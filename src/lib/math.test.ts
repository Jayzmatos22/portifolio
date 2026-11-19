import { describe, expect, it, vi } from 'vitest';
import { clamp, lerp, smoothstep, wait } from './math';

describe('wait', () => {
  it('resolves after the given delay', async () => {
    vi.useFakeTimers();
    let done = false;
    const promise = wait(200).then(() => {
      done = true;
    });
    await vi.advanceTimersByTimeAsync(199);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await promise;
    expect(done).toBe(true);
    vi.useRealTimers();
  });
});

describe('lerp', () => {
  it('returns the start value at t = 0 and the end value at t = 1', () => {
    expect(lerp(10, 20, 0)).toBe(10);
    expect(lerp(10, 20, 1)).toBe(20);
  });

  it('interpolates linearly between the two values', () => {
    expect(lerp(0, 100, 0.25)).toBe(25);
  });
});

describe('clamp', () => {
  it('defaults to the 0..1 range', () => {
    expect(clamp(-0.5)).toBe(0);
    expect(clamp(1.5)).toBe(1);
    expect(clamp(0.3)).toBe(0.3);
  });

  it('respects custom bounds', () => {
    expect(clamp(15, 0, 10)).toBe(10);
    expect(clamp(-3, -2, 2)).toBe(-2);
  });
});

describe('smoothstep', () => {
  it('is 0 below the first edge and 1 above the second edge', () => {
    expect(smoothstep(0.2, 0.8, 0.1)).toBe(0);
    expect(smoothstep(0.2, 0.8, 0.9)).toBe(1);
  });

  it('is 0.5 halfway between the edges', () => {
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5);
  });

  it('eases in and out (slower near the edges)', () => {
    expect(smoothstep(0, 1, 0.1)).toBeLessThan(0.1);
    expect(smoothstep(0, 1, 0.9)).toBeGreaterThan(0.9);
  });
});
