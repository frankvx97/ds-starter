#!/usr/bin/env node
/**
 * Extract design tokens (Variables + Styles) from a Figma file via the REST
 * API and write a single DTCG-format JSON file.
 *
 * Zero dependencies — pure Node 22+ built-ins.
 *
 * Usage:
 *   pnpm tokens:extract
 *   node scripts/figma-extract.mjs
 *
 * Reads FIGMA_TOKEN from process.env or .env.local, prompts otherwise.
 * Personal access token must have scopes: File content (Read), Variables (Read).
 * Variables endpoint requires a Figma Enterprise plan; on Free/Pro the script
 * falls back to styles-only extraction.
 */

import { readFile, writeFile, mkdir, rename, appendFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, relative, isAbsolute } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename), '..');

const FIGMA_API = 'https://api.figma.com/v1';
const DEFAULT_OUTPUT = 'src/tokens/source/figma.tokens.json';
const NODES_CHUNK = 50;

// ─── terminal helpers ─────────────────────────────────────────────────────

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
};

const log = {
  step: (msg) => console.log(`${c.cyan}›${c.reset} ${msg}`),
  ok: (msg) => console.log(`${c.green}✓${c.reset} ${msg}`),
  warn: (msg) => console.log(`${c.yellow}!${c.reset} ${msg}`),
  err: (msg) => console.log(`${c.red}✗${c.reset} ${msg}`),
  info: (msg) => console.log(`  ${c.dim}${msg}${c.reset}`),
  blank: () => console.log(''),
};

// ─── prompts ──────────────────────────────────────────────────────────────

async function prompt(rl, question, { default: def, validate, errorMsg } = {}) {
  while (true) {
    const hint = def ? ` ${c.dim}(${def})${c.reset}` : '';
    const answer = (await rl.question(`${c.bold}?${c.reset} ${question}${hint} `)).trim();
    const value = answer || def || '';
    if (!value) {
      log.err('This field is required.');
      continue;
    }
    if (validate && !validate(value)) {
      log.err(errorMsg || 'Invalid value, try again.');
      continue;
    }
    return value;
  }
}

async function confirm(rl, question, def = true) {
  const hint = def ? 'Y/n' : 'y/N';
  const answer = (await rl.question(`${c.bold}?${c.reset} ${question} ${c.dim}(${hint})${c.reset} `)).trim().toLowerCase();
  if (!answer) return def;
  return answer === 'y' || answer === 'yes';
}

/**
 * Print a numbered list and ask the user to pick one or more.
 * Accepts: "1,3,5" / "1 3 5" / "all" / empty (= all).
 * Returns an array of selected item objects.
 */
async function multiSelect(rl, label, items) {
  if (items.length === 0) return [];
  log.blank();
  console.log(`${c.bold}${label}${c.reset}`);
  for (const [i, item] of items.entries()) {
    console.log(`  ${c.dim}${String(i + 1).padStart(2, ' ')}.${c.reset} ${item.label}`);
  }
  while (true) {
    const raw = (await rl.question(
      `${c.bold}?${c.reset} Pick groups ${c.dim}(comma-separated, "all", empty = all)${c.reset} `,
    )).trim().toLowerCase();
    if (raw === '' || raw === 'all') return items.slice();
    const picks = raw.split(/[\s,]+/).filter(Boolean).map((s) => Number.parseInt(s, 10));
    if (picks.some((n) => !Number.isInteger(n) || n < 1 || n > items.length)) {
      log.err(`Use numbers between 1 and ${items.length}.`);
      continue;
    }
    const seen = new Set();
    const out = [];
    for (const n of picks) {
      if (seen.has(n)) continue;
      seen.add(n);
      out.push(items[n - 1]);
    }
    return out;
  }
}

// ─── .env.local ───────────────────────────────────────────────────────────

const ENV_PATH = join(ROOT, '.env.local');
const GITIGNORE_PATH = join(ROOT, '.gitignore');

