// One frame loop for the whole page (GSAP's ticker) plus shared pointer state.
import { gsap } from 'gsap';

export type FrameCallback = (timeMs: number, deltaMs: number) => void;

const MAX_DELTA_MS = 64;

/** Runs `fn` every frame. A callback that throws is logged and removed. Returns an unsubscribe function. */
export function onFrame(fn: FrameCallback): () => void {
  const handler = (time: number, deltaTime: number): void => {
    try {
      fn(time * 1000, Math.min(MAX_DELTA_MS, deltaTime));
    } catch (err) {
      console.error('[frame]', err);
      gsap.ticker.remove(handler);
    }
  };
  gsap.ticker.add(handler);
  return () => gsap.ticker.remove(handler);
}

export interface PointerState {
  x: number;
  y: number;
  /** Normalized -0.5..0.5 relative to the viewport center. */
  nx: number;
  ny: number;
  hasMoved: boolean;
}

export const pointer: PointerState = {
  x: window.innerWidth / 2,
  y: window.innerHeight / 2,
  nx: 0,
  ny: 0,
  hasMoved: false,
};

window.addEventListener(
  'pointermove',
  (e) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.nx = e.clientX / window.innerWidth - 0.5;
    pointer.ny = e.clientY / window.innerHeight - 0.5;
    pointer.hasMoved = true;
  },
  { passive: true },
);
