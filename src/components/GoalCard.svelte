<script>
  import { CUE_LEVELS, CUE_TYPES, OBSERVATION_TAGS, domainLabel } from '../lib/constants.js'
  import { accuracyPct, shortLabelFor } from '../lib/ogen.js'

  let {
    goal,
    gd,
    obsTags = OBSERVATION_TAGS, // settings-aware list passed by SessionScreen
    selected = false,
    disabled = false,
    canUndo = false,
    ontap,
    onundo,
    onchange
  } = $props()

  const pct = $derived(gd.trials?.total ? accuracyPct(gd.trials.correct, gd.trials.total) : null)

  function toggleType(t) {
    gd.cueTypes ??= []
    const i = gd.cueTypes.indexOf(t)
    if (i >= 0) gd.cueTypes.splice(i, 1)
    else gd.cueTypes.push(t)
    onchange()
  }

  // Observation tags (§2): tapped tags flow into the O section as a natural
  // second sentence for this goal — texture the trial numbers can't capture.
  function toggleObservation(id) {
    gd.observations ??= []
    const i = gd.observations.indexOf(id)
    if (i >= 0) gd.observations.splice(i, 1)
    else gd.observations.push(id)
    onchange()
  }
</script>

<div class="goal-card" class:selected>
  <div class="goal-card-head">
    <div>
      <strong>{shortLabelFor(goal)}</strong>
      <span class="tag quiet">{domainLabel(goal.domain)}</span>
    </div>
    <div class="readout" aria-live="polite">
      {#if gd.trials?.total}
        {gd.trials.correct}/{gd.trials.total} <span class="pct">({pct}%)</span>
      {:else}
        <span class="muted" style="font-size:0.9rem; font-weight:400">no trials yet</span>
      {/if}
    </div>
  </div>

  <div class="tap-row">
    <button type="button" class="tap correct" {disabled} onclick={() => ontap(true)}>
      + Correct
    </button>
    <button type="button" class="tap incorrect" {disabled} onclick={() => ontap(false)}>
      − Incorrect
    </button>
    <button type="button" class="undo" disabled={disabled || !canUndo} onclick={onundo}>
      Undo
    </button>
  </div>

  <div class="seg" role="group" aria-label="Cue level">
    {#each CUE_LEVELS as lvl}
      <button
        type="button"
        class:active={gd.cueLevel === lvl}
        {disabled}
        onclick={() => {
          gd.cueLevel = lvl
          onchange()
        }}
      >
        {lvl}
      </button>
    {/each}
  </div>

  <div class="chips" aria-label="Cue types">
    {#each CUE_TYPES as t}
      <button
        type="button"
        class="chip"
        class:active={gd.cueTypes?.includes(t)}
        {disabled}
        onclick={() => toggleType(t)}
      >
        {t}
      </button>
    {/each}
  </div>

  <p class="hint" style="margin:0.5rem 0 0.15rem">What happened this session?</p>
  <div class="chips" aria-label="Observations">
    {#each obsTags as t (t.id)}
      <button
        type="button"
        class="chip obs"
        class:active={gd.observations?.includes(t.id)}
        {disabled}
        title={t.clause}
        onclick={() => toggleObservation(t.id)}
      >
        {t.chip}
      </button>
    {/each}
  </div>

  <div class="inline-fields">
    <input
      placeholder="Activity (e.g., structured drill, barrier game)"
      bind:value={gd.activity}
      {disabled}
      oninput={onchange}
    />
    <input placeholder="Notes for this goal" bind:value={gd.notes} {disabled} oninput={onchange} />
  </div>
</div>
