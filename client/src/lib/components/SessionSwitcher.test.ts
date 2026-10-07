// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import { drainBodyScrollLockCleanup } from '../../test/bits-ui-cleanup.js';

Element.prototype.scrollIntoView ??= () => {};

vi.mock('$lib/stores/connection.svelte.js', async (importOriginal) => {
  const { ConnectionStore } = await importOriginal<typeof import('$lib/stores/connection.svelte.js')>();
  const connection = new ConnectionStore();
  connection.send = vi.fn(async () => ({ id: '', success: true }));
  return { connection };
});

vi.mock('$lib/stores/folder-store.svelte.js', () => ({
  folderStore: {
    showArchived: false,
    ensureLoaded: vi.fn(async () => {}),
    searchCandidates: vi.fn(async () => [{ path: '/repos/project', name: 'project', archived: false }]),
    loadSessions: vi.fn(async () => {}),
    sessions: new Map(),
  },
}));

vi.mock('$lib/stores/session-registry.svelte.js', () => ({
  openNewSession: vi.fn(async () => ({ success: true })),
  openExistingSession: vi.fn(async () => {}),
  switchToSession: vi.fn(),
  sessionRegistry: { isActiveSession: vi.fn(() => false) },
}));

vi.mock('$lib/stores/manager-submit.js', () => ({ sendManagerMessage: vi.fn(async () => true) }));
vi.mock('$lib/stores/global-settings.svelte.js', () => ({ globalSettingsStore: { open: false } }));
vi.mock('$lib/stores/branch-tree-store.svelte.js', () => ({ branchTreeStore: { state: { open: false } } }));

import SessionSwitcher from './SessionSwitcher.svelte';
import { sendManagerMessage } from '$lib/stores/manager-submit.js';
import { folderStore } from '$lib/stores/folder-store.svelte.js';
import { connection } from '$lib/stores/connection.svelte.js';
import { openExistingSession, openNewSession, sessionRegistry, switchToSession } from '$lib/stores/session-registry.svelte.js';
import { globalSettingsStore } from '$lib/stores/global-settings.svelte.js';
import { branchTreeStore } from '$lib/stores/branch-tree-store.svelte.js';

let component: ReturnType<typeof mount> | undefined;

beforeEach(() => {
  connection.status = 'connected';
  connection.ready = true;
  connection.managerRoot = '/manager';
  globalSettingsStore.open = false;
  branchTreeStore.state.open = false;
  folderStore.showArchived = false;
  folderStore.sessions.clear();
  vi.mocked(sessionRegistry.isActiveSession).mockReturnValue(false);
  vi.mocked(sendManagerMessage).mockResolvedValue(true);
});

async function openPalette() {
  const target = document.createElement('div');
  document.body.appendChild(target);
  component = mount(SessionSwitcher, { target });
  await tick();
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true, cancelable: true }));
  await tick();
  const input = document.querySelector<HTMLInputElement>('input[aria-label="Search folders and sessions"]')!;
  await vi.waitFor(() => expect(document.activeElement).toBe(input));
  return input;
}

async function type(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await tick();
}

async function key(input: HTMLInputElement, key: string, extra: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra });
  input.dispatchEvent(event);
  await tick();
  return event;
}

afterEach(async () => {
  if (component) await unmount(component);
  component = undefined;
  document.body.innerHTML = '';
  vi.clearAllMocks();
  await drainBodyScrollLockCleanup();
});

