'use client';

import { useEffect, useState } from 'react';
import Avatar from '@/components/Avatar';
import MapView from '@/components/MapView';
import { getSupabase, errorMessage } from '@/lib/supabase';

const MAX_PHOTOS = 8;

// Smanjuje sliku na max 1600px i pretvara u JPEG (telefonske slike su često > 5 MB)
async function resizeImage(file, maxSize = 1600) {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve) => canvas.toBlob((b) => resolve(b || file), 'image/jpeg', 0.85));
  } catch {
    return file;
  }
}

async function uploadPhoto(userId, file) {
  const blob = await resizeImage(file);
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const storage = getSupabase().storage.from('photos');
  const { error } = await storage.upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return storage.getPublicUrl(path).data.publicUrl;
}

export default function ProfileEditor({ userId, profile, trainer, myGyms, onSaved }) {
  const [form, setForm] = useState({
    full_name: profile.full_name || '',
    bio: trainer.bio || '',
    specialties: (trainer.specialties || []).join(', '),
    years_experience: trainer.years_experience ?? '',
    certificates: trainer.certificates || '',
    price_per_session: trainer.price_per_session ?? '',
    price_note: trainer.price_note || '',
    instagram: trainer.instagram || '',
    whatsapp: trainer.whatsapp || '',
    viber: trainer.viber || '',
    contact_phone: trainer.contact_phone || '',
    contact_email: trainer.contact_email || '',
    is_published: trainer.is_published,
  });
  const [avatarUrl, setAvatarUrl] = useState(trainer.avatar_url);
  const [photos, setPhotos] = useState(trainer.photos || []);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const set = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  async function save(e) {
    e?.preventDefault();
    setSaving(true);
    setMessage(null);
    const supabase = getSupabase();
    const specialties = form.specialties
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 12);
    const toNum = (v) => (v === '' || v === null ? null : Number(v));

    const [p, t] = await Promise.all([
      supabase.from('profiles').update({ full_name: form.full_name.trim() }).eq('id', userId),
      supabase
        .from('trainers')
        .update({
          bio: form.bio.trim(),
          specialties,
          years_experience: toNum(form.years_experience),
          certificates: form.certificates.trim(),
          price_per_session: toNum(form.price_per_session),
          price_note: form.price_note.trim(),
          instagram: form.instagram.trim() || null,
          whatsapp: form.whatsapp.trim() || null,
          viber: form.viber.trim() || null,
          contact_phone: form.contact_phone.trim() || null,
          contact_email: form.contact_email.trim() || null,
          is_published: form.is_published,
          avatar_url: avatarUrl,
          photos,
        })
        .eq('id', userId),
    ]);
    setSaving(false);
    const error = p.error || t.error;
    if (error) setMessage({ type: 'error', text: errorMessage(error) });
    else {
      setMessage({ type: 'ok', text: 'Profil je sačuvan.' });
      onSaved();
    }
  }

  async function onAvatar(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadPhoto(userId, file);
      setAvatarUrl(url);
      await getSupabase().from('trainers').update({ avatar_url: url }).eq('id', userId);
      setMessage({ type: 'ok', text: 'Profilna slika je postavljena.' });
    } catch (err) {
      setMessage({ type: 'error', text: errorMessage(err) });
    }
    setUploading(false);
    e.target.value = '';
  }

  async function onPhotos(e) {
    const files = [...(e.target.files || [])].slice(0, MAX_PHOTOS - photos.length);
    if (!files.length) return;
    setUploading(true);
    try {
      const urls = [];
      for (const f of files) urls.push(await uploadPhoto(userId, f));
      const next = [...photos, ...urls];
      setPhotos(next);
      await getSupabase().from('trainers').update({ photos: next }).eq('id', userId);
      setMessage({ type: 'ok', text: 'Slike su dodate.' });
    } catch (err) {
      setMessage({ type: 'error', text: errorMessage(err) });
    }
    setUploading(false);
    e.target.value = '';
  }

  async function removePhoto(url) {
    const next = photos.filter((p) => p !== url);
    setPhotos(next);
    await getSupabase().from('trainers').update({ photos: next }).eq('id', userId);
    const marker = '/object/public/photos/';
    const i = url.indexOf(marker);
    if (i >= 0) await getSupabase().storage.from('photos').remove([decodeURIComponent(url.slice(i + marker.length))]);
  }

  return (
    <div className="profile-editor">
      {message && <p className={`alert alert-${message.type}`}>{message.text}</p>}

      <GymPicker userId={userId} myGyms={myGyms} onChanged={onSaved} />

      <form className="card form" onSubmit={save}>
        <h2 className="section-title">Javni profil</h2>

        <div className="avatar-edit">
          <Avatar url={avatarUrl} name={form.full_name} size="lg" />
          <label className="btn btn-small">
            {uploading ? 'Otpremam…' : 'Promeni profilnu sliku'}
            <input type="file" accept="image/*" hidden onChange={onAvatar} disabled={uploading} />
          </label>
        </div>

        <label className="field">
          <span>Ime i prezime</span>
          <input className="input" value={form.full_name} onChange={set('full_name')} required />
        </label>
        <label className="field">
          <span>O meni (bio)</span>
          <textarea className="input" rows={5} value={form.bio} onChange={set('bio')} placeholder="Ko si, kako radiš, sa kim najviše voliš da radiš…" />
        </label>
        <label className="field">
          <span>Specijalnosti (odvoji zarezom)</span>
          <input className="input" value={form.specialties} onChange={set('specialties')} placeholder="Snaga, Mršavljenje, Rehabilitacija" />
        </label>
        <div className="row">
          <label className="field">
            <span>Godine iskustva</span>
            <input className="input" type="number" min="0" max="70" value={form.years_experience} onChange={set('years_experience')} />
          </label>
          <label className="field">
            <span>Cena po treningu (RSD)</span>
            <input className="input" type="number" min="0" step="100" value={form.price_per_session} onChange={set('price_per_session')} />
          </label>
        </div>
        <label className="field">
          <span>Paketi i napomena o ceni</span>
          <textarea className="input" rows={2} value={form.price_note} onChange={set('price_note')} placeholder="Npr. paket 12 treninga — 30.000 RSD" />
        </label>
        <label className="field">
          <span>Sertifikati</span>
          <textarea className="input" rows={2} value={form.certificates} onChange={set('certificates')} placeholder="Jedan po redu" />
        </label>

        <h3 className="section-title">Kontakt (prikazuje se kao dugmad na profilu)</h3>
        <div className="row">
          <label className="field">
            <span>WhatsApp broj</span>
            <input className="input" type="tel" value={form.whatsapp} onChange={set('whatsapp')} placeholder="+381 6x xxx xxxx" />
          </label>
          <label className="field">
            <span>Viber broj</span>
            <input className="input" type="tel" value={form.viber} onChange={set('viber')} placeholder="+381 6x xxx xxxx" />
          </label>
        </div>
        <div className="row">
          <label className="field">
            <span>Instagram</span>
            <input className="input" value={form.instagram} onChange={set('instagram')} placeholder="@korisnicko_ime" />
          </label>
          <label className="field">
            <span>Telefon za pozive</span>
            <input className="input" type="tel" value={form.contact_phone} onChange={set('contact_phone')} />
          </label>
        </div>
        <label className="field">
          <span>Email (nije obavezno)</span>
          <input className="input" type="email" value={form.contact_email} onChange={set('contact_email')} />
        </label>

        <label className="toggle">
          <input type="checkbox" checked={form.is_published} onChange={set('is_published')} />
          <span>
            <strong>Profil je javan</strong>
            <span className="small muted"> — klijenti te vide na mapi i mogu da zakazuju</span>
          </span>
        </label>
        {form.is_published && myGyms.length === 0 && (
          <p className="alert alert-warn">Izaberi bar jednu teretanu iznad, inače te klijenti neće videti na mapi.</p>
        )}

        <button className="btn btn-primary btn-block" disabled={saving}>
          {saving ? 'Čuvam…' : 'Sačuvaj profil'}
        </button>
      </form>

      <section className="card">
        <h2 className="section-title">Galerija ({photos.length}/{MAX_PHOTOS})</h2>
        <div className="gallery">
          {photos.map((url) => (
            <div key={url} className="gallery-item">
              <img src={url} alt="" />
              <button className="gallery-remove" onClick={() => removePhoto(url)} aria-label="Ukloni sliku">✕</button>
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
            <label className="gallery-add">
              {uploading ? 'Otpremam…' : '+ Dodaj slike'}
              <input type="file" accept="image/*" multiple hidden onChange={onPhotos} disabled={uploading} />
            </label>
          )}
        </div>
      </section>
    </div>
  );
}

