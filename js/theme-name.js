export const THEME_NAME_MAX_LENGTH = 64;

/** Trim and cap length for theme display/storage (combobox, imports, saved list). */
export function clampThemeName(s) {
  if (typeof s !== 'string') return '';
  return s.trim().slice(0, THEME_NAME_MAX_LENGTH);
}

/**
 * Base used for "… 1", "… 2" numbering: strip trailing " {digits}" (e.g. "My Theme 1" → "My Theme").
 */
export function numberingBaseFromThemeName(clampedName) {
  const c = clampThemeName(clampedName || '');
  if (!c) return '';
  const stripped = c.replace(/\s+\d+$/, '').trim();
  return stripped || c;
}

/**
 * First unused "{base} {n}" for n ≥ 1, shortening base so the full string fits {@link THEME_NAME_MAX_LENGTH}.
 * @param {string} base
 * @param {Iterable<string> | Set<string>} takenNames
 * @returns {string | null}
 */
export function allocateNumberedThemeNameFromBase(base, takenNames) {
  const b = typeof base === 'string' ? base.trim() : '';
  if (!b) return null;
  const taken = takenNames instanceof Set ? takenNames : new Set(takenNames || []);

  for (let n = 1; n < 100000; n++) {
    const suffix = ' ' + String(n);
    const maxBaseLen = THEME_NAME_MAX_LENGTH - suffix.length;
    if (maxBaseLen < 1) continue;
    let head = b.slice(0, maxBaseLen).trimEnd();
    if (!head) head = (b.slice(0, Math.min(b.length, maxBaseLen)) || 'T').trimEnd() || 'T';
    const candidate = clampThemeName(head + suffix);
    if (candidate.length > THEME_NAME_MAX_LENGTH) continue;
    if (!taken.has(candidate)) return candidate;
  }
  return null;
}

/**
 * New copy name: always numbered ("{base} 1", …) using {@link numberingBaseFromThemeName} on the source.
 * @param {string} sourceName
 * @param {Iterable<string> | Set<string>} takenNames
 * @returns {string | null}
 */
export function allocateDuplicateThemeName(sourceName, takenNames) {
  const clamped = clampThemeName(sourceName || '');
  if (!clamped) return null;
  const base = numberingBaseFromThemeName(clamped);
  return allocateNumberedThemeNameFromBase(base, takenNames);
}

/**
 * If the desired name is free among other saved themes (excluding {@code activeSlotIndex}), returns it.
 * Otherwise returns the first free numbered variant (same rules as duplicate), respecting max length.
 * @param {string} desiredName
 * @param {{ name?: string }[]} savedThemes
 * @param {number} activeSlotIndex
 * @returns {string}
 */
export function resolveThemeNameAgainstSavedList(desiredName, savedThemes, activeSlotIndex) {
  const clamped = clampThemeName(desiredName || '');
  if (!clamped) return clamped;
  const taken = new Set(
    savedThemes.map((t, i) =>
      i === activeSlotIndex || !t?.name ? null : String(t.name)
    ).filter(Boolean)
  );
  if (!taken.has(clamped)) return clamped;
  const base = numberingBaseFromThemeName(clamped);
  return allocateNumberedThemeNameFromBase(base, taken) ?? clamped;
}
