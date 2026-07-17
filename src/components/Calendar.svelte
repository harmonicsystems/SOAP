<script module>
  // Only the opaque view mode survives navigation — never dates or text.
  let savedCalView = { mode: 'week' }
</script>

<script>
  import { get } from 'svelte/store'
  import { clients, goals, sessions, appMode, putRecord } from '../lib/repo.js'
  import { navigate, hrefFor } from '../lib/router.js'
  import { newSessionRecord } from '../lib/session.js'
  import { sampleProvenance } from '../lib/sampleData.js'
  import { todayISO, fmtDate } from '../lib/text.js'
  import { WEEKDAYS } from '../lib/caseload.js'
  import {
    addDaysISO,
    mondayOf,
    weekDates,
    fullWeekDates,
    monthOf,
    monthLabel,
    monthDates,
    addMonths,
    monthGrid,
    sessionsByDate,
    dayPlan,
    rangeSummary,
    weekendSessions,
    latestSessionDate
  } from '../lib/calendar.js'
  import SampleTag from './SampleTag.svelte'

  const today = todayISO()

  // The demo's fictional term ends months before the evaluator's real "today";
  // anchor them on the term's last documented week instead of an empty page.
  function initialAnchor() {
    if (get(appMode) === 'demo') {
      const latest = latestSessionDate(get(sessions))
      if (latest && monthOf(latest) !== monthOf(today)) return latest
    }
    return today
  }

  let mode = $state(savedCalView.mode)
  let anchor = $state(initialAnchor())
  let selectedDate = $state(null) // month mode: expanded day
  let creating = $state(false) // one launchpad create at a time

  $effect(() => {
    savedCalView = { mode }
  })

  const byDate = $derived(sessionsByDate($sessions))
  const clientById = $derived(new Map($clients.map((c) => [c.id, c])))

  const week = $derived(weekDates(mondayOf(anchor)))
  const weekPlans = $derived(week.map((date) => dayPlan(date, $clients, byDate)))
  // Summaries count the FULL range (weekends included) so a manually
  // weekend-dated session is never missing from the header total.
  const weekSummary = $derived(rangeSummary(fullWeekDates(mondayOf(anchor)), byDate))
  const weekOffGrid = $derived(
    fullWeekDates(mondayOf(anchor))
      .slice(5)
      .flatMap((date) => byDate.get(date) ?? [])
  )

  const month = $derived(monthOf(anchor))
  const grid = $derived(monthGrid(month))
  const monthSummary = $derived(rangeSummary(monthDates(month), byDate))
  const offGrid = $derived(weekendSessions(month, $sessions))
  const selectedPlan = $derived(selectedDate ? dayPlan(selectedDate, $clients, byDate) : null)

  function shift(delta) {
    if (mode === 'week') anchor = addDaysISO(mondayOf(anchor), delta * 7)
    else {
      anchor = `${addMonths(month, delta)}-01`
      selectedDate = null
    }
  }

  function goToday() {
    anchor = today
    selectedDate = null
  }

  // The launchpad: open the student's session for that date, or create one
  // dated that day. Guarded so a double-tap cannot create two drafts.
  async function openOrCreate(client, date, session) {
    if (session) {
      navigate(`session/${session.id}`)
      return
    }
    if (creating) return
    creating = true
    try {
      const active = get(goals).filter((g) => g.clientId === client.id && g.status === 'active')
      const rec = await putRecord('sessions', {
        ...newSessionRecord(client.id, active, { date, setting: 'individual' }),
        ...sampleProvenance(client)
      })
      if (rec) navigate(`session/${rec.id}`)
    } finally {
      creating = false
    }
  }

  function statusLabel(session) {
    if (!session) return null
    return session.status === 'final' ? 'final ✓' : 'draft'
  }

  function summaryText({ total, drafts }) {
    const base = `${total} session${total === 1 ? '' : 's'}`
    return drafts > 0 ? `${base} · ${drafts} draft${drafts === 1 ? '' : 's'}` : base
  }
</script>

<div class="toolbar">
  <h1 style="margin:0">Schedule</h1>
  <div class="seg" role="group" aria-label="Calendar view">
    <button
      type="button"
      class:active={mode === 'week'}
      aria-pressed={mode === 'week'}
      onclick={() => (mode = 'week')}
    >
      Week
    </button>
    <button
      type="button"
      class:active={mode === 'month'}
      aria-pressed={mode === 'month'}
      onclick={() => {
        mode = 'month'
        selectedDate = null
      }}
    >
      Month
    </button>
  </div>
  <div class="right toolbar" style="margin-bottom:0">
    <button onclick={() => shift(-1)} aria-label="Previous {mode}">‹</button>
    <button onclick={goToday}>Today</button>
    <button onclick={() => shift(1)} aria-label="Next {mode}">›</button>
  </div>
</div>

