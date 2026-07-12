<script>
  import { clients, goals, sessions, putRecord, createGroup } from '../lib/repo.js'
  import { navigate } from '../lib/router.js'
  import { goalCriterionStatus } from '../lib/progress.js'
  import { fmtDate, todayISO } from '../lib/text.js'
  import { MIN_GROUP_SIZE, MAX_GROUP_SIZE } from '../lib/constants.js'

  let search = $state('')
  let showArchived = $state(false)
  let newCode = $state('')
  let addError = $state('')

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
    } finally {
      groupBusy = false
    }
  }

  const visible = $derived(
    $clients
      .filter((c) => (showArchived ? true : !c.archived))
      .filter((c) => c.code.toLowerCase().includes(search.trim().toLowerCase()))
      .sort((a, b) => a.code.localeCompare(b.code))
  )

  function stats(client) {
    const clientGoals = $goals.filter((g) => g.clientId === client.id)
    const active = clientGoals.filter((g) => g.status === 'active')
    const clientSessions = $sessions.filter((s) => s.clientId === client.id)
    const lastSession = clientSessions.map((s) => s.date).sort().at(-1) ?? null
    const nearing = active.filter((g) => {
      const st = goalCriterionStatus(g, clientSessions)
      return st.nearing || st.met
    }).length
    return { activeCount: active.length, lastSession, nearing }
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
              {c.code} · {activeGoalCount(c.id)} goal{activeGoalCount(c.id) === 1 ? '' : 's'}
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
</div>

{#if visible.length === 0}
  <p class="muted">No clients yet. Add your first client above.</p>
{:else}
  <div class="row-list">
    {#each visible as client (client.id)}
      {@const s = stats(client)}
      <div
        class="row-item clickable"
        role="button"
        tabindex="0"
        onclick={() => navigate(`client/${client.id}`)}
        onkeydown={(e) => {
          if (e.key === 'Enter') navigate(`client/${client.id}`)
        }}
      >
        <strong style="font-size:1.1rem; min-width:4.5rem">{client.code}</strong>
        <span class="tag">{s.activeCount} active goal{s.activeCount === 1 ? '' : 's'}</span>
        {#if s.nearing > 0}
          <span class="tag good">{s.nearing} near criterion</span>
        {/if}
        <span class="muted right" style="font-size:0.85rem">
          {s.lastSession ? `Last session ${fmtDate(s.lastSession)}` : 'No sessions yet'}
        </span>
        {#if client.archived}<span class="tag quiet">archived</span>{/if}
      </div>
    {/each}
  </div>
{/if}
