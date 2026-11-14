import bpy, bmesh, math
import numpy as np
from mathutils import Vector
OUT=[3,1280,105,1280,117,1281,123,1282,134,1285,145,1291,154,1299,161,1309,166,1319,169,1331,170,1343,170,1385,171,1403,173,1421,178,1438,192,1471,218,1532,232,1558,242,1574,252,1589,270,1612,286,1630,343,1684,397,1740,489,1842,568,1925,658,2030,684,2062,728,2120,781,2185,821,2238,845,2272,865,2302,884,2332,902,2364,932,2422,966,2492,1003,2575,1037,2658,1059,2714,1093,2804,1115,2866,1144,2957,1163,3020,1186,3101,1212,3206,1223,3259,1233,3318,1236,3342,1241,3390,1244,3438,1244,3480,1243,3528,1237,3593,1231,3629,1218,3694,1203,3752,1187,3804,1160,3877,1146,3910,1109,3992,1070,4066,1052,4097,1014,4158,982,4202,955,4234,943,4248,910,4283,870,4319,842,4341,798,4372,766,4390,745,4401,713,4417,691,4427,674,4434,635,4448,594,4460,548,4472,489,4485,418,4497,359,4506,282,4515,198,4522,144,4525,42,4529,0,4529]
WR=[110,1917,116,1905,125,1895,162,1853,172,1843,182,1835,194,1828,207,1825,220,1825,232,1830,244,1837,255,1846,356,1943,369,1959,376,1970,382,1983,386,1996,389,2010,390,2024,389,2037,387,2044,382,2056,379,2061,375,2066,370,2069,365,2071,359,2072,346,2071,311,2066,202,2045,162,2036,127,2031,114,2028,108,2025,103,2022,98,2017,95,2012,91,2000,90,1987,92,1973,93,1967,103,1941]
WC=[1,1865,-5,1865,-10,1863,-21,1856,-34,1840,-50,1818,-57,1806,-78,1755,-82,1742,-83,1728,-83,1722,-80,1708,-64,1647,-56,1613,-46,1565,-38,1538,-33,1525,-29,1519,-21,1509,-16,1506,-10,1503,-4,1501,2,1501,8,1502,14,1505,19,1508,24,1512,32,1523,35,1529,40,1542,46,1562,63,1645,80,1706,82,1719,83,1733,81,1746,77,1759,55,1810,48,1822,32,1844,22,1854,12,1862,7,1864]
HOL=[120,4210,100,356,4184,100,589,4124,100,108,3957,100,314,3941,100,515,3912,100,738,3867,100,110,3724,80,313,3723,80,554,3684,100,771,3650,100,109,3518,80,314,3518,80,575,3473,100,789,3437,100,109,3314,80,313,3313,80,579,3265,100,791,3227,100,110,3108,80,314,3109,80,566,3061,100,778,3020,100,108,2905,80,313,2905,80,541,2859,100,753,2816,100,108,2701,80,314,2701,80,501,2660,100,705,2621,80,109,2496,80,313,2496,80,503,2467,80]
LOGO=[[1039,202,1039,199,1018,173,952,82,932,62,918,56,899,57,891,60,882,67,826,144,824,149,821,151,814,163,800,177,786,177,780,174,742,141,724,133,665,133,665,135,708,171,714,178,737,195,744,198,749,198,751,200,820,202,830,200,831,198,839,195,859,176,908,107,915,100,920,98,933,106,975,163,973,165,897,165,890,167,873,179,863,196,863,202],[571,199,590,202,610,202,622,198,630,187,632,177,632,87,634,85,730,84,752,85,761,88,770,97,773,108,768,122,756,131,755,134,785,159,794,161,806,151,815,131,818,117,818,103,813,84,808,75,798,65,791,60,776,55,589,55,587,57,587,176,582,188],[304,83,304,173,313,188,319,193,333,200,339,200,342,202,537,202,547,200,557,195,566,186,571,178,571,90,564,73,552,62,543,58,527,55,337,55,322,60,315,65,309,72],[349,108,354,95,361,88,368,85,509,86,521,95,526,104,526,154,521,164,515,170,503,173,365,172,357,165,349,151],[53,53,53,202,92,202,97,201,98,199,99,93,142,125,227,193,251,202,284,203,287,201,288,55,241,56,241,146,238,148,131,60,110,53]]  # px, x 52..1039, y 52..203 (y down)
import numpy as np


