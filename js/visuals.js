// Live canvases inside the project windows: a black hole (MyWorld) and a market chart
// with a request log (Brasil Panel). Each only runs while visible.
import { onFrame, clamp, lerp, prefersReducedMotion, watchVisibility } from './core.js';
import { getAccent } from './theme.js';

const TAU = Math.PI * 2;

function fitCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w: rect.width, h: rect.height };
}

function trackPointer(el) {
  const p = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, inside: false };
  el.addEventListener('pointermove', (e) => {
    const r = el.getBoundingClientRect();
    p.tx = clamp((e.clientX - r.left) / r.width);
    p.ty = clamp((e.clientY - r.top) / r.height);
    p.inside = true;
  });
  el.addEventListener('pointerleave', () => {
    p.tx = 0.5;
    p.ty = 0.5;
    p.inside = false;
  });
  return p;
}

function mountScene(host, createScene) {
  const canvas = host.querySelector('canvas');
  if (!canvas) return;
  let size = fitCanvas(canvas);
  const pointer = trackPointer(host.closest('[data-spotlight]') || host);
  const scene = createScene(size, host);
  let visible = false;
  let time = 0;
  const reduceMotion = prefersReducedMotion();

  new ResizeObserver(() => {
    size = fitCanvas(canvas);
    scene.draw(size, pointer, time, 0);
  }).observe(canvas);
  watchVisibility(host, (v) => {
    visible = v;
    scene.setActive?.(v && !reduceMotion);
  });

  if (reduceMotion) {
    scene.draw(size, pointer, 0, 0);
    return;
  }
  onFrame((_, dt) => {
    if (!visible) return;
    time += dt;
    pointer.x = lerp(pointer.x, pointer.tx, 0.06);
    pointer.y = lerp(pointer.y, pointer.ty, 0.06);
    scene.draw(size, pointer, time, dt);
  });
}

