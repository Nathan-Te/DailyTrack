# Le GRAND-DUC (lot BR-A1) : une grande chouette bleu nuit, un ventre crème écaillé, une grosse tête aux aigrettes, deux disques faciaux crème autour de grands yeux jaunes (ils brillent : le code les teinte), un bec d'or,
# des serres, de larges ailes en rémiges étagées. Pièces et pivots = `creerDuc` (`bosses.ts`) : `corps` (0, 0, 0), `tete` (0, 2,7, 0,15), `yeux` (0, 0,02, 0,86 dans la tête), `ailes_g` / `ailes_d` (∓0,85, 2,6, 0 ;
# le code ne les met plus à l'échelle 0,82 : elles sont dessinées à leur taille).
from commun import BLANC, ENCRE, Modele, Piece, pose

BLEU = 0x3A4A72
BLEU_DESSUS = 0x5A6C9C
SOMBRE = 0x252F4D
CREME = 0xD9D0B8
CREME_CLAIRE = 0xEEE6D0
BEC = 0xE0A030
AILE = 0x4A5C8C
AILE_CLAIRE = 0x6A7CAC


def construire():
    m = Modele("grand-duc")
    c = Piece("corps", 201)
    c.sphere(1.0, pose(0, 1.7, 0, s=(0.98, 1.08, 0.88)), BLEU, BLEU_DESSUS, SOMBRE, segments=16, anneaux=10)
    c.sphere(1.0, pose(0, 1.5, 0.42, s=(0.66, 0.82, 0.42)), CREME, CREME_CLAIRE, segments=14, anneaux=9)
    # les écailles du ventre : trois rangées de petits chevrons sombres
    for k, y in enumerate((1.95, 1.6, 1.25)):
        for i in range(3 - (k == 2)):
            x = (i - (1 if k < 2 else 0.5)) * 0.32
            c.cone(0.09, 0.0, 0.12, pose(x, y, 0.86 - abs(x) * 0.25, rx=1.75), 0x9C8F72, segments=3)
    # la queue : trois plumes sombres en éventail
    for i, a in enumerate((-0.35, 0.0, 0.35)):
        c.boite(0.42, 0.12, 1.2, pose(a * 1.2, 0.95, -1.15, rx=0.45, ry=a), SOMBRE, BLEU, biseau=0.04)
    # les serres d'or
    for s in (-1, 1):
        c.sphere(0.3, pose(s * 0.48, 0.4, 0.3, s=(1.0, 0.8, 1.2)), BEC, segments=10, anneaux=6)
        for k in (-1, 0, 1):
            c.cone(0.08, 0.02, 0.28, pose(s * 0.48 + k * 0.17, 0.2, 0.62, rx=1.3), SOMBRE, segments=5)
    m.poser(c, (0.0, 0.0, 0.0))

    t = Piece("tete", 211)
    t.sphere(1.0, pose(0, 0, 0, s=(1.12, 0.76, 0.86)), BLEU, BLEU_DESSUS, SOMBRE, segments=16, anneaux=10)
    for s in (-1, 1):
        t.cone(0.3, 0.0, 0.95, pose(s * 0.78, 0.82, -0.05, rz=-s * 0.38), SOMBRE, BLEU, segments=5)  # les aigrettes
        t.sphere(1.0, pose(s * 0.5, -0.02, 0.6, s=(0.56, 0.56, 0.24)), CREME, CREME_CLAIRE, segments=14, anneaux=8)  # le disque facial
        t.boite(0.6, 0.12, 0.2, pose(s * 0.48, 0.5, 0.72, rz=s * 0.3), SOMBRE, biseau=0.04)  # sourcil froncé
    t.cone(0.2, 0.0, 0.55, pose(0, -0.22, 0.95, rx=1.85), BEC, segments=6)  # le bec crochu
    m.poser(t, (0.0, 2.7, 0.15))

    y = Piece("yeux", 212)
    for s in (-1, 1):
        y.sphere(1.0, pose(s * 0.5, 0, 0, s=(0.3, 0.3, 0.16)), BLANC, segments=12, anneaux=8)
        y.sphere(1.0, pose(s * 0.5, -0.01, 0.12, s=(0.15, 0.17, 0.08)), ENCRE, segments=10, anneaux=6)
    m.poser(y, (0.0, 0.02, 0.86), parent="tete")

    for nom, s in (("ailes_g", -1), ("ailes_d", 1)):
        a = Piece(nom, 220 + s)
        # l'avant-bras (une large plume de couverture) puis les rémiges en éventail, plus sombres au bout ; dessinées à 82 % (l'ancienne échelle du groupe)
        k = 0.82
        # tour 2 : les couvertures en une plaque effilée, et trois rangs de plumes claires dessus (des boîtes, vues d'en haut, faisaient des planches)
        couv = [(0.0, -0.75), (1.6, -0.85), (2.75, -0.55), (2.95, 0.1), (2.4, 0.6), (1.2, 0.75), (0.0, 0.7)]
        a.plaque([(px * k, pz * k) for (px, pz) in couv], 0.26 * k, pose(0, 0.13 * k, 0, s=(s, 1, 1)), AILE, AILE_CLAIRE, SOMBRE, biseau=0.06)
        petite = [(0.0, -0.2), (0.7, -0.22), (0.95, 0.0), (0.7, 0.22), (0.0, 0.2)]
        for (x0, z0) in ((0.9, 0.35), (1.6, 0.05), (2.25, -0.25)):
            a.plaque([(px * k, pz * k) for (px, pz) in petite], 0.08 * k, pose(s * x0 * k, 0.16 * k, z0 * k, ry=s * 0.5, s=(s, 1, 1)), AILE_CLAIRE, 0x8A9CCC)
        # les rémiges : des plumes effilées en éventail, qui se chevauchent
        plume = [(0.0, -0.3), (1.25, -0.28), (1.75, 0.0), (1.25, 0.28), (0.0, 0.3)]
        for i, (x, z, ry) in enumerate(((2.75, 0.45, -0.32), (2.95, -0.05, -0.12), (2.9, -0.55, 0.08), (2.65, -1.0, 0.3), (2.3, -1.35, 0.52))):
            a.plaque([(px * k, pz * k) for (px, pz) in plume], 0.12 * k, pose(s * x * k, 0.04 - i * 0.012, z * k, ry=-s * ry, s=(s, 1, 1)), SOMBRE if i % 2 == 0 else BLEU, AILE, biseau=0.0)
        m.poser(a, (s * 0.85, 2.6, 0.0))
    return m
