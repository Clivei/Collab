"""
NORA GEMINI - padel racket, built procedurally in Blender (4.2+ / 5.x).

    blender -b -P build_nora_gemini.py -- --save nora_gemini.blend
or open this file in Blender's Text Editor and press "Run Script".

Two faces, one frame:
    FACE I  (RED)  - 3K carbon, sand grit + 3D hexagon relief   (faces -Y)
    FACE II (BLUE) - 16K aluminized fibre, fine sand            (faces +Y)
Frame mould: diamond / teardrop head (OXDOG reference), 38 mm thick,
455 mm long, 260 mm wide, 66 x 11 mm holes, twin throat openings.

Everything the script makes lives in the collections NORA_Gemini_Racket,
NORA_Studio and in the scene "NORA_Hero_Twins"; re-running the script
replaces only those. Requires the textures/ folder (make_textures.py).
"""
import math
import os
import sys

import bpy  # noqa: I001  (bpy must be imported before bmesh/mathutils)
import bmesh
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__)) if "__file__" in dir() else ""
if not HERE or not os.path.exists(os.path.join(HERE, "nora_geometry.py")):
    # running from Blender's text editor: use the text block's file path
    txt = bpy.context.space_data.text if getattr(bpy.context, "space_data", None) else None
    HERE = os.path.dirname(bpy.path.abspath(txt.filepath)) if txt and txt.filepath else os.getcwd()
sys.path.insert(0, HERE)
import importlib  # noqa: E402

import nora_geometry as G  # noqa: E402
importlib.reload(G)

TEX = os.path.join(HERE, "textures")
MM = 0.001
T = G.THICKNESS
R = G.EDGE_RADIUS
FLOAT_Z = 0.12            # racket floats 12 cm above the studio floor
RACKET_COLL = "NORA_Gemini_Racket"
STUDIO_COLL = "NORA_Studio"
HERO_SCENE = "NORA_Hero_Twins"


# ====================================================================== utils
def get_collection(name, parent=None):
    coll = bpy.data.collections.get(name)
    if coll is None:
        coll = bpy.data.collections.new(name)
    parent = parent or bpy.context.scene.collection
    if coll.name not in [c.name for c in parent.children]:
        parent.children.link(coll)
    return coll


def purge_collection(name):
    coll = bpy.data.collections.get(name)
    if not coll:
        return
    for ob in list(coll.all_objects):
        data = ob.data
        bpy.data.objects.remove(ob, do_unlink=True)
        if data is not None and data.users == 0:
            if isinstance(data, bpy.types.Mesh):
                bpy.data.meshes.remove(data)
            elif isinstance(data, bpy.types.Curve):
                bpy.data.curves.remove(data)
            elif isinstance(data, bpy.types.Light):
                bpy.data.lights.remove(data)
            elif isinstance(data, bpy.types.Camera):
                bpy.data.cameras.remove(data)
    for child in list(coll.children):
        purge_collection(child.name)
    bpy.data.collections.remove(coll)


def link(ob, coll):
    coll.objects.link(ob)
    return ob


def mesh_object(name, mesh, coll, parent=None):
    ob = bpy.data.objects.get(name)
    if ob:
        bpy.data.objects.remove(ob, do_unlink=True)
    ob = bpy.data.objects.new(name, mesh)
    link(ob, coll)
    if parent:
        ob.parent = parent
    return ob


def new_material(name):
    m = bpy.data.materials.get(name)
    if m:
        bpy.data.materials.remove(m)
    m = bpy.data.materials.new(name)
    if hasattr(m, "use_nodes"):
        m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    return m, nt


def node(nt, kind, loc=(0, 0), **inputs):
    n = nt.nodes.new(kind)
    n.location = loc
    for k, v in inputs.items():
        if k in n.inputs:
            n.inputs[k].default_value = v
        else:
            setattr(n, k, v)
    return n


def principled(nt, loc=(0, 0)):
    return node(nt, "ShaderNodeBsdfPrincipled", loc)


