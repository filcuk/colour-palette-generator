import { state, getThemeColorsFromState } from './state.js';
import { getStructuralColorsResolved } from './colour-export.js';

/**
 * Push current palette + structural colours onto CSS custom properties under `root`
 * so the simulated report visuals track the active theme.
 * @param {HTMLElement | null} root
 */
export function refreshPbiReportPreview(root) {
  if (!root) return;
  const theme = getThemeColorsFromState();
  const s = getStructuralColorsResolved(state);
  const [
    firstLevel,
    secondLevel,
    thirdLevel,
    fourthLevel,
    pageBg,
    secondaryBg,
    tableAccent
  ] = s;

  root.style.setProperty('--pbi-page-bg', pageBg);
  root.style.setProperty('--pbi-card-bg', secondaryBg);
  root.style.setProperty('--pbi-fg', firstLevel);
  root.style.setProperty('--pbi-fg-secondary', secondLevel);
  root.style.setProperty('--pbi-fg-muted', thirdLevel);
  root.style.setProperty('--pbi-border', fourthLevel);
  root.style.setProperty('--pbi-accent', tableAccent);

  const n = Math.max(1, theme.length);
  for (let i = 0; i < 16; i++) {
    root.style.setProperty(`--pbi-c${i}`, theme[i % n] || '#118DFF');
  }
}

/**
 * @param {HTMLElement | null} root
 * @returns {() => void} call to sync once now
 */
export function initPbiReportPreview(root) {
  if (!root) return () => {};
  refreshPbiReportPreview(root);
  return () => refreshPbiReportPreview(root);
}
