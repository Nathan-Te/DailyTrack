# Sons de la planche sonore (lot 55, partie B)

Ces fichiers ne sont lus que par la planche `/track/vitrine/?planche=son` (recette et aperçus). **Aucun n'est dans le jeu ni en production** tant que Nathan n'a pas choisi
une approche (`docs/lots/lot-55-fantomes-son.md`).

## `b/` — approche B : rendu hors ligne (nos sons)
Produits par `node --experimental-strip-types apps/web/outils/son/rendre-echantillons.mjs` (code du dépôt, aucune source tierce, rien à créditer). Six boucles AAC mono
22,05 kHz à 32 kbit/s par profil (Sparrow, Boar, Sailfish, Pelican) ; `manifeste.json` donne le régime de chaque boucle et la fenêtre qui boucle sans raccord.

## `c/` — approche C : enregistrements libres de droits (CC0)
Six boucles « racing car engine sound loops » (OpenGameArt) : <https://opengameart.org/content/racing-car-engine-sound-loops>.
- **Licence : CC0** (domaine public, indiquée sur la page de la ressource ; consultée le 30/10/2026). D'après la description de l'auteur de la ressource, les boucles sont
  tirées d'un enregistrement du domaine public (pdsounds.org, « start up car with seat belt warning beep ») découpé, bouclé « à peu près sans raccord » et dont la hauteur a
  été changée : la différence entre les fichiers est la hauteur seule.
- Originaux (WAV 44,1 kHz mono) : `loop_0.wav`, `loop_1_0.wav` … `loop_5_0.wav`. Empreintes SHA-256 (16 premiers caractères) :
  `69d74b106509037c`, `0bc6bf7e1ad33d34`, `e26bef6f1804670a`, `015aee5cd2dec394`, `fadf4420104d9273`, `e0c6547676493177`.
- Conversion : `ffmpeg -i loop_N.wav -ac 1 -ar 22050 -c:a aac -b:a 40k boucle-N.m4a` (N = 0 à 5). Seul changement : le format.
- Limite connue : un seul moteur, de qualité moyenne ; la hauteur des six boucles ne couvre qu'environ ±15 % (60 → 76 Hz mesurés), le reste de la plage est obtenu en
  changeant la vitesse de lecture.
