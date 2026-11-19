// Interaction effects: cursor, hero parallax, magnetic buttons, scramble text,
// spotlight + tilt cards, section spy, statusline, mobile menu, copy-to-clipboard.
import { gsap } from 'gsap';
import { setScrollLocked } from '../anim/motion';
import { closestFromEvent, isFinePointer, prefersReducedMotion, watchVisibility } from '../lib/dom';
import { lerp } from '../lib/math';
import { scrambleText } from '../lib/text';
import { onFrame, pointer } from '../lib/ticker';

const reduceMotion = prefersReducedMotion();

/* Cursor --------------------------------------------------------------------- */
export function initCursor(): void {
  const el = document.querySelector<HTMLElement>('.cursor');
  const dot = el?.querySelector<HTMLElement>('.cursor__dot');
  const ring = el?.querySelector<HTMLElement>('.cursor__ring');
  if (!el || !dot || !ring || !isFinePointer() || reduceMotion) return;

  document.body.classList.add('has-cursor');
  const ringX = gsap.quickTo(ring, 'x', { duration: 0.35, ease: 'power3.out' });
  const ringY = gsap.quickTo(ring, 'y', { duration: 0.35, ease: 'power3.out' });
  window.addEventListener(
    'pointermove',
    (e) => {
      gsap.set(dot, { x: e.clientX, y: e.clientY });
      ringX(e.clientX);
      ringY(e.clientY);
    },
    { passive: true },
  );

  const INTERACTIVE = 'a, button, [data-cursor], .chip, .tree li';
  document.addEventListener('pointerover', (e) => {
    if (!(e.target instanceof Element)) return;
    const target = e.target;
    el.classList.toggle('is-link', Boolean(target.closest(INTERACTIVE)));
    el.classList.toggle('is-hidden', Boolean(target.closest('[data-cursor-hide]')));
    el.classList.toggle('is-text', Boolean(target.closest('input, .term__screen')) && !target.closest('a, button'));
  });
  document.documentElement.addEventListener('pointerleave', () => el.classList.add('is-hidden'));
  document.documentElement.addEventListener('pointerenter', () => el.classList.remove('is-hidden'));
  document.addEventListener('pointerdown', () => el.classList.add('is-down'));
  document.addEventListener('pointerup', () => el.classList.remove('is-down'));
}

/* Hero: grid parallax + glow following the pointer -------------------------- */
export function initHeroParallax(): void {
  const hero = document.querySelector<HTMLElement>('.hero');
  const pattern = document.getElementById('gridPattern');
  const glow = document.querySelector<HTMLElement>('.hero__glow');
  if (!hero || !pattern || reduceMotion) return;

  let visible = true;
  watchVisibility(hero, (v) => (visible = v));
  let gx = 0;
  let gy = 0;
  let lx = window.innerWidth * 0.7;
  let ly = window.innerHeight * 0.45;

  onFrame(() => {
    if (!visible) return;
    gx = lerp(gx, pointer.nx * -28, 0.06);
    gy = lerp(gy, pointer.ny * -28, 0.06);
    pattern.setAttribute('x', gx.toFixed(2));
    pattern.setAttribute('y', gy.toFixed(2));
    if (glow && pointer.hasMoved) {
      lx = lerp(lx, pointer.x, 0.05);
      ly = lerp(ly, pointer.y + window.scrollY, 0.05);
      glow.style.transform = `translate3d(${lx.toFixed(1)}px, ${ly.toFixed(1)}px, 0)`;
    }
  });
}

/* Magnetic buttons ----------------------------------------------------------- */
export function initMagnetic(root: ParentNode = document): void {
  if (!isFinePointer() || reduceMotion) return;
  root.querySelectorAll<HTMLElement>('[data-magnetic]').forEach((el) => {
    const strength = Number.parseFloat(el.dataset.magnetic ?? '') || 0.3;
    const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3.out' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3.out' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * strength);
      yTo((e.clientY - (r.top + r.height / 2)) * strength);
    });
    el.addEventListener('pointerleave', () => {
      xTo(0);
      yTo(0);
    });
  });
}

/* Scramble text ------------------------------------------------------------- */
const activeScrambles = new WeakMap<HTMLElement, gsap.core.Tween>();

export function scramble(el: HTMLElement, duration = 0.65): void {
  const finalText = el.dataset.text ?? el.textContent ?? '';
  el.dataset.text = finalText;
  if (reduceMotion) return;
  activeScrambles.get(el)?.kill();
  const state = { progress: 0 };
  const tween = gsap.to(state, {
    progress: 1,
    duration,
    ease: 'none',
    onUpdate: () => {
      el.textContent = scrambleText(finalText, state.progress);
    },
    onComplete: () => {
      el.textContent = finalText;
    },
  });
  activeScrambles.set(el, tween);
}

export function initScramble(): void {
  document.querySelectorAll<HTMLElement>('[data-scramble]').forEach((el) => {
    const target = el.querySelector<HTMLElement>('.scr') ?? el;
    el.addEventListener('pointerenter', () => scramble(target, 0.45));
  });
}

