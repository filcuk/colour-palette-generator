// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTwiceConfirmPair } from '../../js/twice-confirm.js';

function setupDom() {
  document.body.innerHTML = `
    <div id="dangerConfirmBackdrop" class="danger-confirm-backdrop" aria-hidden="true"></div>
    <button type="button" id="resetBtn">Reset</button>
    <button type="button" id="deleteThemeBtn">Delete</button>
  `;
}

describe('createTwiceConfirmPair', () => {
  beforeEach(() => {
    setupDom();
    document.body.className = '';
  });

  it('shows dimming backdrop and highlights armed button until click outside', () => {
    const resetBtn = document.getElementById('resetBtn');
    const deleteBtn = document.getElementById('deleteThemeBtn');
    const bd = document.getElementById('dangerConfirmBackdrop');
    const onReset = vi.fn();
    const onDelete = vi.fn();
    createTwiceConfirmPair({ resetBtn, deleteBtn, onReset, onDelete, onArm: vi.fn() });

    resetBtn.click();
    expect(bd.classList.contains('danger-confirm-backdrop--visible')).toBe(true);
    expect(resetBtn.classList.contains('danger-confirm-target')).toBe(true);
    expect(document.body.classList.contains('danger-confirm-pending')).toBe(true);
    expect(onReset).not.toHaveBeenCalled();

    const outside = document.createElement('div');
    document.body.appendChild(outside);
    outside.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(bd.classList.contains('danger-confirm-backdrop--visible')).toBe(false);
    expect(resetBtn.classList.contains('danger-confirm-target')).toBe(false);
    expect(document.body.classList.contains('danger-confirm-pending')).toBe(false);
  });

  it('runs onReset after second click on reset and removes backdrop', () => {
    const resetBtn = document.getElementById('resetBtn');
    const deleteBtn = document.getElementById('deleteThemeBtn');
    const bd = document.getElementById('dangerConfirmBackdrop');
    const onReset = vi.fn();
    createTwiceConfirmPair({
      resetBtn,
      deleteBtn,
      onReset,
      onDelete: vi.fn(),
      onArm: vi.fn()
    });

    resetBtn.click();
    expect(bd.classList.contains('danger-confirm-backdrop--visible')).toBe(true);
    resetBtn.click();
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(bd.classList.contains('danger-confirm-backdrop--visible')).toBe(false);
  });
});
