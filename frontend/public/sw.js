/* NagRaksha service worker — app shell + offline emergency guidance.
 * Strategy:
 *  - Precache the app shell + critical static assets on install.
 *  - Navigation requests: network-first, fall back to cached "/" (offline shell).
 *  - Static assets (JS/CSS/fonts/images): stale-while-revalidate.
 *  - NEVER cache active incident medical data — API responses use NetworkOnly.
 */
const VERSION = "nagraksha-v1";
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;

const SHELL_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-512.png",
  "/icons/apple-touch-icon.png",
  "/snake/hero-snake.png",
  "/snake/scale-pattern.png",
  "/offline.html",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // best-effort precache; ignore individual failures so install never breaks
      await Promise.allSettled(SHELL_ASSETS.map((u) => cache.add(u)));
      self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/snake/") ||
    url.pathname.startsWith("/icons/") ||
    /\.(?:js|css|woff2?|ttf|png|jpg|jpeg|svg|webp|ico|gif)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Never intercept /api/* — incident data must always hit the network.
  if (url.pathname.startsWith("/api/")) return;

  // Navigation requests: network-first with offline fallback.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(SHELL_CACHE);
          cache.put("/", fresh.clone()).catch(() => {});
          return fresh;
        } catch {
          const cached = await caches.match("/");
          return cached || (await caches.match("/offline.html")) || Response.error();
        }
      })()
    );
    return;
  }

  // Static assets: stale-while-revalidate.
  if (url.origin === self.location.origin && isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(ASSET_CACHE);
        const cached = await cache.match(req);
        const network = fetch(req)
          .then((res) => {
            if (res && res.status === 200) cache.put(req, res.clone()).catch(() => {});
            return res;
          })
          .catch(() => null);
        return cached || (await network) || Response.error();
      })()
    );
  }
});
