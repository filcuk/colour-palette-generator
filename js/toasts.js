const DEFAULT_DURATION_MS = 5000;

/**
 * Brief status message, top-right; removed after {@link DEFAULT_DURATION_MS} unless overridden.
 * @param {string} message
 * @param {{ durationMs?: number }} [options]
 */
export function showToast(message, options = {}) {
  const durationMs = options.durationMs ?? DEFAULT_DURATION_MS;
  const host = document.getElementById('toastHost');
  if (!host || typeof message !== 'string' || !message.trim()) return;

  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.textContent = message;
  host.appendChild(el);

  requestAnimationFrame(() => {
    el.classList.add('toast--visible');
  });

  const removeEl = () => {
    el.classList.remove('toast--visible');
    el.classList.add('toast--exit');
    const done = () => {
      el.remove();
    };
    el.addEventListener('transitionend', done, { once: true });
    setTimeout(done, 350);
  };

  setTimeout(removeEl, durationMs);
}
