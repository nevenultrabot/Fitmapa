'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSupabase, errorMessage } from '@/lib/supabase';

// Stranica na koju vodi link iz emaila "Reset password".
// Supabase iz linka sam prijavi korisnika (privremeno), a ovde on bira novu lozinku.
export default function NewPasswordPage() {
  const router = useRouter();
  const [status, setStatus] = useState('checking'); // checking | ready | invalid | done
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const supabase = getSupabase();
    let decided = false;
    const ready = () => {
      decided = true;
      setStatus('ready');
    };
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (session && event === 'SIGNED_IN')) ready();
    });
    // link je možda već obrađen pre nego što smo počeli da slušamo
    supabase.auth.getSession().then(({ data }) => data.session && ready());
    // greška u linku (istekao / već iskorišćen)
    if (/error=|error_code=/.test(window.location.hash + window.location.search)) {
      decided = true;
      setStatus('invalid');
    }
    const t = setTimeout(() => !decided && setStatus('invalid'), 4000);
    return () => {
      clearTimeout(t);
      sub.subscription.unsubscribe();
    };
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (password !== password2) {
      setError('Lozinke se ne poklapaju.');
      return;
    }
    setBusy(true);
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.updateUser({ password });
    if (error) {
      setBusy(false);
      setError(errorMessage(error));
      return;
    }
    setStatus('done');
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
    setTimeout(() => router.push(profile?.role === 'trainer' ? '/panel' : '/mapa'), 1200);
  }

  return (
    <div className="page narrow">
      <div className="card">
        <h1 className="section-title">Nova lozinka</h1>

        {status === 'checking' && <p className="muted">Proveravam link…</p>}

        {status === 'invalid' && (
          <>
            <p className="alert alert-error">Link je istekao ili je već iskorišćen.</p>
            <Link href="/prijava" className="btn btn-primary btn-block">
              Zatraži novi link
            </Link>
          </>
        )}

        {status === 'done' && <p className="alert alert-ok">Lozinka je promenjena ✓ Prijavljujem te…</p>}

        {status === 'ready' && (
          <form className="form" onSubmit={submit}>
            <p className="small muted">Izaberi novu lozinku (bar 6 karaktera).</p>
            <label className="field">
              <span>Nova lozinka</span>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </label>
            <label className="field">
              <span>Ponovi lozinku</span>
              <input
                className="input"
                type="password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </label>
            {error && <p className="alert alert-error">{error}</p>}
            <button className="btn btn-primary btn-block" disabled={busy}>
              {busy ? 'Čuvam…' : 'Sačuvaj novu lozinku'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
