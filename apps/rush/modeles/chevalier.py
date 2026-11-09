# Le CHEVALIER (lot BR-A1) : chibi — un gros casque rond à fente où brillent deux yeux, une plume rouge, un petit corps en armure jaune, une grande épée lisible depuis la caméra du jeu, un petit bouclier rond.
# Repère : celui de la racine AVANT son échelle (`creerChevalier` la met à 0,88 : ~1,7 m). Pièces et pivots = les groupes de `acteurs.ts` : `corps` (0, 0,4, 0), `tete` (0, 0,95, −0,16), `yeux` (0, 0,97, 0,26), `plume`
# (0, 1,24, −0,3), `arme` (la main : 0,4, 0,5, 0,12 ; la lame vers +z), `bouclier` (−0,34, 0,45, 0,1), `pied_g` / `pied_d` (∓0,15, 0,1, 0).
import math

from commun import BLANC, ENCRE, Modele, Piece, pose

ARMURE = 0xE8B23A
ARMURE_CLAIRE = 0xF6CC62
ARMURE_SOMBRE = 0xB9822A
ACIER = 0xEDE7DA
ACIER_SOMBRE = 0xB9B3A6
CUIR = 0x6B3F22
CUIR_SOMBRE = 0x4A2A16
PLUME = 0xC2401F
PLUME_CLAIRE = 0xE0603A
OR = 0xF0C24A


