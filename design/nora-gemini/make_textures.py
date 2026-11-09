"""
NORA GEMINI - face artwork & surface map generator.

Run with any Python that has numpy + Pillow:
    python make_textures.py

Writes into ./textures/ :
    face_I_color.png  face_I_metal.png  face_I_rough.png  face_I_height.png
    face_II_color.png face_II_metal.png face_II_rough.png face_II_height.png

FACE I  (RED)  - 3K carbon, painted red, SAND GRIT + 3D hexagon relief.
FACE II (BLUE) - 16K aluminized fibre, blue tinted, light (less) sand.

Image space: 8 px/mm, x = -130..130 mm, z = 140..460 mm (see nora_geometry).
Face II artwork is painted as the viewer sees it, then mirrored so that it
reads correctly on the back of the racket.
"""
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import nora_geometry as G  # noqa: E402

PX = 8                      # pixels per mm
SS = 2                      # supersampling for vector shapes
X0, X1 = -130.0, 130.0
Z0, Z1 = 140.0, 460.0
W = int((X1 - X0) * PX)
H = int((Z1 - Z0) * PX)
OUT = os.path.join(HERE, "textures")
LOGO = os.path.join(HERE, "assets", "nora_logo.png")
FONT = "/usr/share/fonts/opentype/inter/InterDisplay-Bold.otf"

RED = np.array([209, 31, 63]) / 255.0        # NORA logo red
BLUE = np.array([28, 108, 176]) / 255.0      # NORA logo blue
WHITE = np.array([0.93, 0.93, 0.92])

# pixel-centre coordinates in mm
xs = X0 + (np.arange(W) + 0.5) / PX
zs = Z1 - (np.arange(H) + 0.5) / PX
XX, ZZ = np.meshgrid(xs, zs)


# ------------------------------------------------------------------ helpers
def to_px(p, s=SS):
    return ((p[0] - X0) * PX * s, (Z1 - p[1]) * PX * s)


def mask(draw_fn):
    """Draw with PIL at SSx, return float mask 0..1 at final res."""
    im = Image.new("L", (W * SS, H * SS), 0)
    draw_fn(ImageDraw.Draw(im))
    im = im.resize((W, H), Image.LANCZOS)
    return np.asarray(im, dtype=np.float32) / 255.0


