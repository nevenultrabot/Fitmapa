'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSupabase, errorMessage } from '@/lib/supabase';
import { useSession } from '@/lib/useSession';
import { formatDateTime, formatTime } from '@/lib/format';

const STATUS_LABEL = {
  confirmed: 'Potvrđen',
  cancelled_by_client: 'Otkazao si',
  cancelled_by_trainer: 'Trener je otkazao',
};

export default function MyBookingsPage() {
  const router = useRouter();
  const { loading, user } = useSession();
  const [bookings, setBookings] = useState(null);
  const [message, setMessage] = useState(null);

  const load = useCallback(async () => {
    if (!user) return;
    const supabase = getSupabase();
    const { data } = await supabase
      .from('bookings')
      .select('id, status, note, created_at, trainer_id, slots(starts_at, ends_at, gyms(name)), trainers(profiles!trainers_id_fkey(full_name))')
      .eq('client_id', user.id)
      .order('created_at', { ascending: false });
    const list = (data || []).sort((x, y) => new Date(y.slots?.starts_at) - new Date(x.slots?.starts_at));
    setBookings(list);
  }, [user]);

  useEffect(() => {
    if (!loading && !user) router.push('/prijava?next=/moji-termini');
    load();
  }, [loading, user, load, router]);

  async function cancel(id) {
    if (!window.confirm('Sigurno želiš da otkažeš ovaj termin?')) return;
    const { error } = await getSupabase().rpc('cancel_booking', { p_booking_id: id });
    setMessage(error ? { type: 'error', text: errorMessage(error) } : { type: 'ok', text: 'Termin je otkazan.' });
    load();
  }

  if (loading || bookings === null) return <div className="page"><p className="muted">Učitavam…</p></div>;

  const now = Date.now();
  const upcoming = bookings.filter((b) => b.status === 'confirmed' && new Date(b.slots?.starts_at).getTime() > now);
  const past = bookings.filter((b) => !upcoming.includes(b));

  return (
    <div className="page narrow">
      <h1>Moji termini</h1>
      {message && <p className={`alert alert-${message.type}`}>{message.text}</p>}

      <h2 className="section-title">Predstojeći</h2>
      {upcoming.length === 0 ? (
        <p className="muted">
          Nemaš zakazanih termina. <Link href="/">Pronađi trenera na mapi →</Link>
        </p>
      ) : (
        <ul className="booking-list">
          {upcoming.map((b) => (
            <li key={b.id} className="card booking-card">
              <div>
                <strong>{formatDateTime(b.slots.starts_at)} – {formatTime(b.slots.ends_at)}</strong>
                <div>
                  <Link href={`/trener/${b.trainer_id}`}>{b.trainers?.profiles?.full_name || 'Trener'}</Link>
                  <span className="muted"> · {b.slots.gyms?.name}</span>
                </div>
                {b.note && <p className="small muted">„{b.note}”</p>}
              </div>
              <button className="btn btn-danger btn-small" onClick={() => cancel(b.id)}>
                Otkaži
              </button>
            </li>
          ))}
        </ul>
      )}

      <h2 className="section-title">Prošli i otkazani</h2>
      {past.length === 0 ? (
        <p className="muted">Ništa još.</p>
      ) : (
        <ul className="booking-list">
          {past.map((b) => {
            return (
              <li key={b.id} className="card booking-card column">
                <div className="booking-card-top">
                  <div>
                    <strong>{b.slots ? formatDateTime(b.slots.starts_at) : ''}</strong>
                    <div>
                      <Link href={`/trener/${b.trainer_id}`}>{b.trainers?.profiles?.full_name || 'Trener'}</Link>
                      <span className="muted"> · {b.slots?.gyms?.name}</span>
                    </div>
                  </div>
                  <span className={`pill ${b.status === 'confirmed' ? '' : 'pill-muted'}`}>
                    {b.status === 'confirmed' ? 'Odrađen' : STATUS_LABEL[b.status]}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
