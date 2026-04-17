import { toFullHex } from './colour-math.js';
import { clampThemeName } from './theme-name.js';
import {
  DEFAULTS,
  DEFAULTS_SENTIMENT,
  DEFAULTS_DIVERGENT,
  DEFAULTS_STRUCTURAL,
  getStructuralColorsResolved,
  structuralObjectFromResolved
} from './colour-export.js';

export const STORAGE_KEY = 'colour-palette.v2';
export const THEMES_KEY = 'colour-palette.themes.v1';

export const state = {
  count: 8,
  name: '',
  colors: DEFAULTS.slice(0, 16),
  sentimentColors: DEFAULTS_SENTIMENT.slice(),
  divergentColors: DEFAULTS_DIVERGENT.slice(),
  sentimentEnabled: false,
  divergentEnabled: false,
  structuralColors: DEFAULTS_STRUCTURAL.slice(),
  structuralEnabled: false,
  /** When false, the null swatch is hidden and omitted from Power BI JSON / SVG. */
  divergentNullEnabled: true,
  svgHideColourLabels: false,
  activeSection: 'theme',
  activeIndex: 0
};

export function getThemeColorsFromState() {
  return Array.from({ length: state.count }, (_, i) =>
    toFullHex(state.colors[i]) || toFullHex(DEFAULTS[i]) || '#000000');
}
export function getSentimentColorsResolved() {
  return (state.sentimentColors || DEFAULTS_SENTIMENT).slice(0, 3).map((c, i) =>
    toFullHex(c) || toFullHex(DEFAULTS_SENTIMENT[i]) || '#000000');
}
export function getDivergentColorsResolved() {
  return (state.divergentColors || DEFAULTS_DIVERGENT).slice(0, 4).map((c, i) =>
    toFullHex(c) || toFullHex(DEFAULTS_DIVERGENT[i]) || '#000000');
}

/** Legacy state order [center, minimum, maximum, null] → [maximum, center, minimum, null]. */
export function migrateLegacyDivergentOrder(colors) {
  if (!Array.isArray(colors) || colors.length < 4) return DEFAULTS_DIVERGENT.slice();
  const h = [0, 1, 2, 3].map(i => toFullHex(colors[i]) || DEFAULTS_DIVERGENT[i]);
  return [h[2], h[0], h[1], h[3]];
}
export function buildExportSvgOptsFromState(forPreview) {
  const fullDiv = getDivergentColorsResolved();
  const divergentForExport =
    state.divergentEnabled && state.divergentNullEnabled === false
      ? fullDiv.slice(0, 3)
      : fullDiv;
  const structuralResolved = getStructuralColorsResolved(state);
  return {
    themeColors: getThemeColorsFromState(),
    sentiment: getSentimentColorsResolved(),
    divergent: divergentForExport,
    themeName: state.name,
    sentimentEnabled: state.sentimentEnabled,
    divergentEnabled: state.divergentEnabled,
    structuralEnabled: state.structuralEnabled,
    structural: structuralObjectFromResolved(structuralResolved),
    hideColourLabels: !!state.svgHideColourLabels,
    forPreview
  };
}

let afterSaveStateHook = () => {};
export function setAfterSaveStateHook(fn) {
  afterSaveStateHook = typeof fn === 'function' ? fn : () => {};
}

const afterSaveStateListeners = new Set();
/** Run after each successful {@link saveState} (hash update optional). Does not replace {@link setAfterSaveStateHook}. */
export function onAfterSaveState(fn) {
  if (typeof fn === 'function') afterSaveStateListeners.add(fn);
  return () => afterSaveStateListeners.delete(fn);
}

/**
 * @param {{ skipHashUpdate?: boolean }} [options] - Set skipHashUpdate to persist only (e.g. after re-syncing URL from memory).
 */
