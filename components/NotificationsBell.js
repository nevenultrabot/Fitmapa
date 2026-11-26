'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FiBell, FiCheck } from 'react-icons/fi';
import { getSupabase } from '@/lib/supabase';
import {
  pushState, enablePush, disablePush, accountHasPush, setAppBadge, clearShownNotifications, PUSH_EVENT,
} from '@/lib/push';
import { formatDayShort, formatTime } from '@/lib/format';

// Zvono gore desno.
//  • trener: poslednje rezervacije, zahtevi i otkazivanja
//  • vežbač: samo treninzi koje je trener otkazao
// + uključivanje/isključivanje push obaveštenja na ovom uređaju.
// "Pročitano" se pamti u bazi (my_notif_state / mark_notifications_seen), pa važi za sve uređaje.
// Ako SQL 010 još nije pokrenut, pamti se lokalno na uređaju.
const SEEN_KEY = 'gymby-notif-seen';
// trenerove sopstvene radnje se ne broje kao novo obaveštenje
const OWN = ['cancelled_by_trainer', 'declined'];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const LABEL = {
  confirmed: 'Novi trening',
  pending: 'Zahtev za drugu teretanu',
  cancelled_by_client: 'Otkazao trening',
  declined: 'Odbijen zahtev',
  expired: 'Zahtev je istekao',
  cancelled_by_trainer: 'Otkazao si',
};

