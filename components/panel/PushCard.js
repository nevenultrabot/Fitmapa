'use client';

import { useEffect, useState } from 'react';
import { FiBell, FiBellOff, FiShare } from 'react-icons/fi';
import { pushState, enablePush, disablePush } from '@/lib/push';

// Kartica u Panelu: trener uključi obaveštenja na telefonu/računaru za nove treninge i zahteve.
export default function PushCard() {
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    pushState().then(setState).catch(() => setState('unsupported'));
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

  async function turnOff() {
    setBusy(true);
    await disablePush().catch(() => {});
    setState('off');
    setBusy(false);
  }

  if (!state || state === 'unsupported') return null;

  if (state === 'on') {
    return (
      <div className="push-card is-on">
        <FiBell aria-hidden="true" />
        <span>
          <strong>Obaveštenja su uključena na ovom uređaju.</strong>
          <span className="small muted"> Javljamo ti svaki novi trening, zahtev i otkazivanje.</span>
        </span>
        <button className="btn btn-small btn-ghost" onClick={turnOff} disabled={busy}>
          Isključi
        </button>
      </div>
    );
  }

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
