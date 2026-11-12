FONT = {
    "G": [[(4, 5), (3, 6), (1, 6), (0, 5), (0, 1), (1, 0), (4, 0), (4, 3), (2, 3)]],
    "E": [[(4, 6), (0, 6), (0, 0), (4, 0)], [(0, 3), (3, 3)]],
    "M": [[(0, 0), (0, 6), (2, 2.5), (4, 6), (4, 0)]],
    "I": [[(2, 0), (2, 6)]],
    "N": [[(0, 0), (0, 6), (4, 0), (4, 6)]],
    "3": [[(0, 6), (4, 6), (2, 3.5), (4, 2.3), (4, 1), (3, 0), (0, 0)]],
    "K": [[(0, 0), (0, 6)], [(4, 6), (0, 2.6)], [(1.6, 3.8), (4, 0)]],
    "1": [[(1, 4.8), (2.4, 6), (2.4, 0)]],
    "6": [[(4, 6), (1, 6), (0, 5), (0, 1), (1, 0), (3, 0), (4, 1), (4, 2.4), (3, 3.4), (0, 3.4)]],
    " ": [],
}
# Gemini constellation, twins Castor (left) and Pollux (right), world mm
STARS = [(-38, 420, 1), (-27, 371, 0), (-45, 322, 0), (-60, 281, 0), (-72, 356, 0),
         (24, 426, 1), (37, 381, 0), (29, 331, 0), (13, 287, 0), (74, 394, 0)]
LINKS = [(0, 1), (1, 2), (2, 3), (1, 4), (5, 6), (6, 7), (7, 8), (6, 9), (1, 6)]
ANG = math.radians(58)
SPLIT0 = (-25.0, 300.0)


