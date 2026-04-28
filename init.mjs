#!/usr/bin/env node
/**
 * Workshop init script.
 *
 * Personalizes a freshly-degit'd ds-starter clone:
 *   1. Prompts for package name + GitHub org/user
 *   2. Updates package.json (name, description, repository.url)
 *   3. Updates README.md (title + any ds-starter references)
 *   4. Initializes a fresh git repo with an initial commit
 *   5. Deletes itself
 *
 * Usage:
 *   node scripts/init.mjs
 *
 * Zero dependencies — uses only Node built-ins.
 */

import { readFile, writeFile, unlink, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname);

// ─── tiny terminal helpers ────────────────────────────────────────────────

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

// ─── validation ───────────────────────────────────────────────────────────

// npm package name rules: lowercase, no spaces, can include - _ . and / for scopes
const validateScope = (s) => /^[a-z0-9][a-z0-9-]*$/.test(s);
const validatePackageName = (s) => /^[a-z0-9][a-z0-9-_.]*$/.test(s);

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

// ─── file edits ───────────────────────────────────────────────────────────

async function updatePackageJson({ scope, name, description, githubUrl }) {
  const path = join(ROOT, 'package.json');
  const raw = await readFile(path, 'utf8');
  const pkg = JSON.parse(raw);

  pkg.name = scope ? `@${scope}/${name}` : name;
  pkg.version = '0.0.0';
  if (description) pkg.description = description;
  pkg.repository = { type: 'git', url: `git+${githubUrl}.git` };

  // Keep stable key ordering by writing back with 2-space indent + trailing newline
  await writeFile(path, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  log.ok(`Updated package.json → name: ${pkg.name}`);
}

async function updateReadme({ scope, name, description }) {
  const path = join(ROOT, 'README.md');
  if (!existsSync(path)) {
    log.warn('No README.md found, skipping.');
    return;
  }

  const fullName = scope ? `@${scope}/${name}` : name;
  const title = `# ${fullName}\n\n${description || 'A design system built from the ds-starter scaffold.'}\n`;

  // Replace the first heading + first paragraph; preserve everything else.
  const original = await readFile(path, 'utf8');
  const lines = original.split('\n');
  const firstHeadingIdx = lines.findIndex((l) => l.startsWith('# '));

  let updated;
  if (firstHeadingIdx === -1) {
    // No heading at all — prepend the new title
    updated = title + '\n' + original;
  } else {
    // Find the end of the intro paragraph (next blank line after the heading)
    let endIdx = firstHeadingIdx + 1;
    while (endIdx < lines.length && lines[endIdx].trim() !== '') endIdx++;
    // Replace [firstHeading, endIdx) with the new title
    updated = [
      ...lines.slice(0, firstHeadingIdx),
      title.trimEnd(),
      ...lines.slice(endIdx),
    ].join('\n');
  }

  await writeFile(path, updated, 'utf8');
  log.ok(`Updated README.md`);
}

// ─── git ──────────────────────────────────────────────────────────────────

function isGitRepo() {
  try {
    execSync('git rev-parse --is-inside-work-tree', { cwd: ROOT, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function initGit() {
  try {
    execSync('git init -b main', { cwd: ROOT, stdio: 'ignore' });
    execSync('git add -A', { cwd: ROOT, stdio: 'ignore' });
    execSync('git commit -m "chore: initial commit from ds-starter"', { cwd: ROOT, stdio: 'ignore' });
    log.ok('Initialized fresh git repo with initial commit');
  } catch (err) {
    log.warn('Could not initialize git automatically — you can run `git init` manually.');
    log.info(err.message);
  }
}

// ─── self-cleanup ─────────────────────────────────────────────────────────

async function selfDestruct() {
  // Remove this script and the scripts/ directory if it's now empty.
  try {
    await unlink(__filename);
    const scriptsDir = __dirname;
    const { readdir } = await import('node:fs/promises');
    const remaining = await readdir(scriptsDir);
    if (remaining.length === 0) {
      await rm(scriptsDir, { recursive: true, force: true });
    }
    log.ok('Cleaned up init script');
  } catch (err) {
    log.warn('Could not delete init script — remove scripts/init.mjs manually.');
  }
}

// ─── main ─────────────────────────────────────────────────────────────────

async function main() {
  log.blank();
  console.log(`${c.bold}${c.cyan}ds-starter${c.reset} ${c.dim}— project setup${c.reset}`);
  log.blank();
  log.info("Let's personalize your design system. Press Enter to accept defaults.");
  log.blank();

  if (isGitRepo()) {
    log.warn('A .git directory already exists in this project.');
    log.info('If you cloned with degit this should not happen — continuing anyway.');
    log.blank();
  }

  const rl = createInterface({ input, output });

  try {
    const scope = await prompt(rl, 'GitHub org or username (used for the package scope)?', {
      validate: validateScope,
      errorMsg: 'Use lowercase letters, numbers, and hyphens only.',
    });

    const name = await prompt(rl, 'Package name?', {
      default: 'design-system',
      validate: validatePackageName,
      errorMsg: 'Use lowercase letters, numbers, and - _ . only.',
    });

    const description = await prompt(rl, 'One-line description?', {
      default: "My team’s design system.",
    });

    const githubUrl = `https://github.com/${scope}/${name}`;

    log.blank();
    log.step('Summary');
    log.info(`  package name:  @${scope}/${name}`);
    log.info(`  description:   ${description}`);
    log.info(`  repository:    ${githubUrl}`);
    log.blank();

    const proceed = await confirm(rl, 'Apply these changes?', true);
    if (!proceed) {
      log.warn('Aborted. No files were changed.');
      rl.close();
      return;
    }

    rl.close();

    log.blank();
    log.step('Updating files…');
    await updatePackageJson({ scope, name, description, githubUrl });
    await updateReadme({ scope, name, description });

    log.blank();
    log.step('Setting up git…');
    if (!isGitRepo()) initGit();
    else log.info('Skipped (existing .git found).');

    log.blank();
    log.step('Tidying up…');
    await selfDestruct();

    log.blank();
    log.ok(`${c.bold}All set.${c.reset}`);
    log.blank();
    log.info('Next steps:');
    log.info('  1.  pnpm install');
    log.info('  2.  pnpm dev');
    log.info(`  3.  Create the repo on GitHub:  gh repo create ${scope}/${name} --private --source=. --push`);
    log.blank();
  } catch (err) {
    rl.close();
    log.blank();
    log.err(`Something went wrong: ${err.message}`);
    process.exit(1);
  }
}

main();
