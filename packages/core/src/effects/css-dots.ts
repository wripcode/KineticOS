import type { DotsConfig } from '../types.js';

/**
 * Pure CSS fallback for dots-shader.
 * Uses a single absolute <div> with radial-gradient background instead of WebGL.
 * Zero rAF, zero WebGL contexts. Used for explicit ko-mode="css" or auto-downgrade.
 */
export class CssDotsFallback {
  private readonly div: HTMLDivElement;
  private hostElement!: Element;

  constructor(private readonly config: DotsConfig) {
    this.div = document.createElement('div');
  }

  mount(el: Element): void {
    this.hostElement = el;

    // Force relative positioning on host so absolute child is contained
    (el as HTMLElement).style.position = 'relative';

    const { totalSize, dotSize, colors } = this.config;
    
    // We use the first color of the parsed theme/colors as the dot color.
    // The WebGL version interpolates 6 colors, but CSS radial-gradient is a solid color.
    const [r, g, b] = colors[0]!;
    const rInt = Math.round(r * 255);
    const gInt = Math.round(g * 255);
    const bInt = Math.round(b * 255);
    
    // Base dot color — CSS dots are static, so we pick a medium opacity (0.5)
    // to approximate the WebGL average opacity.
    const rbgaDot = `rgba(${rInt}, ${gInt}, ${bInt}, 0.5)`;
    
    // The fade mask requested via ko-fade overlay.
    // E.g. radial-gradient(50% 50% at 50% 50%, rgba(..., 1) 40%, rgba(..., 0) 100%)
    const hasFade = el.hasAttribute('ko-fade');

    const backgrounds: string[] = [];
    
    if (hasFade) {
      // Vignette mask overlay (darkens edges). Default dark vignette.
      // E.g. dark radial overlay. Clerk uses rgb(19 19 22 / 0.8)
      backgrounds.push(`radial-gradient(50% 50% at 50% 50%, rgba(0, 0, 0, 0) 40%, rgba(0, 0, 0, 0.8) 100%)`);
    }

    // Dot grid pattern
    // A radial-gradient centered at each tile.
    backgrounds.push(`radial-gradient(circle, ${rbgaDot} ${dotSize}px, transparent ${dotSize}px)`);

    Object.assign(this.div.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '0',
      backgroundImage: backgrounds.join(', '),
      backgroundSize: hasFade ? '100% 100%, ' + `${totalSize}px ${totalSize}px` : `${totalSize}px ${totalSize}px`,
      backgroundPosition: hasFade ? '0 0, 0 0' : '0 0',
      backgroundRepeat: hasFade ? 'no-repeat, repeat' : 'repeat',
    });

    if (this.config.hoverTarget === 'container') {
      this.div.style.opacity = '0';
      this.div.style.transition = 'opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
      (el as HTMLElement).addEventListener('pointerenter', () => {
        this.div.style.opacity = '1';
      });
      (el as HTMLElement).addEventListener('pointerleave', () => {
        this.div.style.opacity = '0';
      });
    }

    el.appendChild(this.div);
  }

  /** Tears down the effect. */
  destroy(): void {
    this.div.remove();
  }
}
