// Sapiens (Pacha Académie IB) : fonctionne hors connexion (cours, flashcards, planning, calculatrice, mes travaux).
const CACHE = "sapiens-v39";
// Bibliothèques gardées pour le mode hors ligne (calculatrice, lecture des fichiers Word).
const LIBS = ["https://cdn.jsdelivr.net/npm/mathjs@13.0.0/lib/browser/math.js", "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js", "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.2.108/legacy/build/pdf.min.mjs", "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.2.108/legacy/build/pdf.worker.min.mjs"];
const CORE = ["./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-maskable.png"];

self.addEventListener("install", e => {
  // chaque fichier est mis en cache séparément : un fichier absent ne bloque jamais l'installation
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(CORE.concat(LIBS).map(u => fetch(u, /^https?:/.test(u) ? { mode: "cors" } : { cache: "reload" }).then(r => r.ok && c.put(u, r)).catch(() => 0)))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.pathname.startsWith("/api/")) return; // l'IA passe toujours par le réseau
  const local = url.origin === location.origin;
  const lib = /cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com/.test(url.host);
  if (!local && !lib) return;
  if (req.mode === "navigate") {
    // page : réseau d'abord (mises à jour), cache si hors ligne
    e.respondWith(fetch(req, { cache: "no-cache" }).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put("./index.html", c)); return r; })
      .catch(() => caches.match("./index.html").then(r => r || caches.match(req))));
    return;
  }
  // fichiers et bibliothèques : cache d'abord
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r.ok || r.type === "opaque") { const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c)); }
    return r;
  })));
});
