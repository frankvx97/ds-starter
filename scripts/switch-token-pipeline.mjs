#!/usr/bin/env node
/**
 * Switch between the two mutually exclusive token pipelines:
 *
 *   sd   → Style Dictionary (src/tokens/source/ → generated CSS)
 *   sot  → Tokens SOT       (src/tokens/raw/*.css imported as-is)
 *
 * Usage:
 *   pnpm tokens:switch sd
 *   pnpm tokens:switch sot
 *
 * What it does:
 *   1. Rewrites src/styles/global.css so only the chosen branch is active.
 *   2. Moves the unused pipeline's files into .token-pipeline-backup/<mode>/
 *      (so nothing is destroyed; switch back to restore).
 *   3. Restores files from .token-pipeline-backup/<mode>/ if present.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const GLOBAL_CSS = join(ROOT, 'src/styles/global.css');
const BACKUP_ROOT = join(ROOT, '.token-pipeline-backup');

const PATHS = {
  sd: [
    'src/tokens/source',
    'src/styles/tokens.css',
    'src/styles/tokens.ts',
    'src/styles/typography.css',
  ],
  sot: ['src/tokens/raw'],
};

const SD_BRANCH_RE = /\/\* ── \(A\) Style Dictionary path — (ACTIVE|DISABLED) ───+ \*\/\n([\s\S]*?)(?=\n\/\* ── \(B\))/;
const SOT_BRANCH_RE = /\/\* ── \(B\) Tokens SOT path — (ACTIVE|DISABLED) ───+ \*\/\n([\s\S]*?)(?=\n\/\* Font-face)/;

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

function toggleBranches(mode) {
  if (!existsSync(GLOBAL_CSS)) fail(`Missing ${GLOBAL_CSS}`);
  let css = readFileSync(GLOBAL_CSS, 'utf8');

  const sdMatch = css.match(SD_BRANCH_RE);
  const sotMatch = css.match(SOT_BRANCH_RE);
  if (!sdMatch || !sotMatch) {
    fail('Could not locate the (A)/(B) branch markers in global.css. Has it been hand-edited?');
  }

  const setBranch = (block, label, active) => {
    const header = `/* ── (${label.startsWith('(A)') ? 'A) Style Dictionary' : 'B) Tokens SOT'} path — ${active ? 'ACTIVE' : 'DISABLED'} ───────────────────────── */\n`;
    // Strip existing comment wrappers.
    let body = block
      .replace(/^\/\*\n/, '')
      .replace(/\n\*\/\n?$/, '')
      .trim();
    if (!body) body = '';
    const wrapped = active ? `${body}\n` : `/*\n${body}\n*/\n`;
    return header + wrapped;
  };

  css = css.replace(SD_BRANCH_RE, setBranch(sdMatch[2], '(A)', mode === 'sd'));
  css = css.replace(SOT_BRANCH_RE, setBranch(sotMatch[2], '(B)', mode === 'sot'));

  writeFileSync(GLOBAL_CSS, css);
  console.log(`✓ global.css: activated ${mode === 'sd' ? '(A) Style Dictionary' : '(B) Tokens SOT'}`);
}

function moveToBackup(relPath, mode) {
  const src = join(ROOT, relPath);
  if (!existsSync(src)) return;
  const dest = join(BACKUP_ROOT, mode, relPath);
  mkdirSync(dirname(dest), { recursive: true });
  if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
  renameSync(src, dest);
  console.log(`  ↳ backed up ${relPath} → .token-pipeline-backup/${mode}/`);
}

function restoreFromBackup(relPath, mode) {
  const src = join(BACKUP_ROOT, mode, relPath);
  const dest = join(ROOT, relPath);
  if (!existsSync(src)) return false;
  mkdirSync(dirname(dest), { recursive: true });
  renameSync(src, dest);
  console.log(`  ↳ restored ${relPath} from .token-pipeline-backup/${mode}/`);
  return true;
}

function pruneEmptyBackup(mode) {
  const dir = join(BACKUP_ROOT, mode);
  if (!existsSync(dir)) return;
  const walk = (d) => {
    const entries = readdirSync(d, { withFileTypes: true });
    for (const e of entries) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
    }
    if (readdirSync(d).length === 0) rmSync(d, { recursive: true, force: true });
  };
  walk(dir);
  if (existsSync(BACKUP_ROOT) && readdirSync(BACKUP_ROOT).length === 0) {
    rmSync(BACKUP_ROOT, { recursive: true, force: true });
  }
}

function switchTo(mode) {
  if (!['sd', 'sot'].includes(mode)) fail(`Unknown mode "${mode}". Use "sd" or "sot".`);

  const keep = mode;
  const drop = mode === 'sd' ? 'sot' : 'sd';

  console.log(`→ Switching token pipeline to: ${keep === 'sd' ? 'Style Dictionary' : 'Tokens SOT'}`);

  // Restore files for the chosen mode (if previously backed up).
  for (const p of PATHS[keep]) restoreFromBackup(p, keep);

  // Move unused mode's files into backup.
  for (const p of PATHS[drop]) moveToBackup(p, drop);

  toggleBranches(mode);
  pruneEmptyBackup(keep);

  console.log('\nDone. Next steps:');
  if (mode === 'sd') {
    console.log('  • pnpm tokens:build        # regenerate tokens.css + typography.css');
  } else {
    console.log('  • Drop your Tokens SOT *.css exports into src/tokens/raw/');
    console.log('  • Update the @import list in src/styles/global.css to match.');
  }
  console.log('  • Unused files are preserved under .token-pipeline-backup/ — delete it once you are sure.');
}

const mode = process.argv[2];
if (!mode) {
  console.log('Usage: pnpm tokens:switch <sd|sot>');
  process.exit(0);
}
switchTo(mode);
