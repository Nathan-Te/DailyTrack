# Le TONNEAU (lot BR-A1) : un tonneau de bois aux douelles marquées, deux cercles de fer sombre, un couvercle. Collision 0,38 m (`RAYON_VASE`) ; ~0,8 m de haut. Tas instancié : `corps`.
# Ses ÉCLATS : `eclat_1` … `eclat_3` (des douelles) et `eclat_4` (un morceau de cercle), chacun à sa place sur le tonneau (son origine).
import math

from commun import Modele, Piece, pose

BOIS = 0xB07A43
BOIS_CLAIR = 0xD9A65F
BOIS_SOMBRE = 0x7C5230
FER = 0x3B2A1D


def construire():
    m = Modele("tonneau")
    c = Piece("corps", 621)
    prof = [(0.0, 0.0), (0.28, 0.0), (0.35, 0.2), (0.38, 0.4), (0.35, 0.6), (0.28, 0.8), (0.0, 0.8)]
    c.tour(prof, None, BOIS, BOIS_CLAIR, BOIS_SOMBRE, segments=10, lisse=False)
    for y, r in ((0.17, 0.352), (0.63, 0.352)):
        c.tour([(r - 0.01, -0.04), (r + 0.025, 0.0), (r - 0.01, 0.04)], pose(0, y, 0), FER, segments=10, lisse=False)
    for k in range(4):
        a = (k + 0.5) / 4 * 2 * math.pi
        c.boite(0.02, 0.5, 0.02, pose(math.sin(a) * 0.379, 0.4, math.cos(a) * 0.379, ry=a), BOIS_SOMBRE)  # les joints des douelles
    m.poser(c)
    for i, a in enumerate((0.4, 2.5, 4.4)):
        e = Piece(f"eclat_{i + 1}", 630 + i)
        # la douelle regarde vers l'extérieur (tournée de son angle autour de y)
        e.boite(0.2, 0.62, 0.05, pose(0, 0, 0, ry=a, rz=0.04 * (i - 1)), BOIS if i != 1 else BOIS_CLAIR, BOIS_CLAIR)
        e.boite(0.21, 0.06, 0.06, pose(math.sin(a) * 0.01, 0.18, math.cos(a) * 0.01, ry=a), FER)
        m.poser(e, (math.sin(a) * 0.36, 0.4, math.cos(a) * 0.36))
    e = Piece("eclat_4", 634)
    e.tube([(math.sin(t) * 0.35 - math.sin(1.4) * 0.35, 0.0, math.cos(t) * 0.35 - math.cos(1.4) * 0.35) for t in (0.9, 1.4, 1.9)], [0.025, 0.025, 0.025], None, FER, segments=4, lisse=False)
    m.poser(e, (math.sin(1.4) * 0.35, 0.63, math.cos(1.4) * 0.35))
    return m
