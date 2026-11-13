/* engine.js - parametric racket builder. Consumes a MOLD_REGISTRY entry and produces a THREE.Group.
 * All geometry is built in millimetres; the root group is scaled by MMS for the scene. */
const T0 = 38, T2 = 19, SHEET = 1.4, SKIN_LIFT = 0.12, RIM_FLAT = 8.5, MMS = 0.1;

class Acc {                                   // non-indexed triangle accumulator with explicit normals
  constructor() { this.p = []; this.n = []; this.u = []; }
  v(x, y, z, nx, ny, nz, u, v) { this.p.push(x, y, z); this.n.push(nx, ny, nz); this.u.push(u, v); }
  geo() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
}

/* ---------------------------- profile builders (r = into the material, z = thickness) ---------------------------- */
function finishProfile(pts) {
  let P = U.dedupe(pts, 1e-4);
  if (U.area(P) < 0) P.reverse();
  const m = P.length, nrm = [];
  for (let i = 0; i < m; i++) {
    const a = P[(i - 1 + m) % m], b = P[i], c = P[(i + 1) % m];
    const n1 = [(b[1] - a[1]), -(b[0] - a[0])], n2 = [(c[1] - b[1]), -(c[0] - b[0])];
    const l1 = Math.hypot(...n1) || 1, l2 = Math.hypot(...n2) || 1;
    let x = n1[0] / l1 + n2[0] / l2, y = n1[1] / l1 + n2[1] / l2, l = Math.hypot(x, y) || 1;
    nrm.push([x / l, y / l]);
  }
  P.push(P[0].slice()); nrm.push(nrm[0].slice());
  const s = [0]; let tot = 0;
  for (let i = 1; i < P.length; i++) { tot += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); s.push(tot); }
  return { pts: P, nrm, s: s.map(v => v / tot), len: tot };
}
function profileFrame(R = 5, flat = RIM_FLAT, w = 9.8, tuck = 1.3, n = 7) {
  const pts = [[flat, T2], [R, T2]];
  for (let i = 1; i <= n; i++) { const a = Math.PI / 2 + (i / n) * Math.PI / 2; pts.push([R + R * Math.cos(a), T2 - R + R * Math.sin(a)]); }
  pts.push([0, -(T2 - R)]);
  for (let i = 1; i <= n; i++) { const a = Math.PI + (i / n) * Math.PI / 2; pts.push([R + R * Math.cos(a), -(T2 - R) + R * Math.sin(a)]); }
  pts.push([flat, -T2], [w, -(T2 - tuck)], [w, T2 - tuck]);
  return finishProfile(pts);
}
function profileLiner(depth = 1.5, ro = 0.9, n = 5) {   // sits inside a window opening (r < 0)
  const pts = [[0, T2], [-depth + ro, T2]];
  for (let i = 1; i <= n; i++) { const a = Math.PI / 2 + (i / n) * Math.PI / 2; pts.push([-depth + ro + ro * Math.cos(a), T2 - ro + ro * Math.sin(a)]); }
  for (let i = 1; i <= n; i++) { const a = Math.PI + (i / n) * Math.PI / 2; pts.push([-depth + ro + ro * Math.cos(a), -T2 + ro + ro * Math.sin(a)]); }
  pts.push([0, -T2]);
  return finishProfile(pts);
}
function profileCircle(r0, rad, n = 14) {
  const pts = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; pts.push([r0 + Math.cos(a) * rad, Math.sin(a) * rad]); }
  return finishProfile(pts);
}

