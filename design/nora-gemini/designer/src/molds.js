/* =====================================================================================
 * MOLD_REGISTRY  -  all racket geometry/material definitions live here.
 * The engine (engine.js / textures.js / app.js) never hard-codes a racket.
 *
 * Coordinates are millimetres.  x = lateral (0 = centre line), y = distance from the butt-cap.
 * Face A (Attack / Forehand) is +Z, Face B (Control / Backhand) is -Z.
 *
 * SCHEMA (every key optional unless marked *):
 * {
 *   id*, brand*, model*, tagline,
 *   specs: { shape, weightG, balanceMm, lengthMm, widthMm, thicknessMm, core, faceA, faceB },
 *   head*: {
 *     outline*: { type:'half',   points:[[x,y]...] }          // right half, bottom -> top, mirrored automatically
 *             | { type:'bezier', start:[x,y], segments:[[c1x,c1y,c2x,c2y,ex,ey]...] },  // cubic Beziers, right half
 *     windows:  [ { points:[[x,y]...], mirror:true|false } ],  // throat / heart-bridge openings
 *     thickness*: [[y, mm]...]                                  // piecewise-linear thickness taper
 *   },
 *   bridge: { beadStyle, dampers:[{window,y,color,radius}], struts:[{from:[x,y],to:[x,y],w,h,turns,color}] },
 *   drilling*: { type:'explicit', holes:[[x,y,d]...], mirror:true }
 *            | { type:'hex', spacing, d, y0, y1, margin, exclude:[{cx,cy,rx,ry}] }       // staggered lattice
 *            | { type:'perimeter', rows:[{offset,spacing,d}...], y0, y1 }                // curved edge drilling
 *   core: { kind:'solid'|'layered', color, layers:[{color,from,to}] }  // from/to = 0..1 across thickness (B -> A)
 *   frame: { color, weave, finish:'gloss'|'matte', stripe:{color, from, to} }  // from/to = 0..1 around the tube
 *   handle: { rings:[[y,hx,hy]...], collar:[[y,hx,hy]...], butt:[[y,hx,hy]...], grip:{color}, strap:{color}, cap:{color,text} }
 *   faces: { A:FaceCfg, B:FaceCfg }  FaceCfg = { weave, tint, relief, reliefStrength, border, borderMm, gloss,
 *                                              weaveScale, decals:[Decal...] }
 *   performance: { sweetSpot:{x,y,rx,ry}, flexNote }
 *   hotspots: [ { id, label, text, pos:[x,y,z], face:'A'|'B'|'edge' } ]
 *   camera: { y }                                                 // optional framing hint
 * }
 *
 * weave ids  : 3k-twill | 12k-flat | 18k-flat | 16k-alu | colored | glass
 * relief ids : hex | star | spin | sand | smooth
 * decal types: text | logo(nora) | poly | constellation | ring | stripe   (see textures.js drawDecals)
 * ===================================================================================== */
const MOLD_REGISTRY = {};
function registerMold(m) { MOLD_REGISTRY[m.id] = m; return m; }

/* ---------- helpers for hand-written molds ---------- */
function sgnpow(v, p) { return Math.sign(v) * Math.pow(Math.abs(v), p); }
function ellipsePoly(cx, cy, rx, ry, rotDeg = 0, n = 36) {
  const r = rotDeg * Math.PI / 180, out = [];
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, x = Math.cos(a) * rx, y = Math.sin(a) * ry;
    out.push([+(cx + x * Math.cos(r) - y * Math.sin(r)).toFixed(2), +(cy + x * Math.sin(r) + y * Math.cos(r)).toFixed(2)]);
  }
  return out;
}
/* rounded slot, width interpolates bottom->top */
function slotPoly(cx, y0, y1, w0, w1, n = 40, sq = 0.55) {
  const out = [], h = (y1 - y0) / 2, cy = (y0 + y1) / 2;
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, s = sgnpow(Math.sin(a), sq), c = sgnpow(Math.cos(a), sq);
    const y = cy + s * h, t = (y - y0) / (y1 - y0), w = w0 + (w1 - w0) * t;
    out.push([+(cx + c * w / 2).toFixed(2), +y.toFixed(2)]);
  }
  return out;
}
/* STANDARD handle tables (mm) reused by several molds */
const STD_GRIP = [[8, 21.2, 17.6], [20, 21.0, 17.8], [28, 19.4, 16.6], [36, 18.2, 15.4], [46, 17.4, 14.2], [56, 17.3, 13.5],
  [110, 17.3, 13.6], [126, 17.9, 14.6]];
