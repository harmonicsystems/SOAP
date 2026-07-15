# Sandbox demo — implementation plan

- Status: implemented and technically verified on `codex/sandbox-demo`; human SLP content review
  pending before merge
- Feature ID: `F-006`
- Working name in the UI: **Sample caseload**
- Primary audience: school-based SLPs evaluating SOAP Note Builder
- Initial concept: David Nyman
- Planning contributions: David Nyman + Codex
- Implementation owner: Codex
- Independent reviewers: Codex adversarial security, clinical-data, and UI/accessibility agents;
  human/Claude review still welcome before merge

## 1. Summary

Add an optional, clearly fictional longitudinal caseload that a prospective user can install into
their encrypted vault. The sample records should demonstrate what SOAP Note Builder becomes after
roughly two months of use: changing accuracy, fading cues, uneven progress, criterion streaks,
group sessions, distinct notes, progress charts, and copyable progress summaries.

The feature is not a second application mode. It uses the real encrypted repository and ordinary
client, goal, and session records. A user can inspect and edit the sample records through the same
screens used for real work, then remove all sample records with one explicit action.

The implementation must remain local-first, offline, deterministic, dependency-free, and small
enough to preserve the 120 KB gzipped JavaScript budget.

## 2. Problem

The app's single-session workflow is visible immediately, but much of its value is longitudinal:

- progress charts and criterion streaks;
- interpretation of accuracy together with cue level;
- progress summaries suitable for report-writing support;
- data-driven A/P suggestions;
- phrase ranking based on domain and previous-note context;
- anti-repetition nudges;
- ordinary per-client notes produced from group sessions.

An empty vault cannot demonstrate these capabilities. Asking an evaluator to create several goals
and weeks of fictional sessions is too much setup and produces inconsistent feedback.

## 3. Goals

The sandbox demo should:

1. Let an evaluator reach meaningful longitudinal views in under two minutes after unlocking.
2. Demonstrate realistic variation rather than a perfectly smooth improvement curve.
3. Exercise the real data model, encryption, repository, note-generation, progress, group-session,
   backup, and routing paths.
4. Remain unmistakably fictional throughout the UI.
5. Be safe to install repeatedly without creating duplicates.
6. Be removable without affecting any non-sample record or user setting.
7. Produce deterministic records for a given anchor date.
8. Avoid new runtime dependencies and meaningful bundle growth.
9. Give testers a short guided path through the most valuable evidence.

## 4. Non-goals

This round will not:

- create a public shared vault or backend-hosted demo;
- bypass the passphrase, lock screen, or encryption model;
- add a second IndexedDB database or separate repository implementation;
- download sample data at runtime;
- simulate AI-generated notes;
- add random/probabilistic clinical data;
- add diagnoses, ages, birth dates, schools, teachers, schedules, or full names;
- alter exact SOAP-note or O-section output formats;
- seed the clinician's learned phrases, phrase usage, phrase domains, custom observation tags, or
  other settings;
- claim that the synthetic scenarios represent clinical norms or expected treatment outcomes;
- turn the sample dataset into a clinical training or treatment-recommendation product;
- redesign progress charts or group entry beyond changes needed to label and guide the sample.

## 5. Product decision: sample data in the real vault

### Chosen approach

Install ordinary encrypted `Client`, `Goal`, and `Session` payloads carrying sample provenance:

```js
{
  sample: true,
  sampleDataset: 'longitudinal-v1'
}
```

The marker lives inside the encrypted payload. Dexie rows remain exactly
`{id, updatedAt, blob}`.

### Why

- Every meaningful app path is exercised rather than mocked.
- There is no parallel state model to maintain.
- Sample sessions naturally appear in notes, progress, groups, and backups.
- The generator and repository operations can be pure/small and testable.
- The user learns the actual product, including its vault and backup model.

### Accepted tradeoff

An evaluator must create or unlock a vault before installing the sample caseload. This is a small
amount of friction, but it preserves the product's security model and makes the privacy promise
concrete. If user testing later shows this is a serious adoption barrier, a passphrase-free preview
can be considered as a separate feature with its own security and bundle review.

## 6. User experience

### 6.1 Discovery on an empty caseload

When the unlocked vault has no clients, the Caseload screen should show a secondary card below the
normal Add client form:

