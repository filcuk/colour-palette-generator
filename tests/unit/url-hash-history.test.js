import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  state,
  saveState,
  updateHashFromState,
  replaceHashFromStateNow,
  enableHashHistoryPush,
  resetStateData
} from '../../js/state.js';

describe('URL hash history', () => {
  const replaceState = vi.fn();
  const pushState = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {}
    });
    resetStateData();
    state.count = 8;
    state.colors[0] = '#111111';
    replaceState.mockClear();
    pushState.mockClear();
    vi.stubGlobal('history', { replaceState, pushState });
    vi.stubGlobal('location', {
      pathname: '/',
      search: '',
      hash: ''
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('replaceHashFromStateNow uses replaceState', () => {
    replaceHashFromStateNow();
    expect(replaceState).toHaveBeenCalledTimes(1);
    expect(pushState).not.toHaveBeenCalled();
  });

  it('updateHashFromState uses replaceState before enableHashHistoryPush', () => {
    updateHashFromState();
    vi.runAllTimers();
    expect(replaceState).toHaveBeenCalled();
    expect(pushState).not.toHaveBeenCalled();
  });

  it('updateHashFromState uses pushState after enableHashHistoryPush when hash changes', () => {
    replaceHashFromStateNow();
    replaceState.mockClear();
    enableHashHistoryPush();
    state.colors[0] = '#222222';
    updateHashFromState();
    vi.runAllTimers();
    expect(pushState).toHaveBeenCalledTimes(1);
    expect(replaceState).not.toHaveBeenCalled();
  });

  it('saveState({ skipHashUpdate: true }) does not schedule hash update', () => {
    enableHashHistoryPush();
    replaceState.mockClear();
    pushState.mockClear();
    saveState({ skipHashUpdate: true });
    vi.runAllTimers();
    expect(pushState).not.toHaveBeenCalled();
    expect(replaceState).not.toHaveBeenCalled();
  });
});