/* MyWorld: black hole with accretion disk + starfield ----------------------- */
function blackHoleScene() {
  const stars = Array.from({ length: 240 }, () => ({
    x: Math.random(),
    y: Math.random(),
    z: Math.random() * 0.9 + 0.1,
    phase: Math.random() * TAU,
  }));
  const disk = Array.from({ length: 900 }, () => {
    const r = 1.3 + Math.pow(Math.random(), 1.7) * 2.5;
    const heat = clamp(1 - (r - 1.3) / 2.5);
    return {
      r,
      a: Math.random() * TAU,
      speed: 0.7 + Math.random() * 0.6,
      size: 0.5 + Math.random() * 1.3,
      color: `rgb(255, ${Math.round(110 + heat * 130)}, ${Math.round(40 + heat * 170)})`,
      alpha: 0.25 + heat * 0.6,
    };
  });

  function drawDisk(c, cx, cy, R, tilt, front) {
    for (const p of disk) {
      const s = Math.sin(p.a);
      if ((s > 0) !== front) continue;
      const x = cx + Math.cos(p.a) * p.r * R;
      const y = cy + s * p.r * R * tilt;
      const doppler = 0.55 + 0.45 * Math.cos(p.a + 0.6);
      c.globalAlpha = p.alpha * doppler;
      c.fillStyle = p.color;
      c.fillRect(x, y, p.size, p.size);
    }
    c.globalAlpha = 1;
  }

  return {
    draw({ ctx: c, w, h }, pointer, time, dt) {
      const ox = pointer.x - 0.5;
      const oy = pointer.y - 0.5;
      c.globalCompositeOperation = 'source-over';
      c.fillStyle = '#020304';
      c.fillRect(0, 0, w, h);

      for (const s of stars) {
        const x = (((s.x - ox * 0.08 * s.z) % 1) + 1) % 1;
        const y = (((s.y - oy * 0.08 * s.z) % 1) + 1) % 1;
        c.globalAlpha = 0.2 + 0.6 * s.z * (0.6 + 0.4 * Math.sin(time * 0.002 + s.phase));
        c.fillStyle = '#dfe8ff';
        c.fillRect(x * w, y * h, s.z * 1.5, s.z * 1.5);
      }
      c.globalAlpha = 1;

      const R = Math.min(w, h) * 0.12;
      const cx = w * 0.5 + ox * w * 0.06;
      const cy = h * 0.53 + oy * h * 0.05;
      const tilt = 0.2 + oy * 0.16;

      const glow = c.createRadialGradient(cx, cy, R * 0.8, cx, cy, R * 5.5);
      glow.addColorStop(0, 'rgba(255, 160, 80, 0.22)');
      glow.addColorStop(1, 'rgba(255, 110, 40, 0)');
      c.fillStyle = glow;
      c.fillRect(0, 0, w, h);

      for (const p of disk) p.a += (dt || 16) * 0.00055 * p.speed * Math.pow(p.r, -1.5) * 2.6;

      c.globalCompositeOperation = 'lighter';
      drawDisk(c, cx, cy, R, tilt, false);
      // Lensed image of the far side of the disk, bent over and under the shadow.
      for (let k = 0; k < 14; k++) {
        c.beginPath();
        c.ellipse(cx, cy, R * (1.18 + k * 0.03), R * (1.1 + k * 0.026), 0, 0, TAU);
        c.strokeStyle = `rgba(255, ${180 - k * 6}, ${120 - k * 6}, ${0.16 - k * 0.01})`;
        c.lineWidth = 1.4;
        c.stroke();
      }

      c.globalCompositeOperation = 'source-over';
      const shadow = c.createRadialGradient(cx, cy, R * 0.85, cx, cy, R * 1.06);
      shadow.addColorStop(0, '#000');
      shadow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      c.fillStyle = shadow;
      c.beginPath();
      c.arc(cx, cy, R * 1.06, 0, TAU);
      c.fill();

      c.globalCompositeOperation = 'lighter';
      c.beginPath();
      c.arc(cx, cy, R * 1.02, 0, TAU);
      c.strokeStyle = 'rgba(255, 228, 190, 0.85)';
      c.lineWidth = 1.2;
      c.stroke();
      drawDisk(c, cx, cy, R, tilt, true);
      c.globalCompositeOperation = 'source-over';
    },
  };
}

/* Brasil Panel: streaming series + request log ------------------------------ */
const ENDPOINTS = [
  '/api/bcb/selic', '/api/quote/PETR4', '/api/ibge/estados', '/api/ipea/series',
  '/api/coingecko/btc', '/api/frankfurter/usd', '/api/worldbank/gdp', '/api/banks',
  '/api/viacep/01310100', '/api/metals/gold', '/api/auth/me',
];

