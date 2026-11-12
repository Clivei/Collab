import bpy, bmesh, math
import numpy as np
from mathutils import Vector
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
    """distance from points P (n,2) to closed polyline"""
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
    # bevel edge sets (found on the flat caps before the taper)
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
    # Power Ribs: one boolean with 20 small boxes, then baked
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
    # rim colour bands
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
