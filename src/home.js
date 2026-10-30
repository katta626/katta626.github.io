// Page one: the star fills the screen and changes as you read. Each section names a pose;
// between sections the poses blend, and each window can point a line at the part of the star it explains.
import { reduced, phoneQ, lenis } from './common.js';
import { createStar } from './star.js';
import { createDispersion } from './disperse.js';

const root = document.documentElement;
const canvas = document.getElementById('scene');
let star = null;
try {
  star = createStar(canvas, { mobile: phoneQ.matches, reduced });
} catch (err) {
  console.warn('WebGL unavailable, showing the still picture instead.', err);
}
if (!star) root.classList.add('no-webgl');

// x, y: fractions of the half-screen (y up); s: scale; o: brightness; rate: spin speed (rad/s)
const BASE = { x: 0, y: 0, s: 1, o: 1, cut: 0, field: 0, beam: 0, twist: 0, flare: 0, lens: 0, sky: 0.9, lensX: 0.5, lensY: 0.5, core: 0, pole: 0, rate: 0.4 };
const DESK = {
  hero: { x: 0.5, y: 0.05, s: 0.72, field: 0.8, beam: 0.9, rate: 0.5 },
  pulsar: { x: 0.52, s: 0.62, field: 1, beam: 1, pole: 1, rate: 0.7 },
  magnetar: { x: -0.55, s: 0.68, field: 1, beam: 0.15, twist: 1, flare: 1, rate: 0.15 },
  signal: { x: -0.78, y: 0.12, s: 0.26, field: 0.5, beam: 1, rate: 0.6 },
  interior: { x: 0.5, s: 1.0, cut: 1, core: 0.3, rate: 0.05, sky: 0.5 },
  twins: { x: 0.5, s: 1.0, cut: 1, core: 0.3, rate: 0.05, sky: 0.5 },
};
const PHONE = {
  hero: { y: 0.42, s: 0.5, field: 0.8, beam: 0.9, rate: 0.5 },
  pulsar: { y: 0.5, s: 0.45, field: 1, beam: 1, pole: 1, rate: 0.7 },
  magnetar: { y: 0.5, s: 0.48, field: 1, beam: 0.15, twist: 1, flare: 1, rate: 0.15 },
  signal: { y: 0.55, s: 0.3, field: 0.5, beam: 1, rate: 0.6 },
  interior: { y: 0.5, s: 0.72, cut: 1, core: 0.3, rate: 0.05, sky: 0.5 },
  twins: { y: 0.5, s: 0.72, cut: 1, core: 0.3, rate: 0.05, sky: 0.5 },
};
const KEYS = Object.keys(BASE);
const pose = (name) => ({ ...BASE, ...((phoneQ.matches ? PHONE : DESK)[name] || {}) });

// Each section holds its pose while it fills the screen; between sections the poses blend.
let holds = [];
function measure() {
  const vh = window.innerHeight;
  holds = [...document.querySelectorAll('[data-pose]')].map((el) => {
    const top = el.getBoundingClientRect().top + window.scrollY;
    const bottom = top + el.offsetHeight;
    let a = top + vh * 0.05, b = bottom - vh * 0.45;
    if (b < a) a = b = (top + bottom) / 2;
    return { name: el.dataset.pose, a, b };
  });
}
const smooth = (t) => t * t * (3 - 2 * t);
function targetPose() {
  const c = window.scrollY + window.innerHeight / 2;
  if (!holds.length || c <= holds[0].b) return pose(holds[0]?.name || 'hero');
  for (let i = 0; i < holds.length; i++) {
    const h = holds[i], n = holds[i + 1];
    if (c >= h.a && c <= h.b) return pose(h.name);
    if (n && c > h.b && c < n.a) {
      const t = (c - h.b) / (n.a - h.b);
      const p0 = pose(h.name), p1 = pose(n.name);
      if (reduced) return t < 0.5 ? p0 : p1;
      const k = smooth(t), out = {};
      for (const key of KEYS) out[key] = p0[key] + (p1[key] - p0[key]) * k;
      return out;
    }
  }
  return pose(holds[holds.length - 1].name);
}

// ---------- leader lines: the window being read points at its part of the star ----------
const wins = [...document.querySelectorAll('.win[data-anchor]')];
const leader = document.querySelector('.leaders');
const lPath = leader.querySelector('path');
const lDot = leader.querySelector('.dot');
const lRing = leader.querySelector('.ring');
const tags = [...document.querySelectorAll('.tag')];
let active = null, draw = 0;

