# Construit les modèles TIERS de Rush dans Blender (lot BR-A3) et les exporte en glTF binaire non compressé dans `apps/rush/modeles-tiers/build/` ;
# `construire.mjs` (npm run modeles-tiers -w @cdj/rush) extrait les fichiers des packs, lance ce script puis compresse avec gltfpack.
#   blender -b --factory-startup -P apps/rush/modeles-tiers/construire.py -- [noms…] [--vignettes]
import importlib
import json
import os
import sys

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ICI)

import commun  # noqa: E402

MODELES = ["golem", "gelee", "chauve-souris", "chevalier"]


def main():
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    noms = [a for a in args if not a.startswith("--")] or MODELES
    rapport = {}
    for nom in noms:
        mod = importlib.import_module(nom.replace("-", "_"))
        r = commun.construire(mod.SPEC)
        rapport[nom] = r
        print(f"[tiers] {nom} : {r['triangles']} triangles, {r['os']} os, ×{r['echelle']:.3f}, {r['hauteur']:.2f} m, clips {list(r['clips'])}")
        if "couleurs" in r:
            print(f"[tiers] {nom} couleurs : {json.dumps(r['couleurs'])}")
        if "--vignettes" in args:
            commun.vignettes(nom)
    chemin = os.path.join(commun.BUILD, "rapport.json")
    ancien = json.load(open(chemin, encoding="utf-8")) if os.path.exists(chemin) else {}
    ancien.update(rapport)
    with open(chemin, "w", encoding="utf-8") as f:
        json.dump(ancien, f, indent=1)


main()