> **Want to see how this works over time?**
>
> Add a fictional caseload with about two months of sessions. Explore finished notes, group
> sessions, progress charts, and summaries. Everything is sample data and stays encrypted in this
> browser.
>
> **Explore sample caseload**

The ordinary Add client path remains visually primary. Installing the sample is always opt-in.

### 6.2 Confirmation

Before installation:

> Add the fictional sample caseload? It will appear alongside any clients you add. You can edit it
> freely and remove all sample records later from Settings.

Installation should show a busy state and prevent double submission. On success, show a toast and
remain on Caseload with the guided starting point visible.

### 6.3 Sample labeling

All sample client rows should show a quiet `sample` tag. Client Detail, Group Session, Progress,
Session, and Note views should also show a sample indicator when the current record belongs to the
sample dataset.

The label must not rely only on color. `sample` should be visible text.

Prefer one small reusable `SampleTag` component only if it reduces repetition without adding more
code than inline markup. Do not introduce a generalized badge system for this feature.

### 6.4 Guided starting point

After installation, show a dismissible-looking guidance card on Caseload while sample records are
present. For the first version, dismissal does not need persistence; the card may simply remain as
quiet sample guidance:

> **Start with the longitudinal story**
>
> 1. Open M14 and compare the first and latest notes.
> 2. Open Progress to see accuracy and cueing change over time.
> 3. Open the recent sample group session to see separate notes for each student.

Links should navigate directly to the corresponding client, progress view, and group. Do not add a
new route or guided-tour framework.

### 6.5 Editing sample data

Sample records are editable through the normal UI. This is intentional: evaluators should be able
to tap trials, reopen a note, change wording, and see the product respond.

The sample tag and provenance fields must survive normal updates because components spread the
stored record when saving. Tests should protect this assumption for repository-level operations.

### 6.6 Removal

Settings should include a **Sample caseload** card whenever any sample records are present:

> Remove the fictional clients, goals, and sessions added by the sample. Any changes you made to
> those sample records will also be removed. Your own records and settings will not be changed.

Button: **Remove sample caseload**

Require a native `confirm()` before removal. On success, show a toast. Removal must select by both
`sample === true` and the exact supported dataset identifier, not by code prefixes or ID substrings.

If an evaluator manually creates a normal record linked to a sample client, removal must not leave
an unexpected orphan. The first implementation should prevent this ambiguity by applying the
sample provenance to new sessions and goals created from a sample client. This rule must be
implemented deliberately and tested; do not infer sample status solely during removal.

### 6.7 Reinstallation

Installation is idempotent:

- The same dataset cannot appear twice.
- Deterministic IDs are reused.
- If the dataset is fully present, the install control becomes **Reset sample caseload**.
- Reset requires confirmation because it replaces edits made to sample records.
- If installation was interrupted and only part is present, the control reads **Repair sample
  caseload** and restores the canonical sample records.

The UI may simplify the first release by offering only Reset whenever any `longitudinal-v1` record
exists, provided the underlying install remains safe after partial completion.

## 7. Dataset design

### 7.1 Principles

The sample is an authored clinical narrative, not random fixture data.

- Percentages arise from plausible integer trial counts.
- Trial totals vary naturally by activity.
- Improvement is noisy and sometimes context-dependent.
- Cue level is meaningful and may not move in lockstep with accuracy.
- Narrative observations explain context without claiming causation.
- A and P reflect stored session evidence and do not introduce facts.
- O is generated by the real `generateO()` function.
- Notes differ for defensible reasons: task, data, cues, observations, and standout moments.
- Every statement is fictional, professionally neutral, and free of identifying details.

### 7.2 Anchor date

`buildSampleDataset({ anchorDate })` accepts a local ISO date (`YYYY-MM-DD`). Production passes
`todayISO()`. Tests pass a fixed date.

Session dates use fixed day offsets from the anchor rather than random scheduling. Keep dates far
enough apart to read naturally, include one missed week, and avoid creating future dates.

All records should receive stable `createdAt` values derived from the session date plus a fixed
local-safe time. Ordering must not depend on the executing machine's timezone. Prefer constructing
timestamps explicitly from ISO dates at midday or using a tested date helper rather than parsing a
bare ISO date inconsistently.

### 7.3 Deterministic IDs

Use readable namespaced IDs, not `crypto.randomUUID()`:

