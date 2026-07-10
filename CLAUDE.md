# Claude Code Prompt: SLP SOAP Note Builder

Copy everything below this line into Claude Code.

---

Build a complete, production-ready web app called **SOAP Note Builder** — a local-first, offline-capable PWA for a school-based speech-language pathologist to collect session data and generate SOAP notes fast. It will be hosted on GitHub Pages at **soap.harmonic-systems.org**. There is NO backend. All client data lives encrypted in the browser. The primary device is a low-spec Acer Windows laptop running Microsoft Edge on slow internet, so performance and bundle size are hard constraints.

## 1. Tech stack (exact — do not substitute)

- **Svelte 5 + Vite** (plain Svelte, NOT SvelteKit — no SSR, no server routes)
- **Dexie.js** for IndexedDB
- **WebCrypto API** (native) for all cryptography — no crypto libraries
- **uPlot** for charts (or hand-rolled SVG if simpler)
- **Plain CSS** with CSS custom properties — no Tailwind, no component library
- **vite-plugin-pwa** (Workbox) for the service worker
- **Hash-based routing** (`#/clients`, `#/session/:id`) — GitHub Pages has no SPA rewrites, so never use history routing
- Deploy via **GitHub Actions** to GitHub Pages, with a `CNAME` file containing `soap.harmonic-systems.org`

**Performance budget (enforced):** total JS ≤ 120 KB gzipped, first meaningful paint on repeat visit < 1s with network disabled, all interactions < 100ms on low-end hardware. No dependency may be added beyond those listed without a size justification in a code comment.

## 2. Security & privacy model

This app stores therapy data. The protection model:

1. **First run:** user creates a passphrase. Derive a 256-bit key with PBKDF2 (SHA-256, ≥ 310,000 iterations, random 16-byte salt). Store only the salt and a verification value (encrypt a known constant; on unlock, decrypt and compare). NEVER store the passphrase or raw key.
2. **All record payloads encrypted at rest** with AES-GCM (fresh 12-byte IV per write, IV stored alongside ciphertext). Dexie tables store `{id, updatedAt, blob}` where `blob` is ciphertext; all searchable/queryable fields live inside the encrypted payload and are indexed in memory after unlock.
3. **Lock screen:** app opens locked. Auto-lock after 15 minutes idle (configurable) and on tab hide > 5 minutes. Locking wipes the in-memory key and decrypted cache.
4. **De-identification by design:** clients are identified ONLY by initials or a short code (validate: max 5 chars, no spaces). Placeholder text and helper copy must reinforce "initials or code only — never full names." No field anywhere accepts DOB, school name, or other identifiers.
5. **No network calls with data, ever.** The service worker serves the app; zero analytics, zero fonts from CDNs, zero telemetry. Everything self-hosted in the bundle.
6. **Passphrase loss = data loss.** Say this clearly in onboarding and settings, and push the user toward regular backups.

## 3. Backup & restore (critical feature — browser storage is not durable)

- **Export:** one click produces a single encrypted backup file `soap-backup-YYYY-MM-DD.enc` (the encrypted Dexie dump, same passphrase-derived key, versioned JSON inside). Use the File System Access API (`showSaveFilePicker`) on Edge/Chrome with an `<a download>` fallback.
- **Import:** restore from a backup file with a clear merge-or-replace choice (default: replace after confirmation).
- **Backup nagging:** show a dismissible banner if the last export is > 7 days old and there are new/changed records. Show "last backup: N days ago" in the header.
- Request `navigator.storage.persist()` on first unlock to reduce eviction risk.

## 4. Data model (inside encrypted payloads)

