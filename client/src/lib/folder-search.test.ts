import { describe, expect, it } from 'vitest';
import type { FolderInfo, SessionInfo } from '@pimote/shared';
import { buildFolderSearchResults } from './folder-search.js';

const folder = (overrides: Partial<FolderInfo> = {}): FolderInfo => ({
  path: '/work/alpha',
  name: 'Alpha',
  nature: 'code',
  shortcutCount: 0,
  favorite: false,
  archived: false,
  tags: [],
  missing: false,
  activeSessionCount: 0,
  externalProcessCount: 0,
  ...overrides,
});

const session = (id: string, overrides: Partial<SessionInfo> = {}): SessionInfo => ({
  id,
  created: '2026-01-01T00:00:00.000Z',
  modified: '2026-01-01T00:00:00.000Z',
  messageCount: 1,
  ...overrides,
});

describe('buildFolderSearchResults', () => {
  it('shows every session for a folder-tier match', () => {
    const alpha = folder();
    const sessions = new Map([[alpha.path, [session('s1'), session('s2')]]]);

    expect(buildFolderSearchResults([alpha], sessions)).toEqual([
      { kind: 'folder', folder: alpha },
      { kind: 'session', folder: alpha, session: sessions.get(alpha.path)![0] },
      { kind: 'session', folder: alpha, session: sessions.get(alpha.path)![1] },
    ]);
  });

  it('narrows session-tier matches to the server-provided ids', () => {
    const alpha = folder({ matchedSessionIds: ['s2'] });
    const sessions = new Map([[alpha.path, [session('s1'), session('s2')]]]);

    expect(buildFolderSearchResults([alpha], sessions).map((result) => (result.kind === 'session' ? result.session.id : result.kind))).toEqual(['folder', 's2']);
  });

  it('excludes archived folders and sessions unless requested', () => {
    const active = folder({ matchedSessionIds: undefined });
    const archivedFolder = folder({ path: '/work/old', archived: true });
    const sessions = new Map([
      [active.path, [session('active'), session('archived', { archived: true })]],
      [archivedFolder.path, [session('old')]],
    ]);

    expect(buildFolderSearchResults([active, archivedFolder], sessions).map((result) => (result.kind === 'session' ? result.session.id : result.folder.path))).toEqual([
      active.path,
      'active',
    ]);
    expect(buildFolderSearchResults([active, archivedFolder], sessions, true)).toHaveLength(5);
  });
});