const STD_BUTT = [[0, 19.0, 15.6], [2, 22.4, 17.0], [5, 23.1, 17.4], [8, 21.2, 17.6]];
const STD_COLLAR = [[126, 19.2, 15.6], [130, 19.9, 17.4], [136, 20.8, 18.0], [140, 20.2, 17.2]];

/* =====================================================================================
 *  1. NORA Gemini  -  traced OXDOG-style hybrid mould, asymmetric dual identity
 *     Face A: red 3K twill, sand + hexagon relief   |   Face B: blue 16K aluminised, fine sand
 * ===================================================================================== */
registerMold({
  id: 'nora-gemini', brand: 'NORA', model: 'Gemini', tagline: 'One cut. Two faces. Red 3K attack / blue 16K aluminised control.',
  specs: { shape: 'Hybrid (traced OXDOG mould)', weightG: '360 - 370', balanceMm: '265 (medium-high)', lengthMm: 455,
    widthMm: 260, thicknessMm: 38, core: 'Black medium-density EVA', faceA: '3K carbon twill, sand + 3D hex', faceB: '16K aluminised, fine sand' },
  head: {
    outline: { type: 'half', points: NORA_GEMINI_DATA.OUT },
    windows: [{ points: NORA_GEMINI_DATA.WR, mirror: true }, { points: NORA_GEMINI_DATA.WC, mirror: false }],
    thickness: [[128, 24], [140, 24], [150, 25], [160, 26.3], [170, 28.4], [180, 31.2], [190, 33.1], [200, 34.3], [210, 35.5],
      [220, 36.5], [235, 37.3], [250, 38], [460, 38]]
  },
  bridge: { dampers: [{ window: 2, y: 168, color: '#e8e8ea', radius: 2.4 }] },
  drilling: { type: 'explicit', mirror: true, holes: NORA_GEMINI_DATA.HOLES },
  core: { kind: 'solid', color: '#141416' },
  frame: { color: '#0d0d10', weave: '3k-twill', finish: 'gloss', stripe: { color: '#d11f3f', from: 0.30, to: 0.36 } },
  handle: { rings: STD_GRIP, collar: STD_COLLAR, butt: STD_BUTT, grip: { color: '#16161a' }, strap: { color: '#d11f3f' },
    cap: { color: '#101013', text: 'N' } },
  faces: {
    A: { weave: 'colored', tint: '#d11f3f', relief: 'hex', reliefStrength: 1.0, border: true, borderMm: 13, gloss: 0.35, weaveScale: 1.8,
      decals: [
        { type: 'logo', group: 'logo', x: 0, y: 296, width: 168, color: '#f4f4f6', alpha: 0.96 },
        { type: 'text', group: 'type', text: 'I', x: 0, y: 255, size: 14, color: '#f4f4f6', alpha: 0.92 },
        { type: 'text', group: 'type', text: 'GEMINI  ·  ATTACK', x: 0, y: 170, size: 5.2, spacing: 3, color: '#f4f4f6', alpha: 0.85 },
        { type: 'poly', group: 'stripe', points: [[-98, 372], [-60, 432], [-44, 424], [-82, 364]], color: '#0b0b0e', alpha: 0.85 }
      ] },
    B: { weave: '16k-alu', tint: '#1b6fb0', relief: 'sand', reliefStrength: 0.7, border: true, borderMm: 13, gloss: 0.5, weaveScale: 1.8,
      decals: [
        { type: 'logo', group: 'logo', x: 0, y: 296, width: 168, color: '#0a2a50', alpha: 0.95 },
        { type: 'text', group: 'type', text: 'II', x: 0, y: 255, size: 14, color: '#0a2a50', alpha: 0.92 },
        { type: 'text', group: 'type', text: 'GEMINI  ·  CONTROL', x: 0, y: 170, size: 5.2, spacing: 3, color: '#0a2a50', alpha: 0.85 },
        { type: 'constellation', group: 'logo', x: 52, y: 350, scale: 34, color: '#0a2a50', alpha: 0.8 }
      ] }
  },
  performance: { sweetSpot: { x: 0, y: 318, rx: 52, ry: 62 }, flexNote: 'Stiff diamond-leaning frame, softer throat' },
  hotspots: [
    { id: 'faceA', label: 'Face A - 3K twill', text: 'Red 3K carbon twill with sand grit and 9 mm hexagon relief. Matte interior, mirror-gloss border.', pos: [-70, 340, 20], face: 'A' },
    { id: 'faceB', label: 'Face B - 16K aluminised', text: 'Blue-silver aluminised 16K weave with fine sand finish. Reflective metallic sheen under studio light.', pos: [70, 340, -20], face: 'B' },
    { id: 'bridge', label: 'Triple-window throat', text: 'Three-window heart bridge lowers air drag in the swing and leaves a stiff central strut.', pos: [0, 160, 18], face: 'A' },
    { id: 'holes', label: 'Drilling zone', text: '68 holes in a mirrored curve around the sweet spot. Hole walls show the black EVA core.', pos: [78, 425, 19], face: 'A' },
    { id: 'frame', label: 'Power-rib frame', text: 'Gloss carbon tube, 38 mm profile tapering to 24 mm at the throat.', pos: [128, 330, 0], face: 'edge' }
  ]
});

