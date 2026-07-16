# Public demo, trimester caseload, and onboarding — implementation plan

- Status: implemented and technically verified on `codex/public-demo-onboarding`; adversarial
  review complete and confirmed fixes applied; human SLP content review pending before merge
- Umbrella feature ID: `F-007`
- Subfeatures:
  - `F-007A` — public, passphrase-free demo runtime
  - `F-007B` — 25-student January–April fictional caseload
  - `F-007C` — welcome page and private-vault onboarding
  - `F-007D` — guide using the real note-builder UI
  - `F-007E` — demo codename policy and fictional-data presentation
- Primary audience: school-based SLPs evaluating SOAP Note Builder
- Initial product direction: David Nyman
- Architecture and planning: David Nyman + Codex
- Implementation owner: Codex
- Human clinical reviewer: required before merge
- Starting branch/commit: `codex/sandbox-demo` at `1e25d78`

## 1. Executive recommendation

Build two genuinely separate entry paths from a new public welcome page:

1. **See the demo** opens a passphrase-free, temporary workspace containing 25 fictional students
   and a full January–April trimester. It uses the real Caseload, Client, Session, Note, Progress,
   and Group components. Demo edits live only in memory and disappear when the demo is reset,
   exited, or reloaded.
2. **Create private workspace** creates the existing encrypted local vault. It is not called
   “sign up,” because the app has no account, server, email identity, cloud storage, or passphrase
   recovery. A returning user sees **Unlock private workspace** instead.

The public demo should replace the current proposal to install sample records inside a private
vault. The private workspace should begin empty and contain only records the clinician creates or
imports. This separation is easier to understand, safer to implement, smaller to maintain, and
prevents fictional records from entering real backups.

The guide should not use screenshots or a second imitation UI. It should place a compact guidance
panel around the actual production components, preloaded with carefully chosen demo records. This
keeps the instructions accurate whenever the note-builder UI changes.

## 2. Decisions made for this plan

### 2.1 Demo codes: letters only, two or three characters

Every fictional student in `F-007B` will have a unique uppercase code matching:

```text
^[A-Z]{2,3}$
```

The fixture will use the word **code**, never student name. No code will contain a number, space,
punctuation, diagnosis, grade, school, teacher, birth date, or recognizable full name.

This plan does **not** tighten the private workspace's existing one-to-five-character code rule.
That would be a separate product migration and could invalidate conventions or imported backups
already used by clinicians. If David later wants a global letters-only rule, implement it as a
separate decision with compatibility tests; do not fold it silently into the demo work.

### 2.2 Public demo replaces in-vault sample installation

The current `F-006` branch proves that realistic sample records can exercise the production UI,
but its install/reset/remove lifecycle is no longer the preferred user experience once a public
demo exists.

For `F-007`:

- keep and expand the pure sample-data generator;
- keep useful sample labels and print protections;
- reuse ordinary `Client`, `Goal`, and `Session` shapes;
- remove sample install/repair/reset/remove controls from private Caseload and Settings;
- remove repository collision and encrypted sample-lifecycle code that no longer has a user path;
- never include demo records in private backups;
- keep private vault creation and unlocking unchanged until the new onboarding phase is ready.

Because `F-006` is not deployed, no production migration is required. During development, test
vaults containing `longitudinal-v1` records may be erased or recreated. If this assumption changes
before merge, add a one-time cleanup path rather than leaving abandoned sample records.

### 2.3 Demo is interactive but temporary

The demo is not read-only. Evaluators may:

- tap correct/incorrect trials and Undo;
- change cue level and cue types;
- select observation tags;
- edit S/A/P wording and the standout line;
- reopen/finalize a fictional note;
- switch among group members;
- add a temporary goal, client, or session if those paths remain useful;
- copy or print fictional notes with unmistakable sample labeling.

All mutations remain in memory. Reloading or resetting rebuilds the canonical dataset. The UI must
say this clearly so an evaluator does not mistake the demo for durable storage.

## 3. Product goals

The combined feature should:

1. Let a first-time visitor understand the product before choosing a passphrase.
2. Put the evaluator inside a useful longitudinal caseload in one click.
3. Demonstrate a full trimester rather than a handful of isolated notes.
4. Show realistic variation in accuracy, cue dependence, context, goal status, and attendance
   frequency—including plateaus, lower recent performance, and goals with no meaningful measured
   progress—without implying expected clinical outcomes.
5. Reuse the actual note-builder screens and logic instead of maintaining mock screenshots.
6. Keep the encrypted vault completely separate from the public demo.
7. Explain precisely what the private workspace does and does not do.
8. Preserve the no-backend, no-network-data, no-AI, deterministic, offline architecture.
9. Remain responsive on a weak Windows laptop and below the 120 KB gzipped JavaScript budget.
10. Give Claude Code or Codex an implementation path with testable phase boundaries and clear
    contribution credits.

## 4. Non-goals

This work will not:

- create user accounts, authentication servers, subscriptions, or cloud sync;
- use a shared public passphrase or ship a secret passphrase in source code;
- persist demo edits in IndexedDB, Local Storage, session storage, cookies, or a backend;
- let demo data mingle with an unlocked private vault;
- send demo behavior, feedback, or analytics anywhere;
- claim HIPAA, FERPA, district, or organizational compliance;
- replace clinical judgment, diagnose, recommend treatment, or predict progress;
- add AI, probabilistic text generation, randomized trial data, or network-loaded content;
- add a guided-tour dependency, CSS framework, icon package, or chart package;
- duplicate full Session, Note, Progress, or Group components for the guide;
- add identifying fields or realistic personal biographies to fictional students;
- change the test-locked SOAP-note or O-section output formats;
- turn the Help guide into a clinical training curriculum.

