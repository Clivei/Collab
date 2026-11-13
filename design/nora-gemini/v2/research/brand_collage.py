"""
One-sheet collage: top-brand 2026 rackets vs NORA Gemini v2.

Product photos could not be downloaded (the research sandbox only allows web search), so every
racket is an ILLUSTRATION drawn on the OXDOG mould silhouette from the finishes / colours the
research found. They show design language (colour, finish, graphic idea), not exact artwork.
"""
import json, math, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
NG = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, NG)
import nora_geometry as G  # noqa: E402

FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONTB = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
F = lambda s, b=False: ImageFont.truetype(FONTB if b else FONT, s)
W, H = 3000, 2000
BG, CELL = (10, 13, 22), (20, 25, 40)

OUTLINE = np.array(G.head_outline())
HOLES = G.holes()
WINS = G.throat_windows()
rng = np.random.default_rng(7)


def pat_twill(X, Z, s=2.0):
    i, j = np.floor(X / s), np.floor(Z / s)
    return 0.55 + 0.45 * (((i - j) % 4) < 2)


def pat_plain(X, Z, s=5.5):
    return 0.6 + 0.4 * ((np.floor(X / s) + np.floor(Z / s)) % 2)


def pat_hex(X, Z, hw=9.0):
    hs = hw * math.sqrt(3)
    ax, az = np.mod(X, hw) - hw / 2, np.mod(Z, hs) - hs / 2
    bx, bz = np.mod(X - hw / 2, hw) - hw / 2, np.mod(Z - hs / 2, hs) - hs / 2
    pick = ax * ax + az * az < bx * bx + bz * bz
    gx, gz = np.abs(np.where(pick, ax, bx)), np.abs(np.where(pick, az, bz))
    e = hw / 2 - np.maximum(gx, gx * 0.5 + gz * 0.866)
    return 0.72 + 0.28 * np.clip((e - 0.2) / 1.0, 0, 1)


def band(X, Z, a, w):  # diagonal band: angle a(deg), width w, through (0, 300)
    t = math.radians(a)
    d = (X) * math.sin(t) - (Z - 300) * math.cos(t)
    return d