/* sweep a profile along a 2D path (profile r-axis follows the left normal) */
function sweepProfile(path, closed, prof, kf, uMM = 200, zScale = true, name = '') {
  const N = U.leftNormals(path, closed), rings = path.length + (closed ? 1 : 0), m = prof.pts.length;
  const pos = new Float32Array(rings * m * 3), nor = new Float32Array(rings * m * 3), uv = new Float32Array(rings * m * 2);
  let cum = 0;
  for (let i = 0; i < rings; i++) {
    const ii = i % path.length, p = path[ii], n = N[ii];
    if (i > 0) cum += Math.hypot(p[0] - path[(i - 1) % path.length][0], p[1] - path[(i - 1) % path.length][1]);
    const k = zScale ? kf(p[1]) : 1;
    for (let j = 0; j < m; j++) {
      const q = (i * m + j) * 3, r = prof.pts[j][0], z = prof.pts[j][1];
      pos[q] = p[0] + n[0] * r; pos[q + 1] = p[1] + n[1] * r; pos[q + 2] = z * k;
      const pn = prof.nrm[j]; let nx = n[0] * pn[0], ny = n[1] * pn[0], nz = pn[1];
      const l = Math.hypot(nx, ny, nz) || 1; nor[q] = nx / l; nor[q + 1] = ny / l; nor[q + 2] = nz / l;
      uv[(i * m + j) * 2] = cum / uMM; uv[(i * m + j) * 2 + 1] = prof.s[j];
    }
  }
  const idx = [];
  for (let i = 0; i < rings - 1; i++) for (let j = 0; j < m - 1; j++) {
    const a = i * m + j, b = (i + 1) * m + j, c = (i + 1) * m + j + 1, d = i * m + j + 1;
    idx.push(a, b, c, a, c, d);
  }
  // fix winding using one sample quad
  const si = Math.floor(rings / 2), sj = Math.floor((m - 1) / 2);
  const ia = si * m + sj, ib = (si + 1) * m + sj, ic = (si + 1) * m + sj + 1;
  const ux = pos[ib * 3] - pos[ia * 3], uy = pos[ib * 3 + 1] - pos[ia * 3 + 1], uz = pos[ib * 3 + 2] - pos[ia * 3 + 2];
  const vx = pos[ic * 3] - pos[ia * 3], vy = pos[ic * 3 + 1] - pos[ia * 3 + 1], vz = pos[ic * 3 + 2] - pos[ia * 3 + 2];
  const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
  if (cx * nor[ia * 3] + cy * nor[ia * 3 + 1] + cz * nor[ia * 3 + 2] < 0) for (let t = 0; t < idx.length; t += 3) { const x = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = x; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeBoundingSphere(); g.name = name;
  return g;
}

/* ---------------------------- mold resolution ---------------------------- */
function resolveMold(mold) {
  const o = mold.head.outline;
  const right = o.type === 'half' ? o.points.map(p => p.slice()) : U.sampleBezier(o.start, o.segments, 16);
  const left = right.slice().reverse().map(p => [-p[0], p[1]]);
  const outline = U.winding(U.dedupe(right.concat(left), 0.05), true);
  const windows = [];
  for (const w of mold.head.windows || []) {
    const base = U.winding(U.dedupe(w.points, 0.05), false);
    windows.push(base);
    if (w.mirror) windows.push(U.winding(base.map(p => [-p[0], p[1]]), false));
  }
  const bb = U.bbox(outline), kf = (t => y => t(y) / T0)(U.thicknessFn(mold.head.thickness)), thick = U.thicknessFn(mold.head.thickness);
  // drilling
  const dr = mold.drilling || { type: 'explicit', holes: [] }, holes = [];
  const winDist = (x, y) => Math.min(1e9, ...windows.map(w => U.distLoop(w, x, y)));
  if (dr.type === 'explicit') {
    for (const h of dr.holes) { holes.push([h[0], h[1], h[2]]); if (dr.mirror && Math.abs(h[0]) > 0.5) holes.push([-h[0], h[1], h[2]]); }
  } else if (dr.type === 'hex') {
    const s = dr.spacing, rowH = s * 0.866;
    for (let r = 0, y = dr.y0; y <= dr.y1; r++, y += rowH) for (let k = -25; k <= 25; k++) {
      const x = (k + (r & 1) * 0.5) * s;
      if (!U.inPoly(outline, x, y)) continue;
      if (U.distLoop(outline, x, y) < dr.margin + dr.d / 2) continue;
      if (winDist(x, y) < dr.margin * 0.5 + dr.d / 2) continue;
      if ((dr.exclude || []).some(e => ((x - e.cx) / e.rx) ** 2 + ((y - e.cy) / e.ry) ** 2 < 1)) continue;
      holes.push([x, y, dr.d]);
    }
  } else if (dr.type === 'perimeter') {
    for (const row of dr.rows) {
      const off = U.cleanOffset(outline, U.offsetLoop(outline, row.offset), row.offset);
      let top = 0; off.forEach((p, i) => { if (p[1] > off[top][1]) top = i; });
      let acc = 0, next = 0;
      for (let i = top; i > 0; i--) {
        const a = off[i], b = off[i - 1], L = Math.hypot(a[0] - b[0], a[1] - b[1]);
        while (next <= acc + L) {
          const t = (next - acc) / L, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
          if (y >= dr.y0 && y <= dr.y1 && x >= 0 && winDist(x, y) > 10) { holes.push([x, y, row.d]); if (x > 0.5) holes.push([-x, y, row.d]); }
          next += row.spacing;
        }
        acc += L;
      }
    }
  }
  windows.forEach((w, i) => { const d = Math.min(...w.map(p => U.distLoop(outline, p[0], p[1]))); if (d < RIM_FLAT + 1) console.warn(`[mold ${mold.id}] window ${i} is only ${d.toFixed(1)} mm from the outline (needs > ${RIM_FLAT + 1} mm); move it inward`); });
  const sheetOuter = U.cleanOffset(outline, U.offsetLoop(outline, RIM_FLAT), RIM_FLAT);
  const holeLoops = holes.map(h => U.circle(h[0], h[1], h[2] / 2, Math.max(14, Math.round(h[2] * 2.2)), true));
  return {
    outline, windows, holes, holeLoops, bb, kf, thick, sheetOuter,
    inner0: [sheetOuter].concat(windows),
    innerBorder: b => [U.cleanOffset(outline, U.offsetLoop(outline, RIM_FLAT + b), RIM_FLAT + b)].concat(windows.map(w => U.offsetLoop(w, b)))
  };
}

/* ---------------------------- geometry kit ---------------------------- */
function triangulate(outer, holes) {
  const v2 = a => a.map(p => new THREE.Vector2(p[0], p[1]));
  const all = outer.concat(...holes), idx = THREE.ShapeUtils.triangulateShape(v2(outer), holes.map(v2)), flat = [];
  for (const f of idx) {
    let [a, b, c] = f.map(i => all[i]);
    if ((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]) < 0) [b, c] = [c, b];
    flat.push(a[0], a[1], b[0], b[1], c[0], c[1]);
  }
  return flat;
}
function slicePlanes(tab) {
  const out = [];
  for (let i = 1; i < tab.length; i++) if (Math.abs(tab[i][1] - tab[i - 1][1]) > 0.01) for (let y = tab[i - 1][0] + 4; y < tab[i][0]; y += 4) out.push(y);
  return out;
}
/* cap: surface z(y) = S*zc*k(y); sf = outward facing (+1 = +z, -1 = -z) */
function addCap(acc, tris, zc, S, sf, kf, uvf, lift = 0) {
  for (let i = 0; i < tris.length; i += 6) {
    const order = sf > 0 ? [0, 1, 2] : [0, 2, 1];
    for (const o of order) {
      const x = tris[i + o * 2], y = tris[i + o * 2 + 1], k = kf(y), z = S * (zc + lift) * k;
      const f = (kf(y + 0.5) - kf(y - 0.5)) * S * zc;          // dz/dy
      const l = Math.hypot(f, 1), uv = uvf(x, y);
      acc.v(x, y, z, 0, -sf * f / l, sf / l, uv[0], uv[1]);
    }
  }
}
/* wall around a loop whose solid lies on its left */
function addWall(acc, loop, zLo, zHi, kf, uMM = 12, flip = false) {
  const N = U.leftNormals(loop, true), n = loop.length;
  let cum = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, a = loop[i], b = loop[j], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const ka = kf(a[1]), kb = kf(b[1]);
    const na = [-N[i][0], -N[i][1]], nb = [-N[j][0], -N[j][1]];
    const u0 = cum / uMM, u1 = (cum + L) / uMM;
    const P = (p, k, z) => [p[0], p[1], z * k];
    const A = P(a, ka, zLo), B = P(b, kb, zLo), C = P(b, kb, zHi), D = P(a, ka, zHi);
    const quad = [[A, na, u0, 0], [B, nb, u1, 0], [C, nb, u1, 1], [A, na, u0, 0], [C, nb, u1, 1], [D, na, u0, 1]];
    if (flip) { for (const t of [[0, 2, 1], [3, 5, 4]]) for (const q of t) { const e = quad[q]; acc.v(e[0][0], e[0][1], e[0][2], e[1][0], e[1][1], 0, e[2], e[3]); } }
    else for (const e of quad) acc.v(e[0][0], e[0][1], e[0][2], e[1][0], e[1][1], 0, e[2], e[3]);
    cum += L;
  }
}

