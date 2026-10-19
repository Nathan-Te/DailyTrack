# DailyJump — synthèse de l'état actuel (après le lot 13, le lot 3c et les lots P1 et P2 de la plateforme)

Point de départ de toute session DailyJump : cet état d'ensemble tient en quelques pages ; **chaque point renvoie au README du lot qui l'a introduit** (`lots/lot-….md`, dans ce dossier) pour le détail. Les règles à respecter sont dans `packages/jump-sim/CLAUDE.md` et `apps/jump/CLAUDE.md` ; la vision est dans `seed-dailyjump.md` (ne pas modifier). **À mettre à jour par chaque lot de DailyJump** (une ligne par point qui change, avec le renvoi).

Versions en vigueur : `JUMP_SIM_VERSION` **3** · `JUMP_GENERATOR_VERSION` **9** · `EXIGENCE_VERSION` **4** · `MODULE_FORMAT` **3** · premier niveau (`PREMIER_JOUR_JUMP`) : **16/10/2026**.

## 1. Architecture et paquets
| Paquet | Rôle | Lot |
|---|---|---|
| `packages/core` (`@cdj/core`) | socle sans logique de jeu, **partagé** avec DailyTrack : PRNG, calendrier, codage d'octets (base64url, varint), test de pureté | [0](lots/lot-0-socle.md) |
| `packages/clock` | jour de Paris (`parisDay`), **partagé**, jamais importé par une simulation | [0](lots/lot-0-socle.md) |
| `packages/jump-sim` (`@cdj/jump-sim`) | simulation pure : personnage, niveaux, dangers, rediffusions, morceaux, générateur du jour, thèmes ; outils hors `src/` (`tools/` : solveur, mesures) | 1 à 13 |
| `apps/jump` (`@cdj/jump`) | le jeu (Vite + Three.js, caméra orthographique), lecture seule de la sim | 0 à 13 |
- Publication sous `/jump/` du même site Pages (chemins relatifs, aperçus de branche en `…/b/<branche>/jump/`) ; stockage local préfixé `jump:` (`apercu:jump:` en aperçu) — [lot 0](lots/lot-0-socle.md).
- CI : les e2e suivent les règles de DailyTrack (matrice, rapport fusionné, une relance, instables nommés), projets `jump-chromium|firefox|webkit`, `apps/jump/e2e/durees.json` — [lot 3c](lots/lot-3c-ci.md) ; depuis le lot R2 une PR qui ne touche pas DailyJump ne lance pas ses e2e (`docs/plateforme/lots/lot-R2-hygiene.md`).
- Règles du socle : rien de logique de jeu dans `core`, golden des deux jeux inchangés — [lot 0](lots/lot-0-socle.md).

