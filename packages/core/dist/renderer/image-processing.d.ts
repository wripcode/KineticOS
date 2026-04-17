/**
 * CPU-side image processing pipeline for the image-particle effect.
 *
 * Pure functions extracted from the old Canvas2D ImageParticleEffect.
 * Runs once on mount/resize — not per-frame. The output feeds into
 * ImageParticleRenderNode which uploads positions to the GPU.
 */
interface GrayscaleResult {
    grayscale: Uint8Array;
    alpha: Uint8Array;
    width: number;
    height: number;
}
export interface ParticleData {
    baseX: Float32Array;
    baseY: Float32Array;
    colorIndices: Float32Array;
    count: number;
    dotSize: number;
}
export declare function fetchImage(src: string): Promise<HTMLImageElement>;
export declare function toGrayscaleGrid(img: HTMLImageElement, maxDim: number, contrast: number, gamma: number, blur: number): GrayscaleResult;
export declare function errorDiffusionDither(grayscale: Uint8Array, width: number, height: number, threshold: number, diffusionStrength: number, serpentine: boolean, alpha: Uint8Array): Float32Array;
export declare function applyMaskInversion(positions: Float32Array, gridW: number, gridH: number, radiusPct: number, alpha: Uint8Array): Float32Array;
export declare function buildParticleData(points: Float32Array, scaleFactor: number, dotScale: number, originX: number, originY: number, colorsCount: number): ParticleData;
export {};
