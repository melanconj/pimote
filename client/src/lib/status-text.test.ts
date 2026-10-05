import { describe, expect, it } from 'vitest';
import { sanitizeStatusText } from './status-text.js';

describe('sanitizeStatusText', () => {
  it('strips ANSI styling while preserving printable Unicode', () => {
    expect(sanitizeStatusText('\u001b[32m✓ Building…\u001b[0m')).toBe('✓ Building…');
  });

  it('strips cursor and line-editing commands', () => {
    expect(sanitizeStatusText('Working\u001b[2K\u001b[?25l…')).toBe('Working…');
  });

  it('strips OSC titles and terminal hyperlinks', () => {
    const text = '\u001b]0;terminal title\u0007Status: \u001b]8;;https://example.com\u001b\\ready\u001b]8;;\u001b\\';
    expect(sanitizeStatusText(text)).toBe('Status: ready');
  });

  it('strips other terminal control strings and 8-bit CSI sequences', () => {
    expect(sanitizeStatusText('before\u001bP1;2;payload\u001b\\middle\u009b31mafter')).toBe('beforemiddleafter');
  });

  it('normalizes line and tab controls and drops other control characters', () => {
    expect(sanitizeStatusText('  Working\r\n\tnow\u0000  ✓  ')).toBe('Working now ✓');
  });

  it('discards incomplete terminal sequences instead of leaking their payload', () => {
    expect(sanitizeStatusText('Loading\u001b[31')).toBe('Loading');
    expect(sanitizeStatusText('Ready\u001b]0;unfinished title')).toBe('Ready');
  });
});
