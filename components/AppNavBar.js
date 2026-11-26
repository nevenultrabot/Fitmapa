'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { FiChevronLeft, FiChevronRight, FiRotateCw } from 'react-icons/fi';

// Donja traka Nazad / Napred / Osveži — samo kad je FitMapa otvorena kao aplikacija
// (sa ikonice na početnom ekranu). Tada telefon ne prikazuje traku pregledača,
// a iPhone šalje push obaveštenja samo u tom režimu, pa traku pravimo sami.
export default function AppNavBar() {
  const router = useRouter();
  const pathname = usePathname() || '/';
  const [standalone, setStandalone] = useState(false);
  const [can, setCan] = useState({ back: false, forward: false });

  useEffect(() => {
    const mq = window.matchMedia?.('(display-mode: standalone)');
    const check = () => setStandalone(Boolean(mq?.matches) || window.navigator.standalone === true);
    check();
    mq?.addEventListener?.('change', check);
    return () => mq?.removeEventListener?.('change', check);
  }, []);

  useEffect(() => {
    if (!standalone) return;
    // Navigation API (noviji iOS/Android) tačno zna da li ima nazad/napred; inače procena
    const nav = window.navigation;
    const update = () =>
      setCan(
        nav && typeof nav.canGoBack === 'boolean'
          ? { back: nav.canGoBack, forward: nav.canGoForward }
          : { back: window.history.length > 1, forward: true }
      );
    update();
    nav?.addEventListener?.('currententrychange', update);
    return () => nav?.removeEventListener?.('currententrychange', update);
  }, [standalone, pathname]);

  useEffect(() => {
    document.documentElement.classList.toggle('is-app', standalone);
  }, [standalone]);

  if (!standalone) return null;

  // ako nema kuda nazad (npr. aplikacija otvorena klikom na obaveštenje), Nazad vodi na početnu
  const backToHome = !can.back && pathname !== '/';
  const back = () => (can.back ? router.back() : router.push('/'));

  return (
    <nav className="appbar" aria-label="Kretanje kroz aplikaciju">
      <button type="button" onClick={back} disabled={!can.back && !backToHome} aria-label="Nazad">
        <FiChevronLeft aria-hidden="true" />
      </button>
      <button type="button" onClick={() => router.forward()} disabled={!can.forward} aria-label="Napred">
        <FiChevronRight aria-hidden="true" />
      </button>
      <button type="button" onClick={() => window.location.reload()} aria-label="Osveži stranicu">
        <FiRotateCw aria-hidden="true" />
      </button>
    </nav>
  );
}
