// Minimalističke stickman animacije za uvodne poruke (animacije su u globals.css → .sm-*)

const S = { stroke: 'currentColor', strokeWidth: 4, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' };

// 1. "Želiš da smršaš?" — debeli stickman staje na vagu, vaga "poludi"
export function StickScale() {
  return (
    <svg viewBox="0 0 140 130" className="sm sm-scale" aria-hidden="true">
      <g className="sm1-scale">
        <rect x="38" y="108" width="64" height="13" rx="5" {...S} />
        <rect className="sm1-display" x="60" y="111.5" width="20" height="6" rx="2" fill="var(--accent)" />
      </g>
      <g className="sm1-body">
        <circle cx="70" cy="20" r="11" {...S} />
        <path d="M70 31v5" {...S} />
        <ellipse cx="70" cy="60" rx="21" ry="23" {...S} />
        <path d="M51 52l-13 15M89 52l13 15" {...S} />
        <path className="sm1-leg-l" d="M62 82l-2 24" {...S} />
        <path className="sm1-leg-r" d="M78 82l2 24" {...S} />
      </g>
      <g className="sm1-alert">
        <path d="M118 10v18" {...S} stroke="var(--accent)" />
        <circle cx="118" cy="37" r="2.6" fill="var(--accent)" />
      </g>
    </svg>
  );
}

// 2. "Želiš da ojačaš?" — ponosno fleksa oba bicepsa
export function StickFlex() {
  return (
    <svg viewBox="0 0 140 130" className="sm sm-flex" aria-hidden="true">
      <g className="sm2-body">
        <circle cx="70" cy="22" r="11" {...S} />
        <path d="M65 24q5 4 10 0" {...S} strokeWidth="2.5" />
        <path d="M70 33v42" {...S} />
        <path d="M70 75l-12 34M70 75l12 34" {...S} />
        {/* nadlaktice */}
        <path d="M70 44h-24M70 44h24" {...S} />
        {/* podlaktice — "pumpaju" */}
        <path className="sm2-fore-l" d="M46 44l-2-22" {...S} />
        <path className="sm2-fore-r" d="M94 44l2-22" {...S} />
        {/* bicepsi */}
        <circle className="sm2-bicep sm2-bicep-l" cx="54" cy="40" r="5" fill="var(--accent)" />
        <circle className="sm2-bicep sm2-bicep-r" cx="86" cy="40" r="5" fill="var(--accent)" />
      </g>
      <g className="sm2-spark" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round">
        <path d="M24 18l-7-5M22 30h-9M28 8l-3-7" />
        <path d="M116 18l7-5M118 30h9M112 8l3-7" />
      </g>
    </svg>
  );
}

// 3. "Želiš da konačno kreneš?" — odlučan korak napred
export function StickWalk() {
  return (
    <svg viewBox="0 0 140 130" className="sm sm-walk" aria-hidden="true">
      <g className="sm3-lines" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round">
        <path d="M14 46h18M8 62h20M16 78h14" />
      </g>
      <g className="sm3-body">
        <circle cx="76" cy="20" r="11" {...S} />
        <path d="M74 31l-4 40" {...S} />
        <path className="sm3-arm-a" d="M73 42l-2 26" {...S} />
        <path className="sm3-arm-b" d="M73 42l-2 26" {...S} />
        <path className="sm3-leg-a" d="M70 71l0 38" {...S} />
        <path className="sm3-leg-b" d="M70 71l0 38" {...S} />
      </g>
      <path className="sm3-ground" d="M10 118h120" stroke="rgba(255,255,255,0.35)" strokeWidth="3" strokeLinecap="round" strokeDasharray="10 12" />
    </svg>
  );
}
