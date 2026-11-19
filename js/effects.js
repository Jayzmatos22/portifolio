// Page-wide interaction effects: cursor, parallax, magnetic buttons, scramble text,
// scroll reveals, word-by-word lighting, card spotlight, section spy, statusline, menu.
import { onFrame, pointer, lerp, clamp, prefersReducedMotion, isFinePointer, watchVisibility } from './core.js';

const reduceMotion = prefersReducedMotion();

/* Cursor ------------------------------------------------------------------- */
export function initCursor() {
  const el = document.querySelector('.cursor');
  if (!el || !isFinePointer() || reduceMotion) return;
  document.body.classList.add('has-cursor');
  const dot = el.querySelector('.cursor__dot');
  const ring = el.querySelector('.cursor__ring');
  let rx = pointer.x;
  let ry = pointer.y;

  onFrame(() => {
    rx = lerp(rx, pointer.x, 0.2);
    ry = lerp(ry, pointer.y, 0.2);
    dot.style.transform = `translate3d(${pointer.x}px, ${pointer.y}px, 0)`;
    ring.style.transform = `translate3d(${rx.toFixed(1)}px, ${ry.toFixed(1)}px, 0)`;
  });

  const INTERACTIVE = 'a, button, [data-cursor], .chip, .tree li';
  document.addEventListener('pointerover', (e) => {
    const target = e.target instanceof Element ? e.target : null;
    if (!target) return;
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
export function initHeroParallax() {
  const hero = document.querySelector('.hero');
  const pattern = document.getElementById('gridPattern');
  const glow = document.querySelector('.hero__glow');
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

/* Magnetic buttons ---------------------------------------------------------- */
export function initMagnetic(root = document) {
  if (!isFinePointer() || reduceMotion) return;
  root.querySelectorAll('[data-magnetic]:not([data-magnetic-bound])').forEach((el) => {
    el.setAttribute('data-magnetic-bound', '');
    const strength = parseFloat(el.dataset.magnetic) || 0.3;
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--tx', `${((e.clientX - (r.left + r.width / 2)) * strength).toFixed(1)}px`);
      el.style.setProperty('--ty', `${((e.clientY - (r.top + r.height / 2)) * strength).toFixed(1)}px`);
    });
    el.addEventListener('pointerleave', () => {
      el.style.setProperty('--tx', '0px');
      el.style.setProperty('--ty', '0px');
    });
  });
}

/* Scramble text ------------------------------------------------------------- */
const GLYPHS = '!<>-_\\/[]{}=+*^?#01$%';

export function scramble(el, duration = 650) {
  if (!el) return;
  const finalText = el.dataset.text ?? el.textContent;
  el.dataset.text = finalText;
  if (reduceMotion) return;
  cancelAnimationFrame(el._scrambleFrame);
  const start = performance.now();
  const step = (now) => {
    const progress = Math.min(1, (now - start) / duration);
    let out = '';
    for (let i = 0; i < finalText.length; i++) {
      const ch = finalText[i];
      out += ch === ' ' || i / finalText.length < progress ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0];
    }
    el.textContent = out;
    if (progress < 1) el._scrambleFrame = requestAnimationFrame(step);
  };
  el._scrambleFrame = requestAnimationFrame(step);
}

export function initScramble() {
  document.querySelectorAll('[data-scramble]').forEach((el) => {
    const target = el.querySelector('.scr') || el;
    el.addEventListener('pointerenter', () => scramble(target, 450));
  });
}

/* Scroll reveal ------------------------------------------------------------- */
export function initReveal() {
  const els = document.querySelectorAll('[data-reveal]');
  if (!('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        entry.target.querySelectorAll('[data-scramble-in]').forEach((s) => scramble(s, 900));
        io.unobserve(entry.target);
      });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
  );
  els.forEach((el) => io.observe(el));
}

