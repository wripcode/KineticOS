/**
 * KineticOS loader — dynamic per-effect chunking with lazy initialisation.
 *
 * Architecture decisions:
 * - EFFECT_MAP drives both dynamic import() and DOM-fallback detection.
 * - Effects declared on the <script> tag (ko-*) are preloaded with modulepreload hints.
 * - Effects found only in the DOM (but not declared on the script) emit a console.warn.
 * - The runtime registry replaces the static switch, so new effects only need one line added here.
 */

import type { KineticOSConfig } from './types.js';
import { parseConfig } from './config.js';
import { VERSION } from './constants.js';
import { GlobalRenderer, type RenderNode } from './renderer/global-renderer.js';

// ---------------------------------------------------------------------------
// Effect map — single source of truth for all available effects
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EffectCtor = new (config: any, renderer: GlobalRenderer) => RenderNode;
type EffectModule = { RenderNode: EffectCtor };
type EffectLoader = () => Promise<EffectModule>;

const EFFECT_MAP: Record<string, EffectLoader> = {
  'dots-shader':    () => import('./effects/dots-shader/index.js'),
  'image-particle': () => import('./effects/image-particle/index.js'),
  'pixel-blast':    () => import('./effects/pixel-blast/index.js'),
};

// Populated at runtime after dynamic imports resolve.
const effectRegistry = new Map<string, EffectCtor>();

// ---------------------------------------------------------------------------
// DOM-mounted effect registry
// ---------------------------------------------------------------------------

const mountRegistry = new Map<Element, RenderNode>();

// ---------------------------------------------------------------------------
// Loader utilities
// ---------------------------------------------------------------------------

/** Injects a <link rel="modulepreload"> for the given effect chunk. */
function preloadEffect(effectName: string): void {
  const link = document.createElement('link');
  link.rel = 'modulepreload';
  link.href = new URL(`./effects/${effectName}/index.min.js`, import.meta.url).href;
  document.head.appendChild(link);
}

/** Returns the effect names declared as ko-* attributes on the script tag. */
function getRequestedEffects(script: HTMLScriptElement | null): string[] {
  if (!script) return [];
  return Object.keys(EFFECT_MAP).filter((name) => script.hasAttribute(`ko-${name}`));
}

/**
 * Scans [ko-effect] elements and returns unique effect names found in the DOM.
 * Warns for any name not present in EFFECT_MAP.
 */
function getEffectsFromDOM(): string[] {
  const found = new Set<string>();
  document.querySelectorAll('[ko-effect]').forEach((el) => {
    const name = el.getAttribute('ko-effect');
    if (!name) return;
    if (!EFFECT_MAP[name]) {
      console.warn(`[KineticOS] Unknown effect "${name}" found in DOM — add ko-${name} to your <script> tag and ensure the effect is registered in EFFECT_MAP.`);
      return;
    }
    found.add(name);
  });
  return [...found];
}

/** Loads a set of effects in parallel, populates effectRegistry, injects preload hints. */
async function loadEffects(names: string[]): Promise<void> {
  if (names.length === 0) return;

  names.forEach(preloadEffect);

  const results = await Promise.all(
    names.map(async (name) => {
      const mod = await EFFECT_MAP[name]!();
      return { name, Ctor: mod.RenderNode };
    }),
  );

  results.forEach(({ name, Ctor }) => effectRegistry.set(name, Ctor));
}

// ---------------------------------------------------------------------------
// Factory — uses runtime effectRegistry instead of static switch
// ---------------------------------------------------------------------------

function createEffect(config: KineticOSConfig): RenderNode {
  const Ctor = effectRegistry.get(config.effect);
  if (!Ctor) throw new Error(`[KineticOS] Effect "${config.effect}" was not loaded. Add ko-${config.effect} to your <script> tag.`);
  return new Ctor(config, GlobalRenderer.getInstance());
}

/** Mounts a single element immediately — call only when resources should be allocated now. */
function mountElement(el: Element): void {
  try {
    const config = parseConfig(el);
    const effect = createEffect(config);
    effect.mount(el);
    mountRegistry.set(el, effect);
  } catch (err) {
    console.error('[KineticOS] Failed to initialize effect on element', el, err);
  }
}

/**
 * Scans [ko-effect] elements and mounts them lazily:
 * - In-viewport elements mount immediately.
 * - Below-fold elements wait for IntersectionObserver before allocating WebGL resources.
 * The 200px rootMargin pre-loads just before the element enters view, preventing pop-in.
 */
function scanAndMount(): void {
  // fixing-motion-performance: use IntersectionObserver for visibility, never poll scroll.
  // performance-optimizer: defer heavy init (GPU buffers, physics) until needed.
  const lazyObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        if (!mountRegistry.has(entry.target)) mountElement(entry.target);
      });
    },
    { rootMargin: '200px' },
  );

  document.querySelectorAll('[ko-effect]').forEach((el) => {
    if (mountRegistry.has(el)) return;

    if (el.tagName === 'CANVAS') {
      console.error('[KineticOS] Skipping <canvas> host — use a <div> wrapper instead.', el);
      return;
    }

    const rect = el.getBoundingClientRect();
    const isInViewport = rect.top < window.innerHeight + 200 && rect.bottom > -200;

    if (isInViewport) {
      // Mount synchronously — already visible, no reason to defer.
      mountElement(el);
    } else {
      // Defer — observe and mount when near viewport.
      lazyObserver.observe(el);
    }
  });
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
// Debugger
// ---------------------------------------------------------------------------

