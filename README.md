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
| `fit/` | Un `.fit` por trabajo (entrenamiento estructurado para Garmin) y un `.zip` con todos |
| `garmin/` | El mismo trabajo en JSON de Garmin Connect (lo que sube "Hacer hoy") |
| `.github/workflows/garmin.yml`, `scripts/` | El botón "Hacer hoy" y el login a Garmin |
| `icon-*.png`, `apple-touch-icon.png` | Íconos |

## Hacer hoy → Garmin Connect → reloj

El botón **⌚ Hacer hoy** de cada sesión dispara el workflow `garmin.yml`, que sube ese
trabajo a Garmin Connect (con [python-garminconnect](https://github.com/cyberjunky/python-garminconnect),
no oficial) y lo agenda para hoy. Antes borra el que haya subido el plan la vez anterior,
así en Garmin queda uno solo. El reloj lo recibe en el próximo sync y lo ofrece como
entrenamiento del día.

Puesta en marcha (una vez):

1. **Token de GitHub**: en GitHub → Settings → Developer settings → Fine-grained tokens, crear uno
   sólo para este repo con permisos **Actions: Read and write** y **Secrets: Read and write**.
   Guardarlo como secret del repo: `gh secret set GH_PAT` (el workflow lo usa para guardar la
   sesión de Garmin cuando se renueva).
2. **Sesión de Garmin**: `pip install garminconnect && python3 scripts/garmin_login.py`.
   Pide mail, contraseña y código; guarda sólo los tokens en el secret `GARMIN_TOKENS`.
3. **En el celu**: tocar "Hacer hoy" una vez y pegar el mismo token. Queda guardado en ese
   celular (en la app instalada, no en Safari).

Si Garmin invalida la sesión, el botón muestra "✕ Falló": repetir el paso 2.

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

`build.mjs` también genera los `.fit` con `fit.mjs`, que traduce cada esquema de bloques
a pasos de Garmin (tiempo, distancia o "hasta LAP", con repeticiones).

`build.mjs` corre el código de render de `src-page.html` contra un DOM simulado y
escribe el markup ya resuelto: por eso la página se lee aunque el navegador no
ejecute JavaScript (la vista previa de Archivos en iOS, por ejemplo).
