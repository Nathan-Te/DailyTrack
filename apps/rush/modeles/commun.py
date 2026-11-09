# Les briques communes des modèles de Rush (lot BR-A1). Lancé par Blender (`construire.py`) : aucun module hors de Blender.
#
# LE CONTRAT (voir `apps/rush/src/modeles.ts`, qui le relit) :
#  · on modélise dans le REPÈRE DU JEU : x à droite de l'écran, y en haut, l'avant d'un personnage vers +z, le mètre, les pieds à y = 0 ; `G()` passe au repère de Blender (z en haut) et l'exporteur glTF repasse en y en haut ;
#  · un modèle = un vide racine (son nom) et des PIÈCES NOMMÉES (`corps`, `tete`, `bras_g`…), chacune un objet maillé dont l'ORIGINE est là où le code pose le groupe de cette pièce (le pivot de l'articulation, dans le repère du
#    parent : la hiérarchie de Blender est celle des groupes du code) ; le chargeur lit chaque pièce dans son propre repère ;
#  · « _g » est la pièce du côté x < 0, « _d » celle du côté x > 0 (comme `aileG`, `bras[0]` dans le code) ;
#  · des COULEURS PAR FACE (attribut de coin « Col »), aucune texture : le toon et le contour du jeu font le reste ;
#  · des arêtes adoucies (biseaux) ; la pierre en PLANS TAILLÉS (des coupes planes au hasard d'une graine) ; jamais de hasard sans graine : l'export se refait à l'identique.
import math
import os
import random

import bmesh
import bpy
from mathutils import Matrix, Vector

ICI = os.path.dirname(os.path.abspath(__file__))
DEPOT = os.path.abspath(os.path.join(ICI, "..", "..", ".."))
BUILD = os.path.join(ICI, "build")


# --- Couleurs -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
def rgb(h):
    """Une couleur 0xRRGGBB (sRGB) en flottants 0..1 : l'attribut de coin « Col » est en octets sRGB, l'exporteur le passe en linéaire."""
    return ((h >> 16 & 255) / 255.0, (h >> 8 & 255) / 255.0, (h & 255) / 255.0)


def melange(a, b, t):
    return tuple(a[i] * (1 - t) + b[i] * t for i in range(3))


def uniques(suite):
    """Les éléments d'une suite, sans doublon, DANS L'ORDRE (jamais un `set` qu'on parcourt : son ordre suit les adresses en mémoire, et l'export ne se referait pas à l'identique)."""
    vus = set()
    sortie = []
    for x in suite:
        if x not in vus:
            vus.add(x)
            sortie.append(x)
    return sortie


def eclaircir(c, f):
    return tuple(min(1.0, max(0.0, v * f)) for v in c)


# Les couleurs reprises de `apps/rush/src/palette.ts` (COULEURS) et `bosses.ts` (COULEURS_BOSS) : la lisibilité (ΔE ≥ 40 contre chaque sol) est mesurée sur le modèle exporté (`apps/rush/test/modeles.test.ts`).
ENCRE = 0x1A120C
BLANC = 0xFFFAF0


# --- Repères --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
def G(x, y, z):
    """Un point du repère du jeu (y en haut, avant +z) dans celui de Blender (z en haut, avant −y)."""
    return Vector((x, -z, y))


# Le passage du repère du jeu à celui de Blender, en matrice (appliqué à la fin de chaque pièce).
JEU_VERS_BLENDER = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))


def pose(x=0.0, y=0.0, z=0.0, rx=0.0, ry=0.0, rz=0.0, s=1.0):
    """La matrice d'une pose dans le repère du jeu, comme `placer` de `formes.ts` : échelle, puis rotations (ordre XYZ de Three.js), puis translation."""
    sx, sy, sz = (s, s, s) if isinstance(s, (int, float)) else s
    R = Matrix.Rotation(rx, 4, "X") @ Matrix.Rotation(ry, 4, "Y") @ Matrix.Rotation(rz, 4, "Z")
    S = Matrix.Diagonal((sx, sy, sz, 1.0))
    return Matrix.Translation((x, y, z)) @ R @ S