function pickWin() {
  const vh = window.innerHeight;
  const lo = phoneQ.matches ? vh * 0.5 : vh * 0.25, hi = phoneQ.matches ? vh * 0.98 : vh * 0.75;
  const mid = (lo + hi) / 2;
  let best = null, bestD = Infinity;
  for (const w of wins) {
    const r = w.getBoundingClientRect();
    if (r.bottom < lo || r.top > hi || !w.classList.contains('in')) continue;
    const d = Math.abs(r.top + Math.min(r.height, 200) / 2 - mid);
    if (d < bestD) { bestD = d; best = w; }
  }
  return best;
}
// hide the anchor when text or a window sits over that point of the star
function isCovered(x, y) {
  if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return true;
  let el = document.elementFromPoint(x, y);
  while (el && el !== document.body) {
    if (/^(P|H1|H2|H3|LI|A)$/.test(el.tagName)) return true;
    const bg = getComputedStyle(el).backgroundColor;
    if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return true;
    el = el.parentElement;
  }
  return false;
}
function updateLeader(dt, o) {
  const next = o > 0.5 ? pickWin() : null;
  if (next !== active) {
    active?.classList.remove('is-active');
    next?.classList.add('is-active');
    active = next; draw = 0;
  }
  if (!active) { leader.style.opacity = '0'; return; }
  draw = Math.min(1, draw + dt * (reduced ? 10 : 1.8));
  const a = star.project(active.dataset.anchor);
  if (isCovered(a.x, a.y)) { leader.style.opacity = '0'; return; }
  const r = active.getBoundingClientRect();
  let sx, sy, d;
  if (phoneQ.matches) {
    sx = r.left + 32; sy = r.top;
    d = `M${sx},${sy} C${sx},${sy - 60} ${a.x},${a.y + 80} ${a.x},${a.y}`;
  } else {
    sx = a.x > r.right ? r.right : r.left; sy = r.top + 40;
    const dx = a.x - sx;
    d = `M${sx},${sy} C${sx + dx * 0.45},${sy} ${a.x - dx * 0.25},${a.y} ${a.x},${a.y}`;
  }
  lPath.setAttribute('d', d);
  lPath.style.strokeDashoffset = String(1 - smooth(draw));
  const show = draw > 0.85 ? 1 : 0;
  lDot.setAttribute('cx', a.x); lDot.setAttribute('cy', a.y);
  lRing.setAttribute('cx', a.x); lRing.setAttribute('cy', a.y);
  lDot.style.opacity = show; lRing.style.opacity = show * 0.8;
  leader.style.opacity = String((a.behind ? 0.4 : 1) * Math.min(1, o * 1.5));
}

// ---------- the frame loop ----------
const state = { ...pose('hero'), o: 0, spin: 0, phase: 0, puff: 0, flash: 0, skyTurn: 0, lensOff: 0, hiCore: 0, hiPasta: 0 };
const spring = { x: 0, v: 0 };
let spinPhase = 0, last = performance.now();

function tick(now) {
  requestAnimationFrame(tick);
  if (!star) return;
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const t = now / 1000;
  const p = targetPose();
  const ease = Math.min(1, dt * (reduced ? 14 : 3));
  for (const k of KEYS) state[k] += (p[k] - state[k]) * ease;

  const v = Math.abs(lenis?.velocity || 0);
  spring.v += (60 * (v - spring.x) - 9 * spring.v) * dt;
  spring.x += spring.v * dt;
  state.phase += dt * (reduced ? 0 : 0.3 + Math.min(spring.x, 80) * 0.03);
  state.puff = Math.min(1, Math.max(0, spring.x * 0.025));
  spinPhase += dt * (reduced ? 0 : state.rate);
  state.spin = window.scrollY * 0.0018 + spinPhase;
  state.skyTurn = window.scrollY * 0.00004;

  const burst = reduced ? 0.3 : Math.pow(Math.max(0, Math.sin(t * 1.15)), 14);
  const flare = state.flare, pole = state.pole;
  state.flash = state.twist * burst;
  state.flare = flare * (0.4 + 0.6 * burst);
  state.pole = state.beam * 0.25 + pole;
  state.hiCore = state.core;
  star.render(state, t);
  state.flare = flare; state.pole = pole;

  updateLeader(dt, state.o);
  for (const tag of tags) {
    const a = star.project(tag.dataset.anchor);
    const on = state.cut > 0.85 && state.o > 0.8 && !a.behind && !isCovered(a.x, a.y);
    tag.classList.toggle('on', on);
    if (on) {
      const left = tag.dataset.side === 'left';
      tag.style.transform = `translate(${(left ? a.x - 16 - tag.offsetWidth : a.x + 16).toFixed(1)}px, ${(a.y - 13).toFixed(1)}px)`;
    }
  }
}
requestAnimationFrame(tick);

addEventListener('resize', () => { star?.resize(); measure(); });
addEventListener('load', measure);
document.fonts?.ready.then(measure);
new ResizeObserver(measure).observe(document.querySelector('main'));
measure();

// ---------- the live figures ----------
createDispersion(document.querySelector('.disp-sec'));