def make_art():
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

    def crop(x0, x1, z0, z1):
        c0, c1 = int((x0 - TB[0]) * PX), int((x1 - TB[0]) * PX) + 1
        r0, r1 = int((z0 - TB[2]) * PX), int((z1 - TB[2]) * PX) + 1
        return slice(max(r0, 0), min(r1, H)), slice(max(c0, 0), min(c1, W))

    def text(s, cx, cz, cap, w, sx):
        u = cap / 6.0
        adv = 6.2 * u
        x0 = cx - (len(s) * adv - 2.2 * u) / 2
        m = np.zeros((H, W), np.float32)
        sl = crop(cx - len(s) * adv, cx + len(s) * adv, cz - cap, cz + cap)
        xx, zz = X[sl] * sx, Z[sl]
        d = np.full(xx.shape, 99.0, np.float32)
        for i, ch in enumerate(s):
            for st in FONT[ch]:
                for (a, b), (c, e) in zip(st, st[1:]):
                    d = np.minimum(d, seg(x0 + i * adv + a * u, cz - cap / 2 + b * u, x0 + i * adv + c * u,
                                          cz - cap / 2 + e * u, xx, zz))
        m[sl] = 1 - sm(w / 2 - 0.12, w / 2 + 0.12, d)
        return m

    def logo(cx, cz, width, sx):
        k = width / 987.0
        m = np.zeros((H, W), np.float32)
        sl = crop(cx - width / 2 - 1, cx + width / 2 + 1, cz - 8, cz + 8)
        xx, zz = X[sl] * sx, Z[sl]
        ins = np.zeros(xx.shape, bool)
        for poly in LOGO:
            p = np.array(poly, float).reshape(-1, 2)
            px, pz = cx + (p[:, 0] - 545.5) * k, cz - (p[:, 1] - 127.5) * k
            for i in range(len(px)):
                x1, z1, x2, z2 = px[i], pz[i], px[i - 1], pz[i - 1]
                if z1 == z2:
                    continue
                c = ((z1 > zz) != (z2 > zz)) & (xx < (x2 - x1) * (zz - z1) / (z2 - z1) + x1)
                ins ^= c
        m[sl] = ins
        return m

    # the cut: one diagonal plane through the racket
    nx, nz = math.sin(ANG), -math.cos(ANG)
    d = (X - SPLIT0[0]) * nx + (Z - SPLIT0[1]) * nz
    t = (X - SPLIT0[0]) * math.cos(ANG) + (Z - SPLIT0[1]) * math.sin(ANG)
    s1 = (d > 5) & (d < 8.5) & (t > -45) & (t < 100)
    s2 = (d > 12) & (d < 13.2) & (t > -15) & (t < 125)
    s3 = (d > -9.5) & (d < -6.5) & (t > -75) & (t < 60)
    paint1 = ((d < 0) & ~s3) | s1 | s2

    # shared ink (same in world space on both faces): constellation + edge pinstripe
    star = np.zeros((H, W), np.float32)
    near = np.full((H, W), 99.0, np.float32)
    for x, z, big in STARS:
        r = np.hypot(X - x, Z - z)
        near = np.minimum(near, r)
        star = np.maximum(star, 1 - sm(1.25, 1.5, r))
        if big:
            ast = np.sqrt(np.abs(X - x)) + np.sqrt(np.abs(Z - z))
            star = np.maximum(star, 1 - sm(math.sqrt(6.5) - 0.06, math.sqrt(6.5) + 0.06, ast))
    ld = np.full((H, W), 99.0, np.float32)
    for a, b in LINKS:
        ld = np.minimum(ld, seg(STARS[a][0], STARS[a][1], STARS[b][0], STARS[b][1], X, Z))
    lines = (1 - sm(0.22, 0.42, ld)) * sm(2.6, 3.0, near)
    P = np.c_[X.ravel(), Z.ravel()]
    edge = np.concatenate([seg_dist(P[i:i + 400000], OUTLINE[::2]) for i in range(0, len(P), 400000)]).reshape(H, W)
    pin = sm(12.3, 12.5, edge) * (1 - sm(13.0, 13.2, edge))
    border = 1 - sm(12.6, 12.8, edge)  # shiny frame: fibre under gloss, no sand
    hue = np.mod((X * 0.9 + Z * 0.5) / 55.0, 1.0)[..., None] * 6.0  # laser foil base tint
    laser = 0.55 + 0.45 * np.clip(np.abs(np.mod(hue + [0, 4, 2], 6.0) - 3.0) - 1.0, 0, 1)
    shared = np.maximum.reduce([star, lines, pin])

    # weaves and relief
    def tow(v, size):
        f = v / size
        return np.floor(f).astype(np.int32), 0.5 - 0.5 * np.cos(2 * np.pi * (f - np.floor(f)))

    i3, px3 = tow(X, 2.0)
    j3, pz3 = tow(Z, 2.0)
    warp3 = ((i3 - j3) % 4) < 2
    w3 = np.where(warp3, 0.085 + 0.075 * px3, 0.045 + 0.04 * pz3)
    i16, px16 = tow(X, 5.5)
    j16, pz16 = tow(Z, 5.5)
    warp16 = ((i16 + j16) % 2) == 0
    w16 = np.where(warp16, 0.62 + 0.26 * px16, 0.42 + 0.2 * pz16)
    hw = 9.0
    hs = (hw, hw * math.sqrt(3))
    ax, az = np.mod(X, hs[0]) - hs[0] / 2, np.mod(Z, hs[1]) - hs[1] / 2
    bx, bz = np.mod(X - hs[0] / 2, hs[0]) - hs[0] / 2, np.mod(Z - hs[1] / 2, hs[1]) - hs[1] / 2
    pick = (ax * ax + az * az) < (bx * bx + bz * bz)
    gx, gz = np.abs(np.where(pick, ax, bx)), np.abs(np.where(pick, az, bz))
    hexe = hw / 2 - np.maximum(gx, gx * 0.5 + gz * 0.8660254)
    hexh = sm(0.25, 1.1, hexe)

    out = {}
    for face, sx in ((1, 1), (2, -1)):
        ink = np.maximum.reduce([
            shared, logo(0, 233, 84, sx), text("GEMINI", 0, 219.3, 4.6, 0.8, sx),
            text("I  3K" if face == 1 else "II  16K", 0, 212.2, 2.1, 0.42, sx)])
        bw, bh = (13.0, 11.0) if face == 1 else (17.0, 11.0)
        qx, qz = np.abs(X) - bw / 2 + 2, np.abs(Z - 433) - bh / 2 + 2
        rr = np.hypot(np.maximum(qx, 0), np.maximum(qz, 0)) + np.minimum(np.maximum(qx, qz), 0) - 2
        ink = np.maximum(ink, 1 - sm(0.22, 0.42, np.abs(rr)))
        for bxm in ((0,) if face == 1 else (-2.6, 2.6)):
            bar = np.maximum(np.abs(X - bxm) - 0.75, np.abs(Z - 433) - 3.0)
            ser = np.maximum(np.abs(X - bxm) - 1.9, np.abs(np.abs(Z - 433) - 3.0) - 0.45)
            ink = np.maximum(ink, 1 - sm(-0.1, 0.1, np.minimum(bar, ser)))
        a = ink
        ink = ink[..., None]
        bd = border[..., None]
        if face == 1:
            sandy = paint1 * (1 - border)
            carbon = (w3 * (0.85 + 0.15 * hexh * sandy))[..., None] * [1, 1, 1.04]
            col = np.where(paint1[..., None], np.array(RED, np.float32) * (0.72 + 0.2 * hexh)[..., None], carbon)
            col = col * (1 - bd) + (w3[..., None] * [1, 1, 1.04]) * bd
            rough = np.where(paint1, 0.62, 0.46) * (1 - border) + 0.07 * border
            metal = np.zeros((H, W), np.float32)
            height = 0.75 * hexh * sandy + 0.04 * np.where(warp3, px3, pz3)
        else:
            sandy = (~paint1) * (1 - border)
            raw = w16[..., None] * [0.93, 0.95, 1.0]
            col = np.where(~paint1[..., None], np.clip(w16[..., None] * np.array(BLUE, np.float32) * 1.3, 0, 1), raw)
            col = col * (1 - bd) + raw * bd
            rough = np.where(~paint1, 0.5, 0.42) * (1 - border) + 0.2 * border
            metal = np.ones((H, W), np.float32)
            height = 0.5 * np.where(warp16, px16, pz16)
        col = col * (1 - ink) + laser * ink
        rough = rough * (1 - a) + 0.3 * a
        metal = metal * (1 - a) + a
        height = np.clip(height + 0.12 * a, 0, 1)
        grit = sandy * (1 - a)
        out[face] = (np.dstack([col, a]).astype(np.float32), np.dstack([height, rough, metal, grit]).astype(np.float32))
    return out, (W, H)


