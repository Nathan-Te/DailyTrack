# La CHAUVE-SOURIS (lot BR-A1) : un corps rond violet, deux grandes oreilles, deux crocs, de petites pattes ; de LARGES ailes à trois doigts, la membrane festonnée. Tas instanciés : `corps`, `yeux` (un tas à part : ils
# rougissent à l'annonce du plongeon), `ailes_g` / `ailes_d` (pivots aux épaules : ∓0,22, 0,05, 0, comme `pivotAile`). L'origine est le centre du corps (le code le pose à la hauteur du vol).
# Empreinte : le corps fait ~0,32 m de rayon pour une collision de 0,36 m (elle vole : les ailes dépassent).
from commun import BLANC, ENCRE, Modele, Piece, pose

VIOLET = 0x7A4FB5
VIOLET_CLAIR = 0xB48EE6
VIOLET_SOMBRE = 0x553582
ROSE = 0xD99AD6


def construire():
    m = Modele("chauve-souris")
    c = Piece("corps", 521)
    c.sphere(1.0, pose(0, 0, 0, s=(0.32, 0.3, 0.3)), VIOLET, VIOLET_CLAIR, VIOLET_SOMBRE, segments=12, anneaux=8)
    c.sphere(1.0, pose(0, -0.06, 0.12, s=(0.2, 0.18, 0.18)), VIOLET_CLAIR, segments=8, anneaux=6)  # le ventre
    for s in (-1, 1):
        c.cone(0.11, 0.0, 0.3, pose(s * 0.16, 0.32, -0.02, rz=-s * 0.3), VIOLET, VIOLET_CLAIR, segments=4)
        c.cone(0.06, 0.0, 0.16, pose(s * 0.155, 0.3, 0.02, rz=-s * 0.3), ROSE, segments=4)  # l'intérieur de l'oreille
        c.cone(0.03, 0.0, 0.09, pose(s * 0.06, -0.07, 0.27, rx=3.14), BLANC, segments=4)  # les crocs
        c.cone(0.04, 0.02, 0.14, pose(s * 0.1, -0.31, 0.0), VIOLET_SOMBRE, segments=4)  # les pattes
    m.poser(c)

    y = Piece("yeux", 522)
    for s in (-1, 1):
        y.sphere(1.0, pose(s * 0.11, 0.06, 0.24, s=0.075), BLANC, segments=8, anneaux=6)
        y.sphere(1.0, pose(s * 0.105, 0.05, 0.29, s=0.04), ENCRE, segments=6, anneaux=4)
    m.poser(y)

    for nom, s in (("ailes_g", -1), ("ailes_d", 1)):
        a = Piece(nom, 523 + s)
        e = 0.86
        pts = [(0.04, 0.2), (0.42, 0.4), (0.9, 0.34), (1.18, 0.1), (0.98, -0.04), (1.0, -0.3), (0.76, -0.16), (0.74, -0.5), (0.46, -0.24), (0.2, -0.46), (0.04, -0.26)]
        a.plaque([(x * e * s, z * e) for (x, z) in (pts if s > 0 else list(reversed(pts)))], 0.035, pose(0, 0.0, 0), VIOLET_CLAIR, VIOLET_CLAIR, VIOLET)
        for (x, z) in ((1.18, 0.1), (1.0, -0.3), (0.74, -0.5)):
            a.tube([(0.04 * s, -0.01, 0.0), (x * e * s, -0.01, z * e)], [0.04, 0.02], None, VIOLET_SOMBRE, VIOLET, segments=4, lisse=False)
        a.cone(0.035, 0.0, 0.12, pose(0.46 * e * s, 0.03, 0.44 * e, rx=-0.4), VIOLET_SOMBRE, segments=4)  # la griffe du pouce
        m.poser(a, (s * 0.22, 0.05, 0.0))
    return m
