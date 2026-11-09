# Le CRACHEUR (lot BR-A1) : un crapaud orangé trapu, une LARGE bouche sombre devant (le projectile s'y prépare), deux yeux sur tiges, trois piquants au dos, un ventre clair, quatre petites pattes. Tas instancié : `corps`.
# Empreinte : ~0,44 m de rayon pour une collision de 0,40 m.
from commun import BLANC, ENCRE, Modele, Piece, pose

ORANGE = 0xB5651D
ORANGE_CLAIR = 0xF0A860
ORANGE_SOMBRE = 0x8A4A14
ORANGE_DESSUS = 0xCC7428  # le dos vu d'en haut : à peine plus clair (le ventre clair se verrait trop : ΔE < 40 sur la prairie)
BOUCHE = 0x3A1A0C
LANGUE = 0xD9775A


def construire():
    m = Modele("cracheur")
    c = Piece("corps", 531)
    c.sphere(1.0, pose(0, 0.4, -0.02, s=(0.44, 0.38, 0.44)), ORANGE, ORANGE_DESSUS, ORANGE_SOMBRE, segments=14, anneaux=9)
    c.sphere(1.0, pose(0, 0.3, 0.14, s=(0.32, 0.24, 0.28)), ORANGE_CLAIR, segments=10, anneaux=6)  # le ventre
    c.sphere(1.0, pose(0, 0.38, 0.36, s=(0.28, 0.11, 0.12)), BOUCHE, segments=12, anneaux=6)  # la bouche
    c.sphere(1.0, pose(0, 0.43, 0.37, s=(0.3, 0.05, 0.11)), ORANGE_SOMBRE, segments=10, anneaux=4)  # la lèvre
    c.sphere(1.0, pose(0, 0.34, 0.4, s=(0.12, 0.04, 0.06)), LANGUE, segments=6, anneaux=4)
    for s in (-1, 1):
        c.cone(0.06, 0.045, 0.3, pose(s * 0.2, 0.8, 0.08, rz=-s * 0.12), ORANGE, ORANGE_CLAIR, segments=6)
        c.sphere(0.14, pose(s * 0.22, 0.98, 0.1), BLANC, segments=10, anneaux=7)
        c.sphere(1.0, pose(s * 0.22, 0.98, 0.22, s=(0.07, 0.085, 0.04)), ENCRE, segments=6, anneaux=4)
        c.sphere(1.0, pose(s * 0.34, 0.1, 0.22, s=(0.13, 0.08, 0.16)), ORANGE_SOMBRE, segments=6, anneaux=4)  # pattes avant
        c.sphere(1.0, pose(s * 0.38, 0.1, -0.25, s=(0.15, 0.09, 0.2)), ORANGE_SOMBRE, segments=6, anneaux=4)  # pattes arrière
    for (x, z, r) in ((0, -0.32, 0.08), (-0.22, -0.22, 0.065), (0.22, -0.22, 0.065), (0, -0.08, 0.06)):
        c.cone(r, 0.0, 0.26, pose(x, 0.74, z, rx=-0.55), ORANGE_CLAIR, 0xFFD4A0, segments=5)
    m.poser(c)
    return m
