# Le GÉLATON (lot BR-A1) : une petite gelée BLEUE en goutte (une pointe au sommet : sa silhouette n'est pas celle de la gelée), deux yeux. Tas instancié, jusqu'à 96 à l'écran : peu de triangles.
# Empreinte : ~0,35 m pour une collision de 0,30 m. Le code ne lui applique plus l'échelle 0,62 de l'ancienne forme : il est dessiné à sa taille.
from commun import Modele, Piece, pose
from gelee import yeux

BLEU = 0x3F8FE0
BLEU_CLAIR = 0x7DB6F0  # tour 2 : un dessus moins pâle (le gélaton paraissait gris vu d'en haut)
BLEU_SOMBRE = 0x2A66B0


def construire():
    m = Modele("gelaton")
    c = Piece("corps", 511)
    c.tour([(0.0, 0.0), (0.33, 0.0), (0.35, 0.05), (0.34, 0.14), (0.28, 0.26), (0.17, 0.36), (0.07, 0.45), (0.0, 0.52)], None, BLEU, BLEU_CLAIR, BLEU_SOMBRE, segments=14, ondes=(6, 0.05, 0.1))
    c.sphere(1.0, pose(-0.11, 0.3, 0.15, rx=0.5, rz=0.5, s=(0.07, 0.02, 0.05)), 0xEAF6FF, segments=6, anneaux=4)
    yeux(c, 0.12, 0.2, 0.27, 0.06)
    m.poser(c)
    return m
