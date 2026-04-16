/**
 * Theme JSON + SVG export (shared by the app and unit tests).
 * Keep behaviour aligned with the app UI.
 */
export const DEFAULTS = [
  // First 8: user-provided theme defaults
  '#E74C3C', '#A061BA', '#2980B9', '#16A085', '#F1C40F', '#E67E22', '#927064', '#607D8B',
  // Last 8: hue-complementary (HSV hue rotated by 180°), generated from the first 8 above
  '#3CD7E7', '#7BBA61', '#B96229', '#A01631', '#0F3CF1', '#228AE6', '#648692', '#8B6E60'
];
/** State order + JSON keys: good, neutral, bad */
export const DEFAULTS_SENTIMENT = ['#E53935', '#757575', '#43A047'];
/** State order + JSON keys: maximum, center, minimum, "null" */
export const DEFAULTS_DIVERGENT = ['#B2182B', '#F7F7F7', '#2166AC', '#757575'];

/** Power BI theme keys, same order as {@link DEFAULTS_STRUCTURAL}. */
export const STRUCTURAL_KEYS = [
  'firstLevelElements',
  'secondLevelElements',
  'thirdLevelElements',
  'fourthLevelElements',
  'background',
  'secondaryBackground',
  'tableAccent'
];
export const DEFAULTS_STRUCTURAL = [
  '#252423', '#605E5C', '#F3F2F1', '#B3B0AD', '#FFFFFF', '#C8C6C4', '#118DFF'
];

const clampHex = s => s.replace(/[^0-9a-f]/gi, '').slice(0, 6).toUpperCase();
function toFullHex(raw) {
  if (!raw) return null;
  let h = clampHex(raw.startsWith('#') ? raw.slice(1) : raw);
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (h.length !== 6) return null;
  return '#' + h;
}

function hexToRgb(hex) {
  const h = hex.slice(1);
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}
function srgbToLinear(c) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
function relLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}
function contrastRatio(fgHex, bgHex) {
  const L1 = relLuminance(fgHex), L2 = relLuminance(bgHex);
  const lighter = Math.max(L1, L2), darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}
function autoTextOn(hexBg) {
  const { r, g, b } = hexToRgb(hexBg);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 150 ? '#111111' : '#FFFFFF';
}

function getThemeColorsFromState(s) {
  return Array.from({ length: s.count }, (_, i) =>
    toFullHex(s.colors[i]) || toFullHex(DEFAULTS[i]) || '#000000');
}
function getSentimentColorsResolved(s) {
  return (s.sentimentColors || DEFAULTS_SENTIMENT).slice(0, 3).map((c, i) =>
    toFullHex(c) || toFullHex(DEFAULTS_SENTIMENT[i]) || '#000000');
}
function getDivergentColorsResolved(s) {
  return (s.divergentColors || DEFAULTS_DIVERGENT).slice(0, 4).map((c, i) =>
    toFullHex(c) || toFullHex(DEFAULTS_DIVERGENT[i]) || '#000000');
}
export function getStructuralColorsResolved(s) {
  return STRUCTURAL_KEYS.map((_, i) =>
    toFullHex((s.structuralColors || DEFAULTS_STRUCTURAL)[i]) ||
    toFullHex(DEFAULTS_STRUCTURAL[i]) ||
    '#000000');
}
/** Plain object keyed like Power BI theme JSON (for SVG metadata). */
export function structuralObjectFromResolved(arr) {
  const o = {};
  STRUCTURAL_KEYS.forEach((k, i) => {
    o[k] = arr[i];
  });
  return o;
}

/**
 * Alternate property names seen in Power BI / Fabric theme JSON (vs classic
 * `firstLevelElements` … names). Each row lists extra keys for the same index as {@link STRUCTURAL_KEYS}.
 */
export const STRUCTURAL_IMPORT_ALIAS_KEYS = [
  ['foreground'],
  ['foregroundNeutralSecondary'],
  ['foregroundNeutralTertiary'],
  ['backgroundNeutral'],
  ['background'],
  ['backgroundLight'],
  ['tableAccent', 'accent']
];

