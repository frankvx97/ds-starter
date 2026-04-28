/**
 * Token build script.
 *
 * Walks `src/tokens/source/*.json` (DTCG) directly and emits:
 *   - src/styles/tokens.css      — CSS custom properties grouped by collection.
 *   - src/styles/tokens.ts       — TS constants mirroring tokens.css.
 *   - src/styles/typography.css  — utility classes for every $type:"typography" composite.
 *   - .claude/skills/figma-to-react-components/references/token-mapping-guide.md
 *
 * Emission order, grouping, and section comments mirror the source file's
 * top-level key order: primitives → theme → typography → radius → breakpoints
 * → spacing → docs → effectStyles. textStyles drives typography.css.
 *
 * Style Dictionary is intentionally not used: its default css/js formatters
 * sort tokens globally, render `kind: "background"` blur values as
 * `[object Object]`, and don't carry per-collection separator comments.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SOURCE_DIR = path.join(ROOT, 'src/tokens/source');
const OUT_DIR = path.join(ROOT, 'src/styles');
const TOKENS_CSS = path.join(OUT_DIR, 'tokens.css');
const TOKENS_TS = path.join(OUT_DIR, 'tokens.ts');
const TYPOGRAPHY_CSS = path.join(OUT_DIR, 'typography.css');
const MAPPING_DOC = path.join(
  ROOT,
  '.claude/skills/figma-to-react-components/references/token-mapping-guide.md',
);

// --- font-weight keyword mapping (MDN) ----------------------------------------
const WEIGHT_KEYWORDS = {
  thin: 100,
  hairline: 100,
  'extra light': 200,
  extralight: 200,
  ultralight: 200,
  light: 300,
  normal: 400,
  regular: 400,
  book: 400,
  medium: 500,
  'semi bold': 600,
  semibold: 600,
  'demi bold': 600,
  demibold: 600,
  bold: 700,
  'extra bold': 800,
  extrabold: 800,
  ultrabold: 800,
  black: 900,
  heavy: 900,
  'extra black': 950,
  ultrablack: 950,
};

function parseFontWeight(raw) {
  if (raw == null) return { weight: null, italic: false };
  if (typeof raw === 'number') return { weight: raw, italic: false };
  const str = String(raw).trim();
  if (/^\d+$/.test(str)) return { weight: Number(str), italic: false };
  const lower = str.toLowerCase();
  const italic = /\b(italic|oblique)\b/.test(lower);
  const cleaned = lower
    .replace(/\b(italic|oblique)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (WEIGHT_KEYWORDS[cleaned] !== undefined) return { weight: WEIGHT_KEYWORDS[cleaned], italic };
  return { weight: str, italic };
}

function formatLetterSpacing(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v === 0 ? '0' : `${v}px`;
  const s = String(v).trim();
  if (s === '0') return '0';
  if (s.endsWith('%')) {
    const n = parseFloat(s);
    if (!Number.isNaN(n)) return `${n / 100}em`;
  }
  return s;
}

const formatLineHeight = (v) =>
  v == null || v === '' ? null : typeof v === 'number' ? String(v) : String(v).trim();
const formatFontSize = (v) =>
  v == null || v === '' ? null : typeof v === 'number' ? `${v}px` : String(v).trim();

// --- name building ------------------------------------------------------------
// Convert camelCase / mixed segments to kebab-case parts, joined with `-`.
function kebab(segment) {
  return String(segment)
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function pathToCssName(pathSegments) {
  return pathSegments.map(kebab).filter(Boolean).join('-');
}

function pathToTsName(pathSegments) {
  // PascalCase concatenation: ["effectStyles","shadow","tailwind-2xl"] → "EffectStylesShadowTailwind2xl".
  return pathSegments
    .map((seg) =>
      String(seg)
        .replace(/[^a-zA-Z0-9]+/g, ' ')
        .split(' ')
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(''),
    )
    .join('');
}

// --- DTCG walk ---------------------------------------------------------------
function loadSource() {
  const files = fs
    .readdirSync(SOURCE_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => path.join(SOURCE_DIR, f));
  const merged = {};
  for (const f of files) Object.assign(merged, JSON.parse(fs.readFileSync(f, 'utf-8')));
  return merged;
}

const SKIP_TOP_KEYS = new Set(['_meta']);
const SKIP_KEY_PREFIX = '$';

function isLeaf(node) {
  return node && typeof node === 'object' && !Array.isArray(node) && '$value' in node;
}

// Walk in source-declared order, yielding leaves with full path + metadata.
function* walkLeaves(node, pathSegments = []) {
  if (!node || typeof node !== 'object') return;
  if (isLeaf(node)) {
    yield {
      path: pathSegments,
      value: node.$value,
      type: node.$type,
      description: node.$description,
    };
    return;
  }
  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith(SKIP_KEY_PREFIX) || SKIP_TOP_KEYS.has(key)) continue;
    yield* walkLeaves(child, [...pathSegments, key]);
  }
}

// Resolve `{a.b.c}` against the source tree.
function resolveRef(ref, root) {
  const m = String(ref)
    .trim()
    .match(/^\{([^}]+)\}$/);
  if (!m) return null;
  const segs = m[1].split('.');
  let cursor = root;
  for (const s of segs) {
    if (cursor && typeof cursor === 'object' && s in cursor) cursor = cursor[s];
    else return null;
  }
  return cursor;
}

// --- value formatting --------------------------------------------------------
function formatShadow(value) {
  const layers = Array.isArray(value) ? value : [value];
  return layers
    .map((l) => {
      const inset = l.inset ? 'inset ' : '';
      const x = l.offsetX ?? l.x ?? '0px';
      const y = l.offsetY ?? l.y ?? '0px';
      const blur = l.blur ?? '0px';
      const spread = l.spread ?? '0px';
      const color = l.color ?? 'transparent';
      return `${inset}${x} ${y} ${blur} ${spread} ${color}`.trim();
    })
    .join(', ');
}

// Blur tokens carry `{ kind: "layer" | "background", radius: "12px" }`.
// Emit the radius as the value — consumers compose `filter: blur(var(--…))`
// or `backdrop-filter: blur(var(--…))` based on kind. The kind is preserved
// in the description for documentation.
function formatBlur(value) {
  if (value && typeof value === 'object' && 'radius' in value) return String(value.radius);
  return String(value);
}

// CSS-side value for a leaf. References stay as `var(--…)` chains.
function formatValueCss(leaf) {
  const { value, type } = leaf;

  if (typeof value === 'string') {
    const m = value.trim().match(/^\{([^}]+)\}$/);
    if (m) {
      const refName = pathToCssName(m[1].split('.'));
      return `var(--${refName})`;
    }
    return value;
  }

  if (typeof value === 'number') return String(value);

  if (value && typeof value === 'object') {
    if (type === 'shadow') return formatShadow(value);
    // Blur effect-style composite.
    if ('kind' in value && 'radius' in value) return formatBlur(value);
    // Fallback: stringify (shouldn't happen for a known DTCG token).
    return JSON.stringify(value);
  }

  return String(value);
}

// TS-side value: resolve references all the way to literal so the constant
// holds a usable value (mirrors the previous tokens.ts shape).
function formatValueTs(leaf, root) {
  const { value, type } = leaf;

  // Resolve refs through to a literal node, then format.
  if (typeof value === 'string') {
    const m = value.trim().match(/^\{([^}]+)\}$/);
    if (m) {
      const target = resolveRef(value, root);
      if (target && isLeaf(target)) {
        return formatValueTs({ value: target.$value, type: target.$type }, root);
      }
      return JSON.stringify(value);
    }
    // Pure dimension number-as-string passes through quoted.
    return JSON.stringify(value);
  }

  if (typeof value === 'number') return String(value);

  if (value && typeof value === 'object') {
    if (type === 'shadow') {
      // Render as an array of layer objects (matches the previous tokens.ts shape).
      const layers = Array.isArray(value) ? value : [value];
      return JSON.stringify(layers, null, 2);
    }
    if ('kind' in value && 'radius' in value) {
      return JSON.stringify(value, null, 2);
    }
    return JSON.stringify(value, null, 2);
  }

  return JSON.stringify(value);
}

// --- collection / grouping ---------------------------------------------------
// Order leaves by source declaration, but bucket by their top-level collection
// key so we can emit a section comment per collection.
function bucketByCollection(root) {
  const buckets = []; // [{ key, label, leaves: [...] }]
  for (const [topKey, topNode] of Object.entries(root)) {
    if (topKey.startsWith(SKIP_KEY_PREFIX) || SKIP_TOP_KEYS.has(topKey)) continue;
    if (topKey === 'textStyles') continue; // typography.css owns this.
    const leaves = [...walkLeaves(topNode, [topKey])];
    if (leaves.length === 0) continue;
    buckets.push({ key: topKey, label: collectionLabel(topKey), leaves });
  }
  return buckets;
}

const COLLECTION_LABELS = {
  primitives: 'Primitives — raw values (palette, dimensions). Do not consume directly.',
  theme: 'Theme — semantic aliases mapped to primitives.',
  typography: 'Typography — font family + named weights.',
  radius: 'Radius — semantic corner radii.',
  breakpoints: 'Breakpoints — responsive media-query thresholds.',
  spacing: 'Spacing — semantic spacing scale (aliases of primitives.dimensions).',
  docs: 'Docs — Storybook / docs-site only.',
  effectStyles: 'Effect Styles — shadows, focus rings, blur radii.',
};
function collectionLabel(key) {
  return COLLECTION_LABELS[key] ?? key;
}

// Subsection (one path segment deeper) for prettier grouping inside a bucket.
function subsection(leaf) {
  // primitives → palette / dimensions
  // theme → accent / background / …
  // effectStyles → shadow / focus / blur
  return leaf.path[1] ?? null;
}

function groupLeavesBySubsection(leaves) {
  const out = [];
  let currentKey = Symbol('init');
  let currentBucket = null;
  for (const leaf of leaves) {
    const sub = subsection(leaf);
    if (sub !== currentKey) {
      currentKey = sub;
      currentBucket = { sub, leaves: [] };
      out.push(currentBucket);
    }
    currentBucket.leaves.push(leaf);
  }
  return out;
}

// --- writers -----------------------------------------------------------------
const HEADER_CSS = `/**
 * Do not edit directly — generated by scripts/build-tokens.mjs.
 * Source: src/tokens/source/*.json (DTCG).
 */
