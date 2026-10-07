import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./connection.svelte.js', () => ({
  connection: { ready: true, managerRoot: '/manager', send: vi.fn(async () => ({ success: true })) },
}));
vi.mock('./session-registry.svelte.js', () => ({
  openNewSession: vi.fn(async () => ({ success: true, data: { sessionId: 'new-manager' } })),
  switchToSession: vi.fn(),
  sessionRegistry: { viewed: { sessionId: 'current-manager', folderPath: '/manager' } },
}));

import { sendManagerMessage } from './manager-submit.js';
import { connection } from './connection.svelte.js';
import { openNewSession, switchToSession } from './session-registry.svelte.js';

beforeEach(() => {
  vi.clearAllMocks();
  connection.ready = true;
  connection.managerRoot = '/manager';
});

describe('manager submit store adapter', () => {
  it('always opens a fresh session when requested, even while viewing the manager', async () => {
    await expect(sendManagerMessage('  New question  ', { newSession: true })).resolves.toBe(true);
    expect(openNewSession).toHaveBeenCalledExactlyOnceWith('/manager');
    expect(connection.send).toHaveBeenCalledExactlyOnceWith({ type: 'prompt', sessionId: 'new-manager', message: 'New question' });
    expect(switchToSession).toHaveBeenCalledWith('new-manager');
  });

  it('preserves the homepage continue-current behavior by default', async () => {
    await expect(sendManagerMessage('Continue')).resolves.toBe(true);
    expect(openNewSession).not.toHaveBeenCalled();
    expect(connection.send).toHaveBeenCalledWith({ type: 'prompt', sessionId: 'current-manager', message: 'Continue' });
  });

  it('requires a ready connection and manager root', async () => {
    connection.ready = false;
    await expect(sendManagerMessage('Wait', { newSession: true })).resolves.toBe(false);
    connection.ready = true;
    connection.managerRoot = null;
    await expect(sendManagerMessage('Wait', { newSession: true })).resolves.toBe(false);
    expect(openNewSession).not.toHaveBeenCalled();
    expect(connection.send).not.toHaveBeenCalled();
  });

  it('reports prompt connection errors without throwing', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(connection.send).mockRejectedValueOnce(new Error('disconnected'));
    await expect(sendManagerMessage('Retry', { newSession: true })).resolves.toBe(false);
    expect(switchToSession).toHaveBeenCalledWith('new-manager');
    log.mockRestore();
  });
});
