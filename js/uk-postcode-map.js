/**
 * UK outward codes outside England (Scotland, Wales, Northern Ireland).
 * These areas are omitted so the map frames England only.
 */
export const UK_MAP_NON_ENGLAND_AREA_IDS = new Set([
  // Scotland
  'AB',
  'DD',
  'DG',
  'EH',
  'FK',
  'G',
  'HS',
  'IV',
  'KA',
  'KW',
  'KY',
  'ML',
  'PA',
  'PH',
  'TD',
  'ZE',
  // Wales
  'CF',
  'LD',
  'LL',
  'NP',
  'SA',
  // Northern Ireland
  'BT',
]);

/** England outward codes rendered with the divergent null colour (sample no-data). */
export const UK_MAP_NULL_DISPLAY_AREA_IDS = new Set(['DN', 'LA', 'PL', 'TN']);

const SVG_NS = 'http://www.w3.org/2000/svg';

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

/** Stable pseudo-volume in [-1, 1] per outward code (not used for map fill; kept for callers). */
export function volumeTForAreaId(id) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) / 2 ** 32) * 2 - 1;
}

/**
 * Evenly spaced t in [-1, 1] over sorted ids so the divergent ramp is used across the map.
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
 * @param {{ arcs: [number, number][][], transform: { scale: [number, number], translate: [number, number] } }} topology
 * @param {number} signedIndex
 * @returns {[number, number][]}
 */
function decodeArc(topology, signedIndex) {
  const arcIndex = signedIndex < 0 ? ~signedIndex : signedIndex;
  const arc = topology.arcs[arcIndex];
  const { scale, translate } = topology.transform;
  let x = 0;
  let y = 0;
  const pts = [];
  for (let i = 0; i < arc.length; i++) {
    const p = arc[i];
    if (i === 0) {
      x = p[0];
      y = p[1];
    } else {
      x += p[0];
      y += p[1];
    }
    const lon = translate[0] + scale[0] * x;
    const lat = translate[1] + scale[1] * y;
    pts.push([lon, lat]);
  }
  if (signedIndex < 0) pts.reverse();
  return pts;
}

/**
 * @param {{ arcs: [number, number][][], transform: { scale: [number, number], translate: [number, number] } }} topology
 * @param {number[]} arcIndices
 */
function ringFromArcs(topology, arcIndices) {
  /** @type {[number, number][]} */
  let ring = [];
  for (const idx of arcIndices) {
    const next = decodeArc(topology, idx);
    if (ring.length && next.length) {
      const a = ring[ring.length - 1];
      const b = next[0];
      if (Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9) {
        next.shift();
      }
    }
    ring = ring.concat(next);
  }
  return ring;
}

/**
 * @param {{ arcs: [number, number][][], transform: { scale: [number, number], translate: [number, number] } }} topology
 * @param {{ type: string, arcs: number[][][] | number[][] }} geom
 * @returns {[number, number][][]}
 */
function geometryToRings(topology, geom) {
  /** @type {[number, number][][]} */
  const rings = [];
  if (geom.type === 'Polygon') {
    for (const ring of geom.arcs) rings.push(ringFromArcs(topology, ring));
    return rings;
  }
  if (geom.type === 'MultiPolygon') {
    for (const polygon of geom.arcs) {
      for (const ring of polygon) rings.push(ringFromArcs(topology, ring));
    }
    return rings;
  }
  return rings;
}

const RAD = Math.PI / 180;

/**
 * Oblique orthographic (tangent plane at lon0°, lat0°). Uniform scale on both axes
 * on the sphere; lon/lat in degrees.
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
 * @param {[number, number][][]} rings lon/lat rings
 * @param {number} lon0
 * @param {number} lat0
 * @returns {[number, number][][]}
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
 * @param {{ objects: Record<string, { type: string, geometries?: { type: string, arcs: unknown, id?: string }[] }> }} topology
 * @returns {Map<string, [number, number][][]>}
 */
function geometriesById(topology) {
  const coll = topology.objects['uk-postcode-area'];
  if (!coll || coll.type !== 'GeometryCollection' || !Array.isArray(coll.geometries)) return new Map();
  /** @type {Map<string, [number, number][][]>} */
  const map = new Map();
  for (const geom of coll.geometries) {
    const id = geom.id;
    if (id == null) continue;
    const idStr = String(id);
    const rings = geometryToRings(topology, geom);
    if (!map.has(idStr)) map.set(idStr, []);
    map.get(idStr).push(...rings);
  }
  return map;
}

/**
 * @param {Map<string, [number, number][][]>} byId
 * @returns {Map<string, [number, number][][]>}
 */
function englandOnlyById(byId) {
  /** @type {Map<string, [number, number][][]>} */
  const map = new Map();
  for (const [id, rings] of byId) {
    if (UK_MAP_NON_ENGLAND_AREA_IDS.has(id)) continue;
    map.set(id, rings);
  }
  return map;
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
 * @param {SVGSVGElement} svg
 * @param {{ arcs: [number, number][][], objects: Record<string, unknown>, transform: { scale: [number, number], translate: [number, number] } }} topology
 * @param {{ maximum: string, center: string, minimum: string, nullColor: string, stroke: string, strokeWidth: number }} palette
 */
export function renderUkPostcodeAreaMap(svg, topology, palette) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const vb = svg.viewBox.baseVal;
  const W = vb.width || 220;
  const H = vb.height || 260;
  const pad = 4;

  const byId = englandOnlyById(geometriesById(topology));
  /** @type {[number, number, number, number]} */
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
  const dataIds = ids.filter(id => !UK_MAP_NULL_DISPLAY_AREA_IDS.has(id));
  const tById = divergentTByEvenSpread(dataIds);

  for (const id of ids) {
    const rings = projectedById.get(id);
    if (!rings) continue;
    const fill = UK_MAP_NULL_DISPLAY_AREA_IDS.has(id)
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
