import type { PhysicsPreset, PhysicsValues, ThemePreset } from './types.js';
export declare const VERSION = "__KINETICOS_VERSION__";
/** Fully resolved physics values for each named preset. */
export declare const PHYSICS_PRESETS: Readonly<Record<PhysicsPreset, PhysicsValues>>;
/** All 5 built-in color palettes. Stored as 3-entry RGB tuple arrays. */
export declare const THEMES: Readonly<Record<ThemePreset, readonly [number, number, number][]>>;
/** Default opacity distribution for the dots-shader. Always 10 values. */
export declare const DEFAULT_OPACITIES: readonly number[];
export declare const DEFAULT_DOT_SIZE = 1;
export declare const DEFAULT_TOTAL_SIZE = 5;
export declare const DEFAULT_FPS = 60;
export declare const DEFAULT_THEME: ThemePreset;
export declare const DEFAULT_PHYSICS_PRESET: PhysicsPreset;
/** Lerp factor for smooth offset return-to-rest animation. */
export declare const LERP_FACTOR = 0.12;
/**
 * Below this offset magnitude (px), the offset snaps to zero.
 * Prevents infinite micro-animation when the dot is nearly at rest.
 */
export declare const SNAP_THRESHOLD = 0.01;
export declare const DEFAULT_GRID_SIZE = 200;
export declare const DEFAULT_SCALE = 0.5;
export declare const DEFAULT_DOT_SCALE = 1;
export declare const DEFAULT_INVERT = true;
export declare const DEFAULT_CORNER_RADIUS = 0.2;
export declare const DEFAULT_THRESHOLD = 180;
export declare const DEFAULT_CONTRAST = 0;
export declare const DEFAULT_GAMMA = 1;
export declare const DEFAULT_BLUR = 3.75;
export declare const DEFAULT_DIFFUSION_STRENGTH = 1;
export declare const DEFAULT_SERPENTINE = true;
export declare const DEFAULT_PARTICLE_SIZE = 2;
export declare const DEFAULT_PARTICLE_GAP = 4;
export declare const DEFAULT_PB_PIXEL_SIZE = 3;
export declare const DEFAULT_PB_PATTERN_SCALE = 2;
export declare const DEFAULT_PB_PATTERN_DENSITY = 1.2;
export declare const DEFAULT_PB_PIXEL_JITTER = 0;
export declare const DEFAULT_PB_EDGE_FADE = 0.5;
export declare const DEFAULT_PB_VARIANT = "square";
export declare const DEFAULT_PB_SPEED = 0.5;
export declare const DEFAULT_PB_RIPPLE_SPEED = 0.3;
export declare const DEFAULT_PB_RIPPLE_THICKNESS = 0.1;
export declare const DEFAULT_PB_RIPPLE_INTENSITY = 1;
export declare const DEFAULT_PB_COLOR = "#B497CF";
export declare const DEFAULT_PB_MOUSE_RADIUS = 80;
export declare const DEFAULT_PB_MOUSE_STRENGTH = 1.2;
export declare const MAX_DPR = 2;