def poly_mask(poly, outline_w=0.0, fill=True):
    def fn(d):
        pts = [to_px(p) for p in poly]
        if fill:
            d.polygon(pts, fill=255)
        if outline_w > 0:
            d.line(pts + [pts[0]], fill=255, width=max(1, int(outline_w * PX * SS)), joint="curve")
    return mask(fn)


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def value_noise(scale_mm, seed, octaves=3):
    """Cheap smooth value noise in mm space (for streaks / variation)."""
    rng = np.random.default_rng(seed)
    out = np.zeros((H, W), np.float32)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        s = scale_mm / (2 ** o)
        gw = int((X1 - X0) / s) + 3
        gh = int((Z1 - Z0) / s) + 3
        grid = rng.random((gh, gw)).astype(np.float32)
        im = Image.fromarray((grid * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC)
        out += amp * np.asarray(im, np.float32) / 255.0
        tot += amp
        amp *= 0.5
    return out / tot


def weave(tow_mm, twill, seed):
    """Return (orientation 0/1, tow-profile 0..1, filament streaks 0..1)."""
    i = np.floor((XX - X0) / tow_mm).astype(np.int64)
    j = np.floor((ZZ - Z0) / tow_mm).astype(np.int64)
    u = ((XX - X0) / tow_mm) - i
    v = ((ZZ - Z0) / tow_mm) - j
    if twill:
        o = (((i - j) % 4) < 2).astype(np.float32)          # 2x2 twill diagonals
    else:
        o = ((i + j) % 2).astype(np.float32)                # plain weave checker
    across = np.where(o > 0.5, u, v)                          # coordinate across the tow
    along = np.where(o > 0.5, v, u)
    profile = np.sin(np.pi * across) ** 0.6                   # rounded tow cross-section
    profile *= 0.75 + 0.25 * np.sin(np.pi * along) ** 0.5     # dip where tows cross
    rng = np.random.default_rng(seed)
    # filament streaks run along each tow
    fil = 0.5 + 0.5 * np.sin(across * np.pi * 2 * (6 + 3 * rng.random()) + 3.0 * value_noise(tow_mm * 3, seed))
    return o, profile.astype(np.float32), fil.astype(np.float32)


def hex_relief(cell_mm):
    """Raised hexagon '3D' mould relief: plateau tiles with soft grooves."""
    w = cell_mm
    h = w * math.sqrt(3)
    ax = XX / w
    az = ZZ / h
    # lattice A
    ca_x = np.round(ax) * w
    ca_z = np.round(az) * h
    # lattice B (offset by half)
    cb_x = (np.floor(ax) + 0.5) * w
    cb_z = (np.floor(az) + 0.5) * h
    da = (XX - ca_x) ** 2 + (ZZ - ca_z) ** 2
    db = (XX - cb_x) ** 2 + (ZZ - cb_z) ** 2
    dx = np.where(da < db, XX - ca_x, XX - cb_x)
    dz = np.where(da < db, ZZ - ca_z, ZZ - cb_z)
    adx, adz = np.abs(dx), np.abs(dz)
    # hex distance, 1.0 on the cell edge (pointy-top hex of circumradius w/sqrt3)
    hexd = np.maximum(adx, adx * 0.5 + adz * math.sqrt(3) / 2) / (w / 2)
    plateau = 1.0 - smoothstep(0.78, 0.97, hexd)
    dome = 1.0 - 0.25 * hexd ** 2
    return (plateau * dome).astype(np.float32)


def load_logo_mask():
    """White NORA word-mark mask from the brand logo (top line only)."""
    im = Image.open(LOGO).convert("RGBA")
    a = np.asarray(im)[..., 3]
    rows = np.where((a > 128).sum(1) > 0)[0]
    # first band of rows = 'NORA'
    breaks = np.where(np.diff(rows) > 1)[0]
    top_end = rows[breaks[0]] if len(breaks) else rows[-1]
    band = a[rows[0]:top_end + 1]
    cols = np.where((band > 128).any(0))[0]
    band = band[:, cols[0]:cols[-1] + 1]
    return Image.fromarray(band)


def paste_mask(dst, src_img, cx_mm, cz_mm, width_mm):
    """Composite a mask image (PIL L) onto dst (float HxW) centred at mm coords."""
    wpx = int(width_mm * PX)
    hpx = int(src_img.height * wpx / src_img.width)
    m = np.asarray(src_img.resize((wpx, hpx), Image.LANCZOS), np.float32) / 255.0
    x0 = int((cx_mm - X0) * PX - wpx / 2)
    y0 = int((Z1 - cz_mm) * PX - hpx / 2)
    dst[y0:y0 + hpx, x0:x0 + wpx] = np.maximum(dst[y0:y0 + hpx, x0:x0 + wpx], m)
    return hpx / PX


def text_mask(text, cx_mm, cz_mm, cap_mm, tracking=0.25, font=FONT):
    im = Image.new("L", (W * SS, H * SS), 0)
    d = ImageDraw.Draw(im)
    size = int(cap_mm * PX * SS / 0.727)           # Inter cap height ~0.727 em
    f = ImageFont.truetype(font, size)
    widths = [d.textlength(c, font=f) for c in text]
    track = tracking * size
    total = sum(widths) + track * (len(text) - 1)
    x = (cx_mm - X0) * PX * SS - total / 2
    ybase = (Z1 - cz_mm) * PX * SS + cap_mm * PX * SS / 2
    for c, wc in zip(text, widths):
        d.text((x, ybase), c, font=f, fill=255, anchor="ls")
        x += wc + track
    im = im.resize((W, H), Image.LANCZOS)
    return np.asarray(im, np.float32) / 255.0


def roman_mask(n, cx_mm, cz_mm, height_mm, stroke_mm=2.6, gap_mm=2.6):
    """Classic serif Roman numeral I / II, drawn as geometry (crisp, font-free)."""
    serif_w = stroke_mm * 2.4
    serif_t = stroke_mm * 0.55
    total_w = n * serif_w + (n - 1) * gap_mm
    left = cx_mm - total_w / 2

    def fn(d):
        for k in range(n):
            c = left + serif_w / 2 + k * (serif_w + gap_mm)
            z0, z1 = cz_mm - height_mm / 2, cz_mm + height_mm / 2
            # stem
            d.rectangle([to_px((c - stroke_mm / 2, z1)), to_px((c + stroke_mm / 2, z0))], fill=255)
            # serifs top/bottom
            for zz in (z1, z0 + serif_t):
                d.rectangle([to_px((c - serif_w / 2, zz)), to_px((c + serif_w / 2, zz - serif_t))], fill=255)
        # bars joining multiple numerals (Roman 'II' ligature top & bottom)
        if n > 1:
            for zz in (cz_mm + height_mm / 2, cz_mm - height_mm / 2 + serif_t):
                d.rectangle([to_px((left, zz)), to_px((left + total_w, zz - serif_t))], fill=255)
    return mask(fn)


# ------------------------------------------------------------- shared masks
print("building masks ...")
outline = G.head_outline()
face_edge = G.offset_polygon(outline, -G.EDGE_RADIUS)          # where the flat face starts
border_in = G.offset_polygon(outline, -(G.EDGE_RADIUS + 5.0))  # 5 mm exposed border band
key_in = G.offset_polygon(outline, -(G.EDGE_RADIUS + 5.9))     # 0.9 mm keyline

m_inside = poly_mask(outline)
m_border_in = poly_mask(border_in)
m_key_in = poly_mask(key_in)
m_border = m_inside * (1 - m_border_in)                  # exposed fibre band
m_keyline_edge = m_border_in * (1 - m_key_in)            # thin white line

# thin keyline around the twin throat openings
for op in G.throat_openings():
    o_a = poly_mask(G.offset_polygon(op, G.EDGE_RADIUS + 1.2))
    o_b = poly_mask(G.offset_polygon(op, G.EDGE_RADIUS + 2.1))
    m_keyline_edge = np.maximum(m_keyline_edge, np.clip(o_b - o_a, 0, 1))

bars = [G.glyph_bar(True), G.glyph_bar(False)]
pillar_solid = G.glyph_pillar(left=True)                 # viewer's left pillar is solid
pillar_open = G.glyph_pillar(left=False)                 # viewer's right pillar is outline only

KEY = 1.1   # keyline width mm


def glyph_masks():
    solid = np.zeros((H, W), np.float32)
    for p in bars + [pillar_solid]:
        solid = np.maximum(solid, poly_mask(p))
    halo = np.zeros((H, W), np.float32)
    for p in bars + [pillar_solid]:
        halo = np.maximum(halo, poly_mask(p, outline_w=2 * KEY))
    open_line = poly_mask(pillar_open, outline_w=KEY, fill=False)
    key = np.clip(np.maximum(halo, open_line) - solid, 0, 1)
    return solid, key


m_glyph, m_glyph_key = glyph_masks()

# logo + model name in the clean zone between the throat and the holes
logo_img = load_logo_mask()
m_logo = np.zeros((H, W), np.float32)
logo_h = paste_mask(m_logo, logo_img, 0.0, 277.0, 92.0)
m_name = text_mask("GEMINI", 0.0, 261.0, 5.2, tracking=0.42)


def label_masks(numeral):
    """Small Roman numeral label on the throat bridge + numeral under the name."""
    bridge = roman_mask(numeral, 0.0, 218.0, 14.0, stroke_mm=1.9, gap_mm=1.4)
    return bridge


def face_spec(face_text):
    return text_mask(face_text, 0.0, 252.5, 2.1, tracking=0.30,
                     font="/usr/share/fonts/opentype/inter/InterDisplay-Medium.otf")


relief = hex_relief(9.0)


def save(name, arr, mode):
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, name)
    if mode == "rgb":
        im = Image.fromarray((np.clip(arr, 0, 1) ** (1 / 2.2) * 255 + 0.5).astype(np.uint8), "RGB")
    elif mode == "lin8":
        im = Image.fromarray((np.clip(arr, 0, 1) * 255 + 0.5).astype(np.uint8), "L")
    elif mode == "lin16":
        im = Image.fromarray((np.clip(arr, 0, 1) * 65535 + 0.5).astype(np.uint16))
    im.save(path, optimize=True)
    print("  wrote", name, im.size)


