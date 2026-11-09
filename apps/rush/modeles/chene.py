# Le VIEUX CHÊNE (lot BR-A1) : un arbre-souche à l'écorce taillée de sillons sombres, des racines qui s'enfoncent dans le sol, un visage dans le bois (une arcade, une bouche creuse, un nœud ; les yeux vert-jaune sont des
# aplats lumineux du code), deux branches-bras feuillues, une cime en touffes taillées. Repère : la racine AVANT son échelle (`creerChene` la met à 0,8 : ~8 m).
# Pièces et pivots = `creerChene` (`bosses.ts`) : `corps` (0, 0, 0), `cime` (0, 6,6, 0 : le groupe de la cime à 5,7 m, la pièce 0,9 m au-dessus), `bras_g` / `bras_d` (∓1,75, 4,9, 0,1).
import math

from commun import Modele, Piece, pose

ECORCE = (0x4E3624, 0x6B4A32)
SOMBRE = (0x33231A, 0x4E3624)
FEUILLE = (0x2F6B34, 0x4F8C3E)
FEUILLE_CLAIRE = (0x3F7E3A, 0x6CA84E)
BOUCHE = 0x1C120C
SILLON = 0x241810
MOUSSE = 0x5E8A3A


def bois(p, w, h, d, M, teinte, graine, coupes=8, profondeur=(0.12, 0.3)):
    return p.roche(w, h, d, M, teinte[0], teinte[1], 0x241810, coupes=coupes, profondeur=profondeur, biseau=0.05, variation=0.06, graine=graine)


def construire():
    m = Modele("chene")
    c = Piece("corps", 401)
    # le tronc : deux gros fûts taillés l'un sur l'autre, un peu tordus
    bois(c, 3.6, 3.3, 3.4, pose(0, 1.75, 0, ry=0.1), ECORCE, 410, coupes=12)
    bois(c, 3.0, 2.8, 2.9, pose(0, 4.35, 0.1, ry=-0.12), ECORCE, 411, coupes=12)
    # cinq racines qui plongent dans le sol, en tubes qui s'effilent
    for i, a in enumerate((0.4, 1.75, 3.1, 4.4, 5.6)):
        sa, ca = math.sin(a), math.cos(a)
        pts = [(sa * 1.4, 0.8, ca * 1.4), (sa * 2.05, 0.5, ca * 2.05), (sa * 2.7, 0.2, ca * 2.7), (sa * 3.2, -0.1, ca * 3.2)]
        c.tube(pts, [0.75, 0.55, 0.38, 0.2], None, SOMBRE[0], ECORCE[1], segments=6, lisse=False)
    # les sillons de l'écorce (des fentes verticales sombres, devant et sur les flancs)
    for (x, y, z, h) in ((-1.45, 2.0, 1.55, 1.6), (1.3, 1.6, 1.58, 1.4), (1.62, 3.9, 0.9, 1.3), (-1.55, 4.4, 0.6, 1.2), (0.55, 1.2, 1.72, 0.9)):
        c.fissure((x, y + h / 2, z), [(0.08, -h * 0.5, 0.0), (-0.1, -h * 0.5, 0.0)], couleur=SILLON, largeur=0.09, epaisseur=0.1)
    # le visage : une arcade épaisse, une bouche creuse, un nœud, deux orbites sombres (les yeux du code y brillent)
    bois(c, 2.3, 0.45, 0.65, pose(0, 5.05, 1.45), SOMBRE, 412, coupes=5, profondeur=(0.06, 0.18))
    c.boite(1.5, 0.8, 0.4, pose(0, 3.75, 1.5, rx=0.05), BOUCHE, biseau=0.15)
    bois(c, 0.85, 0.8, 0.5, pose(-1.05, 3.2, 1.52), ECORCE, 414, coupes=5)
    for s in (-1, 1):
        c.boite(0.62, 0.32, 0.25, pose(s * 0.68, 4.72, 1.42, rz=s * 0.3), BOUCHE, biseau=0.06)
        # des dents de bois dans la bouche
        c.cone(0.12, 0.0, 0.3, pose(s * 0.35, 4.08, 1.66, rx=math.pi), 0x8A6A48, segments=4)
    # des plaques de mousse sur les épaules du tronc
    c.ico(0.5, pose(1.2, 5.6, -0.4, s=(1.4, 0.45, 1.2)), MOUSSE, 0x7FA84E, subdiv=2, bruit=0.15, graine=416)
    c.ico(0.45, pose(-1.3, 3.4, -1.2, s=(1.2, 0.4, 1.0)), MOUSSE, 0x7FA84E, subdiv=2, bruit=0.15, graine=417)
    m.poser(c, (0.0, 0.0, 0.0))

    # la cime : des touffes de feuillage taillées (icosaèdres déformés), deux verts
    k = Piece("cime", 420)
    for i, (x, y, z, r, f) in enumerate(((0, 0.0, 0, 2.1, FEUILLE), (-2.0, -0.6, 0.3, 1.45, FEUILLE_CLAIRE), (2.0, -0.5, -0.2, 1.45, FEUILLE), (0.2, 1.3, -0.4, 1.5, FEUILLE_CLAIRE), (0, -0.8, 1.7, 1.25, FEUILLE), (-0.9, 0.6, -1.5, 1.3, FEUILLE))):
        k.ico(r, pose(x, y, z, s=(1.0, 0.78, 1.0)), f[0], f[1], 0x23502A, subdiv=2, bruit=0.14, variation=0.06, graine=421 + i)
    m.poser(k, (0.0, 6.6, 0.0))

    for nom, s in (("bras_g", -1), ("bras_d", 1)):
        b = Piece(nom, 430 + s)
        b.tube([(0, 0.2, 0), (s * 0.15, -1.0, 0.1), (s * 0.05, -2.1, 0.15), (s * 0.35, -2.9, 0.2)], [0.5, 0.42, 0.34, 0.26], None, ECORCE[0], ECORCE[1], segments=7, lisse=False)
        b.tube([(s * 0.1, -1.6, 0.1), (s * 0.7, -2.2, 0.2), (s * 0.95, -2.7, 0.15)], [0.22, 0.17, 0.12], None, SOMBRE[0], ECORCE[1], segments=5, lisse=False)
        b.ico(0.85, pose(s * 0.3, -3.35, 0.15, s=(1.0, 0.85, 1.0)), FEUILLE[0], FEUILLE[1], 0x23502A, subdiv=2, bruit=0.15, graine=435 + s)
        b.ico(0.5, pose(s * 1.05, -2.85, 0.2), FEUILLE_CLAIRE[0], FEUILLE_CLAIRE[1], subdiv=2, bruit=0.15, graine=437 + s)
        m.poser(b, (s * 1.75, 4.9, 0.1))
    return m
