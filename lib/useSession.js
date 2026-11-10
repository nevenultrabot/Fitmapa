'use client';

import { useEffect, useState } from 'react';
import { getSupabase } from './supabase';

// Vraća { loading, user, profile } i osvežava se pri prijavi/odjavi.
export function useSession() {
  const [state, setState] = useState({ loading: true, user: null, profile: null });

  useEffect(() => {
    const supabase = getSupabase();
    let active = true;

    async function load(session) {
      const user = session?.user ?? null;
      let profile = null;
      if (user) {
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
        profile = data;
      }
      if (active) setState({ loading: false, user, profile });
    }

    supabase.auth.getSession().then(({ data }) => load(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      // odloženo, da se ne poziva baza unutar samog auth događaja
      setTimeout(() => load(session), 0);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}
