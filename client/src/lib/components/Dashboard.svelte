<script lang="ts">
  import { untrack } from 'svelte';
  import HomeToolbar from '$lib/components/HomeToolbar.svelte';
  import FolderList from '$lib/components/FolderList.svelte';
  import { sendManagerMessage } from '$lib/stores/manager-submit.js';
  import { closeOpenSwipeCard } from '$lib/components/SwipeableCard.svelte';
  import { folderStore } from '$lib/stores/folder-store.svelte.js';
  import { connection } from '$lib/stores/connection.svelte.js';

  let search = $state('');
  let scrollElement = $state<HTMLDivElement | null>(null);
  let managerMode = $state(false);
  let managerDraft = $state('');
  let managerBusy = $state(false);
  let managerReady = $derived(connection.ready && connection.managerRoot !== null);

  async function submitManagerDraft(text: string): Promise<void> {
    const managerRoot = connection.managerRoot;
    if (!managerRoot || !managerReady) return;
    managerBusy = true;
    try {
      const sent = await sendManagerMessage(text);
      if (sent) managerDraft = '';
    } finally {
      managerBusy = false;
    }
  }

  $effect(() => {
    if (connection.status === 'connected') {
      untrack(() => {
        void folderStore.ensureLoaded();
      });
    }
  });
</script>

<div class="flex min-h-0 flex-1">
  <div class="flex min-h-0 flex-1 flex-col overflow-y-auto" bind:this={scrollElement} onscroll={closeOpenSwipeCard}>
    <div class="mx-auto flex w-full max-w-2xl flex-col gap-10 px-5 pt-12 pb-28 md:max-w-4xl md:pt-16">
      <div class="flex flex-col items-center gap-1.5">
        <div class="flex items-center gap-2.5">
          <img src="/pwa/icon-512.png" alt="" class="border-border size-[90px] rounded-xl border object-cover" />
          <span class="text-foreground text-4xl font-semibold tracking-tight">Pimote</span>
        </div>
      </div>

      <HomeToolbar bind:search bind:managerMode bind:managerDraft {managerReady} busy={managerBusy} onSubmitManager={submitManagerDraft} />

      <section>
        <FolderList {search} {scrollElement} />
      </section>
    </div>
  </div>
</div>