```text
sample-longitudinal-v1-client-m14
sample-longitudinal-v1-goal-m14-r
sample-longitudinal-v1-session-m14-01
sample-longitudinal-v1-group-03
```

IDs are implementation details and must never be displayed as identifying information.

### 7.4 Caseload overview

#### M14 — articulation/phonology

Purpose: the primary longitudinal success story.

Goals:

1. Produce vocalic /r/ in structured sentences at 80% accuracy for three consecutive sessions
   with minimal cues.
2. Produce consonant clusters in connected speech at 80% accuracy for three consecutive sessions
   with minimal cues.

History: 9 sessions across approximately 10 weeks, including at least 2 group sessions.

Required arc:

- /r/ begins near 40–45% with moderate verbal/visual cueing.
- It improves unevenly, with a regression when task complexity increases.
- It later reaches at least three qualifying data points at or above criterion with minimal cues,
  so the criterion UI can be verified.
- Cluster performance starts higher, improves, and shows emerging self-correction/generalization.
- Activities move from picture cards to sentence generation and a short reading or description
  task.
- At least one standout records an independently initiated self-correction.

#### K7 — expressive language

Purpose: demonstrate different trajectories across two language goals.

Goals:

1. Produce complete, grammatically accurate sentences during structured description.
2. Retell a short narrative with key story elements in sequence.

History: 7–8 sessions, including at least 2 group sessions.

Required arc:

- Sentence formulation improves gradually with fading models.
- Narrative organization remains variable and depends on visual support.
- One session has strong sentence data but weaker narrative data.
- Observations include benefiting from visual organization and independently adding a missing
  story element.
- The latest plan should follow from the weaker/generalization target rather than simply repeating
  the goal.

#### P3 — receptive language

Purpose: show why accuracy must be interpreted with cue dependence.

Goals:

1. Follow multistep directions containing temporal or spatial concepts.

History: 6–7 sessions, including at least 2 group sessions.

Required arc:

- Accuracy becomes relatively high before cueing reaches the target level.
- At least two sessions show 80% or greater accuracy with moderate cues, which must not count as
  meeting a minimal-cue criterion.
- Later data show reduced cueing without an implausibly smooth accuracy curve.
- Assessment text explicitly but cautiously distinguishes accuracy from independence.

#### T9 — social/pragmatic or fluency

Purpose: show contextual variability and make the group surface feel complete.

Choose one domain during clinical-content review rather than mixing both:

- Social/pragmatic option: maintain topic and provide contingent responses during structured peer
  interaction; performance varies between structured and less structured group activities.
- Fluency option: use a taught strategy in structured and spontaneous speaking; strategy use is
  more consistent than spontaneous carryover.

History: 5–6 sessions, mostly group sessions with one individual session if useful.

This client should not show a simple criterion-reaching curve. The value is contextual description
and an honest plan for continued generalization.

### 7.5 Group sessions

Include at least three group dates. Each group is represented exactly as the production model
requires: ordinary per-client sessions sharing a `groupId`.

Requirements:

- Groups contain 2–4 sample clients.
- Every member record has `setting: 'group'` and the same date/duration for that group.
- Each member retains distinct `goalData`, S/O/A/P, observations, and standout text.
- At least one group lets the evaluator compare students with different domains and performance.
- No shared note or group-level clinical payload is invented.

### 7.6 Session status mix

Include:

- mostly finalized historical sessions;
- one recent draft that can be resumed and changed;
- one finalized recent group;
- one goal already marked `met` only if progress and session dates make that status defensible;
- optionally one discontinued historical goal, but only if it teaches something visible.

Do not include malformed data as a demo feature.

### 7.7 Example authored trajectory

The final exact counts require SLP review, but an M14 /r/ arc may start from:

| Session | Correct/total | Accuracy | Cue level | Clinical context |
|---|---:|---:|---|---|
| 1 | 8/19 | 42% | moderate | target words and picture cards |
| 2 | 10/20 | 50% | moderate | target words in short phrases |
| 3 | 11/19 | 58% | moderate | sentence generation |
| 4 | 9/19 | 47% | moderate | unfamiliar picture description |
| 5 | 12/19 | 63% | minimal | familiar sentence frames |
| 6 | 15/21 | 71% | minimal | mixed sentence practice |
| 7 | 16/20 | 80% | minimal | structured reading |
| 8 | 15/18 | 83% | minimal | picture description |
| 9 | 17/20 | 85% | minimal | mixed structured tasks |

