# La COURONNE d'un élite (lot BR-A1) : un anneau d'or à cinq pointes et des pierres claires (jamais de rouge : le rouge est le danger). Une pièce à part, posée au-dessus du monstre (`marquerElite`) : n'importe quel
# monstre devient un élite avec elle, son halo d'or au sol et l'échelle ×1,5 du code. Tas instancié : `corps`.
import math

from commun import Modele, Piece, pose

OR = 0xFFC93C
OR_CLAIR = 0xFFE58A
OR_SOMBRE = 0xC9922A
PIERRE = 0x9FE6FF


def construire():
    m = Modele("couronne")
    c = Piece("corps", 571)
    c.tour([(0.3, -0.06), (0.33, -0.04), (0.33, 0.05), (0.3, 0.07), (0.26, 0.07), (0.26, -0.06)], None, OR, OR_CLAIR, OR_SOMBRE, segments=16, lisse=False)
    for k in range(5):
        a = k / 5 * 2 * math.pi
        c.cone(0.08, 0.0, 0.26, pose(math.sin(a) * 0.3, 0.19, math.cos(a) * 0.3), OR, OR_CLAIR, segments=4)
        c.sphere(0.035, pose(math.sin(a) * 0.3, 0.33, math.cos(a) * 0.3), OR_CLAIR, segments=6, anneaux=4)
        b = a + math.pi / 5
        c.sphere(1.0, pose(math.sin(b) * 0.335, 0.0, math.cos(b) * 0.335, ry=b, s=(0.045, 0.045, 0.025)), PIERRE, segments=6, anneaux=4)
    m.poser(c)
    return m
