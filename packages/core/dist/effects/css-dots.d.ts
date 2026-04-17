import type { DotsConfig } from '../types.js';
/**
 * Pure CSS fallback for dots-shader.
 * Uses a single absolute <div> with radial-gradient background instead of WebGL.
 * Zero rAF, zero WebGL contexts. Used for explicit ko-mode="css" or auto-downgrade.
 */
export declare class CssDotsFallback {
    private readonly config;
    private readonly div;
    private hostElement;
    constructor(config: DotsConfig);
    mount(el: Element): void;
    /** Tears down the effect. */
    destroy(): void;
}
