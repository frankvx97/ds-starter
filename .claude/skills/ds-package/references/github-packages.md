# GitHub Private Packages

Use this when the user chose "GitHub Private Packages" in Phase 1.

## Naming

The package `name` in `package.json` **must** be scoped to the GitHub owner (user or org) that will host it:

```json
"name": "@owner/package-name"
```

Replace `owner` with the lowercase GitHub username or org. Mismatched scope and owner = 404 on publish.

## `package.json` additions

```json
{
  "name": "@owner/package-name",
  "version": "1.0.0",
  "license": "UNLICENSED",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",

  "exports": {
    ".": {
      "import": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
      "require": { "types": "./dist/index.d.ts", "default": "./dist/index.cjs" }
    },
    "./tokens": "./build/scss/index.scss",
    "./tokens/css": "./build/css/tokens.css",
    "./tokens/scss/*": "./build/scss/*",
    "./tokens/css/*": "./build/css/*",
    "./assets/*": "./assets/*",
    "./dist/index.css": "./dist/index.css"
  },

  "files": ["dist", "build/scss", "build/css", "assets"],

  "publishConfig": {
    "registry": "https://npm.pkg.github.com",
    "access": "restricted"
  },

  "scripts": {
    "build:lib": "vite build --config vite.config.lib.ts && tsc --project tsconfig.build.json",
    "build": "npm run build:lib",
    "prepublishOnly": "npm run build"
  }
}
```

Strip subpaths (`./tokens`, `./assets/*`, etc.) the project doesn't actually have. Don't ship export entries that point to nonexistent files — `npm publish` won't catch it but consumers will get cryptic resolve errors.

## `.npmrc` (committed to the repo)

```
@owner:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

Two lines:

1. Route any `@owner/*` package install through GitHub's registry.
2. Use the `NODE_AUTH_TOKEN` env var for auth. In CI this is provided by `actions/setup-node`; locally, the developer either has it set or relies on their global `~/.npmrc`.

This file is safe to commit — it contains no secret, just an env var reference.

## GitHub Actions workflow

Save as `.github/workflows/publish.yml`:

```yaml
name: Publish to GitHub Packages

on:
  push:
    tags:
      - 'v*.*.*'
  workflow_dispatch:

permissions:
  contents: read
  packages: write

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: https://npm.pkg.github.com

      - run: npm ci
      - run: npm run build
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Why each piece:

- `tags: ['v*.*.*']` — runs on `v1.0.0`-style tags. Pairs with `npm version <bump>` which creates exactly this tag format.
- `workflow_dispatch` — gives a manual "Run workflow" button in the Actions UI for emergency re-publishes.
- `permissions: packages: write` — required for `GITHUB_TOKEN` to push to the registry. Default permissions don't include this.
- `registry-url` on `setup-node` — writes the right entry into a temporary `.npmrc` and points `NODE_AUTH_TOKEN` at the right registry.
- `GITHUB_TOKEN` as `NODE_AUTH_TOKEN` — the auto-provided token has `packages: write` (because of the `permissions` block) so no extra PAT is needed.

If pnpm or yarn is used instead of npm, swap `npm ci` / `npm publish` for the equivalent. The workflow shape is the same.

## Common publish-time errors

**401 Unauthorized on `npm publish`** — the workflow's `permissions` block is missing or doesn't include `packages: write`. Fix the workflow, re-run.

**404 Not Found on first publish** — usually one of:
- Package `name` scope doesn't match the GitHub owner that owns the repo
- `publishConfig.registry` is missing or pointing at npmjs
- For org-owned repos, the org has package creation restricted — ask an admin

**`EPUBLISHCONFLICT`** — version already exists. Bump the version (you can't republish over the same version on GitHub Packages).

## Linking the package to its repository

In the GitHub UI, go to the package page and "Connect Repository" so the package shows up under the repo's "Packages" sidebar and inherits the repo's permissions. Alternatively, add `repository.url` to `package.json` and GitHub will auto-link on next publish:

```json
"repository": {
  "type": "git",
  "url": "https://github.com/owner/repo.git"
}
```
