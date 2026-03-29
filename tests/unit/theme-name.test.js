import { describe, it, expect } from 'vitest';
import {
  THEME_NAME_MAX_LENGTH,
  allocateDuplicateThemeName,
  allocateNumberedThemeNameFromBase,
  clampThemeName,
  resolveThemeNameAgainstSavedList
} from '../../js/theme-name.js';

describe('allocateDuplicateThemeName', () => {
  it('uses base without trailing number and starts at 1', () => {
    expect(allocateDuplicateThemeName('My Theme', new Set())).toBe('My Theme 1');
  });

  it('increments when numbered name exists', () => {
    const taken = new Set(['My Theme 1']);
    expect(allocateDuplicateThemeName('My Theme', taken)).toBe('My Theme 2');
  });

  it('strips trailing digits from source to find next free slot', () => {
    const taken = new Set(['My Theme 1', 'My Theme 2']);
    expect(allocateDuplicateThemeName('My Theme 1', taken)).toBe('My Theme 3');
  });

  it('shortens base to fit suffix within max length', () => {
    const long = 'X'.repeat(THEME_NAME_MAX_LENGTH);
    const name = allocateDuplicateThemeName(long, new Set());
    expect(name.length).toBeLessThanOrEqual(THEME_NAME_MAX_LENGTH);
    expect(name.endsWith(' 1')).toBe(true);
    expect(name.length).toBe(THEME_NAME_MAX_LENGTH);
  });

  it('returns null for empty source', () => {
    expect(allocateDuplicateThemeName('', new Set())).toBe(null);
    expect(allocateDuplicateThemeName('   ', new Set())).toBe(null);
  });
});

describe('clampThemeName', () => {
  it('truncates to max length', () => {
    expect(clampThemeName('a'.repeat(100)).length).toBe(THEME_NAME_MAX_LENGTH);
  });
});

describe('resolveThemeNameAgainstSavedList', () => {
  it('returns desired when no other slot uses that name', () => {
    const list = [{ name: 'A' }, { name: 'B' }];
    expect(resolveThemeNameAgainstSavedList('B', list, 1)).toBe('B');
  });

  it('returns desired when only the active slot uses that name', () => {
    const list = [{ name: 'Foo' }, { name: 'Bar' }];
    expect(resolveThemeNameAgainstSavedList('Foo', list, 0)).toBe('Foo');
  });

  it('appends number when another slot owns the name', () => {
    const list = [{ name: 'Foo' }, { name: 'Bar' }];
    expect(resolveThemeNameAgainstSavedList('Bar', list, 0)).toBe('Bar 1');
  });

  it('increments through taken numbered names', () => {
    const list = [{ name: 'A' }, { name: 'Bar' }, { name: 'Bar 1' }];
    expect(resolveThemeNameAgainstSavedList('Bar', list, 0)).toBe('Bar 2');
  });

  it('shortens base to fit max length when resolving conflict', () => {
    const long = 'Y'.repeat(THEME_NAME_MAX_LENGTH);
    const list = [{ name: long }, { name: 'Other' }];
    const resolved = resolveThemeNameAgainstSavedList(long, list, 1);
    expect(resolved.length).toBeLessThanOrEqual(THEME_NAME_MAX_LENGTH);
    expect(/\s+\d+$/.test(resolved)).toBe(true);
  });
});

describe('allocateNumberedThemeNameFromBase', () => {
  it('matches Theme N sequence for new themes', () => {
    expect(allocateNumberedThemeNameFromBase('Theme', new Set())).toBe('Theme 1');
    expect(allocateNumberedThemeNameFromBase('Theme', new Set(['Theme 1']))).toBe('Theme 2');
  });
});
