import type { KineticOSConfig } from './types.js';
/**
 * Reads all `ko-*` attributes from an element and returns a fully resolved
 * typed config object. Pure function — no side effects, easy to unit test.
 */
export declare function parseConfig(el: Element): KineticOSConfig;
