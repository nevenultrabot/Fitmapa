'use client';

import { useMemo, useState } from 'react';
import { getSupabase, errorMessage } from '@/lib/supabase';
import { dayKey } from '@/lib/format';

const WEEKDAYS = [
  { n: 1, label: 'Pon' },
  { n: 2, label: 'Uto' },
  { n: 3, label: 'Sre' },
  { n: 4, label: 'Čet' },
  { n: 5, label: 'Pet' },
  { n: 6, label: 'Sub' },
  { n: 7, label: 'Ned' },
];

function addDays(key, days) {
  const d = new Date(key + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return dayKey(d);
}

function toMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export default function AddSlots({ gyms, onDone, onNeedGym }) {
  const today = dayKey(new Date());
  const [gymId, setGymId] = useState(gyms[0]?.id || '');
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(addDays(today, 27));
  const [weekdays, setWeekdays] = useState([1, 2, 3, 4, 5]);
  const [start, setStart] = useState('17:00');
  const [end, setEnd] = useState('21:00');
  const [minutes, setMinutes] = useState(60);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const perDay = useMemo(() => {
    const diff = toMinutes(end) - toMinutes(start);
    return diff > 0 ? Math.floor(diff / minutes) : 0;
  }, [start, end, minutes]);

  const estimate = useMemo(() => {
    if (!from || !to || to < from) return 0;
    let count = 0;
    let key = from;
    for (let i = 0; i < 100 && key <= to; i++) {
      const iso = ((new Date(key + 'T12:00:00').getDay() + 6) % 7) + 1;
      if (weekdays.includes(iso)) count++;
      key = addDays(key, 1);
    }
    return count * perDay;
  }, [from, to, weekdays, perDay]);

  if (gyms.length === 0) {
    return (
      <div className="card">
        <p>Pre pravljenja termina izaberi bar jednu teretanu u kojoj radiš.</p>
        <button className="btn btn-primary" onClick={onNeedGym}>Idi na profil</button>
      </div>
    );
  }

  function toggleDay(n) {
    setWeekdays((w) => (w.includes(n) ? w.filter((x) => x !== n) : [...w, n].sort()));
  }

  async function submit(e) {
    e.preventDefault();
    setMessage(null);
    if (weekdays.length === 0) {
      setMessage({ type: 'error', text: 'Izaberi bar jedan dan u nedelji.' });
      return;
    }
    setBusy(true);
    const { data, error } = await getSupabase().rpc('create_slots', {
      p_gym_id: gymId,
      p_from: from,
      p_to: to,
      p_weekdays: weekdays,
      p_start: start,
      p_end: end,
      p_minutes: Number(minutes),
    });
    setBusy(false);
    if (error) {
      setMessage({ type: 'error', text: errorMessage(error) });
    } else if (data === 0) {
      setMessage({ type: 'warn', text: 'Nije napravljen nijedan novi termin — možda već postoje u tom vremenu ili su u prošlosti.' });
    } else {
      setMessage({ type: 'ok', text: `Napravljeno ${data} termina. Sada su vidljivi klijentima.` });
      setTimeout(onDone, 1200);
    }
  }

  return (
    <form className="card form" onSubmit={submit}>
      <h2 className="section-title">Napravi termine za više dana odjednom</h2>
      <p className="small muted">
        Primer: ponedeljak–petak od 17 do 21h, po 60 minuta = 4 termina dnevno. Termini koji se preklapaju sa postojećim se preskaču.
      </p>

      <label className="field">
        <span>Teretana</span>
        <select className="input" value={gymId} onChange={(e) => setGymId(e.target.value)}>
          {gyms.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      </label>

      <div className="row">
        <label className="field">
          <span>Od datuma</span>
          <input className="input" type="date" value={from} min={today} onChange={(e) => setFrom(e.target.value)} required />
        </label>
        <label className="field">
          <span>Do datuma</span>
          <input className="input" type="date" value={to} min={from} max={addDays(from, 92)} onChange={(e) => setTo(e.target.value)} required />
        </label>
      </div>

      <fieldset className="field">
        <legend>Dani u nedelji</legend>
        <div className="weekday-pick">
          {WEEKDAYS.map((d) => (
            <button
              type="button"
              key={d.n}
              className={weekdays.includes(d.n) ? 'chip chip-btn active' : 'chip chip-btn'}
              onClick={() => toggleDay(d.n)}
            >
              {d.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="row">
        <label className="field">
          <span>Početak</span>
          <input className="input" type="time" step="900" value={start} onChange={(e) => setStart(e.target.value)} required />
        </label>
        <label className="field">
          <span>Kraj</span>
          <input className="input" type="time" step="900" value={end} onChange={(e) => setEnd(e.target.value)} required />
        </label>
        <label className="field">
          <span>Trajanje</span>
          <select className="input" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
            {[30, 45, 60, 75, 90, 120].map((m) => (
              <option key={m} value={m}>{m} min</option>
            ))}
          </select>
        </label>
      </div>

      <p className="small">
        Biće napravljeno oko <strong>{estimate}</strong> termina ({perDay} dnevno).
      </p>

      {message && <p className={`alert alert-${message.type}`}>{message.text}</p>}

      <button className="btn btn-primary btn-block" disabled={busy || estimate === 0}>
        {busy ? 'Pravim…' : 'Napravi termine'}
      </button>
    </form>
  );
}
