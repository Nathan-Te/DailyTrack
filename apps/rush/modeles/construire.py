# Construit les modèles de Rush dans Blender (lot BR-A1) et les exporte en glTF binaire non compressé dans `apps/rush/modeles/build/` ; `construire.mjs` (npm run modeles -w @cdj/rush) le lance puis compresse avec gltfpack.
#   blender -b --factory-startup -P apps/rush/modeles/construire.py -- [noms…] [--vignettes] [--blend]
# Sans nom : tous les modèles. `--vignettes` : une vignette par modèle (la caméra du jeu, 41° de plongée) et les deux planches de `docs/rush/lots/`. `--blend` : enregistre la source `apps/rush/modeles/rush-modeles.blend`.
import importlib
import json
import math
import os
import sys

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ICI)

import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import commun  # noqa: E402

# Le nom de chaque modèle (celui du fichier .glb et de `NomModele` dans `apps/rush/src/modeles.ts`) → le script qui le construit (un par modèle).
MODELES = [
    "chevalier",
    "golem",
    "reine",
    "grand-duc",
    "belier",
    "chene",
    "gelee",
    "gelaton",
    "chauve-souris",
    "cracheur",
    "chaman",
    "totem",
    "porte-bouclier",
    "couronne",
    "jarre",
    "tonneau",
    "caisse",
    "projectile",
    "bouclier",
]


def module(nom):
    return importlib.import_module(nom.replace("-", "_"))


def vider():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for c in list(bpy.data.collections):
        bpy.data.collections.remove(c)
    for m in list(bpy.data.meshes):
        bpy.data.meshes.remove(m)


def bornes(modele):
    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    bpy.context.view_layer.update()
    for o in modele.collection.all_objects:
        if o.type != "MESH":
            continue
        for v in o.data.vertices:
            w = o.matrix_world @ v.co
            lo = Vector(map(min, lo, w))
            hi = Vector(map(max, hi, w))
    return lo, hi


def preparer_rendu(taille=480):
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_WORKBENCH"
    sc.render.resolution_x = taille
    sc.render.resolution_y = taille
    sc.render.film_transparent = False
    sh = sc.display.shading
    sh.light = "STUDIO"
    sh.color_type = "VERTEX"
    sh.show_object_outline = True
    sh.object_outline_color = (0.1, 0.07, 0.05)
    sh.show_cavity = False
    sh.background_type = "VIEWPORT"
    sh.background_color = (0.97, 0.93, 0.81)
    sc.view_settings.view_transform = "Standard"
    if sc.world is None:
        sc.world = bpy.data.worlds.new("fond")
    sc.world.color = (0.93, 0.85, 0.62)


def vignette(modele, chemin, echelle=1.0):
    """Une vignette du modèle vu par la caméra du jeu (41° de plongée, de face), orthographique, cadrée sur ses bornes."""
    bpy.context.view_layer.update()
    lo, hi = bornes(modele)
    centre = (lo + hi) / 2
    tailles = hi - lo
    cam = bpy.data.objects.get("Camera vignette")
    if cam is None:
        cam = bpy.data.objects.new("Camera vignette", bpy.data.cameras.new("Camera vignette"))
        bpy.context.scene.collection.objects.link(cam)
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = max(tailles.x, tailles.z * 1.15, tailles.y * 0.8) * 1.25
    phi = math.radians(41)
    d = 60.0
    cam.location = centre + commun.G(0, math.sin(phi) * d, math.cos(phi) * d)
    cam.rotation_euler = (math.radians(90) - phi, 0, 0)
    cam.data.clip_end = 200
    bpy.context.scene.camera = cam
    # seul ce modèle est visible, sans ses éclats (ils ne se montrent qu'à la casse) ; le bouclier du porte-bouclier à sa place (le code le pose à 0,95 m de haut, 0,8 m devant)
    for c in bpy.context.scene.collection.children:
        c.hide_render = c is not modele.collection
    for o in modele.collection.all_objects:
        o.hide_render = o.name.startswith("eclat_")
        if o.name.startswith("bouclier") and o.parent is not None and o.parent.name == "porte-bouclier":
            o.location = commun.G(0, 0.95, 0.8)
    bpy.context.scene.render.filepath = chemin
    bpy.ops.render.render(write_still=True)


def main():
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    noms = [a for a in args if not a.startswith("--")] or MODELES
    vider()
    rapport = {}
    for nom in noms:
        mod = module(nom)
        importlib.reload(mod)
        m = mod.construire()
        chemin = os.path.join(commun.BUILD, nom + ".glb")
        commun.exporter(m, chemin)
        lo, hi = bornes(m)
        rapport[nom] = {"triangles": m.triangles(), "pieces": m.tris, "bornes": [list(lo), list(hi)]}
        print(f"[modeles] {nom} : {m.triangles()} triangles, pièces {m.tris}")
    with open(os.path.join(commun.BUILD, "rapport.json"), "w", encoding="utf-8") as f:
        json.dump(rapport, f, indent=1)
    if "--vignettes" in args:
        preparer_rendu()
        os.makedirs(os.path.join(commun.BUILD, "vignettes"), exist_ok=True)
        for nom in noms:
            m = bpy.data.collections[nom]

            class _M:
                collection = m

            vignette(_M, os.path.join(commun.BUILD, "vignettes", nom + ".png"))
    if "--blend" in args:
        for c in bpy.context.scene.collection.children:
            c.hide_render = False
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ICI, "rush-modeles.blend"), compress=True)


main()
