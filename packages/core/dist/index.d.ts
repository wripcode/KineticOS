/**
 * KineticOS loader — dynamic per-effect chunking with lazy initialisation.
 *
 * Architecture decisions:
 * - EFFECT_MAP drives both dynamic import() and DOM-fallback detection.
 * - Effects declared on the <script> tag (ko-*) are preloaded with modulepreload hints.
 * - Effects found only in the DOM (but not declared on the script) emit a console.warn.
 * - The runtime registry replaces the static switch, so new effects only need one line added here.
 */
export declare const KineticOS: {
    destroy(el: Element): void;
    destroyAll(): void;
    /** Re-scans the DOM for new [ko-effect] elements. Loads new effect chunks if needed. */
    refresh(): Promise<void>;
};