`;

const HEADER_TS = `/**
 * Do not edit directly — generated by scripts/build-tokens.mjs.
 * Source: src/tokens/source/*.json (DTCG).
 */
`;

function writeTokensCss(buckets) {
  const lines = [HEADER_CSS, '', ':root {'];
  for (const bucket of buckets) {
    lines.push('');
    lines.push(`  /* ===== ${bucket.key} ===== ${bucket.label} */`);
    const subgroups = groupLeavesBySubsection(bucket.leaves);
    for (const sg of subgroups) {
      if (sg.sub) lines.push(`  /* ${bucket.key}.${sg.sub} */`);
      for (const leaf of sg.leaves) {
        const name = pathToCssName(leaf.path);
        const val = formatValueCss(leaf);
        const desc = leaf.description ? ` /** ${leaf.description.replace(/\*\//g, '* /')} */` : '';
        lines.push(`  --${name}: ${val};${desc}`);
      }
    }
  }
  lines.push('}', '');
  fs.writeFileSync(TOKENS_CSS, lines.join('\n'));
}

function writeTokensTs(buckets, root) {
  const lines = [HEADER_TS, ''];
  for (const bucket of buckets) {
    lines.push('');
    lines.push(`// ===== ${bucket.key} ===== ${bucket.label}`);
    const subgroups = groupLeavesBySubsection(bucket.leaves);
    for (const sg of subgroups) {
      if (sg.sub) lines.push(`// ${bucket.key}.${sg.sub}`);
      for (const leaf of sg.leaves) {
        const name = pathToTsName(leaf.path);
        const val = formatValueTs(leaf, root);
        const desc = leaf.description ? ` // ${leaf.description.replace(/\r?\n/g, ' ')}` : '';
        lines.push(`export const ${name} = ${val};${desc}`);
      }
    }
  }
  lines.push('');
  fs.writeFileSync(TOKENS_TS, lines.join('\n'));
}

