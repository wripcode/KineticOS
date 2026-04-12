import { describe, it, expect } from 'vitest';
import { parseConfig } from './config';
import { PHYSICS_PRESETS, THEMES } from './constants';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEl(attrs: Record<string, string>): Element {
  const el = document.createElement('div');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

// ---------------------------------------------------------------------------
// Effect type
// ---------------------------------------------------------------------------

describe('parseConfig — effect type', () => {
  it('defaults to dots-shader when ko-effect is missing', () => {
    const config = parseConfig(makeEl({}));
    expect(config.effect).toBe('dots-shader');
  });

  it('parses dots-shader', () => {
    const config = parseConfig(makeEl({ 'ko-effect': 'dots-shader' }));
    expect(config.effect).toBe('dots-shader');
  });

  it('parses image-particle', () => {
    const config = parseConfig(makeEl({ 'ko-effect': 'image-particle' }));
    expect(config.effect).toBe('image-particle');
  });

  it('falls back to dots-shader for unknown effect values', () => {
    const config = parseConfig(makeEl({ 'ko-effect': 'unknown-thing' }));
    expect(config.effect).toBe('dots-shader');
  });
});

// ---------------------------------------------------------------------------
// FPS
// ---------------------------------------------------------------------------

describe('parseConfig — fps', () => {
  it('defaults to 60', () => {
    expect(parseConfig(makeEl({})).maxFps).toBe(60);
  });

  it('reads ko-fps', () => {
    expect(parseConfig(makeEl({ 'ko-fps': '30' })).maxFps).toBe(30);
  });

  it('ignores invalid ko-fps and uses default', () => {
    expect(parseConfig(makeEl({ 'ko-fps': 'fast' })).maxFps).toBe(60);
  });

  it('ignores negative fps and uses default', () => {
    expect(parseConfig(makeEl({ 'ko-fps': '-10' })).maxFps).toBe(60);
  });
});

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

describe('parseConfig — colors (dots-shader)', () => {
  it('defaults to ember theme when no color attributes', () => {
    const config = parseConfig(makeEl({ 'ko-effect': 'dots-shader' }));
    if (config.effect !== 'dots-shader') throw new Error('wrong effect');
    // Ember theme has 3 palette entries, expanded to 6
    expect(config.colors).toHaveLength(6);
    // First color should match ember[0] doubled
    expect(config.colors[0]).toEqual(config.colors[1]);
    expect(config.colors[0]).toEqual(THEMES.ember[0]);
  });

  it('applies named ko-theme', () => {
    const config = parseConfig(makeEl({ 'ko-effect': 'dots-shader', 'ko-theme': 'ocean' }));
    if (config.effect !== 'dots-shader') throw new Error('wrong effect');
    expect(config.colors[0]).toEqual(THEMES.ocean[0]);
  });

  it('ko-colors overrides ko-theme', () => {
    const config = parseConfig(
      makeEl({ 'ko-effect': 'dots-shader', 'ko-theme': 'ocean', 'ko-colors': '#FF0000' }),
    );
    if (config.effect !== 'dots-shader') throw new Error('wrong effect');
    // All 6 slots should be the single red color
    expect(config.colors[0]).toEqual([1, 0, 0]);
    expect(config.colors[5]).toEqual([1, 0, 0]);
  });

  it('parses 3 hex colors and expands to 6', () => {
    const config = parseConfig(
      makeEl({ 'ko-effect': 'dots-shader', 'ko-colors': '#FF0000,#00FF00,#0000FF' }),
    );
    if (config.effect !== 'dots-shader') throw new Error('wrong effect');
    expect(config.colors).toHaveLength(6);
    expect(config.colors[0]).toEqual([1, 0, 0]);
    expect(config.colors[2]).toEqual([0, 1, 0]);
    expect(config.colors[4]).toEqual([0, 0, 1]);
  });

  it('falls back to default theme on invalid hex', () => {
    const config = parseConfig(
      makeEl({ 'ko-effect': 'dots-shader', 'ko-colors': 'notacolor' }),
    );
    if (config.effect !== 'dots-shader') throw new Error('wrong effect');
    expect(config.colors[0]).toEqual(THEMES.ember[0]);
  });

  it('falls back to ember on unknown ko-theme value', () => {
    const config = parseConfig(
      makeEl({ 'ko-effect': 'dots-shader', 'ko-theme': 'neon-pizza' }),
    );
    if (config.effect !== 'dots-shader') throw new Error('wrong effect');
    expect(config.colors[0]).toEqual(THEMES.ember[0]);
  });
});

// ---------------------------------------------------------------------------
// Physics preset
// ---------------------------------------------------------------------------

describe('parseConfig — physics preset', () => {
  it('defaults to medium preset', () => {
    const config = parseConfig(makeEl({}));
    expect(config.physics).toBe('medium');
    expect(config.physicsValues).toEqual(PHYSICS_PRESETS.medium);
  });

  it('reads ko-physics="subtle"', () => {
    const config = parseConfig(makeEl({ 'ko-physics': 'subtle' }));
    expect(config.physics).toBe('subtle');
    expect(config.physicsValues).toEqual(PHYSICS_PRESETS.subtle);
  });

  it('reads ko-physics="strong"', () => {
    const config = parseConfig(makeEl({ 'ko-physics': 'strong' }));
    expect(config.physicsValues).toEqual(PHYSICS_PRESETS.strong);
  });

  it('individual ko-mouse-force overrides preset', () => {
    const config = parseConfig(
      makeEl({ 'ko-physics': 'subtle', 'ko-mouse-force': '999' }),
    );
    expect(config.physicsValues.mouseForce).toBe(999);
    // Other values still from subtle preset
    expect(config.physicsValues.mouseRadius).toBe(PHYSICS_PRESETS.subtle.mouseRadius);
  });

  it('all individual physics attrs override preset', () => {
    const attrs: Record<string, string> = {
      'ko-physics': 'subtle',
      'ko-mouse-radius': '50',
      'ko-mouse-force': '75',
      'ko-ripple-speed': '100',
      'ko-ripple-width': '30',
      'ko-ripple-force': '80',
      'ko-ripple-duration': '400',
    };
    const config = parseConfig(makeEl(attrs));
    expect(config.physicsValues).toEqual({
      mouseRadius: 50,
      mouseForce: 75,
      rippleSpeed: 100,
      rippleWidth: 30,
      rippleForce: 80,
      rippleDuration: 400,
    });
  });
});

// ---------------------------------------------------------------------------
// Mouse toggles
// ---------------------------------------------------------------------------

describe('parseConfig — mouse toggles (dots-shader)', () => {
  it('ko-mouse defaults to true', () => {
    const config = parseConfig(makeEl({ 'ko-effect': 'dots-shader' }));
    expect(config.mouseEnabled).toBe(true);
  });

  it('ko-mouse="false" disables cursor and ripple', () => {
    const config = parseConfig(makeEl({ 'ko-effect': 'dots-shader', 'ko-mouse': 'false' }));
    expect(config.mouseEnabled).toBe(false);
    expect(config.rippleEnabled).toBe(false);
  });

  it('ko-ripple="false" keeps cursor but disables ripple', () => {
    const config = parseConfig(
      makeEl({ 'ko-effect': 'dots-shader', 'ko-ripple': 'false' }),
    );
    expect(config.mouseEnabled).toBe(true);
    expect(config.rippleEnabled).toBe(false);
  });
});

describe('parseConfig — mouse toggles (image-particle)', () => {
  it('image-particle always has mouseEnabled=true even if ko-mouse="false"', () => {
    const config = parseConfig(
      makeEl({ 'ko-effect': 'image-particle', 'ko-mouse': 'false' }),
    );
    expect(config.mouseEnabled).toBe(true);
  });

  it('image-particle respects ko-ripple="false"', () => {
    const config = parseConfig(
      makeEl({ 'ko-effect': 'image-particle', 'ko-ripple': 'false' }),
    );
    expect(config.rippleEnabled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Dot size attrs
// ---------------------------------------------------------------------------

describe('parseConfig — dot grid attrs', () => {
  it('reads ko-dot-size and ko-total-size', () => {
    const config = parseConfig(
      makeEl({ 'ko-effect': 'dots-shader', 'ko-dot-size': '2.5', 'ko-total-size': '8' }),
    );
    if (config.effect !== 'dots-shader') throw new Error();
    expect(config.dotSize).toBe(2.5);
    expect(config.totalSize).toBe(8);
  });

  it('validates ko-opacities: exactly 10 values', () => {
    const config = parseConfig(
      makeEl({
        'ko-effect': 'dots-shader',
        'ko-opacities': '0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9,1.0',
      }),
    );
    if (config.effect !== 'dots-shader') throw new Error();
    expect(config.opacities).toHaveLength(10);
    expect(config.opacities[0]).toBe(0.1);
  });

  it('ignores ko-opacities with wrong count and uses default', () => {
    const config = parseConfig(
      makeEl({ 'ko-effect': 'dots-shader', 'ko-opacities': '0.5,0.5' }),
    );
    if (config.effect !== 'dots-shader') throw new Error();
    expect(config.opacities).toHaveLength(10); // default
  });
});
