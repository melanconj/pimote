import { createJsonStringFieldStreamer, extractJsonStringField } from './json-string-field.js';

/** Extract the shell command from finalized bash tool arguments. */
export function extractBashCommand(args: unknown): string | undefined {
  return extractJsonStringField(args, 'command');
}

export interface BashCommandStreamer {
  /** Feed the next raw JSON argument delta. */
  write(jsonDelta: string): void;
  /** Decoded shell command seen so far, if the `command` field has started. */
  readonly command: string | undefined;
  /** Release parser resources. Safe to call repeatedly. */
  dispose(): void;
}

/** Parse the `command` string incrementally from streamed bash tool arguments. */
export function createBashCommandStreamer(): BashCommandStreamer {
  const streamer = createJsonStringFieldStreamer('command');
  return {
    get command() {
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