/**
 * Read structural colours from one or more theme JSON objects (root, nested `structural`, first `themes[]` entry, etc.).
 * @param {Array<Record<string, unknown>|null|undefined>} sources
 * @returns {{ merged: string[], any: boolean }}
 */
export function mergeStructuralColorsFromThemeJsonObjects(sources) {
  const merged = DEFAULTS_STRUCTURAL.slice();
  let any = false;
  const list = (sources || []).filter(s => s && typeof s === 'object' && !Array.isArray(s));

  for (let i = 0; i < STRUCTURAL_KEYS.length; i++) {
    const keysToTry = [STRUCTURAL_KEYS[i], ...(STRUCTURAL_IMPORT_ALIAS_KEYS[i] || [])];
    let found = null;
    outer: for (const keyName of keysToTry) {
      for (let j = 0; j < list.length; j++) {
        const raw = list[j][keyName];
        if (raw == null || raw === '') continue;
        const h = toFullHex(raw);
        if (h) {
          found = h;
          break outer;
        }
      }
    }
    if (found) {
      merged[i] = found;
      any = true;
    }
  }
  return { merged, any };
}

export function buildThemeJsonPayloadFromState(s) {
  const nm = (s.name || '').trim();
  const dataColors = getThemeColorsFromState(s);
  const payload = nm ? { name: nm, dataColors } : { dataColors };
  if (s.sentimentEnabled) {
    const sentiment = getSentimentColorsResolved(s);
    payload.good = sentiment[0];
    payload.neutral = sentiment[1];
    payload.bad = sentiment[2];
  }
  if (s.divergentEnabled) {
    const divergent = getDivergentColorsResolved(s);
    payload.maximum = divergent[0];
    payload.center = divergent[1];
    payload.minimum = divergent[2];
    if (s.divergentNullEnabled !== false) payload['null'] = divergent[3];
  }
  if (s.structuralEnabled) {
    const structural = getStructuralColorsResolved(s);
    STRUCTURAL_KEYS.forEach((k, i) => {
      payload[k] = structural[i];
    });
  }
  return payload;
}

