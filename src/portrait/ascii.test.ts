import { describe, expect, it } from 'vitest';
import { charFor, inkFromPixels, RAMP, valuesToLines } from './ascii';

/** Builds an RGBA buffer filled with `bg`, with an optional block of `fg` pixels. */
function image(
  cols: number,
  rows: number,
  bg: readonly [number, number, number],
  fg?: { color: readonly [number, number, number]; x0: number; y0: number; x1: number; y1: number },
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(cols * rows * 4);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const inside = fg && x >= fg.x0 && x < fg.x1 && y >= fg.y0 && y < fg.y1;
      const [r, g, b] = inside ? fg.color : bg;
      const o = (y * cols + x) * 4;
      data[o] = r;
      data[o + 1] = g;
      data[o + 2] = b;
      data[o + 3] = 255;
    }
  }
  return data;
}

describe('charFor', () => {
  it('maps 0 to blank and 1 to the densest glyph', () => {
    expect(charFor(0)).toBe(' ');
    expect(charFor(1)).toBe(RAMP[RAMP.length - 1]);
  });

  it('clamps out-of-range values', () => {
    expect(charFor(-2)).toBe(' ');
    expect(charFor(5)).toBe(RAMP[RAMP.length - 1]);
  });
});

describe('inkFromPixels', () => {
  it('suppresses a uniform background', () => {
    const values = inkFromPixels(image(20, 20, [170, 170, 175]), 20, 20);
    expect(Math.max(...values)).toBeLessThan(0.1);
  });

  it('gives the subject (pixels unlike the background) much more ink', () => {
    const cols = 20;
    const rows = 20;
    const data = image(cols, rows, [170, 170, 175], { color: [230, 190, 160], x0: 7, y0: 7, x1: 13, y1: 13 });
    const values = inkFromPixels(data, cols, rows);
    const center = values[10 * cols + 10];
    const corner = values[1 * cols + 1];
    expect(center).toBeGreaterThan(0.4);
    expect(center).toBeGreaterThan(corner * 5);
  });

  it('keeps a minimum density on dark subject pixels so hair stays visible', () => {
    const cols = 20;
    const rows = 20;
    const data = image(cols, rows, [170, 170, 175], { color: [10, 10, 10], x0: 7, y0: 7, x1: 13, y1: 13 });
    const values = inkFromPixels(data, cols, rows);
    expect(values[10 * cols + 10]).toBeGreaterThanOrEqual(0.15);
  });

  it('returns one value per cell, all within 0..1', () => {
    const values = inkFromPixels(image(8, 6, [0, 0, 0]), 8, 6);
    expect(values).toHaveLength(48);
    expect(values.every((v) => v >= 0 && v <= 1)).toBe(true);
  });
});

describe('valuesToLines', () => {
  it('builds one line per row and trims trailing blanks', () => {
    const lines = valuesToLines([1, 0, 0, 1, 1, 0], 3, 2);
    expect(lines).toEqual([RAMP[RAMP.length - 1], `${RAMP[RAMP.length - 1]}${RAMP[RAMP.length - 1]}`]);
  });
});
