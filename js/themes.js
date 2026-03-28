import { toFullHex } from './colour-math.js';
import { DEFAULTS, DEFAULTS_SENTIMENT, DEFAULTS_DIVERGENT } from './colour-export.js';
import {
  state,
  saveState,
  saveSavedThemes,
  setAfterSaveStateHook
} from './state.js';

export let savedThemes = [];
export let suppressAutoThemeSave = false;
export let themeDirty = false;

export function setThemeDirty(v) {
  themeDirty = !!v;
}

export function clearSavedThemesList() {
  savedThemes.length = 0;
}

/**
 * @param {object} refs - DOM refs from main
 * @param {() => object} getUi - returns ui API after initUi
 * @param {object} io - import/export API: updateJsonPreview, updateSvgPreview
 */
export function createThemesController(refs, getUi, io) {
  const {
    themeNameEl,
    themeComboTrigger,
    themeComboList,
    themeStatusIcon,
    themeStatusLabel,
    saveThemeBtn,
    newThemeBtn,
    deleteThemeBtn
  } = refs;

  function updateThemeStatus() {
    if (!themeStatusIcon || !themeStatusLabel) return;
    const name = (themeNameEl && themeNameEl.value ? themeNameEl.value : '').trim();
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
    const divergent = (state.divergentColors || []).slice(0, 3).map(c => toFullHex(c)).filter(Boolean);
    return {
      name,
      count: state.count,
      colors,
      sentimentColors: sentiment.length === 3 ? sentiment : DEFAULTS_SENTIMENT.slice(),
      divergentColors: divergent.length === 3 ? divergent : DEFAULTS_DIVERGENT.slice(),
      sentimentEnabled: !!state.sentimentEnabled,
      divergentEnabled: !!state.divergentEnabled
    };
  }

  function autoSaveThemeIfNamed() {
    if (!themeComboList || !themeNameEl) return;
    const name = (themeNameEl.value || '').trim();
    if (!name) return;
    const payload = buildCurrentThemePayload(name);
    if (!payload) return;
    const existingIndex = savedThemes.findIndex(t => t.name === name);
    if (existingIndex === -1) return;
    savedThemes[existingIndex] = payload;
    saveSavedThemes(savedThemes);
    refreshSavedThemesUI(name);
    themeDirty = false;
    updateThemeStatus();
  }

  function applySavedTheme(theme) {
    if (!theme) return;
    const ui = getUi();
    if (!ui) return;
    const colors = Array.isArray(theme.colors) ? theme.colors : [];
    const n = Math.max(1, Math.min(16, theme.count || colors.length || 1));
    state.name = theme.name || '';
    themeNameEl.value = state.name;
    themeDirty = false;
    suppressAutoThemeSave = true;
    ui.setPaletteFromArray(colors);
    ui.setCount(n);
    if (Array.isArray(theme.sentimentColors) && theme.sentimentColors.length === 3) {
      state.sentimentColors = theme.sentimentColors.map(toFullHex).filter(Boolean).slice(0, 3);
      if (state.sentimentColors.length < 3) state.sentimentColors = DEFAULTS_SENTIMENT.slice();
    }
    if (Array.isArray(theme.divergentColors) && theme.divergentColors.length === 3) {
      state.divergentColors = theme.divergentColors.map(toFullHex).filter(Boolean).slice(0, 3);
      if (state.divergentColors.length < 3) state.divergentColors = DEFAULTS_DIVERGENT.slice();
    }
    ui.renderSentimentSwatches();
    ui.renderDivergentSwatches();
    state.sentimentEnabled = theme.sentimentEnabled !== false;
    state.divergentEnabled = theme.divergentEnabled !== false;
    ui.updateOptionalSectionsVisibility();
    suppressAutoThemeSave = false;
    saveState();
    updateThemeStatus();
  }

  setAfterSaveStateHook(() => {
    if (!suppressAutoThemeSave) autoSaveThemeIfNamed();
  });

  if (saveThemeBtn && newThemeBtn && deleteThemeBtn && themeComboList && themeNameEl) {
    if (themeComboTrigger) {
      themeComboTrigger.addEventListener('click', (e) => {
        e.preventDefault();
        if (themeComboList.classList.contains('open')) closeThemeCombo();
        else { refreshSavedThemesUI((themeNameEl.value || '').trim()); openThemeCombo(); }
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
      let name = (prompt('Name for new theme:') || '').trim() || 'New theme';
      const baseName = name;
      let n = 1;
      while (savedThemes.some(t => t.name === name)) {
        name = baseName + ' ' + (n++);
      }
      const payload = {
        name,
        count: 8,
        colors: DEFAULTS.slice(0, 8),
        sentimentColors: DEFAULTS_SENTIMENT.slice(),
        divergentColors: DEFAULTS_DIVERGENT.slice(),
        sentimentEnabled: !!state.sentimentEnabled,
        divergentEnabled: !!state.divergentEnabled
      };
      savedThemes.push(payload);
      saveSavedThemes(savedThemes);
      refreshSavedThemesUI(name);
      applySavedTheme(payload);
    });

    saveThemeBtn.addEventListener('click', () => {
      const name = (themeNameEl.value || '').trim();
      if (!name) {
        alert('Please enter a theme name before saving.');
        themeNameEl.focus();
        return;
      }
      const payload = buildCurrentThemePayload(name);
      if (!payload) {
        alert('Please fix invalid hex values before saving this theme.');
        return;
      }
      const existingIndex = savedThemes.findIndex(t => t.name === name);
      if (existingIndex !== -1) {
        if (!confirm(`A theme named "${name}" already exists. Overwrite it?`)) return;
        savedThemes[existingIndex] = payload;
      } else {
        savedThemes.push(payload);
      }
      saveSavedThemes(savedThemes);
      refreshSavedThemesUI(name);
      themeDirty = false;
      updateThemeStatus();
    });

    deleteThemeBtn.addEventListener('click', () => {
      const name = (themeNameEl.value || '').trim();
      if (!name) {
        alert('Please enter or select a theme name to delete.');
        return;
      }
      if (!savedThemes.some(t => t.name === name)) {
        alert(`No saved theme named "${name}".`);
        return;
      }
      if (!confirm(`Delete the theme "${name}"? This cannot be undone.`)) return;
      savedThemes = savedThemes.filter(t => t.name !== name);
      saveSavedThemes(savedThemes);
      refreshSavedThemesUI('');
      themeNameEl.value = '';
      state.name = '';
      updateThemeStatus();
    });
  }

  if (themeNameEl) {
    themeNameEl.addEventListener('input', () => {
      state.name = themeNameEl.value;
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
    applySavedTheme
  };
}