/* =====================================================================================
 *  2. Apex Diamond - power racket, high balance, Bezier outline, hex-lattice drilling
 * ===================================================================================== */
registerMold({
  id: 'apex-diamond', brand: 'Concept', model: 'Apex Diamond', tagline: 'Head-heavy power diamond with centre strut and twisted bridge.',
  specs: { shape: 'Diamond', weightG: '365 - 375', balanceMm: '275 (high)', lengthMm: 455, widthMm: 262, thicknessMm: 38,
    core: 'Red high-density EVA', faceA: '18K carbon, spin blades', faceB: '18K carbon, spin blades' },
  head: {
    outline: { type: 'bezier', start: [14, 128], segments: [
      [20, 150, 38, 168, 52, 198],       // throat flare
      [74, 246, 132, 290, 131, 352],     // shoulder to widest point
      [130, 410, 66, 456, 0, 461]        // narrow diamond apex
    ] },
    windows: [
      { points: slotPoly(0, 154, 232, 16, 26, 44), mirror: false },
      { points: ellipsePoly(26, 205, 6, 16, 0), mirror: true }
    ],
    thickness: [[128, 24], [150, 26], [190, 32], [230, 37], [260, 38], [470, 38]]
  },
  bridge: { struts: [{ from: [-8, 170], to: [8, 222], w: 9, h: 3.2, turns: 1.25, color: '#e8e8ea' }] },
  drilling: { type: 'hex', spacing: 16, d: 8, y0: 262, y1: 440, margin: 20, exclude: [{ cx: 0, cy: 345, rx: 20, ry: 20 }] },
  core: { kind: 'solid', color: '#c8202e' },
  frame: { color: '#101012', weave: '12k-flat', finish: 'matte', stripe: { color: '#f4b400', from: 0.28, to: 0.33 } },
  handle: { rings: STD_GRIP, collar: STD_COLLAR, butt: STD_BUTT, grip: { color: '#1b1b1f' }, strap: { color: '#f4b400' },
    cap: { color: '#101013', text: 'A' } },
  faces: {
    A: { weave: '18k-flat', tint: '#f4b400', relief: 'spin', reliefStrength: 1, border: true, borderMm: 10, gloss: 0.2, weaveScale: 1.8,
      decals: [
        { type: 'text', group: 'logo', text: 'APEX', x: 0, y: 330, size: 24, spacing: 6, color: '#f4b400', alpha: 0.95 },
        { type: 'text', group: 'type', text: 'DIAMOND  ·  POWER', x: 0, y: 176, size: 5, spacing: 3, color: '#f4f4f6', alpha: 0.8 },
        { type: 'ring', group: 'stripe', x: 0, y: 330, r: 78, w: 2.2, color: '#f4b400', alpha: 0.75 }
      ] },
    B: { weave: '18k-flat', tint: '#f4b400', relief: 'spin', reliefStrength: 1, border: true, borderMm: 10, gloss: 0.2, weaveScale: 1.8,
      decals: [
        { type: 'text', group: 'logo', text: 'APEX', x: 0, y: 330, size: 24, spacing: 6, color: '#f4b400', alpha: 0.95 },
        { type: 'ring', group: 'stripe', x: 0, y: 330, r: 78, w: 2.2, color: '#f4b400', alpha: 0.75 }
      ] }
  },
  performance: { sweetSpot: { x: 0, y: 345, rx: 40, ry: 50 }, flexNote: 'Very stiff head, small sweet spot, high output' },
  hotspots: [
    { id: 'strut', label: 'Twisted strut', text: 'Twisted carbon ribbon across the throat adds torsional stiffness and splits the airflow.', pos: [0, 196, 6], face: 'A' },
    { id: 'lattice', label: 'Hex-lattice drilling', text: 'Staggered 8 mm holes, with a solid strike zone for dwell time. Red EVA is visible inside each hole.', pos: [60, 392, 19], face: 'A' },
    { id: 'tip', label: 'Diamond apex', text: 'Mass concentrated at the tip raises the swing weight for smashes.', pos: [0, 452, 14], face: 'edge' }
  ]
});

