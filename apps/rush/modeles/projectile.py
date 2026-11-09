# Le PROJECTILE du cracheur (lot BR-A1) : une boule de crachat orange vif, bosselée, au cœur plus clair, avec deux gouttes qui la suivent (vers −z). Dessinée au RAYON 1 : le code la met à l'échelle de sa collision
# (0,26 m ; un élite plus gros) et l'allume (un aplat lumineux : c'est un danger qui avance).
from commun import Modele, Piece, pose

ORANGE = 0xFF7A3C
CLAIR = 0xFFC080
SOMBRE = 0xD9541E


def construire():
    m = Modele("projectile")
    c = Piece("corps", 581)
    c.ico(1.0, None, ORANGE, CLAIR, SOMBRE, subdiv=2, bruit=0.08, lisse=True, graine=581)
    c.sphere(1.0, pose(-0.28, 0.32, 0.5, s=(0.32, 0.26, 0.2)), CLAIR, segments=8, anneaux=5)
    c.sphere(0.42, pose(0.2, -0.1, -1.1), ORANGE, CLAIR, SOMBRE, segments=8, anneaux=5)
    c.sphere(0.24, pose(-0.15, 0.08, -1.65), SOMBRE, ORANGE, segments=6, anneaux=4)
    m.poser(c)
    return m
