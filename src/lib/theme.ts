// Accent color themes. The UI reads --accent / --accent-rgb; canvases listen to "accentchange".

export interface Accent {
  readonly hex: string;
  readonly rgb: string;
  readonly ink: string;
}

export const ACCENTS = {
  green: { hex: '#3dff7a', rgb: '61, 255, 122', ink: '#02130a' },
  amber: { hex: '#ffb547', rgb: '255, 181, 71', ink: '#1a0f00' },
  cyan: { hex: '#42e2ff', rgb: '66, 226, 255', ink: '#001318' },
  magenta: { hex: '#ff4fd8', rgb: '255, 79, 216', ink: '#1a0016' },
  red: { hex: '#ff4d4d', rgb: '255, 77, 77', ink: '#1a0000' },
} as const satisfies Readonly<Record<string, Accent>>;

export type AccentName = keyof typeof ACCENTS;

export interface AccentChangeDetail extends Accent {
  readonly name: AccentName;
}

declare global {
  interface WindowEventMap {
    accentchange: CustomEvent<AccentChangeDetail>;
  }
}

const STORAGE_KEY = 'accent';
let current: AccentName = 'green';

export const accentNames = (): AccentName[] => Object.keys(ACCENTS) as AccentName[];
export const isAccentName = (value: string): value is AccentName => Object.hasOwn(ACCENTS, value);
export const getAccent = (): Accent => ACCENTS[current];
export const getAccentName = (): AccentName => current;

export function setAccent(name: string, { persist = true }: { persist?: boolean } = {}): boolean {
  if (!isAccentName(name)) return false;
  current = name;
  const accent = ACCENTS[name];
  const style = document.documentElement.style;
  style.setProperty('--accent', accent.hex);
  style.setProperty('--accent-rgb', accent.rgb);
  style.setProperty('--accent-ink', accent.ink);
  if (persist) {
    try {
      localStorage.setItem(STORAGE_KEY, name);
    } catch {
      /* storage unavailable: the theme still applies for this visit */
    }
  }
  window.dispatchEvent(new CustomEvent('accentchange', { detail: { name, ...accent } }));
  return true;
}

export function restoreAccent(): void {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setAccent(saved, { persist: false });
  } catch {
    /* ignore */
  }
}
