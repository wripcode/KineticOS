# KineticOS — Attribute Reference
**Date: 2026-04-17 | Version: 1.0.0-beta.13**

KineticOS is a WebGL-powered effects library driven entirely by HTML attributes. No JavaScript required. Drop a `<script>` tag, add `ko-effect` to a `<div>`, and it renders.

---

## How It Works

```html
<!-- 1. Load the script once, anywhere in <body> -->
<script async type="module"
  src="https://cdn.jsdelivr.net/npm/@kineticos/core@latest/dist/kineticos.min.js"
  kineticos>
</script>

<!-- 2. Add ko-effect to any div — that's it -->
<div ko-effect="dots-shader" style="height: 400px; position: relative;"></div>
```

> **Critical requirement:** The host element must have a defined height and `position: relative` (or absolute/fixed). KineticOS sets this automatically, but make sure the element isn't `height: 0`.

---

## Universal Attributes

These work on **both** effects.

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `ko-effect` | `"dots-shader"` \| `"image-particle"` | — | **Required.** Which effect to render. |
| `ko-hover` | `"container"` | off | When set, the effect is hidden by default and fades in only when the user hovers over the element. Perfect for interactive cards. |
| `ko-mouse` | `"true"` \| `"false"` | `"true"` | Enables or disables cursor repulsion physics. Set `"false"` for static ambient backgrounds. |
| `ko-ripple` | `"true"` \| `"false"` | `"true"` | Enables or disables click ripple waves. Only applies when `ko-mouse` is also `"true"`. |
| `ko-physics` | `"subtle"` \| `"medium"` \| `"strong"` | `"medium"` | Sets the overall intensity of all physics forces in one go. A shortcut for the fine-grained physics attributes below. |
| `ko-fps` | number | `60` | Frame rate cap. Reduce to save GPU on low-end devices (e.g. `ko-fps="30"`). |

---

## Physics Fine-Tuning

Each attribute accepts either a **preset name** (`"subtle"` | `"medium"` | `"strong"`) or a **raw number**. The preset name pulls the corresponding value from that preset's table — so you can mix and match freely (e.g. `ko-physics="subtle"` for overall feel, but `ko-mouse-radius="strong"` for a wider cursor reach).

Individual attributes always win over `ko-physics`.

| Attribute | Accepted values | Description |
|-----------|----------------|-------------|
| `ko-mouse-radius` | `"subtle"` \| `"medium"` \| `"strong"` \| number (px) | How far from the cursor dots are affected. |
| `ko-mouse-force` | `"subtle"` \| `"medium"` \| `"strong"` \| number | How hard the cursor pushes dots away. |
| `ko-ripple-speed` | `"subtle"` \| `"medium"` \| `"strong"` \| number (px/s) | How fast the click ripple ring expands outward. |
| `ko-ripple-width` | `"subtle"` \| `"medium"` \| `"strong"` \| number (px) | The thickness of the click ripple ring. |
| `ko-ripple-force` | `"subtle"` \| `"medium"` \| `"strong"` \| number | How hard the ripple pushes dots. |
| `ko-ripple-duration` | `"subtle"` \| `"medium"` \| `"strong"` \| number (ms) | How long the ripple ring lives before fading. |

**Numeric reference** (what each preset word resolves to):

| Attribute | `subtle` | `medium` | `strong` |
|-----------|----------|----------|----------|
| `ko-mouse-radius` | `80` | `100` | `140` |
| `ko-mouse-force` | `60` | `120` | `200` |
| `ko-ripple-speed` | `160` | `225` | `300` |
| `ko-ripple-width` | `40` | `60` | `80` |
| `ko-ripple-force` | `60` | `120` | `200` |
| `ko-ripple-duration` | `450` | `675` | `900` |

**Examples:**
```html
<!-- Wide cursor reach but gentle force -->
<div ko-effect="dots-shader"
     ko-physics="subtle"
     ko-mouse-radius="strong">
</div>

<!-- Fast ripple, but short-lived -->
<div ko-effect="dots-shader"
     ko-ripple-speed="strong"
     ko-ripple-duration="subtle">
</div>

<!-- Raw numeric override -->
<div ko-effect="dots-shader"
     ko-mouse-radius="200"
     ko-ripple-duration="1200">
</div>
```

