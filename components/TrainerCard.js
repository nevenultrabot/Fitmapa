import Link from 'next/link';
import Avatar from './Avatar';
import { formatDayShort, formatPrice, formatTime } from '@/lib/format';

// variant: 'row' (lista u teretani) ili 'tile' (stranica Treneri)
export default function TrainerCard({ t, variant = 'row' }) {
  const next = t.nextSlot
    ? `Slobodno: ${formatDayShort(t.nextSlot)} u ${formatTime(t.nextSlot)}`
    : 'Nema slobodnih termina ove nedelje';

  if (variant === 'tile') {
    return (
      <Link href={`/trener/${t.id}`} className="trainer-tile">
        <Avatar url={t.avatar_url} name={t.name} size="xl" />
        <strong className="trainer-tile-name">{t.name}</strong>
        {t.specialties?.length > 0 && <span className="small muted">{t.specialties.slice(0, 3).join(' · ')}</span>}
        {t.gyms?.length > 0 && <span className="small">{t.gyms.map((g) => g.name).join(', ')}</span>}
        <span className="trainer-tile-foot">
          <span className="trainer-tile-price">{formatPrice(t.price_per_session) || 'Cena po dogovoru'}</span>
          <span className={`small ${t.nextSlot ? 'next-slot' : 'muted'}`}>{next}</span>
        </span>
      </Link>
    );
  }

  return (
    <Link href={`/trener/${t.id}`} className="trainer-card">
      <Avatar url={t.avatar_url} name={t.name} size="md" />
      <span className="trainer-card-text">
        <strong>{t.name}</strong>
        {t.specialties?.length > 0 && <span className="small">{t.specialties.slice(0, 3).join(' · ')}</span>}
        <span className="small muted">{formatPrice(t.price_per_session) || 'Cena po dogovoru'}</span>
        <span className={`small ${t.nextSlot ? 'next-slot' : 'muted'}`}>{next}</span>
      </span>
      <span className="chev" aria-hidden="true">›</span>
    </Link>
  );
}
