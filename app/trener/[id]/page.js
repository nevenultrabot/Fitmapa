'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import Avatar from '@/components/Avatar';
import { getSupabase, errorMessage } from '@/lib/supabase';
import { useSession } from '@/lib/useSession';
import {
  averageRating,
  formatDateTime,
  formatDayShort,
  formatPrice,
  formatTime,
  groupByDay,
  instagramLink,
  stars,
  viberLink,
  whatsappLink,
} from '@/lib/format';

const DAYS_AHEAD = 21;

export default function TrainerProfilePage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useSession();

  const [trainer, setTrainer] = useState(undefined);
  const [reviews, setReviews] = useState([]);
  const [slots, setSlots] = useState([]);
  const [activeDay, setActiveDay] = useState(null);
  const [gymFilter, setGymFilter] = useState('all');
  const [picked, setPicked] = useState(null);
  const [lightbox, setLightbox] = useState(null);

  const loadSlots = useCallback(async () => {
    const now = new Date();
    const until = new Date(now.getTime() + DAYS_AHEAD * 86400000);
    const { data } = await getSupabase()
      .from('slots')
      .select('id, starts_at, ends_at, status, gym_id, gyms(name)')
      .eq('trainer_id', id)
      .neq('status', 'blocked')
      .gt('starts_at', now.toISOString())
      .lt('starts_at', until.toISOString())
      .order('starts_at');
    setSlots(data || []);
  }, [id]);

  useEffect(() => {
    const supabase = getSupabase();
    (async () => {
      const [t, r] = await Promise.all([
        supabase
          .from('trainers')
          .select('*, profiles!trainers_id_fkey(full_name), trainer_gyms(gyms(id, name, address))')
          .eq('id', id)
          .maybeSingle(),
        supabase.from('reviews').select('*').eq('trainer_id', id).order('created_at', { ascending: false }),
      ]);
      setTrainer(t.data || null);
      setReviews(r.data || []);
    })();
    loadSlots();

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
  const filteredSlots = useMemo(
    () => (gymFilter === 'all' ? slots : slots.filter((s) => s.gym_id === gymFilter)),
    [slots, gymFilter]
  );
  const days = useMemo(() => groupByDay(filteredSlots), [filteredSlots]);
  const currentDay = days.find((d) => d.key === activeDay) || days[0] || null;
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

      <section className="profile-head">
        <Avatar url={trainer.avatar_url} name={name} size="lg" />
        <div>
          <h1 className="profile-name">{name}</h1>
          <p className="muted">
            {rating ? <span className="stars">{stars(rating)}</span> : null}
            {rating ? ` ${rating.toFixed(1)} · ${reviews.length} ${reviews.length === 1 ? 'ocena' : 'ocena'}` : 'Još nema ocena'}
          </p>
          {trainer.specialties?.length > 0 && (
            <div className="chips">
              {trainer.specialties.map((s) => (
                <span key={s} className="chip">{s}</span>
              ))}
            </div>
          )}
        </div>
      </section>

      {contacts.length > 0 && (
        <div className="contact-row">
          {contacts.map((c) => (
            <a key={c.label} href={c.href} target="_blank" rel="noopener noreferrer" className={`btn btn-contact ${c.cls}`}>
              {c.label}
            </a>
          ))}
        </div>
      )}

      <div className="profile-grid">
        <div className="profile-main">
          {/* KALENDAR */}
          <section className="card">
            <h2 className="section-title">Zakaži termin</h2>
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

            {days.length === 0 ? (
              <p className="muted">Trener trenutno nema objavljenih termina u naredne {DAYS_AHEAD} dana. Javi mu se direktno preko kontakta iznad.</p>
            ) : (
              <>
                <div className="day-tabs">
                  {days.map((d) => {
                    const free = d.items.filter((s) => s.status === 'open').length;
                    return (
                      <button
                        key={d.key}
                        className={currentDay?.key === d.key ? 'day-tab active' : 'day-tab'}
                        onClick={() => setActiveDay(d.key)}
                      >
                        <span>{formatDayShort(d.items[0].starts_at)}</span>
                        <span className="small">{free > 0 ? `${free} slob.` : 'pun'}</span>
                      </button>
                    );
                  })}
                </div>
                {currentDay && (
                  <div className="slot-grid">
                    {currentDay.items.map((s) =>
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

          {/* O TRENERU */}
          {(trainer.bio || trainer.certificates || trainer.years_experience !== null) && (
            <section className="card">
              <h2 className="section-title">O meni</h2>
              {trainer.bio && <p className="prewrap">{trainer.bio}</p>}
              <dl className="facts">
                {trainer.years_experience !== null && (
                  <>
                    <dt>Iskustvo</dt>
                    <dd>{trainer.years_experience} {trainer.years_experience === 1 ? 'godina' : 'godina'}</dd>
                  </>
                )}
                {trainer.certificates && (
                  <>
                    <dt>Sertifikati</dt>
                    <dd className="prewrap">{trainer.certificates}</dd>
                  </>
                )}
              </dl>
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
          <section className="card">
            <h2 className="section-title">Cena</h2>
            <p className="price">{formatPrice(trainer.price_per_session) || 'Po dogovoru'}</p>
            {trainer.price_per_session !== null && <p className="small muted">po treningu</p>}
            {trainer.price_note && <p className="small prewrap">{trainer.price_note}</p>}
          </section>
          {gyms.length > 0 && (
            <section className="card">
              <h2 className="section-title">Teretane</h2>
              <ul className="plain-list">
                {gyms.map((g) => (
                  <li key={g.id}>
                    <strong>{g.name}</strong>
                    {g.address && <span className="small muted"> · {g.address}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>

      {picked && (
        <BookingDialog
          slot={picked}
          trainerName={name}
          onClose={() => setPicked(null)}
          onBooked={() => loadSlots()}
        />
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
    if (error) {
      setError(errorMessage(error));
      onBooked();
      return;
    }
    setDone(true);
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
