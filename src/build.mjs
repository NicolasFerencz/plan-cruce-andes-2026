import fs from "node:fs";
import { encodeWorkout, garminWorkout, zip } from "./fit.mjs";

const DIR = new URL(".", import.meta.url).pathname;
const src = fs.readFileSync(DIR + "src-page.html", "utf8");

const i = src.indexOf("<script>");
const j = src.lastIndexOf("</script>");
const shell = src.slice(0, i).trimEnd();
const code  = src.slice(i + "<script>".length, j);

/* ---- run the page's render code against a stub DOM, capture the markup ---- */
const store = {};
const nodes = {};
const mk = (id) => (nodes[id] ??= {
  set innerHTML(v){ store[id] = v; },
  get innerHTML(){ return store[id] ?? ""; },
  addEventListener(){}, getAttribute(){ return "false"; }, setAttribute(){},
  style:{}, dataset:{}, textContent:"",
});
const documentStub = { getElementById: mk, querySelectorAll: () => [] };
const { WEEKS, LIB, CONT } =
  new Function("document", "window", "innerWidth", code + "\nreturn {WEEKS, LIB, CONT};")(documentStub, {}, 1024);

for (const key of ["nav","chart","weeks","libs","km-total"]) {
  if (!store[key]) throw new Error("no se generó: " + key);
}

/* ---- bake it into the shell ---- */
let out = shell
  .replace('<div class="weeks-inner" id="nav"></div>',
           `<div class="weeks-inner" id="nav">${store.nav}</div>`)
  .replace('<div class="chart" id="chart"></div>',
           `<div class="chart" id="chart">${store.chart}</div>`)
  .replace('<div id="weeks"></div>',
           `<div id="weeks">${store.weeks}</div>`)
  .replace('<div id="libs"></div>',
           `<div id="libs">${store.libs}</div>`)
  .replace('<span id="km-total"></span>',
           `<span id="km-total">${store["km-total"]}</span>`)
  /* el botón sólo sirve con JS: aparece cuando el JS corre */
  .replace('<button class="ctl" id="btn-open" aria-pressed="false">',
           '<button class="ctl" id="btn-open" aria-pressed="false" hidden>');

if (out === shell) throw new Error("no se inyectó nada");