# --- Une pièce : un bmesh en repère du jeu, des parties colorées -------------------------------------------------------------------------------------------------------------------------------------
class Piece:
    """Une pièce nommée : on y ajoute des PARTIES (boîte, roche taillée, sphère, cône, tour…), chacune avec ses couleurs ; `objet()` la rend en objet de Blender (repère de Blender, origine au pivot)."""

    def __init__(self, nom, graine=1):
        self.nom = nom
        self.principal, self.pcol, _ = Piece._neuf()
        self.bm, self.col, self.fini = self.principal, self.pcol, None
        self.rng = random.Random(graine)

    @staticmethod
    def _neuf():
        bm = bmesh.new()
        # les opérateurs de bmesh effacent les marques `tag` : les faces de la partie en cours sont repérées par un calque d'entiers (0 : en cours)
        return bm, bm.loops.layers.color.new("Col"), bm.faces.layers.int.new("fini")

    # -- une PARTIE se construit dans son propre bmesh (`_avant`), puis est versée dans la pièce (`_finir`) : les opérateurs de bmesh (coupes, biseaux, bouchage des trous) n'y voient jamais les autres parties — ils
    #    rangent leurs résultats selon des adresses en mémoire, et dans un maillage partagé la forme elle-même changeait d'un lancement à l'autre.
    def _avant(self):
        self.bm, self.col, self.fini = Piece._neuf()

    def _nouvelles(self):
        return [f for f in self.bm.faces if f[self.fini] == 0]

    def _verser(self):
        t, tcol = self.bm, self.col
        p = self.principal
        nv = [p.verts.new(v.co) for v in t.verts]
        t.verts.index_update()
        for f in t.faces:
            g = p.faces.new([nv[l.vert.index] for l in f.loops])
            g.smooth = f.smooth
            for l, m in zip(f.loops, g.loops):
                m[self.pcol] = l[tcol]
        t.free()
        self.bm, self.col, self.fini = self.principal, self.pcol, None

    def _finir(self, faces, couleur, dessus=None, dessous=None, variation=0.0, lisse=False):
        """Colore les faces d'une partie : la couleur, plus claire vers le haut (`dessus`), plus sombre dessous ; `variation` : un écart par face (la pierre peinte)."""
        c0 = rgb(couleur) if isinstance(couleur, int) else couleur
        cd = rgb(dessus) if isinstance(dessus, int) else dessus
        cs = rgb(dessous) if isinstance(dessous, int) else dessous
        for f in faces:
            f.normal_update()
            n = f.normal
            c = c0
            if cd is not None and n.y > 0.35:
                c = melange(c0, cd, min(1.0, (n.y - 0.35) / 0.45))
            if cs is not None and n.y < -0.35:
                c = melange(c0, cs, min(1.0, (-n.y - 0.35) / 0.45))
            if variation > 0:
                c = eclaircir(c, 1.0 + (self.rng.random() * 2 - 1) * variation)
            for l in f.loops:
                l[self.col] = (c[0], c[1], c[2], 1.0)
            f.smooth = lisse
            f[self.fini] = 1
        self._verser()
        return faces

    def _biseau(self, faces, largeur, segments=1):
        if largeur <= 0:
            return faces
        aretes = uniques(e for f in faces for e in f.edges)
        vs = uniques(v for f in faces for v in f.verts)
        bmesh.ops.bevel(self.bm, geom=aretes + vs, offset=largeur, offset_type="OFFSET", segments=segments, profile=0.5, affect="EDGES", clamp_overlap=True)
        return self._nouvelles()

    def _transformer(self, faces, M):
        vs = uniques(v for f in faces for v in f.verts)
        bmesh.ops.transform(self.bm, matrix=M, verts=vs)
        if M.determinant() < 0:
            bmesh.ops.reverse_faces(self.bm, faces=faces)

    # -- les parties
    def boite(self, w, h, d, M=None, couleur=0xFFFFFF, dessus=None, dessous=None, biseau=0.0, segments=1, variation=0.0, lisse=False):
        """Une boîte (w, h, d) centrée, aux arêtes biseautées."""
        self._avant()
        bmesh.ops.create_cube(self.bm, size=1.0, matrix=Matrix.Diagonal((w, h, d, 1.0)))
        faces = self._nouvelles()
        faces = self._biseau(faces, biseau, segments)
        if M is not None:
            self._transformer(faces, M)
        return self._finir(faces, couleur, dessus, dessous, variation, lisse)

    def roche(self, w, h, d, M=None, couleur=0x808080, dessus=None, dessous=None, coupes=7, profondeur=(0.12, 0.3), biseau=0.04, variation=0.05, graine=None, base="cube"):
        """Un bloc de pierre TAILLÉE : une boîte dont on abat les coins et les arêtes par des coupes planes (tirées d'une graine), puis un léger biseau. Ombrage plat : des plans nets."""
        rng = random.Random(graine) if graine is not None else self.rng
        self._avant()
        demi = Vector((w / 2, h / 2, d / 2))
        if base == "ico":
            # un ROCHER : un icosaèdre (déjà des facettes) tourné au hasard, étiré à la taille (w, h, d) : les coupes y taillent quelques grands plans (lot BR-A1, tour 3 : le cube faisait des caisses)
            R = Matrix.Rotation(rng.uniform(0, 6.283), 4, "Y") @ Matrix.Rotation(rng.uniform(-0.4, 0.4), 4, "X")
            bmesh.ops.create_icosphere(self.bm, subdivisions=1, radius=0.5, matrix=Matrix.Diagonal((w * 1.12, h * 1.12, d * 1.12, 1.0)) @ R)
            for v in uniques(v for f in self._nouvelles() for v in f.verts):
                v.co *= 1 + (rng.random() * 2 - 1) * 0.06
            demi = demi * 1.12
        else:
            bmesh.ops.create_cube(self.bm, size=1.0, matrix=Matrix.Diagonal((w, h, d, 1.0)))
        for _ in range(coupes):
            # une direction vers un coin ou une arête, un peu bruitée
            n = Vector((rng.choice((-1, 1)) * (0.4 + rng.random()), rng.choice((-1, 1)) * (0.4 + rng.random()), rng.choice((-1, 1)) * (0.4 + rng.random())))
            if rng.random() < 0.4:
                k = rng.randrange(3)
                n[k] *= 0.15
            n.normalize()
            portee = abs(n.x) * demi.x + abs(n.y) * demi.y + abs(n.z) * demi.z if base == "cube" else math.sqrt((n.x * demi.x) ** 2 + (n.y * demi.y) ** 2 + (n.z * demi.z) ** 2)
            p = rng.uniform(*profondeur)
            faces = self._nouvelles()
            geom = uniques(v for f in faces for v in f.verts) + uniques(e for f in faces for e in f.edges) + faces
            bmesh.ops.bisect_plane(self.bm, geom=geom, plane_co=n * (portee * (1 - p)), plane_no=n, clear_outer=True)
            bord = [e for e in self.bm.edges if len(e.link_faces) == 1 and all(f[self.fini] == 0 for f in e.link_faces)]
            if bord:
                bmesh.ops.holes_fill(self.bm, edges=bord, sides=0)
        faces = self._nouvelles()
        faces = self._biseau(faces, biseau * min(w, h, d), 1)
        if M is not None:
            self._transformer(faces, M)
        return self._finir(faces, couleur, dessus, dessous, variation, lisse=False)

    def sphere(self, r, M=None, couleur=0xFFFFFF, dessus=None, dessous=None, segments=16, anneaux=10, lisse=True, variation=0.0):
        self._avant()
        bmesh.ops.create_uvsphere(self.bm, u_segments=segments, v_segments=anneaux, radius=r)
        faces = self._nouvelles()
        if M is not None:
            self._transformer(faces, M)
        return self._finir(faces, couleur, dessus, dessous, variation, lisse)

    def ico(self, r, M=None, couleur=0xFFFFFF, dessus=None, dessous=None, subdiv=1, bruit=0.0, lisse=False, variation=0.0, graine=None):
        """Un icosaèdre (une touffe de feuillage, un caillou), déformé le long de son rayon par `bruit`."""
        rng = random.Random(graine) if graine is not None else self.rng
        self._avant()
        bmesh.ops.create_icosphere(self.bm, subdivisions=subdiv, radius=r)
        faces = self._nouvelles()
        if bruit > 0:
            for v in uniques(v for f in faces for v in f.verts):
                v.co *= 1 + (rng.random() * 2 - 1) * bruit
        if M is not None:
            self._transformer(faces, M)
        return self._finir(faces, couleur, dessus, dessous, variation, lisse)

    def tour(self, profil, M=None, couleur=0xFFFFFF, dessus=None, dessous=None, segments=16, lisse=True, ondes=None, variation=0.0):
        """Un solide de révolution autour de y : `profil` = [(rayon, y)…] de bas en haut (un rayon nul ferme). `ondes` = (nombre, amplitude, hauteur max) : un bord ondulé (une gelée qui coule)."""
        self._avant()
        anneaux = []
        for (r, y) in profil:
            anneau = []
            if r <= 1e-5:
                anneau = [self.bm.verts.new((0.0, y, 0.0))]
            else:
                for i in range(segments):
                    a = 2 * math.pi * i / segments
                    rr = r
                    if ondes is not None and y <= ondes[2]:
                        rr = r * (1 + ondes[1] * math.cos(ondes[0] * a) * (1 - y / max(1e-6, ondes[2])))
                    anneau.append(self.bm.verts.new((math.sin(a) * rr, y, math.cos(a) * rr)))
            anneaux.append(anneau)
        for k in range(len(anneaux) - 1):
            a, b = anneaux[k], anneaux[k + 1]
            for i in range(segments):
                j = (i + 1) % segments
                if len(a) == 1:
                    self.bm.faces.new((a[0], b[j], b[i]))
                elif len(b) == 1:
                    self.bm.faces.new((a[i], a[j], b[0]))
                else:
                    self.bm.faces.new((a[i], a[j], b[j], b[i]))
        faces = self._nouvelles()
        bmesh.ops.recalc_face_normals(self.bm, faces=faces)
        if M is not None:
            self._transformer(faces, M)
        return self._finir(faces, couleur, dessus, dessous, variation, lisse)

    def cone(self, r1, r2, h, M=None, couleur=0xFFFFFF, dessus=None, dessous=None, segments=8, lisse=False, biseau=0.0):
        """Un cône tronqué (rayon du bas, du haut), axe y, centré."""
        self._avant()
        bmesh.ops.create_cone(self.bm, cap_ends=True, cap_tris=False, segments=segments, radius1=r1, radius2=r2, depth=h, matrix=Matrix.Rotation(-math.pi / 2, 4, "X"))
        faces = self._nouvelles()
        faces = self._biseau(faces, biseau, 1)
        if M is not None:
            self._transformer(faces, M)
        return self._finir(faces, couleur, dessus, dessous, 0.0, lisse)

    def plaque(self, points, epaisseur, M=None, couleur=0xFFFFFF, dessus=None, dessous=None, biseau=0.0, variation=0.0):
        """Une plaque extrudée d'un polygone du plan (x, z) (couchée à plat, épaisseur vers le bas) : une aile, une membrane, une lame."""
        self._avant()
        vs = [self.bm.verts.new((x, 0.0, z)) for (x, z) in points]
        f = self.bm.faces.new(vs)
        f.normal_update()
        if f.normal.y < 0:
            f.normal_flip()
        r = bmesh.ops.extrude_face_region(self.bm, geom=[f])
        nv = [g for g in r["geom"] if isinstance(g, bmesh.types.BMVert)]
        bmesh.ops.translate(self.bm, verts=nv, vec=(0.0, -epaisseur, 0.0))
        faces = self._nouvelles()
        bmesh.ops.recalc_face_normals(self.bm, faces=faces)
        faces = self._biseau(faces, biseau, 1)
        if M is not None:
            self._transformer(faces, M)
        return self._finir(faces, couleur, dessus, dessous, variation, lisse=False)

    def tube(self, points, rayons, M=None, couleur=0xFFFFFF, dessus=None, segments=6, lisse=True, fermer=True):
        """Un tube le long d'une suite de points (une corne qui s'enroule, une racine, une branche) : un anneau de `segments` côtés par point, de rayon `rayons[i]`."""
        self._avant()
        anneaux = []
        n = len(points)
        for i, p in enumerate(points):
            p = Vector(p)
            t = (Vector(points[min(n - 1, i + 1)]) - Vector(points[max(0, i - 1)])).normalized()
            a = Vector((0, 1, 0)) if abs(t.y) < 0.9 else Vector((1, 0, 0))
            u = t.cross(a).normalized()
            v = t.cross(u).normalized()
            anneau = []
            for k in range(segments):
                ang = 2 * math.pi * k / segments
                anneau.append(self.bm.verts.new(p + (u * math.cos(ang) + v * math.sin(ang)) * rayons[i]))
            anneaux.append(anneau)
        for i in range(n - 1):
            a, b = anneaux[i], anneaux[i + 1]
            for k in range(segments):
                j = (k + 1) % segments
                self.bm.faces.new((a[k], a[j], b[j], b[k]))
        if fermer:
            self.bm.faces.new(list(reversed(anneaux[0])))
            self.bm.faces.new(anneaux[-1])
        faces = self._nouvelles()
        bmesh.ops.recalc_face_normals(self.bm, faces=faces)
        if M is not None:
            self._transformer(faces, M)
        return self._finir(faces, couleur, dessus, None, 0.0, lisse)

    def fissure(self, depart, pas, M=None, couleur=0x2A201A, largeur=0.07, epaisseur=0.06):
        """Une FISSURE : une ligne brisée de fines lames sombres posées sur une face (`depart` : le premier point ; `pas` : les déplacements successifs dans le plan de la face, en repère du jeu)."""
        p = Vector(depart)
        for d in pas:
            d = Vector(d)
            q = p + d
            milieu = (p + q) / 2
            lon = d.length
            # une lame orientée le long de d : on construit une boîte (lon, largeur, épaisseur) et on l'aligne
            axe = d.normalized()
            hors = Vector((0, 0, 1)) if abs(axe.z) < 0.9 else Vector((0, 1, 0))
            b2 = axe.cross(hors).normalized()
            b3 = axe.cross(b2).normalized()
            R = Matrix((axe, b2, b3)).transposed().to_4x4()
            L = Matrix.Translation(milieu) @ R
            if M is not None:
                L = M @ L
            self.boite(lon + largeur * 0.6, largeur, epaisseur, L, couleur)
            p = q

    # -- la fin
    def _canonique(self):
        """Le maillage (triangulé) dans un ORDRE CANONIQUE : les sommets triés par position, chaque triangle commençant par son plus petit sommet, les triangles triés. Les opérateurs de bmesh rangent leurs résultats
        selon des adresses en mémoire : sans ce tri, deux exports du même script n'auraient pas les mêmes octets (la forme, si)."""
        cle = lambda co: (round(co.x, 5), round(co.y, 5), round(co.z, 5))  # noqa: E731
        sommets = sorted(self.bm.verts, key=lambda v: cle(v.co))
        rang = {v: i for i, v in enumerate(sommets)}
        tris = []
        for f in self.bm.faces:
            ls = list(f.loops)
            k = min(range(len(ls)), key=lambda i: rang[ls[i].vert])
            ls = ls[k:] + ls[:k]
            tris.append((tuple(rang[l.vert] for l in ls), tuple(tuple(round(c, 4) for c in l[self.col]) for l in ls), f.smooth))
        tris.sort()
        bm = bmesh.new()
        col = bm.loops.layers.color.new("Col")
        vs = [bm.verts.new(v.co) for v in sommets]
        for idx, couleurs, lisse in tris:
            try:
                f = bm.faces.new([vs[i] for i in idx])
            except ValueError:
                continue  # un triangle en double (deux parties qui se recouvrent exactement) : on n'en garde qu'un
            f.smooth = lisse
            for l, c in zip(f.loops, couleurs):
                l[col] = c
        return bm

    def triangles(self):
        return sum(len(f.verts) - 2 for f in self.bm.faces)

    def objet(self, collection, parent=None, pivot=(0.0, 0.0, 0.0)):
        """L'objet de Blender de la pièce : le maillage passe en repère de Blender, l'objet est posé au pivot (dans le repère de son parent)."""
        bmesh.ops.remove_doubles(self.bm, verts=self.bm.verts, dist=1e-5)
        bmesh.ops.transform(self.bm, matrix=JEU_VERS_BLENDER, verts=self.bm.verts)
        bmesh.ops.triangulate(self.bm, faces=self.bm.faces[:], quad_method="BEAUTY", ngon_method="BEAUTY")
        me = bpy.data.meshes.new(self.nom)
        self._canonique().to_mesh(me)
        self.bm.free()
        me.color_attributes.active_color = me.color_attributes["Col"]
        obj = bpy.data.objects.new(self.nom, me)
        collection.objects.link(obj)
        obj.parent = parent
        obj.location = G(*pivot)
        return obj


