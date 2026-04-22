# KineticOS

[![npm](https://img.shields.io/npm/v/@kineticos/core?color=%23fc6d26&label=npm)](https://www.npmjs.com/package/@kineticos/core)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/wripcode/KineticOS/blob/main/LICENSE)
[![Sponsor](https://img.shields.io/github/sponsors/wripcode?label=Sponsor&logo=GitHub)](https://github.com/sponsors/wripcode)

A high-performance, attribute-driven WebGL effects library designed for Webflow, Framer, and custom codebases. Zero config required, incredibly easy to implement.

## Quick Start (CDN)

Add this script to your site's `<head>` or `<body>`. Declare which effects you need using `ko-*` attributes — only those chunks are fetched:

```html
<!-- Dots shader only -->
<script async type="module"
  src="https://cdn.jsdelivr.net/npm/@kineticos/core@latest/dist/kineticos.min.js"
  kineticos
  ko-dots-shader>
</script>

<!-- Both effects -->
<script async type="module"
  src="https://cdn.jsdelivr.net/npm/@kineticos/core@latest/dist/kineticos.min.js"
  kineticos
  ko-dots-shader
  ko-image-particle>
</script>
```

Add the `ko-effect` attribute to a **wrapper `<div>`**:

```html
<div ko-effect="dots-shader" style="width:100%;height:100vh;"></div>
```

> **Important:** `ko-effect` must be on a `<div>` (or any non-`<canvas>` block element). The host element must have a defined height. KineticOS manages its own single global canvas.

> **Migrating from v1.0.x?** Just add `ko-dots-shader` and/or `ko-image-particle` to your existing `<script>` tag. Everything else stays the same.

---

## The Effects

### 1. Dots Shader (`ko-effect="dots-shader"`)
An animated WebGL dot grid background with radial entry animations and optional cursor physics.

**Basic Usage:**
```html
<div ko-effect="dots-shader" ko-theme="ocean"></div>
```

**Attributes:**
| Attribute | Example | Default | Description |
|-----------|---------|---------|-------------|
| `ko-theme` | `ocean`, `ember`, `violet`, `mono`, `gold` | `ember` | Predefined color palettes. |
| `ko-colors` | `#FF0000,#00FF00` | (from theme) | Custom palette (comma-separated hex codes). Overrides theme. |
| `ko-dot-size` | `2.5` | `1` | Dot diameter in pixels. |
| `ko-total-size`| `10` | `5` | Grid spacing in pixels. |

### 2. Image Particle (`ko-effect="image-particle"`)
Converts an SVG or image URL into an interactive, dithered particle field.

**Basic Usage:**
```html
<div ko-effect="image-particle" ko-src="/assets/logo.svg" ko-invert="true"></div>
```

**Attributes:**
| Attribute | Example | Default | Description |
|-----------|---------|---------|-------------|
| `ko-src` | `https://.../img.png`| *(Required)* | Image or SVG to convert. Must support CORS if external. |
| `ko-invert` | `true`, `false` | `true` | Fills dark areas (`true`) or bright areas (`false`). Use `true` for dark SVGs. |
| `ko-particle-size`| `1.5` | `1` | Particle size multiplier. Values 0.5 - 1.5 recommended. |
| `ko-colors`| `#38bdf8,#818cf8` | `gray` | Custom colors for the particles. |

---

## Physics Engine

By default, KineticOS provides high-performance spatial cursor tracking and click-ripples.

### Toggles
- `ko-mouse="false"` — Completely disables cursor repulsion and click ripples. Turns the effect into a static background. *(Saves significant CPU overhead on low-end devices).*
- `ko-ripple="false"` — Turns off the click ripple wave, but keeps cursor repulsion active.

### Presets
Control the overall physics "feel" using presets:
```html
<div ko-effect="dots-shader" ko-physics="strong"></div>
```
- `subtle`: Small cursor radius, weak force, quick ripples.
- `medium`: *(Default)* Balanced force and radius.
- `strong`: Huge cursor radius, high repulsion, massive ripples.

### Advanced Overrides
Want granular control? You can override individual physics values on any element using numbers or preset words (`subtle`, `medium`, `strong`):
- `ko-mouse-radius` (e.g. `strong` or `120`)
- `ko-mouse-force` (e.g. `subtle` or `200`)
- `ko-ripple-speed` (e.g. `150`)
- `ko-ripple-width` (e.g. `40`)
- `ko-ripple-force` (e.g. `strong`)
- `ko-ripple-duration` (e.g. `500`)

---

## Performance Optimization

Use these attributes to ensure smooth performance:

- `ko-fps="30"` - Limits the maximum frame rate to 30fps. Halves GPU/CPU load instantly.
- `ko-total-size="10"` - (*dots-shader only*) Increasing grid size reduces the total number of dots rendered.
- `ko-grid-size="100"` - (*image-particle only*) Lowering the grid size reduces the resolution of the particle system (default `200`). This cuts down both mount-time CPU dithering and render-time GPU load.
- `ko-mouse="false"` - Turns off cursor tracking entirely.

---

## Debug Mode

Add the `debug` attribute alongside `kineticos` on the script tag to activate the built-in element auditor:

```html
<script async type="module" src="..." kineticos debug></script>
```

With `debug` enabled, KineticOS will log a health check report for every `[ko-effect]` element found to the browser console.

---

## JS API (For SPAs / React / Vue)

If you are using KineticOS in a Single Page App where components mount/unmount dynamically without full page reloads, use the global `window.KineticOS` object.

```js
// Refresh DOM after injecting new elements
window.KineticOS.refresh();

// Clean up specific element before unmounting
window.KineticOS.destroy(document.querySelector('.my-effect-container'));

// Destroy absolutely everything
window.KineticOS.destroyAll();
```
