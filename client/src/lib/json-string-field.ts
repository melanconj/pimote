import { JSONParser } from '@streamparser/json';

/** Extract a string field from a finalized tool-argument object. */
export function extractJsonStringField(args: unknown, field: string): string | undefined {
  if (!args || typeof args !== 'object') return undefined;
  const value = (args as Record<string, unknown>)[field];
  return typeof value === 'string' ? value : undefined;
}

export interface JsonStringFieldStreamer {
  /** Feed the next raw JSON argument delta. */
  write(jsonDelta: string): void;
  /** Decoded field value seen so far, if the field has started. */
  readonly value: string | undefined;
  /** Release parser resources. Safe to call repeatedly. */
  dispose(): void;
}

/**
 * Parse a string field incrementally from streamed JSON tool arguments.
 * JSON escapes are decoded before the value is passed to its renderer.
 */
export function createJsonStringFieldStreamer(field: string): JsonStringFieldStreamer {
  let value: string | undefined;
  let errored = false;
  let disposed = false;

  let parser: JSONParser | null = null;
  try {
    parser = new JSONParser({
      emitPartialTokens: true,
      emitPartialValues: true,
      paths: [`$.${field}`],
      keepStack: false,
    });
  } catch {
    errored = true;
  }

  if (parser) {
    parser.onValue = (info) => {
      try {
        if (info.key === field && typeof info.value === 'string') value = info.value;
      } catch {
        errored = true;
      }
    };
    parser.onError = () => {
      errored = true;
    };
  }

  return {
    get value() {
      return value;
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
