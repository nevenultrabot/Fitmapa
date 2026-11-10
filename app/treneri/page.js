'use client';

import { useEffect, useMemo, useState } from 'react';
import { FiSearch } from 'react-icons/fi';
import TrainerCard from '@/components/TrainerCard';
import { loadTrainers } from '@/lib/data';

export default function TrainersPage() {
  const [trainers, setTrainers] = useState(null);
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState(null);
  const [onlyFree, setOnlyFree] = useState(false);

  useEffect(() => {
    loadTrainers().then(setTrainers);
  }, []);

  // najčešće specijalnosti kao brzi filteri
  const tags = useMemo(() => {
    const count = {};
    for (const t of trainers || []) for (const s of t.specialties || []) count[s] = (count[s] || 0) + 1;
    return Object.entries(count)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([s]) => s);
  }, [trainers]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (trainers || []).filter((t) => {
      const text = `${t.name} ${(t.specialties || []).join(' ')} ${t.gyms.map((g) => g.name).join(' ')}`.toLowerCase();
      return (!q || text.includes(q)) && (!tag || (t.specialties || []).includes(tag)) && (!onlyFree || t.nextSlot);
    });
  }, [trainers, query, tag, onlyFree]);

  return (
    <div className="page">
      <div className="page-head">
        <h1>Personalni treneri</h1>
        <p className="muted">Izaberi trenera i zakaži termin za ovu nedelju.</p>
      </div>

      <label className="search-box">
        <FiSearch aria-hidden="true" />
        <input placeholder="Ime, specijalnost ili teretana…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>

      <div className="chips filter-chips">
        <button className={onlyFree ? 'chip chip-btn active' : 'chip chip-btn'} onClick={() => setOnlyFree((v) => !v)}>
          Ima slobodnih termina
        </button>
        {tags.map((s) => (
          <button key={s} className={tag === s ? 'chip chip-btn active' : 'chip chip-btn'} onClick={() => setTag(tag === s ? null : s)}>
            {s}
          </button>
        ))}
      </div>

      {trainers === null ? (
        <p className="muted">Učitavam…</p>
      ) : list.length === 0 ? (
        <p className="muted">Nema trenera za ovu pretragu.</p>
      ) : (
        <div className="trainer-grid">
          {list.map((t) => (
            <TrainerCard key={t.id} t={t} variant="tile" />
          ))}
        </div>
      )}
    </div>
  );
}
