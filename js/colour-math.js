/** Pure colour / hex utilities used across the UI. */

export const HEX3 = /^#?[0-9a-fA-F]{3}$/;
export const HEX6 = /^#?[0-9a-fA-F]{6}$/;
export const clampHex = s => s.replace(/[^0-9a-f]/gi, '').slice(0, 6).toUpperCase();

export function toFullHex(raw) {
  if (!raw) return null;
  let h = clampHex(raw.startsWith('#') ? raw.slice(1) : raw);
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (h.length !== 6) return null;
  return '#' + h;
}

export function toPreviewableHex(raw) {
  const s = (raw || '').trim();
  if (HEX6.test(s)) return toFullHex(s);
  if (HEX3.test(s)) return toFullHex(s);
  return null;
}

export function hexToRgb(hex) {
  const h = hex.slice(1);
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

export function rgbToHex(r, g, b) {
  const to2 = v => v.toString(16).padStart(2, '0').toUpperCase();
  return '#' + to2(r) + to2(g) + to2(b);
}

export function rgbToCmyk(r, g, b) {
  r = Math.max(0, Math.min(255, Math.round(r)));
  g = Math.max(0, Math.min(255, Math.round(g)));
  b = Math.max(0, Math.min(255, Math.round(b)));
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const k = 1 - Math.max(rn, gn, bn);
  if (k >= 1 || (1 - k) < 1e-6) return { c: 0, m: 0, y: 0, k: 100 };
  const c = (1 - rn - k) / (1 - k);
  const m = (1 - gn - k) / (1 - k);
  const y = (1 - bn - k) / (1 - k);
  return {
    c: Math.max(0, Math.min(100, Math.round(c * 100))),
    m: Math.max(0, Math.min(100, Math.round(m * 100))),
    y: Math.max(0, Math.min(100, Math.round(y * 100))),
    k: Math.max(0, Math.min(100, Math.round(k * 100)))
  };
}

export function cmykToRgb(c, m, y, k) {
  c = Math.max(0, Math.min(100, Number(c)));
  m = Math.max(0, Math.min(100, Number(m)));
  y = Math.max(0, Math.min(100, Number(y)));
  k = Math.max(0, Math.min(100, Number(k)));
  const cc = c / 100, mm = m / 100, yy = y / 100, kk = k / 100;
  const r = Math.round(255 * (1 - cc) * (1 - kk));
  const g = Math.round(255 * (1 - mm) * (1 - kk));
  const b = Math.round(255 * (1 - yy) * (1 - kk));
  return { r: Math.max(0, Math.min(255, r)), g: Math.max(0, Math.min(255, g)), b: Math.max(0, Math.min(255, b)) };
}

export function srgbToLinear(c) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function relLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

export function contrastRatio(fgHex, bgHex) {
  const L1 = relLuminance(fgHex), L2 = relLuminance(bgHex);
  const lighter = Math.max(L1, L2), darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function autoTextOn(hexBg) {
  const { r, g, b } = hexToRgb(hexBg);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 150 ? '#111111' : '#FFFFFF';
}

export function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = max === 0 ? 0 : (max - min) / max, v = max;
  if (max !== min) {
    switch (max) {
      case r: h = (g - b) / (max - min) + (g < b ? 6 : 0); break;
      case g: h = (b - r) / (max - min) + 2; break;
      case b: h = (r - g) / (max - min) + 4; break;
    }
    h *= 60;
  }
  return { h, s, v };
}

export function hsvToRgb(h, s, v) {
  const c = v * s; const x = c * (1 - Math.abs((h / 60) % 2 - 1)); const m = v - c;
  let rp = 0, gp = 0, bp = 0;
  if (0 <= h && h < 60) { rp = c; gp = x; bp = 0; }
  else if (60 <= h && h < 120) { rp = x; gp = c; bp = 0; }
  else if (120 <= h && h < 180) { rp = 0; gp = c; bp = x; }
  else if (180 <= h && h < 240) { rp = 0; gp = x; bp = c; }
  else if (240 <= h && h < 300) { rp = x; gp = 0; bp = c; }
  else { rp = c; gp = 0; bp = x; }
  const r = Math.round((rp + m) * 255), g = Math.round((gp + m) * 255), b = Math.round((bp + m) * 255);
  return { r, g, b };
}

export function hsvToHex(h, s, v) {
  const { r, g, b } = hsvToRgb(h, s, v);
  return rgbToHex(r, g, b);
}

export function hexToHsv(hex) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHsv(r, g, b);
}

export function sanitizeNameForFile(name) {
  const s = (name || '').trim()
    .replace(/\s+/g, '-')
    .replace(/[^A-Za-z0-9._-]/g, '')
    .replace(/[-_.]{2,}/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '')
    .slice(0, 64);
  return s || 'palette';
}
