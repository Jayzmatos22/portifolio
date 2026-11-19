// Hero portrait: the photo is rendered as live ASCII on a canvas; a "lens" that follows
// the pointer (or drifts on its own when idle) reveals the real photo through a CSS mask.
import { onFrame, lerp, clamp, smoothstep, prefersReducedMotion, watchVisibility } from './core.js';
import { getAccent } from './theme.js';

const RAMP = ' .:-=+*xo#%@';
const GLITCH = '01<>/\\{}[]$#_=+';
const CHAR_ASPECT = 0.6; // monospace advance width / font size
const CELL_RATIO = 1.72; // cell height / cell width
const LEVELS = 10;
const INTRO_MS = 1500;
const GLITCH_EVERY_MS = 90;

function waitForImage(img) {
  if (img.complete) {
    return img.naturalWidth ? Promise.resolve(img) : Promise.reject(new Error('portrait image failed to load'));
  }
  return new Promise((resolve, reject) => {
    img.addEventListener('load', () => resolve(img), { once: true });
    img.addEventListener('error', () => reject(new Error('portrait image failed to load')), { once: true });
  });
}

/** Waits for the photo; retries once with a cache-busting URL if the first request failed. */
async function loadImage(img) {
  try {
    return await waitForImage(img);
  } catch {
    const url = new URL(img.currentSrc || img.src, window.location.href);
    url.searchParams.set('retry', Date.now().toString(36));
    img.src = url.href;
    return waitForImage(img);
  }
}

/**
 * Samples the image into a grid of 0..1 "ink" values. Background (estimated from the top
 * corners) is suppressed, the subject keeps a minimum density so dark hair still shows texture.
 * @param {HTMLImageElement} img
 * @param {number} cols
 * @param {number} rows
 * @returns {Float32Array}
 */
export function sampleValues(img, cols, rows) {
  const canvas = document.createElement('canvas');
  canvas.width = cols;
  canvas.height = rows;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, cols, rows);
  const { data } = ctx.getImageData(0, 0, cols, rows);
  const total = cols * rows;

  const lum = new Float32Array(total);
  for (let i = 0; i < total; i++) {
    const o = i * 4;
    lum[i] = (0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2]) / 255;
  }

  const bg = [0, 0, 0];
  let n = 0;
  const bw = Math.max(2, Math.round(cols * 0.12));
  const bh = Math.max(2, Math.round(rows * 0.08));
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < cols; x++) {
      if (x >= bw && x < cols - bw) continue;
      const o = (y * cols + x) * 4;
      bg[0] += data[o];
      bg[1] += data[o + 1];
      bg[2] += data[o + 2];
      n++;
    }
  }
  bg[0] /= n;
  bg[1] /= n;
  bg[2] /= n;

  const values = new Float32Array(total);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      const o = i * 4;
      const dist = Math.hypot(data[o] - bg[0], data[o + 1] - bg[1], data[o + 2] - bg[2]);
      const fg = smoothstep(22, 62, dist);
      const L = lum[i];
      const right = lum[y * cols + Math.min(cols - 1, x + 1)];
      const down = lum[Math.min(rows - 1, y + 1) * cols + x];
      const detail = Math.min(1, (Math.abs(L - right) + Math.abs(L - down)) * 2.2);
      const nx = (x / cols - 0.5) / 0.56;
      const ny = (y / rows - 0.46) / 0.6;
      const vignette = 1 - smoothstep(0.8, 1.15, Math.hypot(nx, ny));
      const tone = smoothstep(0.04, 0.92, Math.pow(L, 1.1));
      const subject = Math.max(tone, 0.16 + detail * 0.5);
      values[i] = clamp((fg * subject + (1 - fg) * tone * 0.1) * vignette);
    }
  }
  return values;
}

/** ASCII lines of the image, for the terminal's `neofetch`. */
export function asciiLines(img, cols = 44, cellRatio = 1.9) {
  if (!img?.naturalWidth) return [];
  const rows = Math.round((cols * (img.naturalHeight / img.naturalWidth)) / cellRatio);
  const values = sampleValues(img, cols, rows);
  const lines = [];
  for (let y = 0; y < rows; y++) {
    let line = '';
    for (let x = 0; x < cols; x++) line += RAMP[Math.round(values[y * cols + x] * (RAMP.length - 1))];
    lines.push(line.replace(/\s+$/, ''));
  }
  return lines;
}

