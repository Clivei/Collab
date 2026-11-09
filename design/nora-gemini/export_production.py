"""
Export factory files for the NORA GEMINI mould (pure Python, no deps):

    production/nora_gemini_layout.svg   1:1 vector (mm): outline, holes, throat
    production/hole_centres.csv         hole centre coordinates (mm)

Coordinates: x = 0 on the centre line, z = 0 at the butt of the handle.
"""
import csv
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import nora_geometry as G  # noqa: E402

OUT = os.path.join(HERE, "production")
os.makedirs(OUT, exist_ok=True)

holes = G.hole_centres()
with open(os.path.join(OUT, "hole_centres.csv"), "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["hole", "x_mm", "z_mm", "diameter_mm"])
    for i, (x, z) in enumerate(sorted(holes, key=lambda p: (-p[1], p[0])), 1):
        w.writerow([i, f"{x:.2f}", f"{z:.2f}", G.HOLE_D])

# SVG, 1 unit = 1 mm, y flipped so the racket stands upright
W, H = 300, 475


def P(p):
    return f"{p[0] + W / 2:.3f},{H - 10 - p[1]:.3f}"


def path(poly):
    return "M " + " L ".join(P(p) for p in poly) + " Z"


hx, hy = G.HANDLE_HALF_X + 1.3, 0
svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}mm" height="{H}mm" viewBox="0 0 {W} {H}">',
       '<g fill="none" stroke="#000" stroke-width="0.3">',
       f'<path id="frame_outline" d="{path(G.head_outline())}"/>',
       f'<path id="face_edge" stroke="#999" stroke-dasharray="2 1" d="{path(G.offset_polygon(G.head_outline(), -G.EDGE_RADIUS))}"/>']
for k, op in enumerate(G.throat_openings()):
    svg.append(f'<path id="throat_opening_{k + 1}" d="{path(op)}"/>')
for i, (x, z) in enumerate(holes, 1):
    cx, cy = P((x, z)).split(",")
    svg.append(f'<circle id="hole_{i}" cx="{cx}" cy="{cy}" r="{G.HOLE_D / 2}"/>')
# handle
g0, g1 = G.BUTT_CAP[0], G.COLLAR[1]
svg.append(f'<rect id="handle_envelope" stroke="#999" x="{W / 2 - hx - 2.2}" y="{H - 10 - g1}" '
           f'width="{2 * (hx + 2.2)}" height="{g1 - g0}"/>')
svg.append("</g>")
svg.append(f'<text x="5" y="{H - 2}" font-family="sans-serif" font-size="5">NORA GEMINI - '
           f'{G.LENGTH:.0f} x {G.WIDTH:.0f} x {G.THICKNESS:.0f} mm - {len(holes)} holes '
           f'x {G.HOLE_D:.0f} mm - scale 1:1</text>')
svg.append("</svg>")
with open(os.path.join(OUT, "nora_gemini_layout.svg"), "w") as f:
    f.write("\n".join(svg))
print("wrote production/hole_centres.csv and production/nora_gemini_layout.svg", len(holes), "holes")
