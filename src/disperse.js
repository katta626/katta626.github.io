// Dispersion, live: a simulated dynamic spectrum of a 1.337 s pulsar between 150 and 200 MHz.
// Each channel is delayed by 4.15 ms · DM · (f⁻² − f_hi⁻²); dedispersing at a trial DM
// shifts the channels back, and the summed profile sharpens when the trial matches.
const P = 1.3373, T = 2 * P;
const NCH = 64, NT = 360;
const FLO = 0.15, FHI = 0.2; // GHz
const WIDTH = 0.035; // s

function gauss() {
  let u = 0, v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function createDispersion(root) {
  const canvas = root.querySelector('.wf-canvas');
  const ctx = canvas.getContext('2d');
  const dm = root.querySelector('#dm');
  const dmOut = root.querySelector('#dm-out');
  const ded = root.querySelector('#dedisperse');
  const trial = root.querySelector('#trial');
  const trialOut = root.querySelector('#trial-out');
  const snrEl = root.querySelector('.snr-v');
  const trialBox = trial.closest('.control');

  const noise = new Float32Array(NCH * NT);
  for (let i = 0; i < noise.length; i++) noise[i] = gauss();
  const freq = Array.from({ length: NCH }, (_, c) => FHI - (FHI - FLO) * (c / (NCH - 1))); // top row = high frequency
  const delay = (d, f) => 4.15e-3 * d * (1 / (f * f) - 1 / (FHI * FHI));
  const data = new Float32Array(NCH * NT);
  const prof = new Float32Array(NT);
  const img = document.createElement('canvas');
  img.width = NT; img.height = NCH;
  const ictx = img.getContext('2d');
  const id = ictx.createImageData(NT, NCH);

  function pulse(t) {
    let x = ((t % P) + P) % P - 0.42;
    if (x > P / 2) x -= P;
    return Math.exp(-0.5 * (x / WIDTH) ** 2);
  }

  function compute() {
    const D = Number(dm.value), Dt = ded.checked ? Number(trial.value) : 0;
    prof.fill(0);
    for (let c = 0; c < NCH; c++) {
      const lag = delay(D, freq[c]), back = delay(Dt, freq[c]);
      for (let i = 0; i < NT; i++) {
        const t = (i / NT) * T + back; // reading the channel back by the trial delay
        const ti = Math.round((((t / T) * NT) % NT + NT) % NT) % NT;
        const v = noise[c * NT + ti] * 0.9 + 1.25 * pulse(t - lag);
        data[c * NT + i] = v;
        prof[i] += v / NCH;
      }
    }
    // signal-to-noise of the summed profile against its off-pulse scatter
    const sorted = Float32Array.from(prof).sort();
    const med = sorted[NT >> 1];
    let s = 0;
    for (let i = 0; i < NT >> 1; i++) s += (sorted[i] - med) ** 2;
    const sd = Math.sqrt(s / (NT >> 1)) || 1;
    snrEl.textContent = ((sorted[NT - 1] - med) / sd).toFixed(1);
  }

  function colour(v) {
    const x = Math.min(1, Math.max(0, (v + 0.4) / 3.2));
    if (x < 0.6) {
      const k = x / 0.6;
      return [14 + (52 - 14) * k, 14 + (82 - 14) * k, 13 + (210 - 13) * k];
    }
    const k = (x - 0.6) / 0.4;
    return [52 + (240 - 52) * k, 82 + (240 - 82) * k, 210 + (232 - 210) * k];
  }

  function draw() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
    const W = r.width, H = r.height;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0e0e0d';
    ctx.fillRect(0, 0, W, H);

    for (let k = 0; k < NCH * NT; k++) {
      const [R, G, B] = colour(data[k]);
      id.data[k * 4] = R; id.data[k * 4 + 1] = G; id.data[k * 4 + 2] = B; id.data[k * 4 + 3] = 255;
    }
    ictx.putImageData(id, 0, 0);

    const padL = 64, padR = 16, padT = 18;
    const wfH = H * 0.66, gap = 22;
    const pw = W - padL - padR;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, padL, padT, pw, wfH - padT);

    ctx.font = '500 12px "Instrument Sans", system-ui, sans-serif';
    ctx.fillStyle = '#a9a79f';
    ctx.textBaseline = 'top';
    ctx.fillText('200 MHz', 6, padT);
    ctx.textBaseline = 'bottom';
    ctx.fillText('150 MHz', 6, wfH);
    ctx.textBaseline = 'middle';

    // the summed profile
    const py0 = wfH + gap, ph = H - py0 - 30;
    let mx = -Infinity, mn = Infinity;
    for (const v of prof) { mx = Math.max(mx, v); mn = Math.min(mn, v); }
    const span = Math.max(0.6, mx - mn);
    ctx.beginPath();
    for (let i = 0; i < NT; i++) {
      const x = padL + (i / (NT - 1)) * pw;
      const y = py0 + ph - ((prof[i] - mn) / span) * ph;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.strokeStyle = '#ecebe6';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.fillText('Summed', 6, py0 + ph * 0.35);
    ctx.fillText('profile', 6, py0 + ph * 0.35 + 15);
    ctx.textBaseline = 'bottom';
    ctx.fillText('0 s', padL, H - 6);
    ctx.textAlign = 'right';
    ctx.fillText(`${T.toFixed(2)} s`, W - padR, H - 6);
    ctx.textAlign = 'center';
    ctx.fillText('time, two rotations', padL + pw / 2, H - 6);
    ctx.textAlign = 'left';
  }

  function update() {
    dmOut.textContent = Number(dm.value).toFixed(1);
    trialOut.textContent = Number(trial.value).toFixed(1);
    trial.disabled = !ded.checked;
    trialBox.classList.toggle('trial-off', !ded.checked);
    compute();
    draw();
  }

  [dm, trial].forEach((el) => el.addEventListener('input', update));
  ded.addEventListener('change', update);
  addEventListener('resize', draw);
  document.fonts?.ready.then(draw);
  update();
}
