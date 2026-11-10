'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase, errorMessage } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [role, setRole] = useState('client');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [next, setNext] = useState(null);

  useEffect(() => {
    const n = new URLSearchParams(window.location.search).get('next');
    if (n && n.startsWith('/')) setNext(n);
  }, []);

  async function goAfterLogin(userId) {
    const { data } = await getSupabase().from('profiles').select('role').eq('id', userId).maybeSingle();
    router.push(next || (data?.role === 'trainer' ? '/panel' : '/mapa'));
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    setInfo('');
    setBusy(true);
    const supabase = getSupabase();
    try {
      if (mode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await goAfterLogin(data.user.id);
      } else {
        if (fullName.trim().length < 2) throw new Error('Upiši ime i prezime.');
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { role, full_name: fullName.trim(), phone: phone.trim() },
            emailRedirectTo: window.location.origin + '/prijava',
          },
        });
        if (error) throw error;
        if (data.session) {
          await goAfterLogin(data.user.id);
        } else {
          setInfo('Nalog je napravljen! Poslali smo ti email — klikni na link za potvrdu, pa se prijavi.');
          setMode('login');
        }
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page narrow">
      <div className="card">
        <div className="tabs">
          <button className={mode === 'login' ? 'tab active' : 'tab'} onClick={() => setMode('login')}>
            Prijava
          </button>
          <button className={mode === 'signup' ? 'tab active' : 'tab'} onClick={() => setMode('signup')}>
            Registracija
          </button>
        </div>

        {info && <p className="alert alert-ok">{info}</p>}
        {error && <p className="alert alert-error">{error}</p>}

        <form onSubmit={submit} className="form">
          {mode === 'signup' && (
            <>
              <fieldset className="role-pick">
                <legend>Ja sam</legend>
                <label className={role === 'client' ? 'role-option active' : 'role-option'}>
                  <input type="radio" name="role" checked={role === 'client'} onChange={() => setRole('client')} />
                  <strong>Vežbač</strong>
                  <span className="small muted">Tražim trenera i zakazujem termine</span>
                </label>
                <label className={role === 'trainer' ? 'role-option active' : 'role-option'}>
                  <input type="radio" name="role" checked={role === 'trainer'} onChange={() => setRole('trainer')} />
                  <strong>Personalni trener</strong>
                  <span className="small muted">Pravim profil i upravljam rasporedom</span>
                </label>
              </fieldset>
              <label className="field">
                <span>Ime i prezime</span>
                <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </label>
              <label className="field">
                <span>Telefon</span>
                <input className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="06x xxx xxxx" />
                <span className="small muted">
                  {role === 'trainer'
                    ? 'Biće prikazan na tvom javnom profilu (možeš ga promeniti kasnije).'
                    : 'Vidi ga samo trener kod koga zakažeš termin.'}
                </span>
              </label>
            </>
          )}
          <label className="field">
            <span>Email</span>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </label>
          <label className="field">
            <span>Lozinka</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </label>
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Sačekaj…' : mode === 'login' ? 'Prijavi se' : 'Napravi nalog'}
          </button>
        </form>
      </div>
    </div>
  );
}
