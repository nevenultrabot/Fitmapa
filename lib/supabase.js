import { createClient } from '@supabase/supabase-js';

let client = null;

// "Zapamti me": prijava ostaje sačuvana na uređaju (localStorage) i posle zatvaranja
// pregledača/aplikacije. Bez kvačice važi samo dok je pregledač otvoren (sessionStorage).
const REMEMBER_KEY = 'gymby-remember';

export function setRememberMe(on) {
  try {
    localStorage.setItem(REMEMBER_KEY, on ? '1' : '0');
  } catch {}
}

export function getRememberMe() {
  try {
    return localStorage.getItem(REMEMBER_KEY) !== '0';
  } catch {
    return true;
  }
}

const authStorage = {
  getItem(key) {
    try {
      return localStorage.getItem(key) ?? sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key, value) {
    try {
      if (getRememberMe()) {
        localStorage.setItem(key, value);
        sessionStorage.removeItem(key);
      } else {
        sessionStorage.setItem(key, value);
        localStorage.removeItem(key);
      }
    } catch {}
  },
  removeItem(key) {
    try {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    } catch {}
  },
};

// Klijent se pravi tek kad zatreba (u pregledaču), da build na Vercelu ne bi pao.
export function getSupabase() {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Prihvata bilo koje od uobičajenih imena (i ona koja pravi Vercel–Supabase integracija)
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Nedostaju NEXT_PUBLIC_SUPABASE_URL i NEXT_PUBLIC_SUPABASE_KEY. Dodaj ih u Vercel → Settings → Environment Variables.'
    );
  }
  client = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storage: authStorage },
  });
  return client;
}

// Pretvara grešku iz baze u poruku za korisnika.
export function errorMessage(error) {
  if (!error) return '';
  const msg = error.message || String(error);
  if (msg.includes('Invalid login credentials')) return 'Pogrešan email ili lozinka.';
  if (msg.includes('Email not confirmed')) return 'Potvrdi email adresu (proveri inbox), pa se prijavi.';
  if (msg.includes('User already registered')) return 'Nalog sa ovim emailom već postoji. Prijavi se.';
  if (msg.includes('Password should be')) return 'Lozinka mora imati bar 6 karaktera.';
  if (msg.includes('rate limit') || msg.includes('only request this after'))
    return 'Previše pokušaja. Sačekaj minut, pa pokušaj ponovo.';
  if (msg.includes('New password should be different')) return 'Nova lozinka mora biti drugačija od stare.';
  return msg;
}
