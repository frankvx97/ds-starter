# Icons

Drop your exported **SVG** icons here.

- Naming: kebab-case, prefixed `icon-`. Example: `icon-search.svg`, `icon-arrow-right.svg`.
- Keep viewBox consistent (typically `0 0 24 24`).
- Strip hard-coded colors — use `currentColor` for fills/strokes so they can be themed via CSS.

An icon pipeline (SVGR, sprite, or runtime loader) is **not wired yet** — the
repo intentionally leaves the decision to your team. When you pick one, wire it
up in `vite.config.ts` and expose icons from `src/components/atoms/Icon/`.
