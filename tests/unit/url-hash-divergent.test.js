import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  hashPayloadToStoredShape,
  encodeHashPayload,
  decodeHashPayload,
  mergeStoredIntoState,
  resetStateData,
  state
} from '../../js/state.js';
import { DEFAULTS_DIVERGENT, DEFAULTS_STRUCTURAL } from '../../js/colour-export.js';

/** mcmn hex strings without #, length 6 */
const MCMN_DV = DEFAULTS_DIVERGENT.map(c => c.replace(/^#/, '').toUpperCase());

describe('URL hash divergent colours', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });
    resetStateData();
  });

  it('does not migrate when dvV is missing (mcmn in dv)', () => {
    const p = {
      n: 'Shared',
      c: 8,
      d: Array.from({ length: 16 }, (_, i) => '112233'),
      de: true,
      dv: MCMN_DV.slice()
    };
    const s = hashPayloadToStoredShape(p);
    expect(s.divergentEnabled).toBe(true);
    expect(s.divergentColors.map(c => c.toUpperCase())).toEqual(DEFAULTS_DIVERGENT.map(c => c.toUpperCase()));
  });

  it('does not migrate when dvV is 2', () => {
    const p = {
      n: 'Shared',
      c: 8,
      d: Array.from({ length: 16 }, (_, i) => '112233'),
      de: true,
      dv: MCMN_DV.slice(),
      dvV: 2
    };
    const s = hashPayloadToStoredShape(p);
    expect(s.divergentColors.map(c => c.toUpperCase())).toEqual(DEFAULTS_DIVERGENT.map(c => c.toUpperCase()));
  });

  it('migrates only when dvV === 1 (legacy physical order in dv)', () => {
    const legacyDv = [MCMN_DV[1], MCMN_DV[2], MCMN_DV[0], MCMN_DV[3]];
    const p = {
      n: 'Legacy',
      c: 8,
      d: Array.from({ length: 16 }, (_, i) => '112233'),
      de: true,
      dv: legacyDv,
      dvV: 1
    };
    const s = hashPayloadToStoredShape(p);
    expect(s.divergentColors.map(c => c.toUpperCase())).toEqual(DEFAULTS_DIVERGENT.map(c => c.toUpperCase()));
  });

  it('round-trips divergent null flag through encode/decode', () => {
    const payloadOff = {
      n: 'x',
      c: 8,
      d: Array.from({ length: 16 }, (_, i) => '112233'),
      de: true,
      dv: MCMN_DV.slice(),
      dvV: 2,
      dn: false
    };
    const raw = encodeHashPayload(payloadOff);
    const decoded = decodeHashPayload(raw);
    const s = hashPayloadToStoredShape(decoded);
    expect(s.divergentNullEnabled).toBe(false);

    const payloadOn = { ...payloadOff, dn: true };
    const sOn = hashPayloadToStoredShape(decodeHashPayload(encodeHashPayload(payloadOn)));
    expect(sOn.divergentNullEnabled).toBe(true);
  });

  it('mergeStoredIntoState applies divergentNullEnabled false from hash shape', () => {
    mergeStoredIntoState({
      count: 8,
      name: '',
      colors: ['#111111'],
      sentimentColors: state.sentimentColors.slice(),
      divergentColors: DEFAULTS_DIVERGENT.slice(),
      sentimentEnabled: false,
      divergentEnabled: true,
      divergentNullEnabled: false
    });
    expect(state.divergentNullEnabled).toBe(false);
  });

  it('round-trips structural colours when ste is set', () => {
    const stc = DEFAULTS_STRUCTURAL.map(c => c.replace(/^#/, '').toUpperCase());
    const p = {
      n: 'x',
      c: 8,
      d: Array.from({ length: 16 }, (_, i) => '112233'),
      ste: true,
      stc
    };
    const s = hashPayloadToStoredShape(decodeHashPayload(encodeHashPayload(p)));
    expect(s.structuralEnabled).toBe(true);
    expect(s.structuralColors.map(c => c.toUpperCase())).toEqual(
      DEFAULTS_STRUCTURAL.map(c => c.toUpperCase())
    );
  });
});
