"""NORA Gemini v3 - NEW mould (not the traced OXDOG one): squared-shoulder diamond, single delta throat window,
staggered drilling. Defines OUT / WR / WC / HOL in the same x10 integer format the v2 body builder reads.
Load order: v2 data (for LOGO) -> this file -> gemini_v2_body.py -> gemini_v3_art.py"""
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


def _chaikin(p, k=3):
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
_tri = _chaikin(np.array([(0.0, 148.0), (10, 163), (31, 204), (0, 207), (-31, 204), (-10, 163)]), 3)
_holes = []
for r, z in enumerate(np.arange(252.0, 446.0, 16.5)):
    for k in range(-8, 9):
        _holes.append(((k + (r & 1) * 0.5) * 19.0, z))
_holes = np.array(_holes)
_ok = _inside(_holes, _full) & (_dist(_holes, _full) > 25.0) & (_dist(_holes, _tri) > 16.0) & (_holes[:, 0] > -0.1)
_holes = _holes[_ok]

OUT = [int(round(v * 10)) for p in _half for v in p]
WC = [int(round(v * 10)) for p in _tri for v in p]
WR = WC                                    # placeholder; the override below removes side windows
HOL = [int(round(v)) for x, z in _holes for v in (x * 10, z * 10, 100)]
