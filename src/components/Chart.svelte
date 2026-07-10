<script>
  // Per-goal accuracy line chart, hand-rolled SVG instead of uPlot: the data
  // is small (tens of points), which keeps the bundle well under budget with
  // zero dependencies (spec §1 allows this substitution).
  import { fmtDate } from '../lib/text.js'

  let { points = [], target = null } = $props()

  const W = 640
  const H = 220
  const PAD = { l: 38, r: 14, t: 12, b: 26 }
  const iw = W - PAD.l - PAD.r
  const ih = H - PAD.t - PAD.b

  function x(i) {
    return points.length === 1 ? PAD.l + iw / 2 : PAD.l + (i / (points.length - 1)) * iw
  }
  function y(pct) {
    return PAD.t + (1 - pct / 100) * ih
  }

  const linePath = $derived(
    points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.pct).toFixed(1)}`).join(' ')
  )

  // Cue level shown as point styling (spec §5.6).
  const GRID = [0, 25, 50, 75, 100]
</script>

<svg viewBox="0 0 {W} {H}" class="chart-svg" role="img" aria-label="Accuracy over sessions">
  {#each GRID as g}
    <line x1={PAD.l} y1={y(g)} x2={W - PAD.r} y2={y(g)} stroke="var(--line)" stroke-width="1" />
    <text x={PAD.l - 6} y={y(g) + 4} text-anchor="end" font-size="10" fill="var(--muted)">
      {g}
    </text>
  {/each}

  {#if target != null}
    <line
      x1={PAD.l}
      y1={y(target)}
      x2={W - PAD.r}
      y2={y(target)}
      stroke="var(--good)"
      stroke-width="1.5"
      stroke-dasharray="6 4"
    />
    <text x={W - PAD.r} y={y(target) - 4} text-anchor="end" font-size="10" fill="var(--good)">
      target {target}%
    </text>
  {/if}

  {#if points.length > 1}
    <path d={linePath} fill="none" stroke="var(--accent)" stroke-width="2" />
  {/if}

  {#each points as p, i}
    {#if p.cueLevel === 'independent'}
      <circle cx={x(i)} cy={y(p.pct)} r="5" fill="var(--accent)">
        <title>{fmtDate(p.date)} — {p.pct}% (independent)</title>
      </circle>
    {:else if p.cueLevel === 'minimal'}
      <circle cx={x(i)} cy={y(p.pct)} r="5" fill="var(--surface)" stroke="var(--accent)" stroke-width="2">
        <title>{fmtDate(p.date)} — {p.pct}% (minimal cues)</title>
      </circle>
    {:else if p.cueLevel === 'moderate'}
      <path
        d="M {x(i)} {y(p.pct) - 6} L {x(i) + 5.5} {y(p.pct) + 4.5} L {x(i) - 5.5} {y(p.pct) + 4.5} Z"
        fill="var(--accent)"
      >
        <title>{fmtDate(p.date)} — {p.pct}% (moderate cues)</title>
      </path>
    {:else}
      <rect x={x(i) - 4.5} y={y(p.pct) - 4.5} width="9" height="9" fill="var(--accent)">
        <title>{fmtDate(p.date)} — {p.pct}% (maximal cues)</title>
      </rect>
    {/if}
  {/each}

  {#if points.length}
    <text x={PAD.l} y={H - 8} font-size="10" fill="var(--muted)">{fmtDate(points[0].date)}</text>
    {#if points.length > 1}
      <text x={W - PAD.r} y={H - 8} text-anchor="end" font-size="10" fill="var(--muted)">
        {fmtDate(points[points.length - 1].date)}
      </text>
    {/if}
  {/if}
</svg>

<div class="legend">
  <span><span class="swatch">●</span>independent</span>
  <span><span class="swatch">○</span>minimal</span>
  <span><span class="swatch">▲</span>moderate</span>
  <span><span class="swatch">■</span>maximal</span>
</div>
