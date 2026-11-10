'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { FiArrowRight, FiCalendar, FiChevronDown, FiMapPin, FiRotateCcw, FiUser } from 'react-icons/fi';
import { LogoMark } from './Logo';
import MapExplorer from './MapExplorer';
import { StickFlex, StickScale, StickWalk } from './Stickmen';

/* ---------------------------------------------------------------------
   Početna stranica
   logo → 3 poruke sa stickmanom → 4. poruka → koraci → CTA
   → posle ~4 s: uvod se smanji i ode gore (70% ekrana), a dole se kroz
     zamućenje otkrije mapa (30% ekrana). Strelica pokazuje da se skroluje
     dole do pune, funkcionalne mape (učitava se odmah, u pozadini).
   "Preskoči" vodi odmah na završni prikaz i nestaje kad se uvod završi.
   --------------------------------------------------------------------- */

const SEEN_KEY = 'fitmapa-intro';
const LOGO_MS = 3600;
const MESSAGES = [
  { word: 'smršaš?', Stick: StickScale },
  { word: 'ojačaš?', Stick: StickFlex },
  { word: 'konačno kreneš?', Stick: StickWalk },
];
const FINAL = 'Put ka preokretu nikad nije bio dostupniji.';
const FINAL_ACCENT = 'preokretu';
const TYPE_MS = 90;
const FINAL_TYPE_MS = 55;
const DELETE_MS = 40;
const HOLD_MS = 2300;
const SUB_HOLD_MS = 1200; // posle 4. poruke koraci kreću za ~1.5 s
const MORPH_MS = 1000;
const SPLIT_DELAY_MS = 4000; // pauza posle poslednje animacije pre prelaza na mapu
const INTRO_SHARE = 0.7;     // uvod zauzima 70% visine, mapa 30%
const HEADER_PX = 56;

const STEPS = [
  { Icon: FiMapPin, title: 'Izaberi teretanu', text: 'Pronađi teretanu na mapi — blizu kuće, posla ili fakulteta.' },
  { Icon: FiUser, title: 'Izaberi trenera', text: 'Pogledaj profile, specijalnosti i cene trenera koji tu rade.' },
  { Icon: FiCalendar, title: 'Zakaži termin', text: 'Klikni na slobodan termin i dođi — plaćaš na licu mesta.' },
];
const STEPS_TOTAL_MS = 10900; // mora da se slaže sa CSS-om koraka

const COMPACT = ['steps', 'cta', 'split'];

