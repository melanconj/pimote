const CONTROL_STRING_STARTS = new Set([0x90, 0x98, 0x9e, 0x9f]);
const CONTROL_STRING_ESCAPES = new Set([0x50, 0x58, 0x5e, 0x5f]);

function skipCsi(text: string, index: number): number {
  for (let cursor = index; cursor < text.length; cursor++) {
    const code = text.charCodeAt(cursor);
    if (code >= 0x40 && code <= 0x7e) return cursor + 1;
    if (code < 0x20 || code > 0x3f) return cursor;
  }
  return text.length;
}

function skipOsc(text: string, index: number): number {
  for (let cursor = index; cursor < text.length; cursor++) {
    const code = text.charCodeAt(cursor);
    if (code === 0x07 || code === 0x9c) return cursor + 1;
    if (code === 0x1b && text.charCodeAt(cursor + 1) === 0x5c) return cursor + 2;
  }
  return text.length;
}

function skipControlString(text: string, index: number): number {
  for (let cursor = index; cursor < text.length; cursor++) {
    if (text.charCodeAt(cursor) === 0x9c) return cursor + 1;
    if (text.charCodeAt(cursor) === 0x1b && text.charCodeAt(cursor + 1) === 0x5c) return cursor + 2;
  }
  return text.length;
}

function skipEscapeSequence(text: string, index: number): number {
  let cursor = index + 1;
  while (cursor < text.length) {
    const code = text.charCodeAt(cursor);
    if (code >= 0x20 && code <= 0x2f) {
      cursor++;
      continue;
    }
    if (code >= 0x30 && code <= 0x7e) return cursor + 1;
    return index + 1;
  }
  return text.length;
}

/**
 * Remove terminal formatting/control sequences from an extension status string.
 * Printable Unicode (including spinner glyphs and emoji) is kept; whitespace
 * controls become spaces because the web status bar is a single line.
 */
export function sanitizeStatusText(text: string): string {
  const output: string[] = [];

  for (let index = 0; index < text.length; ) {
    const code = text.charCodeAt(index);

    if (code === 0x1b) {
      const next = text.charCodeAt(index + 1);
      if (next === 0x5b) {
        index = skipCsi(text, index + 2);
      } else if (next === 0x5d) {
        index = skipOsc(text, index + 2);
      } else if (CONTROL_STRING_ESCAPES.has(next)) {
        index = skipControlString(text, index + 2);
      } else {
        index = skipEscapeSequence(text, index);
      }
      continue;
    }

    if (code === 0x9b) {
      index = skipCsi(text, index + 1);
      continue;
    }
    if (code === 0x9d) {
      index = skipOsc(text, index + 1);
      continue;
    }
    if (CONTROL_STRING_STARTS.has(code)) {
      index = skipControlString(text, index + 1);
      continue;
    }
    if (code === 0x9c) {
      index++;
      continue;
    }

    if (code <= 0x1f || code === 0x7f || (code >= 0x80 && code <= 0x9f)) {
      if (code === 0x09 || code === 0x0a || code === 0x0d) output.push(' ');
      index++;
      continue;
    }

    output.push(text[index]);
    index++;
  }

  return output.join('').replace(/ {2,}/g, ' ').trim();
}