/** Scrambles the "$ cat sobre.md"-style headings inside a revealed block. */
export function scrambleWithin(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('[data-scramble-in]').forEach((s) => scramble(s, 0.9));
}

/* Words for the scroll-lit paragraph ---------------------------------------- */
export function splitWords(el: HTMLElement | null): HTMLElement[] {
  if (!el) return [];
  const fragment = document.createDocumentFragment();
  Array.from(el.childNodes).forEach((node) => {
    const isHighlight = node.nodeType === Node.ELEMENT_NODE;
    (node.textContent ?? '').split(/(\s+)/).forEach((part) => {
      if (!part) return;
      if (/^\s+$/.test(part)) {
        fragment.append(' ');
        return;
      }
      const span = document.createElement('span');
      span.className = isHighlight ? 'w hl' : 'w';
      span.textContent = part;
      fragment.append(span);
    });
  });
  el.replaceChildren(fragment);
  return Array.from(el.querySelectorAll<HTMLElement>('.w'));
}

/* Spotlight + tilt on project windows ---------------------------------------- */
export function initSpotlight(root: ParentNode = document): void {
  const canTilt = isFinePointer() && !reduceMotion;
  root.querySelectorAll<HTMLElement>('[data-spotlight]').forEach((el) => {
    const tilt = canTilt && el.hasAttribute('data-tilt');
    if (tilt) gsap.set(el, { transformPerspective: 1400 });
    const rotX = tilt ? gsap.quickTo(el, 'rotationX', { duration: 0.8, ease: 'power3.out' }) : null;
    const rotY = tilt ? gsap.quickTo(el, 'rotationY', { duration: 0.8, ease: 'power3.out' }) : null;

    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      el.style.setProperty('--mx', `${x.toFixed(0)}px`);
      el.style.setProperty('--my', `${y.toFixed(0)}px`);
      rotY?.((x / r.width - 0.5) * 7);
      rotX?.((0.5 - y / r.height) * 7);
    });
    el.addEventListener('pointerleave', () => {
      rotX?.(0);
      rotY?.(0);
    });
  });
}

/* Section spy: active nav link + statusline path ---------------------------- */
export function initSectionSpy(onChange: (id: string) => void): void {
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(
    (entries) => entries.forEach((entry) => entry.isIntersecting && onChange(entry.target.id)),
    { rootMargin: '-45% 0px -50% 0px' },
  );
  document.querySelectorAll('main > section[id]').forEach((s) => io.observe(s));
}

/* Statusline ------------------------------------------------------------------ */
export type EditorMode = 'NORMAL' | 'INSERT';

export function initStatusline(): void {
  const clock = document.getElementById('slClock');
  const pct = document.getElementById('slPct');
  const updateClock = (): void => {
    if (clock) clock.textContent = new Date().toLocaleTimeString('pt-BR');
  };
  updateClock();
  window.setInterval(updateClock, 1000);

  const onScroll = (): void => {
    if (!pct) return;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const p = max > 0 ? window.scrollY / max : 0;
    pct.textContent = p < 0.01 ? 'Top' : p > 0.99 ? 'Bot' : `${Math.round(p * 100)}%`;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

export function setStatus({ mode, path, theme }: { mode?: EditorMode; path?: string; theme?: string }): void {
  const modeEl = document.getElementById('slMode');
  if (mode && modeEl) {
    modeEl.textContent = mode;
    modeEl.classList.toggle('is-insert', mode === 'INSERT');
  }
  const pathEl = document.getElementById('slPath');
  if (path !== undefined && pathEl) pathEl.textContent = path;
  const themeEl = document.getElementById('slTheme');
  if (theme && themeEl) themeEl.textContent = `tema: ${theme}`;
}

/* Mobile menu ------------------------------------------------------------------ */
export function initMenu(): void {
  const button = document.getElementById('menuBtn');
  const menu = document.getElementById('menu');
  if (!button || !menu) return;
  const setOpen = (open: boolean): void => {
    menu.classList.toggle('is-open', open);
    menu.inert = !open;
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    setScrollLocked(open);
  };
  setOpen(false);
  button.addEventListener('click', () => setOpen(!menu.classList.contains('is-open')));
  menu.addEventListener('click', (e) => {
    if (closestFromEvent(e, 'a')) setOpen(false);
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.classList.contains('is-open')) setOpen(false);
  });
}

/* Copy-to-clipboard rows ------------------------------------------------------- */
export function initCopy(): void {
  document.addEventListener('click', (e) => {
    const btn = closestFromEvent<HTMLElement>(e, '[data-copy]');
    if (!btn) return;
    const label = btn.querySelector<HTMLElement>('[data-copy-label]');
    const setLabel = (text: string): void => {
      if (label) label.textContent = text;
    };
    navigator.clipboard
      .writeText(btn.dataset.copy ?? '')
      .then(() => setLabel('copiado ✓'))
      .catch(() => setLabel('copie manualmente'))
      .finally(() => window.setTimeout(() => setLabel('copiar'), 2000));
  });
}
