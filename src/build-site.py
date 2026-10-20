#!/usr/bin/env python3
"""Envuelve la página del plan como sitio estático instalable (PWA)."""
import pathlib, shutil, sys

SCRATCH = pathlib.Path(__file__).parent
SITE    = pathlib.Path("/Users/nicolasferencz/Documents/plan-cruce-andes-2026")

page = (SCRATCH / "plan-cruce.html").read_text(encoding="utf-8")
cut  = page.index('<div class="wrap">')
head_bits, body_bits = page[:cut].rstrip(), page[cut:].rstrip()

HEAD = '''<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow">
<meta name="theme-color" content="#1b4d6b">
<link rel="manifest" href="./manifest.webmanifest">
<link rel="apple-touch-icon" href="./apple-touch-icon.png">
<link rel="icon" href="./favicon-32.png" sizes="32x32" type="image/png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Plan Cruce">
<style>
  :root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
  body{margin:0}
  img{max-width:100%}
  [hidden]{display:none!important}
</style>
'''

SW_REG = '''
<script>
if("serviceWorker" in navigator){
  addEventListener("load", function(){
    navigator.serviceWorker.register("./sw.js").catch(function(){});
  });
}
</script>
'''

SITE.mkdir(parents=True, exist_ok=True)
(SITE / "index.html").write_text(
    HEAD + head_bits + "\n</head>\n<body>\n" + body_bits + SW_REG + "\n</body>\n</html>\n",
    encoding="utf-8")

(SITE / "manifest.webmanifest").write_text('''{
  "name": "Plan Cruce de los Andes 2026",
  "short_name": "Plan Cruce",
  "description": "Plan de entrenamiento — Cruce de los Andes 2026.",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#f2f2ee",
  "theme_color": "#1b4d6b",
  "icons": [
    { "src": "icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
''', encoding="utf-8")

(SITE / "sw.js").write_text('''/* Cache-first: una vez abierta, la app funciona sin señal. */
var CACHE = "plan-cruce-v__VER__";
var CORE = ["./", "./index.html", "./manifest.webmanifest",
            "./icon-192.png", "./icon-512.png", "./icon-512-maskable.png",
            "./apple-touch-icon.png", "./favicon-32.png"];

self.addEventListener("install", function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(CORE); })
    .then(function(){ return self.skipWaiting(); }));
});

self.addEventListener("activate", function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.map(function(k){ return k === CACHE ? null : caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});

self.addEventListener("fetch", function(e){
  if(e.request.method !== "GET") return;
  if(new URL(e.request.url).origin !== location.origin) return;   // la API de GitHub va siempre a la red
  e.respondWith(
    caches.match(e.request).then(function(hit){
      if(hit) return hit;
      return fetch(e.request).then(function(res){
        var copy = res.clone();
        caches.open(CACHE).then(function(c){ c.put(e.request, copy); }).catch(function(){});
        return res;
      }).catch(function(){
        return e.request.mode === "navigate" ? caches.match("./index.html") : Response.error();
      });
    })
  );
});
'''.replace("__VER__", sys.argv[1] if len(sys.argv) > 1 else "1"), encoding="utf-8")

(SITE / ".nojekyll").write_text("", encoding="utf-8")

for d in ("fit", "garmin"):
    shutil.rmtree(SITE / d, ignore_errors=True)
    shutil.copytree(SCRATCH / d, SITE / d)

print("sitio en", SITE)
for f in sorted(SITE.iterdir()):
    if f.is_file():
        print(f"  {f.name:28} {f.stat().st_size/1024:6.1f} KB")
