const ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escapes a value for safe interpolation into HTML. */
export const esc = (value: unknown): string => String(value).replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c);

/** Only http(s) and mailto links may be rendered from data; anything else becomes ''. */
export const safeUrl = (url: string | null | undefined): string => {
  const value = url ?? '';
  return /^(https?:|mailto:)/i.test(value) ? value : '';
};

export const SCRAMBLE_GLYPHS = '!<>-_\\/[]{}=+*^?#01$%';

/**
 * One frame of a "decode" effect: characters left of `progress` are final,
 * the rest are random glyphs. Spaces are always preserved.
 */
export function scrambleText(finalText: string, progress: number, random: () => number = Math.random): string {
  let out = '';
  for (let i = 0; i < finalText.length; i++) {
    const ch = finalText.charAt(i);
    const revealed = ch === ' ' || i / finalText.length < progress;
    out += revealed ? ch : SCRAMBLE_GLYPHS.charAt(Math.floor(random() * SCRAMBLE_GLYPHS.length));
  }
  return out;
}
