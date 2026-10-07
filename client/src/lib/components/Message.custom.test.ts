// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import Message from './Message.svelte';

let mounted: ReturnType<typeof mount> | undefined;

afterEach(() => {
  if (mounted) unmount(mounted);
  mounted = undefined;
});

function render(customType: string, text: string, streaming = false) {
  const target = document.createElement('div');
  mounted = mount(Message, {
    target,
    props: {
      message: {
        role: 'custom',
        customType,
        content: [{ type: 'text', text }],
      },
      streaming,
    },
  });
  return target;
}

describe('Message custom output', () => {
  it('shows subagent output as a collapsed type and first-line preview', async () => {
    const target = render('subagents', 'Found three relevant files\nFull details are below.');
    await tick();

    const header = target.querySelector<HTMLButtonElement>('.custom-header');
    expect(header?.textContent).toContain('[subagents]');
    expect(header?.textContent).toContain('Found three relevant files');
    expect(target.textContent).not.toContain('Full details are below.');

    header!.click();
    await tick();

    expect(target.textContent).toContain('Full details are below.');
    expect(header!.getAttribute('aria-expanded')).toBe('true');
  });

  it('uses the same collapsed presentation for other custom message types', async () => {
    const target = render('print-prompt', 'Inspect these instructions.\nThis is extension output.');
    await tick();

    const header = target.querySelector<HTMLButtonElement>('.custom-header');
    expect(header?.textContent).toContain('[print-prompt]');
    expect(header?.textContent).toContain('Inspect these instructions.');
    expect(target.textContent).not.toContain('This is extension output.');

    header!.click();
    await tick();

    expect(target.textContent).toContain('This is extension output.');
  });

  it('keeps streaming custom output expandable with a live preview', async () => {
    const target = render('agent-complete', 'Partial result…', true);
    await tick();

    const header = target.querySelector<HTMLButtonElement>('.custom-header');
    expect(header?.textContent).toContain('[agent-complete]');
    expect(header?.textContent).toContain('Partial result…');
    expect(target.querySelector('.custom-content')).toBeNull();

    header!.click();
    await tick();

    expect(target.textContent).toContain('Partial result…');
  });
});
