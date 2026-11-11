"""
NORA GEMINI - shared geometry of the production mould (pure Python, no deps).

The mould is the OXDOG Ultimate Pro Light frame, traced 1:1 from the reference
photos by trace_oxdog_mould.py into oxdog_mould_trace.json:
outline, the 68 holes (two sizes), the three throat windows (inverted-Y
bridge), the thickness taper of the throat and the handle envelope.

All values are millimetres, in the plane of the hitting face:
    x = across the face (width), 0 = centre line
    z = along the racket (length), 0 = butt of the handle, 453 = top of frame
Thickness runs along y (Blender: FACE I at -y, FACE II at +y).

Used by make_textures.py (artwork), build_nora_gemini.py (Blender) and
export_production.py (factory SVG / CSV) so everything stays in register.
"""
import json
import math
import os

_HERE = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(_HERE, "oxdog_mould_trace.json")) as _f:
    TRACE = json.load(_f)

# ----------------------------------------------------------------- dimensions
LENGTH = TRACE["total_length"]            # 453 mm
THICKNESS = TRACE["frame_profile"]        # 38 mm head
EDGE_RADIUS = 5.0                         # rounded outer edge of the frame
WINDOW_FILLET = 1.5                       # rounded edges of the throat windows
NECK_Z = TRACE["neck_z"]                  # narrowest point of the throat
BODY_BOTTOM = 128.0                       # frame runs on inside the collar

# handle (from the front + side silhouettes), half sizes in mm
BUTT_CAP = (0.0, 8.0)
GRIP = (8.0, 126.0)
COLLAR = (126.0, 140.0)
# (z, half_x, half_y) rings of the grip incl. overgrip: flared butt, oval grip
GRIP_RINGS = [
    (8.0, 21.2, 17.6), (20.0, 21.0, 17.8), (28.0, 19.4, 16.6), (36.0, 18.2, 15.4),
    (46.0, 17.4, 14.2), (56.0, 17.3, 13.5), (110.0, 17.3, 13.6), (126.0, 17.9, 14.6),
]
BUTT_RINGS = [(0.0, 19.0, 15.6), (2.0, 22.4, 17.0), (5.0, 23.1, 17.4), (8.0, 21.2, 17.6)]
COLLAR_RINGS = [(126.0, 19.2, 15.6), (130.0, 19.9, 17.4), (136.0, 20.8, 18.0), (140.0, 20.2, 17.2)]

# throat taper: frame thickness (y) vs z, from the side silhouette
THICKNESS_TABLE = [
    (128.0, 24.0), (140.0, 24.0), (150.0, 25.0), (160.0, 26.3), (170.0, 28.4),
    (180.0, 31.2), (190.0, 33.1), (200.0, 34.3), (210.0, 35.5), (220.0, 36.5),
    (235.0, 37.3), (250.0, 38.0), (LENGTH + 5.0, 38.0),
]

# Power Ribs: moulded grooves across the upper side edges of the frame
RIBS = dict(start_z=378.0, count=10, pitch=9.5, width=1.6, depth=1.0, half_span=13.0)


def thickness_at(z):
    t = THICKNESS_TABLE
    if z <= t[0][0]:
        return t[0][1]
    for (z0, v0), (z1, v1) in zip(t[:-1], t[1:]):
        if z0 <= z <= z1:
            u = (z - z0) / (z1 - z0)
            u = u * u * (3 - 2 * u)                  # smooth between samples
            return v0 + (v1 - v0) * u
    return t[-1][1]


# ------------------------------------------------------------------ helpers
def polygon_area(poly):
    a = 0.0
    for i in range(len(poly)):
        x0, z0 = poly[i - 1]
        x1, z1 = poly[i]
        a += x0 * z1 - x1 * z0
    return a * 0.5


def ccw(poly):
    poly = [tuple(p) for p in poly]
    return poly if polygon_area(poly) > 0 else list(reversed(poly))


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


