"""
Render the 360 deg turntable of NORA GEMINI (frames 1-120, CAM_Face).

    blender -b nora_gemini.blend -P render_turntable.py
then encode:  ffmpeg -framerate 30 -i renders/turntable/f_%04d.png -pix_fmt yuv420p renders/nora_gemini_turntable.mp4
"""
import os

import bpy

HERE = os.path.dirname(os.path.abspath(bpy.data.filepath))
OUT = os.path.join(HERE, "renders", "turntable")
os.makedirs(OUT, exist_ok=True)
sc = next(s for s in bpy.data.scenes if s.name != "NORA_Hero_Twins")
sc.camera = bpy.data.objects["CAM_ThreeQuarter"]
sc.render.resolution_x, sc.render.resolution_y = 720, 900
sc.render.resolution_percentage = 100
sc.cycles.samples = 20
sc.render.filepath = os.path.join(OUT, "f_####")
sc.frame_start, sc.frame_end = 1, 120
bpy.ops.render.render(animation=True, scene=sc.name)
