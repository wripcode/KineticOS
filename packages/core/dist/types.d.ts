/**
 * The two fundamentally distinct effect categories in KineticOS.
 * - dots-shader: WebGL fullscreen dot grid with optional mouse physics
 * - image-particle: SVG/image parsed into an interactive dithered particle field
 */
export type EffectType = 'dots-shader' | 'image-particle';
/** Controls overall physics intensity via a single preset attribute. */
export type PhysicsPreset = 'subtle' | 'medium' | 'strong';
/** Built-in color palettes for the dots-shader effect. */
export type ThemePreset = 'ember' | 'ocean' | 'violet' | 'mono' | 'gold';
/**
 * Fully resolved physics values after merging preset + individual attribute overrides.
 * Individual ko-* attributes take priority over the preset.
 */
export interface PhysicsValues {
    /** Cursor influence radius in CSS pixels. */
    mouseRadius: number;
    /** Cursor repulsion force multiplier. */
    mouseForce: number;
    /** Ripple ring expansion speed in CSS px/s. */
    rippleSpeed: number;
    /** Ripple band thickness in CSS pixels. */
    rippleWidth: number;
    /** Ripple push force multiplier. */
    rippleForce: number;
    /** Ripple lifetime in milliseconds. */
    rippleDuration: number;
}
/** Config fields shared by all effects. */
export interface BaseConfig {
    effect: EffectType;
    /** Frame rate cap (in frames per second). Use Infinity for uncapped. */
    maxFps: number;
    physics: PhysicsPreset;
    /** Merged result of preset + individual attribute overrides. */
    physicsValues: PhysicsValues;
    /** Whether cursor repulsion is active. image-particle ignores this (always true). */
    mouseEnabled: boolean;
    /** Whether click ripples are active. */
    rippleEnabled: boolean;
    /** Target element to bind physics pointer events. 'global' means window, 'container' means the parent element of the canvas. */
    hoverTarget: 'global' | 'container';
}
/**
 * Config for the dots-shader effect.
 * Colors are stored as RGB tuples in the 0–1 range (WebGL normalized).
 */
export interface DotsConfig extends BaseConfig {
    effect: 'dots-shader';
    /** RGB tuples in 0–1 range. Always 6 entries after expansion. */
    colors: readonly [number, number, number][];
    /** Opacity distribution weights. Always exactly 10 values. */
    opacities: readonly number[];
    /** Rendered dot diameter in CSS pixels. */
    dotSize: number;
    /** Grid cell size (controls dot spacing) in CSS pixels. */
    totalSize: number;
}
/**
 * Config for the image-particle effect.
 * Physics is always active — mouseEnabled is always true.
 */
export interface ImageParticleConfig extends BaseConfig {
    effect: 'image-particle';
    /** URL or path to the SVG or image source. Required. */
    src: string;
    /** Custom particle colors (e.g., from ko-colors). Uses default if undefined. Normalized over 0-1 */
    colors?: readonly [number, number, number][];
    /** Rendered particle dot size in CSS pixels. */
    particleSize: number;
    /** Gap between particles in the sampled dither grid. */
    particleGap: number;
    /** Dither grid resolution (max dimension in grid units). */
    gridSize: number;
    /** Scale factor mapping grid units to CSS pixels. */
    scale: number;
    /** Per-particle dot scale multiplier. */
    dotScale: number;
    /** When true, inverts the dither (fills background, not foreground). */
    invert: boolean;
    /** Corner radius as a fraction of the shortest dimension, for the inversion mask. */
    cornerRadius: number;
    /** Floyd-Steinberg threshold (0–255). */
    threshold: number;
    /** Contrast adjustment (-255 to 255). */
    contrast: number;
    /** Gamma correction factor. */
    gamma: number;
    /** Gaussian blur radius applied to source image before dithering. */
    blur: number;
    /** Error diffusion spread strength (0–1). */
    diffusionStrength: number;
    /** Serpentine scanning for Floyd-Steinberg (reduces artifact banding). */
    serpentine: boolean;
}
export type KineticOSConfig = DotsConfig | ImageParticleConfig;
