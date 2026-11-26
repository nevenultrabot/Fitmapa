'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { FiChevronLeft, FiList } from 'react-icons/fi';
import MapView from '@/components/MapView';
import GymCover from '@/components/GymCover';
import GymDetails from '@/components/GymDetails';
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

/**
 * Mapa teretana sa bočnom fiokom (lista i detalji teretana).
 * Fioka: na računaru otvorena (levo), na telefonu zatvorena — otvara se pulsirajućim dugmetom levo
 * ili dugmetom "Teretane oko mene". Na telefonu je to donji panel preko pola ekrana (mapa ostaje
 * vidljiva iznad); povlačenjem ručice nagore se širi preko celog ekrana, nadole se skuplja/zatvara.
 * embedded = prikaz na Početnoj (bez automatske lokacije).
 */
export default function MapExplorer({ embedded = false }) {
  const [gyms, setGyms] = useState([]);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [userPoint, setUserPoint] = useState(null);
  const [query, setQuery] = useState('');
  // null = automatski (CSS: otvorena na računaru, zatvorena na telefonu), pa true/false posle klika
  const [drawer, setDrawer] = useState(null);
  const [expanded, setExpanded] = useState(false); // telefon: panel preko celog ekrana
  const [isPhone, setIsPhone] = useState(false);
  const touchY = useRef(null);
  const swiped = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 899px)');
    const check = () => setIsPhone(mq.matches);
    check();
    mq.addEventListener?.('change', check);
    return () => mq.removeEventListener?.('change', check);
  }, []);

  useEffect(() => {
    if (drawer !== true) setExpanded(false);
  }, [drawer]);

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

  // otvori teretanu iz linka (/mapa?gym=...)
  useEffect(() => {
    if (!gyms.length || embedded) return;
    const id = new URLSearchParams(window.location.search).get('gym');
    if (id && gyms.some((g) => g.id === id)) setSelectedId(id);
  }, [gyms, embedded]);

  const selectedGym = gyms.find((g) => g.id === selectedId) || null;

  function select(id) {
    setSelectedId(id);
    setDrawer(true);
  }

  // "Teretane oko mene": pokaži listu najbližih teretana
  function located(point, { manual } = {}) {
    setUserPoint(point);
    if (manual) {
      setSelectedId(null);
      setQuery('');
      setDrawer(true);
    }
  }

  // ručica donjeg panela (telefon): dodir = pola/ceo ekran, prevlačenje gore = raširi, dole = skupi/zatvori
  function onHandleStart(e) {
    touchY.current = e.touches[0].clientY;
  }
  function onHandleEnd(e) {
    if (touchY.current === null) return;
    const dy = e.changedTouches[0].clientY - touchY.current;
    touchY.current = null;
    if (Math.abs(dy) <= 30) return; // običan dodir — rešava ga onClick
    swiped.current = true;
    if (dy < 0) setExpanded(true);
    else if (expanded) setExpanded(false);
    else setDrawer(false);
  }
  function onHandleClick() {
    if (swiped.current) {
      swiped.current = false;
      return;
    }
    setExpanded((v) => !v);
  }

  return (
    <div className={`map-explorer ${embedded ? 'embedded' : ''}`}>
      <MapView
        gyms={gyms}
        selectedId={selectedId}
        onSelect={select}
        onLocated={located}
        sheetFraction={isPhone && drawer === true ? 0.5 : 0}
        autoLocate={!embedded}
        ctrlZoom={embedded}
      />

      <aside
        className={`drawer ${drawer === null ? 'auto' : drawer ? 'open' : 'closed'} ${expanded ? 'expanded' : ''}`}
        aria-label="Lista teretana"
      >
        <button
          type="button"
          className="drawer-handle"
          onTouchStart={onHandleStart}
          onTouchEnd={onHandleEnd}
          onClick={onHandleClick}
          aria-label={expanded ? 'Smanji panel na pola ekrana' : 'Raširi panel preko celog ekrana'}
        >
          <span aria-hidden="true" />
        </button>
        <button className="drawer-close" onClick={() => setDrawer(false)} aria-label="Sakrij listu teretana" title="Sakrij listu">
          <FiChevronLeft aria-hidden="true" />
        </button>

        {error && <p className="alert alert-error">Greška pri učitavanju: {error}</p>}

        <div className="drawer-body">
          {selectedGym ? (
            <>
              <button className="link-back" onClick={() => setSelectedId(null)}>
                ← Sve teretane
              </button>
              <GymDetails gym={selectedGym} showPageLink />
            </>
          ) : (
            <>
              <div className="sheet-title-row">
                <h2 className="sheet-title">Teretane</h2>
              </div>
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

      <button className="drawer-open" onClick={() => setDrawer(true)} aria-label="Otvori listu teretana">
        <FiList aria-hidden="true" />
        <span>Teretane</span>
        {gyms.length > 0 && <span className="drawer-open-count">{gyms.length}</span>}
      </button>
    </div>
  );
}
