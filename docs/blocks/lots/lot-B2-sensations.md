# Lot B2 — Blocks : HUD de la maquette A et sensations

Branche `ccr-d07f77f3-b999xf` (celle que la session impose ; le prompt disait `blocks/b2-sensations`), PR brouillon `jeu:blocks`. Jeu `off` : « Pour les joueurs » = `rien`. Partie de `main` à jour (B1 fusionné, PR #269).

## Ce qui est fait
- **Maquette A** : la teinte de l'étiquette est celle de la fiche (`#B8D8F4` / `#1F4E79`) : **rien à changer, `npm run fiches` lancé** (seule la liste des specs a bougé). HUD sur mesure en portrait, paysage et bureau (`miseEnPage.ts`, pur, testé) : plaques **score** et **combo** (moutarde dès ×2, deux carrés = poses sans effacement encore permises) dessinées par la scène ; **fantôme** et **pause** : les boutons du kit, restylés (`blocks.css`) ; zone « Ta pièce » saisissable et « Suivante » en pointillés (pour information) ; ligne d'aide avant la première pose ; « Combo ×n ! », « Plateau vide ! +300 », « Plus de place ! » en pastilles ; gain **total** flottant à l'endroit de l'effacement. Clés `fr` + `en` de B0 (sauf `hud.combo.aria`, non utilisée) ; `hud.combo` devient le libellé « Combo » et l'ancien « Combo ×{n} » (lecteurs d'écran) s'appelle `hud.combo.lecteur`.
- **Sensations** (`effets.ts`, `yeuxBlocks.ts`, `sons.ts`, `sonsLogique.ts`, `scene.ts`) : la ligne s'illumine, ses yeux se ferment, contents, puis elle éclate en particules de sa couleur (lignes et colonnes d'une pose ensemble, 160 particules au plus) ; combo qui monte d'**un demi-ton exact** à chaque palier (jusqu'à l'octave) ; plateau vide : célébration, confettis, +300 ; la perte du combo se voit (plaque qui se vide en douceur, sans son ni message) ; yeux : une paire par morceau de pièce, qui clignent et **regardent la pièce qu'on déplace** (l'ombre au clavier) ; panique à « Plus de place ! » ; sons Web Audio procéduraux : prise, pose, pose refusée (la pièce revient en vol), effacement, combo, plateau vide, fin. Les effets suivent l'horloge de l'écran et **ne bloquent jamais la pose suivante**. « Mouvements réduits » : ni particules, ni rebond, ni clignement.
- **Prise en main** : plus de décalage. La pièce reste **sous le doigt au point exact touché** (la case touchée reste sous le pointeur tout le glisser, souris et doigt) ; elle grossit à la taille des cases ; ombre hachurée et anneaux sur les lignes à effacer. `decalage` supprimé de `?debug&tune`, de `essai.ts`, de la scène.
- **Catalogue v2** : **grand T de 5 cases** (4 orientations, famille T, poids 2, boîte 3 × 3 : « très grosse pièce » et `boite33` avec leurs garde-fous), **pièce de 1 case retirée** (« petites » = deux dominos) ; **40 pièces**. `BLOCKS_GENERATOR_VERSION` = 2 (règles v1 inchangées), golden régénéré. Seule la v2 est appelable (la v1 n'a jamais servi un jour classé). Aucun autre réglage de la rampe.
- **Scénario `combo`** : quatre dominos en (6, 4), (6, 5), (6, 6), (6, 7) effacent chacun une ligne : combo ×1 à ×4, scores 12, 34, 66, 108.

## Rampe, avant / après (1 000 graines, `npm run mesure:rampe`, glouton simple)
| rampe | catalogue | min | Q1 | médiane | Q3 | max | score médian | score max |
|---|---|---|---|---|---|---|---|---|
| défaut (4, 80) | v1 : 37 pièces | 8 | 22 | **30** | 42 | 131 | 458 | 7 337 |
| défaut (4, 80) | **v2 : 40 pièces** | 8 | 20 | **27** | 38 | 95 | 388 | 3 522 |
| sans rampe (0) | v1 | 8 | 27 | 40 | 63 | 237 | 638 | 5 407 |
| sans rampe (0) | **v2** | 9 | 24 | 35 | 53 | 192 | 517 | 5 907 |
Les parties raccourcissent d'environ 10 % : le grand T (5 cases, boîte 3 × 3) pèse comme un grand L et la pièce de 1 case, qui sauvait des fins de partie, a disparu. Le glouton ne regarde pas la pièce suivante : à recalibrer en B3 avec le Diamant.

## Recommandations de B0 : ce qui est appliqué
Q1 teinte : **A** (décision de Nathan, ni B ni C). Q2 Rubik Mono One : oui (inchangé). Q3 gain : **total** (« +270 », pas « +90 »). Q4 couleur **par famille**. Q5 yeux **une paire par pièce posée, chaque morceau reconnecté garde la sienne**. Q6 deux carrés du combo : gardés. Q7 suivante **à côté** de la pièce du moment (portrait) ou dessous (paysage). Q8 HUD à plaques : **appliqué dans le jeu faute de lot de plateforme** (voir manques). Q9 plein écran en paysage/bureau : **non appliqué** (le bouton plein écran est celui de l'accueil du kit ; pas de place dans le HUD du kit). Q10 marges de 8 px pour la grille : oui. Q11 annonces : **ombre encre**, la terre cuite reste à « Rejouer ». Q12 bouton fantôme à trois états visibles (pointillés / moutarde / diamant) : oui, mais il ne devient utile qu'avec B4.

## Manques du kit, du module commun et de la plateforme (rien n'a été codé hors zone)
1. **Vibration : aucune.** Le kit n'a ni réglage de vibration ni `vibration` dans `OptionsPartie` ; le prompt interdit un réglage local au jeu. À ajouter au kit : `ReglagesJoueur.vibration` (Réglages › Affichage, allumée par défaut), exposée dans `OptionsPartie`. Appels prévus ensuite : `navigator.vibrate(15)` à l'effacement et `(40)` à la fin (`scene.ts`, là où `jouerSon` est appelé).
2. **Pas de réglage des effets sonores dans le kit.** Les sons passent par le volume et le « couper » de la **musique commune** (`lecteur().reglages()`), seul réglage de son du kit ; ses libellés disent « Volume de la musique » / « Couper la musique » : un joueur qui coupe la musique coupe aussi les effets. Un réglage « Effets » (ou un libellé « Son ») serait plus juste.
3. **HUD à plaques (B0, question 8)** : `.jeu-hud` du kit est une bande pleine largeur. Ici `blocks.css` la sort du flux (boutons seuls, en haut à droite), cache ses textes à la vue (ils restent pour les lecteurs d'écran) et la scène dessine les plaques. Dépend des classes `.jeu-hud*` et `.jeu-plateau` du kit : un lot de plateforme qui donne des plaques au kit supprimerait ce contournement.
4. **Étiquette** : la maquette dessine une grille avec une pièce à yeux ; la fiche garde `dessin: "generique"` (un dessin `propre` s'écrit dans `packages/ui`, zone partagée).
5. **Module commun** : **aucun manque bloquant**. `expressionDe` (clignement, `regard`, genre `figee` = yeux fermés) et `regardVers` font le regard et la fermeture ; le « content » est un trait d'encre (pas de sourire). Tower est inchangé (`packages/visuels` non touché).
6. **Jetons** : aucun manque. `--dj-ombre-bouton`, `--dj-trait`, `--dj-moutarde`, `--dj-diamant`, `--dj-ombre-cartouche` suffisent ; les `--blocks-*` proposés par B0 n'ont pas été créés.
7. Hérités de B1 : `OptionsPartie` sans langue ni traducteur (contournement : `fournirTraduction`) ; pas de drapeau « jamais classée » ; `@cdj/visuels` absent de `apps/blocks/package.json`.

## Vérifié
- `npm run verifier` : **tout vert** (typecheck, unitaires SQLite et libSQL, constructions, e2e Track, Jump, Tower, Cibles, **Blocks 8 specs (34 tests)**, budgets). `npm run consignes` et `npm run traductions` à jour.
- Unitaires : catalogue de 40 pièces (grand T et ses garde-fous, plus aucune pièce de 1 case sur 1 000 graines), golden v2, scénario `combo`, effets, yeux, sons (le demi-ton exact par palier, le niveau suit le kit), mise en page (rien ne se recouvre, chaque pièce tient dans sa zone), essai. Les tests de règles qui s'appuyaient sur la pièce de 1 case ont été réécrits avec des dominos et le coin de 3 cases, **mêmes cas, mêmes valeurs attendues** (un test de plus : la fin détectée après la pose qui bouche la dernière place) ; le test du poids de la rediffusion mesure maintenant ce que les poses ajoutent au texte (la borne d'avant dépendait de la longueur de la partie).
- E2E : `glisser` (la case touchée reste sous le pointeur, souris et événements tactiles CDP ; la pose tombe sous le doigt), `disposition` (HUD dans 390 × 844, 360 × 640, 844 × 390, 1280 × 720 : boutons du kit de 44 px, rien ne se recouvre), **`sensations`** (nouveau : `combo`, carrés et perte du combo, illumination puis particules, **pose pendant les effets**, yeux qui regardent, plateau vide, mouvements réduits), `scenarios`, `partie`, etc. inchangés. 4 captures regardées (portrait, effacement, paysage en glisser).

## Non vérifié
- **Aucun essai sur un vrai téléphone** : le geste est émulé (CDP) ; les 60 images par seconde ne sont **pas mesurées** (plafond de 160 particules, un chemin par bloc ; à profiler sur appareil).
- **Le son n'a jamais été écouté** : testés, la décision (notes, hauteurs, niveau) et la lecture sur un contexte audio factice.
- Thème sombre (fonds, plaques) vu en lecture du code seulement ; Firefox et WebKit non lancés ; contraste des couleurs de pièces sur les fonds de thème : B3.

## Poids
`blocks.jsCss` : **44 893 octets** (44 574 avant, +319 : catalogues et `kitSon`) ; la ligne de 47 Ko de `budgets.md` tient (marge 2 107). Tout le reste (scène, effets, yeux, sons) est dans le chunk à la demande `corps-` (≈ 28 Ko avant compression). **Aucune ligne à changer.** `budgets.md` n'est pas modifié (zone partagée).

## Pour Nathan
Quatre décisions : (1) vibration et réglage des effets : un lot de kit ; (2) HUD à plaques dans le kit ; (3) plein écran dans le HUD ; (4) dessin propre de l'étiquette. **Zone** : `config/jeux/projections/ci.json` et `docs/plateforme/traductions.md` sont régénérés (exceptions permises).

## Liens de test (voir le message de fin)
`npm run build -w @cdj/blocks && cd apps/blocks && npx vite preview --port 4179`, puis `http://localhost:4179/?debug&tactile=1&scenario=combo` (cliquer JOUER : le son attend un geste), `…&scenario=presque-plein`, `…&scenario=plateau-vide`, `…&scenario=blocage`.