def face(spec, ppm):
    """Return RGB float array covering mm box x -130..130, z 120..460 at ppm px/mm."""
    w, h = int(260 * ppm), int(340 * ppm)
    X, Z = np.meshgrid(-130 + (np.arange(w) + .5) / ppm, 460 - (np.arange(h) + .5) / ppm)
    c = np.ones((h, w, 3), np.float32)
    k = spec["kind"]
    col = lambda rgb: np.array(rgb, np.float32) / 255.0
    edge = None
    if k == "vertex":      # light face, black frame, quiet centre logo
        c[:] = col((238, 238, 236)) * pat_hex(X, Z, 11)[..., None] ** 0.35
        c *= 1 - 0.0
        m = (np.hypot(X, Z - 330) < 13)
        c[m] = col((24, 24, 28))
        tri = (Z - 380 < 0) & (Z - 380 > -np.abs(X) * 1.6 - 6) & (np.abs(X) < 40)
        c[tri & (Z > 360)] = col((30, 30, 34))
    elif k == "hack":      # exposed carbon, sharp silver slashes
        c[:] = col((20, 21, 25)) * (0.6 + 0.8 * pat_twill(X, Z, 2.4)[..., None] * 0.6)
        for off, wd in ((-30, 3.0), (-18, 1.2), (6, 2.2), (30, 1.0)):
            d = band(X, Z, 62, 1) + off
            c[np.abs(d) < wd] = col((196, 202, 210))
    elif k == "at10":      # aluminised dark face, gold border + white bar, full-face sand
        c[:] = col((44, 46, 52)) * (0.7 + 0.5 * pat_plain(X, Z, 3.2)[..., None] * 0.6)
        m = (np.abs(Z - 262) < 3.2) & (np.abs(X) < 55)
        c[m] = col((236, 236, 236))
        edge = col((214, 172, 82))
    elif k == "ml10":      # 3K grey, red diamond lattice, red throat accents
        c[:] = col((70, 72, 78)) * (0.7 + 0.5 * pat_twill(X, Z, 2.0)[..., None] * 0.6)
        u, v = (X + Z) / 14.0, (X - Z) / 14.0
        lat = (np.abs(u - np.round(u)) < 0.07) | (np.abs(v - np.round(v)) < 0.07)
        c[lat & (Z > 250) & (Z < 330)] = col((214, 32, 52))
        edge = col((214, 32, 52))
    elif k == "titan":     # 24K black, rough "Spin Boost" grain, colourway unconfirmed
        c[:] = col((16, 17, 22)) * (0.7 + 0.5 * pat_twill(X, Z, 1.6)[..., None] * 0.6)
        n = rng.random((h, w)) > 0.965
        c[n] = col((96, 100, 112))
        d = band(X, Z, 70, 1) + 10
        c[np.abs(d) < 1.6] = col((120, 130, 150))
    elif k == "fenix":     # black + glow purple, 3D relief
        c[:] = col((18, 18, 24)) * pat_hex(X, Z, 9)[..., None]
        d = band(X, Z, 58, 1)
        c = np.where(((d > -10) & (d < 22) & (Z > 250))[..., None], col((150, 70, 230)) * pat_hex(X, Z, 9)[..., None], c)
    elif k == "oxdog":     # carbon + red sand/3D hex zone, matte contrast
        c[:] = col((22, 22, 26)) * (0.6 + 0.8 * pat_twill(X, Z, 2.0)[..., None] * 0.6)
        m = Z > 300
        c = np.where((m)[..., None], col((200, 30, 50)) * pat_hex(X, Z, 9)[..., None], c)
        c[Z < 170] = col((20, 20, 24))
    elif k == "viper":     # red woven 3K, black diagonal
        c[:] = col((204, 28, 44)) * (0.62 + 0.5 * pat_twill(X, Z, 2.2)[..., None] * 0.6)
        d = band(X, Z, 64, 1) + 5
        c = np.where(((d > -4) & (d < 20))[..., None], col((20, 20, 24)) * (0.6 + 0.8 * pat_twill(X, Z, 2.2)[..., None] * 0.6), c)
    elif k == "metalbone":  # aluminised 16K look, bold diagonal decal
        c[:] = col((120, 124, 132)) * pat_plain(X, Z, 5.0)[..., None] * 0.95
        d = band(X, Z, 60, 1)
        c[(d > -4) & (d < 4)] = col((235, 235, 240))
        c[(d > 9) & (d < 11)] = col((235, 235, 240))
    elif k == "coello":    # red + black, crown mark
        c[:] = col((24, 24, 28))
        d = band(X, Z, 62, 1)
        c[d < 0] = col((190, 28, 44))
        cx, cz = 0, 410
        c[(np.abs(X - cx) < 14) & (np.abs(Z - cz) < 5)] = col((230, 230, 230))
        for px in (-12, 0, 12):
            c[(np.abs(X - px) < 2.4) & (Z > cz) & (Z < cz + 13)] = col((230, 230, 230))
    elif k == "gem_I":
        c[:] = col((210, 30, 62)) * pat_hex(X, Z, 9)[..., None]
        d = band(X, Z, 58, 1) + 25
        c = np.where((d > 0)[..., None], col((20, 20, 24)) * (0.6 + 0.8 * pat_twill(X, Z, 2.0)[..., None] * 0.6), c)
    if edge is not None:
        pass
    return c, edge


