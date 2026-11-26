'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FiMenu, FiX } from 'react-icons/fi';
import Logo from './Logo';
import UserMenu from './UserMenu';
import NotificationsBell from './NotificationsBell';
import { useSession } from '@/lib/useSession';
import { getSupabase } from '@/lib/supabase';

export default function Header() {
  const { loading, user, profile } = useSession();
  const router = useRouter();
  const pathname = usePathname() || '/';
  const [open, setOpen] = useState(false);

  const navRef = useRef(null);
  const toggleRef = useRef(null);

  useEffect(() => setOpen(false), [pathname]);

  // ☰ meni se sam zatvara na klik/dodir bilo gde van njega (logo, dugme na stranici, prazno) i na Esc
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (navRef.current?.contains(e.target) || toggleRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

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

      <nav className={`nav ${open ? 'open' : ''}`} ref={navRef}>
        <div className="nav-pages">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`nav-link ${isActive(l.href) ? 'active' : ''}`}
              onClick={() => setOpen(false) /* zatvori i kad je to stranica na kojoj već jesi */}
            >
              {l.label}
            </Link>
          ))}
        </div>
        <div className="nav-account">
          {loading ? null : !user ? (
            <Link href="/prijava" className="btn btn-small btn-accent" onClick={() => setOpen(false)}>
              Prijava
            </Link>
          ) : null}
        </div>
      </nav>

      {!loading && user && profile && <NotificationsBell userId={user.id} role={profile.role} />}
      {!loading && user && (
        <UserMenu user={user} profile={profile} onLogout={logout} onNavigate={() => setOpen(false)} />
      )}

      <button ref={toggleRef} className="nav-toggle" onClick={() => setOpen((o) => !o)} aria-label={open ? 'Zatvori meni' : 'Otvori meni'}>
        {open ? <FiX size={24} /> : <FiMenu size={24} />}
      </button>
    </header>
  );
}
