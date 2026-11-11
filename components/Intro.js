'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  FiArrowRight,
  FiCalendar,
  FiChevronDown,
  FiCreditCard,
  FiMapPin,
  FiRotateCcw,
  FiUser,
} from 'react-icons/fi';
import { LogoMark } from './Logo';
import MapExplorer from './MapExplorer';
import { StickFlex, StickScale, StickWalk } from './Stickmen';

/* ---------------------------------------------------------------------
   Početna stranica
   1. logo preko celog ekrana
   2. zoom-out i podela: uvod ide levo (2/3), desno se otvara "O nama" + CTA (1/3)
   3. levo se nastavlja: poruke sa stickmanom → 4. poruka → koraci
   4. kad se uvod završi: dugme za ponovno puštanje + strelica ka mapi
   Ispod je puna mapa (učitava se odmah). Na telefonu "O nama" ide ispod uvoda.
   --------------------------------------------------------------------- */

const SEEN_KEY = 'fitmapa-intro';
const LOGO_MS = 2800;
const MESSAGES = [
  { word: 'smršaš?', Stick: StickScale },
  { word: 'ojačaš?', Stick: StickFlex },
  { word: 'konačno kreneš?', Stick: StickWalk },
];
const FINAL = 'Put ka preokretu nikad nije bio dostupniji.';
const FINAL_ACCENT = 'preokretu';
const TYPE_MS = 75;
const FINAL_TYPE_MS = 45;
const DELETE_MS = 40;
const HOLD_MS = 1500;
const SUB_HOLD_MS = 900;
const MORPH_MS = 850;
const HEADER_PX = 56;

const STEPS = [
  { Icon: FiMapPin, title: 'Izaberi teretanu', text: 'Pronađi teretanu na mapi — blizu kuće, posla ili fakulteta.' },
  { Icon: FiUser, title: 'Izaberi trenera', text: 'Pogledaj profile, specijalnosti i cene trenera koji tu rade.' },
  { Icon: FiCalendar, title: 'Zakaži termin', text: 'Klikni na slobodan termin i dođi — plaćaš na licu mesta.' },
];
const STEPS_TOTAL_MS = 7800; // mora da se slaže sa CSS-om koraka

