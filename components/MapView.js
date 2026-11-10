'use client';

import { useEffect, useRef, useState } from 'react';

export const NOVI_SAD = { lng: 19.8335, lat: 45.2551 };
// Besplatne mape bez API ključa (OpenStreetMap podaci)
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

/**
 * Mapa sa pinovima teretana.
 * - gyms: [{ id, name, lat, lng }]
 * - selectedId, onSelect(id): izbor teretane
 * - onMapClick({lng, lat}) + pickedPoint: za biranje lokacije nove teretane
 * - onLocated({lng, lat}): kad se pronađe lokacija korisnika
 */
export default function MapView({
  gyms = [],
  selectedId = null,
  onSelect,
  onMapClick,
  pickedPoint = null,
  onLocated,
  center = NOVI_SAD,
  zoom = 13,
  showLocate = true,
  autoLocate = false,
  cooperative = false,
  className = '',
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const libRef = useRef(null);
  const markersRef = useRef(new Map());
  const userMarkerRef = useRef(null);
  const pickMarkerRef = useRef(null);
  const callbacks = useRef({});
  callbacks.current = { onSelect, onMapClick, onLocated };

  const [ready, setReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState('');

  // 1) Pravljenje mape (jednom)
  useEffect(() => {
    let cancelled = false;
    let resizeObs = null;
    (async () => {
      const maplibregl = (await import('maplibre-gl')).default;
      if (cancelled || !containerRef.current) return;
      libRef.current = maplibregl;
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: MAP_STYLE,
        center: [center.lng, center.lat],
        zoom,
        attributionControl: { compact: true },
        // na Početnoj: točkić skroluje stranicu, a mapa se zumira uz Ctrl / dva prsta
        cooperativeGestures: cooperative,
        locale: {
          'CooperativeGesturesHandler.WindowsHelpText': 'Drži Ctrl i skroluj da zumiraš mapu',
          'CooperativeGesturesHandler.MacHelpText': 'Drži ⌘ i skroluj da zumiraš mapu',
          'CooperativeGesturesHandler.MobileHelpText': 'Pomeraj mapu sa dva prsta',
        },
      });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      map.on('click', (e) => callbacks.current.onMapClick?.({ lng: e.lngLat.lng, lat: e.lngLat.lat }));
      mapRef.current = map;
      // kad kontejner promeni veličinu (npr. animacija na početnoj), mapa se prilagodi
      resizeObs = new ResizeObserver(() => map.resize());
      resizeObs.observe(containerRef.current);
      setReady(true);
    })();
    return () => {
      cancelled = true;
      resizeObs?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) Pinovi teretana
  useEffect(() => {
    const map = mapRef.current;
    const maplibregl = libRef.current;
    if (!ready || !map || !maplibregl) return;

    markersRef.current.forEach(({ marker }) => marker.remove());
    markersRef.current.clear();

    for (const gym of gyms) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'gym-pin';
      el.setAttribute('aria-label', gym.name);
      el.innerHTML = '<span class="gym-pin-dot"></span><span class="gym-pin-label"></span>';
      el.querySelector('.gym-pin-label').textContent = gym.name;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        callbacks.current.onSelect?.(gym.id);
      });
      const marker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([gym.lng, gym.lat]).addTo(map);
      markersRef.current.set(gym.id, { marker, el });
    }
  }, [ready, gyms]);

  // 3) Označena teretana
  useEffect(() => {
    markersRef.current.forEach(({ el }, id) => el.classList.toggle('selected', id === selectedId));
    const map = mapRef.current;
    const gym = gyms.find((g) => g.id === selectedId);
    if (map && gym) map.flyTo({ center: [gym.lng, gym.lat], zoom: Math.max(map.getZoom(), 14), speed: 1.4 });
  }, [selectedId, gyms, ready]);

  // 4) Izabrana tačka (za novu teretanu)
  useEffect(() => {
    const map = mapRef.current;
    const maplibregl = libRef.current;
    if (!ready || !map || !maplibregl) return;
    pickMarkerRef.current?.remove();
    pickMarkerRef.current = null;
    if (pickedPoint) {
      pickMarkerRef.current = new maplibregl.Marker({ color: '#14161a' })
        .setLngLat([pickedPoint.lng, pickedPoint.lat])
        .addTo(map);
    }
  }, [ready, pickedPoint]);

  // 5) Automatska lokacija samo ako je korisnik ranije već dozvolio
  useEffect(() => {
    if (!ready || !autoLocate || typeof navigator === 'undefined' || !navigator.permissions) return;
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((p) => {
        if (p.state === 'granted') locate();
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, autoLocate]);

  function locate() {
    if (!navigator.geolocation) {
      setNotice('Tvoj pregledač ne podržava lokaciju. Prikazujem Novi Sad.');
      return;
    }
    setLocating(true);
    setNotice('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const point = { lng: pos.coords.longitude, lat: pos.coords.latitude };
        const map = mapRef.current;
        const maplibregl = libRef.current;
        if (!map || !maplibregl) return;
        userMarkerRef.current?.remove();
        const el = document.createElement('div');
        el.className = 'user-dot';
        userMarkerRef.current = new maplibregl.Marker({ element: el }).setLngLat([point.lng, point.lat]).addTo(map);
        map.flyTo({ center: [point.lng, point.lat], zoom: 14 });
        callbacks.current.onLocated?.(point);
      },
      (err) => {
        setLocating(false);
        setNotice(
          err.code === 1
            ? 'Lokacija nije dozvoljena. Prikazujem Novi Sad — možeš je uključiti u podešavanjima pregledača.'
            : 'Ne mogu da pronađem lokaciju (GPS isključen?). Prikazujem Novi Sad.'
        );
        mapRef.current?.flyTo({ center: [NOVI_SAD.lng, NOVI_SAD.lat], zoom: 13 });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  return (
    <div className={`map-wrap ${className}`}>
      <div ref={containerRef} className="map" />
      {showLocate && (
        <button type="button" className="locate-btn" onClick={locate} disabled={locating}>
          {locating ? 'Tražim…' : '◎ Teretane oko mene'}
        </button>
      )}
      {notice && (
        <div className="map-notice" role="status" onClick={() => setNotice('')}>
          {notice}
        </div>
      )}
    </div>
  );
}
