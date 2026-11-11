'use client';

import { useEffect, useRef, useState } from 'react';
import { FiX } from 'react-icons/fi';
import { LogoMark } from './Logo';
import { useSession } from '@/lib/useSession';

/**
 * Chat dugme dole desno — tvoja slika koja pulsira + oblačić "Pitaj me bilo šta".
 * Ispod radi Tawk.to: poruke stižu u tvoju Tawk aplikaciju na telefonu, odakle odgovaraš.
 * Tawk nalog: ID-jevi su upisani ispod (mogu da se promene i preko Vercel promenljivih
 *   NEXT_PUBLIC_TAWK_PROPERTY_ID i NEXT_PUBLIC_TAWK_WIDGET_ID).
 * Slika: public/chat-avatar.jpg (ako je nema, prikazuje se FitMapa logo).
 */
// (ovi brojevi su javni — vide se u kodu svakog sajta sa Tawk chatom)
const PROPERTY_ID = process.env.NEXT_PUBLIC_TAWK_PROPERTY_ID || '6af45a60a60c2e3c4475479e';
const WIDGET_ID = process.env.NEXT_PUBLIC_TAWK_WIDGET_ID || '1k75822dv';

export default function ChatLauncher() {
  const { loading, user, profile } = useSession();
  const [ready, setReady] = useState(false);
  const [bubble, setBubble] = useState(false);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false); // dok je chat otvoren, naše dugme se ne vidi
  const [photoOk, setPhotoOk] = useState(true);
  const injected = useRef(false);

  // Učitaj Tawk jednom (kad znamo da li je korisnik prijavljen, da bi ti video njegovo ime)
  useEffect(() => {
    if (!PROPERTY_ID || !WIDGET_ID || loading || injected.current) return;
    injected.current = true;

    const api = (window.Tawk_API = window.Tawk_API || {});
    window.Tawk_LoadStart = new Date();
    if (user) {
      api.visitor = { name: profile?.full_name || user.email, email: user.email };
    }
    // Tawk-ovo dugme sakrivamo — koristimo svoje
    api.onLoad = () => {
      api.hideWidget();
      setReady(true);
    };
    api.onChatMaximized = () => setOpen(true);
    api.onChatMinimized = () => {
      api.hideWidget();
      setOpen(false);
    };
    api.onChatHidden = () => {
      api.hideWidget();
      setOpen(false);
    };
    api.onUnreadCountChanged = (count) => setUnread(count || 0);

    const s = document.createElement('script');
    s.async = true;
    s.src = `https://embed.tawk.to/${PROPERTY_ID}/${WIDGET_ID}`;
    s.charset = 'UTF-8';
    s.setAttribute('crossorigin', '*');
    document.body.appendChild(s);
  }, [loading, user, profile]);

  // Oblačić se sam pojavi posle par sekundi, pa se skloni (samo na računaru — na telefonu bi prekrio mapu)
  useEffect(() => {
    if (!ready || window.innerWidth < 900) return;
    const show = setTimeout(() => setBubble(true), 2500);
    const hide = setTimeout(() => setBubble(false), 12000);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [ready]);

  if (!PROPERTY_ID || !WIDGET_ID) return null;

  function openChat() {
    const api = window.Tawk_API;
    if (!api?.maximize) return;
    setBubble(false);
    setOpen(true);
    api.showWidget();
    api.maximize();
  }

  return (
    <div className={`chat-launcher ${ready ? 'ready' : ''} ${open ? 'chat-is-open' : ''}`}>
      {bubble && (
        <div className="chat-bubble" role="status">
          <button className="chat-bubble-text" onClick={openChat}>
            <strong>Pitaj me bilo šta</strong>
            <span>
              <i className="chat-online" aria-hidden="true" /> Odgovaram za par minuta
            </span>
          </button>
          <button className="chat-bubble-close" onClick={() => setBubble(false)} aria-label="Zatvori">
            <FiX aria-hidden="true" />
          </button>
        </div>
      )}
      <button
        className="chat-avatar-btn"
        onClick={openChat}
        onMouseEnter={() => setBubble(true)}
        aria-label="Otvori chat — pitaj me bilo šta"
        title="Pitaj me bilo šta"
      >
        {photoOk ? (
          <img src="/chat-avatar.jpg" alt="" onError={() => setPhotoOk(false)} />
        ) : (
          <span className="chat-avatar-fallback">
            <LogoMark size={34} />
          </span>
        )}
        <i className="chat-online chat-online-dot" aria-hidden="true" />
        {unread > 0 && <span className="chat-unread">{unread}</span>}
      </button>
    </div>
  );
}