export function buildExportSvgString(opts) {
  const {
    themeColors,
    sentiment,
    divergent,
    themeName,
    sentimentEnabled,
    divergentEnabled,
    structuralEnabled = false,
    structural = null,
    hideColourLabels = false,
    forPreview = false
  } = opts;
  const safeTitle = (themeName || '').trim() || 'Color Palette';
  const count = themeColors.length;
  const sw = 80, sh = 40, gap = 8, rowGap = 8, pad = 8;
  const rowLabelWidth = 80;
  const hasSentiment = sentimentEnabled && sentiment.length === 3;
  const hasDivergent = divergentEnabled && divergent.length >= 3;
  const hasDivergentNullSwatch = hasDivergent && divergent.length === 4;
  const numRows = 1 + (hasSentiment ? 1 : 0) + (hasDivergent ? 1 : 0);
  const col2StartX = pad + rowLabelWidth + gap;
  const gradientWidth = 2 * sw + gap;
  const gradientX = col2StartX + 3 * (sw + gap);
  const themeRowWidth = 2 * pad + count * sw + (count - 1) * gap;
  const baseOptionalRowWidth = 2 * pad + rowLabelWidth + gap + 3 * (sw + gap) + gap + gradientWidth;
  const optionalRowWidth = baseOptionalRowWidth + (hasDivergentNullSwatch ? gap + sw : 0);
  let width = themeRowWidth;
  if (hasSentiment || hasDivergent) {
    width = Math.max(themeRowWidth, optionalRowWidth);
  }
  const height = pad * 2 + numRows * sh + (numRows - 1) * rowGap;

  function rowLabel(text, startY) {
    return `
  <text x="${pad}" y="${startY + sh / 2 + 2}" text-anchor="start" dominant-baseline="middle" font-size="17" fill="#555" font-family="sans-serif">${text}</text>`;
  }

  function swatchNodes(colors, startY, rolePrefix, startX, indexOffset = 0) {
    const baseX = startX !== undefined ? startX : col2StartX;
    let out = '';
    colors.forEach((hex, i) => {
      const idx = indexOffset + i;
      const x = baseX + i * (sw + gap);
      const txtColor = autoTextOn(hex);
      const rBlack = contrastRatio('#000000', hex).toFixed(2);
      const rWhite = contrastRatio('#FFFFFF', hex).toFixed(2);
      const passB = parseFloat(rBlack) >= 4.5;
      const passW = parseFloat(rWhite) >= 4.5;
      const labelEl = hideColourLabels ? '' : `
            <text x="${x + sw / 2}" y="${startY + sh / 2 + 5}" text-anchor="middle"
              font-family="monospace" font-size="16" fill="${txtColor}"
              data-role="label">${hex}</text>`;
      out += `
          <g data-index="${idx}" data-role="${rolePrefix}">
            <rect x="${x}" y="${startY}" width="${sw}" height="${sh}" rx="10"
              fill="${hex}" stroke="rgba(0,0,0,0.15)"
              data-role="swatch" data-hex="${hex}"/>${labelEl}
            <title>Swatch ${idx + 1}: ${hex} — Contrast vs Black ${rBlack}:1 (${passB ? 'PASS' : 'FAIL'}), vs White ${rWhite}:1 (${passW ? 'PASS' : 'FAIL'})</title>
          </g>`;
    });
    return out;
  }

  function gradientBox(colors, startY, gradientId) {
    if (!colors || colors.length < 3) return '';
    const n = colors.length;
    const stops = colors
      .map((hex, i) => {
        const offset = n <= 1 ? 0 : i / (n - 1);
        return `<stop offset="${offset}" stop-color="${hex}"/>`;
      })
      .join('\n    ');
    return `
  <defs>
    <linearGradient id="${gradientId}" x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
      ${stops}
    </linearGradient>
  </defs>
  <rect x="${gradientX}" y="${startY}" width="${gradientWidth}" height="${sh}" rx="10" fill="url(#${gradientId})" stroke="rgba(0,0,0,0.15)"/>`;
  }

  let nodes = swatchNodes(themeColors, pad, 'theme', pad);
  let rowIndex = 1;
  if (hasSentiment) {
    const sentimentY = pad + rowIndex * (sh + rowGap);
    nodes += rowLabel('Sentiment', sentimentY);
    nodes += swatchNodes(sentiment, sentimentY, 'sentiment', col2StartX);
    nodes += gradientBox(sentiment, sentimentY, 'sentiment-gradient');
    rowIndex++;
  }
  if (hasDivergent) {
    const divergentY = pad + rowIndex * (sh + rowGap);
    const divGradient = divergent.slice(0, 3);
    nodes += rowLabel('Divergent', divergentY);
    nodes += swatchNodes(divGradient, divergentY, 'divergent', col2StartX);
    nodes += gradientBox(divGradient, divergentY, 'divergent-gradient');
    if (hasDivergentNullSwatch) {
      const nullHex = divergent[3];
      const nullSwatchX = gradientX + gradientWidth + gap;
      nodes += swatchNodes([nullHex], divergentY, 'divergent', nullSwatchX, 3);
    }
  }

  const hasStructuralMeta = structuralEnabled && structural && typeof structural === 'object';
  const meta = {
    app: 'colour-palette',
    version: 8,
    name: (themeName || '').trim(),
    count,
    colors: themeColors,
    ...(sentimentEnabled && sentiment.length === 3 ? { sentimentColors: sentiment } : {}),
    ...(divergentEnabled && divergent.length >= 3 ? { divergentColors: divergent } : {}),
    ...(hasStructuralMeta ? { structural } : {})
  };
  const svgStyle = forPreview ? ' style="max-width:100%;height:auto"' : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${safeTitle}"${svgStyle}>
  <title>${safeTitle}</title>
  <desc>Theme: ${safeTitle}. Palette exported with ${count} theme swatch(es)${hasSentiment ? ', sentiment row' : ''}${hasDivergent ? ', divergent row' : ''}${hasStructuralMeta ? ', structural colours in metadata only' : ''}. Metadata included for re-import.</desc>
  <metadata id="palette-meta">${JSON.stringify(meta)}</metadata>
  ${nodes}
</svg>`;
}
