'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabase, errorMessage } from '@/lib/supabase';
import { formatDate, formatDateTime, whatsappLink } from '@/lib/format';

// Panel → Vežbači: zahtevi za prihvatanje i spisak vežbača
export default function Clients({ userId, onCountChange }) {
  const [requests, setRequests] = useState(null);
  const [list, setList] = useState([]);
  const [busy, setBusy] = useState(null);
  const [message, setMessage] = useState(null);

  const load = useCallback(async () => {
    const supabase = getSupabase();
    const [r, l] = await Promise.all([
      supabase.rpc('my_client_requests'),
      supabase.rpc('trainer_client_list', { p_trainer_id: userId }),
    ]);
    setRequests(r.data || []);
    setList(l.data || []);
    onCountChange?.((r.data || []).length);
  }, [userId, onCountChange]);

  useEffect(() => {
    load();
  }, [load]);

  async function run(id, fn, ok) {
    setBusy(id);
    const { error } = await fn();
    setBusy(null);
    setMessage(error ? { type: 'error', text: errorMessage(error) } : { type: 'ok', text: ok });
    load();
  }

  const respond = (c, accept) =>
    run(c.client_id, () => getSupabase().rpc('respond_client', { p_client_id: c.client_id, p_accept: accept }),
      accept ? `${c.full_name} je sada tvoj vežbač.` : 'Zahtev je odbijen.');

  const remove = (c) => {
    if (!window.confirm(`Ukloniti ${c.full_name} iz vežbača?`)) return;
    run(c.client_id, () => getSupabase().rpc('remove_trainer_client', { p_other: c.client_id }), 'Uklonjeno.');
  };

  if (requests === null) return <p className="muted">Učitavam…</p>;

  return (
    <div className="clients-panel">
      {message && <p className={`alert alert-${message.type}`} onClick={() => setMessage(null)}>{message.text}</p>}

      <section className="card">
        <h2 className="section-title">Zahtevi {requests.length > 0 && <span className="pill">{requests.length}</span>}</h2>
        {requests.length === 0 ? (
          <p className="small muted">Nema novih zahteva. Vežbači te dodaju sa tvog profila, a posle prvog odrađenog treninga postaju tvoji vežbači automatski.</p>
        ) : (
          <ul className="client-rows">
            {requests.map((c) => (
              <li key={c.client_id}>
                <span className="clients-initial" aria-hidden="true">{c.full_name.charAt(0).toUpperCase()}</span>
                <span className="client-rows-text">
                  <strong>{c.full_name}</strong>
                  <span className="small muted">
                    zahtev {formatDateTime(c.created_at)}
                    {c.phone && (
                      <>
                        {' · '}
                        <a href={whatsappLink(c.phone)} target="_blank" rel="noopener noreferrer">WhatsApp</a>
                      </>
                    )}
                  </span>
                </span>
                <span className="requests-actions">
                  <button className="btn btn-small btn-primary" disabled={busy === c.client_id} onClick={() => respond(c, true)}>Prihvati</button>
                  <button className="btn btn-small btn-danger btn-outline" disabled={busy === c.client_id} onClick={() => respond(c, false)}>Odbij</button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2 className="section-title">Moji vežbači · {list.length}</h2>
        <p className="small muted">
          Broj i imena vežbača vide se na tvom profilu. Broj treninga sa svakim od njih je u{' '}
          <Link href="/istorija">Istoriji treninga</Link>.
        </p>
        {list.length === 0 ? (
          <p className="small muted">Još nemaš vežbača.</p>
        ) : (
          <ul className="client-rows">
            {list.map((c) => (
              <li key={c.client_id}>
                <span className="clients-initial" aria-hidden="true">{c.full_name.charAt(0).toUpperCase()}</span>
                <span className="client-rows-text">
                  <strong>{c.full_name}</strong>
                  {c.since && <span className="small muted">od {formatDate(c.since)}</span>}
                </span>
                <button className="btn btn-small btn-ghost" disabled={busy === c.client_id} onClick={() => remove(c)} aria-label={`Ukloni ${c.full_name}`}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
