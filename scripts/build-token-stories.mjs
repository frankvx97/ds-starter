#!/usr/bin/env node
/**
 * Parses src/tokens/raw/*.css and emits a JSON manifest consumed by the
 * Foundations MDX stories in src/docs/foundations/.
 *
 * Run via:
 *   pnpm tokens:stories         # one-shot
 *   pnpm tokens:stories:watch   # rebuild on raw/*.css changes
 */
import { mkdirSync, readFileSync, watch, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rawDir = resolve(__dirname, '../src/tokens/raw');
const outFile = resolve(__dirname, '../src/docs/foundations/_generated/tokens.json');

const FILES = [
  'primitives',
  'theme-light',
  'theme-dark',
  'focus',
  'shadow',
  'blur',
  'typography',
  'text-styles',
  'radius',
  'spacing',
  'breakpoints',
  'tailwind',
];

/** Pull every `--name: value;` declaration from the top-level :root block. */
function parseVars(css) {
  const out = [];
  const re = /--([a-z0-9-]+)\s*:\s*([^;]+);/gi;
  let m;
  while ((m = re.exec(css)) !== null) {
    out.push({ name: `--${m[1]}`, value: m[2].trim() });
  }
  return out;
}

/** Pull every class ruleset (`.foo { ... }`) into { selector, declarations }. */
function parseClasses(css) {
  const out = [];
  const re = /\.([a-z0-9_-]+)\s*\{([^}]+)\}/gi;
  let m;
  while ((m = re.exec(css)) !== null) {
    const declarations = {};
    for (const line of m[2].split(';')) {
      const [k, ...rest] = line.split(':');
      if (!k || !rest.length) continue;
      declarations[k.trim()] = rest.join(':').trim();
    }
    out.push({ selector: `.${m[1]}`, declarations });
  }
  return out;
}

function read(name) {
  return readFileSync(join(rawDir, `${name}.css`), 'utf8');
}

function build() {
  const manifest = {
    generatedAt: new Date().toISOString(),
    primitives: parseVars(read('primitives')),
    theme: {
      light: parseVars(read('theme-light')),
      dark: parseVars(read('theme-dark')),
    },
    focus: parseVars(read('focus')),
    shadow: parseVars(read('shadow')),
    blur: {
      vars: parseVars(read('blur')),
      utilities: parseClasses(read('blur')),
    },
    typography: {
      font: parseVars(read('typography')),
      textStyles: parseClasses(read('text-styles')),
    },
    radius: parseVars(read('radius')),
    spacing: parseVars(read('spacing')),
    breakpoints: parseVars(read('breakpoints')),
    tailwind: {
      vars: parseVars(read('tailwind')),
      utilities: parseClasses(read('tailwind')),
    },
  };

  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, JSON.stringify(manifest, null, 2));
  // eslint-disable-next-line no-console
  console.log(`[tokens:stories] wrote ${outFile}`);
}

build();

if (process.argv.includes('--watch')) {
  // eslint-disable-next-line no-console
  console.log(`[tokens:stories] watching ${rawDir}`);
  let timer;
  watch(rawDir, { persistent: true }, (_event, filename) => {
    if (!filename || !filename.endsWith('.css')) return;
    clearTimeout(timer);
    timer = setTimeout(build, 50);
  });
}
