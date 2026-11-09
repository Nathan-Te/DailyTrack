# La GELÉE (lot BR-A1) : un dôme vert brillant posé au sol, au bord qui coule en festons, un reflet, deux yeux ronds devant. Un TAS instancié (`ennemisVue.ts`) : une seule pièce `corps`, origine aux pieds, l'avant vers +z.
# Empreinte : ~0,56 m de rayon pour une collision de 0,48 m (`RAYON_GELEE`). Couleur : voir `VERT`.
from commun import BLANC, ENCRE, Modele, Piece, pose

# un vert menthe un peu plus soutenu que celui de la palette (0x6FD1A0) : sur le sous-bois (sol vert-jaune), l'ancien n'avait que ΔE 29 ; celui-ci a ΔE ≥ 40 sur les six tons de sol
VERT = 0x35B09A
VERT_CLAIR = 0x8FE0C4
VERT_SOMBRE = 0x23806C


def dome(c, r, h, couleur, claire, sombre, segments=20, ondes=7):
    c.tour([(0.0, 0.0), (r * 0.94, 0.0), (r, h * 0.12), (r * 0.98, h * 0.34), (r * 0.86, h * 0.62), (r * 0.62, h * 0.86), (r * 0.32, h * 0.98), (0.0, h)], None, couleur, claire, sombre, segments=segments, ondes=(ondes, 0.04, h * 0.3))
    c.sphere(1.0, pose(-r * 0.38, h * 0.82, r * 0.3, rx=0.5, rz=0.45, s=(r * 0.24, r * 0.06, r * 0.16)), 0xF2FFF8, segments=8, anneaux=5)


def yeux(c, ecart, y, z, r):
    for s in (-1, 1):
        c.sphere(1.0, pose(s * ecart, y, z, s=(r, r * 1.15, r * 0.7)), BLANC, segments=8, anneaux=6)
        c.sphere(1.0, pose(s * ecart * 0.96, y - r * 0.12, z + r * 0.5, s=(r * 0.52, r * 0.62, r * 0.3)), ENCRE, segments=6, anneaux=4)


def construire():
    m = Modele("gelee")
    c = Piece("corps", 501)
    dome(c, 0.57, 0.54, VERT, VERT_CLAIR, VERT_SOMBRE)
    yeux(c, 0.18, 0.3, 0.47, 0.085)
    m.poser(c)
    return m
