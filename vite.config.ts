import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { defineConfig, type Plugin } from "vite-plus";
import solidPlugin from "vite-plugin-solid";
import devtools from "solid-devtools/vite";

// Generate the Panda `styled-system` artifacts as part of the build pipeline.
// `styled-system` is gitignored, and `vp build` runs the built-in build rather
// than the `package.json` "build" script, so codegen has to be wired into the
// Vite build itself to guarantee the generated files exist before modules load.
function pandaCodegen(): Plugin {
  return {
    name: "panda-codegen",
    buildStart() {
      const require = createRequire(import.meta.url);
      const bin = join(dirname(require.resolve("@pandacss/dev/package.json")), "bin.js");
      execFileSync(process.execPath, [bin, "codegen"], { stdio: "inherit" });
    },
  };
}

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  lint: { options: { typeAware: true, typeCheck: true } },
  plugins: [pandaCodegen(), devtools(), solidPlugin()],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    port: 3000,
  },
  build: {
    target: "esnext",
  },
});
