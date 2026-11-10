'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FiClock, FiCreditCard, FiMapPin, FiSearch } from 'react-icons/fi';
import GymCover from '@/components/GymCover';
import { getSupabase } from '@/lib/supabase';
import { GYM_FIELDS } from '@/lib/data';

export default function GymsPage() {
  const [gyms, setGyms] = useState(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    getSupabase()
      .from('gyms')
      .select(`${GYM_FIELDS}, trainer_gyms(trainers(id))`)
      .order('name')
      .then(({ data }) =>
        setGyms(
          (data || []).map((g) => ({ ...g, trainerCount: (g.trainer_gyms || []).filter((tg) => tg.trainers).length }))
        )
      );
  }, []);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (gyms || []).filter((g) => !q || `${g.name} ${g.address || ''}`.toLowerCase().includes(q));
  }, [gyms, query]);

  return (
    <div className="page">
      <div className="page-head">
        <h1>Teretane u Novom Sadu</h1>
        <p className="muted">Radno vreme, članarine i personalni treneri na jednom mestu.</p>
      </div>

      <label className="search-box">
        <FiSearch aria-hidden="true" />
        <input placeholder="Pretraži teretane po nazivu ili adresi…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>

      {gyms === null ? (
        <p className="muted">Učitavam…</p>
      ) : list.length === 0 ? (
        <p className="muted">Nema teretana za ovu pretragu.</p>
      ) : (
        <div className="gym-grid">
          {list.map((g) => (
            <Link key={g.id} href={`/teretane/${g.id}`} className="gym-card">
              <GymCover gym={g} className="gym-card-cover" />
              <div className="gym-card-body">
                <div className="gym-card-title">
                  <strong>{g.name}</strong>
                  <span className="pill">
                    {g.trainerCount} {g.trainerCount === 1 ? 'trener' : 'trenera'}
                  </span>
                </div>
                {g.address && (
                  <span className="gym-card-line">
                    <FiMapPin aria-hidden="true" /> {g.address}
                  </span>
                )}
                {g.opening_hours && (
                  <span className="gym-card-line">
                    <FiClock aria-hidden="true" /> {g.opening_hours}
                  </span>
                )}
                {g.membership && (
                  <span className="gym-card-line">
                    <FiCreditCard aria-hidden="true" /> {g.membership}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
