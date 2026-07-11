<script>
  // THE core screen (spec §5.4): optimized for live-session speed.
  // Trial taps update in-memory state instantly; persistence is debounced.
  import { onDestroy } from 'svelte'
  import { get } from 'svelte/store'
  import {
    sessions,
    goals,
    clients,
    appSettings,
    putRecord,
    onBeforeLock,
    recordPhraseUse,
    savePhrase
  } from '../lib/repo.js'
  import { navigate } from '../lib/router.js'
  import { todayISO, fmtDate } from '../lib/text.js'
  import { SESSION_SETTINGS, visibleObsTags } from '../lib/constants.js'
  import { generateO } from '../lib/ogen.js'
  import { rankedBank } from '../lib/phrasebanks.js'
  import { aSuggestions, pSuggestions } from '../lib/suggest.js'
  import { appendPhrase } from '../lib/text.js'
  import { isNearDuplicate } from '../lib/similarity.js'
  import { toast } from '../lib/toast.js'
  import GoalCard from './GoalCard.svelte'
  import PhraseSection from './PhraseSection.svelte'

  let { id } = $props()

  const stored = $derived($sessions.find((s) => s.id === id))
  const client = $derived(stored && $clients.find((c) => c.id === stored.clientId))
  const goalMap = $derived(new Map($goals.map((g) => [g.id, g])))

  let working = $state(null)
  let stacks = $state({}) // per-goal undo stacks (session-local, not persisted)
  let selected = $state(0)
  // Usage counts frozen at load so live chip taps don't reshuffle the bank
  // mid-session (ranking adaptation applies to the NEXT session). Read via
  // get() so it is not a reactive dependency.
  let usageSnapshot = $state({})
  // Ranking context, also frozen at load (round 3): this session's goal
  // domains and the client's PREVIOUS session texts per section — used to
  // demote just-used phrases and to power the finalize anti-repetition nudge.
  let rankContext = $state({ domains: [], prev: { S: '', O: '', A: '', P: '' }, prevDate: null })

  // Load a working copy when the session id changes; merge in goals that were
  // added since the session was created. The guard prevents autosave echoes
  // (store updates from our own putRecord) from clobbering live edits.
  $effect(() => {
    if (!stored) return
    if (working && working.id === stored.id) return
    const w = structuredClone(stored)
    w.soap ??= { S: '', O: '', A: '', P: '' }
    w.goalData ??= []
    w.observations ??= ''
    w.standout ??= ''
    for (const g of $goals.filter((x) => x.clientId === w.clientId && x.status === 'active')) {
      if (!w.goalData.some((gd) => gd.goalId === g.id)) {
        w.goalData.push({
          goalId: g.id,
          trials: null,
          cueLevel: g.targetCriterion?.cueLevel ?? 'minimal',
          cueTypes: [],
          observations: [],
          activity: '',
          notes: ''
        })
      }
    }
    working = w
    usageSnapshot = get(appSettings).phraseUsage ?? {}
    // freeze this session's domains + the previous session's section texts
    const gmap = new Map($goals.map((g) => [g.id, g]))
    const domains = [...new Set(w.goalData.map((gd) => gmap.get(gd.goalId)?.domain).filter(Boolean))]
    const prev = $sessions
      .filter(
        (s) =>
          s.clientId === w.clientId &&
          s.id !== w.id &&
          (s.date < w.date || (s.date === w.date && (s.createdAt ?? 0) < (w.createdAt ?? 0)))
      )
      .sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt ?? 0) - (b.createdAt ?? 0))
      .at(-1)
    rankContext = {
      domains,
      prev: {
        S: prev?.soap?.S ?? '',
        O: prev?.soap?.O ?? '',
        A: prev?.soap?.A ?? '',
        P: prev?.soap?.P ?? ''
      },
      prevDate: prev?.date ?? null
    }
    stacks = {}
    selected = 0
  })

  const cards = $derived(
    working
      ? working.goalData.map((gd) => ({ gd, goal: goalMap.get(gd.goalId) })).filter((c) => c.goal)
      : []
  )
  const isFinal = $derived(working?.status === 'final')

  // ---- autosave (drafts save on every change, debounced) ----
  let saveTimer = null
  let saveState = $state('saved') // 'pending' | 'saved'

  function scheduleSave() {
    if (!working) return
    saveState = 'pending'
    clearTimeout(saveTimer)
    saveTimer = setTimeout(flush, 400)
  }

  async function flush() {
    clearTimeout(saveTimer)
    saveTimer = null
    if (!working) return
    const saved = await putRecord('sessions', $state.snapshot(working))
    if (saved) saveState = 'saved'
  }

  onDestroy(() => {
    if (saveTimer) flush()
  })

  // Lock must not lose pending debounced edits: repo.lockNow() awaits this
  // flush while the key is still valid, then wipes.
  $effect(() => {
    const off = onBeforeLock(flush)
    return off
  })

  // ---- O auto-generation: live from trial data unless hand-edited ----
  const autoO = $derived(
    working && client
      ? generateO(
          client.code,
          $goals,
          working.goalData,
          working.observations,
          working.standout,
          $appSettings.customObsTags ?? []
        )
      : ''
  )

  // Observation chips are computed PER CARD (each card only re-adds hidden or
  // archived tags selected on THAT goal) — a session-wide union would render a
  // hidden tag as freshly tappable on every other card, defeating the hide.

  // Never regenerate on a finalized session — Finalize locks the note until
  // an explicit Reopen (spec §5.4), even if the goal's label changed since.
  $effect(() => {
    if (working && working.status !== 'final' && !working.oEdited && working.soap.O !== autoO) {
      working.soap.O = autoO
      scheduleSave()
    }
  })

  // ---- trial taps + undo ----
  function tap(gd, correct) {
    if (!gd || isFinal) return
    gd.trials ??= { correct: 0, total: 0 }
    gd.trials.total++
    if (correct) gd.trials.correct++
    ;(stacks[gd.goalId] ??= []).push(correct)
    scheduleSave()
  }

  function undo(gd) {
    if (!gd || isFinal) return
    const stack = stacks[gd.goalId]
    if (!stack?.length || !gd.trials) return
    const wasCorrect = stack.pop()
    gd.trials.total = Math.max(0, gd.trials.total - 1)
    if (wasCorrect) gd.trials.correct = Math.max(0, gd.trials.correct - 1)
    if (gd.trials.total === 0) gd.trials = null
    scheduleSave()
  }

  // ---- keyboard driving (spec §5.4): arrows select, c/x score, z undoes ----
  function onKey(e) {
    if (!working || isFinal || !cards.length) return
    const tag = e.target?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
    if (e.metaKey || e.ctrlKey || e.altKey) return
    const k = e.key.toLowerCase()
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      selected = Math.min(selected + 1, cards.length - 1)
      e.preventDefault()
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      selected = Math.max(selected - 1, 0)
      e.preventDefault()
    } else if (k === 'c') {
      tap(cards[selected]?.gd, true)
      e.preventDefault()
    } else if (k === 'x') {
      tap(cards[selected]?.gd, false)
      e.preventDefault()
    } else if (k === 'z') {
      undo(cards[selected]?.gd)
      e.preventDefault()
    }
  }

  // Empty number/date inputs bind null in Svelte 5 — never let that reach a
  // stored session ("SOAP NOTE — JD — … — null min — …" in a pasted note).
  function coerceHeaderFields() {
    working.durationMin = Math.max(1, Math.round(Number(working.durationMin) || 30))
    if (!working.date) working.date = todayISO()
  }

  async function finalize() {
    coerceHeaderFields()
    // Anti-repetition nudge (round 3): if S or A reads nearly the same as this
    // client's previous note, ask — never block, never rewrite.
    if (rankContext.prevDate) {
      const repeated = []
      if (isNearDuplicate(working.soap.S, rankContext.prev.S)) repeated.push('S')
      if (isNearDuplicate(working.soap.A, rankContext.prev.A)) repeated.push('A')
      if (repeated.length) {
        const what =
          repeated.length === 2 ? 'S and A sections read' : `${repeated[0]} section reads`
        const ok = confirm(
          `The ${what} nearly the same as this client's previous note (${fmtDate(rankContext.prevDate)}). Anything different today? OK finalizes as-is.`
        )
        if (!ok) return
      }
    }
    working.status = 'final'
    await flush()
  }

  async function reopen() {
    working.status = 'draft'
    await flush()
  }

  // ---- phrase chips ----
  const clientSessions = $derived(
    working
      ? $sessions
          .filter((s) => s.clientId === working.clientId)
          .map((s) => (s.id === working.id ? $state.snapshot(working) : s))
      : []
  )
  // Data-driven suggestions (computed live) are shown separately from the
  // ranked static bank; only bank chips are usage-tracked and learnable.
  const aSug = $derived(
    working ? aSuggestions($state.snapshot(working), goalMap, clientSessions) : []
  )
  const pSug = $derived(working ? pSuggestions($state.snapshot(working), goalMap) : [])
  const bankCtx = (section) => ({
    domains: rankContext.domains,
    prevText: rankContext.prev[section]
  })
  const sBank = $derived(rankedBank($appSettings, 'S', usageSnapshot, bankCtx('S')))
  const oBank = $derived(rankedBank($appSettings, 'O', usageSnapshot, bankCtx('O')))
  const aBank = $derived(rankedBank($appSettings, 'A', usageSnapshot, bankCtx('A')))
  const pBank = $derived(rankedBank($appSettings, 'P', usageSnapshot, bankCtx('P')))

  function addObservation(chip) {
    working.observations = appendPhrase(working.observations, chip)
    // Once O is hand-edited the regeneration effect is paused, so the chip
    // must also land in the visible O text directly or it would never reach
    // the note (spec §6: observations appendable via chips).
    if (working.oEdited) working.soap.O = appendPhrase(working.soap.O, chip)
    recordPhraseUse('O', chip)
    scheduleSave()
  }

  async function saveLearned(section, text) {
    // Tag the phrase with this session's goal domains for affinity ranking.
    const added = await savePhrase(section, text, rankContext.domains)
    toast.show(added ? 'Phrase saved to your bank' : 'That phrase is already in your bank')
  }

  function regenerateO() {
    working.oEdited = false
    working.soap.O = autoO
    scheduleSave()
  }
