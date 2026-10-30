# Sons de la planche sonore (lot 55, partie B)

Ces fichiers ne sont lus que par la planche `/track/vitrine/?planche=son` (recette et aperçus). **Aucun n'est dans le jeu ni en production** tant que Nathan n'a pas
choisi une approche (`docs/lots/lot-55-fantomes-son.md`).

## `b/` — approche B : rendu hors ligne (nos sons)
Produits par `node --experimental-strip-types apps/web/outils/son/rendre-echantillons.mjs` (code du dépôt, aucune source tierce, **rien à créditer ni à licencier**). Huit
boucles AAC mono 22,05 kHz à 40 kbit/s par profil (Sparrow, Boar, Sailfish, Pelican), en progression géométrique du ralenti au rouge ; `manifeste.json` donne le régime
de chaque boucle et la fenêtre qui boucle sans raccord (le fichier porte trois copies de la période : on boucle sur celle du milieu).

## Essai écarté : enregistrements libres de droits
Six boucles CC0 trouvées sur OpenGameArt (« racing car engine sound loops ») ont été essayées en approche C et **écartées après écoute de Nathan** (« une télé qui grésille »).
Mesure : 96 à 100 % de leur énergie est sous 150 Hz, presque pur : un grondement sourd, pas une voix de moteur audible sur un petit haut-parleur. Elles ne sont plus dans le
dépôt (ni dans `docs/credits.md`).
