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

  // Preallocated work arrays — reused every frame to eliminate ~20MB/s of GC pressure.
  // Grown lazily when dot count increases; never shrunk (stable steady-state size).
  private targetFX: Float32Array = new Float32Array(0);
  private targetFY: Float32Array = new Float32Array(0);

  // Store bound handler references so we can remove them cleanly
  private boundOnMove!: (e: PointerEvent) => void;
  private boundOnLeave!: (e: PointerEvent) => void;
  private boundOnUp!: (e: PointerEvent) => void;

  private hostElement: HTMLElement | null = null;
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
   * If hoverTarget is 'container', binds to the element itself.
   * Otherwise binds to window globally.
   * Accepts any HTMLElement — works for both canvas-based (image-particle) and
   * host-element-based (dots-shader via GlobalRenderer) effects.
   */
  attach(element: HTMLElement, hoverTarget: 'global' | 'container' = 'global'): void {
    this.hostElement = element;
    this.targetElement = hoverTarget === 'container' ? element : window;

    this.boundOnMove = (e: PointerEvent) => {
      const rect = this.hostElement?.getBoundingClientRect();
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
      const rect = this.hostElement?.getBoundingClientRect();
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
    this.hostElement = null;
  }

  /**
   * Must be called when the grid is regenerated (resize).
   * Rebuilds spatial hash with new dot positions and grows work arrays if needed.
   */
  rebuildSpatial(baseX: Float32Array, baseY: Float32Array, count: number): void {
    this.spatial.clear();

    // Grow work arrays when dot count increases — never reallocate on steady-state frames
    if (this.targetFX.length < count) {
      this.targetFX = new Float32Array(count);
      this.targetFY = new Float32Array(count);
    }

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
   * 3. For each active ripple: query only dots within the ring's outer bound (spatial pruning)
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
    const rippleMul = numRipples > 0 ? 1 + 0.5 * (numRipples - 1) : 0;

    // Reuse preallocated arrays — fill(0) is a SIMD-accelerated memset, far cheaper
    // than allocating new Float32Array(count) every frame (~320KB × 2 at 60fps).
    this.targetFX.fill(0, 0, count);
    this.targetFY.fill(0, 0, count);

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
        this.targetFX[i] = (this.targetFX[i] ?? 0) + fx;
        this.targetFY[i] = (this.targetFY[i] ?? 0) + fy;
      }
    }

    // --- Ripple forces — spatially pruned to the ring's outer bounding radius ---
    // Old approach was O(n × rippleCount) — all 80K dots per ripple per frame.
    // New approach queries only dots within (ringRadius + rippleWidth) of the origin,
    // reducing to O(ring_area / cell²) which is typically <<< n for large canvases.
    for (const ripple of this.ripples) {
      const elapsed = now - ripple.start;
      const ringRadius = (elapsed / 1000) * rippleSpeed;
      const queryRadius = ringRadius + rippleWidth;

      const candidates = this.spatial.queryRadius(ripple.x, ripple.y, queryRadius);
      for (const i of candidates) {
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
        this.targetFX[i] = (this.targetFX[i] ?? 0) + fx;
        this.targetFY[i] = (this.targetFY[i] ?? 0) + fy;
      }
    }

    // --- Lerp offsets toward target forces + snap to zero ---
    let anyMotion = false;

    for (let i = 0; i < count; i++) {
      offsetX[i] = ((offsetX[i] ?? 0) + ((this.targetFX[i] ?? 0) - (offsetX[i] ?? 0)) * LERP_FACTOR);
      offsetY[i] = ((offsetY[i] ?? 0) + ((this.targetFY[i] ?? 0) - (offsetY[i] ?? 0)) * LERP_FACTOR);

      if (Math.abs(offsetX[i] ?? 0) < SNAP_THRESHOLD) offsetX[i] = 0;
      if (Math.abs(offsetY[i] ?? 0) < SNAP_THRESHOLD) offsetY[i] = 0;

      if (offsetX[i] !== 0 || offsetY[i] !== 0) anyMotion = true;
    }

    return anyMotion || numRipples > 0 || this.cursor.active;
  }
}
