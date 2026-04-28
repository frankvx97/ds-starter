---
name: figma-token-sync
description: Pull design tokens from a Figma file into `src/tokens/source/core.tokens.json` (DTCG / Style Dictionary v5). Triggers on phrases like "sync Figma tokens", "regenerate tokens from Figma", "update core.tokens.json", "/figma-token-sync". Uses the Figma Console MCP to extract Variables, text styles, and effect styles, then assembles a single DTCG file with light/dark modes encoded under `$extensions.modes`.
---

# figma-token-sync

End-to-end workflow for refreshing `src/tokens/source/core.tokens.json` from Figma. The output file is consumed by `style-dictionary.config.mjs` (run `pnpm tokens:build`).

## When to use

- A designer says "I updated tokens in Figma"
- The user asks to "regenerate", "refresh", or "sync" the tokens file
- The variable list, text styles, or effect styles in Figma have changed
- A new Figma file is being onboarded as the source of truth

## What ends up in `core.tokens.json`

**Top-level keys mirror the Figma Variable Collections, one-for-one.** Variable groups (the slash-separated path inside a collection) become nested keys.

| Top-level key | Source in Figma | Sub-structure | DTCG `$type` |
| --- | --- | --- | --- |
| `primitives` | `primitives` collection | `palette/*` (25 families + white/black/eclipse/snow), `dimensions/*` (41) | `color`, `dimension` |
| `theme` | `theme` collection | groups (`accent`, `background`, `danger`, `default`, `field`, `foreground`, `separator`, `success`, `surface`, `warning`) + flat tokens (`backdrop`, `border`, `blur`, `depth`, `disabled-opacity`, `border-width`, `focus-ring`, `overlay`, `ring-focus-width`, `ring-offset-width`, `segment`, `shadow-inner`, `shadow-scroll*`) — every token carries `$extensions.modes.{light,dark}` | `color`, `number`, `dimension` |
| `typography` | `typography` collection (STRING vars) | flat: `font-family`, `font-regular`, `font-medium`, `font-semi-bold`, `font-bold`, `font-extra-bold` | `fontFamily`, `fontWeight` |
| `radius` | `radius` collection | flat — variable names with the redundant `radius-` prefix stripped (`radius-md` → `radius.md`); values alias to `primitives.dimensions.*` | `dimension` |
| `breakpoints` | `breakpoints` collection | flat — `breakpoints-sm` → `breakpoints.sm`; aliases to `primitives.dimensions.*` | `dimension` |
| `spacing` | `spacing` collection | flat — `space-0_5` → `spacing.0_5`; aliases to `primitives.dimensions.*` | `dimension` |
| `docs` | `docs` collection | flat (`bg`, `foreground`, `foreground-inverse`, `muted`, `radius`); light/dark | `color`, `dimension` |
| `textStyles` | local **text styles** (not Variables) | `heading.*`, `body.*`, `link.*`, `text-field.*`, `button.*`, `tailwind.text.<size>.<weight>` | `typography` |
| `effectStyles` | local **effect styles** (not Variables) | `shadow.*` (incl. `shadow.tailwind.*`), `focus.*`, `blur.*` (incl. `blur.tailwind.{layer,backdrop}.*`) | `shadow`, `other` |

The top-level `_meta` block records `generatedAt` (ISO timestamp), source file name + key + URL, the MCP server used, and per-section counts. JSON has no comment syntax — use `_meta` and the `$description` fields as the data-layer header.

## The MCP tools used

All from the **figma-console** server:

