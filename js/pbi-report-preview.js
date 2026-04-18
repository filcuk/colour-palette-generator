import { state, getThemeColorsFromState, getSentimentColorsResolved, getDivergentColorsResolved, DEFAULTS_ADVANCED, DEFAULTS_ADVANCED_TRANSPARENCY_PCT } from './state.js';
import { hexToRgbaCss, toFullHex } from './colour-math.js';
import { getStructuralColorsResolved } from './colour-export.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

const PBI_MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Rolling 6-month window ending in the current calendar month (e.g. Jun → "Jan 2026 – Jun 2026"). */
function formatPbiSlicerLast6MonthsLabel() {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), 1);
  const start = new Date(end.getFullYear(), end.getMonth() - 5, 1);
  const fmt = d => `${PBI_MONTH_ABBR[d.getMonth()]} ${d.getFullYear()}`;
  return `${fmt(start)} - ${fmt(end)}`;
}

/**
 * Product names from the preview table’s first column (keeps slicer in sync with the table).
 * @param {HTMLElement} root
 * @returns {string[]}
 */
function collectPbiPreviewProductNames(root) {
  const tbody = root.querySelector('#pbiProductTable tbody');
  if (!tbody) return [];
  return Array.from(tbody.querySelectorAll('tr td:first-child'))
    .map(td => td.textContent.trim())
    .filter(Boolean);
}

/**
 * @param {HTMLElement} root
 */
function renderPbiProductSlicerList(root) {
  const host = root.querySelector('#pbiSlicerProductList');
  if (!host) return;
  const names = collectPbiPreviewProductNames(root);
  host.replaceChildren();
  for (const name of names) {
    const label = document.createElement('label');
    label.className = 'pbi-slicer-check';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = true;
    const span = document.createElement('span');
    span.textContent = name;
    label.append(input, span);
    host.appendChild(label);
  }
}

/** Demo treemap tiles: areas approximate relative weight; one tile uses divergent null. */
const PBI_TREEMAP_CELLS = [
  { label: 'Enterprise', gridColumn: '1 / 8', gridRow: '1 / 8' },
  { label: 'SMB', gridColumn: '8 / 12', gridRow: '1 / 5' },
  { label: 'Public', gridColumn: '12 / 13', gridRow: '1 / 5' },
  { label: 'Retail', gridColumn: '8 / 11', gridRow: '5 / 8' },
  { label: 'Finance', gridColumn: '11 / 13', gridRow: '5 / 8' },
  { label: 'Tech', gridColumn: '1 / 6', gridRow: '8 / 11' },
  { label: 'Central', gridColumn: '6 / 11', gridRow: '8 / 11' },
  { label: 'Other', gridColumn: '11 / 13', gridRow: '8 / 11', null: true }
];

/**
 * @param {string} hex
 * @returns {[number, number, number]}
 */
function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim());
  if (!m) return [128, 128, 128];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * @param {string} a
 * @param {string} b
 * @param {number} t 0..1
 */
