import pixelBlast from '/demo/editor/js/effects/pixel-blast.js';
import dotsShader from '/demo/editor/js/effects/dots-shader.js';
import imageParticle from '/demo/editor/js/effects/image-particle.js';

const EFFECTS = {
  'pixel-blast': pixelBlast,
  'dots-shader': dotsShader,
  'image-particle': imageParticle
};

const state = {
  effect: 'pixel-blast',
  hover: false,
  mouse: true,
  ripple: true,
  physics: 'medium',
  fps: 60,
  canvasBg: '#0a0a0c',
  values: {}
};

let colorArrays = {};
let debounceTimer = null;

function getDefaults(effectName) {
  const def = EFFECTS[effectName];
  const vals = {};
  def.groups.forEach(function(g) {
    g.controls.forEach(function(c) {
      if (c.type === 'colors') {
        vals[c.attr] = '';
      } else if (c.labeled) {
        vals[c.attr] = c.default;
      } else {
        vals[c.attr] = c.default;
      }
    });
  });
  return vals;
}

function initState() {
  state.values = getDefaults(state.effect);
  colorArrays = {};
}

// DOM references
const previewEl = document.getElementById('effect-target');
const previewContainer = document.getElementById('preview-container');
const controlsBody = document.getElementById('controls-body');
const inspectorBody = document.getElementById('inspector-body');
const inspectorFooter = document.getElementById('inspector-footer');
const effectBadge = document.getElementById('effect-badge');
const attrCount = document.getElementById('attr-count');
const hoverHint = document.getElementById('hover-hint');
const toastEl = document.getElementById('toast');

function showToast(text) {
  toastEl.textContent = text || 'Copied!';
  toastEl.classList.add('show');
  clearTimeout(toastEl._t);
  toastEl._t = setTimeout(function() { toastEl.classList.remove('show'); }, 1400);
}

function copyText(text) {
  navigator.clipboard.writeText(text).then(function() {
    showToast('Copied: ' + (text.length > 40 ? text.slice(0, 37) + '…' : text));
  });
}

function formatNum(v) {
  var n = parseFloat(v);
  if (Number.isInteger(n) && Math.abs(n) < 1000) return n.toString();
  return n.toFixed(2).replace(/\.?0+$/, '') || '0';
}

function updateSliderFill(input) {
  var min = parseFloat(input.min), max = parseFloat(input.max);
  var pct = ((parseFloat(input.value) - min) / (max - min)) * 100;
  input.style.background = 'linear-gradient(to right, var(--accent) ' + pct + '%, var(--control-track) ' + pct + '%)';
}

var copyIconSvg = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';

function getActiveAttrs() {
  var attrs = [];
  attrs.push({ name: 'ko-effect', value: state.effect });

  if (state.hover) attrs.push({ name: 'ko-hover', value: null });
  if (!state.mouse) attrs.push({ name: 'ko-mouse', value: 'false' });
  if (!state.ripple) attrs.push({ name: 'ko-ripple', value: 'false' });
  if (state.physics !== 'medium') attrs.push({ name: 'ko-physics', value: state.physics });
  if (state.fps !== 60) attrs.push({ name: 'ko-fps', value: String(state.fps) });

  var def = EFFECTS[state.effect];
  def.groups.forEach(function(g) {
    g.controls.forEach(function(c) {
      if (c.excludeIf && c.excludeIf(state.values)) return;

      var val = state.values[c.attr];
      if (c.type === 'colors') {
        if (val && val !== '') attrs.push({ name: c.attr, value: val });
        return;
      }
      if (c.type === 'toggle') {
        if (val !== c.default) attrs.push({ name: c.attr, value: String(val) });
        return;
      }
      if (val !== undefined && val !== '' && String(val) !== String(c.default)) {
        attrs.push({ name: c.attr, value: String(val) });
      }
    });
  });

  return attrs;
}

function getFullString() {
  return getActiveAttrs().map(function(a) {
    return a.value !== null ? a.name + '="' + a.value + '"' : a.name;
  }).join('\n');
}