/* =====================================================================================
 *  3. Orbit Round - control racket, low balance, wide sweet spot, perimeter drilling
 * ===================================================================================== */
registerMold({
  id: 'orbit-round', brand: 'Concept', model: 'Orbit Round', tagline: 'Round control head with vent-slot bridge and curved perimeter drilling.',
  specs: { shape: 'Round', weightG: '350 - 360', balanceMm: '255 (low)', lengthMm: 450, widthMm: 266, thicknessMm: 38,
    core: 'Layered multi-density EVA', faceA: '3K carbon, micro-sand', faceB: 'Fibreglass, glossy' },
  head: {
    outline: { type: 'bezier', start: [16, 128], segments: [
      [20, 150, 36, 172, 58, 190],
      [118, 200, 134, 262, 134, 300],
      [134, 372, 90, 430, 0, 436]
    ] },
    windows: [
      { points: slotPoly(0, 158, 198, 20, 26, 40), mirror: false },
      { points: slotPoly(20, 168, 197, 5, 6, 36), mirror: true }
    ],
    thickness: [[128, 24], [160, 28], [200, 34], [240, 38], [450, 38]]
  },
  bridge: { dampers: [{ window: 0, y: 176, color: '#2ee6a6', radius: 2.2 }] },
  drilling: { type: 'perimeter', y0: 200, y1: 420, rows: [{ offset: 24, spacing: 15, d: 7 }, { offset: 40, spacing: 18, d: 6 }] },
  core: { kind: 'layered', color: '#ffffff', layers: [{ color: '#f2f2f2', from: 0, to: 0.3 }, { color: '#1a1a1c', from: 0.3, to: 0.7 }, { color: '#2ee6a6', from: 0.7, to: 1 }] },
  frame: { color: '#0e0e11', weave: '3k-twill', finish: 'gloss', stripe: { color: '#2ee6a6', from: 0.3, to: 0.34 } },
  handle: { rings: STD_GRIP, collar: STD_COLLAR, butt: STD_BUTT, grip: { color: '#0f2c28' }, strap: { color: '#2ee6a6' },
    cap: { color: '#101013', text: 'O' } },
  faces: {
    A: { weave: '3k-twill', tint: '#2ee6a6', relief: 'sand', reliefStrength: 1, border: true, borderMm: 12, gloss: 0.25, weaveScale: 1.8,
      decals: [
        { type: 'ring', group: 'logo', x: 0, y: 300, r: 46, w: 5, color: '#2ee6a6', alpha: 0.95 },
        { type: 'text', group: 'logo', text: 'O', x: 0, y: 300, size: 34, color: '#2ee6a6', alpha: 0.95 },
        { type: 'text', group: 'type', text: 'ORBIT  ·  ROUND  ·  CONTROL', x: 0, y: 176, size: 4.6, spacing: 2.4, color: '#f4f4f6', alpha: 0.8 }
      ] },
    B: { weave: 'glass', tint: '#2ee6a6', relief: 'smooth', reliefStrength: 0, border: false, borderMm: 0, gloss: 1, weaveScale: 1.8,
      decals: [
        { type: 'ring', group: 'logo', x: 0, y: 300, r: 46, w: 5, color: '#0f2c28', alpha: 0.9 },
        { type: 'text', group: 'type', text: 'FIBREGLASS  ·  SOFT TOUCH', x: 0, y: 176, size: 4.6, spacing: 2.4, color: '#0f2c28', alpha: 0.8 }
      ] }
  },
  performance: { sweetSpot: { x: 0, y: 290, rx: 66, ry: 70 }, flexNote: 'Flexible, forgiving, centred sweet spot' },
  hotspots: [
    { id: 'vent', label: 'Vent-slot bridge', text: 'Three vent slots reduce drag and keep the throat compact for fast hands at the net.', pos: [0, 178, 16], face: 'A' },
    { id: 'layers', label: 'Layered EVA', text: 'Soft white outer layers and a firm black mid-layer. The stripes show in every drilled hole.', pos: [80, 330, 19], face: 'A' },
    { id: 'glass', label: 'Fibreglass Face B', text: 'Glossy glass-fibre face for touch and extra comfort.', pos: [-60, 330, -20], face: 'B' }
  ]
});