## 5. Entry experience and information architecture

### 5.1 Public routes

Use explicit hash routes so GitHub Pages remains compatible and demo/private state is visible in
the URL:

| Route | Purpose |
|---|---|
| `#/` | Public welcome page |
| `#/create` | Create a new encrypted private workspace |
| `#/unlock` | Unlock an existing private workspace |
| `#/help` | Public Help, privacy, limitations, and contact |
| `#/demo` | Redirect to `#/demo/guide/1` for first-time demo entry |
| `#/demo/guide/:step` | Guided demo using real production screens |
| `#/demo/clients` | Free exploration of the demo caseload |
| `#/demo/client/:id` | Demo Client Detail |
| `#/demo/client/:id/progress` | Demo Progress |
| `#/demo/session/:id` | Demo Session |
| `#/demo/session/:id/note` | Demo Note |
| `#/demo/group/:groupId` | Demo Group Session |

Private application routes remain unprefixed (`#/clients`, `#/session/:id`, and so on). A route
prefix is preferable to a hidden session flag because it is shareable, reload-safe, testable, and
makes it difficult to confuse the active data mode.

### 5.2 Welcome page

Recommended headline:

> **Faster SOAP notes. Your student data stays on this device.**

Recommended supporting copy:

> Collect trial data during speech sessions, generate deterministic SOAP notes, and review
> progress over time—even offline. No account, cloud database, analytics, or AI in the app.

Primary first-visit actions:

- **See the demo** — “Explore a fictional 25-student caseload. No passphrase required.”
- **Create private workspace** — “Encrypt your own local caseload with a passphrase.”

If a vault already exists on this browser, replace Create with:

- **Unlock private workspace**

Keep **Help & privacy** visible without entering either flow.

Below the actions, include a compact “Know before you begin” list:

- Use codes only—never names, dates of birth, schools, or other identifying details.
- Private data is stored only in this browser and does not sync to other devices.
- A lost passphrase cannot be recovered; encrypted backups are the user's responsibility.
- The app assembles documentation from entered data; it does not provide clinical advice or
  verify an employer's documentation requirements.

Avoid a marketing page long enough to obscure the actions. The initial viewport should contain
the value proposition, both paths, and the key local-storage limitation at 768px height.

### 5.3 Demo entry

Selecting **See the demo** goes directly to `#/demo/guide/1`. Do not require a passphrase, account,
email, checkbox, or confirmation modal.

Show a persistent, non-color-only banner throughout demo routes:

> **DEMO — FICTIONAL DATA** · Changes are temporary and reset when you leave. Do not enter real
> student information.

Demo header actions:

- **Guide**
- **Explore caseload**
- **Reset demo**
- **Create private workspace** or **Unlock private workspace**, depending on vault presence
- **Exit demo**

Reset uses a lightweight confirmation only when the evaluator has changed data. Exiting wipes all
demo stores immediately and returns to `#/`.

### 5.4 Private workspace creation

Use **Create private workspace**, not Sign up. “Sign up” implies an account and a remote service,
which would contradict the architecture and privacy pitch.

The creation screen should explain capabilities and limits adjacent to the passphrase form:

**This workspace does:**

- encrypt client codes, goals, sessions, settings, and phrase data in this browser;
- work offline after the first load;
- generate deterministic, editable notes from the user's entries;
- export encrypted backups the user stores elsewhere.

**This workspace does not:**

- create an online account or cloud copy;
- sync between devices automatically;
- recover a forgotten passphrase;
- replace an EMR, clinical judgment, or organizational policy review;
- transmit data to Harmonic Systems or an AI service.

Retain the current minimum-eight-character passphrase rule unless security requirements are
revisited separately. Require acknowledgments that:

1. losing the passphrase makes the data unrecoverable; and
2. only non-identifying codes should be entered.

Button: **Create encrypted workspace**.

After success, redirect to an empty private Caseload. Offer a short three-step checklist, but do
not offer to import the public demo dataset.

### 5.5 Returning private user

`#/unlock` shows the existing focused passphrase form plus:

- **See demo without unlocking**
- **Help & privacy**
- a reminder that there is no passphrase reset

Entering demo while a private vault is currently unlocked must first flush pending private edits,
lock, wipe the key/decrypted cache, and only then populate demo memory. Returning to private mode
requires the passphrase again.

## 6. Demo runtime architecture

### 6.1 Explicit application mode

Introduce an explicit runtime store:

```text
appMode = welcome | locked | private | demo
```

Do not infer demo mode only from the presence of `sample` records. The route identifies the
requested mode; the runtime store identifies which repository behavior is active.

The transition rules are:

```text
welcome/create/unlock
        │
        ├── create or unlock ──> private stores + private key
        │
        └── see demo ──────────> demo stores, no key

private ── enter demo ──> flush saves ──> wipe key/private stores ──> demo
demo ──── exit/private ──> wipe demo stores ──> welcome or locked
```

At no point may private and demo records coexist in the shared Svelte stores.

### 6.2 Repository strategy

Reuse the existing exported stores and components, but make mutations mode-aware at the repository
boundary:

