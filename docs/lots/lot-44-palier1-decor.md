# Lot 44 — Track : palier 1, le décor de chaque thème

Branche `claude/adoring-clarke-mdlzin` (nom imposé par la session ; le lot prévoyait `lot-44-palier1-decor`, d'où l'étiquette `jeu:track` sur la PR pour le
job `zones`), partie de `main` à `9f9a80a` (lot 43 fusionné), puis `main` fusionné à `42154b6` (retouche 40b, les voitures en jeu). PR : @@PR@@.
Zones : `apps/web/**`, `docs/lots/**`, la section de Track de `docs/plateforme/budgets.md`. **Rien dans `sim`** : golden, `SIM_VERSION`, `GENERATOR_VERSION`,
rediffusions, classements, identifiants de circuit inchangés (aucun fichier de `packages/` touché).

## En deux phrases

**Le décor de fond du palier 1 remplace celui d'avant, thème par thème** — Stade, Rallye, Banquise, Nuit, Campagne, Canyon, Col, Ville : le décor de B
allégé de la vitrine (`decorP` : tribune du départ, recettes du thème) et la matière de C (grain, sol dessiné du thème), **posés sur un sol relevé** près de la
piste (un talus à 1,5 m sous la route, puis une pente douce) pour qu'on voie enfin le décor depuis la voiture ; **la simulation ne voit pas ce sol**. Le décor
de chaque thème est **un morceau chargé à la demande** (12,3 ko pour les huit, plafond 16 ko) : la scène s'affiche d'abord avec la piste, les rebords et les
éléments de course, le décor arrive pendant l'accueil (en 4G lente : prêt 2,4 s après l'ouverture de la page, ≈ 2,8 s avant que le jeu ne soit prêt) et ne
s'ajoute **jamais en course** — s'il n'est pas prêt au décompte, la course part sans lui et il s'ajoute à la prochaine pause ou à l'arrivée.

@@SUITE@@
