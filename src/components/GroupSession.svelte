<script>
  // Group session = N linked per-client sessions (shared groupId) entered on one
  // screen. A client switcher selects the active member; the full session UI is
  // the existing SessionScreen in embedded mode, so all the hardened logic
  // (trials, O-generation, corpus ranking, the nudge, autosave, finalize) is
  // reused per student. Each member still produces its own separate note.
  import { sessions, clients } from '../lib/repo.js'
  import { fmtDate } from '../lib/text.js'
  import SessionScreen from './SessionScreen.svelte'
  import SampleTag from './SampleTag.svelte'
  import { hrefFor } from '../lib/router.js'

  let { groupId } = $props()

  const members = $derived(
    $sessions
      .filter((s) => s.groupId === groupId)
      .map((s) => ({ session: s, client: $clients.find((c) => c.id === s.clientId) }))
      .filter((m) => m.client)
      .sort((a, b) => a.client.code.localeCompare(b.client.code))
  )
  const date = $derived(members[0]?.session.date ?? null)

  let activeId = $state(null)
  // activeId is the user's explicit choice; fall back to the first member when
  // it is unset or points at a member that no longer exists.
  const active = $derived(members.find((m) => m.session.id === activeId) ?? members[0] ?? null)
</script>

{#if members.length === 0}
  <p class="muted">Group session not found. <a href={hrefFor('clients')}>Back to caseload</a></p>
{:else}
  <div class="toolbar">
    <a href={hrefFor('clients')}>← Caseload</a>
    <h1 style="margin:0; font-size:1.2rem">
      Group session · {fmtDate(date)} · {members.length} students
    </h1>
    {#if members.every((member) => member.session.sample)}<SampleTag />{/if}
  </div>

  <div
    class="seg"
    role="group"
    aria-label="Students in this group"
    data-guide-target="group-switcher"
    style="margin-bottom:1rem; flex-wrap:wrap"
  >
    {#each members as m (m.session.id)}
      <button
        class:active={m.session.id === active?.session.id}
        aria-pressed={m.session.id === active?.session.id}
        onclick={() => (activeId = m.session.id)}
      >
        {m.client.code}{#if m.session.status === 'final'} ✓{/if}
      </button>
    {/each}
  </div>

  <!-- keyed so switching students remounts SessionScreen: the outgoing member's
       pending autosave flushes via onDestroy, the incoming one loads fresh -->
  {#if active}
    {#key active.session.id}
      <SessionScreen id={active.session.id} embedded />
    {/key}
  {/if}

  <div class="card no-print" style="margin-top:1rem">
    <h3>Notes for this group</h3>
    <div class="row-list">
      {#each members as m (m.session.id)}
        <div class="row-item" style="padding:0.5rem 0.75rem">
          <strong style="min-width:4rem">{m.client.code}</strong>
          <span class="tag {m.session.status === 'final' ? 'good' : 'quiet'}">{m.session.status}</span>
          <a class="right" href={hrefFor(`session/${m.session.id}/note`)}><button>View note</button></a>
        </div>
      {/each}
    </div>
  </div>
{/if}
