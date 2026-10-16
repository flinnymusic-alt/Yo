// ── Ink Dojo ─────────────────────────────────────────────────────────────────
// A dojo of four halls round a courtyard. Pick a way (Water, Fire, Earth or
// Air) and walk the dojo; its fighters walk up and challenge you, one at a
// time, and you fight them only with moves you write on the pad with a brush.
// Every way has twenty moves. You start with eight; each fighter you beat
// teaches you another, and when all twelve are beaten the Grandmaster waits on
// the dais.
(() => {
'use strict';
const { TAU, clamp, WAYS, WAY_ORDER, MOVES, TIERS, INKP, recognize, writeOut } = INK;
const cv = document.getElementById('game'), ctx = cv.getContext('2d');
const DISPLAY = '"Yuji Syuku", "Hiragino Mincho ProN", "Songti SC", Georgia, serif';
const BODY = '"Zen Kaku Gothic New", "Hiragino Sans", "Segoe UI", system-ui, sans-serif';
const C = { night: '#120f19', night2: '#1b1725', line: '#362e4a', paper: '#efe6d0', sumi: '#19141f', fg: '#ece6f4', muted: '#a99fbc', seal: '#c63f2e', gold: '#e9bb52',
            hp: '#e2574c', rough: '#d9935a', fizzle: '#8b8398' };
const lerp = (a, b, k) => a + (b - a) * k;
const ease = k => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const angTo = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
const rr = (a, b) => a + Math.random() * (b - a);
const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

// ── screen and layout: the dojo above, the pad of paper below (or beside it, on a wide screen) ──
let W = 0, H = 0, DPR = 1;
const L = { arena: { x: 0, y: 0, w: 0, h: 0 }, pad: { cx: 0, cy: 0, r: 0 }, wide: false };
function resize() {
  W = window.innerWidth || document.documentElement.clientWidth || 390;
  H = window.innerHeight || document.documentElement.clientHeight || 844;
  DPR = Math.min(2.5, window.devicePixelRatio || 1);
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  L.wide = W > H * 1.05;
  if (L.wide) {
    const r = Math.min(H * 0.4, W * 0.21, 210);
    L.pad = { cx: W - r - 28, cy: H / 2 + 26, r };
    L.arena = { x: 0, y: 0, w: W - 2 * r - 56, h: H };
  } else {
    const r = Math.min(W * 0.42, H * 0.215, 210);
    L.pad = { cx: W / 2, cy: H - r - Math.max(14, H * 0.02), r };
    L.arena = { x: 0, y: 0, w: W, h: L.pad.cy - r - 46 };
  }
}
window.addEventListener('resize', resize);
resize();

// ── sound: a few tones and noises, made on the spot (nothing to load) ──
let AC = null, master = null, soundOn = true;
try { soundOn = localStorage.getItem('inkdojo-sound') !== 'off'; } catch (_) {}
function audio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return AC; }
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); master = AC.createGain(); master.gain.value = soundOn ? 0.5 : 0; master.connect(AC.destination); } catch (_) { AC = null; }
  return AC;
}
function setSound(on) { soundOn = on; try { localStorage.setItem('inkdojo-sound', on ? 'on' : 'off'); } catch (_) {} if (master) master.gain.value = on ? 0.5 : 0; }
function tone(f, d, type = 'sine', v = 0.15, at = 0, slide = 0) {
  if (!AC || !soundOn) return;
  const t = AC.currentTime + at, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t + d);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + d + 0.02);
}
let noiseBuf = null;
function noise(d, v = 0.2, f0 = 1200, f1 = 400, q = 1, at = 0) {
  if (!AC || !soundOn) return;
  if (!noiseBuf) { noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate); const ch = noiseBuf.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1; }
  const t = AC.currentTime + at, s = AC.createBufferSource(), fl = AC.createBiquadFilter(), g = AC.createGain();
  s.buffer = noiseBuf; fl.type = 'bandpass'; fl.Q.value = q; fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + d);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  s.connect(fl); fl.connect(g); g.connect(master); s.start(t); s.stop(t + d + 0.02);
}
const PENTA = { water: [392, 440, 523, 587, 659], fire: [330, 392, 440, 494, 587], earth: [196, 220, 262, 294, 330], air: [523, 587, 698, 784, 880] };
const SFX = {
  stroke() { noise(0.12, 0.05, 2400, 900, 0.7); },
  cast(way) { const p = PENTA[way] || PENTA.water; tone(p[0], 0.35, 'triangle', 0.09); tone(p[2], 0.35, 'triangle', 0.07, 0.06); tone(p[4], 0.5, 'sine', 0.06, 0.12);
    if (way === 'fire') noise(0.25, 0.08, 3000, 600); else if (way === 'water') noise(0.3, 0.06, 900, 300, 0.6); else if (way === 'earth') tone(70, 0.3, 'sine', 0.2, 0, 0.6); else noise(0.35, 0.07, 1800, 4000, 0.5); },
  hit(big) { tone(big ? 90 : 140, big ? 0.25 : 0.12, 'sine', big ? 0.35 : 0.22, 0, 0.5); noise(big ? 0.18 : 0.08, big ? 0.22 : 0.14, 1500, 300, 0.8); },
  block() { tone(820, 0.06, 'square', 0.06); tone(560, 0.1, 'triangle', 0.08, 0.02); },
  dodge() { noise(0.2, 0.06, 900, 3000, 0.6); },
  fizzle() { tone(220, 0.25, 'sawtooth', 0.04, 0, 0.6); },
  heal() { [523, 659, 784].forEach((f, i) => tone(f, 0.4, 'sine', 0.06, i * 0.08)); },
  gong() { tone(98, 2.2, 'sine', 0.3); tone(147, 1.8, 'sine', 0.12, 0.01); tone(196, 1.4, 'triangle', 0.06, 0.02); },
  drum(n = 2) { for (let i = 0; i < n; i++) { tone(70, 0.3, 'sine', 0.4, i * 0.22, 0.5); noise(0.12, 0.12, 400, 120, 0.8, i * 0.22); } },
  learn() { [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, 0.5, 'triangle', 0.07, i * 0.09)); },
  tap() { tone(660, 0.05, 'triangle', 0.05); },
};