async function loadEnvLocal() {
  if (!existsSync(ENV_PATH)) return {};
  const raw = await readFile(ENV_PATH, 'utf8');
  const out = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

async function saveTokenToEnvLocal(token) {
  const existing = existsSync(ENV_PATH) ? await readFile(ENV_PATH, 'utf8') : '';
  const sep = existing && !existing.endsWith('\n') ? '\n' : '';
  const next = existing.includes('FIGMA_TOKEN=')
    ? existing.replace(/^FIGMA_TOKEN=.*$/m, `FIGMA_TOKEN=${token}`)
    : `${existing}${sep}FIGMA_TOKEN=${token}\n`;
  await writeFile(ENV_PATH, next, 'utf8');

  if (existsSync(GITIGNORE_PATH)) {
    const gi = await readFile(GITIGNORE_PATH, 'utf8');
    if (!gi.split('\n').some((l) => l.trim() === '.env.local')) {
      await appendFile(GITIGNORE_PATH, gi.endsWith('\n') ? '.env.local\n' : '\n.env.local\n');
    }
  }
}

// ─── figma URL / API ──────────────────────────────────────────────────────

function parseFigmaUrl(input) {
  const trimmed = input.trim();
  // Bare key (alphanumeric, ~22 chars)
  if (/^[A-Za-z0-9]{10,}$/.test(trimmed)) return trimmed;
  const m = trimmed.match(/figma\.com\/(?:design|file|board)\/([A-Za-z0-9]+)/);
  if (m) return m[1];
  return null;
}

async function figmaFetch(path, token) {
  const url = `${FIGMA_API}${path}`;
  const res = await fetch(url, { headers: { 'X-Figma-Token': token } });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`Figma API ${res.status} on ${path}: ${body.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// ─── helpers ──────────────────────────────────────────────────────────────

const slug = (s) =>
  s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled';

const slugPath = (name) => name.split('/').map(slug).filter(Boolean);

function rgbaToHex({ r, g, b, a = 1 }) {
  const h = (n) => Math.round(Math.max(0, Math.min(1, n)) * 255).toString(16).padStart(2, '0');
  return a < 1
    ? `#${h(r)}${h(g)}${h(b)}${h(a)}`
    : `#${h(r)}${h(g)}${h(b)}`;
}

function setDeep(root, path, value) {
  let cur = root;
  for (let i = 0; i < path.length - 1; i++) {
    const seg = path[i];
    if (typeof cur[seg] !== 'object' || cur[seg] === null || '$value' in cur[seg]) {
      cur[seg] = {};
    }
    cur = cur[seg];
  }
  cur[path[path.length - 1]] = value;
}

// ─── variables ────────────────────────────────────────────────────────────

/**
 * Map a FLOAT variable's scopes to a DTCG type + value formatter.
 * - Number-ish scopes (opacity, font weight) → number
 * - Everything else → dimension(px)
 */
function floatTypeFromScopes(scopes = []) {
  const numberScopes = new Set(['OPACITY', 'FONT_WEIGHT']);
  if (scopes.some((s) => numberScopes.has(s))) return 'number';
  return 'dimension';
}

function formatVariableValue(variable, modeValue, idToPath, danglingRefs) {
  if (modeValue && typeof modeValue === 'object' && modeValue.type === 'VARIABLE_ALIAS') {
    const targetPath = idToPath.get(modeValue.id);
    if (!targetPath) {
      danglingRefs.add(modeValue.id);
      return `{unresolved.${modeValue.id}}`;
    }
    return `{${targetPath.join('.')}}`;
  }
  switch (variable.resolvedType) {
    case 'COLOR':
      return rgbaToHex(modeValue);
    case 'FLOAT':
      return floatTypeFromScopes(variable.scopes) === 'number' ? modeValue : `${modeValue}px`;
    case 'STRING':
      return String(modeValue);
    case 'BOOLEAN':
      return Boolean(modeValue);
    default:
      return modeValue;
  }
}

function dtcgTypeForVariable(variable) {
  switch (variable.resolvedType) {
    case 'COLOR':
      return 'color';
    case 'FLOAT':
      return floatTypeFromScopes(variable.scopes);
    case 'STRING':
      return 'string';
    case 'BOOLEAN':
      return 'boolean';
    default:
      return undefined;
  }
}

function buildVariableIdToPath(meta) {
  const map = new Map();
  for (const v of Object.values(meta.variables)) {
    const collection = meta.variableCollections[v.variableCollectionId];
    if (!collection) continue;
    const top = slug(collection.name);
    map.set(v.id, [top, ...slugPath(v.name)]);
  }
  return map;
}

/** Group variables by their top-level collection slug. */
function groupVariables(meta) {
  const groups = new Map(); // topSlug → { name, collection, modes, variables[] }
  for (const v of Object.values(meta.variables)) {
    if (v.hiddenFromPublishing) continue;
    const collection = meta.variableCollections[v.variableCollectionId];
    if (!collection || collection.hiddenFromPublishing) continue;
    const top = slug(collection.name);
    if (!groups.has(top)) {
      groups.set(top, {
        topSlug: top,
        kind: 'variables',
        displayName: collection.name,
        collection,
        variables: [],
      });
    }
    groups.get(top).variables.push(v);
  }
  return groups;
}

// ─── styles ───────────────────────────────────────────────────────────────

function styleTopGroup(name) {
  const parts = slugPath(name);
  return parts.length > 1 ? parts[0] : 'styles';
}

function styleSubPath(name) {
  const parts = slugPath(name);
  return parts.length > 1 ? parts.slice(1) : parts;
}

function groupStyles(styles) {
  const groups = new Map();
  for (const s of styles) {
    if (s.style_type === 'GRID') continue;
    const top = styleTopGroup(s.name);
    if (!groups.has(top)) {
      groups.set(top, {
        topSlug: top,
        kind: 'styles',
        displayName: top,
        styles: [],
      });
    }
    groups.get(top).styles.push(s);
  }
  return groups;
}

async function fetchStyleNodes(token, fileKey, ids) {
  const out = {};
  for (let i = 0; i < ids.length; i += NODES_CHUNK) {
    const chunk = ids.slice(i, i + NODES_CHUNK);
    const qs = chunk.map(encodeURIComponent).join(',');
    const data = await figmaFetch(`/files/${fileKey}/nodes?ids=${qs}`, token);
    Object.assign(out, data.nodes || {});
  }
  return out;
}

function paintToToken(paint, varIdToPath, danglingRefs) {
  // boundVariables: { color: { type: 'VARIABLE_ALIAS', id: '...' } }
  const bound = paint.boundVariables?.color;
  if (bound && bound.type === 'VARIABLE_ALIAS') {
    const target = varIdToPath.get(bound.id);
    if (!target) {
      danglingRefs.add(bound.id);
      return { $type: 'color', $value: `{unresolved.${bound.id}}` };
    }
    return { $type: 'color', $value: `{${target.join('.')}}` };
  }
  if (paint.type === 'SOLID') {
    const color = { ...paint.color, a: paint.opacity ?? paint.color.a ?? 1 };
    return { $type: 'color', $value: rgbaToHex(color) };
  }
  if (paint.type?.startsWith('GRADIENT_')) {
    const stops = (paint.gradientStops || []).map((s) => ({
      color: rgbaToHex(s.color),
      position: s.position,
    }));
    return { $type: 'gradient', $value: stops };
  }
  return null;
}

function effectsToToken(effects) {
  const shadows = effects.filter((e) => e.visible !== false && (e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW'));
  if (shadows.length === 0) return null;
  const values = shadows.map((e) => ({
    color: rgbaToHex(e.color),
    offsetX: `${e.offset?.x ?? 0}px`,
    offsetY: `${e.offset?.y ?? 0}px`,
    blur: `${e.radius ?? 0}px`,
    spread: `${e.spread ?? 0}px`,
    inset: e.type === 'INNER_SHADOW',
  }));
  return { $type: 'shadow', $value: values.length === 1 ? values[0] : values };
}

function textStyleToToken(style) {
  if (!style) return null;
  const lh = style.lineHeightPx
    ? `${style.lineHeightPx}px`
    : style.lineHeightPercent
      ? `${style.lineHeightPercent}%`
      : undefined;
  const ls = style.letterSpacing != null ? `${style.letterSpacing}px` : undefined;
  const value = {
    fontFamily: style.fontFamily,
    fontWeight: style.fontWeight,
    fontSize: style.fontSize != null ? `${style.fontSize}px` : undefined,
  };
  if (lh) value.lineHeight = lh;
  if (ls) value.letterSpacing = ls;
  if (style.textCase && style.textCase !== 'ORIGINAL') value.textCase = style.textCase;
  if (style.textDecoration && style.textDecoration !== 'NONE') value.textDecoration = style.textDecoration;
  return { $type: 'typography', $value: value };
}

function styleNodeToToken(style, node, varIdToPath, danglingRefs) {
  const doc = node?.document;
  if (!doc) return null;
  if (style.style_type === 'FILL') {
    const paint = doc.fills?.[0];
    return paint ? paintToToken(paint, varIdToPath, danglingRefs) : null;
  }
  if (style.style_type === 'EFFECT') {
    return doc.effects?.length ? effectsToToken(doc.effects) : null;
  }
  if (style.style_type === 'TEXT') {
    return textStyleToToken(doc.style);
  }
  return null;
}

// ─── output assembly ──────────────────────────────────────────────────────

function buildVariableTokens(group, idToPath, danglingRefs) {
  const root = {};
  const collection = group.collection;
  const modes = collection.modes;
  const defaultModeId = collection.defaultModeId;
  const defaultMode = modes.find((m) => m.modeId === defaultModeId) ?? modes[0];

  for (const v of group.variables) {
    const subPath = slugPath(v.name);
    if (subPath.length === 0) continue;
    const $type = dtcgTypeForVariable(v);
    if (!$type) continue;

    const $value = formatVariableValue(v, v.valuesByMode[defaultMode.modeId], idToPath, danglingRefs);
    const token = { $type, $value };

    if (modes.length > 1) {
      const modesObj = {};
      for (const m of modes) {
        modesObj[m.name] = formatVariableValue(v, v.valuesByMode[m.modeId], idToPath, danglingRefs);
      }
      token.$extensions = { 'com.figma': { variableId: v.id }, modes: modesObj };
    } else {
      token.$extensions = { 'com.figma': { variableId: v.id } };
    }
    if (v.description) token.$description = v.description;

    setDeep(root, subPath, token);
  }
  return root;
}

function buildStyleTokens(group, nodesById, varIdToPath, danglingRefs, warnings) {
  const root = {};
  for (const s of group.styles) {
    const node = nodesById[s.node_id];
    const token = styleNodeToToken(s, node, varIdToPath, danglingRefs);
    if (!token) {
      warnings.push(`Skipped style "${s.name}" (${s.style_type}) — unsupported or empty.`);
      continue;
    }
    token.$extensions = { ...(token.$extensions || {}), 'com.figma': { styleKey: s.key, nodeId: s.node_id } };
    if (s.description) token.$description = s.description;
    const subPath = styleSubPath(s.name);
    if (subPath.length === 0) continue;
    setDeep(root, subPath, token);
  }
  return root;
}

// ─── main ─────────────────────────────────────────────────────────────────

async function resolveToken(rl) {
  const fromProcess = process.env.FIGMA_TOKEN;
  if (fromProcess) return { token: fromProcess, source: 'env' };
  const envLocal = await loadEnvLocal();
  if (envLocal.FIGMA_TOKEN) return { token: envLocal.FIGMA_TOKEN, source: '.env.local' };

  log.info('No FIGMA_TOKEN found in env or .env.local.');
  log.info('Create a personal access token at https://www.figma.com/settings');
  log.info('Required scopes: File content (Read), Variables (Read).');
  const token = await prompt(rl, 'Paste your Figma personal access token:', {
    validate: (s) => s.length > 20,
    errorMsg: 'That does not look like a Figma token.',
  });
  const save = await confirm(rl, 'Save it to .env.local for next time?', true);
  if (save) {
    await saveTokenToEnvLocal(token);
    log.ok('Saved to .env.local');
  }
  return { token, source: 'prompt' };
}

async function resolveOutputPath(rl) {
  const useDefault = await confirm(rl, `Write to default path "${DEFAULT_OUTPUT}"?`, true);
  if (useDefault) return resolve(ROOT, DEFAULT_OUTPUT);

  const rel = await prompt(rl, 'Output path (relative to repo root):', {
    default: DEFAULT_OUTPUT,
    validate: (s) => !s.split(/[/\\]/).includes('..') && !isAbsolute(s),
    errorMsg: 'Must be a relative path inside the repo (no "..").',
  });
  return resolve(ROOT, rel);
}

async function writeAtomic(absPath, json) {
  await mkdir(dirname(absPath), { recursive: true });
  const tmp = `${absPath}.tmp`;
  await writeFile(tmp, json, 'utf8');
  await rename(tmp, absPath);
}

async function main() {
  log.blank();
  console.log(`${c.bold}${c.cyan}figma-extract${c.reset} ${c.dim}— Figma → DTCG JSON${c.reset}`);
  log.blank();

  const rl = createInterface({ input, output });
  const danglingRefs = new Set();
  const warnings = [];

  try {
    // 1. Token
    const { token, source } = await resolveToken(rl);
    log.ok(`Using FIGMA_TOKEN from ${source}`);

    // 2. File key
    const fileInput = await prompt(rl, 'Figma file URL or key:', {
      validate: (s) => parseFigmaUrl(s) !== null,
      errorMsg: 'Could not extract a file key. Paste a figma.com/design/... URL or the bare key.',
    });
    const fileKey = parseFigmaUrl(fileInput);
    log.info(`File key: ${fileKey}`);

    // 3. Fetch variables (best-effort)
    log.blank();
    log.step('Fetching variables…');
    let variableMeta = null;
    try {
      const data = await figmaFetch(`/files/${fileKey}/variables/local`, token);
      variableMeta = data.meta;
      const count = Object.keys(variableMeta.variables || {}).length;
      log.ok(`Got ${count} variable${count === 1 ? '' : 's'} across ${Object.keys(variableMeta.variableCollections || {}).length} collection(s).`);
    } catch (err) {
      if (err.status === 403) {
        log.warn('Variables endpoint returned 403 — your Figma plan likely is not Enterprise. Continuing with styles only.');
      } else if (err.status === 404) {
        log.warn('Variables endpoint returned 404 — file has no local variables. Continuing with styles only.');
      } else {
        throw err;
      }
    }

    // 4. Fetch styles
    log.step('Fetching styles…');
    const stylesResp = await figmaFetch(`/files/${fileKey}/styles`, token);
    const allStyles = (stylesResp.meta?.styles || []).filter((s) => s.style_type !== 'GRID');
    log.ok(`Got ${allStyles.length} style${allStyles.length === 1 ? '' : 's'}.`);

    // 5. Build alias map (always includes all variables, even unselected)
    const idToPath = variableMeta ? buildVariableIdToPath(variableMeta) : new Map();

    // 6. Group + multi-select
    const variableGroups = variableMeta ? groupVariables(variableMeta) : new Map();
    const styleGroups = groupStyles(allStyles);

    const items = [
      ...[...variableGroups.values()].map((g) => ({
        ...g,
        label: `${c.cyan}[V]${c.reset} ${g.displayName}  ${c.dim}(${g.variables.length} vars, ${g.collection.modes.length} mode${g.collection.modes.length === 1 ? '' : 's'})${c.reset}`,
      })),
      ...[...styleGroups.values()].map((g) => ({
        ...g,
        label: `${c.yellow}[S]${c.reset} ${g.displayName}/  ${c.dim}(${g.styles.length} style${g.styles.length === 1 ? '' : 's'})${c.reset}`,
      })),
    ];

    if (items.length === 0) {
      log.warn('Nothing to export — file has no published variables or styles you can extract.');
      rl.close();
      return;
    }

    const selected = await multiSelect(rl, 'Top-level groups to export:', items);
    if (selected.length === 0) {
      log.warn('No groups selected. Exiting.');
      rl.close();
      return;
    }

    // 7. Resolve style nodes (only for selected style groups)
    const selectedStyleGroups = selected.filter((g) => g.kind === 'styles');
    let nodesById = {};
    if (selectedStyleGroups.length > 0) {
      const ids = selectedStyleGroups.flatMap((g) => g.styles.map((s) => s.node_id));
      log.step(`Resolving ${ids.length} style node${ids.length === 1 ? '' : 's'}…`);
      nodesById = await fetchStyleNodes(token, fileKey, ids);
    }

    // 8. Output path
    log.blank();
    const outPath = await resolveOutputPath(rl);

    rl.close();

    // 9. Build DTCG output
    log.blank();
    log.step('Building DTCG output…');
    const out = {
      $description: `Generated by scripts/figma-extract.mjs from Figma file ${fileKey}.`,
      $figma: {
        fileKey,
        exportedAt: new Date().toISOString(),
        groups: selected.map((g) => g.topSlug),
      },
    };

    for (const g of selected) {
      const tokens =
        g.kind === 'variables'
          ? buildVariableTokens(g, idToPath, danglingRefs)
          : buildStyleTokens(g, nodesById, idToPath, danglingRefs, warnings);
      // Merge into existing top-level if both a variable collection and a style group share a slug
      out[g.topSlug] = { ...(out[g.topSlug] || {}), ...tokens };
    }

    // 10. Write
    await writeAtomic(outPath, JSON.stringify(out, null, 2) + '\n');
    log.ok(`Wrote ${relative(ROOT, outPath)}`);

    // 11. Warnings summary
    if (warnings.length > 0) {
      log.blank();
      log.warn(`${warnings.length} skipped item${warnings.length === 1 ? '' : 's'}:`);
      for (const w of warnings.slice(0, 10)) log.info(w);
      if (warnings.length > 10) log.info(`…and ${warnings.length - 10} more.`);
    }
    if (danglingRefs.size > 0) {
      log.blank();
      log.warn(`${danglingRefs.size} unresolved alias reference${danglingRefs.size === 1 ? '' : 's'} — the target variable was not in the selected groups.`);
      log.info('Re-run and include the referenced collection to resolve them.');
    }

    log.blank();
    log.ok(`${c.bold}Done.${c.reset}`);
    log.info(`Run ${c.bold}pnpm tokens:build${c.reset} to compile into CSS + TS.`);
    log.blank();
  } catch (err) {
    rl.close();
    log.blank();
    if (err.status === 401) log.err('Figma rejected the token (401). Double-check the PAT.');
    else if (err.status === 404) log.err('File not found (404). Check the URL/key and that the token can access it.');
    else log.err(err.message);
    process.exit(1);
  }
}

main();