def image(nt, fname, colorspace, loc):
    path = os.path.join(TEX, fname)
    img = bpy.data.images.get(fname)
    if img is None:
        img = bpy.data.images.load(path, check_existing=True)
    img.colorspace_settings.name = colorspace
    n = node(nt, "ShaderNodeTexImage", loc)
    n.image = img
    n.interpolation = "Cubic" if colorspace == "Non-Color" else "Linear"
    n.extension = "EXTEND"
    return n


# ================================================================= materials
def mat_face(face):
    """FACE I: red 3K, sand grit + 3D.  FACE II: blue 16K aluminized, fine sand."""
    is_I = face == "I"
    name = "MAT_Face_I_3K_Red_Sand3D" if is_I else "MAT_Face_II_16K_Alu_Blue_FineSand"
    m, nt = new_material(name)
    L = nt.links
    out = node(nt, "ShaderNodeOutputMaterial", (900, 0))
    bsdf = principled(nt, (550, 0))
    uv = node(nt, "ShaderNodeUVMap", (-1100, 0))
    uv.uv_map = "FaceUV"
    pre = f"face_{face}_"
    col = image(nt, pre + "color.png", "sRGB", (-800, 400))
    met = image(nt, pre + "metal.png", "Non-Color", (-800, 120))
    rou = image(nt, pre + "rough.png", "Non-Color", (-800, -160))
    hei = image(nt, pre + "height.png", "Non-Color", (-800, -440))
    for n in (col, met, rou, hei):
        L.new(uv.outputs["UV"], n.inputs["Vector"])
    L.new(col.outputs["Color"], bsdf.inputs["Base Color"])
    L.new(met.outputs["Color"], bsdf.inputs["Metallic"])

    # --- sand grit (procedural, object space, metres) ---
    tc = node(nt, "ShaderNodeTexCoord", (-1100, -700))
    grit = node(nt, "ShaderNodeTexVoronoi", (-800, -760))
    grit.feature = "F1"
    grit.inputs["Scale"].default_value = 1500.0 if is_I else 2600.0   # ~0.65 mm / ~0.4 mm grains
    grit.inputs["Randomness"].default_value = 1.0
    L.new(tc.outputs["Object"], grit.inputs["Vector"])
    # grains = small bumps where distance is low; density controlled by threshold
    gr = node(nt, "ShaderNodeMapRange", (-560, -760))
    gr.inputs["From Min"].default_value = 0.0
    gr.inputs["From Max"].default_value = 0.42 if is_I else 0.30
    gr.inputs["To Min"].default_value = 1.0
    gr.inputs["To Max"].default_value = 0.0
    gr.clamp = False
    clampn = node(nt, "ShaderNodeClamp", (-380, -760))
    L.new(grit.outputs["Distance"], gr.inputs["Value"])
    L.new(gr.outputs["Result"], clampn.inputs["Value"])

    # roughness: map + grit breaks up the sheen
    rmix = node(nt, "ShaderNodeMath", (-380, -160), operation="MULTIPLY_ADD")
    L.new(clampn.outputs["Result"], rmix.inputs[0])
    rmix.inputs[1].default_value = 0.10 if is_I else 0.05
    L.new(rou.outputs["Color"], rmix.inputs[2])
    L.new(rmix.outputs["Value"], bsdf.inputs["Roughness"])

    # --- relief: 3D hexagon / weave from height map, then grit on top ---
    b1 = node(nt, "ShaderNodeBump", (-200, -440))
    b1.inputs["Strength"].default_value = 1.0
    b1.inputs["Distance"].default_value = (0.00045 if is_I else 0.00012)
    L.new(hei.outputs["Color"], b1.inputs["Height"])
    b2 = node(nt, "ShaderNodeBump", (100, -600))
    b2.inputs["Strength"].default_value = 0.55 if is_I else 0.22
    b2.inputs["Distance"].default_value = 0.00008
    L.new(clampn.outputs["Result"], b2.inputs["Height"])
    L.new(b1.outputs["Normal"], b2.inputs["Normal"])
    L.new(b2.outputs["Normal"], bsdf.inputs["Normal"])

    if is_I:
        # matte sandy paint: no coat
        bsdf.inputs["Specular IOR Level"].default_value = 0.45
    else:
        # aluminized: a thin glossy resin coat over the metallic weave
        bsdf.inputs["Coat Weight"].default_value = 0.35
        bsdf.inputs["Coat Roughness"].default_value = 0.18
    L.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    m["nora_role"] = "face_" + face
    return m