function debugElement(el: Element): void {
  const tag = el.tagName.toLowerCase();
  const effect = el.getAttribute('ko-effect') ?? '(missing)';
  const rect = el.getBoundingClientRect();
  const hasSize = rect.width > 0 && rect.height > 0;
  const isCanvas = tag === 'canvas';

  const errors: string[] = [];
  if (isCanvas) errors.push('host is <canvas> — wrap in a <div> instead');
  if (!hasSize) errors.push(`zero dimensions (${rect.width}×${rect.height}px)`);
  if (!EFFECT_MAP[effect]) errors.push(`unknown effect "${effect}" — not in EFFECT_MAP`);
  else if (!effectRegistry.has(effect)) errors.push(`ko-${effect} missing from <script> tag — effect was not loaded`);
  if (effect === 'image-particle' && !el.getAttribute('ko-src')) errors.push('missing ko-src');

  const status = errors.length > 0 ? '✗' : !hasSize ? '⚠' : '✓';
  const color = errors.length > 0 ? '#f87171' : !hasSize ? '#fbbf24' : '#6ee7b7';

  const attrs = ['ko-effect', 'ko-theme', 'ko-hover', 'ko-physics', 'ko-colors', 'ko-mouse',
    'ko-color', 'ko-variant', 'ko-pixel-size', 'ko-speed', 'ko-density']
    .filter((a) => el.hasAttribute(a))
    .map((a) => `${a}="${el.getAttribute(a)}"`)
    .join(' ');

  const dim = `${Math.round(rect.width)}×${Math.round(rect.height)}`;
  const errStr = errors.length > 0 ? ` — ${errors.join(', ')}` : '';

  console.log(
    `%c ${status} %c <${tag}> ${attrs} ${dim}${errStr}`,
    `color:${color};font-family:monospace;`,
    'color:#a1a1aa;font-family:monospace;font-size:0.9em;',
  );
}

/**
 * Always-on check: warns if any [ko-effect] in the DOM references an effect
 * that was never loaded because its ko-* attribute is missing from the script tag.
 * Runs regardless of debug mode so developers see it in production console too.
 */
function warnMissingScriptAttrs(): void {
  const missing = new Set<string>();
  document.querySelectorAll('[ko-effect]').forEach((el) => {
    const name = el.getAttribute('ko-effect');
    if (name && EFFECT_MAP[name] && !effectRegistry.has(name)) missing.add(name);
  });
  if (missing.size === 0) return;
  const attrs = [...missing].map((n) => `ko-${n}`).join(' ');
  console.warn(
    `[KineticOS] ${missing.size} effect(s) in DOM were not loaded.\n` +
    `Add the following to your <script kineticos> tag: ${attrs}`,
  );
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

  elements.forEach((el) => debugElement(el));
}

function logRendererStatus(): void {
  const renderer = GlobalRenderer.getInstance();
  const { canvas } = renderer;
  const n = mountRegistry.size;
  console.log(
    `%c[KineticOS] %cglobal canvas ${canvas.width}×${canvas.height}px · ${n} node${n !== 1 ? 's' : ''} registered`,
    'color:#71717a;font-family:monospace;',
    'color:#a1a1aa;font-family:monospace;',
  );
}

// ---------------------------------------------------------------------------
// Activation guard + bootstrap
// ---------------------------------------------------------------------------

const scriptTag =
  (document.currentScript as HTMLScriptElement | null) ??
  (document.querySelector('script[kineticos]') as HTMLScriptElement | null);

const isActivated = scriptTag?.hasAttribute('kineticos') ?? false;
const isDebug = scriptTag?.hasAttribute('debug') ?? false;

async function bootstrap(): Promise<void> {
  printBanner();

  // Determine which effects to load — script tag attrs first, DOM fallback otherwise.
  const requested = getRequestedEffects(scriptTag);
  const effectNames = requested.length > 0 ? requested : getEffectsFromDOM();

  await loadEffects(effectNames);

  warnMissingScriptAttrs();
  if (isDebug) runDebugger();
  scanAndMount();
  if (isDebug) logRendererStatus();
}

if (isActivated) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { void bootstrap(); });
  } else {
    void bootstrap();
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const KineticOS = {
  destroy(el: Element): void {
    mountRegistry.get(el)?.destroy();
    mountRegistry.delete(el);
  },

  destroyAll(): void {
    mountRegistry.forEach((effect) => effect.destroy());
    mountRegistry.clear();
    GlobalRenderer.getInstance().destroy();
  },

  /** Re-scans the DOM for new [ko-effect] elements. Loads new effect chunks if needed. */
  async refresh(): Promise<void> {
    const newEffects = getEffectsFromDOM().filter((name) => !effectRegistry.has(name));
    await loadEffects(newEffects);
    scanAndMount();
  },
};

if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).KineticOS = KineticOS;
}
