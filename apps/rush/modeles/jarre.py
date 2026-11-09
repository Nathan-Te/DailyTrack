# La JARRE (lot BR-A1) : une jarre de terre cuite ventrue, un col étroit à lèvre sombre, une bande claire peinte. Collision 0,30 m (`RAYON_VASE`) ; ~0,82 m de haut. Tas instancié : `corps`.
# Ses ÉCLATS (la casse) : `eclat_1` … `eclat_4`, des tessons courbes, chacun posé à sa place sur la panse (son origine) : le code les fait jaillir de là, vers l'extérieur.
import math

import bmesh

from commun import Modele, Piece, pose

TERRE = 0xC9733E
CLAIRE = 0xE7A468
SOMBRE = 0x8F4A25


def tesson(p, r, a0, a1, y0, y1, couleur, claire):
    """Un tesson : un morceau de la panse entre deux angles et deux hauteurs, avec une épaisseur (repère : centré sur son milieu)."""
    n = 3
    am = (a0 + a1) / 2
    ym = (y0 + y1) / 2
    cx, cz = math.sin(am) * r, math.cos(am) * r
    p._avant()
    bm = p.bm
    vs = {}
    for i in range(n + 1):
        a = a0 + (a1 - a0) * i / n
        for j, y in enumerate((y0, y1)):
            for k, rr in enumerate((r, r * 0.86)):
                vs[(i, j, k)] = bm.verts.new((math.sin(a) * rr - cx, y - ym, math.cos(a) * rr - cz))
    for i in range(n):
        for k in (0, 1):
            f = [vs[(i, 0, k)], vs[(i + 1, 0, k)], vs[(i + 1, 1, k)], vs[(i, 1, k)]]
            bm.faces.new(f if k == 0 else list(reversed(f)))
        bm.faces.new([vs[(i, 0, 0)], vs[(i, 0, 1)], vs[(i + 1, 0, 1)], vs[(i + 1, 0, 0)]])
        bm.faces.new([vs[(i, 1, 0)], vs[(i + 1, 1, 0)], vs[(i + 1, 1, 1)], vs[(i, 1, 1)]])
    for i in (0, n):
        f = [vs[(i, 0, 0)], vs[(i, 1, 0)], vs[(i, 1, 1)], vs[(i, 0, 1)]]
        bm.faces.new(f if i == 0 else list(reversed(f)))
    faces = p._nouvelles()
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    p._finir(faces, couleur, claire)
    return (cx, ym, cz)


def construire():
    m = Modele("jarre")
    c = Piece("corps", 601)
    c.tour([(0.0, 0.0), (0.17, 0.0), (0.26, 0.08), (0.3, 0.24), (0.3, 0.38), (0.24, 0.52), (0.14, 0.62), (0.12, 0.7), (0.17, 0.76), (0.17, 0.81), (0.12, 0.81), (0.0, 0.7)], None, TERRE, CLAIRE, SOMBRE, segments=10, lisse=True)
    c.tour([(0.303, 0.3), (0.31, 0.34), (0.303, 0.38)], None, CLAIRE, segments=10, lisse=True)  # la bande peinte
    m.poser(c)
    for i, (a0, a1, y0, y1) in enumerate(((0.2, 1.5, 0.08, 0.4), (1.7, 3.0, 0.2, 0.52), (3.3, 4.6, 0.06, 0.36), (4.8, 6.1, 0.18, 0.5))):
        e = Piece(f"eclat_{i + 1}", 610 + i)
        centre = tesson(e, 0.29, a0, a1, y0, y1, TERRE if i % 2 == 0 else CLAIRE, CLAIRE)
        m.poser(e, centre)
    return m
