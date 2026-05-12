import type {
  BaseConfig,
  DotsConfig,
  EffectType,
  ImageParticleConfig,
  KineticOSConfig,
  PhysicsPreset,
  PhysicsValues,
  PixelBlastConfig,
  PixelBlastVariant,
  ThemePreset,
} from './types.js';
import {
  DEFAULT_BLUR,
  DEFAULT_CONTRAST,
  DEFAULT_CORNER_RADIUS,
  DEFAULT_DIFFUSION_STRENGTH,
  DEFAULT_DOT_SCALE,
  DEFAULT_DOT_SIZE,
  DEFAULT_FPS,
  DEFAULT_GAMMA,
  DEFAULT_GRID_SIZE,
  DEFAULT_INVERT,
  DEFAULT_OPACITIES,
  DEFAULT_PARTICLE_GAP,
  DEFAULT_PARTICLE_SIZE,
  DEFAULT_PB_COLOR,
  DEFAULT_PB_EDGE_FADE,
  DEFAULT_PB_MOUSE_RADIUS,
  DEFAULT_PB_MOUSE_STRENGTH,
  DEFAULT_PB_PATTERN_DENSITY,
  DEFAULT_PB_PATTERN_SCALE,
  DEFAULT_PB_PIXEL_JITTER,
  DEFAULT_PB_PIXEL_SIZE,
  DEFAULT_PB_RIPPLE_INTENSITY,
  DEFAULT_PB_RIPPLE_SPEED,
  DEFAULT_PB_RIPPLE_THICKNESS,
  DEFAULT_PB_SPEED,
  DEFAULT_PB_VARIANT,
  DEFAULT_PHYSICS_PRESET,
  DEFAULT_SCALE,
  DEFAULT_SERPENTINE,
  DEFAULT_THEME,
  DEFAULT_THRESHOLD,
  DEFAULT_TOTAL_SIZE,
  PHYSICS_PRESETS,
  THEMES,
} from './constants.js';

// ---------------------------------------------------------------------------
// Low-level attribute helpers
// ---------------------------------------------------------------------------

/**
 * Reads an attribute and parses it as a finite float.
 * Returns undefined when the attribute is absent or not a valid number.
 */
function parseFloatAttr(el: Element, name: string): number | undefined {
  const raw = el.getAttribute(name);
  if (raw === null) return undefined;
  if (raw.toLowerCase() === 'infinity') return Infinity;
  const n = parseFloat(raw);
  return isFinite(n) ? n : undefined;
}

/**
 * Reads a boolean attribute ("true" / "false").
 * Returns `defaultValue` when the attribute is absent or unrecognized.
 */
function parseBoolAttr(el: Element, name: string, defaultValue: boolean): boolean {
  const raw = el.getAttribute(name);
  if (raw === null) return defaultValue;
  if (raw === 'false') return false;
  if (raw === 'true') return true;
  return defaultValue;
}

/**
 * Parses a comma-separated hex color list into normalized RGB tuples.
 * e.g. "#E24329,#FC6D26" → [[0.886, 0.263, 0.161], ...]
 * Returns null if parsing fails entirely (caller should fall back to theme).
 */
