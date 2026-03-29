import { describe, it, expect, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { toFullHex } from '../../js/colour-math.js';
import { DEFAULTS } from '../../js/colour-export.js';

/**
 * Fresh JSDOM + vi.resetModules() so each test gets a clean document (no leaked
 * document listeners from createThemesController) and fresh themes/state modules.
 */
function snapshotGlobals() {
  return {
    window: globalThis.window,
    document: globalThis.document,
    localStorage: globalThis.localStorage,
    location: globalThis.location,
    history: globalThis.history,
    HTMLElement: globalThis.HTMLElement
  };
}

function restoreGlobals(prev) {
  for (const key of Object.keys(prev)) {
    if (prev[key] === undefined) delete globalThis[key];
    else globalThis[key] = prev[key];
  }
}

function installFreshDom() {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost/',
    pretendToBeVisual: true
  });
  const w = dom.window;
  globalThis.window = w;
  globalThis.document = w.document;
  globalThis.localStorage = w.localStorage;
  globalThis.location = w.location;
  globalThis.history = w.history;
  globalThis.HTMLElement = w.HTMLElement;
}

/**
 * @returns {Promise<{
 *   themesApi: object,
 *   savedThemes: import('../../js/themes.js').savedThemes,
 *   themeNameEl: HTMLInputElement,
 *   newThemeBtn: { click: () => void },
 *   deleteThemeBtn: { click: () => void },
 *   ui: object,
 *   state: import('../../js/state.js').state,
 *   saveState: () => void,
 *   resetStateData: () => void,
 *   clearSavedThemesList: () => void
 * }>}
 */
async function createHarness() {
  vi.resetModules();
  const stateMod = await import('../../js/state.js');
  const themesMod = await import('../../js/themes.js');
  const { createThemesController, savedThemes, clearSavedThemesList } = themesMod;
  const { resetStateData, state, saveState } = stateMod;

  resetStateData();
  clearSavedThemesList();

  function stubBtn() {
    const cbs = [];
    return {
      addEventListener(_t, fn) {
        cbs.push(fn);
      },
      click: () => {
        cbs.forEach(f => f());
      },
      focus: () => {}
    };
  }

  const themeNameEl = document.createElement('input');
  themeNameEl.value = '';
  const themeComboList = document.createElement('ul');
  const themeComboTrigger = stubBtn();
  const duplicateThemeBtn = stubBtn();
  const newThemeBtn = stubBtn();
  const deleteThemeBtn = stubBtn();
  const themeStatusIcon = {
    className: '',
    classList: { add() {}, remove() {} },
    textContent: ''
  };
  const themeStatusLabel = { textContent: '' };

  const inputs = Array.from({ length: 16 }, () => ({ value: '#001122' }));

  const ui = {
    inputs,
    setPaletteFromArray(arr) {
      for (let j = 0; j < Math.min(arr.length, 16); j++) {
        const h = toFullHex(arr[j]);
        if (h) state.colors[j] = h;
      }
    },
    setCount(n) {
      state.count = n;
    },
    renderSentimentSwatches() {},
    renderDivergentSwatches() {},
    updateOptionalSectionsVisibility() {},
    syncInputsFromState() {
      for (let i = 0; i < state.count; i++) {
        inputs[i].value = toFullHex(state.colors[i]) || '#000000';
      }
    }
  };

  const refs = {
    themeNameEl,
    themeComboList,
    themeComboTrigger,
    themeStatusIcon,
    themeStatusLabel,
    duplicateThemeBtn,
    newThemeBtn,
    deleteThemeBtn
  };

  const io = { updateJsonPreview: () => {}, updateSvgPreview: () => {} };

  let themesApi;
  themesApi = createThemesController(refs, () => ui, io, {
    onLastThemeDeleted() {
      resetStateData();
      clearSavedThemesList();
      themeNameEl.value = '';
      state.name = '';
      ui.setCount(8);
      ui.setPaletteFromArray(DEFAULTS.slice(0, 8));
      ui.syncInputsFromState();
      themesApi.ensureInitialThemeIfEmpty();
    }
  });

  return {
    themesApi,
    savedThemes,
    themeNameEl,
    newThemeBtn,
    deleteThemeBtn,
    ui,
    state,
    saveState,
    resetStateData,
    clearSavedThemesList
  };
}

