import { describe, it, expect } from 'vitest';
import {
  buildExportSvgString,
  buildThemeJsonPayloadFromState,
  structuralObjectFromResolved,
  DEFAULTS,
  DEFAULTS_SENTIMENT,
  DEFAULTS_DIVERGENT,
  DEFAULTS_STRUCTURAL,
  mergeStructuralColorsFromThemeJsonObjects,
  STRUCTURAL_KEYS
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
    structuralEnabled: false,
    structuralColors: DEFAULTS_STRUCTURAL.slice(),
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

  it('omits name when empty so exports are not mistaken for named themes on re-import', () => {
    const p = buildThemeJsonPayloadFromState(minimalState({ name: '   ' }));
    expect(p).not.toHaveProperty('name');
  });

  it('omits sentiment and divergent when disabled', () => {
    const p = buildThemeJsonPayloadFromState(minimalState());
    expect(p).not.toHaveProperty('good');
    expect(p).not.toHaveProperty('neutral');
  });

  it('includes Power BI structural keys when structural section is enabled', () => {
    const p = buildThemeJsonPayloadFromState(
      minimalState({
        structuralEnabled: true,
        structuralColors: ['#111111', '#222222', '#333333', '#444444', '#555555', '#666666']
      })
    );
    for (const k of STRUCTURAL_KEYS) {
      expect(p[k]).toMatch(/^#/);
    }
    expect(p.firstLevelElements).toBe('#111111');
    expect(p.secondaryBackground).toBe('#666666');
    expect(p).not.toHaveProperty('tableAccent');
  });

  it('omits structural keys when structural section is disabled', () => {
    const p = buildThemeJsonPayloadFromState(minimalState());
    expect(p).not.toHaveProperty('firstLevelElements');
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

describe('mergeStructuralColorsFromThemeJsonObjects', () => {
  it('maps Fabric-style foreground / background* alias keys to structural slots', () => {
    const fragment = {
      foreground: '#F0F6FC',
      foregroundNeutralSecondary: '#9198A1',
      backgroundLight: '#9198A1',
      foregroundNeutralTertiary: '#9198A1',
      background: '#0E1117',
      backgroundNeutral: '#373D45'
    };
    const { merged, any } = mergeStructuralColorsFromThemeJsonObjects([fragment]);
    expect(any).toBe(true);
    expect(merged[0]).toBe('#F0F6FC');
    expect(merged[1]).toBe('#9198A1');
    expect(merged[2]).toBe('#9198A1');
    expect(merged[3]).toBe('#373D45');
    expect(merged[4]).toBe('#0E1117');
    expect(merged[5]).toBe('#9198A1');
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
    expect(meta.version).toBe(8);
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

  it('embeds structural colours in metadata only when enabled (no extra SVG row)', () => {
    const structural = structuralObjectFromResolved(['#252423', '#605E5C', '#F3F2F1', '#B3B0AD', '#FFFFFF', '#C8C6C4']);
    const svg = buildExportSvgString({
      themeColors: ['#ABCDEF'],
      sentiment: [],
      divergent: [],
      themeName: 'S',
      sentimentEnabled: false,
      divergentEnabled: false,
      structuralEnabled: true,
      structural,
      hideColourLabels: false,
      forPreview: false
    });
    expect(svg).not.toContain('>Structural<');
    const metaMatch = svg.match(/<metadata id="palette-meta">([\s\S]*?)<\/metadata>/);
    expect(metaMatch).toBeTruthy();
    const meta = JSON.parse(metaMatch[1]);
    expect(meta.structural).toEqual(structural);
  });
});
