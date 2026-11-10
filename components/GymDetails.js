'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FiClock, FiCreditCard, FiMapPin } from 'react-icons/fi';
import GymCover from './GymCover';
import TrainerCard from './TrainerCard';
import { loadTrainers } from '@/lib/data';

// Informacije o teretani + lista njenih trenera
export default function GymDetails({ gym, showPageLink = false }) {
  const [trainers, setTrainers] = useState(null);

  useEffect(() => {
    let active = true;
    setTrainers(null);
    loadTrainers({ gymId: gym.id }).then((list) => active && setTrainers(list));
    return () => {
      active = false;
    };
  }, [gym.id]);

  return (
    <div className="gym-details">
      <GymCover gym={gym} className="gym-details-cover" />
      <h1 className="sheet-title">{gym.name}</h1>

      <ul className="gym-facts">
        {gym.address && (
          <li>
            <FiMapPin aria-hidden="true" />
            <span>
              {gym.address}
              <a
                className="small gym-facts-link"
                href={`https://www.google.com/maps/dir/?api=1&destination=${gym.lat},${gym.lng}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Uputstva do teretane
              </a>
            </span>
          </li>
        )}
        {gym.opening_hours && (
          <li>
            <FiClock aria-hidden="true" />
            <span>{gym.opening_hours}</span>
          </li>
        )}
        {gym.membership && (
          <li>
            <FiCreditCard aria-hidden="true" />
            <span>{gym.membership}</span>
          </li>
        )}
      </ul>

      {showPageLink && (
        <Link href={`/teretane/${gym.id}`} className="small gym-page-link">
          Otvori stranicu teretane →
        </Link>
      )}

      <h2 className="section-title">Personalni treneri {trainers?.length ? `(${trainers.length})` : ''}</h2>
      {trainers === null ? (
        <p className="muted">Učitavam…</p>
      ) : trainers.length === 0 ? (
        <p className="muted">U ovoj teretani još nema registrovanih trenera.</p>
      ) : (
        <ul className="trainer-list">
          {trainers.map((t) => (
            <li key={t.id}>
              <TrainerCard t={t} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
