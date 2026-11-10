'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import Avatar from '@/components/Avatar';
import { getSupabase, errorMessage } from '@/lib/supabase';
import { useSession } from '@/lib/useSession';
import { useWeek } from '@/lib/useWeek';
import {
  averageRating,
  dayKey,
  formatDateTime,
  formatPrice,
  formatTime,
  instagramLink,
  stars,
  viberLink,
  whatsappLink,
} from '@/lib/format';

export default function TrainerProfilePage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useSession();
  const week = useWeek();

  const [trainer, setTrainer] = useState(undefined);
  const [reviews, setReviews] = useState([]);
  const [slots, setSlots] = useState([]);
  const [activeDay, setActiveDay] = useState(null);
  const [gymFilter, setGymFilter] = useState('all');
  const [picked, setPicked] = useState(null);
  const [lightbox, setLightbox] = useState(null);

  const loadSlots = useCallback(async () => {
    if (!week) return;
    const { data } = await getSupabase()
      .from('slots')
      .select('id, starts_at, ends_at, status, gym_id, gyms(name)')
      .eq('trainer_id', id)
      .neq('status', 'blocked')
      .gt('starts_at', new Date().toISOString())
      .lt('starts_at', week.end)
      .order('starts_at');
    setSlots(data || []);
  }, [id, week]);

  useEffect(() => {
    const supabase = getSupabase();
    Promise.all([
      supabase
        .from('trainers')
        .select('*, profiles!trainers_id_fkey(full_name), trainer_gyms(gyms(id, name, address))')
        .eq('id', id)
        .maybeSingle(),
      supabase.from('reviews').select('*').eq('trainer_id', id).order('created_at', { ascending: false }),
    ]).then(([t, r]) => {
      setTrainer(t.data || null);
      setReviews(r.data || []);
    });
  }, [id]);

  useEffect(() => {
    loadSlots();
    const supabase = getSupabase();
    // Realtime: čim neko zakaže ili trener promeni raspored, kalendar se osveži
    const channel = supabase
      .channel(`slots-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'slots', filter: `trainer_id=eq.${id}` }, () =>
        loadSlots()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, loadSlots]);

  const gyms = useMemo(() => (trainer?.trainer_gyms || []).map((tg) => tg.gyms).filter(Boolean), [trainer]);
  const filtered = useMemo(
    () => (gymFilter === 'all' ? slots : slots.filter((s) => s.gym_id === gymFilter)),
    [slots, gymFilter]
  );
  const byDay = useMemo(() => {
    const m = {};
    for (const s of filtered) (m[dayKey(s.starts_at)] ||= []).push(s);
    return m;
  }, [filtered]);

  const firstUseful =
    week?.days.find((d) => !d.past && (byDay[d.key] || []).some((s) => s.status === 'open')) ||
    week?.days.find((d) => !d.past);
  const currentKey = activeDay || firstUseful?.key;
  const currentDay = week?.days.find((d) => d.key === currentKey);
  const daySlots = byDay[currentKey] || [];
  const rating = averageRating(reviews);
  const isOwn = user?.id === id;

  if (trainer === undefined) return <div className="page"><p className="muted">Učitavam…</p></div>;
  if (trainer === null)
    return (
      <div className="page">
        <p>Ovaj profil ne postoji ili još nije objavljen.</p>
        <Link href="/" className="btn">Nazad na mapu</Link>
      </div>
    );

  const name = trainer.profiles?.full_name || 'Trener';
  const contacts = [
    trainer.whatsapp && { label: 'WhatsApp', href: whatsappLink(trainer.whatsapp), cls: 'c-wa' },
    trainer.viber && { label: 'Viber', href: viberLink(trainer.viber), cls: 'c-viber' },
    trainer.instagram && { label: 'Instagram', href: instagramLink(trainer.instagram), cls: 'c-ig' },
    trainer.contact_phone && { label: 'Pozovi', href: `tel:${trainer.contact_phone}`, cls: '' },
    trainer.contact_email && { label: 'Email', href: `mailto:${trainer.contact_email}`, cls: '' },
  ].filter((c) => c && c.href);

  function pickSlot(slot) {
    if (!user) {
      router.push(`/prijava?next=/trener/${id}`);
      return;
    }
    setPicked(slot);
  }

  return (
    <div className="page profile-page">
      <Link href="/" className="link-back">← Mapa</Link>

      {isOwn && !trainer.is_published && (
        <p className="alert alert-warn">
          Tvoj profil još nije javan. Uključi „Profil je javan” u <Link href="/panel">panelu</Link>.
        </p>
      )}

      {/* ZAGLAVLJE */}
      <section className="hero card">
        <div className="hero-main">
          <Avatar url={trainer.avatar_url} name={name} size="lg" />
          <div className="hero-text">
            <h1 className="profile-name">{name}</h1>
            <p className="hero-meta">
              {rating ? (
                <>
                  <span className="stars">{stars(rating)}</span> {rating.toFixed(1)} · {reviews.length} ocena
                </>
              ) : (
                <span className="muted">Još nema ocena</span>
              )}
              {trainer.years_experience !== null && <span className="muted"> · {trainer.years_experience} god. iskustva</span>}
            </p>
            {trainer.specialties?.length > 0 && (
              <div className="chips">
                {trainer.specialties.map((s) => (
                  <span key={s} className="chip">{s}</span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="hero-side">
          <span className="small muted">Cena po treningu</span>
          <span className="price">{formatPrice(trainer.price_per_session) || 'Po dogovoru'}</span>
          {trainer.price_note && <span className="small prewrap">{trainer.price_note}</span>}
        </div>
        {contacts.length > 0 && (
          <div className="contact-row">
            {contacts.map((c) => (
              <a key={c.label} href={c.href} target="_blank" rel="noopener noreferrer" className={`btn btn-contact ${c.cls}`}>
                {c.label}
              </a>
            ))}
          </div>
        )}
      </section>

      <div className="profile-grid">
        <div className="profile-main">
          {/* KALENDAR */}
          <section className="card">
            <div className="cal-head">
              <h2 className="section-title">Zakaži termin</h2>
              {week && <span className="small muted">Ova nedelja · {week.range}</span>}
            </div>

            {gyms.length > 1 && (
              <div className="chips">
                <button className={gymFilter === 'all' ? 'chip chip-btn active' : 'chip chip-btn'} onClick={() => setGymFilter('all')}>
                  Sve teretane
                </button>
                {gyms.map((g) => (
                  <button
                    key={g.id}
                    className={gymFilter === g.id ? 'chip chip-btn active' : 'chip chip-btn'}
                    onClick={() => setGymFilter(g.id)}
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            )}

            {!week ? (
              <p className="muted">Učitavam raspored…</p>
            ) : (
              <>
                <div className="week-strip">
                  {week.days.map((d) => {
                    const items = byDay[d.key] || [];
                    const free = items.filter((s) => s.status === 'open').length;
                    const cls = [
                      'week-day',
                      d.key === currentKey && 'active',
                      d.past && 'past',
                      !d.past && free > 0 && 'has-free',
                    ]
                      .filter(Boolean)
                      .join(' ');
                    return (
                      <button key={d.key} className={cls} disabled={d.past} onClick={() => setActiveDay(d.key)}>
                        <span className="week-day-name">{d.short}</span>
                        <span className="week-day-num">{d.num}</span>
                        <span className="week-day-count">{d.past ? '·' : free > 0 ? free : '–'}</span>
                      </button>
                    );
                  })}
                </div>

                {currentDay && <p className="day-title">{currentDay.label}</p>}

                {slots.length === 0 ? (
                  <p className="empty-note">
                    Trener još nije objavio raspored za ovu nedelju. Javi mu se direktno preko kontakta iznad.
                  </p>
                ) : daySlots.length === 0 ? (
                  <p className="empty-note">Nema termina ovog dana. Izaberi drugi dan.</p>
                ) : (
                  <div className="slot-grid">
                    {daySlots.map((s) =>
                      s.status === 'open' && !isOwn ? (
                        <button key={s.id} className="slot slot-open" onClick={() => pickSlot(s)}>
                          <strong>{formatTime(s.starts_at)}</strong>
                          {gyms.length > 1 && <span className="small">{s.gyms?.name}</span>}
                        </button>
                      ) : (
                        <div key={s.id} className={`slot ${s.status === 'open' ? 'slot-own' : 'slot-booked'}`}>
                          <strong>{formatTime(s.starts_at)}</strong>
                          <span className="small">{s.status === 'open' ? 'slobodan' : 'Zauzeto'}</span>
                        </div>
                      )
                    )}
                  </div>
                )}
                <p className="small muted">Plaćanje je na licu mesta, po dogovoru sa trenerom.</p>
              </>
            )}
          </section>

          {(trainer.bio || trainer.certificates) && (
            <section className="card">
              <h2 className="section-title">O meni</h2>
              {trainer.bio && <p className="prewrap">{trainer.bio}</p>}
              {trainer.certificates && (
                <>
                  <h3 className="sub-title">Sertifikati</h3>
                  <p className="prewrap">{trainer.certificates}</p>
                </>
              )}
            </section>
          )}

          {trainer.photos?.length > 0 && (
            <section className="card">
              <h2 className="section-title">Galerija</h2>
              <div className="gallery">
                {trainer.photos.map((url) => (
                  <button key={url} className="gallery-item" onClick={() => setLightbox(url)}>
                    <img src={url} alt="" />
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="card">
            <h2 className="section-title">Ocene klijenata</h2>
            {reviews.length === 0 ? (
              <p className="muted">Još nema ocena. Ocenu može ostaviti samo klijent posle odrađenog treninga.</p>
            ) : (
              <ul className="reviews">
                {reviews.map((r) => (
                  <li key={r.id}>
                    <div className="review-head">
                      <strong>{r.client_name || 'Klijent'}</strong>
                      <span className="stars">{stars(r.rating)}</span>
                    </div>
                    {r.comment && <p>{r.comment}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="profile-side">
          {gyms.length > 0 && (
            <section className="card">
              <h2 className="section-title">Gde trenira</h2>
              <ul className="plain-list">
                {gyms.map((g) => (
                  <li key={g.id}>
                    <strong>{g.name}</strong>
                    {g.address && <div className="small muted">{g.address}</div>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>

      {picked && (
        <BookingDialog slot={picked} trainerName={name} onClose={() => setPicked(null)} onBooked={() => loadSlots()} />
      )}

      {lightbox && (
        <div className="modal-backdrop" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" className="lightbox-img" />
        </div>
      )}
    </div>
  );
}

function BookingDialog({ slot, trainerName, onClose, onBooked }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function confirm() {
    setBusy(true);
    setError('');
    const { error } = await getSupabase().rpc('book_slot', { p_slot_id: slot.id, p_note: note });
    setBusy(false);
    if (error) setError(errorMessage(error));
    else setDone(true);
    onBooked();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        {done ? (
          <>
            <h2 className="section-title">Termin je zakazan ✓</h2>
            <p>
              {trainerName} · {formatDateTime(slot.starts_at)}
              <br />
              <span className="muted">{slot.gyms?.name}</span>
            </p>
            <p className="small muted">Plaćanje je na licu mesta. Ako trener otkaže, videćeš to u „Moji termini”.</p>
            <div className="modal-actions">
              <Link href="/moji-termini" className="btn btn-primary">Moji termini</Link>
              <button className="btn" onClick={onClose}>Zatvori</button>
            </div>
          </>
        ) : (
          <>
            <h2 className="section-title">Potvrdi rezervaciju</h2>
            <p>
              <strong>{trainerName}</strong>
              <br />
              {formatDateTime(slot.starts_at)} – {formatTime(slot.ends_at)}
              <br />
              <span className="muted">{slot.gyms?.name}</span>
            </p>
            <label className="field">
              <span>Poruka treneru (nije obavezno)</span>
              <textarea
                className="input"
                rows={3}
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Npr. prvi trening, cilj mi je…"
              />
            </label>
            {error && <p className="alert alert-error">{error}</p>}
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={confirm} disabled={busy}>
                {busy ? 'Zakazujem…' : 'Zakaži'}
              </button>
              <button className="btn" onClick={onClose}>Odustani</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
