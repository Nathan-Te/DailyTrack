# Lot T7 — Menus, réglages, manette et commandes (Tower)

Retour de Nathan (essai du 1er novembre) : l'accueil n'est pas centré ; le jeu ne marche pas à la manette ; « il faut se réinspirer des menus et réglages des autres jeux » ; pas de retour à l'accueil en partie ; ZQSD en plus des flèches ; les commandes doivent s'afficher en aide. **Décision de Nathan : les écrans de Tower reprennent ceux de Jump** (`jump-pause`, `jump-reglages`, archives), avec l'étiquette de Tower. Règles : `docs/tower/consignes.md`, « Menus, Réglages, manette et commandes (lot T7) ». Aucune version, aucun golden, aucune zone partagée touchée ; Tower reste `off`.

## Livré
1. **Accueil centré** dans la fenêtre (hauteur et largeur, même avec la bande Discord / Ko-fi, réservée en haut comme en bas) ; la colonne défile si la hauteur manque ; **Archives** et **Réglages** reviennent (rangée sous JOUER). La barre montre la date de la tour affichée.
2. **Commandes réglables (M2)** : `commandes.ts`, plus aucune touche en dur (test sur `src/`) ; **ZQSD / WASD** et flèches ; mêmes bits et **même rediffusion** avec d'autres touches (test).
3. **Manette en partie** par `padPourLeJeu` (stick, croix, A, RT, X, Y, Start) : répétition du clavier, un menu ouvert lève tout sauf Start.
4. **Aide des commandes** : une ligne sous la bande au départ (touches choisies, ou boutons de manette), disparaît après 3 pièces ; « Comment jouer » dit les mêmes touches.
5. **Pause complète** : Reprendre, Recommencer, Comment jouer, Réglages, plein écran, **Accueil de Tower** (partie abandonnée jamais envoyée), effets sonores, musique, message en direct, mentions. La fin de partie a aussi « Accueil de Tower ».
6. **Réglages** (à la demande, accueil et pause) : Son · Affichage (fantôme au départ, secousses, panique des yeux, visée du T6) · Commandes (écran du socle).
7. **Archives** (à la demande) : 30 jours au plus depuis `PREMIER_JOUR_TOWER`, ta hauteur et ta médaille ; ouvrir un jour le joue **en archive, non classé** (note sur l'accueil, plaque « Archive » en partie, note à l'arrivée).
8. **Manette dans les menus (M1)** : une ligne par écran (`manetteEcrans.ts`), B = retour.

## Les actions et leurs touches
| Action | Clavier | Manette |
|---|---|---|
| `gauche` / `droite` | ← A / → D (Q / D en AZERTY) | stick, croix (fixes) |
| `tourner` | ↑ W X (Z en AZERTY) | A |
| `descendre` (tenu) | ↓ S Espace | RT ; bas de la croix et du stick (fixes) |
| `recommencer` | Entrée | X |
| `pause` | P ; Échap fixe | Start fixe |
| `fantome` | G | Y |

## Écarts aux écrans de Jump
- **Réglages** : dans le cadre de Tower (barre « ‹ TOWER », étiquette menthe), pas l'étiquette jaune. Pas de choix de langue, de vibrations, de volumes général / ambiance, de « premier » ni de taches (Tower n'a rien de tout cela) ; sections Son · Affichage · Commandes. La visée est celle du T6.
- **Pause** : le fantôme reste au bouton du HUD, pas dans la pause ; pas de « ‹ DU JOUR » (l'accueil l'a), pas de « point de passage » (Tower n'en a pas) ; sons = case et volume (T5) ; mentions en pied.
- **Archives** : mêmes lignes que Jump (numéro, date · thème, résultat avec médaille) ; le résultat est une hauteur, pas un temps ; ouvrir un jour recharge la page (`?seed=`), comme Jump.
- **Accueil** : « Archives » et « Réglages » à côté de « Comment jouer » (rangée de trois).
- **Lecture des commandes** : dans le jeu, **pas dans l'accueil** (il n'en lit aucune touche ; « Comment jouer » la charge à la demande). L'énoncé la plaçait au premier chargement : cela garde l'accueil léger.