function applyState() {
  if (window.KineticOS) {
    window.KineticOS.destroy(previewEl);
  }

  var toRemove = [];
  for (var i = 0; i < previewEl.attributes.length; i++) {
    if (previewEl.attributes[i].name.startsWith('ko-')) {
      toRemove.push(previewEl.attributes[i].name);
    }
  }
  toRemove.forEach(function(n) { previewEl.removeAttribute(n); });

  previewEl.setAttribute('ko-effect', state.effect);
  if (state.hover) previewEl.setAttribute('ko-hover', '');
  if (!state.mouse) previewEl.setAttribute('ko-mouse', 'false');
  if (!state.ripple) previewEl.setAttribute('ko-ripple', 'false');
  if (state.physics !== 'medium') previewEl.setAttribute('ko-physics', state.physics);
  if (state.fps !== 60) previewEl.setAttribute('ko-fps', String(state.fps));

  var def = EFFECTS[state.effect];
  def.groups.forEach(function(g) {
    g.controls.forEach(function(c) {
      var val = state.values[c.attr];
      if (c.type === 'colors') {
        if (val && val !== '') previewEl.setAttribute(c.attr, val);
        return;
      }
      if (c.type === 'toggle') {
        if (val !== c.default) previewEl.setAttribute(c.attr, String(val));
        return;
      }
      if (val !== undefined && val !== '') {
        previewEl.setAttribute(c.attr, String(val));
      }
    });
  });

  previewContainer.style.background = state.canvasBg;
  hoverHint.style.display = state.hover ? 'flex' : 'none';
  effectBadge.textContent = EFFECTS[state.effect].label;

  if (window.KineticOS) {
    window.KineticOS.refresh();
  }

  updateInspector();
}

function scheduleApply() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(applyState, 120);
}

function renderControls() {
  var html = '';

  html += '<div class="section-label">Effect</div>';
  html += '<div class="ctrl-row">';
  html += '<span class="ctrl-label">Effect</span>';
  html += '<div class="ctrl-input"><select id="ctrl-effect">';
  Object.keys(EFFECTS).forEach(function(key) {
    var sel = key === state.effect ? ' selected' : '';
    html += '<option value="' + key + '"' + sel + '>' + EFFECTS[key].label + '</option>';
  });
  html += '</select></div></div>';

  html += '<div class="ctrl-row">';
  html += '<span class="ctrl-label">Canvas BG</span>';
  html += '<div class="ctrl-input"><div class="color-picker-wrap">';
  html += '<input type="color" id="ctrl-canvas-bg" value="' + state.canvasBg + '">';
  html += '<span class="color-hex" id="ctrl-canvas-bg-hex">' + state.canvasBg + '</span>';
  html += '</div></div></div>';

  html += '<div class="ctrl-sep"></div>';
  html += '<div class="section-label">Behavior</div>';

  html += '<div class="ctrl-row">';
  html += '<span class="ctrl-label">Hover Mode</span>';
  html += '<div class="ctrl-input"><div class="toggle' + (state.hover ? ' active' : '') + '" id="ctrl-hover"></div></div></div>';

  html += '<div class="ctrl-row">';
  html += '<span class="ctrl-label">Mouse</span>';
  html += '<div class="ctrl-input"><div class="toggle' + (state.mouse ? ' active' : '') + '" id="ctrl-mouse"></div></div></div>';

  html += '<div class="ctrl-row">';
  html += '<span class="ctrl-label">Ripple</span>';
  html += '<div class="ctrl-input"><div class="toggle' + (state.ripple ? ' active' : '') + '" id="ctrl-ripple"></div></div></div>';

  html += '<div class="ctrl-row">';
  html += '<span class="ctrl-label">Physics</span>';
  html += '<div class="ctrl-input"><select id="ctrl-physics">';
  ['subtle','medium','strong'].forEach(function(p) {
    var sel = p === state.physics ? ' selected' : '';
    html += '<option value="' + p + '"' + sel + '>' + p.charAt(0).toUpperCase() + p.slice(1) + '</option>';
  });
  html += '</select></div></div>';

  html += '<div class="ctrl-row">';
  html += '<span class="ctrl-label">FPS Cap</span>';
  html += '<div class="ctrl-input">';
  html += '<input type="range" id="ctrl-fps" min="10" max="120" step="5" value="' + state.fps + '">';
  html += '<span class="ctrl-value" id="ctrl-fps-val">' + state.fps + '</span>';
  html += '</div></div>';

  html += '<div class="ctrl-sep"></div>';

  var def = EFFECTS[state.effect];
  def.groups.forEach(function(group) {
    html += '<div class="section-label">' + group.name + '</div>';
    group.controls.forEach(function(ctrl) {
      html += renderControl(ctrl);
    });
  });

  controlsBody.innerHTML = html;
  bindControlEvents();
  updateAllSliderFills();
}

