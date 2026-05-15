---
name: ds-package
description: Set up, publish, and maintain a React component library / design system as an installable npm package — to either GitHub Private Packages or the public npm registry. Use this skill whenever the user wants to publish a package, release a new version, set up package publishing, configure GitHub Packages or npm publishing, bump a version, cut a release, ship a tag, or distribute a design system to consumers. Also use it when a consumer project needs to install a private GitHub Package (PAT, .npmrc setup) or import the design system's components, tokens, fonts, or icons. Trigger on phrases like "publish my package", "release a new version", "set up publishing", "package this design system", "ship to npm", "publish to GitHub Packages", "how do I install this in another project", "/ds-package", or anything about registries, semver bumps, prepublish builds, or `.npmrc` configuration.
---

# ds-package

This skill helps a maintainer take a React component library (typically a design system built with Vite, TypeScript, and CSS Modules / SCSS) and set it up as an installable package, publish it, maintain releases over time, and onboard consumer projects.

It supports two distribution targets:

- **GitHub Private Packages** — scoped to `@<owner>/<package>`, gated by a Personal Access Token. Best when the package is internal to a team or organization and you don't want it public.
- **Public npm registry** — published to npmjs.com, installable by anyone. Best for OSS or shared community packages.

The two flows share most of the build setup but differ on registry config, authentication, and the publish step.

## When to use this skill

The user might say any of:

- "Let's publish this as a package"
- "Set up GitHub Packages for this repo"
- "How do I cut a new release?" / "Ship v1.2.0"
- "I want to use this design system in another project — how?"
- "The build is failing on publish" / "npm publish 404" / "401 Unauthorized"
- "Bump the version and push the tag"

If the project has never been published before, start with **Phase 1: First-time setup**. If `package.json` already has `publishConfig` and a barrel export, jump to **Phase 2: Publishing a release** or **Phase 3: Maintaining**. If the user is on the *consumer* side trying to install, jump to **Phase 4: Consuming the package**.

## Phase 1: First-time setup

**Read `references/pitfalls.md` first.** Most publish-day failures are not novel — they're the same handful of mistakes (absolute asset paths, un-externalized React, font-face issues, Storybook masking bugs). Front-loading the gotchas saves an entire release cycle, and several of them shape decisions made *during* setup, not after.

Before writing any config, ask the user **one question**:

> Where should this package be published?
>
> 1. **GitHub Private Packages** — installable via a GitHub Personal Access Token, scoped to `@owner/name`, kept private to your org/account.
> 2. **Public npm** — installable by anyone on npmjs.com, no auth required for consumers.

Wait for the answer before proceeding. The answer determines:

- The package `name` scope (`@owner/...` is required for GitHub; optional for npm)
- The `publishConfig.registry` value
- The `.npmrc` contents
- The GitHub Actions `registry-url` and auth token
- The instructions you'll give consumers later

Once they've chosen, read the matching reference file and apply it:

- GitHub Private Packages → `references/github-packages.md`
- Public npm → `references/npm-public.md`

Both flows share these **registry-agnostic** building blocks, which you should set up regardless:

### Shared setup checklist

1. **Barrel export** — `src/index.ts` re-exports every public component and its types. Why: lets consumers write `import { Button } from '@scope/pkg'` instead of deep paths that lock them to the file structure.

2. **TypeScript declaration build** — `tsconfig.build.json` extends the root tsconfig with `declaration: true`, `declarationMap: true`, `emitDeclarationOnly: true`, `outDir: "./dist"`, and excludes stories/tests. Why: ships `.d.ts` files so consumers get autocomplete and hover-to-source navigation.

3. **Vite library build** — `vite.config.lib.ts` with `build.lib` configured for ESM + CJS output, and `external` listing React + any peer-dep libraries (e.g. `react-aria-components`). Why: peer deps must not be bundled, or consumers will get duplicate-React bugs.

4. **`package.json` fields** — `main`, `module`, `types`, `exports`, `files`, `peerDependencies`, `publishConfig`, plus `prepublishOnly: "npm run build"`. Why: each field tells a different tool (Node ESM resolver, bundlers, TS, npm) where to find what. `prepublishOnly` is critical — it guarantees you never publish stale `dist/` output.

5. **`.gitignore`** — add `dist/` (and any other build output dirs like `build/`). Generated files shouldn't be in git.

6. **Build scripts** — `build:tokens` (if applicable), `build:lib`, and a top-level `build` that runs them in order.

