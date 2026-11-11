'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Avatar from './Avatar';
import { loadTrainers } from '@/lib/data';
import { getSupabase } from '@/lib/supabase';

// Blok "Treneri" na stranici teretane: slika, ime i 3 broja (klijenti, iskustvo, treninzi)
export default function GymTrainers({ gymId }) {
  const [trainers, setTrainers] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const list = await loadTrainers({ gymId });
      let stats = [];
      if (list.length) {
        const { data } = await getSupabase().rpc('trainer_stats', { p_ids: list.map((t) => t.id) });
        stats = data || [];
      }
      if (active)
        setTrainers(
          list.map((t) => {
            const s = stats.find((x) => x.trainer_id === t.id);
            return { ...t, clients: s?.clients ?? 0, sessions: s?.sessions ?? 0 };
          })
        );
    })();
    return () => {
      active = false;
    };
  }, [gymId]);

  if (trainers === null) return <p className="muted">Učitavam…</p>;
  if (trainers.length === 0) return <p className="muted">U ovoj teretani još nema registrovanih trenera.</p>;

  return (
    <ul className="tsc-list">
      {trainers.map((t) => (
        <li key={t.id}>
          <Link href={`/trener/${t.id}`} className="tsc">
            <Avatar url={t.avatar_url} name={t.name} size="xl" />
            <div className="tsc-body">
              <h3 className="tsc-name">{t.name}</h3>
              {t.specialties?.length > 0 && <p className="tsc-spec">{t.specialties.slice(0, 3).join(' · ')}</p>}
              <div className="tsc-stats">
                <div>
                  <strong>{t.clients}</strong>
                  <span>{t.clients === 1 ? 'klijent' : 'klijenata'}</span>
                </div>
                <div>
                  <strong>{t.years_experience ?? '—'}</strong>
                  <span>god. iskustva</span>
                </div>
                <div>
                  <strong>{t.sessions}</strong>
                  <span>{t.sessions === 1 ? 'trening' : 'treninga'}</span>
                </div>
              </div>
            </div>
            <span className="tsc-cta">
              Profil i termini <span aria-hidden="true">›</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
