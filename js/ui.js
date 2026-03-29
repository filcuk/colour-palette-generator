import {
  toFullHex,
  toPreviewableHex,
  hexToRgb,
  rgbToHex,
  rgbToCmyk,
  cmykToRgb,
  contrastRatio,
  autoTextOn,
  hsvToHex,
  hexToHsv
} from './colour-math.js';
import { state, saveState, mergeStoredIntoState } from './state.js';

/**
 * Swatches, contrast summary, count slider, optional rows, and colour picker.
 */
export function initUi(refs, themesApi, ioApi) {
  const {
    rowEl,
    rowSentimentEl,
    rowDivergentEl,
    rowSentimentWrapEl,
    rowDivergentWrapEl,
    sentimentEnabledCb,
    divergentEnabledCb,
    countSlider,
    countValue,
    summaryEl,
    themeNameEl,
    svgHideColourLabelsCb,
    contrastTooltipEl,
    normalizeBtn,
    svEl,
    svHandle,
    hueEl,
    hueHandle,
    pickerHexEl,
    pickerR,
    pickerG,
    pickerB,
    pickerC,
    pickerM,
    pickerY,
    pickerK
  } = refs;

let wraps = [], inputs = [], badgesWraps = [];
let sentimentWraps = [], sentimentInputs = [], sentimentBadgesWraps = [];
let divergentWraps = [], divergentInputs = [], divergentBadgesWraps = [];
let ph = 0, ps = 1, pv = 1; // picker HSV
// ========= Rendering =========
function swatchHTML(section, i, value, ariaLabel) {
  const vAttr = value ? ` value="${value}"` : '';
  const isActive = state.activeSection === section && state.activeIndex === i;
  const activeCls = isActive ? ' active' : '';
  const label = ariaLabel || `${section} color ${i + 1}`;
  return `
    <div class="swatch-wrap${activeCls}" data-section="${section}" data-index="${i}">
      <input class="swatch-input" aria-label="${label}" placeholder="#RRGGBB"${vAttr} data-section="${section}" data-index="${i}" />
      <div class="swatch-contrast" aria-hidden="true" title=""></div>
    </div>
  `;
}

function showContrastTooltip(contrastEl) {
  const text = contrastEl.dataset.tooltip;
  if (!contrastTooltipEl || !text) return;
  contrastTooltipEl.textContent = text;
  contrastTooltipEl.classList.add('visible');
  contrastTooltipEl.setAttribute('aria-hidden', 'false');
  const offset = 8;
  const rect = contrastEl.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.bottom + offset;
  contrastTooltipEl.style.left = x + 'px';
  contrastTooltipEl.style.top = y + 'px';
  contrastTooltipEl.style.transform = 'translateX(-50%)';
}
function hideContrastTooltip() {
  if (contrastTooltipEl) {
    contrastTooltipEl.classList.remove('visible');
    contrastTooltipEl.setAttribute('aria-hidden', 'true');
  }
}

function bindSwatchInputs(wrapsArr, inputsArr, badgesArr, section, stateColors) {
  inputsArr.forEach((inp, idx) => {
    const contrastEl = badgesArr[idx];
    applyPreview(inp, contrastEl);
    inp.addEventListener('input', () => { themesApi.markThemeDirty(); applyPreview(inp, contrastEl); saveState(); });
    inp.addEventListener('blur', () => { normalizeInput(inp, contrastEl); saveState(); });
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } });
    inp.addEventListener('focus', () => setActive(section, idx));
    inp.addEventListener('click', () => setActive(section, idx));
    if (contrastEl) {
      contrastEl.addEventListener('mouseenter', () => showContrastTooltip(contrastEl));
      contrastEl.addEventListener('mouseleave', () => hideContrastTooltip());
    }
  });
}

function renderSwatches(n) {
  if (!rowEl) return;
  let html = '';
  for (let i = 0; i < n; i++) {
    const val = toFullHex(state.colors[i]) || '';
    html += swatchHTML('theme', i, val, `Theme color ${i + 1}`);
  }
  rowEl.innerHTML = html;
  wraps = Array.from(rowEl.querySelectorAll('.swatch-wrap'));
  inputs = wraps.map(w => w.querySelector('.swatch-input'));
  badgesWraps = wraps.map(w => w.querySelector('.swatch-contrast'));
  bindSwatchInputs(wraps, inputs, badgesWraps, 'theme', state.colors);
  updateActiveClass();
  updateSummary();
}

function renderSentimentSwatches() {
  if (!rowSentimentEl) return;
  let html = '';
  const labels = ['Good', 'Neutral', 'Bad'];
  for (let i = 0; i < 3; i++) {
    const val = toFullHex(state.sentimentColors[i]) || '';
    html += swatchHTML('sentiment', i, val, labels[i]);
  }
  rowSentimentEl.innerHTML = html;
  sentimentWraps = Array.from(rowSentimentEl.querySelectorAll('.swatch-wrap'));
  sentimentInputs = sentimentWraps.map(w => w.querySelector('.swatch-input'));
  sentimentBadgesWraps = sentimentWraps.map(w => w.querySelector('.swatch-contrast'));
  bindSwatchInputs(sentimentWraps, sentimentInputs, sentimentBadgesWraps, 'sentiment', state.sentimentColors);
  updateActiveClass();
  updateSummary();
}

