<script>
  import { appendPhrase } from '../lib/text.js'

  let {
    label,
    hint = '',
    chips = [],
    value = $bindable(''),
    disabled = false,
    rows = 3,
    placeholder = '',
    onchange = () => {}
  } = $props()

  function add(chip) {
    value = appendPhrase(value, chip)
    onchange()
  }
</script>

<section class="card">
  <h3>{label}</h3>
  {#if hint}<p class="hint">{hint}</p>{/if}
  <div class="chips">
    {#each chips as chip}
      <button type="button" class="chip" {disabled} onclick={() => add(chip)}>{chip}</button>
    {/each}
  </div>
  <textarea {rows} bind:value {disabled} oninput={onchange} {placeholder}></textarea>
</section>