// --- typography.css (utility classes) ----------------------------------------
function* walkTypographyTokens(node, pathSegments = []) {
  if (!node || typeof node !== 'object') return;
  if (node.$type === 'typography' && node.$value && typeof node.$value === 'object') {
    yield { path: pathSegments, value: node.$value, description: node.$description };
    return;
  }
  for (const [k, c] of Object.entries(node)) {
    if (k.startsWith('$')) continue;
    yield* walkTypographyTokens(c, [...pathSegments, k]);
  }
}

function classNameFromPath(seg) {
  return seg.map(kebab).filter(Boolean).join('-');
}

function buildTypographyCSS(root) {
  const tokens = [...walkTypographyTokens(root)];
  if (tokens.length === 0) {
    fs.writeFileSync(TYPOGRAPHY_CSS, '/* No typography tokens. */\n');
    return 0;
  }

  // Resolve `{…}` references for typography sub-properties.
  const resolveValue = (v) => {
    if (typeof v === 'string' && /^\{[^}]+\}$/.test(v.trim())) {
      const target = resolveRef(v, root);
      if (target && isLeaf(target)) return resolveValue(target.$value);
    }
    return v;
  };

  const blocks = [];
  for (const { path: tokenPath, value, description } of tokens) {
    const className = classNameFromPath(tokenPath);
    if (!className) continue;
    const family = resolveValue(value.fontFamily);
    const { weight, italic } = parseFontWeight(value.fontWeight);
    const fontSize = formatFontSize(value.fontSize);
    const lineHeight = formatLineHeight(value.lineHeight);
    const letterSpacing = formatLetterSpacing(value.letterSpacing);

    const decl = [];
    if (family) decl.push(`  font-family: ${family};`);
    if (weight !== null) decl.push(`  font-weight: ${weight};`);
    if (italic) decl.push(`  font-style: italic;`);
    if (fontSize) decl.push(`  font-size: ${fontSize};`);
    if (lineHeight) decl.push(`  line-height: ${lineHeight};`);
    if (letterSpacing !== null) decl.push(`  letter-spacing: ${letterSpacing};`);
    if (decl.length === 0) continue;

    const comment = description ? `/* ${description.replace(/\*\//g, '* /')} */\n` : '';
    blocks.push(`${comment}.${className} {\n${decl.join('\n')}\n}`);
  }

  const header =
    '/**\n' +
    ' * Do not edit directly — generated by scripts/build-tokens.mjs.\n' +
    ' * Source: src/tokens/source/*.json ($type: "typography")\n' +
    ' *\n' +
    ' * Use via CSS Modules:\n' +
    ' *   .heading { composes: text-styles-heading-1 from global; }\n' +
    ' */\n\n';
  fs.writeFileSync(TYPOGRAPHY_CSS, header + blocks.join('\n\n') + '\n');
  return tokens.length;
}

