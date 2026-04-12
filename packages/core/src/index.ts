import type { KineticOSConfig } from './types.js';
import { parseConfig } from './config.js';
import { CanvasEffect } from './effects/base.js';
import { DotsShaderEffect } from './effects/dots-shader.js';
import { ImageParticleEffect } from './effects/image-particle.js';

// ---------------------------------------------------------------------------
// Registry — tracks all mounted effects for cleanup and deduplication
// ---------------------------------------------------------------------------

const registry = new Map<Element, CanvasEffect>();

// ---------------------------------------------------------------------------
// Factory — type-safe switch, no if/else chains at call sites
// ---------------------------------------------------------------------------

function createEffect(config: KineticOSConfig): CanvasEffect {
  switch (config.effect) {
    case 'dots-shader':
      return new DotsShaderEffect(config);
    case 'image-particle':
      return new ImageParticleEffect(config);
  }
}

// ---------------------------------------------------------------------------
// DOM scan
// ---------------------------------------------------------------------------

function init(): void {
  document.querySelectorAll('[ko-effect]').forEach((el) => {
    if (registry.has(el)) return; // already mounted — skip

    try {
      const config = parseConfig(el);
      const effect = createEffect(config);
      effect.mount(el);
      registry.set(el, effect);
    } catch (err) {
      console.error('[KineticOS] Failed to initialize effect on element', el, err);
    }
  });
}

// ---------------------------------------------------------------------------
// Activation guard
// Require `kineticos` attribute on the script tag — safe for conditional use.
// Without it, the script loads but does nothing.
// ---------------------------------------------------------------------------

const scriptTag = document.currentScript as HTMLScriptElement | null;
const isActivated = scriptTag?.hasAttribute('kineticos') ?? false;

if (isActivated) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}

// ---------------------------------------------------------------------------
// Public API — exposed on window for SPA cleanup and dynamic refresh
// ---------------------------------------------------------------------------

export const KineticOS = {
  /**
   * Destroys the effect mounted on `el` and removes it from the registry.
   * Use in SPAs when a section with `ko-effect` is unmounted.
   */
  destroy(el: Element): void {
    registry.get(el)?.destroy();
    registry.delete(el);
  },

  /** Destroys all mounted effects. */
  destroyAll(): void {
    registry.forEach((effect) => effect.destroy());
    registry.clear();
  },

  /**
   * Scans the DOM for new `[ko-effect]` elements and mounts effects on them.
   * Already-mounted elements are skipped. Use after dynamic content insertion.
   */
  refresh(): void {
    init();
  },
};

// Attach to window for IIFE consumers (non-module script tags)
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).KineticOS = KineticOS;
}
