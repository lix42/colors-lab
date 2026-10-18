<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Built-in Commands vs Scripts

`vp <name>` runs a built-in command. `vp run <name>` runs a `package.json` script or a `vite.config.ts` task. Scripts cannot overwrite built-ins, so `vp dev` and `vp run dev` may do different things. Check `package.json` and `vite.config.ts` first, and run `vp run <name>` when the project defines a script or task with that name.

## Tool Versions

Run `vp toolchain` to show versions and relationships in the active Vite+
release. Add a tool name to select part of the graph. For example, run
`vp toolchain vite`. Use `--global` to ignore the local `vite-plus` package. Use
`vp why <package>` to show the package-manager dependency graph.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->

# Styling

This project styles with **Panda CSS**. The generated `styled-system/` folder is gitignored — run `vp exec panda codegen` to (re)generate it after pulling or changing `panda.config.ts`. See [`docs/panda-css.md`](docs/panda-css.md) for the day-to-day reference (imports, tokens, recipes, shorthand-vs-longhand rules, and common gotchas).

# Storybook

Component development uses **Storybook** (framework `storybook-solidjs-vite`), running on the Vite+/Rolldown fork.

- **Run it:** `vp run storybook` (dev) and `vp run build-storybook` (build) — _not_ `vp storybook`; Storybook isn't a `vp` built-in, so it only resolves via `vp run <script>`.
- **Stories** live at `src/**/*.stories.tsx` (CSF3 + `satisfies Meta<...>`). Import `Meta`/`StoryObj` from `storybook-solidjs-vite` and `fn` from `storybook/test`.
- **Panda styling in stories:** `.storybook/preview.ts` imports `src/index.css` (the `@layer` entry) so `css()` output applies; Storybook's Vite builder auto-loads `postcss.config.cjs`.
- **Gotcha:** files in `.storybook/` need `/// <reference types="vite/client" />` for CSS side-effect imports — they don't inherit the root `tsconfig.json` `types` the way `src/` does.
- Storybook's `vite` peer range (`^5`–`^8`) doesn't match the Vite+ fork's version. `pnpm-workspace.yaml` relaxes the `vite` peer via `peerDependencyRules`, but install can still print a generic peer warning; it's expected and harmless (build/dev confirmed working).
