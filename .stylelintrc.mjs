/**
 * Stylelint config for ds-starter.
 *
 * Primary purpose: enforce the two-tier token contract.
 *
 *   - Primitives (`--palette-*`) are raw values. They exist ONLY to feed
 *     semantic tokens inside `src/tokens/raw/theme-*.css` (and `docs-*.css`).
 *   - Component CSS (and any other consumer) MUST use semantic tokens
 *     (`--color-*`, `--space-*`, `--radius-*`, `--accent-*`, etc.) — never
 *     a primitive directly.
 *
 * Reaching into a primitive bypasses theming (light/dark won't switch) and
 * couples the component to a specific palette value.
 */
export default {
  extends: ['stylelint-config-standard'],
  rules: {
    'declaration-property-value-disallowed-list': [
      { '/.*/': [/var\(\s*--palette-/] },
      {
        message:
          'Do not use primitive tokens (--palette-*) directly. Use a semantic token (--color-*, --accent-*, --space-*, etc.) instead. If none fits, propose a new semantic token in src/tokens/raw/theme-*.css.',
        severity: 'error',
      },
    ],
    // CSS Modules use :global / composes; don't fight them.
    'selector-pseudo-class-no-unknown': [true, { ignorePseudoClasses: ['global'] }],
    'property-no-unknown': [true, { ignoreProperties: ['composes'] }],
    // Tokens SOT exports use a wide variety of naming styles; avoid noise.
    'custom-property-pattern': null,
    'selector-class-pattern': null,
    'no-descending-specificity': null,
  },
  ignoreFiles: [
    // Token sources (Tokens SOT plugin output + Style Dictionary output).
    // These are imported as-is; we don't lint or rewrite them.
    'src/tokens/raw/**',
    'src/styles/generated/**',
    'src/styles/tokens.css',
    'src/styles/typography.css',
    // Build artifacts and deps.
    'dist/**',
    'storybook-static/**',
    'node_modules/**',
    '.token-pipeline-backup/**',
  ],
};
