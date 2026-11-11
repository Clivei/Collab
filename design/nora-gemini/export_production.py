"""
Export factory files for the NORA GEMINI mould (OXDOG Ultimate Pro Light,
traced 1:1).  Pure Python, no dependencies:

    production/nora_gemini_layout.svg   1:1 vector (mm): outline, holes, throat windows, ribs
    production/hole_centres.csv         hole centre coordinates + drill size (mm)
    production/thickness_profile.csv    frame thickness along the length (mm)

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

holes = G.holes()
with open(os.path.join(OUT, "hole_centres.csv"), "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["hole", "x_mm", "z_mm", "diameter_mm"])
    for i, (x, z, d) in enumerate(sorted(holes, key=lambda p: (-round(p[1]), p[0])), 1):
        w.writerow([i, f"{x:.2f}", f"{z:.2f}", f"{d:.1f}"])

with open(os.path.join(OUT, "thickness_profile.csv"), "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["z_mm", "frame_thickness_mm"])
    for z in range(int(G.BODY_BOTTOM), int(G.LENGTH) + 1, 5):
        w.writerow([z, f"{G.thickness_at(z):.2f}"])

# SVG, 1 unit = 1 mm, y flipped so the racket stands upright
W, H = 280, 475
X_OFF, Z_OFF = W / 2, 10


def P(p):
    return f"{p[0] + X_OFF:.3f},{H - Z_OFF - p[1]:.3f}"


def path(poly):
    return "M " + " L ".join(P(p) for p in poly) + " Z"


svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}mm" height="{H}mm" viewBox="0 0 {W} {H}">',
       '<g fill="none" stroke="#000" stroke-width="0.3">',
       f'<path id="frame_outline" d="{path(G.head_outline())}"/>',
       f'<path id="face_edge" stroke="#999" stroke-dasharray="2 1" '
       f'd="{path(G.offset_polygon(G.head_outline(), -G.EDGE_RADIUS))}"/>']
for name, win in zip(("right", "left", "centre"), G.throat_windows()):
    svg.append(f'<path id="throat_window_{name}" d="{path(win)}"/>')
for i, (x, z, d) in enumerate(holes, 1):
    cx, cy = P((x, z)).split(",")
    svg.append(f'<circle id="hole_{i}_d{d:g}" cx="{cx}" cy="{cy}" r="{d / 2}"/>')
for i, (x, z, nx, nz) in enumerate(G.rib_stations(), 1):
    a = (x - nx * G.RIBS["depth"], z - nz * G.RIBS["depth"])
    svg.append(f'<path id="power_rib_{i}" stroke="#c00" d="M {P(a)} L {P((x + nx * 2, z + nz * 2))}"/>')
# handle envelope (front view half widths)
for part, rings in (("butt", G.BUTT_RINGS), ("grip", G.GRIP_RINGS), ("collar", G.COLLAR_RINGS)):
    pts = [(hx, z) for z, hx, _ in rings] + [(-hx, z) for z, hx, _ in reversed(rings)]
    svg.append(f'<path id="handle_{part}" stroke="#999" d="{path(pts)}"/>')
svg.append("</g>")
nb_s = sum(1 for h in holes if h[2] == G.HOLE_SMALL)
svg.append(f'<text x="4" y="{H - 2}" font-family="sans-serif" font-size="4.2">NORA GEMINI on OXDOG Ultimate Pro '
           f'Light mould - {G.LENGTH:.0f} x {max(p[0] for p in G.head_outline()) * 2:.0f} mm, '
           f'{G.THICKNESS:.0f} mm head - {len(holes)} holes ({nb_s} x {G.HOLE_SMALL:g} mm, '
           f'{len(holes) - nb_s} x {G.HOLE_LARGE:g} mm) - red: Power Ribs - scale 1:1</text>')
svg.append("</svg>")
with open(os.path.join(OUT, "nora_gemini_layout.svg"), "w") as f:
    f.write("\n".join(svg))
print("wrote production/: layout svg,", len(holes), "holes csv, thickness profile csv")
