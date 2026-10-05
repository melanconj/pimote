import { JSONParser } from '@streamparser/json';

/** Extract the source program from finalized codemode tool arguments. */
export function extractCodemodeProgram(args: unknown): string | undefined {
  if (!args || typeof args !== 'object') return undefined;
  const code = (args as Record<string, unknown>).code;
  return typeof code === 'string' ? code : undefined;
}

export interface CodemodeProgramStreamer {
  /** Feed the next raw JSON argument delta. */
  write(jsonDelta: string): void;
  /** Decoded program source seen so far, if the `code` field has started. */
  readonly program: string | undefined;
  /** Release parser resources. Safe to call repeatedly. */
  dispose(): void;
}

/**
 * Parse the `code` string incrementally from streamed codemode JSON arguments.
 * JSON escapes are decoded before the source is passed to the code renderer.
 */
export function createCodemodeProgramStreamer(): CodemodeProgramStreamer {
  let program: string | undefined;
  let errored = false;
  let disposed = false;

  let parser: JSONParser | null = null;
  try {
    parser = new JSONParser({
      emitPartialTokens: true,
      emitPartialValues: true,
      paths: ['$.code'],
      keepStack: false,
    });
  } catch {
    errored = true;
  }

  if (parser) {
    parser.onValue = (info) => {
      try {
        if (info.key === 'code' && typeof info.value === 'string') program = info.value;
      } catch {
        errored = true;
      }
    };
    parser.onError = () => {
      errored = true;
    };
  }

  return {
    get program() {
      return program;
    },
    write(jsonDelta: string) {
      if (errored || disposed || !parser) return;
      try {
        parser.write(jsonDelta);
      } catch {
        errored = true;
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      try {
        parser?.end();
      } catch {
        // Ignore an incomplete JSON object at the end of a streamed tool call.
      }
      parser = null;
    },
  };
}