def _bez(start, segs, n=16):
    out, p0 = [start], start
    for c1x, c1y, c2x, c2y, ex, ey in segs:
        for i in range(1, n + 1):
            t = i / n
            u = 1 - t
            out.append((u ** 3 * p0[0] + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t ** 3 * ex,
                        u ** 3 * p0[1] + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t ** 3 * ey))
        p0 = (ex, ey)
    return np.array(out)


def _chaikin(p, k=2):
    for _ in range(k):
        q = np.roll(p, -1, axis=0)
        p = np.stack([0.75 * p + 0.25 * q, 0.25 * p + 0.75 * q], 1).reshape(-1, 2)
    return p


def _dist(P, poly):
    d = np.full(len(P), 1e9)
    for a, b in zip(poly, np.roll(poly, -1, axis=0)):
        ab = b - a
        t = np.clip(((P - a) @ ab) / max(ab @ ab, 1e-12), 0, 1)
        d = np.minimum(d, np.hypot(*(P - (a + t[:, None] * ab)).T))
    return d


def _inside(P, poly):
    x, y = P[:, 0], P[:, 1]
    c = np.zeros(len(P), bool)
    for a, b in zip(poly, np.roll(poly, -1, axis=0)):
        if a[1] == b[1]:
            continue
        c ^= ((a[1] > y) != (b[1] > y)) & (x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0])
    return c


_half = _bez((0.3, 128.0), [(9, 128, 17, 129, 18, 139), (20, 152, 40, 176, 62, 206), (96, 252, 129, 292, 127, 346),
                            (125, 412, 96, 456, 0, 457)])
_full = np.vstack([_half, _half[::-1][1:] * [-1, 1]])
_triR = _chaikin(np.array([(7.0, 224.0), (47.0, 224.0), (13.0, 191.0)]), 3)
_triL = _triR[::-1] * [-1, 1]
_dia = _chaikin(np.array([(0.0, 184.0), (-10.0, 168.0), (0.0, 151.0), (10.0, 168.0)]), 3)
V4_WINDOWS = [_triR, _triL, _dia]
_g = np.array([(x, y) for y in np.arange(258.0, 445.0, 24.0) for x in (0.0, 30.0, 60.0, 90.0)])
_ok = _inside(_g, _full) & (_dist(_g, _full) > 21.0)
V4_HOLES = np.array([(x, y, 11.0) for x, y in _g[_ok]])
OUT = [int(round(v * 10)) for p in _half for v in p]
WC = [int(round(v * 10)) for p in _dia for v in p]
WR = WC
HOL = [int(round(v)) for x, y, d in V4_HOLES for v in (x * 10, y * 10, d * 10)]

MM = 0.001
Z0 = 0.03
PX = 6
TB = (-130.0, 130.0, 120.0, 460.0)
TT = [(128, 24), (140, 24), (150, 25), (160, 26.3), (170, 28.4), (180, 31.2), (190, 33.1), (200, 34.3),
      (210, 35.5), (220, 36.5), (235, 37.3), (250, 38), (460, 38)]
RIBS = [(119.438, 378.111, 0.958, 0.287), (116.239, 387.056, 0.937, 0.348), (112.458, 395.77, 0.912, 0.41),
        (108.232, 404.277, 0.882, 0.471), (103.494, 412.508, 0.847, 0.531), (98.079, 420.309, 0.786, 0.618),
        (91.832, 427.459, 0.706, 0.708), (84.717, 433.745, 0.598, 0.802), (76.778, 438.949, 0.481, 0.877),
        (68.22, 443.065, 0.366, 0.931)]
GRIP = [(8, 21.2, 17.6), (20, 21.0, 17.8), (28, 19.4, 16.6), (36, 18.2, 15.4), (46, 17.4, 14.2), (56, 17.3, 13.5),
        (110, 17.3, 13.6), (126, 17.9, 14.6)]
