import { toFullHex } from './colour-math.js';
import { clampThemeName } from './theme-name.js';
import {
  DEFAULTS,
  DEFAULTS_SENTIMENT,
  DEFAULTS_DIVERGENT
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
  return (state.divergentColors || DEFAULTS_DIVERGENT).slice(0, 3).map((c, i) =>
    toFullHex(c) || toFullHex(DEFAULTS_DIVERGENT[i]) || '#000000');
}
export function buildExportSvgOptsFromState(forPreview) {
  return {
    themeColors: getThemeColorsFromState(),
    sentiment: getSentimentColorsResolved(),
    divergent: getDivergentColorsResolved(),
    themeName: state.name,
    sentimentEnabled: state.sentimentEnabled,
    divergentEnabled: state.divergentEnabled,
    hideColourLabels: !!state.svgHideColourLabels,
    forPreview
  };
}

let afterSaveStateHook = () => {};
export function setAfterSaveStateHook(fn) {
  afterSaveStateHook = typeof fn === 'function' ? fn : () => {};
}

export function saveState() {
  try {
    const themeColors = getThemeColorsFromState();
    const sentiment = (state.sentimentColors || []).map(toFullHex).filter(Boolean).slice(0, 3);
    const divergent = (state.divergentColors || []).map(toFullHex).filter(Boolean).slice(0, 3);
    const payload = {
      count: state.count,
      name: state.name || '',
      colors: themeColors,
      sentimentColors: sentiment.length === 3 ? sentiment : DEFAULTS_SENTIMENT.slice(),
      divergentColors: divergent.length === 3 ? divergent : DEFAULTS_DIVERGENT.slice(),
      sentimentEnabled: !!state.sentimentEnabled,
      divergentEnabled: !!state.divergentEnabled,
      svgHideColourLabels: !!state.svgHideColourLabels
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch { }
  updateHashFromState();
  afterSaveStateHook();
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
    const divergentColors = Array.isArray(data.divergentColors) && data.divergentColors.length === 3
      ? data.divergentColors.map(toFullHex).filter(Boolean).slice(0, 3)
      : DEFAULTS_DIVERGENT.slice();
    return {
      count,
      name: (data.name || '').toString(),
      colors,
      sentimentColors,
      divergentColors,
      sentimentEnabled: data.sentimentEnabled === true,
      divergentEnabled: data.divergentEnabled === true,
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
    payload.dv = (state.divergentColors || DEFAULTS_DIVERGENT).slice(0, 3).map(c => (toFullHex(c) || '').slice(1) || '000000');
    payload.de = true;
  }
  return payload;
}
function hashPayloadToStoredShape(p) {
  if (!p || !Array.isArray(p.d) || !p.d.length) return null;
  const count = Math.max(1, Math.min(16, parseInt(p.c, 10) || 8));
  const colors = p.d.slice(0, 16).map(x => typeof x === 'string' && x.length >= 6 ? '#' + x.replace(/^#/, '').slice(0, 6) : null).filter(Boolean);
  if (!colors.length) return null;
  const sentimentColors = Array.isArray(p.s) && p.s.length === 3
    ? p.s.map(x => typeof x === 'string' && x.length >= 6 ? '#' + x.replace(/^#/, '').slice(0, 6) : null).filter(Boolean)
    : DEFAULTS_SENTIMENT.slice();
  const divergentColors = Array.isArray(p.dv) && p.dv.length === 3
    ? p.dv.map(x => typeof x === 'string' && x.length >= 6 ? '#' + x.replace(/^#/, '').slice(0, 6) : null).filter(Boolean)
    : DEFAULTS_DIVERGENT.slice();
  return {
    count,
    name: clampThemeName(p.n != null ? String(p.n) : ''),
    colors: colors.length ? colors : [DEFAULTS[0]],
    sentimentColors: sentimentColors.length === 3 ? sentimentColors : DEFAULTS_SENTIMENT.slice(),
    divergentColors: divergentColors.length === 3 ? divergentColors : DEFAULTS_DIVERGENT.slice(),
    sentimentEnabled: p.se === true,
    divergentEnabled: p.de === true
  };
}
function encodeHashPayload(payload) {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decodeHashPayload(hashStr) {
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
export function updateHashFromState() {
  if (hashUpdateTimer) clearTimeout(hashUpdateTimer);
  hashUpdateTimer = setTimeout(() => {
    hashUpdateTimer = null;
    try {
      const payload = stateToHashPayload();
      const encoded = encodeHashPayload(payload);
      const url = location.pathname + location.search + '#' + encoded;
      if (location.hash !== '#' + encoded) history.replaceState(null, '', url);
    } catch { }
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
  if (stored.divergentColors && stored.divergentColors.length === 3)
    state.divergentColors = stored.divergentColors.slice();
  if (stored.sentimentEnabled !== undefined) state.sentimentEnabled = stored.sentimentEnabled === true;
  if (stored.divergentEnabled !== undefined) state.divergentEnabled = stored.divergentEnabled === true;
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
  state.svgHideColourLabels = false;
  state.activeSection = 'theme';
  state.activeIndex = 0;
}