| Tool | Used for |
| --- | --- |
| `figma_get_status({ probe: true })` | Verify the Desktop Bridge is connected, capture file name + key |
| `figma_navigate({ url })` | Open the target Figma file (only if not already connected) |
| `figma_get_design_system_summary()` | Quick "is anything there?" check; returns category + token-collection counts |
| `figma_get_variables({ format: "summary", resolveAliases: true })` | Inventory: collection list, modes, total counts, all variable names |
| `figma_get_variables({ format: "filtered", collection, page, resolveAliases: true, verbosity: "full" })` | Per-collection extraction. **Always use `verbosity: "full"`** — `"summary"` strips `description`, `scopes`, `codeSyntax`, and `hiddenFromPublishing`, which we need for `$description` + `$extensions["com.figma.*"]`. Pages of 50; primitives needs 7 pages, theme 2, others 1. Use `namePattern` to narrow when only a sub-group is needed (e.g. `namePattern: "dimensions"`) |
| `figma_get_text_styles()` | All 134 text styles with fontSize / fontStyle / lineHeight / letterSpacing / textDecoration |
| `figma_get_styles()` | Returns 0 in this file — colors live in Variables, so this is informational only |
| `figma_execute({ code })` | Effect styles: `figma.getLocalEffectStylesAsync()` (the sync variant errors under dynamic-page access) |

> ⚠️ Tools are **deferred** in Claude Code. Before calling any of the above, load schemas with `ToolSearch`:
> `select:mcp__figma-console__figma_get_status,mcp__figma-console__figma_navigate,...`

## Step-by-step

### 1 — Connect & inventory

```text
ToolSearch  select:mcp__figma-console__figma_get_status,mcp__figma-console__figma_navigate,
            mcp__figma-console__figma_get_variables,mcp__figma-console__figma_get_styles,
            mcp__figma-console__figma_get_text_styles,mcp__figma-console__figma_execute,
            mcp__figma-console__figma_get_design_system_summary

figma_get_status  { probe: true }     # confirm WebSocket bridge alive
# if currentFileKey ≠ target → figma_navigate({ url: <figma url> })

figma_get_design_system_summary       # category + token-collection overview
figma_get_variables  { format: "summary", resolveAliases: true }
# captures: total_variables, total_collections, modes per collection, full name list
```

The summary tells you how many pages each collection needs (`Math.ceil(count / 50)`).

### 2 — Pull every collection

Run these in parallel (`figma_get_variables` is cached after the first summary call, so paginated reads are fast):

```text
for collection in primitives, theme, typography, radius, breakpoints, spacing, docs:
  for page in 1..ceil(count/50):
    figma_get_variables {
      format: "filtered",
      collection,
      page,
      resolveAliases: true,
      verbosity: "full"      # ALWAYS full — needed for description, scopes,
                             # codeSyntax, hiddenFromPublishing.
    }
```

For each variable record, capture **all six** fields and surface them on the DTCG token:

| Figma field | Where it lands on the DTCG token |
| --- | --- |
| `resolvedValuesByMode` (light/dark) | `$value` (light) + `$extensions.modes.{light,dark}` |
| `aliasTo` (when present) | DTCG reference `{primitives.palette.zinc.500}` |
| `description` (non-empty) | `$description` |
| `scopes` (non-empty array) | `$extensions["com.figma.scopes"]` |
| `codeSyntax` (object, key `WEB`) | `$extensions["com.figma.codeSyntax"]` (re-key `WEB` → `Web` to match the Tokens-Studio convention) |
| `hiddenFromPublishing` | `$extensions["com.figma.hiddenFromPublishing"]` (always emit, even when `false`) |

Mode + alias rules:

- **Single-mode** (`primitives`, `radius`, `breakpoints`, `spacing`, `typography`): one value lives in `resolvedValuesByMode["Mode 1"]`.
- **Multi-mode** (`theme`, `docs`): both `Light` and `Dark` are present — emit them under `$extensions.modes.light` / `$extensions.modes.dark` and put the **light** value as the canonical `$value`.
- **Aliased values** carry an `aliasTo` field: turn `"palette/zinc/500"` into the DTCG reference `{primitives.palette.zinc.500}`. Slash → dot, and prepend the source collection.
- **Special characters in names** — Figma uses `․` (U+2024 ONE DOT LEADER) for fractional dimensions like `dimensions/0․5`. Map to `0_5` in DTCG (matches existing `space-0_5` convention).
- **Description sanitization** — Figma descriptions sometimes contain `{ ... }` (e.g. `@media (min-width: 1024px) { ... }`). Style Dictionary 5 parses any `{...}` substring as an alias and will throw `Reference Errors` at build time. Strip or rephrase the braces (e.g. drop the `{ ... }` tail — the description still reads clearly).

