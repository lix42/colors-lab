import { defineConfig } from "@pandacss/dev";

export default defineConfig({
  // v2 no longer injects these implicitly; without them there are no default utilities, tokens or conditions
  presets: ["@pandacss/preset-base", "@pandacss/preset-panda"],

  // Whether to use css reset
  preflight: true,

  // Where to look for your css declarations
  include: ["./src/**/*.{js,jsx,ts,tsx}"],

  // Files to exclude
  exclude: [],

  // Useful for theme customization
  theme: {
    extend: {},
  },

  // The output directory for your css system
  outdir: "styled-system",
});
