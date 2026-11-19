// Shared helpers: one requestAnimationFrame loop, pointer state, math, media queries.

const subscribers = new Set();
let running = false;
let lastTime = 0;

function tick(time) {
  const dt = Math.min(64, time - (lastTime || time));
  lastTime = time;
  subscribers.forEach((fn) => {
    try {
      fn(time, dt);
    } catch (err) {
      console.error('[frame]', err);
      subscribers.delete(fn);
    }
  });
  if (subscribers.size) {
    requestAnimationFrame(tick);
  } else {
    running = false;
    lastTime = 0;
  }
}

/** Subscribe to the shared frame loop. Returns an unsubscribe function. */
export function onFrame(fn) {
  subscribers.add(fn);
  if (!running) {
    running = true;
    requestAnimationFrame(tick);
  }
  return () => subscribers.delete(fn);
}

export const pointer = {
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

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
export const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const isFinePointer = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ESCAPES[c]);

/** Only allow http(s) and mailto links to be rendered from data. */
export const safeUrl = (url) => (/^(https?:|mailto:)/i.test(url || '') ? url : '');

/** Calls back with true/false as the element enters/leaves the viewport. */
export function watchVisibility(el, callback, options = { threshold: 0.01 }) {
  if (!('IntersectionObserver' in window)) {
    callback(true);
    return () => {};
  }
  const io = new IntersectionObserver(([entry]) => callback(entry.isIntersecting), options);
  io.observe(el);
  return () => io.disconnect();
}
