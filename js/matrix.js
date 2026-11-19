// Full-screen "digital rain" easter egg used by the terminal's `matrix` command.
import { getAccent } from './theme.js';

const GLYPHS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789{}<>/$#=+';
const FONT_SIZE = 16;
const DURATION_MS = 7000;

/** Runs the rain until the timeout or any key/click. Resolves when the overlay is gone. */
export function runMatrix() {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.className = 'matrix';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.append(canvas);
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    const columns = Math.ceil(w / FONT_SIZE);
    const drops = Array.from({ length: columns }, () => Math.random() * -40);
    const { rgb } = getAccent();
    let frame = 0;
    let last = 0;

    const draw = (time) => {
      frame = requestAnimationFrame(draw);
      if (time - last < 33) return;
      last = time;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.fillRect(0, 0, w, h);
      ctx.font = `${FONT_SIZE}px "JetBrains Mono", monospace`;
      drops.forEach((y, i) => {
        const ch = GLYPHS[(Math.random() * GLYPHS.length) | 0];
        const px = i * FONT_SIZE;
        const py = y * FONT_SIZE;
        ctx.fillStyle = 'rgba(235, 255, 240, 0.95)';
        ctx.fillText(ch, px, py);
        ctx.fillStyle = `rgba(${rgb}, 0.8)`;
        ctx.fillText(GLYPHS[(Math.random() * GLYPHS.length) | 0], px, py - FONT_SIZE);
        drops[i] = py > h && Math.random() > 0.975 ? 0 : y + 1;
      });
    };
    frame = requestAnimationFrame(draw);

    const stop = () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      window.removeEventListener('keydown', stop);
      canvas.removeEventListener('pointerdown', stop);
      canvas.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400 }).onfinish = () => {
        canvas.remove();
        resolve();
      };
    };
    const timer = setTimeout(stop, DURATION_MS);
    // Delay key listener so the Enter that launched the command doesn't close it.
    setTimeout(() => window.addEventListener('keydown', stop), 300);
    canvas.addEventListener('pointerdown', stop);
  });
}
