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
pnpm dev           # http://localhost:6006
```

## Repo layout

```
ds-starter/
├── .changeset/                     # pending version bumps
├── .github/workflows/              # CI + release + publish
├── .storybook/                     # Storybook config
└── src/
    ├── foundations/
    │   ├── tokens/
    │   │   ├── source/             # 📥 JSON token drop zone (Figma MCP, Tokens Studio, DTCG)
    │   │   └── raw/                # 📥 CSS/SCSS drop zone (Tokens SOT plugin)
    │   ├── color/                  # color-specific helpers
    │   ├── typography/
    │   └── spacing/
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

Three supported pipelines, all landing in `src/styles/tokens.css` / `tokens.ts`:

| From Figma                       | Drop location                    | Built by         |
| -------------------------------- | -------------------------------- | ---------------- |
| **Figma MCP** → JSON             | `src/foundations/tokens/source/` | Style Dictionary |
| **Tokens Studio** plugin → JSON  | `src/foundations/tokens/source/` | Style Dictionary |
| **Tokens SOT** plugin → CSS/SCSS | `src/foundations/tokens/raw/`    | imported as-is   |

Then run:

```bash
pnpm tokens:build    # one-shot
pnpm tokens:watch    # re-build on change
```

The seed file `src/foundations/tokens/source/core.tokens.json` shows the DTCG
format. Replace or extend it with your real tokens.

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

| Command                | What it does                                                  |
| ---------------------- | ------------------------------------------------------------- |
| `pnpm dev`             | Build tokens, run Storybook at `:6006`.                       |
| `pnpm tokens:build`    | Compile DTCG JSON → `tokens.css` + `tokens.ts`.               |
| `pnpm tokens:watch`    | Watch mode for token authoring.                               |
| `pnpm build`           | Build the library (ESM + types) into `dist/`.                 |
| `pnpm build:storybook` | Static Storybook into `storybook-static/`.                    |
| `pnpm typecheck`       | `tsc --noEmit`.                                               |
| `pnpm lint`            | ESLint.                                                       |
| `pnpm format`          | Prettier write.                                               |
| `pnpm test`            | Vitest (jsdom).                                               |
| `pnpm changeset`       | Record a version bump for your PR.                            |
| `pnpm release`         | Build + publish to GitHub Packages (used by CI, not locally). |

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

## Notes for the workshop

- **No example stories ship.** Teammates will add their own under each component folder.
- **Atomic design taxonomy.** `atoms → molecules → organisms` mirrors the Figma library structure.
- **CSS Modules.** Styles are plain CSS scoped per-component. Consume tokens via `var(--…)` — never hard-coded values.
