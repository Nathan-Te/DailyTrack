# Le BÉLIER DE CARRIÈRE (lot BR-A1) : un gros bélier trapu de pierre bleu-gris en plans taillés, des plaques plus claires sur le dos, une tête massive au museau sombre, deux GRANDES CORNES d'os qui s'enroulent, des
# sabots sombres. Pièces et pivots = `creerBelier` (`bosses.ts`) : `corps` (0, 0, 0), `tete` (0, 2,3, 1,7), `yeux` (0, 0,3, 1,38 dans la tête), `patte_ag` / `patte_ad` / `patte_rg` / `patte_rd` (∓1,05, 1,5, ±1,35 :
# a = avant, r = arrière ; dans l'ordre des `pattes` du code).
import math

from commun import BLANC, ENCRE, Modele, Piece, pose

PIERRE = (0x4D5660, 0x6F7A86)
SOMBRE = (0x33383F, 0x4D5660)
PLAQUE = (0x6A7480, 0x8A95A2)
CORNE = 0xD8CFB8
CORNE_SOMBRE = 0xA89F88
SABOT = 0x23262B


def bloc(p, w, h, d, M, teinte, graine, coupes=10, profondeur=(0.18, 0.4)):
    return p.roche(w, h, d, M, teinte[0], teinte[1], 0x2A2E34, coupes=coupes, profondeur=profondeur, biseau=0.05, variation=0.05, graine=graine)


def corne(p, s):
    """Une corne de bélier : elle part du haut du crâne, file vers l'arrière, plonge et revient vers l'avant autour de l'oreille (une spirale dans le plan du profil), en s'éloignant de la tête et en s'effilant."""
    pts = []
    rayons = []
    n = 14
    for i in range(n):
        u = i / (n - 1)
        th = math.pi * 0.5 + u * 1.75 * math.pi
        r = 0.95 * (1 - 0.55 * u)
        pts.append((s * (0.75 + 1.0 * u), 0.2 + r * math.sin(th), 0.3 + r * math.cos(th)))
        rayons.append(0.44 * (1 - 0.7 * u) + 0.06)
    p.tube(pts, rayons, None, CORNE, BLANC, segments=8, lisse=False)
    # les bourrelets de la corne (des anneaux plus sombres)
    for i in (2, 4, 6, 8):
        p.tube([pts[i], pts[i + 1]], [rayons[i] * 1.07, rayons[i + 1] * 1.03], None, CORNE_SOMBRE, CORNE, segments=8, lisse=False)


def construire():
    m = Modele("belier")
    c = Piece("corps", 301)
    bloc(c, 3.0, 2.0, 3.8, pose(0, 1.9, 0), PIERRE, 301, coupes=12)
    bloc(c, 2.2, 0.55, 1.0, pose(0, 3.0, -1.15), PLAQUE, 302, coupes=6, profondeur=(0.1, 0.25))
    bloc(c, 2.5, 0.6, 1.1, pose(0, 3.1, 0.1), PLAQUE, 303, coupes=6, profondeur=(0.1, 0.25))
    bloc(c, 2.0, 0.55, 0.9, pose(0, 2.95, 1.2), PLAQUE, 304, coupes=6, profondeur=(0.1, 0.25))
    bloc(c, 1.5, 1.0, 0.9, pose(0, 1.5, -1.95), SOMBRE, 305, coupes=7)
    bloc(c, 2.2, 1.3, 1.0, pose(0, 2.0, 1.75), PIERRE, 306, coupes=7)  # le poitrail
    c.fissure((1.52, 2.2, 0.4), [(0.0, -0.3, -0.25), (0.0, -0.25, 0.2)], couleur=0x22262B, largeur=0.06)
    m.poser(c, (0.0, 0.0, 0.0))

    t = Piece("tete", 311)
    bloc(t, 1.9, 1.7, 1.7, pose(0, 0, 0.5), PIERRE, 311, coupes=10)
    bloc(t, 1.25, 0.85, 0.85, pose(0, -0.45, 1.5), SOMBRE, 312, coupes=6)
    bloc(t, 2.1, 0.42, 0.5, pose(0, 0.48, 1.12), SOMBRE, 313, coupes=4, profondeur=(0.05, 0.15))
    for s in (-1, 1):
        t.sphere(0.07, pose(s * 0.28, -0.5, 1.95), ENCRE, segments=6, anneaux=4)  # les naseaux
        corne(t, s)
    m.poser(t, (0.0, 2.3, 1.7))

    y = Piece("yeux", 312)
    for s in (-1, 1):
        y.sphere(1.0, pose(s * 0.62, 0, 0, s=(0.18, 0.13, 0.12)), BLANC, segments=10, anneaux=6)
        y.sphere(1.0, pose(s * 0.6, -0.01, 0.08, s=(0.07, 0.11, 0.06)), ENCRE, segments=8, anneaux=5)
    m.poser(y, (0.0, 0.3, 1.38), parent="tete")

    for nom, sx, sz, g in (("patte_ag", -1, 1, 321), ("patte_ad", 1, 1, 322), ("patte_rg", -1, -1, 323), ("patte_rd", 1, -1, 324)):
        p = Piece(nom, g)
        bloc(p, 0.95, 1.5, 0.95, pose(0, -0.55, 0), SOMBRE, g, coupes=7)
        p.roche(1.0, 0.4, 1.05, pose(0, -1.32, 0.05), SABOT, 0x3A3E45, coupes=5, profondeur=(0.1, 0.25), biseau=0.05, graine=g + 10)
        m.poser(p, (sx * 1.05, 1.5, sz * 1.35))
    return m