/* =====================================================================================
 *  4. Teardrop Hybrid - balanced all-rounder, central strut + vibra-damper
 * ===================================================================================== */
registerMold({
  id: 'teardrop-hybrid', brand: 'Concept', model: 'Teardrop Hybrid', tagline: 'Teardrop head, heart-shaped bridge, vibration-dampening insert.',
  specs: { shape: 'Teardrop', weightG: '355 - 365', balanceMm: '265 (medium)', lengthMm: 455, widthMm: 258, thicknessMm: 38,
    core: 'Black soft EVA', faceA: '12K carbon, star grit', faceB: 'Coloured carbon, smooth' },
  head: {
    outline: { type: 'bezier', start: [15, 128], segments: [
      [20, 150, 36, 170, 54, 196],
      [92, 240, 130, 280, 129, 335],
      [128, 400, 74, 452, 0, 455]
    ] },
    windows: [
      { points: ellipsePoly(0, 186, 15, 27, 0), mirror: false },
      { points: ellipsePoly(26, 200, 6, 16, 0), mirror: true }
    ],
    thickness: [[128, 24], [150, 26], [190, 33], [230, 37.5], [260, 38], [460, 38]]
  },
  bridge: { dampers: [{ window: 0, y: 186, color: '#ff5a1f', radius: 2.8 }], struts: [] },
  drilling: { type: 'hex', spacing: 17, d: 9, y0: 270, y1: 438, margin: 22, exclude: [{ cx: 0, cy: 330, rx: 28, ry: 30 }] },
  core: { kind: 'solid', color: '#0c0c0e' },
  frame: { color: '#0f0f12', weave: '12k-flat', finish: 'gloss', stripe: { color: '#ff5a1f', from: 0.3, to: 0.35 } },
  handle: { rings: STD_GRIP, collar: STD_COLLAR, butt: STD_BUTT, grip: { color: '#18181c' }, strap: { color: '#ff5a1f' },
    cap: { color: '#101013', text: 'T' } },
  faces: {
    A: { weave: '12k-flat', tint: '#ff5a1f', relief: 'star', reliefStrength: 1, border: true, borderMm: 11, gloss: 0.3, weaveScale: 1.8,
      decals: [
        { type: 'text', group: 'logo', text: 'TEARDROP', x: 0, y: 320, size: 15, spacing: 4, color: '#ff5a1f', alpha: 0.95 },
        { type: 'text', group: 'type', text: 'HYBRID  ·  ALL-ROUND', x: 0, y: 170, size: 4.8, spacing: 2.8, color: '#f4f4f6', alpha: 0.8 }
      ] },
    B: { weave: 'colored', tint: '#ff5a1f', relief: 'smooth', reliefStrength: 0, border: false, borderMm: 0, gloss: 0.9, weaveScale: 1.8,
      decals: [
        { type: 'text', group: 'logo', text: 'TEARDROP', x: 0, y: 320, size: 15, spacing: 4, color: '#0f0f12', alpha: 0.9 }
      ] }
  },
  performance: { sweetSpot: { x: 0, y: 305, rx: 55, ry: 60 }, flexNote: 'Balanced stiffness, moderate sweet spot' },
  hotspots: [
    { id: 'damper', label: 'Vibra-damper insert', text: 'Orange elastomer insert across the heart window absorbs high-frequency vibration.', pos: [0, 186, 12], face: 'A' },
    { id: 'star', label: 'Star-grit relief', text: 'Raised micro-stars bite the ball for spin without the harshness of a full rough face.', pos: [-60, 320, 19], face: 'A' },
    { id: 'coloured', label: 'Coloured carbon B', text: 'Tinted weave threads under a smooth gloss coat.', pos: [60, 320, -19], face: 'B' }
  ]
});
