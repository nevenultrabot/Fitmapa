'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FiX } from 'react-icons/fi';

// Slika preko celog ekrana (npr. cenovnik). Zatvara se klikom pored, na X ili tasterom Esc.
export default function Lightbox({ src, title, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return createPortal(
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="lightbox-inner" onClick={(e) => e.stopPropagation()}>
        <div className="lightbox-head">
          <strong>{title}</strong>
          <button className="lightbox-close" onClick={onClose} aria-label="Zatvori">
            <FiX aria-hidden="true" />
          </button>
        </div>
        <div className="lightbox-body">
          <img src={src} alt={title} />
        </div>
      </div>
    </div>,
    document.body
  );
}
