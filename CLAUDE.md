# SOAP Note Builder — architecture & working notes

A local-first, offline, encrypted PWA for a school-based speech-language pathologist: collect
session trial data live and generate clean, EMR-pasteable SOAP notes fast. No backend — all data
lives encrypted in the browser. Deploys to GitHub Pages at **soap.harmonic-systems.org**.

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
  every `npm run build` (CI fails over budget). Currently ~90 KB. **No new runtime dependency
  without a size justification in a code comment.** Only runtime dep is Dexie.
- **Plain CSS** with custom properties (`src/styles/global.css`) — no framework. Low-stimulation
  design: muted palette, generous whitespace, big touch targets, works on a weak Acer/Edge laptop.
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
- `repo.js` — the encrypted repository + in-memory Svelte stores. Owns the
  key (module-var, wiped on lock), the store cache, lock/unlock, CRUD, settings, passphrase change,
  backup import, sample-dataset lifecycle, and the corpus mutators. See invariants below.
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
  `navigate` push / `redirect` replace).

- `session.js` — `newSessionRecord(clientId, activeGoals, opts)`: the one builder for both
  individual and group sessions (carries `groupId`). Used by ClientDetail and `repo.createGroup`.
- `sampleData.js` — deterministic, authored fictional caseload (4 clients, 6 goals, 30 sessions,
  5 linked groups) built relative to an anchor date. Carries `sample:true` +
  `sampleDataset:'longitudinal-v1'`; O text always flows through production `generateO()`.

**Components** — `App.svelte` (shell + routing + auto-lock), `LockScreen`, `Header`, `Caseload`
(+ group creation), `ClientDetail`, `GoalBuilder`, `SessionScreen` (core live screen; `embedded`
prop for group use), `GoalCard`, `PhraseSection`, `NoteOutput`, `Progress`, `Chart`/`Sparkline`
(SVG), `Settings`, `Help`, `GroupSession` (client-switcher wrapper reusing SessionScreen),
`BackupBanner`, `SampleTag`, `Toast`.

## Data model (inside encrypted payloads)

```
Client:  { id, code, notes?, archived, createdAt, sample?, sampleDataset? }
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
           customObsTags [{id,chip,clause,archived}], hiddenObsTags [builtinId] }
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
  usage timer). `lockNow` first awaits registered `onBeforeLock` hooks (SessionScreen's pending
  autosave flush) so a lock mid-typing never drops data.
- **Cross-tab safety via vault epoch.** Record puts/deletes and settings saves capture the epoch
  before asynchronous work, then check it and mutate inside one Dexie transaction (WebCrypto still
  happens before it). External mismatch hard-locks; an operation superseded by a same-tab epoch
  rotation is dropped. Rekey, import, erase, and sample reset/removal mint an epoch and post to the
  `soap-vault` BroadcastChannel; other tabs hard-lock. Sample lifecycle rotates once before
  reloading its destructive-operation snapshot, preventing stale tabs from resurrecting removed
  records.
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

## Fictional longitudinal sample caseload

An unlocked user can explicitly install the `longitudinal-v1` sample from empty Caseload or
Settings. It uses ordinary encrypted records so notes, progress, group switching, backup, lock,
copy, and print exercise the real app. The four authored arcs demonstrate noisy improvement,
accuracy versus cue dependence, different goal trajectories, and contextual variability. All
sample screens carry visible `sample` text; printed sample notes add a banner outside the copied
note string.

Installation/reset and removal are atomic, epoch-changing repository operations. Before any
replacement, installation rejects case-insensitive collisions with normal client codes and raw or
decrypted occupants of reserved canonical IDs. New goals/sessions under a sample client inherit
the marker; sample and personal clients cannot be mixed in a new group. Removal matches the exact
dataset marker and leaves normal records/settings/corpus untouched. `sampleData.test.js` locks the
fixture's determinism, references, clinical arcs, trial validity, generated O text, and criterion
outcomes; repository tests lock encryption, collision, epoch, repair/reset, and removal behavior.

## Security & lock model

App opens locked. Auto-lock after N idle minutes (configurable) or >5 min tab-hidden (a timer fires
*while* hidden, not only on return). Locking wipes the in-memory key and decrypted cache. Passphrase
loss = permanent data loss — onboarding + Settings + Help say so, and push regular backups. Request
`navigator.storage.persist()` on unlock. Backup nag banner when changes are >7 days newer than the
last export. Help is reachable while locked (standalone, for reading privacy before creating a
vault); if the app locks *while on Help*, an effect routes to the lock screen.

---

## Dev workflow

```
npm install
npm run dev        # dev server (hot reload, no service worker)
npm test           # vitest — 89 tests across lib (crypto, backup, corpus, sample, repo, note, …)
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

Each feature round: implement → `npm test` + `npm run build` → verify live in-browser (Claude
Preview MCP against `npm run preview`) → run an **adversarial multi-agent review** (parallel finders
by dimension → 3-judge refute panel per finding, keep those upheld ≥2/3) → fix confirmed findings,
re-verify → commit. This has caught real bugs every round (cross-tab vault corruption, lock-time
data loss, split corpus state, merge-import tag loss). For any change touching privacy/security or
the note format, treat the corresponding test as the contract and re-audit claims against code.

## Roadmap (discussed, not built)

Corpus pack export/share · "suggested saves" (detect repeated typed lines — wants real usage data
first). Possible group-session polish: shared live editing of date/duration/activity across members
(currently set at creation, then per-member), a flat all-cards tap surface. Also pending: refine the
Help "Why this exists" copy (David's voice).
