"""
NORA GEMINI - shared 2D geometry (pure Python, no dependencies).

All values are in millimetres, in the plane of the hitting face:
    x = across the face (width), 0 = centre line
    z = along the racket (length), 0 = butt of the handle, 455 = top of the frame

Used by both make_textures.py (artwork) and build_nora_gemini.py (Blender),
so holes, throat openings and printed graphics always line up.

The head outline follows the diamond / teardrop frame of the reference
OXDOG-style mould: flat-ish top, widest ~75 mm below the top, long taper
into an open throat and the handle.
"""
import math

# ----------------------------------------------------------------- dimensions
LENGTH = 455.0          # max legal length is 455 mm
WIDTH = 260.0           # max legal width is 260 mm
THICKNESS = 38.0        # max legal thickness is 38 mm
EDGE_RADIUS = 5.0       # rounded edge of the frame (bevel)
HOLE_D = 11.0           # hole diameter
BODY_BOTTOM = 140.0     # frame continues 10 mm into the handle collar

# handle
BUTT_CAP = (0.0, 14.0)          # z range
GRIP = (14.0, 147.0)            # z range
COLLAR = (147.0, 168.0)         # z range
HANDLE_HALF_X = 17.5            # half width of the grip core
HANDLE_HALF_Y = 19.0            # half depth of the grip core (= half thickness)

# ------------------------------------------------- outline (right half, mm)
# control points from the top centre, clockwise, down to the handle joint
_RIGHT_HALF = [
    (0.0, 455.0), (38.0, 454.0), (72.0, 450.0), (98.0, 442.0),
    (116.0, 429.0), (126.5, 411.0), (129.85, 390.0), (128.9, 368.0),
    (124.5, 344.0), (116.0, 316.0), (104.0, 287.0), (90.0, 260.0),
    (74.0, 235.0), (58.0, 213.0), (44.0, 196.0), (32.0, 181.0),
    (24.0, 166.0), (20.5, 153.0), (19.5, BODY_BOTTOM),
]


def _catmull_rom(points, samples_per_seg=24, closed=False):
    """Centripetal-ish uniform Catmull-Rom through the given points."""
    pts = list(points)
    n = len(pts)
    out = []
    seg_count = n if closed else n - 1
    for i in range(seg_count):
        p0 = pts[(i - 1) % n] if closed else pts[max(i - 1, 0)]
        p1 = pts[i % n]
        p2 = pts[(i + 1) % n] if closed else pts[min(i + 1, n - 1)]
        p3 = pts[(i + 2) % n] if closed else pts[min(i + 2, n - 1)]
        for s in range(samples_per_seg):
            t = s / samples_per_seg
            t2, t3 = t * t, t * t * t
            out.append(tuple(
                0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t
                       + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2
                       + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)
                for k in range(2)))
    if not closed:
        out.append(pts[-1])
    return out


def head_outline(samples_per_seg=24):
    """Closed outline of the frame body (counter-clockwise, no repeat)."""
    # mirror so the spline is smooth across the top centre line
    left = [(-x, z) for (x, z) in reversed(_RIGHT_HALF[1:])]
    full = left + _RIGHT_HALF                      # left-bottom -> top -> right-bottom
    curve = _catmull_rom(full, samples_per_seg, closed=False)
    # curve runs from (-19.5, 140) over the top to (19.5, 140); close along the bottom
    # orientation: left-bottom -> top -> right-bottom is clockwise; reverse for CCW
    curve = list(reversed(curve))
    return curve


def offset_polygon(poly, d):
    """Offset a closed smooth polygon by d (positive = outward for CCW)."""
    n = len(poly)
    out = []
    for i in range(n):
        x0, z0 = poly[i - 1]
        x2, z2 = poly[(i + 1) % n]
        tx, tz = x2 - x0, z2 - z0
        L = math.hypot(tx, tz) or 1.0
        nx, nz = tz / L, -tx / L                   # right-hand normal (outward for CCW)
        out.append((poly[i][0] + nx * d, poly[i][1] + nz * d))
    return out


