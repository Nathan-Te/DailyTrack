"""La planche de comparaison du lot BR-A3 : la capture de la vitrine (1920 × 1080) à côté de la cible (`docs/rush/maquettes/cible-ia.png`), à la même hauteur.

    python -I apps/rush/modeles-tiers/planche.py <capture.png> <sortie.png> [<capture avant.png>]

Avec une troisième image (la vitrine sans les modèles tiers : `&modeles=0`), la planche a trois colonnes : avant, après, cible.
"""
import os
import sys

from PIL import Image, ImageDraw

RACINE = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
CIBLE = os.path.join(RACINE, "docs", "rush", "maquettes", "cible-ia.png")
H = 720


def ramener(chemin):
    im = Image.open(chemin).convert("RGB")
    return im.resize((round(im.width * H / im.height), H))


def main():
    apres, sortie = sys.argv[1], sys.argv[2]
    images = ([ramener(sys.argv[3])] if len(sys.argv) > 3 else []) + [ramener(apres), ramener(CIBLE)]
    titres = (["avant (&modeles=0)"] if len(sys.argv) > 3 else []) + ["après", "cible"]
    out = Image.new("RGB", (sum(i.width for i in images) + 12 * (len(images) - 1), H + 40), (250, 245, 232))
    x = 0
    d = ImageDraw.Draw(out)
    for im, t in zip(images, titres):
        out.paste(im, (x, 40))
        d.text((x + 10, 12), t, fill=(30, 20, 12))
        x += im.width + 12
    out.save(sortie)


main()