def point_in_polygon(p, poly):
    x, z = p
    inside = False
    for i in range(len(poly)):
        x0, z0 = poly[i - 1]
        x1, z1 = poly[i]
        if (z0 > z) != (z1 > z):
            if x0 + (z - z0) * (x1 - x0) / (z1 - z0) > x:
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
        best = min(best, math.hypot(px - (ax + t * vx), pz - (az + t * vz)))
    return best


def _resample(poly, step):
    """Resample a closed polygon at a constant arc-length step."""
    pts = list(poly) + [poly[0]]
    seg = [math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(pts[:-1], pts[1:])]
    total = sum(seg)
    n = max(8, int(total / step))
    out, acc, i = [], 0.0, 0
    for k in range(n):
        s = k * total / n
        while acc + seg[i] < s:
            acc += seg[i]
            i += 1
        u = (s - acc) / (seg[i] or 1)
        a, b = pts[i], pts[i + 1]
        out.append((a[0] + u * (b[0] - a[0]), a[1] + u * (b[1] - a[1])))
    return out


# ---------------------------------------------------------------- outline
def head_outline(step=0.6):
    """Closed CCW outline of the frame body (head + throat) down to BODY_BOTTOM."""
    right = [tuple(p) for p in TRACE["outline_right"] if p[1] >= 147.0]   # top centre -> neck
    # smooth blend (cubic Bezier) from the traced throat into the vertical neck
    (xa, za), (xb, zb) = right[-2], right[-1]
    L = math.hypot(xb - xa, zb - za)
    da = ((xb - xa) / L, (zb - za) / L)
    neck_x, neck_z = 17.0, 138.0
    p0, p3 = (xb, zb), (neck_x, neck_z)
    h = 0.45 * math.hypot(p3[0] - p0[0], p3[1] - p0[1])
    p1 = (p0[0] + da[0] * h, p0[1] + da[1] * h)
    p2 = (p3[0], p3[1] + h)
    for k in range(1, 13):
        t = k / 12
        u = 1 - t
        right.append(tuple(u ** 3 * a + 3 * u * u * t * b + 3 * u * t * t * c + t ** 3 * d
                           for a, b, c, d in zip(p0, p1, p2, p3)))
    # hidden inside the collar: run straight down, then a 6 mm rounded corner
    # (the 5 mm edge bevel needs corners rounder than itself)
    rc = 6.0
    right = right + [(neck_x, BODY_BOTTOM + rc)]
    for k in range(1, 9):
        a = math.radians(90 * k / 8)
        right.append((neck_x - rc + rc * math.cos(a), BODY_BOTTOM + rc - rc * math.sin(a)))
    # top -> down the right side -> across the bottom -> up the mirrored left side
    loop = right + [(-x, z) for (x, z) in reversed(right)][:-1]
    return ccw(_resample(loop, step))


def _smooth_closed(poly, passes=3, k=2):
    p = list(poly)
    n = len(p)
    for _ in range(passes):
        p = [(sum(p[(i + j) % n][0] for j in range(-k, k + 1)) / (2 * k + 1),
              sum(p[(i + j) % n][1] for j in range(-k, k + 1)) / (2 * k + 1)) for i in range(n)]
    return p


def throat_windows():
    """The three throat windows (right, left, centre), CCW, mm.
    Lightly smoothed (< 0.5 mm) so every bend is rounder than the fillet."""
    right = ccw(_smooth_closed(_resample(ccw(TRACE["window_right"]), 0.7)))
    left = ccw([(-x, z) for (x, z) in right])
    centre = ccw(_smooth_closed(_resample(ccw(TRACE["window_centre"]), 0.7)))
    return right, left, centre


throat_openings = throat_windows        # backwards-compatible name


# ------------------------------------------------------------------- holes
HOLE_SMALL, HOLE_LARGE = 8.0, 10.0      # the mould uses two drill sizes