describe('session switcher', () => {
  it.each(['settings', 'branches', 'dialog'] as const)('leaves shortcuts to an open %s surface', async (surface) => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    component = mount(SessionSwitcher, { target });
    await tick();
    if (surface === 'settings') globalSettingsStore.open = true;
    if (surface === 'branches') branchTreeStore.state.open = true;
    if (surface === 'dialog') target.setAttribute('role', 'dialog');

    const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    await tick();

    expect(event.defaultPrevented).toBe(false);
    expect(document.querySelector('input[aria-label="Search folders and sessions"]')).toBeNull();
  });

  it.each(['active', 'inactive', 'archived', 'restore-rejected'] as const)('opens a selected %s session through the shared session flow', async (state) => {
    const archived = state === 'archived' || state === 'restore-rejected';
    folderStore.showArchived = archived;
    folderStore.sessions.set('/repos/project', [{ id: 'existing', created: '', modified: '', messageCount: 1, archived }]);
    vi.mocked(sessionRegistry.isActiveSession).mockReturnValue(state === 'active');
    if (state === 'restore-rejected') vi.mocked(connection.send).mockResolvedValueOnce({ id: '', success: false, error: 'restore rejected' });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const input = await openPalette();
      await type(input, 'project');
      await vi.waitFor(() => expect(document.querySelectorAll('[role="option"]')).toHaveLength(2));
      await key(input, 'ArrowDown');
      await key(input, 'Enter');

      expect(openNewSession).not.toHaveBeenCalled();
      if (state === 'active') {
        expect(switchToSession).toHaveBeenCalledExactlyOnceWith('existing');
        expect(openExistingSession).not.toHaveBeenCalled();
      } else if (state === 'restore-rejected') {
        expect(openExistingSession).not.toHaveBeenCalled();
      } else {
        expect(openExistingSession).toHaveBeenCalledExactlyOnceWith('existing', '/repos/project', { switchTo: true });
      }
      if (archived) {
        expect(connection.send).toHaveBeenCalledExactlyOnceWith({ type: 'archive_session', folderPath: '/repos/project', sessionIds: ['existing'], archived: false });
        if (state === 'archived') expect(vi.mocked(connection.send).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(openExistingSession).mock.invocationCallOrder[0]);
      } else {
        expect(connection.send).not.toHaveBeenCalled();
      }
    } finally {
      log.mockRestore();
    }
  });
  it('toggles both ways with Tab, preserving text and focus and suspending search', async () => {
    const input = await openPalette();
    await type(input, 'project');
    await vi.waitFor(() => expect(document.querySelector('[role="option"]')).not.toBeNull());

    expect((await key(input, 'Tab')).defaultPrevented).toBe(true);
    expect(input.getAttribute('aria-label')).toBe('Message the manager');
    expect(input.value).toBe('project');
    expect(document.activeElement).toBe(input);
    expect(document.querySelector('[role="option"]')).toBeNull();
    vi.mocked(folderStore.searchCandidates).mockClear();
    await type(input, 'Help with project');
    expect(folderStore.searchCandidates).not.toHaveBeenCalled();

    await key(input, 'Tab');
    expect(input.getAttribute('aria-label')).toBe('Search folders and sessions');
    expect(input.value).toBe('Help with project');
    expect(document.activeElement).toBe(input);
    await vi.waitFor(() => expect(folderStore.searchCandidates).toHaveBeenCalledWith('Help with project'));
  });

  it('handles Tab before native focus-trap listeners run', async () => {
    const input = await openPalette();
    const dialog = input.closest('[role="dialog"]')!;
    const focusTrap = vi.fn((event: Event) => {
      if ((event as KeyboardEvent).key !== 'Tab') return;
      event.preventDefault();
      dialog.querySelector<HTMLButtonElement>('button')!.focus();
    });
    dialog.addEventListener('keydown', focusTrap);
    try {
      await key(input, 'Tab');
      expect(input.getAttribute('aria-label')).toBe('Message the manager');
      expect(document.activeElement).toBe(input);
      expect(focusTrap).not.toHaveBeenCalled();
      await key(input, 'Tab');
      expect(input.getAttribute('aria-label')).toBe('Search folders and sessions');
      expect(document.activeElement).toBe(input);
    } finally {
      dialog.removeEventListener('keydown', focusTrap);
    }
  });

  it('loads the manager path on a cold session page and sends the first prompt', async () => {
    connection.managerRoot = null;
    vi.mocked(folderStore.ensureLoaded).mockImplementationOnce(async () => {
      connection.managerRoot = '/manager';
    });
    const input = await openPalette();
    await key(input, 'Tab');
    await type(input, 'First prompt without visiting Home');
    await key(input, 'Enter');
    expect(folderStore.ensureLoaded).toHaveBeenCalledTimes(1);
    expect(sendManagerMessage).toHaveBeenCalledExactlyOnceWith('First prompt without visiting Home', { newSession: true });
  });

  it('supports the clickable toggle and leaves Shift+Tab available for focus traversal', async () => {
    const input = await openPalette();
    expect((await key(input, 'Tab', { shiftKey: true })).defaultPrevented).toBe(false);
    expect(input.getAttribute('aria-label')).toBe('Search folders and sessions');
    document.querySelector<HTMLButtonElement>('button[aria-label="Switch to the manager"]')!.click();
    await tick();
    expect(input.getAttribute('aria-label')).toBe('Message the manager');
    expect(document.activeElement).toBe(input);
  });

  it('submits Enter in a fresh manager session and closes on success', async () => {
    const input = await openPalette();
    await type(input, 'Help me release');
    await key(input, 'Tab');
    await key(input, 'Enter');
    expect(sendManagerMessage).toHaveBeenCalledExactlyOnceWith('Help me release', { newSession: true });
    expect(openNewSession).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"][data-state="open"]')).toBeNull();
  });

  it('keeps the message and shows an error when sending is rejected', async () => {
    vi.mocked(sendManagerMessage).mockResolvedValue(false);
    const input = await openPalette();
    await key(input, 'Tab');
    await type(input, 'Keep this message');
    document.querySelector<HTMLButtonElement>('button[aria-label="Send to manager"]')!.click();
    await tick();
    expect(document.querySelector('[role="dialog"][data-state="open"]')).not.toBeNull();
    expect(input.value).toBe('Keep this message');
    await vi.waitFor(() => expect(document.querySelector('[role="alert"]')?.textContent).toContain('Could not send'));
  });

  it('does not send an empty message', async () => {
    const input = await openPalette();
    await key(input, 'Tab');
    await key(input, 'Enter');
    await type(input, '   ');
    await key(input, 'Enter');
    expect(sendManagerMessage).not.toHaveBeenCalled();
  });

  it('disables sending when the manager is not ready', async () => {
    connection.ready = false;
    const input = await openPalette();
    await key(input, 'Tab');
    await type(input, 'Not yet');
    await key(input, 'Enter');
    expect(sendManagerMessage).not.toHaveBeenCalled();
    expect(document.querySelector<HTMLButtonElement>('button[aria-label="Send to manager"]')!.disabled).toBe(true);
  });

  it('prevents duplicate submissions while waiting', async () => {
    let resolve!: (sent: boolean) => void;
    vi.mocked(sendManagerMessage).mockImplementationOnce(
      () =>
        new Promise<boolean>((done) => {
          resolve = done;
        }),
    );
    const input = await openPalette();
    await key(input, 'Tab');
    await type(input, 'Only once');
    await key(input, 'Enter');
    await key(input, 'Enter');
    expect(sendManagerMessage).toHaveBeenCalledTimes(1);
    expect(input.readOnly).toBe(true);
    resolve(true);
    await tick();
  });

  it.each(['metaKey', 'ctrlKey'])('creates and navigates through the shared new-session flow using %s+K', async (modifier) => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    component = mount(SessionSwitcher, { target });
    await tick();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', [modifier]: true, bubbles: true, cancelable: true }));
    await tick();

    const input = document.querySelector<HTMLInputElement>('input[aria-label="Search folders and sessions"]');
    expect(input).not.toBeNull();
    input!.value = 'project';
    input!.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.waitFor(() => expect(document.querySelector('[role="option"]')).not.toBeNull());

    input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await tick();

    expect(openNewSession).toHaveBeenCalledExactlyOnceWith('/repos/project');
    expect(connection.send).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"][data-state="open"]')).toBeNull();
  });
});
