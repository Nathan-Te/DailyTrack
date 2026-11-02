# Lot T9 — Les visuels : décors, bonus et malus, taquet (Tower)

Branche `ccr-acc233ce-kg8vja`, PR brouillon. **Tower reste `off`.** Pour les joueurs : rien. Planche validée par Nathan (2 novembre, avec sa retouche : la glissante prend l'habit de glace, la figée un habit de chantier boulonné) : `docs/tower/maquettes/tower-planche-{decors,effets,taquet}.html`. Règles : `docs/tower/consignes.md`, « Les visuels : décors, habillage des effets, taquet (lot T9) ».

**Tout est de l'affichage.** `TOWER_SIM_VERSION`, `TOWER_GENERATOR_VERSION`, le golden, les rediffusions, les fichiers de jours, `lab/` : intacts (les tests de `tower-sim` passent tels quels). Le seul ajout côté simulation est **`Partie.soudures()`**, une lecture seule des joints de Rapier (comme `visee()`), testée : même rediffusion et même empreinte avec ou sans lecture.

## Ce qui est livré
- **Des décors riches, six thèmes, quatre plans** : lointain 0,2 · moyen 0,5 · proche 0,8 · sol 1 (parallaxe verticale), le contenu de la planche thème par thème, en aplats (un maillage par couleur et par plan : une dizaine d'appels de dessin par thème), répétés en miroir sur les côtés pour les grands écrans. **Registre d'altitude** : quelques nuages hauts sous 15 m, nuages et oiseaux de 15 à 45 m, puis le ciel haut (avions, montgolfières, étoiles, aurore, vautours, perroquets, chauves-souris) jusqu'à 160 m, avec des bandes de ciel qui s'assombrissent ; semé par le hasard d'affichage (une graine par thème). Animations lentes (mouettes, vautours, houle, neige, fenêtres et étoiles qui scintillent, crochet de la grue), coupées par `prefers-reduced-motion`. **Tous les décors, le port compris, sont à la demande** (un module par thème) ; la palette n'en porte plus.
- **L'habit des effets** : figée (chantier boulonné : bande jaune et noire, plaques d'acier et boulons, deux équerres, étincelles, clé) ; lierre (liane, feuilles, **une feuille-agrafe par soudure, lue dans les joints**) ; glissante (verglas : bord de glace épais, couleur givrée, facettes, glaçons, gouttes, flocons, traits de glissade) ; petite (étincelles, contour pointillé qui se resserre) ; géante (trait épais, ombre, rivets, sueur ; poussière et fissures à la pose) ; coup de vent (tourbillon, feuilles, yeux plissés, traînées cerclées d'encre).
- **La plaque « Suivante » marquée** (cadre vert épais / cadre d'encre et bande rayée, macaron avec l'icône : écrou, flocon…, pièce dessinée à la couleur ou à la taille de l'effet) et **l'annonce du palier en tampon** (vert penché à gauche « LIERRE ! » · encre penché à droite ombré terre cuite « COUP DE VENT… » ; tombe avec un rebond, 1,5 s, jamais au centre). Textes FR et EN dans les catalogues.
- **Le taquet en quatre temps**, lu dans les événements (`taquet`, `choc`, `cale`, `souffle`) : étirement ×1,15 / ×0,85, traînées et bouffée, bouton tactile qui clignote ; éclat étoilé, éclats, confettis, **micro-secousse de 80 ms**, « toc », **vibration de 15 ms** (Réglages › Affichage › Vibration, allumée par défaut) ; poussière, étincelle, yeux détendus ; sans choc, un petit souffle. **Curseurs de rendu** `?debug&tune` : étirement, éclat, secousse du taquet, vibration, volume du taquet.

## Captures (`docs/tower/lots/img/`, Chromium 844 × 390, planche à côté)
- Les six décors : `lot-T9-decor-{port,chantier,canyon,banquise,jungle,nuit}.png`. Une tour de 50 m : `lot-T9-tour-50m-{port,canyon,nuit}.png` (jour 04/11, bot, thème forcé).
- Les six effets : `lot-T9-effet-{figee,lierre,glissante,petite,geante,vent}.png` (×2). Plaque et tampon : `lot-T9-plaque-tampon-{bonus,malus}.png`.
- Le taquet : `lot-T9-taquet-{1-coup,2-choc,3-calee}.png` (`?scenario=emboitement`).

## Écarts à la planche
- **Échelle** : la planche dessine des cases de 48 px, le jeu 20 px par mètre (téléphone en paysage) : les habits sont plus petits et simplifiés (les équerres de la figée sont aux deux pieds de la pièce et non posées « à ce qu'elle touche » ; la liane suit les bords libres). Les formes creuses de la planche (mesas, feuilles, collines) sont écrites en polygones convexes.
- **Couleurs pour le contraste** (test étendu à tous les plans) : canyon, ciel `#FFEBC8`, sable `#E3BC84`, mesas plus sombres ; jungle, ciel `#8FD1A0` ; chantier, ville et bandes de ciel plus foncées. Les couleurs des pièces ne changent pas.
- **Macaron** au coin bas gauche (au coin haut droit il touchait le bord de l'écran et au coin haut gauche l'étiquette) ; sa couleur est celle du bonus ou de l'encre (la planche a un gris pour l'écrou).
- La plateforme enneigée est un bonnet et des bosses (pas le liseré ondulé) ; les fissures de la géante durent 3 s au lieu de rester sur la pièce écrasée ; en paysage la mer ne montre qu'un mètre : les reflets de la nuit sont à peine visibles.
- Avec `prefers-reduced-motion` : plus de secousse, de traînées, de poussière ni de confettis ; l'éclat reste, immobile.
- **Le choc** : une pièce dont le coup s'arrête collé contre un bloc compte comme un choc (le cas du scénario d'emboîtement : le coup de 1,5 m finit exactement contre la tige), pas seulement celle que la simulation lâche.

## Le poids (`apps/tower/tools/mesure.mjs`, gzip niveau 9)
| ligne | avant | après | plafond |
|---|---|---|---|
| `tower.jsCss` (accueil) | 39 979 | **39 921 (−58)** | 40 000 |
| `tower.jeu` | 171 106 | **174 677 (+3 571 sur les +6 000 accordés)** | 171 200 → **175 000** |
| `tower.decors` (nouveau, le port) | — | 4 129 (banquise 4 084 · canyon 3 889 · chantier 4 080 · jungle 4 103 · nuit 3 999) | 4 540 |
| `tower.habits` (nouveau : habits, effets du taquet, formes) | — | 5 312 | 5 840 |
| `tower.anglais` | 5 065 | 5 181 | 8 000 |
Les deux nouvelles lignes sont dans la section Tower de `budgets.md`, **hors du grand tableau** : `apps/portail/test/budgets.test.ts` relit le grand tableau d'après `LIGNES_TOWER` de `scripts/budgets.mjs` (zone de la plateforme). **Proposition pour un lot de plateforme** : ajouter `tower.decors` et `tower.habits` à `LIGNES_TOWER` et à `mesureTower`, puis les monter dans le grand tableau. Leur mesure est dans `mesure.mjs` (Tower) et leurs tests dans `poids.spec.ts`.

## Vérifié / non vérifié
- **Vérifié** : `npm run typecheck`, tous les tests unitaires de `apps/tower`, `packages/tower-sim`, `apps/web` et le budget du portail verts (1 913 tests), dont les nouveaux (`decors`, `habits`, `taquet`, `tampon`, `vibration`, `secousse`, `soudures`) — parallaxe, registre d'altitude (au moins trois éléments du ciel à l'écran de 0 à 70 m), contraste des pièces sur tous les plans de tous les thèmes, mouvement réduit (décor, habits, effets, micro-secousse), un habit par effet, les agrafes lues dans les joints, la plaque et le tampon, les quatre temps du taquet joués dans la vraie partie (choc, calée ; sans choc seulement le souffle), la vibration coupée par le réglage, et **la même partie avec et sans tout l'affichage donne la même rediffusion, la même empreinte et le même résultat**. Captures lues dans un vrai Chromium (paysage ; un portrait pour le port). Les 19 tests de navigateur de Tower (Chromium) verts, budgets compris. **Cadence** : en rendu logiciel (SwiftShader, 1280 × 720) 48 images par seconde avec le décor contre 60 sans (−17 %) ; un décor fait 21 à 33 appels de dessin et 3 000 à 7 500 triangles ; **non mesuré sur un vrai GPU**. Un test de navigateur (`classement.spec.ts`, « sans serveur ») a échoué une fois dans `npm run verifier` (« Envoi de ta partie… » au lieu de « Hors ligne ») puis est repassé sans changement, seul et en suite : à surveiller en CI.
- **Non vérifié** : un vrai téléphone (vibration, cadence sur un appareil modeste, portrait), iPhone et ses marges, le rendu dans Firefox et WebKit (le petit ensemble `@navigateurs` de la CI ne dessine pas les décors), les six effets en partie réelle de bout en bout (captures prises dans `?scenario=paliers`). Le CI de la PR est à attendre.

## Questions pour Nathan
1. Les textes anglais des tampons (IVY! · BOLTED! · MINI! · GIANT… · GUST… · SLIPPERY…) et leurs points de suspension.
2. Les fissures de la géante doivent-elles rester sur la pièce écrasée (il faudrait savoir laquelle) ou 3 s suffisent ?
3. Les décors à 20 px par mètre sont plus calmes que la planche : veux-tu des habits plus gros que la pièce (au prix d'un recouvrement des voisines) ?
4. Mettre `tower.decors` et `tower.habits` dans le grand tableau : un lot de plateforme.
5. Le canyon et la jungle ont changé de ciel pour tenir le contraste : à valider (couleurs ci-dessus).

## Liens de test (aperçu de la PR, `/tower/` : jamais en production)
- Effets : `/tower/?scenario=paliers&effet=figee` · `…=lierre` · `…=glissante` · `…=petite` · `…=geante` · `…=vent` (pose une pièce, franchis 8 m : plaque « Suivante », tampon, puis la pièce habillée).
- Taquet : `/tower/?scenario=emboitement` (5 pas à gauche, laisse descendre, taquet à droite sous le bâton : coup, choc, calée).
- Décors : `/tower/?seed=2026-11-05&theme=port` · `…=chantier` · `…=canyon` · `…=banquise` · `…=jungle` · `…=nuit` (monte au-delà de 20 m : le décor défile en profondeur et change en altitude ; `&bot` rejoue la partie du bot).
