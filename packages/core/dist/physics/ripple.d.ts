/** A single click ripple — stores origin and birth timestamp. */
export interface Ripple {
    x: number;
    y: number;
    /** performance.now() at creation time. */
    start: number;
}
/**
 * Pure function that computes the ripple ring force on a single dot at index i.
 *
 * The ripple is an expanding ring of width `width` px. A dot only feels force
 * when it falls within the ring band. Force fades linearly over ripple lifetime.
 *
 * @param rippleMul - Amplification factor when multiple ripples are active.
 */
export declare function applyRippleForce(i: number, baseX: Float32Array, baseY: Float32Array, ripple: Ripple, now: number, speed: number, width: number, force: number, duration: number, rippleMul: number): {
    fx: number;
    fy: number;
};
/**
 * Removes expired ripples in-place (mutates the array).
 * Call this once per frame before processing forces.
 */
export declare function pruneExpiredRipples(ripples: Ripple[], now: number, duration: number): void;
