# Du Jour — l'interrupteur des jeux, puis Tower (3ᵉ jeu du jour)

Document de cadrage de Nathan pour l'agent du projet. Il contient deux chantiers, **dans cet ordre** :
1. **Lot P — l'interrupteur des jeux** (plateforme) : pouvoir activer ou désactiver un jeu en production sans redéployer, pour ne jamais publier par erreur un jeu en développement.
2. **Tower** : un troisième jeu du jour inspiré de *Tricky Towers*. Son seed est ci-dessous, ainsi que son premier lot, un **essai technique** de physique.

Les règles habituelles s'appliquent : un lot = une session neuve = une branche = une PR brouillon ; README d'une page ; l'agent s'arrête quand la CI est verte ; chaque lot donne **un scénario testable en deux clics** depuis l'aperçu ; chaque prompt de lot dit quelles modifications le lot apporte aux consignes (`CLAUDE.md` racine pour la plateforme, `docs/tower/consignes.md` pour Tower) ; zones partagées touchées seulement si le lot le dit. Adapte les noms de fichiers et de routes à ceux qui existent réellement dans le dépôt.

---

# Partie 1 — Lot P : l'interrupteur des jeux

## Contexte
Le portail (playdujour.com) réunit Track et Jump, et d'autres jeux vont arriver (Tower, puis l'arcade). Aujourd'hui, un jeu fusionné sur `main` est publié. Nathan veut décider **lui-même, depuis la page d'admin et sans redéploiement**, quand un jeu devient visible.

## Les trois états d'un jeu
| État | Accueil, journée, série, partage | Page du jeu `/<jeu>/` | API (envoi de résultats, classement) |
|---|---|---|---|
| **`off`** | absent | affiche « Bientôt » | refuse (`404 game_unavailable`) |
| **`preview`** | absent | jouable **avec la clé de prévisualisation** (lien donné par l'admin), sinon « Bientôt » ; un bandeau « Aperçu » est visible | accepte seulement avec la clé ; les résultats sont stockés à part et **jamais** affichés dans les classements publics |
| **`on`** | présent | jouable par tous | normal |

## Règles
- **Un nouveau jeu naît `off`.** Rien n'apparaît en production tant que Nathan ne l'a pas changé. Un test vérifie qu'un jeu absent de la configuration ou sans état explicite est traité comme `off`.
- **L'état vit en base** (table `games` ou équivalent : identifiant, état, `live_from`, date de modification), **modifiable depuis `/admin/`** (interrupteur à trois positions par jeu, avec confirmation), protégé par le jeton d'admin existant. La clé de prévisualisation est générée par l'admin, révocable, et n'est jamais stockée en clair (empreinte seule, comme les codes de transfert).
- **Le client lit `GET /api/games`** au chargement (réponse courte, cache de quelques dizaines de secondes, lectures en mémoire par instance comme les autres lectures). **Sans réseau ou si l'API ne répond pas**, le client se rabat sur une liste construite dans le site, où seuls les jeux déjà publics sont `on`. Un jeu en développement n'apparaît donc jamais par défaut.
- **La journée parfaite et la série ne bougent pas en cours de journée.** Un jeu ne compte dans la journée qu'à partir du premier jour **entier** où il est `on` (`live_from` = jour suivant l'activation). Le désactiver le retire de la journée dès le jour suivant, sans casser les séries déjà acquises. Tests à dates fixes.
- **Désactiver un jeu ne supprime rien** : ses résultats restent en base et réapparaissent à la réactivation.
- **Les aperçus de branche** montrent tous les jeux (y compris `off`), avec un badge « brouillon », pour que les lots restent testables en deux clics.
- Le changement d'état est journalisé (sans données personnelles).

## Critères d'arrêt
- CI verte ; tests de l'API doublés sur SQLite et libSQL comme toutes les requêtes.
- En local et sur l'aperçu : passer Jump de `on` à `off` le fait disparaître de l'accueil, rend `/jump/` « Bientôt » et fait refuser un envoi par l'API ; le repasser à `on` le rétablit, résultats compris.
- Golden de Track et Jump inchangés ; aucune version de simulation modifiée.
- `docs/mise-en-ligne.md` indique la marche à suivre pour publier un nouveau jeu (`off` → `preview` → `on`).

