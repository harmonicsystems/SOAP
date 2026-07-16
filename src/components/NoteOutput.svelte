<script>
  import { sessions, clients, appSettings } from '../lib/repo.js'
  import { assembleNote } from '../lib/note.js'
  import SampleTag from './SampleTag.svelte'
  import { hrefFor } from '../lib/router.js'

  let { id } = $props()

  const session = $derived($sessions.find((s) => s.id === id))
  const client = $derived(session && $clients.find((c) => c.id === session.clientId))
  const text = $derived(session && client ? assembleNote(client, session) : '')

  let copied = $state(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // Clipboard API can be unavailable (permissions) — textarea fallback.
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
    }
    copied = true
    setTimeout(() => (copied = false), 2000)
  }
</script>

{#if !session || !client}
  <p class="muted">Session not found. <a href={hrefFor('clients')}>Back to caseload</a></p>
{:else}
  <div class="toolbar no-print">
    <a href={hrefFor(`session/${session.id}`)}>← Back to session</a>
    {#if session.sample}<SampleTag />{/if}
    <span class="tag {session.status === 'final' ? 'good' : 'quiet'}">{session.status}</span>
    <div class="right toolbar" style="margin-bottom:0">
      <button class="btn-primary" onclick={copy}>{copied ? 'Copied ✓' : 'Copy note'}</button>
      <button onclick={() => window.print()}>Print</button>
    </div>
  </div>
  {#if session.sample}
    <p class="print-only sample-print-banner">SAMPLE — FICTIONAL DATA</p>
  {/if}
  <pre class="note-text" data-guide-target="note-output">{text}</pre>
  {#if $appSettings.therapistName}
    <p class="print-only">Clinician: {$appSettings.therapistName}</p>
  {/if}
{/if}