---

## Performance & Optimization

KineticOS is heavily optimized (single shared WebGL canvas, automatic off-screen pausing, batched drawing), but drawing thousands of particles still requires processing power. Use these attributes to ensure smooth performance on all devices:

| Attribute | Recommendation | Why |
|-----------|----------------|-----|
| `ko-fps` | `"30"` | Limits the maximum frame rate to 30fps. Halves GPU/CPU load instantly. Ideal for ambient backgrounds where 60fps fluidity isn't strictly necessary. |
| `ko-total-size` | Increase value (e.g. `"10"`) | Only applies to `dots-shader`. Increasing grid size reduces the total number of dots rendered exponentially. Fewer dots = less physics calculation = faster performance. |
| `ko-grid-size` | Decrease value (e.g. `"100"`) | Only applies to `image-particle`. Lowering the grid size reduces the resolution of the particle system, drastically cutting down both mount-time CPU dithering and render-time GPU load. |
| `ko-mouse` | `"false"` | Turns off cursor tracking entirely. Use this for static backgrounds to skip spatial hashing and physics calculations on every frame. |

> **Pro Tip for image-particle:** The single biggest performance killer is a high `ko-grid-size` (default 200). If you have multiple `image-particle` effects on one page, try dropping their grid sizes to `100` or `150` and compensating with a slightly larger `ko-particle-size`.

---

---

## `ko-effect="dots-shader"`

A WebGL dot grid rendered on the shared Global Canvas. Every dot is driven by cursor repulsion and click ripple physics.

### Use Cases
- Hero section backgrounds on landing pages
- Feature section backgrounds  
- Interactive cards that react to mouse movement
- Ambient particle backgrounds (with `ko-mouse="false"`)

### Minimal Example
```html
<div ko-effect="dots-shader" style="height: 500px;"></div>
```

### Full Example
```html
<div
  ko-effect="dots-shader"
  ko-theme="ocean"
  ko-hover="container"
  ko-physics="strong"
  ko-dot-size="1.5"
  ko-total-size="8"
  style="height: 500px; border-radius: 16px;"
></div>
```

---

### dots-shader Attributes

#### Colors

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `ko-theme` | `"ember"` \| `"ocean"` \| `"violet"` \| `"mono"` \| `"gold"` | `"ember"` | Applies a built-in color palette. Ignored if `ko-colors` is set. |
| `ko-colors` | comma-separated hex | — | Custom colors. Accepts 1–6 hex codes (e.g. `"#e11d48,#fb923c"`). Overrides `ko-theme`. |

**Color expansion rules:**
- 1 color → all dots use that color
- 2 colors → first fills 50%, second fills 50%
- 3 colors → each fills ~33%
- 4–6 colors → evenly distributed, last color repeats to fill 6 slots

**Built-in themes:**

| Theme | Colors | Best for |
|-------|--------|----------|
| `ember` | Orange → Red | Dark backgrounds, warm brand feel |
| `ocean` | Blue → Teal | Clean SaaS, tech products |
| `violet` | Purple → Indigo | Creative, bold, modern |
| `mono` | White → Gray | Minimal, editorial |
| `gold` | Amber → Yellow | Premium, luxury feel |

#### Dot Grid

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `ko-dot-size` | number (px) | `1` | The diameter of each rendered dot in CSS pixels. Increase for a bolder, blockier look. |
| `ko-total-size` | number (px) | `5` | The spacing between dot grid cells. Larger values = fewer, more spread-out dots. |
| `ko-opacities` | 10 comma-separated floats | `"0.4,0.4,0.6,0.6,0.6,0.8,0.8,0.8,0.8,1.0"` | Controls the opacity distribution of dots. 10 weights, each 0–1. Creates the varied brightness look. |