function renderDivergentSwatches() {
  if (!rowDivergentEl) return;
  let html = '';
  const labels = ['Maximum', 'Center', 'Minimum', 'null'];
  for (let i = 0; i < 4; i++) {
    const val = toFullHex(state.divergentColors[i]) || '';
    html += swatchHTML('divergent', i, val, labels[i]);
  }
  rowDivergentEl.innerHTML = html;
  divergentWraps = Array.from(rowDivergentEl.querySelectorAll('.swatch-wrap'));
  divergentInputs = divergentWraps.map(w => w.querySelector('.swatch-input'));
  divergentBadgesWraps = divergentWraps.map(w => w.querySelector('.swatch-contrast'));
  bindSwatchInputs(divergentWraps, divergentInputs, divergentBadgesWraps, 'divergent', state.divergentColors);
  updateActiveClass();
  updateSummary();
}

function getActiveInput() {
  if (state.activeSection === 'theme') return inputs[state.activeIndex];
  if (state.activeSection === 'sentiment') return sentimentInputs ? sentimentInputs[state.activeIndex] : null;
  if (state.activeSection === 'divergent') return divergentInputs ? divergentInputs[state.activeIndex] : null;
  return null;
}
function getActiveBadgesWrap() {
  if (state.activeSection === 'theme') return badgesWraps[state.activeIndex];
  if (state.activeSection === 'sentiment') return sentimentBadgesWraps ? sentimentBadgesWraps[state.activeIndex] : null;
  if (state.activeSection === 'divergent') return divergentBadgesWraps ? divergentBadgesWraps[state.activeIndex] : null;
  return null;
}
function getActiveStateArray() {
  if (state.activeSection === 'theme') return state.colors;
  if (state.activeSection === 'sentiment') return state.sentimentColors;
  if (state.activeSection === 'divergent') return state.divergentColors;
  return state.colors;
}

function updateActiveClass() {
  const allWraps = [...(wraps || []), ...(sentimentWraps || []), ...(divergentWraps || [])];
  allWraps.forEach(w => {
    if (!w) return;
    const section = w.dataset.section;
    const index = parseInt(w.dataset.index, 10);
    w.classList.toggle('active', state.activeSection === section && state.activeIndex === index);
  });
}

function setActive(section, index) {
  const maxIdx =
    section === 'theme'
      ? state.count - 1
      : section === 'divergent'
        ? 3
        : 2;
  const i = Math.max(0, Math.min(maxIdx, index));
  state.activeSection = section;
  state.activeIndex = i;
  updateActiveClass();
  const inp = getActiveInput();
  const arr = getActiveStateArray();
  const hex = inp ? toFullHex(inp.value || arr[i]) : null;
  if (hex) pickerSetHex(hex);
}

// ========= Contrast strip (B/W check/cross + tooltip) + preview =========
function updateContrast(hex, contrastEl) {
  if (!contrastEl) return;
  if (!hex) {
    contrastEl.innerHTML = '<span>B —</span><span>W —</span>';
    contrastEl.removeAttribute('data-tooltip');
    return;
  }
  const rB = contrastRatio('#000000', hex);
  const rW = contrastRatio('#FFFFFF', hex);
  const passB = rB >= 4.5, passW = rW >= 4.5;
  const symB = passB ? '\u2713' : '\u2717';
  const symW = passW ? '\u2713' : '\u2717';
  contrastEl.innerHTML = `<span class="${passB ? 'pass' : 'fail'}">B ${symB}</span><span class="${passW ? 'pass' : 'fail'}">W ${symW}</span>`;
  const tooltip = `Black ${rB.toFixed(2)}:1 (${passB ? 'PASS' : 'FAIL'})\nWhite ${rW.toFixed(2)}:1 (${passW ? 'PASS' : 'FAIL'})`;
  contrastEl.dataset.tooltip = tooltip;
}

function applyPreview(input, contrastEl) {
  const section = input.dataset.section || 'theme';
  const idx = parseInt(input.dataset.index, 10) || 0;
  const arr = section === 'theme' ? state.colors : section === 'sentiment' ? state.sentimentColors : state.divergentColors;
  const hex = toPreviewableHex(input.value || '');

  if (hex) {
    input.classList.remove('invalid');
    input.style.background = hex;
    input.style.color = autoTextOn(hex);
    updateContrast(hex, contrastEl);
    arr[idx] = toFullHex(hex);
    if (state.activeSection === section && state.activeIndex === idx) {
      const pickerHex = toFullHex(hsvToHex(ph === 360 ? 0 : ph, ps, pv));
      if (pickerHex !== toFullHex(hex)) pickerSetHex(hex);
    } else {
      setActive(section, idx);
    }
  } else {
    input.classList.add('invalid');
    input.style.background = '#fff';
    input.style.color = '#111';
    updateContrast(null, contrastEl);
  }
  updateSummary();
}

