// Fake BIOS boot sequence. Runs once per browser session; skippable with any key or click.
import { prefersReducedMotion } from './core.js';

const LINES = [
  '<span class="hi">JSH BIOS v2.6</span>  ·  jailton santos  ·  pt-BR',
  'cpu: café expresso @ 3.2GHz  ·  mem: 16384 MB <span class="ok">ok</span>',
  '',
  '<span class="ok">[  OK  ]</span> montando /dev/portfolio',
  '<span class="ok">[  OK  ]</span> iniciando jvm 21 · spring boot 3.5',
  '<span class="ok">[  OK  ]</span> subindo uvicorn · fastapi',
  '<span class="ok">[  OK  ]</span> conectando postgresql · dynamodb',
  '<span class="ok">[  OK  ]</span> aquecendo cache caffeine',
  '<span class="ok">[  OK  ]</span> renderizando retrato ascii',
  '',
  '<span class="hi">&gt; pronto.</span>',
];
const LINE_MS = 115;
const STORAGE_KEY = 'booted';

function alreadyBooted() {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function markBooted() {
  try {
    sessionStorage.setItem(STORAGE_KEY, '1');
  } catch {
    /* ignore */
  }
}

/** Resolves once the page should start its entrance animations. */
export function runBoot() {
  const el = document.getElementById('boot');
  const markReady = () => document.body.classList.add('is-booted');

  if (!el || alreadyBooted() || prefersReducedMotion()) {
    el?.remove();
    markReady();
    return Promise.resolve();
  }
  markBooted();
  const log = el.querySelector('.boot__log');
  const bar = el.querySelector('.boot__bar i');

  return new Promise((resolve) => {
    const timers = [];
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      timers.forEach(clearTimeout);
      window.removeEventListener('keydown', finish);
      el.removeEventListener('pointerdown', finish);
      el.classList.add('is-done');
      setTimeout(() => {
        markReady();
        resolve();
      }, 280);
      setTimeout(() => el.remove(), 1100);
    };
    window.addEventListener('keydown', finish);
    el.addEventListener('pointerdown', finish);

    LINES.forEach((line, i) => {
      timers.push(
        setTimeout(() => {
          const row = document.createElement('div');
          row.innerHTML = line || '&nbsp;';
          log.append(row);
          if (bar) bar.style.transform = `scaleX(${(i + 1) / LINES.length})`;
        }, 120 + i * LINE_MS),
      );
    });
    timers.push(setTimeout(finish, 120 + LINES.length * LINE_MS + 420));
  });
}
