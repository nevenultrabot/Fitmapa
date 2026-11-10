'use client';

import { useCallback, useEffect, useState } from 'react';
import { getSupabase, errorMessage } from '@/lib/supabase';
import { formatDateTime, formatTime, dayKey, whatsappLink, viberLink } from '@/lib/format';

export default function Schedule({ userId, week, onAddClick }) {
  const [slots, setSlots] = useState(null);
  const [message, setMessage] = useState(null);
  const [cancelling, setCancelling] = useState(null); // { booking, slot }
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    if (!week) return;
    const { data, error } = await getSupabase()
      .from('slots')
      .select(
        'id, starts_at, ends_at, status, gym_id, gyms(name), bookings(id, status, note, client:profiles!bookings_client_id_fkey(full_name, phone))'
      )
      .eq('trainer_id', userId)
      .gte('starts_at', week.start)
      .lt('starts_at', week.end)
      .order('starts_at');
    if (error) setMessage({ type: 'error', text: error.message });
    setSlots(data || []);
  }, [userId, week]);

  useEffect(() => {
    load();
    const supabase = getSupabase();
    const channel = supabase
      .channel(`panel-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'slots', filter: `trainer_id=eq.${userId}` }, () =>
        load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, load]);

  async function run(id, fn, okText) {
    setBusyId(id);
    const { error } = await fn();
    setBusyId(null);
    setMessage(error ? { type: 'error', text: errorMessage(error) } : okText ? { type: 'ok', text: okText } : null);
    load();
  }

  const setSlot = (slot, status) =>
    run(slot.id, () => getSupabase().rpc('set_slot_status', { p_slot_id: slot.id, p_status: status }));

  const deleteSlot = (slot) => {
    if (!window.confirm(`Obrisati termin ${formatDateTime(slot.starts_at)}?`)) return;
    run(slot.id, () => getSupabase().from('slots').delete().eq('id', slot.id), 'Termin je obrisan.');
  };

  const setDay = (key, status) =>
    run(key, () => getSupabase().rpc('set_day_status', { p_day: key, p_status: status }),
      status === 'blocked' ? 'Dan je blokiran — zakazani termini su ostali netaknuti.' : 'Dan je ponovo otvoren.');

  function confirmCancel(reopen) {
    const { booking } = cancelling;
    setCancelling(null);
    run(booking.id, () => getSupabase().rpc('cancel_booking', { p_booking_id: booking.id, p_reopen: reopen }),
      'Rezervacija je otkazana. Javi se klijentu da ga obavestiš.');
  }

  if (!week || slots === null) return <p className="muted">Učitavam raspored…</p>;

  const now = Date.now();
  const future = slots.filter((s) => new Date(s.starts_at).getTime() > now);
  const booked = future.filter((s) => s.status === 'booked').length;
  const free = future.filter((s) => s.status === 'open').length;

  return (
    <div>
      <div className="week-banner">
        <div>
          <strong>Raspored za ovu nedelju</strong>
          <span className="week-banner-range">{week.range}</span>
        </div>
        <p className="small">
          U nedelju u 22h počinje nova nedelja: ovaj raspored se briše i praviš novi. Dok ga ne napraviš, klijenti ne vide slobodne termine.
        </p>
      </div>

      {message && <p className={`alert alert-${message.type}`} onClick={() => setMessage(null)}>{message.text}</p>}

      <div className="stats">
        <div className="stat">
          <span className="stat-num">{booked}</span>
          <span className="small muted">zakazano</span>
        </div>
        <div className="stat">
          <span className="stat-num">{free}</span>
          <span className="small muted">slobodno</span>
        </div>
        <button className="btn btn-primary" onClick={() => onAddClick()}>+ Dodaj termine</button>
      </div>

      {slots.length === 0 && (
        <div className="card empty-week">
          <strong>Još nemaš raspored za ovu nedelju.</strong>
          <p className="small muted">Klikni „Dodaj termine”: izaberi dane i radno vreme, a termini se prave sami.</p>
        </div>
      )}

      <div className="week-list">
        {week.days.map((day) => {
          const items = slots.filter((s) => dayKey(s.starts_at) === day.key);
          const editable = items.filter((s) => s.status !== 'booked' && new Date(s.starts_at).getTime() > now);
          const allBlocked = editable.length > 0 && editable.every((s) => s.status === 'blocked');

          if (day.past) {
            const doneCount = items.filter((s) => s.status === 'booked').length;
            return (
              <div key={day.key} className="day-past">
                <span className="day-past-name">{day.label}</span>
                <span className="small muted">{doneCount > 0 ? `${doneCount} odrađenih` : 'prošao'}</span>
              </div>
            );
          }

          return (
            <section key={day.key} className={`card day-card ${day.today ? 'is-today' : ''}`}>
              <div className="day-card-head">
                <h3>
                  {day.label}
                  {day.today && <span className="pill">danas</span>}
                </h3>
                <div className="day-card-actions">
                  {editable.length > 0 && (
                    <button
                      className="btn btn-small"
                      disabled={busyId === day.key}
                      onClick={() => setDay(day.key, allBlocked ? 'open' : 'blocked')}
                    >
                      {allBlocked ? 'Otvori ceo dan' : 'Ne radim ovaj dan'}
                    </button>
                  )}
                  <button className="btn btn-small btn-ghost" onClick={() => onAddClick(day.iso)}>
                    + Dodaj
                  </button>
                </div>
              </div>

              {items.length === 0 ? (
                <p className="small muted day-empty">Nema termina — ovaj dan si nedostupan.</p>
              ) : (
                <ul className="slot-rows">
                  {items.map((s) => {
                    const booking = (s.bookings || []).find((b) => b.status === 'confirmed');
                    const past = new Date(s.starts_at).getTime() <= now;
                    return (
                      <li key={s.id} className={`slot-row status-${s.status} ${past ? 'past' : ''}`}>
                        <div className="slot-row-time">
                          <strong>{formatTime(s.starts_at)}</strong>
                          <span className="small muted">–{formatTime(s.ends_at)}</span>
                        </div>
                        <div className="slot-row-info">
                          {s.status === 'booked' && booking ? (
                            <>
                              <strong>{booking.client?.full_name || 'Klijent'}</strong>
                              {booking.client?.phone && (
                                <span className="small">
                                  <a href={`tel:${booking.client.phone}`}>{booking.client.phone}</a>
                                  {' · '}
                                  <a href={whatsappLink(booking.client.phone)} target="_blank" rel="noopener noreferrer">WhatsApp</a>
                                  {' · '}
                                  <a href={viberLink(booking.client.phone)}>Viber</a>
                                </span>
                              )}
                              {booking.note && <span className="small muted">„{booking.note}”</span>}
                            </>
                          ) : (
                            <span className={`status-label ${s.status}`}>
                              {s.status === 'open' ? 'Slobodan' : s.status === 'blocked' ? 'Blokiran (klijenti ga ne vide)' : 'Zauzet'}
                            </span>
                          )}
                          <span className="small muted">{s.gyms?.name}</span>
                        </div>
                        {!past && (
                          <div className="slot-row-actions">
                            {s.status === 'booked' && booking && (
                              <button
                                className="btn btn-small btn-danger"
                                disabled={busyId === booking.id}
                                onClick={() => setCancelling({ booking, slot: s })}
                              >
                                Otkaži
                              </button>
                            )}
                            {s.status === 'open' && (
                              <button className="btn btn-small" disabled={busyId === s.id} onClick={() => setSlot(s, 'blocked')}>
                                Blokiraj
                              </button>
                            )}
                            {s.status === 'blocked' && (
                              <button className="btn btn-small" disabled={busyId === s.id} onClick={() => setSlot(s, 'open')}>
                                Otvori
                              </button>
                            )}
                            {s.status !== 'booked' && (
                              <button
                                className="btn btn-small btn-ghost"
                                disabled={busyId === s.id}
                                onClick={() => deleteSlot(s)}
                                aria-label="Obriši termin"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      {cancelling && (
        <div className="modal-backdrop" onClick={() => setCancelling(null)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2 className="section-title">Otkaži rezervaciju?</h2>
            <p>
              <strong>{cancelling.booking.client?.full_name}</strong>
              <br />
              {formatDateTime(cancelling.slot.starts_at)}
            </p>
            <p className="small muted">Klijent će u aplikaciji videti da si otkazao. Preporuka: javi mu se i porukom.</p>
            <div className="modal-actions column">
              <button className="btn btn-danger" onClick={() => confirmCancel(true)}>
                Otkaži i oslobodi termin za druge
              </button>
              <button className="btn btn-danger btn-outline" onClick={() => confirmCancel(false)}>
                Otkaži i blokiraj termin
              </button>
              <button className="btn" onClick={() => setCancelling(null)}>Ne, vrati se</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
