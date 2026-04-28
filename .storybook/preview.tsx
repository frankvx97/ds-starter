import { useEffect } from 'react';
import type { Preview } from '@storybook/react-vite';
import { DocsContainer } from '@storybook/addon-docs/blocks';
import type { DocsContextProps } from '@storybook/addon-docs/blocks';
import '../src/styles/global.css';

type ThemeValue = 'light' | 'dark' | 'system';

function applyTheme(theme: ThemeValue) {
  const root = document.documentElement;
  if (theme === 'system') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', theme);
  }
}

function ThemedDocsContainer({
  context,
  children,
}: {
  context: DocsContextProps;
  children: React.ReactNode;
}) {
  let theme: ThemeValue = 'light';
  try {
    theme = (context.storyById()?.globals?.theme ?? 'light') as ThemeValue;
  } catch {
    // MDX-only docs page with no attached story — fall back to light.
  }
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);
  applyTheme(theme);
  return <DocsContainer context={context}>{children}</DocsContainer>;
}

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    docs: {
      container: ThemedDocsContainer,
    },
    options: {
      storySort: {
        order: [
          'Introduction',
          'Foundations',
          [
            'Primitives',
            'Theme',
            ['Light', 'Dark'],
            'Focus',
            'Shadows',
            'Blur',
            'Typography',
            ['Font', 'Text Styles'],
            'Radius',
            'Spacing',
            'Breakpoints',
            'Tailwind Utilities',
          ],
          'Atoms',
          'Molecules',
          'Organisms',
          '*',
        ],
      },
    },
  },
  globalTypes: {
    theme: {
      description: 'Active theme — flips data-theme on <html>',
      defaultValue: 'light',
      toolbar: {
        title: 'Theme',
        icon: 'paintbrush',
        items: [
          { value: 'light', icon: 'sun', title: 'Light' },
          { value: 'dark', icon: 'moon', title: 'Dark' },
          { value: 'system', icon: 'browser', title: 'System' },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, context) => {
      const theme = context.globals.theme as ThemeValue;
      useEffect(() => {
        applyTheme(theme);
      }, [theme]);
      applyTheme(theme);
      return Story();
    },
  ],
};

export default preview;
