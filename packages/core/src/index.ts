import type { KineticOSConfig } from './types.js';
import { parseConfig } from './config.js';
import { VERSION } from './constants.js';
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
// Console banner
// Styled badge, similar to Finsweet Attributes, printed once on activation.
// ---------------------------------------------------------------------------

function printBanner(): void {
  console.log(
    '%c KineticOS %c v' + VERSION + ' ',
    'background:#18181b;color:#fc6d26;font-weight:700;font-family:monospace;padding:3px 8px;border-radius:4px 0 0 4px;',
    'background:#fc6d26;color:#18181b;font-weight:700;font-family:monospace;padding:3px 8px;border-radius:0 4px 4px 0;',
  );
}

// ---------------------------------------------------------------------------
// Debugger — enabled via `debug` attribute on the <script> tag.
// Audits every [ko-effect] element before init() runs.
// ---------------------------------------------------------------------------

function debugElement(el: Element): void {
  const tag = el.tagName.toLowerCase();
  const effectAttr = el.getAttribute('ko-effect') ?? '(missing)';
  const isCanvasHost = tag === 'canvas';

  const rect = el.getBoundingClientRect();
  const hasSize = rect.width > 0 && rect.height > 0;

  const errors: string[] = [];
  const warnings: string[] = [];
  const info: Record<string, unknown> = {};

  // --- Structural checks -------------------------------------------------

  if (isCanvasHost) {
    errors.push(
      'ko-effect is on a <canvas> element. ' +
      'KineticOS mounts a managed canvas INSIDE the host — ' +
      'use a <div> (or any non-canvas block) as the wrapper instead.',
    );
  }

  if (!hasSize) {
    warnings.push(
      `Host element has zero dimensions (${rect.width}×${rect.height}px). ` +
      'Give it an explicit width/height or make sure it is in the layout before the script runs.',
    );
  }

  // --- Attribute checks --------------------------------------------------

  const validEffects = ['dots-shader', 'image-particle'];
  if (!validEffects.includes(effectAttr)) {
    errors.push(
      `ko-effect="${effectAttr}" is not a known effect. ` +
      `Valid values: ${validEffects.join(', ')}.`,
    );
  }

  if (effectAttr === 'image-particle') {
    const src = el.getAttribute('ko-src');
    if (!src) {
      errors.push('image-particle requires a ko-src attribute with the image URL.');
    } else {
      info['ko-src'] = src;
    }
  }

  // --- Environment checks ------------------------------------------------

  if (effectAttr === 'dots-shader') {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2');
    if (!gl) {
      errors.push('WebGL2 is not available in this browser. dots-shader will not render.');
    } else {
      info['WebGL2'] = '✓ available';
    }
  }

  // --- Resolved config ---------------------------------------------------

  if (!isCanvasHost && validEffects.includes(effectAttr)) {
    try {
      info['resolvedConfig'] = parseConfig(el);
    } catch (err) {
      errors.push(`parseConfig threw: ${String(err)}`);
    }
  }

  // --- Contextual attribute summary --------------------------------------

  info['ko-effect'] = effectAttr;
  info['ko-theme'] = el.getAttribute('ko-theme') ?? '(not set — defaults to ember)';
  info['ko-physics'] = el.getAttribute('ko-physics') ?? '(not set — defaults to medium)';
  info['dimensions'] = `${rect.width}×${rect.height}px`;

  // --- Print grouped output ----------------------------------------------

  const status = errors.length > 0 ? '✗' : warnings.length > 0 ? '⚠' : '✓';
  const color = errors.length > 0 ? '#f87171' : warnings.length > 0 ? '#fbbf24' : '#4ade80';
  const label = `[KineticOS Debug] ${status} <${tag}> ko-effect="${effectAttr}"`;

  console.groupCollapsed(`%c${label}`, `color:${color};font-weight:bold;font-family:monospace;`);

  for (const msg of errors) {
    console.error('[KineticOS Debug]', msg);
  }
  for (const msg of warnings) {
    console.warn('[KineticOS Debug]', msg);
  }

  console.log('[KineticOS Debug] details →', info);
  console.groupEnd();
}

function runDebugger(): void {
  const elements = document.querySelectorAll('[ko-effect]');

  console.group(
    `%c[KineticOS Debug] Scanning ${elements.length} element(s) with [ko-effect]`,
    'color:#38bdf8;font-weight:bold;font-family:monospace;',
  );

  if (elements.length === 0) {
    console.warn(
      '[KineticOS Debug] No [ko-effect] elements found. ' +
      'Make sure the attribute is present in the DOM before the script executes, ' +
      'or call KineticOS.refresh() after dynamic content is inserted.',
    );
  }

  elements.forEach((el) => debugElement(el));
  console.groupEnd();
}

// ---------------------------------------------------------------------------
// DOM scan
// ---------------------------------------------------------------------------

function init(): void {
  document.querySelectorAll('[ko-effect]').forEach((el) => {
    if (registry.has(el)) return; // already mounted — skip

    // Canvas elements cannot host the managed canvas; the browser ignores
    // nested canvas content. The debugger will have already logged this.
    if (el.tagName === 'CANVAS') {
      console.error(
        '[KineticOS] Skipping <canvas> host — use a <div> wrapper instead.',
        el,
      );
      return;
    }

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
//
// IMPORTANT: document.currentScript is ALWAYS null for <script type="module">
// (per HTML spec — modules are deferred by nature). We fall back to
// querySelector so the `kineticos` attribute is reliably detected regardless
// of whether the tag is async, defer, or inline module.
// ---------------------------------------------------------------------------

const scriptTag =
  (document.currentScript as HTMLScriptElement | null) ??
  (document.querySelector('script[kineticos]') as HTMLScriptElement | null);

const isActivated = scriptTag?.hasAttribute('kineticos') ?? false;
const isDebug = scriptTag?.hasAttribute('debug') ?? false;

if (isActivated) {
  printBanner();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (isDebug) runDebugger();
      init();
    });
  } else {
    if (isDebug) runDebugger();
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
