import {
  buildExportSvgString,
  buildThemeJsonPayloadFromState,
  DEFAULTS_SENTIMENT,
  DEFAULTS_DIVERGENT
} from './colour-export.js';
import { toFullHex, sanitizeNameForFile } from './colour-math.js';
import { clampThemeName } from './theme-name.js';
import {
  state,
  saveState,
  saveSavedThemes,
  buildExportSvgOptsFromState,
  replaceHashFromStateNow
} from './state.js';
import { savedThemes } from './themes.js';

export function showCopyButtonFeedback(btn, success) {
  if (!btn) return;
  if (success) {
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.textContent = 'Copy';
      btn.classList.remove('copied');
    }, 2000);
  } else {
    btn.textContent = 'Copy failed';
    setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
  }
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function highlightJson(jsonString) {
  let i = 0;
  const len = jsonString.length;
  const out = [];
  function span(cls, text) {
    out.push('<span class="json-' + cls + '">', escapeHtml(text), '</span>');
  }
  while (i < len) {
    const ch = jsonString[i];
    if (ch === '"') {
      let key = false;
      i++;
      let s = '';
      while (i < len) {
        const c = jsonString[i];
        if (c === '\\') { s += jsonString[i] + jsonString[i + 1]; i += 2; continue; }
        if (c === '"') { i++; break; }
        s += c;
        i++;
      }
      let j = i;
      while (j < len && /[\s]/.test(jsonString[j])) j++;
      if (jsonString[j] === ':') key = true;
      out.push('<span class="json-' + (key ? 'key' : 'string') + '">"', escapeHtml(s), '"</span>');
      continue;
    }
    if (/[-0-9]/.test(ch)) {
      let num = '';
      while (i < len && /[-0-9.eE+]/.test(jsonString[i])) num += jsonString[i++];
      span('number', num);
      continue;
    }
    if (ch === 't' && jsonString.slice(i, i + 4) === 'true') {
      span('boolean', 'true');
      i += 4;
      continue;
    }
    if (ch === 'f' && jsonString.slice(i, i + 5) === 'false') {
      span('boolean', 'false');
      i += 5;
      continue;
    }
    if (ch === 'n' && jsonString.slice(i, i + 4) === 'null') {
      span('null', 'null');
      i += 4;
      continue;
    }
    if (/[{}\[\],:]/.test(ch)) {
      span('punctuation', ch);
      i++;
      continue;
    }
    out.push(escapeHtml(ch));
    i++;
  }
  return out.join('');
}

