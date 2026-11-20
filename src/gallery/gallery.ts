// Curved 3D gallery of project screenshots inside a terminal window, plus a full-screen viewer
// that grows out of the clicked screenshot. Geometry lives in arc.ts (pure, unit tested).
import { gsap } from 'gsap';
import { setScrollLocked } from '../anim/motion';
import { projects } from '../data/content';
import { prefersReducedMotion, watchVisibility } from '../lib/dom';
import { clamp, smoothstep } from '../lib/math';
import { esc } from '../lib/text';
import { onFrame } from '../lib/ticker';
import type { DeviceKind, Project, Screenshot } from '../types';
import { approach, createScreenX, indexAt, nearestIndex, poseFor, positionAt, rubberBand, slotCenters, type ArcConfig } from './arc';

const DEVICE_LABEL: Readonly<Record<DeviceKind, string>> = { desktop: 'desktop', tablet: 'tablet', mobile: 'celular' };
const DESKTOP_BAR_PX = 24;
const BEZEL_PX = 7;
/** Slides overlap a little on the arc, like tapes on a shelf. */
const SPACING = 0.62;
const SPRING_RATE = 6;
const DRAG_RATE = 18;
const TILT_RATE = 8;
const DRAG_THRESHOLD_PX = 6;
const WHEEL_SNAP_MS = 160;
const MAX_TILT_Y = 7;
const MAX_TILT_X = 5;

const pad2 = (n: number): string => String(n).padStart(2, '0');
const hostOf = (project: Project): string => {
  try {
    return new URL(project.links.live || project.links.repo).host;
  } catch {
    return project.id;
  }
};
const metaHtml = (shot: Screenshot): string => `<b>${esc(DEVICE_LABEL[shot.device])}</b> · ${esc(shot.caption)}`;

/* Markup ---------------------------------------------------------------------- */

export function galleryTemplate(project: Project): string {
  const count = project.screens.length;
  if (!count) return '';
  const host = hostOf(project);
  const slides = project.screens
    .map(
      (shot, i) => `
      <figure class="slide slide--${shot.device}" data-index="${i}" data-cursor>
        <div class="device device--${shot.device}">
          ${shot.device === 'desktop' ? `<div class="device__bar" aria-hidden="true"><i></i><i></i><i></i><span class="device__url">${esc(host)}</span></div>` : ''}
          <img src="${esc(shot.src)}" alt="${esc(`${project.name}: ${shot.title}`)}" width="${shot.width}" height="${shot.height}" loading="lazy" decoding="async" draggable="false">
        </div>
        <span class="slide__shade" aria-hidden="true"></span>
      </figure>`,
    )
    .join('');
  const ticks = project.screens
    .map((shot, i) => `<button class="gallery__tick" type="button" data-goto="${i}" aria-label="Ir para ${esc(shot.title)}"></button>`)
    .join('');

  const landscapeOnly = project.screens.every((shot) => shot.device === 'desktop');
  return `
  <section class="gallery${landscapeOnly ? ' gallery--landscape' : ''}" id="g-${esc(project.id)}" data-gallery="${esc(project.id)}" aria-roledescription="carrossel" aria-label="Telas do ${esc(project.name)}">
    <div class="gallery__bar">
      <span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>
      <span class="gallery__path">~/projetos/${esc(project.id)}/telas</span>
      <span class="gallery__count" data-count>01 / ${pad2(count)}</span>
    </div>
    <div class="gallery__stage" tabindex="0" aria-label="Galeria: arraste, use as setas do teclado ou Enter para ampliar">
      <div class="gallery__floor" aria-hidden="true"></div>
      <div class="gallery__center">${slides}</div>
    </div>
    <div class="gallery__foot">
      <button class="gallery__arrow" type="button" data-step="-1" aria-label="Tela anterior">←</button>
      <div class="gallery__caption" aria-live="polite">
        <div class="mask" data-title></div>
        <div class="mask" data-meta></div>
      </div>
      <button class="gallery__arrow" type="button" data-step="1" aria-label="Próxima tela">→</button>
    </div>
    <div class="gallery__ruler">
      <span class="gallery__line" aria-hidden="true"></span>${ticks}<span class="gallery__dot" data-dot aria-hidden="true"></span>
    </div>
    <p class="gallery__hint">arraste · ← → · clique na tela da frente para ampliar</p>
  </section>`;
}

