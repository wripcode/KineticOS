# KineticOS

A high-performance, attribute-driven WebGL effects library designed for Webflow, Framer, and custom codebases. Zero config required, incredibly easy to implement.

## Quick Start (CDN)

Add this script to your site's `<body>` or `<head>`:

```html
<script async type="module" src="https://cdn.jsdelivr.net/npm/@kineticos/core@1/dist/kineticos.min.js" kineticos></script>
```

Add the `ko-effect` attribute to any `div` where you want the effect to appear:

```html
<div ko-effect="dots-shader"></div>
```
*(Make sure the parent section has a defined `width` and `height`, like `100vw` or `100vh`.)*

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
| `ko-fps` | `30` | `60` | Frame rate cap (Infinity for uncapped). |

### 2. Image Particle (`ko-effect="image-particle"`)
Converts an SVG or image URL into an interactive, dithered particle field.

**Basic Usage:**
```html
<div ko-effect="image-particle" ko-src="/assets/logo.svg"></div>
```

**Attributes:**
| Attribute | Example | Default | Description |
|-----------|---------|---------|-------------|
| `ko-src` | `https://.../img.png`| *(Required)* | Image or SVG to convert. Must support CORS if external. |
| `ko-particle-size`| `3` | `2` | Interactive particle size in pixels. |
| `ko-particle-gap`| `6` | `4` | Spacing between particles. |

---

## Physics Engine

By default, KineticOS binds to the global `window` object to provide high-performance spatial cursor tracking and click-ripples, even when the canvas sits behind other content (`pointer-events: none`).

### Toggles
- `ko-mouse="false"` — Completely disables cursor repulsion and click ripples. Turns the effect into a static background playing its standard idle animation. *(Saves significant CPU overhead on low-end devices).*
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
Want granular control? You can override individual physics values on any element:
- `ko-mouse-radius` (e.g. `120`)
- `ko-mouse-force` (e.g. `200`)
- `ko-ripple-speed` (e.g. `150`)
- `ko-ripple-width` (e.g. `40`)
- `ko-ripple-force` (e.g. `100`)
- `ko-ripple-duration` (e.g. `500` ms)

---

## JS API (For SPAs / React / Vue)

If you are using KineticOS in a Single Page App where components mount/unmount dynamically without full page reloads, use the global `window.KineticOS` object to prevent memory leaks.

```js
// Refresh DOM after injecting new elements
window.KineticOS.refresh();

// Clean up specific element before unmounting
window.KineticOS.destroy(document.querySelector('.my-effect-container'));

// Destroy absolutely everything
window.KineticOS.destroyAll();
```
