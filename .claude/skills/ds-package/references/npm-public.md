# Public npm

Use this when the user chose "Public npm" in Phase 1.

## Naming

The package can be unscoped (`my-design-system`) or scoped (`@owner/my-design-system`). Scoped is the modern convention and avoids name collisions. Unscoped names must be globally unique on npmjs.com — check `npm view <name>` first.

If using a scope, the scope must be claimed on npmjs.com (free for personal scopes, included with org accounts for org scopes).

## `package.json` additions

```json
{
  "name": "@owner/package-name",
  "version": "1.0.0",
  "license": "MIT",
  "description": "…",
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
    "access": "public"
  },

  "repository": {
    "type": "git",
    "url": "https://github.com/owner/repo.git"
  },

  "scripts": {
    "build:lib": "vite build --config vite.config.lib.ts && tsc --project tsconfig.build.json",
    "build": "npm run build:lib",
    "prepublishOnly": "npm run build"
  }
}
```

Key differences from the GitHub Packages flow:

- `license` is a real SPDX identifier (not `UNLICENSED`) — required for OSS publishing
- `publishConfig.access: "public"` — without this, scoped packages default to private and fail with a paywall error
- No `publishConfig.registry` — defaults to `https://registry.npmjs.org`
- `description` and `repository` matter more — they show up on the npm package page
- Consider adding `keywords`, `homepage`, and `bugs` for discoverability

## `.npmrc`

For public npm, you usually don't need a committed `.npmrc` at all. Auth is handled by `npm login` locally or by `NODE_AUTH_TOKEN` in CI.

If the project mixes scopes (e.g. consumes a private GitHub Package while publishing publicly), the `.npmrc` only needs the *consume* side:

```
@private-org:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

Don't put your npm publish token in a committed file. Use CI secrets or your global `~/.npmrc`.

## GitHub Actions workflow

Save as `.github/workflows/publish.yml`:

```yaml
name: Publish to npm

on:
  push:
    tags:
      - 'v*.*.*'
  workflow_dispatch:

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: https://registry.npmjs.org

      - run: npm ci
      - run: npm run build
      - run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

Setup needed before the workflow can succeed:

1. Generate an **automation token** at npmjs.com → Account → Access Tokens → Generate New Token (classic) → "Automation". Automation tokens bypass 2FA for publishing.
2. In the GitHub repo, add the token as a secret named `NPM_TOKEN` (Settings → Secrets and variables → Actions → New repository secret).

The `--access public` flag on `npm publish` is belt-and-suspenders — `publishConfig.access` already covers it, but explicit doesn't hurt.

## 2FA and provenance

If the npm account has 2FA enforced for publishes (recommended), automation tokens are the way to publish from CI. Alternatively, npm now supports **trusted publishing** via OIDC — no token at all, GitHub Actions identifies itself directly to npm. Worth setting up if the user is security-conscious; see https://docs.npmjs.com/trusted-publishers.

For provenance attestation (shows a "verified" badge on npmjs.com), add `--provenance` to the publish command and ensure the workflow has `id-token: write` permission:

```yaml
permissions:
  contents: read
  id-token: write

# ...
- run: npm publish --access public --provenance
```

## Common publish-time errors

**402 Payment Required** — scoped package being published as private without a paid plan. Add `"access": "public"` under `publishConfig` (or pass `--access public`).

**403 Forbidden — You do not have permission to publish** — name is taken by someone else, or you don't own the scope. Check `npm view <name>` and `npm org ls <scope>`.

**`EPUBLISHCONFLICT` / 409** — version already exists. Bump and republish. Note: npm allows un-publishing within 72 hours, but only if no other package depends on it. Don't make a habit of this.

**Unable to authenticate** in CI — `NPM_TOKEN` secret missing, expired, or not an automation token. Regenerate and re-add.
