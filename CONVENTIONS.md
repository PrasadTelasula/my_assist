# Conventions

Rules for this codebase. The mechanical ones are enforced by tooling (ESLint,
knip, CI); the rest are enforced in review. When a rule and pragmatism clash,
change the rule deliberately — don't quietly violate it.

## Architecture

- **One-way dependency flow** (lint-enforced): `src/core` imports nothing from
  the app — no next, react, drizzle, or `src/server`. `src/server` may import
  `src/core`, never `src/app` or React. Route handlers in `src/app/api` are
  thin: zod-parse input → call one `src/server` function → shape the response
  (~15-line bodies).
- **Single source of truth for types**: every entity is one zod schema; types
  are `z.infer<>`. Client and server import the same schema module. No
  hand-duplicated interfaces.
- **No premature abstraction**: an interface requires a named, concrete second
  implementation (model providers; sandbox executor → container runner). No
  `BaseService`, no factories-of-factories, no config for single values.

## Code

- Extract on second use, never speculatively.
- Soft cap ~200 lines per file; a file does the one thing its name says.
- Delete, don't comment out. No dead exports (knip), no shipped TODO stubs.
- Comments state _why_ or a non-obvious constraint — never narrate the code.
- Naming voice: `getX/createX/updateX` server functions, `useX` hooks,
  `XCard/XPanel/XDrawer` components; `kebab-case.ts`, `PascalCase.tsx`.
- One error-handling shape per layer; errors are specific and actionable.
- Every dependency is load-bearing; adding one requires a reason in the
  commit message.
- No raw `fetch` in components (use the typed api client); no string-literal
  query keys (use the queryKeys factory).

## UI

- **Tokens only**: colors, radii, fonts, and shadows come from the `@theme`
  block in `globals.css`. No raw hex or default Tailwind palette classes in
  components (`bg-blue-500` fails review; `bg-accent-600` is the way).
- Type scale ≤ 5 sizes. All money, token-count, and latency figures render in
  the mono font.
- One shell: sidebar + `PageHeader` on every page. Compact density for data
  surfaces (board, runs, traces); roomy for editing surfaces.
- shadcn/ui is a base to restyle through tokens — if a screen looks like the
  shadcn docs, it isn't done.
- One component per concept: `StatusBadge` is the only way a status renders,
  `CostChip` the only way money renders.
- Every view ships with five states designed: loading, empty (with
  product-specific copy + call to action), error, partial, ideal.
- Feedback: optimistic where safe; skeletons on first load; spinners only
  inside the triggering element; motion 150–200 ms and functional only.
- Accessibility floor: WCAG AA contrast in both themes, focus rings never
  suppressed, icon-only buttons labeled, `prefers-reduced-motion` respected.

## Process

- **TDD**: the failing test comes first. New behavior lands with the test that
  demanded it in the same commit.
- Per-phase self-review before pushing: a pass over the diff hunting
  duplication, dead code, naming drift, and slop comments — plus `npm run
lint`, `npm run typecheck`, `npm run knip`, `npm test`.
