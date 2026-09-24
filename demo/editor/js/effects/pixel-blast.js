export default {
  label: 'Pixel Blast',
  groups: [
    { name: 'Appearance', controls: [
      { attr: 'ko-color', type: 'color', label: 'Color', default: '#B497CF' },
      { attr: 'ko-variant', type: 'select', label: 'Variant', default: 'square',
        options: ['square','circle','triangle','diamond'] },
    ]},
    { name: 'Pattern', controls: [
      { attr: 'ko-pixel-size', type: 'range', label: 'Pixel Size', default: 3, min: 1, max: 10, step: 0.5 },
      { attr: 'ko-scale', type: 'range', label: 'Pattern Scale', default: 2, min: 0.5, max: 5, step: 0.1 },
      { attr: 'ko-density', type: 'range', label: 'Density', default: 1.2, min: 0.1, max: 3, step: 0.05 },
      { attr: 'ko-jitter', type: 'range', label: 'Size Jitter', default: 0, min: 0, max: 1, step: 0.05 },
      { attr: 'ko-edge-fade', type: 'range', label: 'Edge Fade', default: 0.5, min: 0, max: 1, step: 0.05 },
    ]},
    { name: 'Animation', controls: [
      { attr: 'ko-speed', type: 'range', label: 'Speed', default: 0.5, min: 0.05, max: 2, step: 0.05 },
    ]},
    { name: 'Ripple', controls: [
      { attr: 'ko-ripple-speed', type: 'range', label: 'Speed', default: 0.3, min: 0.05, max: 1, step: 0.05 },
      { attr: 'ko-ripple-thickness', type: 'range', label: 'Thickness', default: 0.1, min: 0.01, max: 0.5, step: 0.01 },
      { attr: 'ko-ripple-intensity', type: 'range', label: 'Intensity', default: 1, min: 0.1, max: 5, step: 0.1 },
    ]},
    { name: 'Cursor', controls: [
      { attr: 'ko-mouse-radius', type: 'range', label: 'Radius', default: 80, min: 20, max: 300, step: 5 },
      { attr: 'ko-mouse-strength', type: 'range', label: 'Strength', default: 1.2, min: 0.1, max: 5, step: 0.1 },
    ]},
  ]
};
