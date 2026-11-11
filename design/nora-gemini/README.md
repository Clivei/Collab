# NORA GEMINI — padel racket (Blender 3D design)

Two faces, one frame. The frame is the **OXDOG Ultimate Pro Light mould**, the one
used for production. It's traced **1:1** from the reference photos in `assets/`.

| | FACE I — RED | FACE II — BLUE |
|---|---|---|
| Fibre | **3K carbon** (2 × 2 twill, ~2 mm tows) | **16K aluminized** fibre (plain weave, ~5.5 mm tows) |
| Surface | **Sand grit + 3D** (raised 9 mm hexagon relief) | **Fine sand** (lighter, finer grit, no 3D) |
| Finish | Matte painted red, exposed 3K carbon in the graphic | Blue-tinted aluminized with a thin gloss coat, raw silver aluminized in the graphic |
| Label | Small Roman **I** badge, top centre | Small Roman **II** badge, top centre |
| Faces | −Y in Blender (front view) | +Y in Blender (back view) |

**Design language.** The face graphic is the Gemini zodiac glyph ♊, which also reads
as the Roman numeral **II**. Its pillars run in the two hole-free lanes of the OXDOG
pattern. On each face the pillar on the viewer's left is solid (exposed fibre) and the
right one is only outlined, so the two faces complete each other, like twins. The frame
edge is split **red | black | blue** with fine white pinstripes, so the two faces show
even from the side.

## The mould (OXDOG Ultimate Pro Light, traced 1:1)

| | |
|---|---|
| Length | 453 mm |
| Width | 248.8 mm |
| Thickness | 38 mm head, tapering through the throat to 24 mm at the neck (`production/thickness_profile.csv`) |
| Holes | 68: 32 × Ø 8 mm (inner field) + 36 × Ø 10 mm (outer ring and top rows), OXDOG layout |
| Throat | Inverted-Y bridge with 3 windows (2 upper, 1 central diamond). Bridge stem 17.6 mm, legs 10 mm, outer walls 16.5 mm. 1.5 mm round-over |
| Power Ribs | 2 × 10 moulded grooves (1.6 mm wide, 1 mm deep, 9.5 mm pitch) on the upper side edges, from z = 378 mm toward the top. Top centre left smooth |
| Edge | 5 mm round edge |
| Handle | Oval grip ≈ 34.6 × 27 mm incl. overgrip, collar band 14 mm, butt flaring to ≈ 46 × 35 mm |
| Colours | NORA red `#D11F3F`, NORA blue `#1C6CB0` (from the logo) |

**How the trace works.** `trace_oxdog_mould.py` segments the straight front photo
against its plain background at 4× sub-pixel resolution. It mirrors and averages
left/right; the left and right holes agree within 0.15 mm. It also measures the
thickness taper from the edge-on photo. The scale is fixed by the published total length
of 453 mm ([Racketguide](https://www.racketguide.com/no-en/padel/oxdog/ultimate-pro-light-2024/):
453 × 251 × 37–38 mm). The traced width comes out at 248.8 mm, within 1 % of the published
251 mm, which independently confirms the scale. `production/trace_check_overlay.png` draws
the final geometry over the OXDOG photo so you can check the fit.

> ⚠️ This is traced from product photos, not from the factory CAD. Hole sizes are
> snapped to two drill sizes, and photos carry about ±0.6 mm of pixel and perspective
> error. Before cutting steel, check the outline, the throat and the hole sizes against
> a physical frame or the mould maker's drawing.

## Renders

`renders/00_hero_twins.png` shows the two faces side by side. `01`–`09` are the
front, back and edge views, the 3/4 view, and close-ups of both surfaces, the throat
and the Power Ribs on the frame edge. `renders/nora_gemini_turntable.mp4` is a 360°
spin. `renders/flat_artwork_preview.png` is the flat face artwork.

## Files

| File | What it is |
|---|---|
| `nora_gemini.blend` | The Blender file, with textures packed inside. Opens on its own in Blender 4.2+ / 5.x. |
| `oxdog_mould_trace.json` | The traced mould data: outline, windows, holes, thickness, handle. |
| `trace_oxdog_mould.py` | Re-creates the trace from `assets/oxdog_upl_front.jpg` / `_side.jpg` (numpy + opencv). |
| `nora_geometry.py` | The single source of truth for the shape, read by every script below. |
| `make_textures.py` | Generates the face maps in `textures/` (colour, metal, roughness, height). |
| `build_nora_gemini.py` | Builds the whole Blender scene procedurally. |
| `render_nora_gemini.py`, `render_turntable.py` | Render the stills and the turntable. |
| `export_production.py` | Writes the 1:1 `production/nora_gemini_layout.svg`, `hole_centres.csv` and `thickness_profile.csv`. |
| `assets/` | The NORA logo and the OXDOG reference photos. |

## Inside the .blend

- Scene **Scene**: the racket (`NORA_Gemini_Racket` collection) on `RIG_Turntable`,
  which spins 360° over frames 1–120. Frame 1 shows Face I, frame 31 the edge, frame 61 Face II.
  Cameras: `CAM_Face`, `CAM_ThreeQuarter`, `CAM_Detail_Face`, `CAM_Detail_Throat`, `CAM_Edge_Macro`.
- Scene **NORA_Hero_Twins**: two collection instances (`TWIN_I_Red`, `TWIN_II_Blue`),
  so editing the master racket updates both.
- The body is one watertight solid with **live Booleans**: `CUT_NORA_Throat_Windows`,
  `CUT_NORA_Holes` and `CUT_NORA_Power_Ribs`, all hidden wireframes. Edit a cutter
  and the frame updates.
- Materials: `MAT_Face_I_3K_Red_Sand3D`, `MAT_Face_II_16K_Alu_Blue_FineSand`,
  `MAT_Frame_Rim_RedBlackBlue`, `MAT_EVA_Core_Soft` (hole walls), `MAT_Grip_Overgrip_Black`.
  To adjust the grit, change the Voronoi *Scale* (grain size) and the second Bump
  *Strength* (how sandy). To adjust the 3D relief, change the first Bump *Distance*.
- Render engine: Cycles, AgX view transform.

## Rebuild / change the design

```bash
python make_textures.py
```

```bash
blender -b -P build_nora_gemini.py -- --save nora_gemini.blend
```

```bash
blender -b nora_gemini.blend -P render_nora_gemini.py
```

`make_textures.py` needs `numpy` and `Pillow`. Mould changes go in `nora_geometry.py`
or the trace JSON. Rerun the three commands and `python export_production.py`, and the
artwork, the 3D model and the factory files stay in sync.
