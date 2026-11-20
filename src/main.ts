// Entry point: renders data-driven sections, wires effects and motion, runs the boot sequence.
import 'lenis/dist/lenis.css';
import './styles/base.css';
import './styles/sections.css';

import { initParallax, initReveals, initSmoothScroll, initWordScrub, playIntro, refreshScroll } from './anim/motion';
import { closestFromEvent } from './lib/dom';
import { getAccentName, restoreAccent } from './lib/theme';
import { initPortrait } from './portrait/portrait';
import { initTerminal, type TerminalController } from './terminal/terminal';
import { runBoot } from './ui/boot';
import {
  initCopy,
  initCursor,
  initHeroParallax,
  initMagnetic,
  initMenu,
  initScramble,
  initSectionSpy,
  initSpotlight,
  initStatusline,
  scrambleWithin,
  setStatus,
  splitWords,
} from './ui/effects';
import { renderArcs, renderContact, renderEducation, renderProjects, renderStack } from './ui/render';
import { initVisuals } from './visuals/visuals';

function initShortcuts(terminal: TerminalController): void {
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
    if (!closestFromEvent(e, '[data-focus-terminal]')) return;
    e.preventDefault();
    terminal.focus();
  });
}

function greetConsole(): void {
  const style = 'font: 600 12px/1.6 "JetBrains Mono", monospace; color: #3dff7a; background: #020303; padding: 6px 10px;';
  console.info('%c> curioso, né? digite "/" na página para abrir o terminal.', style);
}

function main(): void {
  restoreAccent();
  initSmoothScroll();

  renderProjects(document.getElementById('projectList'));
  renderStack(document.getElementById('stackGrid'));
  renderContact(document.getElementById('contactRows'));
  renderArcs(document.getElementById('arcs'));
  renderEducation(document.querySelector<HTMLElement>('[data-education]'));

  const lede = document.querySelector<HTMLElement>('[data-words]');
  const words = splitWords(lede);

  initCursor();
  initHeroParallax();
  initMagnetic();
  initScramble();
  initSpotlight();
  initMenu();
  initCopy();
  initStatusline();
  setStatus({ theme: getAccentName() });
  window.addEventListener('accentchange', (e) => setStatus({ theme: e.detail.name }));

  const navLinks = document.querySelectorAll<HTMLAnchorElement>('.nav__link');
  initSectionSpy((id) => {
    navLinks.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === `#${id}`));
    setStatus({ path: id === 'inicio' ? '~/' : `~/${id}` });
  });

  const portraitRoot = document.getElementById('portrait');
  const portrait = initPortrait(portraitRoot);
  initVisuals();
  const terminal = initTerminal(document.getElementById('term'), {
    portraitImg: portraitRoot?.querySelector<HTMLImageElement>('.portrait__photo'),
    onModeChange: (mode) => setStatus({ mode }),
  });
  initShortcuts(terminal);

  void runBoot().then(() => {
    playIntro();
    void portrait.start();
    initReveals(scrambleWithin);
    if (lede) initWordScrub(lede, words);
    initParallax();
    refreshScroll();
  });
  greetConsole();
}

main();
