'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FiCheck, FiX, FiExternalLink, FiMail, FiPhone } from 'react-icons/fi';
import Avatar from '@/components/Avatar';
import { getSupabase, errorMessage } from '@/lib/supabase';
import { useSession } from '@/lib/useSession';
import { formatDate } from '@/lib/format';

// Administracija: odobravanje novih trenera i teretana (vidi je samo administrator)
export default function AdminPage() {
  const router = useRouter();
  const { loading, user, profile } = useSession();
  const [trainers, setTrainers] = useState(null);
  const [gyms, setGyms] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [busy, setBusy] = useState(null);
  const [message, setMessage] = useState(null);

  const load = useCallback(async () => {
    const supabase = getSupabase();
    const [t, g] = await Promise.all([
      supabase.rpc('admin_trainers'),
      supabase.from('gyms').select('id, name, address, image_url, created_by, created_at').eq('is_approved', false).order('created_at'),
    ]);
    if (t.error) setMessage({ type: 'error', text: errorMessage(t.error) });
    setTrainers(t.data || []);
    setGyms(g.data || []);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) router.push('/prijava?next=/admin');
    else if (profile?.is_admin) load();
  }, [loading, user, profile, router, load]);

  async function run(id, fn, ok) {
    setBusy(id);
    const { error } = await fn();
    setBusy(null);
    setMessage(error ? { type: 'error', text: errorMessage(error) } : { type: 'ok', text: ok });
    load();
  }

  const approveTrainer = (t, yes) =>
    run(t.id, () => getSupabase().rpc('approve_trainer', { p_trainer_id: t.id, p_approve: yes }),
      yes ? `${t.full_name || 'Trener'} je odobren i sada je vidljiv klijentima.` : `${t.full_name || 'Trener'} više nije vidljiv klijentima.`);

  const approveGym = (g, yes) =>
    run(g.id, () => getSupabase().rpc('approve_gym', { p_gym_id: g.id, p_approve: yes }),
      yes ? `Teretana „${g.name}” je odobrena.` : `Teretana „${g.name}” je sklonjena sa mape.`);

  if (loading || !user || !profile) return <div className="page"><p className="muted">Učitavam…</p></div>;
  if (!profile.is_admin) {
    return (
      <div className="page narrow">
        <p>Ova stranica je samo za administratora.</p>
        <Link href="/" className="btn">Početna</Link>
      </div>
    );
  }
  if (trainers === null) return <div className="page"><p className="muted">Učitavam…</p></div>;

  const pending = trainers.filter((t) => !t.is_approved && t.is_published);
  const drafts = trainers.filter((t) => !t.is_approved && !t.is_published);
  const approved = trainers.filter((t) => t.is_approved);
  const shown = filter === 'pending' ? pending : filter === 'drafts' ? drafts : approved;
  const creatorName = (id) => trainers.find((t) => t.id === id)?.full_name;

  return (
    <div className="page admin-page">
      <h1>Administracija</h1>
      <p className="small muted">
        Novi treneri i teretane koje dodaju treneri vidljivi su klijentima tek kad ih odobriš.
      </p>
      {message && <p className={`alert alert-${message.type}`} onClick={() => setMessage(null)}>{message.text}</p>}

      <div className="tabs tabs-wide">
        <button className={filter === 'pending' ? 'tab active' : 'tab'} onClick={() => setFilter('pending')}>
          Čekaju odobrenje{pending.length > 0 && <span className="tab-badge">{pending.length}</span>}
        </button>
        <button className={filter === 'drafts' ? 'tab active' : 'tab'} onClick={() => setFilter('drafts')}>
          U pripremi · {drafts.length}
        </button>
        <button className={filter === 'approved' ? 'tab active' : 'tab'} onClick={() => setFilter('approved')}>
          Odobreni · {approved.length}
        </button>
      </div>

      {filter === 'drafts' && (
        <p className="small muted">Treneri koji još sređuju profil i nisu uključili „Profil je javan”. Možeš ih odobriti i unapred.</p>
      )}

      {shown.length === 0 ? (
        <p className="muted">{filter === 'pending' ? 'Nema trenera koji čekaju odobrenje. 🎉' : 'Nema nikoga ovde.'}</p>
      ) : (
        <ul className="admin-list">
          {shown.map((t) => (
            <li key={t.id} className="card admin-trainer">
              <Avatar url={t.avatar_url} name={t.full_name} size="md" />
              <div className="admin-trainer-info">
                <strong>{t.full_name || 'Bez imena'}</strong>
                <span className="small muted">
                  Registrovan {formatDate(t.created_at)}
                  {t.gyms?.length > 0 ? ` · ${t.gyms.join(', ')}` : ' · nije izabrao teretanu'}
                </span>
                <span className="admin-contact small">
                  {t.email && (
                    <a href={`mailto:${t.email}`}><FiMail aria-hidden="true" /> {t.email}</a>
                  )}
                  {t.phone && (
                    <a href={`tel:${t.phone}`}><FiPhone aria-hidden="true" /> {t.phone}</a>
                  )}
                </span>
                {t.bio && <p className="small admin-bio">„{t.bio}”</p>}
              </div>
              <div className="admin-actions">
                <Link href={`/trener/${t.id}`} className="btn btn-small" target="_blank">
                  <FiExternalLink aria-hidden="true" /> Profil
                </Link>
                {t.is_approved ? (
                  <button className="btn btn-small btn-danger btn-outline" disabled={busy === t.id} onClick={() => approveTrainer(t, false)}>
                    <FiX aria-hidden="true" /> Skloni
                  </button>
                ) : (
                  <button className="btn btn-small btn-primary" disabled={busy === t.id} onClick={() => approveTrainer(t, true)}>
                    <FiCheck aria-hidden="true" /> Odobri
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <h2 className="section-title admin-gyms-title">
        Nove teretane {gyms.length > 0 && <span className="tab-badge">{gyms.length}</span>}
      </h2>
      {gyms.length === 0 ? (
        <p className="small muted">Nema novih teretana za odobrenje. (Kad odobriš trenera, odobravaju se i teretane koje je on dodao.)</p>
      ) : (
        <ul className="admin-list">
          {gyms.map((g) => (
            <li key={g.id} className="card admin-trainer">
              {g.image_url ? <img src={g.image_url} alt="" className="admin-gym-img" /> : <span className="admin-gym-img" />}
              <div className="admin-trainer-info">
                <strong>{g.name}</strong>
                <span className="small muted">
                  {g.address || 'bez adrese'} · dodao {creatorName(g.created_by) || 'trener'}
                </span>
              </div>
              <div className="admin-actions">
                <Link href={`/teretane/${g.id}`} className="btn btn-small" target="_blank">
                  <FiExternalLink aria-hidden="true" /> Pogledaj
                </Link>
                <button className="btn btn-small btn-primary" disabled={busy === g.id} onClick={() => approveGym(g, true)}>
                  <FiCheck aria-hidden="true" /> Odobri
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
