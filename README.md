# Plan Cruce de los Andes 2026

Plan de entrenamiento (primeros mesociclos) en formato web, instalable en el celular.
Transcripción del Excel entregado por el profe, con cada trabajo desglosado en su
esquema de bloques y repeticiones.

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