export default function Intro() {
  const [phase, setPhase] = useState(null); // logo | type | steps | cta | split
  const [instant, setInstant] = useState(false);
  const [run, setRun] = useState(0);
  const [skipGone, setSkipGone] = useState(false);
  const [scale, setScale] = useState(1);
  const [settled, setSettled] = useState(false);
  const rootRef = useRef(null);
  const mapRef = useRef(null);
  const introRef = useRef(null);
  const contentRef = useRef(null);

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
      setSkipGone(true);
      setPhase('split');
    } else {
      setPhase('logo');
    }
  }, []);

  // tajming faza
  useEffect(() => {
    if (phase === 'logo') {
      const t = setTimeout(() => setPhase((p) => (p === 'logo' ? 'type' : p)), LOGO_MS);
      return () => clearTimeout(t);
    }
    if (phase === 'cta' && !instant) {
      const t = setTimeout(() => setPhase((p) => (p === 'cta' ? 'split' : p)), SPLIT_DELAY_MS);
      return () => clearTimeout(t);
    }
    if (phase === 'split') {
      introRef.current?.scrollTo({ top: 0, behavior: instant ? 'auto' : 'smooth' });
      window.scrollTo({ top: 0, behavior: instant ? 'auto' : 'smooth' });
      const t1 = setTimeout(() => setSkipGone(true), 500); // Preskoči izbledi, pa nestane
      const t2 = setTimeout(() => setSettled(true), instant ? 0 : 2700); // posle prelaza mapa bez filtera
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [phase, instant]);

  // dok uvod traje stranica se ne skroluje; posle prelaza se skroluje do mape
  useEffect(() => {
    if (!phase) return;
    const lock = phase !== 'split';
    if (lock) window.scrollTo(0, 0);
    document.documentElement.style.overflow = lock ? 'hidden' : '';
    return () => {
      document.documentElement.style.overflow = '';
    };
  }, [phase]);

  // u završnom prikazu uvod se smanji tako da stane u gornjih 70%
  useLayoutEffect(() => {
    if (phase !== 'split') return;
    const fit = () => {
      const content = contentRef.current;
      if (!content) return;
      // mesto za strelicu ispod sadržaja
      const avail = (window.innerHeight - HEADER_PX) * INTRO_SHARE - 64;
      setScale(Math.max(0.55, Math.min(1, avail / content.offsetHeight)));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [phase]);

  const skip = useCallback(() => {
    setInstant(true);
    setPhase('split');
  }, []);

  // skrol do mape (dno stranice — gore ostaje traka uvoda sa strelicom za povratak)
  const goToMap = useCallback(() => {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
  }, []);

  // strelica pokazuje dole dok smo na uvodu, a gore kad smo na mapi
  const [atMap, setAtMap] = useState(false);
  useEffect(() => {
    if (phase !== 'split') return;
    const onScroll = () => {
      const el = mapRef.current;
      if (el) setAtMap(el.getBoundingClientRect().top < window.innerHeight * 0.45);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [phase]);

  const replay = useCallback(() => {
    window.scrollTo({ top: 0 });
    setInstant(false);
    setSkipGone(false);
    setSettled(false);
    setScale(1);
    setRun((r) => r + 1);
    setPhase('logo');
  }, []);

  if (!phase) return <div className="home" />;

  const compact = COMPACT.includes(phase);
  const split = phase === 'split';

  return (
    <div ref={rootRef} className={`home ${split ? 'split' : ''} ${instant ? 'instant' : ''} ${settled ? 'settled' : ''}`}>
      <section className="home-intro" ref={introRef}>
        <div
          ref={contentRef}
          className={`home-intro-content ${compact ? 'is-compact' : ''}`}
          style={split ? { transform: `scale(${scale})` } : undefined}
        >
          {phase === 'logo' ? (
            <LogoStage key={`l${run}`} />
          ) : (
            <>
              <Headline
                key={`h${run}`}
                instant={instant}
                compact={compact}
                onDone={() => setPhase((p) => (p === 'type' ? 'steps' : p))}
              />
              {compact && (
                <Steps key={`s${run}`} instant={instant} onDone={() => setPhase((p) => (p === 'steps' ? 'cta' : p))} />
              )}
              {(phase === 'cta' || split) && <Cta
                  key={`c${run}`}
                  instant={instant}
                  onShow={() => {
                    // na nižim ekranima pomeri samo uvod (ne celu stranicu) do dugmeta
                    const el = introRef.current;
                    if (el && !split) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
                  }}
                  onStart={split ? goToMap : () => setPhase('split')}
                />}
            </>
          )}
        </div>
        {split && (
          <>
            <button
              className={`home-arrow ${atMap ? 'up' : ''}`}
              onClick={atMap ? () => window.scrollTo({ top: 0, behavior: 'smooth' }) : goToMap}
              aria-label={atMap ? 'Nazad na uvod' : 'Nastavi do mape'}
            >
              <FiChevronDown aria-hidden="true" />
            </button>
            <button className="home-replay" onClick={replay} aria-label="Pusti uvod ponovo" title="Pusti uvod ponovo">
              <FiRotateCcw aria-hidden="true" /> Pusti uvod ponovo
            </button>
          </>
        )}
      </section>

      {/* mapa se učitava odmah (u pozadini), da prelaz bude bez kašnjenja */}
      <section className="home-map" ref={mapRef} aria-label="Mapa teretana">
        <MapExplorer embedded />
      </section>

      {!skipGone && (
        <button className={`onb-skip ${split ? 'leaving' : ''}`} onClick={skip}>
          Preskoči <FiArrowRight aria-hidden="true" />
        </button>
      )}
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
      await wait(800);
      if (!alive()) return;
      setMsg(-1);
      await wait(250);
      for (let i = 1; i <= FINAL.length; i++) {
        if (!alive()) return;
        setFinalText(FINAL.slice(0, i));
        await wait(FINAL_TYPE_MS);
      }
      await wait(300);
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

/* Završni poziv na akciju */
function Cta({ instant, onShow, onStart }) {
  const showRef = useRef(onShow);
  showRef.current = onShow;
  useEffect(() => {
    if (instant) return;
    const t = setTimeout(() => showRef.current?.(), 150);
    return () => clearTimeout(t);
  }, [instant]);
  return (
    <div className="onb-cta">
      <p className="onb-cta-text">Spreman? Prvi korak je najteži — ostalo je na nama.</p>
      <button className="onb-cta-btn" onClick={onStart}>
        Zakaži svoj prvi trening <FiArrowRight aria-hidden="true" />
      </button>
    </div>
  );
}
