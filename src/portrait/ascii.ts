// Pure image -> ASCII math (no DOM), so it can be unit tested.
import { clamp, smoothstep } from '../lib/math';

/** Glyphs ordered from empty to densest. */
export const RAMP = ' .:-=+*xo#%@';

export function charFor(value: number): string {
  return RAMP.charAt(Math.round(clamp(value) * (RAMP.length - 1)));
}

type Rgb = readonly [number, number, number];

/** Average color of the top-left and top-right corners, where the photo's backdrop is. */
function estimateBackground(data: ArrayLike<number>, cols: number, rows: number): Rgb {
  const bandWidth = Math.max(2, Math.round(cols * 0.12));
  const bandHeight = Math.max(2, Math.round(rows * 0.08));
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let y = 0; y < bandHeight; y++) {
    for (let x = 0; x < cols; x++) {
      if (x >= bandWidth && x < cols - bandWidth) continue;
      const o = (y * cols + x) * 4;
      r += data[o];
      g += data[o + 1];
      b += data[o + 2];
      n++;
    }
  }
  return n ? [r / n, g / n, b / n] : [0, 0, 0];
}

/**
 * Converts an RGBA buffer (cols x rows) into 0..1 "ink" per cell.
 * The backdrop is suppressed, the subject keeps a minimum density (so dark hair
 * still shows texture), edges add detail and a soft vignette frames the face.
 */
export function inkFromPixels(data: ArrayLike<number>, cols: number, rows: number): Float32Array {
  const total = cols * rows;
  const lum = new Float32Array(total);
  for (let i = 0; i < total; i++) {
    const o = i * 4;
    lum[i] = (0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2]) / 255;
  }
  const [bgR, bgG, bgB] = estimateBackground(data, cols, rows);
  const values = new Float32Array(total);

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      const o = i * 4;
      const dist = Math.hypot(data[o] - bgR, data[o + 1] - bgG, data[o + 2] - bgB);
      const foreground = smoothstep(22, 62, dist);
      const L = lum[i];
      const right = lum[y * cols + Math.min(cols - 1, x + 1)];
      const down = lum[Math.min(rows - 1, y + 1) * cols + x];
      const detail = Math.min(1, (Math.abs(L - right) + Math.abs(L - down)) * 2.2);
      const nx = (x / cols - 0.5) / 0.56;
      const ny = (y / rows - 0.46) / 0.6;
      const vignette = 1 - smoothstep(0.8, 1.15, Math.hypot(nx, ny));
      const tone = smoothstep(0.04, 0.92, Math.pow(L, 1.1));
      const subject = Math.max(tone, 0.16 + detail * 0.5);
      values[i] = clamp((foreground * subject + (1 - foreground) * tone * 0.1) * vignette);
    }
  }
  return values;
}

export function valuesToLines(values: ArrayLike<number>, cols: number, rows: number): string[] {
  const lines: string[] = [];
  for (let y = 0; y < rows; y++) {
    let line = '';
    for (let x = 0; x < cols; x++) line += charFor(values[y * cols + x]);
    lines.push(line.replace(/\s+$/, ''));
  }
  return lines;
}
