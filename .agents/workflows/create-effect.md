---
description: Create a new KineticOS effect following the standard structure, contracts, and registration steps.
skills:
  - clean-code
  - typescript-pro
  - javascript-pro
  - code-refactoring-refactor-clean
  - architecture
---

# /create-effect

Use this workflow when adding a new visual effect to KineticOS.

---

## Pre-flight

Before writing any code, run `tokenos-ko` to orient:

```
top_nodes          → identify current high-impact files
find_nodes         → locate EFFECT_MAP in src/index.ts
explore            → depth 2 from an existing effect (e.g. effects/dots-shader/index.ts)
```

Study one existing effect end-to-end before touching anything.

---

## Step 1 — Create the effect folder

```
src/effects/<effect-name>/
  index.ts            ← standard entry (required)
  render-node.ts      ← WebGL render node (required)
  shaders/
    <effect-name>.vert.glsl
    <effect-name>.frag.glsl
  image-processing.ts ← only if CPU pre-processing is needed (optional)
```

Naming rules:
- Folder and effect name: `kebab-case`
- Class name: `PascalCase` + `RenderNode` suffix (e.g. `FluidShaderRenderNode`)
- Script attribute: `ko-<effect-name>` (e.g. `ko-fluid-shader`)

---

## Step 2 — Implement the standard effect interface

Every effect **must** export this contract from `index.ts`:

```typescript
// src/effects/<effect-name>/index.ts
export const effectName = '<effect-name>';
export { YourRenderNode as RenderNode } from './render-node.js';
```

The `RenderNode` export must satisfy the `RenderNode` interface from `renderer/global-renderer.ts`. Check it with `get_node`:

```
get_node renderer/global-renderer.ts::RenderNode
```

---

## Step 3 — Implement `render-node.ts`

Follow the existing render nodes as reference. Required methods:

- `mount(el: Element): void` — allocate WebGL resources, start render loop
- `destroy(): void` — release all resources, cancel animation frame

Rules:
- Effects are always mounted on a `<div>` wrapper — never directly on `<canvas>`
- The `kineticos` attribute on the host element is the primary config source — use `parseConfig(el)` from `config.ts`
- WebGL utilities (`buffer.ts`, `shader.ts`) are shared — import from `../../webgl/`
- Physics (`cursor.ts`, `ripple.ts`, `spatial.ts`) are shared — import from `../../physics/`
- If the effect has CPU-heavy init (image decoding, dithering), defer it with `requestIdleCallback`

---

## Step 4 — Register the effect

Two files need one line each:

**`src/index.ts`** — add to `EFFECT_MAP`:
```typescript
'<effect-name>': () => import('./effects/<effect-name>/index.js'),
```

**`rollup.config.js`** — add to `input`:
```javascript
'effects/<effect-name>/index': 'src/effects/<effect-name>/index.ts',
```

That's it. Existing users are unaffected.

---

## Step 5 — Update the debugger

In `src/index.ts`, the `debugElement()` function has a `validEffects` array. Add the new effect name:

```typescript
const validEffects = ['dots-shader', 'image-particle', '<effect-name>'];
```

---

## Step 6 — Build and verify

```bash
cd packages/core
pnpm build
```

Expected output:
```
dist/effects/<effect-name>/index.min.js   ← new chunk present
dist/kineticos.min.js                     ← core loader unchanged in size
```

Run bundle analysis to confirm no unintended size regressions:
```bash
pnpm analyze
```

---

## Step 7 — Test

Minimal test HTML:
```html
<script async type="module"
  src="http://localhost:xxxx/dist/kineticos.min.js"
  kineticos
  ko-<effect-name>
  debug>
</script>

<div ko-effect="<effect-name>" style="width:400px;height:300px;"></div>
```

Verify in DevTools:
- Only `effects/<effect-name>/index.min.js` chunk loads (not other effect chunks)
- Debug console shows `✓` for the element
- `KineticOS.destroyAll()` cleans up without errors

---

## Step 8 — Document the new effect

Add the new effect's attributes to `dev-data/attributes-guide.md`:
- List every `ko-*` attribute it reads
- Provide a minimal working example
- Note any performance considerations

---

## Checklist

- [ ] Folder and files created with correct naming
- [ ] `index.ts` exports `effectName` and `RenderNode`
- [ ] `render-node.ts` implements `mount()` and `destroy()`
- [ ] Added to `EFFECT_MAP` in `src/index.ts`
- [ ] Added to `rollup.config.js` input
- [ ] Added to `validEffects` in `debugElement()`
- [ ] `pnpm build` succeeds, new chunk present
- [ ] `pnpm analyze` shows no regressions
- [ ] Tested with debug mode in browser
- [ ] Attributes documented in `dev-data/attributes-guide.md`
