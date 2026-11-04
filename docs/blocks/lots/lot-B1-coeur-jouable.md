# Lot B1 — Blocks : le cœur jouable

Branche `claude/blocks-b1-coeur-jouable-a2os71` (PR brouillon, étiquette `jeu:blocks`). Jeu `off` : « Pour les joueurs » = `rien`.

## Ce qui est fait
- **Simulation** (`packages/blocks-sim`) : grille 8 × 8 en **deux entiers de 32 bits** ; 37 pièces (chaque orientation distincte) ; suite du jour tirée de `Rng` / `mixSeed` de `@cdj/core` (un générateur par rang, jamais la grille) ; rampe réglable ; garde-fous ; plafond de 2 000 pièces ; barème du seed § 5 (cases, `10 × n × n × combo`, combo perdu à la 3ᵉ pose sans effacement, +300 plateau vide) ; action = `ligne × 8 + colonne` sur un octet ; règles v1, tirage v1 ; golden régénéré. Variante `score`.
- **Fiche** : score ↓, combo ↓ (`npm run fiches` lancé). **Serveur** : `apps/api/src/blocks.ts` rejoue la liste des poses et refuse pose illégale, pose après la fin, suite au-delà du plafond, partie non terminée, scénario ; renvoie score et combo maximal. Module d'essais réécrit (glouton + variantes distinctes).
- **Scène** (`apps/blocks`) : blocs du module commun `@cdj/visuels/blocs` (canvas), disposition portrait / paysage / bureau, glisser-déposer (pièce flottante au-dessus du doigt, ombre aimantée, lignes surlignées, retour à la place), clavier et manette (ombre case par case, `poser`), « +n » flottant, combo dans le HUD du kit, « Plus de place ! » 1 s avant l'écran de fin. Catalogues fr + en. Scénarios `presque-plein`, `blocage`, `plateau-vide` ; `?seed=` (kit) ; `?debug&tune&rampe=pente,rangMax&decalage=cases`.
- `apps/blocks/CLAUDE.md` (créé par B0, section « Maquettes » intacte) reçoit Règles, Représentation, Versions, Scénarios et Hors lot B1 ; `docs/blocks/consignes.md` garde l'état et « Où est quoi ».
- Le vocabulaire de Cibles a disparu de `apps/blocks`, `packages/blocks-sim`, des catalogues et des tests de Blocks (la `passation.md` générée en garde un reste, voir « Manques »).

## Décisions de ce lot (à relire)
- **« Très grosse pièce » = 6 cases ou plus, OU boîte de 3 × 3** (ta proposition) : le carré 3 × 3, les 4 grands L et les rectangles 2 × 3 / 3 × 2 (7 pièces). Aucune parmi les rangs 0 à 5.
- **« Jamais deux 3 × 3 d'affilée »** lu comme **boîte de 3 × 3** (le carré 3 × 3 et les grands L), pas seulement le carré. Plus strict que la lecture littérale ; une ligne à changer (`boite33` dans `pieces.ts`) si tu préfères le carré seul.
- **Rampe** : poids = `poids × (100 + pente × grosseur × min(rang, rangMax))`, grosseur 0 (1 à 3 cases : poids fixe), 1 (4), 2 (5), 3 (6 ou plus). Défaut **pente 4, rangMax 80** (au rang 80 une pièce de grosseur 3 pèse 10,6 fois son poids de base). Poids de base : petites 3–4, barres 8 / 6 / 4, carré 2 × 2 : 9, 3 × 3 : 3, coins 8, L et J 6, grands L 2, T 6, S et Z 5, rectangles 3. **À calibrer** : ce sont des points de départ.
- **Médailles** : aucune avant B3. Côté serveur `seuils` rend `null` ; côté client les seuils sont à zéro (voir « Manques »).
- Le glouton d'essai (`@cdj/blocks-sim/glouton`, hors de l'index) **n'est pas le Diamant** ; il sert aux tests, aux essais du serveur et à la mesure de la rampe.

## Réponse sur le départage
**« Premier arrivé » est déjà natif** : toute table de résultats départage par `submitted_at` croissant puis `player_id` (les deux dernières colonnes de `classement.colonnes`, que le module serveur ajoute et que `npm run fiches` valide). **Deux critères suffisent dans la fiche** (score, combo) ; test serveur : à score égal le plus grand combo passe devant même arrivé après, puis à égalité totale le premier arrivé.

## Durée médiane du glouton simple (pour calibrer la rampe)
1 000 jours (2026-11-02 et suivants), `npm run mesure:rampe -w @cdj/blocks-sim -- --graines=1000` :
| rampe | min | Q1 | **médiane** | Q3 | max | score médian |
|---|---|---|---|---|---|---|
| défaut (4, 80) | 8 | 22 | **30 pièces** | 42 | 131 | 458 |
| sans rampe (pente 0) | 8 | 27 | 40 pièces | 63 | 237 | 638 |
Le glouton joue la position qui laisse la meilleure grille (effacement, cases isolées, périmètre) **sans regarder la pièce suivante** : un joueur humain, et le Diamant de B3, iront nettement plus loin. La suite étant indépendante de la grille (pas de tirage « qui aide »), une partie peut finir tôt sur une mauvaise suite.

