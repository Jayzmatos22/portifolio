import { describe, expect, it } from 'vitest';
import {
  approach,
  createScreenX,
  indexAt,
  nearestIndex,
  poseFor,
  positionAt,
  rubberBand,
  screenScale,
  slotCenters,
  type ArcConfig,
} from './arc';

const CFG: ArcConfig = { falloff: 500, perspective: 1400, maxTurnDeg: 28, sink: 0.3, hideBeyond: 2.4 };

describe('slotCenters', () => {
  it('lays slides side by side with a gap, starting at 0', () => {
    expect(slotCenters([100, 200, 100], 10)).toEqual([0, 160, 320]);
  });

  it('returns an empty list for no slides', () => {
    expect(slotCenters([], 10)).toEqual([]);
  });
});

describe('positionAt', () => {
  const centers = [0, 160, 320];

  it('interpolates between neighbouring centers for fractional indexes', () => {
    expect(positionAt(centers, 1)).toBe(160);
    expect(positionAt(centers, 1.5)).toBe(240);
  });

  it('clamps to the first and last slide', () => {
    expect(positionAt(centers, -2)).toBe(0);
    expect(positionAt(centers, 9)).toBe(320);
  });

  it('is 0 when there are no slides', () => {
    expect(positionAt([], 1)).toBe(0);
  });
});

describe('indexAt', () => {
  const centers = [0, 160, 320];

  it('is the inverse of positionAt inside the range', () => {
    expect(indexAt(centers, 240)).toBeCloseTo(1.5);
    expect(indexAt(centers, positionAt(centers, 0.25))).toBeCloseTo(0.25);
  });

  it('clamps outside the range', () => {
    expect(indexAt(centers, -50)).toBe(0);
    expect(indexAt(centers, 999)).toBe(2);
  });

  it('handles a single slide', () => {
    expect(indexAt([0], 40)).toBe(0);
  });
});

describe('screenScale', () => {
  it('is 1 at the center and 0.5 at one falloff away', () => {
    expect(screenScale(0, 500)).toBe(1);
    expect(screenScale(500, 500)).toBeCloseTo(0.5);
  });

  it('is symmetric and shrinks with distance', () => {
    expect(screenScale(-300, 500)).toBeCloseTo(screenScale(300, 500));
    expect(screenScale(800, 500)).toBeLessThan(screenScale(400, 500));
  });
});

describe('createScreenX', () => {
  const screenX = createScreenX(500);

  it('is 0 at the center and odd-symmetric', () => {
    expect(screenX(0)).toBe(0);
    expect(screenX(-400)).toBeCloseTo(-screenX(400));
  });

  it('packs far slides tighter than their arc distance', () => {
    expect(screenX(10)).toBeCloseTo(10, 0);
    expect(screenX(1000)).toBeLessThan(1000);
    expect(screenX(1000)).toBeGreaterThan(screenX(500));
  });

  it('keeps growing beyond its lookup table', () => {
    expect(screenX(5000)).toBeGreaterThan(screenX(2500));
  });
});

describe('poseFor', () => {
  const screenX = createScreenX(CFG.falloff);

  it('puts the active slide flat, in front and unshaded', () => {
    const pose = poseFor(0, 400, CFG, screenX);
    expect(pose.x).toBeCloseTo(0);
    expect(pose.z).toBeCloseTo(0);
    expect(pose.rotateY).toBeCloseTo(0);
    expect(pose.shade).toBeCloseTo(0);
    expect(pose.visible).toBe(true);
  });

  it('pushes neighbours back and turns them toward the center', () => {
    const left = poseFor(-300, 400, CFG, screenX);
    const right = poseFor(300, 400, CFG, screenX);
    expect(left.x).toBeLessThan(0);
    expect(right.x).toBeGreaterThan(0);
    expect(left.z).toBeLessThan(0);
    expect(left.rotateY).toBeGreaterThan(0);
    expect(right.rotateY).toBeLessThan(0);
    expect(right.shade).toBeGreaterThan(0);
  });

  it('stacks closer slides above farther ones', () => {
    expect(poseFor(100, 400, CFG, screenX).zIndex).toBeGreaterThan(poseFor(600, 400, CFG, screenX).zIndex);
  });

  it('hides slides beyond the visible arc', () => {
    expect(poseFor(CFG.falloff * 3, 400, CFG, screenX).visible).toBe(false);
  });
});

describe('nearestIndex', () => {
  it('rounds and clamps to valid slide indexes', () => {
    expect(nearestIndex(1.4, 5)).toBe(1);
    expect(nearestIndex(1.6, 5)).toBe(2);
    expect(nearestIndex(-3, 5)).toBe(0);
    expect(nearestIndex(9, 5)).toBe(4);
  });
});

describe('approach', () => {
  it('does not move with no elapsed time and converges with a lot of it', () => {
    expect(approach(0, 10, 5, 0)).toBe(0);
    expect(approach(0, 10, 5, 10)).toBeCloseTo(10);
  });

  it('moves part of the way for a normal frame', () => {
    const next = approach(0, 10, 5, 1 / 60);
    expect(next).toBeGreaterThan(0);
    expect(next).toBeLessThan(10);
  });
});

describe('rubberBand', () => {
  it('leaves values inside the range untouched', () => {
    expect(rubberBand(2, 0, 4)).toBe(2);
  });

  it('resists overshooting either end', () => {
    expect(rubberBand(-2, 0, 4)).toBeCloseTo(-0.7);
    expect(rubberBand(6, 0, 4)).toBeCloseTo(4.7);
  });
});
