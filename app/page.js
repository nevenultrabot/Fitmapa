'use client';

import { useEffect, useMemo, useState } from 'react';
import MapView from '@/components/MapView';
import GymCover from '@/components/GymCover';
import GymDetails from '@/components/GymDetails';
import Intro from '@/components/Intro';
import { getSupabase } from '@/lib/supabase';
import { GYM_FIELDS } from '@/lib/data';

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
      .select(`${GYM_FIELDS}, trainer_gyms(trainers(id))`)
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
      list = list.map((g) => ({ ...g, distance: distanceKm(userPoint, g) })).sort((a, b) => a.distance - b.distance);
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
      <Intro />
      <MapView gyms={gyms} selectedId={selectedId} onSelect={select} onLocated={setUserPoint} autoLocate />

      <aside className={`sheet ${sheetOpen ? 'open' : 'closed'}`}>
        <button className="sheet-handle" onClick={() => setSheetOpen((o) => !o)} aria-label="Prikaži ili sakrij listu">
          <span />
        </button>

        {error && <p className="alert alert-error">Greška pri učitavanju: {error}</p>}

        <div className="sheet-body">
          {selectedGym ? (
            <>
              <button className="link-back" onClick={() => setSelectedId(null)}>
                ← Sve teretane
              </button>
              <GymDetails gym={selectedGym} showPageLink />
            </>
          ) : (
            <>
              <h1 className="sheet-title">Teretane</h1>
              <p className="muted small">Izaberi teretanu na mapi ili sa liste da vidiš njene personalne trenere.</p>
              <input
                className="input"
                placeholder="Pretraži po nazivu ili adresi…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <ul className="gym-list">
                {visibleGyms.map((g) => (
                  <li key={g.id}>
                    <button className="gym-row" onClick={() => select(g.id)}>
                      <GymCover gym={g} className="gym-thumb" />
                      <span className="gym-row-text">
                        <strong>{g.name}</strong>
                        <span className="muted small">
                          {g.address || ''}
                          {g.distance !== undefined ? ` · ${g.distance.toFixed(1)} km` : ''}
                        </span>
                      </span>
                      <span className="pill">
                        {g.trainerCount} {g.trainerCount === 1 ? 'trener' : 'trenera'}
                      </span>
                    </button>
                  </li>
                ))}
                {gyms.length > 0 && visibleGyms.length === 0 && <li className="muted">Nema rezultata.</li>}
              </ul>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
