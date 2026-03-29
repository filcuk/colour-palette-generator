import { toFullHex } from './colour-math.js';
import {
  allocateDuplicateThemeName,
  allocateNumberedThemeNameFromBase,
  clampThemeName,
  numberingBaseFromThemeName,
  resolveThemeNameAgainstSavedList
} from './theme-name.js';
import { showToast } from './toasts.js';
import { DEFAULTS, DEFAULTS_SENTIMENT, DEFAULTS_DIVERGENT } from './colour-export.js';
import {
  state,
  saveState,
  saveSavedThemes,
  setAfterSaveStateHook,
  replaceHashFromStateNow,
  getDivergentColorsResolved,
  migrateLegacyDivergentOrder
} from './state.js';

export let savedThemes = [];
export let suppressAutoThemeSave = false;
export let themeDirty = false;

/** Index of the saved theme last applied or created; drives rename-in-place for the combobox. */
let activeSavedThemeIndex = -1;

/** Dedupe auto-save of the same shared URL in one tab session (refresh). */
const SESSION_LAST_SHARED_HASH_KEY = 'colour-palette.lastSharedUrlHash';

export function setActiveSavedThemeIndex(i) {
  activeSavedThemeIndex = typeof i === 'number' && i >= 0 ? i : -1;
}

export function setThemeDirty(v) {
  themeDirty = !!v;
}

export function clearSavedThemesList() {
  savedThemes.length = 0;
  activeSavedThemeIndex = -1;
}

/**
 * @param {object} refs - DOM refs from main
 * @param {() => object} getUi - returns ui API after initUi
 * @param {object} io - import/export API: updateJsonPreview, updateSvgPreview
 * @param {{ onLastThemeDeleted?: () => void }} [opts]
 */
