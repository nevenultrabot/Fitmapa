'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FiMenu, FiX } from 'react-icons/fi';
import Logo from './Logo';
import { useSession } from '@/lib/useSession';
import { getSupabase } from '@/lib/supabase';

export default function Header() {
  const { loading, user, profile } = useSession();
  const router = useRouter();
  const pathname = usePathname() || '/';
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  async function logout() {
    setOpen(false);
    await getSupabase().auth.signOut();
    router.push('/');
  }

  const isActive = (href) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
  const links = [
    { href: '/', label: 'Početna' },
    { href: '/mapa', label: 'Mapa' },
    { href: '/treneri', label: 'Treneri' },
    { href: '/teretane', label: 'Teretane' },
  ];

  return (
    <header className="header">
      <Link href="/" className="logo" aria-label="FitMapa — početna">
        <Logo size={30} />
      </Link>

      <nav className={`nav ${open ? 'open' : ''}`}>
        <div className="nav-pages">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={`nav-link ${isActive(l.href) ? 'active' : ''}`}>
              {l.label}
            </Link>
          ))}
        </div>
        <div className="nav-account">
          {loading ? null : !user ? (
            <Link href="/prijava" className="btn btn-small btn-accent">
              Prijava
            </Link>
          ) : (
            <>
              {profile?.role === 'trainer' ? (
                <Link href="/panel" className={`nav-link ${isActive('/panel') ? 'active' : ''}`}>
                  Moj panel
                </Link>
              ) : (
                <Link href="/moji-termini" className={`nav-link ${isActive('/moji-termini') ? 'active' : ''}`}>
                  Moji termini
                </Link>
              )}
              <button className="nav-link nav-logout" onClick={logout}>
                Odjava
              </button>
            </>
          )}
        </div>
      </nav>

      <button className="nav-toggle" onClick={() => setOpen((o) => !o)} aria-label={open ? 'Zatvori meni' : 'Otvori meni'}>
        {open ? <FiX size={24} /> : <FiMenu size={24} />}
      </button>
    </header>
  );
}