function renderControl(ctrl) {
  if (ctrl.type === 'colors') return renderColorsControl(ctrl);

  var val = state.values[ctrl.attr];
  var h = '<div class="ctrl-row" data-attr="' + ctrl.attr + '">';
  h += '<span class="ctrl-label">' + ctrl.label + '</span>';
  h += '<div class="ctrl-input">';

  if (ctrl.type === 'range') {
    h += '<input type="range" data-attr="' + ctrl.attr + '" min="' + ctrl.min + '" max="' + ctrl.max + '" step="' + ctrl.step + '" value="' + val + '">';
    h += '<span class="ctrl-value" data-val="' + ctrl.attr + '">' + formatNum(val) + '</span>';
  } else if (ctrl.type === 'select') {
    h += '<select data-attr="' + ctrl.attr + '">';
    var opts = ctrl.labeled ? ctrl.options : ctrl.options.map(function(o) { return { value: o, label: o.charAt(0).toUpperCase() + o.slice(1) }; });
    opts.forEach(function(o) {
      var ov = typeof o === 'object' ? o.value : o;
      var ol = typeof o === 'object' ? o.label : o;
      var sel = String(val) === String(ov) ? ' selected' : '';
      h += '<option value="' + ov + '"' + sel + '>' + ol + '</option>';
    });
    h += '</select>';
  } else if (ctrl.type === 'image-select') {
    h += '<div style="display:flex;gap:8px;width:100%;">';
    h += '<select data-attr="' + ctrl.attr + '" data-is-image-select="true" style="width:100%;">';
    var opts2 = ctrl.labeled ? ctrl.options : ctrl.options.map(function(o) { return { value: o, label: o.charAt(0).toUpperCase() + o.slice(1) }; });
    var isCustom = true;
    opts2.forEach(function(o) {
      var ov = typeof o === 'object' ? o.value : o;
      var ol = typeof o === 'object' ? o.label : o;
      var sel = String(val) === String(ov) ? ' selected' : '';
      if (sel) isCustom = false;
      h += '<option value="' + ov + '"' + sel + '>' + ol + '</option>';
    });
    h += '<option value="upload"' + (isCustom ? ' selected' : '') + '>Upload Custom...</option>';
    h += '</select>';
    h += '<input type="file" accept="image/*,.svg" style="display:none;" data-file-attr="' + ctrl.attr + '">';
    h += '</div>';
  } else if (ctrl.type === 'color') {
    h += '<div class="color-picker-wrap">';
    h += '<input type="color" data-attr="' + ctrl.attr + '" value="' + val + '">';
    h += '<span class="color-hex" data-hex="' + ctrl.attr + '">' + val + '</span>';
    h += '</div>';
  } else if (ctrl.type === 'toggle') {
    h += '<div class="toggle' + (val ? ' active' : '') + '" data-attr="' + ctrl.attr + '"></div>';
  }

  h += '</div></div>';
  return h;
}

function renderColorsControl(ctrl) {
  var key = state.effect + ':' + ctrl.attr;
  var colors = colorArrays[key] || [];
  var maxC = ctrl.maxColors || 6;

  var h = '<div class="colors-section" data-colors-attr="' + ctrl.attr + '">';
  colors.forEach(function(c, i) {
    h += '<div class="color-row">';
    h += '<input type="color" data-color-idx="' + i + '" value="' + c + '">';
    h += '<span class="color-hex">' + c + '</span>';
    h += '<button class="color-remove" data-remove-idx="' + i + '" title="Remove">×</button>';
    h += '</div>';
  });
  if (colors.length < maxC) {
    h += '<button class="color-add" data-colors-add="' + ctrl.attr + '">+ Add Color (' + colors.length + '/' + maxC + ')</button>';
  }
  if (colors.length > 0 && state.effect === 'dots-shader') {
    h += '<div class="colors-note">Custom colors override theme preset</div>';
  }
  h += '</div>';
  return h;
}

