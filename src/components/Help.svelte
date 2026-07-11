<script>
  // In-app Help & About (offline, self-contained). Reachable both when locked
  // (standalone, so a prospective user can read privacy/AI/why before creating
  // a vault) and when unlocked (inside the normal app shell). All static prose.
  let { locked = false } = $props()

  const sections = [
    ['quick-start', 'Quick start'],
    ['session', 'Running a session'],
    ['corpus', 'Making notes yours'],
    ['backups', 'Backups & restore'],
    ['progress', 'Progress reports'],
    ['privacy', 'Privacy & security'],
    ['why', 'Why this exists'],
    ['built', 'How it was built'],
    ['contact', 'Contact']
  ]

  // Native hash anchors would collide with the hash router (#/help#contact
  // parses as notfound), so scroll manually. Read the target from the element
  // rather than a loop closure so it always resolves the clicked section.
  function jump(e) {
    e.preventDefault()
    const id = e.currentTarget.getAttribute('data-target')
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
</script>

<div class:container={locked}>
  {#if locked}
    <div class="toolbar no-print">
      <a href="#/">← Back</a>
    </div>
  {/if}

  <div class="toolbar">
    <h1 style="margin:0">Help &amp; About</h1>
    <button class="no-print right" onclick={() => window.print()}>Print this guide</button>
  </div>

  <nav class="help-toc no-print" aria-label="On this page">
    {#each sections as [id, label]}
      <a href="#/help" data-target={id} onclick={jump}>{label}</a>
    {/each}
  </nav>

  <section class="card" id="quick-start">
    <h2>Quick start</h2>
    <p class="hint">The whole loop, start to finished note, takes about a minute.</p>
    <ol>
      <li><strong>Add a client</strong> on the Caseload screen — initials or a short code only (e.g. <code>JD</code> or <code>S12</code>). Never full names.</li>
      <li><strong>Add a goal</strong>: pick a domain, choose a template, and fill the blanks — or write your own. The target (accuracy %, cue level, consecutive sessions) lives right on the goal.</li>
      <li><strong>Start a session</strong> with <em>New session</em>. Each active goal becomes a card.</li>
      <li><strong>Collect data</strong> by tapping <em>+ Correct</em> / <em>− Incorrect</em> as you work. The running score and percentage update live.</li>
      <li><strong>The O section writes itself</strong> from your trial data — one sentence per goal, editable any time.</li>
      <li><strong>View note</strong> → <em>Copy note</em> to paste into your EMR, or <em>Print</em> to save a PDF.</li>
    </ol>
  </section>

  <section class="card" id="session">
    <h2>Running a session fast</h2>
    <p>The session screen is built to keep up with a live session on modest hardware:</p>
    <ul>
      <li><strong>Big tap targets</strong> — <em>+ Correct</em> and <em>− Incorrect</em> are large enough to hit one-handed on a trackpad. <em>Undo</em> removes the last tap.</li>
      <li><strong>Keyboard driving</strong> — <kbd>↑</kbd><kbd>↓</kbd> move between goal cards, <kbd>C</kbd> scores correct, <kbd>X</kbd> scores incorrect, <kbd>Z</kbd> undoes. No mouse needed.</li>
      <li><strong>Cue level &amp; cue types</strong> — set independent/minimal/moderate/maximal and tap which cues you used; both flow into the note.</li>
      <li><strong>Autosave</strong> — every change saves as a draft automatically. <em>Finalize</em> locks the note; <em>Reopen</em> unlocks it if you need to edit.</li>
    </ul>
  </section>

  <section class="card" id="corpus">
    <h2>Making notes yours</h2>
    <p>The app learns your voice so notes stay specific and real instead of boilerplate:</p>
    <ul>
      <li><strong>Save your own phrases</strong> — type a line in the S, A, or P box and tap <em>＋ Save phrase</em>. It becomes a reusable chip. The phrases you use most rise to the top automatically.</li>
      <li><strong>Observation chips &amp; “What stood out?”</strong> — quick-tap what happened on each goal card, and capture the one specific thing worth remembering. Both flow into the O section.</li>
      <li><strong>Repetition nudge</strong> — if a note reads nearly the same as this client's last one, the app asks (it never blocks or rewrites), and it rotates recently-used phrases down so you don't lean on the same lines.</li>
      <li><strong>Custom observation tags</strong> — add your own tags (and hide built-ins you don't use) in <em>Settings → Observation tags</em>. Retired tags are kept so old notes still read correctly.</li>
    </ul>
    <p class="hint">
      Every suggestion comes from your own data or your own saved words — the app never invents
      clinical claims.
    </p>
  </section>

  <section class="card" id="backups">
    <h2>Backups &amp; restore</h2>
    <p>
      <strong>Browser storage is not permanent</strong> — a browser can clear it without warning,
      and there is no cloud copy. Protect your data by exporting backups regularly.
    </p>
    <ul>
      <li><strong>Export</strong> from <em>Settings → Backup</em> produces a single encrypted file you keep somewhere safe. The header shows how long since your last backup, and a banner reminds you when it's overdue.</li>
      <li><strong>Restore</strong> on any device with the same file and its passphrase. Choose <em>Replace</em> (start fresh from the backup) or <em>Merge</em> (combine with what's here — newer records win, and your saved phrases and custom tags come along).</li>
    </ul>
  </section>

  <section class="card" id="progress">
    <h2>Progress reports</h2>
    <p>
      Open a client's <em>Progress</em> view for a per-goal chart of accuracy over time with the
      target line drawn in, and a date-range filter. <em>Copy progress summary</em> produces a
      plain-text paragraph per goal — ready to paste into a progress report or IEP.
    </p>
  </section>

  <section class="card" id="privacy">
    <h2>Privacy &amp; security</h2>
    <p>This tool holds therapy data, so it is private by design:</p>
    <ul>
      <li><strong>Encrypted on your device.</strong> Every record is encrypted with AES-GCM. The key is derived from your passphrase with PBKDF2 (310,000 iterations); the passphrase and key are never stored anywhere.</li>
      <li><strong>Nothing leaves this device.</strong> There are no servers, no accounts, no analytics, no telemetry, and no fonts or scripts loaded from the internet. Nothing you enter is ever transmitted.</li>
      <li><strong>Offline after first load.</strong> The app is downloaded once as static files and then runs entirely offline.</li>
      <li><strong>De-identified by design.</strong> Clients are identified only by initials or short codes — there are no fields for names, dates of birth, or school names.</li>
      <li><strong>Your passphrase cannot be recovered.</strong> If you forget it, the data is permanently unreadable. There is no reset. Keep backups.</li>
      <li><strong>Backups are yours.</strong> A backup is an encrypted file that only your passphrase can open; you decide where it lives.</li>
      <li><strong>The contact link</strong> below opens your own email app — the app never sends anything on its own.</li>
    </ul>
  </section>

  <section class="card" id="why">
    <h2>Why this exists</h2>
    <!-- DRAFT — edit this in your own voice. -->
    <p>
      SOAP Note Builder was made for school-based speech-language pathologists who deserve to
      spend their energy on students, not paperwork. Session notes usually mean either scribbling
      during therapy or rebuilding everything from memory afterward — and most digital tools want
      to put sensitive student data on someone else's cloud.
    </p>
    <p>
      We wanted the opposite: a fast, calm tool that captures real session data as it happens,
      turns it into a clean SOAP note in seconds, runs on the modest hardware schools actually
      have, works without internet, and keeps every bit of student information encrypted on the
      clinician's own device. Nothing to log into, nothing to leak, nothing between you and the
      work.
    </p>
  </section>

  <section class="card" id="built">
    <h2>How it was built</h2>
    <p>
      This app was built by <strong>Harmonic Systems</strong> with the help of AI coding tools
      (Anthropic's Claude) used as a <em>development assistant</em> — to write, review, and test
      the code during development.
    </p>
    <p>
      <strong>The finished app contains no AI and no machine learning.</strong> Every goal
      template, phrase suggestion, and generated SOAP note is produced by plain, deterministic
      text assembly from your own data and your own phrase banks — the same input always produces
      the same output. You can read exactly how each sentence is formed.
    </p>
    <p>
      <strong>Nothing you type is ever sent to an AI service, a language model, or any server.</strong>
      There is no network connection carrying your data, by design. The AI helped <em>make</em>
      the tool; it is not <em>inside</em> the tool.
    </p>
  </section>

  <section class="card" id="contact">
    <h2>Contact</h2>
    <p>
      Questions, ideas, or feedback — especially how it's working in real sessions — are always
      welcome:
    </p>
    <p>
      <a href="mailto:harmonicsystemsio@gmail.com">harmonicsystemsio@gmail.com</a>
    </p>
  </section>
</div>
