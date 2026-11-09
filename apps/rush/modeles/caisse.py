# La PETITE CAISSE (lot BR-A1) : une caisse de bois clair à lattes, deux bandes sombres, des coins renforcés. Collision 0,34 m (`RAYON_VASE`) ; 0,6 m de côté. Tas instancié : `corps`.
# Ses ÉCLATS : `eclat_1` … `eclat_4`, des planches, chacune à sa place sur la caisse (son origine).
from commun import Modele, Piece, pose

BOIS = 0xD9A65F
BOIS_CLAIR = 0xEBC27E
BOIS_SOMBRE = 0x9C6A38
BANDE = 0x8F4A25


def construire():
    m = Modele("caisse")
    c = Piece("corps", 641)
    c.boite(0.6, 0.56, 0.6, pose(0, 0.28, 0), BOIS, BOIS_CLAIR, BOIS_SOMBRE, biseau=0.03)
    for y in (0.1, 0.46):
        c.boite(0.64, 0.07, 0.64, pose(0, y, 0), BANDE, biseau=0.015)
    for z in (-0.15, 0.0, 0.15):
        c.boite(0.62, 0.012, 0.012, pose(0, 0.565, z), BOIS_SOMBRE)  # les joints des lattes du dessus
    for sx in (-1, 1):
        for sz in (-1, 1):
            c.boite(0.08, 0.6, 0.08, pose(sx * 0.29, 0.28, sz * 0.29), BOIS_SOMBRE, BOIS)
    m.poser(c)
    for i, (x, y, z, ry) in enumerate(((0.0, 0.28, 0.3, 0.0), (0.3, 0.28, 0.0, 1.5708), (0.0, 0.56, 0.0, 0.0), (-0.3, 0.2, 0.0, 1.5708))):
        e = Piece(f"eclat_{i + 1}", 650 + i)
        if i == 2:
            e.boite(0.58, 0.05, 0.18, pose(0, 0, 0), BOIS_CLAIR, BOIS_CLAIR)
        else:
            e.boite(0.56, 0.17, 0.05, pose(0, 0, 0, ry=ry), BOIS if i % 2 == 0 else BOIS_CLAIR, BOIS_CLAIR)
            e.boite(0.58, 0.06, 0.06, pose(0, 0.07, 0, ry=ry), BANDE)
        m.poser(e, (x, y, z))
    return m
