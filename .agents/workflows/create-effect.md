---
description: Create a new KineticOS effect following the standard structure, contracts, and registration steps. Includes beta publish → finalize flow.
skills:
  - clean-code
  - typescript-pro
  - javascript-pro
  - code-refactoring-refactor-clean
  - architecture
---

# /create-effect

Use this workflow when adding a new visual effect to KineticOS.

New effects go through two stages:
1. **Beta** — published to npm under the `beta` dist-tag for testing. CDN-accessible but not `@latest`.
2. **Stable** — promoted to `@latest` via a full release tag once the effect is finalized.

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

The `RenderNode` export must satisfy the `RenderNode` interface from `renderer/global-renderer.ts`. Check it:

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
- Use `parseConfig(el)` from `config.ts` for all attribute reading
- WebGL utilities (`buffer.ts`, `shader.ts`) — import from `../../webgl/`
- Physics (`cursor.ts`, `ripple.ts`, `spatial.ts`) — import from `../../physics/`
- If the effect has CPU-heavy init (image decoding, dithering), defer with `requestIdleCallback`

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

---

## Step 5 — Update the debugger

In `src/index.ts`, the `debugElement()` function has a `validEffects` array. Add the new effect name:

```typescript
const validEffects = ['dots-shader', 'image-particle', '<effect-name>'];
```

---

## Step 6 — Build and verify locally

```bash
cd packages/core
pnpm build
```

Expected output:
```
dist/effects/<effect-name>/index.min.js   ← new chunk present
dist/kineticos.min.js                     ← core loader unchanged in size
```

Confirm no regressions:
```bash
pnpm analyze
```

---

## Step 7 — Test locally

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
- Only `effects/<effect-name>/index.min.js` chunk loads
- Debug console shows `✓` for the element
- `KineticOS.destroyAll()` cleans up without errors

---

## Step 8 — Beta publish for CDN testing

Once the effect works locally, publish a beta so it can be tested over jsDelivr before promoting to `@latest`.

### 8.1 — Set a beta version

Beta versions use the format: `<next-minor>.0-beta.<N>` (e.g. `1.2.0-beta.1`).

Edit `packages/core/package.json`:
```json
"version": "1.2.0-beta.1"
```

### 8.2 — Commit to `main`

```bash
git add -A
git commit -m "feat(<effect-name>): add <effect-name> effect [beta]"
git push origin main
```

### 8.3 — Push a beta tag

Tag format: `v<version>-beta.<N>` — this triggers `release-beta.yml` which publishes with `--tag beta`.

```bash
git tag v1.2.0-beta.1
git push origin v1.2.0-beta.1
```

### 8.4 — Verify beta on CDN

After the Action completes, test via jsDelivr:
```
https://cdn.jsdelivr.net/npm/@kineticos/core@1.2.0-beta.1/dist/kineticos.min.js
https://cdn.jsdelivr.net/npm/@kineticos/core@1.2.0-beta.1/dist/effects/<effect-name>/index.min.js
```

Use this in your test HTML — `@latest` still points to the previous stable release.

---

## Step 9 — Iterate on beta

If changes are needed, bump the beta counter and repeat Step 8:

```
1.2.0-beta.1 → 1.2.0-beta.2 → 1.2.0-beta.3 ...
```

Each beta tag push triggers a new CDN publish under the `beta` dist-tag.

---

## Step 10 — Finalize: promote to stable

Once the effect is production-ready:

### 10.1 — Bump to stable version

```json
"version": "1.2.0"
```

### 10.2 — Document the effect

Add all `ko-*` attributes to `dev-data/attributes-guide.md`:
- List every attribute it reads
- Provide a minimal working example
- Note any performance considerations

### 10.3 — Update root `README.md`

Add the new effect to the **Effects** section in `README.md`.

### 10.4 — Commit and push stable release

Follow the `/publish` workflow from Step 4 onwards:

```bash
git add -A
git commit -m "release: @kineticos/core v1.2.0"
git push origin main
git tag v1.2.0
git push origin v1.2.0
```

This triggers `release.yml` which publishes to `@latest`.

---

## Beta vs Stable — what changes where

| Step | Beta | Stable |
|---|---|---|
| Version format | `1.x.0-beta.N` | `1.x.0` |
| Git tag | `v1.x.0-beta.N` | `v1.x.0` |
| GitHub Action | `release-beta.yml` | `release.yml` |
| npm dist-tag | `beta` | `latest` |
| CDN URL | `@1.x.0-beta.N/dist/...` | `@latest/dist/...` |
| `@latest` affected | ❌ No | ✅ Yes |

---

## Checklist

### Effect implementation
- [ ] Folder and files created with correct naming
- [ ] `index.ts` exports `effectName` and `RenderNode`
- [ ] `render-node.ts` implements `mount()` and `destroy()`
- [ ] Added to `EFFECT_MAP` in `src/index.ts`
- [ ] Added to `rollup.config.js` input
- [ ] Added to `validEffects` in `debugElement()`
- [ ] `pnpm build` succeeds, new chunk present
- [ ] `pnpm analyze` shows no regressions
- [ ] Tested with debug mode locally

### Beta cycle
- [ ] Version set to `x.x.x-beta.N` in `package.json`
- [ ] Beta tag pushed (`vx.x.x-beta.N`)
- [ ] `release-beta.yml` Action completed
- [ ] Effect tested via jsDelivr beta URL
- [ ] All iterations done, effect finalized

### Stable release
- [ ] Version bumped to stable (`x.x.x`)
- [ ] Attributes documented in `dev-data/attributes-guide.md`
- [ ] Root `README.md` updated with new effect section
- [ ] Stable tag pushed (`vx.x.x`)
- [ ] `release.yml` Action completed — `@latest` updated
- [ ] CDN `@latest` verified