function bindControlEvents() {
  var effectSelect = document.getElementById('ctrl-effect');
  if (effectSelect) {
    effectSelect.addEventListener('change', function() {
      state.effect = this.value;
      state.values = getDefaults(state.effect);
      colorArrays = {};
      renderControls();
      applyState();
    });
  }

  var bgPicker = document.getElementById('ctrl-canvas-bg');
  if (bgPicker) {
    bgPicker.addEventListener('input', function() {
      state.canvasBg = this.value;
      document.getElementById('ctrl-canvas-bg-hex').textContent = this.value;
      previewContainer.style.background = this.value;
    });
  }

  bindToggle('ctrl-hover', function(v) { state.hover = v; applyState(); });
  bindToggle('ctrl-mouse', function(v) { state.mouse = v; applyState(); });
  bindToggle('ctrl-ripple', function(v) { state.ripple = v; applyState(); });

  var physicsSelect = document.getElementById('ctrl-physics');
  if (physicsSelect) {
    physicsSelect.addEventListener('change', function() {
      state.physics = this.value;
      applyState();
    });
  }

  var fpsSlider = document.getElementById('ctrl-fps');
  if (fpsSlider) {
    fpsSlider.addEventListener('input', function() {
      state.fps = parseInt(this.value);
      document.getElementById('ctrl-fps-val').textContent = this.value;
      updateSliderFill(this);
      scheduleApply();
    });
  }

  controlsBody.querySelectorAll('input[type="range"][data-attr]').forEach(function(input) {
    input.addEventListener('input', function() {
      var attr = this.dataset.attr;
      var val = parseFloat(this.value);
      state.values[attr] = val;
      var valSpan = controlsBody.querySelector('[data-val="' + attr + '"]');
      if (valSpan) valSpan.textContent = formatNum(val);
      updateSliderFill(this);
      updateInspector();
      scheduleApply();
    });
  });

  controlsBody.querySelectorAll('select[data-attr]').forEach(function(sel) {
    sel.addEventListener('change', function() {
      if (this.dataset.isImageSelect && this.value === 'upload') {
        var fileInput = this.nextElementSibling;
        if (fileInput) fileInput.click();
      } else {
        state.values[this.dataset.attr] = this.value;
        applyState();
      }
    });
  });

  controlsBody.querySelectorAll('input[type="file"][data-file-attr]').forEach(function(fileInput) {
    fileInput.addEventListener('change', function() {
      var file = this.files[0];
      if (!file) return;
      var attr = this.dataset.fileAttr;
      var reader = new FileReader();
      reader.onload = function(e) {
        state.values[attr] = e.target.result;
        applyState();
      };
      reader.readAsDataURL(file);
    });
  });

  controlsBody.querySelectorAll('input[type="color"][data-attr]').forEach(function(picker) {
    picker.addEventListener('input', function() {
      var attr = this.dataset.attr;
      state.values[attr] = this.value;
      var hexSpan = controlsBody.querySelector('[data-hex="' + attr + '"]');
      if (hexSpan) hexSpan.textContent = this.value;
      scheduleApply();
    });
  });

  controlsBody.querySelectorAll('.toggle[data-attr]').forEach(function(tog) {
    tog.addEventListener('click', function() {
      var attr = this.dataset.attr;
      var current = state.values[attr];
      state.values[attr] = !current;
      this.classList.toggle('active', !current);
      applyState();
    });
  });

  controlsBody.querySelectorAll('[data-colors-attr]').forEach(function(section) {
    var attr = section.dataset.colorsAttr;
    var key = state.effect + ':' + attr;

    section.querySelectorAll('input[type="color"][data-color-idx]').forEach(function(picker) {
      picker.addEventListener('input', function() {
        var idx = parseInt(this.dataset.colorIdx);
        if (!colorArrays[key]) colorArrays[key] = [];
        colorArrays[key][idx] = this.value;
        this.nextElementSibling.textContent = this.value;
        state.values[attr] = colorArrays[key].join(',');
        scheduleApply();
      });
    });

    section.querySelectorAll('[data-remove-idx]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var idx = parseInt(this.dataset.removeIdx);
        if (!colorArrays[key]) return;
        colorArrays[key].splice(idx, 1);
        state.values[attr] = colorArrays[key].join(',');
        renderControls();
        applyState();
      });
    });

    var addBtn = section.querySelector('[data-colors-add]');
    if (addBtn) {
      addBtn.addEventListener('click', function() {
        if (!colorArrays[key]) colorArrays[key] = [];
        var defaults = ['#e11d48','#fb923c','#3b82f6','#22c55e','#8b5cf6','#eab308'];
        colorArrays[key].push(defaults[colorArrays[key].length] || '#ffffff');
        state.values[attr] = colorArrays[key].join(',');
        renderControls();
        applyState();
      });
    }
  });

  document.getElementById('reset-btn').addEventListener('click', function() {
    state.hover = false;
    state.mouse = true;
    state.ripple = true;
    state.physics = 'medium';
    state.fps = 60;
    state.canvasBg = '#0a0a0c';
    state.values = getDefaults(state.effect);
    colorArrays = {};
    renderControls();
    applyState();
  });

  document.getElementById('copy-all-btn').addEventListener('click', function() {
    copyText(getFullString().replace(/\n/g, ' '));
  });
}

