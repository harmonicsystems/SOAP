<script module>
  // View preferences survive in-session navigation (back to a client and
  // return) but are never persisted — they reset with the page. Only opaque
  // values live here: the search TEXT is deliberately excluded so a private
  // code fragment can never resurface in the demo (or vice versa) after a
  // lock. Stale tag-id selections carried across a demo/private switch are
  // neutralized inside filterClients, which ignores unknown ids.
  let savedView = { showArchived: false, sortKey: 'code', groupBy: 'none', tagIds: [] }
</script>

<script>
  import {
    clients,
    goals,
    sessions,
    appSettings,
    appMode,
    putRecord,
    createGroup
  } from '../lib/repo.js'
  import { navigate } from '../lib/router.js'
  import {
    buildStatsMap,
    filterClients,
    sortClients,
    groupClients,
    visibleCaseloadTags,
    resolveCaseloadTag
  } from '../lib/caseload.js'
  import { fmtDate, todayISO } from '../lib/text.js'
  import { MIN_GROUP_SIZE, MAX_GROUP_SIZE } from '../lib/constants.js'
  import { DEMO_DATASET_SUMMARY } from '../lib/sampleData.js'
  import SampleTag from './SampleTag.svelte'

  let search = $state('')
  let showArchived = $state(savedView.showArchived)
  let sortKey = $state(savedView.sortKey)
  let groupBy = $state(savedView.groupBy)
  let tagIds = $state(savedView.tagIds)
  let newCode = $state('')
  let addError = $state('')

  $effect(() => {
    savedView = { showArchived, sortKey, groupBy, tagIds }
  })

  const GROUP_DIMENSIONS = [
    ['none', 'None'],
    ['tag', 'Tag'],
    ['domain', 'Domain'],
    ['day', 'Day']
  ]

  function toggleFilterTag(id) {
    tagIds = tagIds.includes(id) ? tagIds.filter((t) => t !== id) : [...tagIds, id]
  }

  // ---- group session creation ----
  let groupMode = $state(false)
  let groupDate = $state(todayISO())
  let groupDuration = $state(30)
  let groupSel = $state([]) // selected client ids
  let groupError = $state('')
  let groupBusy = $state(false)

  const activeClients = $derived(
    $clients.filter((c) => !c.archived).sort((a, b) => a.code.localeCompare(b.code))
  )

  function activeGoalCount(clientId) {
    return $goals.filter((g) => g.clientId === clientId && g.status === 'active').length
  }

  function toggleGroupClient(cid) {
    groupSel = groupSel.includes(cid) ? groupSel.filter((x) => x !== cid) : [...groupSel, cid]
  }

  async function submitGroup(e) {
    e.preventDefault()
    groupError = ''
    if (groupSel.length < MIN_GROUP_SIZE || groupSel.length > MAX_GROUP_SIZE) {
      groupError = `Pick ${MIN_GROUP_SIZE}–${MAX_GROUP_SIZE} students for a group.`
      return
    }
    groupBusy = true
    try {
      const gid = await createGroup(groupSel, {
        date: groupDate || todayISO(),
        durationMin: Math.max(1, Number(groupDuration) || 30),
        setting: 'group'
      })
      if (gid) navigate(`group/${gid}`)
      else groupError = 'Could not create the group. Try again.'
    } finally {
      groupBusy = false
    }
  }

  const tagDefs = $derived($appSettings.caseloadTags ?? [])
  const filterTags = $derived(visibleCaseloadTags($appSettings))
  // Selection ids that actually constrain the list right now. tagIds can hold
  // stale ids (tag archived meanwhile, or carried across a mode switch) that
  // filterClients ignores — those must not make "Clear filters" claim a
  // filter is active when no chip shows as pressed.
  const appliedTagIds = $derived(tagIds.filter((id) => filterTags.some((t) => t.id === id)))
  const statsById = $derived(buildStatsMap($clients, $goals, $sessions))
  const sections = $derived(
    groupClients(
      sortClients(
        filterClients($clients, { search, tagIds, showArchived, tagDefs }),
        sortKey,
        statsById
      ),
      groupBy,
      { statsById, tagDefs }
    )
  )
  const visibleCount = $derived(
    groupBy === 'none'
      ? (sections[0]?.clients.length ?? 0)
      : new Set(sections.flatMap((s) => s.clients.map((c) => c.id))).size
  )

  function rowTags(client) {
    return (client.tags ?? [])
      .map((tid) => resolveCaseloadTag(tid, tagDefs))
      .filter(Boolean)
  }

  async function addClient(e) {
    e.preventDefault()
    const code = newCode.trim()
    addError = ''
    if (!/^\S{1,5}$/.test(code)) {
      addError = 'Use initials or a short code — max 5 characters, no spaces. Never a full name.'
      return
    }
    if ($clients.some((c) => c.code.toLowerCase() === code.toLowerCase())) {
      addError = 'That code is already in use.'
      return
    }
    const rec = await putRecord('clients', {
      id: crypto.randomUUID(),
      code,
      notes: '',
      archived: false,
      createdAt: Date.now()
    })
    newCode = ''
    navigate(`client/${rec.id}`)
  }

