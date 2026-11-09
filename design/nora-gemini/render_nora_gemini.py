"""
Render the NORA GEMINI product shots from nora_gemini.blend.

    blender -b nora_gemini.blend -P render_nora_gemini.py -- [--quick] [--only name,name]

Shots (camera, turntable frame):
    01_face_I_red        CAM_Face          f1   (FACE I towards camera)
    02_face_II_blue      CAM_Face          f61  (rotated 180 deg)
    03_edge_profile      CAM_Face          f31  (edge on: red | black | blue rim)
    04_three_quarter     CAM_ThreeQuarter  f1
    05_detail_3K_sand3D  CAM_Detail_Face   f1
    06_detail_16K_alu    CAM_Detail_Face   f61
    07_throat_label_I    CAM_Detail_Throat f1
    08_throat_label_II   CAM_Detail_Throat f61
    09_edge_macro        CAM_Edge_Macro    f1
    00_hero_twins        scene NORA_Hero_Twins
"""
import os
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(bpy.data.filepath or __file__))
OUT = os.path.join(HERE, "renders")
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
QUICK = "--quick" in argv
ONLY = argv[argv.index("--only") + 1].split(",") if "--only" in argv else None

SHOTS = [
    ("00_hero_twins", "NORA_Hero_Twins", "CAM_Hero_Twins", 1, (2000, 1250)),
    ("01_face_I_red", None, "CAM_Face", 1, (1200, 1500)),
    ("02_face_II_blue", None, "CAM_Face", 61, (1200, 1500)),
    ("03_edge_profile", None, "CAM_Face", 31, (1200, 1500)),
    ("04_three_quarter", None, "CAM_ThreeQuarter", 1, (1200, 1500)),
    ("05_detail_3K_sand3D", None, "CAM_Detail_Face", 1, (1400, 1050)),
    ("06_detail_16K_alu", None, "CAM_Detail_Face", 61, (1400, 1050)),
    ("07_throat_label_I", None, "CAM_Detail_Throat", 1, (1400, 1050)),
    ("08_throat_label_II", None, "CAM_Detail_Throat", 61, (1400, 1050)),
    ("09_edge_macro", None, "CAM_Edge_Macro", 1, (1400, 1050)),
]

os.makedirs(OUT, exist_ok=True)
main_scene = next(s for s in bpy.data.scenes if s.name != "NORA_Hero_Twins")
for name, scene_name, cam, frame, res in SHOTS:
    if ONLY and not any(name.startswith(o) for o in ONLY):
        continue
    sc = bpy.data.scenes[scene_name] if scene_name else main_scene
    if bpy.context.window:
        bpy.context.window.scene = sc
    sc.camera = bpy.data.objects[cam]
    sc.frame_set(frame)
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.resolution_percentage = 30 if QUICK else 100
    sc.cycles.samples = 24 if QUICK else 80
    sc.render.filepath = os.path.join(OUT, ("quick_" if QUICK else "") + name + ".png")
    bpy.ops.render.render(write_still=True, scene=sc.name)
    print("rendered", sc.render.filepath)
