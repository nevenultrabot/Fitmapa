// Gymby — slanje push obaveštenja treneru (Supabase Edge Function "push-notify").
//
// Poziva je baza (okidač na tabeli bookings) sa { event_id }. Funkcija:
//   1. uzme taj događaj iz push_events, samo ako još nije poslat i nije stariji od 10 min
//      (zato ne treba nikakva lozinka — niko ne može da pošalje nešto što baza nije tražila),
//   2. pročita rezervaciju i pretplate trenera,
//   3. pošalje šifrovano obaveštenje na svaki njegov uređaj (Web Push standard).
//
// Tajna: VAPID_PRIVATE_KEY (Edge Functions → Secrets). Javni ključ je ispod i u lib/push.js.
// Podešavanje funkcije: "Verify JWT" mora biti ISKLJUČENO.

const VAPID_PUBLIC_KEY = 'BAte5mm2msJAUllv1S5yd_Flwl3mm5V1ruAr9R8L-NOWGWNMP9W_g4H_BZByRntje-fOac1Y3txPIRhVZM31ddQ';
const VAPID_SUBJECT = 'https://fitmapa.vercel.app';
const SITE = 'https://fitmapa.vercel.app';

const enc = new TextEncoder();

export function b64uDecode(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}
export function b64uEncode(buf) {
  let s = '';
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function concat(...parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parts) {
    out.set(p, i);
    i += p.length;
  }
  return out;
}
async function hkdf(salt, ikm, info, length) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8));
}

// RFC 8291 (aes128gcm). `fixed` služi samo za proveru sa primerom iz standarda.
export async function encryptPayload(payload, p256dh, authSecret, fixed) {
  const uaPublic = b64uDecode(p256dh);
  const auth = b64uDecode(authSecret);

  let asPrivate, asPublic;
  if (fixed) {
    asPublic = b64uDecode(fixed.publicKey);
    asPrivate = await crypto.subtle.importKey(
      'jwk',
      { kty: 'EC', crv: 'P-256', d: fixed.privateKey, x: b64uEncode(asPublic.slice(1, 33)), y: b64uEncode(asPublic.slice(33)) },
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      ['deriveBits']
    );
  } else {
    const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    asPrivate = pair.privateKey;
    asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  }

  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, asPrivate, 256));

  const ikm = await hkdf(auth, ecdhSecret, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const salt = fixed ? b64uDecode(fixed.salt) : crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);

  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(payload, new Uint8Array([2])))
  );

  const header = new Uint8Array(21 + asPublic.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = asPublic.length;
  header.set(asPublic, 21);
  return concat(header, cipher);
}

// RFC 8292 (VAPID): potpis koji dokazuje push servisu da poruka stiže od Gymby-ja
export async function vapidHeader(endpoint, publicKey, privateKey, subject) {
  const pub = b64uDecode(publicKey);
  const key = await crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', d: privateKey, x: b64uEncode(pub.slice(1, 33)), y: b64uEncode(pub.slice(33)) },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
  const head = b64uEncode(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = b64uEncode(
    enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject }))
  );
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${head}.${body}`));
  return `vapid t=${head}.${body}.${b64uEncode(sig)}, k=${publicKey}`;
}

export async function sendPush(sub, message, privateKey) {
  const body = await encryptPayload(enc.encode(JSON.stringify(message)), sub.p256dh, sub.auth);
  return fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidHeader(sub.endpoint, VAPID_PUBLIC_KEY, privateKey, VAPID_SUBJECT),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '86400',
      Urgency: 'high',
    },
    body,
  });
}

function when(iso) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('sr-Latn-RS', {
      timeZone: 'Europe/Belgrade',
      weekday: 'short',
      day: 'numeric',
      month: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value])
  );
  return `${p.weekday} ${p.day}.${p.month}. u ${p.hour}:${p.minute}`;
}

export function buildMessage(kind, b) {
  const who = b.client?.full_name || 'Klijent';
  const place = b.place?.name || b.slots?.gyms?.name || '';
  const at = b.slots?.starts_at ? when(b.slots.starts_at) : '';
  if (kind === 'request')
    return { title: `Zahtev za trening: ${who}`, body: `${at} · ${place}. Potvrdi ili odbij u roku od 12h.`, url: '/panel', tag: b.id };
  if (kind === 'client_cancelled')
    return { title: `Otkazan trening: ${who}`, body: `${at} · ${place}. Termin je ponovo slobodan.`, url: '/panel', tag: b.id };
  return { title: `Novi trening: ${who}`, body: `${at} · ${place}`, url: '/panel', tag: b.id };
}

async function handle(req) {
  const url = Deno.env.get('SUPABASE_URL');
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  if (!url || !service || !privateKey) return new Response('missing config', { status: 500 });

  const { event_id } = await req.json().catch(() => ({}));
  if (!event_id) return new Response('bad request', { status: 400 });

  const rest = (path, init = {}) =>
    fetch(`${url}/rest/v1/${path}`, {
      ...init,
      headers: { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
    });

  // preuzmi događaj samo jednom
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const claimed = await rest(
    `push_events?id=eq.${Number(event_id)}&sent_at=is.null&created_at=gte.${since}&select=booking_id,kind`,
    { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ sent_at: new Date().toISOString() }) }
  ).then((r) => r.json());
  const ev = Array.isArray(claimed) ? claimed[0] : null;
  if (!ev) return new Response('nothing to send');

  const [booking] = await rest(
    `bookings?id=eq.${ev.booking_id}&select=id,trainer_id,place:gyms(name),slots(starts_at,gyms(name)),client:profiles!bookings_client_id_fkey(full_name)`
  ).then((r) => r.json());
  if (!booking) return new Response('no booking');

  const subs = await rest(`push_subscriptions?user_id=eq.${booking.trainer_id}&select=id,endpoint,p256dh,auth`).then((r) => r.json());
  const message = buildMessage(ev.kind, booking);

  // broj nepročitanih → telefon ga stavi na ikonicu aplikacije (SQL 010: unseen_count)
  const badge = await rest('rpc/unseen_count', { method: 'POST', body: JSON.stringify({ p_user: booking.trainer_id }) })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  if (typeof badge === 'number') message.badge = badge;

  let sent = 0;
  for (const sub of subs || []) {
    try {
      const res = await sendPush(sub, message, privateKey);
      if (res.status === 404 || res.status === 410) {
        await rest(`push_subscriptions?id=eq.${sub.id}`, { method: 'DELETE' }); // uređaj se odjavio
      } else if (res.ok) {
        sent++;
      } else {
        console.log('push odbijen', res.status, await res.text());
      }
    } catch (e) {
      console.log('push greška', String(e));
    }
  }
  return new Response(JSON.stringify({ sent }), { headers: { 'Content-Type': 'application/json' } });
}

if (typeof Deno !== 'undefined') Deno.serve(handle);
