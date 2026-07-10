<script>
  // Mini accuracy trend (last 8 data points), hand-rolled SVG.
  let { points = [] } = $props()

  const recent = $derived(points.slice(-8))
  const W = 80
  const H = 24
  const path = $derived.by(() => {
    if (recent.length < 2) return ''
    return recent
      .map((p, i) => {
        const x = (i / (recent.length - 1)) * (W - 6) + 3
        const y = H - 3 - (p / 100) * (H - 6)
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(' ')
  })
  const last = $derived(recent.length ? recent[recent.length - 1] : null)
</script>

{#if recent.length >= 2}
  <svg width={W} height={H} aria-label="Recent accuracy trend" role="img">
    <path d={path} fill="none" stroke="var(--accent)" stroke-width="1.5" />
    <circle
      cx={W - 3}
      cy={H - 3 - (last / 100) * (H - 6)}
      r="2.5"
      fill="var(--accent)"
    />
  </svg>
{:else if recent.length === 1}
  <span class="muted" style="font-size:0.8rem">{last}%</span>
{:else}
  <span class="muted" style="font-size:0.8rem">—</span>
{/if}
