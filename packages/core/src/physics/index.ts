import type { PhysicsValues } from '../types.js';
import { LERP_FACTOR, SNAP_THRESHOLD } from '../constants.js';
import { applyCursorForce } from './cursor.js';
import { type Ripple, applyRippleForce, pruneExpiredRipples } from './ripple.js';
import { SpatialGrid } from './spatial.js';

interface CursorState {
  x: number;
  y: number;
  active: boolean;
}

/**
 * PhysicsModule encapsulates cursor repulsion and click ripple physics.
 * It is instantiated by any effect that declares supportsPhysics = true.
 *
 * The module owns no position data — the owning effect passes flat Float32Arrays
 * into tick(), which writes physics offsets back in place.
 */
export class PhysicsModule {
  private readonly cursor: CursorState = { x: 0, y: 0, active: false };
  private readonly ripples: Ripple[] = [];
  private readonly spatial: SpatialGrid;

  // Store bound handler references so we can remove them cleanly
  private boundOnMove!: (e: PointerEvent) => void;
  private boundOnLeave!: (e: PointerEvent) => void;
  private boundOnUp!: (e: PointerEvent) => void;

  private canvas: HTMLCanvasElement | null = null;
  private targetElement: HTMLElement | Window | null = null;

  constructor(
    private readonly config: PhysicsValues,
    private readonly rippleEnabled: boolean,
  ) {
    // Cell size is 1.2× cursor radius — gives 3×3 neighborhood coverage
    this.spatial = new SpatialGrid(Math.ceil(config.mouseRadius * 1.2));
  }

  /**
   * Attaches pointer event listeners.
   * If hoverTarget is 'container', binds to canvas.parentElement.
   * Otherwise binds to window globally.
   */
  attach(canvas: HTMLCanvasElement, hoverTarget: 'global' | 'container' = 'global'): void {
    this.canvas = canvas;
    this.targetElement = hoverTarget === 'container' && canvas.parentElement ? canvas.parentElement : window;

    this.boundOnMove = (e: PointerEvent) => {
      const rect = this.canvas?.getBoundingClientRect();
      if (!rect) return;
      this.cursor.x = e.clientX - rect.left;
      this.cursor.y = e.clientY - rect.top;
      this.cursor.active = true;
    };

    this.boundOnLeave = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      this.cursor.active = false;
    };

    this.boundOnUp = (e: PointerEvent) => {
      if (!this.rippleEnabled) return;
      const rect = this.canvas?.getBoundingClientRect();
      if (!rect) return;
      this.ripples.push({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        start: performance.now(),
      });
      if (e.pointerType !== 'mouse') this.cursor.active = false;
    };

    this.targetElement.addEventListener('pointermove', this.boundOnMove as EventListener);
    this.targetElement.addEventListener('pointerleave', this.boundOnLeave as EventListener);
    this.targetElement.addEventListener('pointerup', this.boundOnUp as EventListener);
  }

  /** Removes all event listeners. Call from the owning effect's destroy(). */
  detach(): void {
    if (this.targetElement) {
      this.targetElement.removeEventListener('pointermove', this.boundOnMove as EventListener);
      this.targetElement.removeEventListener('pointerleave', this.boundOnLeave as EventListener);
      this.targetElement.removeEventListener('pointerup', this.boundOnUp as EventListener);
      this.targetElement = null;
    }
    this.canvas = null;
  }

  /**
   * Must be called when the grid is regenerated (resize).
   * Rebuilds spatial hash with new dot positions.
   */
  rebuildSpatial(baseX: Float32Array, baseY: Float32Array, count: number): void {
    this.spatial.clear();
    for (let i = 0; i < count; i++) {
      this.spatial.insert(i, baseX[i] ?? 0, baseY[i] ?? 0);
    }
  }

  /**
   * Advances physics by one frame.
   *
   * Reads cursor/ripple state, writes force offsets back into offsetX/offsetY.
   * Returns true if any dot moved (so the caller knows whether to re-upload the buffer).
   *
   * Physics algorithm:
   * 1. Prune expired ripples
   * 2. For each candidate dot near the cursor (via spatial grid): apply cursor force
   * 3. For each active ripple: iterate all dots (ring can be anywhere)
   * 4. Lerp each offset toward target; snap to zero below threshold
   */
  tick(
    baseX: Float32Array,
    baseY: Float32Array,
    offsetX: Float32Array,
    offsetY: Float32Array,
    count: number,
  ): boolean {
    const now = performance.now();
    const { mouseRadius, mouseForce, rippleSpeed, rippleWidth, rippleForce, rippleDuration } =
      this.config;

    pruneExpiredRipples(this.ripples, now, rippleDuration);

    const numRipples = this.ripples.length;
    // Small amplification when multiple ripples overlap
    const rippleMul = numRipples > 0 ? 1 + 0.5 * (numRipples - 1) : 0;

    // Accumulate forces per dot into temporary typed arrays
    const targetFX = new Float32Array(count);
    const targetFY = new Float32Array(count);

    // --- Cursor force via spatial grid (fast path) ---
    if (this.cursor.active) {
      const candidates = this.spatial.queryRadius(this.cursor.x, this.cursor.y, mouseRadius);
      for (const i of candidates) {
        const { fx, fy } = applyCursorForce(
          i,
          baseX,
          baseY,
          offsetX,
          offsetY,
          this.cursor.x,
          this.cursor.y,
          mouseRadius,
          mouseForce,
        );
        targetFX[i] = (targetFX[i] ?? 0) + fx;
        targetFY[i] = (targetFY[i] ?? 0) + fy;
      }
    }

    // --- Ripple forces (must iterate all dots — ring can hit any position) ---
    for (const ripple of this.ripples) {
      for (let i = 0; i < count; i++) {
        const { fx, fy } = applyRippleForce(
          i,
          baseX,
          baseY,
          ripple,
          now,
          rippleSpeed,
          rippleWidth,
          rippleForce,
          rippleDuration,
          rippleMul,
        );
        targetFX[i] = (targetFX[i] ?? 0) + fx;
        targetFY[i] = (targetFY[i] ?? 0) + fy;
      }
    }

    // --- Lerp offsets toward target forces + snap to zero ---
    let anyMotion = false;

    for (let i = 0; i < count; i++) {
      offsetX[i] = ((offsetX[i] ?? 0) + ((targetFX[i] ?? 0) - (offsetX[i] ?? 0)) * LERP_FACTOR);
      offsetY[i] = ((offsetY[i] ?? 0) + ((targetFY[i] ?? 0) - (offsetY[i] ?? 0)) * LERP_FACTOR);

      if (Math.abs(offsetX[i] ?? 0) < SNAP_THRESHOLD) offsetX[i] = 0;
      if (Math.abs(offsetY[i] ?? 0) < SNAP_THRESHOLD) offsetY[i] = 0;

      if (offsetX[i] !== 0 || offsetY[i] !== 0) anyMotion = true;
    }

    return anyMotion || numRipples > 0 || this.cursor.active;
  }
}
