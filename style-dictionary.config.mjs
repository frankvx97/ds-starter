/**
 * Style Dictionary v5 config — ESM, DTCG-compatible.
 *
 * Input:  src/foundations/tokens/source/**\/*.json   (DTCG / Tokens Studio format supported)
 * Output: src/styles/tokens.css      (CSS custom properties)
 *         src/styles/tokens.ts       (TypeScript constants)
 *
 * Tokens in Tokens SOT CSS/SCSS format go into src/foundations/tokens/raw/
 * and are imported directly from src/styles/global.css (they bypass this build).
 */

/** @type {import('style-dictionary/types').Config} */
export default {
  source: ['src/foundations/tokens/source/**/*.json'],
  platforms: {
    css: {
      transformGroup: 'css',
      buildPath: 'src/styles/',
      files: [
        {
          destination: 'tokens.css',
          format: 'css/variables',
          options: { outputReferences: true },
        },
      ],
    },
    ts: {
      transformGroup: 'js',
      buildPath: 'src/styles/',
      files: [
        {
          destination: 'tokens.ts',
          format: 'javascript/es6',
        },
      ],
    },
  },
  log: {
    warnings: 'warn',
    verbosity: 'default',
    errors: { brokenReferences: 'throw' },
  },
};