# --- Un modèle ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
class Modele:
    """Un modèle : une collection, un vide racine (son nom) et ses pièces. `piece(nom, pivot, parent)` ouvre une pièce ; `fermer()` la pose."""

    def __init__(self, nom):
        self.nom = nom
        vieille = bpy.data.collections.get(nom)
        if vieille is not None:
            for o in list(vieille.objects):
                bpy.data.objects.remove(o, do_unlink=True)
            bpy.data.collections.remove(vieille)
        self.collection = bpy.data.collections.new(nom)
        bpy.context.scene.collection.children.link(self.collection)
        self.racine = bpy.data.objects.new(nom, None)
        self.collection.objects.link(self.racine)
        self.objets = {}
        self.tris = {}

    def poser(self, piece, pivot=(0.0, 0.0, 0.0), parent=None):
        """Pose une pièce finie : `pivot` dans le repère de la pièce `parent` (un nom), ou de la racine."""
        self.tris[piece.nom] = piece.triangles()
        p = self.objets[parent] if parent else self.racine
        self.objets[piece.nom] = piece.objet(self.collection, p, pivot)
        return self.objets[piece.nom]

    def triangles(self):
        return sum(self.tris.values())


def exporter(modele, chemin):
    """Exporte un modèle en glTF binaire NON compressé (la compression est l'affaire de gltfpack : `construire.mjs`)."""
    os.makedirs(os.path.dirname(chemin), exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    for o in modele.collection.all_objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = modele.racine
    bpy.ops.export_scene.gltf(
        filepath=chemin,
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=True,
        export_normals=True,
        export_texcoords=False,
        export_materials="NONE",
        export_vertex_color="ACTIVE",
        export_extras=False,
        export_animations=False,
        export_skins=False,
        export_morph=False,
        export_cameras=False,
        export_lights=False,
    )
