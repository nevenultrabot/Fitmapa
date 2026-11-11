'use client';

import { useState } from 'react';
import MapView from '@/components/MapView';
import { getSupabase, errorMessage } from '@/lib/supabase';
import { uploadPhoto } from '@/lib/upload';

/**
 * Dodavanje nove ili izmena postojeće teretane (naziv, adresa, radno vreme,
 * članarina, slika, cenovnik, lokacija na mapi).
 * linkTrainer: novu teretanu odmah poveži sa trenerom koji ju je dodao.
 */
export default function GymForm({ userId, gym, onCancel, onSaved, linkTrainer = true }) {
  const [f, setF] = useState({
    name: gym?.name || '',
    address: gym?.address || '',
    opening_hours: gym?.opening_hours || '',
    membership: gym?.membership || '',
  });
  const [image, setImage] = useState(gym?.image_url || null);
  const [priceList, setPriceList] = useState(gym?.price_list_url || null);
  const [point, setPoint] = useState(gym ? { lat: gym.lat, lng: gym.lng } : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function onFile(e, setter, opts) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      setter(await uploadPhoto(userId, file, opts));
    } catch (err) {
      setError(errorMessage(err));
    }
    setBusy(false);
    e.target.value = '';
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!point) {
      setError('Klikni na mapu da označiš gde se teretana nalazi.');
      return;
    }
    setBusy(true);
    const supabase = getSupabase();
    const values = {
      name: f.name.trim(),
      address: f.address.trim() || null,
      opening_hours: f.opening_hours.trim(),
      membership: f.membership.trim(),
      image_url: image,
      price_list_url: priceList,
      lat: point.lat,
      lng: point.lng,
    };
    let err;
    let saved = null;
    if (gym) {
      ({ data: saved, error: err } = await supabase.from('gyms').update(values).eq('id', gym.id).select().maybeSingle());
      if (!err && !saved) err = new Error('Nemaš pravo da menjaš ovu teretanu.');
    } else {
      ({ data: saved, error: err } = await supabase.from('gyms').insert({ ...values, created_by: userId }).select().single());
      if (!err && linkTrainer) ({ error: err } = await supabase.from('trainer_gyms').insert({ trainer_id: userId, gym_id: saved.id }));
    }
    setBusy(false);
    if (err) setError(errorMessage(err));
    else onSaved(saved);
  }

  return (
    <form className="form add-gym" onSubmit={submit}>
      <h3 className="sub-title">{gym ? `Uredi: ${gym.name}` : 'Nova teretana'}</h3>

      <div className="gym-form-images">
        <div className="gym-form-image">
          {image ? <img src={image} alt="" /> : <span className="small muted">Bez slike</span>}
          <label className="btn btn-small">
            {image ? 'Promeni sliku teretane' : 'Dodaj sliku teretane'}
            <input type="file" accept="image/*" hidden onChange={(e) => onFile(e, setImage)} disabled={busy} />
          </label>
        </div>
        <div className="gym-form-image">
          {priceList ? <img src={priceList} alt="" /> : <span className="small muted">Bez cenovnika</span>}
          <label className="btn btn-small">
            {priceList ? 'Promeni cenovnik' : 'Dodaj cenovnik (slika)'}
            {/* cenovnik u većoj rezoluciji da bi se tekst lepo čitao */}
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => onFile(e, setPriceList, { maxSize: 2400, quality: 0.9 })}
              disabled={busy}
            />
          </label>
          {priceList && (
            <button type="button" className="btn btn-small btn-ghost" onClick={() => setPriceList(null)}>
              Ukloni
            </button>
          )}
        </div>
      </div>

      <div className="row">
        <label className="field">
          <span>Naziv teretane</span>
          <input className="input" value={f.name} onChange={set('name')} required />
        </label>
        <label className="field">
          <span>Tačna adresa</span>
          <input className="input" value={f.address} onChange={set('address')} placeholder="Ulica i broj, Novi Sad" />
        </label>
      </div>
      <label className="field">
        <span>Radno vreme</span>
        <input className="input" value={f.opening_hours} onChange={set('opening_hours')} placeholder="Pon–Pet 07–23h · Sub 09–21h · Ned 10–18h" />
      </label>
      <label className="field">
        <span>Članarina (kratko)</span>
        <input className="input" value={f.membership} onChange={set('membership')} placeholder="Mesečna 4.000 RSD · Dnevna 500 RSD" />
      </label>
      <p className="small">{point ? '✓ Lokacija označena (klikni ponovo da je pomeriš)' : 'Klikni na mapu tačno gde je teretana:'}</p>
      <MapView
        gyms={[]}
        onMapClick={setPoint}
        pickedPoint={point}
        center={point || undefined}
        showLocate={false}
        zoom={gym ? 15 : 13}
        className="map-small"
      />
      {error && <p className="alert alert-error">{error}</p>}
      <div className="modal-actions">
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Čuvam…' : gym ? 'Sačuvaj teretanu' : 'Dodaj teretanu'}</button>
        <button type="button" className="btn" onClick={onCancel}>Odustani</button>
      </div>
    </form>
  );
}
