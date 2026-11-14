# PRD v2 - Padel Racket Design Studio

Replaces the v1 "Parametric 3D Configurator & Editor" PRD. v1 was written around rendering features (view modes, shaders,
animations). v2 is written around the real job: **turn a factory mold we have in stock into a finished, manufacturable racket
design as fast as possible, and make that design good.**

## 1. Goal and success measures
| Goal | Measure |
|---|---|
| A new factory mold becomes usable quickly | One registry entry, no engine edits; under 30 minutes from mold photo or drawing to a rendered racket |
| A new design is quick to make | A complete two-face design in under 10 minutes from a blank mold |
| What we design is what the factory makes | Every option in the tool maps 1:1 to a factory option; the export is a spec sheet the factory can quote from |
| Designs are good, not just possible | Every design passes the design checks in section 5 before export |

Non-goals: structural simulation, real aerodynamics, e-commerce checkout. The heatmap stays illustrative.

## 2. What changed from v1, and why
| v1 | v2 | Why |
|---|---|---|
| Free sliders for weave, relief, gloss | **Factory catalog first**: pick one of the factory's surface styles and inks; sliders are fine-tuning | Free parameters produce designs the factory cannot make |
| Decals placed by raw mm coordinates | **Design zones** per mold (strike zone, logo zone, bridge band, frame band, tip) with snap anchors | Placement is the slowest step and the main source of bad layouts |
| One racket at a time | **Variants board**: 2-4 colourways or finishes side by side, one click to promote | Design is comparison; the right answer is rarely the first |
| Output = PNG | Output = **factory spec sheet** (PNG front/back/side + JSON + per-face finish list) | The deliverable is an order, not a picture |
| View modes as the headline | View modes kept, demoted to tools; **court-read preview** added | See section 5, rule 3 |
| Mold added by writing geometry by hand | **Mold intake kit**: trace helper from a straight-on photo, automatic clearance validation | Molds will arrive in batches from the factory |
| No design guidance | **Design checks** and philosophy-based starting templates | The tool should help non-designers avoid common mistakes |

Kept from v1: single self-contained HTML file, procedural textures, `MOLD_REGISTRY` separation of engine and data, dual-face
(A/B) model, exploded / heatmap / wireframe / X-ray / smash / turntable.

## 3. The factory catalog (source of truth for finishes)
The factory's "Surface Style Options" sheet has nine tiles. They are two independent choices, so the tool models them as two axes.

**Axis 1 - face surface (one per face)**
| Id | Factory tile | Carbon visible | Sheen | Relief |
|---|---|---|---|---|
| `matte` | Matte | no (lacquered) | matte | none |
| `shiny` | Shiny | no (lacquered) | gloss | none |
| `sand` | Sand Grit | yes | gloss with grit | sand |
| `shiny-carbon` | Shiny + Carbon Texture Visible | yes | gloss | none |
| `3d-matte` | 3D + Matte | no | matte | 3D tread |
| `3d-shiny-carbon` | 3D + Shiny + Carbon Texture Visible | yes | gloss | 3D tread |
| `3d-hex` | 3D Hexagon | yes | gloss | hexagon |

**Axis 2 - graphic ink (per graphic group)**
| Id | Factory tile |
|---|---|
| `paint` | standard print |
| `laser` | Laser (holographic film) |
| `gold`, `silver` | Laser Gold / Silver Hot Stamping |

Rules: a face has exactly one surface; inks apply to logo and typography; stripes stay paint. The catalog lives in one table
(`SURFACES`, `INKS` in `src/textures.js`), so a new factory option is one row.
**Status: implemented in this revision.**

## 4. Functional requirements
Priority: P0 = needed before the factory molds arrive, P1 = next, P2 = later.

### 4.1 Mold intake (P0)
* A mold is one `registerMold({...})` entry: outline (traced points or Beziers), throat windows, thickness taper, drilling, handle.
* **Intake helper**: load a straight-on photo of the mold, click the outline and windows, mark two points of known distance for scale;
  the helper writes the registry entry. Holes are detected or placed with the lattice/perimeter generators.
* **Validation on load** (partly implemented): windows too close to the outline, holes inside the frame band, hole count vs. spec,
  overall length/width within padel rules (455 mm long, 260 mm wide, 38 mm thick).
* Each mold carries its factory code, stock status and allowed surfaces, so the UI only offers what that mold supports.

### 4.2 Design zones (P0)
* Every mold defines named zones: `strike` (sweet spot, keep clean), `logo`, `bridge`, `tip`, `frameBand`, `border`.
* Graphics snap to zone anchors and are stored relative to the zone, so **a design transfers to another mold** without re-placing.
* Zones are drawn as faint guides in an "edit" view and hidden in studio view.

