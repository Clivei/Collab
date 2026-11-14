"""NORA Gemini v4 - deck pick: Face I = 1C (black, red glyph fading into gloss 3K carbon), Face II = 3A (white, red laser-hatched glyph).
Same Gemini glyph, same position and GEMINI band on both faces; solid NORA on both; I / II markers; mirror-gloss border;
frame half black / half white with a red pinstripe; X-brace throat; holes kept out of the glyph stems."""
WIN = [np.asarray(w) for w in V4_WINDOWS]
HOLES = np.unique(np.round(HOLES, 1), axis=0)
RIBS = []
RED4 = (0.80, 0.03, 0.07)


def make_art4():
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
        adv = 6.6 * u
        x0 = cx - (len(s) * adv - 2.6 * u) / 2
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
        r0, r1 = max(int((cz - 12 - TB[2]) * PX), 0), min(int((cz + 12 - TB[2]) * PX), H)
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

    # ---- the Gemini glyph as a signed distance field (mm). Stems sit between hole columns (x = 0 and +-30).
    ax_ = np.abs(X)
    stem = np.maximum(np.abs(ax_ - 15.4) - 7.6 - 0.008 * np.abs(Z - 340), np.abs(Z - 340.0) - 60.0)
    topc = 397.0 + 0.0042 * X * X
    top = np.maximum(np.abs(Z - (topc + 9.5)) - 9.5, ax_ - 68.0)
    botc = 283.0 - 0.0042 * X * X
    bot = np.maximum(np.abs(Z - (botc - 9.5)) - 9.5, ax_ - 68.0)
    sdf = np.minimum.reduce([stem, top, bot])
    glyph = 1 - sm(-0.15, 0.15, sdf)
    key = (1 - sm(1.0, 1.3, np.abs(sdf - 1.15))) * (1 - glyph)        # 1 mm keyline just outside the glyph
    P = np.c_[X.ravel(), Z.ravel()]
    edge = np.concatenate([seg_dist(P[i:i + 400000], OUTLINE[::2]) for i in range(0, len(P), 400000)]).reshape(H, W)
    border = 1 - sm(10.6, 10.8, edge)
    hue = np.mod((X * 0.9 + Z * 0.5) / 55.0, 1.0)[..., None] * 6.0
    laser = 0.55 + 0.45 * np.clip(np.abs(np.mod(hue + [0, 4, 2], 6.0) - 3.0) - 1.0, 0, 1)
    f3, g3 = X / 2.0, Z / 2.0
    p3x, p3z = 0.5 - 0.5 * np.cos(2 * np.pi * f3), 0.5 - 0.5 * np.cos(2 * np.pi * g3)
    warp3 = ((np.floor(f3).astype(np.int32) - np.floor(g3).astype(np.int32)) % 4) < 2
    w3 = np.where(warp3, 0.085 + 0.075 * p3x, 0.045 + 0.04 * p3z)
    red = np.array(RED4, np.float32)
    zero = np.zeros((H, W), np.float32)
    out = {}
    for face, sx in ((1, 1), (2, -1)):
        nora = logo(0, 437, 62, sx)
        band = np.maximum(text("GEMINI", 0, 236, 6.0, 1.0, sx), text("I" if face == 1 else "II", 0, 225.5, 3.4, 0.7, sx))
        if face == 1:                                   # 1C: matte sand black, glyph red -> gloss 3K carbon
            fade = sm(300.0, 372.0, Z)
            carbon = (w3 * 1.6)[..., None] * np.array([1, 1, 1.04], np.float32)
            gcol = red * (0.55 + 0.45 * fade)[..., None] * fade[..., None] + carbon * (1 - fade)[..., None]
            field = np.full((H, W, 3), 0.03, np.float32) + (w3 * 0.10)[..., None]
            edgec = carbon
            col = field * (1 - glyph[..., None]) + gcol * glyph[..., None]
            col = col * (1 - border[..., None]) + edgec * border[..., None]
            rough = 0.74 * (1 - np.maximum(glyph, border)) + 0.07 * np.maximum(glyph, border)
            metal = zero.copy()
            height = 0.05 * np.where(warp3, p3x, p3z) + 0.1 * glyph
            grit = (1 - glyph) * (1 - border)
            foil = key
            ink = [(nora, (0.94, 0.94, 0.95)), (band, RED4)]
        else:                                           # 3A: matte white, red laser hatching, red keyline
            d45 = (X + Z) / math.sqrt(2.0)
            hatch = glyph * (1 - sm(0.9, 1.15, np.abs(np.mod(d45, 4.0) - 2.0)))
            white = np.array([0.84, 0.84, 0.82], np.float32)
            col = np.ones((H, W, 3), np.float32) * white
            col = col * (1 - hatch[..., None]) + (red * 0.8 + laser * 0.2) * hatch[..., None]
            col = col * (1 - key[..., None]) + red * key[..., None]
            rough = 0.58 * (1 - border) + 0.07 * border
            rough = rough * (1 - hatch) + 0.2 * hatch
            metal = zero.copy()
            height = 0.12 * hatch + 0.05 * key
            grit = 0.35 * (1 - border) * (1 - hatch) * (1 - key)
            foil = hatch
            ink = [(nora, RED4), (band, (0.12, 0.12, 0.13))]
        for m_, c_ in ink:
            col = col * (1 - m_[..., None]) + np.array(c_, np.float32) * m_[..., None]
            rough = rough * (1 - m_) + 0.25 * m_
            grit = grit * (1 - m_)
        col = col * (1 - (key * (face == 1))[..., None]) + laser * (key * (face == 1))[..., None]
        metal = metal * (1 - foil) + foil
        out[face] = (np.dstack([col, foil]).astype(np.float32), np.dstack([np.clip(height, 0, 1), rough, metal, grit]).astype(np.float32))
    return out, (W, H)


