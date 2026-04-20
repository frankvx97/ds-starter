# Tokens — Source JSON drop zone

Drop **JSON token files** here. Style Dictionary (`pnpm tokens:build`) reads
every `*.json` in this folder recursively and compiles them into:

- `src/styles/tokens.css` — CSS custom properties (`--color-brand-primary`, etc.)
- `src/styles/tokens.ts` — TypeScript constants (importable from code)

## Supported export sources

1. **Figma MCP** — when the MCP server writes out tokens, aim them at this folder.
2. **Tokens Studio plugin** — export as JSON (DTCG format recommended).
3. **Hand-authored DTCG** — the seed file `core.tokens.json` shows the shape.

All three use the DTCG (`$value` / `$type`) spec. Style Dictionary v5 handles
them natively.

## Conventions

- One file per logical group: `color.tokens.json`, `spacing.tokens.json`, `typography.tokens.json`, etc.
- File extension `.tokens.json` is preferred but any `*.json` is picked up.
- Use kebab-case or camelCase keys; stick to one style within a file.
- **Don't** put CSS/SCSS here — those go in `../raw/`.

## Rebuild after changes

```bash
pnpm tokens:build      # one-shot
pnpm tokens:watch      # watch mode during development
```