function marketScene(_, host) {
  const N = 120;
  const STEP_MS = 110;
  const series = [
    { color: () => getAccent().hex, vol: 0.022, v: 0.55 },
    { color: () => '#ffb547', vol: 0.03, v: 0.42 },
    { color: () => '#42e2ff', vol: 0.018, v: 0.3 },
  ].map((s) => {
    const data = [];
    let v = s.v;
    for (let i = 0; i < N; i++) {
      v = clamp(v + (Math.random() - 0.5) * s.vol * 2 + (0.5 - v) * 0.015, 0.1, 0.9);
      data.push(v);
    }
    return { ...s, data, v };
  });
  let acc = 0;

  const log = host.querySelector('[data-log]');
  let logTimer = 0;
  const pushLog = () => {
    if (!log) return;
    const path = ENDPOINTS[(Math.random() * ENDPOINTS.length) | 0];
    const hit = Math.random() > 0.3;
    const ms = hit ? 1 + ((Math.random() * 6) | 0) : 40 + ((Math.random() * 180) | 0);
    const row = document.createElement('div');
    row.innerHTML = `<span class="m">GET</span><span class="p"></span><span class="s">200</span><span class="h">${hit ? 'cache:HIT ' : 'cache:MISS'}</span><span>${String(ms).padStart(3, ' ')}ms</span>`;
    row.querySelector('.p').textContent = path;
    log.append(row);
    while (log.children.length > 4) log.firstElementChild.remove();
  };

  return {
    setActive(active) {
      clearInterval(logTimer);
      if (active) logTimer = setInterval(pushLog, 900);
    },
    draw({ ctx: c, w, h }, pointer, time, dt) {
      acc += dt;
      while (acc > STEP_MS) {
        acc -= STEP_MS;
        series.forEach((s) => {
          s.v = clamp(s.v + (Math.random() - 0.5) * s.vol * 2 + (0.5 - s.v) * 0.015, 0.1, 0.9);
          s.data.push(s.v);
          s.data.shift();
        });
      }
      const frac = acc / STEP_MS;
      const top = 44;
      const bottom = h * 0.62;
      const step = w / (N - 2);
      const accentRgb = getAccent().rgb;

      c.fillStyle = '#020303';
      c.fillRect(0, 0, w, h);
      c.lineWidth = 1;
      c.strokeStyle = 'rgba(255, 255, 255, 0.045)';
      const gridStep = w / 12;
      const shift = ((time / STEP_MS) * step) % gridStep;
      for (let x = -shift; x < w; x += gridStep) {
        c.beginPath();
        c.moveTo(x, 0);
        c.lineTo(x, h);
        c.stroke();
      }
      for (let i = 0; i <= 5; i++) {
        const y = top + ((bottom - top) * i) / 5;
        c.beginPath();
        c.moveTo(0, y);
        c.lineTo(w, y);
        c.stroke();
      }

      const toY = (v) => bottom - v * (bottom - top);
      series.forEach((s, si) => {
        const color = s.color();
        c.beginPath();
        s.data.forEach((v, i) => {
          const x = (i - frac) * step;
          if (i === 0) c.moveTo(x, toY(v));
          else c.lineTo(x, toY(v));
        });
        c.strokeStyle = color;
        c.lineWidth = si === 0 ? 1.8 : 1.2;
        c.shadowColor = color;
        c.shadowBlur = si === 0 ? 12 : 6;
        c.stroke();
        c.shadowBlur = 0;
        if (si === 0) {
          c.lineTo((N - 1 - frac) * step, bottom);
          c.lineTo(-frac * step, bottom);
          c.closePath();
          const fill = c.createLinearGradient(0, top, 0, bottom);
          fill.addColorStop(0, `rgba(${accentRgb}, 0.18)`);
          fill.addColorStop(1, `rgba(${accentRgb}, 0)`);
          c.fillStyle = fill;
          c.fill();
        }
        const lastX = (N - 1 - frac) * step;
        const lastY = toY(s.data[N - 1]);
        c.fillStyle = color;
        c.beginPath();
        c.arc(lastX, lastY, 2.5 + Math.sin(time * 0.006 + si) * 0.8, 0, TAU);
        c.fill();
      });

      if (pointer.inside) {
        const x = pointer.x * w;
        c.setLineDash([3, 4]);
        c.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        c.beginPath();
        c.moveTo(x, top - 10);
        c.lineTo(x, bottom);
        c.stroke();
        c.setLineDash([]);
        const idx = clamp(Math.round(x / step + frac), 0, N - 1);
        series.forEach((s) => {
          c.fillStyle = '#020303';
          c.strokeStyle = s.color();
          c.lineWidth = 1.5;
          c.beginPath();
          c.arc((idx - frac) * step, toY(s.data[idx]), 4, 0, TAU);
          c.fill();
          c.stroke();
        });
      }
    },
  };
}

const SCENES = { blackhole: blackHoleScene, market: marketScene };

export function initVisuals(root = document) {
  root.querySelectorAll('[data-visual]').forEach((host) => {
    const create = SCENES[host.dataset.visual];
    if (create) mountScene(host, create);
  });
}