{#snippet weekendNote(list)}
  {#if list.length > 0}
    <p class="hint" style="margin-top:0.5rem">
      {list.length} session{list.length === 1 ? '' : 's'} dated on a weekend:
      {#each list as s, i (s.id)}
        <a href={hrefFor(`session/${s.id}`)}>{clientById.get(s.clientId)?.code ?? '—'} {fmtDate(s.date)}</a>{i < list.length - 1 ? ', ' : ''}
      {/each}
    </p>
  {/if}
{/snippet}

{#if mode === 'week'}
  <p class="muted" style="margin:0 0 0.75rem">
    Week of {fmtDate(week[0])} · {summaryText(weekSummary)}
  </p>
  <div class="cal-week">
    {#each weekPlans as plan, i (plan.date)}
      <section class="cal-day" class:today={plan.date === today} aria-label="{WEEKDAYS[i].label} {fmtDate(plan.date)}">
        <h3>
          {WEEKDAYS[i].short}
          <span class="cal-date">{fmtDate(plan.date)}</span>
          {#if plan.date === today}<span class="tag good">today</span>{/if}
        </h3>
        {#if plan.planned.length === 0 && plan.extra.length === 0}
          <p class="muted cal-empty">No students scheduled.</p>
        {:else}
          {#each plan.planned as { client, session } (client.id)}
            <button
              type="button"
              class="cal-slot"
              disabled={creating && !session}
              title={session
                ? `Open ${client.code}'s ${session.status} session from ${fmtDate(plan.date)}`
                : `Start a session for ${client.code} dated ${fmtDate(plan.date)}`}
              onclick={() => openOrCreate(client, plan.date, session)}
            >
              <strong>{client.code}</strong>
              {#if client.sample}<SampleTag />{/if}
              {#if session}
                <span class="tag {session.status === 'final' ? 'good' : 'quiet'}">{statusLabel(session)}</span>
                {#if session.groupId}<span class="tag quiet">group</span>{/if}
              {:else}
                <span class="muted">＋ session</span>
              {/if}
            </button>
          {/each}
          {#each plan.extra as session (session.id)}
            {@const c = clientById.get(session.clientId)}
            <button
              type="button"
              class="cal-slot"
              title="Open this additional session"
              onclick={() => navigate(`session/${session.id}`)}
            >
              <strong>{c?.code ?? '—'}</strong>
              <span class="tag {session.status === 'final' ? 'good' : 'quiet'}">{statusLabel(session)}</span>
              {#if session.groupId}<span class="tag quiet">group</span>{/if}
              <span class="muted" style="font-size:0.75rem">additional</span>
            </button>
          {/each}
        {/if}
      </section>
    {/each}
  </div>
  {@render weekendNote(weekOffGrid)}
{:else}
  <p class="muted" style="margin:0 0 0.75rem">
    {monthLabel(month)} · {summaryText(monthSummary)}
  </p>
  <div class="cal-month" aria-label="{monthLabel(month)} sessions">
    {#each WEEKDAYS as d (d.id)}
      <div class="cal-month-head" aria-hidden="true">{d.short}</div>
    {/each}
    {#each grid as weekRow (weekRow[0].date)}
      {#each weekRow as cell (cell.date)}
        {@const cellSessions = byDate.get(cell.date) ?? []}
        {@const cellDrafts = cellSessions.filter((s) => s.status === 'draft').length}
        <button
          type="button"
          class="cal-cell"
          class:outside={!cell.inMonth}
          class:today={cell.date === today}
          class:selected={cell.date === selectedDate}
          aria-pressed={cell.date === selectedDate}
          aria-label="{fmtDate(cell.date)}: {cellSessions.length} session{cellSessions.length === 1 ? '' : 's'}{cellDrafts ? `, ${cellDrafts} draft${cellDrafts === 1 ? '' : 's'}` : ''}"
          onclick={() => (selectedDate = selectedDate === cell.date ? null : cell.date)}
        >
          <span class="cal-cell-day">{Number(cell.date.slice(8))}</span>
          {#if cellSessions.length > 0}
            <span class="tag">{cellSessions.length}</span>
          {/if}
          {#if cellDrafts > 0}
            <span class="tag quiet">{cellDrafts} draft{cellDrafts === 1 ? '' : 's'}</span>
          {/if}
        </button>
      {/each}
    {/each}
  </div>

  {@render weekendNote(offGrid)}

  {#if selectedPlan}
    <section class="card" style="margin-top:0.75rem" aria-label="Sessions on {fmtDate(selectedPlan.date)}">
      <h3 style="margin-top:0">
        {fmtDate(selectedPlan.date)}
        {#if selectedPlan.date === today}<span class="tag good">today</span>{/if}
      </h3>
      {#if selectedPlan.planned.length === 0 && selectedPlan.extra.length === 0}
        <p class="muted" style="margin:0">No students scheduled and no sessions recorded.</p>
      {:else}
        <div class="row-list">
          {#each selectedPlan.planned as { client, session } (client.id)}
            <button
              type="button"
              class="row-item clickable cal-detail-row"
              disabled={creating && !session}
              onclick={() => openOrCreate(client, selectedPlan.date, session)}
            >
              <strong style="min-width:4.5rem">{client.code}</strong>
              {#if client.sample}<SampleTag />{/if}
              {#if session}
                <span class="tag {session.status === 'final' ? 'good' : 'quiet'}">{statusLabel(session)}</span>
                {#if session.groupId}<span class="tag quiet">group</span>{/if}
              {:else}
                <span class="muted">scheduled · ＋ start session</span>
              {/if}
            </button>
          {/each}
          {#each selectedPlan.extra as session (session.id)}
            <button
              type="button"
              class="row-item clickable cal-detail-row"
              onclick={() => navigate(`session/${session.id}`)}
            >
              <strong style="min-width:4.5rem">{clientById.get(session.clientId)?.code ?? '—'}</strong>
              <span class="tag {session.status === 'final' ? 'good' : 'quiet'}">{statusLabel(session)}</span>
              {#if session.groupId}<span class="tag quiet">group</span>{/if}
              <span class="muted" style="font-size:0.85rem">additional</span>
            </button>
          {/each}
        </div>
      {/if}
    </section>
  {/if}
{/if}
