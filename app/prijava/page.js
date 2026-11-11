'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase, errorMessage } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState('login'); // 'login' | 'signup' | 'forgot' (zaboravljena lozinka)
  const [resetStep, setResetStep] = useState(1); // 1 = upis emaila, 2 = kod + nova lozinka
  const [code, setCode] = useState('');
  const [showCode, setShowCode] = useState(false); // kod se koristi tek kad se poveže sopstveni SMTP
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

  function switchMode(m) {
    setMode(m);
    setError('');
    setInfo('');
    setResetStep(1);
    setShowCode(false);
    setCode('');
    setPassword('');
  }

  // Zaboravljena lozinka: 1) pošalji kod na email  2) proveri kod i postavi novu lozinku
  async function submitReset(e) {
    e.preventDefault();
    setError('');
    setInfo('');
    setBusy(true);
    const supabase = getSupabase();
    try {
      if (resetStep === 1) {
        // email sadrži link koji vodi na /nova-lozinka (i kod, ako je šablon podešen)
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/nova-lozinka`,
        });
        if (error) throw error;
        setResetStep(2);
        setInfo(`Ako nalog sa adresom ${email.trim()} postoji, poslali smo ti email. Proveri inbox (i spam).`);
      } else {
        const { data, error } = await supabase.auth.verifyOtp({
          email: email.trim(),
          token: code.trim(),
          type: 'recovery',
        });
        if (error) throw new Error('Kod nije ispravan ili je istekao. Proveri ga ili zatraži novi.');
        const { error: upErr } = await supabase.auth.updateUser({ password });
        if (upErr) throw upErr;
        await goAfterLogin(data.user.id);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
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
          <button className={mode !== 'signup' ? 'tab active' : 'tab'} onClick={() => switchMode('login')}>
            Prijava
          </button>
          <button className={mode === 'signup' ? 'tab active' : 'tab'} onClick={() => switchMode('signup')}>
            Registracija
          </button>
        </div>

        {info && <p className="alert alert-ok">{info}</p>}
        {error && <p className="alert alert-error">{error}</p>}

        {mode === 'forgot' ? (
          <form onSubmit={submitReset} className="form">
            <div>
              <h2 className="section-title">Nova lozinka</h2>
              <p className="small muted">
                {resetStep === 1
                  ? 'Upiši email sa kojim si se registrovao — poslaćemo ti link za promenu lozinke.'
                  : 'Otvori email i klikni na link „Reset password". Otvoriće se stranica gde biraš novu lozinku.'}
              </p>
            </div>
            <label className="field">
              <span>Email</span>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={resetStep === 2}
              />
            </label>
            {resetStep === 2 && !showCode && (
              <button type="button" className="link-btn" onClick={() => setShowCode(true)}>
                U emailu imam kod umesto linka
              </button>
            )}
            {resetStep === 2 && showCode && (
              <>
                <label className="field">
                  <span>Kod iz emaila</span>
                  <input
                    className="input code-input"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6,10}"
                    maxLength={10}
                    placeholder="123456"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    required
                  />
                </label>
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
              </>
            )}
            {(resetStep === 1 || showCode) && (
              <button className="btn btn-primary btn-block" disabled={busy}>
                {busy ? 'Sačekaj…' : resetStep === 1 ? 'Pošalji email' : 'Promeni lozinku i prijavi me'}
              </button>
            )}
            <div className="form-links">
              {resetStep === 2 && (
                <button type="button" className="link-btn" onClick={() => { setResetStep(1); setCode(''); setInfo(''); setShowCode(false); }}>
                  Nije stigao email? Pošalji ponovo
                </button>
              )}
              <button type="button" className="link-btn" onClick={() => switchMode('login')}>
                ← Nazad na prijavu
              </button>
            </div>
          </form>
        ) : (
        <form onSubmit={submit} className="form">
          {mode === 'signup' && (
            <>
              <fieldset className="role-pick">
                <legend>Ja sam</legend>
                <label className={role === 'client' ? 'role-option active' : 'role-option'}>
                  <input type="radio" name="role" checked={role === 'client'} onChange={() => setRole('client')} />
                  <strong>Vežbač</strong>
                </label>
                <label className={role === 'trainer' ? 'role-option active' : 'role-option'}>
                  <input type="radio" name="role" checked={role === 'trainer'} onChange={() => setRole('trainer')} />
                  <strong>Personalni trener</strong>
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
          {mode === 'login' && (
            <button type="button" className="link-btn forgot-link" onClick={() => switchMode('forgot')}>
              Zaboravio si lozinku?
            </button>
          )}
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Sačekaj…' : mode === 'login' ? 'Prijavi se' : 'Napravi nalog'}
          </button>
        </form>
        )}
      </div>
    </div>
  );
}
