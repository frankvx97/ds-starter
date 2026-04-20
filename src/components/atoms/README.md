# Atoms

Smallest indivisible UI primitives: `Button`, `Input`, `Icon`, `Badge`, `Avatar`, etc.

## File layout for a new atom

```
atoms/Button/
├── Button.tsx              # component
├── Button.module.css       # styles (CSS Modules) — consume var(--…) tokens only
├── Button.stories.tsx      # Storybook story
├── Button.test.tsx         # Vitest + @testing-library/react
└── index.ts                # re-export
```

Then add to the library's public API in `src/index.ts`:

```ts
export * from './components/atoms/Button';
```