The table is a planning example, not yet approved fixture content. Verify exact rounding against
`accuracyPct()` and criterion behavior against `goalCriterionStatus()`.

### 7.8 Text content

For each scenario, author small ordered palettes for:

- activities;
- S statements;
- goal observation-tag IDs;
- standout moments;
- A statements;
- P statements.

Do not randomly combine palettes. Each session scenario explicitly selects its text so data and
narrative cannot contradict one another.

Prefer ordinary, restrained language. Avoid claims such as “mastered,” “generalized,” or “due to”
unless the stored record supports them. Avoid fabricated third-party reports. Sample S content can
describe transition, participation, or a fictional self-report clearly grounded in the scenario.

## 8. Proposed code organization

### New pure logic

`src/lib/sampleData.js`

Suggested exports:

```js
export const SAMPLE_DATASET_ID = 'longitudinal-v1'

export function buildSampleDataset({ anchorDate }) {
  // returns { clients, goals, sessions }
}

export function isSampleRecord(record, datasetId = SAMPLE_DATASET_ID) {
  return record?.sample === true && record?.sampleDataset === datasetId
}

export function sampleDatasetState({ clients, goals, sessions }) {
  // returns 'absent' | 'partial' | 'complete'
}
```

The builder should use existing constants and helpers wherever they are the source of truth:

- `generateO()` for O text;
- `newSessionRecord()` if it can accept deterministic overrides cleanly without complicating its
  normal call sites; otherwise use a small sample-specific record builder matching its tested
  shape;
- enums from `constants.js`;
- existing accuracy/progress logic for validation tests, never duplicated production logic.

Do not add a general fixture framework.

### Repository operations

Add narrowly named functions to `src/lib/repo.js`, for example:

```js
export async function installSampleDataset(anchorDate) {}
export async function removeSampleDataset() {}
```

Rules:

1. All writes go through the encrypted repository layer.
2. Stored table rows remain `{id, updatedAt, blob}` only.
3. Never await WebCrypto inside a Dexie transaction.
4. Check the vault epoch before writes, consistent with existing repository behavior.
5. Do not mutate settings or phrase-corpus state.
6. Update in-memory stores and `lastModifiedAt` consistently.
7. Installation/removal must be safe to retry after interruption.

The lean first implementation may call `putRecord()`/`deleteRecord()` sequentially because IDs are
deterministic and retries are safe. If atomic bulk operations are introduced, pre-encrypt every
record before the Dexie transaction and re-audit epoch/broadcast behavior. Do not copy `importData()`
without understanding its cross-tab and settings semantics.

### UI changes

Expected touch points:

- `src/components/Caseload.svelte`: install/reset/repair entry point, sample tags, guidance links;
- `src/components/ClientDetail.svelte`: sample label and propagation to newly created goals/sessions;
- `src/components/GoalBuilder.svelte`: preserve/inherit sample provenance for sample-client goals;
- `src/components/SessionScreen.svelte`: sample label, preserve provenance on autosave;
- `src/components/GroupSession.svelte`: sample label where useful;
- `src/components/NoteOutput.svelte`: sample label outside copied/printed clinical text;
- `src/components/Progress.svelte`: sample label;
- `src/components/Settings.svelte`: removal/reset controls;
- `src/components/Help.svelte`: short explanation of the fictional sample and how to remove it.

The sample label must not enter `assembleNote()` output or copied EMR text. Printed sample notes may
optionally show `SAMPLE — FICTIONAL DATA` outside the note body, but this requires an explicit
product decision and a print-layout check. Default recommendation: show the label on screen and in
print-only UI, never inside the copyable note string.

No new route is expected.

## 9. Referential-integrity rules

The generator and repository tests must enforce:

- every goal references an existing sample client;
- every session references an existing sample client;
- every `goalData.goalId` references a goal belonging to that same client;
- all members sharing a `groupId` share date, duration, and `setting: 'group'`;
- no individual session carries a `groupId`;
- sample records never reference a normal record;
- every generated record has the exact sample marker and dataset ID;
- all client codes satisfy the existing maximum-five-character/no-space rule;
- active/met/discontinued statuses use valid values;
- all cue levels, cue types, settings, domains, and observation IDs resolve through existing
  constants;
- finalized sessions contain fixed O text generated from their stored inputs.

