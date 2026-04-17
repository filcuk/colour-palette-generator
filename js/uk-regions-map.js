/**
 * UK NUTS1 region codes shown with the divergent null colour (sample no-data).
 */
export const UK_REGIONS_NULL_DISPLAY_IDS = new Set(['UKI', 'UKN']);

const SVG_NS = 'http://www.w3.org/2000/svg';
const RAD = Math.PI / 180;

/**
 * @param {string} hex
 * @returns {[number, number, number]}
 */
function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim());
  if (!m) return [128, 128, 128];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * @param {string} a
 * @param {string} b
 * @param {number} t 0..1
 */
function mixHex(a, b, t) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const u = Math.max(0, Math.min(1, t));
  const parts = A.map((c, i) => Math.round(c + (B[i] - c) * u));
  return `#${parts.map(c => c.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

/** @param {number} t in [-1, 1] — high → maximum, low → minimum */
export function divergentFillForT(t, maximumHex, centerHex, minimumHex) {
  const k = Math.max(-1, Math.min(1, t));
  if (k >= 0) return mixHex(centerHex, maximumHex, k);
  return mixHex(centerHex, minimumHex, -k);
}

/**
 * @param {{ type: string, coordinates: unknown }} geometry GeoJSON geometry
 * @returns {[number, number][][]}
 */
function geoJsonGeometryToLonLatRings(geometry) {
  /** @type {[number, number][][]} */
  const rings = [];
  if (!geometry || !geometry.type) return rings;
  if (geometry.type === 'Polygon') {
    const coords = /** @type {number[][][]} */ (geometry.coordinates);
    for (const ring of coords) rings.push(ring.map(([lon, lat]) => [lon, lat]));
    return rings;
  }
  if (geometry.type === 'MultiPolygon') {
    const polys = /** @type {number[][][][]} */ (geometry.coordinates);
    for (const polygon of polys) {
      for (const ring of polygon) rings.push(ring.map(([lon, lat]) => [lon, lat]));
    }
    return rings;
  }
  return rings;
}

/**
 * @param {{ type: string, features?: { properties?: { id?: string }, geometry: { type: string, coordinates: unknown } }[] }} collection
 * @returns {Map<string, [number, number][][]>}
 */
function ringsByRegionId(collection) {
  /** @type {Map<string, [number, number][][]>} */
  const map = new Map();
  const features = collection.features;
  if (!Array.isArray(features)) return map;
  for (const f of features) {
    const id = f.properties && f.properties.id != null ? String(f.properties.id) : '';
    if (!id) continue;
    const rings = geoJsonGeometryToLonLatRings(f.geometry);
    if (!rings.length) continue;
    if (!map.has(id)) map.set(id, []);
    map.get(id).push(...rings);
  }
  return map;
}

/**
 * Oblique orthographic (tangent plane at lon0°, lat0°).
 * @returns {[number, number]}
 */
function lonLatToOrthographic(lonDeg, latDeg, lon0Deg, lat0Deg) {
  const λ = lonDeg * RAD;
  const φ = latDeg * RAD;
  const λ0 = lon0Deg * RAD;
  const φ0 = lat0Deg * RAD;
  const dλ = λ - λ0;
  const cosφ = Math.cos(φ);
  const x = cosφ * Math.sin(dλ);
  const y = Math.cos(φ0) * Math.sin(φ) - Math.sin(φ0) * cosφ * Math.cos(dλ);
  return [x, y];
}

/**
 * @param {[number, number][][]} rings
 * @param {number} lon0
 * @param {number} lat0
 */
function projectRingsOrthographic(rings, lon0, lat0) {
  return rings.map(ring => ring.map(([lon, lat]) => lonLatToOrthographic(lon, lat, lon0, lat0)));
}

/**
 * @param {[number, number][]} ring
 * @param {number} s
 * @param {number} ox
 * @param {number} oy
 * @param {number} maxY
 */
function ringToPathD(ring, s, ox, oy, maxY) {
  if (!ring.length) return '';
  const x0 = ox + ring[0][0] * s;
  const y0 = oy + (maxY - ring[0][1]) * s;
  let d = `M ${x0.toFixed(3)} ${y0.toFixed(3)}`;
  for (let i = 1; i < ring.length; i++) {
    const x = ox + ring[i][0] * s;
    const y = oy + (maxY - ring[i][1]) * s;
    d += ` L ${x.toFixed(3)} ${y.toFixed(3)}`;
  }
  d += ' Z';
  return d;
}

/**
 * @param {[number, number][][]} rings
 * @returns {[number, number, number, number]}
 */
function boundsOfRings(rings) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const ring of rings) {
    for (const [x, y] of ring) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return [minX, minY, maxX, maxY];
}

/**
 * Evenly spaced t in [-1, 1] over sorted ids (null ids excluded).
 * @param {string[]} idsSorted
 * @returns {Map<string, number>}
 */
function divergentTByEvenSpread(idsSorted) {
  /** @type {Map<string, number>} */
  const map = new Map();
  const n = idsSorted.length;
  if (n === 0) return map;
  if (n === 1) {
    map.set(idsSorted[0], 0);
    return map;
  }
  for (let i = 0; i < n; i++) {
    map.set(idsSorted[i], -1 + (2 * i) / (n - 1));
  }
  return map;
}

/**
 * @param {SVGSVGElement} svg
 * @param {{ type: string, features?: { properties?: { id?: string }, geometry: { type: string, coordinates: unknown } }[] }} geojson
 * @param {{ maximum: string, center: string, minimum: string, nullColor: string, stroke: string, strokeWidth: number }} palette
 */
export function renderUkNuts1RegionsMap(svg, geojson, palette) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const vb = svg.viewBox.baseVal;
  const W = vb.width || 220;
  const H = vb.height || 260;
  const pad = 4;

  const byId = ringsByRegionId(geojson);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const rings of byId.values()) {
    const b = boundsOfRings(rings);
    minX = Math.min(minX, b[0]);
    minY = Math.min(minY, b[1]);
    maxX = Math.max(maxX, b[2]);
    maxY = Math.max(maxY, b[3]);
  }
  if (!Number.isFinite(minX)) return;

  const lon0 = (minX + maxX) / 2;
  const lat0 = (minY + maxY) / 2;

  /** @type {Map<string, [number, number][][]>} */
  const projectedById = new Map();
  let pMinX = Infinity;
  let pMinY = Infinity;
  let pMaxX = -Infinity;
  let pMaxY = -Infinity;
  for (const [id, rings] of byId) {
    const pr = projectRingsOrthographic(rings, lon0, lat0);
    projectedById.set(id, pr);
    for (const ring of pr) {
      for (const [px, py] of ring) {
        pMinX = Math.min(pMinX, px);
        pMinY = Math.min(pMinY, py);
        pMaxX = Math.max(pMaxX, px);
        pMaxY = Math.max(pMaxY, py);
      }
    }
  }

  const pbw = pMaxX - pMinX;
  const pbh = pMaxY - pMinY;
  if (!(pbw > 1e-12 && pbh > 1e-12)) return;

  const sx = (W - 2 * pad) / pbw;
  const sy = (H - 2 * pad) / pbh;
  const s = Math.min(sx, sy);
  const bwS = pbw * s;
  const bhS = pbh * s;
  const ox = pad + (W - 2 * pad - bwS) / 2 - pMinX * s;
  const oy = pad + (H - 2 * pad - bhS) / 2;

  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('fill-rule', 'evenodd');
  svg.appendChild(g);

  const ids = [...byId.keys()].sort();
  const dataIds = ids.filter(id => !UK_REGIONS_NULL_DISPLAY_IDS.has(id));
  const tById = divergentTByEvenSpread(dataIds);

  for (const id of ids) {
    const rings = projectedById.get(id);
    if (!rings) continue;
    const fill = UK_REGIONS_NULL_DISPLAY_IDS.has(id)
      ? palette.nullColor
      : divergentFillForT(tById.get(id) ?? 0, palette.maximum, palette.center, palette.minimum);

    for (const ring of rings) {
      const d = ringToPathD(ring, s, ox, oy, pMaxY);
      if (!d) continue;
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', d);
      path.setAttribute('fill', fill);
      path.setAttribute('stroke', palette.stroke);
      path.setAttribute('stroke-width', String(palette.strokeWidth));
      path.setAttribute('vector-effect', 'non-scaling-stroke');
      g.appendChild(path);
    }
  }
}
