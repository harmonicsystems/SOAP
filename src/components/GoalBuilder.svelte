<script>
  import { putRecord } from '../lib/repo.js'
  import { DOMAINS, CUE_LEVELS } from '../lib/constants.js'
  import { getTemplates } from '../lib/goalTemplates.js'
  import { extractSlots, fillTemplate, slotLabel, slotInputType, CRITERION_SLOTS } from '../lib/templates.js'
  import { sampleProvenance } from '../lib/sampleData.js'

  let { clientId, goal = null, sampleSource = null, onclose } = $props()

  let domain = $state(goal?.domain ?? 'articulation-phonology')
  let mode = $state(goal ? 'free' : 'template')
  let templateId = $state(null)
  let slotValues = $state({})
  let freeText = $state(goal?.text ?? '')
  let shortLabel = $state(goal?.shortLabel ?? '')
  let baseline = $state(goal?.baseline ?? '')
  let criterion = $state({
    accuracyPct: goal?.targetCriterion?.accuracyPct ?? 80,
    consecutiveSessions: goal?.targetCriterion?.consecutiveSessions ?? 3,
    cueLevel: goal?.targetCriterion?.cueLevel ?? 'minimal'
  })
  let error = $state('')

  const templates = $derived(getTemplates(domain))
  const tpl = $derived(templates.find((t) => t.id === templateId) ?? null)
  const openSlots = $derived(
    tpl ? extractSlots(tpl.text).filter((s) => !CRITERION_SLOTS.includes(s)) : []
  )
  const boundValues = $derived({
    ...slotValues,
    accuracy: criterion.accuracyPct,
    cueLevel: criterion.cueLevel,
    sessions: criterion.consecutiveSessions
  })
  const previewText = $derived(
    mode === 'template' ? (tpl ? fillTemplate(tpl.text, boundValues) : '') : freeText
  )

  function pickDomain(d) {
    domain = d
    templateId = null
    slotValues = {}
  }

  async function save(e) {
    e.preventDefault()
    error = ''
    const text = previewText.trim()
    if (!text) {
      error = mode === 'template' ? 'Pick a template first.' : 'Write the goal text first.'
      return
    }
    await putRecord('goals', {
      id: goal?.id ?? crypto.randomUUID(),
      clientId,
      domain,
      text,
      shortLabel: shortLabel.trim(),
      targetCriterion: {
        accuracyPct: Number(criterion.accuracyPct),
        consecutiveSessions: Number(criterion.consecutiveSessions),
        cueLevel: criterion.cueLevel
      },
      baseline: baseline.trim(),
      status: goal?.status ?? 'active',
      createdAt: goal?.createdAt ?? Date.now(),
      ...sampleProvenance(goal ?? sampleSource)
    })
    onclose()
  }
</script>

<form class="card" onsubmit={save} style="border-color: var(--accent)">
  <h3>{goal ? 'Edit goal' : 'New goal'}</h3>

  <div class="field">
    <label for="gb-domain">Domain</label>
    <select
      id="gb-domain"
      value={domain}
      onchange={(e) => pickDomain(e.target.value)}
    >
      {#each DOMAINS as d}
        <option value={d.id}>{d.label}</option>
      {/each}
    </select>
  </div>

  <div class="field">
    <div class="seg" role="tablist">
      <button
        type="button"
        class:active={mode === 'template'}
        onclick={() => (mode = 'template')}
      >
        From template
      </button>
      <button type="button" class:active={mode === 'free'} onclick={() => (mode = 'free')}>
        Free text
      </button>
    </div>
  </div>

  {#if mode === 'template'}
    <div class="field">
      <label for="gb-template">Template</label>
      <select id="gb-template" bind:value={templateId} size="4" style="width:100%">
        {#each templates as t (t.id)}
          <option value={t.id}>{t.text}</option>
        {/each}
      </select>
    </div>
    {#if tpl && openSlots.length}
      <div class="field-row" style="margin-bottom:0.75rem">
        {#each openSlots as slot (tpl.id + slot)}
          {@const input = slotInputType(slot)}
          <div class="field" style="margin-bottom:0">
            <label for="slot-{slot}">{slotLabel(slot)}</label>
            {#if input.kind === 'number'}
              <input
                id="slot-{slot}"
                type="number"
                min="1"
                bind:value={slotValues[slot]}
                style="width:90px"
              />
            {:else if input.kind === 'select'}
              <select id="slot-{slot}" bind:value={slotValues[slot]}>
                <option value="">—</option>
                {#each input.options as opt}
                  <option value={opt}>{opt}</option>
                {/each}
              </select>
            {:else}
              <input id="slot-{slot}" bind:value={slotValues[slot]} style="width:180px" />
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  {:else}
    <div class="field">
      <label for="gb-free">Goal text</label>
      <textarea id="gb-free" rows="3" bind:value={freeText}></textarea>
    </div>
  {/if}

  <div class="field-row">
    <div class="field">
      <label for="gb-acc">Target accuracy %</label>
      <input id="gb-acc" type="number" min="1" max="100" bind:value={criterion.accuracyPct} style="width:90px" />
    </div>
    <div class="field">
      <label for="gb-sessions">Consecutive sessions</label>
      <input id="gb-sessions" type="number" min="1" max="20" bind:value={criterion.consecutiveSessions} style="width:90px" />
    </div>
    <div class="field">
      <label for="gb-cue">Cue level</label>
      <select id="gb-cue" bind:value={criterion.cueLevel}>
        {#each CUE_LEVELS as lvl}
          <option value={lvl}>{lvl}</option>
        {/each}
      </select>
    </div>
  </div>

  <div class="field-row">
    <div class="field">
      <label for="gb-label">Short label (used in notes and charts)</label>
      <input id="gb-label" bind:value={shortLabel} placeholder="e.g., /r/ in words" style="width:220px" />
    </div>
    <div class="field">
      <label for="gb-baseline">Baseline (optional)</label>
      <input id="gb-baseline" bind:value={baseline} placeholder="e.g., 35% at word level" style="width:220px" />
    </div>
  </div>

  {#if previewText}
    <div class="field">
      <label for="gb-preview">Preview</label>
      <p id="gb-preview" class="card" style="margin:0; background:var(--accent-soft); border-color:transparent">
        {previewText}
      </p>
    </div>
  {/if}

  {#if error}<p class="error-text">{error}</p>{/if}

  <div class="toolbar" style="margin:0.75rem 0 0">
    <button class="btn-primary" type="submit">{goal ? 'Save changes' : 'Add goal'}</button>
    <button type="button" onclick={onclose}>Cancel</button>
  </div>
</form>