#### Interaction

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `ko-hover` | `"container"` | off | Effect is invisible until hovered. The dots reveal with a radial wave from the center on every hover. |

### dots-shader Recipes

**Subtle ambient background (no physics):**
```html
<div ko-effect="dots-shader"
     ko-theme="mono"
     ko-mouse="false"
     ko-dot-size="1.5"
     ko-total-size="8">
</div>
```

**High-energy interactive card:**
```html
<div ko-effect="dots-shader"
     ko-hover="container"
     ko-theme="violet"
     ko-physics="strong"
     ko-dot-size="2"
     ko-total-size="12">
</div>
```

**Custom dual-tone with hover reveal:**
```html
<div ko-effect="dots-shader"
     ko-hover="container"
     ko-colors="#e11d48,#fb923c">
</div>
```

**Dense, fine-grain starfield:**
```html
<div ko-effect="dots-shader"
     ko-theme="mono"
     ko-dot-size="0.5"
     ko-total-size="3">
</div>
```

---

---

## `ko-effect="image-particle"`

Converts any SVG or image into an interactive dithered particle field rendered on the Global WebGL Canvas. The CPU runs a Floyd-Steinberg dithering algorithm to position particles to match the image shape, then the GPU renders thousands of interactive physics particles.

### Use Cases
- Logo animations (interactive branded logo reveals)  
- Icon accents on product pages
- Hero artwork turned into reactive particle fields
- Interactive decorative elements

### Minimal Example
```html
<div ko-effect="image-particle"
     ko-src="./your-logo.svg"
     style="height: 400px;">
</div>
```

### Full Example
```html
<div
  ko-effect="image-particle"
  ko-src="https://example.com/logo.svg"
  ko-invert="true"
  ko-scale="0.7"
  ko-particle-size="1.0"
  ko-colors="#38bdf8,#818cf8"
  ko-physics="strong"
  style="height: 500px; border-radius: 16px;"
></div>
```

---

### image-particle Attributes

#### Image Source

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `ko-src` | URL string | — | **Required.** URL or relative path to the SVG or image file. For external URLs (CDN-hosted), CORS must be enabled on the server. |

#### Colors

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `ko-colors` | comma-separated hex | gray | Custom particle colors. Accepts 1–6 hex codes. Each particle is randomly assigned one of the provided colors. |

#### Image Interpretation

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `ko-invert` | `"true"` \| `"false"` | `"true"` | **Most important attribute.** Controls whether particles fill the dark areas (`"true"`) or bright areas (`"false"`) of the image. Use `"true"` for dark/black SVGs on transparent backgrounds. Use `"false"` for white/light SVGs. |

**When to use `ko-invert="true"`:**
The dithering engine treats brightness as particle density. A black SVG logo on a transparent background has 0% brightness, so particles fill the *background* (which is wrong). `ko-invert="true"` reverses the math, placing particles in the dark shape areas instead.
- Black SVG on transparent → `ko-invert="true"` ✅
- White SVG on transparent → `ko-invert="false"` ✅

#### Sizing & Layout

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `ko-scale` | float (0.1–2.0) | `0.5` | How large the image renders relative to the container. `0.5` = fills 50% of the shortest dimension. `1.0` = fills 100%. |
| `ko-particle-size` | float | `1.0` | The diameter of each particle as a multiplier of the grid cell size. `1.0` = particles touch each other edge-to-edge. `0.5` = particles are half-size with visible gaps. Values above `1.5` cause overlap/solid appearance. |

> **Warning:** `ko-particle-size` is a **multiplier**, not pixels. `ko-particle-size="8"` will make particles 8× their cell size, turning the image into a solid block of color. Recommended range: `0.5` – `1.5`.

#### Advanced Pipeline