## Modifications de `CLAUDE.md` (racine)
Ajouter une section **« Publication des jeux »** : les trois états, « un nouveau jeu naît `off` », la règle `live_from`, le fait que tout nouveau jeu doit s'enregistrer dans la configuration des jeux et respecter l'état côté client **et** côté API.

## À tester par Nathan (deux clics)
Sur l'aperçu : `/admin/` → passer Jump à `off` → recharger l'accueil (Jump a disparu) → le repasser à `on`.

---

# Partie 2 — Seed de Tower

Source de vérité du jeu, à déposer dans `docs/tower/seed.md` ; seul Nathan le modifie. Code dans `packages/tower-sim` et `apps/tower`, publication sous `/tower/`, **état `off` tant que Nathan ne l'a pas changé**.

## 1. Le jeu en une phrase
Chaque jour, la même suite de pièces et la même plateforme pour tout le monde : on empile, la tour tangue, on perd une vie à chaque pièce qui tombe, et l'on vise la plus haute tour possible quand la dernière pièce est posée.

## 2. Les piliers
1. **Une partie courte et bornée.** Une suite d'un nombre fixe de pièces (point de départ : 40), soit environ 2 minutes de jeu. Essais illimités dans la journée.
2. **La même tour possible pour tous.** Suite de pièces, plateforme, bonus et malus : tout vient de la graine du jour.
3. **La physique est le jeu.** Les pièces vacillent, glissent et basculent : c'est la source de la tension et des effondrements spectaculaires.
4. **Un score est une preuve.** La partie est déterministe et rejouée par le serveur, comme Track et Jump.
5. **Jouable partout.** Des commandes discrètes, aussi bonnes au tactile qu'au clavier.

