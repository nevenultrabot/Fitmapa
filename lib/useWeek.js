'use client';

import { useEffect, useState } from 'react';
import { getSupabase } from './supabase';
import { TZ, LOCALE, dayKey } from './format';

const SHORT = ['Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub', 'Ned'];

function addDaysKey(key, n) {
  const d = new Date(key + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function labelFor(key, opts) {
  return new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, ...opts }).format(new Date(key + 'T12:00:00Z'));
}

// Aktivna nedelja (pon–ned). Od nedelje u 22h baza već vraća sledeću nedelju.
export function buildWeek(row) {
  const today = dayKey(new Date());
  const days = Array.from({ length: 7 }, (_, i) => {
    const key = addDaysKey(row.first_day, i);
    return {
      key,
      iso: i + 1,
      short: SHORT[i],
      num: labelFor(key, { day: 'numeric' }).replace('.', ''),
      label: labelFor(key, { weekday: 'long', day: 'numeric', month: 'long' }),
      past: key < today,
      today: key === today,
    };
  });
  const range = `${labelFor(days[0].key, { day: 'numeric', month: 'long' })} – ${labelFor(days[6].key, {
    day: 'numeric',
    month: 'long',
  })}`;
  return { start: row.week_start, end: row.week_end, days, range };
}

export function useWeek() {
  const [week, setWeek] = useState(null);
  useEffect(() => {
    getSupabase()
      .rpc('active_week')
      .then(({ data, error }) => {
        const row = Array.isArray(data) ? data[0] : data;
        if (!error && row) setWeek(buildWeek(row));
      });
  }, []);
  return week;
}
