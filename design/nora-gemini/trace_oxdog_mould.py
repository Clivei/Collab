"""
Trace the OXDOG Ultimate Pro Light mould 1:1 from the reference photos.

    python trace_oxdog_mould.py          (needs numpy + opencv-python)

Inputs  : assets/oxdog_upl_front.jpg  (straight front view, plain background)
          assets/oxdog_upl_side.jpg   (straight edge view)
Output  : oxdog_mould_trace.json      (all values in mm; read by nora_geometry.py)

Scale: total length = 453 mm (Racketguide measurement of the Ultimate Pro Light:
453 mm long, 251 mm wide, 37-38 mm profile).  The traced width comes out at
~250 mm, which independently confirms the scale.  Everything is mirrored and
averaged left/right, so the mould is perfectly symmetric.

Coordinates: x = 0 on the centre line, z = 0 at the butt of the handle.
"""
import json
import math
import os

import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
FRONT = os.path.join(HERE, "assets", "oxdog_upl_front.jpg")
SIDE = os.path.join(HERE, "assets", "oxdog_upl_side.jpg")
OUT = os.path.join(HERE, "oxdog_mould_trace.json")

TOTAL_LENGTH = 453.0
FRAME_PROFILE = 38.0          # printed on the frame: "38mm FRAME"
UP = 4                        # sub-pixel upsampling factor
EDGE_LEVEL = 150              # grey level of the edge (background is 230)


def segment(path):
    g = cv2.cvtColor(cv2.imread(path), cv2.COLOR_BGR2GRAY)
    fg = (g < 205).astype(np.uint8)
    # drop the wrist strap: open, keep the largest blob, then restore detail near it
    op = cv2.morphologyEx(fg, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13)))
    n, lab, st, _ = cv2.connectedComponentsWithStats(op, 8)
    main = (lab == 1 + np.argmax(st[1:, 4])).astype(np.uint8)
    keep = cv2.dilate(main, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15)))
    # sub-pixel mask: upsample the grey image, threshold at the edge level
    gu = cv2.resize(g, None, fx=UP, fy=UP, interpolation=cv2.INTER_CUBIC)
    ku = cv2.resize(keep, None, fx=UP, fy=UP, interpolation=cv2.INTER_NEAREST)
    mu = ((gu < EDGE_LEVEL) & (ku > 0)).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(mu, 8)
    mu = (lab == 1 + np.argmax(st[1:, 4])).astype(np.uint8)
    return mu


def radial_profile(pts, centre, n=720, start_deg=90.0, sweep=-180.0, outer=False, smooth=0, closed=False):
    """Average radius vs angle (right half, already mirrored+merged)."""
    cx, cz = centre
    ang = np.degrees(np.arctan2(pts[:, 1] - cz, pts[:, 0] - cx))
    rad = np.hypot(pts[:, 0] - cx, pts[:, 1] - cz)
    out = []
    for k in range(n + 1):
        a = start_deg + sweep * k / n
        sel = np.abs(((ang - a + 180) % 360) - 180) < (abs(sweep) / n) * 1.5
        if sel.any():
            # rim glare can only eat into the silhouette, never add to it -> bias outward
            r = float(np.percentile(rad[sel], 85 if outer else 50))
            out.append((a, r))
    a = np.array([p[0] for p in out])
    r = np.array([p[1] for p in out])
    if smooth > 0:                                   # gaussian low-pass on r(angle)
        k = np.exp(-0.5 * (np.arange(-3 * smooth, 3 * smooth + 1) / smooth) ** 2)
        k /= k.sum()
        pad = 3 * smooth
        rp = np.concatenate([r[pad:0:-1], r, r[-2:-pad - 2:-1]]) if not closed else np.concatenate([r[-pad:], r, r[:pad]])
        r = np.convolve(rp, k, mode="same")[pad:pad + len(a)]
    return [(cx + rr * math.cos(math.radians(aa)), cz + rr * math.sin(math.radians(aa))) for aa, rr in zip(a, r)]


def smooth_closed(poly, k=5):
    p = np.array(poly)
    q = np.zeros_like(p)
    n = len(p)
    for i in range(n):
        idx = [(i + j) % n for j in range(-k, k + 1)]
        q[i] = p[idx].mean(0)
    return q