def mat_rim():
    """Frame edge: red (Face I side) | gloss black carbon | blue (Face II side)."""
    m, nt = new_material("MAT_Frame_Rim_RedBlackBlue")
    L = nt.links
    out = node(nt, "ShaderNodeOutputMaterial", (900, 0))
    bsdf = principled(nt, (550, 0))
    tc = node(nt, "ShaderNodeTexCoord", (-900, 0))
    sep = node(nt, "ShaderNodeSeparateXYZ", (-700, 0))
    L.new(tc.outputs["Object"], sep.inputs["Vector"])
    # map object-space Y (-19 mm .. +19 mm) to 0..1
    mr = node(nt, "ShaderNodeMapRange", (-500, 0))
    mr.inputs["From Min"].default_value = -T / 2 * MM
    mr.inputs["From Max"].default_value = T / 2 * MM
    L.new(sep.outputs["Y"], mr.inputs["Value"])
    ramp = node(nt, "ShaderNodeValToRGB", (-300, 0))
    cr = ramp.color_ramp
    cr.interpolation = "CONSTANT"
    red = (0.63, 0.012, 0.045, 1)
    blue = (0.010, 0.135, 0.42, 1)
    black = (0.012, 0.012, 0.014, 1)
    white = (0.85, 0.85, 0.85, 1)
    cr.elements[0].position = 0.0
    cr.elements[0].color = red
    cr.elements[1].position = 0.30
    cr.elements[1].color = white
    for pos, c in ((0.315, black), (0.685, white), (0.70, blue)):
        e = cr.elements.new(pos)
        e.color = c
    L.new(mr.outputs["Result"], ramp.inputs["Fac"])
    L.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.32
    bsdf.inputs["Coat Weight"].default_value = 0.8
    bsdf.inputs["Coat Roughness"].default_value = 0.06
    L.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    m["nora_role"] = "rim"
    return m


def mat_eva():
    m, nt = new_material("MAT_EVA_Core_Soft")
    out = node(nt, "ShaderNodeOutputMaterial", (600, 0))
    bsdf = principled(nt, (300, 0))
    bsdf.inputs["Base Color"].default_value = (0.70, 0.70, 0.68, 1)
    bsdf.inputs["Roughness"].default_value = 0.85
    noise = node(nt, "ShaderNodeTexNoise", (-200, -200))
    noise.inputs["Scale"].default_value = 2500.0
    tc = node(nt, "ShaderNodeTexCoord", (-400, -200))
    nt.links.new(tc.outputs["Object"], noise.inputs["Vector"])
    bump = node(nt, "ShaderNodeBump", (100, -200))
    bump.inputs["Strength"].default_value = 0.3
    bump.inputs["Distance"].default_value = 0.0001
    nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    m["nora_role"] = "eva_core"
    return m