## 10. Privacy and security review

The sample contains no real protected data, but implementation must not weaken the real vault.

Review specifically for:

- accidental plaintext storage outside encrypted payloads;
- additional Dexie fields or indexes;
- runtime fetches or analytics;
- a hidden/demo passphrase persisted in code or storage;
- failure to wipe decrypted sample records on lock;
- bulk writes that await WebCrypto inside a transaction;
- stale-key writes after vault epoch changes;
- removal predicates broad enough to delete user records;
- backup/restore behavior that loses or misclassifies sample provenance;
- sample labels accidentally copied into a real EMR note;
- realistic-looking identifiers or text that could be mistaken for real students.

Sample content should include a short disclaimer:

> All sample clients, sessions, and clinical details are fictional and are provided only to
> demonstrate the software. They are not clinical recommendations or expected outcomes.

## 11. Testing plan

### 11.1 Pure generator tests — `src/lib/sampleData.test.js`

Test at minimum:

1. Same anchor date produces deeply equal output.
2. Different anchors shift dates without changing clinical content or IDs.
3. No generated date is after the anchor.
4. Expected record counts and stable IDs are present.
5. IDs are unique across all records.
6. All referential-integrity rules in section 9 hold.
7. Client codes meet de-identification validation.
8. All enums and observation tags are valid.
9. Every generated O equals a fresh call to `generateO()` with the stored inputs.
10. Finalized session note assembly succeeds without `null`/`undefined` leakage.
11. M14 demonstrates regression and later satisfies the intended criterion.
12. P3 has high-accuracy sessions that do not satisfy criterion because cues remain above target.
13. K7 contains different trajectories across its goals.
14. Group members have separate notes and correct shared headers.
15. At least one draft and the required finalized sessions exist.
16. No forbidden identifying field names or known placeholder names occur.
17. Every record is marked `sample: true` and `sampleDataset: 'longitudinal-v1'`.

Avoid brittle full-dataset snapshots as the only test. Target contracts and a few exact clinical
sentences. A compact snapshot may supplement, not replace, behavioral assertions.

### 11.2 Repository tests

Extend the fake-IndexedDB repository suite to verify:

1. Installation stores encrypted-only Dexie rows.
2. Installation updates decrypted stores while unlocked.
3. Repeating installation does not duplicate records.
4. Partial installation can be repaired/reset.
5. Removing the sample deletes only matching sample records.
6. Normal clients, goals, sessions, settings, and learned corpus remain byte-for-byte equivalent
   at the plaintext model level after removal.
7. Modified sample records are removed.
8. Lock/unlock preserves sample provenance.
9. Backup snapshot and merge/replace import preserve sample markers.
10. A stale vault epoch prevents installation/removal from writing with the wrong key.
11. New goals/sessions created from a sample client inherit sample provenance.

### 11.3 Existing contract tests

Run the complete suite. Pay particular attention to:

- `note.test.js` — copied note format must not change;
- `ogen.test.js` — O framing must remain exact;
- `progress` tests — criterion behavior used by the sample story;
- `backup` and `repo` tests — encryption/import/removal invariants;
- `router` tests — no new route should be necessary;
- `session` tests — sample records must retain the ordinary session shape.

### 11.4 Build verification

Run:

```sh
npm test
npm run build
```

Record total gzipped JavaScript before and after. There is no separate sub-budget, but investigate
unexpected growth. No runtime dependency is permitted for this feature.

## 12. Browser acceptance script

Verify against `npm run preview`, not only the dev server, so the production bundle and PWA paths
are exercised.

### Fresh vault

1. Create a new vault.
2. Confirm the normal empty-caseload state remains understandable.
3. Install the sample caseload.
4. Confirm all client rows are labeled sample and no duplicate appears after reload.
5. Lock and unlock; verify sample data remains and decrypted data disappears while locked.

### Longitudinal story

1. Open M14.
2. Compare its earliest and latest finalized notes.
3. Confirm trial data, cue levels, A, and P tell a coherent progression.
4. Open Progress and verify the visible curve, criterion state, and copied summary.
5. Confirm P3's high accuracy does not falsely show cue-level criterion success.

### Live editing

1. Open the sample draft.
2. Tap correct/incorrect trials and undo.
3. Add an observation and standout.
4. Confirm O regenerates normally.
5. Finalize, copy, reopen, and save.
6. Confirm the sample label never enters clipboard note text.

