# ds-starter

A **starter design system scaffold** for designers learning to translate Figma into React components. It runs Storybook out of the box, consumes design tokens from multiple Figma pipelines, and publishes as a private npm package on GitHub Packages.

## Tech stack

- **TypeScript** — types over everything.
- **React 19** — component runtime.
- **Vite 8** — dev + library build.
- **Storybook 10** (`@storybook/react-vite`) — component workshop.
- **Style Dictionary 5** — compiles design tokens to CSS vars + TS constants.
- **Vitest** + **@testing-library/react** — unit tests.
- **ESLint** (flat config) + **Prettier** — lint + format.
- **Changesets** — version bumps + CHANGELOG.
- **pnpm** — package manager.

## Quick start

```bash
# 1. Install Node 22 (see .nvmrc) and pnpm
# 2. Install dependencies
pnpm install

# 3. Build tokens and launch Storybook
pnpm dev           # http://localhost:6060
```

## Repo layout

```
ds-starter/
├── .changeset/                     # pending version bumps
├── .github/workflows/              # CI + release + publish
├── .storybook/                     # Storybook config
└── src/
    ├── tokens/
    │   ├── source/                 # 📥 JSON token drop zone (Figma MCP, Tokens Studio, DTCG)
    │   └── raw/                    # 📥 CSS/SCSS drop zone (Tokens SOT plugin)
    ├── components/
    │   ├── atoms/                  # Button, Input, Icon…
    │   ├── molecules/              # SearchField, FormField…
    │   └── organisms/              # Header, Modal, DataTable…
    ├── assets/
    │   ├── icons/                  # 📥 SVG icons
    │   ├── illustrations/          # 📥 narrative artwork
    │   ├── images/                 # 📥 photography / raster
    │   ├── logos/                  # 📥 brand marks
    │   └── fonts/                  # 📥 web fonts
    ├── styles/
    │   ├── global.css              # resets + @imports tokens
    │   ├── tokens.css              # (generated) CSS custom properties
    │   └── tokens.ts               # (generated) TS constants
    └── index.ts                    # library entry
```

## Adding design tokens

Two **mutually exclusive** token pipelines are supported. Pick one — using both at the same time leads to conflicting CSS variables and confusing cascade order. The repo ships with **Tokens SOT** active by default; switch with `pnpm tokens:switch sd` if you'd rather use Style Dictionary.

| From Figma                                           | Drop location        | Built by         | Mode  |
| ---------------------------------------------------- | -------------------- | ---------------- | ----- |
| **Figma REST API / MCP / Tokens Studio plugin** → JSON | `src/tokens/source/` | Style Dictionary | `sd`  |
| **Tokens SOT** plugin → CSS/SCSS                     | `src/tokens/raw/`    | imported as-is   | `sot` |

### Style Dictionary mode (`sd`)

Drop DTCG / Tokens Studio JSON into `src/tokens/source/`, then:

```bash
pnpm tokens:build    # one-shot
pnpm tokens:watch    # re-build on change
```

Outputs are written to `src/styles/tokens.css` + `src/styles/tokens.ts` + `src/styles/typography.css` and imported by `global.css`. The seed file `src/tokens/source/core.tokens.json` shows the DTCG format.

### Tokens SOT mode (`sot`)

Drop the CSS files exported by the Tokens SOT Figma plugin into `src/tokens/raw/`, then update the `@import` list in [`src/styles/global.css`](src/styles/global.css) to match the filenames you exported.

Run `pnpm tokens:sync` after every re-export. It does two things:

1. **`scripts/wrap-theme.mjs`** rewrites `theme-light.css` / `theme-dark.css` from `src/tokens/raw/` into `src/styles/generated/` so they apply via `[data-theme="…"]` (with `prefers-color-scheme` as fallback) instead of unconditionally hitting `:root`. Without this step the dark file would always win the cascade.
2. **`scripts/build-token-stories.mjs`** introspects the raw files to regenerate the token-reference Storybook MDX under `src/docs/foundations/`.

### Switching token pipeline

```bash
pnpm tokens:switch sd     # activate Style Dictionary
pnpm tokens:switch sot    # activate Tokens SOT
```

The script:

1. Toggles which `@import` block is active inside [`src/styles/global.css`](src/styles/global.css) (the inactive branch is left commented, not deleted).
2. Moves the **unused** pipeline's files (`src/tokens/source/` or `src/tokens/raw/` and any generated CSS/TS) into `.token-pipeline-backup/<mode>/` so nothing is destroyed.
3. Restores files from `.token-pipeline-backup/<mode>/` if you switch back.

Once you're confident you won't need the other pipeline, delete `.token-pipeline-backup/` to clean up.

### Extract tokens from a Figma file

`pnpm tokens:extract` runs an interactive CLI that pulls Variables and Styles
from any Figma file via the REST API and writes a single DTCG JSON file with
aliases preserved and modes encoded under `$extensions.modes`.

```bash
pnpm tokens:extract
```

You'll be prompted for:

1. A **Figma personal access token** — generate at
   <https://www.figma.com/settings> with scopes **File content (Read)** and
   **Variables (Read)**. Set it as `FIGMA_TOKEN` in your environment or accept
   the offer to save it to `.env.local` (gitignored).
2. A **Figma file URL or key**.
3. The **collections / style groups** you want to export (multi-select).
4. The **output path** (defaults to `src/tokens/source/figma.tokens.json`).

> **Note:** the Variables endpoint requires a **Figma Enterprise** plan. On
> Free / Pro plans the script falls back to extracting Local Styles only.

## Adding a component

```bash
src/components/atoms/MyButton/
├── MyButton.tsx
├── MyButton.module.css       # use var(--…) tokens, no hard-coded values
├── MyButton.stories.tsx
├── MyButton.test.tsx
└── index.ts                  # export { MyButton } from './MyButton';
```

Then re-export from `src/index.ts` so it's part of the public API.

## Scripts

| Command                 | What it does                                                                      |
| ----------------------- | --------------------------------------------------------------------------------- |
| `pnpm dev`              | `tokens:sync` + Storybook at `:6060`.                                             |
| `pnpm tokens:build`     | Compile DTCG JSON → `tokens.css` + `tokens.ts` + `typography.css` (`sd` mode).    |
| `pnpm tokens:watch`     | Watch `src/tokens/source/` and rebuild (`sd` mode).                               |
| `pnpm tokens:sync`      | `wrap-theme.mjs` + `build-token-stories.mjs` (`sot` mode — run after re-export).  |
| `pnpm tokens:stories`   | Regenerate the token-reference MDX under `src/docs/foundations/`.                 |
| `pnpm tokens:extract`   | Pull tokens from a Figma file via the REST API → DTCG JSON.                       |
| `pnpm tokens:switch`    | Toggle between `sd` and `sot` pipelines.                                          |
| `pnpm build`            | Build the library (ESM + types) into `dist/`.                                     |
| `pnpm build:storybook`  | Static Storybook into `storybook-static/`.                                        |
| `pnpm typecheck`        | `tsc --noEmit`.                                                                   |
| `pnpm lint`             | ESLint + Stylelint (enforces semantic-token-only CSS).                            |
| `pnpm lint:css`         | Stylelint only — blocks `var(--palette-*)` in components.                         |
| `pnpm format`           | Prettier write.                                                                   |
| `pnpm test`             | Vitest (jsdom).                                                                   |
| `pnpm changeset`        | Record a version bump for your PR.                                                |
| `pnpm release`          | Build + publish to GitHub Packages (used by CI, not locally).                     |

## Publishing to GitHub Packages

This repo is pre-wired to publish a private package to GitHub Packages.

### One-time setup

1. Create a GitHub repo (public or private) and push this codebase to it.
2. In `package.json`, change `"name": "ds-starter"` to `"@YOUR-ORG/ds-starter"` (must be scoped to match the owner of the package registry).
3. In `.npmrc`, replace `@OWNER` with your scope (e.g. `@your-org`).
4. (Optional) Flip `"private": true` → `"private": false` in `package.json` when you're ready to publish.

### Release flow

1. Open PRs that each include a changeset (`pnpm changeset`).
2. Merge PRs into `main`. The `release.yml` workflow opens a **"Version Packages"** PR that aggregates pending changesets.
3. Merge the Version Packages PR. A GitHub release is created automatically.
4. The `publish.yml` workflow runs on release and pushes the package to `https://npm.pkg.github.com`.

### Consuming the package

In the consuming project's `.npmrc`:

```
@YOUR-ORG:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

Then `pnpm add @YOUR-ORG/ds-starter` (auth token must have `read:packages` scope).

Import:

```ts
import '@YOUR-ORG/ds-starter/styles/global.css';
// import { MyButton } from '@YOUR-ORG/ds-starter';
```

## Token tiers (read this before writing component CSS)

Tokens are **two-tiered**, and components must consume the public tier only:

- **Primitives** (`--palette-*`) live in `src/tokens/raw/primitives.css`. Their **only** purpose is to feed semantic tokens inside `theme-light.css` / `theme-dark.css`. Do **not** reference `--palette-*` from component CSS.
- **Semantic tokens** (`--color-*`, `--accent-*`, `--space-*`, `--radius-*`, …) are the public API. Components consume these.
- If no semantic token fits, **propose a new semantic token** in both `theme-light.css` and `theme-dark.css` (aliasing a primitive) — don't reach into the primitive directly, or dark mode will silently break.

This is enforced by `pnpm lint:css`. Reaching for `var(--palette-*)` outside the allowed files fails CI.

## Notes for the workshop

- **No example stories ship.** Teammates will add their own under each component folder.
- **Atomic design taxonomy.** `atoms → molecules → organisms` mirrors the Figma library structure.
- **CSS Modules.** Styles are plain CSS scoped per-component. Consume tokens via `var(--…)` — never hard-coded values.
- **Theming.** Toggle modes by setting `data-theme="light"` / `data-theme="dark"` on `<html>` (or any ancestor). With no attribute set, `prefers-color-scheme` decides.
