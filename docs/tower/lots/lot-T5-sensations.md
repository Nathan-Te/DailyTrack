# Lot T5 — Sensations

Branche `claude/eager-hopper-atwnmd`. **Tower reste `off`.** Aucune règle de la simulation ne change : `TOWER_SIM_VERSION` (3), `TOWER_GENERATOR_VERSION` (3), golden, rediffusions de référence et fichiers de jours sont intacts. Règles et détail : `docs/tower/consignes.md`, « Sensations (lot T5) ».

## Livré
- **Les yeux qui paniquent** (affichage seul, dérivé de la vue) : quatre états (calme, inquiet, paniqué, affolé : sourcils, pupilles, yeux écarquillés, tremblement) calculés par une fonction pure de la vitesse, de l'inclinaison, du porte-à-faux et de l'oscillation de la tour ; la pièce active panique en approchant du vide et se détend posée à plat. Regard (le sol, ou la pièce active tant qu'elle tombe près), clignement tiré d'un **hasard d'affichage** séparé de la simulation. Expressions : chute (yeux écarquillés, pupilles en points vers le haut), figée (yeux fermés), lierre (soulagé), glissante (inquiète, la pupille file de côté).
- **Les effondrements** : secousse de caméra ≈ 200 ms (plus forte et plus longue pour une cascade), absente avec `prefers-reduced-motion` ; vies de la bande qui clignotent une fois ; **les pièces tombées passent devant la mer** (z propre, une eau « de devant » les cache) et finissent dans une **gerbe d'eau aplatie** (gouttes basses et larges, deux ondes plates).
- **Le vent** : traînées en aplat plus nombreuses et variées ; la pièce active penche dans le sens du vent (affichage seul).
- **La plaque « Suivante »** : liseré (vert bonus / encre épais malus) et icône au trait de l'effet qui attend la prochaine pièce (`VuePartie.effetSuivant`, lecture seule).
- **Les sons** (Web Audio procédural, sans fichier) : clics de déplacement et de rotation ; choc de contact (hauteur selon la taille, volume selon la vitesse) ; palier (bonus qui monte, malus qui descend) puis effet ; sifflement de chute et « plouf » ; grondement d'effondrement ; souffle du vent en boucle ; fin de partie et fanfare par médaille ; petits cris de panique (une voix à la fois, rares, réglables à zéro). **Aucun son avant le premier geste.** Case « Sons » et volume **dans la pause** (`tower:sons`).
- **Les curseurs de sensation** (`?debug&tune`) : 27 curseurs + la largeur de plateforme, en deux groupes ; **toute partie jouée avec un réglage d'essai est marquée et jamais envoyée au classement** ; « Copier les valeurs » donne un seul bloc JSON pour le lot T5b.
- **Dans `tower-sim` (additif, sans effet par défaut)** : `ReglagesPhysique` (option `physique` de `Partie`), `boitesE` (tailles d'essai), `VuePartie.effetSuivant`.

## Les curseurs (valeurs de départ et bornes)
Groupe 1 — **parties d'essai** (s'appliquent à la partie suivante) ; groupe 2 — rendu et son (immédiat, sans version).

| G | Curseur | Départ | Bornes | Pas |
|---|---|---|---|---|
| 1 | Délai avant répétition | 167 ms | 50 à 500 | 1 tick |
| 1 | Cadence de répétition | 50 ms | 17 à 300 | 1 tick |
| 1 | Vitesse de chute | 2,5 m/s | 0,5 à 8 | 0,125 |
| 1 | Facteur de descente | 4 × | 1 à 12 | 1 |
| 1 | Hauteur d'apparition | 7 m | 2 à 14 | 0,5 |
| 1 | Frottement (pièces et plateforme) | 0,60 | 0 à 1,5 | 0,05 |
| 1 | Rebond | 0 | 0 à 0,9 | 0,05 |
| 1 | Force du vent (pas par poussée) | 1 × 12,5 cm | 1 à 6 | 1 |
| 1 | Période du vent | 10 ticks | 2 à 40 | 1 |
| 1 | Frottement de la pièce glissante | 0,05 | 0 à 0,6 | 0,01 |
| 1 | Taille de la petite pièce | 0,5 | 0,25 à 1 | 0,25 |
| 1 | Taille de la pièce géante | 2 | 1 à 3 | 0,25 |
| 1 | Seuil de contact (lâcher) | 0,030 m | 0,005 à 0,15 | 0,005 |
| 1 | Seuil de contact (soudure) | 0,030 m | 0,005 à 0,1 | 0,005 |
| 1 | Largeur de la plateforme | celle du jour | 3 à 10 m | 0,25 m |
| 2 | Panique des yeux | 1 × | 0 à 2 | 0,05 |
| 2 | Secousse de caméra | 1 × | 0 à 2 | 0,05 |
| 2 | Cris de panique | 0,5 | 0 à 1 | 0,05 |
| 2 | Inclinaison au vent | 4° | 0 à 12 | 0,5 |
| 2 | Traînées de vent | 10 | 0 à 12 | 1 |
| 2 | Volume : clics · contacts · paliers · chute et plouf · effondrement · vent · fin et médailles | 1 × | 0 à 1,5 | 0,05 |

Bloc copié (exemple, une ligne) : `{"delaiTicks":10,"cadenceTicks":3,"vitesseChute8":20,"facteurDescente":4,"hauteurApparition8":56,"physique":{"frottement":0.6,…},"plateformeDemi8":28,"plateformeForcee":false,"rendu":{…},"essai":false}`.

## Poids (gzip, `node apps/tower/tools/mesure.mjs`, contre `main` reconstruit à part)
| Ligne | Avant | Après | Plafond |
|---|---|---|---|
| `tower.jsCss` (l'accueil) | 36 817 | **36 800** | 39 000 |
| `tower.jeu` | 150 305 | **161 585** (+11 280) | 164 000 (marge 2 415) |
| `tower.anglais` | 2 795 | 4 027 | 8 000 |
| `tower.physique`, `tower.polices` | — | inchangés | |

L'accueil ne grossit pas : les textes français que seul le jeu lit sont à part (`catalogue.jeu.fr.ts`), les réglages d'essai et les tailles d'essai sont hors de `constantes.ts` / `sommet.ts` (`physique.ts`, `echelles.ts`). L'outil `?debug&tune` (≈ 1 900 o) est importé **dans** le jeu : un `import()` de plus l'aurait séparé en un morceau et fait grossir l'accueil de 16 o (liste des morceaux préchargés).

## Vérifié
- Tests unitaires (Vitest, sans navigateur) : `tower-sim` 236 (dont `essai.test.ts` : défauts = constantes, partie identique au bit près sans option, chaque réglage change la partie, vent, tailles, `effetSuivant` = l'effet réel des six effets) ; `apps/tower` : panique (bornes, états, hystérésis, analyseur), expression, événements (vues écrites à la main **et** vraie partie Rapier), sons (faux `AudioContext` : chaque événement joue son son, **rien avant le premier geste**, cris bornés), secousse + `prefers-reduced-motion`, décor devant la mer (ordre des profondeurs, un seul plouf, gerbe plafonnée), hasard d'affichage séparé de la simulation, curseurs (chaque curseur du groupe 1 empêche le classement ; le groupe 2 non). Golden de `tower-sim` et déterminisme : verts.
- `tsc -b` ; `npm run traductions` (1 359 clés) ; budgets (`poids.spec.ts`) ; les 17 e2e de Tower en Chromium.
- Dans un vrai Chromium (SwiftShader) : la pièce perdue passe devant la mer et disparaît dans la gerbe (une planche de 14 images regardée), les yeux (calme, inquiet près du vide), la plaque « Suivante » avec l'icône du vent et les traînées avec la pièce penchée ; sans geste, `sons.pret` reste faux ; après une touche, 6 genres de sons joués, aucune erreur de console.

## Non vérifié
- **L'écoute** (aucune sortie audio ici) : les recettes (fréquences, durées, gains) sont raisonnées, pas entendues ; les volumes sont à régler à l'oreille avec les curseurs.
- **Le ressenti** des yeux (seuils de panique, tremblement), de la secousse et des cris : à jouer. Pas de téléphone, ni Firefox/WebKit (le test de déterminisme n'a pas changé), ni iPhone (l'audio y demande un geste : `touchend` est écouté).
- Le panneau `?debug&tune` à 27 curseurs n'a pas été essayé au doigt ; en 844 × 390 il est fermé de départ.
- Un e2e (`classement.spec.ts`, « partie scriptée ») a échoué une fois au premier lancement (attente de 5 s du fantôme Diamant, machine chargée), puis 6 fois sur 6 ensuite ; non reproduit.

## Questions pour Nathan
1. **Un réglage de sons commun manque** : Track garde `cdj:audio`, Jump `jump:settings`. Tower a sa case « Sons » et son volume **dans la pause** (`tower:sons`). À faire par un lot de plateforme (zone partagée, non touchée) : un réglage commun (`packages/ui`, `packages/profile`) et la clé `tower:sons` dans les deux pages de mentions légales — la clé est aujourd'hui une donnée de jeu effacée au « Nouveau départ » (un réglage devrait être gardé).
2. Les expressions **figée** (yeux fermés), **lierre** (soulagé) et **glissante** (inquiète) sont des propositions : à confirmer en jouant.
3. Les **cris de panique** : gardés discrets (0,5, un toutes les 3 s au plus) ; à zéro si tu n'en veux pas.
4. L'outil `?debug&tune` pèse 1 900 o dans `tower.jeu` ; je peux le séparer (`import()`) au prix de +16 o dans l'accueil — à toi de dire si 16 o de l'accueil valent 1 900 o du jeu.
5. La marge de `tower.jeu` est de 2 415 o : le lot T5b ou les maquettes d'archives devront la relever ou alléger.

## Liens de test (aperçu de la PR)
- Jouer avec le son : `/tower/?seed=2026-11-05` (les yeux suivent la pièce, puis paniquent quand la tour tangue ; une pièce qui tombe : sifflement, plouf, secousse ; provoque un effondrement).
- Régler : `/tower/?seed=2026-11-05&debug&tune` (bouge les curseurs, « Recommencer avec ces réglages », puis « Copier les valeurs » et envoie-moi le bloc).
- Le vent : `/tower/?scenario=paliers&effet=vent&debug&tune`.
