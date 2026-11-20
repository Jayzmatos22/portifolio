import { describe, expect, it } from 'vitest';
import { completionLabel, esc, formatMonthYear, safeUrl, scrambleText, SCRAMBLE_GLYPHS } from './text';

describe('formatMonthYear', () => {
  it('formats YYYY-MM as a short Portuguese month and year', () => {
    expect(formatMonthYear('2027-07')).toBe('jul/2027');
    expect(formatMonthYear('2026-12')).toBe('dez/2026');
    expect(formatMonthYear('2025-01')).toBe('jan/2025');
  });

  it('returns the input unchanged when it is not a valid YYYY-MM', () => {
    expect(formatMonthYear('2027-13')).toBe('2027-13');
    expect(formatMonthYear('julho')).toBe('julho');
  });
});

describe('completionLabel', () => {
  it('describes an expected completion for a course in progress', () => {
    expect(completionLabel('2027-07', true)).toBe('previsão jul/2027');
  });

  it('describes a finished course', () => {
    expect(completionLabel('2024-12', false)).toBe('concluído em dez/2024');
  });
});

describe('esc', () => {
  it('escapes every HTML-significant character', () => {
    expect(esc(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  });

  it('stringifies non-string values', () => {
    expect(esc(42)).toBe('42');
  });
});

describe('safeUrl', () => {
  it('keeps http, https and mailto links', () => {
    expect(safeUrl('https://github.com')).toBe('https://github.com');
    expect(safeUrl('http://example.com')).toBe('http://example.com');
    expect(safeUrl('mailto:a@b.com')).toBe('mailto:a@b.com');
  });

  it('rejects javascript: urls and empty values', () => {
    expect(safeUrl('javascript:alert(1)')).toBe('');
    expect(safeUrl('')).toBe('');
    expect(safeUrl(undefined)).toBe('');
  });
});

describe('scrambleText', () => {
  const firstGlyph = () => 0;

  it('returns the final text when progress is complete', () => {
    expect(scrambleText('sobre', 1, firstGlyph)).toBe('sobre');
  });

  it('replaces unrevealed characters with glyphs but keeps spaces', () => {
    const out = scrambleText('ab cd', 0, firstGlyph);
    expect(out).toBe(`${SCRAMBLE_GLYPHS[0]}${SCRAMBLE_GLYPHS[0]} ${SCRAMBLE_GLYPHS[0]}${SCRAMBLE_GLYPHS[0]}`);
  });

  it('reveals characters from left to right as progress grows', () => {
    const out = scrambleText('abcd', 0.5, firstGlyph);
    expect(out.slice(0, 2)).toBe('ab');
    expect(out.slice(2)).toBe(SCRAMBLE_GLYPHS[0].repeat(2));
  });
});
