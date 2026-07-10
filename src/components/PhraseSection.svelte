<script>
  import { appendPhrase } from '../lib/text.js'

  let {
    label,
    hint = '',
    // Dynamic, data-driven suggestions (A/P) shown first; never ranked or saved.
    suggestions = [],
    // Static bank chips (ranked, usage-tracked, learnable).
    chips = [],
    value = $bindable(''),
    disabled = false,
    rows = 3,
    placeholder = '',
    onchange = () => {},
    onuse = () => {}, // record a bank-chip use for ranking
    onsave = () => {} // save typed text into the learned corpus
  } = $props()

  let saving = $state(false)
  let draft = $state('')

  function add(chip, isBank) {
    value = appendPhrase(value, chip)
    if (isBank) onuse(chip)
    onchange()
  }

  function openSave() {
    draft = (value ?? '').replace(/\s+/g, ' ').trim()
    saving = true
  }

  function confirmSave() {
    const text = draft.trim()
    if (text) onsave(text)
    saving = false
    draft = ''
  }
</script>

<section class="card">
  <div class="toolbar" style="margin-bottom:0.4rem">
    <h3 style="margin:0">{label}</h3>
    {#if !disabled}
      <button
        type="button"
        class="btn-quiet right"
        style="min-height:32px; padding:0.15rem 0.5rem"
        onclick={openSave}
        disabled={!(value ?? '').trim()}
        title="Save what you typed as a reusable phrase"
      >
        ＋ Save phrase
      </button>
    {/if}
  </div>
  {#if hint}<p class="hint">{hint}</p>{/if}

  {#if saving}
    <div class="card" style="background:var(--accent-soft); border-color:transparent; margin-bottom:0.6rem">
      <label for="save-{label}">Save this phrase to your bank (trim it to the reusable part — no names)</label>
      <input id="save-{label}" bind:value={draft} style="width:100%" />
      <div class="toolbar" style="margin:0.5rem 0 0">
        <button type="button" class="btn-primary" onclick={confirmSave} disabled={!draft.trim()}>
          Save
        </button>
        <button type="button" onclick={() => (saving = false)}>Cancel</button>
      </div>
    </div>
  {/if}

  {#if suggestions.length}
    <div class="chips">
      {#each suggestions as chip}
        <button type="button" class="chip suggestion" {disabled} onclick={() => add(chip, false)}>
          {chip}
        </button>
      {/each}
    </div>
  {/if}
  <div class="chips">
    {#each chips as chip}
      <button type="button" class="chip" {disabled} onclick={() => add(chip, true)}>{chip}</button>
    {/each}
  </div>
  <textarea {rows} bind:value {disabled} oninput={onchange} {placeholder}></textarea>
</section>
