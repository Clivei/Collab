"""NORA Gemini "Eclipse" - pattern-interrupt colourway applied on top of the built v2 scene.
Front "Day": matte bone lacquer, no logo, one gloss oxblood band from the edge to the sweet spot.
Back "Night": gloss near-black 16K aluminised weave, the same band in gold foil, constellation drawn with laser-ringed holes.
Run after build_all() (or on the saved scene): apply_eclipse()"""
import bpy, math
import numpy as np

E_TB, E_PX, E_MM = (-130.0, 130.0, 120.0, 460.0), 6, 0.001
E_HOL = [120, 4210, 100, 356, 4184, 100, 589, 4124, 100, 108, 3957, 100, 314, 3941, 100, 515, 3912, 100, 738, 3867, 100, 110, 3724, 80, 313, 3723, 80, 554, 3684, 100, 771, 3650, 100, 109, 3518, 80, 314, 3518, 80, 575, 3473, 100, 789, 3437, 100, 109, 3314, 80, 313, 3313, 80, 579, 3265, 100, 791, 3227, 100, 110, 3108, 80, 314, 3109, 80, 566, 3061, 100, 778, 3020, 100, 108, 2905, 80, 313, 2905, 80, 541, 2859, 100, 753, 2816, 100, 108, 2701, 80, 314, 2701, 80, 501, 2660, 100, 705, 2621, 80, 109, 2496, 80, 313, 2496, 80, 503, 2467, 80]
E_STARS = [(-38, 420), (-27, 371), (-45, 322), (-60, 281), (-72, 356), (24, 426), (37, 381), (29, 331), (13, 287), (74, 394)]
E_LINKS = [(0, 1), (1, 2), (2, 3), (1, 4), (5, 6), (6, 7), (7, 8), (6, 9), (1, 6)]
BONE, OXBLOOD, GOLD = (0.80, 0.76, 0.66), (0.30, 0.02, 0.045), (1.0, 0.74, 0.30)


def make_eclipse():
    W, H = int((E_TB[1] - E_TB[0]) * E_PX), int((E_TB[3] - E_TB[2]) * E_PX)
    X, Z = np.meshgrid(E_TB[0] + (np.arange(W) + 0.5) / E_PX, E_TB[2] + (np.arange(H) + 0.5) / E_PX)
    X, Z = X.astype(np.float32), Z.astype(np.float32)

    def sm(e0, e1, v):
        t = np.clip((v - e0) / (e1 - e0), 0, 1)
        return t * t * (3 - 2 * t)

    def seg(ax, az, bx, bz):
        dx, dz = bx - ax, bz - az
        t = np.clip(((X - ax) * dx + (Z - az) * dz) / max(dx * dx + dz * dz, 1e-9), 0, 1)
        return np.hypot(X - ax - t * dx, Z - az - t * dz)

    def bar(cx, cz, hw, hh):
        return 1 - sm(-0.12, 0.12, np.maximum(np.abs(X - cx) - hw, np.abs(Z - cz) - hh))

    # the band: enters from the +X edge at 58 deg from vertical and stops square at the sweet spot
    S, E = (6.0, 316.0), (150.0, 406.0)
    ux, uz = E[0] - S[0], E[1] - S[1]
    L = math.hypot(ux, uz)
    ux, uz = ux / L, uz / L
    t = (X - S[0]) * ux + (Z - S[1]) * uz
    d = -(X - S[0]) * uz + (Z - S[1]) * ux
    band = (1 - sm(10.8, 11.2, np.abs(d))) * sm(-0.2, 0.2, t)
    hair = (1 - sm(0.35, 0.6, np.abs(d - 15.0))) * sm(-0.2, 0.2, t - 22)      # thin echo line above the band
    # sweet-spot relief zone (soft ellipse)
    sweet = 1 - sm(0.75, 1.0, np.hypot((X - 0) / 66.0, (Z - 318) / 76.0))
    hw = 9.0
    hs = (hw, hw * math.sqrt(3))
    ax, az = np.mod(X, hs[0]) - hs[0] / 2, np.mod(Z, hs[1]) - hs[1] / 2
    bx, bz = np.mod(X - hs[0] / 2, hs[0]) - hs[0] / 2, np.mod(Z - hs[1] / 2, hs[1]) - hs[1] / 2
    pick = (ax * ax + az * az) < (bx * bx + bz * bz)
    gx, gz = np.abs(np.where(pick, ax, bx)), np.abs(np.where(pick, az, bz))
    hexh = sm(0.25, 1.1, hw / 2 - np.maximum(gx, gx * 0.5 + gz * 0.8660254))
    # 16K weave
    f, g = X / 5.5, Z / 5.5
    px16, pz16 = 0.5 - 0.5 * np.cos(2 * np.pi * (f - np.floor(f))), 0.5 - 0.5 * np.cos(2 * np.pi * (g - np.floor(g)))
    warp16 = ((np.floor(f).astype(np.int32) + np.floor(g).astype(np.int32)) % 2) == 0
    w16 = np.where(warp16, 0.62 + 0.26 * px16, 0.42 + 0.2 * pz16)
    # constellation drawn with the drilling: ring the hole nearest each star, join with hairlines
    hol = np.array(E_HOL, float).reshape(-1, 3) / 10.0
    hol = np.vstack([hol, hol * [-1, 1, 1]])
    pickh = []
    for sx_, sz_ in E_STARS:
        i = int(np.argmin(np.hypot(hol[:, 0] - sx_, hol[:, 1] - sz_)))
        pickh.append(i)
    ring = np.zeros((H, W), np.float32)
    nearh = np.full((H, W), 99.0, np.float32)
    for i in set(pickh):
        r = np.hypot(X - hol[i, 0], Z - hol[i, 1]) - hol[i, 2] / 2
        ring = np.maximum(ring, sm(-0.2, 0.2, r) * (1 - sm(2.3, 2.6, r)))
        nearh = np.minimum(nearh, r)
    ld = np.full((H, W), 99.0, np.float32)
    for a, b in E_LINKS:
        if pickh[a] != pickh[b]:
            ld = np.minimum(ld, seg(hol[pickh[a], 0], hol[pickh[a], 1], hol[pickh[b], 0], hol[pickh[b], 1]))
    lines = (1 - sm(0.3, 0.5, ld)) * sm(2.6, 3.0, nearh)
    hue = np.mod((X * 0.9 + Z * 0.5) / 55.0, 1.0)[..., None] * 6.0
    laser = 0.55 + 0.45 * np.clip(np.abs(np.mod(hue + [0, 4, 2], 6.0) - 3.0) - 1.0, 0, 1)
    one = bar(0, 222, 0.9, 3.2)
    two = np.maximum(bar(-2.4, 222, 0.9, 3.2), bar(2.4, 222, 0.9, 3.2))

    out = {}
    # ---- Front "Day"
    b3 = band[..., None]
    ink = np.maximum(one, hair)[..., None]
    col = np.array(BONE, np.float32) * (0.97 + 0.03 * hexh * sweet)[..., None] * np.ones((H, W, 3), np.float32)
    col = col * (1 - b3) + np.array(OXBLOOD, np.float32) * b3
    col = col * (1 - ink) + np.array(OXBLOOD, np.float32) * ink
    rough = 0.78 * (1 - band) + 0.07 * band
    height = np.clip(0.55 * hexh * sweet * (1 - band) + 0.25 * band, 0, 1)
    grit = 0.35 * sweet * (1 - band)
    zero = np.zeros((H, W), np.float32)
    out[1] = (np.dstack([col, zero]).astype(np.float32), np.dstack([height, rough, zero, grit]).astype(np.float32))
    # ---- Back "Night"
    foil = np.maximum(ring, lines)
    gold = np.maximum.reduce([band, two, hair])
    col = w16[..., None] * np.array([0.20, 0.21, 0.24], np.float32)
    col = col * (1 - gold[..., None]) + np.array(GOLD, np.float32) * (0.82 + 0.18 * laser) * gold[..., None]
    col = col * (1 - foil[..., None]) + laser * foil[..., None]
    rough = (0.14 + 0.1 * (1 - np.where(warp16, px16, pz16))) * (1 - gold) + 0.2 * gold
    rough = rough * (1 - foil) + 0.25 * foil
    height = np.clip(0.4 * np.where(warp16, px16, pz16) * (1 - gold) + 0.5 * gold + 0.15 * foil, 0, 1)
    alpha = np.clip(foil + 0.22 * gold, 0, 1)
    out[2] = (np.dstack([col, alpha]).astype(np.float32),
              np.dstack([height, rough, np.ones((H, W), np.float32), zero]).astype(np.float32))
    return out, (W, H)


