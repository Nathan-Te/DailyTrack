# La chaîne de conversion des modèles TIERS de Rush (lot BR-A3), côté Blender : FBX d'un pack Unity → un modèle normalisé → glTF binaire.
# Chaque modèle a son script (`golem.py`, `gelee.py`, …) qui décrit sa SOURCE (le pack, le maillage, les clips) et ses RÉGLAGES (le rayon de la sim, la palette, les accessoires) ;
# `construire.py` les lance, `construire.mjs` enchaîne extraction, Blender et gltfpack. Rien de ce qui sort d'ici ne se commite (dépôt public : `docs/rush/licences-tiers.md`).
#
# Ce que fait `construire(spec)` :
#  1. importe le maillage (FBX), ne garde que les pièces demandées, y attache les accessoires (épée, bouclier) comme des pièces RIGIDES d'un os, et fond le tout en UN maillage (un appel de dessin) ;
#  2. importe chaque clip (un FBX par clip, ou un FBX à plusieurs prises), le renomme d'après l'ÉTAT de la sim (`attente`, `marche`, `annonce`, `frappe`, `touche`, `mort`…), le pose sur le squelette en piste NLA ;
#     la translation horizontale de l'os racine est retirée (la sim déplace l'acteur : jamais de « root motion ») ;
#  3. ÉCHELLE : l'empreinte au sol (le rayon du CORPS dans la pose d'attente : tronc, tête, jambes — sans les membres qui frappent, ailes, bras, mains, armes) = le rayon de la sim ;
#     ORIENTATION : face à −Y dans Blender, donc +Z dans le glTF (le `rotation.y` de la vue : 0 regarde +Z) ; les pieds à y = 0 ;
#  4. MATÉRIAU : une seule texture de couleur de base (la palette du pack, recolorée par une table de correspondances, réduite), sans normale ni métal : la rampe toon du jeu s'applique dessus ;
#  5. exporte un .glb non compressé dans `build/` (gltfpack compresse ensuite).
import json
import math
import os

import bpy
import numpy as np
from mathutils import Matrix, Vector

ICI = os.path.dirname(os.path.abspath(__file__))
BRUT = os.environ.get("RUSH_TIERS_BRUT", os.path.join(ICI, ".brut"))
BUILD = os.path.join(ICI, "build")


def vider():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = 30


def importer_fbx(chemin):
    sc = bpy.context.scene
    avant = set(sc.objects)
    actions = set(bpy.data.actions)
    bpy.ops.import_scene.fbx(filepath=chemin, use_anim=True, automatic_bone_orientation=False, ignore_leaf_bones=False)
    return [o for o in sc.objects if o not in avant], [a for a in bpy.data.actions if a not in actions]


def supprimer(objets):
    for o in objets:
        bpy.data.objects.remove(o, do_unlink=True)


def chemin_brut(rel):
    return os.path.join(BRUT, *rel.split("/"))


# --- Les accessoires : une pièce rigide portée par un os -------------------------------------------------------------------------------------------------------------------------------------
def attacher(arm, chemin, os_nom, decalage=(0, 0, 0), rotation=(0, 0, 0), echelle=1.0):
    """Importe un accessoire (une épée…) et le rend « skinné » à 100 % sur `os_nom` : posé à la tête de l'os (pose de repos), dans le repère de l'os, puis décalé (mètres) et tourné (degrés)."""
    objets, _ = importer_fbx(chemin)
    meshes = [o for o in objets if o.type == "MESH"]
    supprimer([o for o in objets if o.type != "MESH"])
    b = arm.data.bones[os_nom]
    repere = arm.matrix_world @ b.matrix_local
    loc, rot, _ = repere.decompose()
    base = Matrix.Translation(loc) @ rot.to_matrix().to_4x4()
    for m in meshes:
        m.parent = None
        m.matrix_world = base @ Matrix.Translation(Vector(decalage)) @ Matrix.Rotation(math.radians(rotation[0]), 4, "X") @ Matrix.Rotation(math.radians(rotation[1]), 4, "Y") @ Matrix.Rotation(math.radians(rotation[2]), 4, "Z") @ Matrix.Scale(echelle, 4)
        vg = m.vertex_groups.new(name=os_nom)
        vg.add(list(range(len(m.data.vertices))), 1.0, "REPLACE")
        mod = m.modifiers.new("Armature", "ARMATURE")
        mod.object = arm
        m.parent = arm
        m.matrix_parent_inverse = arm.matrix_world.inverted()
    return meshes


