'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FiBell, FiCheck } from 'react-icons/fi';
import { getSupabase } from '@/lib/supabase';
import { pushState, enablePush, disablePush, PUSH_EVENT } from '@/lib/push';
import { formatDayShort, formatTime } from '@/lib/format';

// Zvono gore desno (samo za trenere): poslednje rezervacije, zahtevi i otkazivanja
// + uključivanje/isključivanje push obaveštenja na ovom uređaju.
const SEEN_KEY = 'gymby-notif-seen';
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const LABEL = {
  confirmed: 'Novi trening',
  pending: 'Zahtev za drugu teretanu',
  cancelled_by_client: 'Otkazao trening',
  declined: 'Odbijen zahtev',
  expired: 'Zahtev je istekao',
  cancelled_by_trainer: 'Otkazao si',
};

export default function NotificationsBell({ userId }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [clientRequests, setClientRequests] = useState(0);
  const [push, setPush] = useState(null);
  const [busy, setBusy] = useState(false);
  const [seen, setSeen] = useState(0);
  const ref = useRef(null);
  const pathname = usePathname();

  const load = useCallback(async () => {
    const supabase = getSupabase();
    const [b, r] = await Promise.all([
      supabase
        .from('bookings')
        .select('id, status, created_at, cancelled_at, slots(starts_at), client:profiles!bookings_client_id_fkey(full_name)')
        .eq('trainer_id', userId)
        .order('created_at', { ascending: false })
        .limit(12),
      supabase.rpc('my_client_requests'),
    ]);
    setItems(b.data || []);
    setClientRequests((r.data || []).length);
  }, [userId]);

  useEffect(() => {
    try {
      setSeen(Number(localStorage.getItem(SEEN_KEY) || 0));
    } catch {}
    load();
  }, [load, pathname]);

  useEffect(() => {
    const check = () => pushState().then(setPush).catch(() => setPush('unsupported'));
    check();
    window.addEventListener(PUSH_EVENT, check);
    return () => window.removeEventListener(PUSH_EVENT, check);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const eventTime = (b) => new Date(b.cancelled_at || b.created_at).getTime();
  const unseen = items.filter((b) => eventTime(b) > seen).length + clientRequests;

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      const now = Date.now();
      try {
        localStorage.setItem(SEEN_KEY, String(now));
      } catch {}
      // tačka nestaje kad se otvori, a nove stavke ostaju označene dok je otvoreno
      setTimeout(() => setSeen(now), 4000);
    }
  }

  async function turnOn() {
    setBusy(true);
    try {
      await enablePush();
    } catch {}
    setPush(await pushState().catch(() => 'unsupported'));
    setBusy(false);
  }

  async function turnOff() {
    setBusy(true);
    await disablePush().catch(() => {});
    setPush(await pushState().catch(() => 'unsupported'));
    setBusy(false);
  }

  return (
    <div className={`bell ${open ? 'open' : ''}`} ref={ref}>
      <button type="button" className="bell-btn" onClick={toggle} aria-label="Obaveštenja" aria-expanded={open}>
        <FiBell aria-hidden="true" />
        {unseen > 0 && <span className="bell-count">{unseen > 9 ? '9+' : unseen}</span>}
      </button>

      <div className="bell-list" role="dialog" aria-label="Obaveštenja">
        <div className="bell-head">
          <strong>Obaveštenja</strong>
          <Link href="/panel" className="small">Raspored →</Link>
        </div>

        {clientRequests > 0 && (
          <Link href="/panel?tab=clients" className="bell-item is-new">
            <span className="bell-dot" aria-hidden="true" />
            <span>
              <strong>{clientRequests === 1 ? '1 vežbač želi da te doda' : `${clientRequests} vežbača žele da te dodaju`}</strong>
              <small>Prihvati ili odbij u kartici Vežbači</small>
            </span>
          </Link>
        )}

        {items.length === 0 && clientRequests === 0 ? (
          <p className="bell-empty">Još nema rezervacija.</p>
        ) : (
          items.map((b) => (
            <Link key={b.id} href="/panel" className={`bell-item ${eventTime(b) > seen ? 'is-new' : ''} st-${b.status}`}>
              <span className="bell-dot" aria-hidden="true" />
              <span>
                <strong>
                  {LABEL[b.status] || 'Rezervacija'}: {b.client?.full_name || 'Klijent'}
                </strong>
                <small>{b.slots?.starts_at ? cap(`${formatDayShort(b.slots.starts_at)} u ${formatTime(b.slots.starts_at)}`) : ''}</small>
              </span>
            </Link>
          ))
        )}

        <div className="bell-push">
          {push === 'on' ? (
            <>
              <span className="bell-push-on">
                <FiCheck aria-hidden="true" /> Push obaveštenja uključena na ovom uređaju
              </span>
              <button className="link-btn small" onClick={turnOff} disabled={busy}>
                Isključi
              </button>
            </>
          ) : push === 'off' ? (
            <>
              <span>Push obaveštenja na ovom uređaju su isključena.</span>
              <button className="btn btn-small btn-primary" onClick={turnOn} disabled={busy}>
                Uključi
              </button>
            </>
          ) : push === 'ios-install' ? (
            <span>Na iPhone-u: Podeli → Dodaj na početni ekran, pa otvori sa ikonice i uključi u Panelu.</span>
          ) : push === 'denied' ? (
            <span>Obaveštenja su blokirana u pregledaču (ikonica pored adrese → Obaveštenja → Dozvoli).</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
