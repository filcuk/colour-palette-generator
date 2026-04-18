import {
  state,
  saveState,
  loadState,
  loadSavedThemes,
  readStateFromHash,
  updateHashFromState,
  replaceHashFromStateNow,
  enableHashHistoryPush,
  resetStateData,
  onAfterSaveState
} from './state.js';
import {
  savedThemes,
  createThemesController,
  clearSavedThemesList,
  setThemeDirty
} from './themes.js';
import { createImportExport } from './import-export.js';
import { initUi } from './ui.js';
import { clampThemeName } from './theme-name.js';
import { createTwiceConfirmPair } from './twice-confirm.js';
import { showToast } from './toasts.js';
import { initColoursPreviewLayout } from './colours-preview-layout.js';
import { initPbiReportPreview, refreshPbiReportPreview } from './pbi-report-preview.js';

function toastFirstConfirm(which) {
  if (which === 'reset') {
    showToast('Press again to confirm. All stored themes will be permanently deleted.', { theme: 'critical' });
  } else {
    showToast('Press again to confirm. This action cannot be undone.', { theme: 'warning' });
  }
}

let dangerArms = null;

const refs = {
  rowEl: document.getElementById('row'),
  rowSentimentEl: document.getElementById('rowSentiment'),
  rowDivergentEl: document.getElementById('rowDivergent'),
  rowSentimentWrapEl: document.getElementById('rowSentimentWrap'),
  rowDivergentWrapEl: document.getElementById('rowDivergentWrap'),
  rowStructuralEl: document.getElementById('rowStructural'),
  rowStructuralWrapEl: document.getElementById('rowStructuralWrap'),
  rowAdvancedEl: document.getElementById('rowAdvanced'),
  rowAdvancedWrapEl: document.getElementById('rowAdvancedWrap'),
  sentimentEnabledCb: document.getElementById('sentimentEnabled'),
  divergentEnabledCb: document.getElementById('divergentEnabled'),
  structuralEnabledCb: document.getElementById('structuralEnabled'),
  advancedEnabledCb: document.getElementById('advancedEnabled'),
  advancedPageTransparencySlider: document.getElementById('advancedPageTransparencySlider'),
  advancedVisualTransparencySlider: document.getElementById('advancedVisualTransparencySlider'),
  advancedPageTransparencyValue: document.getElementById('advancedPageTransparencyValue'),
  advancedVisualTransparencyValue: document.getElementById('advancedVisualTransparencyValue'),
  divergentNullEnabledCb: document.getElementById('divergentNullEnabled'),
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
  themeNameEl: document.getElementById('themeName'),
  resetBtn: document.getElementById('resetBtn'),
  themeComboTrigger: document.getElementById('themeComboTrigger'),
  themeComboList: document.getElementById('themeComboList'),
  themeStatusIcon: document.getElementById('themeStatusIcon'),
  themeStatusLabel: document.getElementById('themeStatusLabel'),
  duplicateThemeBtn: document.getElementById('duplicateThemeBtn'),
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

function runResetAndReseed() {
  resetStateData();
  clearSavedThemesList();
  if (refs.themeNameEl) refs.themeNameEl.value = '';
  if (refs.svgHideColourLabelsCb) refs.svgHideColourLabelsCb.checked = false;
  ui.setCount(state.count);
  ui.renderSentimentSwatches();
  ui.renderDivergentSwatches();
  ui.renderStructuralSwatches();
  ui.renderAdvancedSwatches();
  ui.updateOptionalSectionsVisibility();
  ui.setActive('theme', 0);
  themes.ensureInitialThemeIfEmpty();
  themes.refreshSavedThemesUI(clampThemeName(refs.themeNameEl ? refs.themeNameEl.value : ''));
  setThemeDirty(false);
  themes.updateThemeStatus();
  showToast('Local storage was reset', { theme: 'success' });
}

const themes = createThemesController(refs, () => ui, io, {
  onLastThemeDeleted: runResetAndReseed
});
ui = initUi(refs, themes, io);
Object.assign(io, createImportExport(refs, () => ui, themes));

if (refs.resetBtn && refs.deleteThemeBtn) {
  dangerArms = createTwiceConfirmPair({
    resetBtn: refs.resetBtn,
    deleteBtn: refs.deleteThemeBtn,
    onReset: () => runResetAndReseed(),
    onDelete: () => themes.deleteCurrentSavedTheme(),
    onArm: toastFirstConfirm
  });
}

initColoursPreviewLayout({
  previewBtn: document.getElementById('coloursPreviewBtn'),
  layoutEl: document.getElementById('appLayout'),
  panelEl: document.getElementById('coloursPreviewPanel')
});

const pbiReportPreviewEl = document.getElementById('pbiReportPreview');
const fromHash = readStateFromHash();
const stored = fromHash || loadState();
if (stored) ui.applyStoredState(stored);
initPbiReportPreview(pbiReportPreviewEl);
onAfterSaveState(() => refreshPbiReportPreview(pbiReportPreviewEl));

let urlNavRaf = null;
function scheduleApplyStateFromUrl() {
  if (urlNavRaf != null) return;
  urlNavRaf = requestAnimationFrame(() => {
    urlNavRaf = null;
    dangerArms?.clear();
    const fromHashNow = readStateFromHash();
    if (fromHashNow) {
      ui.applyStoredState(fromHashNow);
      saveState();
      replaceHashFromStateNow();
      themes.commitSharedUrlPaletteAsNewSavedTheme();
    }
  });
}

window.addEventListener('popstate', scheduleApplyStateFromUrl);
window.addEventListener('hashchange', scheduleApplyStateFromUrl);

savedThemes.push(...loadSavedThemes());

ui.setCount(state.count);
ui.renderSentimentSwatches();
ui.renderDivergentSwatches();
ui.renderStructuralSwatches();
ui.renderAdvancedSwatches();
ui.updateOptionalSectionsVisibility();
ui.setActive('theme', 0);
const pickerSetSelect = document.getElementById('pickerSetSelect');
if (pickerSetSelect) {
  pickerSetSelect.value = 'basic';
  ui.showPickerSubsection('basic');
}

if (!fromHash) {
  themes.ensureInitialThemeIfEmpty();
}
themes.syncActiveSavedThemeToFieldName();
themes.refreshSavedThemesUI(clampThemeName(refs.themeNameEl ? refs.themeNameEl.value : ''));
themes.updateThemeStatus();
io.updateJsonPreview();
io.updateSvgPreview();
saveState();
replaceHashFromStateNow();
enableHashHistoryPush();
if (fromHash) {
  themes.commitSharedUrlPaletteAsNewSavedTheme();
}

