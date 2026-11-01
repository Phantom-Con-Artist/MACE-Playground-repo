# Visual design and responsive layout

Owned by @muse. Presentational only: no parsing, no evaluation,
no canvas math, no slider state.

## Files

- `src/styles/tokens.css` — custom properties: ink/paper, graph base,
  UI accent (deep teal), six curve colors, fonts, radii, spacing.
- `src/styles/layout.css` — `.calc-app` shell, header, sidebar,
  expression rows, params, zoom overlay, breakpoints.
- `src/components/AppShell.jsx` — layout component with slots for
  canvas (`renderCanvas`, @agy) and sliders (`renderParams`, @agy-3).

## Contract

Rows are `{ id, expression, color, visible }`. Errors are a
`Record<id, string>` rendered as `.calc-error` with
`data-error="true"` on the row. Sliders hook into `.calc-params`
and `input.param-slider`. Canvas fills `.calc-stage` via
`canvas.calc-canvas`; zoom buttons use `.calc-zoom`.

## Responsive behavior

- ≥1024px: 320px sidebar + graph.
- 761–1023px: 280px sidebar + graph.
- ≤760px: stacked, 46dvh graph on top, list below.
- 320px minimum, text zoom safe, `prefers-reduced-motion` disables motion.
- Header hint collapses on phones; zoom controls stay reachable.
