import { createClient } from '@supabase/supabase-js';

let client = null;

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
  client = createClient(url, key);
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
  return msg;
}