async function withFreshDom(run) {
  const prev = snapshotGlobals();
  installFreshDom();
  try {
    return await run();
  } finally {
    vi.clearAllTimers();
    restoreGlobals(prev);
  }
}

describe('theme storage workflows', () => {
  it('initialises with a default saved theme when the list is empty', async () => {
    await withFreshDom(async () => {
      const { themesApi, savedThemes, themeNameEl, state, ui } = await createHarness();

      const seeded = themesApi.ensureInitialThemeIfEmpty();
      expect(seeded).toBe(true);
      expect(savedThemes.length).toBe(1);
      expect(savedThemes[0].name).toMatch(/^Theme \d+$/);
      expect(themeNameEl.value).toBe(savedThemes[0].name);
      expect(state.name).toBe(savedThemes[0].name);
      ui.syncInputsFromState();
      expect(savedThemes[0].colors.length).toBe(state.count);
    });
  });

  it('creates a new theme with the next Theme N name', async () => {
    await withFreshDom(async () => {
      const { themesApi, savedThemes, themeNameEl, newThemeBtn } = await createHarness();
      themesApi.ensureInitialThemeIfEmpty();
      expect(savedThemes.length).toBe(1);
      const first = savedThemes[0].name;

      newThemeBtn.click();
      expect(savedThemes.length).toBe(2);
      expect(savedThemes[1].name).not.toBe(first);
      expect(savedThemes.map(t => t.name)).toContain('Theme 2');
      expect(themeNameEl.value).toBe('Theme 2');
    });
  });

  it('renames the active theme via saveState / autosave', async () => {
    await withFreshDom(async () => {
      const { themesApi, savedThemes, themeNameEl, state, saveState, ui } = await createHarness();
      themesApi.ensureInitialThemeIfEmpty();
      ui.syncInputsFromState();

      themeNameEl.value = 'Ocean Blue';
      state.name = 'Ocean Blue';
      saveState();

      expect(savedThemes.length).toBe(1);
      expect(savedThemes[0].name).toBe('Ocean Blue');
      expect(themeNameEl.value).toBe('Ocean Blue');
    });
  });

  it('deletes the new theme and leaves the previous one selected when two exist', async () => {
    await withFreshDom(async () => {
      const { themesApi, savedThemes, themeNameEl, newThemeBtn, ui, state } =
        await createHarness();
      themesApi.ensureInitialThemeIfEmpty();
      newThemeBtn.click();
      expect(savedThemes.length).toBe(2);
      const firstName = savedThemes[0].name;

      ui.syncInputsFromState();
      themeNameEl.value = 'Theme 2';
      state.name = 'Theme 2';

      themesApi.deleteCurrentSavedTheme();
      expect(savedThemes.length).toBe(1);
      expect(savedThemes[0].name).toBe(firstName);
      expect(themeNameEl.value).toBe(firstName);
    });
  });

  it('reset clears stored themes and re-seeds a default theme', async () => {
    await withFreshDom(async () => {
      const { themesApi, savedThemes, themeNameEl, state, newThemeBtn, resetStateData, clearSavedThemesList, ui } =
        await createHarness();
      themesApi.ensureInitialThemeIfEmpty();
      newThemeBtn.click();
      expect(savedThemes.length).toBe(2);

      resetStateData();
      clearSavedThemesList();
      themeNameEl.value = '';
      state.name = '';
      ui.setCount(8);
      ui.setPaletteFromArray(DEFAULTS.slice(0, 8));
      ui.syncInputsFromState();

      themesApi.ensureInitialThemeIfEmpty();
      expect(savedThemes.length).toBe(1);
      expect(savedThemes[0].name).toMatch(/^Theme \d+$/);
      expect(themeNameEl.value).toBe(savedThemes[0].name);
    });
  });
});
