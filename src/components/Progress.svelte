<script>
  import { clients, goals, sessions } from '../lib/repo.js'
  import { goalPoints, progressSummary, goalCriterionStatus } from '../lib/progress.js'
  import { shortLabelFor } from '../lib/ogen.js'
  import { domainLabel } from '../lib/constants.js'
  import { todayISO } from '../lib/text.js'
  import { toast } from '../lib/toast.js'
  import Chart from './Chart.svelte'

  let { id } = $props()

  const client = $derived($clients.find((c) => c.id === id))
  const clientGoals = $derived(
    $goals
      .filter((g) => g.clientId === id)
      .sort((a, b) => (a.status === 'active' ? 0 : 1) - (b.status === 'active' ? 0 : 1))
  )

  let range = $state('all') // all | 30 | 90 | custom
  let fromDate = $state('')
  let toDate = $state('')

  const filteredSessions = $derived.by(() => {
    let list = $sessions.filter((s) => s.clientId === id)
    if (range === '30' || range === '90') {
      const cutoff = new Date(Date.now() - Number(range) * 86400000)
      const iso = todayISO(cutoff)
      list = list.filter((s) => s.date >= iso)
    } else if (range === 'custom') {
      if (fromDate) list = list.filter((s) => s.date >= fromDate)
      if (toDate) list = list.filter((s) => s.date <= toDate)
    }
    return list
  })

  async function copySummary() {
    const text = clientGoals
      .map((g) => progressSummary(g, filteredSessions))
      .join('\n\n')
    try {
      await navigator.clipboard.writeText(text)
      toast.show('Progress summary copied')
    } catch {
      toast.show('Could not copy — clipboard unavailable')
    }
  }
</script>

{#if !client}
  <p class="muted">Client not found. <a href="#/clients">Back to caseload</a></p>
{:else}
  <div class="toolbar">
    <a href="#/client/{client.id}">← {client.code}</a>
  </div>

  <div class="toolbar">
    <h1 style="margin:0">Progress — {client.code}</h1>
    <button class="btn-primary right" onclick={copySummary}>Copy progress summary</button>
  </div>

  <div class="toolbar">
    <label for="range" style="margin:0">Range</label>
    <select id="range" bind:value={range}>
      <option value="all">All time</option>
      <option value="30">Last 30 days</option>
      <option value="90">Last 90 days</option>
      <option value="custom">Custom</option>
    </select>
    {#if range === 'custom'}
      <input type="date" bind:value={fromDate} aria-label="From date" />
      <span class="muted">to</span>
      <input type="date" bind:value={toDate} aria-label="To date" />
    {/if}
  </div>

  {#if clientGoals.length === 0}
    <p class="muted">No goals yet for this client.</p>
  {/if}

  {#each clientGoals as goal (goal.id)}
    {@const points = goalPoints(goal.id, filteredSessions)}
    {@const status = goalCriterionStatus(goal, filteredSessions)}
    <div class="card">
      <div class="toolbar" style="margin-bottom:0.25rem">
        <h3 style="margin:0">{shortLabelFor(goal)}</h3>
        <span class="tag quiet">{domainLabel(goal.domain)}</span>
        <span class="tag {goal.status === 'active' ? '' : 'quiet'}">{goal.status}</span>
        {#if status.met}
          <span class="tag good">criterion met</span>
        {:else if status.streak > 0}
          <span class="tag warn">{status.streak}/{status.required} at target</span>
        {/if}
      </div>
      <p class="hint">{goal.text}</p>
      {#if points.length === 0}
        <p class="muted">No trial data in this range.</p>
      {:else}
        <Chart {points} target={goal.targetCriterion?.accuracyPct ?? null} />
      {/if}
    </div>
  {/each}
{/if}