```
Client:   { id, code, notes?, archived, createdAt }
Goal:     { id, clientId, domain, text, targetCriterion {accuracyPct, consecutiveSessions, cueLevel},
            baseline?, status: active|met|discontinued, createdAt }
Session:  { id, clientId, date, durationMin, setting: individual|group|push-in|teletherapy,
            soap: { S: string, O: string (generated + editable), A: string, P: string },
            goalData: [GoalData], status: draft|final, createdAt, updatedAt }
GoalData: { goalId, trials: {correct, total} | null, accuracyPct (derived),
            cueLevel: independent|minimal|moderate|maximal,
            cueTypes: [verbal|visual|tactile|phonemic|gestural|model],
            activity?: string, notes?: string }
Setting:  { phraseBank overrides, autoLockMinutes, therapistName? }
```

`domain` is one of: `receptive-language`, `expressive-language`, `articulation-phonology`, `social-pragmatic`, `fluency`, `voice`, `other`. The first four get full template support (see §6); fluency/voice/other get generic templates.

## 5. Screens (hash routes)

1. **Lock / Unlock** (`#/`) — passphrase entry; create-passphrase flow on first run with the data-loss warning and a required "I understand" checkbox.
2. **Caseload** (`#/clients`) — client list with per-client indicators: active goal count, last session date, goals nearing criterion. Add/archive clients. Search by code.
3. **Client detail** (`#/client/:id`) — goals grouped by domain with mini sparkline of recent accuracy each; session history; "New session" button. Goal add/edit uses a builder: pick domain → pick a goal template from the bank (see §6) → fill the slots (skill, level, accuracy %, cue level, consecutive sessions) → or write free-text.
4. **Session** (`#/session/:id`) — THE core screen; optimize relentlessly for speed during a live session:
   - Client's active goals listed as cards. Each card: **big +correct / −incorrect tap buttons** with a running `correct/total (pct%)` readout, undo, cue-level segmented control, cue-type chips, one-line activity/notes field.
   - Works one-handed on a laptop trackpad; also fully keyboard-drivable (arrow keys select goal card, `c`/`x` for correct/incorrect).
   - Below the goal cards: S, A, P quick-entry with phrase-bank chips (§6), each followed by an editable textarea. O is auto-generated live from the trial data and shown as an editable preview.
   - Autosaves as draft on every change. "Finalize" locks it (editable again via explicit "Reopen").
5. **Note output** (`#/session/:id/note`) — assembled plain-text note (format in §7), a **Copy note** button (`navigator.clipboard.writeText`, with visible "Copied ✓" feedback), and a **Print** button opening a clean print stylesheet view (this is the PDF path — user prints to PDF).
6. **Progress** (`#/client/:id/progress`) — per-goal line chart of accuracy over sessions with the target criterion drawn as a horizontal reference line; cue-level shown as point styling; date-range filter; "copy progress summary" button producing a plain-text paragraph per goal (for progress reports/IEP input).
7. **Settings** (`#/settings`) — change passphrase (re-encrypt all), auto-lock timer, export/import backup, edit phrase banks, erase all data (typed confirmation).

## 6. Template engine & phrase banks (the heart of the app)

Deterministic text assembly — no AI, no network. Two layers:

**Goal templates** (used in the goal builder). Slot syntax: `{skill}`, `{accuracy}`, `{cueLevel}`, `{sessions}`, `{context}`. Ship at least 8 per domain for the three priority domains. Examples to include and extend in the same style:

- *Receptive language:* "Will follow {n}-step directions containing {concept type, e.g., temporal/spatial concepts} with {accuracy}% accuracy given {cueLevel} cues across {sessions} consecutive sessions." / "Will identify {skill: e.g., objects by function, category members, story elements} from a field of {n} with {accuracy}% accuracy…" / "Will answer {wh-type} questions about a {text type} presented {orally/with visuals} with {accuracy}% accuracy…"
- *Expressive language:* "Will produce {structure: e.g., subject–verb–object sentences, regular past tense, conjunctions} in {context: structured tasks/conversation} with {accuracy}% accuracy…" / "Will retell a narrative including {story grammar elements} given {cueLevel} cues…" / "Will define/describe {skill} using {n}+ attributes…"
- *Articulation/phonology:* "Will produce {phoneme(s)} in the {initial/medial/final} position at the {isolation/syllable/word/phrase/sentence/conversation} level with {accuracy}% accuracy given {cueLevel} cues…" / "Will reduce use of {phonological process, e.g., fronting, cluster reduction} to below {n}% of opportunities…" / "Will self-monitor and self-correct target sound errors in {context} in {n} of {n} opportunities…"
- *Social-pragmatic:* "Will initiate and maintain a topic for {n} conversational turns with {cueLevel} cues…" / "Will identify expected/unexpected behaviors in {context: role-play, video scenarios} with {accuracy}% accuracy…" / "Will interpret nonliteral language ({idioms/sarcasm/inference}) with {accuracy}% accuracy…" / "Will use repair strategies when a communication breakdown occurs in {n} of {n} opportunities…"

