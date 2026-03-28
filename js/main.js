import {
  state,
  saveState,
  loadState,
  loadSavedThemes,
  readStateFromHash,
  updateHashFromState,
  resetStateData
} from './state.js';
import {
  savedThemes,
  createThemesController,
  clearSavedThemesList,
  setThemeDirty
} from './themes.js';
import { createImportExport } from './import-export.js';
import { initUi } from './ui.js';

const refs = {
  rowEl: document.getElementById('row'),
  rowSentimentEl: document.getElementById('rowSentiment'),
  rowDivergentEl: document.getElementById('rowDivergent'),
  rowSentimentWrapEl: document.getElementById('rowSentimentWrap'),
  rowDivergentWrapEl: document.getElementById('rowDivergentWrap'),
  sentimentEnabledCb: document.getElementById('sentimentEnabled'),
  divergentEnabledCb: document.getElementById('divergentEnabled'),
  countSlider: document.getElementById('countSlider'),
  countValue: document.getElementById('countValue'),
  downloadBtn: document.getElementById('downloadBtn'),
  importBtn: document.getElementById('importBtn'),
  fileInput: document.getElementById('fileInput'),
  jsonFileInput: document.getElementById('jsonFileInput'),
  dropzone: document.getElementById('dropzone'),
  svgHideColourLabelsCb: document.getElementById('svgHideColourLabels'),
  svgCopyBtn: document.getElementById('svgCopyBtn'),
  svgPreviewEl: document.getElementById('svgPreview'),
  jsonPreviewEl: document.getElementById('jsonPreview'),
  jsonCopyBtn: document.getElementById('jsonCopyBtn'),
  exportJsonBtn: document.getElementById('exportJsonBtn'),
  importJsonBtn: document.getElementById('importJsonBtn'),
  summaryEl: document.getElementById('summary'),
  themeNameEl: document.getElementById('themeName'),
  resetBtn: document.getElementById('resetBtn'),
  themeComboTrigger: document.getElementById('themeComboTrigger'),
  themeComboList: document.getElementById('themeComboList'),
  themeStatusIcon: document.getElementById('themeStatusIcon'),
  themeStatusLabel: document.getElementById('themeStatusLabel'),
  saveThemeBtn: document.getElementById('saveThemeBtn'),
  newThemeBtn: document.getElementById('newThemeBtn'),
  deleteThemeBtn: document.getElementById('deleteThemeBtn'),
  pickerPanel: document.getElementById('pickerPanel'),
  svEl: document.getElementById('sv'),
  svHandle: document.getElementById('svHandle'),
  hueEl: document.getElementById('hue'),
  hueHandle: document.getElementById('hueHandle'),
  pickerHexEl: document.getElementById('pickerHex'),
  pickerR: document.getElementById('pickerR'),
  pickerG: document.getElementById('pickerG'),
  pickerB: document.getElementById('pickerB'),
  pickerC: document.getElementById('pickerC'),
  pickerM: document.getElementById('pickerM'),
  pickerY: document.getElementById('pickerY'),
  pickerK: document.getElementById('pickerK'),
  contrastTooltipEl: document.getElementById('contrastTooltip'),
  normalizeBtn: document.getElementById('normalizeBtn')
};

const io = {
  updateJsonPreview() {},
  updateSvgPreview() {}
};

let ui;
const themes = createThemesController(refs, () => ui, io);
ui = initUi(refs, themes, io);
Object.assign(io, createImportExport(refs, () => ui, themes));

const fromHash = readStateFromHash();
const stored = fromHash || loadState();
if (stored) ui.applyStoredState(stored);

window.addEventListener('hashchange', () => {
  const fromHashNow = readStateFromHash();
  if (fromHashNow) {
    ui.applyStoredState(fromHashNow);
    saveState();
  }
});

savedThemes.push(...loadSavedThemes());

ui.setCount(state.count);
ui.renderSentimentSwatches();
ui.renderDivergentSwatches();
ui.updateOptionalSectionsVisibility();
ui.setActive('theme', 0);
const pickerSetSelect = document.getElementById('pickerSetSelect');
if (pickerSetSelect) {
  pickerSetSelect.value = 'basic';
  ui.showPickerSubsection('basic');
}

themes.refreshSavedThemesUI('');
themes.updateThemeStatus();
io.updateJsonPreview();
io.updateSvgPreview();
saveState();
updateHashFromState();

if (refs.resetBtn) {
  refs.resetBtn.addEventListener('click', () => {
    if (!confirm('Clear all stored themes and reset palette to defaults? This cannot be undone.')) return;
    resetStateData();
    clearSavedThemesList();
    if (refs.themeNameEl) refs.themeNameEl.value = '';
    if (refs.svgHideColourLabelsCb) refs.svgHideColourLabelsCb.checked = false;
    ui.setCount(state.count);
    ui.renderSentimentSwatches();
    ui.renderDivergentSwatches();
    ui.updateOptionalSectionsVisibility();
    ui.setActive('theme', 0);
    if (refs.themeComboList) themes.refreshSavedThemesUI('');
    setThemeDirty(false);
    themes.updateThemeStatus();
  });
}
