/* Otondo service worker (2026-11-26).
 *
 * Why: a returning player used to re-download everything. GitHub Pages serves
 * a fixed ten-minute cache (see build.sh), so coming back after lunch meant
 * pulling index.html, the modules and — until this week — a 635KB mp3 again,
 * on Nigerian mobile data. This keeps the heavy, unchanging things on the
 * phone and leaves the code alone.
 *
 * Two caches on purpose:
 *
 *   MEDIA  — mp3, m4a, png, the manifest. These almost never change, and they
 *            are nearly all of the bytes. Cache-first, and NOT cleared on a
 *            deploy: Damian deploys several times a day and purging it on
 *            every deploy would hand the player the same 635KB download all over
 *            again. Bump MEDIA_V by hand when a sound or an icon is replaced.
 *
 *   APP    — index.html's offline copy and the versioned module files. Keyed
 *            to the build, so a deploy drops the old one.
 *
 * index.html is deliberately network-first. build.sh stamps every import with
 * ?v=<build> precisely so a stale index.html can never meet fresh modules; if
 * the worker served a cached page while the server had a newer one, it would
 * recreate the exact skew that stamping exists to prevent. The cached copy is
 * only ever used when the network fails, which is what makes the game open at
 * all on a dead connection.
 */
const BUILD   = '20261126110508';            // replaced by build.sh
const APP     = 'otondo-app-' + BUILD;
const MEDIA_V = 'v1';                   // bump by hand when audio or icons change
const MEDIA   = 'otondo-media-' + MEDIA_V;

const MEDIA_RE = /\.(?:mp3|m4a|png|jpg|jpeg|webp|svg|woff2?|webmanifest)$/i;

self.addEventListener('install', e => {
  self.skipWaiting();                   // a new build should take over at once
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => {
      if (k.startsWith('otondo-app-') && k !== APP) return caches.delete(k);
      if (k.startsWith('otondo-media-') && k !== MEDIA) return caches.delete(k);
      return null;
    }));
    await self.clients.claim();
  })());
});

const isNav = req => req.mode === 'navigate'
  || (req.method === 'GET' && (req.headers.get('accept') || '').includes('text/html'));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // never touch writes
  let url;
  try { url = new URL(req.url); } catch { return; }
  if (url.origin !== self.location.origin) return;        // Supabase, CDNs: straight through

  /* The page itself: always try the network, fall back to the last good copy. */
  if (isNav(req)) {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res && res.ok) (await caches.open(APP)).put('/index.html', res.clone());
        return res;
      } catch {
        return (await caches.match('/index.html'))
            || new Response('<meta charset="utf-8"><body style="font:16px system-ui;padding:24px">'
                          + 'Otondo needs the network the first time. Try again when you have data.',
                            { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }
    })());
    return;
  }

  const media = MEDIA_RE.test(url.pathname);
  const bucket = media ? MEDIA : APP;

  /* Everything else is immutable in practice — media by nature, modules
     because build.sh gives each build its own ?v= URL. Serve from the phone
     when it is there, and only then go to the network. */
  e.respondWith((async () => {
    const hit = await caches.match(req, { ignoreVary: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      /* Opaque and error responses are not worth keeping. */
      if (res && res.ok && res.type === 'basic') (await caches.open(bucket)).put(req, res.clone());
      return res;
    } catch (err) {
      const any = await caches.match(req, { ignoreVary: true, ignoreSearch: true });
      if (any) return any;
      throw err;
    }
  })());
});

/* ---- push (2026-11-26) ----
 * Nothing sends these yet; the client collects subscriptions first, because a
 * sender with no subscribers is worth nothing. The handlers are here so that
 * the day the sender exists, already-installed players can receive without
 * needing to reinstall anything.
 */
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
  const title = d.title || 'Otondo';
  e.waitUntil(self.registration.showNotification(title, {
    body: d.body || 'Today’s wahala dey wait you.',
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    tag: d.tag || 'otondo',
    renotify: false,
    data: { url: d.url || '/?r=push' },
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || '/?r=push';
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if (c.url.includes(self.location.origin)) { await c.focus(); return; }
    }
    await self.clients.openWindow(target);
  })());
});
