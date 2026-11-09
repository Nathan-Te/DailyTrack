# Le BOUCLIER LANCÉ (compétence du chevalier, lot BR-A1) : un disque d'acier clair à plat, cerclé d'or, un umbo et une étoile dorés (jamais de rouge : c'est au joueur). Il file à plat en tournant (`BouclierVu`).
# Pièce `corps`, centrée, à plat (axe y). Rayon 0,5 m (la largeur du bouclier dans la simulation : 0,6 m).
import math

from commun import Modele, Piece, pose

ACIER = 0xCFE8FF
ACIER_SOMBRE = 0x9AB4CC
OR = 0xE8B23A
OR_CLAIR = 0xF6CC62


def construire():
    m = Modele("bouclier")
    c = Piece("corps", 591)
    c.tour([(0.0, -0.05), (0.44, -0.05), (0.44, 0.05), (0.0, 0.07)], None, ACIER, 0xF0F8FF, ACIER_SOMBRE, segments=20, lisse=False)
    c.tour([(0.43, -0.06), (0.52, -0.05), (0.54, 0.0), (0.52, 0.06), (0.43, 0.07)], None, OR, OR_CLAIR, segments=20, lisse=False)
    c.sphere(1.0, pose(0, 0.07, 0, s=(0.17, 0.09, 0.17)), OR, OR_CLAIR, segments=10, anneaux=6)
    for k in range(4):
        a = k / 4 * 2 * math.pi
        c.boite(0.07, 0.03, 0.3, pose(math.sin(a) * 0.27, 0.075, math.cos(a) * 0.27, ry=a), OR, OR_CLAIR)
    m.poser(c)
    return m
