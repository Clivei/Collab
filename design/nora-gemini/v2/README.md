# NORA GEMINI v2 — "one cut, two faces"

Second design, built as a hosted Higgsfield 3D scene (project "NORA Gemini v2 - twin-face padel racket").
Same OXDOG Ultimate Pro Light mould as v1.

- A single diagonal cut runs through the racket. Where Face I is painted red, Face II is raw
  aluminized 16K; where Face I shows raw 3K carbon, Face II is tinted blue.
- Three finishes on each face:
  - **Shiny** border, 13 mm wide: the fibre under gloss (3K carbon on Face I, 16K aluminized on Face II).
  - **Sandy + matte** inside: the painted zone is sandy (red with 3D hexagon relief on Face I, blue
    with fine sand on Face II); the raw-fibre zone is smooth matte.
  - **Laser** (holographic foil) on the strokes: NORA logo, GEMINI, the constellation, the keyline
    between border and face, and the I / II badge.
- Gemini constellation (Castor and Pollux) as fine line art, NORA logo, I / II badge, red | black | blue rim.

Files: `gemini_v2_data.py` (mould data), `gemini_v2_body.py` (geometry), `gemini_v2_art.py`
(face artwork and materials), `gemini_v2_stage.py` (lights, cameras, renders). Concatenate them in
that order and run in Blender 5.x, then call `build_all()` and `stage()`. `previews/` holds test renders.
