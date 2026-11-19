/** Linear interpolation from `a` to `b` by `t` (0..1). */
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Restricts `value` to the [min, max] range (0..1 by default). */
export const clamp = (value: number, min = 0, max = 1): number => Math.min(max, Math.max(min, value));

/** Hermite smoothstep between two edges, returning 0..1. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

export const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
