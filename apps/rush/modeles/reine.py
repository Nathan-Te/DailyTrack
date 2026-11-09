# La REINE GELÉE (lot BR-A1) : une GROSSE gelée bleue en dôme (2 m de rayon, 2,2 m de haut : sa collision), au bord qui coule en festons, un reflet brillant, des bulles prises dans la gelée, une couronne d'or à cinq pointes
# et ses joyaux (jamais rouges : le rouge est le danger), de grands yeux. Pièces et pivots = `creerReine` (`bosses.ts`) : `corps` (0, 0, 0), `couronne` (0, 1,9, 0,2), `yeux` (0, 1,1, 1,58).
import math

from commun import BLANC, ENCRE, Modele, Piece, pose

BLEU = 0x2F78B8
BLEU_CLAIR = 0x7DB8E6
BLEU_SOMBRE = 0x1F5A8E
OR = 0xE8B23A
OR_CLAIR = 0xF6CC62
OR_SOMBRE = 0xB9822A
JOYAU = 0x7FE3E8
JOYAU_VIOLET = 0xB48EE6


def construire():
    m = Modele("reine")
    c = Piece("corps", 101)
    # le dôme : un profil de gelée (large en bas, épaule ronde, sommet aplati), un bord en festons
    profil = [(0.0, 0.0), (1.86, 0.0), (2.0, 0.18), (2.0, 0.55), (1.9, 1.0), (1.68, 1.45), (1.32, 1.85), (0.82, 2.12), (0.0, 2.22)]
    c.tour(profil, None, BLEU, BLEU_CLAIR, BLEU_SOMBRE, segments=28, ondes=(9, 0.035, 0.6))
    # le reflet : une tache claire en haut à gauche, et un petit point blanc
    c.sphere(1.0, pose(-0.75, 1.88, 0.62, rx=0.5, rz=0.45, s=(0.42, 0.1, 0.3)), 0xCDE9FF, segments=12, anneaux=6)
    c.sphere(0.09, pose(-0.42, 2.02, 0.68), BLANC, segments=8, anneaux=5)
    # des bulles à fleur de gelée (des disques plus clairs)
    for (x, y, z, r) in ((1.2, 0.9, 1.25, 0.16), (-1.45, 0.6, 1.2, 0.12), (1.55, 1.25, -0.4, 0.14), (0.4, 0.45, 1.88, 0.1), (-1.1, 1.4, -1.0, 0.15)):
        n = math.sqrt(x * x + z * z)
        c.sphere(r, pose(x, y, z, ry=math.atan2(x, z), s=(1.0, 1.0, 0.35)), BLEU_CLAIR, segments=8, anneaux=5)
    m.poser(c, (0.0, 0.0, 0.0))

    o = Piece("couronne", 102)
    o.tour([(0.86, 0.0), (0.92, 0.05), (0.92, 0.26), (0.86, 0.32), (0.78, 0.32), (0.78, 0.0)], pose(0, -0.15, 0), OR, OR_CLAIR, OR_SOMBRE, segments=20, lisse=False)
    for i in range(5):
        a = i / 5 * 2 * math.pi
        o.cone(0.2, 0.02, 0.6, pose(math.sin(a) * 0.84, 0.42, math.cos(a) * 0.84, rx=math.cos(a) * 0.12, rz=-math.sin(a) * 0.12), OR, OR_CLAIR, segments=5, biseau=0.0)
        o.sphere(0.08, pose(math.sin(a) * 0.86, 0.75, math.cos(a) * 0.86), OR_CLAIR, segments=8, anneaux=5)
        o.sphere(0.11, pose(math.sin(a + 0.63) * 0.93, 0.02, math.cos(a + 0.63) * 0.93, s=(1.0, 1.0, 0.6), ry=a + 0.63), JOYAU if i % 2 == 0 else JOYAU_VIOLET, segments=8, anneaux=5)
    m.poser(o, (0.0, 1.9, 0.2))

    y = Piece("yeux", 103)
    for s in (-1, 1):
        y.sphere(1.0, pose(s * 0.72, 0, 0, s=(0.33, 0.4, 0.3)), BLANC, segments=12, anneaux=8)
        y.sphere(1.0, pose(s * 0.68, -0.04, 0.24, s=(0.19, 0.24, 0.12)), ENCRE, segments=10, anneaux=6)
        y.sphere(0.06, pose(s * 0.62, 0.06, 0.33), BLANC, segments=6, anneaux=4)
        # un sourcil royal : une petite virgule sombre qui monte vers l'extérieur
        y.boite(0.42, 0.07, 0.08, pose(s * 0.74, 0.47, 0.18, rz=-s * 0.25), BLEU_SOMBRE, biseau=0.02)
    m.poser(y, (0.0, 1.1, 1.58))
    return m
