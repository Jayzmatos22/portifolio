// Hero portrait: the photo rendered as live ASCII on a canvas; a lens that follows the
// pointer (or drifts on its own when idle) reveals the real photo through a CSS mask.
import { prefersReducedMotion, watchVisibility } from '../lib/dom';
import { clamp, lerp } from '../lib/math';
import { getAccent } from '../lib/theme';
import { onFrame } from '../lib/ticker';
import { charFor, inkFromPixels, valuesToLines } from './ascii';

const GLITCH = '01<>/\\{}[]$#_=+';
const CHAR_ASPECT = 0.6; // monospace advance width / font size
const CELL_RATIO = 1.72; // cell height / cell width
const LEVELS = 10;
const INTRO_MS = 1500;
const GLITCH_EVERY_MS = 90;

const randomGlyph = (): string => GLITCH.charAt(Math.floor(Math.random() * GLITCH.length));

function waitForImage(img: HTMLImageElement): Promise<HTMLImageElement> {
  if (img.complete) {
    return img.naturalWidth ? Promise.resolve(img) : Promise.reject(new Error('portrait image failed to load'));
  }
  return new Promise((resolve, reject) => {
    img.addEventListener('load', () => resolve(img), { once: true });
    img.addEventListener('error', () => reject(new Error('portrait image failed to load')), { once: true });
  });
}

/** Waits for the photo; retries once with a cache-busting URL if the first request failed. */
async function loadImage(img: HTMLImageElement): Promise<HTMLImageElement> {
  try {
    return await waitForImage(img);
  } catch {
    const url = new URL(img.currentSrc || img.src, window.location.href);
    url.searchParams.set('retry', Date.now().toString(36));
    img.src = url.href;
    return waitForImage(img);
  }
}

/** Samples the image into a grid of 0..1 ink values (see ascii.ts for the math). */
export function sampleValues(img: HTMLImageElement, cols: number, rows: number): Float32Array {
  const canvas = document.createElement('canvas');
  canvas.width = cols;
  canvas.height = rows;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2d canvas unavailable');
  ctx.drawImage(img, 0, 0, cols, rows);
  return inkFromPixels(ctx.getImageData(0, 0, cols, rows).data, cols, rows);
}

/** ASCII lines of the image, for the terminal's `neofetch`. */
export function asciiLines(img: HTMLImageElement | null | undefined, cols = 46, cellRatio = 1.9): string[] {
  if (!img?.naturalWidth) return [];
  const rows = Math.round((cols * (img.naturalHeight / img.naturalWidth)) / cellRatio);
  return valuesToLines(sampleValues(img, cols, rows), cols, rows);
}

interface Grid {
  cols: number;
  rows: number;
  cw: number;
  ch: number;
  w: number;
  h: number;
  values: Float32Array | null;
  chars: string[];
}

interface Lens {
  x: number;
  y: number;
  tx: number;
  ty: number;
  r: number;
  hover: boolean;
  pressed: boolean;
  t: number;
}

interface Glitch {
  readonly ch: string;
  readonly until: number;
}

export interface PortraitController {
  /** Starts the decode intro and the live loop (called after the boot sequence). */
  start(): Promise<void>;
}

