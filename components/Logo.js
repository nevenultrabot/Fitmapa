// FitMapa logo: pin na mapi sa tegom u sredini
export function LogoMark({ size = 32, className = '' }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M32 4C20.4 4 11 13.2 11 24.6 11 39.5 32 60 32 60s21-20.5 21-35.4C53 13.2 43.6 4 32 4z"
        fill="var(--accent)"
      />
      <rect x="20" y="22.5" width="24" height="4" rx="2" fill="var(--ink)" />
      <rect x="18" y="17" width="5" height="15" rx="2" fill="var(--ink)" />
      <rect x="41" y="17" width="5" height="15" rx="2" fill="var(--ink)" />
      <rect x="14" y="20" width="3.5" height="9" rx="1.5" fill="var(--ink)" />
      <rect x="46.5" y="20" width="3.5" height="9" rx="1.5" fill="var(--ink)" />
    </svg>
  );
}

export default function Logo({ size = 30, className = '' }) {
  return (
    <span className={`logo-full ${className}`}>
      <LogoMark size={size} />
      <span className="logo-word">
        Fit<span className="logo-word-accent">Mapa</span>
      </span>
    </span>
  );
}
