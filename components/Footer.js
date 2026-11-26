'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FaInstagram, FaTiktok } from 'react-icons/fa6';
import Logo from './Logo';

// Footer na svim stranicama (osim mape, koja zauzima ceo ekran).
// Linkovi ka društvenim mrežama su za sada opšti — kad otvorimo naloge, ovde se upišu pravi.
const LINKS = [
  { href: '/', label: 'Početna' },
  { href: '/mapa', label: 'Mapa' },
  { href: '/treneri', label: 'Treneri' },
  { href: '/teretane', label: 'Teretane' },
];

const SOCIAL = [
  { href: 'https://www.instagram.com/', label: 'FitMapa na Instagramu', icon: FaInstagram },
  { href: 'https://www.tiktok.com/', label: 'FitMapa na TikToku', icon: FaTiktok },
];

export default function Footer() {
  const pathname = usePathname() || '/';
  if (pathname.startsWith('/mapa')) return null;

  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <Link href="/" className="logo" aria-label="FitMapa — početna">
            <Logo size={28} />
          </Link>
          <p>Personalni treneri u teretanama u tvojoj blizini.</p>
        </div>

        <nav className="footer-nav" aria-label="Footer">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href}>
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="footer-social">
          {SOCIAL.map(({ href, label, icon: Icon }) => (
            <a key={href} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} title={label}>
              <Icon aria-hidden="true" />
            </a>
          ))}
        </div>
      </div>

      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} FitMapa. Sva prava zadržana.</span>
      </div>
    </footer>
  );
}
