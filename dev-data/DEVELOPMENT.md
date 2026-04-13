# Architecture & Development Guide

This document explains the KineticOS codebase structure, technical decisions, and how to maintain or extend the library safely.

## Tech Stack
- **Package Manager:** `pnpm` (Workspace/Monorepo setup)
- **TypeScript:** Strict mode enabled, `ES2020` target.
- **Bundler:** `Rollup` with `@rollup/plugin-typescript`, `terser`, and `rollup-plugin-glsl`.
- **Testing:** `Vitest` (testing logical configs and spatial math across `node` and `jsdom` environments).
- **CI/CD:** GitHub Actions (Automated npm publishing on tag push).

---

## Repository Structure

```text
kineticos/
├── demo/                   # Raw HTML pages testing built outputs
│   ├── dots-shader-physics.html
│   └── image-particle.html
│
└── packages/core/          # The main @kineticos/core package
    ├── dist/               # Rollup output (ESM & IIFE bundles)
    └── src/
        ├── index.ts        # DOM scanner, Factory, Global API (`window.KineticOS`)
        ├── config.ts       # Parses HTML `ko-*` attributes into typed `KineticOSConfig`
        ├── constants.ts    # Magic numbers, themes, physics defaults
        ├── types.ts        # Single source of truth for all interfaces
        │
        ├── effects/        
        │   ├── base.ts           # `CanvasEffect` abstract base (IntersectionObserver, rAF)
        │   ├── dots-shader.ts    # WebGL2 implementation for dots
        │   └── image-particle.ts # Canvas2D implementation for dithered images
        │
        ├── physics/
        │   ├── index.ts    # `PhysicsModule` orchestrator (tracks cursor & ripples)
        │   ├── spatial.ts  # O(1) Spatial Hash Grid for cursor calculation
        │   ├── cursor.ts   # Pure function for cursor repulsion math
        │   └── ripple.ts   # Pure function for ring ripple math
        │
        └── webgl/
            ├── buffer.ts   # GPU Buffer allocators & updaters
            ├── shader.ts   # GLSL compile utilities
            └── shaders/    # Raw .glsl files (inlined securely via Rollup)
```

---

## Core Systems & Logic Rules

### 1. The Physics Module
Physics (`src/physics/`) is strictly decoupled from rendering. The `PhysicsModule` maintains no state regarding dot coordinates.
- **Tick method:** The effect passes flat `Float32Arrays` into `physics.tick()`. The physics system writes the computed repulsion directly into the `offsetX` and `offsetY` arrays in-place.
- **Spatial Grid:** Cursor math checking 10,000 dots is slow. `SpatialGrid` hashes coords so only the ~400 dots surrounding the cursor are iterated.

### 2. The Abstract Canvas Effect
Always extend `CanvasEffect` in `src/effects/base.ts`. It handles:
- Canvas injection and DPR scaling.
- `ResizeObserver` (debounced resizing).
- `IntersectionObserver` (pauses the `requestAnimationFrame` loop when the canvas is scrolled off-screen).
- Tab visibility pausing (prevents `u_time` from jumping drastically when returning to the tab).

---

## How to Add a New Effect

If you want to add a completely new effect (e.g. `ko-effect="webgl-fluid"`):

1. **Define the Types (`src/types.ts`)**
   - Add the literal string to `EffectType`.
   - Create a specific interface like `export interface FluidConfig extends BaseConfig { ... }`.
   - Add it to the generic `KineticOSConfig` union.

2. **Add Parsing Rules (`src/config.ts`)**
   - Write a `parseFluidConfig()` function that looks up `el.getAttribute('ko-...')`.
   - Wire it into the main switch statement inside `parseConfig()`.

3. **Implement the Class (`src/effects/fluid-shader.ts`)**
   - Extend `CanvasEffect`.
   - Override `init()`, `renderFrame(dt)`, and `onResize()`.
   - Instantiate `PhysicsModule` inside `init()` if the effect needs it.

4. **Register in Factory (`src/index.ts`)**
   - Import the class.
   - Add it to the `switch (config.effect)` statement in `createEffect()`.

---

## Development Workflow

### Local preview
To test while writing code, run Rollup in watch mode:
```bash
cd packages/core
pnpm dev
```
Open any of the files in `kineticos/demo/` directly in your browser. As you save TypeScript files, Rollup rebuilds, and you just manually refresh the browser.

### Testing
Run unit tests across Node and DOM boundaries using Vitest:
```bash
pnpm test
```

### Releasing a New Version
The build and publish process is 100% automated via GitHub Actions.
To release an update to the CDN:

1. Commit your changes:
   ```bash
   git add .
   git commit -m "feat: new fluid shader"
   ```
2. Update the version inside `packages/core/package.json` (e.g. `"1.1.0"`).
3. Create a Git tag and push it:
   ```bash
   git tag v1.1.0
   git push origin main --tags
   ```

GitHub Actions will wake up, run `pnpm install`, build the bundles, run tests, and automatically publish to npm using the `NPM_TOKEN` provided in repository secrets.