def mat_grip():
    """Black overgrip with a helical wrap and fine perforation texture."""
    m, nt = new_material("MAT_Grip_Overgrip_Black")
    L = nt.links
    out = node(nt, "ShaderNodeOutputMaterial", (900, 0))
    bsdf = principled(nt, (600, 0))
    bsdf.inputs["Base Color"].default_value = (0.018, 0.018, 0.02, 1)
    bsdf.inputs["Roughness"].default_value = 0.72
    tc = node(nt, "ShaderNodeTexCoord", (-1000, 0))
    sep = node(nt, "ShaderNodeSeparateXYZ", (-800, 0))
    L.new(tc.outputs["Object"], sep.inputs["Vector"])
    ang = node(nt, "ShaderNodeMath", (-600, 100), operation="ARCTAN2")
    L.new(sep.outputs["Y"], ang.inputs[0])
    L.new(sep.outputs["X"], ang.inputs[1])
    # phase = z / pitch + angle / 2pi  (pitch 24 mm per turn)
    a2 = node(nt, "ShaderNodeMath", (-420, 100), operation="DIVIDE")
    L.new(ang.outputs["Value"], a2.inputs[0])
    a2.inputs[1].default_value = 2 * math.pi
    zp = node(nt, "ShaderNodeMath", (-420, -60), operation="DIVIDE")
    L.new(sep.outputs["Z"], zp.inputs[0])
    zp.inputs[1].default_value = 0.024
    ph = node(nt, "ShaderNodeMath", (-240, 0), operation="ADD")
    L.new(a2.outputs["Value"], ph.inputs[0])
    L.new(zp.outputs["Value"], ph.inputs[1])
    fr = node(nt, "ShaderNodeMath", (-80, 0), operation="FRACT")
    L.new(ph.outputs["Value"], fr.inputs[0])
    # overlap ridge: sharp step where the tape overlaps itself
    pw = node(nt, "ShaderNodeMath", (80, 0), operation="POWER")
    L.new(fr.outputs["Value"], pw.inputs[0])
    pw.inputs[1].default_value = 0.35
    perf = node(nt, "ShaderNodeTexVoronoi", (-80, -250))
    perf.inputs["Scale"].default_value = 900.0
    L.new(tc.outputs["Object"], perf.inputs["Vector"])
    pm = node(nt, "ShaderNodeMath", (120, -250), operation="GREATER_THAN")
    L.new(perf.outputs["Distance"], pm.inputs[0])
    pm.inputs[1].default_value = 0.12
    hsum = node(nt, "ShaderNodeMath", (260, -100), operation="MULTIPLY_ADD")
    L.new(pm.outputs["Value"], hsum.inputs[0])
    hsum.inputs[1].default_value = 0.25
    L.new(pw.outputs["Value"], hsum.inputs[2])
    bump = node(nt, "ShaderNodeBump", (420, -150))
    bump.inputs["Strength"].default_value = 0.8
    bump.inputs["Distance"].default_value = 0.0006
    L.new(hsum.outputs["Value"], bump.inputs["Height"])
    L.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    L.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    m["nora_role"] = "grip"
    return m


def mat_simple(name, color, rough, metal=0.0, coat=0.0):
    m, nt = new_material(name)
    out = node(nt, "ShaderNodeOutputMaterial", (400, 0))
    b = principled(nt, (100, 0))
    b.inputs["Base Color"].default_value = color
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    b.inputs["Coat Weight"].default_value = coat
    nt.links.new(b.outputs["BSDF"], out.inputs["Surface"])
    return m


# ================================================================== geometry
def to_world_matrix():
    """Curve space (x, y=length, z=thickness) in mm  ->  world metres.
    Rotation +90 deg about X: curve +Z (top cap) faces world -Y  (FACE I)."""
    return Matrix.Rotation(math.radians(90), 4, "X") @ Matrix.Scale(MM, 4)


def build_body(coll, parent, mats):
    """Frame + faces as one solid: filled 2D curve, extruded, round edges."""
    cu = bpy.data.curves.new("CRV_body_tmp", "CURVE")
    cu.dimensions = "2D"
    cu.fill_mode = "BOTH"
    cu.extrude = T / 2 - R
    cu.bevel_depth = R
    cu.bevel_resolution = 5
    cu.resolution_u = 1

    def add_poly(pts):
        sp = cu.splines.new("POLY")
        sp.points.add(len(pts) - 1)
        for p, (x, z) in zip(sp.points, pts):
            p.co = (x, z, 0.0, 1.0)
        sp.use_cyclic_u = True

    # the bevel grows each spline by R -> pre-compensate so the final size is exact
    add_poly(G.offset_polygon(G.head_outline(), -R))
    for op in G.throat_openings():
        add_poly(G.offset_polygon(op, +R))
    tmp = bpy.data.objects.new("tmp_body", cu)
    bpy.context.scene.collection.objects.link(tmp)
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(tmp.evaluated_get(dg))
    bpy.data.objects.remove(tmp, do_unlink=True)
    bpy.data.curves.remove(cu)
    me.name = "ME_NORA_Gemini_Body"

    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)       # weld caps to bevels (mm)
    bmesh.ops.transform(bm, matrix=to_world_matrix(), verts=bm.verts)
    bm.normal_update()
    uv = bm.loops.layers.uv.new("FaceUV")
    half = T / 2 * MM - 1e-6
    for f in bm.faces:
        cy = f.calc_center_median().y
        if cy <= -half:
            f.material_index = 0          # FACE I  (front, -Y)
            f.smooth = False
        elif cy >= half:
            f.material_index = 1          # FACE II (back, +Y)
            f.smooth = False
        else:
            f.material_index = 2          # frame rim
            f.smooth = True
        for lp in f.loops:
            co = lp.vert.co
            lp[uv].uv = ((co.x / MM + 130.0) / 260.0, (co.z / MM - 140.0) / 320.0)
    bm.to_mesh(me)
    bm.free()
    for mt in mats:
        me.materials.append(mt)
    ob = mesh_object("NORA_Gemini_Body", me, coll, parent)
    return ob


