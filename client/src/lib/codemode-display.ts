import { createJsonStringFieldStreamer, extractJsonStringField } from './json-string-field.js';

/** Extract the source program from finalized codemode tool arguments. */
export function extractCodemodeProgram(args: unknown): string | undefined {
  return extractJsonStringField(args, 'code');
}

export interface CodemodeProgramStreamer {
  /** Feed the next raw JSON argument delta. */
  write(jsonDelta: string): void;
  /** Decoded program source seen so far, if the `code` field has started. */
  readonly program: string | undefined;
  /** Release parser resources. Safe to call repeatedly. */
  dispose(): void;
}

/** Parse the `code` string incrementally from streamed codemode JSON arguments. */
export function createCodemodeProgramStreamer(): CodemodeProgramStreamer {
  const streamer = createJsonStringFieldStreamer('code');
  return {
    get program() {
      return streamer.value;
    },
    write(jsonDelta: string) {
      streamer.write(jsonDelta);
    },
    dispose() {
      streamer.dispose();
    },
  };
}
