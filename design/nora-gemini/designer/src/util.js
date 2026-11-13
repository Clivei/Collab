/* util.js - small math / polygon helpers shared by the geometry engine and the texture generator */
const U = (() => {
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  function rng(seed) {                       // mulberry32
    let a = seed >>> 0;
    return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  function hexRgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  const rgbCss = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

  function area(p) { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; }
  function winding(p, ccw) { return (area(p) > 0) === ccw ? p.map(q => q.slice()) : p.slice().reverse().map(q => q.slice()); }
  function dedupe(p, eps = 0.02) {
    const o = [];
    for (const q of p) { const l = o[o.length - 1]; if (!l || Math.hypot(q[0] - l[0], q[1] - l[1]) > eps) o.push(q); }
    while (o.length > 2 && Math.hypot(o[0][0] - o[o.length - 1][0], o[0][1] - o[o.length - 1][1]) <= eps) o.pop();
    return o;
  }
  /* left-of-travel unit normals (miter-averaged) for an open or closed polyline */
  function leftNormals(p, closed = true) {
    const n = p.length, out = [];
    const en = [];
    for (let i = 0; i < (closed ? n : n - 1); i++) {
      const a = p[i], b = p[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
      en.push([-dy / l, dx / l]);
    }
    for (let i = 0; i < n; i++) {
      const pe = closed ? en[(i - 1 + en.length) % en.length] : en[Math.max(i - 1, 0)];
      const ne = closed ? en[i % en.length] : en[Math.min(i, en.length - 1)];
      let x = pe[0] + ne[0], y = pe[1] + ne[1], l = Math.hypot(x, y);
      if (l < 1e-6) { x = ne[0]; y = ne[1]; l = 1; }
      out.push([x / l, y / l]);
    }
    return out;
  }
  /* offset a loop d mm to its LEFT with a miter limit */
  function offsetLoop(p, d, closed = true) {
    const N = leftNormals(p, closed), n = p.length, out = [];
    for (let i = 0; i < n; i++) {
      const ne = N[i], nxt = N[closed ? (i + 1) % n : Math.min(i + 1, n - 1)];
      const dot = Math.max(0.55, ne[0] * nxt[0] + ne[1] * nxt[1]);
      const k = 1 / Math.sqrt((1 + dot) / 2) * 1; // ~miter factor, bounded
      out.push([p[i][0] + ne[0] * d * Math.min(k, 1.45), p[i][1] + ne[1] * d * Math.min(k, 1.45)]);
    }
    return out;
  }
  function inPoly(p, x, y) {
    let c = false;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      const a = p[i], b = p[j];
      if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
    }
    return c;
  }
  function distLoop(p, x, y) {
    let best = 1e9;
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length], abx = b[0] - a[0], aby = b[1] - a[1];
      const t = clamp(((x - a[0]) * abx + (y - a[1]) * aby) / (abx * abx + aby * aby || 1), 0, 1);
      const d = Math.hypot(x - (a[0] + t * abx), y - (a[1] + t * aby));
      if (d < best) best = d;
    }
    return best;
  }
  /* drop offset points that fell on top of the original loop (self-overlap in tight concave bends) */
  function cleanOffset(orig, off, d) { return off.filter(q => distLoop(orig, q[0], q[1]) > d * 0.82); }
  function circle(cx, cy, r, n, cw = true) {
    const o = [];
    for (let i = 0; i < n; i++) { const a = (cw ? -1 : 1) * i / n * Math.PI * 2; o.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    return o;
  }
  function bbox(p) {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const q of p) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
    return { x0, x1, y0, y1, w: x1 - x0, h: y1 - y0 };
  }
  function sampleBezier(start, segs, n = 14) {
    const out = [start.slice()];
    let p0 = start;
    for (const s of segs) {
      const [c1x, c1y, c2x, c2y, ex, ey] = s;
      for (let i = 1; i <= n; i++) {
        const t = i / n, u = 1 - t;
        out.push([u * u * u * p0[0] + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * ex,
          u * u * u * p0[1] + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * ey]);
      }
      p0 = [ex, ey];
    }
    return out;
  }
  function thicknessFn(tab) {
    const f = y => {
      if (y <= tab[0][0]) return tab[0][1];
      for (let i = 1; i < tab.length; i++) if (y <= tab[i][0]) { const a = tab[i - 1], b = tab[i]; return a[1] + (b[1] - a[1]) * (y - a[0]) / (b[0] - a[0]); }
      return tab[tab.length - 1][1];
    };
    return f;
  }
  /* slice 2D triangles (flat xy array, 6 floats per tri) by horizontal lines y = c; orientation is preserved */
  function sliceTris(tri, planes) {
    const E = 1e-7;
    let cur = tri;
    for (const c of planes) {
      const out = [];
      for (let i = 0; i < cur.length; i += 6) {
        const P = [[cur[i], cur[i + 1]], [cur[i + 2], cur[i + 3]], [cur[i + 4], cur[i + 5]]];
        const s = P.map(q => q[1] - c), g = s.map(v => v > E ? 1 : v < -E ? -1 : 0);
        if (!g.includes(1) || !g.includes(-1)) { out.push(cur[i], cur[i + 1], cur[i + 2], cur[i + 3], cur[i + 4], cur[i + 5]); continue; }
        const ix = (j, k) => { const t = s[j] / (s[j] - s[k]); return [P[j][0] + (P[k][0] - P[j][0]) * t, P[j][1] + (P[k][1] - P[j][1]) * t]; };
        const push = (...q) => { for (const v of q) out.push(v[0], v[1]); };
        const z = g.indexOf(0);
        if (z >= 0) {                                   // one vertex on the line
          const Z = P[z], V1 = P[(z + 1) % 3], V2 = P[(z + 2) % 3], I = ix((z + 1) % 3, (z + 2) % 3);
          push(Z, V1, I); push(Z, I, V2);
        } else {                                        // one vertex alone on its side
          const q = g[0] !== g[1] && g[0] !== g[2] ? 0 : (g[1] !== g[0] && g[1] !== g[2] ? 1 : 2);
          const r = (q + 1) % 3, t = (q + 2) % 3;
          const QR = ix(q, r), QT = ix(q, t);
          push(P[q], QR, QT); push(QR, P[r], P[t]); push(QR, P[t], QT);
        }
      }
      cur = out;
    }
    return cur;
  }
  return { clamp, lerp, smooth, rng, hexRgb, rgbCss, mix3, area, winding, dedupe, leftNormals, offsetLoop, inPoly, distLoop, cleanOffset, circle, bbox, sampleBezier, thicknessFn, sliceTris };
})();
