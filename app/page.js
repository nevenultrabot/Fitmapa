'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import MapView from '@/components/MapView';
import Avatar from '@/components/Avatar';
import { getSupabase } from '@/lib/supabase';
import { averageRating, formatDayShort, formatPrice, formatTime } from '@/lib/format';

function distanceKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export default function HomePage() {
  const [gyms, setGyms] = useState([]);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [userPoint, setUserPoint] = useState(null);
  const [query, setQuery] = useState('');
  const [sheetOpen, setSheetOpen] = useState(true);

  useEffect(() => {
    getSupabase()
      .from('gyms')
      .select('id, name, address, lat, lng, image_url, trainer_gyms(trainers(id))')
      .order('name')
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else
          setGyms(
            (data || []).map((g) => ({
              ...g,
              trainerCount: (g.trainer_gyms || []).filter((tg) => tg.trainers).length,
            }))
          );
      });
  }, []);

  const visibleGyms = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = gyms.filter((g) => !q || g.name.toLowerCase().includes(q) || (g.address || '').toLowerCase().includes(q));
    if (userPoint) {
      list = list
        .map((g) => ({ ...g, distance: distanceKm(userPoint, g) }))
        .sort((a, b) => a.distance - b.distance);
    }
    return list;
  }, [gyms, query, userPoint]);

  const selectedGym = gyms.find((g) => g.id === selectedId) || null;

  function select(id) {
    setSelectedId(id);
    setSheetOpen(true);
  }

  return (
    <div className="map-page">
      <MapView gyms={gyms} selectedId={selectedId} onSelect={select} onLocated={setUserPoint} autoLocate />

      <aside className={`sheet ${sheetOpen ? 'open' : 'closed'}`}>
        <button className="sheet-handle" onClick={() => setSheetOpen((o) => !o)} aria-label="Prikaži ili sakrij listu">
          <span />
        </button>

        {error && <p className="alert alert-error">Greška pri učitavanju: {error}</p>}

        {selectedGym ? (
          <GymPanel gym={selectedGym} onBack={() => setSelectedId(null)} />
        ) : (
          <div className="sheet-body">
            <h1 className="sheet-title">Teretane</h1>
            <p className="muted small">Izaberi teretanu na mapi ili sa liste da vidiš njene personalne trenere.</p>
            <input
              className="input"
              placeholder="Pretraži teretane…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <ul className="gym-list">
              {visibleGyms.map((g) => (
                <li key={g.id}>
                  <button className="gym-row" onClick={() => select(g.id)}>
                    {g.image_url ? (
                      <img src={g.image_url} alt="" className="gym-thumb" />
                    ) : (
                      <span className="gym-thumb gym-thumb-empty">{g.name.charAt(0)}</span>
                    )}
                    <span className="gym-row-text">
                      <strong>{g.name}</strong>
                      <span className="muted small">
                        {g.address || ''}
                        {g.distance !== undefined ? ` · ${g.distance.toFixed(1)} km` : ''}
                      </span>
                    </span>
                    <span className="pill">{g.trainerCount} {g.trainerCount === 1 ? 'trener' : 'trenera'}</span>
                  </button>
                </li>
              ))}
              {gyms.length > 0 && visibleGyms.length === 0 && <li className="muted">Nema rezultata.</li>}
            </ul>
          </div>
        )}
      </aside>
    </div>
  );
}

function GymPanel({ gym, onBack }) {
  const [trainers, setTrainers] = useState(null);

  useEffect(() => {
    let active = true;
    setTrainers(null);
    (async () => {
      const supabase = getSupabase();
      const { data } = await supabase
        .from('trainer_gyms')
        .select('trainers(id, avatar_url, specialties, price_per_session, years_experience, profiles!trainers_id_fkey(full_name))')
        .eq('gym_id', gym.id);
      const list = (data || []).map((r) => r.trainers).filter(Boolean);
      const ids = list.map((t) => t.id);

      let reviews = [];
      let slots = [];
      if (ids.length) {
        const [r, s] = await Promise.all([
          supabase.from('reviews').select('trainer_id, rating').in('trainer_id', ids),
          supabase
            .from('slots')
            .select('trainer_id, starts_at')
            .eq('gym_id', gym.id)
            .eq('status', 'open')
            .gt('starts_at', new Date().toISOString())
            .order('starts_at')
            .limit(200),
        ]);
        reviews = r.data || [];
        slots = s.data || [];
      }

      const enriched = list.map((t) => {
        const own = reviews.filter((x) => x.trainer_id === t.id);
        return {
          ...t,
          rating: averageRating(own),
          reviewCount: own.length,
          nextSlot: slots.find((x) => x.trainer_id === t.id)?.starts_at || null,
        };
      });
      if (active) setTrainers(enriched);
    })();
    return () => {
      active = false;
    };
  }, [gym.id]);

  return (
    <div className="sheet-body">
      <button className="link-back" onClick={onBack}>
        ← Sve teretane
      </button>
      {gym.image_url && <img src={gym.image_url} alt="" className="gym-cover" />}
      <h1 className="sheet-title">{gym.name}</h1>
      {gym.address && <p className="muted">{gym.address}</p>}

      <h2 className="section-title">Personalni treneri</h2>
      {trainers === null ? (
        <p className="muted">Učitavam…</p>
      ) : trainers.length === 0 ? (
        <p className="muted">U ovoj teretani još nema registrovanih trenera.</p>
      ) : (
        <ul className="trainer-list">
          {trainers.map((t) => (
            <li key={t.id}>
              <Link href={`/trener/${t.id}`} className="trainer-card">
                <Avatar url={t.avatar_url} name={t.profiles?.full_name} />
                <span className="trainer-card-text">
                  <strong>{t.profiles?.full_name || 'Trener'}</strong>
                  {t.specialties?.length > 0 && <span className="small">{t.specialties.slice(0, 3).join(' · ')}</span>}
                  <span className="small muted">
                    {t.rating ? `★ ${t.rating.toFixed(1)} (${t.reviewCount})` : 'Bez ocena'}
                    {formatPrice(t.price_per_session) ? ` · ${formatPrice(t.price_per_session)}` : ''}
                  </span>
                  <span className={`small ${t.nextSlot ? 'next-slot' : 'muted'}`}>
                    {t.nextSlot
                      ? `Prvi slobodan: ${formatDayShort(t.nextSlot)} u ${formatTime(t.nextSlot)}`
                      : 'Trenutno nema slobodnih termina'}
                  </span>
                </span>
                <span className="chev" aria-hidden="true">›</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