BUTT = [(0, 19.0, 15.6), (2, 22.4, 17.0), (5, 23.1, 17.4), (8, 21.2, 17.6)]
COLLAR = [(126, 19.2, 15.6), (130, 19.9, 17.4), (136, 20.8, 18.0), (140, 20.2, 17.2)]
RED, BLUE, NAVY = (0.82, 0.12, 0.25), (0.11, 0.42, 0.69), (0.04, 0.13, 0.27)
def pts(a):
    return np.array(a, float).reshape(-1, 2) / 10.0
def thick(z):
    z = np.asarray(z, float)
    zs = np.array([t[0] for t in TT], float)
    ts = np.array([t[1] for t in TT], float)
    return np.interp(z, zs, ts)
R_ = pts(OUT)
OUTLINE = np.vstack([R_, (R_[::-1][1:] * [-1, 1])])
WIN = [pts(WR), pts(WR)[::-1] * [-1, 1], pts(WC)]
H_ = np.array(HOL, float).reshape(-1, 3) / 10.0
HOLES = np.vstack([H_, H_ * [-1, 1, 1]])
def seg_dist(P, poly):
    A = poly
    B = np.roll(poly, -1, axis=0)
    d = np.full(len(P), 1e9)
    for a, b in zip(A, B):
        ab = b - a
        t = np.clip(((P - a) @ ab) / max(ab @ ab, 1e-12), 0, 1)
        d = np.minimum(d, np.hypot(*(P - (a + t[:, None] * ab)).T))
    return d
def srgb(c):
    return tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c)
