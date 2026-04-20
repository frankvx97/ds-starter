# Changesets

Hi! This folder is where [Changesets](https://github.com/changesets/changesets) stores pending version-bump and changelog entries.

## Adding a changeset

When you make a change that affects consumers of this package, run:

```bash
pnpm changeset
```

You'll be asked:

1. Which packages changed (this repo has one).
2. Whether it's a `patch`, `minor`, or `major` bump.
3. A short summary (this becomes the CHANGELOG entry).

A Markdown file is written into this folder. **Commit it with your PR.**

## What happens next

- On merge to `main`, the `release.yml` workflow opens (or updates) a "Version Packages" PR.
- Merging that PR bumps the package version, regenerates `CHANGELOG.md`, and creates a GitHub release.
- The GitHub release triggers `publish.yml`, which publishes the package to GitHub Packages.

No changesets = no release. Keep them small and focused.
