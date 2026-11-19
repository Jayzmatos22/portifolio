// Small DOM/media-query helpers.

export const prefersReducedMotion = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const isFinePointer = (): boolean => window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/** Calls back with true/false as the element enters/leaves the viewport. Returns a disposer. */
export function watchVisibility(
  el: Element,
  callback: (visible: boolean) => void,
  options: IntersectionObserverInit = { threshold: 0.01 },
): () => void {
  if (!('IntersectionObserver' in window)) {
    callback(true);
    return () => undefined;
  }
  const io = new IntersectionObserver((entries) => {
    const entry = entries[entries.length - 1];
    if (entry) callback(entry.isIntersecting);
  }, options);
  io.observe(el);
  return () => io.disconnect();
}

export const closestFromEvent = <T extends Element>(event: Event, selector: string): T | null =>
  event.target instanceof Element ? event.target.closest<T>(selector) : null;
