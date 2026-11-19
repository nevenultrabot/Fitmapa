'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  FiCalendar, FiPlusCircle, FiUsers, FiUser, FiBookmark, FiLogOut,
} from 'react-icons/fi';
import Avatar from './Avatar';
import { getSupabase } from '@/lib/supabase';

// Avatar gore desno → padajući meni naloga (trener ili vežbač)
export default function UserMenu({ user, profile, onLogout, onNavigate }) {
  const [open, setOpen] = useState(false);
  const [avatar, setAvatar] = useState(null);
  const [requests, setRequests] = useState(0);
  const ref = useRef(null);
  const pathname = usePathname();
  const router = useRouter();
  const isTrainer = profile?.role === 'trainer';
  const name = profile?.full_name || user.email;

  // slika trenera + broj novih zahteva vežbača
  useEffect(() => {
    if (!isTrainer) return;
    const supabase = getSupabase();
    supabase.from('trainers').select('avatar_url').eq('id', user.id).maybeSingle().then(({ data }) => setAvatar(data?.avatar_url || null));
    supabase.rpc('my_client_requests').then(({ data }) => setRequests((data || []).length));
  }, [isTrainer, user.id, pathname]);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // "Moj profil": trener → javni profil (tamo su i Uredi profil i Istorija), vežbač → /profil
  const profileHref = isTrainer ? `/trener/${user.id}` : '/profil';
  const items = isTrainer
    ? [
        { href: '/panel', label: 'Moj panel', icon: FiCalendar, hint: 'raspored' },
        { href: '/panel?tab=add', label: 'Dodaj termine', icon: FiPlusCircle },
        { href: '/panel?tab=clients', label: 'Vežbači', icon: FiUsers, badge: requests },
        { href: profileHref, label: 'Moj profil', icon: FiUser, hint: 'izmene i istorija treninga' },
      ]
    : [
        { href: profileHref, label: 'Moj profil', icon: FiUser, hint: 'izmene i istorija treninga' },
        { href: '/moji-termini', label: 'Moji termini', icon: FiBookmark },
      ];

  return (
    <div className={`user-menu ${open ? 'open' : ''}`} ref={ref}>
      <button
        type="button"
        className="user-menu-btn"
        onClick={() => {
          setOpen((o) => !o);
          onNavigate?.(); // na telefonu zatvori ☰ meni
        }}
        onDoubleClick={() => {
          setOpen(false);
          onNavigate?.();
          router.push(profileHref);
        }}
        title="Dvoklik — moj profil"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Moj nalog"
      >
        <Avatar url={avatar} name={name} size="sm" />
        {requests > 0 && <span className="user-menu-dot" aria-hidden="true" />}
      </button>

      <div className="user-menu-list" role="menu">
        <div className="user-menu-head">
          <strong>{name}</strong>
          <span>{isTrainer ? 'Personalni trener' : 'Vežbač'}</span>
        </div>
        {items.map(({ href, label, icon: Icon, hint, badge }) => (
          <Link
            key={href}
            href={href}
            className="user-menu-item"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onNavigate?.();
            }}
          >
            <Icon aria-hidden="true" />
            <span>
              {label}
              {hint && <small>{hint}</small>}
            </span>
            {badge > 0 && <span className="tab-badge">{badge}</span>}
          </Link>
        ))}
        <button type="button" className="user-menu-item user-menu-logout" role="menuitem" onClick={onLogout}>
          <FiLogOut aria-hidden="true" />
          <span>Odjava</span>
        </button>
      </div>
    </div>
  );
}
