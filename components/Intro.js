'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { LogoMark } from './Logo';

const DURATION = 2300;

// Uvodna animacija: logo se zavrti u centru, pojavi se naziv, pa se sve smanji
// prema logou u meniju i otkrije mapu. Prikazuje se jednom po poseti.
export default function Intro() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem('fitmapa-intro') === '1';
      sessionStorage.setItem('fitmapa-intro', '1');
    } catch {}
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (seen || reduced) return;
    setShow(true);
    const t = setTimeout(() => setShow(false), DURATION);
    return () => clearTimeout(t);
  }, []);

  if (!show) return null;

  return createPortal(
    <div className="intro" aria-hidden="true" onClick={() => setShow(false)}>
      <div className="intro-logo">
        <LogoMark size={112} className="intro-mark" />
        <span className="intro-word">
          Fit<span className="logo-word-accent">Mapa</span>
        </span>
        <span className="intro-tag">Pronađi trenera. Zakaži trening.</span>
      </div>
    </div>,
    document.body
  );
}