/* ---- runtime chico: sólo lo que necesita JS de verdad ---- */
const weeks = JSON.parse(fs.readFileSync(DIR + "weeks.json", "utf8"));
const runtime = `
<script>
(function(){
  "use strict";
  var W = ${JSON.stringify(weeks)};

  /* 1. "Esta semana" se recalcula al abrir (el HTML viene con la marca horneada). */
  try{
    var hoy = new Date(), z = new Date(hoy.getTime() - hoy.getTimezoneOffset()*6e4)
                                .toISOString().slice(0,10);
    var now = W.filter(function(w){ return z >= w.from && z <= w.to; })[0];
    var marcada = document.querySelector(".wk[data-now]");
    if(!now || !marcada || marcada.id !== "s" + now.n){
      [].forEach.call(document.querySelectorAll("[data-now]"), function(e){ e.removeAttribute("data-now"); });
      [].forEach.call(document.querySelectorAll(".now-tag"), function(e){ e.remove(); });
      [].forEach.call(document.querySelectorAll(".pill"), function(p){
        p.textContent = p.textContent.replace(" · hoy","");
      });
      if(now){
        var card = document.getElementById("s" + now.n);
        if(card){
          card.setAttribute("data-now","1");
          var h = card.querySelector(".wk-head");
          if(h) h.insertAdjacentHTML("beforeend",'<span class="now-tag">Esta semana</span>');
        }
        var pill = document.querySelector('.pill[href="#s' + now.n + '"]');
        if(pill){ pill.setAttribute("data-now","1"); pill.textContent = now.n + " · hoy"; }
        var row = document.querySelector('.row[data-wk="' + now.n + '"]');
        if(row) row.setAttribute("data-now","1");
      }
    }
  }catch(e){}

  /* 2. Abrir / cerrar todos los trabajos. */
  var btn = document.getElementById("btn-open");
  if(btn){
    btn.hidden = false;
    btn.addEventListener("click", function(){
      var open = btn.getAttribute("aria-pressed") !== "true";
      btn.setAttribute("aria-pressed", String(open));
      btn.textContent = open ? "Cerrar todos los trabajos" : "Abrir todos los trabajos";
      [].forEach.call(document.querySelectorAll("#weeks details.work"), function(d){ d.open = open; });
    });
  }

  /* 3. "Hacer hoy": dispara el workflow que lo sube a Garmin Connect y lo agenda para hoy. */
  var API = "https://api.github.com/repos/NicolasFerencz/plan-cruce-andes-2026/actions/workflows/garmin.yml";
  var KEY = "gh-token";
  function token(force){
    var t = null;
    try{ t = localStorage.getItem(KEY); }catch(e){}
    if(!t || force){
      t = prompt("Pegá el token de GitHub (se guarda sólo en este celular):", "");
      if(t){ t = t.trim(); try{ localStorage.setItem(KEY, t); }catch(e){} }
    }
    return t;
  }
  function gh(path, opts){
    opts = opts || {};
    opts.headers = { "Authorization": "Bearer " + token(), "Accept": "application/vnd.github+json" };
    return fetch(API + path, opts);
  }
  function estado(b, st, txt){ if(st) b.setAttribute("data-st", st); else b.removeAttribute("data-st"); b.textContent = txt; }
  function seguir(b, desde, intentos){
    if(intentos <= 0) return estado(b, "err", "⌚ Sin respuesta");
    setTimeout(function(){
      gh("/runs?event=workflow_dispatch&per_page=5&created=" + encodeURIComponent(">=" + desde)).then(function(r){ return r.json(); })
        .then(function(j){
          var run = (j.workflow_runs || []).filter(function(x){ return x.display_title.indexOf(b.dataset.wo) >= 0; })[0];
          if(!run || run.status !== "completed") return seguir(b, desde, intentos - 1);
          if(run.conclusion === "success") estado(b, "ok", "✓ En Garmin");
          else { estado(b, "err", "✕ Falló"); b.title = run.html_url; }
        }).catch(function(){ seguir(b, desde, intentos - 1); });
    }, 5000);
  }
  [].forEach.call(document.querySelectorAll("button.hoy"), function(b){
    b.hidden = false;
    b.addEventListener("click", function(){
      if(b.getAttribute("data-st") === "run") return;
      if(!token()) return;
      var d = new Date(), hoy = new Date(d.getTime() - d.getTimezoneOffset()*6e4).toISOString().slice(0,10);
      var desde = new Date(Date.now() - 60e3).toISOString().slice(0,19) + "Z";
      estado(b, "run", "⌚ Enviando…");
      gh("/dispatches", { method:"POST", body: JSON.stringify({ ref:"main", inputs:{ trabajo:b.dataset.wo, fecha:hoy } }) })
        .then(function(r){
          if(r.status === 204) return seguir(b, desde, 36);
          if(r.status === 401 || r.status === 403) token(true);
          estado(b, "err", "✕ Error " + r.status);
        })
        .catch(function(){ estado(b, "err", "✕ Sin conexión"); });
    });
  });

  /* 4. Tooltip del gráfico (sólo con mouse; en el celu mandan las etiquetas). */
  var tip = document.getElementById("tip"), ch = document.getElementById("chart");
  if(tip && ch){
    ch.addEventListener("pointerover", function(e){
      var s = e.target.closest && e.target.closest(".seg-bar"); if(!s) return;
      tip.innerHTML = "<b>" + s.getAttribute("data-w") + "</b>" + s.getAttribute("data-tip");
      tip.style.opacity = 1;
    });
    ch.addEventListener("pointermove", function(e){
      tip.style.left = Math.min(e.clientX + 12, window.innerWidth - tip.offsetWidth - 10) + "px";
      tip.style.top  = (e.clientY - tip.offsetHeight - 12) + "px";
    });
    ch.addEventListener("pointerout", function(e){
      if(e.target.closest && e.target.closest(".seg-bar")) tip.style.opacity = 0;
    });
  }
})();
</script>`;

/* ---- un .FIT por trabajo, más un zip con todos; y el mismo trabajo en JSON de Garmin Connect ---- */
for (const d of ["fit", "garmin"]) {
  fs.rmSync(DIR + d, { recursive:true, force:true });
  fs.mkdirSync(DIR + d);
}
const all = [];
for (const w of WEEKS) w.s.forEach((s, i) => {
  const work = s.ref ? LIB[s.ref[0]].items[s.ref[1]] : s.cont ? CONT[s.cont] : null;
  if (!work) return;
  const base = `semana-${String(w.n).padStart(2,"0")}-sesion-${i+1}`, file = base + ".fit";
  const { bytes, steps } = encodeWorkout(`S${w.n} · ${s.tag}`, work.wo);
  if (steps > 50) console.warn(`ojo: ${file} tiene ${steps} pasos (algunos relojes cortan en 50)`);
  fs.writeFileSync(DIR + "fit/" + file, bytes);
  fs.writeFileSync(DIR + "garmin/" + base + ".json",
                   JSON.stringify(garminWorkout(`S${w.n} · ${s.tag}`, work.wo), null, 1));
  all.push({ name: file, bytes });
});
fs.writeFileSync(DIR + "fit/plan-cruce-garmin.zip", zip(all));
console.log("fit —", all.length, "entrenamientos");

fs.writeFileSync(DIR + "plan-cruce.html", out + "\n" + runtime + "\n");
console.log("ok —", (out.length/1024|0) + "KB de HTML estático");
