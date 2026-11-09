# Le PORTE-BOUCLIER (lot BR-A1) : un colosse trapu d'ardoise (jambes courtes, torse large, épaulières, gros bras), un casque à crête ocre et fente sombre ; le GRAND BOUCLIER rond d'acier est une pièce à part (le code
# le tourne là où la simulation le tient). Tas instanciés : `corps` et `bouclier` (centré, tourné vers +z ; le code le pose à 0,95 m de haut, 0,8 m devant). Empreinte : ~0,62 m pour une collision de 0,60 m.
import math

from commun import BLANC, ENCRE, Modele, Piece, pose

ARDOISE = 0x3D4A63
ARDOISE_CLAIRE = 0x5A6A88
BORD = 0x2B3447
ACIER = 0x6C7FA3
ACIER_CLAIR = 0x9AAAC8
OCRE = 0xE0A030


def construire():
    m = Modele("porte-bouclier")
    c = Piece("corps", 561)
    for s in (-1, 1):
        c.boite(0.32, 0.5, 0.36, pose(s * 0.22, 0.25, 0), BORD, ARDOISE, biseau=0.06)
        c.boite(0.36, 0.12, 0.44, pose(s * 0.22, 0.06, 0.04), 0x20263A, biseau=0.03)
    c.roche(1.0, 0.75, 0.72, pose(0, 0.88, 0), ARDOISE, ARDOISE_CLAIRE, BORD, coupes=6, profondeur=(0.1, 0.22), biseau=0.06, graine=562)
    c.boite(0.86, 0.1, 0.64, pose(0, 0.55, 0), 0x6A4A2A, biseau=0.02)  # la ceinture de cuir
    c.sphere(1.0, pose(0, 1.48, 0, s=(0.31, 0.3, 0.31)), ARDOISE, ARDOISE_CLAIRE, BORD, segments=12, anneaux=8)  # le casque
    c.boite(0.08, 0.16, 0.58, pose(0, 1.78, -0.02), OCRE, 0xF6C860, biseau=0.03)  # la crête
    c.cone(0.09, 0.0, 0.36, pose(0, 1.92, -0.06, rx=-0.25), OCRE, segments=5)
    c.boite(0.4, 0.09, 0.14, pose(0, 1.5, 0.26), ENCRE, biseau=0.03)  # la fente
    for s in (-1, 1):
        c.sphere(1.0, pose(s * 0.09, 1.5, 0.32, s=0.035), BLANC, segments=6, anneaux=4)
        c.sphere(1.0, pose(s * 0.55, 1.13, 0.02, s=(0.22, 0.18, 0.24)), ARDOISE_CLAIRE, ARDOISE_CLAIRE, BORD, segments=10, anneaux=6)  # épaulière
        c.cone(0.12, 0.1, 0.5, pose(s * 0.6, 0.82, 0.12, rx=-0.4), ARDOISE, segments=7)  # le bras
        c.sphere(0.14, pose(s * 0.6, 0.58, 0.28), BORD, segments=8, anneaux=6)  # le poing
    m.poser(c)

    b = Piece("bouclier", 562)
    b.cone(0.7, 0.7, 0.12, pose(0, 0, 0, rx=math.pi / 2), BORD, segments=16)
    b.cone(0.6, 0.56, 0.16, pose(0, 0, 0.03, rx=math.pi / 2), ACIER, ACIER_CLAIR, segments=16)
    b.sphere(1.0, pose(0, 0, 0.12, s=(0.17, 0.17, 0.12)), OCRE, 0xF6C860, segments=10, anneaux=6)  # l'umbo
    b.boite(0.1, 0.9, 0.06, pose(0, 0, 0.12), BORD)
    b.boite(0.9, 0.1, 0.06, pose(0, 0, 0.12), BORD)
    for k in range(8):
        a = k / 8 * 2 * math.pi + math.pi / 8
        b.boite(0.06, 0.06, 0.04, pose(math.sin(a) * 0.64, math.cos(a) * 0.64, 0.07, rz=-a), ACIER_CLAIR)  # les rivets
    m.poser(b)
    return m
