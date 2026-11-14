/* textures.js - 100% procedural canvas textures: carbon weaves, relief layers, decals, EVA foam, grip wrap.
 * Nothing is loaded from the network. All canvases are regenerated on demand by the UI. */
const TEXGEN = (() => {
  const { clamp, lerp, smooth, rng, hexRgb, rgbCss } = U;
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

  /* ----------------------------------------------------------------------------------
   * Weave tiles (128 px square). Colour, height and roughness/metalness (G/B) are produced together.
   * ---------------------------------------------------------------------------------- */
  const WEAVES = {
    '3k-twill': { label: '3K Carbon (fine twill, black)', n: 16, twill: true, tow: 1.0, kind: 'carbon', base: [14, 14, 17], hi: [92, 96, 108], rough: 0.30, metal: 0.0 },
    '12k-flat': { label: '12K Carbon (flat tow)', n: 8, twill: false, tow: 2.2, kind: 'carbon', base: [12, 12, 15], hi: [84, 88, 98], rough: 0.34, metal: 0.0 },
    '18k-flat': { label: '18K Carbon (wide tow)', n: 8, twill: false, tow: 3.0, kind: 'carbon', base: [11, 11, 14], hi: [80, 84, 94], rough: 0.36, metal: 0.0 },
    '16k-alu': { label: '16K Aluminised carbon', n: 8, twill: false, tow: 2.4, kind: 'alu', base: [70, 76, 88], hi: [222, 228, 238], rough: 0.24, metal: 0.92 },
    'colored': { label: 'Coloured 3K carbon (tinted)', n: 16, twill: true, tow: 1.0, kind: 'color', base: [10, 10, 12], hi: [255, 255, 255], rough: 0.30, metal: 0.0 },
    'glass': { label: 'Fibreglass', n: 8, twill: false, tow: 2.0, kind: 'glass', base: [60, 60, 64], hi: [255, 255, 255], rough: 0.46, metal: 0.0 }
  };
  const tileCache = {};
  function weaveTile(id, tintHex) {
    const key = id + '|' + (['color', 'glass', 'alu'].includes(WEAVES[id].kind) ? tintHex : '');
    if (tileCache[key]) return tileCache[key];
    const W = WEAVES[id], S = 128, ts = S / W.n, tint = hexRgb(tintHex || '#d11f3f');
    const color = mk(S, S), bump = mk(S, S), rm = mk(S, S);
    const cd = color.getContext('2d').createImageData(S, S), bd = bump.getContext('2d').createImageData(S, S), rd = rm.getContext('2d').createImageData(S, S);
    const rnd = rng(77);
    const grain = new Float32Array(S * S);
    for (let i = 0; i < grain.length; i++) grain[i] = rnd();
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const cx = Math.floor(x / ts), cy = Math.floor(y / ts), lx = (x % ts) / ts, ly = (y % ts) / ts;
      const warp = W.twill ? ((((cx - cy) % 4) + 4) % 4) < 2 : ((cx + cy) & 1) === 0;
      const across = warp ? lx : ly, along = warp ? ly : lx;
      let h = Math.pow(Math.sin(Math.PI * across), 0.55);
      h *= 1 - 0.62 * Math.pow(Math.abs(2 * along - 1), 6);
      const fib = 0.5 + 0.5 * Math.sin(across * ts * 6.5 + grain[y * S + x] * 2.2);
      let L = (0.26 + 0.74 * h) * (warp ? 1.12 : 0.84) * (0.9 + 0.1 * fib) * (0.96 + 0.08 * grain[y * S + x]);
      let r, g, b, rough = W.rough + (1 - h) * 0.12, metal = W.metal;
      if (W.kind === 'carbon') {
        const t = clamp(L, 0, 1.2);
        r = lerp(W.base[0], W.hi[0], t * t); g = lerp(W.base[1], W.hi[1], t * t); b = lerp(W.base[2], W.hi[2], t * t);
      } else if (W.kind === 'alu') {
        const t = clamp(L, 0, 1.3);
        r = lerp(W.base[0], W.hi[0], clamp(t * 0.95, 0, 1)); g = lerp(W.base[1], W.hi[1], clamp(t * 0.95, 0, 1)); b = lerp(W.base[2], W.hi[2], clamp(t * 0.95, 0, 1));
        // anodised tint over the aluminium coat (keeps the bright metallic highlights)
        const tk = 0.74, hl = clamp(t * 0.95, 0, 1);
        r = lerp(r, tint[0] * (0.35 + 0.95 * hl), tk); g = lerp(g, tint[1] * (0.35 + 0.95 * hl), tk); b = lerp(b, tint[2] * (0.35 + 0.95 * hl), tk);
        rough = 0.22 + (1 - h) * 0.2; metal = 0.9 + 0.1 * h;
      } else if (W.kind === 'color') {
        const t = clamp(L, 0, 1.25), k = 0.12 + 0.80 * Math.min(1, t) * Math.min(1, t);
        r = tint[0] * k * (warp ? 1 : 0.72) + 14 * (1 - h); g = tint[1] * k * (warp ? 1 : 0.72) + 14 * (1 - h); b = tint[2] * k * (warp ? 1 : 0.72) + 14 * (1 - h);
      } else {                                      // glass
        const t = clamp(L, 0, 1.2), k = 0.52 + 0.48 * Math.min(1, t);
        r = tint[0] * k + 24 * h; g = tint[1] * k + 24 * h; b = tint[2] * k + 24 * h;
        rough = 0.46 + 0.1 * (1 - h);
      }
      const i = (y * S + x) * 4;
      cd.data[i] = clamp(r, 0, 255); cd.data[i + 1] = clamp(g, 0, 255); cd.data[i + 2] = clamp(b, 0, 255); cd.data[i + 3] = 255;
      const hv = clamp(255 * (0.15 + 0.85 * h * (0.9 + 0.1 * fib)), 0, 255);
      bd.data[i] = bd.data[i + 1] = bd.data[i + 2] = hv; bd.data[i + 3] = 255;
      rd.data[i] = 255; rd.data[i + 1] = clamp(rough * 255, 0, 255); rd.data[i + 2] = clamp(metal * 255, 0, 255); rd.data[i + 3] = 255;
    }
    color.getContext('2d').putImageData(cd, 0, 0); bump.getContext('2d').putImageData(bd, 0, 0); rm.getContext('2d').putImageData(rd, 0, 0);
    return (tileCache[key] = { color, bump, rm, tileMM: W.n * W.tow, rough: W.rough, metal: W.metal, def: W });
  }

  function fillPattern(ctx, tileCanvas, pxPerMm, tileMM, scale, angleDeg, W, H, sx = 1, sy = 1) {
    const pat = ctx.createPattern(tileCanvas, 'repeat'), k = pxPerMm * tileMM * scale / tileCanvas.width;
    ctx.save();
    ctx.translate(W / 2, H / 2); ctx.rotate(angleDeg * Math.PI / 180);
    ctx.scale(k * sx, k * sy); ctx.translate(-W / 2 / (k * sx), -H / 2 / (k * sy));
    ctx.fillStyle = pat;
    const big = Math.hypot(W, H) * 1.2;
    ctx.fillRect(-big / (k * sx), -big / (k * sy), 3 * big / (k * sx), 3 * big / (k * sy));
    ctx.restore();
  }

  /* ----------------------------------------------------------------------------------
   * Relief layers (grey height maps: dark = valley, bright = peak)
   * ---------------------------------------------------------------------------------- */
  function reliefCanvas(kind, W, H, ppm, strength) {
    const c = mk(W, H), ctx = c.getContext('2d');
    ctx.fillStyle = 'rgb(46,46,46)'; ctx.fillRect(0, 0, W, H);
    if (kind === 'hex') {
      const R = 5.4 * ppm, dx = Math.sqrt(3) * R, dy = 1.5 * R;
      for (let row = -1; row * dy < H + R; row++) for (let col = -1; col * dx < W + dx; col++) {
        const cx = col * dx + (row & 1 ? dx / 2 : 0), cy = row * dy;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
        g.addColorStop(0, 'rgb(255,255,255)'); g.addColorStop(0.72, 'rgb(190,190,190)'); g.addColorStop(1, 'rgb(70,70,70)');
        ctx.fillStyle = g; ctx.beginPath();
        for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; ctx.lineTo(cx + Math.cos(a) * (R - 1.2), cy + Math.sin(a) * (R - 1.2)); }
        ctx.closePath(); ctx.fill();
      }
    } else if (kind === 'star') {
      const s = 6.2 * ppm;
      ctx.fillStyle = 'rgb(255,255,255)';
      for (let row = -1; row * s < H + s; row++) for (let col = -1; col * s < W + s; col++) {
        const cx = col * s + (row & 1 ? s / 2 : 0), cy = row * s, r1 = s * 0.38, r2 = s * 0.12;
        ctx.beginPath();
        for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k & 1 ? r2 : r1; ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
        ctx.closePath(); ctx.fill();
      }
    } else if (kind === 'plate') {                    // 3D tread / diamond-plate emboss
      const s = 7.5 * ppm;
      for (let row = -1; row * s < H + s; row++) for (let col = -1; col * s < W + s; col++) {
        const cx = col * s + (row & 1 ? s / 2 : 0), cy = row * s, rot = ((row + col) & 1 ? 1 : -1) * Math.PI / 4;
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 0.42); g.addColorStop(0, 'rgb(255,255,255)'); g.addColorStop(1, 'rgb(120,120,120)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, s * 0.42, s * 0.13, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
    } else if (kind === 'spin') {
      const P = 64, t = mk(P, P), tc = t.getContext('2d'), id = tc.createImageData(P, P);
      for (let y = 0; y < P; y++) for (let x = 0; x < P; x++) {
        const v = Math.pow(0.5 + 0.5 * Math.sin(2 * Math.PI * x / P), 1.6), g = 40 + 215 * v, i = (y * P + x) * 4;
        id.data[i] = id.data[i + 1] = id.data[i + 2] = g; id.data[i + 3] = 255;
      }
      tc.putImageData(id, 0, 0);
      const pat = ctx.createPattern(t, 'repeat'), k = 3.4 * ppm / P;
      ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(-58 * Math.PI / 180); ctx.scale(k, k); ctx.translate(-W / 2 / k, -H / 2 / k);
      ctx.fillStyle = pat; const big = Math.hypot(W, H) * 1.3 / k; ctx.fillRect(-big, -big, 3 * big, 3 * big); ctx.restore();
    } else if (kind === 'sand') {
      const P = 512, t = mk(P, P), tc = t.getContext('2d'), id = tc.createImageData(P, P), r = rng(5);
      for (let i = 0; i < P * P; i++) { const v = r(), g = v < 0.46 ? 38 + 20 * r() : 90 + 165 * Math.pow(r(), 0.8); id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = g; id.data[i * 4 + 3] = 255; }
      tc.putImageData(id, 0, 0);
      const pat = ctx.createPattern(t, 'repeat'), k = Math.max(0.9, ppm / 4.2);
      ctx.save(); ctx.scale(k, k); ctx.fillStyle = pat; ctx.fillRect(0, 0, W / k + 4, H / k + 4); ctx.restore();
    }
    return c;
  }

  /* ----------------------------------------------------------------------------------
   * FACTORY CATALOG - the nine tiles of the factory "Surface Style Options" sheet, split in two axes:
   *   SURFACES (7) = what the whole face is made of      INKS (3 + paint) = how graphics are applied
   * ---------------------------------------------------------------------------------- */
  const SURFACES = {
    'matte':           { label: 'Matte',                         set: { paint: true,  sheen: 'matte', relief: 'smooth', border: false } },
    'shiny':           { label: 'Shiny',                         set: { paint: true,  sheen: 'shiny', relief: 'smooth', border: false } },
    'sand':            { label: 'Sand grit',                     set: { paint: false, sheen: 'shiny', relief: 'sand',   reliefStrength: 1 } },
    'shiny-carbon':    { label: 'Shiny + carbon visible',        set: { paint: false, sheen: 'shiny', relief: 'smooth', border: false } },
    '3d-matte':        { label: '3D + matte',                    set: { paint: true,  sheen: 'matte', relief: 'plate',  reliefStrength: 1 } },
    '3d-shiny-carbon': { label: '3D + shiny + carbon visible',   set: { paint: false, sheen: 'shiny', relief: 'plate',  reliefStrength: 1 } },
    '3d-hex':          { label: '3D hexagon',                    set: { paint: false, sheen: 'shiny', relief: 'hex',    reliefStrength: 1 } }
  };
  const INKS = { paint: 'Paint', laser: 'Laser (holographic)', gold: 'Gold hot stamping', silver: 'Silver hot stamping' };
  const holoCache = {};
  function holoTile(ink) {
    if (holoCache[ink]) return holoCache[ink];
    const S = 256, c = mk(S, S), x = c.getContext('2d'), r = rng(ink.length * 17 + 3), cell = 16;
    for (let j = 0; j < S / cell; j++) for (let i = 0; i < S / cell; i++) {
      const band = ((i + j) * 28) % 360, v = r();
      let col;
      if (ink === 'laser') col = `hsl(${(band + v * 90) % 360},92%,${62 + v * 22}%)`;
      else if (ink === 'gold') col = v > 0.82 ? `hsl(${(band) % 360},80%,72%)` : `hsl(${40 + v * 10},${78 + v * 12}%,${50 + v * 26}%)`;
      else col = v > 0.82 ? `hsl(${band},70%,80%)` : `hsl(215,${6 + v * 10}%,${70 + v * 24}%)`;
      x.fillStyle = col; x.fillRect(i * cell, j * cell, cell, cell);
      const g = x.createLinearGradient(i * cell, j * cell, (i + 1) * cell, (j + 1) * cell); g.addColorStop(0, 'rgba(255,255,255,.45)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.18)');
      x.fillStyle = g; x.fillRect(i * cell, j * cell, cell, cell);
    }
    return (holoCache[ink] = c);
  }

  /* ----------------------------------------------------------------------------------
   * Decals (mm space -> canvas). `map(x,y)` returns canvas px.
   * ---------------------------------------------------------------------------------- */
  const GEM = { a: [[0, 0], [-0.25, 0.9], [-0.1, 1.8], [0.3, 2.6]], b: [[1.1, 0.1], [0.95, 1.0], [1.2, 1.9], [1.7, 2.7]] };
  function drawDecals(ctx, decals, map, ppm, ovr = {}) {
    for (const d of decals) {
      const col = ovr[d.group] || d.color;
      ctx.save(); ctx.globalAlpha = d.alpha == null ? 1 : d.alpha; ctx.fillStyle = col; ctx.strokeStyle = col;
      const [px, py] = map(d.x || 0, d.y || 0);
      if (d.type === 'text') {
        ctx.translate(px, py); if (d.rot) ctx.rotate(d.rot * Math.PI / 180);
        ctx.font = `800 ${d.size * ppm * 1.35}px "Arial Black","Helvetica Neue",Arial,sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        if ('letterSpacing' in ctx) ctx.letterSpacing = (d.spacing || 0) * ppm * 0.45 + 'px';
        ctx.fillText(d.text, 0, 0);
      } else if (d.type === 'logo' && typeof NORA_GEMINI_DATA !== 'undefined') {
        const k = d.width * ppm / 987;
        ctx.translate(px, py); ctx.scale(k, k); ctx.beginPath();
        for (const poly of NORA_GEMINI_DATA.LOGO) { poly.forEach((p, i) => (i ? ctx.lineTo(p[0] - 545.5, p[1] - 127.5) : ctx.moveTo(p[0] - 545.5, p[1] - 127.5))); ctx.closePath(); }
        ctx.fill('evenodd');
      } else if (d.type === 'poly') {
        ctx.beginPath(); d.points.forEach((p, i) => { const q = map(p[0], p[1]); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.closePath(); ctx.fill();
      } else if (d.type === 'ring') {
        ctx.lineWidth = d.w * ppm; ctx.beginPath(); ctx.arc(px, py, d.r * ppm, 0, Math.PI * 2); ctx.stroke();
      } else if (d.type === 'constellation') {
        const s = d.scale * ppm / 2.8; ctx.lineWidth = Math.max(1.2, 0.45 * ppm);
        const chains = [GEM.a, GEM.b];
        for (const ch of chains) {
          ctx.beginPath(); ch.forEach((p, i) => { const x = px + p[0] * s, y = py - p[1] * s; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
          ch.forEach(p => { ctx.beginPath(); ctx.arc(px + p[0] * s, py - p[1] * s, 0.9 * ppm, 0, Math.PI * 2); ctx.fill(); });
        }
        ctx.beginPath(); ctx.moveTo(px + GEM.a[1][0] * s, py - GEM.a[1][1] * s); ctx.lineTo(px + GEM.b[1][0] * s, py - GEM.b[1][1] * s); ctx.stroke();
      } else if (d.type === 'stripe') {
        ctx.translate(px, py); ctx.rotate((d.rot || 0) * Math.PI / 180); ctx.fillRect(-d.len * ppm / 2, -d.w * ppm / 2, d.len * ppm, d.w * ppm);
      }
      ctx.restore();
    }
  }

  /* ----------------------------------------------------------------------------------
   * Face composer: colour + bump + roughness/metal canvases for one racket face.
   * `geo` = { bb, inner:[loops in mm] (even-odd clip for the matte interior) }
   * ---------------------------------------------------------------------------------- */
  function composeFace(cv, cfg, side, geo, ui) {
    const { color, bump, rm } = cv, W = color.width, H = color.height, bb = geo.bb, ppm = W / bb.w;
    const cc = color.getContext('2d'), bc = bump.getContext('2d'), rc = rm.getContext('2d');
    const tile = weaveTile(cfg.weave, cfg.tint), sc = cfg.weaveScale || 1.8;
    const flip = side === 'B';
    const map = (x, y) => [((flip ? bb.x1 - x : x - bb.x0) / bb.w) * W, (1 - (y - bb.y0) / bb.h) * H];
    // 1. weave base
    cc.setTransform(1, 0, 0, 1, 0, 0); bc.setTransform(1, 0, 0, 1, 0, 0); rc.setTransform(1, 0, 0, 1, 0, 0);
    fillPattern(cc, tile.color, ppm, tile.tileMM, sc, 0, W, H);
    fillPattern(bc, tile.bump, ppm, tile.tileMM, sc, 0, W, H);
    fillPattern(rc, tile.rm, ppm, tile.tileMM, sc, 0, W, H);
    bc.save(); bc.globalAlpha = 0.5; bc.fillStyle = 'rgb(128,128,128)'; bc.fillRect(0, 0, W, H); bc.restore();   // soften weave bump (kills glint aliasing)
    // gloss slider: lower roughness everywhere (clear-coat feel), keeps B (metal) channel
    const gl = cfg.gloss == null ? 0.4 : cfg.gloss, sh = cfg.sheen || '';
    const metal = cfg.paint ? 0 : tile.metal;
    if (cfg.paint) {                              // opaque lacquer: carbon hidden, only a ghost of the weave left
      cc.save(); cc.globalAlpha = 0.94; cc.fillStyle = cfg.tint || '#d11f3f'; cc.fillRect(0, 0, W, H); cc.restore();
      bc.save(); bc.globalAlpha = 0.85; bc.fillStyle = 'rgb(128,128,128)'; bc.fillRect(0, 0, W, H); bc.restore();
      rc.save(); rc.fillStyle = 'rgb(255,110,0)'; rc.fillRect(0, 0, W, H); rc.restore();
    }
    // 2. matte / sand / hex interior
    const relief = cfg.relief || 'smooth', str = cfg.reliefStrength == null ? 1 : cfg.reliefStrength;
    let reliefOn = relief !== 'smooth' && str > 0.01;
    const region = () => {
      const p = new Path2D();
      const loops = cfg.border ? geo.innerBorder(cfg.borderMm || 12) : geo.inner0;
      for (const L of loops) L.forEach((q, i) => { const m = map(q[0], q[1]); i ? p.lineTo(m[0], m[1]) : p.moveTo(m[0], m[1]); }), p.closePath();
      return p;
    };
    if (reliefOn) {
      const rl = reliefCanvas(relief, W, H, ppm, str);
      const clip = region();
      // bump
      bc.save(); bc.clip(clip, 'evenodd'); bc.globalAlpha = 0.88; bc.drawImage(rl, 0, 0); bc.restore();
      // valleys darken the colour slightly
      cc.save(); cc.clip(clip, 'evenodd'); cc.globalCompositeOperation = 'multiply'; cc.globalAlpha = 0.34 * str; cc.drawImage(rl, 0, 0);
      cc.globalCompositeOperation = 'source-over';
      // matte pass: bleach the colour a little where relief peaks are (dry sand look)
      cc.globalAlpha = 0.06 * str; cc.globalCompositeOperation = 'screen'; cc.drawImage(rl, 0, 0); cc.restore();
      // roughness: matte interior
      rc.save(); rc.clip(clip, 'evenodd');
      const m = Math.round(metal * 255), rr = sh === 'shiny' ? (relief === 'sand' ? 0.3 : 0.16) : sh === 'matte' ? 0.76 : (relief === 'sand' ? 0.70 : relief === 'hex' ? 0.64 : 0.58);
      rc.globalAlpha = 0.82 * Math.min(1, str + 0.15); rc.fillStyle = `rgb(255,${Math.round(255 * rr)},${m})`; rc.fillRect(0, 0, W, H);
      rc.restore();
    }
    // shiny border: very low roughness outside the interior clip
    if (cfg.border && (reliefOn || relief === 'smooth')) {
      rc.save(); const clip = region(); rc.globalCompositeOperation = 'source-over';
      const all = new Path2D(); all.rect(0, 0, W, H); all.addPath(clip);
      rc.clip(all, 'evenodd'); rc.globalAlpha = 0.92;
      rc.fillStyle = `rgb(255,${Math.round(255 * (0.10 + 0.06 * (1 - gl)))},${Math.round(metal * 255)})`; rc.fillRect(0, 0, W, H); rc.restore();
    }
    if (!reliefOn && !cfg.border) {            // flat face: matte lacquer or gloss
      rc.save(); rc.globalAlpha = 0.9; rc.fillStyle = `rgb(255,${Math.round(255 * (sh === 'matte' ? 0.8 : 0.08 + 0.10 * (1 - gl)))},${Math.round(metal * 255)})`; rc.fillRect(0, 0, W, H); rc.restore();
    }
    // 3. decals
    const off = {}; if (ui && ui.logoColor) { off.logo = ui.logoColor; off.type = ui.logoColor; }
    const g = ui ? ui.groups : { logo: true, type: true, stripe: true };
    let decals = (cfg.decals || []).filter(d => g[d.group || 'logo']);
    if (ui && ui.customText) {
      decals = decals.filter(d => !(d.group === 'logo'));
      const base = (cfg.decals || []).find(d => d.group === 'logo');
      decals.push({ type: 'text', group: 'logo', text: ui.customText, x: 0, y: base && base.y ? base.y : 300, size: Math.min(26, 200 / Math.max(4, ui.customText.length) * 1.2), spacing: 5, color: base ? base.color : '#ffffff', alpha: 0.95 });
    }
    cc.setTransform(1, 0, 0, 1, 0, 0);
    const ink = (ui && ui.ink) || cfg.ink || 'paint';
    if (cv.fx) { const fc = cv.fx.getContext('2d'); fc.setTransform(1, 0, 0, 1, 0, 0); fc.fillStyle = '#000'; fc.fillRect(0, 0, W, H); }
    if (ink !== 'paint' && cv.fx && cv.tmp) {       // foil inks: laser film / gold / silver hot stamping on logo + typography
      const foil = decals.filter(d => d.group !== 'stripe'); decals = decals.filter(d => d.group === 'stripe');
      const tc = cv.tmp.getContext('2d'); tc.setTransform(1, 0, 0, 1, 0, 0); tc.globalCompositeOperation = 'source-over'; tc.clearRect(0, 0, W, H);
      drawDecals(tc, foil.map(d => ({ ...d, alpha: 1, color: '#fff' })), map, ppm, {});
      tc.globalCompositeOperation = 'source-in';
      const pat = tc.createPattern(holoTile(ink), 'repeat'), k = Math.max(0.5, ppm / 5);
      tc.save(); tc.scale(k, k); tc.fillStyle = pat; tc.fillRect(0, 0, W / k + 2, H / k + 2); tc.restore(); cc.drawImage(cv.tmp, 0, 0);
      tc.fillStyle = 'rgb(255,46,255)'; tc.fillRect(0, 0, W, H); rc.drawImage(cv.tmp, 0, 0);             // smooth + metallic
      tc.fillStyle = '#fff'; tc.fillRect(0, 0, W, H); cv.fx.getContext('2d').drawImage(cv.tmp, 0, 0);      // iridescence mask
      tc.fillStyle = 'rgb(150,150,150)'; tc.fillRect(0, 0, W, H); bc.drawImage(cv.tmp, 0, 0);              // foil lies flat over the relief
      tc.globalCompositeOperation = 'source-over';
    }
    drawDecals(cc, decals, map, ppm, off);
    // decals read as slightly inked-in: lower the bump a hair where they are
    bc.save(); bc.globalAlpha = 0.18; bc.globalCompositeOperation = 'multiply'; bc.restore();
    return { reliefOn, tile };
  }

  /* ----------------------------------------------------------------------------------
   * Frame texture: weave + coloured accent stripe. u = along tube (200 mm per repeat), v = around profile.
   * ---------------------------------------------------------------------------------- */
  function composeFrame(cv, frame, profileMM, bumpOnly) {
    const { color, bump, rm } = cv, W = color.width, H = color.height;
    const tile = weaveTile(frame.weave || '3k-twill', frame.tint || '#d11f3f');
    const ppU = W / 200, ppV = H / profileMM, sc = 1.6;
    const cc = color.getContext('2d'), bc = bump.getContext('2d'), rc = rm.getContext('2d');
    cc.setTransform(1, 0, 0, 1, 0, 0); bc.setTransform(1, 0, 0, 1, 0, 0); rc.setTransform(1, 0, 0, 1, 0, 0);
    for (const [ctx, t] of [[cc, tile.color], [bc, tile.bump], [rc, tile.rm]]) {
      const pat = ctx.createPattern(t, 'repeat'), ku = ppU * tile.tileMM * sc / t.width, kv = ppV * tile.tileMM * sc / t.height;
      ctx.save(); ctx.scale(ku, kv); ctx.fillStyle = pat; ctx.fillRect(0, 0, W / ku, H / kv); ctx.restore();
    }
    bc.save(); bc.globalAlpha = 0.5; bc.fillStyle = 'rgb(128,128,128)'; bc.fillRect(0, 0, W, H); bc.restore();
    const matte = frame.finish === 'matte';
    rc.save(); rc.globalAlpha = 0.88; rc.fillStyle = `rgb(255,${matte ? 168 : 40},${Math.round(tile.metal * 255)})`; rc.fillRect(0, 0, W, H); rc.restore();
    cc.save(); cc.globalAlpha = 0.58; cc.fillStyle = frame.color || '#0d0d10'; cc.fillRect(0, 0, W, H); cc.restore();
    if (frame.stripe) {
      const s = frame.stripe;
      cc.save(); cc.globalAlpha = 0.95; cc.fillStyle = s.color; cc.fillRect(0, (1 - s.to) * H, W, (s.to - s.from) * H); cc.restore();
      rc.save(); rc.globalAlpha = 0.9; rc.fillStyle = `rgb(255,${matte ? 140 : 30},0)`; rc.fillRect(0, (1 - s.to) * H, W, (s.to - s.from) * H); rc.restore();
    }
    return tile;
  }

  /* ----------------------------------------------------------------------------------
   * EVA foam: micro-cellular colour + bump. u = along wall (12 mm per repeat), v = across thickness (0..1, B -> A)
   * ---------------------------------------------------------------------------------- */
  function composeEva(cv, core, thicknessMM = 35) {
    const { color, bump } = cv, W = color.width, H = color.height, cc = color.getContext('2d'), bc = bump.getContext('2d');
    const bands = core.kind === 'layered' && core.layers ? core.layers : [{ color: core.color, from: 0, to: 1 }];
    cc.fillStyle = core.color; cc.fillRect(0, 0, W, H);
    for (const b of bands) { cc.fillStyle = b.color; cc.fillRect(0, (1 - b.to) * H, W, (b.to - b.from) * H + 1); }
    bc.fillStyle = 'rgb(128,128,128)'; bc.fillRect(0, 0, W, H);
    const r = rng(11), N = Math.round(W * H / 55);
    for (let i = 0; i < N; i++) {
      const x = r() * W, y = r() * H, rad = 1.2 + r() * r() * 4.2, dark = r() < 0.6;
      for (const ox of [0, x < 8 ? W : (x > W - 8 ? -W : 0)]) {
        cc.fillStyle = dark ? 'rgba(0,0,0,0.24)' : 'rgba(255,255,255,0.12)';
        cc.beginPath(); cc.arc(x + ox, y, rad, 0, 7); cc.fill();
        const g = bc.createRadialGradient(x + ox, y, 0, x + ox, y, rad);
        g.addColorStop(0, 'rgba(25,25,25,0.95)'); g.addColorStop(0.75, 'rgba(60,60,60,0.8)'); g.addColorStop(1, 'rgba(128,128,128,0)');
        bc.fillStyle = g; bc.beginPath(); bc.arc(x + ox, y, rad, 0, 7); bc.fill();
      }
    }
  }

  /* ----------------------------------------------------------------------------------
   * Overgrip: diagonal wrap with overlap ridge + perforations. Tileable.
   * ---------------------------------------------------------------------------------- */
  function composeGrip(cv, hex) {
    const { color, bump } = cv, S = color.width, cc = color.getContext('2d'), bc = bump.getContext('2d');
    const base = hexRgb(hex), P = S / 2;
    const cd = cc.createImageData(S, S), bd = bc.createImageData(S, S), r = rng(3);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const d = ((x + y) % P) / P;                           // diagonal tape coordinate (periodic)
      const ridge = d < 0.09 ? 1 - d / 0.09 : 0, edge = d > 0.91 ? (d - 0.91) / 0.09 : 0;
      const dots = ((x % 8) - 4) ** 2 + ((y % 8) - 4) ** 2 < 2.4 ? 1 : 0;
      const n = r() * 0.12;
      const k = 0.92 - 0.35 * edge + 0.28 * ridge - 0.3 * dots + n - 0.06;
      const i = (y * S + x) * 4;
      cd.data[i] = clamp(base[0] * k + 8 * ridge, 0, 255); cd.data[i + 1] = clamp(base[1] * k + 8 * ridge, 0, 255); cd.data[i + 2] = clamp(base[2] * k + 8 * ridge, 0, 255); cd.data[i + 3] = 255;
      const h = 150 + 90 * ridge - 70 * edge - 80 * dots + n * 80;
      bd.data[i] = bd.data[i + 1] = bd.data[i + 2] = clamp(h, 0, 255); bd.data[i + 3] = 255;
    }
    cc.putImageData(cd, 0, 0); bc.putImageData(bd, 0, 0);
  }
  function composeCap(canvas, mold) {
    const S = canvas.width, c = canvas.getContext('2d'), cfg = mold.handle.cap || { color: '#111', text: 'N' };
    const g = c.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2); g.addColorStop(0, '#2a2a30'); g.addColorStop(1, cfg.color);
    c.fillStyle = g; c.fillRect(0, 0, S, S);
    c.strokeStyle = (mold.faces.A && mold.faces.A.tint) || '#fff'; c.lineWidth = S * 0.025; c.beginPath(); c.arc(S / 2, S / 2, S * 0.38, 0, 7); c.stroke();
    c.fillStyle = '#f2f2f4'; c.font = `800 ${S * 0.42}px Arial Black, Arial, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(cfg.text || 'N', S / 2, S / 2 + S * 0.02);
  }

  /* heat maps: normalised float field -> canvas (R channel); inside = mask in G */
  function composeHeat(canvas, field, w, h) {
    const c = canvas.getContext('2d'), id = c.createImageData(w, h);
    for (let i = 0; i < w * h; i++) { id.data[i * 4] = field[i] * 255; id.data[i * 4 + 1] = 0; id.data[i * 4 + 2] = 0; id.data[i * 4 + 3] = 255; }
    c.putImageData(id, 0, 0);
  }

  return { WEAVES, SURFACES, INKS, weaveTile, composeFace, composeFrame, composeEva, composeGrip, composeCap, composeHeat, mk };
})();