/** Slides new text into a mask while the old text slides out (no opacity fades). */
function swapText(mask: HTMLElement, className: string, html: string, dir: number, animate: boolean): void {
  const next = document.createElement('span');
  next.className = className;
  next.innerHTML = html;
  const old = Array.from(mask.children);
  mask.append(next);
  if (!animate || dir === 0) {
    old.forEach((el) => el.remove());
    return;
  }
  gsap.fromTo(next, { yPercent: dir * 105 }, { yPercent: 0, duration: 0.65, ease: 'expo.out' });
  old.forEach((el) => gsap.to(el, { yPercent: -dir * 105, duration: 0.65, ease: 'expo.out', onComplete: () => el.remove() }));
}

/* Full-screen viewer ------------------------------------------------------------ */

interface ViewerTarget {
  readonly project: Project;
  readonly index: number;
  readonly slideAt: (index: number) => HTMLElement | null;
  readonly onNavigate: (index: number) => void;
}

interface Viewer {
  open(target: ViewerTarget): void;
}

const insetFor = (rect: DOMRect): string =>
  `inset(${rect.top.toFixed(1)}px ${(window.innerWidth - rect.right).toFixed(1)}px ${(window.innerHeight - rect.bottom).toFixed(1)}px ${rect.left.toFixed(1)}px round 10px)`;
const FULL_INSET = 'inset(0px 0px 0px 0px round 0px)';

function createViewer(): Viewer {
  const reduceMotion = prefersReducedMotion();
  const el = document.createElement('div');
  el.className = 'lightbox';
  el.hidden = true;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-labelledby', 'lightboxTitle');
  el.setAttribute('data-lenis-prevent', '');
  el.innerHTML = `
    <div class="lightbox__bar">
      <span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>
      <span class="lightbox__path" data-lb-path></span>
      <button class="lightbox__close" type="button" data-lb-close>fechar <kbd>esc</kbd></button>
    </div>
    <div class="lightbox__body" data-lb-body><img class="lightbox__img" alt="" data-lb-img></div>
    <div class="lightbox__foot">
      <button class="gallery__arrow" type="button" data-lb-step="-1" aria-label="Tela anterior">←</button>
      <div class="lightbox__info">
        <div class="mask" id="lightboxTitle" data-lb-title></div>
        <div class="mask" data-lb-meta></div>
      </div>
      <button class="gallery__arrow" type="button" data-lb-step="1" aria-label="Próxima tela">→</button>
    </div>`;
  document.body.append(el);

  const img = el.querySelector<HTMLImageElement>('[data-lb-img]');
  const path = el.querySelector<HTMLElement>('[data-lb-path]');
  const title = el.querySelector<HTMLElement>('[data-lb-title]');
  const meta = el.querySelector<HTMLElement>('[data-lb-meta]');
  const closeBtn = el.querySelector<HTMLButtonElement>('[data-lb-close]');
  let current: ViewerTarget | null = null;
  let index = 0;
  let lastFocus: HTMLElement | null = null;
  let isOpen = false;

  const show = (dir: number): void => {
    if (!current || !img || !title || !meta || !path) return;
    const shot = current.project.screens[index];
    if (!shot) return;
    img.src = shot.src;
    img.alt = `${current.project.name}: ${shot.title}`;
    path.textContent = `~/projetos/${current.project.id}/telas/${pad2(index + 1)} · ${pad2(current.project.screens.length)}`;
    swapText(title, 'lightbox__title', esc(shot.title), dir, !reduceMotion);
    swapText(meta, 'lightbox__meta', metaHtml(shot), dir, !reduceMotion);
    if (dir && !reduceMotion) gsap.fromTo(img, { xPercent: dir * 4, opacity: 0 }, { xPercent: 0, opacity: 1, duration: 0.5, ease: 'expo.out' });
  };

  const step = (dir: number): void => {
    if (!current) return;
    const next = clamp(index + dir, 0, current.project.screens.length - 1);
    if (next === index) return;
    index = next;
    show(dir);
    current.onNavigate(index);
  };

  const close = (): void => {
    if (!isOpen || !current) return;
    isOpen = false;
    const from = current.slideAt(index);
    const finish = (): void => {
      el.hidden = true;
      gsap.set(el, { clearProps: 'clipPath' });
      setScrollLocked(false);
      lastFocus?.focus({ preventScroll: true });
    };
    if (reduceMotion || !from) {
      finish();
      return;
    }
    gsap.to(el, { clipPath: insetFor(from.getBoundingClientRect()), duration: 0.75, ease: 'expo.inOut', onComplete: finish });
  };

  el.addEventListener('click', (e) => {
    if (!(e.target instanceof Element)) return;
    if (e.target.closest('[data-lb-close]')) close();
    const stepBtn = e.target.closest<HTMLElement>('[data-lb-step]');
    if (stepBtn) step(Number(stepBtn.dataset.lbStep));
    if (e.target.matches('[data-lb-body]')) close(); // click on the backdrop around the image
  });

  document.addEventListener('keydown', (e) => {
    if (!isOpen) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'ArrowRight') step(1);
    else if (e.key === 'Tab') {
      // Keep focus inside the dialog.
      const focusables = Array.from(el.querySelectorAll<HTMLElement>('button'));
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  });

  return {
    open(target) {
      current = target;
      index = target.index;
      lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      show(0);
      el.hidden = false;
      isOpen = true;
      setScrollLocked(true);
      const from = target.slideAt(index);
      if (!reduceMotion && from) {
        gsap.fromTo(el, { clipPath: insetFor(from.getBoundingClientRect()) }, { clipPath: FULL_INSET, duration: 0.95, ease: 'expo.inOut' });
        if (img) gsap.fromTo(img, { scale: 0.94 }, { scale: 1, duration: 1.1, ease: 'expo.out', delay: 0.25 });
      }
      closeBtn?.focus({ preventScroll: true });
    },
  };
}

