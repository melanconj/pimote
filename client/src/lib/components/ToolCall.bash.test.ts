// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import type { PimoteMessageContent } from '@pimote/shared';
import ToolCall from './ToolCall.svelte';

let mounted: ReturnType<typeof mount> | undefined;

function render(content: PimoteMessageContent, streaming = false) {
  const target = document.createElement('div');
  mounted = mount(ToolCall, { target, props: { content, streaming } });
  return target;
}

afterEach(() => {
  if (mounted) unmount(mounted);
  mounted = undefined;
});

describe('ToolCall bash rendering', () => {
  it('renders the finalized command as highlighted shell code instead of JSON arguments', async () => {
    const target = render({
      type: 'tool_call',
      toolName: 'bash',
      args: { command: `printf '{"answer": 42}'\nls -la` },
      text: JSON.stringify({ command: `printf '{"answer": 42}'\nls -la` }),
    });
    target.querySelector<HTMLButtonElement>('.tool-header')!.click();
    await tick();

    expect(target.querySelector('.tool-section-label')?.textContent).toBe('Bash command');
    expect(target.querySelector('.write-file-block')?.getAttribute('data-mode')).toBe('code');
    expect(target.querySelector('.wfb-code code')?.textContent).toContain(`printf '{"answer": 42}'\nls -la`);
    expect(target.textContent).not.toContain('"command"');
    expect(target.querySelector('[aria-label="Copy command"]')).not.toBeNull();
  });

  it('renders the decoded command while its JSON arguments are streaming', async () => {
    const command = `printf "ready"\nls`;
    const target = render(
      {
        type: 'tool_call',
        toolName: 'bash',
        text: JSON.stringify({ command }),
      },
      true,
    );
    target.querySelector<HTMLButtonElement>('.tool-header')!.click();
    await tick();
    await vi.waitFor(() => expect(target.querySelector('.wfb-code code')?.textContent).toContain(command));

    expect(target.textContent).not.toContain('"command"');
  });

  it('keeps the regular arguments view when no string command is available', async () => {
    const target = render({ type: 'tool_call', toolName: 'bash', args: { timeout: 10 }, text: JSON.stringify({ timeout: 10 }) });
    target.querySelector<HTMLButtonElement>('.tool-header')!.click();
    await tick();

    expect(target.querySelector('.tool-section-label')?.textContent).toBe('Arguments');
    expect(target.textContent).toContain('timeout');
  });
});
