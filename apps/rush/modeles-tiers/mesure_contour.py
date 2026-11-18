"""Mesure l'épaisseur du contour sur les captures du lot BR-A3 (`bra3-tN-contour-<l>x<h>-dpr<d>.png`) : sur la zone du chevalier (la même part de l'image partout),
la largeur moyenne des traits d'encre (suites horizontales de pixels très sombres), en part de la hauteur de l'image (× 1080 : « pixels à 1080 »), et la part de pixels d'encre.
Un contour indépendant de la définition et de la densité de pixels donne les mêmes deux nombres partout.

    python -I apps/rush/modeles-tiers/mesure_contour.py <tour>
"""
import glob
import os
import re
import sys

import numpy as np
from PIL import Image

RACINE = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
tour = sys.argv[1] if len(sys.argv) > 1 else "3"
print("| définition | DPR | pixels | trait (px à 1080) | part d'encre |\n|---|---|---|---|---|")
for chemin in sorted(glob.glob(os.path.join(RACINE, "docs", "rush", "lots", f"bra3-t{tour}-contour-*.png")), key=lambda c: (int(re.search(r"(\d+)x", c).group(1)), c)):
    m = re.search(r"contour-(\d+)x(\d+)-dpr(\d)", chemin)
    im = np.asarray(Image.open(chemin).convert("L"), dtype=np.float32)
    H, W = im.shape
    zone = im[int(H * 0.44) : int(H * 0.70), int(W * 0.36) : int(W * 0.47)]  # le chevalier (casque clair, armure jaune) sur les dalles : seul le trait y est très sombre
    encre = zone < 45
    largeurs = []
    for ligne in encre:
        n = 0
        for v in ligne:
            if v:
                n += 1
            elif n:
                largeurs.append(n)
                n = 0
    moy = float(np.mean(largeurs)) if largeurs else 0.0
    print(f"| {m.group(1)} × {m.group(2)} | {m.group(3)} | {W} × {H} | {moy * 1080 / H:.2f} | {encre.mean() * 100:.2f} % |")
