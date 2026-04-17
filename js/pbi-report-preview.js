import { state, getThemeColorsFromState, getSentimentColorsResolved, getDivergentColorsResolved } from './state.js';
import { getStructuralColorsResolved } from './colour-export.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

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
 * @param {SVGSVGElement} svg
 */
function renderPbiWaterfallSvg(svg) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const W = 260;
  const H = 90;
  const padL = 6;
  const padR = 6;
  const padT = 8;
  const padB = 10;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const baselineY = padT + chartH;
  const maxVal = 52;

  const yAt = v => baselineY - (v / maxVal) * chartH;

  /** @type {{ kind: string, y: number, h: number, fill: string }[]} */
  const bars = [];

  const startVal = 38;
  let cum = startVal;
  bars.push({
    kind: 'total',
    y: yAt(startVal),
    h: baselineY - yAt(startVal),
    fill: 'var(--pbi-sentiment-neutral)'
  });

  const deltas = [
    { dir: 'up', d: 14 },
    { dir: 'down', d: 9 },
    { dir: 'down', d: 7 },
    { dir: 'up', d: 6 }
  ];

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

  const endVal = 42;
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

    if (i < nb - 1) {
      const yLine = yAt(cumAfterBar[i]);
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', String(x + w));
      line.setAttribute('x2', String(padL + (i + 1) * colW + colW * 0.12));
      line.setAttribute('y1', String(yLine));
      line.setAttribute('y2', String(yLine));
      line.setAttribute('stroke', 'var(--pbi-border)');
      line.setAttribute('stroke-width', '1');
      line.setAttribute('stroke-dasharray', '2 2');
      svg.appendChild(line);
    }
  }
}

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
  if (barArea) {
    barArea.replaceChildren();
    for (let i = 0; i < n; i++) {
      const bar = document.createElement('div');
      bar.className = 'pbi-bar';
      const hPct = 36 + ((i * 41 + n * 13) % 50);
      bar.style.setProperty('--h', `${hPct}%`);
      bar.style.setProperty('--bc', `var(--pbi-c${i})`);
      barArea.appendChild(bar);
    }
  }

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
