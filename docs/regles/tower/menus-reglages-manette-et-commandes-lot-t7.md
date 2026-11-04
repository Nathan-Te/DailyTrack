# Menus, Réglages, manette et commandes (lot T7)

> Déplacé **mot pour mot** de `docs/tower/consignes.md` (lot T1, économie de jetons) : rien n'est réécrit, les règles sont en vigueur. Le renvoi est dans [`apps/tower/CLAUDE.md`](../../../apps/tower/CLAUDE.md).

## Menus, Réglages, manette et commandes (lot T7)
Rapport : `docs/tower/lots/lot-T7-menus-manette.md`. **Décision de Nathan : les écrans de Tower reprennent ceux de Jump** (`jump-pause.html`, `jump-reglages.html`, `jump-classement.html`, les archives de Jump), avec l'étiquette de Tower (menthe dans sa coque vert sapin, Rubik Mono One) ; aucune nouvelle maquette. Aucune version, aucun golden, aucune rediffusion ne bouge.

**Les actions** (`commandes.ts` : `ACTIONS_TOWER`, `new Commandes("tower", …)` de `@cdj/ui`, stockage `cdj:commandes:tower`). **Tower ne lit plus aucune touche en dur** (`test/commandes.test.ts` le vérifie sur `src/`) : les touches sont des `event.code` (la touche physique : ← A / → D sont Q / D sur un AZERTY, ↑ W est Z) :

| Action | Clavier d'origine | Manette d'origine |
|---|---|---|
| `gauche` / `droite` | ← A / → D (Q / D en AZERTY) | stick, croix (fixes) |
| `tourner` | ↑ W X (Z en AZERTY) | A |
| `descendre` (tenu) | ↓ S Espace | RT ; le bas de la croix et du stick (fixes) |
| `recommencer` | Entrée | X |
| `pause` | P ; **Échap fixe** | **Start fixe** |
| `fantome` | G | Y |
| `taquetGauche` / `taquetDroite` (lot T8 : un petit coup de côté de la pièce en main, un ordre par appui) | Q / E (A / E en AZERTY) | LB / RB |

**La correspondance se fait avant le masque** : `Entrees.brancherClavier(fenêtre, actif, commandes)` traduit la touche par `commandes.actionDeTouche`, `Entrees.lirePad(pad, commandes)` la manette ; le masque de bits par tick (`COMMANDE`) est le même quelles que soient les touches (`test/entrees.test.ts` : même scénario, d'autres touches, **mêmes bits, même texte de rediffusion, même hauteur**). Trois sources (clavier, tactile, manette) peuvent tenir la même touche : un ordre n'est levé qu'au premier appui, la touche reste tenue tant qu'une source la tient.

**La manette en partie** : lue **à chaque image** par `padPourLeJeu` (un menu ouvert lui cache tout, sauf Start : un appui ne sert jamais deux fois — le A qui reprend la partie ne fait pas tourner la pièce). Le stick et la croix déplacent, avec **la répétition du clavier** (`delaiTicks`, `cadenceTicks`) ; Start met en pause et reprend (sauf sous Réglages, « Comment jouer » ou le classement) ; X recommence (même regard que Entrée : jamais quand un bouton, un lien ou un champ a le focus) ; Y change le fantôme.

**L'aide des commandes** (`aideLigne.ts`, chargée à la demande, jamais au tactile) : **au départ d'une partie**, une ligne sous la bande — « {gauche} {droite} déplacer · {tourner} tourner · {descendre} descendre · {pause} pause » (`aide.ligne`) — avec **les touches choisies** (deux au plus par action) en pastilles de clavier, ou **les boutons de la manette** (`touche--manette`) si la dernière entrée vient d'une manette ; elle disparaît après trois pièces. « Comment jouer » est redessiné à chaque ouverture avec les mêmes touches (et une ligne pour la manette), ouvert depuis l'accueil ou la pause.

**La pause** (`pause.ts`) : Reprendre, Recommencer, Comment jouer, Réglages, plein écran, **Accueil de Tower** (la page de l'accueil sans les outils d'essai : `adresseAccueil`, `jourPasse.ts` ; **la partie abandonnée n'est jamais envoyée** : seule la fin d'une partie, `terminer()`, propose un record et envoie), les effets sonores (`tower:sons`, T5), le bloc commun de la musique, le message en direct (destination `tower`) en tête et le lien des mentions légales en pied. La fin de partie a aussi son bouton « Accueil de Tower ».

**Réglages** (`reglages.ts`, à la demande, depuis l'accueil et la pause ; cadre `ecrans.ts` : la barre « ‹ TOWER » en plaque crème et l'étiquette sur le voile, un seul voile à la fois) : **Son** (les effets : le même bloc que la pause ; la musique commune), **Affichage** (le fantôme au départ, Aucun par défaut (lot T6) ou Ma meilleure ; les secousses de l'écran et la panique des yeux : Normal · Réduit · Aucun, en plus de `prefers-reduced-motion` ; la visée du lot T6, en plus de `?visee=0` : `scene.viseeActive = options.visee && réglage`, changée tout de suite), **Commandes** (l'écran du socle : Clavier · Manette · Tactile ; sur le tactile, un rappel des quatre boutons), les liens du profil commun et des mentions. **Stockage : `tower:reglages`** (`reglagesJoueur.ts`, `{ v: 1, fantome, secousses, yeux, visee }` ; absent, abîmé ou d'un autre format : les défauts), `tower:sons` (T5), `cdj:musique` (commune), `cdj:commandes:tower` (les touches). **Ces réglages ne touchent jamais à la simulation** : ils règlent l'affichage (le gain de la panique et de la secousse se multiplie aux curseurs de `?debug&tune`) et le départ d'une partie. Pas de choix de langue dans les Réglages (la langue commune se choisit sur le portail).

**Archives** (`archives.ts`, `archivesLogique.ts`, à la demande, depuis l'accueil) : les jours passés depuis `PREMIER_JOUR_TOWER` (**30 au plus**, du plus récent), avec ta meilleure hauteur et ta médaille ; les données du serveur (`GET /api/tower/me`, `days` : aucune route nouvelle) complétées par `tower:records` ; ouvrir un jour passé recharge la page avec `?seed=AAAA-MM-JJ` : **joué en archive, jamais classé ni envoyé** (`peutClasser`), l'accueil le dit (« Archive : cette tour n'est pas classée » et « Tour du jour › »), le HUD montre la plaque « Archive », l'arrivée une note ; l'accueil d'une archive montre le classement figé de ce jour.

**À la demande** : Réglages, Archives, l'écran des commandes (`@cdj/ui`) et leurs textes français (`catalogue.ecrans.fr.ts`) ne sont dans ni l'accueil ni le jeu. **Dans le jeu** : la lecture des commandes (`Commandes`, ≈ 1,9 ko), comme Track et Jump ; **pas dans l'accueil** (il n'en lit aucune touche : « Comment jouer », ouvert depuis lui, la charge à la demande). Budgets : voir « Le chargement à la demande et les budgets ».
