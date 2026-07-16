<script>
  import { route, hrefFor } from '../lib/router.js'
  import Header from './Header.svelte'
  import BackupBanner from './BackupBanner.svelte'
  import DemoBanner from './DemoBanner.svelte'
  import Caseload from './Caseload.svelte'
  import ClientDetail from './ClientDetail.svelte'
  import SessionScreen from './SessionScreen.svelte'
  import NoteOutput from './NoteOutput.svelte'
  import Progress from './Progress.svelte'
  import Settings from './Settings.svelte'
  import Help from './Help.svelte'
  import GroupSession from './GroupSession.svelte'
  import DemoGuide from './DemoGuide.svelte'

  let { demo = false } = $props()
</script>

<Header {demo} />
{#if demo}<DemoBanner />{:else}<BackupBanner />{/if}

<main class="container">
  {#if $route.name === 'clients'}
    <Caseload />
  {:else if $route.name === 'client'}
    <ClientDetail id={$route.params.id} />
  {:else if $route.name === 'progress'}
    <Progress id={$route.params.id} />
  {:else if $route.name === 'session'}
    <SessionScreen id={$route.params.id} />
  {:else if $route.name === 'group'}
    <GroupSession groupId={$route.params.groupId} />
  {:else if $route.name === 'note'}
    <NoteOutput id={$route.params.id} />
  {:else if $route.name === 'settings' && !demo}
    <Settings />
  {:else if $route.name === 'help'}
    <Help />
  {:else if $route.name === 'guide' && demo}
    <DemoGuide step={$route.params.step} />
  {:else}
    <div class="card">
      <h1>Page not found</h1>
      <a href={hrefFor('clients', demo ? 'demo' : 'private')}>Back to caseload</a>
    </div>
  {/if}
</main>
