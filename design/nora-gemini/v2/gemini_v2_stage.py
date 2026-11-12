def stage():
    sc = bpy.context.scene
    col = sc.collection

    def look(ob, target):
        ob.rotation_euler = (Vector(target) - ob.location).to_track_quat("-Z", "Y").to_euler()

    mid = Z0 + 0.2265
    fl = bpy.data.meshes.new("ENV_floor")
    fl.from_pydata([(-4, -4, 0), (4, -4, 0), (4, 4, 0), (-4, 4, 0)], [], [(0, 1, 2, 3)])
    fm = bpy.data.materials.new("MAT_Floor")
    fm.use_nodes = True
    fb = fm.node_tree.nodes["Principled BSDF"]
    fb.inputs["Base Color"].default_value = (0.012, 0.013, 0.016, 1)
    fb.inputs["Roughness"].default_value = 0.35
    fl.materials.append(fm)
    col.objects.link(bpy.data.objects.new("ENV_floor", fl))
    w = bpy.data.worlds.new("World_Studio") if not sc.world else sc.world
    sc.world = w
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs["Color"].default_value = (0.02, 0.022, 0.028, 1)
    w.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.0

    def light(name, kind, loc, energy, color=(1, 1, 1), **kw):
        ld = bpy.data.lights.new(name, kind)
        ld.energy = energy
        ld.color = color
        for k, v in kw.items():
            setattr(ld, k, v)
        ob = bpy.data.objects.new(name, ld)
        ob.location = loc
        col.objects.link(ob)
        look(ob, (0, 0, mid))
        return ob

    light("LGT_key", "SPOT", (-0.9, -1.5, 1.25), 230, (1, 0.97, 0.94), spot_size=0.6, spot_blend=0.6,
          shadow_soft_size=0.25)
    light("LGT_fill", "POINT", (1.1, -1.1, 0.3), 45, (0.85, 0.9, 1), shadow_soft_size=0.5)
    light("LGT_back_key", "SPOT", (0.9, 1.5, 1.25), 230, (0.94, 0.97, 1), spot_size=0.6, spot_blend=0.6,
          shadow_soft_size=0.25)
    light("LGT_back_fill", "POINT", (-1.1, 1.1, 0.3), 45, (1, 0.9, 0.85), shadow_soft_size=0.5)
    light("LGT_rim", "SPOT", (1.3, 0.25, 0.95), 160, (1, 1, 1), spot_size=0.5, spot_blend=0.5, shadow_soft_size=0.1)

    def cam(name, loc, target, lens):
        cd = bpy.data.cameras.new(name)
        cd.lens = lens
        cd.clip_start = 0.01
        ob = bpy.data.objects.new(name, cd)
        ob.location = loc
        col.objects.link(ob)
        look(ob, target)
        return ob

    cam("CAM_face_I", (0, -1.22, mid), (0, 0, mid), 70)
    cam("CAM_face_II", (0, 1.22, mid), (0, 0, mid), 70)
    main = cam("CAM_main", (-0.62, -1.0, mid + 0.22), (0, 0, mid - 0.01), 70)
    cam("CAM_detail", (0.07, -0.34, Z0 + 0.30), (0.0, 0, Z0 + 0.275), 60)
    sc.camera = main
    sc.view_settings.view_transform = "AgX"
    try:
        sc.view_settings.look = "AgX - Medium High Contrast"
    except TypeError:
        pass
    return [o.name for o in sc.objects]


def shots(names, res=(800, 1000), engine="BLENDER_EEVEE", samples=32, outdir=None):
    sc = bpy.context.scene
    sc.render.engine = engine
    if engine == "CYCLES":
        sc.cycles.samples = samples
        sc.cycles.use_denoising = True
    else:
        try:
            sc.eevee.taa_render_samples = samples
        except AttributeError:
            pass
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.resolution_percentage = 100
    done = []
    for n in names:
        sc.camera = bpy.data.objects[n]
        try:
            sc.render.image_settings.media_type = "IMAGE"
        except AttributeError:
            pass
        sc.render.image_settings.file_format = "PNG"
        if outdir:
            sc.render.filepath = outdir + "/" + n + ".png"
            bpy.ops.render.render(write_still=True)
        else:
            tgt = artifacts.file(name=n + ".png", media_type="image/png")
            sc.render.filepath = str(tgt.path)
            bpy.ops.render.render(write_still=True)
            tgt.publish()
        done.append(n)
    sc.camera = bpy.data.objects["CAM_main"]
    return done