def fondre(meshes):
    """Fond les maillages (mêmes os) en un seul : appliquer les transformations d'objet d'abord, garder les groupes de sommets."""
    bpy.ops.object.select_all(action="DESELECT")
    for m in meshes:
        m.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.join()
    return bpy.context.view_layer.objects.active


# --- Les clips -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
def retirer_deplacement(action, racines):
    """Retire la translation horizontale des os racines (la sim déplace l'acteur) : on garde la hauteur (un saut, un plongeon), on fige le reste à sa première valeur.
    `racines` : {os: [composantes locales à figer]} — les axes horizontaux dépendent du repère de l'os dans chaque pack ; ils sont écrits par modèle, vérifiés sur la vignette du clip."""
    for fc in list(_courbes(action)):
        nom = fc.data_path
        if not nom.endswith(".location"):
            continue
        axes = next((ax for r, ax in racines.items() if f'pose.bones["{r}"]' in nom), None)
        if axes is None or fc.array_index not in axes:
            continue
        v0 = fc.keyframe_points[0].co[1] if fc.keyframe_points else 0
        for k in fc.keyframe_points:
            k.co[1] = v0
            k.handle_left[1] = v0
            k.handle_right[1] = v0


def _courbes(action):
    # Blender 4.4+ : les courbes vivent dans les sacs de canaux des couches (actions à « slots ») ; avant, dans `action.fcurves`.
    if hasattr(action, "layers") and len(action.layers) > 0:
        for couche in action.layers:
            for bande in couche.strips:
                for sac in bande.channelbags:
                    yield from sac.fcurves
    elif hasattr(action, "fcurves"):
        yield from action.fcurves


def poser_clip(arm, action, nom, debut=None, fin=None):
    """Pose `action` sur `arm` dans une piste NLA nommée `nom` (le nom de l'animation dans le glTF)."""
    action.name = nom
    action.use_fake_user = True
    ad = arm.animation_data or arm.animation_data_create()
    piste = ad.nla_tracks.new()
    piste.name = nom
    d, f = action.frame_range
    bande = piste.strips.new(nom, int(d), action)
    if hasattr(bande, "action_slot") and len(action.slots) > 0:
        bande.action_slot = action.slots[0]
    if debut is not None:
        bande.action_frame_start = debut
    if fin is not None:
        bande.action_frame_end = fin
    piste.mute = False
    return bande


def importer_clips(arm, clips, racines):
    """`clips` : {nom: {"fbx": chemin relatif, "prise": nom de la prise (FBX à plusieurs prises), "debut"/"fin": images}}. Les FBX à une prise donnent une action par fichier."""
    faits = {}
    caches = {}
    for nom, c in clips.items():
        f = c["fbx"]
        if f not in caches:
            objets, actions = importer_fbx(chemin_brut(f))
            supprimer(objets)
            caches[f] = actions
        actions = caches[f]
        if "prise" in c:
            a = next((x for x in actions if x.name.split("|")[-2 if x.name.count("|") >= 2 else -1] == c["prise"] or x.name.endswith("|" + c["prise"]) or c["prise"] in x.name.split("|")), None)
            if a is None:
                raise KeyError(f"prise {c['prise']} absente de {f} : {[x.name for x in actions]}")
        else:
            a = actions[0]
        if any(a is v for v in faits.values()):
            a = a.copy()  # deux clips d'une même prise (une annonce et sa frappe, coupées à des images différentes)
        retirer_deplacement(a, racines)
        poser_clip(arm, a, nom, c.get("debut"), c.get("fin"))
        faits[nom] = a
    return faits


# --- La pose d'attente, l'échelle, l'orientation --------------------------------------------------------------------------------------------------------------------------------------------------
def poser_action(arm, action, image=None):
    ad = arm.animation_data or arm.animation_data_create()
    ad.action = action
    if hasattr(ad, "action_slot") and len(action.slots) > 0:
        ad.action_slot = action.slots[0]
    bpy.context.scene.frame_set(int(image if image is not None else action.frame_range[0]))
    bpy.context.view_layer.update()


def sommets_monde(mesh):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = mesh.evaluated_get(dg)
    me = ev.to_mesh()
    pts = np.array([tuple(mesh.matrix_world @ v.co) for v in me.vertices])
    ev.to_mesh_clear()
    return pts