function parseHexList(raw: string): [number, number, number][] | null {
  const parts = raw.split(',').map((s) => s.trim());
  const result: [number, number, number][] = [];

  for (const hex of parts) {
    const cleaned = hex.replace(/^#/, '');
    if (cleaned.length !== 6) return null;

    const r = parseInt(cleaned.slice(0, 2), 16);
    const g = parseInt(cleaned.slice(2, 4), 16);
    const b = parseInt(cleaned.slice(4, 6), 16);

    if (isNaN(r) || isNaN(g) || isNaN(b)) return null;

    result.push([r / 255, g / 255, b / 255]);
  }

  return result.length > 0 ? result : null;
}

// ---------------------------------------------------------------------------
// Color resolution — ko-colors overrides ko-theme
// ---------------------------------------------------------------------------

/**
 * Expands a 1–6 color array to always have exactly 6 entries (WebGL u_colors layout).
 * - 1 color  → all 6 slots the same
 * - 2 colors → each repeated 3 times
 * - 3 colors → each repeated 2 times
 * - 4–6 colors → filled directly, padding last color if needed
 */
function expandTo6Colors(
  colors: readonly [number, number, number][],
): readonly [number, number, number][] {
  const len = colors.length;

  if (len === 1) {
    const c = colors[0]!;
    return [c, c, c, c, c, c];
  }
  if (len === 2) {
    const [a, b] = [colors[0]!, colors[1]!];
    return [a, a, a, b, b, b];
  }
  if (len === 3) {
    const [a, b, c] = [colors[0]!, colors[1]!, colors[2]!];
    return [a, a, b, b, c, c];
  }

  // 4–6: fill up to 6, repeating last color
  const fill = colors[len - 1]!;
  const result: [number, number, number][] = [...colors.slice(0, 6)] as [number, number, number][];
  while (result.length < 6) result.push(fill);
  return result;
}

function resolveColors(el: Element): readonly [number, number, number][] {
  const rawColors = el.getAttribute('ko-colors');
  if (rawColors) {
    const parsed = parseHexList(rawColors);
    if (parsed !== null) return expandTo6Colors(parsed);
    // Fall through to theme on invalid hex
  }

  const themeAttr = el.getAttribute('ko-theme') ?? DEFAULT_THEME;
  const theme = (Object.prototype.hasOwnProperty.call(THEMES, themeAttr)
    ? themeAttr
    : DEFAULT_THEME) as ThemePreset;

  return expandTo6Colors(THEMES[theme]);
}

// ---------------------------------------------------------------------------
// Physics resolution — individual attr > preset > default
// ---------------------------------------------------------------------------

function resolvePhysicsPreset(el: Element): PhysicsPreset {
  const attr = el.getAttribute('ko-physics') ?? DEFAULT_PHYSICS_PRESET;
  return (Object.prototype.hasOwnProperty.call(PHYSICS_PRESETS, attr)
    ? attr
    : DEFAULT_PHYSICS_PRESET) as PhysicsPreset;
}

/**
 * Reads a physics attribute that accepts either a preset name ("subtle" | "medium" | "strong")
 * or a raw numeric value. Preset names map to the corresponding field in PHYSICS_PRESETS.
 * Falls back to the provided default when the attribute is absent or unrecognised.
 */
function parsePhysicsAttr(
  el: Element,
  name: string,
  field: keyof PhysicsValues,
  fallback: number,
): number {
  const raw = el.getAttribute(name);
  if (raw === null) return fallback;
  if (Object.prototype.hasOwnProperty.call(PHYSICS_PRESETS, raw)) {
    return PHYSICS_PRESETS[raw as PhysicsPreset][field];
  }
  const n = parseFloat(raw);
  return isFinite(n) ? n : fallback;
}

/**
 * Merges preset values with any individually specified ko-* attributes.
 * Each attribute accepts either a preset name ("subtle" | "medium" | "strong")
 * or a raw numeric value. Individual attributes always win over the base preset.
 */
function resolvePhysicsValues(el: Element, preset: PhysicsPreset): PhysicsValues {
  const p = PHYSICS_PRESETS[preset];
  return {
    mouseRadius: parsePhysicsAttr(el, 'ko-mouse-radius', 'mouseRadius', p.mouseRadius),
    mouseForce: parsePhysicsAttr(el, 'ko-mouse-force', 'mouseForce', p.mouseForce),
    rippleSpeed: parsePhysicsAttr(el, 'ko-ripple-speed', 'rippleSpeed', p.rippleSpeed),
    rippleWidth: parsePhysicsAttr(el, 'ko-ripple-width', 'rippleWidth', p.rippleWidth),
    rippleForce: parsePhysicsAttr(el, 'ko-ripple-force', 'rippleForce', p.rippleForce),
    rippleDuration: parsePhysicsAttr(el, 'ko-ripple-duration', 'rippleDuration', p.rippleDuration),
  };
}

function resolveMouseToggles(
  el: Element,
  effect: EffectType,
): { mouseEnabled: boolean; rippleEnabled: boolean; hoverTarget: 'global' | 'container' } {
  const hasHover = el.hasAttribute('ko-hover');
  const hoverAttr = el.getAttribute('ko-hover');
  const hoverTarget = hasHover && hoverAttr !== 'global' ? 'container' : 'global';

  const mouseEnabled = parseBoolAttr(el, 'ko-mouse', true);
  return {
    mouseEnabled,
    // If mouse is fully disabled, ripple is also disabled
    rippleEnabled: mouseEnabled ? parseBoolAttr(el, 'ko-ripple', true) : false,
    hoverTarget,
  };
}

// ---------------------------------------------------------------------------
// Effect-specific config parsers
// ---------------------------------------------------------------------------

function parseDotsConfig(el: Element, base: BaseConfig): DotsConfig {
  const opacitiesRaw = el.getAttribute('ko-opacities');
  let opacities: readonly number[] = DEFAULT_OPACITIES;

  if (opacitiesRaw) {
    const parsed = opacitiesRaw
      .split(',')
      .map((s) => parseFloat(s.trim()))
      .filter((n) => isFinite(n));
    if (parsed.length === 10) opacities = parsed;
  }

  return {
    ...base,
    effect: 'dots-shader',
    colors: resolveColors(el),
    opacities,
    dotSize: parseFloatAttr(el, 'ko-dot-size') ?? DEFAULT_DOT_SIZE,
    totalSize: parseFloatAttr(el, 'ko-total-size') ?? DEFAULT_TOTAL_SIZE,
  };
}

function parseImageParticleConfig(el: Element, base: BaseConfig): ImageParticleConfig {
  const src = el.getAttribute('ko-src') ?? '';
  const rawColors = el.getAttribute('ko-colors') ?? el.getAttribute('ko-color');
  let colors: readonly [number, number, number][] | undefined;
  if (rawColors) {
    const parsed = parseHexList(rawColors);
    if (parsed && parsed.length > 0) colors = parsed;
  }

  const dotScale = parseFloatAttr(el, 'ko-dot-size') ?? parseFloatAttr(el, 'ko-particle-size') ?? DEFAULT_DOT_SCALE;

  return {
    ...base,
    effect: 'image-particle',
    src,
    ...(colors ? { colors } : {}),
    particleSize: dotScale,
    particleGap: parseFloatAttr(el, 'ko-particle-gap') ?? DEFAULT_PARTICLE_GAP,
    // Fully bound pipeline configs
    gridSize: parseFloatAttr(el, 'ko-grid-size') ?? DEFAULT_GRID_SIZE,
    scale: parseFloatAttr(el, 'ko-scale') ?? DEFAULT_SCALE,
    dotScale: dotScale,
    invert: parseBoolAttr(el, 'ko-invert', DEFAULT_INVERT),
    cornerRadius: parseFloatAttr(el, 'ko-corner-radius') ?? DEFAULT_CORNER_RADIUS,
    threshold: parseFloatAttr(el, 'ko-threshold') ?? DEFAULT_THRESHOLD,
    contrast: parseFloatAttr(el, 'ko-contrast') ?? DEFAULT_CONTRAST,
    gamma: parseFloatAttr(el, 'ko-gamma') ?? DEFAULT_GAMMA,
    blur: parseFloatAttr(el, 'ko-blur') ?? DEFAULT_BLUR,
    diffusionStrength: parseFloatAttr(el, 'ko-diffusion') ?? DEFAULT_DIFFUSION_STRENGTH,
    serpentine: parseBoolAttr(el, 'ko-serpentine', DEFAULT_SERPENTINE),
  };
}

function hexToNormalizedRgb(hex: string): [number, number, number] {
  const cleaned = hex.replace(/^#/, '');
  if (cleaned.length !== 6) return [0.706, 0.592, 0.812];
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return [0.706, 0.592, 0.812];
  return [r / 255, g / 255, b / 255];
}

const VALID_PB_VARIANTS: PixelBlastVariant[] = ['square', 'circle', 'triangle', 'diamond'];

function parsePixelBlastConfig(el: Element, base: BaseConfig): PixelBlastConfig {
  const colorHex = el.getAttribute('ko-color') ?? DEFAULT_PB_COLOR;
  const variantRaw = el.getAttribute('ko-variant') ?? DEFAULT_PB_VARIANT;
  const variant: PixelBlastVariant = VALID_PB_VARIANTS.includes(variantRaw as PixelBlastVariant)
    ? (variantRaw as PixelBlastVariant)
    : 'square';

  return {
    ...base,
    effect: 'pixel-blast',
    colorRgb: hexToNormalizedRgb(colorHex),
    pixelSize: parseFloatAttr(el, 'ko-pixel-size') ?? DEFAULT_PB_PIXEL_SIZE,
    patternScale: parseFloatAttr(el, 'ko-scale') ?? DEFAULT_PB_PATTERN_SCALE,
    patternDensity: parseFloatAttr(el, 'ko-density') ?? DEFAULT_PB_PATTERN_DENSITY,
    pixelSizeJitter: parseFloatAttr(el, 'ko-jitter') ?? DEFAULT_PB_PIXEL_JITTER,
    edgeFade: parseFloatAttr(el, 'ko-edge-fade') ?? DEFAULT_PB_EDGE_FADE,
    variant,
    speed: parseFloatAttr(el, 'ko-speed') ?? DEFAULT_PB_SPEED,
    rippleSpeed: parseFloatAttr(el, 'ko-ripple-speed') ?? DEFAULT_PB_RIPPLE_SPEED,
    rippleThickness: parseFloatAttr(el, 'ko-ripple-thickness') ?? DEFAULT_PB_RIPPLE_THICKNESS,
    rippleIntensity: parseFloatAttr(el, 'ko-ripple-intensity') ?? DEFAULT_PB_RIPPLE_INTENSITY,
    mouseRadius: parseFloatAttr(el, 'ko-mouse-radius') ?? DEFAULT_PB_MOUSE_RADIUS,
    mouseStrength: parseFloatAttr(el, 'ko-mouse-strength') ?? DEFAULT_PB_MOUSE_STRENGTH,
  };
}

// ---------------------------------------------------------------------------
// Public entry
// ---------------------------------------------------------------------------

/**
 * Reads all `ko-*` attributes from an element and returns a fully resolved
 * typed config object. Pure function — no side effects, easy to unit test.
 */
export function parseConfig(el: Element): KineticOSConfig {
  const effectAttr = el.getAttribute('ko-effect') ?? '';
  let effect: EffectType;
  if (effectAttr === 'image-particle') effect = 'image-particle';
  else if (effectAttr === 'pixel-blast') effect = 'pixel-blast';
  else effect = 'dots-shader';

  const maxFps = parseFloatAttr(el, 'ko-fps') ?? DEFAULT_FPS;
  const physics = resolvePhysicsPreset(el);
  const physicsValues = resolvePhysicsValues(el, physics);
  const { mouseEnabled, rippleEnabled, hoverTarget } = resolveMouseToggles(el, effect);

  const base: BaseConfig = {
    effect,
    maxFps: maxFps > 0 ? maxFps : DEFAULT_FPS,
    physics,
    physicsValues,
    mouseEnabled,
    rippleEnabled,
    hoverTarget,
  };

  if (effect === 'image-particle') return parseImageParticleConfig(el, base);
  if (effect === 'pixel-blast') return parsePixelBlastConfig(el, base);
  return parseDotsConfig(el, base);
}