def to_image(name, arr, wh, colorspace):
    W, H = wh
    img = bpy.data.images.new(name, W, H, alpha=True)
    img.colorspace_settings.name = colorspace
    img.alpha_mode = "CHANNEL_PACKED"
    img.pixels.foreach_set(np.ascontiguousarray(arr, np.float32).ravel())
    img.pack()
    return img


def face_mat(name, col_img, dat_img, grit, bump_mm, coat):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexImage")
    tc.image = col_img
    td = nt.nodes.new("ShaderNodeTexImage")
    td.image = dat_img
    sep = nt.nodes.new("ShaderNodeSeparateColor")
    nt.links.new(td.outputs["Color"], sep.inputs["Color"])
    nt.links.new(tc.outputs["Color"], b.inputs["Base Color"])
    nt.links.new(sep.outputs["Green"], b.inputs["Roughness"])
    nt.links.new(sep.outputs["Blue"], b.inputs["Metallic"])
    b1 = nt.nodes.new("ShaderNodeBump")
    b1.inputs["Strength"].default_value = 1.0
    b1.inputs["Distance"].default_value = bump_mm * MM
    nt.links.new(sep.outputs["Red"], b1.inputs["Height"])
    vor = nt.nodes.new("ShaderNodeTexVoronoi")
    vor.inputs["Scale"].default_value = 2600.0 if grit > 0.5 else 4200.0
    tco = nt.nodes.new("ShaderNodeTexCoord")
    nt.links.new(tco.outputs["Object"], vor.inputs["Vector"])
    b2 = nt.nodes.new("ShaderNodeBump")
    gm = nt.nodes.new("ShaderNodeMath")  # sand only where the grit mask (data alpha) says so
    gm.operation = "MULTIPLY"
    gm.inputs[1].default_value = grit
    nt.links.new(td.outputs["Alpha"], gm.inputs[0])
    nt.links.new(gm.outputs[0], b2.inputs["Strength"])
    tf = nt.nodes.new("ShaderNodeMath")  # laser foil: thin-film iridescence where colour alpha = 1
    tf.operation = "MULTIPLY"
    tf.inputs[1].default_value = 520.0
    nt.links.new(tc.outputs["Alpha"], tf.inputs[0])
    nt.links.new(tf.outputs[0], b.inputs["Thin Film Thickness"])
    b.inputs["Thin Film IOR"].default_value = 1.45
    em = nt.nodes.new("ShaderNodeMath")  # foil keeps a little glow so it reads in dark reflections
    em.operation = "MULTIPLY"
    em.inputs[1].default_value = 0.4
    nt.links.new(tc.outputs["Alpha"], em.inputs[0])
    nt.links.new(tc.outputs["Color"], b.inputs["Emission Color"])
    nt.links.new(em.outputs[0], b.inputs["Emission Strength"])
    b2.inputs["Distance"].default_value = 0.12 * MM
    b2.invert = True
    nt.links.new(vor.outputs["Distance"], b2.inputs["Height"])
    nt.links.new(b1.outputs["Normal"], b2.inputs["Normal"])
    nt.links.new(b2.outputs["Normal"], b.inputs["Normal"])
    b.inputs["Coat Weight"].default_value = coat
    b.inputs["Coat Roughness"].default_value = 0.1
    return m


