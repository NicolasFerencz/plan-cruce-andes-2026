# Plan Cruce de los Andes 2026

Plan de entrenamiento en formato web, instalable en el celular. Transcripción de los
Excel entregados por el profe, con cada trabajo desglosado en su esquema de bloques y
repeticiones:

- **Primeros mesociclos** — semanas 1 a 5 (31 ago → 4 oct). Las semanas 6 a 8 de ese
  plan quedaron reemplazadas por el plan nuevo.
- **Último mesociclo y tapering** — semanas 9 a 17 (5 oct → 6 dic), la 17 es el Cruce.

**Sitio:** https://nicolasferencz.github.io/plan-cruce-andes-2026/

## Instalar en el iPhone

Abrir el link en **Safari** → Compartir → **Agregar a inicio**.
Queda con ícono propio, a pantalla completa y funciona sin señal.

## Contenido

| Archivo | Qué es |
|---|---|
| `index.html` | La página entera, pre-renderizada (se lee incluso con JavaScript apagado) |
| `sw.js` | Service worker: cache-first, habilita el uso offline |
| `manifest.webmanifest` | Metadatos de la app instalable |
| `icon-*.png`, `apple-touch-icon.png` | Íconos |

## Notas

- Lleva `noindex`, así que no aparece en buscadores — pero el repo es público,
  o sea que cualquiera con el link puede ver la página.
- Cada trabajo guarda debajo el **texto tal cual la planilla**: el esquema de
  bloques es una lectura de ese texto original.
- Al tocar `index.html`, subir el número de versión del cache en `sw.js` para que
  los celulares que ya lo tengan instalado bajen la versión nueva.

## Regenerar

Las fuentes están en `src/`. `src-page.html` es la página con los datos del plan y
las funciones de render; el resto es la cadena de armado.

```sh
cd src
node build.mjs                 # ejecuta el render y hornea el HTML estático
python3 build-site.py 2        # lo envuelve como sitio; el número es la versión del cache
python3 make-icons.py          # sólo si cambian los íconos
```

`build.mjs` corre el código de render de `src-page.html` contra un DOM simulado y
escribe el markup ya resuelto: por eso la página se lee aunque el navegador no
ejecute JavaScript (la vista previa de Archivos en iOS, por ejemplo).
