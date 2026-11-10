'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/useSession';
import { getSupabase } from '@/lib/supabase';

export default function Header() {
  const { loading, user, profile } = useSession();
  const router = useRouter();

  async function logout() {
    await getSupabase().auth.signOut();
    router.push('/');
  }

  return (
    <header className="header">
      <Link href="/" className="logo">
        <span className="logo-dot" aria-hidden="true" />
        FitMapa
      </Link>
      <nav className="nav">
        {loading ? null : !user ? (
          <Link href="/prijava" className="btn btn-small btn-accent">
            Prijava
          </Link>
        ) : (
          <>
            {profile?.role === 'trainer' ? (
              <Link href="/panel" className="nav-link">
                Moj panel
              </Link>
            ) : (
              <Link href="/moji-termini" className="nav-link">
                Moji termini
              </Link>
            )}
            <button className="nav-link" onClick={logout}>
              Odjava
            </button>
          </>
        )}
      </nav>
    </header>
  );
}
