"""Extrait des fichiers d'un .unitypackage (lot BR-A3).

Un .unitypackage est une archive tar gz : un dossier par fichier (son GUID) qui porte `pathname` (le chemin dans le projet Unity)
et `asset` (le contenu). On n'écrit que les fichiers dont le chemin correspond à l'un des motifs, sous `<sortie>/<pathname>`.

    python -I extraire.py <paquet.unitypackage> <sortie> <motif regex> [<motif>…]

La sortie est hors dépôt (dossier `.brut/`, ignoré par git) : AUCUN fichier d'un pack ne se commite (dépôt public).
Aucun chemin absolu ni `..` n'est accepté depuis l'archive (on ne lui fait pas confiance).
"""
import os
import re
import sys
import tarfile


def extraire(paquet, sortie, motifs):
    regex = [re.compile(m) for m in motifs]
    chemins, contenus = {}, {}
    with tarfile.open(paquet, "r:gz") as t:
        for m in t:
            parts = m.name.replace("\\", "/").split("/")
            if len(parts) < 2 or not m.isfile():
                continue
            guid, f = parts[-2], parts[-1]
            if f == "pathname":
                chemins[guid] = t.extractfile(m).read().decode("utf-8", "replace").splitlines()[0].strip()
            elif f == "asset":
                contenus[guid] = m
        ecrits = []
        for guid, chemin in chemins.items():
            if guid not in contenus or not any(r.search(chemin) for r in regex):
                continue
            propre = os.path.normpath(chemin)
            if os.path.isabs(propre) or propre.startswith(".."):
                raise ValueError(f"chemin refusé : {chemin}")
            cible = os.path.join(sortie, propre)
            os.makedirs(os.path.dirname(cible), exist_ok=True)
            with t.extractfile(contenus[guid]) as src, open(cible, "wb") as dst:
                dst.write(src.read())
            ecrits.append(chemin)
    return sorted(ecrits)


if __name__ == "__main__":
    if len(sys.argv) < 4:
        print(__doc__)
        sys.exit(2)
    for c in extraire(sys.argv[1], sys.argv[2], sys.argv[3:]):
        print(c)
