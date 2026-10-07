import { describe, expect, it } from 'vitest';
import type { ProjectInfo, SessionInfo } from '@pimote/shared';
import { searchProjectsAndSessions } from './project-search.js';

const project = (path: string, name: string, tags: string[] = []): ProjectInfo => ({
  path,
  name,
  kind: 'single',
  tags,
  activeSessionCount: 0,
  externalProcessCount: 0,
});

const session = (id: string, name: string, firstMessage = ''): SessionInfo => ({
  id,
  name,
  firstMessage,
  created: '2026-01-01T00:00:00.000Z',
  modified: '2026-01-01T00:00:00.000Z',
  messageCount: 1,
});

describe('searchProjectsAndSessions', () => {
  const alpha = project('/work/alpha', 'Alpha', ['frontend']);
  const beta = project('/work/beta', 'Beta');
  const sessions = new Map([
    [alpha.path, [session('a1', 'Fix header'), session('a2', 'Other')]],
    [beta.path, [session('b1', 'Other', 'Investigate timeout')]],
  ]);

  it('returns null for an empty query', () => {
    expect(searchProjectsAndSessions([alpha], sessions, '  ')).toBeNull();
  });

  it('includes every session when the project name, path, or tag matches', () => {
    for (const query of ['alpha', '/work/alpha', 'frontEND']) {
      const result = searchProjectsAndSessions([alpha], sessions, query);

      expect(result?.projects).toEqual([alpha]);
      expect(result?.sessionView.get(alpha.path)).toEqual(sessions.get(alpha.path));
    }
  });

  it('includes only matching sessions when the project itself does not match', () => {
    const result = searchProjectsAndSessions([alpha, beta], sessions, 'timeout');

    expect(result?.projects).toEqual([beta]);
    expect(result?.sessionView.get(beta.path)).toEqual([sessions.get(beta.path)?.[0]]);
  });
});