These attributes control the CPU-side dithering algorithm. Most users won't need them.

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `ko-threshold` | integer (0–255) | `180` | Brightness threshold for the dithering algorithm. Lower values produce more particles; higher values produce fewer. |
| `ko-contrast` | integer (-255 to 255) | `0` | Contrast adjustment applied to the image before dithering. Useful for making faint images produce clear particle shapes. |
| `ko-gamma` | float | `1.0` | Gamma correction applied before dithering. Values > 1 brighten the source; < 1 darken it. |
| `ko-blur` | float (px) | `3.75` | Gaussian blur applied to the source image before dithering. Higher values soften edges and reduce sharp aliasing artifacts. |
| `ko-grid-size` | integer | `200` | Resolution of the dithering grid (max dimension in grid units). Higher = more particles, more detail, more CPU work on mount. |
| `ko-diffusion` | float (0–1) | `1.0` | Floyd-Steinberg error diffusion strength. Lower values reduce the characteristic dithering "halftone" pattern. |
| `ko-serpentine` | `"true"` \| `"false"` | `"true"` | Whether the dithering scans alternating rows in opposite directions. Reduces banding artifacts on diagonal edges. |

### image-particle Recipes

**Dark logo on transparent background (most common):**
```html
<div ko-effect="image-particle"
     ko-src="./logo-black.svg"
     ko-invert="true"
     ko-scale="0.6"
     ko-particle-size="0.8">
</div>
```

**Logo with brand colors + strong physics:**
```html
<div ko-effect="image-particle"
     ko-src="./logo.svg"
     ko-invert="true"
     ko-scale="0.6"
     ko-colors="#e11d48,#fb923c"
     ko-physics="strong">
</div>
```

**Subtle icon accent (no cursor physics):**
```html
<div ko-effect="image-particle"
     ko-src="./icon.svg"
     ko-invert="true"
     ko-scale="0.5"
     ko-mouse="false"
     ko-particle-size="0.7">
</div>
```

**Multi-color logo reveal on hover:**
```html
<div ko-effect="image-particle"
     ko-src="./logo.svg"
     ko-hover="container"
     ko-invert="true"
     ko-scale="0.7"
     ko-colors="#38bdf8,#818cf8,#ec4899">
</div>
```

**Fine-detail logo (more grid resolution):**
```html
<div ko-effect="image-particle"
     ko-src="./logo.svg"
     ko-invert="true"
     ko-grid-size="300"
     ko-particle-size="0.6"
     ko-scale="0.8">
</div>
```

---

## Script Tag Options

| Attribute on `<script>` | Effect |
|-------------------------|--------|
| `kineticos` | **Required.** Activates the library. Without this, the script loads but does nothing. |
| `debug` | Logs a health check for every `[ko-effect]` element found: dimensions, missing attributes, unknown values. Use during development. |

```html
<!-- Development (with debug output) -->
<script async type="module"
  src="https://cdn.jsdelivr.net/npm/@kineticos/core@latest/dist/kineticos.min.js"
  kineticos
  debug>
</script>

<!-- Production -->
<script async type="module"
  src="https://cdn.jsdelivr.net/npm/@kineticos/core@latest/dist/kineticos.min.js"
  kineticos>
</script>
```

---

## JavaScript API

KineticOS exposes a minimal API on `window.KineticOS` for dynamic use cases.

```js
// Destroy the effect on a specific element
KineticOS.destroy(document.querySelector('.my-card'));

// Destroy everything and remove the global canvas
KineticOS.destroyAll();

// Re-scan for new [ko-effect] elements (after dynamic DOM insertion)
KineticOS.refresh();
```

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Effect not showing | Ensure the host element has a non-zero height. |
| `ko-effect` on a `<canvas>` | Wrap the canvas in a `<div>` and apply `ko-effect` to the div. |
| `image-particle` shows nothing with `ko-invert="false"` | Your SVG is probably black/dark — use `ko-invert="true"`. |
| `image-particle` looks like a solid color block | `ko-particle-size` is too high. Keep it between `0.5` and `1.5`. |
| External image not loading | The image URL must have CORS headers (`Access-Control-Allow-Origin: *`). CDN-hosted Webflow assets support this. |
| Effect bleeds outside rounded corners | Ensure the host element has `border-radius` set in CSS — KineticOS reads it automatically and applies pixel-perfect SDF clipping. |
