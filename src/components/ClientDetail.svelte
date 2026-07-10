<script>
  import { clients, goals, sessions, putRecord, deleteRecord } from '../lib/repo.js'
  import { navigate } from '../lib/router.js'
  import { DOMAINS, domainLabel } from '../lib/constants.js'
  import { goalCriterionStatus, goalPoints } from '../lib/progress.js'
  import { shortLabelFor } from '../lib/ogen.js'
  import { todayISO, fmtDate } from '../lib/text.js'
  import GoalBuilder from './GoalBuilder.svelte'
  import Sparkline from './Sparkline.svelte'

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
      id: crypto.randomUUID(),
      clientId: id,
      date: todayISO(),
      durationMin: 30,
      setting: 'individual',
      soap: { S: '', O: '', A: '', P: '' },
      oEdited: false,
      observations: '',
      standout: '',
      goalData: active.map((g) => ({
        goalId: g.id,
        trials: null,
        cueLevel: g.targetCriterion?.cueLevel ?? 'minimal',
        cueTypes: [],
        observations: [],
        activity: '',
        notes: ''
      })),
      status: 'draft',
      createdAt: Date.now()
    })
    navigate(`session/${rec.id}`)
  }

  async function setGoalStatus(goal, status) {
    await putRecord('goals', { ...goal, status })
  }

  async function toggleArchive() {
    await putRecord('clients', { ...client, archived: !client.archived })
  }

  async function saveNotes() {
    await putRecord('clients', { ...client, notes: notesDraft })
    notesDraft = null
  }

  async function deleteDraft(session) {
    if (confirm(`Delete draft session from ${fmtDate(session.date)}? This cannot be undone.`)) {
      await deleteRecord('sessions', session.id)
    }
  }
</script>

{#if !client}
  <p class="muted">Client not found. <a href="#/clients">Back to caseload</a></p>
{:else}
  <div class="toolbar">
    <a href="#/clients">← Caseload</a>
  </div>

  <div class="toolbar">
    <h1 style="margin:0">{client.code}</h1>
    {#if client.archived}<span class="tag quiet">archived</span>{/if}
    <div class="right toolbar" style="margin-bottom:0">
      <button class="btn-primary" onclick={newSession}>New session</button>
      <a href="#/client/{client.id}/progress"><button>Progress</button></a>
      <button onclick={toggleArchive}>{client.archived ? 'Unarchive' : 'Archive'}</button>
    </div>
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

  <div class="toolbar">
    <h2 style="margin:0">Goals</h2>
    <button class="right" onclick={() => (editingGoal = 'new')}>+ Add goal</button>
  </div>

  {#if editingGoal !== null}
    <!-- keyed so switching which goal is edited remounts the form with fresh state -->
    {#key editingGoal === 'new' ? 'new' : editingGoal.id}
      <GoalBuilder
        clientId={client.id}
        goal={editingGoal === 'new' ? null : editingGoal}
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
          <div class="right toolbar" style="margin-bottom:0">
            <a href="#/session/{session.id}"><button>Open</button></a>
            <a href="#/session/{session.id}/note"><button>Note</button></a>
            {#if session.status === 'draft'}
              <button class="btn-quiet" onclick={() => deleteDraft(session)}>Delete</button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
{/if}
