<script>
  import { demoDirty, demoGuideStep, hasVault, resetDemo, exitDemo } from '../lib/repo.js'
  import { navigate } from '../lib/router.js'

  async function reset() {
    if ($demoDirty && !confirm('Reset every change made in this demo and restore the fictional caseload?')) {
      return
    }
    await resetDemo()
    navigate('guide/1', 'demo')
  }

  function goPrivate() {
    exitDemo()
    navigate($hasVault === null ? '' : $hasVault ? 'unlock' : 'create', 'public')
  }
</script>

<aside class="demo-banner no-print" aria-label="Demo status">
  <div>
    <strong>DEMO — FICTIONAL DATA</strong>
    <span>Changes are temporary and reset when you leave. Do not enter real student information.</span>
  </div>
  <div class="demo-actions">
    <button onclick={() => navigate(`guide/${$demoGuideStep}`, 'demo')}>
      Guide step {$demoGuideStep}
    </button>
    <button class="btn-quiet" onclick={reset}>Reset demo</button>
    <button onclick={goPrivate}>
      {$hasVault === null
        ? 'Go to private workspace'
        : $hasVault
          ? 'Unlock private workspace'
          : 'Create private workspace'}
    </button>
  </div>
</aside>