def build_hole_cutter(coll, parent, eva):
    """All 66 holes in one cutter mesh (hidden), used by a live Boolean."""
    bm = bmesh.new()
    segs = 32
    for (x, z) in G.hole_centres():
        geom = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs,
                                     radius1=G.HOLE_D / 2 * MM, radius2=G.HOLE_D / 2 * MM,
                                     depth=(T + 20) * MM)
        m = Matrix.Translation((x * MM, 0, z * MM)) @ Matrix.Rotation(math.radians(90), 4, "X")
        bmesh.ops.transform(bm, matrix=m, verts=geom["verts"])
    me = bpy.data.meshes.new("ME_NORA_Hole_Cutter")
    bm.to_mesh(me)
    bm.free()
    me.materials.append(eva)
    ob = mesh_object("CUT_NORA_Holes", me, coll, parent)
    ob.display_type = "WIRE"
    ob.hide_render = True
    ob.visible_camera = False
    ob.visible_shadow = False
    ob["nora_note"] = "Boolean cutter for the 66 x 11 mm holes. Move/scale holes here."
    return ob


def rounded_rect(hx, hy, r, steps=6):
    pts = []
    for cx, cy, a0 in ((hx - r, hy - r, 0), (-hx + r, hy - r, 90), (-hx + r, -hy + r, 180), (hx - r, -hy + r, 270)):
        for k in range(steps + 1):
            a = math.radians(a0 + 90 * k / steps)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def loft(name, rings, coll, parent, mat, cap_bottom=True, cap_top=True, smooth=True):
    """rings: list of (z_mm, [(x_mm, y_mm), ...]) all with equal point counts."""
    bm = bmesh.new()
    vrings = []
    for z, pts in rings:
        vrings.append([bm.verts.new((x * MM, y * MM, z * MM)) for (x, y) in pts])
    n = len(vrings[0])
    for a, b in zip(vrings[:-1], vrings[1:]):
        for i in range(n):
            f = bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]))
            f.smooth = smooth
    if cap_bottom:
        f = bm.faces.new(list(reversed(vrings[0])))
        f.smooth = False
    if cap_top:
        f = bm.faces.new(vrings[-1])
        f.smooth = False
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new("ME_" + name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    return mesh_object(name, me, coll, parent)


def outline_half_width(z):
    best = None
    for (x, zz) in G.head_outline():
        if x > 0 and (best is None or abs(zz - z) < abs(best[1] - z)):
            best = (x, zz)
    return best[0]


def build_handle(coll, parent, grip_mat, rim_mat):
    hx, hy = G.HANDLE_HALF_X + 1.3, G.HANDLE_HALF_Y + 1.3      # + overgrip thickness
    # grip: slight flare toward the butt
    rings = []
    for z in (G.GRIP[0], G.GRIP[0] + 6, G.GRIP[0] + 16, 60, 100, G.GRIP[1]):
        flare = 1.0 + 0.07 * max(0.0, 1.0 - (z - G.GRIP[0]) / 18.0)
        rings.append((z, rounded_rect(hx * flare, hy * flare, 7.0)))
    grip = loft("NORA_Gemini_Grip", rings, coll, parent, grip_mat)
    # collar: wraps the frame where it enters the handle
    rings = []
    zc0, zc1 = G.COLLAR
    for k in range(6):
        z = zc0 + (zc1 - zc0) * k / 5
        w = max(outline_half_width(z), hx) + 1.6
        rings.append((z, rounded_rect(w, G.HANDLE_HALF_Y + 1.8, 6.5)))
    collar = loft("NORA_Gemini_Collar", rings, coll, parent, rim_mat)
    bev = collar.modifiers.new("Bevel", "BEVEL")
    bev.width = 0.0012
    bev.segments = 3
    bev.limit_method = "ANGLE"
    # butt cap
    z0, z1 = G.BUTT_CAP
    rings = []
    for z, s in ((z0, 0.96), (z0 + 2, 1.0), (z1 - 2, 1.0), (z1, 0.97)):
        rings.append((z, rounded_rect((hx + 2.2) * s, (hy + 2.2) * s, 8.0)))
    cap = loft("NORA_Gemini_ButtCap", rings, coll, parent, rim_mat)
    bev = cap.modifiers.new("Bevel", "BEVEL")
    bev.width = 0.0015
    bev.segments = 3
    bev.limit_method = "ANGLE"
    return grip, collar, cap


# ===================================================================== studio
def build_backdrop(coll, mat):
    """Seamless cyclorama: floor sweeping up into a wall behind (+Y)."""
    bm = bmesh.new()
    prof = []
    for k in range(9):
        prof.append((-3.0 + 3.6 * k / 8, 0.0))
    rad = 0.9
    for k in range(1, 17):
        a = math.radians(90 * k / 16)
        prof.append((0.6 + rad * math.sin(a), rad - rad * math.cos(a)))
    prof.append((0.6 + rad, 4.0))
    rows = []
    for x in (-4.0, -2.0, 0.0, 2.0, 4.0):
        rows.append([bm.verts.new((x, y, z)) for (y, z) in prof])
    for a, b in zip(rows[:-1], rows[1:]):
        for i in range(len(prof) - 1):
            f = bm.faces.new((a[i], b[i], b[i + 1], a[i + 1]))
            f.smooth = True
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new("ME_ENV_Cyclorama")
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    ob = mesh_object("ENV_Cyclorama", me, coll)
    # make normals face up / toward camera
    for p in me.polygons:
        if p.normal.z < -0.5 or p.normal.y > 0.5:
            pass
    return ob


def area_light(name, coll, loc, target, size, power, color=(1, 1, 1), shape="RECTANGLE", spread=180):
    ld = bpy.data.lights.get(name) or bpy.data.lights.new(name, "AREA")
    ld.shape = shape
    if shape in ("RECTANGLE", "ELLIPSE"):
        ld.size, ld.size_y = size
    else:
        ld.size = size[0]
    ld.energy = power
    ld.color = color
    ld.spread = math.radians(spread)
    ob = bpy.data.objects.get(name)
    if ob:
        bpy.data.objects.remove(ob, do_unlink=True)
    ob = bpy.data.objects.new(name, ld)
    link(ob, coll)
    ob.visible_camera = False          # soft boxes light & reflect, but are never seen directly
    ob.location = loc
    d = Vector(target) - Vector(loc)
    ob.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    return ob


def camera(name, coll, loc, target, lens, shift=(0, 0)):
    cd = bpy.data.cameras.get(name) or bpy.data.cameras.new(name)
    cd.lens = lens
    cd.sensor_width = 36
    cd.shift_x, cd.shift_y = shift
    cd.clip_start = 0.02
    ob = bpy.data.objects.get(name)
    if ob:
        bpy.data.objects.remove(ob, do_unlink=True)
    ob = bpy.data.objects.new(name, cd)
    link(ob, coll)
    ob.location = loc
    d = Vector(target) - Vector(loc)
    ob.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    return ob


def setup_render(scene, res=(1600, 2000)):
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 160
    scene.cycles.use_denoising = True
    try:
        scene.cycles.denoiser = "OPENIMAGEDENOISE"
    except TypeError:
        pass
    scene.cycles.max_bounces = 8
    scene.cycles.caustics_reflective = False
    scene.cycles.caustics_refractive = False
    scene.render.resolution_x, scene.render.resolution_y = res
    scene.render.resolution_percentage = 100
    scene.render.fps = 30
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "AgX"
    try:
        scene.view_settings.look = "AgX - Medium High Contrast"
    except TypeError:
        pass
    scene.view_settings.exposure = 0.0
    scene.render.image_settings.file_format = "PNG"


def setup_world(scene):
    w = bpy.data.worlds.get("WLD_NORA_Studio") or bpy.data.worlds.new("WLD_NORA_Studio")
    if hasattr(w, "use_nodes"):
        w.use_nodes = True
    nt = w.node_tree
    bg = nt.nodes.get("Background") or nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Color"].default_value = (0.012, 0.013, 0.016, 1)
    bg.inputs["Strength"].default_value = 1.0
    outn = next((n for n in nt.nodes if n.type == "OUTPUT_WORLD"), None) or nt.nodes.new("ShaderNodeOutputWorld")
    nt.links.new(bg.outputs["Background"], outn.inputs["Surface"])
    scene.world = w


# ======================================================================= main
def main():
    scene = bpy.context.scene
    # clean slate for a fresh factory file only (never touch user objects)
    if not bpy.data.filepath:
        for nm in ("Cube", "Light", "Camera"):
            ob = bpy.data.objects.get(nm)
            if ob and ob.users_collection and ob.users_collection[0] == scene.collection.children.get("Collection", scene.collection):
                bpy.data.objects.remove(ob, do_unlink=True)
    old = bpy.data.scenes.get(HERO_SCENE)
    if old:
        bpy.data.scenes.remove(old)
    purge_collection(RACKET_COLL)
    purge_collection(STUDIO_COLL)
    for nm in ("RIG_Turntable",):
        ob = bpy.data.objects.get(nm)
        if ob:
            bpy.data.objects.remove(ob, do_unlink=True)

    rc = get_collection(RACKET_COLL)
    sc = get_collection(STUDIO_COLL)
    lc = get_collection("NORA_Lights", sc)
    cc = get_collection("NORA_Cameras", sc)

    # ------------------------------------------------------------ materials
    m_face_I = mat_face("I")
    m_face_II = mat_face("II")
    m_rim = mat_rim()
    m_eva = mat_eva()
    m_grip = mat_grip()
    m_back = mat_simple("MAT_ENV_Backdrop_Charcoal", (0.030, 0.031, 0.034, 1), 0.55)

    # ------------------------------------------------------------ hierarchy
    turntable = bpy.data.objects.new("RIG_Turntable", None)
    turntable.empty_display_type = "CIRCLE"
    turntable.empty_display_size = 0.2
    link(turntable, sc)
    turntable.location = (0, 0, FLOAT_Z)

    root = bpy.data.objects.new("NORA_Gemini_ROOT", None)
    root.empty_display_type = "SINGLE_ARROW"
    root.empty_display_size = 0.5
    link(root, rc)
    root.parent = turntable
    root["model"] = "NORA GEMINI"
    root["face_I"] = "RED - 3K carbon - sand grit + 3D hexagon"
    root["face_II"] = "BLUE - 16K aluminized - fine sand"
    root["dimensions_mm"] = "455 x 260 x 38"

    body = build_body(rc, root, [m_face_I, m_face_II, m_rim])
    cutter = build_hole_cutter(rc, root, m_eva)
    boo = body.modifiers.new("Holes", "BOOLEAN")
    boo.operation = "DIFFERENCE"
    boo.solver = "EXACT"
    boo.object = cutter
    boo.material_mode = "TRANSFER"
    ws = body.modifiers.new("WeightedNormals", "WEIGHTED_NORMAL")
    ws.keep_sharp = True
    build_handle(rc, root, m_grip, m_rim)

    # ------------------------------------------------------------ studio
    build_backdrop(sc, m_back)
    tgt = (0, 0, FLOAT_Z + 0.25)
    area_light("LGT_Key", lc, (-1.05, -1.45, 1.35), tgt, (1.2, 1.6), 55)
    area_light("LGT_Fill", lc, (1.6, -1.1, 0.55), tgt, (1.4, 1.4), 10)
    area_light("LGT_Top_Softbox", lc, (0.0, -0.75, 1.7), tgt, (1.6, 0.9), 22)
    area_light("LGT_Rim_Red", lc, (-0.85, 0.55, 0.65), tgt, (0.25, 1.4), 45, (1.0, 0.18, 0.2))
    area_light("LGT_Rim_Blue", lc, (0.85, 0.55, 0.65), tgt, (0.25, 1.4), 45, (0.2, 0.42, 1.0))
    area_light("LGT_Backdrop_Glow", lc, (0.0, 0.2, 0.02), (0, 1.4, 0.9), (1.8, 0.4), 6, spread=70)

    zc = FLOAT_Z + 0.2275
    cam_face = camera("CAM_Face", cc, (0.0, -1.55, zc + 0.01), (0, 0, zc), 85)
    camera("CAM_ThreeQuarter", cc, (-0.72, -1.12, zc + 0.20), (0, 0, zc - 0.005), 85)
    camera("CAM_Detail_Face", cc, (0.035, -0.42, FLOAT_Z + 0.31), (0.012, 0, FLOAT_Z + 0.282), 100)
    camera("CAM_Detail_Throat", cc, (0.0, -0.40, FLOAT_Z + 0.24), (0.0, 0, FLOAT_Z + 0.232), 100)
    camera("CAM_Edge_Macro", cc, (-0.52, -0.30, FLOAT_Z + 0.53), (-0.095, 0, FLOAT_Z + 0.395), 85)
    scene.camera = cam_face

    setup_world(scene)
    setup_render(scene)

    # ------------------------------------------------------------ turntable
    scene.frame_start, scene.frame_end = 1, 120
    turntable.rotation_euler = (0, 0, 0)
    turntable.keyframe_insert("rotation_euler", index=2, frame=1)
    turntable.rotation_euler = (0, 0, 2 * math.pi)
    turntable.keyframe_insert("rotation_euler", index=2, frame=121)
    ad = turntable.animation_data
    try:
        fcs = ad.action.fcurves
    except AttributeError:
        slot = ad.action_slot.handle
        fcs = [fc for layer in ad.action.layers for strip in layer.strips
               for cb in strip.channelbags if cb.slot_handle == slot for fc in cb.fcurves]
    for fc in fcs:
        for kp in fc.keyframe_points:
            kp.interpolation = "LINEAR"
    scene.frame_set(1)

    # ------------------------------------------------------------ hero twins scene
    hero = bpy.data.scenes.new(HERO_SCENE)
    hero.collection.children.link(sc)        # shares backdrop, lights, cameras
    twins = []
    for nm, x, rz in (("TWIN_I_Red", -0.175, math.radians(14)),
                      ("TWIN_II_Blue", 0.175, math.radians(180 - 14))):
        inst = bpy.data.objects.new(nm, None)
        inst.instance_type = "COLLECTION"
        inst.instance_collection = rc
        inst.location = (x, 0.0, 0.0)
        inst.rotation_euler = (0, 0, rz)
        hero.collection.objects.link(inst)
        twins.append(inst)
    hcd = bpy.data.cameras.new("CAM_Hero_Twins")
    hcd.lens = 70
    hcam = bpy.data.objects.new("CAM_Hero_Twins", hcd)
    hero.collection.objects.link(hcam)
    hcam.location = (0.0, -1.75, zc + 0.04)
    hcam.rotation_euler = (Vector((0, 0, zc)) - hcam.location).to_track_quat("-Z", "Y").to_euler()
    hero.camera = hcam
    hero.world = scene.world
    setup_render(hero, (2400, 1500))
    hero.frame_start = hero.frame_end = hero.frame_current = 1
    # the racket collection is excluded from the hero scene (only instances)
    return dict(body=body.name, holes=len(G.hole_centres()))


if __name__ == "__main__":
    info = main()
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    if "--save" in argv:
        path = os.path.abspath(argv[argv.index("--save") + 1])
        bpy.ops.wm.save_as_mainfile(filepath=path)
        # portable file: relative texture paths + textures packed inside the .blend
        bpy.ops.file.make_paths_relative()
        bpy.ops.file.pack_all()
        bpy.ops.wm.save_as_mainfile(filepath=path)
        print("saved", path)
    print("NORA GEMINI built:", info)
