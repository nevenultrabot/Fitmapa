'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { useSession } from '@/lib/useSession';
import Schedule from '@/components/panel/Schedule';
import AddSlots from '@/components/panel/AddSlots';
import ProfileEditor from '@/components/panel/ProfileEditor';

const TABS = [
  { id: 'schedule', label: 'Raspored' },
  { id: 'add', label: 'Dodaj termine' },
  { id: 'profile', label: 'Profil' },
];

export default function TrainerPanelPage() {
  const router = useRouter();
  const { loading, user, profile } = useSession();
  const [tab, setTab] = useState('schedule');
  const [trainer, setTrainer] = useState(null);
  const [myGyms, setMyGyms] = useState([]);

  const loadTrainer = useCallback(async () => {
    if (!user) return;
    const { data } = await getSupabase()
      .from('trainers')
      .select('*, trainer_gyms(gyms(id, name, address, lat, lng))')
      .eq('id', user.id)
      .maybeSingle();
    setTrainer(data);
    setMyGyms((data?.trainer_gyms || []).map((tg) => tg.gyms).filter(Boolean));
  }, [user]);

  useEffect(() => {
    if (!loading && !user) router.push('/prijava?next=/panel');
    loadTrainer();
  }, [loading, user, router, loadTrainer]);

  // Novi trener: prvo ga pošalji na profil
  useEffect(() => {
    if (trainer && myGyms.length === 0) setTab('profile');
  }, [trainer, myGyms.length]);

  if (loading || (user && !trainer && profile?.role === 'trainer')) {
    return <div className="page"><p className="muted">Učitavam…</p></div>;
  }
  if (!user) return null;
  if (profile?.role !== 'trainer') {
    return (
      <div className="page narrow">
        <p>Ovaj panel je samo za personalne trenere.</p>
        <Link href="/" className="btn">Nazad na mapu</Link>
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
          <h1>Zdravo, {profile.full_name?.split(' ')[0] || 'treneru'}</h1>
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

      <div className="tabs tabs-wide">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'tab active' : 'tab'} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'schedule' && <Schedule userId={user.id} onAddClick={() => setTab('add')} />}
      {tab === 'add' && (
        <AddSlots gyms={myGyms} onDone={() => setTab('schedule')} onNeedGym={() => setTab('profile')} />
      )}
      {tab === 'profile' && (
        <ProfileEditor userId={user.id} profile={profile} trainer={trainer} myGyms={myGyms} onSaved={loadTrainer} />
      )}
    </div>
  );
}
