import { describe, expect, it } from 'vitest';
import { esc, safeUrl, scrambleText, SCRAMBLE_GLYPHS } from './text';

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