export function initPortrait(root) {
  const frame = root?.querySelector('.portrait__frame');
  const canvas = root?.querySelector('.portrait__ascii');
  const img = root?.querySelector('.portrait__photo');
  const lensEl = root?.querySelector('.portrait__lens');
  const hud = root?.querySelector('[data-hud-pos]');
  if (!frame || !canvas || !img) return { start() {} };

  const ctx = canvas.getContext('2d');
  const reduceMotion = prefersReducedMotion();
  const grid = { cols: 0, rows: 0, cw: 0, ch: 0, w: 0, h: 0, values: null, chars: null };
  const glitches = new Map(); // cell index -> { ch, until }
  const lens = { x: 0, y: 0, tx: 0, ty: 0, r: 0, hover: false, pressed: false, t: Math.random() * 10 };
  let ready = false;
  let started = false;
  let visible = true;
  let intro = reduceMotion ? 1 : 0;
  let lastGlitch = 0;
  let nextWave = 3000;

  function layout() {
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
    grid.chars = Array.from(grid.values, (v) => RAMP[Math.round(v * (RAMP.length - 1))]);
    ctx.font = `500 ${(grid.cw / CHAR_ASPECT).toFixed(2)}px "JetBrains Mono", monospace`;
    ctx.textBaseline = 'top';
    lens.r = Math.max(70, Math.min(150, rect.width * 0.24));
    if (!lens.x) {
      lens.x = lens.tx = rect.width * 0.5;
      lens.y = lens.ty = rect.height * 0.42;
    }
    return true;
  }

  function draw() {
    const { cols, rows, cw, ch, values, chars } = grid;
    if (!values) return;
    const { rgb } = getAccent();
    ctx.clearRect(0, 0, grid.w, grid.h);
    const revealRow = intro * (rows + 8);
    const buckets = Array.from({ length: LEVELS }, () => []);
    const now = performance.now();

    for (let y = 0; y < rows && y <= revealRow; y++) {
      const isFront = intro < 1 && revealRow - y < 8;
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        let v = values[i];
        let glyph = chars[i];
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
          glyph = GLITCH[(Math.random() * GLITCH.length) | 0];
          v = Math.min(1, v + 0.5);
        }
        if (glyph === ' ') continue;
        buckets[Math.min(LEVELS - 1, (v * LEVELS) | 0)].push(x * cw, y * ch, glyph);
      }
    }
    buckets.forEach((cells, level) => {
      if (!cells.length) return;
      const alpha = (0.16 + (level / (LEVELS - 1)) * 0.84).toFixed(3);
      ctx.fillStyle = level >= LEVELS - 1 ? `rgba(236, 255, 242, ${alpha})` : `rgba(${rgb}, ${alpha})`;
      for (let k = 0; k < cells.length; k += 3) ctx.fillText(cells[k + 2], cells[k], cells[k + 1]);
    });
  }

  function addGlitches(now) {
    const { cols, rows, values } = grid;
    for (let n = 0; n < 14; n++) {
      const i = (Math.random() * values.length) | 0;
      if (values[i] < 0.15) continue;
      glitches.set(i, { ch: GLITCH[(Math.random() * GLITCH.length) | 0], until: now + 120 + Math.random() * 380 });
    }
    if (now > nextWave) {
      // A horizontal "interference" band across a couple of rows.
      const row = (Math.random() * rows) | 0;
      for (let y = row; y < Math.min(rows, row + 2); y++) {
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x;
          if (values[i] > 0.08) glitches.set(i, { ch: GLITCH[(Math.random() * GLITCH.length) | 0], until: now + 160 });
        }
      }
      nextWave = now + 2500 + Math.random() * 3000;
    }
  }

  function updateLens(dt) {
    if (!lens.hover) {
      lens.t += dt * 0.00045;
      lens.tx = grid.w * (0.5 + Math.sin(lens.t * 1.3) * 0.17);
      lens.ty = grid.h * (0.4 + Math.sin(lens.t * 2.1) * 0.1);
    }
    const ease = lens.hover ? 0.16 : 0.035;
    lens.x = lerp(lens.x, lens.tx, ease);
    lens.y = lens.y ? lerp(lens.y, lens.ty, ease) : lens.ty;
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

  function tick(time, dt) {
    if (!visible) return;
    if (!ready) {
      ready = img.naturalWidth > 0 && layout();
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

  const setLensTarget = (e) => {
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
  window.addEventListener('pointerup', () => (lens.pressed = false));
  frame.addEventListener('pointerleave', () => {
    lens.hover = false;
    lens.pressed = false;
    root.classList.remove('is-hover');
  });

  watchVisibility(frame, (v) => (visible = v));
  window.addEventListener('accentchange', () => ready && draw());

  let resizeTimer = 0;
  new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (ready && layout()) draw();
    }, 120);
  }).observe(frame);

  const fontReady = Promise.race([
    document.fonts?.load('500 12px "JetBrains Mono"').catch(() => null),
    new Promise((resolve) => setTimeout(resolve, 1500)),
  ]);
  const prepared = Promise.all([loadImage(img), fontReady])
    .then(() => {
      ready = layout();
      if (ready && !started) {
        intro = 0;
        draw();
      }
    })
    .catch((err) => {
      console.error('[portrait]', err);
      frame.style.setProperty('--lr', '2000px'); // show the plain photo
    });

  return {
    /** Starts the decode intro + live loop (called after the boot sequence). */
    async start() {
      if (started) return;
      started = true;
      onFrame(tick); // tick lays out lazily, so the lens works even before the photo is sampled
      await prepared;
      intro = reduceMotion ? 1 : 0;
      if (ready) draw();
    },
  };
}
