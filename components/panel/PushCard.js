'use client';

import { useEffect, useState } from 'react';
import { FiBell, FiBellOff, FiShare } from 'react-icons/fi';
import { pushState, enablePush, accountHasPush, PUSH_EVENT } from '@/lib/push';

// Kartica u Panelu: trener uključi obaveštenja na telefonu/računaru za nove treninge i zahteve.
export default function PushCard() {
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const check = async () => {
      const st = await pushState().catch(() => 'unsupported');
      // uključeno na nekom drugom uređaju (npr. telefonu) → kartica ne treba; na ovom se uključuje preko zvona
      if (st !== 'on' && (await accountHasPush().catch(() => false))) return setState('elsewhere');
      setState(st);
    };
    check();
    window.addEventListener(PUSH_EVENT, check);
    return () => window.removeEventListener(PUSH_EVENT, check);
  }, []);

  async function turnOn() {
    setBusy(true);
    setError('');
    try {
      await enablePush();
      setState('on');
    } catch (e) {
      if (e.message === 'denied') setState('denied');
      else if (e.message !== 'dismissed')
        setError(
          /permission|NotAllowed/i.test(`${e.name} ${e.message}`)
            ? 'Pregledač nije dozvolio obaveštenja. Proveri dozvole za ovaj sajt (ikonica pored adrese) i pokušaj ponovo.'
            : 'Uključivanje nije uspelo. Proveri internet i pokušaj ponovo.'
        );
    }
    setBusy(false);
  }

  // kad su obaveštenja uključena (na ovom ili drugom uređaju), kartica nestaje —
  // status, uključivanje na ovom uređaju i isključivanje su na zvonu gore desno, skroz dole
  if (!state || state === 'unsupported' || state === 'on' || state === 'elsewhere') return null;

  return (
    <div className="push-card">
      <span className="push-card-icon">
        <FiBell aria-hidden="true" />
      </span>
      <div className="push-card-text">
        <strong>Uključi obaveštenja na telefonu</strong>
        {state === 'ios-install' ? (
          <span className="small">
            Na iPhone-u obaveštenja rade kad FitMapu dodaš na početni ekran: u Safariju dodirni{' '}
            <FiShare aria-label="Podeli" /> <b>Podeli</b> → <b>Dodaj na početni ekran</b>, otvori FitMapu sa ikonice i
            uključi ih ovde.
          </span>
        ) : state === 'denied' ? (
          <span className="small">
            <FiBellOff aria-hidden="true" /> Obaveštenja su blokirana u pregledaču. Dozvoli ih u podešavanjima sajta (ikonica
            pored adrese), pa osveži stranicu.
          </span>
        ) : (
          <span className="small muted">Da odmah saznaš kad neko zakaže trening ili pošalje zahtev za drugu teretanu.</span>
        )}
        {error && <span className="small push-card-error">{error}</span>}
      </div>
      {state === 'off' && (
        <button className="btn btn-primary btn-small" onClick={turnOn} disabled={busy}>
          {busy ? 'Uključujem…' : 'Uključi'}
        </button>
      )}
    </div>
  );
}
