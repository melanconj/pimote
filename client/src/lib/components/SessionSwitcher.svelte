<script lang="ts">
  import { onMount, tick, untrack } from 'svelte';
  import type { SessionInfo } from '@pimote/shared';
  import { connection } from '$lib/stores/connection.svelte.js';
  import { folderStore } from '$lib/stores/folder-store.svelte.js';
  import { openExistingSession, openNewSession, sessionRegistry, switchToSession } from '$lib/stores/session-registry.svelte.js';
  import { isSessionOpenCancelledResponse } from '$lib/session-open-response.js';
  import { buildFolderSearchResults, type FolderSearchResult } from '$lib/folder-search.js';
  import FolderIcon from '@lucide/svelte/icons/folder';
  import MessageSquare from '@lucide/svelte/icons/message-square';
  import Search from '@lucide/svelte/icons/search';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import SendHorizontal from '@lucide/svelte/icons/send-horizontal';
  import { sendManagerMessage } from '$lib/stores/manager-submit.js';
  import * as Dialog from '$lib/components/ui/dialog/index.js';
  import { Input } from '$lib/components/ui/input/index.js';

  let open = $state(false);
  let query = $state('');
  let selectedIndex = $state(0);
  let results = $state<FolderSearchResult[]>([]);
  let searchGeneration = 0;
  let managerMode = $state(false);
  let managerBusy = $state(false);
  let managerError = $state('');
  let inputEl = $state<HTMLInputElement | null>(null);
  const managerReady = $derived(connection.ready && !!connection.managerRoot);
  const canSend = $derived(managerReady && !managerBusy && query.trim().length > 0);

  async function toggleMode() {
    if (managerBusy) return;
    managerMode = !managerMode;
    selectedIndex = 0;
    managerError = '';
    await tick();
    inputEl?.focus();
  }

  async function submitManager() {
    if (!canSend) return;
    managerBusy = true;
    managerError = '';
    try {
      const sent = await sendManagerMessage(query, { newSession: true });
      if (sent) {
        open = false;
        query = '';
        selectedIndex = 0;
      } else {
        managerError = 'Could not send to the manager. Your message has been kept; try again.';
      }
    } catch (error) {
      console.error('Failed to query manager:', error);
      managerError = 'Could not send to the manager. Your message has been kept; try again.';
    } finally {
      managerBusy = false;
    }
  }

  $effect(() => {
    if (open && connection.status === 'connected') {
      untrack(() => void folderStore.ensureLoaded());
    }
  });

  $effect(() => {
    const isOpen = open;
    const searchText = query.trim();
    const connected = connection.status === 'connected';
    const includeArchived = folderStore.showArchived;

    if (!isOpen || managerMode || !connected || !searchText) {
      searchGeneration++;
      results = [];
      return;
    }

    const generation = ++searchGeneration;
    void (async () => {
      const folders = await folderStore.searchCandidates(searchText);
      if (generation !== searchGeneration) return;

      const eligibleFolders = folders.filter((folder) => includeArchived || !folder.archived);
      await Promise.all(eligibleFolders.map((folder) => folderStore.loadSessions(folder.path)));
      if (generation !== searchGeneration) return;

      results = buildFolderSearchResults(eligibleFolders, folderStore.sessions, includeArchived);
    })().catch((error) => {
      if (generation === searchGeneration) {
        results = [];
        console.error('Failed to search folders and sessions:', error);
      }
    });
  });

  $effect(() => {
    if (selectedIndex >= results.length) selectedIndex = 0;
  });

  function openPalette() {
    if (managerBusy) return;
    managerMode = false;
    managerError = '';
    query = '';
    selectedIndex = 0;
    open = true;
  }

  function handleOpenChange(nextOpen: boolean) {
    if (managerBusy && !nextOpen) return;
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

  function handleInputKeydownCapture(event: KeyboardEvent) {
    if (event.defaultPrevented || event.isComposing) return;
    if (event.key !== 'Tab' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    event.stopPropagation();
    void toggleMode();
  }

  function handleDialogKeydown(event: KeyboardEvent) {
    if (event.defaultPrevented || event.isComposing || event.target !== inputEl) return;
    if (managerMode) {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        void submitManager();
      }
      return;
    }
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

  async function chooseResult(result: FolderSearchResult) {
    handleOpenChange(false);
    if (result.kind === 'folder') {
      try {
        const response = await openNewSession(result.folder.path);
        if (!response.success && !isSessionOpenCancelledResponse(response)) console.error('Failed to create a session:', response.error);
      } catch (error) {
        console.error('Failed to create a session:', error);
      }
      return;
    }

    try {
      if (sessionRegistry.isActiveSession(result.session.id)) {
        switchToSession(result.session.id);
      } else {
        await openExistingSession(result.session.id, result.folder.path, { switchTo: true });
      }
    } catch (error) {
      console.error('Failed to open session:', error);
    }
  }

  function resultKey(result: FolderSearchResult): string {
    return result.kind === 'folder' ? `folder:${result.folder.path}` : `session:${result.session.id}`;
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
  <Dialog.Content
    class="gap-0 p-0 sm:max-w-xl"
    showCloseButton={false}
    onkeydown={handleDialogKeydown}
    onOpenAutoFocus={(event) => {
      event.preventDefault();
      inputEl?.focus();
    }}
  >
    <Dialog.Header class="px-4 pt-4">
      <Dialog.Title>{managerMode ? 'Ask the manager' : 'Go to a folder or session'}</Dialog.Title>
      <Dialog.Description>{managerMode ? 'Send a question in a new manager session.' : 'Search folders, tags, session names, or first messages.'}</Dialog.Description>
    </Dialog.Header>

    <div class="border-border flex items-center gap-3 border-b px-4 py-3">
      <button
        type="button"
        class="hover:bg-accent/50 focus-visible:ring-ring flex shrink-0 items-center gap-0.5 rounded-lg focus-visible:ring-1 focus-visible:outline-none"
        data-mode={managerMode ? 'manager' : 'search'}
        aria-label={managerMode ? 'Switch to search' : 'Switch to the manager'}
        title="Switch between Search and Manager (Tab)"
        disabled={managerBusy}
        onclick={() => void toggleMode()}
      >
        <span class="flex size-8 items-center justify-center rounded-md {managerMode ? 'text-muted-foreground' : 'bg-primary/15 text-foreground'}"><Search class="size-4" /></span>
        <span class="flex size-8 items-center justify-center rounded-md {managerMode ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'text-muted-foreground'}"
          ><Sparkles class="size-4" /></span
        >
      </button>
      <Input
        bind:ref={inputEl}
        bind:value={query}
        placeholder={managerMode ? 'Ask the manager…' : 'Search folders and sessions…'}
        aria-label={managerMode ? 'Message the manager' : 'Search folders and sessions'}
        readonly={managerBusy}
        onkeydowncapture={handleInputKeydownCapture}
        autofocus
        class="h-10 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
        oninput={() => (selectedIndex = 0)}
      />
      {#if managerMode}
        <button
          type="button"
          class="bg-primary text-primary-foreground rounded-lg p-2 disabled:opacity-50"
          aria-label="Send to manager"
          disabled={!canSend}
          onclick={() => void submitManager()}
        >
          <SendHorizontal class="size-4" />
        </button>
      {/if}
      <kbd class="text-muted-foreground bg-muted shrink-0 rounded px-1.5 py-0.5 text-[10px]">ESC</kbd>
    </div>

    <div class="max-h-[min(60vh,32rem)] overflow-y-auto p-2">
      {#if managerMode}
        {#if managerError}
          <p role="alert" class="text-destructive px-3 py-8 text-center text-sm">{managerError}</p>
        {:else}
          <p role="status" class="text-muted-foreground px-3 py-8 text-center text-sm">
            {managerBusy ? 'Sending to the manager…' : !managerReady ? 'Waiting for the manager connection…' : 'Press Enter to ask the manager in a new session.'}
          </p>
        {/if}
      {:else if query.trim().length === 0}
        <p class="text-muted-foreground px-3 py-8 text-center text-sm">Type to search folders and sessions.</p>
      {:else if connection.status !== 'connected'}
        <p class="text-muted-foreground px-3 py-8 text-center text-sm">Waiting for the server connection…</p>
      {:else if results.length === 0}
        <p class="text-muted-foreground px-3 py-8 text-center text-sm">No matching folders or sessions.</p>
      {:else}
        <div role="listbox" aria-label="Folders and sessions" class="flex flex-col gap-1">
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
              {#if result.kind === 'folder'}
                <FolderIcon class="text-muted-foreground size-4 shrink-0" />
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-medium">{result.folder.name}</span>
                  <span class="text-muted-foreground block truncate text-xs">{result.folder.path}</span>
                </span>
                <span class="text-muted-foreground shrink-0 text-xs">New session</span>
              {:else}
                <MessageSquare class="text-muted-foreground size-4 shrink-0" />
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-medium">{sessionDisplayName(result.session)}</span>
                  <span class="text-muted-foreground block truncate text-xs">{result.folder.name} · {result.folder.path}</span>
                </span>
                <span class="text-muted-foreground shrink-0 text-xs">Open</span>
              {/if}
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <div class="border-border text-muted-foreground flex items-center gap-4 border-t px-4 py-2 text-xs">
      <span><kbd class="bg-muted rounded px-1">Tab</kbd> {managerMode ? 'Search' : 'Manager'}</span>
      {#if !managerMode}<span><kbd class="bg-muted rounded px-1">↑</kbd> <kbd class="bg-muted rounded px-1">↓</kbd> navigate</span>{/if}
      <span><kbd class="bg-muted rounded px-1">↵</kbd> {managerMode ? 'send' : 'select'}</span>
      <span><kbd class="bg-muted rounded px-1">Esc</kbd> close</span>
    </div>
  </Dialog.Content>
</Dialog.Root>
