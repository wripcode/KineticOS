export default {
  label: 'Dots Shader',
  groups: [
    { name: 'Colors', controls: [
      { attr: 'ko-theme', type: 'select', label: 'Theme', default: 'ember',
        options: ['ember','ocean','violet','mono','gold'],
        excludeIf: function(v) { return v['ko-colors'] && v['ko-colors'] !== ''; } },
      { attr: 'ko-colors', type: 'colors', label: 'Custom Colors', default: '', maxColors: 6 },
    ]},
    { name: 'Dots', controls: [
      { attr: 'ko-dot-size', type: 'range', label: 'Dot Size', default: 1, min: 0.5, max: 5, step: 0.1 },
      { attr: 'ko-total-size', type: 'range', label: 'Grid Spacing', default: 5, min: 2, max: 30, step: 0.5 },
    ]},
    { name: 'Mouse Physics', controls: [
      { attr: 'ko-mouse-radius', type: 'range', label: 'Radius', default: 100, min: 20, max: 300, step: 5 },
      { attr: 'ko-mouse-force', type: 'range', label: 'Force', default: 120, min: 10, max: 400, step: 5 },
    ]},
    { name: 'Ripple Physics', controls: [
      { attr: 'ko-ripple-speed', type: 'range', label: 'Speed', default: 225, min: 50, max: 500, step: 5 },
      { attr: 'ko-ripple-width', type: 'range', label: 'Width', default: 60, min: 10, max: 150, step: 5 },
      { attr: 'ko-ripple-force', type: 'range', label: 'Force', default: 120, min: 10, max: 400, step: 5 },
      { attr: 'ko-ripple-duration', type: 'range', label: 'Duration', default: 675, min: 100, max: 1500, step: 25 },
    ]},
  ]
};
