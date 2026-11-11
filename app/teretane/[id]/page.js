'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FiEdit2 } from 'react-icons/fi';
import GymDetails from '@/components/GymDetails';
import GymForm from '@/components/GymForm';
import GymTrainers from '@/components/GymTrainers';
import MapView from '@/components/MapView';
import { getSupabase } from '@/lib/supabase';
import { useSession } from '@/lib/useSession';
import { GYM_FIELDS } from '@/lib/data';

export default function GymPage() {
  const { id } = useParams();
  const { user, profile } = useSession();
  const [gym, setGym] = useState(undefined);
  const [editing, setEditing] = useState(false);

  const load = useCallback(() => {
    getSupabase()
      .from('gyms')
      .select(GYM_FIELDS)
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => setGym(data || null));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (gym === undefined) return <div className="page"><p className="muted">Učitavam…</p></div>;
  if (gym === null)
    return (
      <div className="page">
        <p>Teretana nije pronađena.</p>
        <Link href="/teretane" className="btn">Sve teretane</Link>
      </div>
    );

  // administrator i trener koji je dodao teretanu mogu da je urede (cenovnik, slika, radno vreme…)
  const canEdit = Boolean(user && (profile?.is_admin || gym.created_by === user.id));

  return (
    <div className="page page-wide">
      <Link href="/teretane" className="link-back">← Sve teretane</Link>
      <div className="gym-page">
        <div className="gym-page-main">
          <div className="card">
            {editing ? (
              <GymForm
                userId={user.id}
                gym={gym}
                linkTrainer={false}
                onCancel={() => setEditing(false)}
                onSaved={() => {
                  setEditing(false);
                  load();
                }}
              />
            ) : (
              <GymDetails
                gym={gym}
                showTrainers={false}
                actions={
                  canEdit && (
                    <button className="btn" onClick={() => setEditing(true)}>
                      <FiEdit2 aria-hidden="true" /> Uredi teretanu
                    </button>
                  )
                }
              />
            )}
          </div>

          <section className="card">
            <h2 className="section-title section-title-lg">Treneri</h2>
            <GymTrainers gymId={gym.id} />
          </section>
        </div>

        <aside className="gym-page-side">
          <div className="card gym-page-map">
            <MapView
              gyms={[gym]}
              selectedId={gym.id}
              center={{ lng: gym.lng, lat: gym.lat }}
              zoom={15}
              showLocate={false}
              className="map-tall"
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
