<script>
  import { clients, goals, sessions, putRecord } from '../lib/repo.js'
  import { navigate } from '../lib/router.js'
  import { goalCriterionStatus } from '../lib/progress.js'
  import { fmtDate } from '../lib/text.js'

  let search = $state('')
  let showArchived = $state(false)
  let newCode = $state('')
  let addError = $state('')

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