def mat(name, col, rough=0.5, metal=0.0, coat=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*srgb(col), 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if coat:
        b.inputs["Coat Weight"].default_value = coat
        b.inputs["Coat Roughness"].default_value = 0.08
    return m
def build_body():
    cu = bpy.data.curves.new("tmp_profile", "CURVE")
    cu.dimensions = "2D"
    cu.fill_mode = "BOTH"
    cu.extrude = 19 * MM
    loops = [OUTLINE] + WIN
    for x, z, d in HOLES:
        a = np.linspace(0, 2 * np.pi, 28, endpoint=False) + 0.1
        loops.append(np.c_[x + d / 2 * np.cos(a), z + d / 2 * np.sin(a)])
    for lp in loops:
        s = cu.splines.new("POLY")
        s.points.add(len(lp) - 1)
        s.use_cyclic_u = True
        for p, (x, z) in zip(s.points, lp):
            p.co = (x * MM, z * MM, 0, 1)
    tmp = bpy.data.objects.new("tmp_profile", cu)
    bpy.context.scene.collection.objects.link(tmp)
    dg = bpy.context.evaluated_depsgraph_get()
    dg.update()
    me = bpy.data.meshes.new_from_object(tmp.evaluated_get(dg))
    bpy.data.objects.remove(tmp)
    bpy.data.curves.remove(cu)
    bm = bmesh.new()
    bm.from_mesh(me)
    for v in bm.verts:  # curve XY + extrude Z  ->  world X, Z, thickness Y
        v.co = Vector((v.co.x, v.co.z, v.co.y))
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    for zc in range(134, 256, 8):
        bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, 0, zc * MM),
                               plane_no=(0, 0, 1))
    bm.edges.ensure_lookup_table()
    cand = [e for e in bm.edges if all(abs(abs(v.co.y) - 19 * MM) < 1e-6 for v in e.verts)
            and e.verts[0].co.y * e.verts[1].co.y > 0]
    P = np.array([[c for v in e.verts for c in (v.co.x / MM, v.co.z / MM)] for e in cand])
    tri = np.vstack([P[:, :2], P[:, 2:], (P[:, :2] + P[:, 2:]) / 2])
    n = len(cand)
    d_o = seg_dist(tri, OUTLINE).reshape(3, n).max(0)
    d_w = np.minimum.reduce([seg_dist(tri, w).reshape(3, n).max(0) for w in WIN])
    rim = [e for e, d in zip(cand, d_o) if d < 1e-3]
    win = [e for e, d in zip(cand, d_w) if d < 1e-3]
    for v in bm.verts:
        v.co.y *= float(thick(v.co.z / MM)) / 38.0
    bmesh.ops.bevel(bm, geom=rim, offset=5 * MM, offset_type="OFFSET", segments=6, profile=0.5, affect="EDGES",
                    clamp_overlap=True)
    win = [e for e in win if e.is_valid]
    bmesh.ops.bevel(bm, geom=win, offset=1.5 * MM, offset_type="OFFSET", segments=3, profile=0.5, affect="EDGES",
                    clamp_overlap=True)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new("HERO_Gemini_Body", me)
    bpy.context.scene.collection.objects.link(ob)
    cb = bmesh.new()
    for sx in (1, -1):
        for x, z, nx, nz in RIBS:
            t = Vector((-nz * sx, 0, nx)).normalized()
            nrm = Vector((nx * sx, 0, nz))
            c = Vector((x * sx, 0, z)) * MM + nrm * 2.0 * MM
            hw, hy, hn = 0.8 * MM, 13 * MM, 3.0 * MM
            vs = [cb.verts.new(c + t * a * hw + Vector((0, b * hy, 0)) + nrm * k * hn)
                  for k in (-1, 1) for a, b in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
            for f in ((0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)):
                cb.faces.new([vs[i] for i in f])
    bmesh.ops.recalc_face_normals(cb, faces=cb.faces)
    cme = bpy.data.meshes.new("tmp_ribs")
    cb.to_mesh(cme)
    cb.free()
    cut = bpy.data.objects.new("tmp_ribs", cme)
    bpy.context.scene.collection.objects.link(cut)
    md = ob.modifiers.new("ribs", "BOOLEAN")
    md.operation = "DIFFERENCE"
    md.solver = "EXACT"
    md.object = cut
    dg = bpy.context.evaluated_depsgraph_get()
    dg.update()
    me2 = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    ob.modifiers.clear()
    ob.data = me2
    bpy.data.objects.remove(cut)
    bpy.data.meshes.remove(cme)
    bpy.data.meshes.remove(me)
    me2.name = "Gemini_Body"
    me2.materials.clear()  # drop the empty slot inherited from the curve before indexing
    bm = bmesh.new()
    bm.from_mesh(me2)
    for yc in (-4.0, -3.2, 3.2, 4.0):
        bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, yc * MM, 0),
                               plane_no=(0, 1, 0))
    for lay in list(bm.loops.layers.uv):
        bm.loops.layers.uv.remove(lay)
    uv = bm.loops.layers.uv.new("FaceUV")
    for f in bm.faces:
        c = f.calc_center_median()
        cx, cy, cz = c.x / MM, c.y / MM, c.z / MM
        cap = all(abs(v.co.y) / MM > float(thick(v.co.z / MM)) / 2 - 0.02 for v in f.verts)
        hole = abs(f.normal.y) < 0.5 and np.min(np.hypot(HOLES[:, 0] - cx, HOLES[:, 1] - cz) - HOLES[:, 2] / 2) < 0.4
        if hole:
            f.material_index = 2
        elif cap:
            f.material_index = 0 if cy < 0 else 1
        elif cy < -4.0:
            f.material_index = 3
        elif cy > 4.0:
            f.material_index = 4
        elif abs(cy) > 3.2:
            f.material_index = 5
        else:
            f.material_index = 6
        f.smooth = not cap
        for l in f.loops:
            co = l.vert.co
            l[uv].uv = ((co.x / MM - TB[0]) / (TB[1] - TB[0]), (co.z / MM - TB[2]) / (TB[3] - TB[2]))
    bm.to_mesh(me2)
    bm.free()
    me2.set_sharp_from_angle(angle=math.radians(38))
    ob.location.z = Z0
    return ob
def loft(name, rings, m, cap0=False, cap1=False, n=40, power=3.0):
    bm = bmesh.new()
    loops = []
    for z, hx, hy in rings:
        lp = []
        for i in range(n):
            a = 2 * math.pi * i / n
            c, s = math.cos(a), math.sin(a)
            lp.append(bm.verts.new((hx * MM * math.copysign(abs(c) ** (2 / power), c),
                                    hy * MM * math.copysign(abs(s) ** (2 / power), s), z * MM)))
        loops.append(lp)
    for a, b in zip(loops, loops[1:]):
        for i in range(n):
            bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]))
    if cap0:
        bm.faces.new(loops[0][::-1])
    if cap1:
        bm.faces.new(loops[-1])
    for f in bm.faces:
        f.smooth = True
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.set_sharp_from_angle(angle=math.radians(50))
    me.materials.append(m)
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    ob.location.z = Z0
    return ob
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
WIN = [pts(WC)]          # single delta window
HOLES = np.unique(np.round(HOLES, 1), axis=0)   # centre-line holes are not mirrored twice
RIBS = []                # the old mould's power ribs do not exist on this mould
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

