/**
 * Spatial hash grid for O(1) neighborhood lookups.
 *
 * Divides the canvas into fixed-size cells. Instead of checking every dot
 * against the cursor each frame (O(n)), we only check dots in the 3×3
 * neighborhood of cells surrounding the cursor (O(~900) at typical settings).
 *
 * This gives a 90× speedup at 5px grid spacing on a 1920×1080 viewport.
 */
export class SpatialGrid {
  private readonly cells = new Map<number, number[]>();
  private width = 0;

  // Reusable result buffer — reset each call, never reallocated on steady-state frames.
  private readonly resultBuf: number[] = [];

  constructor(private readonly cellSize: number) {}

  /** Clears all cells. Must be called before re-inserting on resize. */
  clear(): void {
    this.cells.clear();
  }

  /** Sets the canvas width — required to compute cell keys correctly. */
  setWidth(width: number): void {
    this.width = width;
  }

  /** Inserts a dot index into the cell that contains (x, y). */
  insert(index: number, x: number, y: number): void {
    const key = this.cellKey(x, y);
    let cell = this.cells.get(key);
    if (!cell) {
      cell = [];
      this.cells.set(key, cell);
    }
    cell.push(index);
  }

  /**
   * Returns all dot indices within the bounding box of (cx, cy) ± radius.
   * Callers should still do an exact distance check on returned candidates.
   * The returned array is reused — copy if you need persistence across calls.
   */
  queryRadius(cx: number, cy: number, radius: number): readonly number[] {
    const minGX = Math.floor((cx - radius) / this.cellSize);
    const maxGX = Math.floor((cx + radius) / this.cellSize);
    const minGY = Math.floor((cy - radius) / this.cellSize);
    const maxGY = Math.floor((cy + radius) / this.cellSize);

    this.resultBuf.length = 0;

    for (let gx = minGX; gx <= maxGX; gx++) {
      for (let gy = minGY; gy <= maxGY; gy++) {
        const cell = this.cells.get(this.gridKey(gx, gy));
        if (cell) {
          for (let j = 0; j < cell.length; j++) {
            this.resultBuf.push(cell[j]!);
          }
        }
      }
    }

    return this.resultBuf;
  }

  /** Encodes a world-space (x, y) into an integer cell key. */
  private cellKey(x: number, y: number): number {
    return this.gridKey(Math.floor(x / this.cellSize), Math.floor(y / this.cellSize));
  }

  /**
   * Encodes (gx, gy) grid coordinates into a single integer.
   * Uses Cantor pairing + bias to handle negative coordinates.
   */
  private gridKey(gx: number, gy: number): number {
    // Bias to make negative coords positive (canvas is always positive, but
    // dots near the edge may compute to gx/gy = -1 due to padding)
    const bx = gx + 1000;
    const by = gy + 1000;
    // Cantor pairing function — unique integer per (bx, by) pair
    return ((bx + by) * (bx + by + 1)) / 2 + by;
  }
}