def construire():
    m = Modele("chevalier")

    # Le corps : un tonnelet d'armure jaune (plus large que haut), une ceinture de cuir, un plastron plus clair, deux petites épaulières et deux bras courts (la main de l'épée est dans l'arme).
    c = Piece("corps", 5)
    c.tour([(0.0, -0.3), (0.36, -0.3), (0.43, -0.2), (0.46, -0.04), (0.44, 0.12), (0.36, 0.24), (0.2, 0.3), (0.0, 0.31)], pose(s=(1.0, 1.0, 0.82)), ARMURE, ARMURE_CLAIRE, ARMURE_SOMBRE, segments=12, lisse=False)
    c.tour([(0.455, -0.17), (0.465, -0.08)], pose(s=(1.0, 1.0, 0.82)), CUIR, segments=12, lisse=False)
    c.tour([(0.0, -0.17), (0.452, -0.17)], pose(s=(1.0, 1.0, 0.82)), CUIR_SOMBRE, segments=12)
    c.boite(0.16, 0.12, 0.06, pose(0, -0.125, 0.39), OR, biseau=0.02)  # la boucle
    c.sphere(0.2, pose(0, 0.06, 0.2, s=(1.25, 0.95, 0.6)), ARMURE_CLAIRE, ARMURE_CLAIRE, segments=12, anneaux=8)  # le plastron
    for s in (-1, 1):
        c.sphere(0.17, pose(s * 0.4, 0.17, -0.02, s=(1.0, 0.75, 1.0)), ARMURE, ARMURE_CLAIRE, ARMURE_SOMBRE, segments=10, anneaux=7)  # épaulière
        c.cone(0.09, 0.075, 0.26, pose(s * 0.44, -0.04, 0.06, rz=s * 0.35, rx=-0.3), ACIER, ACIER, segments=8, lisse=True)  # le bras court
    m.poser(c, (0.0, 0.4, 0.0))

    # Le casque : une grande sphère d'acier crème un peu aplatie (le gros crâne chibi de la cible), une FENTE sombre et fine en travers du visage (les yeux de la pièce `yeux` y brillent), deux rivets dorés. Tour 2 : ni crête
    # dorée ni rebord sombre (ils chargeaient la tête vue d'en haut) ; la fente est plus fine (elle faisait des lunettes).
    t = Piece("tete", 7)
    t.sphere(0.38, pose(0, 0.0, 0.0, s=(1.0, 0.95, 1.0)), ACIER, BLANC, ACIER_SOMBRE, segments=20, anneaux=12)
    t.sphere(0.1, pose(0, 0.02, 0.32, s=(2.6, 0.62, 0.7)), ENCRE, segments=14, anneaux=7)  # la fente
    for s in (-1, 1):
        t.sphere(0.04, pose(s * 0.33, -0.08, 0.16), OR, segments=8, anneaux=5)  # les rivets
    m.poser(t, (0.0, 0.95, -0.16))

    # Les yeux : deux ovales blancs et leurs pupilles, en un maillage (aplat sans lumière : `fermer` les cligne). Ils brillent dans la fente, un peu plus grands qu'elle (on les voit de loin).
    y = Piece("yeux", 3)
    for s in (-1, 1):
        y.sphere(1.0, pose(s * 0.115, 0.0, -0.03, s=(0.06, 0.075, 0.04)), BLANC, segments=8, anneaux=5)
        y.sphere(1.0, pose(s * 0.11, -0.005, 0.0, s=(0.032, 0.046, 0.02)), ENCRE, segments=6, anneaux=4)
    m.poser(y, (0.0, 0.97, 0.26))

    # La plume : une CRÊTE rouge en lame (une nageoire posée d'avant en arrière), comme la cible ; le groupe la balance.
    p = Piece("plume", 11)
    p.sphere(0.07, pose(0, 0.0, 0.02), PLUME, segments=8, anneaux=6)
    p.plaque([(0.0, -0.2), (0.16, -0.12), (0.34, 0.06), (0.4, 0.22), (0.3, 0.26), (0.12, 0.16), (0.0, 0.12)], 0.09, pose(0.045, 0.0, 0.0, rz=1.5708), PLUME, PLUME_CLAIRE, biseau=0.025)
    m.poser(p, (0.0, 1.24, -0.3))

    # L'épée : la main gantée, une garde dorée, une poignée de cuir et une LONGUE lame large et claire, la pointe en biseau ; tout pivote autour de la main. Tour 2 : sans gorge sombre (vue d'en haut, elle en faisait une règle).
    e = Piece("arme", 13)
    e.sphere(0.13, pose(0, 0, 0), ARMURE, ARMURE_CLAIRE, ARMURE_SOMBRE, segments=10, anneaux=7)
    e.cone(0.04, 0.04, 0.24, pose(0, 0, -0.02, rx=math.pi / 2), CUIR, segments=6)
    e.sphere(0.065, pose(0, 0, -0.15), OR, segments=8, anneaux=6)
    e.boite(0.46, 0.1, 0.12, pose(0, 0, 0.15), OR, OR, biseau=0.035)
    e.boite(0.24, 0.07, 0.98, pose(0, 0, 0.7), ACIER, BLANC, ACIER_SOMBRE, biseau=0.03)
    e.cone(0.12, 0.0, 0.2, pose(0, 0, 1.28, rx=math.pi / 2, s=(1.0, 1.0, 0.3)), ACIER, BLANC, segments=8)
    m.poser(e, (0.4, 0.5, 0.12))

    # Le bouclier : un petit écu rond de profil (son plan regarde −x), de bois brun cerclé de jaune (celui de la cible), un umbo d'acier.
    b = Piece("bouclier", 17)
    b.cone(0.25, 0.25, 0.07, pose(0, 0, 0, rz=math.pi / 2), ARMURE_SOMBRE, segments=16)
    b.cone(0.21, 0.19, 0.09, pose(-0.01, 0, 0, rz=math.pi / 2), 0x9A5A2E, 0xB87440, segments=16)
    b.sphere(0.08, pose(-0.06, 0, 0, s=(0.6, 1, 1)), ACIER, segments=8, anneaux=6)
    m.poser(b, (-0.34, 0.45, 0.1))

    # Les pieds : deux bottes de cuir arrondies, plus longues que larges (le groupe les fait marcher).
    for nom, s in (("pied_g", -1), ("pied_d", 1)):
        f = Piece(nom, 19 + s)
        f.sphere(0.15, pose(0, 0.0, 0.04, s=(0.95, 0.7, 1.35)), CUIR, CUIR, CUIR_SOMBRE, segments=10, anneaux=7)
        f.boite(0.26, 0.04, 0.38, pose(0, -0.085, 0.04), CUIR_SOMBRE, biseau=0.015)
        m.poser(f, (s * 0.15, 0.1, 0.0))
    return m