// ── tilt: lean the phone to walk. However you hold it when tilt starts counts as standing still ──
// Gravity is read in the screen's own frame (x to the right, y down the screen, z out of it), so it
// works in either orientation and doesn't jump when the phone passes upright.
const TILT = { on: false, asked: false, denied: false, raw: null, s: null, roll0: 0, pitch0: 0, relevel: true, paused: true,
               x: 0, y: 0, lx: 0, ly: 0, flash: 0, DZ: 4, FULL: 18 };
function screenAngle() {
  const o = screen.orientation, a = o && typeof o.angle === 'number' ? o.angle : typeof window.orientation === 'number' ? window.orientation : 0;
  return ((a % 360) + 360) % 360 * Math.PI / 180;
}
function tiltGravity(beta, gamma) {
  const b = beta * Math.PI / 180, g = gamma * Math.PI / 180, a = screenAngle();
  const dx = Math.sin(g) * Math.cos(b), dy = Math.sin(b), dz = -Math.cos(g) * Math.cos(b); // device right, device down, out of the screen
  return { x: dx * Math.cos(a) + dy * Math.sin(a), y: -dx * Math.sin(a) + dy * Math.cos(a), z: dz };
}
function onTilt(e) {
  if (e.beta == null || e.gamma == null) return;
  TILT.raw = tiltGravity(e.beta, e.gamma);
  if (!TILT.on) { TILT.on = true; TILT.relevel = true; TILT.s = { ...TILT.raw }; }
}
let tiltListening = false;
function tiltListen() { if (!tiltListening) { tiltListening = true; window.addEventListener('deviceorientation', onTilt); } }
// iPhones share motion only after asking, and only when asked from a tap: until then tilt is "needed",
// and a tilt button by the paper asks (a real button, whose click iPhones always accept as a tap).
// Elsewhere the readings just arrive.
const DOE = window.DeviceOrientationEvent;
TILT.need = !!(DOE && typeof DOE.requestPermission === 'function') && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
const inFrame = (() => { try { return window.self !== window.top; } catch (_) { return true; } })();
const tiltBtn = document.getElementById('tiltBtn');
function tiltAsk(byHand) {
  if (!TILT.need || TILT.asking) return;
  TILT.asking = true;
  const no = err => { TILT.asking = false; TILT.err = String((err && err.name) || err || ''); if (byHand) tiltSayOff(); };
  let p;
  try { p = DOE.requestPermission(); } catch (err) { no(err); return; }
  Promise.resolve(p).then(r => {
    TILT.asking = false;
    if (r === 'granted') { TILT.need = false; TILT.denied = false; tiltListen(); if (byHand) say('Tilt is on', 'Lean the phone to walk. Tap the circle by the paper to make the way you hold it now count as standing still.', 4, C.gold); }
    else { TILT.denied = true; if (byHand) tiltSayOff(); }
  }, no);
}
function tiltSayOff() {
  if (inFrame) say('Tilt can’t work here', 'This viewer keeps the phone’s motion from the game. Open the Play link in Safari to walk by tilting. Dragging the floor works here.', 5.5, C.muted);
  else if (TILT.denied) say('Tilt is off', 'Motion access was turned down. Close this tab, open the game again, and tap Allow when asked. Dragging the floor still works.', 6, C.muted);
  else say('Tilt didn’t start', `Tap the tilt circle by the paper again. Dragging the floor still works.${TILT.err ? ' (' + TILT.err + ')' : ''}`, 5, C.muted);
}
if (DOE && !TILT.need) tiltListen();
// the first tap in the dojo tries once on its own; if the phone doesn't take that as a tap, the button is there
document.addEventListener('touchend', () => { if (state === 'play' && TILT.need && !TILT.denied && !TILT.tried) { TILT.tried = true; tiltAsk(false); } });
if (tiltBtn) tiltBtn.addEventListener('click', e => { e.preventDefault(); audio(); SFX.tap(); if (TILT.on) TILT.relevel = true; else tiltAsk(true); });
const relevel = () => { TILT.relevel = true; };
window.addEventListener('orientationchange', relevel);
if (screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener('change', relevel);
document.addEventListener('visibilitychange', () => { if (!document.hidden) relevel(); });
// each frame: smooth the reading, then turn the lean (in degrees, from the still pose) into a walk
function tiltTick(dt) {
  TILT.flash = Math.max(0, TILT.flash - dt);
  if (!TILT.on || !TILT.raw) { TILT.x = TILT.y = 0; return; }
  const k = 1 - Math.exp(-dt / 0.07), S = TILT.s, R = TILT.raw;
  S.x += (R.x - S.x) * k; S.y += (R.y - S.y) * k; S.z += (R.z - S.z) * k;
  const roll = G => Math.asin(clamp(G.x / (Math.hypot(G.x, G.y, G.z) || 1), -1, 1)), pitch = G => Math.atan2(G.y, -G.z);
  if (TILT.relevel) { TILT.relevel = false; TILT.s = { ...R }; TILT.roll0 = roll(R); TILT.pitch0 = pitch(R); TILT.flash = 0.7; }
  let dp = pitch(TILT.s) - TILT.pitch0; if (dp > Math.PI) dp -= TAU; if (dp < -Math.PI) dp += TAU;
  // (a phone held at an angle feels a sideways lean less, so that side is scaled back up to match)
  const side = 1 / Math.max(0.5, Math.cos(TILT.pitch0));
  const tx = (roll(TILT.s) - TILT.roll0) * side * 180 / Math.PI, ty = dp * 180 / Math.PI, m = Math.hypot(tx, ty);
  const go = clamp((m - TILT.DZ) / (TILT.FULL - TILT.DZ), 0, 1);
  TILT.x = m > 0 ? tx / m * go : 0; TILT.y = m > 0 ? ty / m * go : 0;
  const show = Math.min(1, m / TILT.FULL); TILT.lx = m > 0 ? tx / m * show : 0; TILT.ly = m > 0 ? ty / m * show : 0;
}

// ── saved progress: your way, the fighters you've beaten, and a few numbers ──
const SAVE_KEY = 'inkdojo-1';
let save = null;
function loadSave() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (s && WAYS[s.way]) return s; } catch (_) {} return null; }
function writeSave() { if (!save) return; try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (_) {} }
function newSave(way) { return { way, beaten: [], master: false, stats: { casts: 0, clean: 0, wins: 0, falls: 0, t0: Date.now() } }; }
// the moves you know: the three basic ones from the start; Ren, each white belt and each brown belt teach you one more (the
// skilled moves), and each black belt two (the master moves), so you have all twenty for the Grandmaster
const learnedCount = () => { if (!save) return 0; const b = save.beaten.length; return Math.min(20, 3 + (save.warm ? 1 : 0) + Math.min(8, b) + 2 * Math.max(0, b - 8)); };
const myMoves = () => (save ? MOVES[save.way].filter(m => m.order < learnedCount()) : []);

