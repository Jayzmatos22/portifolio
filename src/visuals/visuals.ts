// Live canvases inside the project windows: a black hole (MyWorld) and a market chart with
// a request log (Brasil Panel). Each only runs while visible.
import { prefersReducedMotion, watchVisibility } from '../lib/dom';
import { clamp, lerp } from '../lib/math';
import { getAccent } from '../lib/theme';
import { onFrame } from '../lib/ticker';
import type { VisualKind } from '../types';

const TAU = Math.PI * 2;

interface CanvasSize {
  readonly ctx: CanvasRenderingContext2D;
  readonly w: number;
  readonly h: number;
}

interface LocalPointer {
  x: number;
  y: number;
  tx: number;
  ty: number;
  inside: boolean;
}

interface Scene {
  draw(size: CanvasSize, pointer: LocalPointer, time: number, dt: number): void;
  setActive?(active: boolean): void;
}

type SceneFactory = (host: HTMLElement) => Scene;

function fitCanvas(canvas: HTMLCanvasElement): CanvasSize {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d canvas unavailable');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w: rect.width, h: rect.height };
}

function trackPointer(el: HTMLElement): LocalPointer {
  const p: LocalPointer = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, inside: false };
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

function mountScene(host: HTMLElement, createScene: SceneFactory): void {
  const canvas = host.querySelector<HTMLCanvasElement>('canvas');
  if (!canvas) return;
  let size = fitCanvas(canvas);
  const pointer = trackPointer(host.closest<HTMLElement>('[data-spotlight]') ?? host);
  const scene = createScene(host);
  const reduceMotion = prefersReducedMotion();
  let visible = false;
  let time = 0;

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

/* MyWorld: black hole with accretion disk + starfield ------------------------- */
interface Star {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly phase: number;
}

interface DiskParticle {
  readonly r: number;
  a: number;
  readonly speed: number;
  readonly size: number;
  readonly color: string;
  readonly alpha: number;
}

function blackHoleScene(): Scene {
  const stars: Star[] = Array.from({ length: 240 }, () => ({
    x: Math.random(),
    y: Math.random(),
    z: Math.random() * 0.9 + 0.1,
    phase: Math.random() * TAU,
  }));
  const disk: DiskParticle[] = Array.from({ length: 900 }, () => {
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

  function drawDisk(c: CanvasRenderingContext2D, cx: number, cy: number, R: number, tilt: number, front: boolean): void {
    for (const p of disk) {
      const s = Math.sin(p.a);
      if (s > 0 !== front) continue;
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

/* Brasil Panel: streaming series + request log -------------------------------- */
const ENDPOINTS: readonly string[] = [
  '/api/bcb/selic', '/api/quote/PETR4', '/api/ibge/estados', '/api/ipea/series',
  '/api/coingecko/btc', '/api/frankfurter/usd', '/api/worldbank/gdp', '/api/banks',
  '/api/viacep/01310100', '/api/metals/gold', '/api/auth/me',
];
const SERIES_POINTS = 120;
const STEP_MS = 110;
const LOG_LINES = 4;

interface Series {
  readonly color: () => string;
  readonly vol: number;
  readonly data: number[];
  v: number;
}

const randomWalk = (v: number, vol: number): number => clamp(v + (Math.random() - 0.5) * vol * 2 + (0.5 - v) * 0.015, 0.1, 0.9);

function createSeries(color: () => string, vol: number, start: number): Series {
  const data: number[] = [];
  let v = start;
  for (let i = 0; i < SERIES_POINTS; i++) {
    v = randomWalk(v, vol);
    data.push(v);
  }
  return { color, vol, data, v };
}

function marketScene(host: HTMLElement): Scene {
  const series: Series[] = [
    createSeries(() => getAccent().hex, 0.022, 0.55),
    createSeries(() => '#ffb547', 0.03, 0.42),
    createSeries(() => '#42e2ff', 0.018, 0.3),
  ];
  let acc = 0;
  const log = host.querySelector<HTMLElement>('[data-log]');
  let logTimer = 0;

  const pushLog = (): void => {
    if (!log) return;
    const path = ENDPOINTS[Math.floor(Math.random() * ENDPOINTS.length)] ?? '/api';
    const hit = Math.random() > 0.3;
    const ms = hit ? 1 + Math.floor(Math.random() * 6) : 40 + Math.floor(Math.random() * 180);
    const row = document.createElement('div');
    row.innerHTML = `<span class="m">GET</span><span class="p"></span><span class="s">200</span><span class="h">${hit ? 'cache:HIT ' : 'cache:MISS'}</span><span>${String(ms).padStart(3, ' ')}ms</span>`;
    const pathEl = row.querySelector('.p');
    if (pathEl) pathEl.textContent = path;
    log.append(row);
    while (log.children.length > LOG_LINES) log.firstElementChild?.remove();
  };

  return {
    setActive(active) {
      window.clearInterval(logTimer);
      if (active) logTimer = window.setInterval(pushLog, 900);
    },
    draw({ ctx: c, w, h }, pointer, time, dt) {
      acc += dt;
      while (acc > STEP_MS) {
        acc -= STEP_MS;
        series.forEach((s) => {
          s.v = randomWalk(s.v, s.vol);
          s.data.push(s.v);
          s.data.shift();
        });
      }
      const frac = acc / STEP_MS;
      const top = 44;
      const bottom = h * 0.62;
      const step = w / (SERIES_POINTS - 2);
      const accentRgb = getAccent().rgb;
      const toY = (v: number): number => bottom - v * (bottom - top);

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
          c.lineTo((SERIES_POINTS - 1 - frac) * step, bottom);
          c.lineTo(-frac * step, bottom);
          c.closePath();
          const fill = c.createLinearGradient(0, top, 0, bottom);
          fill.addColorStop(0, `rgba(${accentRgb}, 0.18)`);
          fill.addColorStop(1, `rgba(${accentRgb}, 0)`);
          c.fillStyle = fill;
          c.fill();
        }
        const last = s.data[SERIES_POINTS - 1] ?? 0.5;
        c.fillStyle = color;
        c.beginPath();
        c.arc((SERIES_POINTS - 1 - frac) * step, toY(last), 2.5 + Math.sin(time * 0.006 + si) * 0.8, 0, TAU);
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
        const idx = clamp(Math.round(x / step + frac), 0, SERIES_POINTS - 1);
        series.forEach((s) => {
          c.fillStyle = '#020303';
          c.strokeStyle = s.color();
          c.lineWidth = 1.5;
          c.beginPath();
          c.arc((idx - frac) * step, toY(s.data[idx] ?? 0.5), 4, 0, TAU);
          c.fill();
          c.stroke();
        });
      }
    },
  };
}

const SCENES: Readonly<Record<VisualKind, SceneFactory>> = { blackhole: blackHoleScene, market: marketScene };

const isVisualKind = (value: string | undefined): value is VisualKind => value === 'blackhole' || value === 'market';

export function initVisuals(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-visual]').forEach((host) => {
    const kind = host.dataset.visual;
    if (isVisualKind(kind)) mountScene(host, SCENES[kind]);
  });
}
