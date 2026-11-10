export const TZ = 'Europe/Belgrade';
export const LOCALE = 'sr-Latn-RS';

// Ključ dana u beogradskoj zoni: "2026-11-12"
export function dayKey(date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(date)
  );
}

export function formatDayLong(date) {
  return new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' }).format(
    new Date(date)
  );
}

export function formatDayShort(date) {
  return new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'numeric' }).format(
    new Date(date)
  );
}

export function formatTime(date) {
  return new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(
    new Date(date)
  );
}

export function formatDateTime(date) {
  return `${formatDayLong(date)}, ${formatTime(date)}`;
}

export function formatPrice(value) {
  if (value === null || value === undefined || value === '') return null;
  return `${Number(value).toLocaleString(LOCALE)} RSD`;
}

// Grupiše termine po danu: [{ key, label, items: [...] }]
export function groupByDay(slots) {
  const map = new Map();
  for (const s of slots) {
    const key = dayKey(s.starts_at);
    if (!map.has(key)) map.set(key, { key, label: formatDayLong(s.starts_at), items: [] });
    map.get(key).items.push(s);
  }
  return [...map.values()];
}

// Linkovi za kontakt
export function digitsOnly(phone) {
  let d = String(phone || '').replace(/[^\d]/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = '381' + d.slice(1); // srpski broj bez pozivnog
  return d;
}

export function whatsappLink(phone) {
  const d = digitsOnly(phone);
  return d ? `https://wa.me/${d}` : null;
}

export function viberLink(phone) {
  const d = digitsOnly(phone);
  return d ? `viber://chat?number=%2B${d}` : null;
}

export function instagramLink(handle) {
  if (!handle) return null;
  const h = String(handle).trim();
  if (h.startsWith('http')) return h;
  return `https://instagram.com/${h.replace(/^@/, '')}`;
}

export function averageRating(reviews) {
  if (!reviews || reviews.length === 0) return null;
  return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
}

export function stars(n) {
  const full = Math.round(n);
  return '★★★★★'.slice(0, full) + '☆☆☆☆☆'.slice(0, 5 - full);
}
