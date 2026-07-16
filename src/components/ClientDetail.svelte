<script>
  import { get } from 'svelte/store'
  import { clients, goals, sessions, appSettings, appMode, putRecord, deleteRecord } from '../lib/repo.js'
  import { navigate, hrefFor } from '../lib/router.js'
  import { DOMAINS, domainLabel } from '../lib/constants.js'
  import { visibleCaseloadTags, resolveCaseloadTag, WEEKDAYS } from '../lib/caseload.js'
  import { goalCriterionStatus, goalPoints } from '../lib/progress.js'
  import { shortLabelFor } from '../lib/ogen.js'
  import { fmtDate } from '../lib/text.js'
  import { newSessionRecord } from '../lib/session.js'
  import { sampleProvenance } from '../lib/sampleData.js'
  import GoalBuilder from './GoalBuilder.svelte'
  import Sparkline from './Sparkline.svelte'
  import SampleTag from './SampleTag.svelte'

  let { id } = $props()

  const client = $derived($clients.find((c) => c.id === id))
  const clientGoals = $derived($goals.filter((g) => g.clientId === id))
  const clientSessions = $derived(
    $sessions
      .filter((s) => s.clientId === id)
      .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt ?? 0) - (a.createdAt ?? 0))
  )
  const domainsWithGoals = $derived(
    DOMAINS.filter((d) => clientGoals.some((g) => g.domain === d.id))
  )

  let editingGoal = $state(null) // null = closed, 'new' = adding, object = editing
  let notesDraft = $state(null)

  async function newSession() {
    const active = clientGoals.filter((g) => g.status === 'active')
    const rec = await putRecord('sessions', {
      ...newSessionRecord(id, active, { setting: 'individual' }),
      ...sampleProvenance(client)
    })
    navigate(`session/${rec.id}`)
  }

  async function setGoalStatus(goal, status) {
    await putRecord('goals', { ...goal, status })
  }

  // Client edits are serialized through one queue that re-reads the freshest
  // record at write time. Chip taps arrive faster than a private-mode
  // encrypt-and-write round-trip on a slow laptop; without this, the second
  // tap spreads a pre-write snapshot and silently erases the first (last
  // writer wins in both the store and the encrypted row).
  let clientWriteQueue = Promise.resolve()
  function queueClientUpdate(mutate) {
    clientWriteQueue = clientWriteQueue
      .then(async () => {
        const latest = get(clients).find((c) => c.id === id)
        if (latest) await putRecord('clients', mutate(latest))
      })
      .catch(() => {}) // a failed write must not jam later edits
    return clientWriteQueue
  }

  async function toggleArchive() {
    await queueClientUpdate((c) => ({ ...c, archived: !c.archived }))
  }

  async function saveNotes() {
    const notes = notesDraft
    await queueClientUpdate((c) => ({ ...c, notes }))
    notesDraft = null
  }

  // Tag/day chips shown for this client: active definitions, plus any archived
  // tag still assigned here so it can be seen and removed.
  const tagChoices = $derived.by(() => {
    const active = visibleCaseloadTags($appSettings)
    const activeIds = new Set(active.map((t) => t.id))
    const assignedArchived = (client?.tags ?? [])
      .filter((tid) => !activeIds.has(tid))
      .map((tid) => resolveCaseloadTag(tid, $appSettings.caseloadTags ?? []))
      .filter(Boolean)
    return [...active, ...assignedArchived]
  })

  async function toggleTag(tagId) {
    await queueClientUpdate((c) => {
      const current = c.tags ?? []
      const tags = current.includes(tagId)
        ? current.filter((t) => t !== tagId)
        : [...current, tagId]
      return { ...c, tags }
    })
  }

  async function toggleDay(dayId) {
    await queueClientUpdate((c) => {
      const current = c.serviceDays ?? []
      const serviceDays = current.includes(dayId)
        ? current.filter((d) => d !== dayId)
        : [...current, dayId].sort((a, b) => a - b)
      return { ...c, serviceDays }
    })
  }

  async function deleteDraft(session) {
    if (confirm(`Delete draft session from ${fmtDate(session.date)}? This cannot be undone.`)) {
      await deleteRecord('sessions', session.id)
    }
  }
</script>

