// Full-screen "digital rain" easter egg used by the terminal's `matrix` command.
import { getAccent } from '../lib/theme';

const GLYPHS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789{}<>/$#=+';
const FONT_SIZE = 16;
const DURATION_MS = 7000;
const FRAME_MS = 33;

const randomGlyph = (): string => GLYPHS.charAt(Math.floor(Math.random() * GLYPHS.length));

/** Runs the rain until the timeout or any key/click. Resolves when the overlay is gone. */
export function runMatrix(): Promise<void> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      resolve();
      return;
    }
    canvas.className = 'matrix';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.append(canvas);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    const drops = Array.from({ length: Math.ceil(w / FONT_SIZE) }, () => Math.random() * -40);
    const { rgb } = getAccent();
    let frame = 0;
    let last = 0;

    const draw = (time: number): void => {
      frame = requestAnimationFrame(draw);
      if (time - last < FRAME_MS) return;
      last = time;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.fillRect(0, 0, w, h);
      ctx.font = `${FONT_SIZE}px "JetBrains Mono", monospace`;
      drops.forEach((y, i) => {
        const px = i * FONT_SIZE;
        const py = y * FONT_SIZE;
        ctx.fillStyle = 'rgba(235, 255, 240, 0.95)';
        ctx.fillText(randomGlyph(), px, py);
        ctx.fillStyle = `rgba(${rgb}, 0.8)`;
        ctx.fillText(randomGlyph(), px, py - FONT_SIZE);
        drops[i] = py > h && Math.random() > 0.975 ? 0 : y + 1;
      });
    };
    frame = requestAnimationFrame(draw);

    let timer = 0;
    const stop = (): void => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      window.removeEventListener('keydown', stop);
      canvas.removeEventListener('pointerdown', stop);
      canvas.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400 }).onfinish = () => {
        canvas.remove();
        resolve();
      };
    };
    timer = window.setTimeout(stop, DURATION_MS);
    // Delay the key listener so the Enter that launched the command doesn't close it.
    window.setTimeout(() => window.addEventListener('keydown', stop), 300);
    canvas.addEventListener('pointerdown', stop);
  });
}