</script>

<!-- pagehide: best-effort flush of pending edits on tab close/navigation -->
<svelte:window onkeydown={onKey} onpagehide={() => saveTimer && flush()} />

{#if !working || !client}
  <p class="muted">Session not found. <a href="#/clients">Back to caseload</a></p>
{:else}
  <div class="toolbar no-print">
    <a href="#/client/{client.id}">← {client.code}</a>
    <span class="muted" aria-live="polite">{saveState === 'saved' ? 'Saved' : 'Saving…'}</span>
    <div class="right toolbar" style="margin-bottom:0">
      {#if isFinal}
        <span class="tag good">finalized</span>
        <button onclick={reopen}>Reopen</button>
      {:else}
        <button onclick={finalize}>Finalize</button>
      {/if}
      <a href="#/session/{working.id}/note"><button class="btn-primary">View note</button></a>
    </div>
  </div>

  <div class="card">
    <div class="field-row">
      <div class="field" style="margin-bottom:0">
        <label for="sess-date">Date</label>
        <input
          id="sess-date"
          type="date"
          bind:value={working.date}
          disabled={isFinal}
          onchange={() => {
            coerceHeaderFields()
            scheduleSave()
          }}
        />
      </div>
      <div class="field" style="margin-bottom:0">
        <label for="sess-dur">Duration (min)</label>
        <input
          id="sess-dur"
          type="number"
          min="1"
          bind:value={working.durationMin}
          disabled={isFinal}
          onchange={() => {
            coerceHeaderFields()
            scheduleSave()
          }}
          style="width:80px"
        />
      </div>
      <div class="field" style="margin-bottom:0">
        <label for="sess-setting">Setting</label>
        <select
          id="sess-setting"
          bind:value={working.setting}
          disabled={isFinal}
          onchange={scheduleSave}
        >
          {#each SESSION_SETTINGS as s}
            <option value={s}>{s}</option>
          {/each}
        </select>
      </div>
      <p class="kbd-hint right" style="margin:0">
        <kbd>↑</kbd><kbd>↓</kbd> select goal · <kbd>C</kbd> correct · <kbd>X</kbd> incorrect ·
        <kbd>Z</kbd> undo
      </p>
    </div>
  </div>

  {#if cards.length === 0}
    <p class="muted">
      No active goals for this client. <a href="#/client/{client.id}">Add goals first.</a>
    </p>
  {/if}

  {#each cards as { gd, goal }, i (gd.goalId)}
    <GoalCard
      {goal}
      {gd}
      obsTags={visibleObsTags($appSettings, gd.observations ?? [])}
      selected={i === selected && !isFinal}
      disabled={isFinal}
      canUndo={(stacks[gd.goalId]?.length ?? 0) > 0}
      ontap={(correct) => {
        selected = i
        tap(gd, correct)
      }}
      onundo={() => undo(gd)}
      onchange={scheduleSave}
    />
  {/each}

  <section class="card" style="border-left:3px solid var(--accent)">
    <label for="sess-standout" style="font-size:0.95rem; color:var(--ink); font-weight:600">
      What stood out this session?
    </label>
    <p class="hint" style="margin-top:0.1rem">
      One specific thing — a moment, a breakthrough, something you'd want to remember. This is
      what makes the note real. Added to the end of O. (No names.)
    </p>
    <input
      id="sess-standout"
      style="width:100%"
      bind:value={working.standout}
      disabled={isFinal}
      oninput={scheduleSave}
      placeholder="e.g., used the whiteboard unprompted to self-cue /r/ before each word"
    />
  </section>

  <PhraseSection
    label="S — Subjective"
    chips={sBank}
    bind:value={working.soap.S}
    disabled={isFinal}
    onchange={scheduleSave}
    onuse={(chip) => recordPhraseUse('S', chip)}
    onsave={(text) => saveLearned('S', text)}
    placeholder="Arrival, mood, engagement, reports from teacher/parent…"
  />

  <section class="card">
    <h3>O — Objective (auto-generated from trial data)</h3>
    <p class="hint">
      Updates live as you tap trials{working.oEdited ? ' — paused because you edited it' : ''}.
    </p>
    <div class="chips">
      {#each oBank as chip}
        <button type="button" class="chip" disabled={isFinal} onclick={() => addObservation(chip)}>
          {chip}
        </button>
      {/each}
    </div>
    <textarea
      rows="4"
      bind:value={working.soap.O}
      disabled={isFinal}
      oninput={() => {
        working.oEdited = true
        scheduleSave()
      }}
    ></textarea>
    {#if working.oEdited && !isFinal}
      <button class="btn-quiet" onclick={regenerateO}>Regenerate from data</button>
    {/if}
  </section>

  <PhraseSection
    label="A — Assessment"
    hint="Accent-edged chips are computed from this session's data; the rest is your bank."
    suggestions={aSug}
    chips={aBank}
    bind:value={working.soap.A}
    disabled={isFinal}
    onchange={scheduleSave}
    onuse={(chip) => recordPhraseUse('A', chip)}
    onsave={(text) => saveLearned('A', text)}
    placeholder="Progress statements, response to cues, comparison with previous sessions…"
  />

  <PhraseSection
    label="P — Plan"
    suggestions={pSug}
    chips={pBank}
    bind:value={working.soap.P}
    disabled={isFinal}
    onchange={scheduleSave}
    onuse={(chip) => recordPhraseUse('P', chip)}
    onsave={(text) => saveLearned('P', text)}
    placeholder="Next steps, cue fading, generalization, home practice…"
  />
{/if}