{#if !client}
  <p class="muted">Client not found. <a href={hrefFor('clients')}>Back to caseload</a></p>
{:else}
  <div class="toolbar">
    <a href={hrefFor('clients')}>← Caseload</a>
  </div>

  <div class="toolbar">
    <h1 style="margin:0">{client.code}</h1>
    {#if client.sample}<SampleTag />{/if}
    {#if client.archived}<span class="tag quiet">archived</span>{/if}
    <div class="right toolbar" style="margin-bottom:0">
      <button class="btn-primary" onclick={newSession}>New session</button>
      <a href={hrefFor(`client/${client.id}/progress`)}><button>Progress</button></a>
      <button onclick={toggleArchive}>{client.archived ? 'Unarchive' : 'Archive'}</button>
    </div>
  </div>

  <div class="card">
    <h3>Tags &amp; schedule</h3>
    {#if tagChoices.length === 0}
      <p class="muted" style="margin:0 0 0.5rem">
        No caseload tags yet.
        {#if $appMode !== 'demo'}
          <a href={hrefFor('settings')}>Define tags in Settings</a> to group students by grade,
          room, or site.
        {/if}
      </p>
    {:else}
      <div class="chips" style="margin-bottom:0.5rem" role="group" aria-label="Caseload tags">
        {#each tagChoices as t (t.id)}
          {@const on = (client.tags ?? []).includes(t.id)}
          <button
            type="button"
            class="chip"
            class:active={on}
            aria-pressed={on}
            style={t.archived ? 'opacity:0.55' : ''}
            onclick={() => toggleTag(t.id)}
          >
            {t.label}{#if t.archived}&nbsp;· archived{/if}
          </button>
        {/each}
      </div>
    {/if}
    <div class="chips" role="group" aria-label="Service days">
      {#each WEEKDAYS as d (d.id)}
        {@const on = (client.serviceDays ?? []).includes(d.id)}
        <button
          type="button"
          class="chip"
          class:active={on}
          aria-pressed={on}
          aria-label="{d.label} service day"
          onclick={() => toggleDay(d.id)}
        >
          {d.short}
        </button>
      {/each}
    </div>
    <p class="hint" style="margin:0.5rem 0 0">
      Tap to assign tags and usual service days — they power the caseload filters and the
      day-by-day view. Neutral labels only; never teacher, school, or student names.
    </p>
  </div>

  <div class="card">
    <h3>Context notes</h3>
    {#if notesDraft === null}
      <p class="muted" style="margin:0">
        {client.notes || 'No notes yet.'}
        <button class="btn-quiet" onclick={() => (notesDraft = client.notes ?? '')}>Edit</button>
      </p>
    {:else}
      <textarea
        rows="2"
        bind:value={notesDraft}
        placeholder="Scheduling, service minutes, groupings — no names or identifying details"
      ></textarea>
      <div class="toolbar" style="margin:0.5rem 0 0">
        <button class="btn-primary" onclick={saveNotes}>Save</button>
        <button onclick={() => (notesDraft = null)}>Cancel</button>
      </div>
    {/if}
  </div>

  <div class="toolbar" data-guide-target="student-goals">
    <h2 style="margin:0">Goals</h2>
    <button class="right" onclick={() => (editingGoal = 'new')}>+ Add goal</button>
  </div>

  {#if editingGoal !== null}
    <!-- keyed so switching which goal is edited remounts the form with fresh state -->
    {#key editingGoal === 'new' ? 'new' : editingGoal.id}
      <GoalBuilder
        clientId={client.id}
        goal={editingGoal === 'new' ? null : editingGoal}
        sampleSource={client}
        onclose={() => (editingGoal = null)}
      />
    {/key}
  {/if}

  {#if clientGoals.length === 0}
    <p class="muted">No goals yet.</p>
  {:else}
    {#each domainsWithGoals as domain (domain.id)}
      <h3 class="muted" style="margin-top:1rem">{domain.label}</h3>
      <div class="row-list">
        {#each clientGoals.filter((g) => g.domain === domain.id) as goal (goal.id)}
          {@const status = goalCriterionStatus(goal, clientSessions)}
          {@const points = goalPoints(goal.id, clientSessions)}
          <div class="row-item">
            <div style="flex:1; min-width:220px">
              <strong>{shortLabelFor(goal)}</strong>
              {#if status.met}<span class="tag good">criterion met</span>
              {:else if status.nearing}<span class="tag warn">
                  {status.streak}/{status.required} at target
                </span>{/if}
              <p class="muted" style="margin:0.15rem 0 0; font-size:0.85rem">{goal.text}</p>
            </div>
            <Sparkline points={points.map((p) => p.pct)} />
            <select
              value={goal.status}
              onchange={(e) => setGoalStatus(goal, e.target.value)}
              aria-label="Goal status"
            >
              <option value="active">active</option>
              <option value="met">met</option>
              <option value="discontinued">discontinued</option>
            </select>
            <button onclick={() => (editingGoal = goal)}>Edit</button>
          </div>
        {/each}
      </div>
    {/each}
  {/if}

  <h2 style="margin-top:1.5rem">Sessions</h2>
  {#if clientSessions.length === 0}
    <p class="muted">No sessions yet.</p>
  {:else}
    <div class="row-list">
      {#each clientSessions as session (session.id)}
        <div class="row-item">
          <strong>{fmtDate(session.date)}</strong>
          <span class="muted">{session.durationMin} min · {session.setting}</span>
          <span class="tag {session.status === 'final' ? 'good' : 'quiet'}">{session.status}</span>
          {#if session.groupId}
            <a href={hrefFor(`group/${session.groupId}`)} class="tag">group ↗</a>
          {/if}
          <div class="right toolbar" style="margin-bottom:0">
            <a href={hrefFor(`session/${session.id}`)}><button>Open</button></a>
            <a href={hrefFor(`session/${session.id}/note`)}><button>Note</button></a>
            {#if session.status === 'draft'}
              <button class="btn-quiet" onclick={() => deleteDraft(session)}>Delete</button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
{/if}