export function saveState(options = {}) {
  const skipHashUpdate = options.skipHashUpdate === true;
  try {
    const themeColors = getThemeColorsFromState();
    const sentiment = (state.sentimentColors || []).map(toFullHex).filter(Boolean).slice(0, 3);
    const divergent = getDivergentColorsResolved();
    const payload = {
      count: state.count,
      name: state.name || '',
      colors: themeColors,
      sentimentColors: sentiment.length === 3 ? sentiment : DEFAULTS_SENTIMENT.slice(),
      divergentColors: divergent.slice(),
      divergentOrder: 'mcmn',
      sentimentEnabled: !!state.sentimentEnabled,
      divergentEnabled: !!state.divergentEnabled,
      structuralColors: getStructuralColorsResolved(state).slice(),
      structuralEnabled: !!state.structuralEnabled,
      divergentNullEnabled: state.divergentNullEnabled !== false,
      svgHideColourLabels: !!state.svgHideColourLabels
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch { }
  if (!skipHashUpdate) updateHashFromState();
  afterSaveStateHook();
  for (const fn of afterSaveStateListeners) {
    try {
      fn();
    } catch {
      /* ignore listener errors */
    }
  }
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('colour-palette.v1');
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.colors) || !data.colors.length) return null;
    const count = Math.max(1, Math.min(16, parseInt(data.count || 8, 10)));
    const colors = data.colors.map(toFullHex).filter(Boolean).slice(0, 16);
    const sentimentColors = Array.isArray(data.sentimentColors) && data.sentimentColors.length === 3
      ? data.sentimentColors.map(toFullHex).filter(Boolean).slice(0, 3)
      : DEFAULTS_SENTIMENT.slice();
    let divergentColors = DEFAULTS_DIVERGENT.slice();
    if (Array.isArray(data.divergentColors) && data.divergentColors.length >= 3) {
      for (let i = 0; i < Math.min(4, data.divergentColors.length); i++) {
        const h = toFullHex(data.divergentColors[i]);
        if (h) divergentColors[i] = h;
      }
    }
    if (data.divergentOrder !== 'mcmn' && Array.isArray(data.divergentColors) && data.divergentColors.length >= 4) {
      divergentColors = migrateLegacyDivergentOrder(divergentColors);
    }
    let structuralColors = DEFAULTS_STRUCTURAL.slice();
    if (Array.isArray(data.structuralColors) && data.structuralColors.length >= 6) {
      const n = Math.min(6, data.structuralColors.length);
      for (let i = 0; i < n; i++) {
        const h = toFullHex(data.structuralColors[i]);
        if (h) structuralColors[i] = h;
      }
    }
    return {
      count,
      name: (data.name || '').toString(),
      colors,
      sentimentColors,
      divergentColors,
      structuralColors,
      divergentOrder: 'mcmn',
      sentimentEnabled: data.sentimentEnabled === true,
      divergentEnabled: data.divergentEnabled === true,
      structuralEnabled: data.structuralEnabled === true,
      divergentNullEnabled: data.divergentNullEnabled !== false,
      svgHideColourLabels: data.svgHideColourLabels === true
    };
  } catch { return null; }
}

