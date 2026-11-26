'use client';

import { getSupabase } from './supabase';

// Javni ključ za push (nije tajna). Par mu je VAPID_PRIVATE_KEY u Supabase → Edge Functions → Secrets.
export const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  'BAte5mm2msJAUllv1S5yd_Flwl3mm5V1ruAr9R8L-NOWGWNMP9W_g4H_BZByRntje-fOac1Y3txPIRhVZM31ddQ';

function toBytes(b64u) {
  const s = b64u.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64u.length % 4)) % 4);
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

// javlja ostalim delovima stranice (zvono, kartica u Panelu) da je stanje promenjeno
export const PUSH_EVENT = 'gymby-push-change';
const announce = () => {
  try {
    window.dispatchEvent(new Event(PUSH_EVENT));
  } catch {}
};

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;

// 'unsupported' | 'ios-install' | 'denied' | 'off' | 'on'
export async function pushState() {
  if (typeof window === 'undefined') return 'unsupported';
  if (isIOS() && !isStandalone()) return 'ios-install';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration('/');
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

export async function enablePush() {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error(permission === 'denied' ? 'denied' : 'dismissed');
  const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(VAPID_PUBLIC_KEY) });
  }
  const json = sub.toJSON();
  const { error } = await getSupabase().rpc('save_push_subscription', {
    p_endpoint: json.endpoint,
    p_p256dh: json.keys.p256dh,
    p_auth: json.keys.auth,
  });
  if (error) throw error;
  announce();
}

// Da li nalog ima push uključen na bar jednom uređaju (telefon, računar…)
export async function accountHasPush() {
  const { count, error } = await getSupabase().from('push_subscriptions').select('id', { count: 'exact', head: true });
  if (error) return false;
  return (count || 0) > 0;
}

// Broj na ikonici aplikacije (iPhone sa početnog ekrana, Android/računar kad je instalirana)
export function setAppBadge(n) {
  try {
    if (typeof navigator === 'undefined' || !('setAppBadge' in navigator)) return;
    if (n > 0) navigator.setAppBadge(n).catch(() => {});
    else navigator.clearAppBadge().catch(() => {});
  } catch {}
}

// Ukloni već prikazana obaveštenja iz centra za obaveštenja (pročitana su u aplikaciji)
export async function clearShownNotifications() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration('/');
    const list = (await reg?.getNotifications()) || [];
    list.forEach((n) => n.close());
  } catch {}
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration('/');
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await getSupabase().from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  await sub.unsubscribe();
  announce();
}
