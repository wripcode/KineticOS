import type { PhysicsValues } from '../types.js';
/**
 * PhysicsModule encapsulates cursor repulsion and click ripple physics.
 * It is instantiated by any effect that declares supportsPhysics = true.
 *
 * The module owns no position data — the owning effect passes flat Float32Arrays
 * into tick(), which writes physics offsets back in place.
 */
export declare class PhysicsModule {
    private readonly config;
    private readonly rippleEnabled;
    private readonly cursor;
    private readonly ripples;
    private readonly spatial;
    private targetFX;
    private targetFY;
    private boundOnMove;
    private boundOnLeave;
    private boundOnUp;
    private hostElement;
    private targetElement;
    constructor(config: PhysicsValues, rippleEnabled: boolean);
    /**
     * Attaches pointer event listeners.
     * If hoverTarget is 'container', binds to the element itself.
     * Otherwise binds to window globally.
     * Accepts any HTMLElement — works for both canvas-based (image-particle) and
     * host-element-based (dots-shader via GlobalRenderer) effects.
     */
    attach(element: HTMLElement, hoverTarget?: 'global' | 'container'): void;
    /** Removes all event listeners. Call from the owning effect's destroy(). */
    detach(): void;
    /**
     * Must be called when the grid is regenerated (resize).
     * Rebuilds spatial hash with new dot positions and grows work arrays if needed.
     */
    rebuildSpatial(baseX: Float32Array, baseY: Float32Array, count: number): void;
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
    tick(baseX: Float32Array, baseY: Float32Array, offsetX: Float32Array, offsetY: Float32Array, count: number): boolean;
}