function stateToHashPayload() {
  const themeColors = getThemeColorsFromState().map(h => (h && h.length >= 7 ? h.slice(1) : '000000'));
  const payload = {
    n: clampThemeName(state.name || ''),
    c: state.count,
    d: themeColors
  };
  if (state.sentimentEnabled) {
    payload.s = (state.sentimentColors || DEFAULTS_SENTIMENT).slice(0, 3).map(c => (toFullHex(c) || '').slice(1) || '000000');
    payload.se = true;
  }
  if (state.divergentEnabled) {
    payload.dv = (state.divergentColors || DEFAULTS_DIVERGENT).slice(0, 4).map(c => (toFullHex(c) || '').slice(1) || '000000');
    payload.de = true;
    payload.dvV = 2;
    if (state.divergentNullEnabled === false) payload.dn = false;
  }
  if (state.structuralEnabled) {
    payload.stc = (state.structuralColors || DEFAULTS_STRUCTURAL).slice(0, 6).map(c => (toFullHex(c) || '').slice(1) || '000000');
    payload.ste = true;
  }
  return payload;
}
export function hashPayloadToStoredShape(p) {
  if (!p || !Array.isArray(p.d) || !p.d.length) return null;
  const count = Math.max(1, Math.min(16, parseInt(p.c, 10) || 8));
  const colors = p.d.slice(0, 16).map(x => typeof x === 'string' && x.length >= 6 ? '#' + x.replace(/^#/, '').slice(0, 6) : null).filter(Boolean);
  if (!colors.length) return null;
  const sentimentColors = Array.isArray(p.s) && p.s.length === 3
    ? p.s.map(x => typeof x === 'string' && x.length >= 6 ? '#' + x.replace(/^#/, '').slice(0, 6) : null).filter(Boolean)
    : DEFAULTS_SENTIMENT.slice();
  let divergentColors = DEFAULTS_DIVERGENT.slice();
  if (Array.isArray(p.dv) && p.dv.length >= 3) {
    for (let i = 0; i < Math.min(4, p.dv.length); i++) {
      const x = p.dv[i];
      const h = typeof x === 'string' && x.length >= 6 ? '#' + x.replace(/^#/, '').slice(0, 6) : null;
      if (h) divergentColors[i] = h;
    }
  }
  /** Only dvV === 1 is legacy [center, min, max, null]. Missing dvV or dvV === 2 is mcmn — do not migrate (avoids swapping center/minimum on shared URLs). */
  if (p.de === true && p.dvV === 1 && Array.isArray(p.dv) && p.dv.length >= 4) {
    divergentColors = migrateLegacyDivergentOrder(divergentColors);
  }
  let structuralColors = DEFAULTS_STRUCTURAL.slice();
  if (Array.isArray(p.stc) && p.stc.length >= 6) {
    for (let i = 0; i < 6; i++) {
      const x = p.stc[i];
      const h = typeof x === 'string' && x.length >= 6 ? '#' + x.replace(/^#/, '').slice(0, 6) : null;
      if (h) structuralColors[i] = h;
    }
  }
  return {
    count,
    name: clampThemeName(p.n != null ? String(p.n) : ''),
    colors: colors.length ? colors : [DEFAULTS[0]],
    sentimentColors: sentimentColors.length === 3 ? sentimentColors : DEFAULTS_SENTIMENT.slice(),
    divergentColors: divergentColors.length === 4 ? divergentColors : DEFAULTS_DIVERGENT.slice(),
    structuralColors,
    divergentOrder: p.de === true ? 'mcmn' : undefined,
    sentimentEnabled: p.se === true,
    divergentEnabled: p.de === true,
    structuralEnabled: p.ste === true,
    divergentNullEnabled: p.de === true ? p.dn !== false : undefined
  };
}
export function encodeHashPayload(payload) {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function decodeHashPayload(hashStr) {
  try {
    const base64 = (hashStr || '').replace(/^#/, '').replace(/-/g, '+').replace(/_/g, '/');
    if (!base64) return null;
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch { return null; }
}
let hashUpdateTimer = null;
/** After initial load, URL updates use pushState so Back/Forward undo/redo palette state. */
let allowHashHistoryPush = false;

export function enableHashHistoryPush() {
  allowHashHistoryPush = true;
}

function getEncodedHashForCurrentState() {
  const payload = stateToHashPayload();
  return encodeHashPayload(payload);
}

function commitHashToUrl(usePush) {
  try {
    const encoded = getEncodedHashForCurrentState();
    const url = location.pathname + location.search + '#' + encoded;
    if (location.hash === '#' + encoded) return;
    if (usePush) history.pushState(null, '', url);
    else history.replaceState(null, '', url);
  } catch { }
}

/** Clears pending debounced hash write and sets the URL with replaceState (initial sync). */
export function replaceHashFromStateNow() {
  if (hashUpdateTimer) {
    clearTimeout(hashUpdateTimer);
    hashUpdateTimer = null;
  }
  commitHashToUrl(false);
}

export function updateHashFromState() {
  if (hashUpdateTimer) clearTimeout(hashUpdateTimer);
  hashUpdateTimer = setTimeout(() => {
    hashUpdateTimer = null;
    commitHashToUrl(allowHashHistoryPush);
  }, 300);
}
export function readStateFromHash() {
  const decoded = decodeHashPayload(location.hash);
  return decoded ? hashPayloadToStoredShape(decoded) : null;
}

export function mergeStoredIntoState(stored) {
  if (!stored) return;
  state.count = stored.count;
  state.name = clampThemeName(stored.name || '');
  for (let i = 0; i < Math.min(stored.colors.length, 16); i++) {
    const h = toFullHex(stored.colors[i]); if (h) state.colors[i] = h;
  }
  if (stored.sentimentColors && stored.sentimentColors.length === 3)
    state.sentimentColors = stored.sentimentColors.slice();
  if (stored.divergentColors && stored.divergentColors.length >= 3) {
    const next = DEFAULTS_DIVERGENT.slice();
    const src = stored.divergentColors.slice(0, 4);
    for (let i = 0; i < src.length; i++) {
      const h = toFullHex(src[i]);
      if (h) next[i] = h;
    }
    state.divergentColors =
      stored.divergentOrder !== 'mcmn' && src.length >= 4
        ? migrateLegacyDivergentOrder(next)
        : next;
  }
  if (stored.sentimentEnabled !== undefined) state.sentimentEnabled = stored.sentimentEnabled === true;
  if (stored.divergentEnabled !== undefined) state.divergentEnabled = stored.divergentEnabled === true;
  if (stored.structuralColors && stored.structuralColors.length >= 6) {
    const next = DEFAULTS_STRUCTURAL.slice();
    const src = stored.structuralColors.slice(0, 6);
    for (let i = 0; i < src.length; i++) {
      const h = toFullHex(src[i]);
      if (h) next[i] = h;
    }
    state.structuralColors = next;
  }
  if (stored.structuralEnabled !== undefined) state.structuralEnabled = stored.structuralEnabled === true;
  if (stored.divergentNullEnabled !== undefined) {
    state.divergentNullEnabled = Boolean(stored.divergentNullEnabled);
  }
  if (stored.svgHideColourLabels !== undefined) state.svgHideColourLabels = stored.svgHideColourLabels === true;
}

export function loadSavedThemes() {
  try {
    const raw = localStorage.getItem(THEMES_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(t =>
        t &&
        typeof t.name === 'string' &&
        Array.isArray(t.colors) &&
        t.colors.length
      )
      .map(t => ({ ...t, name: clampThemeName(t.name) }));
  } catch {
    return [];
  }
}
export function saveSavedThemes(list) {
  try {
    localStorage.setItem(THEMES_KEY, JSON.stringify(list));
  } catch { }
}

export function resetStateData() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem('colour-palette.v1');
  localStorage.removeItem(THEMES_KEY);
  state.count = 8;
  state.name = '';
  state.colors = DEFAULTS.slice(0, 16);
  state.sentimentColors = DEFAULTS_SENTIMENT.slice();
  state.divergentColors = DEFAULTS_DIVERGENT.slice();
  state.sentimentEnabled = false;
  state.divergentEnabled = false;
  state.structuralColors = DEFAULTS_STRUCTURAL.slice();
  state.structuralEnabled = false;
  state.divergentNullEnabled = true;
  state.svgHideColourLabels = false;
  state.activeSection = 'theme';
  state.activeIndex = 0;
}
