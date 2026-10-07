import { isPlaceholderSessionId, submitManagerMessage, type ManagerSubmitPorts } from '$lib/manager-composer.js';
import { connection } from './connection.svelte.js';
import { openNewSession, sessionRegistry, switchToSession } from './session-registry.svelte.js';

const managerPorts: ManagerSubmitPorts = {
  openManagerSession: async (managerRoot) => {
    const response = await openNewSession(managerRoot);
    const sessionId = (response.data as { sessionId?: string } | undefined)?.sessionId;
    return { success: response.success, ...(sessionId !== undefined ? { sessionId } : {}) };
  },
  prompt: async (sessionId, message) => {
    try {
      return (await connection.send({ type: 'prompt', sessionId, message })).success;
    } catch (error) {
      console.error('Failed to prompt manager session:', error);
      return false;
    }
  },
  switchToSession,
};

export async function sendManagerMessage(text: string, { newSession = false }: { newSession?: boolean } = {}): Promise<boolean> {
  const managerRoot = connection.managerRoot;
  if (!connection.ready || !managerRoot) return false;
  const viewed = newSession ? undefined : sessionRegistry.viewed;
  return submitManagerMessage(
    {
      viewed: viewed ? { sessionId: viewed.sessionId } : undefined,
      viewedIsManager: viewed != null && !isPlaceholderSessionId(viewed.sessionId) && viewed.folderPath === managerRoot,
      managerRoot,
      text,
    },
    managerPorts,
  );
}
