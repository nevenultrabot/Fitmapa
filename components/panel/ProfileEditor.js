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
          <span>Bio</span>
          <textarea
            className="input"
            rows={3}
            maxLength={300}
            value={form.bio}
            onChange={set('bio')}
            placeholder="Kratko, kao na Instagramu. Npr: Treniram ljude 8 godina 💪 Snaga · gubitak kilograma · prvi koraci u teretani"
          />
          <span className="small muted">{form.bio.length}/300 · prikazuje se odmah ispod tvog imena</span>
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
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [editing, setEditing] = useState(null); // null | 'new' | gym
  const [error, setError] = useState('');
  const myIds = new Set(myGyms.map((g) => g.id));

  // Pretraga teretana po nazivu ili adresi (sa malim zakašnjenjem dok kucaš)
  useEffect(() => {
    const q = query.trim().replace(/[,()%*]/g, ' ');
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      const { data } = await getSupabase()
        .from('gyms')
        .select('id, name, address')
        .or(`name.ilike.%${q}%,address.ilike.%${q}%`)
        .order('name')
        .limit(8);
      setResults(data || []);
      setSearching(false);
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  async function add(gymId) {
    setError('');
    const { error } = await getSupabase().from('trainer_gyms').insert({ trainer_id: userId, gym_id: gymId });
    if (error) setError(errorMessage(error));
    setQuery('');
    onChanged();
  }

  async function remove(gymId) {
    setError('');
    const { error } = await getSupabase().from('trainer_gyms').delete().eq('trainer_id', userId).eq('gym_id', gymId);
    if (error) setError(errorMessage(error));
    onChanged();
  }

  const canEdit = (g) => g.created_by === userId || !g.created_by;

  return (
    <section className="card">
      <h2 className="section-title">Teretane u kojima radim</h2>
      <p className="small muted">Klijenti te pronalaze preko ovih teretana na mapi.</p>

      {myGyms.length > 0 ? (
        <ul className="my-gyms">
          {myGyms.map((g) => (
            <li key={g.id}>
              <span className="my-gyms-text">
                <strong>{g.name}</strong>
                {g.address && <span className="small muted">{g.address}</span>}
              </span>
              {canEdit(g) && (
                <button className="btn btn-small btn-ghost" onClick={() => setEditing(g)}>
                  Uredi
                </button>
              )}
              <button className="btn btn-small btn-ghost" onClick={() => remove(g.id)} aria-label={`Ukloni ${g.name}`}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="alert alert-warn">Još nisi dodao nijednu teretanu — pronađi je ispod.</p>
      )}

      <div className="gym-search">
        <input
          className="input"
          placeholder="Pronađi teretanu: upiši naziv ili ulicu…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query.trim().length >= 2 && (
          <ul className="gym-search-results">
            {searching && results.length === 0 && <li className="muted small">Tražim…</li>}
            {!searching && results.length === 0 && <li className="muted small">Nema teretane sa tim nazivom.</li>}
            {results.map((g) => (
              <li key={g.id}>
                <button type="button" disabled={myIds.has(g.id)} onClick={() => add(g.id)}>
                  <span>
                    <strong>{g.name}</strong>
                    {g.address && <span className="small muted"> · {g.address}</span>}
                  </span>
                  <span className="small">{myIds.has(g.id) ? 'Dodata ✓' : '+ Dodaj'}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {error && <p className="alert alert-error">{error}</p>}

      {editing === null && (
        <button className="link-btn" onClick={() => setEditing('new')}>
          Moje teretane nema na listi — dodaj je
        </button>
      )}
      {editing !== null && (
        <GymForm
          userId={userId}
          gym={editing === 'new' ? null : editing}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChanged();
          }}
        />
      )}
    </section>
  );
}

// Dodavanje nove ili izmena postojeće teretane
function GymForm({ userId, gym, onCancel, onSaved }) {
  const [f, setF] = useState({
    name: gym?.name || '',
    address: gym?.address || '',
    opening_hours: gym?.opening_hours || '',
    membership: gym?.membership || '',
  });
  const [image, setImage] = useState(gym?.image_url || null);
  const [point, setPoint] = useState(gym ? { lat: gym.lat, lng: gym.lng } : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function onImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      setImage(await uploadPhoto(userId, file));
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
      lat: point.lat,
      lng: point.lng,
    };
    let err;
    if (gym) {
      ({ error: err } = await supabase.from('gyms').update(values).eq('id', gym.id));
    } else {
      const { data, error } = await supabase.from('gyms').insert({ ...values, created_by: userId }).select('id').single();
      err = error;
      if (!err) ({ error: err } = await supabase.from('trainer_gyms').insert({ trainer_id: userId, gym_id: data.id }));
    }
    setBusy(false);
    if (err) setError(errorMessage(err));
    else onSaved();
  }

  return (
    <form className="form add-gym" onSubmit={submit}>
      <h3 className="sub-title">{gym ? `Uredi: ${gym.name}` : 'Nova teretana'}</h3>
      <div className="gym-form-image">
        {image ? <img src={image} alt="" /> : <span className="small muted">Bez slike</span>}
        <label className="btn btn-small">
          {busy ? 'Otpremam…' : image ? 'Promeni sliku' : 'Dodaj sliku'}
          <input type="file" accept="image/*" hidden onChange={onImage} disabled={busy} />
        </label>
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
        <span>Članarina</span>
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
