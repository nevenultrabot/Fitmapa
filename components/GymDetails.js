'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FiArrowUpRight, FiClock, FiCreditCard, FiFileText, FiMapPin } from 'react-icons/fi';
import Lightbox from './Lightbox';
import GymCover from './GymCover';
import TrainerCard from './TrainerCard';
import { loadTrainers } from '@/lib/data';

// Informacije o teretani + lista njenih trenera
export default function GymDetails({ gym, showPageLink = false, showTrainers = true, actions = null }) {
  const [trainers, setTrainers] = useState(null);
  const [priceOpen, setPriceOpen] = useState(false);

  useEffect(() => {
    if (!showTrainers) return;
    let active = true;
    setTrainers(null);
    loadTrainers({ gymId: gym.id }).then((list) => active && setTrainers(list));
    return () => {
      active = false;
    };
  }, [gym.id, showTrainers]);

  return (
    <div className="gym-details">
      {showPageLink ? (
        // slika i naziv vode na stranicu teretane
        <Link href={`/teretane/${gym.id}`} className="gym-hero-link" aria-label={`Otvori stranicu teretane ${gym.name}`}>
          <span className="gym-hero-cover">
            <GymCover gym={gym} className="gym-details-cover" />
            <span className="gym-hero-hint">
              Otvori stranicu <FiArrowUpRight aria-hidden="true" />
            </span>
          </span>
          <h1 className="sheet-title gym-hero-title">
            {gym.name} <FiArrowUpRight aria-hidden="true" className="gym-hero-arrow" />
          </h1>
        </Link>
      ) : (
        <>
          <GymCover gym={gym} className="gym-details-cover" />
          <h1 className="sheet-title">{gym.name}</h1>
        </>
      )}

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

      {(gym.price_list_url || actions || showPageLink) && (
        <div className="gym-actions">
          {gym.price_list_url && (
            <button className="btn btn-primary gym-price-btn" onClick={() => setPriceOpen(true)}>
              <FiFileText aria-hidden="true" /> Cenovnik
            </button>
          )}
          {showPageLink && (
            <Link href={`/teretane/${gym.id}`} className="btn gym-page-btn">
              <FiArrowUpRight aria-hidden="true" /> Stranica teretane
            </Link>
          )}
          {actions}
        </div>
      )}
      {priceOpen && <Lightbox src={gym.price_list_url} title={`Cenovnik — ${gym.name}`} onClose={() => setPriceOpen(false)} />}

      {showTrainers && (<>
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
      </>)}
    </div>
  );
}