Resulting token shape (example):

```json
"theme": {
  "accent": {
    "foreground": {
      "$type": "color",
      "$value": "{primitives.palette.snow}",
      "$description": "Text/icon color on accent backgrounds.",
      "$extensions": {
        "com.figma.scopes": ["ALL_SCOPES"],
        "com.figma.hiddenFromPublishing": false,
        "com.figma.codeSyntax": { "Web": "--accent-foreground" },
        "modes": {
          "light": "{primitives.palette.snow}",
          "dark":  "{primitives.palette.snow}"
        }
      }
    }
  }
}
```

### 3 — Pull text styles

```text
figma_get_text_styles    → returns 134 styles: id, name, fontSize, fontFamily,
                           fontStyle, letterSpacing { unit, value },
                           lineHeight { unit, value }, textCase, textDecoration
```

Mapping:

- `lineHeight.unit === "PERCENT"` → unitless ratio (`134%` → `1.34`)
- `lineHeight.unit === "PIXELS"` → `"<n>px"`
- `letterSpacing.value === 0` → `"0"`
- `textDecoration === "UNDERLINE"` → emit `textDecoration: "underline"`
- `description` (non-empty) → `$description` on the typography token (Figma text styles don't expose `scopes` or `codeSyntax`, so no `$extensions["com.figma.*"]` block — `$description` is the only metadata to surface).
- The `tailwind/text-{size}/font-{weight}` styles form a regular size×weight grid — generate them programmatically (9 weights × 13 sizes).

### 4 — Pull effect styles

`figma_get_styles` returns `0` for this file because the design system uses Variables for color and only **effect** styles for shadows/blurs. Use `figma_execute` instead:

```js
const effectStyles = await figma.getLocalEffectStylesAsync();
return { effects: effectStyles.map(s => ({
  id: s.id, name: s.name, description: s.description,
  effects: s.effects.map(e => ({
    type: e.type, visible: e.visible,
    radius: e.radius, spread: e.spread,
    color: e.color, offset: e.offset,
    blendMode: e.blendMode,
  }))
})) };
```

> 🚨 The synchronous `figma.getLocalEffectStyles()` errors under `documentAccess: dynamic-page` — always use the `Async` variant.

For each effect style:

- Filter out `visible: false` effects.
- `DROP_SHADOW` → DTCG shadow object `{ color, offsetX, offsetY, blur, spread }`.
- `INNER_SHADOW` → same shape with `inset: true`.
- Convert RGBA `{r,g,b,a}` (0–1 floats) to `#RRGGBB` (or `#RRGGBBAA` if `a < 1`):

  ```js
  const h = v => Math.round(v * 255).toString(16).padStart(2, "0").toUpperCase();
  const hex = a >= 1 ? `#${h(r)}${h(g)}${h(b)}` : `#${h(r)}${h(g)}${h(b)}${h(a)}`;
  ```

- `BACKGROUND_BLUR` / `LAYER_BLUR` → emit a sibling `blur.*` token with `$type: "other"`, `$value: { kind, radius }`. DTCG has no native blur type yet.
- `description` (non-empty) on the parent style → `$description` on the DTCG token. Effect styles don't expose `scopes` or `codeSyntax`, so `$description` is the only metadata to surface.
- Group: `focus/*` → `focus.*`, `shadow/*` → `shadow.*`, `tailwind/Box Shadow/*` → `shadow.tailwind.*`, blur variants under `blur.tailwind.{layer,backdrop}.*`.

### 5 — Assemble the DTCG file

Skeleton:

```jsonc
{
  "_meta": {
    "$description": "Generated from Figma — DO NOT EDIT MANUALLY. Regenerate via .claude/skills/figma-token-sync.",
    "generatedAt": "<ISO timestamp at generation time>",
    "source": { "name": "...", "fileKey": "...", "url": "..." },
    "extractedVia": "Figma Console MCP (figma-console)",
    "counts": { "..." }
  },
  "$description": "DTCG-shaped tokens consumed by Style Dictionary v5.",
  "primitives": {
    "palette":    { /* slate, gray, ..., ruby, white, black, eclipse, snow */ },
    "dimensions": { /* 0, px, 0_5, 1, ..., sm, md, lg, xl, 2xl, 9999 */ }
  },
  "theme":       { /* accent.*, background.*, …, surface.*, warning.* + flat tokens; all with $extensions.modes.{light,dark} */ },
  "typography":  { /* font-family, font-regular, …, font-extra-bold */ },
  "radius":      { /* none, xs, sm, md, lg, xl, 2xl, 2_5xl, 3xl, 4xl, full → alias primitives.dimensions.* */ },
  "breakpoints": { /* sm, md, lg, xl, 2xl */ },
  "spacing":     { /* 0, px, 0_5, …, 96 */ },
  "docs":        { /* bg, foreground, foreground-inverse, muted, radius */ },
  "textStyles":  { /* heading.{1..4}, body.*, link.*, text-field.*, button.*, tailwind.text.<size>.<weight> */ },
  "effectStyles":{
    "shadow":    { /* surface, field, switch, tab, overlay, inner, tailwind.* */ },
    "focus":     { /* ring, ring-field */ },
    "blur":      { /* default, backdrop, tailwind.layer.*, tailwind.backdrop.* */ }
  }
}
```

Multi-mode token shape (with full Figma metadata):

```json
{
  "$type": "color",
  "$value": "{primitives.palette.neutral.100}",
  "$description": "App/page background.",
  "$extensions": {
    "com.figma.scopes": ["FRAME_FILL", "SHAPE_FILL", "EFFECT_COLOR"],
    "com.figma.hiddenFromPublishing": false,
    "com.figma.codeSyntax": { "Web": "--background-default" },
    "modes": {
      "light": "{primitives.palette.neutral.100}",
      "dark":  "{primitives.palette.zinc.950}"
    }
  }
}
```

Style Dictionary v5 reads `$value`/`$type` natively and ignores `$extensions`/`$description` for output but preserves them in the token tree (so Tokens-Studio plugins, custom format functions, or downstream tools can read them). Keep `$value` = light and put the alternates under `$extensions.modes`.

### 6 — Write & build

Write the assembled object to `src/tokens/source/core.tokens.json` (overwrite). Then verify:

```bash
pnpm tokens:build
```

A single warning is expected:

> Unknown CSS Font Shorthand properties found for ~134 tokens

This is informational — Style Dictionary cannot fold every typography composite into the CSS `font` shorthand. The tokens still emit as individual CSS custom properties.

### 7 — Update memory if naming conventions changed

If the user adopts a new key convention (e.g. switches from `space.0_5` to `space.0-5`), save a `feedback` memory so the next sync follows the new shape.

## JSON & comments

JSON has no comment syntax (RFC 8259). Use the `_meta` data-field workaround at the top of the file plus per-token `$description` fields. Both are honored by Style Dictionary as metadata. The image the user shared shows this exact pattern.

## Quick checklist

- [ ] `figma_get_status({ probe: true })` returns `success: true`
- [ ] `figma_get_variables` summary counts match the assembled file's `_meta.counts`
- [ ] Every Variable token call used `verbosity: "full"` (so `description` / `scopes` / `codeSyntax` are present)
- [ ] Every Variable token has `$extensions["com.figma.hiddenFromPublishing"]` and (when Figma provides them) `$description`, `com.figma.scopes`, `com.figma.codeSyntax` (with `Web` key)
- [ ] All `aliasTo` references resolve to a DTCG path that exists in the file (e.g. `{primitives.palette.zinc.500}`)
- [ ] No `$description` contains `{...}` (Style Dictionary parses braces as references — strip or rephrase)
- [ ] No `$value: undefined` slipped through (will silently break Style Dictionary)
- [ ] `pnpm tokens:build` succeeds
- [ ] `_meta.generatedAt` is a fresh ISO timestamp