export default function Intro() {
  const [phase, setPhase] = useState(null); // logo | type | steps | done
  const [instant, setInstant] = useState(false);
  const [run, setRun] = useState(0);
  const mapRef = useRef(null);
  const aboutRef = useRef(null);

  // prvi ulazak u sesiji = animacija; posle toga odmah završni prikaz
  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN_KEY) === '1';
      sessionStorage.setItem(SEEN_KEY, '1');
    } catch {}
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (seen || reduced) {
      setInstant(true);
      setPhase('done');
    } else {
      setPhase('logo');
    }
  }, []);

  useEffect(() => {
    if (phase !== 'logo') return;
    const t = setTimeout(() => setPhase((p) => (p === 'logo' ? 'type' : p)), LOGO_MS);
    return () => clearTimeout(t);
  }, [phase]);

  // tamna pozadina iza stranice (na iPhone-u se ispod Safari trake ne vidi bela traka)
  useEffect(() => {
    const html = document.documentElement;
    const prev = [html.style.backgroundColor, document.body.style.backgroundColor];
    html.style.backgroundColor = '#14161a';
    document.body.style.backgroundColor = '#14161a';
    return () => {
      html.style.backgroundColor = prev[0];
      document.body.style.backgroundColor = prev[1];
    };
  }, []);

  // chat dugme se ne prikazuje dok traje logo
  useEffect(() => {
    document.body.classList.toggle('intro-running', phase === 'logo');
    return () => document.body.classList.remove('intro-running');
  }, [phase]);

  const scrollToEl = (el) => {
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - HEADER_PX, behavior: 'smooth' });
  };
  const goToMap = useCallback(() => scrollToEl(mapRef.current), []);
  // strelica: na računaru glatko spusti stranicu tako da se otkrije 15% mape (nagoveštaj),
  // na telefonu vodi do sekcije "O nama" ispod uvoda
  const goNext = useCallback(() => {
    if (window.innerWidth >= 900) {
      const map = mapRef.current;
      if (!map) return;
      const r = map.getBoundingClientRect();
      window.scrollTo({ top: window.scrollY + r.top + r.height * 0.15 - window.innerHeight, behavior: 'smooth' });
    } else {
      scrollToEl(aboutRef.current);
    }
  }, []);

  const replay = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setInstant(false);
    setRun((r) => r + 1);
    setPhase('logo');
  }, []);

  if (!phase) return <div className="home" />;

  const split = phase !== 'logo';
  const compact = phase === 'steps' || phase === 'done';
  const done = phase === 'done';

  return (
    <div className={`home ${split ? 'split' : ''} ${instant ? 'instant' : ''}`}>
      <div className="home-hero">
        <section className="home-intro">
          <div key={`c${run}${split}`} className={`home-intro-content ${compact ? 'is-compact' : ''} ${split ? 'zoomed' : ''}`}>
            {phase === 'logo' ? (
              <LogoStage />
            ) : (
              <>
                <Headline
                  key={`h${run}`}
                  instant={instant}
                  compact={compact}
                  onDone={() => setPhase((p) => (p === 'type' ? 'steps' : p))}
                />
                {compact && (
                  <Steps key={`s${run}`} instant={instant} onDone={() => setPhase((p) => (p === 'steps' ? 'done' : p))} />
                )}
                {done && (
                  <div className="onb-cta">
                    <p className="onb-cta-text">Spreman? Prvi korak je najteži — ostalo je na nama.</p>
                    <button className="onb-cta-btn" onClick={goToMap}>
                      Zakaži svoj prvi trening <FiArrowRight aria-hidden="true" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {split && (
            <div className="home-intro-foot">
              {done && (
                <button className="home-replay" onClick={replay}>
                  <FiRotateCcw aria-hidden="true" /> Pusti uvod ponovo
                </button>
              )}
              {/* na telefonu strelica pulsira od početka uvoda — ispod je "O nama" */}
              <button className="home-arrow" onClick={goNext} aria-label="Nastavi dole">
                <FiChevronDown aria-hidden="true" />
              </button>
            </div>
          )}
        </section>

        <aside className="home-about" ref={aboutRef} aria-label="O FitMapi">
          {split && <About instant={instant} onStart={goToMap} />}
        </aside>
      </div>

      {/* mapa se učitava odmah (u pozadini), da prelaz bude bez kašnjenja */}
      <section className="home-map" ref={mapRef} aria-label="Mapa teretana">
        <MapExplorer embedded />
      </section>
    </div>
  );
}

/* Desna strana: O nama + CTA — fokus na zakazivanju prvog treninga */
function About({ instant, onStart }) {
  return (
    <div className={`about ${instant ? 'instant' : ''}`}>
      <span className="about-eyebrow">Tvoj prvi trening</span>
      <h2 className="about-title">
        Od odluke do prvog treninga — <span className="about-mark">za 5 minuta.</span>
      </h2>
      <p className="about-text">
        Najteži deo je početak. Zato smo ga skratili: izaberi personalnog trenera u teretani blizu tebe, pogledaj
        njegove slobodne termine i zakaži prvi trening odmah — bez poziva, dopisivanja i čekanja na odgovor.
      </p>
      <ul className="about-list">
        <li>
          <FiUser aria-hidden="true" /> Profil, iskustvo i cena svakog trenera
        </li>
        <li>
          <FiCalendar aria-hidden="true" /> Slobodni termini za ovu nedelju, uživo
        </li>
        <li>
          <FiCreditCard aria-hidden="true" /> Bez plaćanja unapred — plaćaš na licu mesta
        </li>
      </ul>
      <button className="about-cta" onClick={onStart}>
        Zakaži prvi trening
        <span className="about-cta-icon">
          <FiArrowRight aria-hidden="true" />
        </span>
      </button>
      <div className="about-links">
        <Link href="/treneri">ili izaberi direktno među trenerima →</Link>
        <span className="about-note">Razgledanje je besplatno — nalog ti treba tek za zakazivanje.</span>
      </div>
    </div>
  );
}

/* Logo */
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

/* Poruke: tekst u jednoj liniji, stickman odmah ispod */
function Headline({ instant, compact, onDone }) {
  const [msg, setMsg] = useState(0); // -1 = završna poruka
  const [word, setWord] = useState('');
  const [prefixVisible, setPrefixVisible] = useState(true);
  const [finalText, setFinalText] = useState('');
  const [showSub, setShowSub] = useState(false);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    if (instant) return;
    let cancelled = false;
    const timers = [];
    const wait = (ms) => new Promise((r) => timers.push(setTimeout(r, ms)));
    const alive = () => !cancelled;

    (async () => {
      await wait(500);
      for (let m = 0; m < MESSAGES.length; m++) {
        if (!alive()) return;
        setMsg(m);
        const text = MESSAGES[m].word;
        for (let i = 1; i <= text.length; i++) {
          if (!alive()) return;
          setWord(text.slice(0, i));
          await wait(TYPE_MS);
        }
        await wait(HOLD_MS);
        for (let i = text.length - 1; i >= 0; i--) {
          if (!alive()) return;
          setWord(text.slice(0, i));
          await wait(DELETE_MS);
        }
        await wait(300);
      }
      if (!alive()) return;
      setPrefixVisible(false); // "Želiš da" i stickman se povlače
      await wait(550);
      if (!alive()) return;
      setMsg(-1);
      await wait(250);
      for (let i = 1; i <= FINAL.length; i++) {
        if (!alive()) return;
        setFinalText(FINAL.slice(0, i));
        await wait(FINAL_TYPE_MS);
      }
      await wait(200);
      if (!alive()) return;
      setShowSub(true);
      await wait(SUB_HOLD_MS);
      if (alive()) doneRef.current();
    })();

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [instant]);

  // preskočeno → odmah završno stanje
  const isFinal = instant || msg === -1;
  const leaving = instant || !prefixVisible;
  const shownFinal = instant ? FINAL : finalText;
  const subVisible = instant || showSub;

  // FLIP: tekst se glatko smanji i klizne na novo mesto kad dođu koraci
  const headRef = useRef(null);
  const titleRef = useRef(null);
  const last = useRef(null);
  const wasCompact = useRef(compact);
  useLayoutEffect(() => {
    const el = headRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const font = parseFloat(getComputedStyle(titleRef.current).fontSize);
    if (last.current && wasCompact.current !== compact && !instant && el.animate) {
      const prev = last.current;
      const dx = prev.left + prev.width / 2 - (rect.left + rect.width / 2);
      const dy = prev.top - rect.top;
      el.animate(
        [{ transform: `translate(${dx}px, ${dy}px) scale(${prev.font / font})` }, { transform: 'translate(0, 0) scale(1)' }],
        { duration: MORPH_MS, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
      );
    }
    last.current = { left: rect.left, top: rect.top, width: rect.width, font };
    wasCompact.current = compact;
  });

  return (
    <header ref={headRef} className={`onb-head ${compact ? 'compact' : ''} ${leaving ? 'leaving' : ''} ${isFinal ? 'final' : ''}`}>
      <h1 className="onb-title" ref={titleRef}>
        {!isFinal ? (
          <>
            <span className={`onb-prefix ${prefixVisible ? '' : 'out'}`}>Želiš da</span>{' '}
            <span className="onb-typed">
              {word}
              <span className="onb-caret" aria-hidden="true" />
            </span>
          </>
        ) : (
          <span className="onb-final">
            <FinalText text={shownFinal} />
            {!subVisible && <span className="onb-caret" aria-hidden="true" />}
          </span>
        )}
      </h1>

      {!compact && (
        <div className="onb-stage" aria-hidden="true">
          {MESSAGES.map(({ Stick }, i) => (
            <div key={i} className={`onb-stick ${!isFinal && i === msg ? 'on' : ''}`}>
              {!isFinal && i === msg && <Stick />}
            </div>
          ))}
        </div>
      )}

      <p className={`onb-sub ${subVisible ? 'show' : ''}`}>
        Spojili smo teretane i personalne trenere na jednoj mapi.
        <br />
        Ti samo izabereš — <strong>prvi trening zakazuješ za 5 minuta.</strong>
      </p>
    </header>
  );
}

function FinalText({ text }) {
  const a = FINAL.indexOf(FINAL_ACCENT);
  const b = a + FINAL_ACCENT.length;
  return (
    <>
      {text.slice(0, a)}
      <span className="onb-accent">{text.slice(a, b)}</span>
      {text.slice(b)}
    </>
  );
}

/* Cik-cak koraci sa linijom koja se crta */
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

// koordinate se računaju bez transform-a (offset*), pa linija radi i kad je uvod smanjen
function box(el, wrap) {
  let x = 0;
  let y = 0;
  let n = el;
  while (n && n !== wrap) {
    x += n.offsetLeft;
    y += n.offsetTop;
    n = n.offsetParent;
  }
  return { left: x, top: y, right: x + el.offsetWidth, bottom: y + el.offsetHeight, width: el.offsetWidth, height: el.offsetHeight };
}

function connector(a, b, wrap) {
  const r1 = box(a, wrap);
  const r2 = box(b, wrap);
  let pts;
  if (r2.left > r1.right - 4) {
    const p0 = [r1.right, r1.top + r1.height / 2];
    const p3 = [r2.left + r2.width / 2, r2.top];
    pts = [p0, [p3[0], p0[1]], [p3[0], p0[1]], p3];
  } else if (r1.left > r2.right - 4) {
    const p0 = [r1.left + r1.width / 2, r1.bottom];
    const p3 = [r2.right, r2.top + r2.height / 2];
    pts = [p0, [p0[0], p3[1]], [p0[0], p3[1]], p3];
  } else {
    const p0 = [r1.left + r1.width / 2, r1.bottom];
    const p3 = [r2.left + r2.width / 2, r2.top];
    const k = Math.max(20, (p3[1] - p0[1]) * 0.6);
    pts = [p0, [p0[0], p0[1] + k], [p3[0], p3[1] - k], p3];
  }
  const [p0, c1, c2, p3] = pts;
  return {
    d: `M${p0[0]},${p0[1]} C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p3[0]},${p3[1]}`,
    len: Math.ceil(bezierLength(p0, c1, c2, p3)) + 2,
    end: p3,
  };
}

function Steps({ instant, onDone }) {
  const wrapRef = useRef(null);
  const c1 = useRef(null);
  const c2 = useRef(null);
  const c3 = useRef(null);
  const [segs, setSegs] = useState([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const id = useId().replace(/:/g, '');
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  const measure = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap || !c1.current || !c2.current || !c3.current) return;
    setSize({ w: wrap.offsetWidth, h: wrap.offsetHeight });
    setSegs([connector(c1.current, c2.current, wrap), connector(c2.current, c3.current, wrap)]);
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

  const refs = [c1, c2, c3];

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
        <article key={title} ref={refs[i]} className={`onb-step onb-step-${i + 1}`}>
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
