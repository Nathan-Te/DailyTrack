# Le GOLEM (lot BR-A1) : des ROCHES TAILLÉES (des plans nets, des arêtes adoucies), des fissures sombres, une tête enfoncée entre d'énormes épaules, des POINGS ÉNORMES aux phalanges taillées, des orbites creuses où brillent les
# yeux ambre (ceux-ci restent des aplats lumineux du code, avec leur halo : `creerGolem`). ~6 m de haut ; collision : un disque de 1,7 m (les bras dépassent).
# Pièces et pivots = les groupes de `creerGolem` (`acteurs.ts`) : `corps` (0, 0, 0), `tete` (0, 5,3, 1,05), `bras_g` / `bras_d` (∓2,55, 3,15, 0), `avant_bras_g` / `avant_bras_d` (0, −1,45, 0 sous l'épaule),
# `jambe_g` / `jambe_d` (∓0,85, 0,65, 0).
from commun import Modele, Piece, pose

# Les pierres : un brun chaud (celui de la cible), nettement plus sombre que tous les sols (`PIERRE*` de `acteurs.ts`), un dessus plus clair (le ciel), un dessous plus sombre.
PIERRE = (0x7E6450, 0xA4876C)
SOMBRE = (0x5C4A3C, 0x7C6550)
POING = (0x765C48, 0x9C7F64)
CLAIRE = (0x8A6E58, 0xB09276)
TETE = (0x927660, 0xB89A7E)
FISSURE = 0x261C16
ORBITE = 0x1E1612


def bloc(p, w, h, d, M, teinte, graine, coupes=4, profondeur=(0.12, 0.26), base="ico"):
    """Une pierre du golem. `base="ico"` (les gros blocs : torse, épaules, poings, tête) : un ROCHER arrondi aux grands plans taillés ; `base="cube"` (les détails : sourcils, phalanges, mâchoire) : un bloc aux coins abattus."""
    if base == "cube":
        return p.roche(w, h, d, M, teinte[0], teinte[1], 0x4A3A2E, coupes=max(coupes, 9), profondeur=(0.24, 0.46), biseau=0.05, variation=0.06, graine=graine)
    return p.roche(w, h, d, M, teinte[0], teinte[1], 0x4A3A2E, coupes=coupes, profondeur=profondeur, biseau=0.03, variation=0.06, graine=graine, base="ico")


def construire():
    m = Modele("golem")

    # Le tronc : le bassin, le torse massif (deux pectoraux taillés devant), la bosse du dos, le ventre ; deux fissures sur le torse. Tour 3 : les gros blocs sont des rochers (icosaèdre taillé), les détails des blocs taillés.
    c = Piece("corps", 10)
    bloc(c, 2.5, 1.05, 1.8, pose(0, 1.35, 0), SOMBRE, 11)
    bloc(c, 3.3, 2.3, 2.3, pose(0, 2.85, 0.0), CLAIRE, 12)
    for s in (-1, 1):
        bloc(c, 1.5, 1.3, 0.7, pose(s * 0.78, 3.15, 1.0, ry=s * 0.12, rx=-0.08), PIERRE, 13 + s, base="cube")
    bloc(c, 2.4, 1.4, 1.5, pose(0, 3.85, -0.95, rx=0.2), PIERRE, 16)
    bloc(c, 1.6, 0.9, 1.2, pose(0, 2.0, 0.55), PIERRE, 19, base="cube")  # le ventre
    # tour 2 : des lignes brisées plus fines, en plus de segments (elles faisaient des flèches)
    c.fissure((-0.35, 3.75, 1.33), [(0.1, -0.18, 0.01), (-0.06, -0.2, 0.01), (0.12, -0.16, 0.0), (-0.04, -0.2, 0.0)], couleur=FISSURE, largeur=0.045)
    c.fissure((0.95, 2.1, 1.08), [(-0.1, 0.16, 0.02), (0.08, 0.18, 0.01), (-0.05, 0.16, 0.0)], couleur=FISSURE, largeur=0.04)
    m.poser(c, (0.0, 0.0, 0.0))

    # La tête : un gros bloc enfoncé, une mâchoire, une arcade épaisse, deux sourcils froncés (les extrémités intérieures plus bas) et deux ORBITES sombres sous eux (les yeux du code y brillent).
    t = Piece("tete", 20)
    bloc(t, 2.2, 1.7, 1.75, pose(0, 0, 0), TETE, 21)
    bloc(t, 1.6, 0.7, 1.1, pose(0, -0.78, 0.42), PIERRE, 22, base="cube")
    bloc(t, 2.3, 0.36, 0.55, pose(0, 0.2, 0.78), SOMBRE, 23, base="cube")
    for s in (-1, 1):
        bloc(t, 1.05, 0.36, 0.58, pose(s * 0.56, 0.36, 0.86, rz=s * 0.4), SOMBRE, 24 + s, base="cube")
        t.boite(0.62, 0.32, 0.2, pose(s * 0.46, 0.0, 0.84, rz=s * 0.35), ORBITE, biseau=0.06)
    t.fissure((0.55, 0.75, 0.88), [(0.07, -0.12, 0.0), (-0.05, -0.12, 0.0), (0.05, -0.1, 0.0)], couleur=FISSURE, largeur=0.035)
    m.poser(t, (0.0, 5.3, 1.05))

    for nom, s in (("_g", -1), ("_d", 1)):
        g = 30 if s == 1 else 40
        # Le haut du bras : une énorme épaule taillée et le bras jusqu'au coude, qui pend sous son pivot.
        b = Piece("bras" + nom, g)
        bloc(b, 2.0, 1.55, 2.0, pose(s * 0.05, 0.05, 0), CLAIRE, g + 1)
        bloc(b, 1.25, 1.4, 1.25, pose(0, -1.05, 0.05), SOMBRE, g + 2)
        m.poser(b, (s * 2.55, 3.15, 0.0))
        # L'avant-bras et le POING ÉNORME : un gros bloc, quatre phalanges taillées devant, un pouce côté intérieur, une fissure.
        a = Piece("avant_bras" + nom, g + 5)
        bloc(a, 1.3, 1.2, 1.35, pose(0, -0.45, 0.1), PIERRE, g + 6)
        bloc(a, 2.4, 1.85, 2.3, pose(0, -1.6, 0.4), POING, g + 7)
        for k in range(4):
            x = (k - 1.5) * 0.56
            bloc(a, 0.55, 0.62, 0.55, pose(x, -2.25, 1.45 - abs(k - 1.5) * 0.08, rx=0.3), POING, g + 10 + k, base="cube")
        bloc(a, 0.6, 0.9, 0.7, pose(-s * 1.2, -1.75, 1.05, rz=-s * 0.35), POING, g + 15, base="cube")
        a.fissure((s * 0.55, -1.0, 1.56), [(-s * 0.1, -0.16, 0.0), (s * 0.06, -0.18, 0.0), (-s * 0.08, -0.16, 0.0)], couleur=FISSURE, largeur=0.04)
        m.poser(a, (0.0, -1.45, 0.0), parent="bras" + nom)
        # La jambe : un pilier court et sombre.
        j = Piece("jambe" + nom, g + 20)
        bloc(j, 1.15, 1.25, 1.3, pose(0, 0, 0), SOMBRE, g + 21)
        bloc(j, 1.3, 0.4, 1.5, pose(0, -0.5, 0.12), PIERRE, g + 22, base="cube")
        m.poser(j, (s * 0.85, 0.65, 0.0))
    return m