function normalizeInput(input, contrastEl) {
  const full = toFullHex(input.value || '');
  if (full) {
    input.value = full;
    applyPreview(input, contrastEl);
  } else {
    input.classList.add('invalid');
  }
}

function updateSummary() {
  if (!summaryEl) return;
  let passB = 0, failB = 0, passW = 0, failW = 0;
  const allInputs = [
    ...(inputs || []),
    ...(state.sentimentEnabled && sentimentInputs ? sentimentInputs : []),
    ...(state.divergentEnabled && divergentInputs ? divergentInputs : [])
  ];
  allInputs.forEach(inp => {
    if (!inp) return;
    const hex = toFullHex(inp.value || '');
    if (!hex) return;
    const rB = contrastRatio('#000000', hex);
    const rW = contrastRatio('#FFFFFF', hex);
    if (rB >= 4.5) passB++; else failB++;
    if (rW >= 4.5) passW++; else failW++;
  });
  const totalB = passB + failB;
  const totalW = passW + failW;
  if (totalB === 0 && totalW === 0) summaryEl.textContent = 'Contrast summary: —';
  else {
    const pctB = totalB ? Math.round((passB / totalB) * 100) : 0;
    const pctW = totalW ? Math.round((passW / totalW) * 100) : 0;
    summaryEl.textContent = `Testing contrast ≥ 4.5:1 — Black ${pctB}% · White ${pctW}%.`;
  }
}

function updateOptionalSectionsVisibility() {
  if (sentimentEnabledCb) sentimentEnabledCb.checked = !!state.sentimentEnabled;
  if (divergentEnabledCb) divergentEnabledCb.checked = !!state.divergentEnabled;
  if (rowSentimentWrapEl) rowSentimentWrapEl.classList.toggle('optional-hidden', !state.sentimentEnabled);
  if (rowDivergentWrapEl) rowDivergentWrapEl.classList.toggle('optional-hidden', !state.divergentEnabled);
  if (state.activeSection === 'sentiment' && !state.sentimentEnabled) setActive('theme', 0);
  if (state.activeSection === 'divergent' && !state.divergentEnabled) setActive('theme', 0);
}

// ========= Slider (1–16), Theme name =========
function setCount(n) {
  state.count = n;
  if (countSlider) countSlider.value = String(n);
  if (countValue) countValue.textContent = String(n);
  renderSwatches(n);
  if (state.activeSection === 'theme') setActive('theme', Math.min(state.activeIndex, n - 1));
  saveState();
  ioApi.updateJsonPreview();
  ioApi.updateSvgPreview();
}
if (countSlider) {
  countSlider.addEventListener('input', (e) => {
    const n = Math.max(1, Math.min(16, parseInt(e.target.value || '8', 10)));
    themesApi.markThemeDirty();
    setCount(n);
  });
}

if (sentimentEnabledCb) {
  sentimentEnabledCb.addEventListener('change', () => {
    state.sentimentEnabled = sentimentEnabledCb.checked;
    updateOptionalSectionsVisibility();
    updateSummary();
    saveState();
    ioApi.updateJsonPreview();
    ioApi.updateSvgPreview();
  });
}
if (divergentEnabledCb) {
  divergentEnabledCb.addEventListener('change', () => {
    state.divergentEnabled = divergentEnabledCb.checked;
    updateOptionalSectionsVisibility();
    updateSummary();
    saveState();
    ioApi.updateJsonPreview();
    ioApi.updateSvgPreview();
  });
}
if (svgHideColourLabelsCb) {
  svgHideColourLabelsCb.addEventListener('change', () => {
    state.svgHideColourLabels = svgHideColourLabelsCb.checked;
    ioApi.updateSvgPreview();
    saveState();
  });
}

// ========= Normalize current =========
if (typeof normalizeBtn !== 'undefined' && normalizeBtn) {
  normalizeBtn.addEventListener('click', () => {
    inputs.forEach((inp, i) => { normalizeInput(inp, badgesWraps[i]); });
    saveState();
  });
}

// ========= Simple Color Picker Logic =========
function blendHex(hex1, hex2, t) {
  const a = hexToRgb(hex1);
  const b = hexToRgb(hex2);
  const r = Math.round(a.r * (1 - t) + b.r * t);
  const g = Math.round(a.g * (1 - t) + b.g * t);
  const bl = Math.round(a.b * (1 - t) + b.b * t);
  return rgbToHex(Math.max(0, Math.min(255, r)), Math.max(0, Math.min(255, g)), Math.max(0, Math.min(255, bl)));
}

function getShadeHexes(hex) {
  const full = toFullHex(hex);
  if (!full) return [];
  const lighter2 = blendHex(full, '#FFFFFF', 0.4);
  const lighter1 = blendHex(full, '#FFFFFF', 0.2);
  const darker1 = blendHex(full, '#000000', 0.2);
  const darker2 = blendHex(full, '#000000', 0.4);
  return [lighter2, lighter1, full, darker1, darker2];
}

