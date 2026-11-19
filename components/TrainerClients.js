'use client';

import { useCallback, useEffect, useState } from 'react';
import { FiUserPlus, FiUserCheck, FiClock, FiX } from 'react-icons/fi';
import { getSupabase, errorMessage } from '@/lib/supabase';

// Vežbači trenera: javni spisak + veza ulogovanog vežbača sa ovim trenerom.
export function useTrainerClients(trainerId, user) {
  const [list, setList] = useState([]);
  const [relation, setRelation] = useState(null); // null | 'pending' | 'accepted'

  const load = useCallback(async () => {
    const supabase = getSupabase();
    const { data } = await supabase.rpc('trainer_client_list', { p_trainer_id: trainerId });
    setList(data || []);
    if (user) {
      const { data: rel } = await supabase
        .from('trainer_clients')
        .select('status')
        .eq('trainer_id', trainerId)
        .eq('client_id', user.id)
        .maybeSingle();
      setRelation(rel?.status || null);
    }
  }, [trainerId, user]);

  useEffect(() => {
    load();
  }, [load]);

  return { list, relation, reload: load };
}

// Dugme na profilu trenera: Dodaj trenera / Zahtev poslat / Moj trener
export function AddTrainerButton({ trainerId, relation, onChange, onNeedLogin }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function act(fn) {
    setBusy(true);
    setError('');
    const { error } = await fn();
    setBusy(false);
    if (error) setError(errorMessage(error));
    onChange();
  }

  const request = () => act(() => getSupabase().rpc('request_trainer', { p_trainer_id: trainerId }));
  const remove = (text) => {
    if (!window.confirm(text)) return;
    act(() => getSupabase().rpc('remove_trainer_client', { p_other: trainerId }));
  };

  return (
    <div className="add-trainer">
      {relation === 'accepted' ? (
        <button className="btn btn-small add-trainer-on" disabled={busy} onClick={() => remove('Ukloniti ovog trenera iz svojih trenera?')}>
          <FiUserCheck aria-hidden="true" /> Moj trener
        </button>
      ) : relation === 'pending' ? (
        <button className="btn btn-small" disabled={busy} onClick={() => remove('Povući zahtev?')} title="Klikni da povučeš zahtev">
          <FiClock aria-hidden="true" /> Zahtev poslat
        </button>
      ) : (
        <button className="btn btn-small btn-primary" disabled={busy} onClick={onNeedLogin || request}>
          <FiUserPlus aria-hidden="true" /> Dodaj trenera
        </button>
      )}
      {error && <span className="small add-trainer-error">{error}</span>}
    </div>
  );
}

// Prozor sa imenima vežbača
export function ClientsModal({ name, list, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal clients-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="clients-modal-head">
          <h2 className="section-title">Vežbači · {name}</h2>
          <button className="btn btn-small btn-ghost" onClick={onClose} aria-label="Zatvori">
            <FiX aria-hidden="true" />
          </button>
        </div>
        {list.length === 0 ? (
          <p className="muted">Još nema vežbača.</p>
        ) : (
          <ul className="clients-list">
            {list.map((c) => (
              <li key={c.client_id}>
                <span className="clients-initial" aria-hidden="true">
                  {(c.full_name || '?').trim().charAt(0).toUpperCase()}
                </span>
                <span>{c.full_name}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