## 2. Physique et réglages
- État **entièrement entier** (1 tuile = 4 096 unités), pas fixe 120 Hz, `idiv` pour toute division, `tileOf` (`>> 12`) seul décalage permis, `MAX_SPEED` < 1 tuile/pas — [lot 1](lots/lot-1-personnage.md), [1b](lots/lot-1b-mobile.md).
- `stepPlayer` (collisions boîte contre grille, axe par axe) ; commandes = 3 bits (gauche, droite, saut tenu) ; réglages `JumpParams` (entiers, tableau en unités humaines dans le README du lot 1) — [lot 1](lots/lot-1-personnage.md).
- Dangers (pics, scies par sections, blocs friables, ressort), mort, réapparition 0,15 s, temps en pas, arrivée prioritaire sur la mort — [lot 2](lots/lot-2-dangers.md) ; points de passage `C` (franchir la colonne) — lot 2b dans le même README + [lot 4](lots/lot-4-morceaux.md).
- **Élan progressif : essayé puis écarté** (décision de Nathan), reste un essai `?debug&tune&sprint=1` — [lot 8b](lots/lot-8b-animation-elan.md), [8c](lots/lot-8c-elan.md).
- Rediffusion : séries `{count, bits}` en varint, bornée à 10 min, version dans l'en-tête, rejeu seule source de vérité de tout temps conservé — [lot 3](lots/lot-3-rediffusion.md).
- Tout changement de physique ⇒ `JUMP_SIM_VERSION` +1 et golden (`UPDATE_GOLDEN=1`) ; **les mécaniques de thème sont des ajouts purs** (réglages hors `DEFAULT_JUMP_PARAMS`, champs d'état absents quand inutilisés) — [lot 11](lots/lot-11-themes-jouables.md).

## 3. Mécaniques par thème (un thème = une mécanique)
| Thème | Mécanique | Caractères | Lot |
|---|---|---|---|
| usine | tapis roulants | `[` `]` | [11](lots/lot-11-themes-jouables.md) |
| glace | sol glissant | `~` | [11](lots/lot-11-themes-jouables.md) |
| nuit | blocs clignotants (deux groupes en opposition de phase, règle de sortie) | `b` `d` | [12](lots/lot-12-nuit-neon.md) |
| néon | blocs alternés (chaque saut inverse les jeux A/B, remise à A au point de passage) | `A` `B` | [12](lots/lot-12-nuit-neon.md) |
| forêt | zones de vent / courants d'air (haut, gauche, droite ; rafales) | annexe `vent` | [13](lots/lot-13-foret.md) |
- Le thème d'une date est une donnée du générateur (`jumpThemeForDay`) ; un thème forcé (`?theme=`) est un essai, jamais classé ni dans l'historique — [lot 11](lots/lot-11-themes-jouables.md). Aspect (palette, tuiles, décor, plans, ambiance) : [lot 9](lots/lot-9-themes.md) ; couleurs réservées (rouge des dangers, jaune du personnage) et seuils de contraste testés.
- Une mécanique arrive avec : événement, son, particules, contrastes, quota de signature (≥ 2 morceaux, 20–40 % du temps), morceaux étiquetés + `theme:`, mutateur réservé, groupes de repos rangés à la main, niveau de secours.

## 4. Morceaux, mutateurs, solveur, jouabilité humaine
- Un morceau = un fichier `packages/jump-sim/modules/<id>.txt` (format 3 : famille, enchaînement long, élan, mutateurs) ; palier standard de 2 colonnes, point canonique = bord droit d'un palier, `buildModule` pur — [lot 4](lots/lot-4-morceaux.md), [6](lots/lot-6-raccords.md), [7](lots/lot-7-variete.md).
- Variantes déclaratives (`repeter`) + **mutateurs** (plafond, fosse, sol-friable, ressort, patrouille, garde, dénivelé ; surfaces et mécaniques de thème), au plus 2 par variante, 6 variantes par morceau — [lot 7](lots/lot-7-variete.md).
- **Solveur** hors simulation (`tools/`) : `npm run solve:modules -w @cdj/jump-sim` (incrémental, empreinte + version), produit `modules/solutions.json` et `src/catalog.ts` (générés, à commiter) — [lot 4](lots/lot-4-morceaux.md). Seconde passe pour les blocs dynamiques et les rafales — [lot 12](lots/lot-12-nuit-neon.md), [13](lots/lot-13-foret.md).
- **Jouable par un humain** : gigue ±3 pas ≥ 50 % de réussite, raccord ≥ 90 % sur 25 positions, repli robuste du solveur — [lot 8c](lots/lot-8c-elan.md) ; appui de saut ≥ 5 pas et relâchement ≥ 3 pas (clavier) — [lot 11](lots/lot-11-themes-jouables.md) ; une respiration n'est jamais exigeante (≤ 2) — [lot 7b](lots/lot-7b-retouches.md). Exigence = note 1 à 5 d'après la gigue (`exigenceOf`).
- Règle des plats (6 tuiles, 9 avec `elan: oui`) et familles (une de chaque par niveau) — [lot 7](lots/lot-7-variete.md). Galerie `?modules`, outil `voir:module`.

## 5. Générateur du jour, quotas, versions
- `dailyLevel(jour[, thème])` assemble garde · palier de départ · morceaux · paliers partagés avec `C` · arrivée ; 6 à 13 morceaux, hauteur ≤ 56, temps de l'auteur dans [25 ; 40] s, médailles en pas entiers (or ×1,10, argent ×1,30, bronze ×1,60) — [lot 5](lots/lot-5-niveau-du-jour.md), [6](lots/lot-6-raccords.md).
- Validation par **rejeu complet** de la preuve de l'auteur ; 6 tirages, secours jamais utilisé (mesuré) ; budget d'exigence (445–570 dixièmes de point par minute), dernier tiers ≥ deuxième et ≥ premier, repos (7 groupes dont 4 ouverts), enchaînements longs 1 ou 2, plus longue course au sol ≤ 1,2 s en moyenne — [lot 5](lots/lot-5-niveau-du-jour.md), [7](lots/lot-7-variete.md), [7b](lots/lot-7b-retouches.md).
- Identifiant `jour-AAAA-MM-JJ-g<JUMP_GENERATOR_VERSION>` (`-t<thème>` si forcé). Tout changement du niveau d'une date ⇒ `JUMP_GENERATOR_VERSION` +1, `UPDATE_GOLDEN=1` sur `golden-daily`, puis `npm run measure:jump -w @cdj/jump-sim` (toute règle se juge à ses mesures, sur 120 dates).
- Chargement : worker de module, charge JSON, cache `jump:niveau:…` dont la preuve est rejouée — [lot 7b](lots/lot-7b-retouches.md).

## 6. Jours figés et procédure
- `apps/jump/public/levels/AAAA-MM-JJ.json` : niveau + preuve + versions, lu en premier par `loadDaily` et **rejoué** ; jamais réécrit — [lot 10](lots/lot-10-arrivee.md).
- **Règle : figer avant de changer de version.** Dans un worktree sur `main` à jour : `npm run freeze:days -w @cdj/jump -- demain`, copier `public/levels/` dans la branche, commiter — [lot 10](lots/lot-10-arrivee.md), [11](lots/lot-11-themes-jouables.md). Test `apps/jump/test/figes.test.ts` : chaque jour figé se rejoue.
- **Une seule règle des niveaux figés** (lot P1 de la plateforme) : `thawLevel` vit dans `jump-sim` (`src/frozen.ts`), le jeu et le serveur l'importent — [P1](../plateforme/lots/lot-P1-classement.md).
- Jours figés en g4 (16 et 17/10) contenant des passages que la règle actuelle refuserait — [lot 8c](lots/lot-8c-elan.md). Sort d'une archive sous une ancienne physique : question ouverte pour Nathan — [lot 10](lots/lot-10-arrivee.md).

## 7. Interface
- **Accueil** (page du jour, archives, aide « Comment jouer »), **écran d'arrivée** (médaille, temps de l'auteur, partage, série), **historique** `jump:historique` (niveau du jour joué le jour même seulement), **ligne à partager** — [lot 10](lots/lot-10-arrivee.md).
- Tactile : zones sans trou, cibles ≥ 44 px, cadrage 13 tuiles en paysage — [lot 1b](lots/lot-1b-mobile.md). Sensations (événements → son procédural, particules, secousse, menu ⏸, mouvement réduit) — [lot 8](lots/lot-8-sensations.md) ; animation du personnage calée sur la distance — [lot 8b](lots/lot-8b-animation-elan.md). Carnage et taches (rendu seul) — [lot 3](lots/lot-3-rediffusion.md).
- « Aujourd'hui » = date de Paris (`@cdj/clock`) ; sur le site publié, une date future est refusée (une porte, pas une protection) — [lot 5](lots/lot-5-niveau-du-jour.md).
- **Classement du jour (lot P1 de la plateforme)** : chaque essai réussi du niveau du jour meilleur que le meilleur envoyé part au serveur (`POST /api/jump/submit` : la rediffusion, jamais un temps), qui le **rejoue** et garde son temps et ses morts ; rang (« 3ᵉ sur 128 ») et top 10 à l'arrivée (ta ligne mise en valeur), rang du jour à l'accueil, rang au bout de la ligne à partager (`… — 47 💀 — 3ᵉ/128`) ; archives : classement figé ; file d'envois hors ligne (un seul envoi en attente par jour, délai qui s'allonge, reprise au retour du réseau) ; premier pseudo par `@cdj/profile` (celui de DailyTrack réutilisé) ; jamais d'envoi pour une archive, un thème forcé, une partie aux réglages modifiés, un morceau ou un scénario ; le jeu ne bloque jamais sur le réseau. Adresse : `?api=`, sinon `VITE_API_URL` (production pour `main`, recette pour un aperçu) — [P1](../plateforme/lots/lot-P1-classement.md).
- **Démonstration `?api=demo`** : joueurs fictifs « Démo … » sur 14 jours plus « aujourd'hui » (30/10/2026, joué comme niveau du jour), de vraies rediffusions validées par le vrai serveur en mémoire (`npm run jump:seed -w @cdj/api`, à relancer après tout changement de version), tout gardé à part (`demo:`) ; **recette** : `npm run recette:seed` remplit aussi le jour courant de DailyJump — [P1](../plateforme/lots/lot-P1-classement.md) ; depuis le lot P2 il tourne **tout seul** (chaque jour et après chaque déploiement de recette, `recette-seed.yml`) — [P2](../plateforme/lots/lot-P2-fantome-profil.md).
- **Fantôme du premier (lot P2 de la plateforme)** : la rediffusion du premier du classement du jour (`GET /api/jump/day/<date>/ghost/first`), **vérifiée par le rejeu du jeu** (une autre version est ignorée), court à côté de ton fantôme : **deux couleurs** (le tien cyan clair, le sien mauve, ni rouge des dangers ni jaune du personnage — les fantômes ne sont plus jaunes), **son pseudo au-dessus** ; pas de doublon quand tu es premier ; lu au chargement, à l'arrivée et après un envoi accepté ; réglage « Fantôme du premier » du menu, `?ghost=off|best|first`, **`?watch=first`** (et « Regarder le premier » à l'arrivée) ; archives : le premier de ce jour-là ; démonstration : `first` dans `public/demo/` — [P2](../plateforme/lots/lot-P2-fantome-profil.md).
- **Profil DailyJump synchronisé (lot P2)** : `GET /api/jump/me` (un profil par jeu ; le `/api/me` de DailyTrack ne change pas) fusionné avec `jump:historique` — **par jour, le meilleur temps gagne**, morts et essais du jour locaux gardés (jusqu'au lot P3), jours d'un autre appareil ajoutés, rien n'est supprimé, série recalculée ; code révoqué (410) signalé sans rien perdre — [P2](../plateforme/lots/lot-P2-fantome-profil.md).
- **Réglages › Profil (lot P2)** : pseudo et Renommer, Copier / Charger / Changer mon code, par `@cdj/profile` : **le même profil que DailyTrack** (« Ton profil est le même dans tous les jeux de la plateforme… ») ; charger un code dans DailyJump vaut aussi pour DailyTrack ; carte du profil à l'accueil (pseudo, série, médailles) — [P2](../plateforme/lots/lot-P2-fantome-profil.md).
- **Plateforme (lot P0)** : avec `?debug`, `__jump.profile` dit si une identité de la plateforme (`cdj:*`, celle de DailyTrack) existe et son pseudo, sans rien afficher ni créer ; le serveur sert `/api/jump/info` et `/api/jump/day/<date>` (le niveau calculé par la même règle que le jeu : figé d'abord, sinon `dailyLevel`), en lecture seule — [P0](../plateforme/lots/lot-P0-socle.md).

## 8. Outils
- Fantôme du premier et profil (lot P2) : `__jump.firstGhost`, `__jump.ghostColors`, `__jump.sync` (`?debug`) ; e2e `profil-commun.spec.ts` (deux appareils, vrai serveur sur le port 8791) — [P2](../plateforme/lots/lot-P2-fantome-profil.md).
- Classement (lot P1) : `__jump.rank`, `__jump.rankWake()` (`?debug`) ; `npm run measure:jump-api -w @cdj/api` (coût des routes, joueur type) ; `npm run jump:seed -w @cdj/api` (jeu de données de `?api=demo`) — [P1](../plateforme/lots/lot-P1-classement.md).
- `?debug` expose `window.__jump` (phase, player, params, attempt, daily, events, audio, blocks, wind, history…) ; `?debug&tune` panneau de réglages (jamais enregistré) ; `?debug&hitbox` — [lot 1](lots/lot-1-personnage.md), [2](lots/lot-2-dangers.md).
- Scénarios : `essai` (défaut hors jour), `dangers`, `bac-a-sable`, `vent`, `?modules`, `?module=<id>&variante=<n>&entree=…`, `&solution`, `?carnage=demo`, `?watch=best`, `?seed=`, `?theme=` ; options listées dans `apps/jump/src/urlOptions.ts` — [lot 2](lots/lot-2-dangers.md), [3](lots/lot-3-rediffusion.md), [4](lots/lot-4-morceaux.md).
- Mesures : `npm run measure:jump`, `measure:modules`, `repos:modules`, `measure:elan` (`-w @cdj/jump-sim`), `MESURES=1 npx vitest run …/mesures.test.ts`, `MESURE=1` (chargement, thèmes) et `CAPTURES=1` côté e2e (sautés en CI).
- Tests de jeu **en pas à pas** (`manual(true)` + `input`/`advance`), jamais sur une durée ; horloge maîtrisée par décalage de `Date` (`apps/jump/e2e/clock.ts`).

## 9. Décisions de Nathan (à ne pas remettre en cause sans lui)
- Élan progressif **écarté** : élargissait les niveaux (382 colonnes contre 293 pour 30 s), moins de technique, passages impossibles à un humain — [lot 8c](lots/lot-8c-elan.md).
- Règle de jouabilité humaine (retour de Nathan sur un pont friable sous des scies basses) : gigue ±3 pas, appuis ≥ 5 pas — [lot 8c](lots/lot-8c-elan.md), [11](lots/lot-11-themes-jouables.md).
- Pas de saut automatique à la réapparition ; le monde attend la première commande — [lot 2](lots/lot-2-dangers.md).
- La même exigence chaque jour, quel que soit le jour de la semaine — [lot 5](lots/lot-5-niveau-du-jour.md).
- Le décor ne ressemble jamais à un danger ; couleurs des dangers et du personnage réservées — [lot 9](lots/lot-9-themes.md).
- Figer avant de changer de version ; le gel se fait avec le code de `main` — [lot 10](lots/lot-10-arrivee.md), [11](lots/lot-11-themes-jouables.md).
- Seed `seed-dailyjump.md` : jamais modifié par un agent ; DailyTrack et DailyJump ne s'importent pas — [lot 0](lots/lot-0-socle.md).

## 10. Dettes et questions ouvertes
- Archives sous ancienne physique (recommandation : listées, non rejouables) — [lot 10](lots/lot-10-arrivee.md).
- Difficulté ressentie des morceaux de glace, de nuit et de vent : l'exigence (gigue des commandes) la mesure mal — [lot 11](lots/lot-11-themes-jouables.md), [12](lots/lot-12-nuit-neon.md), [13](lots/lot-13-foret.md).
- Tests instables de DailyTrack qui ont bloqué des lots DailyJump (`salon.spec.ts:149`, `tactile.spec.ts`) : voir `docs/orchestration.md` § 8 (lot R2).