function updatePickerShades(hex) {
  const shades = getShadeHexes(hex);
  const container = document.getElementById('pickerShades');
  if (!container) return;
  const boxes = container.querySelectorAll('.picker-shade');
  shades.forEach((h, i) => {
    if (boxes[i]) {
      boxes[i].style.background = h;
      boxes[i].dataset.hex = h;
    }
  });
}

function pickerPreview(hex) {
  const full = toFullHex(hex);
  if (!full) return;
  if (pickerHexEl) {
    pickerHexEl.value = full;
    pickerHexEl.setAttribute('dir', 'ltr');
    pickerHexEl.style.textAlign = 'left';
  }
  const rgb = hexToRgb(full);
  if (pickerR) pickerR.value = String(rgb.r);
  if (pickerG) pickerG.value = String(rgb.g);
  if (pickerB) pickerB.value = String(rgb.b);
  const cmyk = rgbToCmyk(rgb.r, rgb.g, rgb.b);
  if (pickerC) pickerC.value = String(cmyk.c);
  if (pickerM) pickerM.value = String(cmyk.m);
  if (pickerY) pickerY.value = String(cmyk.y);
  if (pickerK) pickerK.value = String(cmyk.k);
  updatePickerShades(full);
}
function pickerSetHue(h) {
  if (h >= 359.5) {
    ph = 360;
  } else {
    ph = (h + 360) % 360;
  }
  const hueForColor = ph === 360 ? 0 : ph;
  const base = hsvToHex(hueForColor, 1, 1);
  if (svEl) svEl.style.background = base;
  if (hueEl && hueHandle) {
    const rect = hueEl.getBoundingClientRect();
    const x = (ph / 360) * rect.width;
    hueHandle.style.left = (x - 6) + 'px';
  }
  const hex = hsvToHex(hueForColor, ps, pv);
  pickerPreview(hex);
  applyColorToActive(hex);
  positionSvHandle();
}

function pickerSetSV(s, v) {
  ps = Math.max(0, Math.min(1, s));
  pv = Math.max(0, Math.min(1, v));
  const hex = hsvToHex(ph, ps, pv);
  pickerPreview(hex);
  applyColorToActive(hex);
  positionSvHandle();
}
function positionSvHandle() {
  if (!svEl || !svHandle) return;
  const rect = svEl.getBoundingClientRect();
  svHandle.style.left = (ps * rect.width) + 'px';
  svHandle.style.top = ((1 - pv) * rect.height) + 'px';
}
function applyColorToActive(hex) {
  const inp = getActiveInput();
  if (!inp) return;
  inp.value = toFullHex(hex);
  const arr = getActiveStateArray();
  const idx = state.activeIndex;
  if (arr && arr[idx] !== undefined) arr[idx] = toFullHex(hex);
  applyPreview(inp, getActiveBadgesWrap());
  themesApi.markThemeDirty(); saveState();
}
function pickerSetHex(hex) {
  const full = toFullHex(hex);
  if (!full) return;
  pickerPreview(full);
  const { h, s, v } = hexToHsv(full);
  ph = h; ps = s; pv = v;
  const base = hsvToHex(ph, 1, 1);
  if (svEl) svEl.style.background = base;
  if (hueEl && hueHandle) {
    const hueRect = hueEl.getBoundingClientRect();
    hueHandle.style.left = ((h / 360) * hueRect.width - 6) + 'px';
  }
  positionSvHandle();
}
function svEventToSV(e) {
  if (!svEl) return { s: 0, v: 0 };
  const rect = svEl.getBoundingClientRect();
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
  const y = clamp((e.clientY - rect.top) / rect.height, 0, 1);
  return { s: x, v: 1 - y };
}
function startSvDrag(e) {
  e.preventDefault();
  const move = (ev) => { const { s, v } = svEventToSV(ev); pickerSetSV(s, v); };
  const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  const { s, v } = svEventToSV(e); pickerSetSV(s, v);
}
if (svEl) svEl.addEventListener('mousedown', startSvDrag);
function hueEventToH(e) {
  if (!hueEl) return 0;
  const rect = hueEl.getBoundingClientRect();
  const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
  const h = (x / rect.width) * 360;
  return Math.min(360, h);
}
function startHueDrag(e) {
  e.preventDefault();
  const move = (ev) => { pickerSetHue(hueEventToH(ev)); };
  const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  pickerSetHue(hueEventToH(e));
}
if (hueEl) hueEl.addEventListener('mousedown', startHueDrag);