def empreinte(mesh, exclus):
    """Le rayon du CORPS au sol : la plus grande distance horizontale à l'axe de l'acteur des sommets dont l'os dominant n'est pas un membre qui frappe (`exclus` : morceaux de noms d'os)."""
    pts = sommets_monde(mesh)
    noms = {vg.index: vg.name.lower() for vg in mesh.vertex_groups}
    garde = []
    for i, v in enumerate(mesh.data.vertices):
        if not v.groups:
            garde.append(i)
            continue
        dom = noms.get(max(v.groups, key=lambda g: g.weight).group, "")
        if not any(e.lower() in dom for e in exclus):
            garde.append(i)
    p = pts[garde]
    return float(np.max(np.hypot(p[:, 0], p[:, 1]))), pts


def normaliser(arm, mesh, rayon, exclus, action_attente):
    """Pieds à z = 0, axe vertical au centre du corps, empreinte = `rayon` (mètres)."""
    poser_action(arm, action_attente)
    # l'axe vertical reste l'origine du pack (son pivot de rotation : la sim tourne l'acteur autour de lui)
    r, pts = empreinte(mesh, exclus)
    k = rayon / r
    arm.scale = arm.scale * k
    bpy.context.view_layer.update()
    pts = sommets_monde(mesh)
    arm.location.z -= float(pts[:, 2].min())
    bpy.context.view_layer.update()
    pts = sommets_monde(mesh)
    return {"echelle": k, "empreinte_avant": r, "hauteur": float(pts[:, 2].max() - pts[:, 2].min()), "boite": [pts.min(axis=0).tolist(), pts.max(axis=0).tolist()]}


# --- Le matériau : une texture de couleur de base, recolorée ---------------------------------------------------------------------------------------------------------------------------------
def charger_image(chemin):
    img = bpy.data.images.load(chemin, check_existing=True)
    img.pixels[0]  # force la lecture
    return img


def couleurs_utilisees(mesh, img):
    """Les couleurs de la palette que les UV du maillage visent (pour écrire la table de recoloration) : {hex: nombre de coins}."""
    w, h = img.size
    px = np.array(img.pixels[:]).reshape(h, w, 4)
    uv = mesh.data.uv_layers.active.data
    compte = {}
    for l in uv:
        u, v = l.uv
        x = min(w - 1, max(0, int((u % 1.0) * w)))
        y = min(h - 1, max(0, int((v % 1.0) * h)))
        c = px[y, x, :3]
        hx = "%02x%02x%02x" % tuple(int(round(_lin_srgb(ch) * 255)) for ch in c) if img.colorspace_settings.name == "Linear" else "%02x%02x%02x" % tuple(int(round(ch * 255)) for ch in c)
        compte[hx] = compte.get(hx, 0) + 1
    return dict(sorted(compte.items(), key=lambda kv: -kv[1]))


def _lin_srgb(c):
    return 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055


def hex_rgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i : i + 2], 16) / 255 for i in (0, 2, 4)])