function GymPicker({ userId, myGyms, onChanged }) {
  const [allGyms, setAllGyms] = useState([]);
  const [adding, setAdding] = useState(false);
  const [newGym, setNewGym] = useState({ name: '', address: '' });
  const [point, setPoint] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const myIds = new Set(myGyms.map((g) => g.id));

  async function loadGyms() {
    const { data } = await getSupabase().from('gyms').select('id, name, address, lat, lng').order('name');
    setAllGyms(data || []);
  }

  useEffect(() => {
    loadGyms();
  }, []);

  async function toggle(gymId) {
    setError('');
    const supabase = getSupabase();
    const { error } = myIds.has(gymId)
      ? await supabase.from('trainer_gyms').delete().eq('trainer_id', userId).eq('gym_id', gymId)
      : await supabase.from('trainer_gyms').insert({ trainer_id: userId, gym_id: gymId });
    if (error) setError(errorMessage(error));
    onChanged();
  }

  async function addGym(e) {
    e.preventDefault();
    setError('');
    if (!point) {
      setError('Klikni na mapu da označiš gde se teretana nalazi.');
      return;
    }
    setBusy(true);
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('gyms')
      .insert({ name: newGym.name.trim(), address: newGym.address.trim() || null, lat: point.lat, lng: point.lng, created_by: userId })
      .select('id')
      .single();
    if (!error) await supabase.from('trainer_gyms').insert({ trainer_id: userId, gym_id: data.id });
    setBusy(false);
    if (error) {
      setError(errorMessage(error));
      return;
    }
    setAdding(false);
    setNewGym({ name: '', address: '' });
    setPoint(null);
    loadGyms();
    onChanged();
  }

  return (
    <section className="card">
      <h2 className="section-title">Teretane u kojima radim</h2>
      <p className="small muted">Klijenti te pronalaze preko ovih teretana na mapi.</p>
      <div className="gym-checks">
        {allGyms.map((g) => (
          <label key={g.id} className={myIds.has(g.id) ? 'gym-check active' : 'gym-check'}>
            <input type="checkbox" checked={myIds.has(g.id)} onChange={() => toggle(g.id)} />
            <span>
              <strong>{g.name}</strong>
              {g.address && <span className="small muted"> · {g.address}</span>}
            </span>
          </label>
        ))}
      </div>
      {error && <p className="alert alert-error">{error}</p>}

      {!adding ? (
        <button className="btn btn-small" onClick={() => setAdding(true)}>
          + Moje teretane nema na listi
        </button>
      ) : (
        <form className="form add-gym" onSubmit={addGym}>
          <div className="row">
            <label className="field">
              <span>Naziv teretane</span>
              <input className="input" value={newGym.name} onChange={(e) => setNewGym({ ...newGym, name: e.target.value })} required />
            </label>
            <label className="field">
              <span>Adresa</span>
              <input className="input" value={newGym.address} onChange={(e) => setNewGym({ ...newGym, address: e.target.value })} placeholder="Ulica i broj" />
            </label>
          </div>
          <p className="small">{point ? '✓ Lokacija označena (klikni ponovo da je pomeriš)' : 'Klikni na mapu tačno gde je teretana:'}</p>
          <MapView gyms={allGyms} onMapClick={setPoint} pickedPoint={point} showLocate={false} zoom={13} className="map-small" />
          <div className="modal-actions">
            <button className="btn btn-primary" disabled={busy}>{busy ? 'Dodajem…' : 'Dodaj teretanu'}</button>
            <button type="button" className="btn" onClick={() => setAdding(false)}>Odustani</button>
          </div>
        </form>
      )}
    </section>
  );
}