### 4.3 Design building blocks (P0)
* Per face: surface (catalog), base colour, weave (3K, 12K, 18K, 16K aluminised, coloured, fibreglass), border on/off and width.
* Graphics: logo upload (SVG/PNG), wordmark text, stripes/blocks, each with an ink from the catalog.
* Frame, core colour (visible in holes), grip, cord, butt-cap.
* Palettes: brand palette stored once; pickers offer the palette first.

### 4.4 Templates and variants (P1)
* **Starting templates** built on the philosophies in section 5 (e.g. "Twin identity", "Stealth", "Heritage stripe", "Tech grid").
* **Variants board**: duplicate the current design, change colourway or surface, compare 2-4 rackets on one stage, promote one.
* Symmetric mode (link faces) and asymmetric mode (dual identity) are both first-class.

### 4.5 Review tools (P1)
* Studio, flip A/B, turntable, exploded, heatmap, wireframe, X-ray, smash (all exist).
* **Court-read preview**: the racket shown at the size it appears from 10 m and on a phone thumbnail.
* **Design-check panel**: live pass/warn list from section 5.

### 4.6 Factory export (P0)
* One click produces: front, back and side renders on white; a spec sheet listing mold code, surface per face, inks per graphic,
  colours (HEX + nearest Pantone to confirm with the factory), weave, core colour, frame finish; and the design JSON.
* The JSON re-imports to the same design.

### 4.7 Concept visuals (P2, optional)
* Marketing imagery (lifestyle shots, hero video) can be generated from an exported render with the Higgsfield tools.
  This costs credits, so it is never automatic; the designer itself stays free and offline.

## 5. Design philosophy, turned into checks
These are the rules the templates follow and the design-check panel tests.

1. **Form follows function.** The shape already says what the racket is (diamond = power, round = control, teardrop = hybrid).
   Graphics should agree: aggressive diagonals and high contrast on power faces, calm symmetric layouts on control faces.
   *Check: face style tag matches mold shape tag, or is a deliberate dual identity.*
2. **One idea per racket.** A racket has one hero element (a cut, a logo, a colour). Everything else supports it.
   *Check: at most one hero graphic per face; at most three colours plus black/white (60 / 30 / 10 split).*
3. **Read it from across the court.** Rackets are seen moving, at distance, and as thumbnails.
   *Check: logo contrast ratio at least 4.5:1 against its background; logo width at least 35% of the head; passes the 10 m preview.*
4. **Protect the strike zone.** Heavy ink, foil and thick lacquer change feel and wear off first where the ball hits.
   *Check: no foil ink inside the sweet-spot ellipse; relief surface covers the strike zone on spin-oriented designs.*
5. **Contrast of finish, not just colour.** Matte next to gloss, grit next to mirror border, foil on carbon. One finish contrast per face
   reads as premium; three reads as noise. *Check: at most two sheens per face.*
6. **Honest materials.** If the carbon is the selling point (3K, 16K aluminised), show it; do not lacquer over it.
   *Check: warn when a premium weave is fully covered by a painted surface.*
7. **Two faces, one racket.** Asymmetric faces must share at least two things (logo position, border, frame colour) so they read as a pair.
   *Check: shared anchors between Face A and Face B.*
8. **Design for the factory.** Graphics stay 3 mm clear of holes where they must stay legible, 8.5 mm clear of the frame edge,
   and use only catalog inks. *Check: clearance and catalog validation.*

## 6. Architecture (unchanged principles)
* `src/molds.js` data only; `src/textures.js` catalog + procedural textures; `src/engine.js` geometry; `src/app.js` UI.
* `python3 build.py` inlines everything into `padel-designer.html`. No network at runtime.
* New in v2: `zones` and `factory` blocks in the mold schema; `surface` and `ink` in the face config; a `checks` module (P1).

## 7. Workflow when the factory molds arrive
1. Receive mold photo or drawing plus spec (code, weight, balance, thickness, hole count).
2. Trace with the intake helper, run validation, fix warnings.
3. Define zones (defaults are generated from the outline and sweet spot).
4. Pick a template, set palette and surfaces, place logo.
5. Make 2-3 variants, review with court-read preview and the check panel.
6. Export the factory sheet.

## 8. Status
| Item | State |
|---|---|
| Factory surface catalog (7 surfaces) and inks (laser, gold, silver) | done |
| Mold registry, 4 molds, clearance warning | done |
| View modes, flip, smash, turntable, hotspots, PNG + JSON copy | done (v1) |
| Design zones, intake helper, factory export sheet | P0, not started |
| Templates, variants board, check panel, court-read preview | P1, not started |
| Logo upload (SVG/PNG) | P0, not started |