def recolorer(img, table, taille, nom):
    """Une nouvelle image : la palette `img` dont chaque couleur proche (écart < 0,09 en RVB) d'une source de `table` prend la cible ; réduite à `taille` (au plus proche : une palette ne se mélange pas)."""
    w, h = img.size
    px = np.array(img.pixels[:]).reshape(h, w, 4).copy()
    rgb = px[:, :, :3]
    for src, dst in table.items():
        s = hex_rgb(src)
        d = hex_rgb(dst)
        masque = np.linalg.norm(rgb - s, axis=2) < 0.09
        rgb[masque] = d
    px[:, :, :3] = rgb
    if taille and taille < w:
        pas = w // taille
        # au plus proche, au CENTRE de chaque bloc (les cases de la palette sont alignées sur la grille)
        px = px[pas // 2 :: pas, pas // 2 :: pas]
    nh, nw = px.shape[:2]
    out = bpy.data.images.new(nom, nw, nh, alpha=False)
    out.pixels[:] = px.ravel().tolist()
    out.file_format = "PNG"
    chemin = os.path.join(BUILD, nom + ".png")
    out.filepath_raw = chemin
    out.save()
    return out


def deplacer_uv(mesh, de, vers):
    """Recolore une PIÈCE sans toucher à la texture : ses UV qui tombent dans la case `de` vont à la même place relative dans la case `vers` (une autre couleur de la palette, son dégradé gardé).
    Cases en fractions de la texture, origine en HAUT à gauche : [u0, y0, u1, y1]."""
    u0, y0, u1, y1 = de
    a0, b0, a1, b1 = vers
    for l in mesh.data.uv_layers.active.data:
        u, v = l.uv
        y = 1 - v
        if u0 <= u <= u1 and y0 <= y <= y1:
            nu = a0 + (u - u0) / (u1 - u0) * (a1 - a0)
            ny = b0 + (y - y0) / (y1 - y0) * (b1 - b0)
            l.uv = (nu, 1 - ny)


def masque_lueur(img, couleurs, nom):
    """La texture de LUEUR : les seules cases de la palette (déjà recolorée) dont la couleur est dans `couleurs` (les yeux du golem), le reste noir. Exportée comme `emissiveTexture` ; le jeu la fait fleurir (bloom)."""
    w, h = img.size
    px = np.array(img.pixels[:]).reshape(h, w, 4).copy()
    garde = np.zeros((h, w), dtype=bool)
    for c in couleurs:
        garde |= np.linalg.norm(px[:, :, :3] - hex_rgb(c), axis=2) < 0.06
    px[~garde, :3] = 0
    out = bpy.data.images.new(nom, w, h, alpha=False)
    out.pixels[:] = px.ravel().tolist()
    out.file_format = "PNG"
    out.filepath_raw = os.path.join(BUILD, nom + ".png")
    out.save()
    return out


def materiau(mesh, img, plus_proche, lueur=None):
    m = bpy.data.materials.new("peau")
    m.use_nodes = True
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    tex.interpolation = "Closest" if plus_proche else "Linear"
    nt.links.new(tex.outputs[0], bsdf.inputs["Base Color"])
    bsdf.inputs["Metallic"].default_value = 0.0
    bsdf.inputs["Roughness"].default_value = 1.0
    if lueur is not None:
        tl = nt.nodes.new("ShaderNodeTexImage")
        tl.image = lueur
        tl.interpolation = "Closest" if plus_proche else "Linear"
        nt.links.new(tl.outputs[0], bsdf.inputs["Emission Color"])
        bsdf.inputs["Emission Strength"].default_value = 1.0
    mesh.data.materials.clear()
    mesh.data.materials.append(m)
    return m


def lisser(mesh, angle=None):
    """Ombrage LISSE (la cible : des formes rondes, lisses) : toutes les faces lisses ; `angle` (degrés) garde les arêtes plus vives que cet angle (un modèle facetté exprès)."""
    for p in mesh.data.polygons:
        p.use_smooth = True
    if angle is not None:
        bpy.context.view_layer.objects.active = mesh
        try:
            bpy.ops.object.shade_auto_smooth(angle=math.radians(angle))
        except Exception:  # noqa: BLE001
            pass


# --- L'export ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
def exporter(arm, mesh, chemin):
    ad = arm.animation_data
    if ad:
        ad.action = None
    bpy.context.scene.frame_set(0)
    bpy.ops.object.select_all(action="DESELECT")
    arm.select_set(True)
    mesh.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=chemin,
        export_format="GLB",
        use_selection=True,
        export_apply=False,
        export_yup=True,
        export_texcoords=True,
        export_normals=True,
        export_tangents=False,
        export_materials="EXPORT",
        export_image_format="AUTO",
        export_skins=True,
        export_animations=True,
        export_animation_mode="NLA_TRACKS",
        export_force_sampling=True,
        export_frame_step=1,
        export_optimize_animation_size=True,
        export_anim_single_armature=True,
        export_def_bones=True,
        export_reset_pose_bones=True,
        export_morph=False,
        export_lights=False,
        export_cameras=False,
        export_extras=False,
    )


