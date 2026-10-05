// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import ToolCall from './ToolCall.svelte';

let mounted: ReturnType<typeof mount> | undefined;

afterEach(() => {
  if (mounted) unmount(mounted);
  mounted = undefined;
});

describe('ToolCall codemode rendering', () => {
  it('renders the program as highlighted code instead of JSON arguments', async () => {
    const target = document.createElement('div');
    const source = 'const answer = 42;\ntext(answer);';
    const args = { code: source };
    mounted = mount(ToolCall, {
      target,
      props: {
        content: {
          type: 'tool_call',
          toolName: 'codemode',
          args,
          text: JSON.stringify(args),
        },
      },
    });
    await tick();

    target.querySelector<HTMLButtonElement>('.tool-header')!.click();
    await tick();

    expect(target.querySelector('.tool-section-label')?.textContent).toBe('JavaScript program');
    expect(target.querySelector('.wfb-code')).not.toBeNull();
    expect(target.querySelector('.wfb-code code')?.textContent).toContain('const answer = 42;');
    expect(target.textContent).not.toContain('"code"');
    expect(target.querySelector('[aria-label="Copy program"]')).not.toBeNull();
  });
});