</script>

<h1>Caseload</h1>

{#if $appMode === 'demo'}
  <section class="card demo-summary" aria-label="Fictional demo dataset summary">
    <p class="eyebrow">Winter trimester · January–April</p>
    <h2>{DEMO_DATASET_SUMMARY.clients} fictional students · {DEMO_DATASET_SUMMARY.sessions} session records</h2>
    <p>
      The caseload includes {DEMO_DATASET_SUMMARY.goals} goals and {DEMO_DATASET_SUMMARY.groups}
      recurring groups. Its progress patterns include improvement, noisy change, plateaus, lower
      recent performance, mixed goal results, and cue dependence.
    </p>
    <p class="hint">These scenarios show product behavior—not clinical norms or expected outcomes.</p>
  </section>
{/if}

<div class="card">
  <form class="field-row" onsubmit={addClient}>
    <div class="field" style="margin-bottom:0">
      <label for="new-code">Add client</label>
      <input
        id="new-code"
        bind:value={newCode}
        placeholder="Initials or code only — e.g., JD or S12"
        maxlength="5"
        style="width:220px"
      />
    </div>
    <button class="btn-primary" type="submit">Add</button>
  </form>
  {#if addError}<p class="error-text">{addError}</p>{/if}
  <p class="hint" style="margin-bottom:0">
    Identify clients by initials or a short code only — never full names, birthdates, or school
    names.
  </p>
</div>

<div class="card">
  <div class="toolbar" style="margin-bottom:0">
    <h3 style="margin:0">Group session</h3>
    {#if !groupMode}
      <button class="right" onclick={() => (groupMode = true)} disabled={activeClients.length < MIN_GROUP_SIZE}>
        New group session
      </button>
    {/if}
  </div>
  {#if activeClients.length < MIN_GROUP_SIZE && !groupMode}
    <p class="hint" style="margin-bottom:0">Add at least {MIN_GROUP_SIZE} clients to start a group.</p>
  {/if}

  {#if groupMode}
    <form onsubmit={submitGroup}>
      <p class="hint">
        Pick {MIN_GROUP_SIZE}–{MAX_GROUP_SIZE} students. Each gets their own session and note; you
        enter data for all of them on one screen.
      </p>
      <div class="field-row">
        <div class="field" style="margin-bottom:0">
          <label for="grp-date">Date</label>
          <input id="grp-date" type="date" bind:value={groupDate} />
        </div>
        <div class="field" style="margin-bottom:0">
          <label for="grp-dur">Duration (min)</label>
          <input id="grp-dur" type="number" min="1" bind:value={groupDuration} style="width:90px" />
        </div>
      </div>
      <fieldset style="border:1px solid var(--line); border-radius:8px; margin:0.75rem 0; padding:0.5rem 0.75rem">
        <legend class="muted" style="font-size:0.85rem; padding:0 0.35rem">
          Students ({groupSel.length} selected)
        </legend>
        <div class="chips">
          {#each activeClients as c (c.id)}
            {@const picked = groupSel.includes(c.id)}
            <button
              type="button"
              class="chip"
              class:active={picked}
              disabled={!picked && groupSel.length >= MAX_GROUP_SIZE}
              onclick={() => toggleGroupClient(c.id)}
            >
              {c.code}{#if c.sample} · demo{/if} · {activeGoalCount(c.id)} goal{activeGoalCount(c.id) === 1 ? '' : 's'}
            </button>
          {/each}
        </div>
      </fieldset>
      {#if groupError}<p class="error-text">{groupError}</p>{/if}
      <div class="toolbar" style="margin-bottom:0">
        <button class="btn-primary" type="submit" disabled={groupBusy}>
          {groupBusy ? 'Creating…' : 'Start group session'}
        </button>
        <button type="button" onclick={() => { groupMode = false; groupSel = []; groupError = '' }}>
          Cancel
        </button>
      </div>
    </form>
  {/if}
</div>

<div class="toolbar">
  <input placeholder="Search by code" bind:value={search} style="width:200px" />
  <label style="display:flex; align-items:center; gap:0.4rem; margin:0; color:var(--muted)">
    <input type="checkbox" bind:checked={showArchived} />
    Show archived
  </label>
  <div class="seg right" role="group" aria-label="Sort caseload">
    <button
      type="button"
      class:active={sortKey === 'code'}
      aria-pressed={sortKey === 'code'}
      onclick={() => (sortKey = 'code')}
    >
      A–Z
    </button>
    <button
      type="button"
      class:active={sortKey === 'last-seen'}
      aria-pressed={sortKey === 'last-seen'}
      onclick={() => (sortKey = 'last-seen')}
      title="Students you haven't seen recently first"
    >
      Last seen
    </button>
  </div>
</div>

<div class="toolbar" style="row-gap:0.5rem">
  <span class="muted" style="font-size:0.85rem">Group by</span>
  <div class="seg" role="group" aria-label="Group caseload by">
    {#each GROUP_DIMENSIONS as [key, label] (key)}
      <button
        type="button"
        class:active={groupBy === key}
        aria-pressed={groupBy === key}
        onclick={() => (groupBy = key)}
      >
        {label}
      </button>
    {/each}
  </div>
</div>

{#if filterTags.length > 0}
  <div class="chips" style="margin-bottom:0.75rem" role="group" aria-label="Filter by caseload tag">
    {#each filterTags as t (t.id)}
      {@const on = tagIds.includes(t.id)}
      <button type="button" class="chip" class:active={on} aria-pressed={on} onclick={() => toggleFilterTag(t.id)}>
        {t.label}
      </button>
    {/each}
    {#if appliedTagIds.length > 0}
      <button type="button" class="chip" onclick={() => (tagIds = [])}>Clear filters</button>
    {/if}
  </div>
{/if}

{#snippet clientRow(client)}
  {@const s = statsById.get(client.id)}
  {@const badges = rowTags(client)}
  <div
    class="row-item clickable"
    role="button"
    tabindex="0"
    onclick={() => navigate(`client/${client.id}`)}
    onkeydown={(e) => {
      // role="button" must activate on Space as well as Enter; preventDefault
      // stops Space from scrolling the page instead.
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        navigate(`client/${client.id}`)
      }
    }}
  >
    <strong style="font-size:1.1rem; min-width:4.5rem">{client.code}</strong>
    {#if client.sample}<SampleTag />{/if}
    <span class="tag">{s.activeCount} active goal{s.activeCount === 1 ? '' : 's'}</span>
    {#if s.nearing > 0}
      <span class="tag good">{s.nearing} near criterion</span>
    {/if}
    {#each badges.slice(0, 3) as t (t.id)}
      <span class="tag quiet">{t.label}</span>
    {/each}
    {#if badges.length > 3}
      <span class="tag quiet">+{badges.length - 3}</span>
    {/if}
    <span class="muted right" style="font-size:0.85rem">
      {s.lastSession ? `Last session ${fmtDate(s.lastSession)}` : 'No sessions yet'}
    </span>
    {#if client.archived}<span class="tag quiet">archived</span>{/if}
  </div>
{/snippet}

{#if visibleCount === 0}
  <p class="muted">
    {#if $clients.length === 0}
      No clients yet. Add your first client above.
    {:else}
      No students match the current search or filters.
    {/if}
  </p>
{:else if groupBy === 'none'}
  <div class="row-list" data-guide-target="caseload-list">
    {#each sections[0].clients as client (client.id)}
      {@render clientRow(client)}
    {/each}
  </div>
{:else}
  <div data-guide-target="caseload-list">
    {#each sections as section (section.key)}
      <h3 class="muted" style="margin:1rem 0 0.35rem">
        {section.label}
        <span style="font-weight:normal">
          · {section.clients.length} student{section.clients.length === 1 ? '' : 's'}
        </span>
      </h3>
      <div class="row-list">
        {#each section.clients as client (client.id)}
          {@render clientRow(client)}
        {/each}
      </div>
    {/each}
  </div>
{/if}
