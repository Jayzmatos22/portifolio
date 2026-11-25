// Scroll and motion layer: Lenis smooth scrolling + GSAP (ScrollTrigger, SplitText).
// Everything degrades to the final, static state when the user prefers reduced motion.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';
import { closestFromEvent, prefersReducedMotion } from '../lib/dom';

gsap.registerPlugin(ScrollTrigger, SplitText);

const reduceMotion = prefersReducedMotion();
const NAV_OFFSET = -72;
const EASE = 'expo.out';

let lenis: Lenis | null = null;

/* Smooth scroll ------------------------------------------------------------ */

export function initSmoothScroll(): void {
  if (reduceMotion) return;
  lenis = new Lenis({ lerp: 0.1, autoRaf: false });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis?.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  // In-page anchors scroll through Lenis so they share its easing.
  document.addEventListener('click', (e) => {
    const link = closestFromEvent<HTMLAnchorElement>(e, 'a[href^="#"]');
    if (!link || link.hasAttribute('data-focus-terminal')) return;
    const id = link.getAttribute('href')?.slice(1) ?? '';
    const target = id ? document.getElementById(id) : null;
    if (!target) return;
    e.preventDefault();
    scrollToElement(target);
  });
}

export function scrollToElement(el: HTMLElement, onComplete?: () => void): void {
  const offset = el.id === 'inicio' ? 0 : NAV_OFFSET;
  if (lenis) {
    lenis.scrollTo(el, { offset, duration: 1.4, onComplete: () => onComplete?.() });
    return;
  }
  el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
  onComplete?.();
}

export function scrollToId(id: string, onComplete?: () => void): void {
  const el = document.getElementById(id);
  if (el) scrollToElement(el, onComplete);
}

/** Pauses page scrolling (e.g. while the mobile menu is open). */
export function setScrollLocked(locked: boolean): void {
  if (lenis) {
    if (locked) lenis.stop();
    else lenis.start();
  }
  document.body.style.overflow = locked ? 'hidden' : '';
}

/* Entrance ----------------------------------------------------------------- */

/** Hero entrance after the boot screen: nav drops, title letters rise, the rest fades up. */
export function playIntro(): void {
  const nav = document.querySelector<HTMLElement>('.nav__pill');
  const titleLines = gsap.utils.toArray<HTMLElement>('.hero__title .line');
  const rest = gsap.utils.toArray<HTMLElement>('.rise').filter((el) => !titleLines.includes(el));

  if (reduceMotion) {
    gsap.set([nav, ...titleLines, ...rest], { opacity: 1, clearProps: 'transform,filter' });
    return;
  }

  const tl = gsap.timeline({ defaults: { ease: EASE } });
  if (nav) tl.fromTo(nav, { y: -18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9 }, 0.05);

  gsap.set(titleLines, { opacity: 1 });
  titleLines.forEach((line, i) => {
    // "words,chars": letters sit inside a word wrapper, so a line can never break mid-word.
    const split = SplitText.create(line, { type: 'words,chars', mask: 'chars', aria: 'auto' });
    tl.from(split.chars, { yPercent: 110, duration: 1.1, stagger: 0.035 }, 0.15 + i * 0.12);
  });

  tl.fromTo(
    rest,
    { y: 28, opacity: 0, filter: 'blur(8px)' },
    { y: 0, opacity: 1, filter: 'blur(0px)', duration: 1.1, stagger: 0.08, clearProps: 'filter' },
    0.35,
  );
}

/* Scroll-driven ---------------------------------------------------------- */

/** Fades/blurs [data-reveal] blocks in as they enter the viewport. */
export function initReveals(onReveal?: (el: HTMLElement) => void): void {
  const items = gsap.utils.toArray<HTMLElement>('[data-reveal]');
  if (reduceMotion) {
    gsap.set(items, { opacity: 1 });
    items.forEach((el) => onReveal?.(el));
    return;
  }
  gsap.set(items, { y: 32, opacity: 0, filter: 'blur(6px)' });
  ScrollTrigger.batch(items, {
    start: 'top 88%',
    once: true,
    onEnter: (batch) => {
      gsap.to(batch, { y: 0, opacity: 1, filter: 'blur(0px)', duration: 1.1, ease: EASE, stagger: 0.1, clearProps: 'filter,transform' });
      batch.forEach((el) => onReveal?.(el as HTMLElement));
    },
  });
}

/** Lights the "sobre" paragraph word by word, scrubbed to the scroll position. */
export function initWordScrub(container: HTMLElement, words: readonly HTMLElement[]): void {
  if (reduceMotion) {
    words.forEach((w) => w.classList.add('is-lit'));
    return;
  }
  let litCount = -1;
  ScrollTrigger.create({
    trigger: container,
    start: 'top 82%',
    end: 'bottom 45%',
    scrub: true,
    onUpdate: (self) => {
      const count = Math.round(self.progress * words.length);
      if (count === litCount) return;
      litCount = count;
      words.forEach((w, i) => w.classList.toggle('is-lit', i < count));
    },
  });
}

/** Depth while scrolling: the hero drifts apart and project numbers float. */
export function initParallax(): void {
  if (reduceMotion) return;
  const heroScroll = { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true };
  gsap.to('.hero__copy', { yPercent: -14, opacity: 0.15, ease: 'none', scrollTrigger: heroScroll });
  gsap.to('.portrait__frame', { yPercent: 8, scale: 0.96, ease: 'none', scrollTrigger: heroScroll });

  gsap.utils.toArray<HTMLElement>('.project__index').forEach((el) => {
    gsap.fromTo(
      el,
      { yPercent: 35 },
      { yPercent: -35, ease: 'none', scrollTrigger: { trigger: el.closest('.project') ?? el, start: 'top bottom', end: 'bottom top', scrub: true } },
    );
  });

  const contactTitle = document.querySelector<HTMLElement>('.contact__title');
  if (contactTitle) {
    const split = SplitText.create(contactTitle, { type: 'lines', mask: 'lines', aria: 'auto' });
    gsap.from(split.lines, {
      yPercent: 100,
      duration: 1.2,
      ease: EASE,
      stagger: 0.12,
      scrollTrigger: { trigger: contactTitle, start: 'top 85%' },
    });
  }
}

export function refreshScroll(): void {
  ScrollTrigger.refresh();
}
