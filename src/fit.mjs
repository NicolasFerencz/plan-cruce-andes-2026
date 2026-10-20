/* Convierte los esquemas de la página (S/R/B/P/N) en archivos de entrenamiento .FIT
   que los relojes Garmin cargan como "workouts" estructurados. */

/* ------------------------------------------------------------- esquema → pasos */
const INT = { active:0, warmup:2, cooldown:3, recovery:4 };
const strip = s => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

function parseDur(d){
  const m = /^~?\s*(\d+(?:[.,]\d+)?)\s*(seg|min|mts)\b/i.exec(d || "");
  if(!m) return null;
  const v = parseFloat(m[1].replace(",", "."));
  const u = m[2].toLowerCase();
  if(u === "mts") return { type:1, value:Math.round(v * 100) };          // distancia, cm
  return { type:0, value:Math.round(v * (u === "min" ? 60000 : 1000)) }; // tiempo, ms
}
const OPEN = { type:5, value:0 };                                         // hasta tocar LAP

function gapFrom(text){
  const t = strip(text);
  if(!/entre/i.test(t)) return null;
  const dur = parseDur((/(\d+(?:[.,]\d+)?\s*(?:min|seg))/i.exec(t) || [])[1]);
  if(!dur) return null;
  return { name: /caminando/i.test(t) ? "Caminar" : "Trote suave", dur, int:INT.recovery, notes:t };
}

function stepFromS(n, blocks){
  const label = strip(n.l);
  if(n.d === "="){
    const ref = /bloque (\d+)/i.exec(label);
    if(ref && blocks["Bloque " + ref[1]]) return structuredClone(blocks["Bloque " + ref[1]]);
  }
  const dur = parseDur(n.d);
  const int = n.i === "easy" || n.i === "rec" ? INT.recovery : INT.active;
  const pre = !dur && n.d && n.d !== "=" ? n.d + " " : "";
  return [{ name: pre + label, dur: dur || OPEN, int, notes: pre + label }];
}

function convert(nodes, blocks = {}){
  const out = [];
  let pending = [];                                   // bloques a separar por una pausa
  const flush = gap => {
    pending.forEach((b, i) => { out.push(...b); if(gap && i < pending.length - 1) out.push({ ...gap }); });
    pending = [];
  };
  for(const n of nodes){
    if(n.t === "b"){
      const steps = convert(n.items, blocks);
      if(/^Bloque \d+$/.test(n.nm)) blocks[n.nm] = steps;
      pending.push(steps);
      continue;
    }
    if(n.t === "n"){
      const gap = gapFrom(n.x);
      if(gap){ flush(gap); continue; }
      flush(null);
      continue;
    }
    flush(null);
    if(n.t === "s") out.push(...stepFromS(n, blocks));
    else if(n.t === "p"){
      const dur = parseDur(strip(n.x)) || OPEN;
      out.push({ name: n.p === "EC" ? "Entrada en calor" : "Vuelta a la calma", dur,
                 int: n.p === "EC" ? INT.warmup : INT.cooldown, notes: strip(n.x) });
    }
    else if(n.t === "r"){
      const inner = convert(n.items, blocks);
      const gap = n.note ? gapFrom(n.note) : null;
      if(gap) inner.push(gap);
      if(n.reps <= 1) out.push(...inner);
      else if(inner.some(s => s.reps)){                       // repetición anidada: se desenrolla
        for(let k = 0; k < n.reps; k++) out.push(...structuredClone(inner));
      }
      else out.push({ reps: n.reps, steps: inner });
    }
  }
  flush(null);
  return out;
}

/* ------------------------------------------------------------------ codificador */
const CRC_T = [0x0000,0xCC01,0xD801,0x1400,0xF001,0x3C00,0x2800,0xE401,
               0xA001,0x6C00,0x7800,0xB401,0x5000,0x9C01,0x8801,0x4400];
function crc16(bytes, crc = 0){
  for(const b of bytes){
    let t = CRC_T[crc & 0xF]; crc = (crc >> 4) & 0x0FFF; crc ^= t ^ CRC_T[b & 0xF];
    t = CRC_T[crc & 0xF];     crc = (crc >> 4) & 0x0FFF; crc ^= t ^ CRC_T[(b >> 4) & 0xF];
  }
  return crc;
}

