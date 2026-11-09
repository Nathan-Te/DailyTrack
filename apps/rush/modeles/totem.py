# Le TOTEM (lot BR-A1) : un socle de pierre taillée, un fût de bois aux bandes ocre, un GRAND VISAGE sarcelle aux yeux clairs et à la bouche dentée, deux cornes ocre ; la lueur violette du code brille au sommet
# (2,45 m). Tas instancié : `corps`. Empreinte : ~0,55 m pour une collision de 0,55 m.
from commun import ENCRE, Modele, Piece, pose

PIERRE = 0x6B5B4A
PIERRE_CLAIRE = 0x8A7A68
BOIS = 0x5B3A22
BOIS_CLAIR = 0x7A5232
OCRE = 0xE0A030
SARCELLE = 0x1F8A82
SARCELLE_CLAIRE = 0x3FB0A6
CREME = 0xF4F1E0


def construire():
    m = Modele("totem")
    c = Piece("corps", 551)
    c.roche(1.08, 0.42, 1.08, pose(0, 0.21, 0), PIERRE, PIERRE_CLAIRE, 0x4A3E32, coupes=6, profondeur=(0.1, 0.25), biseau=0.05, graine=551)
    c.tour([(0.38, 0.0), (0.4, 0.3), (0.36, 0.95), (0.38, 1.05)], pose(0, 0.38, 0), BOIS, BOIS_CLAIR, segments=10, lisse=False)
    for y in (0.62, 1.1):
        c.tour([(0.41, -0.06), (0.45, -0.03), (0.45, 0.03), (0.41, 0.06)], pose(0, y, 0), OCRE, 0xF6C860, segments=10, lisse=False)
    # le visage : un gros bloc sarcelle biseauté, deux yeux, une bouche aux dents carrées, des sourcils ocre
    c.boite(0.92, 0.66, 0.86, pose(0, 1.75, 0), SARCELLE, SARCELLE_CLAIRE, 0x14625C, biseau=0.08)
    c.boite(0.5, 0.16, 0.12, pose(0, 1.56, 0.42), ENCRE, biseau=0.03)
    for k in (-1, 0, 1):
        c.boite(0.1, 0.07, 0.05, pose(k * 0.14, 1.61, 0.47), CREME)
    for s in (-1, 1):
        c.sphere(1.0, pose(s * 0.22, 1.86, 0.43, s=(0.11, 0.11, 0.05)), CREME, segments=8, anneaux=5)
        c.sphere(1.0, pose(s * 0.22, 1.85, 0.47, s=(0.05, 0.055, 0.02)), ENCRE, segments=6, anneaux=4)
        c.boite(0.3, 0.07, 0.08, pose(s * 0.22, 2.0, 0.44, rz=s * 0.25), OCRE, biseau=0.02)
        c.cone(0.13, 0.0, 0.55, pose(s * 0.4, 2.2, 0, rz=-s * 0.55), OCRE, 0xF6C860, segments=6)
    c.tour([(0.2, 0.0), (0.22, 0.06), (0.16, 0.14), (0.0, 0.16)], pose(0, 2.08, 0), SARCELLE_CLAIRE, segments=8, lisse=False)  # la coupe de la lueur
    m.poser(c)
    return m