def holes():
    """[(x, z, d)] - traced positions, diameters snapped to the two drill sizes."""
    return [(x, z, HOLE_SMALL if d < 8.6 else HOLE_LARGE) for (x, z, d) in TRACE["holes"]]


def hole_centres():
    return [(x, z) for (x, z, _) in holes()]


HOLE_D = HOLE_LARGE                     # nominal (largest) hole


# ------------------------------------------------------------------ ribs
def rib_stations():
    """Rib positions on the outline: [(x, z, nx, nz)] for both sides."""
    o = head_outline(0.25)
    # walk the right-hand side from the start height up toward the top centre
    right = [p for p in o if p[0] > 0]
    # order by angle from the head centre, going up from the side
    cz = 330.0
    right.sort(key=lambda p: math.atan2(p[1] - cz, p[0]))
    start = min(range(len(right)), key=lambda i: abs(right[i][1] - RIBS["start_z"]) + (0 if right[i][0] > 80 else 1e3))
    out, acc, k = [], 0.0, 0
    for i in range(start, len(right) - 1):
        a, b = right[i], right[i + 1]
        if acc >= k * RIBS["pitch"]:
            tx, tz = b[0] - a[0], b[1] - a[1]
            L = math.hypot(tx, tz) or 1
            nx, nz = tz / L, -tx / L
            if nx * a[0] + nz * (a[1] - cz) < 0:
                nx, nz = -nx, -nz
            out.append((a[0], a[1], nx, nz))
            k += 1
            if k == RIBS["count"]:
                break
        acc += math.hypot(b[0] - a[0], b[1] - a[1])
    return out + [(-x, z, -nx, nz) for (x, z, nx, nz) in out]


# ----------------------------------------------------- face artwork shapes
# The face graphic is the Gemini glyph (two pillars + bowed bars, like the
# zodiac sign) - which also reads as the Roman numeral II.  Its pillars run
# in the hole-free lanes of the OXDOG pattern (x ~ +/-42.5 mm).
GLYPH = dict(
    pillar_x=42.6, pillar_w=10.5, pillar_z=(256.0, 410.0),
    bar_half_len=68.0, bar_t=9.0,
    top_z=408.6, bot_z=260.5, bow=-9.5,
)
TEX_BOUNDS = (-130.0, 130.0, 120.0, 460.0)   # face artwork image extent: x0, x1, z0, z1 (mm)
LOGO_Z = 233.0          # NORA word-mark (clean band between holes and throat)
NAME_Z = 222.0          # "GEMINI"
SPEC_Z = 215.5          # small spec line
LABEL_Z = 434.0         # small Roman numeral label, top centre


def glyph_bar(top=True, steps=60):
    g = GLYPH
    L, t, bow = g["bar_half_len"], g["bar_t"], g["bow"]
    zc = g["top_z"] if top else g["bot_z"]
    sgn = 1.0 if top else -1.0          # top bar droops at the ends, bottom bar lifts
    upper, lower = [], []
    for i in range(steps + 1):
        x = -L + 2 * L * i / steps
        z = zc + sgn * bow * (x / L) ** 2
        tt = t * (1.0 - 0.30 * (abs(x) / L) ** 3)
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
    print(f"outline pts {len(o)}  width {max(xs) - min(xs):.1f}  z {min(zs):.1f}..{max(zs):.1f}  "
          f"area {polygon_area(o):.0f}")
    h = holes()
    print("holes", len(h), "small", sum(1 for x in h if x[2] == HOLE_SMALL),
          "large", sum(1 for x in h if x[2] == HOLE_LARGE))
    r, l, c = throat_windows()
    gap = min(distance_to_polygon(p, l) for p in r)
    leg = min(distance_to_polygon(p, c) for p in r)
    wall = min(distance_to_polygon(p, o) for p in r)
    print(f"throat: stem {gap:.1f} mm, legs {leg:.1f} mm, outer wall {wall:.1f} mm")
    print("ribs", len(rib_stations()), [(round(x), round(z)) for x, z, *_ in rib_stations()[:10]])