- `putRecord` in private mode keeps the current encrypted IndexedDB path.
- `putRecord` in demo mode updates only the matching in-memory store.
- `deleteRecord` in demo mode updates only memory.
- `saveSettings` in demo mode updates only in-memory demo settings.
- `createGroup` continues to compose `putRecord`, so it naturally follows the active mode.
- backup, restore, passphrase change, vault erase, and storage persistence are unavailable in demo.
- sample install/remove functions are deleted when their UI is retired.

Prefer a small internal persistence strategy (`privatePersistence` / `demoPersistence`) if it makes
mode branching auditable. Do not fork the entire repository or duplicate business logic.

### 6.3 Entering demo

`enterDemo()` must:

1. await registered before-lock hooks if private mode is unlocked;
2. hard-wipe the private key, epoch, decrypted stores, pending usage timer, and private settings;
3. build a fresh canonical dataset synchronously from bundled pure data;
4. set demo-specific settings in memory;
5. set `appMode` to `demo` only after all demo stores are ready;
6. perform no IndexedDB writes and no network calls.

### 6.4 Leaving or resetting demo

`exitDemo()` wipes every demo store and returns to welcome/locked state. `resetDemo()` rebuilds the
fixture and returns to the guide or Caseload without touching IndexedDB.

Demo data should also be wiped when:

- navigation leaves the `/demo` route prefix;
- the page unloads;
- a vault creation/unlock attempt begins;
- an unrecoverable demo initialization error occurs.

Reloading a demo route may rebuild the canonical dataset automatically. No demo mutation must
survive a page reload.

### 6.5 Header and private-only surfaces

In demo mode:

- replace **Lock** with **Exit demo**;
- hide `BackupBanner` and last-backup status;
- hide private Settings or provide only a minimal Demo settings screen with Reset/Exit;
- prevent backup export, import, passphrase change, erase, and storage persistence;
- preserve Note copy/print behavior with a fictional-data banner;
- keep Help available and aware that it was opened from demo.

## 7. Mode-aware routing

### 7.1 Route representation

Extend `matchRoute()` to return mode as part of the pure result:

```js
{
  mode: 'public' | 'private' | 'demo',
  name: 'clients' | 'client' | 'session' | 'note' | 'progress' | 'group' | ...,
  params: {}
}
```

Strip the leading `demo` segment before matching the ordinary application route table. Public
routes are matched separately.

### 7.2 Link helper

Replace hard-coded `href="#/..."` strings with one tested helper:

```js
hrefFor('client/abc')
// private -> #/client/abc
// demo    -> #/demo/client/abc
```

`navigate()` and `redirect()` should preserve the active mode by default, while accepting an
explicit mode for entry/exit transitions. This refactor is foundational: a missed link must not
silently drop a demo user onto the private lock screen or expose private screens inside demo mode.

### 7.3 Route tests

Tests must cover every private/demo pair, URL encoding, not-found behavior, Back/Forward, direct
loading, reload initialization, mode exit, and explicit public routes.

## 8. Full trimester fictional dataset

### 8.1 Calendar

For an anchor date of July 15, 2026, the canonical demo represents the winter trimester from
January 5 through April 3, 2026.

The generator may derive the most recently completed January–April term from an `anchorDate`, but
the same anchor must always produce identical data. Tests use a fixed anchor. The schedule should
include 13 possible service weeks with one planned gap and realistic variation in completed
sessions; do not label the gap as a specific holiday or district closure.

Target output:

- 25 clients;
- approximately 36 goals;
- 8–12 sessions per client;
- approximately 260–280 per-client session records;
- 7 recurring groups of 2–4 students plus 3 primarily individual students;
- 110–125 total meeting events when group meetings and individual sessions are included;
- mostly final notes plus 2–3 designated drafts for live interaction;
- records spanning early January through early April.

Counts become test-locked once the clinical matrix is approved.

### 8.2 Domain distribution

| Primary domain | Students | Purpose |
|---|---:|---|
| Articulation/phonology | 8 | sound acquisition, carryover, generalization, mixed target trajectories |
| Expressive language | 5 | morphosyntax, narrative, sentence formulation, vocabulary, explanations |
| Receptive language | 4 | multistep directions, concepts, inferencing, auditory comprehension |
| Social-pragmatic | 4 | topic maintenance, repair, entry, contingent response/perspective |
| Fluency | 2 | strategy use and self-monitoring without promising fluency outcomes |
| Voice | 1 | school-appropriate voice target with neutral wording |
| Other/functional communication | 1 | functional multimodal communication without device or diagnosis details |

This distribution is illustrative, not a prevalence claim.

### 8.3 Proposed caseload matrix

Final codes should receive human review for readability and to ensure none is interpreted as a
real name. All meet the two-to-three-letter rule.