def srgb(c):
    return np.asarray(c, np.float32) ** 2.2


def lay(base, m, col):
    m = m[..., None]
    return base * (1 - m) + np.asarray(col, np.float32) * m


# ================================================================ FACE I
def build_face_I():
    print("FACE I - red / 3K carbon / sand + 3D")
    o, prof, fil = weave(2.0, twill=True, seed=3)
    carbon = np.where(o > 0.5, 0.020, 0.032)[..., None] * np.ones(3)
    carbon = carbon * (0.55 + 0.75 * prof[..., None]) * (0.85 + 0.3 * fil[..., None])
    carbon = carbon.astype(np.float32) + np.array([0.0, 0.0, 0.002], np.float32)

    # painted red field with a soft vignette toward the frame
    edge_dist = 1.0 - smoothstep(0.0, 1.0, (ZZ - 230.0) / 230.0)
    red = srgb(RED)[None, None, :] * (0.78 + 0.22 * (1 - edge_dist[..., None] * 0.6))
    # subtle tonal variation of the paint
    red = red * (0.96 + 0.08 * value_noise(18.0, 11)[..., None])

    exposed = np.clip(m_border + m_glyph, 0, 1)              # where carbon shows through
    col = red * (1 - exposed[..., None]) + carbon * exposed[..., None]
    prints = np.clip(m_keyline_edge + m_glyph_key + m_logo + m_name + label_masks(1)
                     + face_spec("FACE I  ·  3K CARBON  ·  SAND GRIT + 3D"), 0, 1)
    col = lay(col, prints, srgb(WHITE))

    metal = np.zeros((H, W), np.float32)
    rough = 0.62 * (1 - exposed) + 0.46 * exposed
    rough = rough * (1 - prints) + 0.50 * prints
    rough += 0.04 * (o - 0.5) * exposed                       # twill sheen variation
    height = 0.80 * relief + 0.10 * prof * exposed + 0.06 * prints
    save("face_I_color.png", col, "rgb")
    save("face_I_metal.png", metal, "lin8")
    save("face_I_rough.png", rough, "lin8")
    save("face_I_height.png", height / max(height.max(), 1e-6), "lin16")


