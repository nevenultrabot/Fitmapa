'use client';

import { useMemo, useState } from 'react';
import { getSupabase, errorMessage } from '@/lib/supabase';

function toMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export default function AddSlots({ gyms, week, presetDay, onDone, onNeedGym }) {
  const openDays = (week?.days || []).filter((d) => !d.past).map((d) => d.iso);
  const [gymId, setGymId] = useState(gyms[0]?.id || '');
  const [weekdays, setWeekdays] = useState(() =>
    presetDay ? [presetDay] : openDays.filter((n) => n <= 5).length ? openDays.filter((n) => n <= 5) : openDays
  );
  const [start, setStart] = useState('17:00');
  const [end, setEnd] = useState('21:00');
  const [minutes, setMinutes] = useState(60);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const perDay = useMemo(() => {
    const diff = toMinutes(end) - toMinutes(start);
    return diff > 0 ? Math.floor(diff / minutes) : 0;
  }, [start, end, minutes]);

  if (gyms.length === 0) {
    return (
      <div className="card">
        <p>Pre pravljenja termina izaberi bar jednu teretanu u kojoj radiš.</p>
        <button className="btn btn-primary" onClick={onNeedGym}>Idi na profil</button>
      </div>
    );
  }
  if (!week) return <p className="muted">Učitavam…</p>;

  const selected = weekdays.filter((n) => openDays.includes(n));
  const estimate = selected.length * perDay;

  function toggleDay(n) {
    setWeekdays((w) => (w.includes(n) ? w.filter((x) => x !== n) : [...w, n].sort()));
  }
  const preset = (list) => setWeekdays(list.filter((n) => openDays.includes(n)));

  async function submit(e) {
    e.preventDefault();
    setMessage(null);
    if (selected.length === 0) {
      setMessage({ type: 'error', text: 'Izaberi bar jedan dan.' });
      return;
    }
    setBusy(true);
    const { data, error } = await getSupabase().rpc('create_slots', {
      p_gym_id: gymId,
      p_weekdays: selected,
      p_start: start,
      p_end: end,
      p_minutes: Number(minutes),
    });
    setBusy(false);
    if (error) {
      setMessage({ type: 'error', text: errorMessage(error) });
    } else if (data === 0) {
      setMessage({ type: 'warn', text: 'Nije napravljen nijedan novi termin — već postoje u tom vremenu ili je to vreme prošlo.' });
    } else {
      setMessage({ type: 'ok', text: `Napravljeno ${data} termina. Klijenti ih već vide.` });
      setTimeout(onDone, 1200);
    }
  }

  return (
    <form className="card form" onSubmit={submit}>
      <div>
        <h2 className="section-title">Dodaj termine za ovu nedelju</h2>
        <p className="small muted">
          {week.range}. Izaberi dane i radno vreme — termini se prave sami. Za drugačije vreme po danima (npr. subotom ujutru)
          dodaj ih u dva navrata.
        </p>
      </div>

      <label className="field">
        <span>Teretana</span>
        <select className="input" value={gymId} onChange={(e) => setGymId(e.target.value)}>
          {gyms.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      </label>

      <fieldset className="field">
        <legend>Dani</legend>
        <div className="week-pick">
          {week.days.map((d) => (
            <button
              type="button"
              key={d.key}
              disabled={d.past}
              className={selected.includes(d.iso) ? 'week-day active' : 'week-day'}
              onClick={() => toggleDay(d.iso)}
            >
              <span className="week-day-name">{d.short}</span>
              <span className="week-day-num">{d.num}</span>
            </button>
          ))}
        </div>
        <div className="preset-row">
          <button type="button" className="link-btn" onClick={() => preset([1, 2, 3, 4, 5])}>Radni dani</button>
          <button type="button" className="link-btn" onClick={() => preset([6, 7])}>Vikend</button>
          <button type="button" className="link-btn" onClick={() => preset([1, 2, 3, 4, 5, 6, 7])}>Svi preostali</button>
          <button type="button" className="link-btn" onClick={() => setWeekdays([])}>Poništi</button>
        </div>
      </fieldset>

      <div className="row">
        <label className="field">
          <span>Od</span>
          <input className="input" type="time" step="900" value={start} onChange={(e) => setStart(e.target.value)} required />
        </label>
        <label className="field">
          <span>Do</span>
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

      <p className="estimate">
        Biće napravljeno do <strong>{estimate}</strong> termina · {perDay} dnevno × {selected.length}{' '}
        {selected.length === 1 ? 'dan' : 'dana'}
      </p>

      {message && <p className={`alert alert-${message.type}`}>{message.text}</p>}

      <button className="btn btn-primary btn-block" disabled={busy || estimate === 0}>
        {busy ? 'Pravim…' : 'Napravi termine'}
      </button>
    </form>
  );
}