def build_v4():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)
    art, wh = make_art4()
    mats = [
        face_mat("MAT_Face_I_1C_MatteSand_RedCarbonGlyph", to_image("V4_FaceI_color", art[1][0], wh, "sRGB"),
                 to_image("V4_FaceI_height_rough_metal", art[1][1], wh, "Non-Color"), 0.9, 0.12, 0.0),
        face_mat("MAT_Face_II_3A_MatteWhite_LaserHatch", to_image("V4_FaceII_color", art[2][0], wh, "sRGB"),
                 to_image("V4_FaceII_height_rough_metal", art[2][1], wh, "Non-Color"), 0.35, 0.06, 0.0),
        mat("MAT_EVA_Core_White", (0.88, 0.88, 0.86), 0.85),
        mat("MAT_Rim_A_Black_Gloss", (0.02, 0.02, 0.022), 0.18, 0, 0.9),
        mat("MAT_Rim_B_White_Gloss", (0.86, 0.86, 0.85), 0.2, 0, 0.9),
        mat("MAT_Rim_Red_Pinstripe", RED4, 0.15, 0, 0.9),
        mat("MAT_Rim_Center_Carbon", (0.045, 0.045, 0.05), 0.28, 0, 0.6),
    ]
    body = build_body()
    body.name = "HERO_GeminiV4_Body"
    bm = bmesh.new()                       # drop stray slivers the curve fill / rim bevel leave below the throat
    bm.from_mesh(body.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z / MM < 127.0 or abs(v.co.y) / MM > 20], context="VERTS")
    bm.to_mesh(body.data)
    bm.free()
    for m in mats:
        body.data.materials.append(m)
    g = loft("HERO_GeminiV4_Grip", GRIP, mat("MAT_Grip_Black", (0.035, 0.035, 0.04), 0.7))
    c = loft("HERO_GeminiV4_Collar", COLLAR, mats[3], True, True)
    bt = loft("HERO_GeminiV4_ButtCap", BUTT, mats[5], True, True)
    root = bpy.data.objects.new("HERO_NORA_Gemini_V4", None)
    bpy.context.scene.collection.objects.link(root)
    for o in (body, g, c, bt):
        o.parent = root
    bpy.context.view_layer.update()
    return {"dims_mm": [round(v / MM, 1) for v in body.dimensions], "verts": len(body.data.vertices),
            "faces": len(body.data.polygons), "holes": len(HOLES),
            "mat_counts": [sum(1 for p in body.data.polygons if p.material_index == i) for i in range(7)]}
