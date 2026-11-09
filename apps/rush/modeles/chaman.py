# Le CHAMAN (lot BR-A1) : une robe vert-de-gris en cloche, une capuche pointue rabattue, un visage d'ombre aux yeux jaunes, un collier de perles ocre, un bâton noueux à plumes (l'orbe du code flotte en haut :
# 0,44, 1,72, 0,12). Tas instancié : `corps`. Empreinte : ~0,44 m pour une collision de 0,40 m.
import math

from commun import Modele, Piece, pose

ROBE = 0x14746F
ROBE_CLAIRE = 0x2A928A
SOMBRE = 0x0D4F4B
OMBRE = 0x0A1412
YEUX = 0xFFE27A
BOIS = 0x5B3A22
OCRE = 0xE0A030
PLUME = 0xF4F1E0


def construire():
    m = Modele("chaman")
    c = Piece("corps", 541)
    c.tour([(0.0, 0.0), (0.44, 0.0), (0.42, 0.12), (0.34, 0.45), (0.25, 0.78), (0.2, 0.92), (0.0, 0.95)], None, ROBE, ROBE_CLAIRE, SOMBRE, segments=14, lisse=False, ondes=(5, 0.06, 0.2))
    c.boite(0.5, 0.08, 0.36, pose(0, 0.62, 0.12), OCRE, biseau=0.02)  # la ceinture
    c.sphere(1.0, pose(0, 1.08, 0, s=(0.3, 0.29, 0.31)), SOMBRE, ROBE, segments=12, anneaux=8)  # la capuche
    c.cone(0.21, 0.0, 0.42, pose(0, 1.42, -0.12, rx=-0.55), SOMBRE, ROBE, segments=7)
    c.sphere(1.0, pose(0, 1.05, 0.17, s=(0.18, 0.17, 0.12)), OMBRE, segments=10, anneaux=6)  # le visage d'ombre
    for s in (-1, 1):
        c.sphere(1.0, pose(s * 0.075, 1.07, 0.27, s=(0.045, 0.035, 0.02)), YEUX, segments=6, anneaux=4)
        c.sphere(0.1, pose(s * 0.3, 0.72, 0.1, s=(1.0, 1.2, 1.0)), SOMBRE, segments=8, anneaux=5)  # les manches
    for i in range(7):
        a = (i - 3) * 0.32
        c.sphere(0.045, pose(math.sin(a) * 0.22, 0.86 - abs(i - 3) * 0.015, math.cos(a) * 0.22 + 0.02), OCRE, segments=6, anneaux=4)  # le collier
    # le bâton : un fût noueux, un anneau ocre qui tient l'orbe, deux plumes
    c.tube([(0.44, 0.0, 0.12), (0.42, 0.6, 0.14), (0.45, 1.2, 0.11), (0.44, 1.56, 0.12)], [0.04, 0.045, 0.04, 0.05], None, BOIS, 0x7A5232, segments=6, lisse=False)
    c.tour([(0.12, -0.03), (0.15, 0.0), (0.15, 0.04), (0.12, 0.07)], pose(0.44, 1.56, 0.12), OCRE, segments=10, lisse=False)
    for s in (-1, 1):
        c.sphere(1.0, pose(0.44 + s * 0.08, 1.4, 0.16, rz=s * 0.5, s=(0.03, 0.12, 0.02)), PLUME, segments=6, anneaux=4)
    m.poser(c)
    return m
