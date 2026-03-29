import { describe, it, expect } from 'vitest';
import {
  buildExportSvgString,
  buildThemeJsonPayloadFromState,
  DEFAULTS,
  DEFAULTS_SENTIMENT,
  DEFAULTS_DIVERGENT
} from '../../js/colour-export.js';

function minimalState(overrides = {}) {
  return {
    count: 3,
    name: 'Test',
    colors: DEFAULTS.slice(0, 16),
    sentimentColors: DEFAULTS_SENTIMENT.slice(),
    divergentColors: DEFAULTS_DIVERGENT.slice(),
    sentimentEnabled: false,
    divergentEnabled: false,
    ...overrides
  };
}

describe('buildThemeJsonPayloadFromState', () => {
  it('returns name, dataColors, and optional sentiment / divergent keys', () => {
    const s = minimalState({
      name: '  My theme  ',
      count: 2,
      colors: ['#111111', '#222222', ...DEFAULTS.slice(2)],
      sentimentEnabled: true,
      divergentEnabled: true
    });
    const p = buildThemeJsonPayloadFromState(s);
    expect(p.name).toBe('My theme');
    expect(p.dataColors).toHaveLength(2);
    expect(p.dataColors[0]).toBe('#111111');
    expect(p.good).toBeDefined();
    expect(p.neutral).toBeDefined();
    expect(p.bad).toBeDefined();
    expect(p.maximum).toBeDefined();
    expect(p.center).toBeDefined();
    expect(p.minimum).toBeDefined();
    expect(p['null']).toBeDefined();
  });

  it('uses default name when empty', () => {
    const p = buildThemeJsonPayloadFromState(minimalState({ name: '   ' }));
    expect(p.name).toBe('Custom');
  });

  it('omits sentiment and divergent when disabled', () => {
    const p = buildThemeJsonPayloadFromState(minimalState());
    expect(p).not.toHaveProperty('good');
    expect(p).not.toHaveProperty('neutral');
  });

  it('omits null key when divergent null is disabled', () => {
    const p = buildThemeJsonPayloadFromState(
      minimalState({ divergentEnabled: true, divergentNullEnabled: false })
    );
    expect(p.maximum).toBeDefined();
    expect(p.center).toBeDefined();
    expect(p.minimum).toBeDefined();
    expect(p).not.toHaveProperty('null');
  });
});

describe('buildExportSvgString', () => {
  it('outputs valid svg root and embedded metadata', () => {
    const themeColors = ['#FF0000', '#00FF00', '#0000FF'];
    const svg = buildExportSvgString({
      themeColors,
      sentiment: DEFAULTS_SENTIMENT,
      divergent: DEFAULTS_DIVERGENT,
      themeName: 'Unit',
      sentimentEnabled: false,
      divergentEnabled: false,
      hideColourLabels: false,
      forPreview: false
    });
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    expect(svg).toContain('width="');
    expect(svg).toContain('<metadata id="palette-meta">');
    const metaMatch = svg.match(/<metadata id="palette-meta">([\s\S]*?)<\/metadata>/);
    expect(metaMatch).toBeTruthy();
    const meta = JSON.parse(metaMatch[1]);
    expect(meta.app).toBe('colour-palette');
    expect(meta.version).toBe(7);
    expect(meta.colors).toEqual(themeColors);
    expect(meta.name).toBe('Unit');
  });

  it('includes preview style when forPreview is true', () => {
    const svg = buildExportSvgString({
      themeColors: ['#112233'],
      sentiment: [],
      divergent: [],
      themeName: '',
      sentimentEnabled: false,
      divergentEnabled: false,
      forPreview: true
    });
    expect(svg).toContain('style="max-width:100%;height:auto"');
  });

  it('omits swatch hex labels when hideColourLabels is true', () => {
    const svg = buildExportSvgString({
      themeColors: ['#ABCDEF'],
      sentiment: [],
      divergent: [],
      themeName: 'x',
      sentimentEnabled: false,
      divergentEnabled: false,
      hideColourLabels: true,
      forPreview: false
    });
    expect(svg).not.toContain('data-role="label"');
  });

  it('adds sentiment and divergent rows when enabled', () => {
    const svg = buildExportSvgString({
      themeColors: ['#111111', '#222222'],
      sentiment: DEFAULTS_SENTIMENT,
      divergent: DEFAULTS_DIVERGENT,
      themeName: 'Full',
      sentimentEnabled: true,
      divergentEnabled: true,
      hideColourLabels: false,
      forPreview: false
    });
    expect(svg).toContain('>Sentiment<');
    expect(svg).toContain('>Divergent<');
    expect(svg).toContain('sentiment-gradient');
    expect(svg).toContain('divergent-gradient');
  });

  it('divergent row without fourth null swatch when only three colours passed', () => {
    const three = DEFAULTS_DIVERGENT.slice(0, 3);
    const svg = buildExportSvgString({
      themeColors: ['#111111'],
      sentiment: [],
      divergent: three,
      themeName: 'Div3',
      sentimentEnabled: false,
      divergentEnabled: true,
      hideColourLabels: false,
      forPreview: false
    });
    const metaMatch = svg.match(/<metadata id="palette-meta">([\s\S]*?)<\/metadata>/);
    expect(metaMatch).toBeTruthy();
    const meta = JSON.parse(metaMatch[1]);
    expect(meta.divergentColors).toHaveLength(3);
  });
});
