# Shared build config

These templates are identical for both GitHub Packages and public npm. Drop them in as-is.

## `src/index.ts` — barrel export

```typescript
export { Button } from './components/actions/Button';
export type { ButtonProps } from './components/actions/Button';
export { IconButton } from './components/actions/IconButton';
export type { IconButtonProps } from './components/actions/IconButton';
// …re-export every public component + its prop types
```

Why this matters: consumers writing `import { Button } from '@scope/pkg'` are locked in to *the API*, not your file structure. You can move `Button.tsx` anywhere without breaking them, as long as the barrel still exports it.

Don't re-export internals (private helpers, intermediate components used only inside others). Anything in this file is a public API contract — once shipped, removing or renaming it is a breaking change.

## `tsconfig.build.json`

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": false,
    "declaration": true,
    "declarationMap": true,
    "emitDeclarationOnly": true,
    "outDir": "./dist"
  },
  "include": ["src"],
  "exclude": ["src/**/*.stories.*", "src/**/*.test.*"]
}
```

Why each option:

- `noEmit: false` — overrides the root tsconfig (which usually has `noEmit: true` for IDE-only checking)
- `declaration` + `declarationMap` — emit `.d.ts` and `.d.ts.map`. The map lets a consumer cmd-click into your *source* TypeScript, not the generated types.
- `emitDeclarationOnly: true` — Vite handles the JS bundling; tsc would just duplicate work and produce loose `.js` files in `dist/` that confuse the resolver.
- `exclude` — never ship Storybook or test files.

## `vite.config.lib.ts`

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es', 'cjs'],
      fileName: (format) => format === 'es' ? 'index.js' : 'index.cjs',
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'react-aria-components',
        'react-stately',
      ],
      output: {
        globals: { react: 'React', 'react-dom': 'ReactDOM' },
        assetFileNames: 'index.[ext]',
      },
    },
    sourcemap: true,
    cssCodeSplit: false,
  },
});
```

Notes:

- The `external` list **must** include every package that's also in `peerDependencies`. Bundling React (or React Aria) into the library = duplicate copies in the consumer = "Invalid hook call" / "two copies of React" runtime errors. This is the single most common publishing mistake.
- `cssCodeSplit: false` collapses all CSS into one file (`dist/index.css`). Easier for consumers to import as a single line. If the library is huge and tree-shaking CSS matters, set to `true` and adjust the import pattern in docs.
- `assetFileNames: 'index.[ext]'` ensures the CSS is named predictably as `index.css` rather than hashed.
- `sourcemap: true` — small, helpful for consumers debugging into the library.

## `.gitignore` additions

```
# Build output
dist/
build/
*.tgz
```

`*.tgz` covers the artifacts left behind by `npm pack` testing.

## `package.json` scripts (shared)

```json
{
  "scripts": {
    "build:lib": "vite build --config vite.config.lib.ts && tsc --project tsconfig.build.json",
    "build": "npm run build:lib",
    "prepublishOnly": "npm run build",
    "prepack": "npm run build"
  }
}
```

If the project has a token build step (e.g. `build:tokens`) wire it into the top-level `build`:

```json
"build": "npm run build:tokens && npm run build:lib"
```

`prepack` covers people who use `npm pack` directly; `prepublishOnly` covers `npm publish`. Having both means every distribution path produces a fresh build.

## Verifying the build

After everything is wired:

```bash
npm run build
ls -la dist/
```

You should see at minimum:

- `dist/index.js` (ESM)
- `dist/index.cjs` (CommonJS)
- `dist/index.d.ts` (types)
- `dist/index.d.ts.map`
- `dist/index.css` (if components have styles)

Then:

```bash
npm pack --dry-run
```

Read the file list it prints. Things to spot-check:

- The `dist/` files are present
- No `src/`, no `*.stories.*`, no `*.test.*` files
- Total size is reasonable (a typical DS package is 200KB–1MB)
- No `.env`, no `node_modules`, no secrets
