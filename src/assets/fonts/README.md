# Fonts

Drop web font files here.

- Preferred format: **WOFF2** (variable fonts where available).
- Naming: `FamilyName-Weight.woff2` or `FamilyName-Variable.woff2`.
- Register each family via `@font-face` in `src/styles/global.css`.

Example:

```css
@font-face {
  font-family: 'Inter';
  src: url('../assets/fonts/Inter-Variable.woff2') format('woff2-variations');
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}
```

Then reference `font-family: 'Inter', sans-serif` via a typography token in
`src/foundations/tokens/source/typography.tokens.json`.