| Code | Domain | Goals | Service | Longitudinal story |
|---|---|---:|---|---|
| AV | Articulation | 2 | Individual | steady gain, cue fading, one goal met |
| BEX | Articulation | 1 | Group A | accuracy improves before cues fade |
| CY | Articulation | 2 | Group A | one target progresses while one plateaus |
| DOR | Articulation | 1 | Group A | dip with only partial recovery; ends below early-term performance |
| ELM | Articulation/phonology | 2 | Group B | structured success with carryover gap |
| FEN | Articulation | 1 | Group B | noisy but upward trajectory |
| GRA | Articulation | 2 | Group B | self-correction increases while measured accuracy ends slightly lower |
| HUX | Articulation | 1 | Group B | goal met, followed by maintenance samples |
| IVQ | Expressive language | 2 | Group C | morphosyntax improves; formulation remains variable |
| JET | Expressive language | 1 | Group C | rebound after a service gap does not reach the early-term level |
| KAL | Expressive language | 1 | Group C | stronger with visuals; cue dependence persists |
| LUM | Expressive language | 2 | Group D | different trajectories across narrative and sentences |
| MEP | Expressive language | 1 | Group D | remains essentially flat after a task adjustment |
| NIX | Receptive language | 1 | Group D | high accuracy with moderate cues, not yet met |
| ORQ | Receptive language | 2 | Group E | concepts improve from structured to mixed directions |
| PAV | Receptive language | 1 | Group E | inferencing varies by context with no clear trimester trend |
| QET | Receptive language | 1 | Group E | steady improvement with fading repetition |
| RUS | Social-pragmatic | 2 | Group F | context-dependent variability with no overall upward trend |
| SIV | Social-pragmatic | 1 | Group F | repair strategy use increases |
| TOL | Social-pragmatic | 1 | Group F | conversational entry generalizes gradually |
| UMB | Social-pragmatic | 2 | Group F | one goal nears criterion; one remains emerging |
| VEK | Fluency | 1 | Group G | strategy use becomes more independent after plateau |
| WIR | Fluency | 1 | Group G | variable strategy use without meaningful trimester change |
| XAN | Voice | 1 | Individual | flat, variable strategy-use data without causal/medical claims |
| ZEP | Functional communication | 2 | Individual | modality use broadens across structured activities |

### 8.4 Group design

| Group | Members | Typical frequency | Notes |
|---|---|---|---|
| A | BEX, CY, DOR | weekly | articulation group with distinct targets |
| B | ELM, FEN, GRA, HUX | weekly | carryover and self-monitoring |
| C | IVQ, JET, KAL | weekly | expressive-language group |
| D | LUM, MEP, NIX | weekly | mixed expressive/receptive language |
| E | ORQ, PAV, QET | weekly | receptive-language tasks |
| F | RUS, SIV, TOL, UMB | weekly | social-pragmatic peer context |
| G | VEK, WIR | weekly | fluency support with separate individual notes |

Each meeting remains N linked ordinary `Session` records sharing one deterministic `groupId`.
Headers match across members; goal data, observations, standout lines, A/P, and note text remain
individual.

### 8.5 Required outcome distribution

The demo must not read like a showcase in which therapy reliably produces steady improvement.
Student-level outcomes should be intentionally distributed as follows:

| Outcome class | Students | Proposed codes | What the data should show |
|---|---:|---|---|
| Clear progress or criterion attainment | 5 | AV, HUX, QET, SIV, TOL | meaningful upward data plus reduced support or a met goal |
| Modest, noisy gains | 6 | FEN, KAL, ORQ, UMB, VEK, ZEP | some improvement, but variability and/or criteria remain |
| Plateau/no meaningful net change | 5 | MEP, PAV, RUS, WIR, XAN | early and late performance remain broadly comparable |
| Lower recent measured performance | 3 | DOR, GRA, JET | late-term samples end below early-term samples |
| Mixed outcomes across goals | 4 | CY, ELM, IVQ, LUM | one goal improves while another is flat or less successful |
| Accuracy improves but cue criterion is unmet | 2 | BEX, NIX | percentage rises, but support remains above the target level |

This distribution is an authored demonstration choice, not a claim about expected response rates,
clinical significance, prognosis, or the effectiveness of speech therapy. The UI should present
observations neutrally: “recent performance was comparable to earlier samples” or “recent samples
were lower,” not “therapy failed,” “the student failed to progress,” or an invented explanation.

Only a minority of goals should be marked met by April. The initial target is 4–6 met goals out of
approximately 36, with most goals remaining active and at least two fictional goals discontinued
or reframed after clinician review. A discontinued/reframed goal demonstrates documentation state;
the app must never suggest that action automatically.

Fixture specifications should carry an internal `outcomeClass` so tests can prevent accidental
optimistic drift. Numeric thresholds used in fixture tests are data-shape checks only—not clinical
definitions of meaningful change. Proposed checks include:

- plateau: the final three-session accuracy mean stays within five percentage points of the first
  three and cues do not improve beyond the story's approved path;
- lower recent performance: the final three-session mean is at least five points below the first
  three, without claiming why;
- accuracy-before-cues: accuracy rises materially while the target cue level remains unmet;
- mixed: the two goals end in different outcome classes;
- clear progress: the approved upward change is accompanied by reduced cueing or criterion status.

### 8.6 Authored trajectory archetypes

Use a small set of authored, deterministic trajectory shapes rather than random generation:

1. steady accuracy improvement with cue fading;
2. accuracy improves before cue dependence resolves;
3. plateau followed by task/cue adjustment;
4. context-sensitive variability;
5. regression after a service gap followed by recovery;
6. criterion met followed by maintenance samples;
7. two goals with divergent progress;
8. structured success with a generalization gap;
9. flat performance across the trimester despite task/cue adjustments;
10. lower recent observations without an attributed cause.

Profiles choose an archetype and supply goal-specific start/end ranges. The generator converts
approved percentage targets to plausible integer correct/total trials. It may use shared activity,
observation, and neutral S/A/P phrase tables, but every emitted claim must be traceable to stored
session data or authored context.

For plateau, mixed, and lower-performance stories, A/P language must stay descriptive and
appropriately uncertain. It may document continued data collection, a changed task/support, or
clinician review of the plan. It must not infer motivation, family follow-through, diagnosis,
prognosis, attendance causes, or treatment efficacy from the synthetic data.

### 8.7 Compact generator design

Do not hard-code 270 complete session objects or SOAP notes. Store compact profile specs:

```js
{
  code: 'NIX',
  group: 'D',
  goals: [...],
  arc: 'accuracy-before-cues',
  start: 52,
  end: 86,
  cuePath: ['maximal', 'moderate', 'moderate', 'minimal'],
  activitySet: 'directions'
}
```

Then deterministically expand shared weekly schedules, trial-count patterns, cue paths,
observations, and text frames. This approach keeps the source reviewable and protects the bundle
budget while retaining authored clinical stories.

No `Math.random()`, seeded pseudo-random generator, runtime fetch, or generated clinical language
is allowed.

### 8.8 Dataset contracts

Tests must prove:

- exactly 25 unique uppercase alphabetic codes, each length 2–3;
- exact client/goal/session/group counts after content approval;
- every ID and reference is deterministic and valid;
- all dates lie within the approved January–April term;
- session dates are chronological and no record is in the future for the chosen term;
- group members share header facts and group IDs;
- every trial count is integer, `0 <= correct <= total`, with clinically reasonable totals;
- cue levels/types, domains, settings, statuses, tags, and activities use supported constants;
- criterion streaks respect both accuracy and target cue level;
- the exact 5/6/5/3/4/2 student-level outcome distribution is present;
- plateau, lower-performance, mixed-goal, and cue-dependent profiles satisfy their internal
  fixture-shape checks;
- only 4–6 of approximately 36 goals are met; most remain active and at least two are
  discontinued/reframed;
- designated hero arcs produce the intended met, active, plateau, mixed, and lower-recent outcomes;
- O is generated only through production `generateO()`;
- A/P statements do not claim unsupported causes, prognosis, diagnosis, or treatment norms;
- no key or value contains a name, DOB, school, grade, teacher, address, diagnosis, or schedule;
- copied note text excludes UI demo labels, while printed sample notes include the banner.

## 9. Guide built from the actual UI

### 9.1 Design principle

The guide should render the real Caseload, Client Detail, Progress, Session, Note, and Group
components against demo memory. It must not use screenshots, mock HTML, or copied controls.

A small `DemoGuide` wrapper owns only:

- step title and explanation;
- Back, Next, Explore freely, and Exit actions;
- the route/props for the real screen used by that step;
- a stable target identifier for a gentle visual highlight;
- optional “Try it” instructions.

### 9.2 Proposed six-step guide

| Step | Real screen | Purpose | Interaction |
|---:|---|---|---|
| 1 | Caseload | Orient to 25 clients, goal counts, recent sessions, and group workflow | search for a code |
| 2 | Client Detail for CY | Compare two goals and open longitudinal history | inspect early/latest sessions |
| 3 | Progress for MEP | Show a realistic plateau with no meaningful trimester change | change date range; copy summary |
| 4 | Designated draft Session for NIX | Demonstrate scoring, cue level, observations, and O regeneration | tap Correct/Incorrect and Undo |
| 5 | Final Note for AV | Show editable S/O/A/P, clean copy output, and fictional print label | copy note |
| 6 | Recent Group F meeting | Show one shared workspace with separate student data and notes | switch RUS/SIV/TOL/UMB |

The final step offers:

- **Explore the demo freely**
- **Create private workspace**
- **Return to welcome**

### 9.3 Highlighting

Add stable `data-guide-target` attributes to existing production elements. Highlight with an
outline and a short inline callout; do not use an opaque spotlight layer that traps focus or hides
the actual UI.

The guide must remain usable when the target is below the fold:

- scroll the target into view after the real screen mounts;
- respect `prefers-reduced-motion`;
- keep the callout in normal document flow on small screens;
- never move or reorder the target while a clinician/evaluator is tapping it;
- make every guide control keyboard accessible.

### 9.4 Help integration

Update Help's Quick Start so each major instruction includes **Try this in the demo**, linking to
the corresponding guide step. The linked step renders the actual screen and controls.

Do not embed a second full SessionScreen directly inside the long static Help document; that would
produce nested landmarks, duplicate IDs, awkward mobile layout, and two places to maintain guide
state.

## 10. Private workspace disclaimers and copy contract

### 10.1 Required claims

Copy may say:

- records are encrypted locally with the documented WebCrypto design;
- no student data is intentionally sent to Harmonic Systems or any backend;
- the app works offline after its static assets are available;
- note output is deterministic and editable;
- the user controls encrypted backups;
- only codes should be used.

### 10.2 Claims to avoid

Copy must not say or imply:

- “HIPAA compliant,” “FERPA compliant,” or “district approved”;
- zero risk, guaranteed privacy, or guaranteed browser durability;
- automatic backups or syncing;
- passphrase reset/recovery;
- diagnostic accuracy, clinical recommendations, or progress prediction;
- EMR integration unless one is actually built;
- account creation, sign-in, or cloud storage.

### 10.3 Demo disclaimer hierarchy

Use three layers without overwhelming the interface:

1. persistent global demo banner;
2. `demo`/`fictional` text on screen headings and printed notes;
3. a concise explanation on Welcome and Help.

Do not repeat long warning paragraphs on every card.

## 11. Security and privacy invariants

The following are release blockers:

- Demo entry must never read/decrypt the private vault.
- Demo mutation must never call IndexedDB or private persistence APIs.
- Demo and private records must never coexist in shared decrypted stores.
- Entering demo from private mode must await pending autosaves before wiping the key.
- Leaving demo must wipe every demo record and settings value before private unlock/create begins.
- Route manipulation must not bypass mode transitions.
- Private-only backup/import/rekey/erase controls must be unreachable in demo mode.
- Broadcast-channel epoch handling must remain correct when another tab is in demo mode.
- No hard-coded “demo passphrase” may exist.
- No runtime network call, telemetry, analytics, external font, CDN, or remote image may be added.
- The service worker may cache only bundled static assets; demo data remains compiled fiction.
- Printing/copying must keep fictional labeling correct without polluting EMR-pasteable text.
- All existing vault, transaction, key-wipe, epoch, lock-flush, and encrypted-row tests remain green.

## 12. Performance and bundle budget

The reviewed implementation is approximately 105.5 KB gzipped with a 120 KB hard limit. `F-007`
should target **no more than 112 KB total gzipped JS**, preserving at least 8 KB of headroom for
future fixes.

Budget strategy:

- remove the in-vault sample install/reset/remove lifecycle before adding the full dataset;
- use compact profile/archetype specs rather than authored full session objects;
- reuse existing components and CSS variables;
- add no runtime dependency;
- avoid storing repeated long strings per client when a shared phrase/activity table works;
- consider dynamic imports for faster initial parsing, but remember the current gate counts all JS
  chunks, so code splitting does not excuse total-size growth;
- measure after every phase, not only at the end.

Performance targets on the project's intended weak Windows/Edge laptop:

- welcome page interactive promptly after cached load;
- demo dataset generation and first Caseload render under 250 ms on representative throttled
  hardware, with no multi-second blank state;
- search/filter of 25 clients immediate;
- group switching preserves current autosave behavior and has no perceptible stall;
- progress charts over 8–12 points remain lightweight SVG;
- demo reset completes without freezing input for more than one animation frame when practical;
- no horizontal overflow at 598–640 px viewport width.

If 25 clients plus 270 sessions exceed the target, reduce repetitive fixture text and source
representation first. Do not weaken encryption, remove safety checks, or increase the 120 KB gate.

## 13. Accessibility requirements

- Welcome actions have distinct, descriptive names and are reachable in logical tab order.
- Demo status uses visible text, not color alone.
- Banner is a landmark/status message but does not repeatedly announce on every route change.
- Guide step changes move focus to the guide heading, then allow normal traversal into the real UI.
- Highlighted targets retain existing focus indicators and contrast.
- No auto-advancing tour, focus trap, hover-only instruction, or drag interaction.
- Back/Next buttons state the destination or step count.
- Reduced-motion preferences disable smooth scrolling/animated emphasis.
- All demo controls remain usable at 200% zoom and the smallest supported viewport.
- The print-only fictional banner remains legible in grayscale.

## 14. Implementation order

The safest order validates architecture with the existing four-client fixture before investing in
the full clinical dataset.

### Phase 0 — content and product approval

Owner: David + practicing SLP reviewer.

- approve demo-only two-to-three-letter codename policy;
- approve public demo replacing in-vault sample installation;
- approve January–April calendar rule and proposed caseload matrix;
- review domains, goals, criterion language, trajectory archetypes, activities, and disclaimers;
- choose the guide's hero students and draft session;
- confirm the product term **private workspace** instead of Sign up.

Exit: the dataset matrix and public/private copy are approved for implementation.

### Phase 1 — mode-aware router and lifecycle shell

Owner: implementation agent.

- add public/private/demo route parsing and `hrefFor()`;
- replace all hard-coded internal hashes with the mode-aware helper;
- add `appMode` transition rules without changing repository persistence yet;
- add exhaustive router and transition tests;
- keep the current private vault behavior functional.

Exit: every ordinary screen has a direct demo-prefixed route in tests, even before demo data loads.

### Phase 2 — passphrase-free vertical slice with the existing fixture

- implement enter/reset/exit demo memory behavior using the current four-client dataset;
- make record, settings, and group mutations in-memory in demo mode;
- hide private-only backup/rekey/import/erase surfaces;
- add persistent demo banner and Exit action;
- verify entering demo from an unlocked private session flushes and wipes safely;
- add repository tests proving zero demo writes reach IndexedDB.

Exit: `#/demo/clients` is interactive without a passphrase and cannot affect a private vault.

### Phase 3 — welcome and private-workspace onboarding

- add `Welcome`, `CreateWorkspace`, and returning Unlock flow;
- implement capability/limitation copy and acknowledgments;
- link Help from every public state;
- test first-run, returning-vault, wrong-passphrase, cross-tab vault creation, and demo/private
  transitions;
- browser-test Back/Forward and direct links.

Exit: both intake paths are understandable and complete with the four-client vertical slice.

### Phase 4 — retire in-vault sample lifecycle and reclaim budget

- remove encrypted sample install/repair/reset/remove UI and repository APIs;
- remove collision/mixed-sample code made unnecessary by strict mode separation;
- keep only provenance/labels needed by public demo records;
- update `F-006`, Help, and architecture docs to say the public demo superseded vault installation;
- re-run vault security tests and compare bundle size.

Exit: private workspaces begin empty, demo records never enter backups, and the bundle has room for
the trimester fixture.

### Phase 5 — expand to 25 students and a full trimester

- replace the four-client fixture with compact approved profile/archetype specs;
- generate groups, goals, approximately 260–280 sessions, SOAP sections, and designated drafts;
- add exact dataset contracts and hero-story tests;
- verify Caseload/Progress/Group rendering and search on throttled hardware;
- human-review representative early/middle/late notes for every archetype and all hero stories.

Exit: the canonical demo has approved January–April longitudinal breadth and stays within the
interim 112 KB target.

### Phase 6 — guide using real UI