## 3. Une partie
- **Les pièces** : des polyominos (les sept tétrominos au premier jalon), tombant une à une à vitesse constante depuis le haut de l'écran. Le joueur voit la pièce suivante.
- **Commandes** : gauche et droite par demi-case, rotation de 90°, descente accélérée. Dès qu'une pièce touche la tour, le joueur n'a plus la main dessus et la suivante apparaît. Au tactile : zones ou boutons larges, à régler en lot.
- **La plateforme** : la même pour tous le jour donné, assez étroite pour que la tour déborde vite.
- **Les vies** : 3. **Chaque pièce qui tombe sous le niveau de la plateforme coûte une vie**, y compris les pièces de la tour emportées par un effondrement (une cascade peut coûter plusieurs vies). À 0 vie, la partie s'arrête.
- **La fin** : toutes les pièces posées, ou plus de vies. On attend alors que la tour se stabilise (toutes les pièces immobiles, au plus 5 s).
- **Le score** : la **hauteur finale stable**, au millimètre (point le plus haut d'une pièce posée sur la tour). Départage : vies restantes, puis temps. La hauteur maximale atteinte est affichée, mais ne compte pas.
- **Les paliers** : tous les 10 m de hauteur stable, un **bonus ou malus du jour** se déclenche, le même pour tous au même palier. Premier jalon :
  - bonus : *lierre* (la pièce suivante se colle à ce qu'elle touche), *pièce figée* (la pièce suivante devient immobile une fois posée), *petite pièce* ;
  - malus : *pièce géante*, *coup de vent* (poussée latérale pendant trois pièces), *pièce glissante*.
- **Médailles** : bronze, argent, or et **score de l'auteur**, calculé par un bot (§ 5).
- **La ligne à partager** : `Tower #12 — 42,7 m — 🥇 — ❤️❤️🖤`.
- **Fantôme** : la silhouette de sa meilleure tour, en transparence derrière la tour en cours.

## 4. Direction artistique
Dans la famille du portail : aplats francs, couleurs vives, zéro asset. Les pièces ont **de petits yeux qui paniquent** quand la tour tangue (affichage seulement, comme le personnage de Jump). Une palette et un fond par thème du jour, le vent rendu visible par des traînées, un effondrement court et lisible (secousse coupable, sons Web Audio procéduraux). La caméra monte avec la tour.

## 5. Le contenu du jour
- `dailyTower(jour)` pur : graine tirée de la date (même règle de changement de jour que Track et Jump), suite de pièces (sac mélangé pour éviter les séries absurdes), plateforme, tirage des bonus et malus par palier, thème.
- **Le bot de l'auteur** : pour chaque pièce, il essaie les positions et rotations, simule jusqu'à stabilisation et garde le meilleur compromis hauteur/stabilité (glouton). Son score donne les médailles (point de départ : or = auteur × 0,90, argent × 0,75, bronze × 0,55 ; à calibrer). Il tourne une fois par jour, côté serveur, et son résultat est mis en cache, comme la génération de Track. **Si son coût est trop élevé**, on se rabat sur une estimation géométrique (aire des pièces / largeur de la plateforme), à mesurer.

## 6. Technique
- Même architecture que Track et Jump : `packages/tower-sim` pur (pas fixe, commandes entières par tick, aucune lecture d'horloge ni de hasard non semé), `apps/tower` (Vite + Three.js orthographique), rediffusion = preuve, `TOWER_SIM_VERSION` et `TOWER_GENERATOR_VERSION`, golden tests, test de déterminisme Node ↔ Chromium ↔ Firefox ↔ WebKit.
- **Le moteur physique est la grande inconnue** : contacts empilés entre corps rigides, frottement, mise en sommeil. Il sera choisi par l'**essai technique du lot 0**, sur des mesures.
- **Coût serveur** : rejouer 2 minutes de physique avec 40 corps coûte bien plus qu'un tour de Track. À mesurer dès le lot 0 ; Cloud Run (1 vCPU) et la limitation de débit existante doivent tenir.

## 7. Hors du premier jalon
Autres formes de pièces, sorts lancés par le joueur, mode puzzle (poser sous un laser), mode course, multijoueur et classement par rang (plus tard, avec la « fête »).

## 8. Références
*Tricky Towers* (WeirdBeard) pour la mécanique : on reprend les principes, **ni son nom ni son style visuel**.

## 9. Plan en lots
- **Lot T0 — Essai technique de la physique** (détaillé ci-dessous). **Décision de Nathan** à la fin.
- **Lot T1 — Une partie jouable** : pièces, commandes clavier/manette, caméra, vies, fin, score, suite fixe d'essai. **À tester** : `/tower/?scenario=essai`.
- **Lot T2 — Rediffusion et contenu du jour** : enregistrement, rejeu exact (4 environnements), golden ; `dailyTower` ; paliers de bonus et malus. **À tester** : `/tower/?seed=AAAA-MM-JJ` sur trois dates, `?scenario=paliers` (tour pré-montée juste sous le palier de 10 m).
- **Lot T3 — Bot, médailles et thèmes.** **À tester** : `?seed=…&bot` pour regarder le bot jouer, puis battre sa médaille.
- **Lot T4 — Branchement à la plateforme** : classement prouvé côté serveur, journée, série, partage, carte d'accueil, tactile. Le jeu passe à `preview`. **À tester** : le lien de prévisualisation sur téléphone.
- **Lot T5 — Sensations** : yeux paniqués, sons, effondrements, réglages de sensations par Nathan (`?debug&tune`). Ensuite, Nathan passe le jeu à `on`.

---

# Partie 3 — Prompt du lot T0 : essai technique de la physique

## Contexte
Lis `CLAUDE.md`, le guide technique, et `docs/tower/seed.md`. Tower repose sur une physique de corps rigides empilés, qui doit donner **exactement** le même résultat sur Node et dans les trois navigateurs, puisque le serveur rejoue chaque partie. Avant de construire le jeu, on choisit le moteur sur des mesures. Le lot P (interrupteur des jeux) est fusionné : Tower est `off` en production.

## Objet
Comparer deux moteurs sur le même banc d'essai, mesurer, recommander. Pas de jeu, pas d'interface au-delà d'une page de démonstration.

## À livrer
1. **Deux implémentations derrière une même interface** (`createWorld`, `addPiece`, `step`, `snapshot`) dans `packages/tower-sim/lab/` :
   - **A — moteur maison** minimal en TypeScript pur : polygones convexes (un tétromino = plusieurs boîtes soudées), collisions par axes séparateurs, contacts avec frottement, solveur à impulsions séquentielles à nombre d'itérations fixe, mise en sommeil ; trigonométrie par tables, mêmes interdits que les autres simulations ;
   - **B — Rapier 2D dans sa version déterministe** (vérifie le nom exact du paquet et sa promesse de déterminisme entre plateformes dans sa documentation ; version figée), chargé en WebAssembly côté client **et** côté serveur.
2. **Le banc d'essai** : une suite fixe de 40 pièces posées selon une suite fixe de commandes (positions, rotations, instants), sur une plateforme étroite, avec au moins un effondrement provoqué. Les deux moteurs rejouent la même suite.
3. **Mesures** (dans le README, avec la méthode) :
   - **Déterminisme** : empreinte de l'état final (positions et angles exacts de toutes les pièces) identique sur Node, Chromium, Firefox et WebKit, pour chaque moteur. Test automatisé (Vitest + Playwright, comme `replay.spec.ts`).
   - **Coût d'un rejeu complet** sur Node (ms, médiane sur 20 passes), et estimation pour Cloud Run (1 vCPU).
   - **Poids ajouté au chargement** du jeu (Ko compressés).
   - **Stabilité** : une tour de 40 pièces posées proprement reste-t-elle immobile, sans tremblement ni dérive, pendant 30 s ?
   - **Coût d'un tour de bot** (une pièce essayée en ~40 positions × 4 rotations jusqu'à stabilisation), pour savoir si le bot de l'auteur est faisable.
4. **Une page de démonstration** `/tower/?scenario=banc&engine=a|b` : le banc rejoué à l'écran, plus un mode libre (`&libre`) où l'on lâche des pièces au clavier pour **juger la sensation** (est-ce que ça tangue comme il faut ?), avec un panneau `?debug&tune` (gravité, frottement, rebond, itérations).

## Critères d'arrêt
- CI verte ; tests de déterminisme écrits pour les deux moteurs. Un moteur qui **échoue** au test du bit près n'est pas une erreur du lot : c'est un résultat, à documenter (où l'écart apparaît, après combien de pas).
- Les mesures du point 3 sont toutes dans le README.
- Aucune version de Track ou de Jump modifiée ; golden inchangés ; Tower reste `off`.
- **Le README se termine par une recommandation argumentée** (A, B, ou ni l'un ni l'autre avec la raison) et les **questions qui reviennent à Nathan**. Ne construis pas le jeu sur le moteur choisi : c'est le lot T1, après la décision de Nathan.

## Modifications des consignes
Crée `docs/tower/consignes.md` (importé par le `CLAUDE.md` racine, comme celles de Jump) : emplacements, règles de déterminisme de `tower-sim`, règle « Tower naît `off` », commandes du banc d'essai. Si Rapier est essayé, ajoute la règle provisoire : « dépendance externe autorisée dans `packages/tower-sim/lab/` seulement, version figée ». Dans le `CLAUDE.md` racine, seulement la ligne d'import.

## Hors périmètre
Gameplay, vies, score, bonus, classement, interface, tactile, génération du jour.

## Règles rappelées
Ne jamais désactiver ni affaiblir un test ; ne pas régénérer de golden ; zones partagées seulement pour la ligne d'import et l'ajout éventuel de la dépendance Rapier (avec une ligne de justification) ; pas de secret dans le dépôt.

## Rapport attendu
`docs/tower/lots/lot-T0-physique.md`, une page : le tableau des mesures (A contre B), ce qui est vérifié / non vérifié, la recommandation, les questions pour Nathan, et **les liens de test** : `/tower/?scenario=banc&engine=a`, `…&engine=b`, `…&libre&debug&tune`.
