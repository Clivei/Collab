# NORA GEMINI — padel racket (Blender 3D design)

Two faces, one frame. Built on the diamond / teardrop **OXDOG-style mould** that
will be used for production.

| | FACE I — RED | FACE II — BLUE |
|---|---|---|
| Fibre | **3K carbon** (2 × 2 twill, ~2 mm tows) | **16K aluminized** fibre (plain weave, ~5.5 mm tows) |
| Surface | **Sand grit + 3D** (raised 9 mm hexagon relief) | **Fine sand** (lighter, finer grit, no 3D) |
| Finish | Matte painted red, exposed 3K carbon in the graphic | Blue-tinted aluminized with a thin gloss coat, raw silver aluminized in the graphic |
| Label | Roman **I** on the throat bridge | Roman **II** on the throat bridge |
| Faces | −Y in Blender (front view) | +Y in Blender (back view) |

**Design language.** The face graphic is the Gemini zodiac glyph ♊, which also reads
as the Roman numeral **II**. On each face the pillar on the viewer's left is solid
(exposed fibre) and the right one is only outlined, so the two faces complete each
other, like twins. The frame edge is split **red | black | blue** with fine white
pinstripes, so the two faces show even from the side. The throat has twin openings
around a 24 mm bridge that carries the I / II label.

## Specs (as modelled)

| | |
|---|---|
| Length | 455 mm (legal max) |
| Width | 260 mm (legal max) |
| Thickness | 38 mm (legal max), 5 mm round edge |
| Holes | 66 × Ø 11 mm, hexagonal pattern, 23.5 mm pitch |
| Grip | 133 mm, rounded-octagon section ≈ 37.6 × 40.6 mm incl. overgrip |
| Colours | NORA red `#D11F3F`, NORA blue `#1C6CB0` (from the logo) |

## Renders

`renders/00_hero_twins.png` shows the two faces side by side. `01`–`09` are the
front, back and edge views, the 3/4 view, and close-ups of both surfaces, the throat
labels and the frame edge. `renders/nora_gemini_turntable.mp4` is a 360° spin.
`renders/flat_artwork_preview.png` is the flat face artwork.

## Files

| File | What it is |
|---|---|
| `nora_gemini.blend` | The Blender file, with textures packed inside. Opens on its own in Blender 4.2+ / 5.x. |
| `nora_geometry.py` | The single source of truth for the shape: outline, holes, throat openings, graphic. |
| `make_textures.py` | Generates the face maps in `textures/` (colour, metal, roughness, height). |
| `build_nora_gemini.py` | Builds the whole Blender scene procedurally. |
| `render_nora_gemini.py`, `render_turntable.py` | Render the stills and the turntable. |
| `export_production.py` | Writes `production/nora_gemini_layout.svg` (1:1 vector) and `production/hole_centres.csv`. |
| `assets/` | The NORA logo and the reference images. |

## Inside the .blend

- Scene **Scene**: the racket (`NORA_Gemini_Racket` collection) on `RIG_Turntable`,
  which spins 360° over frames 1–120. Frame 1 shows Face I, frame 31 the edge, frame 61 Face II.
  Cameras: `CAM_Face`, `CAM_ThreeQuarter`, `CAM_Detail_Face`, `CAM_Detail_Throat`, `CAM_Edge_Macro`.
- Scene **NORA_Hero_Twins**: two collection instances (`TWIN_I_Red`, `TWIN_II_Blue`),
  so editing the master racket updates both.
- The holes are a **live Boolean** (`CUT_NORA_Holes`, hidden wireframe). Move or resize
  the cylinders in that object and the frame updates.
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

`make_textures.py` needs `numpy` and `Pillow`. For example, to change the hole count
or pitch, edit `hole_centres()` in `nora_geometry.py`, then rerun all three commands.
The artwork, the 3D model and the factory SVG stay in sync.
