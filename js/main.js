// Entry point: renders data-driven sections, wires effects, runs the boot sequence.
import { restoreAccent, getAccentName } from './theme.js';
import { runBoot } from './boot.js';
import { renderProjects, renderStack, renderContact, renderArcs } from './render.js';
import {
  initCursor, initHeroParallax, initMagnetic, initScramble, initReveal, initWordLight,
  initSpotlight, initSectionSpy, initStatusline, setStatus, initMenu, initCopy,
} from './effects.js';
import { initPortrait } from './portrait.js';
import { initVisuals } from './visuals.js';
import { initTerminal } from './terminal.js';

function initShortcuts(terminal) {
  window.addEventListener('keydown', (e) => {
    const target = e.target;
    const typing = target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '/' || e.key === '`') {
      e.preventDefault();
      terminal.focus();
    }
  });
  document.addEventListener('click', (e) => {
    const trigger = e.target instanceof Element ? e.target.closest('[data-focus-terminal]') : null;
    if (!trigger) return;
    e.preventDefault();
    terminal.focus();
  });
}

function greetConsole() {
  const style = 'font: 600 12px/1.6 "JetBrains Mono", monospace; color: #3dff7a; background: #020303; padding: 6px 10px;';
  console.info('%c> curioso, né? o código é todo feito à mão. digite "/" na página para abrir o terminal.', style);
}

function main() {
  restoreAccent();
  renderProjects(document.getElementById('projectList'));
  renderStack(document.getElementById('stackGrid'));
  renderContact(document.getElementById('contactRows'));
  renderArcs(document.getElementById('arcs'));
  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());

  initCursor();
  initHeroParallax();
  initMagnetic();
  initScramble();
  initReveal();
  initWordLight();
  initSpotlight();
  initMenu();
  initCopy();
  initStatusline();
  setStatus({ theme: getAccentName() });
  window.addEventListener('accentchange', (e) => setStatus({ theme: e.detail.name }));

  const navLinks = document.querySelectorAll('.nav__link');
  initSectionSpy((id) => {
    navLinks.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === `#${id}`));
    setStatus({ path: id === 'inicio' ? '~/' : `~/${id}` });
  });

  const portraitRoot = document.getElementById('portrait');
  const portrait = initPortrait(portraitRoot);
  initVisuals();
  const terminal = initTerminal(document.getElementById('term'), {
    portraitImg: portraitRoot?.querySelector('.portrait__photo'),
    onModeChange: (mode) => setStatus({ mode }),
  });
  initShortcuts(terminal);

  runBoot().then(() => portrait.start());
  greetConsole();
}

main();