**SOAP phrase banks** (chips on the session screen; clicking appends to the textarea; all editable in Settings):

- **S:** arrival/mood/engagement ("transitioned willingly," "required encouragement to engage," "reported a good week," "appeared fatigued"), participation level, relevant reports from teacher/parent.
- **O (auto-generated):** one sentence per goal from trial data, in this exact pattern: `"{ClientCode} produced {goal short label} with {accuracy}% accuracy ({correct}/{total} trials) given {cueLevel} {cueTypes} cues during {activity}."` Goals with no trials that session are omitted. Non-trial observations appendable via chips.
- **A:** progress statements keyed to data the app already has — auto-suggest chips like "improved from {last session pct}% to {today pct}%," "consistent with previous session," "emerging skill — benefits from {cueTypes} cues," "approaching criterion ({n} of {sessions} consecutive sessions at target)," "difficulty generalizing to {context}." The engine fills the numbers automatically.
- **P:** "continue current goals," "increase linguistic complexity," "fade cues toward {next cue level}," "introduce {context} generalization," "probe {skill} next session," "recommend home practice: {activity}."

Store default banks as JSON; user edits are an overlay saved in Settings (never mutate defaults, so updates can ship new phrases safely).

## 7. Plain-text note output format

```
SOAP NOTE — {ClientCode} — {YYYY-MM-DD} — {duration} min — {setting}

S: {subjective text}

O: {objective text — one sentence per goal + observations}

A: {assessment text}

P: {plan text}
```

Plain text only: no markdown, no smart quotes, no tabs, single blank line between sections — it must paste cleanly into any EMR text field. The Copy button copies exactly this.

## 8. PWA & offline

- Precache the entire app shell; `registerType: 'prompt'` — show a small "Update available — Reload" toast rather than auto-reloading (never interrupt a live session).
- App must be fully functional with network disabled after first visit. Test this explicitly.
- Provide a proper manifest (name, icons 192/512, `display: standalone`, theme color) so it can be pinned as an app from Edge.

## 9. Repository & deployment

- Repo layout: standard Vite app, `public/CNAME` containing `soap.harmonic-systems.org`, `vite.config` with `base: '/'` (custom domain = root path).
- GitHub Actions workflow: on push to `main` → build → deploy to Pages (official `actions/deploy-pages` flow).
- README with: local dev instructions, deployment steps, and DNS instructions (CNAME record for `soap` pointing to `<username>.github.io`, then enable custom domain + Enforce HTTPS in repo Pages settings).
- Include unit tests (Vitest) for: crypto round-trip (encrypt/decrypt, wrong passphrase fails), backup export/import round-trip, accuracy calculation, O-section text generation, and the goal-template slot filler. Include a CI step that fails the build if the gzipped JS bundle exceeds 120 KB.

## 10. Build order

1. Scaffold + routing + lock screen + crypto layer (with tests)
2. Dexie schema + encrypted repository layer (with tests)
3. Caseload + client + goal builder with template banks
4. Session screen with trial counters and phrase chips
5. O-generation + note output + copy/print
6. Progress charts + progress summary text
7. Backup export/import + settings
8. PWA + Actions deploy + README

Work through these in order, verifying each stage runs before moving on. Prioritize the session screen's speed and ergonomics above all else — it's used live, mid-session, on weak hardware.