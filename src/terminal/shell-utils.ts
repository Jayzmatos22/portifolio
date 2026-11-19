// Pure helpers for the terminal: parsing, suggestions, tab completion and banner text.

export type AliasMap = Readonly<Record<string, string>>;

export interface ParsedCommand {
  readonly raw: string;
  readonly name: string;
  readonly args: readonly string[];
}

export interface Completion {
  readonly value: string;
  readonly matches: readonly string[];
}

const FONT: Readonly<Record<string, readonly string[]>> = {
  J: ['  ███', '    █', '    █', '█   █', ' ███ '],
  A: [' ███ ', '█   █', '█████', '█   █', '█   █'],
  I: ['███', ' █ ', ' █ ', ' █ ', '███'],
  L: ['█    ', '█    ', '█    ', '█    ', '█████'],
  T: ['█████', '  █  ', '  █  ', '  █  ', '  █  '],
  O: [' ███ ', '█   █', '█   █', '█   █', ' ███ '],
  N: ['█   █', '██  █', '█ █ █', '█  ██', '█   █'],
  S: [' ████', '█    ', ' ███ ', '    █', '████ '],
  E: ['█████', '█    ', '████ ', '█    ', '█████'],
  D: ['████ ', '█   █', '█   █', '█   █', '████ '],
  V: ['█   █', '█   █', '█   █', ' █ █ ', '  █  '],
  ' ': ['  ', '  ', '  ', '  ', '  '],
};
const BANNER_ROWS = 5;

/** Renders text in 5-row block letters; unknown characters are skipped. */
export function banner(text: string): string {
  const rows: string[] = Array.from({ length: BANNER_ROWS }, () => '');
  for (const ch of text.toUpperCase()) {
    const glyph = FONT[ch];
    if (!glyph) continue;
    glyph.forEach((row, i) => {
      rows[i] += `${row}  `;
    });
  }
  return rows.join('\n');
}

export function parseCommand(line: string, aliases: AliasMap): ParsedCommand | null {
  const raw = line.trim();
  if (!raw) return null;
  const [first = '', ...args] = raw.split(/\s+/);
  const lower = first.toLowerCase();
  return { raw, name: aliases[lower] ?? lower, args };
}

export function levenshtein(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current.push(Math.min((previous[j] ?? 0) + 1, (current[j - 1] ?? 0) + 1, (previous[j - 1] ?? 0) + cost));
    }
    previous = current;
  }
  return previous[b.length] ?? 0;
}

/** The closest candidate within `maxDistance` edits, or null. */
export function suggestCommand(name: string, candidates: readonly string[], maxDistance = 2): string | null {
  let best: string | null = null;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    const distance = levenshtein(candidate, name);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return bestDistance <= maxDistance ? best : null;
}

export function commonPrefix(words: readonly string[]): string {
  if (!words.length) return '';
  return words.reduce((prefix, word) => {
    let i = 0;
    while (i < prefix.length && prefix[i] === word[i]) i++;
    return prefix.slice(0, i);
  });
}

/**
 * Bash-like tab completion. A single match is completed; several matches are
 * returned so the caller can list them (and the input grows to their common prefix).
 */
export function completeInput(
  value: string,
  commands: readonly string[],
  argOptions: (command: string) => readonly string[],
  aliases: AliasMap,
): Completion {
  const parts = value.split(/\s+/);
  if (parts.length <= 1) {
    const typed = (parts[0] ?? '').toLowerCase();
    const matches = commands.filter((c) => c.startsWith(typed));
    if (matches.length === 1) return { value: `${matches[0]} `, matches: [] };
    if (matches.length > 1) {
      const prefix = commonPrefix(matches);
      return { value: prefix.length > typed.length ? prefix : value, matches };
    }
    return { value, matches: [] };
  }

  const first = (parts[0] ?? '').toLowerCase();
  const options = argOptions(aliases[first] ?? first);
  const last = (parts[parts.length - 1] ?? '').toLowerCase();
  const matches = options.filter((o) => o.startsWith(last));
  if (matches.length === 1) return { value: [...parts.slice(0, -1), matches[0]].join(' '), matches: [] };
  return { value, matches: matches.length > 1 ? matches : [] };
}
