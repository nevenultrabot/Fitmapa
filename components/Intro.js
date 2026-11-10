'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { FiArrowRight, FiCalendar, FiMapPin, FiUser } from 'react-icons/fi';
import { LogoMark } from './Logo';

/* ---------------------------------------------------------------------
   Uvodna stranica (onboarding) — redosled:
   1. logo se zavrti u centru            (~3.6 s)
   2. rečenica se sama kuca              (~8 s)
   3. tri koraka u cik-cak lancu         (~5 s)
   4. završni poziv na akciju (CTA)
   Meni je sve vreme vidljiv, a "Preskoči" stoji dole desno.
   Prikazuje se jednom po poseti; ponovo se pušta događajem "fitmapa:intro".
   --------------------------------------------------------------------- */

const LOGO_MS = 3600;
const WORDS = ['smršaš?', 'ojačaš?', 'konačno kreneš?'];
const TYPE_MS = 85;
const DELETE_MS = 40;
const HOLD_MS = 1300;

const STEPS = [
  { Icon: FiMapPin, title: 'Izaberi teretanu', text: 'Pronađi teretanu na mapi — blizu kuće, posla ili fakulteta.' },
  { Icon: FiUser, title: 'Izaberi trenera', text: 'Pogledaj profile, specijalnosti i cene trenera koji tu rade.' },
  { Icon: FiCalendar, title: 'Zakaži termin', text: 'Klikni na slobodan termin i dođi — plaćaš na licu mesta.' },
];
// tajming koraka (sekunde) — mora da se slaže sa CSS-om (.onb-step, .onb-draw)
const STEPS_TOTAL_MS = 5000;

export default function Intro() {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [phase, setPhase] = useState('logo'); // logo | type | steps | cta
  const [instant, setInstant] = useState(false);

  const start = useCallback((force = false) => {
    let seen = false;
    try {
      seen = sessionStorage.getItem('fitmapa-intro') === '1';
      sessionStorage.setItem('fitmapa-intro', '1');
    } catch {}
    if (seen && !force) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    setInstant(Boolean(reduced));
    setPhase(reduced ? 'cta' : 'logo');
    setClosing(false);
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setClosing(true);
    setTimeout(() => setOpen(false), 450);
  }, []);

  // prvo otvaranje + ponovno puštanje iz aplikacije
  useEffect(() => {
    start();
    const replay = () => start(true);
    window.addEventListener('fitmapa:intro', replay);
    return () => window.removeEventListener('fitmapa:intro', replay);
  }, [start]);

  // Esc = preskoči
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  // faza loga traje fiksno
  useEffect(() => {
    if (!open || phase !== 'logo') return;
    const t = setTimeout(() => setPhase('type'), LOGO_MS);
    return () => clearTimeout(t);
  }, [open, phase]);

  if (!open) return null;

  return createPortal(
    <div className={`onb ${closing ? 'closing' : ''} ${instant ? 'instant' : ''}`} role="dialog" aria-label="Kako funkcioniše FitMapa">
      <div className="onb-scroll">
        <div className={`onb-inner phase-${phase}`}>
          {phase === 'logo' ? (
            <LogoStage />
          ) : (
            <>
              <Headline instant={instant} compact={phase === 'steps' || phase === 'cta'} onDone={() => setPhase('steps')} />
              {(phase === 'steps' || phase === 'cta') && (
                <Steps instant={instant} onDone={() => setPhase('cta')} />
              )}
              {phase === 'cta' && <Cta onStart={close} />}
            </>
          )}
        </div>
      </div>

      <button className="onb-skip" onClick={close}>
        Preskoči <FiArrowRight aria-hidden="true" />
      </button>
    </div>,
    document.body
  );
}

/* 1. Logo */
function LogoStage() {
  return (
    <div className="onb-logo">
      <LogoMark size={120} className="onb-mark" />
      <span className="onb-word">
        Fit<span className="logo-word-accent">Mapa</span>
      </span>
      <span className="onb-tag">Teretane i treneri Novog Sada na jednoj mapi</span>
    </div>
  );
}

/* 2. Rečenica koja se kuca */
function Headline({ instant, compact, onDone }) {
  const [word, setWord] = useState(instant ? WORDS[WORDS.length - 1] : '');
  const [showSub, setShowSub] = useState(instant);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    if (instant) return;
    let cancelled = false;
    const timers = [];
    const wait = (ms) => new Promise((r) => timers.push(setTimeout(r, ms)));

    (async () => {
      await wait(400);
      for (let w = 0; w < WORDS.length; w++) {
        const text = WORDS[w];
        for (let i = 1; i <= text.length; i++) {
          if (cancelled) return;
          setWord(text.slice(0, i));
          await wait(TYPE_MS);
        }
        if (w === WORDS.length - 1) break;
        await wait(HOLD_MS);
        for (let i = text.length - 1; i >= 0; i--) {
          if (cancelled) return;
          setWord(text.slice(0, i));
          await wait(DELETE_MS);
        }
        await wait(250);
      }
      await wait(700);
      if (cancelled) return;
      setShowSub(true);
      await wait(3200); // vreme da se podnaslov komotno pročita
      if (!cancelled) doneRef.current();
    })();

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [instant]);

  return (
    <header className={`onb-head ${compact ? 'compact' : ''}`}>
      <h1 className="onb-title">
        <span>Želiš da</span>{' '}
        <span className="onb-typed">
          {word}
          <span className="onb-caret" aria-hidden="true" />
        </span>
      </h1>
      <p className={`onb-sub ${showSub ? 'show' : ''}`}>
        Spojili smo teretane i personalne trenere na jednoj mapi.
        <br />
        Ti samo izabereš — <strong>prvi trening zakazuješ za 5 minuta.</strong>
      </p>
    </header>
  );
}