export function createThemesController(refs, getUi, io, opts = {}) {
  const { onLastThemeDeleted } = opts;
  const {
    themeNameEl,
    themeComboTrigger,
    themeComboList,
    themeStatusIcon,
    themeStatusLabel,
    duplicateThemeBtn,
    newThemeBtn,
    deleteThemeBtn
  } = refs;

  function themeNameFromField() {
    return clampThemeName(themeNameEl ? themeNameEl.value : '');
  }

  function syncActiveSavedThemeToFieldName() {
    if (!themeNameEl) {
      activeSavedThemeIndex = -1;
      return;
    }
    const name = themeNameFromField();
    if (!name) {
      activeSavedThemeIndex = -1;
      return;
    }
    const i = savedThemes.findIndex(t => t.name === name);
    activeSavedThemeIndex = i;
  }

  function updateThemeStatus() {
    if (!themeStatusIcon || !themeStatusLabel) return;
    const name = themeNameFromField();
    themeStatusIcon.className = 'theme-status-icon';
    if (!name) {
      themeStatusIcon.textContent = '\u2014';
      themeStatusIcon.classList.remove('throbber', 'icon-check', 'icon-warning');
      themeStatusLabel.textContent = 'No theme selected';
      io.updateJsonPreview();
      io.updateSvgPreview();
      return;
    }
    const exists = savedThemes.some(t => t.name === name);
    if (exists && themeDirty) {
      themeStatusIcon.textContent = '';
      themeStatusIcon.classList.add('throbber');
      themeStatusLabel.textContent = 'Unsaved changes';
    } else if (exists) {
      themeStatusIcon.textContent = '';
      themeStatusIcon.classList.add('icon-check');
      themeStatusIcon.textContent = '\u2713';
      themeStatusLabel.textContent = 'Saved';
    } else {
      themeStatusIcon.textContent = '';
      themeStatusIcon.classList.add('icon-warning');
      themeStatusIcon.textContent = '!';
      themeStatusLabel.textContent = 'Not saved';
    }
    io.updateJsonPreview();
    io.updateSvgPreview();
  }

  function markThemeDirty() {
    themeDirty = true;
    updateThemeStatus();
  }

  function refreshSavedThemesUI(selectedName) {
    if (!themeComboList) return;
    themeComboList.innerHTML = '';
    themeComboList.removeAttribute('aria-activedescendant');

    if (savedThemes.length === 0) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'No saved themes';
      li.setAttribute('aria-selected', 'false');
      themeComboList.appendChild(li);
      return;
    }

    savedThemes.forEach(t => {
      const li = document.createElement('li');
      li.textContent = t.name;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', t.name === selectedName ? 'true' : 'false');
      li.dataset.themeName = t.name;
      themeComboList.appendChild(li);
    });
  }

  function openThemeCombo() {
    if (!themeComboList) return;
    themeComboList.classList.add('open');
    themeComboList.setAttribute('aria-hidden', 'false');
    if (themeComboTrigger) themeComboTrigger.setAttribute('aria-expanded', 'true');
  }

  function closeThemeCombo() {
    if (!themeComboList) return;
    themeComboList.classList.remove('open');
    themeComboList.setAttribute('aria-hidden', 'true');
    if (themeComboTrigger) themeComboTrigger.setAttribute('aria-expanded', 'false');
  }

  function buildCurrentThemePayload(name) {
    const cleanName = clampThemeName(name == null ? '' : String(name));
    const ui = getUi();
    if (!ui || !ui.inputs) return null;
    const inputs = ui.inputs;
    const colors = [];
    for (let i = 0; i < state.count; i++) {
      const hex = toFullHex(inputs[i]?.value || state.colors[i]);
      if (!hex) return null;
      colors.push(hex);
    }
    const sentiment = (state.sentimentColors || []).slice(0, 3).map(c => toFullHex(c)).filter(Boolean);
    const divergent = getDivergentColorsResolved();
    return {
      name: cleanName,
      count: state.count,
      colors,
      sentimentColors: sentiment.length === 3 ? sentiment : DEFAULTS_SENTIMENT.slice(),
      divergentColors: divergent.slice(),
      divergentOrder: 'mcmn',
      sentimentEnabled: !!state.sentimentEnabled,
      divergentEnabled: !!state.divergentEnabled,
      divergentNullEnabled: state.divergentNullEnabled !== false
    };
  }

  function autoSaveThemeIfNamed() {
    if (!themeComboList || !themeNameEl) return;
    const name = themeNameFromField();
    if (!name) return;
    if (activeSavedThemeIndex >= 0 && activeSavedThemeIndex < savedThemes.length) {
      const finalName = resolveThemeNameAgainstSavedList(name, savedThemes, activeSavedThemeIndex);
      const payload = buildCurrentThemePayload(finalName);
      if (!payload) return;
      savedThemes[activeSavedThemeIndex] = payload;
      saveSavedThemes(savedThemes);
      if (finalName !== name) {
        themeNameEl.value = finalName;
        state.name = finalName;
        suppressAutoThemeSave = true;
        saveState();
        suppressAutoThemeSave = false;
      }
      refreshSavedThemesUI(finalName);
      themeDirty = false;
      updateThemeStatus();
      return;
    }
    const payload = buildCurrentThemePayload(name);
    if (!payload) return;
    const existingIndex = savedThemes.findIndex(t => t.name === name);
    if (existingIndex === -1) return;
    savedThemes[existingIndex] = payload;
    activeSavedThemeIndex = existingIndex;
    saveSavedThemes(savedThemes);
    refreshSavedThemesUI(name);
    themeDirty = false;
    updateThemeStatus();
  }

  /**
   * After palette state was applied from the URL hash, append it as a new saved theme
   * (unique name) so it does not fight an existing selection. Skips if this hash was
   * already committed in this session (same tab, same URL — e.g. refresh).
   */
  function commitSharedUrlPaletteAsNewSavedTheme() {
    const h = typeof location !== 'undefined' ? location.hash || '' : '';
    if (!h || h.length < 2) return;
    try {
      if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(SESSION_LAST_SHARED_HASH_KEY) === h) {
        return;
      }
    } catch {
      /* private mode */
    }

    const ui = getUi();
    if (!ui || !ui.inputs) return;

    const taken = new Set(savedThemes.map(t => t.name).filter(Boolean));
    const base = clampThemeName(state.name || '') || 'Shared';
    const finalName = taken.has(base)
      ? allocateDuplicateThemeName(base, taken) ??
        allocateNumberedThemeNameFromBase(numberingBaseFromThemeName(base), taken) ??
        `${base} 1`
      : base;

    const payload = buildCurrentThemePayload(finalName);
    if (!payload) return;

    suppressAutoThemeSave = true;
    savedThemes.push(payload);
    saveSavedThemes(savedThemes);
    state.name = finalName;
    if (themeNameEl) themeNameEl.value = finalName;
    refreshSavedThemesUI(finalName);
    setActiveSavedThemeIndex(savedThemes.length - 1);
    suppressAutoThemeSave = false;
    setThemeDirty(false);
    updateThemeStatus();
    saveState({ skipHashUpdate: true });
    try {
      if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(SESSION_LAST_SHARED_HASH_KEY, h);
    } catch {
      /* ignore */
    }
  }

  function applySavedTheme(theme) {
    if (!theme) return;
    const ui = getUi();
    if (!ui) return;
    const colors = Array.isArray(theme.colors) ? theme.colors : [];
    const n = Math.max(1, Math.min(16, theme.count || colors.length || 1));
    const nm = clampThemeName(theme.name || '');
    state.name = nm;
    themeNameEl.value = nm;
    themeDirty = false;
    suppressAutoThemeSave = true;
    ui.setPaletteFromArray(colors);
    ui.setCount(n);
    if (Array.isArray(theme.sentimentColors) && theme.sentimentColors.length === 3) {
      state.sentimentColors = theme.sentimentColors.map(toFullHex).filter(Boolean).slice(0, 3);
      if (state.sentimentColors.length < 3) state.sentimentColors = DEFAULTS_SENTIMENT.slice();
    }
    if (Array.isArray(theme.divergentColors) && theme.divergentColors.length >= 3) {
      let next = DEFAULTS_DIVERGENT.slice();
      for (let i = 0; i < Math.min(4, theme.divergentColors.length); i++) {
        const h = toFullHex(theme.divergentColors[i]);
        if (h) next[i] = h;
      }
      if (theme.divergentOrder !== 'mcmn' && theme.divergentColors.length >= 4) {
        next = migrateLegacyDivergentOrder(next);
      }
      state.divergentColors = next;
    }
    state.sentimentEnabled = theme.sentimentEnabled !== false;
    state.divergentEnabled = theme.divergentEnabled !== false;
    state.divergentNullEnabled = theme.divergentNullEnabled !== false;
    ui.renderSentimentSwatches();
    ui.renderDivergentSwatches();
    ui.updateOptionalSectionsVisibility();
    suppressAutoThemeSave = false;
    activeSavedThemeIndex = savedThemes.findIndex(t => t === theme);
    if (activeSavedThemeIndex === -1)
      activeSavedThemeIndex = savedThemes.findIndex(t => t.name === theme.name);
    saveState();
    replaceHashFromStateNow();
    updateThemeStatus();
  }

  /** Same payload and flow as the New button: auto name Theme 1, Theme 2, … */
  function createNewAutoNamedTheme(announceCreate = false) {
    const taken = new Set(savedThemes.map(t => t.name).filter(Boolean));
    let name = allocateNumberedThemeNameFromBase('Theme', taken);
    if (!name) {
      let n = 1;
      name = clampThemeName(`Theme ${n}`);
      while (savedThemes.some(t => t.name === name)) {
        n++;
        name = clampThemeName(`Theme ${n}`);
      }
    }
    const payload = {
      name,
      count: 8,
      colors: DEFAULTS.slice(0, 8),
      sentimentColors: DEFAULTS_SENTIMENT.slice(),
      divergentColors: DEFAULTS_DIVERGENT.slice(),
      divergentOrder: 'mcmn',
      sentimentEnabled: !!state.sentimentEnabled,
      divergentEnabled: !!state.divergentEnabled,
      divergentNullEnabled: true
    };
    savedThemes.push(payload);
    saveSavedThemes(savedThemes);
    refreshSavedThemesUI(name);
    applySavedTheme(payload);
    if (announceCreate) {
      showToast(`${name} was created with default preset.`);
    }
  }

  /** When there are no saved themes, seed Theme 1 (or next free name) like New — no prompt. */
  function ensureInitialThemeIfEmpty() {
    if (savedThemes.length > 0) return false;
    createNewAutoNamedTheme(false);
    return true;
  }

  setAfterSaveStateHook(() => {
    if (!suppressAutoThemeSave) autoSaveThemeIfNamed();
  });

  if (duplicateThemeBtn && newThemeBtn && deleteThemeBtn && themeComboList && themeNameEl) {
    if (themeComboTrigger) {
      themeComboTrigger.addEventListener('click', (e) => {
        e.preventDefault();
        if (themeComboList.classList.contains('open')) closeThemeCombo();
        else { refreshSavedThemesUI(themeNameFromField()); openThemeCombo(); }
      });
    }

    themeComboList.addEventListener('click', (e) => {
      const li = e.target.closest('li[data-theme-name]');
      if (!li) return;
      const name = li.dataset.themeName;
      const theme = savedThemes.find(t => t.name === name);
      if (theme) {
        themeNameEl.value = name;
        state.name = name;
        applySavedTheme(theme);
        closeThemeCombo();
        updateThemeStatus();
      }
    });

    document.addEventListener('click', (e) => {
      if (themeComboList && themeComboList.classList.contains('open') &&
          !themeComboList.contains(e.target) && e.target !== themeComboTrigger && !themeComboTrigger?.contains(e.target))
        closeThemeCombo();
    });

    newThemeBtn.addEventListener('click', () => {
      createNewAutoNamedTheme(true);
    });

    duplicateThemeBtn.addEventListener('click', () => {
      const sourceName = themeNameFromField();
      if (!sourceName) {
        alert('Please enter or select a theme name before duplicating.');
        themeNameEl.focus();
        return;
      }
      const newName = allocateDuplicateThemeName(
        sourceName,
        savedThemes.map(t => t.name)
      );
      if (!newName) {
        alert('Could not find an available duplicate name. Try shortening the theme name.');
        return;
      }
      const payload = buildCurrentThemePayload(newName);
      if (!payload) {
        alert('Please fix invalid hex values before duplicating this theme.');
        return;
      }
      savedThemes.push(payload);
      saveSavedThemes(savedThemes);
      applySavedTheme(payload);
      refreshSavedThemesUI(newName);
      themeDirty = false;
      updateThemeStatus();
      showToast(`${newName} was duplicated from ${sourceName}.`);
    });
  }

  function deleteCurrentSavedTheme() {
    if (!deleteThemeBtn || !themeNameEl) return;
    const name = themeNameFromField();
    if (!name) {
      alert('Please enter or select a theme name to delete.');
      return;
    }
    if (!savedThemes.some(t => t.name === name)) {
      alert(`No saved theme named "${name}".`);
      return;
    }
    const idx = savedThemes.findIndex(t => t.name === name);
    if (savedThemes.length === 1 && typeof onLastThemeDeleted === 'function') {
      onLastThemeDeleted();
      return;
    }
    const kept = savedThemes.filter(t => t.name !== name);
    savedThemes.splice(0, savedThemes.length, ...kept);
    saveSavedThemes(savedThemes);
    showToast(`${name} was deleted.`);
    if (idx > 0 && savedThemes[idx - 1]) {
      const prev = savedThemes[idx - 1];
      applySavedTheme(prev);
      refreshSavedThemesUI(prev.name);
    } else {
      activeSavedThemeIndex = -1;
      refreshSavedThemesUI('');
      themeNameEl.value = '';
      state.name = '';
      updateThemeStatus();
    }
  }

  if (themeNameEl) {
    themeNameEl.addEventListener('input', () => {
      const c = clampThemeName(themeNameEl.value);
      if (themeNameEl.value !== c) themeNameEl.value = c;
      state.name = c;
      markThemeDirty();
      saveState();
    });
  }

  return {
    updateThemeStatus,
    markThemeDirty,
    setThemeDirty,
    refreshSavedThemesUI,
    buildCurrentThemePayload,
    autoSaveThemeIfNamed,
    applySavedTheme,
    ensureInitialThemeIfEmpty,
    commitSharedUrlPaletteAsNewSavedTheme,
    setActiveSavedThemeIndex,
    syncActiveSavedThemeToFieldName,
    deleteCurrentSavedTheme
  };
}