/* string de largo fijo, cortado sin partir caracteres UTF-8, terminado en 0 */
function fixedStr(s, size){
  const enc = new TextEncoder(), out = new Uint8Array(size);
  let bytes = enc.encode(s);
  if(bytes.length > size - 1){
    let cut = s;
    while(enc.encode(cut).length > size - 1) cut = cut.slice(0, -1);
    bytes = enc.encode(cut);
  }
  out.set(bytes);
  return out;
}

const BT = { enum:0x00, uint16:0x84, uint32:0x86, uint32z:0x8C, string:0x07 };
const NAME_LEN = 32, NOTES_LEN = 128, WKT_LEN = 40;

class Writer {
  constructor(){ this.parts = []; }
  bytes(a){ this.parts.push(Uint8Array.from(a)); }
  raw(u8){ this.parts.push(u8); }
  u16(v){ this.bytes([v & 0xFF, (v >> 8) & 0xFF]); }
  u32(v){ this.bytes([v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF]); }
  define(local, global, fields){
    this.bytes([0x40 | local, 0, 0]); this.u16(global); this.bytes([fields.length]);
    for(const [num, size, bt] of fields) this.bytes([num, size, bt]);
  }
  concat(){
    const n = this.parts.reduce((a, p) => a + p.length, 0), out = new Uint8Array(n);
    let o = 0; for(const p of this.parts){ out.set(p, o); o += p.length; }
    return out;
  }
}

export function encodeWorkout(name, nodes){
  /* aplana a la lista de pasos FIT: las repeticiones apuntan al índice de su primer paso */
  const flat = [];
  for(const s of convert(nodes)){
    if(s.reps){
      const first = flat.length;
      flat.push(...s.steps);
      flat.push({ repeatFrom: first, reps: s.reps });
    } else flat.push(s);
  }

  const w = new Writer();
  const FIT_EPOCH = Date.UTC(1989, 11, 31) / 1000;

  w.define(0, 0, [[0,1,BT.enum],[1,2,BT.uint16],[2,2,BT.uint16],[3,4,BT.uint32z],[4,4,BT.uint32]]);
  w.bytes([0, 5]); w.u16(255); w.u16(0); w.u32(1);
  w.u32(Math.floor(Date.now() / 1000 - FIT_EPOCH));

  w.define(1, 26, [[4,1,BT.enum],[6,2,BT.uint16],[8,WKT_LEN,BT.string]]);
  w.bytes([1, 1]); w.u16(flat.length); w.raw(fixedStr(name, WKT_LEN));

  w.define(2, 27, [[254,2,BT.uint16],[0,NAME_LEN,BT.string],[1,1,BT.enum],[2,4,BT.uint32],
                   [3,1,BT.enum],[4,4,BT.uint32],[7,1,BT.enum],[8,NOTES_LEN,BT.string]]);
  flat.forEach((s, i) => {
    w.bytes([2]); w.u16(i);
    if(s.reps){
      w.raw(fixedStr("", NAME_LEN)); w.bytes([6]); w.u32(s.repeatFrom);
      w.bytes([2]); w.u32(s.reps); w.bytes([INT.active]); w.raw(fixedStr("", NOTES_LEN));
    } else {
      w.raw(fixedStr(s.name, NAME_LEN)); w.bytes([s.dur.type]); w.u32(s.dur.value);
      w.bytes([2]); w.u32(0); w.bytes([s.int]); w.raw(fixedStr(s.notes || "", NOTES_LEN));
    }
  });

  const data = w.concat();
  const head = new Writer();
  head.bytes([14, 0x10]); head.u16(2132); head.u32(data.length); head.raw(new TextEncoder().encode(".FIT"));
  const h = head.concat();
  const hdr = new Uint8Array(14); hdr.set(h);
  const hc = crc16(h); hdr[12] = hc & 0xFF; hdr[13] = hc >> 8;
  const body = new Uint8Array(14 + data.length + 2);
  body.set(hdr); body.set(data, 14);
  const c = crc16(body.subarray(0, 14 + data.length));
  body[14 + data.length] = c & 0xFF; body[15 + data.length] = c >> 8;
  return { bytes: body, steps: flat.length };
}

/* ------------------------------------------------- JSON para Garmin Connect */
/* Mismos pasos que el .FIT, en el formato de workout-service (lo que sube el
   botón "Hacer hoy" vía GitHub Actions). Tiempo en segundos, distancia en metros. */
