import { describe, expect, it } from 'vitest';
import { createCodemodeProgramStreamer, extractCodemodeProgram } from './codemode-display.js';

describe('codemode program display', () => {
  it('extracts the JavaScript source from finalized tool arguments', () => {
    const source = 'const answer = 42;\ntext(answer);';
    expect(extractCodemodeProgram({ code: source })).toBe(source);
  });

  it('does not treat missing or non-string code fields as source', () => {
    expect(extractCodemodeProgram(undefined)).toBeUndefined();
    expect(extractCodemodeProgram({ code: 42 })).toBeUndefined();
    expect(extractCodemodeProgram({ command: 'text(1)' })).toBeUndefined();
  });

  it('decodes a streamed JSON code string across arbitrary chunks', () => {
    const source = 'const label = "Pimote";\ntext(label);';
    const serialized = JSON.stringify({ code: source });
    const streamer = createCodemodeProgramStreamer();

    for (let offset = 0; offset < serialized.length; offset += 5) {
      streamer.write(serialized.slice(offset, offset + 5));
    }

    expect(streamer.program).toBe(source);
    streamer.dispose();
  });
});
