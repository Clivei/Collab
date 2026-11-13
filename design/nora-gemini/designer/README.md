# Padel Racket Designer (parametric 3D configurator)

A single self-contained file: **`padel-designer.html`**. Open it in any WebGL2 browser. No network, no CDN, no image files.
Three.js r147, OrbitControls and GSAP are inlined; every carbon weave, relief map, decal, EVA foam and grip wrap is generated
on `<canvas>` at runtime.

## What it does
| Area | Implementation |
|---|---|
| Mold selector | `MOLD_REGISTRY` entries, camera re-frames with a GSAP tween |
| Geometry | outline (Bezier or traced points) -> triangulated face sheets with drilled holes, tapered thickness, swept tubular frame, window liners, vibra-damper capsule, twisted struts, octagonal grip, buttcap plate, wrist cord |
| Hole drilling | explicit list, staggered `hex` lattice with exclusion zones, or curved `perimeter` rows. Hole walls are real geometry and render the **EVA core** (micro-cell foam texture, solid colour or layered multi-density) |
| Dual face | Face A (+Z, attack) and Face B (-Z, control) have independent weave, tint, relief, gloss, border, decals. "Link faces" makes a symmetric racket |
| Weaves | 3K twill, 12K / 18K flat tow, 16K aluminised (metallic), coloured carbon, fibreglass |
| Relief | hexagon 3D, star grit, spin blades (58 deg), micro-sand, glossy smooth; optional mirror-gloss border around a matte interior |
| Views | Studio PBR (procedural env map + 3-point light), Exploded CAD (7 layers on Z with leader tags), Sweet-spot / flex heatmap with airflow streaks, Wireframe, X-ray (fresnel) |
| Actions | Air smash (swing, motion trail, ball hit, vibration, face ripple), 360 turntable, camera flip A/B |
| Output | PNG screenshot, copy config JSON, hotspot callouts per mold |

Keys: `F` flip, `1-5` view modes, `S` smash, `T` turntable, `R` reset camera.

## Files
```
padel-designer.html        <- the deliverable (generated)
build.py                   <- inlines vendor/ + src/ into the html
gen_gemini_data.py         <- converts the traced OXDOG mould (../v2/gemini_v2_data.py) to src/mold_nora_gemini_data.js
src/molds.js               <- MOLD_REGISTRY (edit / add rackets here, nothing else)
src/util.js                <- polygon + math helpers
src/textures.js            <- procedural canvas textures
src/engine.js              <- geometry builder (class Racket)
src/app.js                 <- scene, UI, view modes, animations
src/index.template.html    <- page + CSS
vendor/                    <- three.min.js r147, OrbitControls.js, gsap.min.js (cached copies)
```
Rebuild after any edit: `python3 build.py` (uses `vendor/`, no network needed).

## Agent protocol: adding a new mold
1. **Extract parameters** from the reference (image, brand/model, spec sheet): head shape, length/width/thickness, balance,
   throat/bridge layout, hole zones, face weave, core colour.
2. **Outline**: a right-half polyline `{type:'half', points:[[x,y]...]}` (bottom of the head to the apex, mm; x = 0 is the centre line,
   y = distance from the butt) or cubic Beziers `{type:'bezier', start, segments:[[c1x,c1y,c2x,c2y,ex,ey]...]}`. The left half is mirrored.
   Throat openings go in `head.windows` as polygons (`mirror:true` for left/right pairs). `ellipsePoly()` and `slotPoly()` are available helpers.
   `head.thickness` is a piecewise-linear taper table `[[y, mm],...]`.
3. **Drilling**: `explicit` (traced holes), `hex` (lattice + `exclude` ellipses for a solid strike zone) or `perimeter` (curved edge rows).
4. **Materials + hotspots**: `faces.A/B` (weave, tint, relief, border, decals), `core`, `frame`, `handle`, `performance.sweetSpot`, and 3-5 `hotspots`.
5. **Register**: `registerMold({...})` at the end of `src/molds.js`, then `python3 build.py`. The first registered mold is the default on load;
   move yours to the top of the file (or call `PADEL.loadMold('your-id')`) to make it the default.

The full schema is documented at the top of `src/molds.js`. Decal types: `text`, `logo` (NORA vector mark), `poly`, `ring`, `constellation`, `stripe`;
each has a `group` (`logo`, `type`, `stripe`) that the UI toggles.

## Console API (for agents / tests)
`PADEL.loadMold(id)`, `PADEL.setMode('studio'|'exploded'|'heat'|'wire'|'xray')`, `PADEL.flip()`, `PADEL.smash()`, `PADEL.state`,
`PADEL.racket` (the live `Racket`), `PADEL.tweenCam({az,pol,d,tx,ty,tz}, seconds)`.

## Known limits
* Anisotropic carbon highlights are approximated with roughness / sheen maps, not a true anisotropic BRDF (Three r147 has none).
* The EVA core is shown in hole walls and the exploded/X-ray views; its internal density gradient is a texture, not volumetric.
* The mesh is built in the browser on mold change (about 0.3 s) and the face textures re-render on every edit (about 100-200 ms each).
* Verified in headless Chromium (SwiftShader); real GPUs are faster. Mobile Safari is untested.