For the exact contents of each file, see the registry reference (the only differences are the `name` scope, `publishConfig.registry`, and the auth bits). Shared template snippets are also in `references/shared-build-config.md`.

### Verify the build works locally

After setup, before any publish attempt:

```bash
npm run build         # or pnpm build
npm pack --dry-run    # shows exactly what will ship — review the file list
```

The dry run is the cheapest way to catch "I forgot to add `dist/` to `files`" mistakes. If the file list is missing your build output or includes source code that shouldn't ship, fix `files` in `package.json` and re-run.

## Phase 2: Publishing a release

The release flow is the same regardless of registry, with one auth difference at the very end.

1. **Make sure main is clean and built.** Don't release from a dirty working tree.
2. **Bump the version** with semver in mind:
   - `npm version patch` (1.0.0 → 1.0.1) — bug fixes, internal tweaks
   - `npm version minor` (1.0.0 → 1.1.0) — new components/features, backwards compatible
   - `npm version major` (1.0.0 → 2.0.0) — breaking changes (renamed prop, removed component, changed token name)

   This command updates `package.json`, makes a commit, and creates an annotated git tag like `v1.0.1`.

3. **Push the commit and the tag**:

   ```bash
   git push origin main
   git push origin v1.0.1   # or: git push --tags
   ```

4. **The GitHub Actions workflow takes over.** It triggers on the `v*.*.*` tag, runs `npm ci && npm run build && npm publish`, and the package is live.

   If publishing locally instead of via CI, run `npm publish` manually after the version bump. For GitHub Packages this requires `NODE_AUTH_TOKEN` in the env; for public npm this requires `npm login` to have been run.

5. **Verify** — for GitHub Packages, check the repo's "Packages" page; for npm, check `npmjs.com/package/<name>`. You can also run `npm view <name> versions` to list everything published.

If the publish fails, see the troubleshooting section in the registry-specific reference.

## Phase 3: Maintaining over time

A few things worth doing periodically:

- **CHANGELOG entries.** If using Changesets (`@changesets/cli`), the version bump is driven by changeset files instead of `npm version`. The user may already have this set up — check for `.changeset/` in the repo root before suggesting `npm version`.
- **Peer dep ranges.** When React 20 ships, you'll want to widen `peerDependencies.react` to `"^18.0.0 || ^19.0.0 || ^20.0.0"`. Don't tighten ranges without a major version bump.
- **`exports` map drift.** If you add a new subpath import (e.g. `@scope/pkg/utils`), it must be added to both the `exports` map *and* `files` or consumers get a "no exports main defined" error.
- **Token / asset paths.** If the build output structure changes (e.g. tokens move from `build/scss/` to `dist/tokens/`), the `exports` map subpaths need to follow.

## Phase 4: Consuming the package

When a developer wants to *use* the package in another project, the steps differ by registry:

- GitHub Packages → see `references/consumer-install.md` (PAT creation, `.npmrc` setup, troubleshooting 401/404)
- Public npm → just `npm install <name>`, no auth needed

Both registries share these **import patterns** once installed:

```tsx
import { Button } from '@scope/package-name';
import '@scope/package-name/dist/index.css';   // styles — easy to forget!
```

Tokens (if exposed via the `exports` map):

```scss
@import '@scope/package-name/tokens';   // SCSS variables
```

```css
@import '@scope/package-name/tokens/css'; /* CSS custom properties */
```

Fonts (if shipped):

```tsx
import '@scope/package-name/fonts.css';
```

The single thing consumers most often forget is the CSS import — components render unstyled and they think the package is broken. Always mention it.

## What lives where

| File | Purpose |
| --- | --- |
| `references/github-packages.md` | GitHub Private Packages registry config + Actions workflow |
| `references/npm-public.md` | Public npm registry config + Actions workflow |
| `references/shared-build-config.md` | Vite, tsconfig, package.json templates shared by both flows |
| `references/consumer-install.md` | Consumer-side install (PAT, `.npmrc`, import patterns) |
| `references/troubleshooting.md` | Common 401/404/E404/peer-dep errors and fixes |
| `references/pitfalls.md` | Asset-distribution failure modes that only surface in consumer apps (read first) |

Read references on demand — they're not preloaded into context. The smaller ones (consumer-install, troubleshooting) are fine to skim early; the bigger config templates are best read when you're actually about to write the file.
