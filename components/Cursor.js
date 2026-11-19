'use client';

import { useEffect } from 'react';

// Animirani kursor (tačka + prsten koji je prati) — samo na računaru sa mišem.
// Iznad dugmadi i linkova prsten se poveća, na klik "otkuca" i pusti talas.
// U poljima za kucanje ostaje običan kursor.
const HOVER = 'a, button, [role="button"], label, select, summary, .gym-pin, .slot-btn, .chip';
const TEXT = 'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]), textarea, [contenteditable="true"]';

export default function Cursor() {
  useEffect(() => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!fine || reduced) return;

    const root = document.documentElement;
    const dot = document.createElement('div');
    dot.className = 'cursor-dot';
    const ring = document.createElement('div');
    ring.className = 'cursor-ring';
    ring.appendChild(document.createElement('span'));
    document.body.append(dot, ring);
    root.classList.add('has-cursor');

    let x = -100, y = -100, rx = -100, ry = -100, raf = 0, ready = false;

    const loop = () => {
      rx += (x - rx) * 0.2;
      ry += (y - ry) * 0.2;
      dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      raf = Math.abs(x - rx) + Math.abs(y - ry) > 0.1 ? requestAnimationFrame(loop) : 0;
    };

    const onMove = (e) => {
      x = e.clientX;
      y = e.clientY;
      if (!ready) {
        rx = x;
        ry = y;
        ready = true;
        root.classList.add('cursor-ready');
      }
      const t = e.target instanceof Element ? e.target : null;
      root.classList.toggle('cursor-hidden', Boolean(t?.closest(TEXT)));
      ring.classList.toggle('is-hover', Boolean(t?.closest(HOVER)));
      if (!raf) raf = requestAnimationFrame(loop);
    };

    const onDown = () => {
      ring.classList.remove('is-click');
      void ring.offsetWidth; // ponovo pokreni animaciju
      ring.classList.add('is-click');
      const p = document.createElement('div');
      p.className = 'cursor-pulse';
      p.style.left = `${x}px`;
      p.style.top = `${y}px`;
      document.body.appendChild(p);
      p.addEventListener('animationend', () => p.remove());
    };

    const onOut = (e) => {
      if (!e.relatedTarget) root.classList.add('cursor-hidden'); // miš je izašao iz prozora (ili u chat)
    };
    const onOver = () => root.classList.remove('cursor-hidden');

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mousedown', onDown);
    document.addEventListener('mouseout', onOut);
    document.addEventListener('mouseover', onOver);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mousedown', onDown);
      document.removeEventListener('mouseout', onOut);
      document.removeEventListener('mouseover', onOver);
      dot.remove();
      ring.remove();
      root.classList.remove('has-cursor', 'cursor-ready', 'cursor-hidden');
    };
  }, []);

  return null;
}