// ---------- the thesis dial: extra pressure ΔP at the transition ----------
// The star's mixed phase widens with ΔP; the P–μ sketch and the mass–radius sketch follow.
const sliders = [document.getElementById('dp'), document.getElementById('dp2')];
const outs = [document.getElementById('dp-out'), document.getElementById('dp2-out')];
const lH = document.querySelector('.pmu .l-h'), lQ = document.querySelector('.pmu .l-q'), lM = document.querySelector('.pmu .l-m');
const dpState = document.querySelector('.dp-state');
const gTwin = document.querySelector('.mr .g-twin'), gSmooth = document.querySelector('.mr .g-smooth');
const mixTag = document.querySelector('.tag-mixed');
// P–μ sketch in plot units: hadronic P = 0.6μ, quark P = 1.4μ − 0.8, crossing at μc = 1 (Pc = 0.6).
// The mixed phase is the parabola tangent to both lines at μc ∓ d; it passes Pc + 0.2 d at μc.
const X = (m) => 34 + (m - 0.45) / 1.1 * 276, Y = (p) => 164 - (p - 0.15) / 1.0 * 150;
const line = (f, m0, m1) => `M${X(m0).toFixed(1)},${Y(f(m0)).toFixed(1)} L${X(m1).toFixed(1)},${Y(f(m1)).toFixed(1)}`;
const PH = (m) => 0.6 * m, PQ = (m) => 1.4 * m - 0.8;
function setDP(v) {
  sliders.forEach((sl) => { sl.value = v; });
  outs.forEach((o) => { o.textContent = v.toFixed(2); });
  const dd = Math.max(1.8 * v, 0.0001); // half-width of the mixed phase in μ
  lH.setAttribute('d', line(PH, 0.5, 1 - dd));
  lQ.setAttribute('d', line(PQ, 1 + dd, 1.5));
  let m = '';
  for (let i = 0; i <= 24; i++) {
    const x = 1 - dd + (2 * dd) * (i / 24);
    const y = (0.2 / dd) * (x - 1) ** 2 + (x - 1) + 0.6 + 0.2 * dd;
    m += (i ? 'L' : 'M') + X(x).toFixed(1) + ',' + Y(y).toFixed(1);
  }
  lM.setAttribute('d', v > 0 ? m : '');
  dpState.innerHTML = v === 0
    ? 'Δ<i>P</i> = 0: Maxwell, a sharp boundary between hadrons and quarks.'
    : v < 0.035 ? 'Small Δ<i>P</i>: a thin mixed phase.' : 'Large Δ<i>P</i>: a wide mixed phase, a smooth transition.';
  // twins vanish past a threshold (illustrative position on the dial)
  const t = Math.min(1, Math.max(0, (v - 0.03) / 0.025));
  gTwin.style.opacity = String(1 - t * 0.85);
  gSmooth.style.opacity = String(0.15 + t * 0.85);
  star?.setInterior(v / 0.08 * 0.26);
  mixTag.style.visibility = v > 0.004 ? 'visible' : 'hidden';
}
sliders.forEach((sl) => sl.addEventListener('input', () => setDP(Number(sl.value))));
setDP(0);

// ---------- the signal travels: a dispersed pulse crosses from the star to the antenna ----------
const tc = document.querySelector('.travel-canvas');
const tctx = tc.getContext('2d');
const dmInput = document.getElementById('dm');
const BANDS = 7;
let travelOn = false;
new IntersectionObserver(([e]) => { travelOn = e.isIntersecting; }).observe(tc);
function travel(now) {
  requestAnimationFrame(travel);
  if (!travelOn) return;
  const r = tc.getBoundingClientRect();
  const dpr = Math.min(2, devicePixelRatio || 1);
  if (tc.width !== Math.round(r.width * dpr)) { tc.width = Math.round(r.width * dpr); tc.height = Math.round(r.height * dpr); }
  const W = r.width, H = r.height;
  tctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  tctx.clearRect(0, 0, W, H);
  const dm = Number(dmInput.value);
  const T = 3.2; // seconds for the leading edge to cross
  const t = reduced ? 0.75 * T : (now / 1000) % (T + 1.6);
  tctx.font = '500 12px "Instrument Sans", system-ui, sans-serif';
  for (let i = 0; i < BANDS; i++) {
    const f = 0.2 - (0.05 * i) / (BANDS - 1); // 200 → 150 MHz, in GHz
    const lag = 4.15e-3 * dm * (1 / (f * f) - 25) * 0.9; // seconds of lag, scaled for the screen
    const y = 18 + (i / (BANDS - 1)) * (H - 36);
    tctx.fillStyle = 'rgba(147,166,255,0.12)';
    tctx.fillRect(0, y - 1, W, 2);
    const x = ((t - lag) / T) * W;
    if (x > -40 && x < W + 20) {
      const k = i / (BANDS - 1);
      tctx.fillStyle = `rgb(${Math.round(147 + 108 * k)},${Math.round(166 - 44 * k)},${Math.round(255 - 153 * k)})`;
      tctx.fillRect(Math.min(W - 4, Math.max(0, x - 26)), y - 4, Math.max(0, Math.min(26, x)), 8);
    }
    tctx.fillStyle = '#8a8880';
    if (i === 0) tctx.fillText('200 MHz', 4, y - 10);
    if (i === BANDS - 1) tctx.fillText('150 MHz', 4, y + 18);
  }
}
requestAnimationFrame(travel);
