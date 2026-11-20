// Pure geometry for the curved 3D gallery: slides sit on an arc that recedes into depth,
// getting smaller, darker and turned toward the center the farther they are. No DOM here.
import { clamp } from '../lib/math';

export interface ArcConfig {
  /** Arc distance (px) at which a slide renders at half size. */
  readonly falloff: number;
  /** CSS perspective (px) of the stage. */
  readonly perspective: number;
  /** Max Y rotation (deg) for side slides. */
  readonly maxTurnDeg: number;
  /** How much far slides sink below the center line (0..1 of half the height). */
  readonly sink: number;
  /** Slides farther than falloff × hideBeyond are hidden. */
  readonly hideBeyond: number;
}

export interface SlidePose {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly rotateY: number;
  readonly scale: number;
  readonly shade: number;
  readonly zIndex: number;
  readonly visible: boolean;
}

const FALLOFF_POWER = 1.6;
const MAX_SHADE = 0.72;

/** Centers of slides laid side by side along the arc, the first one at 0. */
export function slotCenters(widths: readonly number[], gap: number): number[] {
  const centers: number[] = [];
  widths.forEach((width, i) => {
    if (i === 0) {
      centers.push(0);
      return;
    }
    const previous = centers[i - 1] ?? 0;
    centers.push(previous + (widths[i - 1] ?? 0) / 2 + gap + width / 2);
  });
  return centers;
}

/** Arc position of a fractional slide index (clamped to the first/last slide). */
export function positionAt(centers: readonly number[], index: number): number {
  if (!centers.length) return 0;
  const s = clamp(index, 0, centers.length - 1);
  const i = Math.floor(s);
  const from = centers[i] ?? 0;
  const to = centers[Math.min(i + 1, centers.length - 1)] ?? from;
  return from + (to - from) * (s - i);
}

/** Inverse of positionAt: the fractional slide index at an arc position. */
export function indexAt(centers: readonly number[], position: number): number {
  const last = centers.length - 1;
  if (last <= 0) return 0;
  if (position <= (centers[0] ?? 0)) return 0;
  if (position >= (centers[last] ?? 0)) return last;
  let i = 0;
  while (i < last && position > (centers[i + 1] ?? 0)) i++;
  const from = centers[i] ?? 0;
  const to = centers[i + 1] ?? from;
  return to === from ? i : i + (position - from) / (to - from);
}

/** On-screen scale of a slide at arc distance u. */
export const screenScale = (u: number, falloff: number): number => 1 / (1 + Math.pow(Math.abs(u) / falloff, FALLOFF_POWER));

/**
 * Screen-space x for an arc distance: the integral of screenScale, so far slides
 * pack tighter instead of running off-screen. Precomputed as a lookup table.
 */
export function createScreenX(falloff: number, step = 2): (u: number) => number {
  const limit = falloff * 4;
  const table: number[] = [0];
  for (let u = step; u <= limit; u += step) {
    table.push((table[table.length - 1] ?? 0) + step * screenScale(u - step / 2, falloff));
  }
  const lastIndex = table.length - 1;
  const lastValue = table[lastIndex] ?? 0;
  const tailSlope = screenScale(limit, falloff);

  return (u: number): number => {
    const distance = Math.abs(u);
    const position = distance / step;
    let value: number;
    if (position >= lastIndex) {
      value = lastValue + (distance - lastIndex * step) * tailSlope;
    } else {
      const i = Math.floor(position);
      const from = table[i] ?? 0;
      const to = table[i + 1] ?? from;
      value = from + (to - from) * (position - i);
    }
    return Math.sign(u) * value;
  };
}

/** 3D transform for a slide at arc distance u from the center. */
export function poseFor(u: number, height: number, cfg: ArcConfig, screenX: (u: number) => number): SlidePose {
  const scale = screenScale(u, cfg.falloff);
  const k = 1 / scale;
  const z = cfg.perspective * (1 - k);
  return {
    // Placed at depth z, the perspective projection brings x back to screenX(u).
    x: screenX(u) * k,
    y: height * 0.5 * (1 - scale) * cfg.sink * k,
    z,
    rotateY: -Math.sign(u) * Math.min(1, Math.abs(u) / cfg.falloff) * cfg.maxTurnDeg,
    scale,
    shade: Math.min(MAX_SHADE, (1 - scale) * 0.95),
    zIndex: Math.round(3000 + z),
    visible: Math.abs(u) < cfg.falloff * cfg.hideBeyond,
  };
}

export const nearestIndex = (s: number, count: number): number => clamp(Math.round(s), 0, Math.max(0, count - 1));

/** Frame-rate independent exponential approach toward a target. */
export const approach = (current: number, target: number, rate: number, dtSeconds: number): number =>
  current + (target - current) * (1 - Math.exp(-rate * dtSeconds));

/** Lets a dragged value overshoot the ends, but with resistance. */
export function rubberBand(value: number, min: number, max: number, strength = 0.35): number {
  if (value < min) return min + (value - min) * strength;
  if (value > max) return max + (value - max) * strength;
  return value;
}
