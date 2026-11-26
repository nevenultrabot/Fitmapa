'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FiChevronDown, FiX } from 'react-icons/fi';
import { getSupabase, errorMessage } from '@/lib/supabase';
import { formatDate, formatDateTime, formatDayShort, formatTime, monthKey, monthLabel, whatsappLink } from '@/lib/format';

// Panel → Vežbači.
// Levo: zahtevi + vežbači (klik na vežbača otvara njegove prethodne treninge).
// Desno: istorija svih odrađenih treninga. Na telefonu jedno ispod drugog.
export default function Clients({ userId, onCountChange }) {
  const [requests, setRequests] = useState(null);
  const [list, setList] = useState([]);
  const [trainings, setTrainings] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState(null);
  const [message, setMessage] = useState(null);

  const load = useCallback(async () => {
    const supabase = getSupabase();
    const [r, l, t] = await Promise.all([
      supabase.rpc('my_client_requests'),
      supabase.rpc('trainer_client_list', { p_trainer_id: userId }),
      supabase
        .from('bookings')
        .select('id, client_id, place:gyms(name), slots!inner(starts_at, ends_at, gyms(name)), client:profiles!bookings_client_id_fkey(full_name)')
        .eq('trainer_id', userId)
        .eq('status', 'confirmed')
        .lt('slots.ends_at', new Date().toISOString()),
    ]);
    setRequests(r.data || []);
    setList(l.data || []);
    setTrainings(
      (t.data || [])
        .filter((b) => b.slots)
        .map((b) => ({
          id: b.id,
          clientId: b.client_id,
          name: b.client?.full_name || 'Vežbač',
          start: b.slots.starts_at,
          end: b.slots.ends_at,
          gym: b.place?.name || b.slots.gyms?.name || '',
        }))
        .sort((a, b) => new Date(b.start) - new Date(a.start))
    );
    onCountChange?.((r.data || []).length);
  }, [userId, onCountChange]);

  useEffect(() => {
    load();
  }, [load]);

  const byClient = useMemo(() => {
    const map = new Map();
    for (const t of trainings) {
      if (!map.has(t.clientId)) map.set(t.clientId, []);
      map.get(t.clientId).push(t);
    }
    return map;
  }, [trainings]);

  const months = useMemo(() => {
    const shown = showAll ? trainings : trainings.slice(0, 12);
    const map = new Map();
    for (const t of shown) {
      const k = monthKey(t.start);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(t);
    }
    return [...map.entries()];
  }, [trainings, showAll]);

  async function run(id, fn, ok) {
    setBusy(id);
    const { error } = await fn();
    setBusy(null);
    setMessage(error ? { type: 'error', text: errorMessage(error) } : { type: 'ok', text: ok });
    load();
  }

  const respond = (c, accept) =>
    run(c.client_id, () => getSupabase().rpc('respond_client', { p_client_id: c.client_id, p_accept: accept }),
      accept ? `${c.full_name} je sada tvoj vežbač.` : 'Zahtev je odbijen.');

  const remove = (c) => {
    if (!window.confirm(`Ukloniti ${c.full_name} iz vežbača?`)) return;
    run(c.client_id, () => getSupabase().rpc('remove_trainer_client', { p_other: c.client_id }), 'Uklonjeno.');
  };

  if (requests === null) return <p className="muted">Učitavam…</p>;

  return (
    <div className="clients-panel">
      {message && <p className={`alert alert-${message.type}`} onClick={() => setMessage(null)}>{message.text}</p>}

      <div className="clients-cols">
        {/* LEVO: zahtevi + vežbači */}
        <div className="clients-col">
          {requests.length > 0 && (
            <section className="card">
              <h2 className="section-title">Zahtevi <span className="pill">{requests.length}</span></h2>
              <ul className="client-rows">
                {requests.map((c) => (
                  <li key={c.client_id}>
                    <span className="clients-initial" aria-hidden="true">{c.full_name.charAt(0).toUpperCase()}</span>
                    <span className="client-rows-text">
                      <strong>{c.full_name}</strong>
                      <span className="small muted">
                        zahtev {formatDateTime(c.created_at)}
                        {c.phone && (
                          <>
                            {' · '}
                            <a href={whatsappLink(c.phone)} target="_blank" rel="noopener noreferrer">WhatsApp</a>
                          </>
                        )}
                      </span>
                    </span>
                    <span className="requests-actions">
                      <button className="btn btn-small btn-primary" disabled={busy === c.client_id} onClick={() => respond(c, true)}>Prihvati</button>
                      <button className="btn btn-small btn-danger btn-outline" disabled={busy === c.client_id} onClick={() => respond(c, false)}>Odbij</button>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="card">
            <h2 className="section-title">Moji vežbači · {list.length}</h2>
            {list.length === 0 ? (
              <p className="small muted">
                Još nemaš vežbača. Dodaju te sa tvog profila, a posle prvog odrađenog treninga postaju tvoji automatski.
              </p>
            ) : (
              <ul className="client-acc">
                {list.map((c) => {
                  const done = byClient.get(c.client_id) || [];
                  const isOpen = openId === c.client_id;
                  return (
                    <li key={c.client_id} className={isOpen ? 'open' : ''}>
                      <div className="client-acc-row">
                        <button
                          type="button"
                          className="client-acc-btn"
                          onClick={() => setOpenId(isOpen ? null : c.client_id)}
                          aria-expanded={isOpen}
                        >
                          <span className="clients-initial" aria-hidden="true">{c.full_name.charAt(0).toUpperCase()}</span>
                          <span className="client-rows-text">
                            <strong>{c.full_name}</strong>
                            <span className="small muted">
                              {done.length === 0
                                ? 'još nema odrađenih treninga'
                                : `${done.length} ${done.length === 1 ? 'trening' : 'treninga'} · poslednji ${formatDate(done[0].start)}`}
                            </span>
                          </span>
                          <FiChevronDown className="client-acc-chev" aria-hidden="true" />
                        </button>
                        <button className="btn btn-small btn-ghost" disabled={busy === c.client_id} onClick={() => remove(c)} aria-label={`Ukloni ${c.full_name}`}>
                          <FiX aria-hidden="true" />
                        </button>
                      </div>
                      {isOpen && (
                        <div className="client-acc-body">
                          {done.length === 0 ? (
                            <p className="small muted">Ovde će se pojaviti treninzi čim ih odradite.</p>
                          ) : (
                            <ol className="client-trainings">
                              {done.map((t, i) => (
                                <li key={t.id}>
                                  <span className="client-trainings-n">{done.length - i}.</span>
                                  <span className="client-trainings-date">{formatDayShort(t.start)}</span>
                                  <span className="small muted">
                                    {formatTime(t.start)}–{formatTime(t.end)} · {t.gym}
                                  </span>
                                </li>
                              ))}
                            </ol>
                          )}
                          {c.since && <p className="small muted client-since">Tvoj vežbač od {formatDate(c.since)}</p>}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {/* DESNO: istorija svih treninga */}
        <section className="card clients-col clients-history">
          <div className="clients-history-head">
            <h2 className="section-title">Istorija treninga · {trainings.length}</h2>
            <Link href="/istorija" className="small">Filteri i tabela →</Link>
          </div>
          {trainings.length === 0 ? (
            <p className="small muted">Još nema odrađenih treninga. Pojavljuju se ovde automatski čim prođu.</p>
          ) : (
            <>
              {months.map(([m, items]) => (
                <div key={m} className="clients-history-month">
                  <h3>{monthLabel(m)}</h3>
                  <ul className="history-rows">
                    {items.map((t) => (
                      <li key={t.id}>
                        <span className="history-date">
                          <strong>{formatDayShort(t.start)}</strong>
                          <span className="small muted">{formatTime(t.start)}–{formatTime(t.end)}</span>
                        </span>
                        <span className="history-who">
                          <strong>{t.name}</strong>
                          <span className="small muted">{t.gym}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {trainings.length > 12 && (
                <button className="btn btn-small" onClick={() => setShowAll((v) => !v)}>
                  {showAll ? 'Prikaži manje' : `Prikaži sve (${trainings.length})`}
                </button>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
