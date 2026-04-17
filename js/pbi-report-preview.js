import { state, getThemeColorsFromState, getSentimentColorsResolved, getDivergentColorsResolved } from './state.js';
import { getStructuralColorsResolved } from './colour-export.js';
import { renderUkPostcodeAreaMap } from './uk-postcode-map.js';

let ukPostcodeTopologyPromise;

function ensureUkPostcodeTopology() {
  if (!ukPostcodeTopologyPromise) {
    ukPostcodeTopologyPromise = fetch(new URL('../data/uk-postcode-area.json', import.meta.url))
      .then(r => (r.ok ? r.text() : null))
      .then(text => {
        if (text == null) return null;
        const i = text.indexOf('{');
        if (i < 0) return null;
        try {
          return JSON.parse(text.slice(i));
        } catch {
          return null;
        }
      })
      .catch(() => null);
  }
  return ukPostcodeTopologyPromise;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

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
  ensureUkPostcodeTopology().then(topology => {
    if (!topology || !root.isConnected) return;
    const mapSvg = root.querySelector('#pbiUkMapSvg');
    if (!(mapSvg instanceof SVGSVGElement)) return;
    renderUkPostcodeAreaMap(mapSvg, topology, {
      maximum: divColors[0],
      center: divColors[1],
      minimum: divColors[2],
      nullColor: nullDivergent,
      stroke: fourthLevel,
      strokeWidth: 0.32
    });
  });
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