function mixHex(a, b, t) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const u = Math.max(0, Math.min(1, t));
  const parts = A.map((c, i) => Math.round(c + (B[i] - c) * u));
  return `#${parts.map(c => c.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

/** @param {number} t in [-1, 1] */
function divergentFillForT(t, maximumHex, centerHex, minimumHex) {
  const k = Math.max(-1, Math.min(1, t));
  if (k >= 0) return mixHex(centerHex, maximumHex, k);
  return mixHex(centerHex, minimumHex, -k);
}

/**
 * @param {string[]} idsSorted
 * @returns {Map<string, number>}
 */
function divergentTByEvenSpread(idsSorted) {
  /** @type {Map<string, number>} */
  const map = new Map();
  const n = idsSorted.length;
  if (n === 0) return map;
  if (n === 1) {
    map.set(idsSorted[0], 0);
    return map;
  }
  for (let i = 0; i < n; i++) {
    map.set(idsSorted[i], -1 + (2 * i) / (n - 1));
  }
  return map;
}

/**
 * @param {HTMLElement} slot
 * @param {{ maximum: string, center: string, minimum: string, nullColor: string }} palette
 */
function renderPbiTreemap(slot, palette) {
  slot.replaceChildren();
  const inner = document.createElement('div');
  inner.className = 'pbi-treemap-inner';

  const dataLabels = PBI_TREEMAP_CELLS.filter(c => !c.null).map(c => c.label);
  const sorted = [...dataLabels].sort((a, b) => a.localeCompare(b));
  const tByLabel = divergentTByEvenSpread(sorted);

  for (const cell of PBI_TREEMAP_CELLS) {
    const el = document.createElement('div');
    el.className = 'pbi-treemap-cell';
    el.style.gridColumn = cell.gridColumn;
    el.style.gridRow = cell.gridRow;
    el.textContent = cell.label;
    const fill = cell.null
      ? palette.nullColor
      : divergentFillForT(tByLabel.get(cell.label) ?? 0, palette.maximum, palette.center, palette.minimum);
    el.style.backgroundColor = fill;
    inner.appendChild(el);
  }

  slot.appendChild(inner);
}

/**
 * Column bar chart with Y grid, axes, category labels, and data labels (structural colours via CSS).
 * @param {HTMLElement} barArea
 * @param {number} n number of bars (theme colour count)
 */
function renderPbiBarAreaSvg(barArea, n) {
  barArea.replaceChildren();
  const nb = Math.max(1, n);
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'pbi-bar-svg');
  svg.setAttribute('viewBox', '0 0 260 112');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.setAttribute('aria-hidden', 'true');

  const W = 260;
  const H = 112;
  const padL = 28;
  const padR = 8;
  const padT = 10;
  const padB = 20;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const baselineY = padT + chartH;
  const yTicks = [0, 25, 50, 75, 100];

  for (const t of yTicks) {
    const y = baselineY - (t / 100) * chartH;
    const g = document.createElementNS(SVG_NS, 'line');
    g.setAttribute('class', 'pbi-chart-grid-line');
    g.setAttribute('x1', String(padL));
    g.setAttribute('x2', String(W - padR));
    g.setAttribute('y1', String(y));
    g.setAttribute('y2', String(y));
    svg.appendChild(g);
  }

  const spine = document.createElementNS(SVG_NS, 'line');
  spine.setAttribute('class', 'pbi-chart-axis-line');
  spine.setAttribute('x1', String(padL));
  spine.setAttribute('x2', String(padL));
  spine.setAttribute('y1', String(padT));
  spine.setAttribute('y2', String(baselineY));
  svg.appendChild(spine);

  const xAxis = document.createElementNS(SVG_NS, 'line');
  xAxis.setAttribute('class', 'pbi-chart-axis-line');
  xAxis.setAttribute('x1', String(padL));
  xAxis.setAttribute('x2', String(W - padR));
  xAxis.setAttribute('y1', String(baselineY));
  xAxis.setAttribute('y2', String(baselineY));
  svg.appendChild(xAxis);

  for (const t of yTicks) {
    const y = baselineY - (t / 100) * chartH;
    const txt = document.createElementNS(SVG_NS, 'text');
    txt.setAttribute('class', 'pbi-chart-axis-label pbi-chart-axis-label--y');
    txt.setAttribute('x', String(padL - 4));
    txt.setAttribute('y', String(y + 3));
    txt.setAttribute('text-anchor', 'end');
    txt.textContent = String(t);
    svg.appendChild(txt);
  }

  const colGap = Math.max(4, 10 - nb);
  const slotW = (chartW - colGap * (nb - 1)) / nb;
  const barW = Math.min(26, slotW * 0.72);

  for (let i = 0; i < nb; i++) {
    const hPct = 36 + ((i * 41 + nb * 13) % 50);
    const barH = (hPct / 100) * chartH;
    const xCenter = padL + i * (slotW + colGap) + slotW / 2;
    const x = xCenter - barW / 2;
    const y = baselineY - barH;
    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('x', String(x));
    rect.setAttribute('y', String(y));
    rect.setAttribute('width', String(barW));
    rect.setAttribute('height', String(Math.max(1, barH)));
    rect.setAttribute('rx', '2');
    rect.setAttribute('fill', `var(--pbi-c${i})`);
    svg.appendChild(rect);

    const lab = document.createElementNS(SVG_NS, 'text');
    lab.setAttribute('class', 'pbi-chart-data-label');
    lab.setAttribute('x', String(xCenter));
    lab.setAttribute('y', String(y - 3));
    lab.setAttribute('text-anchor', 'middle');
    lab.textContent = `${hPct}%`;
    svg.appendChild(lab);

    const cat = document.createElementNS(SVG_NS, 'text');
    cat.setAttribute('class', 'pbi-chart-axis-label');
    cat.setAttribute('x', String(xCenter));
    cat.setAttribute('y', String(baselineY + 12));
    cat.setAttribute('text-anchor', 'middle');
    cat.textContent = `P${i + 1}`;
    svg.appendChild(cat);
  }

  barArea.appendChild(svg);
}

/**
 * @param {SVGSVGElement} svg
 */
function renderPbiWaterfallSvg(svg) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const W = 260;
  const H = 118;
  const padL = 28;
  const padR = 8;
  const padT = 12;
  const padB = 22;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const baselineY = padT + chartH;
  const maxVal = 52;
  const yTicks = [0, 13, 26, 39, 52];

  const yAt = v => baselineY - (v / maxVal) * chartH;

  for (const t of yTicks) {
    const y = yAt(t);
    const gl = document.createElementNS(SVG_NS, 'line');
    gl.setAttribute('class', 'pbi-chart-grid-line');
    gl.setAttribute('x1', String(padL));
    gl.setAttribute('x2', String(W - padR));
    gl.setAttribute('y1', String(y));
    gl.setAttribute('y2', String(y));
    svg.appendChild(gl);
  }

  const spine = document.createElementNS(SVG_NS, 'line');
  spine.setAttribute('class', 'pbi-chart-axis-line');
  spine.setAttribute('x1', String(padL));
  spine.setAttribute('x2', String(padL));
  spine.setAttribute('y1', String(padT));
  spine.setAttribute('y2', String(baselineY));
  svg.appendChild(spine);

  const xAxis = document.createElementNS(SVG_NS, 'line');
  xAxis.setAttribute('class', 'pbi-chart-axis-line');
  xAxis.setAttribute('x1', String(padL));
  xAxis.setAttribute('x2', String(W - padR));
  xAxis.setAttribute('y1', String(baselineY));
  xAxis.setAttribute('y2', String(baselineY));
  svg.appendChild(xAxis);

  for (const t of yTicks) {
    const y = yAt(t);
    const txt = document.createElementNS(SVG_NS, 'text');
    txt.setAttribute('class', 'pbi-chart-axis-label pbi-chart-axis-label--y');
    txt.setAttribute('x', String(padL - 4));
    txt.setAttribute('y', String(y + 3));
    txt.setAttribute('text-anchor', 'end');
    txt.textContent = String(t);
    svg.appendChild(txt);
  }

  /** @type {{ kind: string, y: number, h: number, fill: string }[]} */
  const bars = [];

  const startVal = 32;
  const deltas = [
    { dir: 'up', d: 12 },
    { dir: 'down', d: 21 },
    { dir: 'up', d: 32 },
    { dir: 'down', d: 8 }
  ];

  let cum = startVal;
  bars.push({
    kind: 'total',
    y: yAt(startVal),
    h: baselineY - yAt(startVal),
    fill: 'var(--pbi-sentiment-neutral)'
  });

  for (const { dir, d } of deltas) {
    if (dir === 'up') {
      const bottom = cum;
      cum += d;
      const top = cum;
      bars.push({
        kind: 'up',
        y: yAt(top),
        h: yAt(bottom) - yAt(top),
        fill: 'var(--pbi-sentiment-good)'
      });
    } else {
      const top = cum;
      cum -= d;
      const bottom = cum;
      bars.push({
        kind: 'down',
        y: yAt(top),
        h: yAt(bottom) - yAt(top),
        fill: 'var(--pbi-sentiment-bad)'
      });
    }
  }

  const endVal = cum;
  bars.push({
    kind: 'total',
    y: yAt(endVal),
    h: baselineY - yAt(endVal),
    fill: 'var(--pbi-sentiment-neutral)'
  });

  const cumAfterBar = [startVal];
  let run = startVal;
  for (const { dir, d } of deltas) {
    if (dir === 'up') run += d;
    else run -= d;
    cumAfterBar.push(run);
  }
  cumAfterBar.push(endVal);

  const dataLabelStrs = [String(startVal)];
  for (const { dir, d } of deltas) {
    dataLabelStrs.push(dir === 'up' ? `+${d}` : `-${d}`);
  }
  dataLabelStrs.push(String(endVal));

  const catLabels = ['Opening', 'Sales', 'Costs', 'Returns', 'Adj', 'Closing'];

  const nb = bars.length;
  const colW = chartW / nb;

  for (let i = 0; i < nb; i++) {
    const b = bars[i];
    const x = padL + i * colW + colW * 0.12;
    const w = colW * 0.76;
    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('x', String(x));
    rect.setAttribute('y', String(b.y));
    rect.setAttribute('width', String(w));
    rect.setAttribute('height', String(Math.max(0.5, b.h)));
    rect.setAttribute('rx', '2');
    rect.setAttribute('fill', b.fill);
    svg.appendChild(rect);
  }

  for (let i = 0; i < nb - 1; i++) {
    const b = bars[i];
    const x = padL + i * colW + colW * 0.12;
    const w = colW * 0.76;
    const yLine = yAt(cumAfterBar[i]);
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', String(x + w));
    line.setAttribute('x2', String(padL + (i + 1) * colW + colW * 0.12));
    line.setAttribute('y1', String(yLine));
    line.setAttribute('y2', String(yLine));
    line.setAttribute('class', 'pbi-chart-connector');
    svg.appendChild(line);
  }

  for (let i = 0; i < nb; i++) {
    const x = padL + i * colW + colW * 0.12;
    const w = colW * 0.76;
    const cx = x + w / 2;
    const b = bars[i];
    const labelY = Math.max(padT + 7, b.y - 3);
    const dl = document.createElementNS(SVG_NS, 'text');
    dl.setAttribute('class', 'pbi-chart-data-label');
    dl.setAttribute('x', String(cx));
    dl.setAttribute('y', String(labelY));
    dl.setAttribute('text-anchor', 'middle');
    dl.textContent = dataLabelStrs[i] || '';
    svg.appendChild(dl);

    const cat = document.createElementNS(SVG_NS, 'text');
    cat.setAttribute('class', 'pbi-chart-axis-label');
    cat.setAttribute('x', String(cx));
    cat.setAttribute('y', String(baselineY + 12));
    cat.setAttribute('text-anchor', 'middle');
    cat.textContent = catLabels[i] || '';
    svg.appendChild(cat);
  }
}

/**
 * Push current palette + structural colours onto CSS custom properties under `root`
 * so the simulated report visuals track the active theme.
 * @param {HTMLElement | null} root
 */
export function refreshPbiReportPreview(root) {
  if (!root) return;
  const dateSlicer = root.querySelector('#pbiSlicerDateRange');
  if (dateSlicer) dateSlicer.textContent = formatPbiSlicerLast6MonthsLabel();
  renderPbiProductSlicerList(root);

  const theme = getThemeColorsFromState();
  const s = getStructuralColorsResolved(state);
  const [firstLevel, secondLevel, thirdLevel, fourthLevel, pageBg, secondaryBg] = s;

  if (state.advancedEnabled) {
    const ac = (state.advancedColors || DEFAULTS_ADVANCED).slice(0, 3);
    const at = (state.advancedTransparencyPct || DEFAULTS_ADVANCED_TRANSPARENCY_PCT).slice(0, 2);
    const pageHex = toFullHex(ac[0]) || DEFAULTS_ADVANCED[0];
    const visHex = toFullHex(ac[1]) || DEFAULTS_ADVANCED[1];
    const titleHex = toFullHex(ac[2]) || DEFAULTS_ADVANCED[2];
    const pageT = Math.max(0, Math.min(100, Number(at[0]) || 0));
    const visT = Math.max(0, Math.min(100, Number(at[1]) || 0));
    root.style.setProperty('--pbi-page-bg', hexToRgbaCss(pageHex, 1 - pageT / 100));
    root.style.setProperty('--pbi-card-bg', hexToRgbaCss(visHex, 1 - visT / 100));
    root.style.setProperty('--pbi-title-text', titleHex);
  } else {
    root.style.removeProperty('--pbi-title-text');
    root.style.setProperty('--pbi-page-bg', pageBg);
    root.style.setProperty('--pbi-card-bg', pageBg);
  }
  root.style.setProperty('--pbi-fg', firstLevel);
  root.style.setProperty('--pbi-fg-secondary', secondLevel);
  root.style.setProperty('--pbi-fg-muted', thirdLevel);
  root.style.setProperty('--pbi-border', fourthLevel);
  root.style.setProperty('--pbi-accent', theme[0] || '#118DFF');
  /* Chart chrome vs structural keys (MS Learn: thirdLevel≈gridlines, fourth≈axis/frame, second≈axis labels, first≈data labels) */
  root.style.setProperty('--pbi-struct-grid', thirdLevel);
  root.style.setProperty('--pbi-struct-axis', fourthLevel);
  root.style.setProperty('--pbi-struct-axis-label', secondLevel);
  root.style.setProperty('--pbi-struct-data-label', firstLevel);

  const [sentGood, sentNeutral, sentBad] = getSentimentColorsResolved();
  root.style.setProperty('--pbi-sentiment-good', sentGood);
  root.style.setProperty('--pbi-sentiment-neutral', sentNeutral);
  root.style.setProperty('--pbi-sentiment-bad', sentBad);

  const wfSvg = root.querySelector('#pbiWaterfallSvg');
  if (wfSvg instanceof SVGSVGElement) renderPbiWaterfallSvg(wfSvg);

  const n = Math.max(1, theme.length);
  for (let i = 0; i < 16; i++) {
    root.style.setProperty(`--pbi-c${i}`, theme[i % n] || '#118DFF');
  }

  const barArea = root.querySelector('#pbiBarArea');
  if (barArea) renderPbiBarAreaSvg(barArea, n);

  const divColors = getDivergentColorsResolved();
  const nullDivergent = divColors.length >= 4 ? divColors[3] : secondaryBg;
  const treemapSlot = root.querySelector('#pbiTreemapSlot');
  if (treemapSlot instanceof HTMLElement) {
    renderPbiTreemap(treemapSlot, {
      maximum: divColors[0],
      center: divColors[1],
      minimum: divColors[2],
      nullColor: nullDivergent
    });
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
