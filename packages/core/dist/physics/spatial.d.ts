/**
 * Spatial hash grid for O(1) neighborhood lookups.
 *
 * Divides the canvas into fixed-size cells. Instead of checking every dot
 * against the cursor each frame (O(n)), we only check dots in the 3×3
 * neighborhood of cells surrounding the cursor (O(~900) at typical settings).
 *
 * This gives a 90× speedup at 5px grid spacing on a 1920×1080 viewport.
 */
export declare class SpatialGrid {
    private readonly cellSize;
    private readonly cells;
    private width;
    constructor(cellSize: number);
    /** Clears all cells. Must be called before re-inserting on resize. */
    clear(): void;
    /** Sets the canvas width — required to compute cell keys correctly. */
    setWidth(width: number): void;
    /** Inserts a dot index into the cell that contains (x, y). */
    insert(index: number, x: number, y: number): void;
    /**
     * Returns all dot indices within the bounding box of (cx, cy) ± radius.
     * Callers should still do an exact distance check on returned candidates.
     */
    queryRadius(cx: number, cy: number, radius: number): readonly number[];
    /** Encodes a world-space (x, y) into an integer cell key. */
    private cellKey;
    /**
     * Encodes (gx, gy) grid coordinates into a single integer.
     * Uses Cantor pairing + bias to handle negative coordinates.
     */
    private gridKey;
}
