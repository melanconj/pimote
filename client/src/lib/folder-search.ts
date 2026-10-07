import type { FolderInfo, SessionInfo } from '@pimote/shared';

export type FolderSearchResult = { kind: 'folder'; folder: FolderInfo } | { kind: 'session'; folder: FolderInfo; session: SessionInfo };

/** Flatten server-ranked folder matches and their matching session summaries for the command palette. */
export function buildFolderSearchResults(
  folders: readonly FolderInfo[],
  sessionsByPath: { get(path: string): SessionInfo[] | undefined },
  includeArchived = false,
): FolderSearchResult[] {
  const results: FolderSearchResult[] = [];

  for (const folder of folders) {
    if (!includeArchived && folder.archived) continue;
    results.push({ kind: 'folder', folder });

    const matchingSessionIds = folder.matchedSessionIds;
    const sessions = sessionsByPath.get(folder.path) ?? [];
    for (const session of sessions) {
      if (!includeArchived && session.archived) continue;
      if (matchingSessionIds && !matchingSessionIds.includes(session.id)) continue;
      results.push({ kind: 'session', folder, session });
    }
  }

  return results;
}
