# Consuming the package

How to install and use the design system from a *different* project.

## Public npm

```bash
npm install @scope/package-name
# or
pnpm add @scope/package-name
```

No auth, no `.npmrc`, no PAT. Skip ahead to **Importing**.

## GitHub Private Packages

Two extra steps before `npm install` will work.

### 1. Create a Personal Access Token (PAT)

1. https://github.com/settings/tokens → **Generate new token (classic)**
2. Name it descriptively (e.g. `ds-package-read`)
3. Scopes: check **`read:packages`** (and only that — don't grant write unless this token is for publishing too)
4. Set an expiration. 90 days is a reasonable default; shorter is more secure but more annoying.
5. Generate, then **copy the token immediately** — you can't view it again.

If the package is in an organization that has SSO enforced, click "Configure SSO" next to the token after creating it and authorize it for the org. Without this step the token works but org-owned packages 404.

### 2. Configure `.npmrc`

**Per-project** (preferred for CI):

Create `.npmrc` in the consumer project root:

```
@scope:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_PACKAGES_TOKEN}
```

Then set `GITHUB_PACKAGES_TOKEN` in the developer's environment (e.g. via `direnv`, `.env`, or shell rc) and as a CI secret. Don't hardcode the token literal in a committed file — it leaks.

**User-global** (preferred for local dev across many projects):

```bash
npm config set @scope:registry https://npm.pkg.github.com
npm config set //npm.pkg.github.com/:_authToken <token>
```

This writes to `~/.npmrc`, which is outside any repo and not at risk of being committed.

### 3. Install

```bash
npm install @scope/package-name
```

If this 404s, see `troubleshooting.md`.

## Importing

Once installed, the import surface is the same regardless of registry.

### Components

```tsx
import { Button, IconButton, Link } from '@scope/package-name';
import '@scope/package-name/dist/index.css';   // ← easy to forget

export function Page() {
  return <Button variant="primary">Click me</Button>;
}
```

The CSS import is the #1 thing consumers forget. Without it components render unstyled and people assume the package is broken. If the consumer is using a CSS-in-JS-only stack and the import line feels out of place, mention that it's necessary because the library uses CSS Modules / vanilla CSS, not runtime styles.

### Tokens — SCSS

```scss
@import '@scope/package-name/tokens';

.my-element {
  color: $tokens-color-text-default-primary;
  padding: $numeric-tokens-spacing-md;
}
```

### Tokens — CSS custom properties

```css
@import '@scope/package-name/tokens/css';

.my-element {
  color: var(--tokens-color-text-default-primary);
  padding: var(--numeric-tokens-spacing-md);
}
```

### Fonts

```tsx
import '@scope/package-name/fonts.css';
```

The bundler (Vite, webpack, Next.js) follows the `url()` references in the CSS and copies the font files into the consumer's build output automatically. No manual copying needed.

### Individual icons

If the consumer needs an SVG icon outside of any DS component:

```tsx
import checkIcon from '@scope/package-name/assets/icons/base/check.svg';

<img src={checkIcon} alt="check" />;
```

## Updating to a new version

```bash
npm update @scope/package-name           # newest within semver range
npm install @scope/package-name@1.2.3    # exact version
npm install @scope/package-name@latest   # newest, ignoring range
```

To see what's installed and what's available:

```bash
npm list @scope/package-name              # current
npm view @scope/package-name versions     # all published
npm outdated @scope/package-name          # is there something newer?
```

## Semver ranges in `package.json`

When `npm install` adds a dep it writes a range like `^1.0.0`. The prefix character matters:

- `^1.0.0` — accept any `1.x.x` (default; matches all backwards-compat updates)
- `~1.0.0` — accept only `1.0.x` (patch-only, more conservative)
- `1.0.0` — pin exactly to `1.0.0` (tightest, requires manual bumps for any update)

For a design system used across many consumer apps, `^` is the usual choice — it lets minor releases roll out without lockstep coordination but holds the line on majors.
