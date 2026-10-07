import type { ProjectInfo, SessionInfo } from '@pimote/shared';

export interface ProjectSearchResults {
  projects: ProjectInfo[];
  sessionView: Map<string, SessionInfo[]>;
}

/**
 * Homepage-style two-tier search: a project name/path/tag match includes all
 * its sessions, while a session-only match includes just matching sessions.
 */
export function searchProjectsAndSessions(
  projects: readonly ProjectInfo[],
  sessionsByPath: { get(path: string): SessionInfo[] | undefined },
  searchText: string,
): ProjectSearchResults | null {
  const query = searchText.trim().toLowerCase();
  if (!query) return null;

  const matchingProjects: ProjectInfo[] = [];
  const sessionView = new Map<string, SessionInfo[]>();

  for (const project of projects) {
    const sessions = sessionsByPath.get(project.path) ?? [];
    const tagMatch = (project.tags ?? []).some((tag) => tag.toLowerCase().includes(query));
    const projectMatch = tagMatch || project.name.toLowerCase().includes(query) || project.path.toLowerCase().includes(query);
    const matchingSessions = sessions.filter((session) => (session.name ?? '').toLowerCase().includes(query) || (session.firstMessage ?? '').toLowerCase().includes(query));

    if (projectMatch) {
      matchingProjects.push(project);
      sessionView.set(project.path, sessions);
    } else if (matchingSessions.length > 0) {
      matchingProjects.push(project);
      sessionView.set(project.path, matchingSessions);
    }
  }

  return { projects: matchingProjects, sessionView };
}