// --- token-mapping-guide.md --------------------------------------------------
const MAPPING_PREAMBLE = `<!-- Auto-generated by scripts/build-tokens.mjs. Do not edit by hand. -->
<!-- Run \`pnpm tokens:build\` to refresh. -->

# Token Mapping Guide

The single source of truth for which design tokens exist in this project,
their resolved values, and when to use each. Auto-generated from
\`src/tokens/source/*.json\` (DTCG) on every \`pnpm tokens:build\`.

## How tokens are exposed

Two consumption paths, both regenerated from the same source:

| Form | File | How to use |
|---|---|---|
| CSS custom properties | \`src/styles/tokens.css\` | \`color: var(--theme-accent-default);\` |
| TypeScript constants | \`src/styles/tokens.ts\` | \`import { ThemeAccentDefault } from '…/tokens';\` |
| Typography utility classes | \`src/styles/typography.css\` | \`.heading { composes: text-styles-heading-1 from global; }\` |

**Always reference semantic tokens over primitives.** \`--primitives-palette-*\`
are exposed for completeness but should not be consumed directly in component
code — use the \`--theme-*\`, \`--spacing-*\`, \`--radius-*\` aliases instead.

## Naming convention

Token names mirror the source path, kebab-cased and joined with \`-\`:

| Source path | CSS variable | TS export |
|---|---|---|
| \`primitives.palette.sky.500\` | \`--primitives-palette-sky-500\` | \`PrimitivesPaletteSky500\` |
| \`theme.accent.default\` | \`--theme-accent-default\` | \`ThemeAccentDefault\` |
| \`spacing.4\` | \`--spacing-4\` | \`Spacing4\` |
| \`effectStyles.blur.tailwind.layer.md\` | \`--effect-styles-blur-tailwind-layer-md\` | \`EffectStylesBlurTailwindLayerMd\` |

## Notes on special token shapes

- **Shadow tokens** (\`$type: "shadow"\`) are emitted as ready-to-use
  \`box-shadow\` strings in CSS, and as arrays of layer objects in TS.
- **Blur tokens** (\`effectStyles.blur.*\`) carry a \`{ kind, radius }\` shape;
  the CSS variable holds only the radius, so consumers compose
  \`filter: blur(var(--effect-styles-blur-tailwind-layer-md))\` for layer
  blurs and \`backdrop-filter: blur(var(--effect-styles-blur-backdrop))\`
  for backdrop blurs. The \`kind\` is preserved in the token's description.
- **Reference tokens** stay as \`var(--…)\` chains in CSS so theme overrides
  cascade naturally; the TS export resolves to the final literal value.

---

`;

