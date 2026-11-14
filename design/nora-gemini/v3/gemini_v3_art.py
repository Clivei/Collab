"""NORA Gemini v3 "Twin" - stays inside the market pattern (big centred wordmark through the holes, dark base, one accent,
model band above the throat, mirror-gloss edge) but is unique in how it is made:
  * the wordmark is NOT printed - it is a change of finish (gloss carbon inside matte sand, or the reverse) with a laser keyline
  * front and back share the layout and invert the finish and accent (crimson attack / cobalt control)
  * eight drilled holes carry laser-foil rings: the Gemini stars
Needs: v2 data (LOGO), gemini_v3_shape.py, gemini_v2_body.py, gemini_v2_art.py (to_image, face_mat, FONT), gemini_v2_stage.py"""
WIN = [pts(WC)]          # single delta window
HOLES = np.unique(np.round(HOLES, 1), axis=0)   # centre-line holes are not mirrored twice
RIBS = []                # the old mould's power ribs do not exist on this mould
V3_STARS = [(-38, 420), (-27, 371), (-45, 322), (-60, 281), (-72, 356), (24, 426), (37, 381), (29, 331), (13, 287), (74, 394)]
CRIMSON, COBALT = (0.82, 0.06, 0.16), (0.07, 0.36, 0.86)


