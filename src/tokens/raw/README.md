# Tokens — Raw CSS/SCSS drop zone

Drop **pre-built CSS or SCSS** here — typically from the
[Tokens SOT Figma plugin](https://www.figma.com/community/plugin/1564875958262501937).

Files here are **not processed by Style Dictionary** — they're already
final CSS/SCSS and are imported straight into `src/styles/global.css`.

## How to use

1. Export from Tokens SOT and drop the files here (e.g. `tokens.css`, `themes/dark.css`).
2. Open `src/styles/global.css` and add an `@import` line, for example:

   ```css
   @import '../tokens/raw/tokens.css';
   ```

3. Restart Storybook (`pnpm dev`) — the variables are now in scope everywhere.

## When to use this vs. `../source/`

| Pipeline              | Drop into | Built by         |
| --------------------- | --------- | ---------------- |
| Figma MCP → JSON      | `source/` | Style Dictionary |
| Tokens Studio → JSON  | `source/` | Style Dictionary |
| Tokens SOT → CSS/SCSS | `raw/`    | Imported as-is   |

The two paths can coexist — CSS variables from both merge into `:root`.
