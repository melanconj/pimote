<script lang="ts">
  import { onMount, tick, untrack } from 'svelte';
  import type { ProjectInfo, SessionInfo } from '@pimote/shared';
  import { searchProjectsAndSessions } from '$lib/project-search.js';
  import { connection } from '$lib/stores/connection.svelte.js';
  import { projectStore } from '$lib/stores/project-store.svelte.js';
  import { openExistingSession, sessionRegistry, switchToSession } from '$lib/stores/session-registry.svelte.js';
  import FolderIcon from '@lucide/svelte/icons/folder';
  import MessageSquare from '@lucide/svelte/icons/message-square';
  import Search from '@lucide/svelte/icons/search';
  import * as Dialog from '$lib/components/ui/dialog/index.js';
  import { Input } from '$lib/components/ui/input/index.js';

  type PaletteResult = { kind: 'project'; project: ProjectInfo } | { kind: 'session'; project: ProjectInfo; session: SessionInfo };

  let open = $state(false);
  let query = $state('');
  let selectedIndex = $state(0);

  const results = $derived.by(() => {
    const matches = searchProjectsAndSessions(projectStore.visibleProjects, projectStore.sessions, query);
    if (!matches) return [];

    const flattened: PaletteResult[] = [];
    for (const project of matches.projects) {
      flattened.push({ kind: 'project', project });
      for (const session of matches.sessionView.get(project.path) ?? []) {
        flattened.push({ kind: 'session', project, session });
      }
    }
    return flattened;
  });

  $effect(() => {
    if (open && connection.status === 'connected') {
      untrack(() => void projectStore.ensureLoaded());
    }
  });

  $effect(() => {
    if (selectedIndex >= results.length) selectedIndex = 0;
  });

  function openPalette() {
    query = '';
    selectedIndex = 0;
    open = true;
  }

  function handleOpenChange(nextOpen: boolean) {
    open = nextOpen;
    if (!nextOpen) {
      query = '';
      selectedIndex = 0;
    }
  }

  function handleGlobalKeydown(event: KeyboardEvent) {
    if (event.defaultPrevented || event.repeat || event.altKey || event.shiftKey) return;
    if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return;
    if (event.target instanceof Element && event.target.closest('[role="dialog"], [role="alertdialog"]')) return;

    event.preventDefault();
    openPalette();
  }

  function setSelectedIndex(index: number) {
    selectedIndex = index;
    void tick().then(() => document.getElementById(`session-switcher-result-${index}`)?.scrollIntoView({ block: 'nearest' }));
  }

  function handleDialogKeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (results.length > 0) setSelectedIndex((selectedIndex + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (results.length > 0) setSelectedIndex((selectedIndex - 1 + results.length) % results.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const result = results[selectedIndex];
      if (result && connection.status === 'connected') void chooseResult(result);
    }
  }

  async function chooseResult(result: PaletteResult) {
    handleOpenChange(false);
    if (result.kind === 'project') {
      try {
        await connection.send({ type: 'open_session', folderPath: result.project.path });
      } catch (error) {
        console.error('Failed to create new session:', error);
      }
      return;
    }

    try {
      if (sessionRegistry.isActiveSession(result.session.id)) {
        switchToSession(result.session.id);
      } else {
        await openExistingSession(result.session.id, result.project.path, { switchTo: true });
      }
    } catch (error) {
      console.error('Failed to open session:', error);
    }
  }

  function resultKey(result: PaletteResult): string {
    return result.kind === 'project' ? `project:${result.project.path}` : `session:${result.session.id}`;
  }

  function sessionDisplayName(session: SessionInfo): string {
    if (session.name) return session.name;
    if (session.firstMessage) return session.firstMessage.length > 80 ? `${session.firstMessage.slice(0, 80)}…` : session.firstMessage;
    return `Session ${session.id.slice(0, 8)}`;
  }

  onMount(() => {
    window.addEventListener('keydown', handleGlobalKeydown);
    return () => window.removeEventListener('keydown', handleGlobalKeydown);
  });
</script>

<Dialog.Root {open} onOpenChange={handleOpenChange}>
  <Dialog.Content class="gap-0 p-0 sm:max-w-xl" showCloseButton={false} onkeydown={handleDialogKeydown}>
    <Dialog.Header class="px-4 pt-4">
      <Dialog.Title>Go to a session or start one</Dialog.Title>
      <Dialog.Description>Search projects, tags, session names, or first messages.</Dialog.Description>
    </Dialog.Header>

    <div class="border-border flex items-center gap-3 border-b px-4 py-3">
      <Search class="text-muted-foreground size-4 shrink-0" />
      <Input
        bind:value={query}
        placeholder="Search projects and sessions…"
        aria-label="Search projects and sessions"
        autofocus
        class="h-10 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
        oninput={() => (selectedIndex = 0)}
      />
      <kbd class="text-muted-foreground bg-muted shrink-0 rounded px-1.5 py-0.5 text-[10px]">ESC</kbd>
    </div>

    <div class="max-h-[min(60vh,32rem)] overflow-y-auto p-2">
      {#if query.trim().length === 0}
        <p class="text-muted-foreground px-3 py-8 text-center text-sm">Type to search projects and sessions.</p>
      {:else if results.length === 0}
        <p class="text-muted-foreground px-3 py-8 text-center text-sm">No matching projects or sessions.</p>
      {:else}
        <div role="listbox" aria-label="Projects and sessions" class="flex flex-col gap-1">
          {#each results as result, index (resultKey(result))}
            <button
              id="session-switcher-result-{index}"
              type="button"
              role="option"
              aria-selected={selectedIndex === index}
              class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors {selectedIndex === index
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-accent/60'}"
              disabled={connection.status !== 'connected'}
              onfocus={() => (selectedIndex = index)}
              onmouseenter={() => (selectedIndex = index)}
              onclick={() => void chooseResult(result)}
            >
              {#if result.kind === 'project'}
                <FolderIcon class="text-muted-foreground size-4 shrink-0" />
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-medium">{result.project.name}</span>
                  <span class="text-muted-foreground block truncate text-xs">{result.project.path}</span>
                </span>
                <span class="text-muted-foreground shrink-0 text-xs">New session</span>
              {:else}
                <MessageSquare class="text-muted-foreground size-4 shrink-0" />
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-medium">{sessionDisplayName(result.session)}</span>
                  <span class="text-muted-foreground block truncate text-xs">{result.project.name} · {result.project.path}</span>
                </span>
                <span class="text-muted-foreground shrink-0 text-xs">Open</span>
              {/if}
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <div class="border-border text-muted-foreground flex items-center gap-4 border-t px-4 py-2 text-xs">
      <span><kbd class="bg-muted rounded px-1">↑</kbd> <kbd class="bg-muted rounded px-1">↓</kbd> navigate</span>
      <span><kbd class="bg-muted rounded px-1">↵</kbd> select</span>
      <span><kbd class="bg-muted rounded px-1">Esc</kbd> close</span>
    </div>
  </Dialog.Content>
</Dialog.Root>