def polygon_area(poly):
    a = 0.0
    for i in range(len(poly)):
        x0, z0 = poly[i - 1]
        x1, z1 = poly[i]
        a += x0 * z1 - x1 * z0
    return a * 0.5


def point_in_polygon(p, poly):
    x, z = p
    inside = False
    n = len(poly)
    for i in range(n):
        x0, z0 = poly[i - 1]
        x1, z1 = poly[i]
        if (z0 > z) != (z1 > z):
            xi = x0 + (z - z0) * (x1 - x0) / (z1 - z0)
            if xi > x:
                inside = not inside
    return inside


def distance_to_polygon(p, poly):
    best = 1e9
    px, pz = p
    for i in range(len(poly)):
        ax, az = poly[i - 1]
        bx, bz = poly[i]
        vx, vz = bx - ax, bz - az
        L2 = vx * vx + vz * vz or 1e-12
        t = max(0.0, min(1.0, ((px - ax) * vx + (pz - az) * vz) / L2))
        cx, cz = ax + t * vx, az + t * vz
        best = min(best, math.hypot(px - cx, pz - cz))
    return best


# --------------------------------------------------------- throat openings
def rounded_polygon(corners, radius, arc_steps=10, round_idx=None):
    """Polygon with corners rounded by `radius` (corners given CCW).

    round_idx: optional set of vertex indices to round (others are kept)."""
    n = len(corners)
    out = []
    for i in range(n):
        if round_idx is not None and i not in round_idx:
            out.append(corners[i])
            continue
        p_prev = corners[i - 1]
        p = corners[i]
        p_next = corners[(i + 1) % n]
        v1 = (p_prev[0] - p[0], p_prev[1] - p[1])
        v2 = (p_next[0] - p[0], p_next[1] - p[1])
        l1, l2 = math.hypot(*v1), math.hypot(*v2)
        u1 = (v1[0] / l1, v1[1] / l1)
        u2 = (v2[0] / l2, v2[1] / l2)
        cos_a = max(-1.0, min(1.0, u1[0] * u2[0] + u1[1] * u2[1]))
        ang = math.acos(cos_a)
        t = radius / math.tan(ang / 2)             # distance from corner to tangent points
        bis = (u1[0] + u2[0], u1[1] + u2[1])
        lb = math.hypot(*bis)
        bis = (bis[0] / lb, bis[1] / lb)
        c = (p[0] + bis[0] * radius / math.sin(ang / 2),
             p[1] + bis[1] * radius / math.sin(ang / 2))
        a_start = (p[0] + u1[0] * t, p[1] + u1[1] * t)
        a_end = (p[0] + u2[0] * t, p[1] + u2[1] * t)
        s0 = math.atan2(a_start[1] - c[1], a_start[0] - c[0])
        s1 = math.atan2(a_end[1] - c[1], a_end[0] - c[0])
        d = s1 - s0
        while d > math.pi:
            d -= 2 * math.pi
        while d < -math.pi:
            d += 2 * math.pi
        for k in range(arc_steps + 1):
            a = s0 + d * k / arc_steps
            out.append((c[0] + radius * math.cos(a), c[1] + radius * math.sin(a)))
    return out


BRIDGE_HALF = 12.0    # the central bridge between the twin openings is 24 mm wide


