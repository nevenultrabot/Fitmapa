'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FiDownload, FiLock } from 'react-icons/fi';
import Avatar from '@/components/Avatar';
import { getSupabase } from '@/lib/supabase';
import { useSession } from '@/lib/useSession';
import { dayKey, formatDayShort, formatTime, monthKey, monthLabel } from '@/lib/format';

// Istorija odrađenih treninga — vidi je samo trener ili vežbač čija je.
export default function HistoryPage() {
  const router = useRouter();
  const { loading, user, profile } = useSession();
  const [rows, setRows] = useState(null);
  const [myTrainers, setMyTrainers] = useState([]);
  const [person, setPerson] = useState('all');
  const [month, setMonth] = useState('all');

  const isTrainer = profile?.role === 'trainer';

  useEffect(() => {
    if (!loading && !user) router.push('/prijava?next=/istorija');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user || !profile) return;
    const supabase = getSupabase();
    supabase
      .from('bookings')
      .select(
        'id, trainer_id, client_id, place:gyms(name), slots!inner(starts_at, ends_at, gyms(name)), client:profiles!bookings_client_id_fkey(full_name), trainers(profiles!trainers_id_fkey(full_name))'
      )
      .eq(isTrainer ? 'trainer_id' : 'client_id', user.id)
      .eq('status', 'confirmed')
      .lt('slots.ends_at', new Date().toISOString())
      .then(({ data }) => {
        const list = (data || [])
          .filter((b) => b.slots)
          .map((b) => ({
            id: b.id,
            start: b.slots.starts_at,
            end: b.slots.ends_at,
            gym: b.place?.name || b.slots.gyms?.name || '',
            personId: isTrainer ? b.client_id : b.trainer_id,
            personName: (isTrainer ? b.client?.full_name : b.trainers?.profiles?.full_name) || (isTrainer ? 'Vežbač' : 'Trener'),
          }))
          .sort((a, b) => new Date(b.start) - new Date(a.start));
        setRows(list);
      });

    if (!isTrainer) {
      supabase
        .from('trainer_clients')
        .select('trainer_id, status, trainers(avatar_url, profiles!trainers_id_fkey(full_name))')
        .eq('client_id', user.id)
        .then(({ data }) => setMyTrainers(data || []));
    }
  }, [user, profile, isTrainer]);

  const people = useMemo(() => {
    const map = new Map();
    for (const r of rows || []) map.set(r.personId, r.personName);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], 'sr'));
  }, [rows]);

  const months = useMemo(() => [...new Set((rows || []).map((r) => monthKey(r.start)))], [rows]);

  const filtered = useMemo(
    () => (rows || []).filter((r) => (person === 'all' || r.personId === person) && (month === 'all' || monthKey(r.start) === month)),
    [rows, person, month]
  );

  const byMonth = useMemo(() => {
    const map = new Map();
    for (const r of filtered) {
      const k = monthKey(r.start);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(r);
    }
    return [...map.entries()];
  }, [filtered]);

  function downloadCsv() {
    const head = ['Datum', 'Početak', 'Kraj', isTrainer ? 'Vežbač' : 'Trener', 'Teretana'];
    const lines = [...filtered]
      .reverse()
      .map((r) => [dayKey(r.start), formatTime(r.start), formatTime(r.end), r.personName, r.gym]);
    const csv = [head, ...lines].map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `fitmapa-istorija${month !== 'all' ? '-' + month : ''}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading || !user || rows === null) return <div className="page"><p className="muted">Učitavam…</p></div>;

  const thisMonth = monthKey(new Date());
  const thisMonthCount = rows.filter((r) => monthKey(r.start) === thisMonth).length;
  const personWord = isTrainer ? 'vežbač' : 'trener';

  return (
    <div className="page narrow history-page">
      <h1>Istorija treninga</h1>
      <p className="small muted history-private">
        <FiLock aria-hidden="true" /> Vidiš je samo ti. Ovde su svi odrađeni treninzi, za evidenciju i obračun.
      </p>

      {!isTrainer && myTrainers.length > 0 && (
        <section className="card my-trainers">
          <h2 className="section-title">Moji treneri</h2>
          <ul>
            {myTrainers.map((t) => {
              const n = t.trainers?.profiles?.full_name || 'Trener';
              return (
                <li key={t.trainer_id}>
                  <Link href={`/trener/${t.trainer_id}`}>
                    <Avatar url={t.trainers?.avatar_url} name={n} size="sm" />
                    <span>{n}</span>
                    {t.status === 'pending' && <span className="pill pill-warn">čeka potvrdu</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="history-stats">
        <div className="stat">
          <span className="stat-num">{rows.length}</span>
          <span className="small muted">ukupno treninga</span>
        </div>
        <div className="stat">
          <span className="stat-num">{thisMonthCount}</span>
          <span className="small muted">ovog meseca</span>
        </div>
        <div className="stat">
          <span className="stat-num">{people.length}</span>
          <span className="small muted">{isTrainer ? (people.length === 1 ? 'vežbač' : 'vežbača') : people.length === 1 ? 'trener' : 'trenera'}</span>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card empty-week">
          <strong>Još nema odrađenih treninga.</strong>
          <p className="small muted">
            Treninzi se ovde pojavljuju automatski čim prođu.{' '}
            {!isTrainer && <Link href="/mapa">Pronađi trenera →</Link>}
          </p>
        </div>
      ) : (
        <>
          <div className="history-filters">
            <label className="field">
              <span>{isTrainer ? 'Vežbač' : 'Trener'}</span>
              <select className="input" value={person} onChange={(e) => setPerson(e.target.value)}>
                <option value="all">Svi</option>
                {people.map(([id, n]) => (
                  <option key={id} value={id}>{n}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Mesec</span>
              <select className="input" value={month} onChange={(e) => setMonth(e.target.value)}>
                <option value="all">Svi meseci</option>
                {months.map((m) => (
                  <option key={m} value={m}>{monthLabel(m)}</option>
                ))}
              </select>
            </label>
            <button className="btn history-csv" onClick={downloadCsv} disabled={filtered.length === 0}>
              <FiDownload aria-hidden="true" /> Preuzmi tabelu
            </button>
          </div>

          {byMonth.length === 0 && <p className="muted">Nema treninga za izabrani filter.</p>}

          {byMonth.map(([m, items]) => {
            const counts = new Map();
            for (const r of items) counts.set(r.personName, (counts.get(r.personName) || 0) + 1);
            return (
              <section key={m} className="card history-month">
                <div className="history-month-head">
                  <h2>{monthLabel(m)}</h2>
                  <span className="pill">{items.length} {items.length === 1 ? 'trening' : 'treninga'}</span>
                </div>
                {person === 'all' && counts.size > 1 && (
                  <div className="history-counts">
                    {[...counts.entries()]
                      .sort((a, b) => b[1] - a[1])
                      .map(([n, c]) => (
                        <span key={n} className="chip">
                          {n} <b>×{c}</b>
                        </span>
                      ))}
                  </div>
                )}
                <ul className="history-rows">
                  {items.map((r) => (
                    <li key={r.id}>
                      <span className="history-date">
                        <strong>{formatDayShort(r.start)}</strong>
                        <span className="small muted">
                          {formatTime(r.start)}–{formatTime(r.end)}
                        </span>
                      </span>
                      <span className="history-who">
                        <strong>{r.personName}</strong>
                        <span className="small muted">{r.gym}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
          <p className="small muted">
            „Preuzmi tabelu” pravi fajl koji se otvara u Excel-u ili Google Sheets-u (prikazani {personWord === 'vežbač' ? 'vežbači' : 'treneri'} i meseci).
          </p>
        </>
      )}
    </div>
  );
}
