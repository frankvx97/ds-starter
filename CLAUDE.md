# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Design System Usage Rules

> [!IMPORTANT]
> Always follow the rules below, do not skip or ignore them by any means.

1. When the user ask you to build a prototype, whether is from the codebase only or from a Figma mockup, inspect your component inventory first to check for available components. If a component from the mockup or the screenshot reference is not available, prompt the user if they want you to create it or build the dependency component first. The idea is to not waste tokens by reworking components that already exist in the DS codebase.

2. Never use hardcoded/raw values. Always call for the CSS variables available, if the Figma mockup doesn't have variables or styles attached, find the closest match in the codebase, use them instead and at the end of the session call them out for the user, so they can either update their figmas, create missing variables/styles, or create custom utility classes for an specific case only, the latter should be the exception, not the rule.

3. **Tokens have two tiers — components must consume semantic tokens only.**
   - **Primitives** (`--palette-*`) live in `src/tokens/raw/primitives.css`. They are raw color values whose **only** purpose is to feed semantic tokens inside `src/tokens/raw/theme-light.css` and `theme-dark.css`. Do not reference `--palette-*` from component CSS, stories, or anywhere else outside `theme-*.css` / `docs-*.css`.
   - **Semantic tokens** (`--accent-*`, `--default-*`, `--success-*`, `--color-*`, `--space-*`, `--radius-*`, etc.) are the public API. Components consume these.
   - If no semantic token fits a design need, **propose a new semantic token** in `theme-light.css` + `theme-dark.css` (aliasing a primitive). Do not reach into the primitive directly as a workaround — it bypasses theming and silently breaks dark mode.
   - This is enforced by `stylelint` (`pnpm lint:css`). A PR using `var(--palette-*)` outside the allowed files will fail CI.

## Commands

```bash
pnpm dev               # tokens:sync + Storybook at :6060
pnpm build             # tokens:build + Vite library build → dist/
pnpm build:storybook   # static Storybook → storybook-static/

# Tokens (see Token pipeline below)
pnpm tokens:build      # compile src/tokens/source/*.tokens.json → src/styles/tokens.css + tokens.ts + typography.css
pnpm tokens:watch      # watch src/tokens/source for changes
pnpm tokens:stories    # regenerate token-reference Storybook MDX from raw CSS
pnpm tokens:sync       # wrap-theme.mjs + tokens:stories (run before Storybook)
pnpm tokens:extract    # pull tokens from Figma (figma-extract.mjs)
pnpm tokens:switch     # switch between Style Dictionary and raw-CSS pipelines

# QA
pnpm typecheck         # tsc --noEmit
pnpm lint              # ESLint + stylelint (lint:css)
pnpm lint:fix          # both with --fix
pnpm lint:css          # stylelint only — enforces the two-tier token contract
pnpm format            # Prettier write
pnpm test              # Vitest (jsdom, single run, --passWithNoTests)
pnpm test:watch        # Vitest watch

# Release
pnpm changeset         # author a changeset
pnpm version           # apply changesets, bump versions
pnpm release           # build + changeset publish
```

Run a single test file:

```bash
pnpm vitest run src/components/atoms/Button/Button.test.tsx
```

## Architecture

This is a **React component library** built with Vite in library mode. It publishes a single ESM bundle (`dist/index.js`) plus a type declaration rollup (`dist/index.d.ts`). React and react-dom are peer deps and are excluded from the bundle.

### Token pipeline

Design tokens flow through two separate paths:

1. **Style Dictionary path** — DTCG/Tokens Studio JSON files dropped in `src/tokens/source/` are compiled by `scripts/build-tokens.mjs` into:
   - `src/styles/tokens.css` — CSS custom properties for every non-typography token (color, spacing, radius, etc.).
   - `src/styles/tokens.ts` — TS constants mirroring `tokens.css`.
   - `src/styles/typography.css` — utility classes for every `$type: "typography"` composite (e.g. `.text-styles-heading-1`). Typography composites bypass Style Dictionary because the CSS `font` shorthand can't carry `letter-spacing` and chokes on word-form weights; the build script expands each composite to a full ruleset and converts named weights ("Extra Bold") to numeric (`800`).

   All three generated files are gitignored-safe and linted-ignored — do not edit them directly.

2. **Raw CSS path** — CSS/SCSS from the Tokens SOT Figma plugin is dropped in `src/tokens/raw/` and imported as-is via `src/styles/global.css`. It bypasses Style Dictionary entirely. `scripts/wrap-theme.mjs` post-processes `theme-light.css` / `theme-dark.css` so they apply via `[data-theme="…"]` selectors instead of `:root`. `scripts/build-token-stories.mjs` introspects the raw files to (re)generate the token-reference MDX under `src/docs/foundations/`.

The two pipelines are interchangeable for the consumer-facing `var(--…)` API — `pnpm tokens:switch` toggles which one is active. Components don't need to know which is in use.

### Component structure

Follows atomic design: `atoms → molecules → organisms`. Each component lives in its own folder:

```
src/components/atoms/MyComponent/
├── MyComponent.tsx
├── MyComponent.module.css   # use var(--…) tokens only, no hard-coded values
├── MyComponent.stories.tsx
├── MyComponent.test.tsx
└── index.ts
```

New components must be re-exported from `src/index.ts` to be part of the public API. `src/index.ts` and `src/tokens/index.ts` currently ship as empty barrels (`export {}`) — uncomment / add re-exports as components and the generated `src/styles/tokens.ts` come online.

Storybook docs (MDX) live in `src/docs/`. The `foundations/` subtree is regenerated by `pnpm tokens:stories` and should not be hand-edited.

### Storybook

Config is in `.storybook/`. Stories are picked up from `src/**/*.stories.@(ts|tsx|js|jsx)`. The `@storybook/addon-a11y` addon is enabled — a11y passes are expected.

### Publishing

Uses Changesets for versioning. Package publishes to GitHub Packages (private registry). The `publishConfig` registry and `.npmrc` scope (`@OWNER`) must be updated to match the GitHub org before publishing.

## Key conventions

- **CSS Modules** — all component styles use `.module.css`. Never use hard-coded color, spacing, or typography values; reference a `var(--…)` token, or for typography `composes: text-styles-… from global;`.
- **Typography** — apply via `composes: text-styles-<name> from global;` on a `.module.css` class (the typography utility classes are emitted into the global stylesheet by `pnpm tokens:build`). Don't try to recreate typography composites with individual `var(--…)` declarations.
- **Generated files** — `src/styles/tokens.css`, `src/styles/tokens.ts`, and `src/styles/typography.css` are generated by `pnpm tokens:build` and excluded from ESLint. Do not edit them manually.
- **`src/tokens/source/core.tokens.json`** — seed file showing DTCG format; replace or extend with real tokens.
- **ESLint flat config** — configured in `eslint.config.mjs` with `typescript-eslint`, `react-hooks`, and `storybook` plugins.

## Key Technologies

- **React 19.2.1** with **React Aria Components** for accessible UI primitives
- **Style Dictionary** + **@tokens-studio/sd-transforms** for token generation
- **Storybook 10** for documentation and component development
- **Vite** + **TypeScript** (strict mode)
- **Vitest** + **Playwright** for testing

## Asset Dependencies

### Icons

Gravity UI Icons (https://github.com/gravity-ui/icons) — prefer the package over individual SVG exports.

### Fonts

Inter (`src/assets/fonts/Inter-*.woff2`, weights 400/500/600/700/800), self-hosted and loaded via `src/styles/global.css`.