const MAPPING_FOOTER = `
---

## Tips

1. **Never hardcode values.** Always reference a CSS variable or TS export.
2. **Prefer semantic over primitive.** \`--theme-*\` / \`--spacing-*\` /
   \`--radius-*\` are the consumption surface; \`--primitives-*\` are inputs.
3. **Check for state variants.** Most theme tokens have \`-default\`, \`-hover\`,
   and sometimes \`-soft\` / \`-soft-hover\` / \`-foreground\` companions.
4. **Typography tokens are composite.** Apply via
   \`composes: text-styles-<name> from global;\` — don't try to recreate them
   with individual font-* declarations.
5. **Light / dark modes.** Tokens whose source carries
   \`$extensions.modes\` switch values per active theme. The default emission
   is the light value.
`;

function renderTokenLine(leaf) {
  const cssName = pathToCssName(leaf.path);
  const tsName = pathToTsName(leaf.path);
  const css = formatValueCss(leaf);
  const desc = leaf.description ? ` — ${leaf.description.replace(/\s+/g, ' ').trim()}` : '';
  return `- \`--${cssName}\` / \`${tsName}\` — \`${css}\`${desc}`;
}

function buildTokenMappingDoc(buckets, root) {
  const sections = [];
  for (const bucket of buckets) {
    const subgroups = groupLeavesBySubsection(bucket.leaves);
    const lines = [];
    lines.push(`## ${bucket.key}`);
    lines.push('');
    lines.push(`_${bucket.label}_`);
    lines.push('');
    for (const sg of subgroups) {
      if (sg.sub) {
        lines.push(`### ${bucket.key}.${sg.sub}`);
        lines.push('');
      }
      for (const leaf of sg.leaves) lines.push(renderTokenLine(leaf));
      lines.push('');
    }
    sections.push(lines.join('\n'));
  }

  // Typography section (utility classes).
  const typoTokens = [...walkTypographyTokens(root)];
  if (typoTokens.length > 0) {
    const lines = [];
    lines.push('## textStyles');
    lines.push('');
    lines.push('_Typography composites — apply via `composes: <class> from global;`_');
    lines.push('');
    for (const t of typoTokens) {
      const cls = classNameFromPath(t.path);
      const desc = t.description ? ` — ${t.description.replace(/\s+/g, ' ').trim()}` : '';
      lines.push(`- \`.${cls}\`${desc}`);
    }
    lines.push('');
    sections.push(lines.join('\n'));
  }

  fs.mkdirSync(path.dirname(MAPPING_DOC), { recursive: true });
  fs.writeFileSync(MAPPING_DOC, MAPPING_PREAMBLE + sections.join('\n') + MAPPING_FOOTER);
  return sections.length;
}

// --- run ---------------------------------------------------------------------
const root = loadSource();
const buckets = bucketByCollection(root);
for (const b of buckets) b._root = root;

writeTokensCss(buckets);
writeTokensTs(buckets, root);
const typoCount = buildTypographyCSS(root);
const sectionCount = buildTokenMappingDoc(buckets, root);

const totalTokens = buckets.reduce((n, b) => n + b.leaves.length, 0);
console.log(
  `✔︎ ${path.relative(ROOT, TOKENS_CSS)} (${totalTokens} tokens, ${buckets.length} collections)`,
);
console.log(`✔︎ ${path.relative(ROOT, TOKENS_TS)}`);
console.log(`✔︎ ${path.relative(ROOT, TYPOGRAPHY_CSS)} (${typoCount} classes)`);
console.log(`✔︎ ${path.relative(ROOT, MAPPING_DOC)} (${sectionCount} sections)`);