- add `DemoGuide` and six step definitions;
- render actual production screen components for every step;
- add stable target attributes and accessible highlighting;
- link Help Quick Start instructions to guide steps;
- test guide navigation, target presence, interactive edits, focus, reduced motion, and narrow
  layout.

Exit: a first-time evaluator can complete the guided loop without reading a separate manual.

### Phase 7 — final verification and adversarial review

- run all unit/integration tests and the production build/bundle gate;
- run the complete public/private browser acceptance matrix against `npm run preview`;
- test offline reload after service-worker installation;
- test low-end CPU and narrow viewport behavior;
- run independent security/privacy, clinical-data, and UI/accessibility finders;
- use the established three-judge refutation panel for each finding;
- fix findings upheld by at least two judges and repeat focused reviews;
- update handoff, decision, and contribution records;
- commit only after all release blockers are resolved.

Exit: feature is ready for human merge approval.

## 15. Test and acceptance matrix

### 15.1 Public routing

- Fresh browser opens Welcome, not an accidental create/unlock form.
- `#/demo` enters the guide with no passphrase.
- Every `#/demo/...` deep link rebuilds demo data after reload and opens the intended record.
- Private routes never initialize demo memory.
- Demo links retain the `/demo` prefix.
- Exit removes the prefix, wipes stores, and shows Welcome/Unlock as appropriate.
- Unknown public/demo/private paths fail safely.

### 15.2 Isolation

1. Create a private vault with a sentinel client, goal, setting, learned phrase, and session.
2. Enter demo from the unlocked vault.
3. Confirm the private key/cache is wiped and sentinel data is absent.
4. Edit/delete/create demo records and settings.
5. Inspect IndexedDB: no row or metadata changed.
6. Exit and unlock the vault.
7. Confirm the sentinel data and settings are byte-for-byte/logically unchanged.
8. Repeat while a Session autosave is pending.
9. Repeat with a second tab performing an epoch-changing private operation.

### 15.3 Demo reset

- Mutate a hero session, goal, client code, phrase setting, and group member note.
- Reset once and verify the exact canonical fixture returns.
- Reset repeatedly and verify no duplicates or stale in-memory references.
- Reload and verify canonical data returns.
- Confirm no backup nag or last-modified metadata is produced.

### 15.4 Dataset

- Validate every contract in Section 8.8.
- Snapshot only compact structural facts and intentional note contracts, not hundreds of brittle
  full-object snapshots.
- Review at least one early/middle/late note for each of eight archetypes.
- Review every goal for unsupported clinical claims.
- Verify all Progress summaries match stored trials, cues, and criteria.

### 15.5 Guide

- Complete all six steps using keyboard only.
- Confirm each step renders the actual production component and target.
- Modify the draft session and observe O update through production logic.
- Switch all four Group F members and confirm independent data/note state.
- Copy/print a note and verify fictional labeling boundaries.
- Exit midway and confirm memory wipe.

### 15.6 Welcome/private onboarding

- First visit: See Demo and Create private workspace are visible without scrolling.
- Existing vault: Unlock replaces Create as the main private action.
- Passphrase mismatch, too-short passphrase, lost-passphrase acknowledgment, and vault-exists race
  remain clear and accessible.
- Copy never implies an account, cloud sync, recovery, compliance certification, or AI behavior.

### 15.7 Performance/offline

- Test at 4× CPU throttling or representative weak Windows hardware.
- Test 598px width and 200% zoom without horizontal overflow.
- Install the production service worker, go offline, reload Welcome, demo deep links, Help, and
  private unlock.
- Confirm the update prompt never interrupts a live private or demo session.
- Record total gzipped JS after every phase; final must be <=120 KB and target <=112 KB.

## 16. Documentation changes

Update together with implementation:

- `CLAUDE.md`: app modes, mode-aware repository writes, public route map, demo invariants, dataset
  counts, test count, and current bundle size;
- `docs/SANDBOX_DEMO_PLAN.md`: mark the in-vault approach superseded by `F-007` if approved;
- Help: Welcome/demo/private distinctions, 25-student January–April description, Try-in-demo links,
  limitations, and no-account terminology;
- UI copy: replace old “about two months/four clients” text everywhere;
- tests: source of truth for routes, dataset counts, persistence isolation, and output boundaries.

Do not describe the public demo as encrypted storage. It contains only bundled fictional data and
is intentionally temporary. Continue describing private records and backups accurately as
encrypted.

## 17. Branching, ownership, and agent handoff

### 17.1 Recommended branch strategy

Preserve `codex/sandbox-demo` at `1e25d78` as the working prototype. After plan approval, create:

```text
codex/public-demo-onboarding
```

from that commit. If Claude is the implementation owner, it may instead create its normal
Claude-prefixed branch from the same commit. Do not let Claude Code and Codex edit the same
working tree concurrently.

Keep one implementation owner per phase. Independent agents may review committed diffs, but they
should not mutate the implementation worktree during finder/judge review.

### 17.2 Handoff format

```text
Feature/subfeature and phase:
Starting commit:
Ending commit or working-tree state:
Files changed:
Behavior implemented:
Security/mode invariants touched:
Tests added or changed:
Commands and results:
Bundle size before/after:
Browser scenarios completed:
Plan deviations and rationale:
Known risks or unfinished work:
Suggested-by / specified-with / implemented-with / reviewed-by-tool credits:
```

### 17.3 Credit trailers

Use only accurate trailers. Suggested form for planning commits:

```text
Suggested-by: David Nyman
Specified-with: Codex
```