def racket_image(spec, height_px=420):
    ppm_face = 6
    c, edge = face(spec, ppm_face)
    fh, fw = c.shape[:2]
    img = Image.fromarray((np.clip(c, 0, 1) * 255).astype(np.uint8), "RGB").convert("RGBA")
    S = ppm_face
    # masks in the same pixel frame (x -130..130, z 460..120)
    T = lambda p: ((p[0] + 130) * S, (460 - p[1]) * S)
    m = Image.new("L", (fw, fh), 0)
    ImageDraw.Draw(m).polygon([T(p) for p in OUTLINE], fill=255)
    if edge is not None:  # border stripe
        inner = Image.new("L", (fw, fh), 0)
        ImageDraw.Draw(inner).polygon([T(p) for p in G.offset_polygon(G.head_outline(), -7)], fill=255)
        stripe = Image.new("RGBA", (fw, fh), tuple(int(v * 255) for v in edge) + (255,))
        ring = Image.composite(Image.new("L", (fw, fh), 0), m, inner)
        img.paste(stripe, (0, 0), ring)
    dr = ImageDraw.Draw(img)
    for win in WINS:
        dr.polygon([T(p) for p in win], fill=CELL + (255,))
    for x, z, d in HOLES:
        cx, cy = T((x, z))
        r = d / 2 * S
        dr.ellipse([cx - r, cy - r, cx + r, cy + r], fill=CELL + (255,))
    img.putalpha(m)
    rim = Image.new("RGBA", (fw, fh), (0, 0, 0, 0))
    ImageDraw.Draw(rim).line([T(p) for p in OUTLINE] + [T(OUTLINE[0])], fill=(96, 108, 140, 255), width=9)
    img = Image.alpha_composite(img, rim)
    # handle + head on one canvas, racket upright (z up)
    full_w, full_h = int(260 * S), int(470 * S)
    out = Image.new("RGBA", (full_w, full_h), (0, 0, 0, 0))
    out.paste(img, (0, int((453 - 460) * -S) if False else int((453 - 460 + 7) * S) * 0 + int(0)))
    # place the head so z=460 maps to top
    out = Image.new("RGBA", (full_w, full_h), (0, 0, 0, 0))
    out.paste(img, (0, 0), img)
    d2 = ImageDraw.Draw(out)
    hx0, hx1 = 130 - 17.3, 130 + 17.3
    d2.rounded_rectangle([hx0 * S, (460 - 140) * S, hx1 * S, (460 - 8) * S + 0], radius=int(6 * S),
                         fill=(18, 18, 22, 255))
    d2.rounded_rectangle([(130 - 21) * S, (460 - 12) * S, (130 + 21) * S, (460 + 8) * S], radius=int(6 * S),
                         fill=tuple(int(v * 255) for v in spec.get("accent", (214, 32, 52))) + (255,))
    out = out.crop((0, 0, full_w, int((460 - 7) * S)))
    sc = height_px / out.height
    return out.resize((int(out.width * sc), height_px), Image.LANCZOS)


def tw(d, xy, text, font, fill, maxw):
    words, line, y = text.split(), "", xy[1]
    for w_ in words:
        t = (line + " " + w_).strip()
        if d.textlength(t, font=font) <= maxw:
            line = t
        else:
            d.text((xy[0], y), line, font=font, fill=fill)
            y += font.size + 6
            line = w_
    if line:
        d.text((xy[0], y), line, font=font, fill=fill)
        y += font.size + 6
    return y


def cell(canvas, box, spec):
    x0, y0, x1, y1 = box
    d = ImageDraw.Draw(canvas)
    d.rounded_rectangle(box, radius=26, fill=CELL)
    d.text((x0 + 26, y0 + 20), spec["brand"].upper(), font=F(21, True), fill=spec["tag"])
    d.text((x0 + 26, y0 + 50), spec["model"], font=F(25, True), fill=(240, 240, 245))
    r = racket_image(spec, 430)
    canvas.paste(r, (x0 + 26, y0 + 100), r)
    tx = x0 + 26 + r.width + 24
    y = y0 + 110
    for lab, val in spec["rows"]:
        d.text((tx, y), lab.upper(), font=F(15, True), fill=(120, 130, 155))
        y = tw(d, (tx, y + 20), val, F(19), (222, 226, 236), x1 - tx - 22) + 8
    d.line([(x0 + 26, y1 - 112), (x1 - 26, y1 - 112)], fill=(44, 52, 76), width=2)
    d.text((x0 + 26, y1 - 100), "STEAL", font=F(15, True), fill=spec["tag"])
    tw(d, (x0 + 26, y1 - 78), spec["steal"], F(19), (236, 238, 245), x1 - x0 - 52)


