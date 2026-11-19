'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FiEdit3, FiClock, FiBookmark } from 'react-icons/fi';
import Avatar from '@/components/Avatar';
import { getSupabase, errorMessage } from '@/lib/supabase';
import { useSession } from '@/lib/useSession';

// Moj profil (vežbač): ime i telefon, moji treneri, brzi linkovi. Trener ide na svoj javni profil.
export default function MyProfilePage() {
  const router = useRouter();
  const { loading, user, profile } = useSession();
  const [trainers, setTrainers] = useState([]);
  const [count, setCount] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ full_name: '', phone: '' });
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) router.push('/prijava?next=/profil');
    else if (profile?.role === 'trainer') router.replace(`/trener/${user.id}`);
  }, [loading, user, profile, router]);

  useEffect(() => {
    if (!user || !profile || profile.role === 'trainer') return;
    setForm({ full_name: profile.full_name || '', phone: profile.phone || '' });
    const supabase = getSupabase();
    supabase
      .from('trainer_clients')
      .select('trainer_id, status, trainers(avatar_url, profiles!trainers_id_fkey(full_name))')
      .eq('client_id', user.id)
      .then(({ data }) => setTrainers(data || []));
    supabase
      .from('bookings')
      .select('id, slots!inner(ends_at)')
      .eq('client_id', user.id)
      .eq('status', 'confirmed')
      .lt('slots.ends_at', new Date().toISOString())
      .then(({ data }) => setCount((data || []).length));
  }, [user, profile]);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    const { error } = await getSupabase()
      .from('profiles')
      .update({ full_name: form.full_name.trim(), phone: form.phone.trim() || null })
      .eq('id', user.id);
    setSaving(false);
    if (error) setMessage({ type: 'error', text: errorMessage(error) });
    else {
      setMessage({ type: 'ok', text: 'Sačuvano.' });
      setEditing(false);
    }
  }

  if (loading || !user || !profile || profile.role === 'trainer') return <div className="page"><p className="muted">Učitavam…</p></div>;

  const name = form.full_name || profile.full_name || user.email;
  const accepted = trainers.filter((t) => t.status === 'accepted');

  return (
    <div className="page narrow">
      <section className="card hero2">
        <div className="hero2-top">
          <Avatar url={null} name={name} size="xl" />
          <div className="hero2-info">
            <h1 className="profile-name">{name}</h1>
            <p className="muted small">{user.email}{profile.phone ? ` · ${profile.phone}` : ''}</p>
            <div className="owner-actions">
              <button className="btn btn-small btn-primary" onClick={() => setEditing((v) => !v)}>
                <FiEdit3 aria-hidden="true" /> Uredi profil
              </button>
              <Link href="/istorija" className="btn btn-small">
                <FiClock aria-hidden="true" /> Istorija treninga
              </Link>
              <Link href="/moji-termini" className="btn btn-small">
                <FiBookmark aria-hidden="true" /> Moji termini
              </Link>
            </div>
          </div>
        </div>

        <div className="hero2-stats">
          <div>
            <strong>{count ?? '—'}</strong>
            <span>odrađenih treninga</span>
          </div>
          <div>
            <strong>{accepted.length}</strong>
            <span>{accepted.length === 1 ? 'trener' : 'trenera'}</span>
          </div>
        </div>

        {message && <p className={`alert alert-${message.type}`}>{message.text}</p>}

        {editing && (
          <form className="profile-edit-form" onSubmit={save}>
            <label className="field">
              <span>Ime i prezime</span>
              <input className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
            </label>
            <label className="field">
              <span>Telefon <span className="field-opt">vidi ga samo tvoj trener</span></span>
              <input className="input" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="06x xxx xxxx" />
            </label>
            <div className="modal-actions">
              <button className="btn btn-primary" disabled={saving}>{saving ? 'Čuvam…' : 'Sačuvaj'}</button>
              <button type="button" className="btn" onClick={() => setEditing(false)}>Odustani</button>
            </div>
          </form>
        )}
      </section>

      <section className="card my-trainers">
        <h2 className="section-title">Moji treneri</h2>
        {trainers.length === 0 ? (
          <p className="small muted">
            Još nemaš trenera. Dodaj ga sa njegovog profila ili zakaži trening — posle prvog treninga postaje tvoj trener
            automatski. <Link href="/treneri">Pogledaj trenere →</Link>
          </p>
        ) : (
          <ul>
            {trainers.map((t) => {
              const n = t.trainers?.profiles?.full_name || 'Trener';
              return (
                <li key={t.trainer_id}>
                  <Link href={`/trener/${t.trainer_id}`}>
                    <Avatar url={t.trainers?.avatar_url} name={n} size="sm" />
                    <span>{n}</span>
                    {t.status === 'pending' && <span className="pill pill-warn">čeka potvrdu</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