/* 3. Cik-cak koraci sa linijom koja se crta */
function bezierLength(p0, p1, p2, p3) {
  let len = 0;
  let prev = p0;
  for (let i = 1; i <= 40; i++) {
    const t = i / 40;
    const mt = 1 - t;
    const x = mt ** 3 * p0[0] + 3 * mt * mt * t * p1[0] + 3 * mt * t * t * p2[0] + t ** 3 * p3[0];
    const y = mt ** 3 * p0[1] + 3 * mt * mt * t * p1[1] + 3 * mt * t * t * p2[1] + t ** 3 * p3[1];
    len += Math.hypot(x - prev[0], y - prev[1]);
    prev = [x, y];
  }
  return len;
}

function connector(a, b, wrapRect) {
  const r1 = a.getBoundingClientRect();
  const r2 = b.getBoundingClientRect();
  const ox = wrapRect.left;
  const oy = wrapRect.top;
  let pts;
  if (r2.left > r1.right - 4) {
    // kartice su jedna pored druge (računar): desna ivica → vrh sledeće
    const p0 = [r1.right - ox, r1.top + r1.height / 2 - oy];
    const p3 = [r2.left + r2.width / 2 - ox, r2.top - oy];
    pts = [p0, [p3[0], p0[1]], [p3[0], p0[1]], p3];
  } else if (r1.left > r2.right - 4) {
    // sa desne strane nazad na levu: dno → desna ivica sledeće
    const p0 = [r1.left + r1.width / 2 - ox, r1.bottom - oy];
    const p3 = [r2.right - ox, r2.top + r2.height / 2 - oy];
    pts = [p0, [p0[0], p3[1]], [p0[0], p3[1]], p3];
  } else {
    // kartice jedna ispod druge (telefon): S-kriva od dna do vrha
    const p0 = [r1.left + r1.width / 2 - ox, r1.bottom - oy];
    const p3 = [r2.left + r2.width / 2 - ox, r2.top - oy];
    const k = Math.max(20, (p3[1] - p0[1]) * 0.6);
    pts = [p0, [p0[0], p0[1] + k], [p3[0], p3[1] - k], p3];
  }
  const [p0, c1, c2, p3] = pts;
  return {
    d: `M${p0[0]},${p0[1]} C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p3[0]},${p3[1]}`,
    len: Math.ceil(bezierLength(p0, c1, c2, p3)) + 2,
    start: p0,
    end: p3,
  };
}

function Steps({ instant, onDone }) {
  const wrapRef = useRef(null);
  const cardRefs = [useRef(null), useRef(null), useRef(null)];
  const [segs, setSegs] = useState([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const id = useId().replace(/:/g, '');
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  const measure = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap || cardRefs.some((r) => !r.current)) return;
    const wr = wrap.getBoundingClientRect();
    setSize({ w: wr.width, h: wr.height });
    setSegs([connector(cardRefs[0].current, cardRefs[1].current, wr), connector(cardRefs[1].current, cardRefs[2].current, wr)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [measure]);

  useEffect(() => {
    const t = setTimeout(() => doneRef.current(), instant ? 0 : STEPS_TOTAL_MS);
    return () => clearTimeout(t);
  }, [instant]);

  return (
    <div className="onb-steps" ref={wrapRef}>
      {size.w > 0 && (
        <svg className="onb-chain" width={size.w} height={size.h} viewBox={`0 0 ${size.w} ${size.h}`} aria-hidden="true">
          <defs>
            {segs.map((s, i) => (
              <mask key={i} id={`${id}-m${i}`} maskUnits="userSpaceOnUse" x="0" y="0" width={size.w} height={size.h}>
                <path d={s.d} className={`onb-draw onb-draw-${i + 1}`} style={{ '--len': s.len }} />
              </mask>
            ))}
          </defs>
          {segs.map((s, i) => (
            <g key={i}>
              <path d={s.d} className="onb-line" mask={`url(#${id}-m${i})`} />
              <circle cx={s.end[0]} cy={s.end[1]} r="4.5" className={`onb-dot onb-dot-${i + 1}`} />
            </g>
          ))}
        </svg>
      )}

      {STEPS.map(({ Icon, title, text }, i) => (
        // spoljni element ostaje miran (po njemu se meri linija), unutrašnji se animira
        <article key={title} ref={cardRefs[i]} className={`onb-step onb-step-${i + 1}`}>
          <div className="onb-step-card">
            <span className="onb-step-icon">
              <Icon aria-hidden="true" />
            </span>
            <div>
              <span className="onb-step-num">Korak {i + 1}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

/* 4. Završni poziv na akciju */
function Cta({ onStart }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);
  return (
    <div className="onb-cta" ref={ref}>
      <p className="onb-cta-text">Spreman? Prvi korak je najteži — ostalo je na nama.</p>
      <button className="onb-cta-btn" onClick={onStart}>
        Zakaži svoj prvi trening <FiArrowRight aria-hidden="true" />
      </button>
      <Link href="/treneri" className="onb-cta-link" onClick={onStart}>
        ili pogledaj sve trenere
      </Link>
    </div>
  );
}