# ================================================================ FACE II
def build_face_II():
    print("FACE II - blue / 16K aluminized / light sand")
    o, prof, fil = weave(5.5, twill=False, seed=7)
    sheen = np.where(o > 0.5, 1.0, 0.72)[..., None]
    alu_raw = np.array([0.80, 0.82, 0.86], np.float32)        # raw aluminized glass fibre
    tint = srgb(BLUE) * 1.25                                    # blue tinted resin
    shade = (0.70 + 0.30 * prof[..., None]) * (0.92 + 0.10 * fil[..., None]) * sheen
    bg = (tint[None, None, :] * shade).astype(np.float32)
    silver = (alu_raw[None, None, :] * shade).astype(np.float32)

    exposed = np.clip(m_border + m_glyph, 0, 1)                 # raw aluminized shows through
    col = bg * (1 - exposed[..., None]) + silver * exposed[..., None]
    prints = np.clip(m_keyline_edge + m_glyph_key + m_logo + m_name + label_masks(2)
                     + face_spec("FACE II  ·  16K ALUMINIZED  ·  FINE SAND"), 0, 1)
    col = lay(col, prints, srgb(WHITE))

    metal = 1.0 - prints
    rough_cells = np.where(o > 0.5, 0.24, 0.40)
    rough = rough_cells * (1 - prints) + 0.45 * prints
    height = 0.35 * prof * (1 - prints) + 0.10 * prints

    # paint as the viewer sees it, mirror for the back of the racket
    flip = lambda a: a[:, ::-1].copy()
    save("face_II_color.png", flip(col), "rgb")
    save("face_II_metal.png", flip(metal), "lin8")
    save("face_II_rough.png", flip(rough), "lin8")
    save("face_II_height.png", flip(height / max(height.max(), 1e-6)), "lin16")


# preview of the flat artwork (both faces side by side, not used by Blender)
def preview():
    a = Image.open(os.path.join(OUT, "face_I_color.png"))
    b = Image.open(os.path.join(OUT, "face_II_color.png")).transpose(Image.FLIP_LEFT_RIGHT)
    holes = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(holes)
    for (x, z) in G.hole_centres():
        r = G.HOLE_D / 2
        d.ellipse([to_px((x - r, z + r), 1), to_px((x + r, z - r), 1)], fill=255)
    for op in G.throat_openings():
        d.polygon([to_px(p, 1) for p in op], fill=255)
    cut = Image.fromarray(((1 - m_inside) * 255).astype(np.uint8))
    holes = Image.fromarray(np.maximum(np.asarray(holes), np.asarray(cut)))
    canvas = Image.new("RGB", (W * 2 + 40, H), (245, 245, 245))
    for k, im in enumerate((a, b)):
        im = im.convert("RGB")
        im.paste((245, 245, 245), mask=holes if k == 0 else holes)
        canvas.paste(im, (k * (W + 40), 0))
    canvas = canvas.resize((canvas.width // 4, canvas.height // 4), Image.LANCZOS)
    canvas.save(os.path.join(HERE, "renders", "flat_artwork_preview.png"))
    print("  wrote renders/flat_artwork_preview.png")


if __name__ == "__main__":
    os.makedirs(os.path.join(HERE, "renders"), exist_ok=True)
    build_face_I()
    build_face_II()
    preview()