/* octagonal grip loft along y; rings = [[y,hx,hy]...] */
function loftOctagon(rings, uTurns = 3, vMM = 36) {
  const acc = new Acc(), c22 = Math.cos(Math.PI / 8);
  const sec = (hx, hy, th) => [hx * Math.cos(th) / c22, hy * Math.sin(th) / c22];
  for (let i = 0; i < rings.length - 1; i++) {
    const [y0, ax, az] = rings[i], [y1, bx, bz] = rings[i + 1], dy = y1 - y0 || 1;
    for (let j = 0; j < 8; j++) {
      const phi = j * Math.PI / 4, t0 = phi - Math.PI / 8, t1 = phi + Math.PI / 8;
      const p00 = sec(ax, az, t0), p01 = sec(ax, az, t1), p10 = sec(bx, bz, t0), p11 = sec(bx, bz, t1);
      const nx = Math.cos(phi) / ((ax + bx) / 2), nz = Math.sin(phi) / ((az + bz) / 2), nl = Math.hypot(nx, nz);
      const dh = ((bx - ax) * Math.cos(phi) + (bz - az) * Math.sin(phi)) / dy;
      const n = [nx / nl, -dh, nz / nl], ln = Math.hypot(...n); n[0] /= ln; n[1] /= ln; n[2] /= ln;
      const ua = j / 8 * uTurns, ub = (j + 1) / 8 * uTurns, va = y0 / vMM, vb = y1 / vMM;
      const V = [[p00[0], y0, p00[1], ua, va], [p01[0], y0, p01[1], ub, va], [p11[0], y1, p11[1], ub, vb], [p00[0], y0, p00[1], ua, va], [p11[0], y1, p11[1], ub, vb], [p10[0], y1, p10[1], ua, vb]];
      // winding: outward normal; (p00,p01,p11) in x-z plane viewed along +y ... pick order that agrees with n
      const e1 = [V[1][0] - V[0][0], V[1][1] - V[0][1], V[1][2] - V[0][2]], e2 = [V[2][0] - V[0][0], V[2][1] - V[0][1], V[2][2] - V[0][2]];
      const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const flip = cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] < 0;
      const order = flip ? [0, 2, 1, 3, 5, 4] : [0, 1, 2, 3, 4, 5];
      for (const q of order) acc.v(V[q][0], V[q][1], V[q][2], n[0], n[1], n[2], V[q][3], V[q][4]);
    }
  }
  return acc.geo();
}
function endPlate(ring) {                     // octagonal disc at the butt, facing -y
  const [y, hx, hz] = ring, acc = new Acc(), c22 = Math.cos(Math.PI / 8), pts = [];
  for (let j = 0; j < 8; j++) { const th = j * Math.PI / 4 + Math.PI / 8; pts.push([hx * Math.cos(th) / c22, hz * Math.sin(th) / c22]); }
  const uv = p => [0.5 + p[0] / (2 * hx * 1.08), 0.5 + p[1] / (2 * hz * 1.08)];
  for (let j = 0; j < 8; j++) {
    const a = pts[j], b = pts[(j + 1) % 8];
    for (const [p, u] of [[[0, 0], [0.5, 0.5]], [b, uv(b)], [a, uv(a)]]) acc.v(p[0], y, p[1], 0, -1, 0, u[0], u[1]);
  }
  return acc.geo();
}
function twistBar(from, to, w, h, turns, color) {
  const n = 48, sec = 12, pos = [], idx = [];
  const d = new THREE.Vector3(to[0] - from[0], to[1] - from[1], 0), L = d.length(); d.normalize();
  const e1 = new THREE.Vector3(0, 0, 1), e2 = new THREE.Vector3().crossVectors(d, e1).normalize();
  const rr = (a) => { const c = Math.cos(a), s = Math.sin(a), p = 0.28; return [Math.sign(c) * Math.pow(Math.abs(c), p) * w / 2, Math.sign(s) * Math.pow(Math.abs(s), p) * h / 2]; };
  for (let i = 0; i <= n; i++) {
    const t = i / n, th = turns * Math.PI * 2 * t, c = new THREE.Vector3(from[0] + d.x * L * t, from[1] + d.y * L * t, 0);
    for (let j = 0; j < sec; j++) {
      const [a, b] = rr(j / sec * Math.PI * 2), ca = Math.cos(th), sa = Math.sin(th);
      const lw = a * ca - b * sa, lh = a * sa + b * ca;
      pos.push(c.x + e2.x * lw + e1.x * lh, c.y + e2.y * lw, lh);
    }
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < sec; j++) {
    const a = i * sec + j, b = i * sec + (j + 1) % sec, c = (i + 1) * sec + (j + 1) % sec, dd = (i + 1) * sec + j;
    idx.push(a, dd, c, a, c, b);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/* ====================================================================================================
 * Racket
 * ==================================================================================================== */
const PROFILE_FRAME = profileFrame(), PROFILE_LINER = profileLiner(), PROFILE_REINF = profileCircle(3.4, 2.6, 14);

class Racket {
  constructor(mold, opts = {}) {
    this.mold = mold; this.opts = opts; this.root = new THREE.Group(); this.root.scale.setScalar(MMS);
    this.meshes = []; this.layers = []; this.maxAniso = opts.maxAniso || 8;
    this.geo = resolveMold(mold);
    this.faceRes = opts.faceRes || 1280;
    this.build();
  }
  tex(canvas, srgb, repeat) {
    const t = new THREE.CanvasTexture(canvas);
    t.encoding = srgb ? THREE.sRGBEncoding : THREE.LinearEncoding; t.anisotropy = this.maxAniso;
    t.wrapS = t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; return t;
  }
  add(geom, mat, name, role, parent) {
    const m = new THREE.Mesh(geom, mat); m.name = name; m.userData.role = role; m.castShadow = role !== 'overlay' && role !== 'fx'; m.receiveShadow = role !== 'overlay'; m.userData.orig = mat;
    (parent || this.root).add(m); this.meshes.push(m); return m;
  }
  build() {
    const g = this.geo, mold = this.mold, kf = g.kf, bb = g.bb;
    const faceW = this.faceRes, faceH = Math.round(faceW * bb.h / bb.w);
    const makeSet = (w, h) => ({ color: TEXGEN.mk(w, h), bump: TEXGEN.mk(w, h), rm: TEXGEN.mk(w, h) });
    // ---- textures & materials
    this.faceCv = { A: makeSet(faceW, faceH), B: makeSet(faceW, faceH) };
    this.skinMat = {};
    for (const s of ['A', 'B']) {
      const cv = this.faceCv[s];
      const m = new THREE.MeshPhysicalMaterial({
        map: this.tex(cv.color, true), bumpMap: this.tex(cv.bump), bumpScale: 2.0, roughnessMap: this.tex(cv.rm), metalnessMap: this.tex(cv.rm),
        roughness: 1, metalness: 1, clearcoat: 0, clearcoatRoughness: 0.12, sheen: 0.12, sheenRoughness: 0.6, sheenColor: new THREE.Color(0x606878), envMapIntensity: 0.95
      });
      m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -2;
      this.skinMat[s] = m;
    }
    this.frameCv = makeSet(512, 512);
    this.frameMat = new THREE.MeshPhysicalMaterial({
      map: this.tex(this.frameCv.color, true, true), bumpMap: this.tex(this.frameCv.bump, false, true), bumpScale: 1.4,
      roughnessMap: this.tex(this.frameCv.rm, false, true), metalnessMap: this.tex(this.frameCv.rm, false, true), roughness: 1, metalness: 1,
      clearcoat: 0.8, clearcoatRoughness: 0.08, envMapIntensity: 1.1
    });
    this.evaCv = { color: TEXGEN.mk(256, 1024), bump: TEXGEN.mk(256, 1024) };
    this.coreMat = new THREE.MeshStandardMaterial({ map: this.tex(this.evaCv.color, true, true), bumpMap: this.tex(this.evaCv.bump, false, true), bumpScale: 3.0, roughness: 0.93, metalness: 0 });
    this.coreMat.map.wrapT = this.coreMat.bumpMap.wrapT = THREE.ClampToEdgeWrapping;
    this.lamCv = TEXGEN.mk(256, 256);
    { const tl = TEXGEN.weaveTile('3k-twill'), c = this.lamCv.getContext('2d'); const p = c.createPattern(tl.color, 'repeat'); c.scale(2, 2); c.fillStyle = p; c.fillRect(0, 0, 256, 256); }
    this.lamMat = new THREE.MeshPhysicalMaterial({ map: this.tex(this.lamCv, true, true), roughness: 0.5, clearcoat: 0.5, envMapIntensity: 0.9 });
    this.gripCv = { color: TEXGEN.mk(256, 256), bump: TEXGEN.mk(256, 256) };
    this.gripMat = new THREE.MeshStandardMaterial({ map: this.tex(this.gripCv.color, true, true), bumpMap: this.tex(this.gripCv.bump, false, true), bumpScale: 2.4, roughness: 0.82 });
    this.capCv = TEXGEN.mk(256, 256);
    this.capMat = new THREE.MeshPhysicalMaterial({ map: this.tex(this.capCv, true), roughness: 0.28, clearcoat: 0.8 });
    this.plasticMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(mold.handle.cap.color), roughness: 0.3, clearcoat: 0.9, metalness: 0 });
    this.collarMat = new THREE.MeshPhysicalMaterial({ color: 0x0b0b0e, roughness: 0.28, clearcoat: 1.0, metalness: 0 });
    this.strapMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(mold.handle.strap.color), roughness: 0.78 });
    this.reinfMat = new THREE.MeshStandardMaterial({ color: 0xff7a1a, emissive: 0x7a2a00, roughness: 0.35, metalness: 0.5 });

    // ---- body geometry
    const planes = slicePlanes(mold.head.thickness);
    const tris = U.sliceTris(triangulate(g.sheetOuter, g.windows.concat(g.holeLoops)), planes);
    this.tris = tris;
    const uvBB = flip => (x, y) => [flip ? 1 - (x - bb.x0) / bb.w : (x - bb.x0) / bb.w, (y - bb.y0) / bb.h];
    const uvMM = (x, y) => [x / 40, y / 40];
    const loops = [g.sheetOuter].concat(g.windows, g.holeLoops);
    const CORE = T2 - SHEET;

    // skins (relief + graphics) and heat overlays
    this.skin = {}; this.heat = {};
    for (const [s, S] of [['A', 1], ['B', -1]]) {
      const a = new Acc(); addCap(a, tris, T2, S, S, kf, uvBB(S < 0), SKIN_LIFT / T2 * 0 + SKIN_LIFT);
      this.skin[s] = this.add(a.geo(), this.skinMat[s], 'Skin ' + s, 'skin');
      const h = new Acc(); addCap(h, tris, T2, S, S, kf, uvBB(S < 0), 0.55);
      this.heat[s] = this.add(h.geo(), null, 'Heat ' + s, 'overlay'); this.heat[s].visible = false;
    }
    // sheets
    this.sheet = {};
    for (const [s, S] of [['A', 1], ['B', -1]]) {
      const a = new Acc();
      addCap(a, tris, T2, S, S, kf, uvMM); addCap(a, tris, CORE, S, -S, kf, uvMM);
      const lo = S > 0 ? CORE : -T2, hi = S > 0 ? T2 : -CORE;
      for (const L of loops) addWall(a, L, lo, hi, kf, 12);
      this.sheet[s] = this.add(a.geo(), this.lamMat, 'Sheet ' + s, 'sheet');
    }
    // EVA core
    { const a = new Acc(); addCap(a, tris, CORE, 1, 1, kf, uvMM); addCap(a, tris, CORE, -1, -1, kf, uvMM);
      for (const L of loops) addWall(a, L, -CORE, CORE, kf, 12);
      this.core = this.add(a.geo(), this.coreMat, 'EVA core', 'core'); }
    // outline frame (skip the closed bottom edge)
    { const ymin = bb.y0, o = g.outline; let i0 = 0, i1 = o.length - 1;
      const bottom = p => p[1] < ymin + 0.8;
      while (i0 < o.length && bottom(o[i0])) i0++;
      while (i1 > 0 && bottom(o[i1])) i1--;
      const path = o.slice(i0, i1 + 1);
      this.frame = this.add(sweepProfile(path, false, PROFILE_FRAME, kf, 200, true, 'frame'), this.frameMat, 'Frame', 'frame');
      const rpath = U.offsetLoop(path, 5.5, false);
      this.reinf = this.add(sweepProfile(rpath, false, PROFILE_REINF, kf, 60, true, 'reinf'), this.reinfMat, 'Reinforcement tube', 'reinf'); this.reinf.visible = false;
      this.reinf.position.set(0, 0, 0); }
    // window liners, dampers, struts (the "throat insert")
    this.insert = [];
    g.windows.forEach(w => { this.insert.push(this.add(sweepProfile(w, true, PROFILE_LINER, kf, 200, true, 'liner'), this.frameMat, 'Window liner', 'liner')); });
    const br = mold.bridge || {};
    (br.dampers || []).forEach(d => {
      const w = g.windows[d.window]; if (!w) return;
      const xs = []; for (let i = 0; i < w.length; i++) { const a = w[i], b = w[(i + 1) % w.length]; if ((a[1] > d.y) !== (b[1] > d.y)) xs.push(a[0] + (b[0] - a[0]) * (d.y - a[1]) / (b[1] - a[1])); }
      if (xs.length < 2) return;
      const x0 = Math.min(...xs) - 1.2, x1 = Math.max(...xs) + 1.2, len = x1 - x0 - 2 * d.radius;
      const geom = new THREE.CapsuleGeometry(d.radius, Math.max(0.5, len), 6, 16); geom.rotateZ(Math.PI / 2);
      const mat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(d.color), roughness: 0.42, clearcoat: 0.4 });
      const m = this.add(geom, mat, 'Vibra damper', 'damper'); m.position.set((x0 + x1) / 2, d.y, 0); m.scale.z = kf(d.y) * 1.0 * 1.9; this.insert.push(m);
    });
    (br.struts || []).forEach(s => {
      const mat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(s.color || '#dcdce0'), roughness: 0.3, metalness: 0.2, clearcoat: 0.8, side: THREE.DoubleSide });
      const m = this.add(twistBar(s.from, s.to, s.w, s.h, s.turns, s.color), mat, 'Twisted strut', 'damper'); this.insert.push(m);
    });
    // handle
    this.handle = new THREE.Group(); this.root.add(this.handle);
    const h = mold.handle;
    this.add(loftOctagon(h.rings, 3, 36), this.gripMat, 'Grip', 'handle', this.handle);
    this.add(loftOctagon(h.butt, 1, 60), this.plasticMat, 'Butt cap', 'handle', this.handle);
    this.add(endPlate(h.butt[0]), this.capMat, 'Butt plate', 'handle', this.handle);
    this.add(loftOctagon(h.collar, 1, 60), this.collarMat, 'Collar', 'handle', this.handle);
    { const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, -2, 0), new THREE.Vector3(7, -24, 5), new THREE.Vector3(10, -52, 2), new THREE.Vector3(0, -76, 0),
        new THREE.Vector3(-10, -52, -2), new THREE.Vector3(-7, -24, -5), new THREE.Vector3(0, -2, 0.5)]);
      this.add(new THREE.TubeGeometry(curve, 64, 1.6, 10, false), this.strapMat, 'Wrist cord', 'handle', this.handle);
      const knot = this.add(new THREE.SphereGeometry(3.4, 20, 14), this.strapMat, 'Cord knot', 'handle', this.handle); knot.position.set(0, -76, 0); knot.scale.set(1, 1.5, 1); }

    // ---- layers for the exploded CAD view (z offset in mm)
    const L = (key, name, objs, z) => ({ key, name, objs, z, anchor: [0, 330, z] });
    this.layers = [
      L('reliefA', 'Surface relief + graphics (Face A)', [this.skin.A, this.heat.A], 104),
      L('sheetA', 'Face A carbon sheet (attack)', [this.sheet.A], 74),
      L('frame', 'Tubular carbon frame + reinforcement', [this.frame, this.reinf], 40),
      L('core', 'EVA core slab', [this.core], 6),
      L('insert', 'Throat insert (liners, damper, struts)', this.insert, -30),
      L('sheetB', 'Face B carbon sheet (control)', [this.sheet.B], -66),
      L('reliefB', 'Surface relief + graphics (Face B)', [this.skin.B, this.heat.B], -100)
    ];
    this.explodeT = 0;

    // ---- heat textures & shader
    this.buildHeat();
    // ---- airflow particles
    this.buildAirflow();
    // ---- x-ray / wire swap materials
    this.wireMat = new THREE.MeshBasicMaterial({ color: 0x35e0ff, wireframe: true, transparent: true, opacity: 0.55, depthWrite: false });
    const xr = c => new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uCol: { value: new THREE.Color(c) } },
      vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); vN=normalize(normalMatrix*normal); vV=-mv.xyz; gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'uniform vec3 uCol; varying vec3 vN; varying vec3 vV; void main(){ float f=1.-abs(dot(normalize(vN),normalize(vV))); gl_FragColor=vec4(uCol*(0.10+1.15*pow(f,2.2)),1.); }'
    });
    this.xrayMats = { skin: xr(0x2ad4ff), sheet: xr(0x2a86ff), frame: xr(0x5affc8), core: xr(0xff9a2a), liner: xr(0x2ad4ff), damper: xr(0xff4a7a), handle: xr(0x4a7aff), reinf: xr(0xffd23a), overlay: xr(0xffffff) };

    // initial textures
    this.setFace('A', JSON.parse(JSON.stringify(mold.faces.A)), null);
    this.setFace('B', JSON.parse(JSON.stringify(mold.faces.B)), null);
    this.setFrame(JSON.parse(JSON.stringify(mold.frame)));
    this.setCore(JSON.parse(JSON.stringify(mold.core)));
    TEXGEN.composeGrip(this.gripCv, mold.handle.grip.color); this.gripMat.map.needsUpdate = this.gripMat.bumpMap.needsUpdate = true;
    TEXGEN.composeCap(this.capCv, mold); this.capMat.map.needsUpdate = true;
    this.gripMat.map.repeat.set(1, 1);
    this.lamMat.map.needsUpdate = true;
  }

  /* ---------------- appearance setters ---------------- */
  setFace(side, cfg, ui) {
    const cv = this.faceCv[side], res = TEXGEN.composeFace(cv, cfg, side, this.geo, ui || { groups: { logo: true, type: true, stripe: true } });
    const m = this.skinMat[side];
    for (const t of [m.map, m.bumpMap, m.roughnessMap, m.metalnessMap]) t.needsUpdate = true;
    const str = cfg.reliefStrength == null ? 1 : cfg.reliefStrength;
    m.bumpScale = (cfg.relief === 'smooth' ? 0.9 : cfg.relief === 'hex' ? 2.6 : cfg.relief === 'spin' ? 2.2 : 2.0) * (0.4 + 0.9 * str);
    m.clearcoat = cfg.relief === 'smooth' ? 0.4 + 0.6 * (cfg.gloss == null ? 0.5 : cfg.gloss) : 0.15 * (cfg.gloss == null ? 0.4 : cfg.gloss);
    m.clearcoatRoughness = 0.08 + (cfg.relief === 'smooth' ? 0 : 0.35);
    m.userData.cfg = cfg; m.needsUpdate = true;
  }
  setFrame(frame) {
    const prof = PROFILE_FRAME.len;
    TEXGEN.composeFrame(this.frameCv, frame, prof);
    for (const t of [this.frameMat.map, this.frameMat.bumpMap, this.frameMat.roughnessMap, this.frameMat.metalnessMap]) t.needsUpdate = true;
    this.frameMat.clearcoat = frame.finish === 'matte' ? 0.0 : 0.85; this.frameMat.clearcoatRoughness = 0.06;
    this.frameMat.needsUpdate = true;
  }
  setCore(core) {
    TEXGEN.composeEva(this.evaCv, core);
    this.coreMat.map.needsUpdate = this.coreMat.bumpMap.needsUpdate = true;
  }
  setGripColor(hex) { TEXGEN.composeGrip(this.gripCv, hex); this.gripMat.map.needsUpdate = this.gripMat.bumpMap.needsUpdate = true; }

  /* ---------------- heat / airflow ---------------- */
  buildHeat() {
    const g = this.geo, bb = g.bb, w = 96, h = Math.round(w * bb.h / bb.w), mold = this.mold, ss = (mold.performance || {}).sweetSpot || { x: 0, y: 320, rx: 50, ry: 60 };
    const sweet = new Float32Array(w * h), flex = new Float32Array(w * h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const x = bb.x0 + (i + 0.5) / w * bb.w, y = bb.y0 + (1 - (j + 0.5) / h) * bb.h, k = j * w + i;
      if (!U.inPoly(g.outline, x, y)) continue;
      const d = U.distLoop(g.outline, x, y);
      sweet[k] = 0.04 + 0.96 * Math.exp(-(((x - ss.x) / ss.rx) ** 2 + ((y - ss.y) / ss.ry) ** 2) * 1.1);
      let s = 1 - 0.78 * U.smooth(4, 78, d);
      s += 0.55 * (1 - U.smooth(150, 262, y));
      let hd = 1e9; for (const hh of g.holes) hd = Math.min(hd, Math.hypot(x - hh[0], y - hh[1]));
      s -= 0.22 * Math.exp(-hd / 14);
      flex[k] = U.clamp(s, 0, 1);
    }
    const mkTex = f => { const c = TEXGEN.mk(w, h); TEXGEN.composeHeat(c, f, w, h); const t = new THREE.CanvasTexture(c); t.minFilter = t.magFilter = THREE.LinearFilter; t.generateMipmaps = false; return t; };
    this.heatTex = { sweet: mkTex(sweet), flex: mkTex(flex) };
    this.heatUniforms = { uTex: { value: this.heatTex.sweet }, uOpacity: { value: 0.0 }, uTime: { value: 0 }, uMode: { value: 0 }, uRipple: { value: new THREE.Vector3(ss.x, ss.y, -100) } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.heatUniforms, transparent: true, depthWrite: false,
      vertexShader: 'varying vec2 vUv; varying vec2 vP; void main(){ vUv=uv; vP=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: `uniform sampler2D uTex; uniform float uOpacity,uTime,uMode; uniform vec3 uRipple; varying vec2 vUv; varying vec2 vP;
        vec3 lut(float t){ vec3 c0=vec3(.08,.05,.45),c1=vec3(.0,.62,.95),c2=vec3(.1,.9,.35),c3=vec3(1.,.9,.1),c4=vec3(1.,.15,.08);
          t=clamp(t,0.,1.)*4.; return t<1.?mix(c0,c1,t):t<2.?mix(c1,c2,t-1.):t<3.?mix(c2,c3,t-2.):mix(c3,c4,t-3.); }
        void main(){
          if(uMode<.5){ float h=texture2D(uTex,vUv).r; vec3 col=lut(h); float iso=abs(fract(h*9.+uTime*.15)-.5); float line=1.-smoothstep(.0,.07,iso);
            col=mix(col,vec3(1.),line*.35); gl_FragColor=vec4(col,uOpacity*(.55+.35*h)); }
          else { float t=uTime-uRipple.z; float r=distance(vP,uRipple.xy); float w=sin(r*.12-t*16.)*exp(-r*.010)*exp(-t*1.7)*smoothstep(0.,.04,t);
            float a=clamp(abs(w)*1.5,0.,1.); vec3 col=mix(vec3(.1,.8,1.),vec3(1.,.95,.7),step(0.,w)); gl_FragColor=vec4(col,a*uOpacity); } }`
    });
    this.heatMat = mat; this.heat.A.material = mat; this.heat.B.material = mat;
  }
  buildAirflow() {
    const g = this.geo, N = 150, seeds = [], r = U.rng(9);
    const wins = g.windows.filter(w => U.bbox(w).w > 6);
    if (!wins.length) { this.airflow = null; return; }
    let guard = 0;
    while (seeds.length < N && guard++ < 6000) {
      const w = wins[Math.floor(r() * wins.length)], b = U.bbox(w), x = b.x0 + r() * b.w, y = b.y0 + r() * b.h;
      if (U.inPoly(w, x, y) && U.distLoop(w, x, y) > 1.8) seeds.push({ x, y, ph: r(), sp: 0.7 + r() * 0.8 });
    }
    // a few free-stream streaks along the frame sides
    for (let i = 0; i < 40; i++) { const side = r() < 0.5 ? -1 : 1, y = 220 + r() * 220; const o = g.outline; let best = null; for (const p of o) if (p[0] * side > 0 && Math.abs(p[1] - y) < 3) best = p; if (best) seeds.push({ x: best[0] + side * (8 + r() * 14), y: best[1], ph: r(), sp: 0.8 + r() * 0.7 }); }
    this.airSeeds = seeds;
    const geo = new THREE.BufferGeometry(), pos = new Float32Array(seeds.length * 6), col = new Float32Array(seeds.length * 6);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.airflow = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.airflow.frustumCulled = false; this.airflow.visible = false; this.airflow.userData.role = 'fx';
    this.root.add(this.airflow);
  }
  updateAirflow(t) {
    if (!this.airflow || !this.airflow.visible) return;
    const p = this.airflow.geometry.attributes.position.array, c = this.airflow.geometry.attributes.color.array, S = this.airSeeds;
    for (let i = 0; i < S.length; i++) {
      const s = S[i], ph = (s.ph + t * 0.35 * s.sp) % 1, z = -85 + ph * 170, fade = Math.sin(ph * Math.PI);
      const q = i * 6, kf = this.geo.kf(s.y);
      p[q] = s.x + Math.sin(ph * 6 + i) * 1.2; p[q + 1] = s.y; p[q + 2] = z; p[q + 3] = p[q] + Math.sin(ph * 6 + i + 0.3) * 0.2; p[q + 4] = s.y; p[q + 5] = z + 16 * s.sp;
      const f = fade * 0.9; c[q] = 0.1 * f; c[q + 1] = 0.7 * f; c[q + 2] = 1.0 * f; c[q + 3] = 0.8 * f; c[q + 4] = 1.0 * f; c[q + 5] = 1.0 * f;
    }
    this.airflow.geometry.attributes.position.needsUpdate = true; this.airflow.geometry.attributes.color.needsUpdate = true;
  }
  setHeatKind(kind) { this.heatUniforms.uTex.value = this.heatTex[kind]; }

  /* ---------------- view modes ---------------- */
  setExplode(t) {
    this.explodeT = t;
    for (const L of this.layers) for (const o of L.objs) o.position.z = L.z * t;
    this.handle.position.y = -34 * t;
    this.reinf.visible = t > 0.02 || this.viewMode === 'xray' || this.viewMode === 'wire';
  }
  setViewMode(mode) {
    this.viewMode = mode;
    for (const m of this.meshes) {
      const role = m.userData.role;
      if (role === 'overlay') continue;
      if (role === 'sheet' || role === 'core') m.visible = mode !== 'wire';
      if (mode === 'wire') m.material = this.wireMat;
      else if (mode === 'xray') m.material = this.xrayMats[role] || this.wireMat;
      else m.material = this.restoreMat(m);
    }
    this.reinf.visible = mode === 'xray' || mode === 'wire' || this.explodeT > 0.02;
    const heat = mode === 'heat';
    this.heat.A.visible = this.heat.B.visible = heat;
    if (this.airflow) this.airflow.visible = heat && this.airflowOn !== false;
  }
  restoreMat(m) {
    switch (m.userData.role) {
      case 'skin': return m === this.skin.A ? this.skinMat.A : this.skinMat.B;
      case 'sheet': case 'liner': return m.userData.role === 'liner' ? this.frameMat : this.lamMat;
      case 'frame': return this.frameMat;
      case 'core': return this.coreMat;
      case 'reinf': return this.reinfMat;
      default: return m.userData.orig || m.material;
    }
  }
  dispose() {
    this.root.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    for (const m of [...Object.values(this.skinMat), this.frameMat, this.coreMat, this.lamMat, this.gripMat, this.capMat]) { for (const k of ['map', 'bumpMap', 'roughnessMap', 'metalnessMap']) if (m[k]) m[k].dispose(); m.dispose(); }
  }
}
