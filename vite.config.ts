import { defineConfig } from "vite-plus";
import solidPlugin from "vite-plugin-solid";
import devtools from "solid-devtools/vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  lint: { options: { typeAware: true, typeCheck: true } },
  plugins: [devtools(), solidPlugin(), tsconfigPaths()],
  server: {
    port: 3000,
  },
  build: {
    target: "esnext",
  },
});