def make_art3():
    W, H = int((TB[1] - TB[0]) * PX), int((TB[3] - TB[2]) * PX)
    X, Z = np.meshgrid(TB[0] + (np.arange(W) + 0.5) / PX, TB[2] + (np.arange(H) + 0.5) / PX)
    X, Z = X.astype(np.float32), Z.astype(np.float32)

    def sm(e0, e1, v):
        t = np.clip((v - e0) / (e1 - e0), 0, 1)
        return t * t * (3 - 2 * t)

    def seg(ax, az, bx, bz, xx, zz):
        dx, dz = bx - ax, bz - az
        t = np.clip(((xx - ax) * dx + (zz - az) * dz) / max(dx * dx + dz * dz, 1e-9), 0, 1)
        return np.hypot(xx - ax - t * dx, zz - az - t * dz)

    def text(s, cx, cz, cap, w, sx):
        u = cap / 6.0
        adv = 6.2 * u
        x0 = cx - (len(s) * adv - 2.2 * u) / 2
        r0, r1 = max(int((cz - cap - TB[2]) * PX), 0), min(int((cz + cap - TB[2]) * PX), H)
        xx, zz = X[r0:r1] * sx, Z[r0:r1]
        d = np.full(xx.shape, 99.0, np.float32)
        for i, ch in enumerate(s):
            for st in FONT[ch]:
                for (a, b), (c, e) in zip(st, st[1:]):
                    d = np.minimum(d, seg(x0 + i * adv + a * u, cz - cap / 2 + b * u, x0 + i * adv + c * u,
                                          cz - cap / 2 + e * u, xx, zz))
        m = np.zeros((H, W), np.float32)
        m[r0:r1] = 1 - sm(w / 2 - 0.12, w / 2 + 0.12, d)
        return m

    def logo(cx, cz, width, sx):
        k = width / 987.0
        r0, r1 = max(int((cz - 20 - TB[2]) * PX), 0), min(int((cz + 20 - TB[2]) * PX), H)
        xx, zz = X[r0:r1] * sx, Z[r0:r1]
        ins = np.zeros(xx.shape, bool)
        for poly in LOGO:
            p = np.array(poly, float).reshape(-1, 2)
            px, pz = cx + (p[:, 0] - 545.5) * k, cz - (p[:, 1] - 127.5) * k
            for i in range(len(px)):
                x1, z1, x2, z2 = px[i], pz[i], px[i - 1], pz[i - 1]
                if z1 != z2:
                    ins ^= ((z1 > zz) != (z2 > zz)) & (xx < (x2 - x1) * (zz - z1) / (z2 - z1) + x1)
        m = np.zeros((H, W), np.float32)
        m[r0:r1] = ins
        return m

    def dilate(m, r_mm):
        r, out = int(round(r_mm * PX)), m.copy()
        for a in np.linspace(0, 2 * np.pi, 16, endpoint=False):
            out = np.maximum(out, np.roll(np.roll(m, int(round(r * math.sin(a))), 0), int(round(r * math.cos(a))), 1))
        return out

    P = np.c_[X.ravel(), Z.ravel()]
    edge = np.concatenate([seg_dist(P[i:i + 400000], OUTLINE[::2]) for i in range(0, len(P), 400000)]).reshape(H, W)
    border = 1 - sm(10.6, 10.8, edge)                                   # mirror-gloss edge
    low = 1 - sm(285, 330, Z)                                           # twin shoulder lines live in the lower head
    twin = (sm(15.0, 15.2, edge) * (1 - sm(17.4, 17.6, edge)) + sm(20.0, 20.15, edge) * (1 - sm(20.9, 21.05, edge))) * low
    ring = np.zeros((H, W), np.float32)
    for sx_, sz_ in V3_STARS:
        i = int(np.argmin(np.hypot(HOLES[:, 0] - sx_, HOLES[:, 1] - sz_)))
        r = np.hypot(X - HOLES[i, 0], Z - HOLES[i, 1]) - HOLES[i, 2] / 2
        ring = np.maximum(ring, sm(-0.2, 0.2, r) * (1 - sm(1.9, 2.2, r)))
    hue = np.mod((X * 0.9 + Z * 0.5) / 55.0, 1.0)[..., None] * 6.0
    laser = 0.55 + 0.45 * np.clip(np.abs(np.mod(hue + [0, 4, 2], 6.0) - 3.0) - 1.0, 0, 1)
    f3, g3 = X / 2.0, Z / 2.0
    p3x, p3z = 0.5 - 0.5 * np.cos(2 * np.pi * f3), 0.5 - 0.5 * np.cos(2 * np.pi * g3)
    warp3 = ((np.floor(f3).astype(np.int32) - np.floor(g3).astype(np.int32)) % 4) < 2
    w3 = np.where(warp3, 0.085 + 0.075 * p3x, 0.045 + 0.04 * p3z)
    f16, g16 = X / 5.5, Z / 5.5
    p16x, p16z = 0.5 - 0.5 * np.cos(2 * np.pi * f16), 0.5 - 0.5 * np.cos(2 * np.pi * g16)
    warp16 = ((np.floor(f16).astype(np.int32) + np.floor(g16).astype(np.int32)) % 2) == 0
    w16 = np.where(warp16, 0.62 + 0.26 * p16x, 0.42 + 0.2 * p16z)

    out = {}
    for face, sx, acc in ((1, 1, CRIMSON), (2, -1, COBALT)):
        mark = logo(0, 330, 196, sx)
        key = np.clip(dilate(mark, 1.1) - mark, 0, 1)                  # laser keyline round the wordmark
        small = np.maximum(text("GEMINI", 0, 232, 5.4, 0.9, sx), text("I  3K" if face == 1 else "II  16K", 0, 223.5, 2.4, 0.46, sx))
        foil = np.maximum.reduce([key, ring])
        accent = np.maximum(twin, small)
        inner = 1 - border
        if face == 1:      # matte sand black field, wordmark = gloss visible 3K carbon
            base = np.full((H, W, 3), 0.028, np.float32) + (w3 * 0.12)[..., None]
            carbon = (w3 * 1.5)[..., None] * np.array([1, 1, 1.04], np.float32)
            gloss = np.maximum(mark, border)
            col = base * (1 - gloss[..., None]) + carbon * gloss[..., None]
            rough = 0.74 * (1 - gloss) + 0.06 * gloss
            metal = np.zeros((H, W), np.float32)
            height = 0.05 * np.where(warp3, p3x, p3z) + 0.0 * mark
            grit = inner * (1 - mark)
        else:              # gloss 16K aluminised field, wordmark = matte sand black
            alu = w16[..., None] * np.array([0.30, 0.33, 0.38], np.float32)
            matte = mark * inner
            col = alu * (1 - matte[..., None]) + 0.03 * matte[..., None]
            rough = (0.16 + 0.1 * (1 - np.where(warp16, p16x, p16z))) * (1 - matte) + 0.74 * matte
            metal = 1 - matte
            height = 0.45 * np.where(warp16, p16x, p16z) * (1 - matte)
            grit = matte
        a3 = accent[..., None]
        col = col * (1 - a3) + np.array(acc, np.float32) * a3
        rough = rough * (1 - accent) + 0.2 * accent
        metal = metal * (1 - accent)
        col = col * (1 - foil[..., None]) + laser * foil[..., None]
        rough = rough * (1 - foil) + 0.28 * foil
        metal = metal * (1 - foil) + foil
        height = np.clip(height + 0.1 * foil + 0.06 * accent, 0, 1)
        grit = grit * (1 - foil) * (1 - accent)
        out[face] = (np.dstack([col, foil]).astype(np.float32), np.dstack([height, rough, metal, grit]).astype(np.float32))
    return out, (W, H)