SPECS = json.load(open(os.path.join(HERE, "brand_specs.json")))
for _s in SPECS["rackets"]:
    _s["tag"] = tuple(_s["tag"])


def main(out):
    canvas = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(canvas)
    # hero (left)
    d.rounded_rectangle([30, 30, 1010, H - 30], radius=30, fill=(16, 20, 34))
    d.text((70, 66), "NORA", font=F(78, True), fill=(214, 40, 66))
    d.text((70, 156), "GEMINI  v2", font=F(46, True), fill=(240, 240, 245))
    d.text((70, 214), "one cut, two faces", font=F(26), fill=(150, 162, 190))
    for i, (fn, lab) in enumerate((("face_I.png", "FACE I  red 3K"), ("face_II.png", "FACE II  blue 16K aluminized"))):
        im = Image.open(os.path.join(NG, "v2", "higgsfield_renders", fn)).convert("RGB")
        im = im.crop((70, 110, 570, 760)).resize((450, 585), Image.LANCZOS)
        canvas.paste(im, (60 + i * 470, 290))
        d.text((70 + i * 470, 890), lab, font=F(21, True), fill=(220, 224, 236))
    y = 960
    d.text((70, y), "FINISH KEY", font=F(22, True), fill=(214, 40, 66))
    for lab, txt in (("SHINY", "gloss border, fibre under lacquer (StarVie-style frame)"),
                     ("SANDY + 3D", "grit and hexagon relief on the painted half (Oxdog / NOX Dual Spin)"),
                     ("MATTE", "smooth raw-fibre half, no sand (Hack-style exposed carbon)"),
                     ("LASER", "holographic foil on logo, GEMINI, constellation strokes")):
        d.text((70, y + 40), lab, font=F(19, True), fill=(240, 240, 245))
        y = tw(d, (250, y + 40), txt, F(19), (190, 198, 216), 720)
    d.text((70, 1330), "WHAT THE RESEARCH SAYS", font=F(22, True), fill=(214, 40, 66))
    y = 1372
    for t in SPECS["takeaways"]:
        y = tw(d, (70, y), "- " + t, F(21), (226, 230, 240), 900) + 6
    d.text((70, H - 78), "Rackets are illustrations from researched specs, not photos. Colourways vary by seller.",
           font=F(17), fill=(120, 130, 155))
    # grid (right): 4 cols x 3 rows
    gx0, gy0, gw, gh, gap = 1040, 30, 480, 646, 12
    cells = SPECS["rackets"]
    pos = [(c, r) for r in range(3) for c in range(4)]
    for spec, (c, r) in zip(cells, pos[:10]):
        x = gx0 + c * (gw + gap)
        y = gy0 + r * (gh + gap)
        cell(canvas, (x, y, x + gw - 0, y + gh), spec)
    # comparison matrix in the last two cells of the bottom row
    mx0 = gx0 + 2 * (gw + gap)
    my0 = gy0 + 2 * (gh + gap)
    d.rounded_rectangle((mx0, my0, mx0 + 2 * gw + gap, my0 + gh), radius=26, fill=CELL)
    d.text((mx0 + 26, my0 + 20), "SIDE BY SIDE", font=F(21, True), fill=(214, 40, 66))
    cols = [0, 190, 380, 640]
    heads = ["MODEL", "FACE", "FINISH", "COLOURS"]
    for cx, hd in zip(cols, heads):
        d.text((mx0 + 26 + cx, my0 + 62), hd, font=F(15, True), fill=(120, 130, 155))
    for i, row in enumerate(SPECS["matrix"]):
        yy = my0 + 92 + i * 42
        gem = row[0].startswith("NORA")
        if gem:
            d.rectangle((mx0 + 14, yy - 6, mx0 + 2 * gw + gap - 14, yy + 32), fill=(34, 24, 44))
        for cx, t in zip(cols, row):
            d.text((mx0 + 26 + cx, yy), t, font=F(16, gem or cx == 0), fill=(240, 240, 245) if gem else (214, 218, 230))
    canvas.save(out, quality=94)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "brand_collage.png"))