def apply_eclipse():
    art, (W, H) = make_eclipse()
    for face, names in ((1, ("FaceI_color", "FaceI_height_rough_metal")), (2, ("FaceII_color", "FaceII_height_rough_metal"))):
        for name, arr in zip(names, art[face]):
            img = bpy.data.images[name]
            assert tuple(img.size) == (W, H), (name, tuple(img.size))
            img.pixels.foreach_set(np.ascontiguousarray(arr, np.float32).ravel())
            img.update()
            img.pack()

    def setcol(name, rgb, rough, coat=None, metal=None, newname=None):
        m = bpy.data.materials.get(name)
        if not m:
            return
        b = m.node_tree.nodes["Principled BSDF"]
        b.inputs["Base Color"].default_value = (*rgb, 1)
        b.inputs["Roughness"].default_value = rough
        if coat is not None:
            b.inputs["Coat Weight"].default_value = coat
        if metal is not None:
            b.inputs["Metallic"].default_value = metal
        if newname:
            m.name = newname

    for name, coat, newname in (("MAT_Face_I_3K_Red_Sand3D", 0.0, "MAT_Face_I_Day_Bone_Matte"),
                                ("MAT_Face_II_16K_Alu_Blue_FineSand", 0.85, "MAT_Face_II_Night_16K_Alu_Gloss")):
        m = bpy.data.materials.get(name) or bpy.data.materials.get(newname)
        b = m.node_tree.nodes["Principled BSDF"]
        b.inputs["Coat Weight"].default_value = coat
        b.inputs["Coat Roughness"].default_value = 0.05
        m.name = newname
    setcol("MAT_Rim_Red", BONE, 0.7, 0.0, 0.0, "MAT_Rim_Day_Bone")
    setcol("MAT_Rim_Blue", (0.012, 0.012, 0.014), 0.22, 0.8, 0.0, "MAT_Rim_Night_Black")
    setcol("MAT_Rim_Pinstripe", OXBLOOD, 0.12, 0.8, 0.0, "MAT_Rim_Oxblood_Line")
    setcol("MAT_Rim_Carbon", (0.02, 0.02, 0.022), 0.3, 0.5, 0.0)
    setcol("MAT_EVA_Core", (0.012, 0.012, 0.013), 0.9)
    return {"images": [W, H], "materials": sorted(m.name for m in bpy.data.materials)}