/* About: words light up as you scroll -------------------------------------- */
export function initWordLight() {
  const el = document.querySelector('[data-words]');
  if (!el) return;
  const fragment = document.createDocumentFragment();
  Array.from(el.childNodes).forEach((node) => {
    const isHighlight = node.nodeType === Node.ELEMENT_NODE;
    node.textContent.split(/(\s+)/).forEach((part) => {
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

  const words = Array.from(el.querySelectorAll('.w'));
  if (reduceMotion) {
    words.forEach((w) => w.classList.add('is-lit'));
    return;
  }
  let litCount = -1;
  const update = () => {
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const progress = clamp((vh * 0.82 - rect.top) / (rect.height + vh * 0.3));
    const count = Math.round(progress * words.length);
    if (count === litCount) return;
    litCount = count;
    words.forEach((w, i) => w.classList.toggle('is-lit', i < count));
  };
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
}

/* Spotlight + tilt on project windows -------------------------------------- */
export function initSpotlight(root = document) {
  const canTilt = isFinePointer() && !reduceMotion;
  root.querySelectorAll('[data-spotlight]').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      el.style.setProperty('--mx', `${x.toFixed(0)}px`);
      el.style.setProperty('--my', `${y.toFixed(0)}px`);
      if (canTilt && el.hasAttribute('data-tilt')) {
        el.style.setProperty('--ry', `${((x / r.width - 0.5) * 7).toFixed(2)}deg`);
        el.style.setProperty('--rx', `${((0.5 - y / r.height) * 7).toFixed(2)}deg`);
      }
    });
    el.addEventListener('pointerleave', () => {
      el.style.setProperty('--rx', '0deg');
      el.style.setProperty('--ry', '0deg');
    });
  });
}

/* Section spy: active nav link + statusline path --------------------------- */
export function initSectionSpy(onChange) {
  const sections = document.querySelectorAll('main > section[id]');
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(
    (entries) => entries.forEach((entry) => entry.isIntersecting && onChange(entry.target.id)),
    { rootMargin: '-45% 0px -50% 0px' },
  );
  sections.forEach((s) => io.observe(s));
}

/* Statusline ---------------------------------------------------------------- */
export function initStatusline() {
  const clock = document.getElementById('slClock');
  const pct = document.getElementById('slPct');
  const updateClock = () => {
    if (clock) clock.textContent = new Date().toLocaleTimeString('pt-BR');
  };
  updateClock();
  setInterval(updateClock, 1000);

  const onScroll = () => {
    if (!pct) return;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const p = max > 0 ? window.scrollY / max : 0;
    pct.textContent = p < 0.01 ? 'Top' : p > 0.99 ? 'Bot' : `${Math.round(p * 100)}%`;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

export function setStatus({ mode, path, theme } = {}) {
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

/* Mobile menu --------------------------------------------------------------- */
export function initMenu() {
  const button = document.getElementById('menuBtn');
  const menu = document.getElementById('menu');
  if (!button || !menu) return;
  const setOpen = (open) => {
    menu.classList.toggle('is-open', open);
    menu.inert = !open;
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    document.body.style.overflow = open ? 'hidden' : '';
  };
  setOpen(false);
  button.addEventListener('click', () => setOpen(!menu.classList.contains('is-open')));
  menu.addEventListener('click', (e) => {
    if (e.target instanceof Element && e.target.closest('a')) setOpen(false);
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setOpen(false);
  });
}

/* Copy-to-clipboard rows ---------------------------------------------------- */
export function initCopy() {
  document.addEventListener('click', async (e) => {
    const btn = e.target instanceof Element ? e.target.closest('[data-copy]') : null;
    if (!btn) return;
    const label = btn.querySelector('[data-copy-label]');
    try {
      await navigator.clipboard.writeText(btn.dataset.copy);
      if (label) label.textContent = 'copiado ✓';
    } catch {
      if (label) label.textContent = 'copie manualmente';
    }
    setTimeout(() => label && (label.textContent = 'copiar'), 2000);
  });
}
