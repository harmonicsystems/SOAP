# SOAP Note Builder — architecture & working notes

A local-first, offline PWA for a school-based speech-language pathologist: collect session trial
data live and generate clean, EMR-pasteable SOAP notes fast. Private workspaces are encrypted in
the browser; the separate public demo contains only bundled fiction in memory. No backend.
Deploys to GitHub Pages at **soap.harmonic-systems.org**.

Built by Harmonic Systems. This file is the living architecture doc; the original product spec
(the detailed build prompt) is preserved in git history at the first commit (`cbd7db1`). Tests are
the source of truth for exact output formats.

---

## Hard constraints (non-negotiable)

- **No backend, no network calls with data — ever.** Zero analytics, zero telemetry, zero CDN
  fonts/scripts. Everything is self-hosted in the bundle. The only user-initiated network touch is
  the `mailto:` contact link on the Help page (opens the user's mail app; sends nothing itself).
- **Deterministic, no AI in the shipped app.** Every template, suggestion, and generated note is
  plain text assembly — same input always yields same output. (AI was used to *build* the app; it
  is not *in* the app. This distinction is stated on the Help page and must stay true.)
- **Bundle budget: total JS ≤ 120 KB gzipped**, enforced by `scripts/check-bundle-size.mjs` in
  every `npm run build` (CI fails over budget). Currently ~113 KB. **No new runtime dependency
  without a size justification in a code comment.** Only runtime dep is Dexie.
- **Plain CSS** with custom properties (`src/styles/global.css`) — no framework. Low-stimulation
  design: muted palette, generous whitespace, big touch targets, works on a weak Acer/Edge laptop.
  Four curated palettes (default/studio/clinic/evening, from the Harmonic Systems playground) +
  a system-serif reading option, chosen in Settings → Appearance (`settings.appearance`), applied
  via `data-palette`/`data-font` on `<html>` ONLY while a private workspace is unlocked — Welcome,
  lock screens, and the demo always render the default; printing forces black-on-white.
  **Every palette must pass `scripts/check-contrast.mjs` (WCAG AA), which gates `npm run build`
  alongside the bundle-size check.** No CDN fonts ever — system font stacks only.
- **Hash routing only** (`#/clients`, `#/session/:id`) — GitHub Pages has no SPA rewrites.
- **De-identification by design:** clients are initials/short codes only (max 5 chars, no spaces).
  No field anywhere accepts names, DOB, or school.

## Tech stack

Svelte 5 (runes; plain Svelte, **not** SvelteKit) + Vite · Dexie (IndexedDB) · native WebCrypto ·
hand-rolled SVG charts · `vite-plugin-pwa` (Workbox) · Vitest. Node 20.17 here → Vite 6 pinned
(Vite 7 needs Node 20.19+).

---

## Architecture & file map

`src/lib/` is the pure logic layer (unit-tested, no Svelte). `src/components/` is thin UI.

**Crypto & storage**
- `crypto.js` — WebCrypto only. PBKDF2-SHA-256, **310k** iterations, 16-byte salt → AES-GCM-256
  key (non-extractable). Blob layout `[12-byte IV][ciphertext]`, fresh IV per write. Verification
  value = encrypted known constant.
- `db.js` — Dexie `soap-note-builder`. Data tables store **only `{id, updatedAt, blob}`** where
  `blob` is ciphertext; all queryable fields live *inside* the encrypted payload. `meta` table
  holds vault params (salt, iterations, verification, epoch) + backup/modified timestamps.
- `repo.js` — the encrypted repository + shared in-memory Svelte stores. Owns the key (module-var,
  wiped on lock), private lock/unlock/CRUD/settings/rekey/import, corpus mutators, and the strict
  `locked|private|demo` lifecycle. Demo mutations update stores only and never touch Dexie.
- `backup.js` — `SOAPBKP1` file format (magic + salt-len + salt + 4-byte LE iterations + IV +
  ciphertext; self-contained, restore needs only the passphrase). `mergeRecords` (by id, newer
  wins), `mergeCorpusSettings` (merge-mode import), `saveBackupFile` (File System Access API +
  `<a download>` fallback).

**Note generation & corpus**
- `ogen.js` — O-section assembly. `goalSentence` (exact spec pattern), `observationSentence`
  (Oxford-comma join of observation-tag clauses, resolves custom+archived tags), `generateO`
  (per-goal trial + observation sentences, then chip observations, then the capitalized standout).
- `note.js` — `assembleNote` (exact plain-text §7 format; `note.test.js` is authoritative) +
  `scrubPlainText` (strips smart quotes/tabs/blank lines for clean EMR paste).
- `phrasebanks.js` — `DEFAULT_BANKS`, `effectiveBank` (base list), `phraseKey(section, text)` =
  `section:normalized-lowercase`, `usedInPrevText` (slot-aware, word-boundary-safe), `rankedBank`
  (the session-screen ranking — see corpus section).
- `suggest.js` — data-driven A/P suggestion chips computed live from session data ("improved from
  X% to Y%", "approaching criterion", "fade cues toward…"). These are *not* learnable/ranked.
- `similarity.js` — token-set Jaccard + `isNearDuplicate` (≥5 tokens, ≥0.75) for the anti-repetition nudge.
- `goalTemplates.js` / `templates.js` — goal-template bank (≥8 per priority domain) + slot engine.
- `progress.js` — accuracy math, accuracy-plus-cue criterion streaks, `progressSummary` (IEP
  paragraph per goal).
- `constants.js` — enums, `DOMAINS`, `OBSERVATION_TAGS` (`{id, chip, clause}`), `resolveObsTag`
  (includes archived + custom), `visibleObsTags`, `nextCueLevel`.
- `text.js` (`appendPhrase`, `fmtDate`, `todayISO`, `daysAgoLabel`), `toast.js` (transient toast +
  separate `updateReady` slot for the PWA update prompt), `router.js` (`matchRoute` pure/testable,
  public/private/demo route modes, mode-preserving `hrefFor`/`navigate`, `redirect` replace).

- `session.js` — `newSessionRecord(clientId, activeGoals, opts)`: the one builder for both
  individual and group sessions (carries `groupId`). Used by ClientDetail and `repo.createGroup`.
- `caseload.js` — caseload legibility (round 5): `buildStatsMap` (one pass → per-client
  activeCount/lastSession/nearing/primaryDomain), `filterClients` (code search + **AND** across
  selected tags; unknown/archived tag ids are dropped so stale selections never blank the list),
  `sortClients` ('code' | 'last-seen': never-seen first, then oldest, code tie-break),
  `groupClients` (partitions an already-sorted list into sections: tag = definition order with
  multi-membership, domain = primaryDomain single-membership, day = Mon–Fri; catch-all buckets
  last, empty sections dropped), `resolveCaseloadTag` (includes archived), `visibleCaseloadTags`,
  `WEEKDAYS`. Caseload tags are `settings.caseloadTags` `{id:'ctag-…', label, archived}` —
  archived never deleted; definitions travel through merge-import via `mergeCorpusSettings`.
- `calendar.js` — Schedule screen logic (round 6): UTC-safe ISO date math (`mondayOf`, `weekDates`,
  `monthGrid` — Mon–Fri school grid whose weeks all touch the month), `sessionsByDate`,
  `dayPlan(date, clients, byDate)` = the planned-vs-actual join (scheduled clients with that
  date's session or null, plus `extra` unscheduled sessions so makeups never disappear),
  `rangeSummary` (total/drafts accountability counts), `weekendSessions` (manually weekend-dated
  work stays discoverable despite the 5-column grid), `latestSessionDate` (anchors the demo
  calendar inside its fictional term instead of an empty real-world "today").
- `sampleData.js` — compact deterministic generator for the most recently completed January–April
  term: 25 letter-only codes, 35 goals, 268 per-client sessions, 7 recurring groups, and 110 total
  meetings. Carries `sample:true` + `sampleDataset:'winter-trimester-v2'`; O text always flows
  through production `generateO()`. Exports `DEMO_CASELOAD_TAGS` (grade spread + two room labels);
  each demo client gets tags plus one `serviceDays` weekday derived from the same day constants
  that place its session dates.

**Components** — `App.svelte` (mode orchestration + private auto-lock), `Welcome`, `LockScreen`
(create/unlock), `Workspace`, `Header`, `DemoBanner`, `DemoGuide`, `Caseload` (+ group creation),
`Calendar` (Schedule screen: week planned-vs-actual + month grid; tapping a scheduled student
opens or creates that day's session — the create is double-tap guarded),
`ClientDetail`, `GoalBuilder`, `SessionScreen` (core live screen; `embedded` prop for group use),
`GoalCard`, `PhraseSection`, `NoteOutput`, `Progress`, `Chart`/`Sparkline` (SVG), `Settings`, `Help`,
`GroupSession` (client-switcher wrapper reusing SessionScreen), `BackupBanner`, `SampleTag`, `Toast`.

## Data model (inside encrypted payloads)

```
Client:  { id, code, notes?, archived, createdAt, sample?, sampleDataset?,
           tags?: [caseloadTagId], serviceDays?: [1..5] }   // ISO weekday, Mon–Fri
Goal:    { id, clientId, domain, text, shortLabel?,
           targetCriterion {accuracyPct, consecutiveSessions, cueLevel},
           baseline?, status: active|met|discontinued, createdAt }
Session: { id, clientId, groupId?, date, durationMin, setting, status: draft|final,
           soap {S, O, A, P}, oEdited, observations (O-chip text), standout (one-liner),
           goalData: [GoalData], createdAt, updatedAt }   // groupId links group members
GoalData:{ goalId, trials: {correct,total}|null, cueLevel, cueTypes: [],
           observations: [tagId], activity?, notes? }
Setting: { id:'settings', autoLockMinutes, therapistName?,
           phraseBanks {S,O,A,P: null|[...]},          // Settings-edited overlay (null=defaults)
           learned {S,O,A,P: [...]},                    // phrases saved from typing
           phraseUsage {sectionKey: {count,lastUsedAt}},// ranking signal
           phraseDomains {sectionKey: [domainIds]},     // domain affinity
           customObsTags [{id,chip,clause,archived}], hiddenObsTags [builtinId],
           caseloadTags [{id,label,archived}],          // client organization labels
           appearance {palette, font} }                 // device look; default outside private
```

`domain` ∈ receptive-language, expressive-language, articulation-phonology, social-pragmatic
(full templates), fluency, voice, other (generic).

---

## Invariants — do not break these

- **Never `await` WebCrypto inside a Dexie transaction** (it aborts the txn). Pre-encrypt all blobs
  *before* `db.transaction(...)` — see `changePassphrase`, `importData`.
- **Tables store only `{id, updatedAt, blob}`.** Any new queryable field goes *inside* the payload
  and is indexed in memory after unlock, never as a Dexie index.
- **Key/passphrase are never persisted** and are wiped on lock (`hardLock` also clears the debounced
  usage timer). `lockNow` first awaits registered `onBeforeLock` hooks plus centrally tracked
  destroy-time writes, so a lock or private→demo route change mid-typing never drops data.
- **Mode transitions invalidate async private work.** Unlock/create/rekey/import/group creation
  capture the lifecycle generation, mode, key, and epoch as applicable. Stale completions never
  publish stores or revive a key after demo entry. Unlock decrypts into local arrays and publishes
  the private snapshot only after final epoch/generation checks; group creation is one atomic
  transaction rather than N per-student writes.
- **Cross-tab safety via vault epoch.** Private record puts/deletes and settings saves capture the epoch
  before asynchronous work, then check it and mutate inside one Dexie transaction (WebCrypto still
  happens before it). External mismatch hard-locks; an operation superseded by a same-tab epoch
  rotation is dropped. Rekey, import, and erase mint an epoch and post to the `soap-vault`
  BroadcastChannel; other private tabs hard-lock. Demo tabs hold no private key and ignore vault
  epoch messages.
- **Corpus state is section-scoped.** `phraseUsage` and `phraseDomains` key on `phraseKey(section,
  text)` (whitespace-collapsed, lowercased). `rankedBank` falls back to legacy plain-text keys for
  pre-round-3 data. Identical text in two sections must never share/clobber state.
- **Ranking is frozen at session mount.** `SessionScreen` snapshots `usageSnapshot` and
  `rankContext` (via `get()`, not reactive) so live chip taps never reshuffle chips under the
  finger — adaptation shows up next session. A newly *saved* phrase still appears (learned list is
  reactive).
- **O regeneration pauses** when `oEdited` (user hand-edited O) or `status === 'final'`. Finalize
  locks the note until explicit Reopen.
- **Observation tags are archived, never deleted** — `resolveObsTag` resolves archived + custom ids
  so old notes always render their clauses. `visibleObsTags` is computed *per goal card* (a hidden
  tag must not become re-tappable on another card).
- **Exact output formats are test-locked:** note format → `note.test.js`; O sentence pattern →
  `ogen.test.js`. Change the format only with the test.
- **PWA:** `registerType: 'prompt'` — never auto-reload (a live session must not be interrupted).
  The update prompt uses its own `updateReady` store slot so a transient toast can't destroy it.

## The corpus & observation system (rounds 2–3)

Purpose: fight note monotony and capture what actually happened, deterministically.

- **Learn from typing** — "＋ Save phrase" in `PhraseSection` saves the clinician's own S/A/P lines
  into `settings.learned` (separate from `phraseBanks` so a defaults-reset never wipes them).
- **Ranking** (`rankedBank`), precedence: (1) freshness — phrases in *this client's previous note*
  for the section sink (`usedInPrevText`, slot-aware + boundary-safe); (2) domain affinity — matched
  2 / untagged 1 / mismatched 0; (3) usage count; (4) recency; (5) base order.
- **Observation chips** — quick-tap `OBSERVATION_TAGS` on goal cards → `gd.observations`, flow into
  O via `observationSentence`. Custom tags + hiding built-ins in Settings.
- **"What stood out?"** — session `standout` line, appended to O (the un-fakeable specificity).
- **Anti-repetition nudge** — `finalize()` `confirm()`s (never blocks) when S or A is a near-
  duplicate of the previous note.
- Design rule: **specificity as the path of least resistance; suggestions grounded in real data or
  the clinician's own words — never fabricated.** O-frame randomization deliberately NOT done
  (scannable consistency across sessions is a feature). No cloud voice-to-text (violates no-network).

## Group sessions

A group session is **N linked per-client `Session` records sharing a `groupId`** (2–4 students) —
NOT a new multi-client type. Each student keeps a normal session and its own separate note; the
group is only a shared data-entry surface. `createGroup` builds one session per client (seeded with
that client's active goals, `setting: 'group'`). `GroupSession.svelte` is a thin wrapper: a client
switcher + a `{#key}`-remounted `<SessionScreen embedded />` per student, so all the hardened
per-session logic is reused, not forked. Remounting on switch flushes the outgoing student's
autosave via `onDestroy`. Every per-client path (notes, progress, caseload, backup) works unchanged
because the underlying records are ordinary sessions. Ranking/nudge naturally exclude other group
members (they filter by `clientId`).

## Public demo and application modes

`#/` is a public Welcome screen with two separate paths: passphrase-free **See the demo**, or
Create/Unlock a private workspace. Public routes are `#/`, `#/create`, `#/unlock`, and `#/help`;
private app routes retain their original unprefixed hashes. Every demo route begins `#/demo/...`,
including direct client, progress, session, note, group, Help, and six guide routes. `hrefFor()`
preserves the active mode so ordinary production components work in both workspaces.

The demo reuses the production stores, record shapes, note generator, charts, and UI components,
but `enterDemo()` first flushes pending private autosaves, wipes the private key/cache, and then
populates bundled fiction. Demo `putRecord`, delete, settings, corpus, and group writes are memory
only. Reset/reload/exit rebuilds or wipes those stores. Private-only Settings/backup/import/rekey
surfaces have no demo route, and demo records never enter Dexie or backups. Repository tests compare
all IndexedDB rows before/after demo mutation and then re-unlock a private sentinel.

The canonical `winter-trimester-v2` fixture uses 25 unique 2–3 letter uppercase codes and exactly
35 goals/268 session records. Student-level outcome distribution is test-locked at 5 clear,
6 modest/noisy, 5 plateau, 3 lower-recent, 4 mixed-goal, and 2 cue-dependent. Only 5 goals meet
criterion; 28 remain active and 2 are discontinued/reframed. A/P wording is neutral and never
attributes a cause for flat or lower performance. `DemoGuide` renders the actual Caseload, Client,
Progress (plateauing MEP), Session, Note, and Group components—not screenshots or mock controls.

## Security & lock model

App opens on public Welcome; private routes remain locked until passphrase unlock. Auto-lock after
N idle minutes (configurable) or >5 min tab-hidden runs only in private mode (the timer fires while
hidden, not only on return). Locking wipes the in-memory key and every decrypted store. Passphrase
loss = permanent data loss — Welcome/onboarding + Settings + Help say so, and push regular backups.
Request `navigator.storage.persist()` on unlock. Backup nag banner when changes are >7 days newer
than the last export. Help remains reachable before vault creation/unlock. Entering demo from an
unlocked private route awaits `onBeforeLock` hooks before wiping and loading fiction.

---

## Dev workflow

```
npm install
npm run dev        # dev server (hot reload, no service worker)
npm test           # vitest — 130 tests across lib (crypto, backup, corpus, caseload, calendar, …)
npm run build      # vite build + gzip bundle-size gate (fails > 120 KB)
npm run preview    # serve the production build (has the service worker)
npm run icons      # regenerate public/icon-*.png (zero-dep PNG encoder; only if the mark changes)
```

Tests run in a node environment against the pure `lib/` layer (`fake-indexeddb` for `repo.js`).
Keep them green and the bundle under budget — both gate the build/CI.

## Deployment

**Live at https://soap.harmonic-systems.org** — repo `harmonicsystems/SOAP` (public). Push to
`main` → `.github/workflows/deploy.yml` (test → build+budget → `actions/deploy-pages`) auto-deploys.
Remote uses the SSH alias `git@github-harmonicsystems:harmonicsystems/SOAP.git` (github.com would
use the wrong key). One-time setup is DONE: Pages source = GitHub Actions, custom domain
`soap.harmonic-systems.org` (also shipped as `public/CNAME`), HTTPS enforced; DNS `CNAME soap →
harmonicsystems.github.io` was already in place. The nightly-cron habit note from other HS repos
does not apply here (no cron in this workflow).

## How we work on this project

Each feature round: implement → `npm test` + `npm run build` → verify live in-browser against
`npm run preview` → run an **adversarial multi-agent review** (parallel finders
by dimension → 3-judge refute panel per finding, keep those upheld ≥2/3) → fix confirmed findings,
re-verify → commit. This has caught real bugs every round (cross-tab vault corruption, lock-time
data loss, split corpus state, merge-import tag loss). For any change touching privacy/security or
the note format, treat the corresponding test as the contract and re-audit claims against code.

## Roadmap (discussed, not built)

Corpus pack export/share · "suggested saves" (detect repeated typed lines — wants real usage data
first). Possible group-session polish: shared live editing of date/duration/activity across members
(currently set at creation, then per-member), a flat all-cards tap surface. Also pending: refine the
Help "Why this exists" copy (David's voice).