## Poids (gzip, `docs/plateforme/budgets.md`)
| Ligne | Avant | Après | Plafond |
|---|---|---|---|
| `tower.jsCss` (accueil) | 37 101 | **39 669** (+2 568) | 39 000 → **40 000** (+1 000) |
| `tower.jeu` | 163 876 | **169 111** (+5 235) | 164 000 → **169 200** (+5 200 : **plus que les 3 000 accordés**, le T6 fusionné avant ce lot avait déjà pris 2 263 o ; à valider) |

Dans le jeu : `Commandes` ≈ 1 960 o, entrées et manette, pause complète, aide (chargée à la demande, jamais au tactile), réglages, archive. Réglages, Archives, écran des commandes et leurs textes : à la demande. Mesure : la feuille `commandes-*.css` du socle est retirée de la mesure du jeu (`apps/tower/tools/mesure.mjs`, comme chez Jump). **Marge du jeu : 89 o.**

## Vérifié / non vérifié
- **Vérifié** : `tsc` ; Vitest `apps/tower` et `packages/ui` (actions, touches d'origine, AZERTY / QWERTY, même rediffusion avec d'autres touches, manette levée sous un menu, sources du clavier et de la manette, aide qui cite les touches, stockage absent / abîmé, archives non classées, abandon sans envoi, une ligne par écran, parité FR / EN) ; **un** test de navigateur (Réglages › Commandes : Tourner sur Z, Z agit en partie, l'aide dit Z) ; `poids.spec.ts` ; captures Chromium (ordinateur, téléphone en paysage, portrait) ; **une manette simulée dans Chromium** (menus, partie, pause, B, X, Réglages) ; archives avec une horloge décalée. **`npm run verifier` : tout vert** (typecheck, 31 fichiers Vitest, construction, e2e Tower 4 specs) ; la CI de la PR est à lire sur la PR.
- **Non vérifié** : une **vraie manette** (la manette simulée passe par `navigator.getGamepads`) ; un vrai AZERTY (Chromium sans carte du clavier : testé par la table) ; Firefox, Safari et iPhone sur les nouveaux écrans ; le serveur réel pour les archives (testées sur le navigateur seul).

## Au cahier de la plateforme (zones partagées, non touchées)
- **Mentions légales** (les deux pages, règle de fidélité) : nommer `tower:reglages` (réglages d'affichage), `tower:sons` (déjà au T5, jamais nommée) et `cdj:commandes:tower` (comme les commandes des autres jeux).
- **`CLES_GARDEES`** (`packages/profile/src/generation.ts`) : `tower:reglages`, `tower:sons` et `cdj:commandes:*` sont des réglages d'appareil ; aujourd'hui le « Nouveau départ » les efface. À décider (les touches de Track et de Jump sont dans le même cas).
- **`budgets.md`** : T6 fusionné avant ce lot ; les lignes `tower.*` sont remesurées après la fusion.
- Rappel T5 : un réglage de sons commun aux trois jeux.

## Questions pour Nathan
1. **Fantôme au départ** : le T6 l'a coupé par défaut ; le réglage le rend à qui le veut (« Ma meilleure »), « Aucun » par défaut. Bon ?
2. **Langue** : pas de choix dans les Réglages de Tower (celui du portail s'applique). L'ajouter (≈ 200 o, rechargement de la page) ?
3. **Entrée / X recommencent en pleine partie**, comme Track et Jump : sans confirmation. Garder ?
4. « Accueil de Tower » **recharge la page** (l'accueil est reconstruit). Acceptable ?
5. **Budget `tower.jeu`** : après la fusion du T6, le plafond doit monter à 169 200 o (+5 200), au lieu des +3 000 accordés. Valider, ou me dire quoi sortir du jeu (la pause chargée à la demande rendrait ≈ 1,5 ko).
6. L'accueil d'une archive montre le **classement figé de ce jour**. Garder ?

## Liens de test (aperçu de la PR)
- **`/tower/?seed=2026-11-05`** : au clavier ZQSD (l'aide cite tes touches) ; P, « Accueil de Tower » ; Réglages › Commandes, change « Tourner », rejoue ; Archives. Puis à la manette seule : A pour jouer, croix / stick, A tourne, RT descend, Start met en pause, B revient.
