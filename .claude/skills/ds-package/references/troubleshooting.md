# Troubleshooting

Common errors during publish or install, and how to resolve them.

## Publish-side errors

### `npm ERR! 401 Unauthorized` on publish

The CI or local environment doesn't have a valid auth token for the registry.

- **GitHub Packages, in CI**: the workflow's `permissions` block is missing or doesn't include `packages: write`. Add it.
- **GitHub Packages, locally**: `NODE_AUTH_TOKEN` env var is unset or the token has expired. Regenerate a PAT with `write:packages` scope.
- **npm, in CI**: `NPM_TOKEN` secret is missing, expired, or not an *automation* token (regular tokens may be blocked by 2FA).
- **npm, locally**: run `npm whoami` — if it errors, run `npm login` and retry.

### `npm ERR! 404 Not Found` on first publish

Several possible causes; check in this order:

1. The package `name` in `package.json` doesn't match where you're trying to publish.
   - GitHub Packages: scope must equal the GitHub owner of the repo (`@owner/...`)
   - npm: the scope must be one you own (or be unscoped + globally unique)
2. `publishConfig.registry` is wrong or absent.
3. For GitHub Packages org-owned repos: the org has package creation restricted to admins. Ask an org owner to publish the first version, or to grant your account permission.
4. The package exists but you're hitting the wrong registry. `npm config get registry` should show the expected URL.

### `EPUBLISHCONFLICT` / 409 — version already exists

You can't republish over a published version. Bump the version (`npm version patch`) and try again. This is a *feature* — version immutability is what consumers depend on.

### `402 Payment Required` (npm only)

A scoped package is being published as private without a paid npm account. Either:

- Add `"access": "public"` to `publishConfig` (or pass `--access public`) — package becomes public
- Upgrade to npm Pro/Teams/Org for private publishing

### `403 Forbidden — You do not have permission to publish`

- The package name is taken by someone else. Check `npm view <name>`.
- The scope is owned by someone else. `npm org ls <scope>` to verify membership.
- The npm account's email isn't verified yet.

### Build runs but `dist/` is empty / publish ships no JS

- `prepublishOnly` script isn't running. It only runs on `npm publish` (not `npm pack` — that's `prepack`). If using `pnpm publish` with certain versions, it may skip lifecycle scripts; pass `--no-git-checks` and verify scripts ran.
- The build *did* run but Vite errored silently. Run `npm run build` directly and inspect output.

### Package ships way too much (10MB+)

`files` in `package.json` is missing or wrong. Without it, npm ships the entire repo (minus `.gitignore`d paths and a few defaults like `node_modules`). Add an explicit `files` array with only `dist`, `build`, `assets`, etc.

Run `npm pack --dry-run` to see exactly what would ship.

## Consumer-side errors

### `npm ERR! 404 Not Found` on install

For GitHub Packages this is almost always one of:

1. PAT not configured. Check `~/.npmrc` (`npm config get //npm.pkg.github.com/:_authToken`).
2. PAT lacks `read:packages` scope. Generate a new one with the right scope.
3. PAT not authorized for SSO org. Go to the token in GitHub Settings, click "Configure SSO", authorize the org.
4. Scope routing missing. The first line of `.npmrc` (`@owner:registry=...`) must match the package's scope exactly, lowercase.

For public npm: the package may genuinely not exist yet, or there's a typo in the name.

### `npm ERR! 401 Unauthorized` on install

Token expired or wrong. For GitHub Packages, regenerate the PAT and update `.npmrc`.

### Components render unstyled

The consumer forgot `import '@scope/pkg/dist/index.css'`. Tell them to add it once near their app entry point.

### "Invalid hook call" / "two copies of React" runtime error

The library bundled React instead of treating it as a peer dep. Check `vite.config.lib.ts` — `external` must include `react`, `react-dom`, and `react/jsx-runtime`. Rebuild and republish (with a version bump).

### TypeScript types not found / `Cannot find module '@scope/pkg' or its corresponding type declarations`

- `dist/index.d.ts` not in the published tarball. Check `files` in `package.json` includes `dist`, and run `npm pack --dry-run`.
- `types` field in `package.json` not pointing at `./dist/index.d.ts`.
- `exports` map's `.` entry missing the `types` condition. Modern TS (4.7+) reads from `exports`, not from `types`, when `exports` is present.

### Subpath import fails (`@scope/pkg/tokens` → "no exports main defined")

The subpath isn't declared in the `exports` map, or the file it points to doesn't exist in the published tarball. Both must be true. Add the entry to `exports` *and* make sure the source dir is listed in `files`.

### `peer dep` warnings on install

Consumer's React (or React Aria) version is outside the range declared in the library's `peerDependencies`. Either widen the range in the library (and republish, minor bump) or have the consumer upgrade.

## Tooling differences (npm vs pnpm vs yarn)

The skill examples use `npm`. If the project uses pnpm or yarn, swap commands consistently:

| npm | pnpm | yarn |
| --- | --- | --- |
| `npm install` | `pnpm install` | `yarn install` |
| `npm ci` | `pnpm install --frozen-lockfile` | `yarn install --immutable` |
| `npm publish` | `pnpm publish` | `yarn npm publish` |
| `npm version patch` | `pnpm version patch` | `yarn version --patch` |
| `npm pack --dry-run` | `pnpm pack --dry-run` | `yarn pack --dry-run` |

Lifecycle scripts (`prepublishOnly`, `prepack`) work in all three but pnpm has historically been stricter about which ones run on `pnpm publish` vs `pnpm pack`. If you see "build didn't run on publish" check pnpm's release notes for your version.