def build_v3():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.curves, bpy.data.lights, bpy.data.cameras):
        for b in list(coll):
            if b.users == 0:
                coll.remove(b)
    art, wh = make_art3()
    black = (0.018, 0.018, 0.02)
    mats = [
        face_mat("MAT_Face_I_MatteSand_GlossCarbonMark", to_image("V3_FaceI_color", art[1][0], wh, "sRGB"),
                 to_image("V3_FaceI_height_rough_metal", art[1][1], wh, "Non-Color"), 0.9, 0.12, 0.0),
        face_mat("MAT_Face_II_Gloss16KAlu_MatteMark", to_image("V3_FaceII_color", art[2][0], wh, "sRGB"),
                 to_image("V3_FaceII_height_rough_metal", art[2][1], wh, "Non-Color"), 0.9, 0.06, 0.5),
        mat("MAT_EVA_Core_White", (0.86, 0.86, 0.84), 0.85),
        mat("MAT_Rim_Black_A", black, 0.22, 0, 0.8), mat("MAT_Rim_Black_B", black, 0.22, 0, 0.8),
        mat("MAT_Rim_Twin_Line", (0.75, 0.76, 0.8), 0.25, 1.0), mat("MAT_Rim_Carbon", (0.045, 0.045, 0.05), 0.28, 0, 0.6),
    ]
    body = build_body()
    body.name = "HERO_GeminiV3_Body"
    bm = bmesh.new()                       # drop stray slivers the rim bevel can leave below the throat
    bm.from_mesh(body.data)
    bad = [v for v in bm.verts if v.co.z / MM < 127.0 or abs(v.co.x) / MM > 135 or abs(v.co.y) / MM > 20]
    stray = len(bad)
    bmesh.ops.delete(bm, geom=bad, context="VERTS")
    bm.to_mesh(body.data)
    bm.free()
    for m in mats:
        body.data.materials.append(m)
    grip = mat("MAT_Grip_Black", (0.035, 0.035, 0.04), 0.7)
    g = loft("HERO_GeminiV3_Grip", GRIP, grip)
    c = loft("HERO_GeminiV3_Collar", COLLAR, mats[6], True, True)
    bt = loft("HERO_GeminiV3_ButtCap", BUTT, mats[3], True, True)
    root = bpy.data.objects.new("HERO_NORA_Gemini_V3", None)
    bpy.context.scene.collection.objects.link(root)
    for o in (body, g, c, bt):
        o.parent = root
    return {"dims_mm": [round(v / MM, 1) for v in body.dimensions], "verts": len(body.data.vertices),
            "faces": len(body.data.polygons), "holes": len(HOLES), "stray_removed": stray}
