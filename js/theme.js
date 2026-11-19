// Accent color themes. The whole UI reads --accent / --accent-rgb, canvases listen to "accentchange".

export const ACCENTS = Object.freeze({
  green: { hex: '#3dff7a', rgb: '61, 255, 122', ink: '#02130a' },
  amber: { hex: '#ffb547', rgb: '255, 181, 71', ink: '#1a0f00' },
  cyan: { hex: '#42e2ff', rgb: '66, 226, 255', ink: '#001318' },
  magenta: { hex: '#ff4fd8', rgb: '255, 79, 216', ink: '#1a0016' },
  red: { hex: '#ff4d4d', rgb: '255, 77, 77', ink: '#1a0000' },
});

const STORAGE_KEY = 'accent';
let current = 'green';

export const getAccent = () => ACCENTS[current];
export const getAccentName = () => current;

export function setAccent(name, { persist = true } = {}) {
  const accent = ACCENTS[name];
  if (!accent) return false;
  current = name;
  const style = document.documentElement.style;
  style.setProperty('--accent', accent.hex);
  style.setProperty('--accent-rgb', accent.rgb);
  style.setProperty('--accent-ink', accent.ink);
  if (persist) {
    try {
      localStorage.setItem(STORAGE_KEY, name);
    } catch {
      /* storage unavailable: theme still applies for this visit */
    }
  }
  window.dispatchEvent(new CustomEvent('accentchange', { detail: { name, ...accent } }));
  return true;
}

export function restoreAccent() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && ACCENTS[saved]) setAccent(saved, { persist: false });
  } catch {
    /* ignore */
  }
}