export function parseSvgPalette(text) {
  try {
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    if (!doc || !doc.documentElement || doc.getElementsByTagName('parsererror').length) return null;

    const metaEl = doc.querySelector('metadata#palette-meta');
    if (metaEl && metaEl.textContent) {
      try {
        const meta = JSON.parse(metaEl.textContent.trim());
        if (meta && Array.isArray(meta.colors)) {
          const out = { colors: meta.colors.map(toFullHex).filter(Boolean), name: (meta.name || '').trim() };
          if (Array.isArray(meta.sentimentColors) && meta.sentimentColors.length === 3)
            out.sentimentColors = meta.sentimentColors.map(toFullHex).filter(Boolean).slice(0, 3);
          if (Array.isArray(meta.divergentColors) && meta.divergentColors.length >= 3) {
            const base = DEFAULTS_DIVERGENT.slice();
            for (let i = 0; i < Math.min(4, meta.divergentColors.length); i++) {
              const h = toFullHex(meta.divergentColors[i]);
              if (h) base[i] = h;
            }
            out.divergentColors = base;
          }
          return out;
        }
      } catch { }
    }

    const marked = Array.from(doc.querySelectorAll('rect[data-role="swatch"]'));
    if (marked.length) {
      const arr = marked.map(r => r.getAttribute('data-hex') || r.getAttribute('fill') || '').map(toFullHex).filter(Boolean);
      if (arr.length) {
        const t = (doc.querySelector('svg > title')?.textContent || '').trim();
        return { colors: arr, name: t };
      }
    }

    const rects = Array.from(doc.querySelectorAll('rect[fill]'));
    const rectColors = rects.map(r => (r.getAttribute('fill') || '').trim()).map(toFullHex).filter(c => c && c !== '#FFFFFF');
    if (rectColors.length) {
      const seen = new Set(); const uniq = rectColors.filter(c => (seen.has(c) ? false : (seen.add(c), true)));
      const t = (doc.querySelector('svg > title')?.textContent || '').trim();
      return { colors: uniq, name: t };
    }

    const texts = Array.from(doc.querySelectorAll('text'));
    const fromText = [];
    texts.forEach(t => {
      const s = (t.textContent || ''); const m = s.match(/#[0-9A-Fa-f]{6}\b/g); if (m) fromText.push(...m);
    });
    if (fromText.length) {
      const seen = new Set(); const uniq = fromText.map(toFullHex).filter(Boolean).filter(c => (seen.has(c) ? false : (seen.add(c), true)));
      const t = (doc.querySelector('svg > title')?.textContent || '').trim();
      return { colors: uniq, name: t };
    }

    return null;
  } catch { return null; }
}

export function createImportExport(refs, getUi, themesApi) {
  const {
    downloadBtn,
    importBtn,
    fileInput,
    jsonFileInput,
    dropzone,
    svgCopyBtn,
    svgPreviewEl,
    jsonPreviewEl,
    jsonCopyBtn,
    exportJsonBtn,
    importJsonBtn,
    themeNameEl,
    themeComboList
  } = refs;

  const {
    updateThemeStatus,
    refreshSavedThemesUI,
    buildCurrentThemePayload,
    setThemeDirty,
    setActiveSavedThemeIndex
  } = themesApi;

  function buildThemeJsonPayload() {
    return buildThemeJsonPayloadFromState(state);
  }

  function updateJsonPreview() {
    if (!jsonPreviewEl) return;
    try {
      const payload = buildThemeJsonPayload();
      const raw = JSON.stringify(payload, null, 4);
      jsonPreviewEl.innerHTML = highlightJson(raw);
    } catch {
      jsonPreviewEl.textContent = '';
    }
  }

  function updateSvgPreview() {
    if (!svgPreviewEl) return;
    try {
      svgPreviewEl.innerHTML = buildExportSvgString(buildExportSvgOptsFromState(true));
    } catch {
      svgPreviewEl.innerHTML = '';
    }
  }

  function copySvgFallback(svg, onSuccess, onFail) {
    const ta = document.createElement('textarea');
    ta.value = svg;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
      if (document.execCommand('copy')) {
        onSuccess();
      } else {
        onFail();
      }
    } catch {
      onFail();
    }
    document.body.removeChild(ta);
  }

  async function handleJsonImport(file) {
    if (!file) return;
    const ui = getUi();
    if (!ui) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data || !Array.isArray(data.dataColors) || !data.dataColors.length) {
        alert('Invalid theme JSON: expected an object with a "dataColors" array.');
        return;
      }
      const colors = data.dataColors.map(c => toFullHex(c)).filter(Boolean);
      if (!colors.length) {
        alert('No valid hex colours found in dataColors.');
        return;
      }
      const n = Math.max(1, Math.min(16, colors.length));
      ui.setPaletteFromArray(colors);
      ui.setCount(n);
      state.name = (typeof data.name === 'string' && data.name.trim())
        ? clampThemeName(data.name)
        : '';
      if (themeNameEl) themeNameEl.value = state.name;

      const hasSentiment =
        data.good != null &&
        (data.neutral != null || data.center != null) &&
        data.bad != null;
      if (hasSentiment) {
        state.sentimentEnabled = true;
        const g = toFullHex(data.good);
        const n = toFullHex(data.neutral != null ? data.neutral : data.center);
        const b = toFullHex(data.bad);
        state.sentimentColors = [g || DEFAULTS_SENTIMENT[0], n || DEFAULTS_SENTIMENT[1], b || DEFAULTS_SENTIMENT[2]];
      } else {
        state.sentimentEnabled = false;
      }
      const hasDivergentNew =
        data.maximum != null && data.center != null && data.minimum != null;
      const hasDivergentLegacy =
        data.neutral != null && data.minimum != null && data.maximum != null;
      if (hasDivergentNew) {
        state.divergentEnabled = true;
        const n0 = toFullHex(data.maximum);
        const n1 = toFullHex(data.center);
        const n2 = toFullHex(data.minimum);
        const n3 = toFullHex(data['null']);
        state.divergentNullEnabled = n3 != null;
        state.divergentColors = [
          n0 || DEFAULTS_DIVERGENT[0],
          n1 || DEFAULTS_DIVERGENT[1],
          n2 || DEFAULTS_DIVERGENT[2],
          n3 || DEFAULTS_DIVERGENT[3]
        ];
      } else if (hasDivergentLegacy) {
        state.divergentEnabled = true;
        const o0 = toFullHex(data.neutral);
        const o1 = toFullHex(data.minimum);
        const o2 = toFullHex(data.maximum);
        const o3 = toFullHex(data['null']);
        state.divergentNullEnabled = o3 != null;
        const legacy = [o0, o1, o2, o3].map((h, i) => h || DEFAULTS_DIVERGENT[i]);
        state.divergentColors = [legacy[2], legacy[0], legacy[1], legacy[3]];
      } else {
        state.divergentEnabled = false;
      }
      ui.updateOptionalSectionsVisibility();
      ui.renderSentimentSwatches();
      ui.renderDivergentSwatches();
      saveState();
      replaceHashFromStateNow();
      updateThemeStatus();
      updateJsonPreview();

      const name = (state.name || '').trim();
      if (name && themeComboList) {
        const payload = buildCurrentThemePayload(name);
        if (payload) {
          const existingIndex = savedThemes.findIndex(t => t.name === name);
          if (existingIndex === -1) {
            savedThemes.push(payload);
            saveSavedThemes(savedThemes);
            refreshSavedThemesUI(name);
            setActiveSavedThemeIndex(savedThemes.length - 1);
          } else if (confirm(`A theme named "${name}" already exists. Overwrite with the imported palette?`)) {
            savedThemes[existingIndex] = payload;
            saveSavedThemes(savedThemes);
            refreshSavedThemesUI(name);
            setActiveSavedThemeIndex(existingIndex);
          }
          setThemeDirty(false);
          updateThemeStatus();
        }
      }
    } catch (err) {
      alert('Failed to read or parse the JSON file. ' + (err && err.message ? err.message : ''));
    }
  }

  async function handleSvgImport(file) {
    if (!file) return;
    const ui = getUi();
    if (!ui) return;
    try {
      const text = await file.text();
      const parsed = parseSvgPalette(text);
      if (parsed && parsed.colors && parsed.colors.length) {
        const colors = parsed.colors;
        const n = Math.max(1, Math.min(16, colors.length));
        ui.setPaletteFromArray(colors);
        ui.setCount(n);
        if (typeof parsed.name === 'string' && parsed.name.trim().length) {
          state.name = clampThemeName(parsed.name);
          if (themeNameEl) themeNameEl.value = state.name;
        } else {
          if (themeNameEl) themeNameEl.value = '';
          state.name = '';
        }
        if (Array.isArray(parsed.sentimentColors) && parsed.sentimentColors.length === 3) {
          state.sentimentColors = parsed.sentimentColors.map(toFullHex).filter(Boolean).slice(0, 3);
          if (state.sentimentColors.length < 3) state.sentimentColors = DEFAULTS_SENTIMENT.slice();
          state.sentimentEnabled = true;
        } else {
          state.sentimentEnabled = false;
        }
        if (Array.isArray(parsed.divergentColors) && parsed.divergentColors.length >= 3) {
          const next = DEFAULTS_DIVERGENT.slice();
          for (let i = 0; i < Math.min(4, parsed.divergentColors.length); i++) {
            const h = toFullHex(parsed.divergentColors[i]);
            if (h) next[i] = h;
          }
          state.divergentColors = next;
          state.divergentEnabled = true;
          state.divergentNullEnabled = parsed.divergentColors.length >= 4;
        } else {
          state.divergentEnabled = false;
        }
        ui.renderSentimentSwatches();
        ui.renderDivergentSwatches();
        ui.updateOptionalSectionsVisibility();
        saveState();
        replaceHashFromStateNow();

        const name = (state.name || '').trim();
        if (name && themeComboList) {
          const payload = buildCurrentThemePayload(name);
          if (payload) {
            const existingIndex = savedThemes.findIndex(t => t.name === name);
            if (existingIndex === -1) {
              savedThemes.push(payload);
              saveSavedThemes(savedThemes);
              refreshSavedThemesUI(name);
              setActiveSavedThemeIndex(savedThemes.length - 1);
            } else {
              if (confirm(`A theme named "${name}" already exists. Overwrite with the imported palette?`)) {
                savedThemes[existingIndex] = payload;
                saveSavedThemes(savedThemes);
                refreshSavedThemesUI(name);
                setActiveSavedThemeIndex(existingIndex);
              }
            }
            setThemeDirty(false);
            updateThemeStatus();
          }
        }
      } else {
        alert('Could not find a palette in this SVG. Make sure it was exported by this tool.');
      }
    } catch {
      alert('Failed to read the SVG file.');
    }
  }

  if (jsonCopyBtn) {
    jsonCopyBtn.addEventListener('click', async () => {
      try {
        const payload = buildThemeJsonPayload();
        const raw = JSON.stringify(payload, null, 4);
        await navigator.clipboard.writeText(raw);
        showCopyButtonFeedback(jsonCopyBtn, true);
      } catch {
        showCopyButtonFeedback(jsonCopyBtn, false);
      }
    });
  }
  if (svgCopyBtn) {
    svgCopyBtn.addEventListener('click', () => {
      const svg = buildExportSvgString(buildExportSvgOptsFromState(false));
      const done = () => showCopyButtonFeedback(svgCopyBtn, true);
      const fail = () => showCopyButtonFeedback(svgCopyBtn, false);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(svg).then(done).catch(() => {
          copySvgFallback(svg, done, fail);
        });
      } else {
        copySvgFallback(svg, done, fail);
      }
    });
  }

  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
      const ui = getUi();
      if (!ui) return;
      const inputs = ui.inputs;
      const themeColors = Array.from({ length: state.count }, (_, i) =>
        toFullHex(inputs[i]?.value || state.colors[i] || ''));
      const firstInvalid = themeColors.findIndex(c => !c);
      if (firstInvalid !== -1) {
        if (inputs[firstInvalid]) {
          inputs[firstInvalid].classList.add('invalid');
          inputs[firstInvalid].focus();
        }
        alert('Please fix invalid hex values in theme colours (use #RRGGBB or #RGB).');
        return;
      }
      const themeName = (state.name || '').trim();
      const fileBase = sanitizeNameForFile(themeName) || 'palette';
      const svg = buildExportSvgString({ ...buildExportSvgOptsFromState(false), themeColors });
      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = fileBase + '.svg';
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    });
  }

  if (exportJsonBtn) {
    exportJsonBtn.addEventListener('click', () => {
      const payload = buildThemeJsonPayload();
      const json = JSON.stringify(payload, null, 4);
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (sanitizeNameForFile(state.name) || 'theme') + '.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  }

  if (importJsonBtn && jsonFileInput) {
    importJsonBtn.addEventListener('click', () => jsonFileInput.click());
  }
  if (jsonFileInput) {
    jsonFileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      handleJsonImport(file);
      jsonFileInput.value = '';
    });
  }

  if (importBtn && fileInput) {
    importBtn.addEventListener('click', () => fileInput.click());
  }
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      handleSvgImport(file);
      fileInput.value = '';
    });
  }

  let dragDepth = 0;
  if (dropzone) {
    ['dragenter', 'dragover'].forEach(ev => window.addEventListener(ev, (e) => {
      e.preventDefault(); e.stopPropagation();
      dragDepth++;
      dropzone.classList.add('dragover', 'fullscreen');
    }));
    ['dragleave', 'drop'].forEach(ev => window.addEventListener(ev, (e) => {
      e.preventDefault(); e.stopPropagation();
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) {
        dropzone.classList.remove('dragover', 'fullscreen');
      }
    }));
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
    });
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault(); e.stopPropagation();
      dragDepth = 0;
      dropzone.classList.remove('dragover', 'fullscreen');
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      const name = (file.name || '').toLowerCase();
      const isSvg = file.type === 'image/svg+xml' || name.endsWith('.svg');
      const isJson = file.type === 'application/json' || name.endsWith('.json');
      if (isSvg) {
        handleSvgImport(file);
      } else if (isJson) {
        handleJsonImport(file);
      } else {
        alert('Please drop an SVG or JSON file (exported by this tool for best results).');
      }
    });
  }

  return {
    updateJsonPreview,
    updateSvgPreview,
    handleJsonImport,
    handleSvgImport
  };
}