const GC_STEP = {
  [INT.warmup]:   { stepTypeId:1, stepTypeKey:"warmup",   displayOrder:1 },
  [INT.cooldown]: { stepTypeId:2, stepTypeKey:"cooldown", displayOrder:2 },
  [INT.active]:   { stepTypeId:3, stepTypeKey:"interval", displayOrder:3 },
  [INT.recovery]: { stepTypeId:4, stepTypeKey:"recovery", displayOrder:4 },
};
const GC_END = {
  0: { conditionTypeId:2, conditionTypeKey:"time",       displayOrder:2, displayable:true },
  1: { conditionTypeId:3, conditionTypeKey:"distance",   displayOrder:3, displayable:true },
  5: { conditionTypeId:1, conditionTypeKey:"lap.button", displayOrder:1, displayable:true },
};
const NO_TARGET = { workoutTargetTypeId:1, workoutTargetTypeKey:"no.target", displayOrder:1 };

export function garminWorkout(name, nodes){
  let order = 0, secs = 0;
  const steps = (list, mult = 1) => list.map(s => {
    if(s.reps){
      const g = { type:"RepeatGroupDTO", stepOrder:++order,
        stepType:{ stepTypeId:6, stepTypeKey:"repeat", displayOrder:6 },
        numberOfIterations:s.reps, smartRepeat:false,
        endCondition:{ conditionTypeId:7, conditionTypeKey:"iterations", displayOrder:7, displayable:false },
        endConditionValue:s.reps };
      g.workoutSteps = steps(s.steps, mult * s.reps);
      return g;
    }
    const value = s.dur.type === 0 ? s.dur.value / 1000 : s.dur.type === 1 ? s.dur.value / 100 : null;
    if(s.dur.type === 0) secs += value * mult;
    return { type:"ExecutableStepDTO", stepOrder:++order, stepType:GC_STEP[s.int],
             endCondition:GC_END[s.dur.type], endConditionValue:value,
             ...(s.dur.type === 1 && { preferredEndConditionUnit:{ unitKey:"meter" } }),
             targetType:NO_TARGET, description:(s.notes || s.name).slice(0, 512) };
  });
  const running = { sportTypeId:1, sportTypeKey:"running", displayOrder:1 };
  const workoutSteps = steps(convert(nodes));
  return { workoutName:name, description:"Plan Cruce de los Andes 2026", sportType:running,
           estimatedDurationInSecs:Math.round(secs),
           workoutSegments:[{ segmentOrder:1, sportType:running, workoutSteps }] };
}

/* ------------------------------------------------------------ zip sin compresión */
const CRC32 = (() => { const t = new Uint32Array(256);
  for(let n = 0; n < 256; n++){ let c = n; for(let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return b => { let c = 0xFFFFFFFF; for(const x of b) c = t[(c ^ x) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
})();

export function zip(files){                      // files: [{name, bytes}]
  const local = new Writer(), central = new Writer();
  let offset = 0;
  for(const f of files){
    const name = new TextEncoder().encode(f.name), crc = CRC32(f.bytes), n = f.bytes.length;
    const hdr = new Writer();
    hdr.u32(0x04034b50); hdr.u16(20); hdr.u16(0x0800); hdr.u16(0); hdr.u16(0); hdr.u16(0x21);
    hdr.u32(crc); hdr.u32(n); hdr.u32(n); hdr.u16(name.length); hdr.u16(0); hdr.raw(name);
    const h = hdr.concat();
    local.raw(h); local.raw(f.bytes);
    central.u32(0x02014b50); central.u16(20); central.u16(20); central.u16(0x0800); central.u16(0);
    central.u16(0); central.u16(0x21); central.u32(crc); central.u32(n); central.u32(n);
    central.u16(name.length); central.u16(0); central.u16(0); central.u16(0); central.u16(0);
    central.u32(0); central.u32(offset); central.raw(name);
    offset += h.length + n;
  }
  const cd = central.concat(), end = new Writer();
  end.u32(0x06054b50); end.u16(0); end.u16(0); end.u16(files.length); end.u16(files.length);
  end.u32(cd.length); end.u32(offset); end.u16(0);
  const w = new Writer(); w.raw(local.concat()); w.raw(cd); w.raw(end.concat());
  return w.concat();
}
