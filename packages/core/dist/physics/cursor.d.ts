/**
 * Pure function that computes the cursor repulsion force on a single dot.
 * Returns zero force when the dot is outside the cursor radius.
 *
 * Force model: cubic falloff — strongest at center, zero at radius edge.
 */
export declare function applyCursorForce(i: number, baseX: Float32Array, baseY: Float32Array, offsetX: Float32Array, offsetY: Float32Array, cursorX: number, cursorY: number, radius: number, force: number): {
    fx: number;
    fy: number;
};
