# Panda CSS Quick Reference

## Regenerating the Design System

Run after config changes or pulling remote changes:

```sh
pnpm panda codegen
```

The `styled-system/` folder is generated output — do not commit it, treat it like `node_modules`. Add `prepare: "panda codegen"` to `package.json` so it regenerates on install.

Watch mode during development:

```sh
pnpm panda --watch
```

Debug token/style extraction:

```sh
pnpm panda debug
```

## What to Import

```ts
import { css } from "../styled-system/css"; // style function
import { cva } from "../styled-system/css"; // atomic recipe (CVA)
import { token } from "../styled-system/tokens"; // token value at runtime
import { stack, flex, grid } from "../styled-system/patterns";
import { button } from "../styled-system/recipes"; // config recipe
```

## Root CSS Layer Order

Must appear before any component styles:

```css
@layer reset, base, tokens, recipes, utilities;
```

`utilities` beats `recipes`. Miss this and specificity behaves unexpectedly.

## Tokens

Reference a token value in TypeScript/JS:

```ts
token("colors.blue.200");
```

CSS variables are auto-generated. In style values, reference tokens with curly braces:

```ts
css({ color: "{colors.blue.200}" });
```

Semantic tokens support conditions (light/dark, etc.):

```ts
semanticTokens: {
  colors: {
    success: { value: { _light: '{colors.green500}', _dark: '{colors.green200}' } }
  }
}
```

## Recipes vs Patterns

|               | Config Recipes              | Atomic Recipes (cva)       |
| ------------- | --------------------------- | -------------------------- |
| Defined in    | `panda.config.ts > recipes` | inline with `cva()`        |
| CSS generated | only used variants          | all variants upfront       |
| Best for      | design system tokens        | colocated component styles |

Split variant props from style props in config recipes:

```ts
import { button, type ButtonVariantProps } from "../styled-system/recipes";
const [variantProps, rest] = button.splitVariantProps(props);
```

Slot recipes handle compound components where multiple elements share variants.

## Shorthand vs Longhand Conflicts

Panda shorthands are its own aliases: `p` → `padding`, `pt` → `paddingTop`, `bg` → `backgroundColor`, `rounded` → `borderRadius`, etc.

When a Panda shorthand and its longhand (full property name) conflict, **the shorthand wins** and the longhand is dropped entirely:

```ts
css({ paddingTop: "20px", pt: "10px" }); // pt wins → only pt_10px class generated
css({ padding: "20px", p: "10px" }); // p wins  → only p_10px class generated
```

## Extending vs Replacing Tokens

`theme: { extend: {} }` — merges with defaults (what this project uses).

`theme: {}` (no `extend`) — completely replaces defaults. Use when you want zero default tokens.

## Common Gotchas

**Styles not applied** — check the `@layer` declaration is present and `styled-system/styles.css` (or PostCSS output) is imported at the root.

**Dynamic asset URLs** — Panda can't resolve Vite asset imports. Use inline `style` instead:

```tsx
// wrong: css({ backgroundImage: `url("${img}")` })
style={{ backgroundImage: `url("${img}")` }}
```

**Overriding from another CSS library** — wrap the third-party CSS in its own layer so Panda's utilities win:

```css
@import url("other.css") layer(other);
@layer other, reset, base, tokens, recipes, utilities;
```

**tsconfig paths alias** — if using a path alias for `styled-system`, set `importMap` in `panda.config.ts`:

```ts
importMap: "@/styled-system";
```

**IDE can't resolve `styled-system` imports** — add it to `tsconfig.json`:

```json
{ "include": ["src", "styled-system"] }
```
