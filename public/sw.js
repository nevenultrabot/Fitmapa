// FitMapa — prima push obaveštenja (nove rezervacije, zahtevi, otkazivanja) i otvara Panel na klik.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// broj nepročitanih na ikonici aplikacije (šalje ga server uz svako obaveštenje)
function setBadge(n) {
  try {
    if (!('setAppBadge' in self.navigator) || typeof n !== 'number') return Promise.resolve();
    return (n > 0 ? self.navigator.setAppBadge(n) : self.navigator.clearAppBadge()).catch(() => {});
  } catch {
    return Promise.resolve();
  }
}

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title || 'FitMapa', {
        body: data.body || 'Imaš novu rezervaciju.',
        icon: '/icon-192.png',
        badge: '/badge-72.png',
        tag: data.tag,
        renotify: Boolean(data.tag),
        data: { url: data.url || '/panel' },
      }),
      setBadge(data.badge),
      // otvorena aplikacija odmah osveži zvonce
      self.clients
        .matchAll({ type: 'window', includeUncontrolled: true })
        .then((list) => list.forEach((c) => c.postMessage({ type: 'gymby-push' }))),
    ])
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/panel', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.startsWith(self.location.origin) && 'focus' in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