def vignettes(nom, taille=360):
    """Une planche : le modèle vu par la caméra du jeu (plongée ~35°, de face), à la première image, au milieu et à la fin de chaque clip (Workbench, texture). `build/<nom>-planche.png`."""
    sc = bpy.context.scene
    arm = next(o for o in sc.objects if o.type == "ARMATURE")
    mesh = next(o for o in sc.objects if o.type == "MESH")
    sc.render.engine = "BLENDER_WORKBENCH"
    sh = sc.display.shading
    sh.light = "STUDIO"
    sh.color_type = "TEXTURE"
    sh.show_object_outline = True
    sh.object_outline_color = (0.1, 0.07, 0.05)
    sh.background_type = "VIEWPORT"
    sh.background_color = (0.93, 0.82, 0.6)
    sc.view_settings.view_transform = "Standard"
    sc.render.resolution_x = taille
    sc.render.resolution_y = taille
    sc.render.film_transparent = False
    cam = bpy.data.objects.new("vignette", bpy.data.cameras.new("vignette"))
    sc.collection.objects.link(cam)
    sc.camera = cam
    cam.data.type = "ORTHO"
    phi = math.radians(35)
    ad = arm.animation_data
    pistes = list(ad.nla_tracks)
    images = []
    os.makedirs(os.path.join(BUILD, "vignettes"), exist_ok=True)
    for p in pistes:
        p.mute = True
    for p in pistes:
        a = p.strips[0].action
        poser = a.frame_range
        for k, f in enumerate((poser[0], (poser[0] + poser[1]) / 2, poser[1])):
            poser_action(arm, a, f)
            pts = sommets_monde(mesh)
            lo, hi = pts.min(axis=0), pts.max(axis=0)
            c = (lo + hi) / 2
            cam.data.ortho_scale = float(max(hi - lo)) * 1.3
            cam.location = Vector((c[0], c[1] - math.cos(phi) * 30, c[2] + math.sin(phi) * 30))
            cam.rotation_euler = (math.radians(90) - phi, 0, 0)
            chemin = os.path.join(BUILD, "vignettes", f"{nom}-{p.name}-{k}.png")
            sc.render.filepath = chemin
            bpy.ops.render.render(write_still=True)
            images.append(chemin)
    # la planche : une ligne par clip, trois images
    lignes = len(pistes)
    planche = np.ones((lignes * taille, 3 * taille, 4))
    for i, chemin in enumerate(images):
        im = bpy.data.images.load(chemin)
        px = np.array(im.pixels[:]).reshape(taille, taille, 4)
        r, k = divmod(i, 3)
        planche[(lignes - 1 - r) * taille : (lignes - r) * taille, k * taille : (k + 1) * taille] = px
        bpy.data.images.remove(im)
    out = bpy.data.images.new(nom + "-planche", 3 * taille, lignes * taille)
    out.pixels[:] = planche.ravel().tolist()
    out.filepath_raw = os.path.join(BUILD, nom + "-planche.png")
    out.file_format = "PNG"
    out.save()


def construire(spec):
    """Le modèle `spec["nom"]` de bout en bout ; rend le rapport (triangles, os, clips, échelle, hauteur)."""
    vider()
    objets, _ = importer_fbx(chemin_brut(spec["maillage"]))
    arm = next(o for o in objets if o.type == "ARMATURE")
    pieces = spec.get("pieces")
    meshes = []
    for o in objets:
        if o.type != "MESH":
            continue
        if pieces is not None and o.name.split(".")[0] not in pieces:
            bpy.data.objects.remove(o, do_unlink=True)
            continue
        meshes.append(o)
    for d in spec.get("deplacer_uv", []):
        for o in meshes:
            if o.name.split(".")[0] in d["pieces"]:
                deplacer_uv(o, d["de"], d["vers"])
    for a in spec.get("accessoires", []):
        meshes += attacher(arm, chemin_brut(a["fbx"]), a["os"], a.get("decalage", (0, 0, 0)), a.get("rotation", (0, 0, 0)), a.get("echelle", 1.0))
    # appliquer les transformations des pièces (leur parent reste le squelette)
    mesh = fondre(meshes) if len(meshes) > 1 else meshes[0]
    mesh.name = spec["nom"]
    clips = importer_clips(arm, spec["clips"], spec.get("racines", []))
    rapport = normaliser(arm, mesh, spec["rayon"], spec.get("exclus", []), clips[spec.get("pose", "attente")])
    # la texture
    img = charger_image(chemin_brut(spec["texture"]))
    if spec.get("inspecter"):
        rapport["couleurs"] = couleurs_utilisees(mesh, img)
    os.makedirs(BUILD, exist_ok=True)
    tex = recolorer(img, spec.get("teintes", {}), spec.get("taille_texture", 64), spec["nom"] + "-couleur")
    lueur = masque_lueur(tex, spec["lueur"], spec["nom"] + "-lueur") if spec.get("lueur") else None
    materiau(mesh, tex, spec.get("plus_proche", True), lueur)
    lisser(mesh, spec.get("angle_vif"))
    # retirer les poses NLA du rendu de la pose de repos, puis exporter
    exporter(arm, mesh, os.path.join(BUILD, spec["nom"] + ".glb"))
    rapport.update(
        {
            "triangles": sum(len(p.vertices) - 2 for p in mesh.data.polygons),
            "os": len(arm.data.bones),
            "clips": {n: [float(a.frame_range[0]), float(a.frame_range[1])] for n, a in clips.items()},
            "texture": list(tex.size),
        }
    )
    with open(os.path.join(BUILD, spec["nom"] + ".json"), "w", encoding="utf-8") as f:
        json.dump(rapport, f, indent=1)
    return rapport
