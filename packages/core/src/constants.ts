import type { PhysicsPreset, PhysicsValues, ThemePreset } from './types.js';

// ---------------------------------------------------------------------------
// Physics presets
// ---------------------------------------------------------------------------

/** Fully resolved physics values for each named preset. */
export const PHYSICS_PRESETS: Readonly<Record<PhysicsPreset, PhysicsValues>> = {
  subtle: {
    mouseRadius: 80,
    mouseForce: 60,
    rippleSpeed: 160,
    rippleWidth: 40,
    rippleForce: 60,
    rippleDuration: 450,
  },
  medium: {
    mouseRadius: 100,
    mouseForce: 120,
    rippleSpeed: 225,
    rippleWidth: 60,
    rippleForce: 120,
    rippleDuration: 675,
  },
  strong: {
    mouseRadius: 140,
    mouseForce: 200,
    rippleSpeed: 300,
    rippleWidth: 80,
    rippleForce: 200,
    rippleDuration: 900,
  },
} as const;

// ---------------------------------------------------------------------------
// Color themes — RGB tuples in 0–1 range (3 palette colors per theme)
// ---------------------------------------------------------------------------

/** All 5 built-in color palettes. Stored as 3-entry RGB tuple arrays. */
export const THEMES: Readonly<Record<ThemePreset, readonly [number, number, number][]>> = {
  // Ember — orange/red (the prototype default)
  ember: [
    [0.886, 0.263, 0.161],
    [0.988, 0.427, 0.149],
    [0.988, 0.639, 0.149],
  ],
  // Ocean — blue/teal
  ocean: [
    [0.102, 0.396, 0.604],
    [0.133, 0.545, 0.733],
    [0.255, 0.714, 0.769],
  ],
  // Violet — purple/indigo
  violet: [
    [0.435, 0.196, 0.678],
    [0.584, 0.306, 0.757],
    [0.757, 0.443, 0.831],
  ],
  // Mono — white/gray on dark
  mono: [
    [0.600, 0.600, 0.600],
    [0.750, 0.750, 0.750],
    [1.000, 1.000, 1.000],
  ],
  // Gold — amber/yellow
  gold: [
    [0.788, 0.541, 0.098],
    [0.918, 0.686, 0.153],
    [0.980, 0.820, 0.306],
  ],
} as const;

// ---------------------------------------------------------------------------
// Dot grid defaults
// ---------------------------------------------------------------------------

/** Default opacity distribution for the dots-shader. Always 10 values. */
export const DEFAULT_OPACITIES: readonly number[] = [
  0.4, 0.4, 0.6, 0.6, 0.6, 0.8, 0.8, 0.8, 0.8, 1.0,
] as const;

export const DEFAULT_DOT_SIZE = 1;
export const DEFAULT_TOTAL_SIZE = 5;
export const DEFAULT_FPS = 60;
export const DEFAULT_THEME: ThemePreset = 'ember';
export const DEFAULT_PHYSICS_PRESET: PhysicsPreset = 'medium';

// ---------------------------------------------------------------------------
// Physics simulation constants
// ---------------------------------------------------------------------------

/** Lerp factor for smooth offset return-to-rest animation. */
export const LERP_FACTOR = 0.12;

/**
 * Below this offset magnitude (px), the offset snaps to zero.
 * Prevents infinite micro-animation when the dot is nearly at rest.
 */
export const SNAP_THRESHOLD = 0.01;

// ---------------------------------------------------------------------------
// image-particle defaults (not exposed as ko-* attributes in v1)
// ---------------------------------------------------------------------------

export const DEFAULT_GRID_SIZE = 200;
export const DEFAULT_SCALE = 0.5;
export const DEFAULT_DOT_SCALE = 1;
export const DEFAULT_INVERT = true;
export const DEFAULT_CORNER_RADIUS = 0.2;
export const DEFAULT_THRESHOLD = 180;
export const DEFAULT_CONTRAST = 0;
export const DEFAULT_GAMMA = 1.0;
export const DEFAULT_BLUR = 3.75;
export const DEFAULT_DIFFUSION_STRENGTH = 1.0;
export const DEFAULT_SERPENTINE = true;

export const DEFAULT_PARTICLE_SIZE = 2;
export const DEFAULT_PARTICLE_GAP = 4;

// ---------------------------------------------------------------------------
// DPR cap — prevents allocating absurdly large buffers on 3× screens
// ---------------------------------------------------------------------------

export const MAX_DPR = 2;
