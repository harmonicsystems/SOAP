<script>
  import { tick } from 'svelte'
  import { demoGuideStep, hasVault } from '../lib/repo.js'
  import { hrefFor, navigate } from '../lib/router.js'
  import { DEMO_GUIDE_TARGETS } from '../lib/sampleData.js'
  import Caseload from './Caseload.svelte'
  import ClientDetail from './ClientDetail.svelte'
  import Progress from './Progress.svelte'
  import SessionScreen from './SessionScreen.svelte'
  import NoteOutput from './NoteOutput.svelte'
  import GroupSession from './GroupSession.svelte'

  let { step = '1' } = $props()
  let heading

  const stepNumber = $derived(Math.min(6, Math.max(1, Number.parseInt(step, 10) || 1)))
  const steps = [
    {
      eyebrow: 'Step 1 of 6 · Caseload',
      title: 'See a trimester at a glance',
      copy: 'These 25 fictional student codes cover January through early April. Search the list or scan active goals and recent service dates; Explore freely keeps a return path to this step.'
    },
    {
      eyebrow: 'Step 2 of 6 · Student record',
      title: 'Goals and sessions stay together',
      copy: 'This is a real student-detail screen. Goals, status, quick trend lines, and every individual or group session are collected in one place.'
    },
    {
      eyebrow: 'Step 3 of 6 · Longitudinal progress',
      title: 'Progress is not always a straight line',
      copy: 'MEP is intentionally plateauing. The graph stays honest about variable performance instead of implying that therapy always produces steady gains.'
    },
    {
      eyebrow: 'Step 4 of 6 · Live note builder',
      title: 'Capture what happened during the session',
      copy: 'Try this real draft: tap correct or incorrect trials, adjust cues, add observations, and watch the Objective section update deterministically.'
    },
    {
      eyebrow: 'Step 5 of 6 · Finished note',
      title: 'Copy a clean note into your EMR',
      copy: 'The same structured session data becomes plain, predictable SOAP text. The shipped app uses templates and rules—never AI or a network service.'
    },
    {
      eyebrow: 'Step 6 of 6 · Group workflow',
      title: 'One group surface, one note per student',
      copy: 'Switch between students without duplicating the group setup. Each fictional student still keeps an independent session record and note.'
    }
  ]

  const current = $derived(steps[stepNumber - 1])
  const targetNames = [
    'caseload-list',
    'student-goals',
    'progress-chart',
    'trial-card',
    'note-output',
    'group-switcher'
  ]

  $effect(() => {
    stepNumber
    demoGuideStep.set(stepNumber)
    tick().then(() => heading?.focus())
  })

  function go(nextStep) {
    navigate(`guide/${nextStep}`, 'demo')
  }

  function showTarget() {
    const target = document.querySelector(
      `.guide-screen [data-guide-target="${targetNames[stepNumber - 1]}"]`
    )
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    target?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' })
  }
</script>

<section class="guide-panel card" aria-labelledby="guide-title">
  <p class="eyebrow">{current.eyebrow}</p>
  <h1 id="guide-title" bind:this={heading} tabindex="-1">{current.title}</h1>
  <p>{current.copy}</p>
  <div class="guide-nav">
    {#if stepNumber > 1}<button onclick={() => go(stepNumber - 1)}>← Step {stepNumber - 1}</button>{/if}
    <button onclick={showTarget}>Show highlighted area</button>
    <a href={hrefFor('clients', 'demo')}>Explore freely</a>
    {#if stepNumber < 6}
      <button class="btn-primary right" onclick={() => go(stepNumber + 1)}>Step {stepNumber + 1} →</button>
    {:else if $hasVault !== null}
      <a
        class="button-link btn-primary right"
        href={hrefFor($hasVault ? 'unlock' : 'create', 'public')}
      >
        {$hasVault ? 'Unlock private workspace' : 'Create private workspace'}
      </a>
      <a href={hrefFor('', 'public')}>Return to welcome</a>
    {:else}
      <a class="button-link btn-primary right" href={hrefFor('', 'public')}>
        Go to private workspace
      </a>
      <a href={hrefFor('', 'public')}>Return to welcome</a>
    {/if}
  </div>
</section>

<div class={`guide-screen guide-step-${stepNumber}`}>
  {#if stepNumber === 1}
    <Caseload />
  {:else if stepNumber === 2}
    <ClientDetail id={DEMO_GUIDE_TARGETS.clientId} />
  {:else if stepNumber === 3}
    <Progress id={DEMO_GUIDE_TARGETS.progressClientId} />
  {:else if stepNumber === 4}
    <SessionScreen id={DEMO_GUIDE_TARGETS.draftSessionId} />
  {:else if stepNumber === 5}
    <NoteOutput id={DEMO_GUIDE_TARGETS.noteSessionId} />
  {:else}
    <GroupSession groupId={DEMO_GUIDE_TARGETS.groupId} />
  {/if}
</div>
