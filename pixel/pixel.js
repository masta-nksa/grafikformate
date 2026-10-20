// Pixel-Labor – Rastergrafiken aus Bits.
// Dateiformat wie beim Pixelation-Widget von code.org:
//   Breite (1 Byte) | Höhe (1 Byte) | Farbtiefe (1 Byte) | Breite × Höhe × Farbtiefe Bits Pixeldaten
'use strict';
(() => {
  const MAX_DIM = 255;
  const MAX_BPP = 24;
  const MAP_LIMIT = 1024; // max. Pixel für die Zuordnungsansicht
  const SWATCH_LIMIT = 64;
  const DEFAULT_TOL = 48; // max. Abweichung pro Farbkanal beim Vergleich mit dem Zielbild
  const STORE_KEY = 'pixel-labor-v1';
  const START_PRESET = 'folie-4x3';

  const $ = (id) => document.getElementById(id);
  const el = {
    preset: $('preset'), task: $('task'), taskTitle: $('task-title'), taskBody: $('task-body'),
    targetWrap: $('task-target-wrap'), target: $('target-canvas'), taskCheck: $('task-check'),
    inW: $('in-w'), inH: $('in-h'), inB: $('in-b'), rngB: $('rng-b'),
    byteW: $('byte-w'), byteH: $('byte-h'), byteB: $('byte-b'),
    model: $('sel-model'), modelInfo: $('model-info'), chkHeader: $('chk-header'),
    segView: $('seg-view'), segTool: $('seg-tool'),
    bits: $('bits'), status: $('bits-status'),
    cardMap: $('card-map'), map: $('bitmap'),
    wrap: $('canvas-wrap'), canvas: $('canvas'), cover: $('cover'), info: $('hover-info'),
    chkGrid: $('chk-grid'), chkLabels: $('chk-labels'),
    drawPanel: $('draw-panel'), drawColor: $('draw-color'), drawQuant: $('draw-quant'),
    drawBits: $('draw-bits'), swatches: $('swatches'),
    cardPalette: $('card-palette'), palette: $('palette'),
    cardAnalysis: $('card-analysis'), analysis: $('analysis'),
    dlgHelp: $('dlg-help'), dlgText: $('dlg-text'), dlgShare: $('dlg-share'),
    textIn: $('text-in'), textTable: $('text-table'),
    shReveal: $('sh-reveal'), shTaskBox: $('sh-task-box'), shTitle: $('sh-title'), shText: $('sh-text'),
    shTarget: $('sh-target'), shEmpty: $('sh-empty'), shUrl: $('sh-url'), shCopy: $('sh-copy'),
    shOpen: $('sh-open'), shNote: $('sh-note'),
  };

  // ---------- Hilfsfunktionen ----------
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const bin = (n, len) => n.toString(2).padStart(len, '0');
  const hex2 = (n) => n.toString(16).padStart(2, '0');
  const rgbHex = (c) => '#' + c.map(hex2).join('');
  const hexRgb = (h) => {
    const s = String(h).replace('#', '');
    return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16) || 0);
  };
  const fmt = (n) => n.toLocaleString('de-CH');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const luminance = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  const SEPARATORS = /[\s,;|_#]/;

  function defaultPalette() {
    const base = ['000000', 'ffffff', 'ff0000', '008000', '0000ff', 'ffff00', '00ffff', 'ff00ff',
      '808080', 'c0c0c0', '800000', '00ff00', '000080', '808000', '008080', '800080'];
    const out = base.map((c) => '#' + c);
    const lv = [0, 51, 102, 153, 204, 255];
    for (const r of lv) for (const g of lv) for (const b of lv) out.push(rgbHex([r, g, b]));
    for (let i = 0; i < 24; i++) out.push(rgbHex([8 + i * 10, 8 + i * 10, 8 + i * 10]));
    return out;
  }

  // ---------- Zustand ----------
  const state = {
    w: 4, h: 3, bpp: 3, model: 'auto', bits: '', hdr: true, view: 'bin',
    palette: defaultPalette(), grid: true, labels: false, tool: 'inspect',
    drawColor: '#ff0000', task: null, lock: new Set(), hidden: false,
    bad: new Set(), hover: -1,
  };
  let px = []; // decodierte Farben pro Pixel ([r,g,b] oder null)

  const locked = (k) => state.lock.has(k);
  const valid = () => state.w >= 1 && state.h >= 1 && state.bpp >= 1 && state.bpp <= MAX_BPP;
  const needBits = () => state.w * state.h * state.bpp;

  // ---------- Farbmodell ----------
  function model() {
    if (state.model === 'auto') return state.bpp < 3 ? 'gray' : 'rgb';
    if (state.model === 'palette' && state.bpp > 8) return 'rgb';
    return state.model;
  }

  // Verteilt die Bits auf R, G, B. Ein Rest geht zuerst an Grün, dann an Rot (wie RGB565).
  function split(b) {
    const base = Math.floor(b / 3), rem = b % 3;
    return [base + (rem === 2 ? 1 : 0), base + (rem >= 1 ? 1 : 0), base];
  }

  const scale = (v, n) => (n === 0 ? 0 : Math.round(v * 255 / (2 ** n - 1)));

  function channels(bits) {
    const [nr, ng] = split(bits.length);
    return [bits.slice(0, nr), bits.slice(nr, nr + ng), bits.slice(nr + ng)];
  }

  function decode(bits) {
    const m = model();
    if (m === 'gray') {
      const g = scale(parseInt(bits, 2), bits.length);
      return [g, g, g];
    }
    if (m === 'palette') return hexRgb(state.palette[parseInt(bits, 2)] || '#000000');
    return channels(bits).map((c) => (c ? scale(parseInt(c, 2), c.length) : 0));
  }

  function encode(rgb) {
    const m = model(), b = state.bpp;
    if (m === 'gray') return bin(Math.round(luminance(rgb) / 255 * (2 ** b - 1)), b);
    if (m === 'palette') {
      let best = 0, bestD = Infinity;
      for (let i = 0; i < 2 ** b; i++) {
        const c = hexRgb(state.palette[i]);
        const d = (c[0] - rgb[0]) ** 2 + (c[1] - rgb[1]) ** 2 + (c[2] - rgb[2]) ** 2;
        if (d < bestD) { bestD = d; best = i; }
      }
      return bin(best, b);
    }
    return split(b).map((n, i) => (n ? bin(Math.round(rgb[i] / 255 * (2 ** n - 1)), n) : '')).join('');
  }

  function decodeAll() {
    if (!valid()) return [];
    const n = state.w * state.h, b = state.bpp, out = new Array(n), cache = new Map();
    for (let i = 0; i < n; i++) {
      const s = i * b;
      if (s + b > state.bits.length) { out[i] = null; continue; }
      const p = state.bits.substr(s, b);
      let c = cache.get(p);
      if (!c) { c = decode(p); cache.set(p, c); }
      out[i] = c;
    }
    return out;
  }

  const pixelBits = (i) => {
    const s = i * state.bpp;
    return s + state.bpp <= state.bits.length ? state.bits.substr(s, state.bpp) : null;
  };

  // ---------- Text <-> Bits ----------
  function toHex(bits) {
    const pad = (4 - (bits.length % 4)) % 4, p = bits + '0'.repeat(pad);
    let s = '';
    for (let i = 0; i < p.length; i += 4) s += parseInt(p.substr(i, 4), 2).toString(16).toUpperCase();
    return s;
  }

  const headerBits = () => bin(clamp(state.w, 0, 255), 8) + bin(clamp(state.h, 0, 255), 8) + bin(clamp(state.bpp, 0, 255), 8);

  function groupChars(s, size, perLine) {
    const lines = [];
    let line = [];
    for (let i = 0; i < s.length; i += size) {
      line.push(s.slice(i, i + size));
      if (line.length === perLine) { lines.push(line.join(' ')); line = []; }
    }
    if (line.length) lines.push(line.join(' '));
    return lines;
  }

  function formatText() {
    const lines = [], perRow = state.w >= 1 ? state.w : 8, b = Math.max(1, state.bpp);
    if (state.view === 'bin') {
      if (state.hdr) lines.push(groupChars(headerBits(), 8, 3)[0]);
      lines.push(...groupChars(state.bits, b, perRow));
    } else {
      if (state.hdr) lines.push(groupChars(toHex(headerBits()), 2, 3)[0]);
      const hex = toHex(state.bits);
      lines.push(...(b % 4 === 0 ? groupChars(hex, b / 4, perRow) : groupChars(hex, 2, 16)));
    }
    return lines.join('\n');
  }

  function parseText(raw) {
    const isHex = state.view === 'hex', bad = new Set(), parts = [];
    for (const ch of raw) {
      if (SEPARATORS.test(ch)) continue;
      if (isHex) {
        const v = parseInt(ch, 16);
        if (Number.isNaN(v)) bad.add(ch); else parts.push(bin(v, 4));
      } else if (ch === '0' || ch === '1') parts.push(ch);
      else bad.add(ch);
    }
    return { bits: parts.join(''), bad };
  }

  function writeText() {
    el.bits.value = formatText();
    state.bad = new Set();
  }

  function onTextInput() {
    const { bits, bad } = parseText(el.bits.value);
    let data = bits;
    if (state.hdr) {
      if (bits.length >= 8) state.w = parseInt(bits.slice(0, 8), 2);
      if (bits.length >= 16) state.h = parseInt(bits.slice(8, 16), 2);
      if (bits.length >= 24) state.bpp = parseInt(bits.slice(16, 24), 2);
      data = bits.slice(24);
    }
    state.bits = data;
    state.bad = bad;
    syncControls();
    refresh();
  }

  // ---------- Bedienelemente ----------
  const dimInputs = { w: el.inW, h: el.inH, bpp: el.inB };

  function setDim(key, value, fromTyping) {
    const max = key === 'bpp' ? MAX_BPP : MAX_DIM;
    const v = parseInt(value, 10);
    if (fromTyping && !(v >= 1 && v <= max)) return; // Zwischenzustand beim Tippen
    const nv = clamp(Number.isNaN(v) ? 1 : v, 1, max);
    if (state[key] !== nv) {
      state[key] = nv;
      writeText();
      refresh();
    }
    syncControls(fromTyping ? dimInputs[key] : null);
  }

  // skip: Eingabefeld, in dem gerade getippt wird (nicht überschreiben)
  function syncControls(skip) {
    for (const [k, input] of Object.entries(dimInputs)) {
      if (input !== skip) input.value = state[k];
    }
    el.rngB.value = clamp(state.bpp, 1, MAX_BPP);
    el.byteW.textContent = bin(clamp(state.w, 0, 255), 8);
    el.byteH.textContent = bin(clamp(state.h, 0, 255), 8);
    el.byteB.textContent = bin(clamp(state.bpp, 0, 255), 8);
    el.byteW.classList.toggle('bad', state.w < 1);
    el.byteH.classList.toggle('bad', state.h < 1);
    el.byteB.classList.toggle('bad', state.bpp < 1 || state.bpp > MAX_BPP);
    el.model.value = state.model;
    el.chkHeader.checked = state.hdr;
    el.chkGrid.checked = state.grid;
    el.chkLabels.checked = state.labels;
    for (const btn of el.segView.children) btn.setAttribute('aria-checked', btn.dataset.view === state.view);
    for (const btn of el.segTool.children) btn.setAttribute('aria-checked', btn.dataset.tool === state.tool);
    el.canvas.classList.toggle('draw', state.tool === 'draw');
    renderModelInfo();
  }

  function renderModelInfo() {
    const b = state.bpp, m = model();
    if (!valid()) { el.modelInfo.textContent = ''; return; }
    let html = state.model === 'auto' ? 'Automatisch → ' : '';
    if (state.model === 'palette' && b > 8) html = 'Eine Farbpalette ist nur bis 8 Bit sinnvoll – es wird RGB verwendet. ';
    if (m === 'gray') {
      html += `Graustufen: ${fmt(2 ** b)} Helligkeitsstufen (0 = schwarz, ${fmt(2 ** b - 1)} = weiss).`;
    } else if (m === 'palette') {
      html += `Farbpalette: Jedes Pixel speichert eine Nummer von 0 bis ${2 ** b - 1}, die Farbe steht in der Farbtabelle.`;
    } else {
      const [r, g, bl] = split(b);
      const pat = `<code><span style="color:#d22">${'R'.repeat(r)}</span><span style="color:#1a1">${'G'.repeat(g)}</span><span style="color:#36f">${'B'.repeat(bl)}</span></code>`;
      html += `RGB ${pat}: Rot ${r} Bit · Grün ${g} Bit · Blau ${bl} Bit → ${fmt(2 ** b)} Farben.`;
      if (b < 3) html += ' Bei weniger als 3 Bit fehlen Farbkanäle.';
    }
    el.modelInfo.innerHTML = html;
  }

  function applyLocks() {
    const size = locked('size'), bpp = locked('bpp');
    for (const s of document.querySelectorAll('.stepper')) {
      const off = s.dataset.for === 'in-b' ? bpp : size;
      for (const c of s.children) c.disabled = off;
    }
    el.rngB.disabled = bpp;
    el.model.disabled = locked('model');
    el.chkHeader.disabled = locked('header');
    for (const btn of el.segView.children) btn.disabled = locked('view');
    el.segTool.hidden = locked('draw');
    if (locked('draw')) state.tool = 'inspect';
    el.cardMap.hidden = locked('map');
    el.cardAnalysis.hidden = locked('analysis');
  }

  // ---------- Bild zeichnen ----------
  const ctx = el.canvas.getContext('2d');
  const scene = document.createElement('canvas');
  let cell = 1, dpr = 1, labelsSkipped = false;
  let hatch = null, hatchDpr = 0;

  function hatchPattern(c) {
    if (hatch && hatchDpr === dpr) return hatch;
    const t = document.createElement('canvas'), s = Math.round(8 * dpr);
    t.width = t.height = s;
    const x = t.getContext('2d');
    x.fillStyle = '#e4e6ea'; x.fillRect(0, 0, s, s);
    x.strokeStyle = '#a3a9b3'; x.lineWidth = Math.max(1, dpr);
    x.beginPath(); x.moveTo(0, s); x.lineTo(s, 0); x.stroke();
    hatch = c.createPattern(t, 'repeat'); hatchDpr = dpr;
    return hatch;
  }

  function drawScene() {
    if (!valid()) {
      el.canvas.width = el.canvas.height = 0;
      el.canvas.style.width = el.canvas.style.height = '0px';
      return;
    }
    const { w, h } = state;
    const avail = Math.max(50, el.wrap.clientWidth - 16);
    const maxH = Math.max(220, Math.min(window.innerHeight * 0.62, 640));
    cell = clamp(Math.floor(Math.min(avail / w, maxH / h)), 1, 72);
    dpr = window.devicePixelRatio || 1;
    const cs = cell * dpr, W = Math.round(w * cs), H = Math.round(h * cs);
    scene.width = W; scene.height = H;
    const c = scene.getContext('2d');
    const xs = Array.from({ length: w + 1 }, (_, i) => Math.round(i * cs));
    const ys = Array.from({ length: h + 1 }, (_, i) => Math.round(i * cs));

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const col = px[y * w + x];
        c.fillStyle = col ? rgbHex(col) : hatchPattern(c);
        c.fillRect(xs[x], ys[y], xs[x + 1] - xs[x], ys[y + 1] - ys[y]);
      }
    }

    if (state.grid && cell >= 6) {
      c.fillStyle = 'rgba(128,128,128,0.55)';
      const lw = Math.max(1, Math.round(dpr));
      for (const x of xs) c.fillRect(Math.min(x, W - lw), 0, lw, H);
      for (const y of ys) c.fillRect(0, Math.min(y, H - lw), W, lw);
    }

    labelsSkipped = false;
    if (state.labels) {
      const useHex = state.view === 'hex' && state.bpp % 4 === 0;
      const fs = clamp(cell * 0.3, 8, 15) * dpr;
      c.font = `${fs}px ui-monospace, Consolas, monospace`;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      const sample = useHex ? 'F'.repeat(state.bpp / 4) : '0'.repeat(state.bpp);
      if (c.measureText(sample).width > cs - 4 * dpr || fs > cs * 0.8) {
        labelsSkipped = true;
      } else {
        for (let i = 0; i < w * h; i++) {
          const bits = pixelBits(i);
          if (!bits) continue;
          const x = i % w, y = Math.floor(i / w);
          c.fillStyle = luminance(px[i]) > 140 ? '#000' : '#fff';
          c.fillText(useHex ? toHex(bits) : bits, (xs[x] + xs[x + 1]) / 2, (ys[y] + ys[y + 1]) / 2);
        }
      }
    }

    el.canvas.width = W; el.canvas.height = H;
    el.canvas.style.width = (W / dpr) + 'px';
    el.canvas.style.height = (H / dpr) + 'px';
    paint();
  }

  function paint() {
    if (!el.canvas.width) return;
    ctx.clearRect(0, 0, el.canvas.width, el.canvas.height);
    ctx.drawImage(scene, 0, 0);
    const i = state.hover;
    if (i >= 0 && i < state.w * state.h) {
      const cs = cell * dpr, x = Math.round((i % state.w) * cs), y = Math.round(Math.floor(i / state.w) * cs);
      const s = Math.round(cs);
      ctx.lineWidth = Math.max(2, 3 * dpr); ctx.strokeStyle = '#fff';
      ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);
      ctx.lineWidth = Math.max(1, 1.5 * dpr); ctx.strokeStyle = '#000';
      ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);
    }
  }

  function hitIndex(e) {
    const r = el.canvas.getBoundingClientRect();
    if (!r.width || !r.height) return -1;
    const x = Math.floor((e.clientX - r.left) / r.width * state.w);
    const y = Math.floor((e.clientY - r.top) / r.height * state.h);
    if (x < 0 || y < 0 || x >= state.w || y >= state.h) return -1;
    return y * state.w + x;
  }

  function setHover(i) {
    if (state.hidden) i = -1;
    if (state.hover === i) return;
    if (mapChips[state.hover]) mapChips[state.hover].classList.remove('hl');
    state.hover = i;
    if (mapChips[i]) mapChips[i].classList.add('hl');
    paint();
    renderInfo();
  }

  function renderInfo() {
    const i = state.hover;
    if (state.hidden) { el.info.textContent = ''; return; }
    if (i < 0 || !valid()) {
      let t = state.tool === 'draw'
        ? 'Klicken oder ziehen Sie, um Pixel einzufärben. Die Bits ändern sich mit.'
        : 'Fahren Sie über ein Pixel, um seine Bits und Farbwerte zu sehen.';
      if (labelsSkipped) t += ' (Für «Bits im Pixel» sind die Pixel zu klein.)';
      el.info.textContent = t;
      return;
    }
    const x = i % state.w, y = Math.floor(i / state.w), b = state.bpp;
    const where = `<b>Pixel ${i + 1}</b> (Zeile ${y + 1}, Spalte ${x + 1}) · Bit ${fmt(i * b + 1)}–${fmt((i + 1) * b)}`;
    const bits = pixelBits(i);
    if (!bits) { el.info.innerHTML = `${where}: <span class="warn">keine Daten – es fehlen Bits.</span>`; return; }
    const col = px[i], m = model(), max = 2 ** b - 1;
    let detail;
    if (m === 'gray') {
      detail = `Wert ${parseInt(bits, 2)} von ${fmt(max)} → Helligkeit ${col[0]} von 255`;
    } else if (m === 'palette') {
      detail = `Index ${parseInt(bits, 2)} in der Farbtabelle`;
    } else {
      const names = ['R', 'G', 'B'];
      detail = channels(bits).map((c, k) => (c
        ? `${names[k]} <code>${c}</code> = ${parseInt(c, 2)}${c.length !== 8 ? ` → ${col[k]}` : ''}`
        : `${names[k]} –`)).join(' · ');
    }
    const shown = state.view === 'hex' && b % 4 === 0 ? `${bits} = ${toHex(bits)}<sub>16</sub>` : bits;
    el.info.innerHTML = `${where}<br><code>${shown}</code> → ${detail} → <span class="swatch" style="background:${rgbHex(col)}"></span> <code>${rgbHex(col).toUpperCase()}</code>`;
  }

  // ---------- Zeichnen ----------
  let drawing = false, pending = 0;

  function paintPixel(i) {
    if (i < 0 || state.hidden || !valid()) return;
    const b = state.bpp, s = i * b, nb = encode(hexRgb(state.drawColor));
    if (state.bits.substr(s, b) === nb) return;
    let bits = state.bits;
    if (bits.length < s + b) bits = bits.padEnd(s + b, '0');
    state.bits = bits.slice(0, s) + nb + bits.slice(s + b);
    if (!pending) pending = requestAnimationFrame(() => { pending = 0; writeText(); refresh(); });
  }

  function renderDraw() {
    el.drawPanel.hidden = state.tool !== 'draw' || state.hidden;
    if (el.drawPanel.hidden || !valid()) return;
    const bits = encode(hexRgb(state.drawColor)), q = decode(bits);
    el.drawQuant.style.background = rgbHex(q);
    el.drawQuant.title = `Wird gespeichert als ${rgbHex(q).toUpperCase()}`;
    el.drawBits.textContent = bits + (state.view === 'hex' && state.bpp % 4 === 0 ? ` = ${toHex(bits)}` : '');
    const count = 2 ** state.bpp;
    const key = `${model()}|${state.bpp}|${model() === 'palette' ? state.palette.slice(0, count).join() : ''}`;
    if (el.swatches.dataset.key !== key) {
      el.swatches.dataset.key = key;
      el.swatches.textContent = '';
      if (count <= SWATCH_LIMIT) {
        for (let k = 0; k < count; k++) {
          const sb = bin(k, state.bpp), c = rgbHex(decode(sb));
          const btn = document.createElement('button');
          btn.type = 'button'; btn.style.background = c; btn.dataset.color = c; btn.dataset.bits = sb;
          btn.title = `${sb} → ${c.toUpperCase()}`;
          el.swatches.append(btn);
        }
      } else {
        const p = document.createElement('p');
        p.className = 'hint';
        p.textContent = `${fmt(count)} mögliche Farben – wählen Sie eine Farbe, sie wird auf die Farbtiefe gerundet.`;
        el.swatches.append(p);
      }
    }
    for (const btn of el.swatches.querySelectorAll('button')) btn.setAttribute('aria-pressed', btn.dataset.bits === bits);
  }

  // ---------- Farbtabelle ----------
  function renderPalette() {
    const show = model() === 'palette' && !state.hidden;
    el.cardPalette.hidden = !show;
    if (!show) return;
    const count = 2 ** state.bpp;
    if (el.palette.childElementCount !== count) {
      el.palette.textContent = '';
      for (let i = 0; i < count; i++) {
        const lab = document.createElement('label');
        lab.className = 'pal-entry';
        lab.innerHTML = `<input type="color" data-i="${i}"><code>${i} = ${bin(i, state.bpp)}</code>`;
        el.palette.append(lab);
      }
    }
    for (const input of el.palette.querySelectorAll('input')) {
      if (document.activeElement !== input) input.value = state.palette[+input.dataset.i];
    }
  }

  // ---------- Zuordnung Bits -> Pixel ----------
  let mapChips = [];

  function chip(cls, text, color, i) {
    const s = document.createElement('span');
    s.className = 'chip ' + cls;
    if (color) { const d = document.createElement('i'); d.style.background = color; s.append(d); }
    s.append(text);
    if (i !== undefined) s.dataset.i = i;
    return s;
  }

  function line(label, ...chips) {
    const d = document.createElement('div');
    d.className = 'line';
    const l = document.createElement('span');
    l.className = 'lbl'; l.textContent = label;
    const c = document.createElement('div');
    c.className = 'chips';
    c.append(...chips);
    d.append(l, c);
    return d;
  }

  function renderMap() {
    mapChips = [];
    el.map.textContent = '';
    if (state.hidden) { el.map.innerHTML = '<p class="note">Das Bild ist noch verdeckt.</p>'; return; }
    if (!valid()) { el.map.innerHTML = '<p class="note">Mit diesem Header kann kein Bild entstehen.</p>'; return; }
    const n = state.w * state.h, b = state.bpp;
    if (n > MAP_LIMIT) {
      el.map.innerHTML = `<p class="note">Das Bild hat ${fmt(n)} Pixel – zu viele für diese Ansicht (max. ${fmt(MAP_LIMIT)}). Fahren Sie stattdessen über das Bild.</p>`;
      return;
    }
    const useHex = state.view === 'hex' && b % 4 === 0;
    const frag = document.createDocumentFragment();
    if (state.hdr) {
      const hb = headerBits();
      frag.append(line('Header',
        chip('h-w', `${hb.slice(0, 8)} = ${state.w} Breite`),
        chip('h-h', `${hb.slice(8, 16)} = ${state.h} Höhe`),
        chip('h-b', `${hb.slice(16)} = ${state.bpp} Bit`)));
    }
    for (let y = 0; y < state.h; y++) {
      const chips = [];
      for (let x = 0; x < state.w; x++) {
        const i = y * state.w + x, bits = pixelBits(i);
        let c;
        if (bits) c = chip('', useHex ? toHex(bits) : bits, rgbHex(px[i]), i);
        else {
          const part = state.bits.slice(i * b, (i + 1) * b);
          c = chip('extra', part ? part + '…' : '—', null, i);
          c.title = 'Für dieses Pixel fehlen Bits';
        }
        mapChips[i] = c;
        chips.push(c);
      }
      frag.append(line(`Zeile ${y + 1}`, ...chips));
    }
    const extra = state.bits.length - needBits();
    if (extra > 0) {
      const rest = state.bits.slice(needBits());
      const c = chip('extra', rest.length > 48 ? rest.slice(0, 48) + '…' : rest);
      c.title = 'Diese Bits gehören zu keinem Pixel und werden ignoriert';
      frag.append(line(`${extra} Bit zu viel`, c));
    }
    if (state.hover >= 0 && mapChips[state.hover]) mapChips[state.hover].classList.add('hl');
    el.map.append(frag);
  }

  // ---------- Status ----------
  function renderStatus() {
    const out = [];
    if (state.w < 1 || state.h < 1) out.push(['bad', `Breite oder Höhe ist 0 – es kann kein Bild entstehen.`]);
    if (state.bpp < 1 || state.bpp > MAX_BPP) out.push(['bad', `Eine Farbtiefe von ${state.bpp} Bit wird nicht unterstützt (1 bis ${MAX_BPP} Bit).`]);
    if (valid()) {
      const need = needBits(), have = state.bits.length;
      let t = `${fmt(have)} Bit Pixeldaten${state.hdr ? ' (+ 24 Bit Header)' : ''} · benötigt: ${state.w} × ${state.h} × ${state.bpp} = ${fmt(need)} Bit`;
      if (have === need) out.push(['ok', t + ' ✓']);
      else if (have < need) {
        const miss = state.w * state.h - Math.floor(have / state.bpp);
        out.push(['warn', `${t} – es fehlen ${fmt(need - have)} Bit (${fmt(miss)} Pixel ohne Daten).`]);
      } else out.push(['warn', `${t} – ${fmt(have - need)} Bit zu viel (werden ignoriert).`]);
    }
    if (state.bad.size) {
      const chars = [...state.bad].slice(0, 12).map((c) => `«${esc(c)}»`).join(' ');
      const hexHint = state.view === 'bin' && [...state.bad].some((c) => /[2-9a-f]/i.test(c))
        ? ' Für Hex-Ziffern die Ansicht «Hex» wählen.' : '';
      out.push(['bad', `Ungültige Zeichen werden ignoriert: ${chars}.${hexHint}`]);
    }
    if (state.view === 'hex' && state.bits.length % 4) {
      out.push(['warn', `Für die Hex-Darstellung wurden ${4 - (state.bits.length % 4)} Nullbit(s) angehängt.`]);
    }
    el.status.innerHTML = out.map(([c, t]) => `<span class="${c}">${t}</span>`).join('');
  }

  // ---------- Speicherbedarf ----------
  function renderAnalysis() {
    if (state.hidden || !valid()) { el.analysis.innerHTML = '<p class="hint">Keine Angaben möglich.</p>'; return; }
    const n = state.w * state.h, b = state.bpp, raw = n * b;
    let html = `<dl class="facts">
      <dt>Bildgrösse</dt><dd>${state.w} × ${state.h} = ${fmt(n)} Pixel</dd>
      <dt>Farbtiefe</dt><dd>${b} Bit → 2<sup>${b}</sup> = ${fmt(2 ** b)} mögliche Farben</dd>`;
    const complete = px.length === n && px.every(Boolean);
    if (!complete) {
      html += `</dl><p class="hint">Unkomprimiert braucht das Bild ${fmt(raw)} Bit = ${fmt(Math.ceil(raw / 8))} Byte. Für den Vergleich mit Komprimierungsverfahren zuerst alle Pixeldaten eingeben.</p>`;
      el.analysis.innerHTML = html;
      return;
    }
    const hexes = px.map(rgbHex), k = new Set(hexes).size;
    const ib = Math.max(1, Math.ceil(Math.log2(k)));
    const idxBits = n * ib + k * 24;
    const runs = [];
    for (const c of hexes) {
      const last = runs[runs.length - 1];
      if (last && last.c === c && last.n < 255) last.n++; else runs.push({ c, n: 1 });
    }
    const rleBits = runs.length * (8 + b);
    html += `<dt>Verschiedene Farben</dt><dd>${fmt(k)} im Bild</dd></dl>`;
    const rows = [
      ['Unkomprimiert (wie BMP)', `${fmt(n)} Pixel × ${b} Bit`, raw],
      ['Farbtabelle (indiziert, wie GIF)', `${fmt(n)} Pixel × ${ib} Bit Index + Tabelle ${fmt(k)} × 24 Bit`, idxBits],
      ['Gleichfarbige Blöcke (Lauflänge)', `${fmt(runs.length)} Blöcke × (8 Bit Anzahl + ${b} Bit Farbe)`, rleBits],
    ];
    const max = Math.max(...rows.map((r) => r[2]));
    html += '<table class="an-table"><tr><th>Speicherart</th><th>Bit</th><th>Byte</th></tr>';
    for (const [name, how, bits] of rows) {
      const pct = bits === raw ? '' : ` · ${bits < raw ? '−' : '+'}${Math.abs(Math.round((bits - raw) / raw * 100))} %`;
      html += `<tr><td>${name}<br><small class="hint">${how}${pct}</small><div class="bar" style="width:${(bits / max * 100).toFixed(1)}%"></div></td>
        <td class="num">${fmt(bits)}</td><td class="num">${fmt(Math.ceil(bits / 8))}</td></tr>`;
    }
    html += '</table><p class="hint">Jeweils ohne Header. Die Verfahren sind vereinfacht – echte Formate kombinieren mehrere Tricks.</p>';
    if (runs.length <= 60) {
      html += '<div class="mini-label" style="margin-top:.6rem">Blöcke gleichfarbiger Pixel (Leserichtung)</div><div class="runs">' +
        runs.map((r) => `<span>${r.n}×<i style="background:${r.c}"></i></span>`).join('') + '</div>';
    }
    el.analysis.innerHTML = html;
  }

  // ---------- Aufgabe ----------
  function mdLite(text) {
    return String(text).split('\n').filter((l) => l.trim())
      .map((l) => `<p>${esc(l).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')}</p>`).join('');
  }

  function renderTask() {
    const t = state.task;
    el.task.hidden = !t;
    if (!t) return;
    el.taskTitle.textContent = t.title || 'Aufgabe';
    el.taskBody.innerHTML = mdLite(t.text || '');
    const tg = t.target;
    el.targetWrap.hidden = !tg;
    if (!tg) return;
    const s = clamp(Math.floor(150 / Math.max(tg.w, tg.h)), 2, 40), r = window.devicePixelRatio || 1;
    el.target.width = Math.round(tg.w * s * r); el.target.height = Math.round(tg.h * s * r);
    el.target.style.width = tg.w * s + 'px'; el.target.style.height = tg.h * s + 'px';
    const c = el.target.getContext('2d');
    c.setTransform(r, 0, 0, r, 0, 0);
    tg.colors.forEach((col, i) => { c.fillStyle = col; c.fillRect((i % tg.w) * s, Math.floor(i / tg.w) * s, s, s); });

    const tol = t.tol ?? DEFAULT_TOL;
    let msg, ok = false;
    if (state.w !== tg.w || state.h !== tg.h) {
      msg = `Die Grösse stimmt noch nicht: Das Zielbild hat ${tg.w} × ${tg.h} Pixel.`;
    } else {
      let hit = 0;
      tg.colors.forEach((col, i) => {
        const a = px[i], bb = hexRgb(col);
        if (a && a.every((v, k) => Math.abs(v - bb[k]) <= tol)) hit++;
      });
      ok = hit === tg.colors.length;
      msg = ok
        ? `✓ Stimmt! Ihre Pixeldaten brauchen ${state.w} × ${state.h} × ${state.bpp} = ${fmt(needBits())} Bit.`
        : `${hit} von ${tg.colors.length} Pixeln stimmen.`;
    }
    el.taskCheck.textContent = msg;
    el.taskCheck.className = 'check ' + (ok ? 'ok' : 'no');
  }

  // ---------- Gesamtaktualisierung ----------
  let saveTimer = 0;

  function refresh() {
    px = decodeAll();
    if (state.hover >= state.w * state.h) state.hover = -1;
    el.cover.hidden = !state.hidden;
    el.canvas.style.visibility = state.hidden ? 'hidden' : 'visible';
    drawScene();
    renderStatus();
    renderInfo();
    renderMap();
    renderDraw();
    renderPalette();
    renderAnalysis();
    renderTask();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 400);
  }

  // ---------- Laden / Speichern / Teilen ----------
  function bitsToB64(bits) {
    const bytes = new Uint8Array(Math.ceil(bits.length / 8));
    for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(bits.substr(i * 8, 8).padEnd(8, '0'), 2);
    let s = '';
    for (const x of bytes) s += String.fromCharCode(x);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function b64ToBits(b64, n) {
    try {
      const s = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
      let bits = '';
      for (let i = 0; i < s.length; i++) bits += bin(s.charCodeAt(i), 8);
      return bits.slice(0, Number.isFinite(n) ? n : bits.length);
    } catch (e) {
      return '';
    }
  }

  const normColor = (c) => {
    const s = String(c).replace('#', '').toLowerCase();
    return /^[0-9a-f]{6}$/.test(s) ? '#' + s : '#000000';
  };

  function loadCfg(cfg) {
    state.w = clamp(parseInt(cfg.w, 10) || 8, 1, MAX_DIM);
    state.h = clamp(parseInt(cfg.h, 10) || 8, 1, MAX_DIM);
    state.bpp = clamp(parseInt(cfg.b, 10) || 1, 1, MAX_BPP);
    state.model = ['auto', 'gray', 'rgb', 'palette'].includes(cfg.model) ? cfg.model : 'auto';
    state.bits = String(cfg.bits || '').replace(/[^01]/g, '');
    state.hdr = cfg.hdr !== false; // Standard: Header im Bitstrom
    state.view = cfg.view === 'hex' ? 'hex' : 'bin';
    state.labels = !!cfg.labels;
    state.grid = cfg.grid !== false;
    const pal = defaultPalette();
    (cfg.palette || []).forEach((c, i) => { if (i < 256) pal[i] = normColor(c); });
    state.palette = pal;
    if (cfg.task) {
      const tg = cfg.task.target;
      state.task = {
        title: String(cfg.task.title || ''),
        text: String(cfg.task.text || ''),
        tol: Number.isFinite(cfg.task.tol) ? cfg.task.tol : DEFAULT_TOL,
        target: tg && tg.w > 0 && tg.h > 0 && tg.colors && tg.colors.length === tg.w * tg.h
          ? { w: tg.w, h: tg.h, colors: tg.colors.map(normColor) } : null,
      };
    } else state.task = null;
    state.lock = new Set(cfg.lock || []);
    state.hidden = !!cfg.reveal;
    state.tool = 'inspect';
    state.hover = -1;
    writeText();
    applyLocks();
    syncControls();
    refresh();
  }

  function currentCfg() {
    return {
      w: state.w, h: state.h, b: state.bpp, model: state.model, bits: state.bits, hdr: state.hdr,
      view: state.view, labels: state.labels, grid: state.grid,
      palette: model() === 'palette' ? state.palette.slice(0, 2 ** state.bpp) : undefined,
      task: state.task, lock: [...state.lock], reveal: state.hidden,
    };
  }

  function cfgFromHash(hash) {
    const p = new URLSearchParams(hash.replace(/^#/, ''));
    if (!p.has('w')) return null;
    const cfg = {
      w: p.get('w'), h: p.get('h'), b: p.get('b'), model: p.get('m') || 'auto',
      hdr: p.get('hdr') !== '0', view: p.get('v'), labels: p.get('lbl') === '1',
      bits: p.has('d') ? b64ToBits(p.get('d'), parseInt(p.get('n'), 10)) : '',
      reveal: p.get('r') === '1', lock: (p.get('lock') || '').split(',').filter(Boolean),
      palette: (p.get('pal') || '').match(/[0-9a-fA-F]{6}/g) || undefined,
    };
    if (p.has('t') || p.has('x') || p.has('tw')) {
      const tw = parseInt(p.get('tw'), 10), th = parseInt(p.get('th'), 10);
      cfg.task = {
        title: p.get('t') || '', text: p.get('x') || '',
        tol: p.has('tol') ? Number(p.get('tol')) : undefined,
        target: tw && th ? { w: tw, h: th, colors: (p.get('tc') || '').match(/[0-9a-fA-F]{6}/g) || [] } : null,
      };
    }
    return cfg;
  }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(currentCfg())); } catch (e) { /* z.B. privater Modus */ }
  }

  function loadSaved() {
    try {
      const s = localStorage.getItem(STORE_KEY);
      return s ? JSON.parse(s) : null;
    } catch (e) {
      return null;
    }
  }

  function buildLink() {
    const p = new URLSearchParams();
    p.set('w', state.w); p.set('h', state.h); p.set('b', state.bpp);
    if (state.model !== 'auto') p.set('m', state.model);
    if (!state.hdr) p.set('hdr', '0');
    if (state.view === 'hex') p.set('v', 'hex');
    if (state.labels) p.set('lbl', '1');
    const bits = el.shEmpty.checked ? '' : state.bits;
    if (bits) { p.set('n', bits.length); p.set('d', bitsToB64(bits)); }
    if (model() === 'palette') p.set('pal', state.palette.slice(0, 2 ** state.bpp).map((c) => c.slice(1)).join(''));
    if (el.shReveal.checked) p.set('r', '1');
    const title = el.shTitle.value.trim(), text = el.shText.value.trim();
    if (title) p.set('t', title);
    if (text) p.set('x', text);
    let note = '';
    let target = state.task && state.task.target;
    if (el.shTarget.checked) {
      if (valid() && px.length && px.every(Boolean)) target = { w: state.w, h: state.h, colors: px.map(rgbHex) };
      else note = 'Das aktuelle Bild ist unvollständig und kann nicht als Zielbild dienen.';
    }
    if (target) {
      p.set('tw', target.w); p.set('th', target.h);
      p.set('tc', target.colors.map((c) => c.slice(1)).join(''));
      if (state.task && state.task.tol !== DEFAULT_TOL) p.set('tol', state.task.tol);
    }
    const locks = [...el.dlgShare.querySelectorAll('[data-lock]')].filter((c) => c.checked).map((c) => c.dataset.lock);
    if (locks.length) p.set('lock', locks.join(','));
    const url = location.href.split('#')[0] + '#' + p.toString();
    if (url.length > 8000) note = (note ? note + ' ' : '') + `Der Link ist sehr lang (${fmt(url.length)} Zeichen) und funktioniert eventuell nicht überall.`;
    if (location.protocol === 'file:') note = (note ? note + ' ' : '') + 'Hinweis: Die Seite ist lokal geöffnet – der Link funktioniert nur auf diesem Computer. Auf GitHub Pages veröffentlicht, funktioniert er überall.';
    return { url, note };
  }

  function updateShare() {
    const { url, note } = buildLink();
    el.shUrl.value = url;
    el.shOpen.href = url;
    el.shNote.textContent = note;
  }

  function openShare() {
    el.shReveal.checked = false;
    el.shTitle.value = state.task ? state.task.title : '';
    el.shText.value = state.task ? state.task.text : '';
    el.shTarget.checked = false;
    el.shEmpty.checked = false;
    for (const c of el.dlgShare.querySelectorAll('[data-lock]')) c.checked = state.lock.has(c.dataset.lock);
    el.shTaskBox.open = !!state.task;
    el.shCopy.textContent = 'Kopieren';
    updateShare();
    el.dlgShare.showModal();
  }

  // ---------- Text -> Bits ----------
  let textBits = '';

  function renderTextTable() {
    const enc = new TextEncoder();
    el.textTable.textContent = '';
    const all = [];
    for (const ch of el.textIn.value) {
      const bytes = [...enc.encode(ch)];
      const bits = bytes.map((x) => bin(x, 8));
      all.push(...bits);
      const s = document.createElement('span');
      const b = document.createElement('b'); b.textContent = ch === ' ' ? '␣' : ch;
      const sm = document.createElement('small'); sm.textContent = bytes.join(' + ');
      s.append(b, sm, bits.join(' '));
      el.textTable.append(s);
    }
    textBits = all.join('');
  }

  function useTextBits(append) {
    if (!textBits) return;
    state.bits = append ? state.bits + textBits : textBits;
    writeText();
    refresh();
    el.dlgText.close();
  }

  // ---------- PNG ----------
  function exportPng() {
    if (!valid() || state.hidden) return;
    const s = clamp(Math.floor(1024 / Math.max(state.w, state.h)), 1, 64);
    const c = document.createElement('canvas');
    c.width = state.w * s; c.height = state.h * s;
    const x = c.getContext('2d');
    px.forEach((col, i) => {
      if (!col) return;
      x.fillStyle = rgbHex(col);
      x.fillRect((i % state.w) * s, Math.floor(i / state.w) * s, s, s);
    });
    c.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `pixelbild-${state.w}x${state.h}-${state.bpp}bit.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    });
  }

  // ---------- Ereignisse ----------
  function bindEvents() {
    for (const [k, input] of Object.entries(dimInputs)) {
      input.addEventListener('input', () => setDim(k, input.value, true));
      input.addEventListener('change', () => setDim(k, input.value, false));
    }
    for (const s of document.querySelectorAll('.stepper')) {
      const key = { 'in-w': 'w', 'in-h': 'h', 'in-b': 'bpp' }[s.dataset.for];
      for (const btn of s.querySelectorAll('button')) {
        btn.addEventListener('click', () => setDim(key, state[key] + Number(btn.dataset.step), false));
      }
    }
    el.rngB.addEventListener('input', () => setDim('bpp', el.rngB.value, false));
    el.model.addEventListener('change', () => { state.model = el.model.value; syncControls(); refresh(); });
    el.chkHeader.addEventListener('change', () => { state.hdr = el.chkHeader.checked; writeText(); refresh(); });
    el.chkGrid.addEventListener('change', () => { state.grid = el.chkGrid.checked; refresh(); });
    el.chkLabels.addEventListener('change', () => { state.labels = el.chkLabels.checked; refresh(); });
    el.segView.addEventListener('click', (e) => {
      const v = e.target.dataset.view;
      if (!v || v === state.view) return;
      state.view = v; writeText(); syncControls(); refresh();
    });
    el.segTool.addEventListener('click', (e) => {
      const t = e.target.dataset.tool;
      if (!t) return;
      state.tool = t; syncControls(); refresh();
    });

    el.bits.addEventListener('input', onTextInput);
    $('btn-format').addEventListener('click', () => { writeText(); refresh(); });
    $('btn-zero').addEventListener('click', () => { if (valid()) { state.bits = '0'.repeat(needBits()); writeText(); refresh(); } });
    $('btn-random').addEventListener('click', () => {
      if (!valid()) return;
      const a = new Uint8Array(needBits());
      crypto.getRandomValues(a);
      state.bits = Array.from(a, (v) => v & 1).join('');
      writeText(); refresh();
    });
    $('btn-text').addEventListener('click', () => { renderTextTable(); el.dlgText.showModal(); el.textIn.focus(); });
    el.textIn.addEventListener('input', renderTextTable);
    $('btn-text-replace').addEventListener('click', () => useTextBits(false));
    $('btn-text-append').addEventListener('click', () => useTextBits(true));

    el.canvas.addEventListener('pointermove', (e) => {
      const i = hitIndex(e);
      if (drawing) paintPixel(i);
      setHover(i);
    });
    el.canvas.addEventListener('pointerdown', (e) => {
      if (state.tool !== 'draw' || state.hidden) return;
      drawing = true;
      el.canvas.setPointerCapture(e.pointerId);
      paintPixel(hitIndex(e));
      e.preventDefault();
    });
    const stop = () => { drawing = false; };
    el.canvas.addEventListener('pointerup', stop);
    el.canvas.addEventListener('pointercancel', stop);
    el.canvas.addEventListener('pointerleave', () => { if (!drawing) setHover(-1); });
    el.map.addEventListener('pointerover', (e) => {
      const c = e.target.closest('.chip');
      if (c && c.dataset.i !== undefined) setHover(+c.dataset.i);
    });
    el.map.addEventListener('pointerleave', () => setHover(-1));

    el.drawColor.addEventListener('input', () => { state.drawColor = el.drawColor.value; renderDraw(); });
    el.swatches.addEventListener('click', (e) => {
      const c = e.target.dataset.color;
      if (!c) return;
      state.drawColor = c; el.drawColor.value = c; renderDraw();
    });
    el.palette.addEventListener('input', (e) => {
      const i = e.target.dataset.i;
      if (i === undefined) return;
      state.palette[+i] = e.target.value;
      refresh();
    });
    $('btn-pal-reset').addEventListener('click', () => { state.palette = defaultPalette(); refresh(); });

    $('btn-reveal').addEventListener('click', () => { state.hidden = false; refresh(); });
    $('task-close').addEventListener('click', () => { state.task = null; refresh(); });
    $('btn-help').addEventListener('click', () => el.dlgHelp.showModal());
    $('btn-png').addEventListener('click', exportPng);
    $('btn-share').addEventListener('click', openShare);
    el.dlgShare.addEventListener('input', updateShare);
    el.dlgShare.addEventListener('change', updateShare);
    el.shCopy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(el.shUrl.value); }
      catch (e) { el.shUrl.select(); document.execCommand('copy'); }
      el.shCopy.textContent = 'Kopiert ✓';
    });

    el.preset.addEventListener('change', () => {
      const p = window.PIXEL_PRESETS.find((x) => x.id === el.preset.value);
      el.preset.value = '';
      if (!p) return;
      history.replaceState(null, '', location.pathname + location.search);
      loadCfg(p.cfg);
    });
    window.addEventListener('hashchange', () => {
      const cfg = cfgFromHash(location.hash);
      if (cfg) loadCfg(cfg);
    });

    let lastW = 0;
    new ResizeObserver(() => {
      const w = el.wrap.clientWidth;
      if (w !== lastW) { lastW = w; drawScene(); }
    }).observe(el.wrap);
  }

  function buildPresetMenu() {
    const ph = document.createElement('option');
    ph.value = ''; ph.textContent = 'Beispiel oder Aufgabe laden …';
    el.preset.append(ph);
    const groups = new Map();
    for (const p of window.PIXEL_PRESETS || []) {
      if (!groups.has(p.group)) {
        const g = document.createElement('optgroup');
        g.label = p.group;
        groups.set(p.group, g);
        el.preset.append(g);
      }
      const o = document.createElement('option');
      o.value = p.id; o.textContent = p.label;
      groups.get(p.group).append(o);
    }
  }

  // ---------- Start ----------
  buildPresetMenu();
  bindEvents();
  const start = cfgFromHash(location.hash) || loadSaved()
    || (window.PIXEL_PRESETS || []).find((p) => p.id === START_PRESET)?.cfg || { w: 8, h: 8, b: 3 };
  loadCfg(start);
})();