def main():
    m = cv2.copyMakeBorder(segment(FRONT), 4, 4, 4, 4, cv2.BORDER_CONSTANT, 0)
    ys, xs = np.where(m)
    top, bot = ys.min(), ys.max() + 1
    s = TOTAL_LENGTH / (bot - top)                         # mm per (upsampled) pixel
    cx_px = 0.5 * (xs.min() + xs.max() + 1)

    def mm(p):                                             # pixel -> (x, z) mm
        return np.stack([(p[:, 0] + 0.5 - cx_px) * s, (bot - (p[:, 1] + 0.5)) * s], 1)

    contours, hier = cv2.findContours(m, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    hier = hier[0]
    outer_i = max((i for i in range(len(contours)) if hier[i][3] < 0), key=lambda i: cv2.contourArea(contours[i]))
    outer = mm(contours[outer_i][:, 0, :].astype(np.float64))
    width = outer[:, 0].max() - outer[:, 0].min()

    # ---------------- outer outline of the head + throat (right half, symmetric)
    neck_z = None
    # width per z to find the neck (narrowest point between the throat and the collar)
    zs = np.arange(120, 200, 0.5)
    half = []
    for z in zs:
        sel = np.abs(outer[:, 1] - z) < 0.6
        half.append(np.abs(outer[sel, 0]).max() if sel.any() else np.nan)
    half = np.array(half)
    neck_z = float(zs[np.nanargmin(np.where((zs > 135) & (zs < 175), half, np.nan))])
    neck_half = float(np.nanmin(np.where((zs > 135) & (zs < 175), half, np.nan)))

    head = outer[outer[:, 1] >= neck_z]
    merged = np.concatenate([head[head[:, 0] >= 0], head[head[:, 0] < 0] * [-1, 1]])
    centre = (0.0, 0.5 * (neck_z + TOTAL_LENGTH) + 40.0)
    right = radial_profile(merged, centre, n=900, start_deg=90.0, sweep=-176.0, outer=True, smooth=4)
    right = [p for p in right if p[1] >= neck_z + 1.0]
    right[0] = (0.0, right[0][1])

    # ---------------- interior openings: throat windows + face holes
    holes, windows = [], []
    max_pair_err = 0.0
    for i in range(len(contours)):
        if hier[i][3] != outer_i:
            continue
        c = contours[i][:, 0, :].astype(np.float64)
        area_mm2 = cv2.contourArea(contours[i]) * s * s
        pm = mm(c)
        if area_mm2 < 15:
            continue
        perim = cv2.arcLength(contours[i], True) * s
        circular = 4 * math.pi * area_mm2 / max(perim * perim, 1e-9)
        if area_mm2 < 300 and circular < 0.75:
            continue                                   # printed lettering, highlights
        if area_mm2 < 300:
            M = cv2.moments(contours[i])
            cxm = (M["m10"] / M["m00"] + 0.5 - cx_px) * s
            czm = (bot - (M["m01"] / M["m00"] + 0.5)) * s
            holes.append((cxm, czm, 2 * math.sqrt(area_mm2 / math.pi)))
        else:
            windows.append(pm)

    # symmetrise the holes: centre-line holes + mirrored pairs (greedy global match)
    centre_h = [h for h in holes if abs(h[0]) < 2.5]
    rights = [h for h in holes if h[0] >= 2.5]
    lefts = [h for h in holes if h[0] <= -2.5]
    cand = sorted((math.hypot(r[0] + l[0], r[1] - l[1]), a, b)
                  for a, r in enumerate(rights) for b, l in enumerate(lefts))
    ua, ub, pairs = set(), set(), []
    for dist, a, b in cand:
        if a in ua or b in ub:
            continue
        ua.add(a)
        ub.add(b)
        pairs.append((rights[a], lefts[b], dist))
    pairs = [p for p in pairs if p[2] < 2.5]           # a real hole always has a mirror twin
    holes_sym = [(0.0, z, d) for (_, z, d) in centre_h]
    for r, l, dist in pairs:
        xa, za, da = 0.5 * (r[0] - l[0]), 0.5 * (r[1] + l[1]), 0.5 * (r[2] + l[2])
        holes_sym += [(xa, za, da), (-xa, za, da)]
    max_pair_err = max(p[2] for p in pairs)
    holes_sym.sort(key=lambda h: (-round(h[1]), h[0]))

    # symmetrise the windows: centre one + the right one (left = mirror)
    windows.sort(key=lambda w: w[:, 0].mean())
    assert len(windows) == 3, f"expected 3 throat windows, found {len(windows)}"
    wl, wc, wr = windows
    wr_m = np.concatenate([wr, wl * [-1, 1]])
    c_r = (wr_m[:, 0].mean(), wr_m[:, 1].mean())
    win_right = radial_profile(wr_m, c_r, n=360, start_deg=180.0, sweep=-360.0, smooth=2, closed=True)[:-1]
    wc_m = np.concatenate([wc, wc * [-1, 1]])
    c_c = (0.0, wc_m[:, 1].mean())
    win_centre = radial_profile(wc_m, c_c, n=360, start_deg=180.0, sweep=-360.0, smooth=2, closed=True)[:-1]
    win_right = smooth_closed(win_right, 2).tolist()
    win_centre = smooth_closed(win_centre, 2).tolist()

    # ---------------- handle from the front silhouette (width) ...
    def half_width_at(z):
        sel = np.abs(outer[:, 1] - z) < 0.6
        return float(np.abs(outer[sel, 0]).max()) if sel.any() else None

    handle_front = [(z, half_width_at(z)) for z in np.arange(1.0, neck_z, 2.0)]

    # ... and the thickness profile from the side view
    ms = segment(SIDE)
    ys2, xs2 = np.where(ms)
    top2, bot2 = ys2.min(), ys2.max() + 1
    s2 = TOTAL_LENGTH / (bot2 - top2)
    rows = {}
    for zmm in np.arange(4.0, TOTAL_LENGTH - 10.0, 3.0):
        y = int(round(bot2 - zmm / s2))
        r = np.where(ms[y])[0]
        if len(r):
            # ignore the strap (far right) - take the run around the frame axis
            axis = np.median(xs2) if False else None
            rows[float(zmm)] = (r.max() - r.min() + 1) * s2
    head_vals = [v for z, v in rows.items() if 250 < z < 420]
    k = FRAME_PROFILE / float(np.median(head_vals))          # side photo scale correction
    thickness = [(z, round(v * k, 2)) for z, v in rows.items()]

    out = dict(
        source="OXDOG Ultimate Pro Light reference photos (front + side), traced",
        total_length=TOTAL_LENGTH,
        width=round(width, 2),
        frame_profile=FRAME_PROFILE,
        neck_z=round(neck_z, 2), neck_half_width=round(neck_half, 2),
        outline_right=[(round(x, 3), round(z, 3)) for x, z in right],
        window_right=[(round(x, 3), round(z, 3)) for x, z in win_right],
        window_centre=[(round(x, 3), round(z, 3)) for x, z in win_centre],
        holes=[(round(x, 2), round(z, 2), round(d, 2)) for x, z, d in holes_sym],
        handle_front_half_width=[(round(z, 1), round(w, 2)) for z, w in handle_front if w],
        thickness_profile=thickness,
        mm_per_px_front=s * UP, side_scale_correction=round(k, 4),
    )
    with open(OUT, "w") as f:
        json.dump(out, f, indent=1)
    print(f"width {width:.1f} mm  neck z={neck_z:.1f} half={neck_half:.2f}  holes {len(holes_sym)} "
          f"(d {min(h[2] for h in holes_sym):.1f}-{max(h[2] for h in holes_sym):.1f} mm)  "
          f"outline pts {len(right)}  side k={k:.3f}  max L/R hole mismatch {max_pair_err:.2f} mm")


def overlay_check():
    """Draw the final mould geometry (nora_geometry) over the OXDOG photo."""
    import sys
    sys.path.insert(0, HERE)
    import nora_geometry as G
    m = segment(FRONT)
    ys, xs = np.where(m)
    top, bot = ys.min() / UP, (ys.max() + 1) / UP
    cx = 0.5 * (xs.min() + xs.max() + 1) / UP
    k = (bot - top) / G.LENGTH                      # px per mm
    S = 3
    im = cv2.resize(cv2.imread(FRONT), None, fx=S, fy=S, interpolation=cv2.INTER_CUBIC)

    def P(x, z):
        return (int(round((cx + x * k) * S)), int(round((bot - z * k) * S)))

    green, cyan = (60, 255, 60), (255, 230, 0)
    o = G.head_outline()
    cv2.polylines(im, [np.array([P(x, z) for x, z in o if z > G.NECK_Z + 4], np.int32)], False, green, 2, cv2.LINE_AA)
    for w in G.throat_windows():
        cv2.polylines(im, [np.array([P(x, z) for x, z in w], np.int32)], True, green, 2, cv2.LINE_AA)
    for x, z, d in G.holes():
        cv2.circle(im, P(x, z), int(round(d / 2 * k * S)), cyan if d == G.HOLE_SMALL else green, 2, cv2.LINE_AA)
    for x, z, nx, nz in G.rib_stations():
        cv2.line(im, P(x, z), P(x + nx * 6, z + nz * 6), (60, 60, 255), 2, cv2.LINE_AA)
    out = os.path.join(HERE, "production", "trace_check_overlay.png")
    cv2.imwrite(out, im)
    print("wrote", out)


if __name__ == "__main__":
    main()
    overlay_check()