## Vérifié
- `npm run typecheck` ; tests unitaires SQLite et libSQL (blocks-sim : 70+ tests dont pureté, déterminisme, garde-fous et rampe sur 1 000 graines, rejeu et refus des rediffusions trichées ; serveur : classement, copies, aperçu, effacement, groupe ; app : fiche, mise en page, options d'essai, boîtes).
- e2e Chromium (`apps/blocks/e2e`, 7 specs (25 tests), déclarés dans la fiche et `durees.json`) : `partie`, `glisser` (souris, **événements tactiles par CDP**, clavier, retour de la pièce), `scenarios` (dont « jamais classé » avec un vrai serveur), `disposition` (390 × 844, 360 × 640, 844 × 390, 1280 × 720), `classement`, `determinisme`, `poids`.
- Budget : `blocks.jsCss` **44 574 octets** mesurés. Le corps du jeu (tirage, scène, blocs communs) est un chunk à la demande `corps-` (nommé dans `budget.aLaDemande` de la fiche) ; sans ce découpage : 47 919. **La ligne passe de 45 à 47 Ko** : le plafond de 45 Ko était celui du modèle (« à fixer avec la mesure du jeu »), et la règle de `budgets.md` (mesure + 5 % et 2 Ko, au Ko supérieur ; `apps/portail/test/budgets.test.ts`) donne 47 Ko pour 44 574. C'est une décision de budget pour Nathan : ligne `blocks.jsCss` de `docs/plateforme/budgets.md`.
- `npm run verifier` : typecheck, tests unitaires SQLite et libSQL, constructions, budgets, e2e Blocks verts, **sauf le test de `consignes` ci-dessous**. CI de la PR (run 41901251453) : tout vert **sauf trois jobs rouges qui viennent de deux défauts de la plateforme, pas de ce lot** (voir « CI rouge »).

## Non vérifié
- **Aucun essai sur un vrai téléphone** : le geste tactile est émulé (CDP) ; la sensation du décalage (1,3 case) est à juger au doigt. Firefox et WebKit : le spec `@navigateurs` n'a pas été lancé ici (Chromium seul installé).
- Pas de capture de la musique, du plein écran ni des Réglages (ce sont ceux du kit, inchangés). Le thème « sombre » n'a été vu qu'en lecture du code (mêmes pièces, fonds différents).

## Manques du kit, du module commun et des zones partagées (rien n'a été codé hors zone)
1. **`OptionsPartie` ne donne ni langue ni traducteur** : la scène écrit « Combo ×n », « +n pts », « Plus de place ! ». Contournement : `brancherJeu(...)` rend `i18n`, que `main.ts` fournit à `textes.ts`. Un champ `t` dans `OptionsPartie` le supprimerait.
2. **Rien dans le kit ne dit « cette partie n'est jamais classée »** (scénario, rampe réglée). Contournement : `essai.ts` met la page en archive (`?seed=` de la veille) avant que le kit lise l'adresse ; la rediffusion d'un scénario nomme le scénario et le serveur la refuse. Un drapeau `classable` dans la définition serait plus direct.
3. **Pas de « jeu sans médaille »** : l'écran de fin liste Diamant / Or / Argent / Bronze avec leur valeur (0 ici). Disparaît avec B3.
4. **`@cdj/visuels` n'est pas déclaré dans `apps/blocks/package.json`** : la ligne correspondante de `package-lock.json` est hors des zones d'un jeu (le job `zones` la refuserait). Le lien d'espace de travail existe déjà, tout marche ; la référence est dans `apps/blocks/tsconfig.json`. À ajouter par un lot de plateforme.
5. **Module commun** : quatre cases autour d'un même point laissent un point d'encre au milieu d'un bloc (les ponts de `interieur` s'arrêtent à `retrait` du point). Contourné en dessinant **une boîte par suite de cases d'une ligne** (`boites.ts`) ; un correctif serait dans `relief.ts`. Les palettes de Tower ont 7 couleurs (une par forme de Tower) : les 8 familles de Blocks en partagent (`couleurs.ts`) ; les palettes par thème viennent en B3.
6. `docs/blocks/passation.md` (générée, régénérée ici par `--passation`) dit encore « squelette » et nomme Cibles : c'est le gabarit du générateur (`scripts/`, partagé).
7. Le `CLAUDE.md` racine n'a pas de ligne Blocks dans sa carte du dépôt (zone partagée).

## CI : deux défauts de la plateforme corrigés sur demande de Nathan
1. `apps/portail/test/consignes.test.ts` échouait déjà sur `main` (B0 a créé `apps/blocks/CLAUDE.md` sans l'ajouter à la liste) : une ligne ajoutée. Cela rendait rouges `unit (4/4)` et `jeu fictif (1/3)`.
2. `apps/api/src/fiches.generated.ts` (réécrit par `npm run fiches` à tout changement de fiche) n'était pas dans les exceptions de `scripts/zones-jeu.mjs` : ajouté, avec la liste attendue par `apps/api/test/zonesJeu.test.ts`.
**Reste rouge, par construction : le job `zones`.** Ces trois fichiers (`scripts/zones-jeu.mjs`, `apps/portail/test/consignes.test.ts`, `apps/api/test/zonesJeu.test.ts`) sont des zones partagées, qu'une PR de jeu ne peut pas toucher. Tous les autres jobs sont verts (run 41906872092). Pour un `zones` vert : fusionner ces trois lignes par une PR de la plateforme, puis fusionner `main` ici (`apps/api/src/fiches.generated.ts` n'est alors plus hors zone).

## Pour Nathan
Teinte de l'étiquette, premier jour et plafond du budget restent les tiens. Avant `on`, un lot de plateforme décrit les clés `blocks:*` dans les mentions légales.