### Group

1. Open a sample group from the guide.
2. Switch among members.
3. Confirm outgoing autosaves flush and each member retains different data/note text.
4. Open each note independently.

### Removal and coexistence

1. Add a normal client and at least one normal goal/session.
2. Remove the sample caseload from Settings.
3. Confirm every sample client, goal, session, and group is gone.
4. Confirm the normal records and all settings remain.
5. Reinstall and verify one clean canonical dataset appears.

### Windows/low-end checks

At the smallest supported viewport and with CPU throttling if available:

- Caseload remains scannable and sample labels do not force awkward horizontal overflow.
- Guidance links and buttons meet existing touch-target conventions.
- Installing does not freeze the UI for an unreasonable interval.
- Keyboard navigation continues to work.
- Offline reload works after the production service worker has installed.

## 13. Accessibility and copy review

- Buttons describe actions (`Explore sample caseload`, `Remove sample caseload`), not vague
  concepts (`Demo`).
- Busy and success states are announced through existing UI patterns.
- Confirmation text states exactly what will be changed.
- `sample` is textual, not color-only.
- Guidance uses real links and remains keyboard accessible.
- Sample disclaimers use plain language and do not overwhelm the primary task.
- Do not describe local browser storage as cloud storage or imply organizational compliance.
- Preserve the Help-page statement that shipped behavior is deterministic and contains no AI.

## 14. Implementation phases

### Phase 0 — content approval (human review pending)

Owner: product/SLP reviewer.

- Choose T9's domain.
- Review goals and target criteria for natural school-based wording.
- Approve the session arcs, activities, observations, A/P language, and progress-summary outcome.
- Confirm that no content implies diagnosis, prognosis, or normative expectations.

Exit criterion: the scenario table is approved before merging the implementation to production.

The exploratory branch proceeded with the recommended decisions below so the product can be
reviewed in working form. This does not substitute for review by a practicing SLP.

### Phase 1 — pure dataset and tests

- Add `sampleData.js` and generator tests.
- Build deterministic clients, goals, sessions, and group links.
- Generate O through production logic.
- Validate clinical and referential contracts.

Exit criterion: generator tests pass without touching repository or UI code.

### Phase 2 — encrypted install/remove operations

- Add repository installation, reset/repair, and removal behavior.
- Add fake-IndexedDB tests for encryption, idempotence, coexistence, removal, and epoch safety.
- Confirm settings/corpus remain unchanged.

Exit criterion: sample lifecycle is reliable through repository APIs alone.

### Phase 3 — Caseload and labels

- Add empty-state discovery and confirmation.
- Add sample guidance with direct links.
- Add visible sample labels across relevant screens.
- Preserve sample provenance when creating/editing related records.

Exit criterion: an evaluator can install, identify, and explore the sample without documentation.

### Phase 4 — Settings removal and Help copy

- Add safe removal/reset controls.
- Add the fictional-data disclaimer and short Help explanation.
- Verify sample labeling stays outside copyable note output.

Exit criterion: the user can fully reverse the feature and understands its scope.

### Phase 5 — full verification and adversarial review

- Run tests and production build/bundle gate.
- Complete the browser acceptance script.
- Perform the project's adversarial multi-agent review process.
- Fix findings upheld by the established review threshold.
- Re-run tests, build, and browser verification.

Exit criterion: all checks pass, confirmed findings are resolved, and the feature is ready to commit.

## 15. Multi-agent working agreement

This document is the canonical accepted plan. Agents may propose amendments, but should not create
competing implementation plans once work begins.

### Before an agent starts

The agent should:

1. Read `AGENTS.md` completely.
2. Read this plan completely.
3. Inspect the current Git status and preserve unrelated changes.
4. Confirm the assigned phase and whether it owns implementation or review.
5. Record the starting commit in the handoff log below.
6. Identify any plan decision that blocks implementation before editing code.

### Implementation ownership

- Only one coding agent owns a phase at a time.
- Claude Code and Codex must not edit the same working tree concurrently.
- Concurrent work requires separate Git worktrees/branches and non-overlapping file scopes.
- The implementation agent follows the canonical plan and records deliberate deviations.
- The reviewing agent begins from a committed diff whenever possible.

### Handoff format

Every implementation handoff should state:

```text
Feature/phase:
Starting commit:
Ending commit or working tree state:
Files changed:
Behavior implemented:
Tests added/changed:
Commands run and results:
Bundle size before/after:
Plan deviations and rationale:
Known risks or unfinished work:
Suggested-by / implemented-with / reviewed-by-tool credits:
```

### Review independence

For the adversarial review, give finders the accepted plan, code, and commit diff, but do not give
them another finder's conclusions before their initial pass. Findings should cite exact code paths,
broken invariants, or reproducible behavior. Style preferences without product or maintenance
impact are not defects.

## 16. Credit and decision provenance

Update the header fields and handoff log as work progresses. Track roles rather than assigning one
author to an evolving feature.

Recommended commit-message trailers when applicable:

```text
Suggested-by: Codex
Specified-with: Codex
Implemented-with: Codex
Reviewed-by-tool: Codex
```

Use only trailers that accurately describe that commit. Human Git authorship remains unchanged.

### Decision log

| Date | Decision | Decided by | Rationale |
|---|---|---|---|
| 2026-07-12 | Use sample records in the real encrypted vault, not a parallel demo mode | David + Codex | Exercises the actual product with minimal parallel architecture |
| 2026-07-12 | Use deterministic authored scenarios rather than randomized data | David + Codex | Keeps clinical narratives coherent and tests reproducible |
| 2026-07-12 | Do not modify the user's corpus/settings | David + Codex | Removal must leave the clinician's personalization untouched |
| 2026-07-14 | Use social-pragmatic language for T9 | Codex implementation; human content review pending | Shows performance varying by context rather than another smooth accuracy arc |
| 2026-07-14 | Add a print-only fictional-data banner, while leaving copied note text unchanged | Codex implementation | Protects screenshots/printouts without contaminating EMR-pasteable output |
| 2026-07-14 | Offer install/reset from Settings as well as discovery on an empty Caseload | Codex implementation | Supports coexistence with personal records and easy repeat evaluation |
| 2026-07-14 | Derive Install, Repair, or Reset from exact dataset completeness | Codex implementation | Makes the destructive action accurately describe current state |
| 2026-07-14 | Inherit provenance for sample descendants and reject mixed sample/personal groups | Codex implementation | Ensures removal cannot strand sample-linked records or partial groups |
| 2026-07-14 | Reset to the canonical dataset and keep the guidance card visible | Codex implementation | Keeps recovery deterministic and avoids another persisted preference |

### Handoff log

| Date | Agent/person | Role | Phase | Commit(s) | Notes |
|---|---|---|---|---|---|
| 2026-07-12 | Codex | planning | 0–5 | `9e9cb76` | Created and committed the agent-neutral implementation plan from discussion with David |
| 2026-07-14 | Codex | implementation | 1–5 | `codex/sandbox-demo` | Built the dataset, encrypted lifecycle, guided UI, labels, Help copy, 18 new tests, production browser QA, and adversarial review fixes; final bundle 101.4 KB gzipped, no runtime dependency added |

## 17. Implementation decisions (resolved; human content review remains)

The exploratory implementation resolved the original questions as follows:

1. T9 demonstrates social/pragmatic language.
2. Sample note printouts include a print-only `SAMPLE — FICTIONAL DATA` banner.
3. Installation is available from empty Caseload and from Settings alongside personal records.
4. The action says Install, Repair, or Reset based on exact canonical completeness.
5. New goals and sessions under a sample client inherit sample provenance.
6. Reset removes tester-created sample descendants and restores the canonical dataset.
7. The guidance card remains while sample data exists; it has no persisted dismissal state.

## 18. Definition of done

The feature is done only when:

- the clinical content has been reviewed and approved;
- sample installation is explicit, deterministic, encrypted, and idempotent;
- sample records are visibly labeled across all relevant screens;
- longitudinal, cue-dependence, group, note, and progress stories are coherent;
- removal deletes all and only the supported sample dataset, including edited descendants;
- user settings and normal records survive install/reset/removal unchanged;
- no exact note/O format changes occur;
- no runtime network call or dependency is added;
- all existing and new tests pass;
- the production build passes the 120 KB gzip gate;
- the browser acceptance script passes against the production preview;
- the adversarial review is complete and confirmed findings are fixed;
- the handoff log, decision log, and contribution credits are current;
- Help accurately explains that all sample data is fictional and locally encrypted.
