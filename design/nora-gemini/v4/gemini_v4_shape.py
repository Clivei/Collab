"""NORA Gemini v4 mould: v3 squared-shoulder outline + the X-brace throat from the Canva deck
(two upper triangles over a diamond) + an aligned hole grid whose columns leave the glyph stems clear."""
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