def throat_openings(frame_wall=16.0, top_z=241.0, corner_r=5.0):
    """The two 'Gemini twin' throat openings, CCW each: (right, left).

    Inner edge = the 18 mm central bridge, top edge = bottom of the hitting
    face, outer edge = follows the frame curve at a constant wall thickness.
    """
    inset = offset_polygon(head_outline(), -frame_wall)
    # right-hand side of the inset outline between the bridge and top_z
    side = [p for p in inset if p[0] > BRIDGE_HALF + 1.0 and 172.0 < p[1] <= top_z + 6.0]
    side.sort(key=lambda p: p[1])
    # exact point where the inner wall meets the top edge (interpolated)
    x_top = None
    for p, q in zip(side[:-1], side[1:]):
        if p[1] <= top_z <= q[1]:
            t = (top_z - p[1]) / (q[1] - p[1])
            x_top = p[0] + t * (q[0] - p[0])
    lo = side[0]
    # keep the wall points well clear of the two rounded corners
    bottom = (BRIDGE_HALF, lo[1] + 2.0)
    wall = [p for p in side
            if math.hypot(p[0] - bottom[0], p[1] - bottom[1]) > 17.0 and p[1] < top_z - 9.0][::4]
    # walk CCW: bridge-top -> bridge-bottom -> up the outer wall -> top-outer corner
    pts = [(BRIDGE_HALF, top_z), bottom] + wall + [(x_top, top_z)]
    n = len(pts)
    right = rounded_polygon(pts, corner_r, arc_steps=8, round_idx={0, 1, n - 1})
    left = [(-x, z) for (x, z) in reversed(right)]
    return right, left


# ------------------------------------------------------------------- holes
def hole_centres(spacing=23.5, z_min=294.0, edge_clear=17.0):
    """Staggered (hexagonal) hole pattern, symmetric about the centre line."""
    outline = head_outline()
    dz = spacing * math.sqrt(3) / 2
    holes = []
    row = 0
    z = z_min
    while z < LENGTH:
        shift = 0.0 if row % 2 == 0 else spacing / 2
        k = 0
        while True:
            x = shift + k * spacing
            if x > WIDTH / 2:
                break
            for sx in ((x,) if x == 0 else (x, -x)):
                p = (sx, z)
                if point_in_polygon(p, outline) and distance_to_polygon(p, outline) >= edge_clear:
                    holes.append(p)
            k += 1
        row += 1
        z += dz
    return holes


# ----------------------------------------------------- face artwork shapes
# The face graphic is the Gemini glyph (two pillars + bowed bars, like the
# zodiac sign) - which also reads as the Roman numeral II.
GLYPH = dict(
    pillar_x=40.0, pillar_w=20.0, pillar_z=(300.0, 400.0),
    bar_half_len=80.0, bar_t=15.0,
    top_z=405.0, bot_z=297.0, bow=11.0,
)


def glyph_bar(top=True, steps=60):
    g = GLYPH
    L, t, bow = g["bar_half_len"], g["bar_t"], g["bow"]
    zc = g["top_z"] if top else g["bot_z"]
    sgn = -1.0 if top else 1.0          # top bar droops at the ends, bottom bar lifts
    upper, lower = [], []
    for i in range(steps + 1):
        x = -L + 2 * L * i / steps
        z = zc + sgn * bow * (x / L) ** 2
        # end taper: bars get slimmer toward the tips
        tt = t * (1.0 - 0.35 * (abs(x) / L) ** 3)
        upper.append((x, z + tt / 2))
        lower.append((x, z - tt / 2))
    return lower + list(reversed(upper))


def glyph_pillar(left=True):
    g = GLYPH
    cx = -g["pillar_x"] if left else g["pillar_x"]
    w = g["pillar_w"]
    z0, z1 = g["pillar_z"]
    return [(cx - w / 2, z0), (cx + w / 2, z0), (cx + w / 2, z1), (cx - w / 2, z1)]


if __name__ == "__main__":
    o = head_outline()
    xs = [p[0] for p in o]
    zs = [p[1] for p in o]
    print("outline pts", len(o), "x", min(xs), max(xs), "z", min(zs), max(zs),
          "area", polygon_area(o))
    h = hole_centres()
    print("holes", len(h))
    r, l = throat_openings()
    print("opening min clearance to frame edge:",
          min(distance_to_polygon(p, o) for p in r))
