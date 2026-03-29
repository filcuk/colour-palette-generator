/**
 * Two-step confirmation for paired danger actions: first click appends "?" to the label;
 * second click runs the handler. Any other click, keydown, or focus move clears both.
 * @param {{ resetBtn: Element, deleteBtn: Element, onReset: () => void, onDelete: () => void, onArm?: (which: 'reset' | 'delete') => void }} opts
 */
export function createTwiceConfirmPair({ resetBtn, deleteBtn, onReset, onDelete, onArm }) {
  const labels = {
    reset: (resetBtn.textContent || 'Reset').replace(/\?+$/, ''),
    delete: (deleteBtn.textContent || 'Delete').replace(/\?+$/, '')
  };
  const state = { armed: null };

  function clear() {
    if (state.armed === 'reset') resetBtn.textContent = labels.reset;
    else if (state.armed === 'delete') deleteBtn.textContent = labels.delete;
    state.armed = null;
    document.removeEventListener('click', onDocClick, true);
    document.removeEventListener('keydown', onDocKey, true);
    document.removeEventListener('focusin', onDocFocusIn, true);
  }

  function onDocClick(e) {
    if (!state.armed) return;
    const el = state.armed === 'reset' ? resetBtn : deleteBtn;
    if (el.contains(e.target)) return;
    clear();
  }

  function onDocKey() {
    if (state.armed) clear();
  }

  function onDocFocusIn(e) {
    if (!state.armed) return;
    const el = state.armed === 'reset' ? resetBtn : deleteBtn;
    if (el.contains(e.target)) return;
    clear();
  }

  function arm(which) {
    clear();
    state.armed = which;
    if (which === 'reset') resetBtn.textContent = `${labels.reset}?`;
    else deleteBtn.textContent = `${labels.delete}?`;
    document.addEventListener('click', onDocClick, true);
    document.addEventListener('keydown', onDocKey, true);
    document.addEventListener('focusin', onDocFocusIn, true);
    if (typeof onArm === 'function') onArm(which);
  }

  resetBtn.addEventListener('click', () => {
    if (state.armed === 'reset') {
      clear();
      onReset();
      return;
    }
    arm('reset');
  });

  deleteBtn.addEventListener('click', () => {
    if (state.armed === 'delete') {
      clear();
      onDelete();
      return;
    }
    arm('delete');
  });

  return { clear };
}
