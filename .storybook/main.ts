import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  framework: '@storybook/react-vite',
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(ts|tsx|js|jsx)'],
  addons: ['@storybook/addon-a11y'],
  typescript: {
    reactDocgen: 'react-docgen',
  },
};

export default config;