if (pickerHexEl) {
  pickerHexEl.setAttribute('dir', 'ltr');
  pickerHexEl.style.textAlign = 'left';
  pickerHexEl.addEventListener('input', () => {
    const prev = pickerHexEl.value || '';
    const selStart = pickerHexEl.selectionStart;
    let raw = prev.replace(/[^#0-9A-Fa-f]/g, '');
    if (raw.indexOf('#') > 0) raw = raw.replace(/#/g, '');
    if (raw.startsWith('#')) {
      if (raw.length > 7) raw = raw.slice(0, 7);
    } else {
      if (raw.length > 6) raw = raw.slice(0, 6);
    }
    raw = raw.toUpperCase();
    if (raw !== prev) {
      const validBefore = (prev.slice(0, selStart).match(/[#0-9A-Fa-f]/gi) || []).length;
      const newPos = Math.min(validBefore, raw.length);
      pickerHexEl.value = raw;
      pickerHexEl.setSelectionRange(newPos, newPos);
    }
    const full = toPreviewableHex(raw || '');
    if (full) { pickerSetHex(full); applyColorToActive(full); }
  });
}

function tryApplyRgb() {
  if (!pickerR || !pickerG || !pickerB) return;
  const r = parseInt(pickerR.value, 10), g = parseInt(pickerG.value, 10), b = parseInt(pickerB.value, 10);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return;
  if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255) return;
  const hex = rgbToHex(r, g, b);
  pickerSetHex(hex);
  applyColorToActive(hex);
}
function tryApplyCmyk() {
  if (!pickerC || !pickerM || !pickerY || !pickerK) return;
  const c = parseInt(pickerC.value.trim(), 10), m = parseInt(pickerM.value.trim(), 10), y = parseInt(pickerY.value.trim(), 10), k = parseInt(pickerK.value.trim(), 10);
  if (Number.isNaN(c) || Number.isNaN(m) || Number.isNaN(y) || Number.isNaN(k)) return;
  if (c < 0 || c > 100 || m < 0 || m > 100 || y < 0 || y > 100 || k < 0 || k > 100) return;
  const { r, g, b } = cmykToRgb(c, m, y, k);
  const hex = rgbToHex(r, g, b);
  pickerSetHex(hex);
  applyColorToActive(hex);
}
[pickerR, pickerG, pickerB].forEach(el => { if (el) el.addEventListener('input', tryApplyRgb); });
[pickerC, pickerM, pickerY, pickerK].forEach(el => {
  if (!el) return;
  el.addEventListener('blur', tryApplyCmyk);
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); el.blur(); } });
});

// Colour sets: add { id, name, colors } where each color is a hex string or { hex, name } for tooltip
const PICKER_SETS = [
  { id: 'basic', name: 'Basic', colors: ['#FF0000', '#FFA500', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#FF00FF', '#000000', '#FFFFFF', '#808080', '#8B4513', '#800080'] },
  { id: 'fluent2', name: 'Fluent', colors: ['#FFB900', '#E74856', '#0078D7', '#0099BC', '#7A7574', '#767676', '#FF8C00', '#E81123', '#0063B1', '#2D7D9A', '#5D5A58', '#4C4A48', '#F7630C', '#EA005E', '#8E8CD8', '#00B7C3', '#68768A', '#69797E', '#CA5010', '#C30052', '#6B69D6', '#038387', '#515C6B', '#4A5459', '#DA3B01', '#E3008C', '#8764B8', '#00B294', '#567C73', '#647C64', '#EF6950', '#BF0077', '#744DA9', '#018574', '#486860', '#525E54', '#D13438', '#C239B3', '#B146C2', '#00CC6A', '#498205', '#847545', '#FF4343', '#9A0089', '#881798', '#10893E', '#107C10', '#7E735F'] },
  { id: 'metro', name: 'Metro', colors: [
    { hex: '#99b433', name: 'Light Green' }, { hex: '#00a300', name: 'Green' }, { hex: '#1e7145', name: 'Dark Green' },
    { hex: '#ff0097', name: 'Magenta' }, { hex: '#9f00a7', name: 'Light Purple' }, { hex: '#7e3878', name: 'Purple' }, { hex: '#603cba', name: 'Dark Purple' },
    { hex: '#1d1d1d', name: 'Darken' }, { hex: '#00aba9', name: 'Teal' },
    { hex: '#eff4ff', name: 'Light Blue' }, { hex: '#2d89ef', name: 'Blue' }, { hex: '#2b5797', name: 'Dark Blue' },
    { hex: '#ffc40d', name: 'Yellow' }, { hex: '#e3a21a', name: 'Orange' }, { hex: '#da532c', name: 'Dark Orange' },
    { hex: '#ee1111', name: 'Red' }, { hex: '#b91d47', name: 'Dark Red' }, { hex: '#ffffff', name: 'White' }
  ] },
  { id: 'flatui', name: 'Flat UI', colors: [
    { hex: '#C0392B', name: 'Pomegranate' }, { hex: '#E74C3C', name: 'Alizarin' }, { hex: '#9B59B6', name: 'Amethyst' }, { hex: '#8E44AD', name: 'Wisteria' },
    { hex: '#2980B9', name: 'Belize Hole' }, { hex: '#3498DB', name: 'Peter River' }, { hex: '#1ABC9C', name: 'Turquoise' }, { hex: '#16A085', name: 'Green Sea' },
    { hex: '#27AE60', name: 'Nephritis' }, { hex: '#2ECC71', name: 'Emerald' }, { hex: '#F1C40F', name: 'Sunflower' }, { hex: '#F39C12', name: 'Orange' },
    { hex: '#E67E22', name: 'Carrot' }, { hex: '#D35400', name: 'Pumpkin' }, { hex: '#ECF0F1', name: 'Clouds' }, { hex: '#BDC3C7', name: 'Silver' },
    { hex: '#7F8C8D', name: 'Concrete' }, { hex: '#7F8C8D', name: 'Asbestos' }, { hex: '#34495E', name: 'Wet Asphalt' }, { hex: '#2C3E50', name: 'Midnight Blue' }
  ] },
  { id: 'material', name: 'Material', colors: [
    { hex: '#F44336', name: 'Red' }, { hex: '#E91E63', name: 'Pink' }, { hex: '#9C27B0', name: 'Purple' }, { hex: '#673AB7', name: 'Deep Purple' },
    { hex: '#3F51B5', name: 'Indigo' }, { hex: '#2196F3', name: 'Blue' }, { hex: '#03A9F4', name: 'Light Blue' }, { hex: '#00BCD4', name: 'Cyan' },
    { hex: '#009688', name: 'Teal' }, { hex: '#4CAF50', name: 'Green' }, { hex: '#8BC34A', name: 'Light Green' }, { hex: '#CDDC39', name: 'Lime' },
    { hex: '#FFEB3B', name: 'Yellow' }, { hex: '#FFC107', name: 'Amber' }, { hex: '#FF9800', name: 'Orange' }, { hex: '#FF5722', name: 'Deep Orange' },
    { hex: '#795548', name: 'Brown' }, { hex: '#9E9E9E', name: 'Grey' }, { hex: '#607D8B', name: 'Blue Grey' }, { hex: '#FFFFFF', name: 'White' }, { hex: '#000000', name: 'Black' }
  ] },
  { id: 'tailwind', name: 'Tailwind', colors: [
    { hex: '#FB2C36', name: 'Red' }, { hex: '#FF692A', name: 'Orange' }, { hex: '#FE9A37', name: 'Amber' }, { hex: '#F0B13B', name: 'Yellow' }, { hex: '#7CCF35', name: 'Lime' },
    { hex: '#31C950', name: 'Green' }, { hex: '#37BC7D', name: 'Emerald' }, { hex: '#36BBA7', name: 'Teal' }, { hex: '#3BB8DB', name: 'Cyan' }, { hex: '#34A6F4', name: 'Sky' },
    { hex: '#2B7FFF', name: 'Blue' }, { hex: '#615FFF', name: 'Indigo' }, { hex: '#8E51FF', name: 'Violet' }, { hex: '#AD46FF', name: 'Purple' }, { hex: '#E12AFB', name: 'Fuchsia' },
    { hex: '#F6339A', name: 'Pink' }, { hex: '#FF2056', name: 'Rose' }, { hex: '#62748E', name: 'Slate' }, { hex: '#6A7282', name: 'Gray' }, { hex: '#71717B', name: 'Zinc' },
    { hex: '#737373', name: 'Neutral' }, { hex: '#79716B', name: 'Stone' }
  ] },
  { id: 'htmlnamed', name: 'Web Safe', colors: [
    { hex: '#CD5C5C', name: 'IndianRed' }, { hex: '#F08080', name: 'LightCoral' }, { hex: '#FA8072', name: 'Salmon' }, { hex: '#E9967A', name: 'DarkSalmon' }, { hex: '#FFA07A', name: 'LightSalmon' }, { hex: '#DC143C', name: 'Crimson' }, { hex: '#FF0000', name: 'Red' }, { hex: '#B22222', name: 'FireBrick' }, { hex: '#8B0000', name: 'DarkRed' },
    { hex: '#FFC0CB', name: 'Pink' }, { hex: '#FFB6C1', name: 'LightPink' }, { hex: '#FF69B4', name: 'HotPink' }, { hex: '#FF1493', name: 'DeepPink' }, { hex: '#C71585', name: 'MediumVioletRed' }, { hex: '#DB7093', name: 'PaleVioletRed' },
    { hex: '#FF7F50', name: 'Coral' }, { hex: '#FF6347', name: 'Tomato' }, { hex: '#FF4500', name: 'OrangeRed' }, { hex: '#FF8C00', name: 'DarkOrange' }, { hex: '#FFA500', name: 'Orange' },
    { hex: '#FFD700', name: 'Gold' }, { hex: '#FFFF00', name: 'Yellow' }, { hex: '#FFFFE0', name: 'LightYellow' }, { hex: '#FFFACD', name: 'LemonChiffon' }, { hex: '#FAFAD2', name: 'LightGoldenrodYellow' }, { hex: '#FFEFD5', name: 'PapayaWhip' }, { hex: '#FFE4B5', name: 'Moccasin' }, { hex: '#FFDAB9', name: 'PeachPuff' }, { hex: '#EEE8AA', name: 'PaleGoldenrod' }, { hex: '#F0E68C', name: 'Khaki' }, { hex: '#BDB76B', name: 'DarkKhaki' },
    { hex: '#E6E6FA', name: 'Lavender' }, { hex: '#D8BFD8', name: 'Thistle' }, { hex: '#DDA0DD', name: 'Plum' }, { hex: '#EE82EE', name: 'Violet' }, { hex: '#DA70D6', name: 'Orchid' }, { hex: '#FF00FF', name: 'Fuchsia' }, { hex: '#BA55D3', name: 'MediumOrchid' }, { hex: '#9370DB', name: 'MediumPurple' }, { hex: '#663399', name: 'RebeccaPurple' }, { hex: '#8A2BE2', name: 'BlueViolet' }, { hex: '#9400D3', name: 'DarkViolet' }, { hex: '#9932CC', name: 'DarkOrchid' }, { hex: '#8B008B', name: 'DarkMagenta' }, { hex: '#800080', name: 'Purple' }, { hex: '#4B0082', name: 'Indigo' }, { hex: '#6A5ACD', name: 'SlateBlue' }, { hex: '#483D8B', name: 'DarkSlateBlue' }, { hex: '#7B68EE', name: 'MediumSlateBlue' },
    { hex: '#ADFF2F', name: 'GreenYellow' }, { hex: '#7FFF00', name: 'Chartreuse' }, { hex: '#7CFC00', name: 'LawnGreen' }, { hex: '#00FF00', name: 'Lime' }, { hex: '#32CD32', name: 'LimeGreen' }, { hex: '#98FB98', name: 'PaleGreen' }, { hex: '#90EE90', name: 'LightGreen' }, { hex: '#00FA9A', name: 'MediumSpringGreen' }, { hex: '#00FF7F', name: 'SpringGreen' }, { hex: '#3CB371', name: 'MediumSeaGreen' }, { hex: '#2E8B57', name: 'SeaGreen' }, { hex: '#228B22', name: 'ForestGreen' }, { hex: '#008000', name: 'Green' }, { hex: '#006400', name: 'DarkGreen' }, { hex: '#9ACD32', name: 'YellowGreen' }, { hex: '#6B8E23', name: 'OliveDrab' }, { hex: '#808000', name: 'Olive' }, { hex: '#556B2F', name: 'DarkOliveGreen' }, { hex: '#66CDAA', name: 'MediumAquamarine' }, { hex: '#8FBC8B', name: 'DarkSeaGreen' }, { hex: '#20B2AA', name: 'LightSeaGreen' }, { hex: '#008B8B', name: 'DarkCyan' }, { hex: '#008080', name: 'Teal' },
    { hex: '#00FFFF', name: 'Aqua' }, { hex: '#E0FFFF', name: 'LightCyan' }, { hex: '#AFEEEE', name: 'PaleTurquoise' }, { hex: '#7FFFD4', name: 'Aquamarine' }, { hex: '#40E0D0', name: 'Turquoise' }, { hex: '#48D1CC', name: 'MediumTurquoise' }, { hex: '#00CED1', name: 'DarkTurquoise' }, { hex: '#5F9EA0', name: 'CadetBlue' }, { hex: '#4682B4', name: 'SteelBlue' }, { hex: '#B0C4DE', name: 'LightSteelBlue' }, { hex: '#B0E0E6', name: 'PowderBlue' }, { hex: '#ADD8E6', name: 'LightBlue' }, { hex: '#87CEEB', name: 'SkyBlue' }, { hex: '#87CEFA', name: 'LightSkyBlue' }, { hex: '#00BFFF', name: 'DeepSkyBlue' }, { hex: '#1E90FF', name: 'DodgerBlue' }, { hex: '#6495ED', name: 'CornflowerBlue' }, { hex: '#4169E1', name: 'RoyalBlue' }, { hex: '#0000FF', name: 'Blue' }, { hex: '#0000CD', name: 'MediumBlue' }, { hex: '#00008B', name: 'DarkBlue' }, { hex: '#000080', name: 'Navy' }, { hex: '#191970', name: 'MidnightBlue' },
    { hex: '#FFF8DC', name: 'Cornsilk' }, { hex: '#FFEBCD', name: 'BlanchedAlmond' }, { hex: '#FFE4C4', name: 'Bisque' }, { hex: '#FFDEAD', name: 'NavajoWhite' }, { hex: '#F5DEB3', name: 'Wheat' }, { hex: '#DEB887', name: 'BurlyWood' }, { hex: '#D2B48C', name: 'Tan' }, { hex: '#BC8F8F', name: 'RosyBrown' }, { hex: '#F4A460', name: 'SandyBrown' }, { hex: '#DAA520', name: 'Goldenrod' }, { hex: '#B8860B', name: 'DarkGoldenrod' }, { hex: '#CD853F', name: 'Peru' }, { hex: '#D2691E', name: 'Chocolate' }, { hex: '#8B4513', name: 'SaddleBrown' }, { hex: '#A0522D', name: 'Sienna' }, { hex: '#A52A2A', name: 'Brown' }, { hex: '#800000', name: 'Maroon' },
    { hex: '#FFFFFF', name: 'White' }, { hex: '#FFFAFA', name: 'Snow' }, { hex: '#F0FFF0', name: 'HoneyDew' }, { hex: '#F5FFFA', name: 'MintCream' }, { hex: '#F0FFFF', name: 'Azure' }, { hex: '#F0F8FF', name: 'AliceBlue' }, { hex: '#F8F8FF', name: 'GhostWhite' }, { hex: '#F5F5F5', name: 'WhiteSmoke' }, { hex: '#FFF5EE', name: 'SeaShell' }, { hex: '#F5F5DC', name: 'Beige' }, { hex: '#FDF5E6', name: 'OldLace' }, { hex: '#FFFAF0', name: 'FloralWhite' }, { hex: '#FFFFF0', name: 'Ivory' }, { hex: '#FAEBD7', name: 'AntiqueWhite' }, { hex: '#FAF0E6', name: 'Linen' }, { hex: '#FFF0F5', name: 'LavenderBlush' }, { hex: '#FFE4E1', name: 'MistyRose' },
    { hex: '#DCDCDC', name: 'Gainsboro' }, { hex: '#D3D3D3', name: 'LightGray' }, { hex: '#C0C0C0', name: 'Silver' }, { hex: '#A9A9A9', name: 'DarkGray' }, { hex: '#808080', name: 'Gray' }, { hex: '#696969', name: 'DimGray' }, { hex: '#778899', name: 'LightSlateGray' }, { hex: '#708090', name: 'SlateGray' }, { hex: '#2F4F4F', name: 'DarkSlateGray' }, { hex: '#000000', name: 'Black' }
  ] }
];

function chipHtml(color) {
  const hex = typeof color === 'string' ? color : color.hex;
  const name = typeof color === 'string' ? '' : (color.name || '');
  const tooltipAttr = name ? ` data-tooltip="${name.replace(/"/g, '&quot;')}"` : '';
  return `<div class="chip" data-hex="${hex}"${tooltipAttr} style="background:${hex}"></div>`;
}
const pickerSetSelect = document.getElementById('pickerSetSelect');
const pickerSubsectionsWrap = document.getElementById('pickerSubsectionsWrap');
if (pickerSetSelect && pickerSubsectionsWrap) {
  PICKER_SETS.forEach((set, index) => {
    const option = document.createElement('option');
    option.value = set.id;
    option.textContent = set.name;
    if (index === 0) option.selected = true;
    pickerSetSelect.appendChild(option);
    const subsection = document.createElement('div');
    subsection.className = 'picker-subsection' + (index === 0 ? '' : ' picker-subsection-hidden');
    subsection.id = 'pickerSubsection' + set.id.charAt(0).toUpperCase() + set.id.slice(1);
    subsection.dataset.set = set.id;
    const quickRow = document.createElement('div');
    quickRow.className = 'quick-row';
    quickRow.title = set.name;
    quickRow.innerHTML = set.colors.map(c => chipHtml(c)).join('');
    quickRow.addEventListener('click', (e) => {
      const hex = e.target?.getAttribute?.('data-hex');
      if (!hex) return;
      pickerSetHex(hex);
      applyColorToActive(hex);
    });
    subsection.appendChild(quickRow);
    pickerSubsectionsWrap.appendChild(subsection);
  });
  pickerSubsectionsWrap.addEventListener('mouseover', (e) => {
    const chip = e.target?.closest?.('.chip[data-tooltip]');
    if (chip) showContrastTooltip(chip);
  });
  pickerSubsectionsWrap.addEventListener('mouseout', (e) => {
    const fromChip = e.target?.closest?.('.chip[data-tooltip]');
    const toChip = e.relatedTarget?.closest?.('.chip[data-tooltip]');
    if (fromChip && !toChip) hideContrastTooltip();
  });
}
function showPickerSubsection(setId) {
  if (!pickerSubsectionsWrap) return;
  pickerSubsectionsWrap.querySelectorAll('.picker-subsection').forEach(el => {
    el.classList.toggle('picker-subsection-hidden', el.dataset.set !== setId);
  });
}
if (pickerSetSelect) {
  pickerSetSelect.addEventListener('change', () => showPickerSubsection(pickerSetSelect.value));
}
const pickerShadesEl = document.getElementById('pickerShades');
if (pickerShadesEl) {
  pickerShadesEl.addEventListener('click', (e) => {
    const box = e.target.closest('.picker-shade');
    const hex = box?.dataset?.hex;
    if (!hex) return;
    pickerSetHex(hex);
    applyColorToActive(hex);
  });
}
  function setPaletteFromArray(arr) {
    for (let j = 0; j < Math.min(arr.length, 16); j++) {
      const h = toFullHex(arr[j]); if (h) state.colors[j] = h;
    }
  }

  function applyStoredState(stored) {
    mergeStoredIntoState(stored);
    if (themeNameEl) themeNameEl.value = state.name;
    if (svgHideColourLabelsCb) svgHideColourLabelsCb.checked = !!state.svgHideColourLabels;
    setCount(state.count);
    renderSentimentSwatches();
    renderDivergentSwatches();
    updateOptionalSectionsVisibility();
    setActive('theme', 0);
    themesApi.updateThemeStatus();
    themesApi.syncActiveSavedThemeToFieldName?.();
    ioApi.updateJsonPreview();
    ioApi.updateSvgPreview();
  }

  return {
    get inputs() { return inputs; },
    setCount,
    setPaletteFromArray,
    renderSwatches,
    renderSentimentSwatches,
    renderDivergentSwatches,
    updateOptionalSectionsVisibility,
    setActive,
    applyStoredState,
    showPickerSubsection
  };
}