# LLM.md (Project Principles)

This document helps an AI understand the purpose of the **Colour Palette Generator** and the design principles it follows.

## Purpose

The app generates and validates colour palettes for **MS Power BI** workflows. It produces:

- A palette preview with contrast validation (B/W 4.5:1 or higher).
- Sentiment and divergent “meaning” rows suitable for Power BI use.
- Export formats compatible with **Power BI theme JSON** and an SVG preview that embeds the same palette meaning.
- Sharing via URL state so a palette can be restored by opening a link.

## Core principles

### 1) Semantics-first: match Power BI theme keys

The meaning labels in the UI and the keys in exports/imports must stay consistent with the **Power BI report theme JSON schema** (what Desktop validates on import).

The project targets the following semantic keys:

- Sentiment: `good`, `neutral`, `bad`
- Divergent: `maximum`, `center`, `minimum`, `null`

When the meaning names change, treat them as a breaking change for any persisted formats and add migration logic.

Primary references:

- **Human-oriented docs** (keys and examples): [Create custom report themes in Power BI Desktop](https://learn.microsoft.com/en-gb/power-bi/create-reports/report-themes-create-custom)

- **Machine-oriented schema** (authoritative validation): Microsoft publishes versioned JSON Schema files (Draft 7), one per Power BI Desktop monthly release, in the [Report Theme JSON Schema](https://github.com/microsoft/powerbi-desktop-samples/tree/main/Report%20Theme%20JSON%20Schema) directory of [`microsoft/powerbi-desktop-samples`](https://github.com/microsoft/powerbi-desktop-samples) (files named `reportThemeSchema-*.json`). Power BI Desktop validates imported themes against these schemas. When extending exports or validating theme JSON, pick the schema version that matches the target Desktop release; this app’s JSON export covers a subset of the full schema (`dataColors`, `good` / `neutral` / `bad`, `maximum` / `center` / `minimum` / `null`, optional structural keys, etc.).

### 2) Single source of truth: app state drives everything

Internals are organized around a shared in-memory `state` (palette colours, optional rows enabled/disabled, and the active swatch).

Everything else is derived from that state:

- Rendered swatches
- Contrast summary
- Export payloads (JSON + SVG)
- URL hash representation used for shareable links and navigation

Avoid “UI-only” state. If a value matters for export/import or sharing, it belongs in `state`.

### 3) Shareable state via URL hash (and navigation)

The app uses the URL hash to encode the current palette payload so that:

- A link restores the palette state.
- Browser Back/Forward acts like “undo/redo” of meaningful palette edits.

Implementation principles:

- Use a stable encoding for the palette state.
- Update the URL with an initial `replace` (so landing on the app doesn’t create a useless history step).
- Use `push` for subsequent meaningful user edits so Back/Forward can undo/redo palette changes.
- On navigation events (`popstate` / `hashchange`), decode and apply the hash payload.
- When the user changes the active saved theme, fold/reset the history so theme-switching doesn’t pollute the undo stack of colour edits.

### 4) Optional rows are explicitly derived from enabled flags

Sentiment and divergent rows are optional UI sections:

- The corresponding data must exist even if optional rows are disabled (defaults), but the rows should only be *exported* when enabled.
- Disabled sections must not contribute to export payload keys.

### 5) Export/import fidelity (unit + E2E)

Export logic lives in `js/colour-export.js` and must be consistent with the UI semantics and unit-tested.

Import logic lives in `js/import-export.js`, and must:

- Accept both the app’s exported formats and legacy Power BI theme shapes when reasonable.
- Normalize inputs (hex formatting, missing fields, optional rows).
- Migrate legacy divergent ordering / missing `null` values to the current order.

Testing principles:

- Unit tests validate JSON/SVG payloads and metadata.
- Playwright E2E tests validate real user flows:
  - theme creation/switching
  - palette editing via swatches/picker
  - optional rows toggling
  - URL-history behavior (Back restores prior states)

### 6) Accessibility and labels

Swatches are rendered as accessible inputs and use `aria-label` that matches the meaning label.

Principle:

- The visible label above an optional swatch should match the accessible name used in tests.
- Keep labels stable for screen readers and for Playwright selectors.

### 7) Maintain backward compatibility with migrations

Stored data and older URL hashes may not match the current internal representation.

Rule:

- Add migration functions when the meaning/order/keys change.
- Prefer additive changes where possible (e.g., padding missing arrays / defaulting `null` to `#757575`).

### 8) “Null” handling is semantic, not gradient data

Divergent `null` is treated as an additional optional meaning swatch (default `#757575`), and must not contaminate the gradient stops intended for the other three divergent meanings.

In SVG export:

- Render the 3 divergent meanings used for the gradient.
- Render `null` as a separate swatch positioned to the right of the gradient.

## Project layout (high-level)

- `index.html`: markup structure and accessible headings/toggles
- `css/styles.css`: swatch and layout styling (including optional row labels)
- `js/main.js`: DOM refs, bootstrap, wiring, and URL-history listeners
- `js/state.js`: shared state, persistence, and URL hash encode/decode
- `js/ui.js`: swatch rendering, contrast summary, and picker integration
- `js/themes.js`: saved named theme management (localStorage)
- `js/import-export.js`: JSON/SVG export UI + import parsing and applying
- `js/colour-export.js`: pure export builder logic (used by unit tests too)

## Development and testing

- Unit tests validate export/import payload correctness:
  - `tests/unit/`
- End-to-end tests validate real app behavior:
  - `tests/e2e/`