let viewer: Viewer | null = null;
const getViewer = (): Viewer => (viewer ??= createViewer());

/* Gallery controller ------------------------------------------------------------ */

interface SlideState {
  readonly el: HTMLElement;
  readonly shot: Screenshot;
  w: number;
  h: number;
}

interface DragState {
  pointerId: number;
  startX: number;
  startPosition: number;
  moved: boolean;
  downIndex: number;
}

function mountGallery(root: HTMLElement, project: Project): void {
  const stage = root.querySelector<HTMLElement>('.gallery__stage');
  const titleMask = root.querySelector<HTMLElement>('[data-title]');
  const metaMask = root.querySelector<HTMLElement>('[data-meta]');
  const countEl = root.querySelector<HTMLElement>('[data-count]');
  const dot = root.querySelector<HTMLElement>('[data-dot]');
  const ticks = Array.from(root.querySelectorAll<HTMLElement>('[data-goto]'));
  const slides: SlideState[] = Array.from(root.querySelectorAll<HTMLElement>('.slide')).map((el, i) => ({
    el,
    shot: project.screens[i] as Screenshot,
    w: 0,
    h: 0,
  }));
  if (!stage || !titleMask || !metaMask || !slides.length) return;

  const reduceMotion = prefersReducedMotion();
  const last = slides.length - 1;
  let stageHeight = 0;
  let centers: number[] = [];
  let cfg: ArcConfig = { falloff: 400, perspective: 1400, maxTurnDeg: 30, sink: 0.25, hideBeyond: 2.6 };
  let screenX = createScreenX(cfg.falloff);
  let s = 0;
  let target = 0;
  let active = -1;
  let tilt = { x: 0, y: 0, tx: 0, ty: 0 };
  let visible = false;
  let needsRender = true;
  let wheelTimer = 0;
  const drag: DragState = { pointerId: -1, startX: 0, startPosition: 0, moved: false, downIndex: -1 };

  /* Layout: every slide gets the same height (minus device chrome) and keeps its aspect. */
  function layout(): void {
    const rect = stage!.getBoundingClientRect();
    if (!rect.width) return;
    const compact = rect.width < 640;
    stageHeight = rect.height * 0.8;
    const maxWidth = rect.width * (compact ? 0.82 : 0.6);
    slides.forEach((slide) => {
      const isDesktop = slide.shot.device === 'desktop';
      const chromeH = isDesktop ? DESKTOP_BAR_PX : BEZEL_PX * 2;
      const chromeW = isDesktop ? 0 : BEZEL_PX * 2;
      const aspect = slide.shot.width / slide.shot.height;
      let h = stageHeight * (isDesktop ? 0.82 : 1);
      let w = (h - chromeH) * aspect + chromeW;
      if (w > maxWidth) {
        w = maxWidth;
        h = (w - chromeW) / aspect + chromeH;
      }
      slide.w = w;
      slide.h = h;
      Object.assign(slide.el.style, { width: `${w}px`, height: `${h}px`, marginLeft: `${-w / 2}px`, marginTop: `${-h / 2}px` });
    });
    // Tied to the slide size so neighbours read as ~65%, ~45%, ~30% of the active slide.
    const falloff = Math.max(220, stageHeight * (compact ? 0.95 : 1.1));
    cfg = { falloff, perspective: 1400, maxTurnDeg: 32, sink: 0.22, hideBeyond: 2.6 };
    screenX = createScreenX(falloff);
    centers = slotCenters(
      slides.map((slide) => slide.w * SPACING),
      stageHeight * 0.05,
    );
    needsRender = true;
  }

  /** Arc position for a (possibly overshooting) index. */
  const positionFor = (index: number): number => {
    const first = centers[0] ?? 0;
    const end = centers[last] ?? 0;
    if (index < 0) return first + index * slides[0].w * SPACING;
    if (index > last) return end + (index - last) * slides[last].w * SPACING;
    return positionAt(centers, index);
  };
  const indexFor = (position: number): number => {
    const first = centers[0] ?? 0;
    const end = centers[last] ?? 0;
    if (position < first) return (position - first) / (slides[0].w * SPACING);
    if (position > end) return last + (position - end) / (slides[last].w * SPACING);
    return indexAt(centers, position);
  };

  function render(): void {
    const position = positionFor(s);
    slides.forEach((slide, i) => {
      const pose = poseFor((centers[i] ?? 0) - position, stageHeight, cfg, screenX);
      const focus = smoothstep(0, 1, Math.max(0, 1 - Math.abs(i - s)));
      const style = slide.el.style;
      style.visibility = pose.visible ? 'visible' : 'hidden';
      style.zIndex = String(pose.zIndex);
      style.transform =
        `translate3d(${pose.x.toFixed(1)}px, ${pose.y.toFixed(1)}px, ${pose.z.toFixed(1)}px) ` +
        `rotateX(${(tilt.x * focus).toFixed(2)}deg) rotateY(${(pose.rotateY + tilt.y * focus).toFixed(2)}deg)`;
      style.setProperty('--shade', pose.shade.toFixed(3));
    });
    if (dot) dot.style.left = `${(last ? clamp(s / last) : 0) * 100}%`;
  }

  function setActive(index: number, dir: number): void {
    active = index;
    const shot = slides[index].shot;
    slides.forEach((slide, i) => slide.el.classList.toggle('is-active', i === index));
    ticks.forEach((tick, i) => tick.setAttribute('aria-current', String(i === index)));
    if (countEl) countEl.textContent = `${pad2(index + 1)} / ${pad2(slides.length)}`;
    swapText(titleMask!, 'gallery__title', esc(shot.title), dir, !reduceMotion);
    swapText(metaMask!, 'gallery__meta', metaHtml(shot), dir, !reduceMotion);
  }

  const goTo = (index: number): void => {
    target = clamp(Math.round(index), 0, last);
  };

  const openViewer = (index: number): void => {
    getViewer().open({
      project,
      index,
      slideAt: (i) => slides[i]?.el ?? null,
      onNavigate: (i) => {
        target = i;
        s = i;
        needsRender = true;
      },
    });
  };

  /* Frame loop --------------------------------------------------------------- */
  onFrame((_, deltaMs) => {
    if (!visible) return;
    const dt = deltaMs / 1000;
    const before = { s, tx: tilt.x, ty: tilt.y };
    s = reduceMotion ? target : approach(s, target, drag.pointerId >= 0 ? DRAG_RATE : SPRING_RATE, dt);
    if (Math.abs(target - s) < 0.0005) s = target;
    if (!reduceMotion) {
      tilt = { ...tilt, x: approach(tilt.x, tilt.tx, TILT_RATE, dt), y: approach(tilt.y, tilt.ty, TILT_RATE, dt) };
    }
    const nearest = nearestIndex(s, slides.length);
    if (nearest !== active) setActive(nearest, active < 0 ? 0 : Math.sign(nearest - active));
    const changed = s !== before.s || Math.abs(tilt.x - before.tx) > 0.001 || Math.abs(tilt.y - before.ty) > 0.001;
    if (needsRender || changed) {
      render();
      needsRender = false;
    }
  });

  /* Input -------------------------------------------------------------------- */
  const updateTilt = (e: PointerEvent): void => {
    const rect = slides[active]?.el.getBoundingClientRect();
    if (!rect || reduceMotion) return;
    const inside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
    tilt.ty = inside ? clamp((e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2), -1, 1) * MAX_TILT_Y : 0;
    tilt.tx = inside ? -clamp((e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2), -1, 1) * MAX_TILT_X : 0;
    stage.classList.toggle('is-over-active', inside);
  };

  stage.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const slideEl = e.target instanceof Element ? e.target.closest<HTMLElement>('.slide') : null;
    drag.pointerId = e.pointerId;
    drag.startX = e.clientX;
    drag.startPosition = positionFor(s);
    drag.moved = false;
    drag.downIndex = slideEl ? Number(slideEl.dataset.index) : -1;
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener('pointermove', (e) => {
    if (drag.pointerId !== e.pointerId) {
      updateTilt(e);
      return;
    }
    const dx = e.clientX - drag.startX;
    if (!drag.moved && Math.abs(dx) < DRAG_THRESHOLD_PX) return;
    drag.moved = true;
    stage.classList.add('is-dragging');
    tilt.tx = 0;
    tilt.ty = 0;
    target = rubberBand(indexFor(drag.startPosition - dx * 1.4), 0, last);
  });
  const endDrag = (e: PointerEvent): void => {
    if (drag.pointerId !== e.pointerId) return;
    drag.pointerId = -1;
    stage.classList.remove('is-dragging');
    if (drag.moved) {
      goTo(target);
      return;
    }
    if (drag.downIndex < 0) return;
    if (drag.downIndex === active) openViewer(active);
    else goTo(drag.downIndex);
  };
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);
  stage.addEventListener('pointerleave', () => {
    tilt.tx = 0;
    tilt.ty = 0;
    stage.classList.remove('is-over-active');
  });

  // Only horizontal wheel/trackpad gestures move the gallery; vertical scrolling stays with the page.
  stage.addEventListener(
    'wheel',
    (e) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || Math.abs(e.deltaX) < 2) return;
      e.preventDefault();
      target = clamp(target + e.deltaX / (slides[active]?.w || 400), -0.3, last + 0.3);
      window.clearTimeout(wheelTimer);
      wheelTimer = window.setTimeout(() => goTo(target), WHEEL_SNAP_MS);
    },
    { passive: false },
  );

  stage.addEventListener('keydown', (e) => {
    const actions: Record<string, () => void> = {
      ArrowLeft: () => goTo(active - 1),
      ArrowRight: () => goTo(active + 1),
      Home: () => goTo(0),
      End: () => goTo(last),
      Enter: () => openViewer(active),
      ' ': () => openViewer(active),
    };
    const action = actions[e.key];
    if (!action) return;
    e.preventDefault();
    action();
  });

  root.addEventListener('click', (e) => {
    if (!(e.target instanceof Element)) return;
    const stepBtn = e.target.closest<HTMLElement>('[data-step]');
    if (stepBtn) goTo(active + Number(stepBtn.dataset.step));
    const tick = e.target.closest<HTMLElement>('[data-goto]');
    if (tick) goTo(Number(tick.dataset.goto));
  });

  watchVisibility(root, (v) => {
    visible = v;
    if (v) needsRender = true;
  });
  new ResizeObserver(() => {
    layout();
    render();
  }).observe(stage);
  layout();
  setActive(0, 0);
  render();
}

export function initGalleries(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-gallery]').forEach((el) => {
    const project = projects.find((p) => p.id === el.dataset.gallery);
    if (project?.screens.length) mountGallery(el, project);
  });
}
