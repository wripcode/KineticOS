export default {
  label: 'Image Particle',
  groups: [
    { name: 'Source', controls: [
      { attr: 'ko-src', type: 'image-select', label: 'Image', default: '/demo/assets/apple-logo.svg',
        options: [
          { value: '/demo/assets/apple-logo.svg', label: 'Apple Logo' },
          { value: '/demo/assets/logo.svg', label: 'KineticOS Logo' },
          { value: '/demo/assets/white-logo.svg', label: 'White Logo' },
        ], labeled: true },
    ]},
    { name: 'Colors', controls: [
      { attr: 'ko-colors', type: 'colors', label: 'Custom Colors', default: '', maxColors: 6 },
    ]},
    { name: 'Particles', controls: [
      { attr: 'ko-particle-size', type: 'range', label: 'Particle Size', default: 1, min: 0.3, max: 5, step: 0.1 },
      { attr: 'ko-particle-gap', type: 'range', label: 'Gap', default: 4, min: 1, max: 10, step: 0.5 },
    ]},
    { name: 'Transform', controls: [
      { attr: 'ko-grid-size', type: 'range', label: 'Grid Size', default: 200, min: 50, max: 400, step: 10 },
      { attr: 'ko-scale', type: 'range', label: 'Scale', default: 0.5, min: 0.1, max: 1.5, step: 0.05 },
      { attr: 'ko-invert', type: 'toggle', label: 'Invert', default: true },
      { attr: 'ko-corner-radius', type: 'range', label: 'Corner Radius', default: 0.2, min: 0, max: 0.5, step: 0.02 },
    ]},
    { name: 'Processing', controls: [
      { attr: 'ko-threshold', type: 'range', label: 'Threshold', default: 180, min: 0, max: 255, step: 1 },
      { attr: 'ko-contrast', type: 'range', label: 'Contrast', default: 0, min: -255, max: 255, step: 5 },
      { attr: 'ko-gamma', type: 'range', label: 'Gamma', default: 1.0, min: 0.1, max: 3, step: 0.05 },
      { attr: 'ko-blur', type: 'range', label: 'Blur', default: 3.75, min: 0, max: 10, step: 0.25 },
      { attr: 'ko-diffusion', type: 'range', label: 'Diffusion', default: 1.0, min: 0, max: 1, step: 0.05 },
      { attr: 'ko-serpentine', type: 'toggle', label: 'Serpentine', default: true },
    ]},
    { name: 'Mouse Physics', controls: [
      { attr: 'ko-mouse-radius', type: 'range', label: 'Radius', default: 100, min: 20, max: 300, step: 5 },
      { attr: 'ko-mouse-force', type: 'range', label: 'Force', default: 120, min: 10, max: 400, step: 5 },
    ]},
  ]
};