export default function NotificationsBell({ userId, role }) {
  const isTrainer = role === 'trainer';
  const home = isTrainer ? '/panel' : '/moji-termini';
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [clientRequests, setClientRequests] = useState([]);
  const [push, setPush] = useState(null);
  const [elsewhere, setElsewhere] = useState(false); // uključeno na nekom drugom uređaju
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [seen, setSeen] = useState(0); // do kada je sve pročitano (brojka)
  const [highlight, setHighlight] = useState(0); // šta označiti kao novo dok je zvonce otvoreno
  const ref = useRef(null);
  const pathname = usePathname();

  const load = useCallback(async () => {
    const supabase = getSupabase();
    const bookings = isTrainer
      ? supabase
          .from('bookings')
          .select('id, status, created_at, cancelled_at, slots(starts_at), client:profiles!bookings_client_id_fkey(full_name)')
          .eq('trainer_id', userId)
          .order('created_at', { ascending: false })
          .limit(12)
      : supabase
          .from('bookings')
          .select('id, status, created_at, cancelled_at, slots(starts_at), trainers(profiles!trainers_id_fkey(full_name))')
          .eq('client_id', userId)
          .eq('status', 'cancelled_by_trainer')
          .order('cancelled_at', { ascending: false, nullsFirst: false })
          .limit(12);
    const [b, r, st] = await Promise.all([
      bookings,
      isTrainer ? supabase.rpc('my_client_requests') : Promise.resolve({ data: [] }),
      supabase.rpc('my_notif_state'),
    ]);
    setItems(b.data || []);
    setClientRequests(r.data || []);
    let at = 0;
    const row = Array.isArray(st.data) ? st.data[0] : null;
    if (!st.error && row) {
      at = row.seen_at && !String(row.seen_at).includes('infinity') ? new Date(row.seen_at).getTime() : 0;
    } else {
      try {
        at = Number(localStorage.getItem(SEEN_KEY) || 0);
      } catch {}
    }
    setSeen((prev) => Math.max(prev, at));
    setHighlight((prev) => Math.max(prev, at));
  }, [userId, isTrainer]);

  useEffect(() => {
    load();
  }, [load, pathname]);

  // osveži kad se aplikacija vrati u prvi plan ili stigne push dok je otvorena
  useEffect(() => {
    const onVisible = () => document.visibilityState === 'visible' && load();
    const onMsg = (e) => e.data?.type === 'gymby-push' && load();
    document.addEventListener('visibilitychange', onVisible);
    navigator.serviceWorker?.addEventListener('message', onMsg);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      navigator.serviceWorker?.removeEventListener('message', onMsg);
    };
  }, [load]);

  useEffect(() => {
    const check = async () => {
      const st = await pushState().catch(() => 'unsupported');
      setPush(st);
      setElsewhere(st !== 'on' && (await accountHasPush().catch(() => false)));
    };
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
  const isNew = (b, since) => (!isTrainer || !OWN.includes(b.status)) && eventTime(b) > since;
  const newRequests = (since) => clientRequests.filter((c) => new Date(c.created_at).getTime() > since).length;
  const unseen = items.filter((b) => isNew(b, seen)).length + newRequests(seen);

  // isti broj i na ikonici aplikacije na telefonu
  useEffect(() => {
    setAppBadge(unseen);
  }, [unseen]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      // brojka odmah nestaje; nove stavke ostaju označene dok je zvonce otvoreno
      const now = Date.now();
      setSeen(now);
      setAppBadge(0);
      clearShownNotifications();
      try {
        localStorage.setItem(SEEN_KEY, String(now));
      } catch {}
      getSupabase().rpc('mark_notifications_seen').then(() => {}, () => {});
    }
  }

  // kad se zvonce zatvori (klik van, Esc, druga stranica), oznake "novo" nestaju
  useEffect(() => {
    if (!open) setHighlight((h) => Math.max(h, seen));
  }, [open, seen]);

  async function turnOn() {
    setBusy(true);
    setError('');
    try {
      await enablePush();
    } catch (e) {
      // 'dismissed' = zatvorio je prozor za dozvolu; 'denied' = prikazuje se poruka ispod
      if (e.message !== 'dismissed' && e.message !== 'denied')
        setError('Uključivanje nije uspelo. Proveri internet i pokušaj ponovo.');
    }
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
    <div className={`bell ${open ? 'open' : ''} ${isTrainer ? '' : 'for-client'}`} ref={ref}>
      <button type="button" className="bell-btn" onClick={toggle} aria-label="Obaveštenja" aria-expanded={open}>
        <FiBell aria-hidden="true" />
        {unseen > 0 && <span className="bell-count">{unseen > 9 ? '9+' : unseen}</span>}
      </button>

      <div className="bell-list" role="dialog" aria-label="Obaveštenja">
        <div className="bell-head">
          <strong>Obaveštenja</strong>
          <Link href={home} className="small">{isTrainer ? 'Raspored →' : 'Moji termini →'}</Link>
        </div>

        {clientRequests.length > 0 && (
          <Link href="/panel?tab=clients" className={`bell-item ${newRequests(highlight) > 0 ? 'is-new' : ''}`}>
            <span className="bell-dot" aria-hidden="true" />
            <span>
              <strong>
                {clientRequests.length === 1
                  ? '1 vežbač želi da te doda'
                  : `${clientRequests.length} vežbača žele da te dodaju`}
              </strong>
              <small>Prihvati ili odbij u kartici Vežbači</small>
            </span>
          </Link>
        )}

        {items.length === 0 && clientRequests.length === 0 ? (
          <p className="bell-empty">
            {isTrainer ? 'Još nema rezervacija.' : 'Nema novih obaveštenja. Ovde ti javljamo ako trener otkaže trening.'}
          </p>
        ) : (
          items.map((b) => (
            <Link key={b.id} href={home} className={`bell-item ${isNew(b, highlight) ? 'is-new' : ''} st-${b.status}`}>
              <span className="bell-dot" aria-hidden="true" />
              <span>
                <strong>
                  {isTrainer
                    ? `${LABEL[b.status] || 'Rezervacija'}: ${b.client?.full_name || 'Klijent'}`
                    : `Trener je otkazao trening: ${b.trainers?.profiles?.full_name || 'Trener'}`}
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
              <span>
                {elsewhere
                  ? 'Push je uključen na drugom uređaju (npr. telefonu). Na ovom je isključen.'
                  : 'Push obaveštenja na ovom uređaju su isključena.'}
                {error && <span className="push-card-error"> {error}</span>}
              </span>
              <button className="btn btn-small btn-primary" onClick={turnOn} disabled={busy}>
                {busy ? 'Uključujem…' : elsewhere ? 'Uključi i ovde' : 'Uključi'}
              </button>
            </>
          ) : push === 'ios-install' ? (
            <span>Na iPhone-u: Podeli → Dodaj na početni ekran, pa otvori sa ikonice i uključi ovde.</span>
          ) : push === 'denied' ? (
            <span>Obaveštenja su blokirana u pregledaču (ikonica pored adrese → Obaveštenja → Dozvoli).</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