def build_all():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)
    art, wh = make_art()
    mats = [
        face_mat("MAT_Face_I_3K_Red_Sand3D", to_image("FaceI_color", art[1][0], wh, "sRGB"),
                 to_image("FaceI_height_rough_metal", art[1][1], wh, "Non-Color"), 0.9, 0.35, 0.0),
        face_mat("MAT_Face_II_16K_Alu_Blue_FineSand", to_image("FaceII_color", art[2][0], wh, "sRGB"),
                 to_image("FaceII_height_rough_metal", art[2][1], wh, "Non-Color"), 0.35, 0.06, 0.0),
        mat("MAT_EVA_Core", (0.86, 0.86, 0.84), 0.85),
        mat("MAT_Rim_Red", RED, 0.32, 0, 0.5), mat("MAT_Rim_Blue", BLUE, 0.32, 0, 0.5),
        mat("MAT_Rim_Pinstripe", (0.95, 0.95, 0.95), 0.35), mat("MAT_Rim_Carbon", (0.045, 0.045, 0.05), 0.28, 0, 0.6),
    ]
    body = build_body()
    for m in mats:
        body.data.materials.append(m)
    grip = mat("MAT_Grip_Black", (0.035, 0.035, 0.04), 0.7)
    g = loft("HERO_Gemini_Grip", GRIP, grip)
    c = loft("HERO_Gemini_Collar", COLLAR, mats[6], True, True)
    bt = loft("HERO_Gemini_ButtCap", BUTT, mats[3], True, True)
    root = bpy.data.objects.new("HERO_NORA_Gemini", None)
    bpy.context.scene.collection.objects.link(root)
    for o in (body, g, c, bt):
        o.parent = root
    d = body.dimensions
    return {"dims_mm": [round(v / MM, 1) for v in d], "verts": len(body.data.vertices),
            "faces": len(body.data.polygons)}