export function initPortrait(root: HTMLElement | null): PortraitController {
  const frame = root?.querySelector<HTMLElement>('.portrait__frame');
  const canvas = root?.querySelector<HTMLCanvasElement>('.portrait__ascii');
  const img = root?.querySelector<HTMLImageElement>('.portrait__photo');
  const lensEl = root?.querySelector<HTMLElement>('.portrait__lens');
  const hud = root?.querySelector<HTMLElement>('[data-hud-pos]');
  const ctx = canvas?.getContext('2d');
  if (!root || !frame || !canvas || !img || !ctx) return { start: async () => undefined };

  const reduceMotion = prefersReducedMotion();
  const grid: Grid = { cols: 0, rows: 0, cw: 0, ch: 0, w: 0, h: 0, values: null, chars: [] };
  const glitches = new Map<number, Glitch>();
  const lens: Lens = { x: 0, y: 0, tx: 0, ty: 0, r: 0, hover: false, pressed: false, t: Math.random() * 10 };
  let ready = false;
  let started = false;
  let visible = true;
  let intro = reduceMotion ? 1 : 0;
  let lastGlitch = 0;
  let nextWave = 3000;

  function layout(): boolean {
    if (!frame || !canvas || !img || !ctx) return false;
    const rect = frame.getBoundingClientRect();
    if (rect.width < 40 || rect.height < 40 || !img.naturalWidth) return false;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    grid.w = rect.width;
    grid.h = rect.height;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const target = rect.width < 360 ? 4.6 : rect.width < 520 ? 5.6 : 6.6;
    grid.cols = Math.round(rect.width / target);
    grid.cw = rect.width / grid.cols;
    grid.rows = Math.round(rect.height / (grid.cw * CELL_RATIO));
    grid.ch = rect.height / grid.rows;
    grid.values = sampleValues(img, grid.cols, grid.rows);
    grid.chars = Array.from(grid.values, charFor);
    ctx.font = `500 ${(grid.cw / CHAR_ASPECT).toFixed(2)}px "JetBrains Mono", monospace`;
    ctx.textBaseline = 'top';
    lens.r = Math.max(70, Math.min(150, rect.width * 0.24));
    if (!lens.x) {
      lens.x = lens.tx = rect.width * 0.5;
      lens.y = lens.ty = rect.height * 0.42;
    }
    return true;
  }

  function draw(): void {
    const { cols, rows, cw, ch, values, chars } = grid;
    if (!values || !ctx) return;
    const { rgb } = getAccent();
    ctx.clearRect(0, 0, grid.w, grid.h);
    const revealRow = intro * (rows + 8);
    const buckets: Array<Array<number | string>> = Array.from({ length: LEVELS }, () => []);
    const now = performance.now();

    for (let y = 0; y < rows && y <= revealRow; y++) {
      const isFront = intro < 1 && revealRow - y < 8;
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        let v = values[i];
        let glyph = chars[i] ?? ' ';
        const g = glitches.get(i);
        if (g) {
          if (g.until < now) glitches.delete(i);
          else {
            glyph = g.ch;
            v = Math.min(1, v + 0.45);
          }
        }
        if (isFront) {
          if (v < 0.05) continue;
          glyph = randomGlyph();
          v = Math.min(1, v + 0.5);
        }
        if (glyph === ' ') continue;
        buckets[Math.min(LEVELS - 1, Math.floor(v * LEVELS))]?.push(x * cw, y * ch, glyph);
      }
    }
    buckets.forEach((cells, level) => {
      if (!cells.length) return;
      const alpha = (0.16 + (level / (LEVELS - 1)) * 0.84).toFixed(3);
      ctx.fillStyle = level >= LEVELS - 1 ? `rgba(236, 255, 242, ${alpha})` : `rgba(${rgb}, ${alpha})`;
      for (let k = 0; k < cells.length; k += 3) ctx.fillText(String(cells[k + 2]), Number(cells[k]), Number(cells[k + 1]));
    });
  }

  function addGlitches(now: number): void {
    const { cols, rows, values } = grid;
    if (!values) return;
    for (let n = 0; n < 14; n++) {
      const i = Math.floor(Math.random() * values.length);
      if (values[i] < 0.15) continue;
      glitches.set(i, { ch: randomGlyph(), until: now + 120 + Math.random() * 380 });
    }
    if (now > nextWave) {
      const row = Math.floor(Math.random() * rows);
      for (let y = row; y < Math.min(rows, row + 2); y++) {
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x;
          if (values[i] > 0.08) glitches.set(i, { ch: randomGlyph(), until: now + 160 });
        }
      }
      nextWave = now + 2500 + Math.random() * 3000;
    }
  }

  function updateLens(dt: number): void {
    if (!frame || !img) return;
    if (!lens.hover) {
      lens.t += dt * 0.00045;
      lens.tx = grid.w * (0.5 + Math.sin(lens.t * 1.3) * 0.17);
      lens.ty = grid.h * (0.4 + Math.sin(lens.t * 2.1) * 0.1);
    }
    const ease = lens.hover ? 0.16 : 0.035;
    lens.x = lerp(lens.x, lens.tx, ease);
    lens.y = lerp(lens.y, lens.ty, ease);
    const radius = lens.r * (lens.pressed ? 1.35 : lens.hover ? 1 : 0.82);
    frame.style.setProperty('--lx', `${lens.x.toFixed(1)}px`);
    frame.style.setProperty('--ly', `${lens.y.toFixed(1)}px`);
    frame.style.setProperty('--lr', `${radius.toFixed(1)}px`);
    if (lensEl) lensEl.style.transform = `translate3d(${(lens.x - radius).toFixed(1)}px, ${(lens.y - radius).toFixed(1)}px, 0)`;
    if (hud) {
      const px = Math.round((lens.x / grid.w) * img.naturalWidth);
      const py = Math.round((lens.y / grid.h) * img.naturalHeight);
      hud.textContent = `x ${String(px).padStart(3, '0')} · y ${String(py).padStart(3, '0')}`;
    }
  }

  function tick(time: number, dt: number): void {
    if (!visible) return;
    if (!ready) {
      ready = layout();
      if (!ready) return;
    }
    updateLens(dt);
    if (intro < 1) {
      intro = Math.min(1, intro + dt / INTRO_MS);
      draw();
      return;
    }
    if (reduceMotion) return;
    if (time - lastGlitch > GLITCH_EVERY_MS) {
      lastGlitch = time;
      addGlitches(time);
      draw();
    }
  }

  const setLensTarget = (e: PointerEvent): void => {
    const rect = frame.getBoundingClientRect();
    lens.tx = clamp(e.clientX - rect.left, 0, rect.width);
    lens.ty = clamp(e.clientY - rect.top, 0, rect.height);
  };
  frame.addEventListener('pointerenter', (e) => {
    lens.hover = true;
    root.classList.add('is-hover');
    setLensTarget(e);
  });
  frame.addEventListener('pointermove', setLensTarget);
  frame.addEventListener('pointerdown', (e) => {
    lens.hover = true;
    lens.pressed = true;
    setLensTarget(e);
  });
  window.addEventListener('pointerup', () => {
    lens.pressed = false;
  });
  frame.addEventListener('pointerleave', () => {
    lens.hover = false;
    lens.pressed = false;
    root.classList.remove('is-hover');
  });

  watchVisibility(frame, (v) => (visible = v));
  window.addEventListener('accentchange', () => {
    if (ready) draw();
  });

  let resizeTimer = 0;
  new ResizeObserver(() => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      if (ready && layout()) draw();
    }, 120);
  }).observe(frame);

  const fontReady = Promise.race([
    document.fonts.load('500 12px "JetBrains Mono"').catch(() => null),
    new Promise((resolve) => window.setTimeout(resolve, 1500)),
  ]);
  const prepared = Promise.all([loadImage(img), fontReady])
    .then(() => {
      ready = layout();
    })
    .catch((err: unknown) => {
      console.error('[portrait]', err);
      frame.style.setProperty('--lr', '2000px'); // fall back to the plain photo
    });

  return {
    async start(): Promise<void> {
      if (started) return;
      started = true;
      onFrame(tick); // tick lays out lazily, so the lens works even before the photo is sampled
      await prepared;
      intro = reduceMotion ? 1 : 0;
      if (ready) draw();
    },
  };
}
