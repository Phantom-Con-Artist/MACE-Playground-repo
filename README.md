# MACE Playground — Desmos-style Graphing Calculator

A Desmos-style graphing calculator web app, built end to end by a MACE agent team.

Type several expressions (`y = sin(x)`, `x^2 + y^2 = 25`, `y = a*x + b`), each draws
on one shared graph in its own color. Pan and zoom with readable grid and axis
labels. Free variables like `a` or `b` get sliders. Bad input shows a clear
error without breaking the page.

## Prerequisites

- Node.js 20+ and npm 10+

## Run it

```sh
npm install
npm run dev
```

Open the printed local URL (default `http://localhost:5173`).

## Tests

```sh
npm test
```

Runs the automated math parsing and evaluation tests.

## Build

```sh
npm run build
npm run preview
```

## Project layout (to be finalized on integration)

- `src/math/` — `parseExpression` / `evaluate` plus automated tests
- `src/graph/` — React graph canvas, pan/zoom, grid and labels
- `src/state/` — graph rows `{id, expression, color, visible}`, sliders, errors
- `src/ui/` — layout and styling

## Troubleshooting

- Port in use: run `npm run dev -- --port 5174`.
- Clean reinstall: `rm -rf node_modules package-lock.json && npm install`.
