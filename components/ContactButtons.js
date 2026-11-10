import { FaWhatsapp, FaInstagram, FaViber, FaPhoneAlt, FaEnvelope } from 'react-icons/fa';
import { instagramLink, viberLink, whatsappLink } from '@/lib/format';

// Okrugla dugmad sa ikonicama za kontakt trenera
export default function ContactButtons({ trainer, size = 'md' }) {
  const items = [
    trainer.whatsapp && { key: 'wa', label: 'WhatsApp', href: whatsappLink(trainer.whatsapp), Icon: FaWhatsapp },
    trainer.viber && { key: 'viber', label: 'Viber', href: viberLink(trainer.viber), Icon: FaViber },
    trainer.instagram && { key: 'ig', label: 'Instagram', href: instagramLink(trainer.instagram), Icon: FaInstagram },
    trainer.contact_phone && { key: 'tel', label: 'Pozovi', href: `tel:${trainer.contact_phone}`, Icon: FaPhoneAlt },
    trainer.contact_email && { key: 'mail', label: 'Email', href: `mailto:${trainer.contact_email}`, Icon: FaEnvelope },
  ].filter((c) => c && c.href);

  if (items.length === 0) return null;

  return (
    <div className={`contact-icons contact-${size}`}>
      {items.map(({ key, label, href, Icon }) => (
        <a
          key={key}
          href={href}
          target={key === 'tel' || key === 'mail' ? undefined : '_blank'}
          rel="noopener noreferrer"
          className={`contact-icon ci-${key}`}
          aria-label={label}
          title={label}
        >
          <Icon />
        </a>
      ))}
    </div>
  );
}
