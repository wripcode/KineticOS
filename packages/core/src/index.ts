import type { KineticOSConfig } from './types.js';
import { parseConfig } from './config.js';
import { VERSION } from './constants.js';
import { CanvasEffect } from './effects/base.js';
import { ImageParticleEffect } from './effects/image-particle.js';
import { GlobalRenderer } from './renderer/global-renderer.js';
import { DotsRenderNode } from './renderer/dots-render-node.js';

// ---------------------------------------------------------------------------
// Registry — tracks all mounted effects for cleanup and deduplication
// ---------------------------------------------------------------------------

const registry = new Map<Element, DotsRenderNode | CanvasEffect>();

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

function createEffect(config: KineticOSConfig): DotsRenderNode | CanvasEffect {
  switch (config.effect) {
    case 'dots-shader':
      return new DotsRenderNode(config, GlobalRenderer.getInstance());
    case 'image-particle':
      return new ImageParticleEffect(config);
  }
}

// ---------------------------------------------------------------------------
// Console banner
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
// ---------------------------------------------------------------------------

function debugElement(el: Element, isDebug: boolean): void {
  const tag = el.tagName.toLowerCase();
  const effect = el.getAttribute('ko-effect') ?? '(missing)';
  const rect = el.getBoundingClientRect();
  const hasSize = rect.width > 0 && rect.height > 0;
  const isCanvas = tag === 'canvas';
  const validEffects = ['dots-shader', 'image-particle'];

  const errors: string[] = [];
  if (isCanvas) errors.push('host is <canvas> — wrap in a <div> instead');
  if (!hasSize) errors.push(`zero dimensions (${rect.width}×${rect.height}px)`);
  if (!validEffects.includes(effect)) errors.push(`unknown ko-effect="${effect}"`);
  if (effect === 'image-particle' && !el.getAttribute('ko-src')) errors.push('missing ko-src');

  const status = errors.length > 0 ? '✗' : !hasSize ? '⚠' : '✓';
  const color = errors.length > 0 ? '#f87171' : !hasSize ? '#fbbf24' : '#6ee7b7';

  const attrs = ['ko-effect', 'ko-theme', 'ko-hover', 'ko-physics', 'ko-colors', 'ko-mouse']
    .filter((a) => el.hasAttribute(a))
    .map((a) => `${a}="${el.getAttribute(a)}"`)
    .join(' ');

  const dim = `${Math.round(rect.width)}×${Math.round(rect.height)}`;
  const errStr = errors.length > 0 ? ` — ${errors.join(', ')}` : '';

  if (isDebug) {
    console.log(
      `%c ${status} %c <${tag}> ${attrs} ${dim}${errStr}`,
      `color:${color};font-family:monospace;`,
      'color:#a1a1aa;font-family:monospace;font-size:0.9em;',
    );
  }
}

function runDebugger(): void {
  const elements = document.querySelectorAll('[ko-effect]');
  const n = elements.length;

  console.log(
    `%c[KineticOS] %c${n} effect${n !== 1 ? 's' : ''} found`,
    'color:#71717a;font-family:monospace;',
    'color:#a1a1aa;font-family:monospace;',
  );

  if (n === 0) {
    console.warn('[KineticOS] No [ko-effect] elements found — call KineticOS.refresh() after dynamic inserts.');
    return;
  }

  elements.forEach((el) => debugElement(el, true));
}

// ---------------------------------------------------------------------------
// DOM scan
// ---------------------------------------------------------------------------

function init(): void {
  document.querySelectorAll('[ko-effect]').forEach((el) => {
    if (registry.has(el)) return;

    if (el.tagName === 'CANVAS') {
      console.error('[KineticOS] Skipping <canvas> host — use a <div> wrapper instead.', el);
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

function logRendererStatus(): void {
  const renderer = GlobalRenderer.getInstance();
  const { canvas } = renderer;
  const n = registry.size;
  console.log(
    `%c[KineticOS] %cglobal canvas ${canvas.width}×${canvas.height}px · ${n} node${n !== 1 ? 's' : ''} registered`,
    'color:#71717a;font-family:monospace;',
    'color:#a1a1aa;font-family:monospace;',
  );
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
      if (isDebug) logRendererStatus();
    });
  } else {
    if (isDebug) runDebugger();
    init();
    if (isDebug) logRendererStatus();
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const KineticOS = {
  /** Destroys the effect on `el` and removes it from the registry. */
  destroy(el: Element): void {
    registry.get(el)?.destroy();
    registry.delete(el);
  },

  /** Destroys all mounted effects and the global canvas. */
  destroyAll(): void {
    registry.forEach((effect) => effect.destroy());
    registry.clear();
    GlobalRenderer.getInstance().destroy();
  },

  /** Scans for new `[ko-effect]` elements. Use after dynamic content insertion. */
  refresh(): void {
    init();
  },
};

if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).KineticOS = KineticOS;
}
