# Pitfalls (read first)

These are the failure modes that ship to production and break consumer apps. Most are invisible in the dev server and Storybook — they only surface when a teammate installs the published tarball.

Front-load them. Catching one of these *before* the first publish saves an entire release cycle.

## 1. Absolute asset paths in source

Both forms are traps:

```tsx
<img src="/icons/base/check.svg" />
```

```css
.chip { mask: url('/icons/base/shopping-bag.svg'); }
```

They resolve against the dev server's origin and look fine locally. In a consumer app, the browser resolves them against the consumer's origin (`https://consumer-app.com/icons/...`) and 404s.

Fix differs by surface:

- **JSX `<img src="/...">`**: replace with an inline SVG React component, or import the file with Vite's `?url` suffix so the bundler emits a fingerprinted path:
  ```ts
  import iconUrl from '../../assets/icons/check.svg?url';
  ```
- **CSS `url('/...')`**: don't edit source modules; run `postcss-url` in the library build to rewrite absolute URLs to relative ones and copy the files into `dist/assets/`. See the Vite config block in `shared-build-config.md`.

Fixing only JSX leaves CSS `url()` paths broken. Both must be addressed.

## 2. Storybook's `staticDirs` masks the bug

Storybook serves `assets/` as a static dir in dev. A component referencing `/icons/base/check.svg` renders perfectly in Storybook — and breaks the moment it's installed elsewhere. Storybook validates components *look* right, not that the package *ships* right.

**Always validate distribution by installing the tarball into a fresh project:**

```bash
pnpm pack                     # creates your-design-system-X.Y.Z.tgz
# in a scratch consumer project (Vite or Next):
pnpm add /absolute/path/to/your-design-system-X.Y.Z.tgz
```

Render one component that uses an icon, one that uses a CSS mask, one that uses a placeholder image, one that uses a loading state, and one that uses fonts. If any 404s in the browser network tab, the package is not ready to publish.

## 3. Externalize peer dependencies

React, `react-dom`, `react/jsx-runtime`, and any UI primitive library (`react-aria-components`, `react-stately`, etc.) must be listed in `external` in the Vite config **and** in `peerDependencies` in `package.json`. Bundling them causes:

- Duplicate React instances → "Invalid hook call" runtime errors
- Larger bundle than the consumer wants
- Version mismatches between the design system's bundled React and the consumer's React

This is the single most common publishing mistake.

## 4. External-asset loaders

If a component uses `@lottiefiles/dotlottie-react` (or similar) to fetch `/icons/animated/loader.lottie` by URL, fixing icon paths won't help the loader — it requests the file at runtime against the consumer's origin.

Replace external-asset loaders with inline SVG + CSS keyframe animations themed via `currentColor`. This eliminates a whole class of asset-path bugs and typically drops hundreds of KB of dependencies.

## 5. Fonts need real `@font-face` rules, not path strings

A SCSS/CSS variable that just holds a font path (`$font-foo: '~design-system/path/Font.otf'`) does nothing on its own — it's inert until a `@font-face` rule references it. And consumer bundlers won't resolve a `~`-prefixed Webpack alias they don't know about.

The package must either:

- Ship a separate opt-in fonts CSS entry (e.g. `dist/fonts.css`) with real `@font-face` rules using **relative** `url('./fonts/MyFont.woff2')` paths, plus the font files copied into a sibling folder (e.g. `dist/fonts/`), **or**
- Not ship fonts at all and document that consumers self-host them.

Whatever the folder names, the URLs in the published CSS must be relative and point to files that actually exist in the tarball. Any bundler-specific alias (`~`, `@/`, etc.) that escapes into published CSS will fail in consumer setups that don't share that alias.

## 6. Generated barrel files must match files on disk

If you generate a token barrel (SCSS `@import` or CSS `@import`) of every token group, but your token generator skips empty groups (Style Dictionary does this), the barrel will reference partials that don't exist. The first dangling `@import` aborts the import chain in the consumer.

After generation, filter the file list against disk before writing the barrel:

```js
import fs from 'node:fs';
import path from 'node:path';

const existing = candidateFiles.filter((f) =>
  fs.existsSync(path.join(outputDir, f)),
);
writeIndex(existing);
```

## 7. Pick one SCSS module system and stay there

If any of the published partials use `@use 'foo' as *;` and others use `@import 'foo';`, both forms touching the same variables produce duplicate-variable errors in consumer projects.

Modern Sass prefers `@use`/`@forward`, but `@import` remains compatible. Pick one across every generated partial and the barrel that re-exports them. Doesn't apply if you only ship CSS Modules and CSS custom properties.

## 8. Test what ships, not what builds

`pnpm pack --dry-run` lists what will be in the published tarball. Read the list.

- If you see `.stories.tsx`, test fixtures, or `node_modules/` (it happens), tighten the `files` array in `package.json`.
- If you don't see your `dist/` outputs, your build didn't run before pack.
- If total size is over ~2 MB for a typical DS, something unintended is shipping.

## 9. Add a regression guard for whatever just bit you

Detect-in-build beats remember-to-check-this. After fixing an absolute-URL leak, add `scripts/assert-no-absolute-urls.js`:

```js
import fs from 'node:fs';
const css = fs.readFileSync('dist/index.css', 'utf8');
const bad = css.match(/url\(\s*['"]?\/[^)'"]+/g);
if (bad) {
  console.error('Absolute URL(s) leaked into dist/index.css:\n' + bad.join('\n'));
  process.exit(1);
}
console.log('No absolute URLs in dist/index.css');
```

Wire it into `build:lib` so the build fails the next time someone reintroduces the bug. Apply the same pattern to other regression-prone failures — a small script that fails loudly is worth more than a doc comment that says "remember to check this."
