import { describe, expect, it } from 'vitest';
import { banner, commonPrefix, completeInput, levenshtein, parseCommand, suggestCommand } from './shell-utils';

const ALIASES = { ajuda: 'help', open: 'abrir' } as const;
const COMMANDS = ['help', 'abrir', 'stack', 'sobre', 'theme'];
const argOptions = (cmd: string): readonly string[] => {
  if (cmd === 'abrir') return ['myworld', 'brasilpanel'];
  if (cmd === 'theme') return ['green', 'amber', 'cyan'];
  return [];
};

describe('parseCommand', () => {
  it('returns null for blank input', () => {
    expect(parseCommand('   ', ALIASES)).toBeNull();
  });

  it('splits the command name and arguments, lowercasing the name', () => {
    expect(parseCommand('  THEME   amber ', ALIASES)).toEqual({ raw: 'THEME   amber', name: 'theme', args: ['amber'] });
  });

  it('resolves aliases', () => {
    expect(parseCommand('open myworld', ALIASES)?.name).toBe('abrir');
  });
});

describe('levenshtein', () => {
  it('is 0 for identical strings', () => {
    expect(levenshtein('stack', 'stack')).toBe(0);
  });

  it('counts insertions, deletions and substitutions', () => {
    expect(levenshtein('stak', 'stack')).toBe(1);
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(levenshtein('', 'abc')).toBe(3);
  });
});

describe('suggestCommand', () => {
  it('suggests the closest command within the distance limit', () => {
    expect(suggestCommand('stak', COMMANDS)).toBe('stack');
  });

  it('returns null when nothing is close enough', () => {
    expect(suggestCommand('xyzxyz', COMMANDS)).toBeNull();
  });
});

describe('commonPrefix', () => {
  it('finds the shared prefix', () => {
    expect(commonPrefix(['sobre', 'stack', 'sudo'])).toBe('s');
    expect(commonPrefix(['theme', 'themes'])).toBe('theme');
  });

  it('returns an empty string for an empty list', () => {
    expect(commonPrefix([])).toBe('');
  });
});

describe('completeInput', () => {
  it('completes a unique command and adds a trailing space', () => {
    expect(completeInput('hel', COMMANDS, argOptions, ALIASES)).toEqual({ value: 'help ', matches: [] });
  });

  it('lists ambiguous commands and completes their common prefix', () => {
    expect(completeInput('s', COMMANDS, argOptions, ALIASES)).toEqual({ value: 's', matches: ['stack', 'sobre'] });
  });

  it('completes a unique argument', () => {
    expect(completeInput('abrir my', COMMANDS, argOptions, ALIASES).value).toBe('abrir myworld');
  });

  it('completes arguments for aliased commands', () => {
    expect(completeInput('open bra', COMMANDS, argOptions, ALIASES).value).toBe('open brasilpanel');
  });

  it('lists ambiguous arguments without changing the input', () => {
    expect(completeInput('theme ', COMMANDS, argOptions, ALIASES)).toEqual({ value: 'theme ', matches: ['green', 'amber', 'cyan'] });
  });

  it('leaves unknown input untouched', () => {
    expect(completeInput('zzz', COMMANDS, argOptions, ALIASES)).toEqual({ value: 'zzz', matches: [] });
  });
});

describe('banner', () => {
  it('renders five rows of block letters', () => {
    const rows = banner('jo').split('\n');
    expect(rows).toHaveLength(5);
    expect(rows[2]).toContain('█');
  });

  it('skips characters that are not in the font', () => {
    expect(banner('?')).toBe(['', '', '', '', ''].join('\n'));
  });
});
