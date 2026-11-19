'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { useSession } from '@/lib/useSession';
import { useWeek } from '@/lib/useWeek';
import Schedule from '@/components/panel/Schedule';
import AddSlots from '@/components/panel/AddSlots';
import ProfileEditor from '@/components/panel/ProfileEditor';
import PushCard from '@/components/panel/PushCard';
import Clients from '@/components/panel/Clients';

const TABS = [
  { id: 'schedule', label: 'Raspored' },
  { id: 'add', label: 'Dodaj termine' },
  { id: 'clients', label: 'Vežbači' },
  { id: 'profile', label: 'Profil' },
];

export default function TrainerPanelPage() {
  return (
    <Suspense fallback={<div className="page"><p className="muted">Učitavam…</p></div>}>
      <TrainerPanel />
    </Suspense>
  );
}

const TAB_IDS = ['schedule', 'add', 'clients', 'profile'];

function TrainerPanel() {
  const router = useRouter();
  const params = useSearchParams();
  const { loading, user, profile } = useSession();
  const week = useWeek();
  // kartica se čita iz adrese (/panel?tab=add), da meni gore desno može da otvori tačnu karticu
  const urlTab = params.get('tab');
  const tab = TAB_IDS.includes(urlTab) ? urlTab : 'schedule';
  const setTab = useCallback(
    (id) => router.replace(id === 'schedule' ? '/panel' : `/panel?tab=${id}`, { scroll: false }),
    [router]
  );
  const [presetDay, setPresetDay] = useState(null);
  const [trainer, setTrainer] = useState(null);
  const [myGyms, setMyGyms] = useState([]);
  const [requestCount, setRequestCount] = useState(0);

  const loadTrainer = useCallback(async () => {
    if (!user) return;
    const { data } = await getSupabase()
      .from('trainers')
      .select('*, trainer_gyms(is_primary, gyms(id, name, address, lat, lng, image_url, opening_hours, membership, created_by))')
      .eq('id', user.id)
      .maybeSingle();
    setTrainer(data);
    setMyGyms(
      (data?.trainer_gyms || [])
        .filter((tg) => tg.gyms)
        .map((tg) => ({ ...tg.gyms, is_primary: tg.is_primary }))
        .sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
    );
  }, [user]);

  useEffect(() => {
    if (!loading && !user) router.push('/prijava?next=/panel');
    loadTrainer();
  }, [loading, user, router, loadTrainer]);

  // broj novih zahteva vežbača (za značku na kartici "Vežbači")
  useEffect(() => {
    if (!user) return;
    getSupabase()
      .rpc('my_client_requests')
      .then(({ data }) => setRequestCount((data || []).length));
  }, [user]);

  // Novi trener: prvo ga pošalji na profil
  useEffect(() => {
    if (trainer && myGyms.length === 0 && tab !== 'profile') setTab('profile');
  }, [trainer, myGyms.length, tab, setTab]);

  if (loading || (user && !trainer && profile?.role === 'trainer')) {
    return <div className="page"><p className="muted">Učitavam…</p></div>;
  }
  if (!user) return null;
  if (profile?.role !== 'trainer') {
    return (
      <div className="page narrow">
        <p>Ovaj panel je samo za personalne trenere.</p>
        <Link href="/mapa" className="btn">Nazad na mapu</Link>
      </div>
    );
  }

  const checklist = [
    { ok: myGyms.length > 0, text: 'Izaberi teretanu u kojoj radiš' },
    { ok: Boolean(trainer.bio), text: 'Napiši nešto o sebi' },
    { ok: trainer.is_published, text: 'Uključi „Profil je javan”' },
  ];
  const incomplete = checklist.some((c) => !c.ok);

  return (
    <div className="page">
      <div className="panel-head">
        <div>
          <h1>{profile.full_name || 'Moj profil'}</h1>
          <p className="muted small">
            {trainer.is_published ? (
              <>
                Profil je javan · <Link href={`/trener/${user.id}`}>Pogledaj kako ga drugi vide →</Link>
              </>
            ) : (
              'Profil još nije javan — klijenti ga ne vide.'
            )}
          </p>
        </div>
      </div>

      {incomplete && (
        <div className="card checklist">
          <strong>Da bi te klijenti pronašli:</strong>
          <ul>
            {checklist.map((c) => (
              <li key={c.text} className={c.ok ? 'done' : ''}>
                {c.ok ? '✓' : '○'} {c.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      <PushCard />

      <div className="tabs tabs-wide">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'tab active' : 'tab'} onClick={() => {
              setPresetDay(null);
              setTab(t.id);
            }}>
            {t.label}
            {t.id === 'clients' && requestCount > 0 && <span className="tab-badge">{requestCount}</span>}
          </button>
        ))}
      </div>

      {tab === 'schedule' && (
        <Schedule
          userId={user.id}
          week={week}
          onAddClick={(iso) => {
            setPresetDay(iso || null);
            setTab('add');
          }}
        />
      )}
      {tab === 'add' && !week && <p className="muted">Učitavam…</p>}
      {tab === 'add' && week && (
        <AddSlots
          gyms={myGyms}
          week={week}
          presetDay={presetDay}
          onDone={() => setTab('schedule')}
          onNeedGym={() => setTab('profile')}
        />
      )}
      {tab === 'clients' && <Clients userId={user.id} onCountChange={setRequestCount} />}
      {tab === 'profile' && (
        <ProfileEditor userId={user.id} profile={profile} trainer={trainer} myGyms={myGyms} onSaved={loadTrainer} />
      )}
    </div>
  );
}
