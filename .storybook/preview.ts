/// <reference types="vite/client" />
import type { Preview } from "storybook-solidjs-vite";
// Pulls in Panda's `@layer` entry so the generated `css()` styles apply in stories.
// PostCSS (postcss.config.cjs) processes this through @pandacss/dev at build time.
import "../src/index.css";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