Implementation commits add exactly one of:

```text
Implemented-with: Claude Code
```

or:

```text
Implemented-with: Codex
```

Review commits may add:

```text
Reviewed-by-tool: Claude Code
Reviewed-by-tool: Codex
```

Human Git authorship remains unchanged.

## 18. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Demo/private store crossover | severe privacy/data-loss issue | explicit mode state, route-driven transitions, wipe-before-populate, sentinel isolation tests |
| Missed hard-coded link drops mode | confusing or unsafe navigation | central `hrefFor`, exhaustive route/link audit and tests |
| 25-student fixture exceeds bundle | build failure/lost headroom | remove in-vault lifecycle, compact specs, shared vocabulary, per-phase size gate |
| Dataset feels synthetic or clinically questionable | poor SLP feedback/trust | authored archetypes, human SLP review, integer trials, neutral claims |
| Welcome warnings overwhelm conversion | evaluators abandon before seeing value | progressive disclosure; concise Welcome, details on Create/Help |
| “Sign up” misrepresents architecture | false expectation of account/sync | consistently use Create/Unlock private workspace |
| Guide diverges from real UI | stale instruction | render real components; stable targets; no screenshots |
| Demo edits appear durable | evaluator loses work or enters real data | persistent banner, temporary-copy language, reset on reload/exit |
| Demo route exposes private settings tools | accidental private mutation/confusion | mode-gated shell and private-only surface tests |
| Large initial render feels slow | poor weak-laptop experience | generate once, compact data, no heavy dependencies, throttled QA |
| Sample codes resemble names | de-identification confusion | human review of code list; call them codes; uppercase letters only |

## 19. Decision log

| Date | Decision | Status | Rationale |
|---|---|---|---|
| 2026-07-15 | Use two-to-three uppercase letters for all demo student codes | Recommended | Meets requested presentation without breaking private/imported code compatibility |
| 2026-07-15 | Keep the real-vault code rule unchanged in this feature | Recommended | Avoids an unrelated breaking validation/migration change |
| 2026-07-15 | Replace in-vault sample installation with an ephemeral public demo | Recommended | Cleaner intake, stronger isolation, smaller backup/collision surface |
| 2026-07-15 | Use `/demo`-prefixed hash routes instead of a hidden session flag | Recommended | Shareable, reload-safe, mode-explicit navigation |
| 2026-07-15 | Call the private flow Create private workspace, not Sign up | Recommended | There is no account or backend |
| 2026-07-15 | Build the guide from actual production screens | Recommended | Eliminates screenshot/mock drift and gives experiential learning |
| 2026-07-15 | Validate the demo runtime with four clients before expanding to 25 | Recommended | Proves the highest-risk isolation architecture before content-heavy work |
| 2026-07-15 | Target the most recently completed January–April term for an anchor date | Recommended | Keeps the trimester coherent and deterministic without a permanently stale year |
| 2026-07-15 | Require plateau, lower-recent, mixed, and cue-dependent outcomes—not only progress stories | David + Codex | Presents realistic longitudinal expectations and prevents an inadvertently promotional dataset |

## 20. Handoff log

| Date | Agent/person | Role | Phase | Commit/state | Notes |
|---|---|---|---|---|---|
| 2026-07-15 | David Nyman + Codex | product/architecture planning | 0–7 | `84c467e` on `codex/public-demo-onboarding` | Defined separate public/private flows, ephemeral demo boundary, trimester dataset, live UI guide, implementation order, and contribution model |
| 2026-07-15 | Codex | implementation, adversarial review, and browser verification | 1–7 | uncommitted implementation on `codex/public-demo-onboarding` | Built strict demo/private modes, Welcome/Create/Unlock, 25-student/35-goal/268-session trimester, real-UI guide, and Help integration. Three finder reviews plus a three-judge panel confirmed lifecycle, clinical-fixture, and accessibility issues; confirmed fixes are covered by a 99-test suite. Final production/offline browser matrix passed at 105.5 KB gzipped. |

## 21. Definition of done

The umbrella feature is done only when:

- a public visitor can enter the demo without a passphrase or account;
- the demo contains exactly 25 approved fictional letter-only codes and a complete January–April
  trimester;
- the test-locked dataset includes clear progress, modest/noisy gains, plateaus, lower recent
  performance, mixed-goal outcomes, and accuracy gains that do not meet cue criteria;
- only a minority of goals are met, while most remain active and at least two are
  discontinued/reframed after fictional clinician review;
- the six-step guide uses actual production note-builder screens and remains fully interactive;
- private creation/unlock copy accurately explains local encryption, no sync, no recovery,
  backups, codes-only use, and clinical limitations;
- demo data is temporary, clearly fictional, and never written to IndexedDB or backups;
- private and demo data never coexist in decrypted stores;
- entering/leaving demo safely flushes and wipes any private state;
- every private/demo route and link preserves the correct mode;
- the private vault starts empty and no longer offers fictional-data installation;
- no backend, analytics, telemetry, AI, runtime fetch, or new dependency is added;
- clinical content is reviewed by a practicing SLP;
- the exact note contract remains unchanged; the O cue-list grammar revision is intentional and
  test-locked;
- all old and new tests pass;
- production offline/browser acceptance passes on the target low-end profile;
- final JavaScript is <=120 KB gzipped, with <=112 KB as the design target;
- adversarial security, clinical-data, and UI/accessibility review is complete and upheld findings
  are fixed;
- architecture docs, Help, decisions, handoff, and contribution credits are current.
