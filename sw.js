/* Lese-Rekorde service worker: keeps the app working offline. */
const VERSION = "2026-10-16-7beff8";
const CACHE = "lese-rekorde-" + VERSION;
const FONTS = "lese-rekorde-fonts";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png"];
const FONT_CSS = "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Lexend:wght@300;400;500;700&display=swap";

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(SHELL.map(u => new Request(u, { cache: "reload" })));
    try {
      const fc = await caches.open(FONTS);
      if (!(await fc.match(FONT_CSS))) {
        const r = await fetch(FONT_CSS, { mode: "cors" });
        if (r.ok) {
          const css = await r.clone().text();
          await fc.put(FONT_CSS, r);
          const urls = [...css.matchAll(/url\((https:[^)]+)\)/g)].map(m => m[1]);
          await Promise.all(urls.map(u => fetch(u, { mode: "cors" }).then(fr => fr.ok ? fc.put(u, fr) : null).catch(() => null)));
        }
      }
    } catch (err) { /* fonts are optional: the app falls back to system fonts */ }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE && k !== FONTS) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === "https://fonts.googleapis.com" || url.origin === "https://fonts.gstatic.com") {
    e.respondWith(caches.open(FONTS).then(async c => {
      const hit = await c.match(req, { ignoreVary: true });
      if (hit) return hit;
      try {
        const r = await fetch(req);
        if (r.ok || r.type === "opaque") c.put(req, r.clone());
        return r;
      } catch (err) { return Response.error(); }
    }));
    return;
  }
  if (url.origin !== self.location.origin) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const hit = (await c.match(req, { ignoreSearch: true })) || (req.mode === "navigate" ? await c.match("index.html") : null);
    if (hit) return hit;
    try { return await fetch(req); }
    catch (err) { return (await c.match("index.html")) || Response.error(); }
  })());
});
