'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import GymDetails from '@/components/GymDetails';
import MapView from '@/components/MapView';
import { getSupabase } from '@/lib/supabase';
import { GYM_FIELDS } from '@/lib/data';

export default function GymPage() {
  const { id } = useParams();
  const [gym, setGym] = useState(undefined);

  useEffect(() => {
    getSupabase()
      .from('gyms')
      .select(GYM_FIELDS)
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => setGym(data || null));
  }, [id]);

  if (gym === undefined) return <div className="page"><p className="muted">Učitavam…</p></div>;
  if (gym === null)
    return (
      <div className="page">
        <p>Teretana nije pronađena.</p>
        <Link href="/teretane" className="btn">Sve teretane</Link>
      </div>
    );

  return (
    <div className="page">
      <Link href="/teretane" className="link-back">← Sve teretane</Link>
      <div className="gym-page">
        <div className="card gym-page-main">
          <GymDetails gym={gym} />
        </div>
        <aside className="gym-page-side">
          <div className="card gym-page-map">
            <MapView gyms={[gym]} selectedId={gym.id} center={{ lng: gym.lng, lat: gym.lat }} zoom={15} showLocate={false} className="map-small" />
          </div>
        </aside>
      </div>
    </div>
  );
}
