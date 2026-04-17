/** Viewport min-width (px) where preview sits beside the Colours column (keep in sync with CSS). */
export const COLOURS_PREVIEW_MIN_WIDTH_SIDE_BY_SIDE = 1080;

const MEDIA_SIDE_BY_SIDE = `(min-width: ${COLOURS_PREVIEW_MIN_WIDTH_SIDE_BY_SIDE}px)`;

/**
 * Toggle preview panel: beside the main column (themes + colours + export) when wide;
 * below that column on small screens, with scroll-into-view.
 * @param {{ previewBtn: HTMLElement | null, layoutEl: HTMLElement | null, panelEl: HTMLElement | null }} opts
 */
export function initColoursPreviewLayout({ previewBtn, layoutEl, panelEl }) {
  if (!previewBtn || !layoutEl || !panelEl) return;

  let open = false;
  const mq = window.matchMedia(MEDIA_SIDE_BY_SIDE);

  function reduceMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function applyState() {
    layoutEl.classList.toggle('app-layout--preview-open', open);
    panelEl.classList.toggle('colours-preview-panel--open', open);
    previewBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    panelEl.setAttribute('aria-hidden', open ? 'false' : 'true');
    previewBtn.textContent = open ? 'Hide preview' : 'Preview';
    previewBtn.title = open ? 'Hide preview panel' : 'Show preview panel';
  }

  function scrollPanelIntoViewIfStacked() {
    if (!open || mq.matches) return;
    const instant = reduceMotion();
    requestAnimationFrame(() => {
      panelEl.scrollIntoView({ behavior: instant ? 'auto' : 'smooth', block: 'start' });
    });
  }

  function onPreviewClick() {
    open = !open;
    applyState();
    if (open) scrollPanelIntoViewIfStacked();
  }

  function onViewportModeChange() {
    if (open && !mq.matches) scrollPanelIntoViewIfStacked();
  }

  previewBtn.addEventListener('click', onPreviewClick);
  mq.addEventListener('change', onViewportModeChange);
}
