# Lot PBV2 — Pinball : décor de l'Espace et du Volcan, et retouches de la passe visuelle

Branche `ccr-13565b06-cahb9k` (le nom du prompt, `claude/pinball-visuel-2`, n'a pas été pris : la session impose celui-ci), PR brouillon `jeu:pinball`. Le jeu reste `off`. **La simulation ne change pas** : aucun fichier de `packages/pinball-sim` ni de `apps/api` touché, mêmes versions, même golden.

## Les images cibles
- **`cible-foire.png` et `cible-ocean.png` ont été jointes à ce lot** et sont maintenant dans `docs/pinball/maquettes/cibles/` (le `LISEZMOI.md` est à jour).
- **`actuel-foire.png` et `actuel-ocean.png` n'ont pas été reçues** : le jeu d'alors est la première colonne de `captures-pbv1/*-tours.jpg`. Dit ici comme demandé.
- **Aucun JSON exporté de `?debug&tune` n'était joint** : `VUE_DEFAUT` ne change pas (point 6). Sa partie `reglages`, s'il vient, sera de toute façon ignorée (la simulation ne change pas).

## Livré
1. **Le sol riche de l'Espace** (`dessin.ts`, `solEspace`, donc aussi dans le rendu de secours) : ciel profond, 240 étoiles de trois teintes et quatre tailles (denses et brillantes dans les marges, de petits points pâles au milieu), nébuleuses dans les marges (un voile à 7 % au milieu), planètes à anneaux riches dans les coins bas (sous les couloirs de retour) et en silhouettes à 11 % ailleurs, nom en lettres de néon (lueur cyan, filet rose), **étiquettes en plaques de métal brossé rivetées**.
2. **Le sol riche du Volcan** (`solVolcan`) : roche sombre craquelée (diagramme de Voronoï, relief par un liseré clair), **fissures de lave qui luisent dans les marges seulement** (`richesseDuDecor` : 0 là où passe la bille, 1 dans les marges), mares de lave dans les coins, cendres, braises, nom gravé avec une fissure, **étiquettes en plaques de pierre taillée**. La palette du Volcan change pour rester lisible sur la roche sombre : accent `#D9A066` (jupe des bumpers, plaque du moulin, anneau des trous) et cible `#B8B4C0` au lieu de bruns sombres, cratère du geyser plus clair. **Le geyser et la coulée restent les éléments les plus vifs** (lave orange sur roche brune ; regardé sur 390 × 844 et 360 × 640).
3. **Lisibilité** : rien n'a l'air d'un bumper (planètes sans contour ni reflet, rochers absents, tout à plat) ; le décor est discret au milieu (`richesseDuDecor`).
4. **Les étiquettes ne se chevauchent plus** — règle `placerEtiquettes` (`dessin.ts`), commune aux deux rendus : place habituelle, sinon **décalée**, **sur deux lignes** (« POMMES / D'AMOUR ») ou **réduite** (68 % au plus bas), au moindre coût ; les lampes de couloir et de la mission, les poteaux et tous les modules sont des obstacles. **Test `test/etiquettes.test.ts` : 120 tables (30 jours × 4 thèmes), fr et en** — aucune boîte n'en recouvre une autre, un module, un poteau ou une lampe, ni ne sort de la table. Sur les 1 440 plaques : 123 sur deux lignes, 6 % réduites (à 76 % pour « BULLES », « COQUILLAGES » ; à 68 % pour « POMMES D'AMOUR » seulement), **1,5 % plus proches d'un autre module que du leur** (voir « Écarts »).
5. **Écarts du PBV1** :
   - *L'eau de l'Océan qui bouge* : **fait** (haute qualité seulement) — un calque de reflets tuilé qui dérive, masqué vers le sable, autour du tourbillon et des trous.
   - *Le tourbillon avec un léger creux* : **fait** — un entonnoir peu profond (lèvre d'écume, un seul maillage, la mousse en reprend la forme).
   - *La lueur des bandes qui suit le curseur* : **fait** — elle n'est plus cuite dans le sol de la haute qualité (`sansLueurBandes`) mais posée en deux plans ; le rendu de secours la garde cuite (pas de curseur à plat).
6. **Réglages de Nathan** : aucun JSON joint, `VUE_DEFAUT` inchangé.
7. **Comparaisons** : `captures-pbv2/` (voir plus bas). Outil : `e2e/captures-lot-pbv2.spec.ts` (hors CI).

## Comparaisons (`docs/pinball/lots/captures-pbv2/`)
- `espace-tours.jpg`, `volcan-tours.jpg` : avant (état du PBV1) | tour 1 | final.
- `foire-cible.jpg`, `ocean-cible.jpg` : la cible à côté du jeu final.
- `final-quatre-themes-390x844.jpg`, `final-quatre-themes-360x640.jpg`, `final-secours-390x844.jpg`, `avant-apres-secours.jpg`.

## Écarts qui restent (jeu final / cibles)
- Les cibles sont des **rendus d'IA** : matière du bois et de l'eau, rochers et algues en volume, méduses lumineuses, meuble photoréaliste. Le jeu reste un dessin par le code sans image ajoutée ; la direction (couleurs, lumière chaude, étiquettes en plaques, décor dans les marges) est suivie, pas la richesse.
- **Étiquettes plus grandes que sur les cibles** (140 % : la lisibilité sur téléphone prime) : c'est ce qui les rend à l'étroit.
- **Cas serré de la Fête foraine** (grappe de bumpers entre deux modules, au-dessus du manège dont les lampes de mission barrent la place) : « POMMES D'AMOUR » ne tient nulle part près de son module ; elle se pose sous un voisin (« GRANDE ROUE » passe au-dessus). **Sans chevauchement mais ambigu**, sur environ un tiers des jours de la Fête foraine en français (0 en anglais). Pistes : raccourcir le nom dans le catalogue, ou déplacer les lampes de mission (hors zones de ce lot).
- « BULLES » est petite (76 %) sur l'Océan quand les lampes du tourbillon barrent l'espace.
- Le **curseur « Étiquettes »** au-delà de 140 % ne garantit plus l'absence de chevauchement.
- Les ombres longues, les reflets de la pièce et la bille dans le sol : comme au PBV1.

## Mesures
- **Premier chargement** : rien n'y a été ajouté (le rendu et le sol sont à la demande) ; `e2e/poids.spec.ts` vert.
- **Rendu à la demande** (`corps-` + `dessin-`, gzip) : **166 634 o** (`corps-` 155 718, `dessin-` 10 916), contre 162 314 o au PBV1 : **+4,3 Ko, sous le plafond de 172 Ko** de `pinball.rendu`. Pas de relèvement à demander.
- **Fluidité**, comme au PBV1 (Chromium de Playwright, 390 × 844, bille en jeu, processeur ralenti ×4, WebGL logiciel SwiftShader, médiane du fil principal par image ; mesure bruitée d'environ ±2 ms d'une passe à l'autre) :

  | avec bloom | avant (PBV1) | après |
  |---|---|---|
  | Fête foraine | 12,8 ms | 10,7 ms |
  | Océan | 7,4 ms | 9,1 ms |
  | Espace | 8,5 ms | 8,4 ms |
  | Volcan | 9,3 ms | 9,6 ms |

  Tous **sous 16,7 ms**. L'Océan gagne ~1,7 ms (le calque d'eau, l'entonnoir : +3 000 triangles), dans le bruit de la mesure. **Non mesuré : un vrai téléphone.**

## Vérifié
- **`npm run verifier` : tout vert** (typecheck, tests unitaires SQLite et libSQL, construction, e2e Pinball 7 specs, budgets de toutes les lignes) ; `npm run consignes` vert. Test ajouté : `test/etiquettes.test.ts` (7 tests, dont les 120 tables en fr et en) ; `test/decor.test.ts` mis à jour (styles des plaques). `main` fusionné : déjà à jour.
- Captures regardées : sept planches (quatre tables du tour 1, secours, Océan contre sa cible, 360 × 640).

## Non vérifié
- Un vrai téléphone (carte graphique), Firefox, WebKit.
- Les liens de l'aperçu (le réseau du conteneur refuse `web.app`).

## Zones partagées
Rien hors de `apps/pinball/**` et `docs/pinball/**`.

## Pour Nathan : tester en 2 clics (recette, le jeu est `off`)
La base de l'aperçu est donnée par le commentaire « Recette » de la PR :
- `/pinball/?theme=espace` et `/pinball/?theme=volcan`
- **Les étiquettes corrigées** : `/pinball/?theme=foire`
- **Le rendu de secours** : `/pinball/?theme=volcan&qualite=basse`

Ce que Nathan regarde : l'Espace et le Volcan sont au niveau des deux autres, il lit toutes les étiquettes, et c'est fluide sur son téléphone.

**Pour les joueurs : rien**