function bindToggle(id, callback) {
  var el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('click', function() {
    var isActive = this.classList.toggle('active');
    callback(isActive);
  });
}

function updateAllSliderFills() {
  controlsBody.querySelectorAll('input[type="range"]').forEach(updateSliderFill);
}

function updateInspector() {
  var attrs = getActiveAttrs();
  var html = '';

  attrs.forEach(function(a) {
    html += '<div class="attr-card">';
    html += '<div class="attr-name-row">';
    html += '<span class="attr-name" data-copy="' + a.name + '" title="Click to copy name">' + a.name + '</span>';
    html += '<button class="attr-copy-btn" data-copy-pair="' + a.name + '" title="Copy attribute pair">' + copyIconSvg + '</button>';
    html += '</div>';
    html += '<div class="attr-value-row">';
    if (a.value !== null) {
      html += '<span class="attr-value" data-copy="' + a.value + '" title="Click to copy value">"' + a.value + '"</span>';
    } else {
      html += '<span class="attr-value boolean">(boolean attribute)</span>';
    }
    html += '</div>';
    html += '</div>';
  });

  inspectorBody.innerHTML = html;
  attrCount.textContent = attrs.length + ' active';

  var fullStr = getFullString();
  var footerHtml = '<div class="attr-full-section">';
  footerHtml += '<div class="attr-full-label">Full attribute string</div>';
  footerHtml += '<div class="attr-full-code">' + escapeHtml(fullStr.replace(/\n/g, ' ')) + '</div>';
  footerHtml += '<button class="btn btn-secondary" id="copy-full-btn" style="width:100%;justify-content:center;">';
  footerHtml += copyIconSvg + ' Copy Full String</button>';
  footerHtml += '</div>';
  inspectorFooter.innerHTML = footerHtml;

  bindInspectorEvents();
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function bindInspectorEvents() {
  inspectorBody.querySelectorAll('[data-copy]').forEach(function(el) {
    el.addEventListener('click', function() {
      copyText(this.dataset.copy);
    });
  });

  inspectorBody.querySelectorAll('[data-copy-pair]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var name = this.dataset.copyPair;
      var attrs = getActiveAttrs();
      var match = attrs.find(function(a) { return a.name === name; });
      if (match) {
        var str = match.value !== null ? match.name + '="' + match.value + '"' : match.name;
        copyText(str);
      }
    });
  });

  var copyFullBtn = document.getElementById('copy-full-btn');
  if (copyFullBtn) {
    copyFullBtn.addEventListener('click', function() {
      copyText(getFullString().replace(/\n/g, ' '));
    });
  }
}

function waitForKOS(cb) {
  if (window.KineticOS) { cb(); return; }
  var poll = setInterval(function() {
    if (window.KineticOS) { clearInterval(poll); cb(); }
  }, 50);
  setTimeout(function() { clearInterval(poll); cb(); }, 3000);
}

function init() {
  initState();
  renderControls();
  waitForKOS(function() {
    applyState();
  });
  updateInspector();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