def stage():
    sc = bpy.context.scene
    col = sc.collection
    def look(ob, target):
        ob.rotation_euler = (Vector(target) - ob.location).to_track_quat("-Z", "Y").to_euler()
    mid = Z0 + 0.2265
    fl = bpy.data.meshes.new("ENV_floor")
    fl.from_pydata([(-4, -4, 0), (4, -4, 0), (4, 4, 0), (-4, 4, 0)], [], [(0, 1, 2, 3)])
    fm = bpy.data.materials.new("MAT_Floor")
    fm.use_nodes = True
    fb = fm.node_tree.nodes["Principled BSDF"]
    fb.inputs["Base Color"].default_value = (0.012, 0.013, 0.016, 1)
    fb.inputs["Roughness"].default_value = 0.35
    fl.materials.append(fm)
    col.objects.link(bpy.data.objects.new("ENV_floor", fl))
    w = bpy.data.worlds.new("World_Studio") if not sc.world else sc.world
    sc.world = w
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs["Color"].default_value = (0.02, 0.022, 0.028, 1)
    w.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.0
    def light(name, kind, loc, energy, color=(1, 1, 1), **kw):
        ld = bpy.data.lights.new(name, kind)
        ld.energy = energy
        ld.color = color
        for k, v in kw.items():
            setattr(ld, k, v)
        ob = bpy.data.objects.new(name, ld)
        ob.location = loc
        col.objects.link(ob)
        look(ob, (0, 0, mid))
        return ob
    light("LGT_key", "SPOT", (-0.9, -1.5, 1.25), 230, (1, 0.97, 0.94), spot_size=0.6, spot_blend=0.6,
          shadow_soft_size=0.25)
    light("LGT_fill", "POINT", (1.1, -1.1, 0.3), 45, (0.85, 0.9, 1), shadow_soft_size=0.5)
    light("LGT_back_key", "SPOT", (0.9, 1.5, 1.25), 230, (0.94, 0.97, 1), spot_size=0.6, spot_blend=0.6,
          shadow_soft_size=0.25)
    light("LGT_back_fill", "POINT", (-1.1, 1.1, 0.3), 45, (1, 0.9, 0.85), shadow_soft_size=0.5)
    light("LGT_rim", "SPOT", (1.3, 0.25, 0.95), 160, (1, 1, 1), spot_size=0.5, spot_blend=0.5, shadow_soft_size=0.1)
    def cam(name, loc, target, lens):
        cd = bpy.data.cameras.new(name)
        cd.lens = lens
        cd.clip_start = 0.01
        ob = bpy.data.objects.new(name, cd)
        ob.location = loc
        col.objects.link(ob)
        look(ob, target)
        return ob
    cam("CAM_face_I", (0, -1.22, mid), (0, 0, mid), 70)
    cam("CAM_face_II", (0, 1.22, mid), (0, 0, mid), 70)
    main = cam("CAM_main", (-0.62, -1.0, mid + 0.22), (0, 0, mid - 0.01), 70)
    cam("CAM_detail", (0.07, -0.34, Z0 + 0.30), (0.0, 0, Z0 + 0.275), 60)
    sc.camera = main
    sc.view_settings.view_transform = "AgX"
    try:
        sc.view_settings.look = "AgX - Medium High Contrast"
    except TypeError:
        pass
    return [o.name for o in sc.objects]
info = build_v4()
stage()
sc = bpy.context.scene
sc.render.engine = "CYCLES"
sc.cycles.samples = 24
sc.cycles.use_denoising = True
sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = 640, 800, 100
sc.render.image_settings.media_type = "IMAGE"
sc.render.image_settings.file_format = "PNG"
for n in ("CAM_face_I", "CAM_face_II", "CAM_main"):
    sc.camera = bpy.data.objects[n]
    tgt = artifacts.file(name="v4_" + n + ".png", media_type="image/png")
    sc.render.filepath = str(tgt.path)
    bpy.ops.render.render(write_still=True)
    tgt.publish()
sc.camera = bpy.data.objects["CAM_main"]
result = info
