# Lot R2 — tableau de correspondance des consignes (annexe)

Annexe de `lot-R2-hygiene.md`. Chaque **règle** des trois anciens fichiers (`CLAUDE.md` racine, `docs/jump/consignes.md`, `docs/plateforme/consignes.md`) est déplacée **telle quelle, ligne pour ligne** dans le `CLAUDE.md` de sa zone ; seule exception : quatre mots de renvoi corrigés dans « Plusieurs jeux dans ce dépôt » (« ce fichier » → les nouveaux fichiers). La colonne « lignes » compte les lignes de règles (puces et suites) de la rubrique ; une rubrique répartie sur deux fichiers montre le nombre de lignes de chacun.

**Contrôle mécanique** (refait à la fin du lot, script jetable) : toutes les lignes non vides et hors titres des trois anciens fichiers, sauf celles listées ci-dessous, se retrouvent à l'identique dans l'un des six `CLAUDE.md` — résultat : 0 ligne manquante.

**Lignes non reprises (remplacées, pas perdues)** :
- `CLAUDE.md` (avant) : titre, phrase d'introduction (reprise dans le nouveau `CLAUDE.md` racine : jeu quotidien, source de vérité `docs/seed.md` à ne pas modifier, réponses en français) ; rubrique « Structure » (remplacée par la **carte du dépôt**, qui couvre aussi DailyJump, la plateforme et les zones partagées) ; les deux lignes `@docs/jump/consignes.md` et `@docs/plateforme/consignes.md` (les imports sont supprimés : ils chargeaient tout au démarrage).
- `docs/jump/consignes.md` : titre et phrase d'introduction (reprises dans les en-têtes de `apps/jump/CLAUDE.md` et `packages/jump-sim/CLAUDE.md`).
- `docs/plateforme/consignes.md` : titre et phrase d'introduction (reprises dans l'en-tête de `apps/api/CLAUDE.md`).

**Lignes ajoutées** (nouvelles) : en-tête de chaque `CLAUDE.md` de zone (ce que c'est, quand il est chargé, vers quelle synthèse partir, où sont les autres consignes) ; carte du dépôt, règles communes et index des rubriques dans le `CLAUDE.md` racine.

| Source | Rubrique | Règles (lignes) | Nouveau fichier |
|---|---|---|---|
| CLAUDE.md (racine, avant) | Plusieurs jeux dans ce dépôt | 4 | `CLAUDE.md` |
| CLAUDE.md (racine, avant) | Commandes | 3 | `CLAUDE.md` |
| CLAUDE.md (racine, avant) | Tests et CI (retouche 29b) — rouge = vrai problème | 6 | `CLAUDE.md` |
| CLAUDE.md (racine, avant) | Méthode | 2 | `CLAUDE.md` |
| CLAUDE.md (racine, avant) | Circuits (lot 2) | 4 | `packages/sim/CLAUDE.md` |
| CLAUDE.md (racine, avant) | Rediffusions (lot 3) | 3 | `packages/sim/CLAUDE.md` |
| CLAUDE.md (racine, avant) | Circuit du jour (lot 4) | 4 | `packages/sim/CLAUDE.md` |
| CLAUDE.md (racine, avant) | Conduite (lot 7) | 12 | `packages/sim/CLAUDE.md` |
| CLAUDE.md (racine, avant) | Air et atterrissages (lot 19) | 7 | `packages/sim/CLAUDE.md` |
| CLAUDE.md (racine, avant) | Surfaces et blocs à effet (lot 8) | 8 | `packages/sim/CLAUDE.md` |
| CLAUDE.md (racine, avant) | Glace (lot 16) | 2 | `packages/sim/CLAUDE.md` |
| CLAUDE.md (racine, avant) | Thèmes (lot 8) | 3 | `packages/sim/CLAUDE.md` |
| CLAUDE.md (racine, avant) | Nouveaux thèmes : Canyon, Col alpin, Ville (lot 22) | 7 | `packages/sim/CLAUDE.md` |
| CLAUDE.md (racine, avant) | Largeurs de route et courbes amples (lot 12) | 7 | `packages/sim/CLAUDE.md` |
| CLAUDE.md (racine, avant) | Portions rapides (lot 15) | 3 | `packages/sim/CLAUDE.md` |
| CLAUDE.md (racine, avant) | Mesures : moments de choix (lot 21) | 2 | `packages/sim/CLAUDE.md` |
| CLAUDE.md (racine, avant) | Relief, sauts et chute (lot 17) | 8 | `packages/sim/CLAUDE.md` |
| CLAUDE.md (racine, avant) | Cuves (lot 18) | 9 | `packages/sim/CLAUDE.md` |
| CLAUDE.md (racine, avant) | Figures (lot 20) | 7 | `packages/sim/CLAUDE.md` |
| CLAUDE.md (racine, avant) | Règles de la simulation (déterminisme) | 6 | `packages/sim/CLAUDE.md` |
| CLAUDE.md (racine, avant) | Classement (lot 5) | 7 | `apps/api/CLAUDE.md` |
| CLAUDE.md (racine, avant) | Historique et mode démo (lot 11) | 4 | `apps/api/CLAUDE.md` |
| CLAUDE.md (racine, avant) | Admin et planning (lot 14) | 6 | `apps/api/CLAUDE.md` (4) + `apps/web/CLAUDE.md` (2) |
| CLAUDE.md (racine, avant) | Salon (lots 26 et 27) | 9 | `apps/api/CLAUDE.md` (1) + `apps/web/CLAUDE.md` (8) |
| CLAUDE.md (racine, avant) | Le Salon oublie (retouche 27b) | 4 | `apps/api/CLAUDE.md` |
| CLAUDE.md (racine, avant) | Finale du Salon (lot 31) | 4 | `apps/api/CLAUDE.md` (1) + `apps/web/CLAUDE.md` (3) |
| CLAUDE.md (racine, avant) | Jour de Paris (lot 31) | 3 | `apps/api/CLAUDE.md` |
| CLAUDE.md (racine, avant) | Production (lot 28) | 15 | `apps/api/CLAUDE.md` |
| CLAUDE.md (racine, avant) | Profil (lot 30) | 8 | `apps/api/CLAUDE.md` |
| docs/plateforme/consignes.md | Emplacements | 5 | `apps/api/CLAUDE.md` |
| docs/plateforme/consignes.md | Recette (lot R1) | 12 | `apps/api/CLAUDE.md` |
| CLAUDE.md (racine, avant) | Arrivée, partage, archives, mobile (lot 6) | 3 | `apps/web/CLAUDE.md` |
| CLAUDE.md (racine, avant) | Commandes tactiles (lot 10) | 7 | `apps/web/CLAUDE.md` |
| CLAUDE.md (racine, avant) | Rendu, effets et sons (lot 9) | 11 | `apps/web/CLAUDE.md` |
| CLAUDE.md (racine, avant) | Graphismes, ambiance et caméras (lot 23) | 8 | `apps/web/CLAUDE.md` |
| CLAUDE.md (racine, avant) | Miniatures (lot 13) | 8 | `apps/web/CLAUDE.md` |
| CLAUDE.md (racine, avant) | Circuits à venir et outils d'essai (lot 31) | 3 | `apps/web/CLAUDE.md` |
| CLAUDE.md (racine, avant) | Revoir le meilleur tour (retouche 27b) | 6 | `apps/web/CLAUDE.md` |
| CLAUDE.md (racine, avant) | Interface (lot 29) | 9 | `apps/web/CLAUDE.md` |
| docs/jump/consignes.md | Emplacements | 5 | `apps/jump/CLAUDE.md` |
| docs/jump/consignes.md | Conventions de `apps/jump` | 5 | `apps/jump/CLAUDE.md` |
| docs/jump/consignes.md | Commandes | 7 | `apps/jump/CLAUDE.md` |
| docs/jump/consignes.md | Lot 1 — personnage | 10 | `apps/jump/CLAUDE.md` (6) + `packages/jump-sim/CLAUDE.md` (4) |
| docs/jump/consignes.md | Lot 1b — mobile | 6 | `apps/jump/CLAUDE.md` (5) + `packages/jump-sim/CLAUDE.md` (1) |
| docs/jump/consignes.md | Lot 2 — dangers et mort | 13 | `apps/jump/CLAUDE.md` (2) + `packages/jump-sim/CLAUDE.md` (11) |
| docs/jump/consignes.md | Lot 3 — rediffusion | 10 | `apps/jump/CLAUDE.md` (5) + `packages/jump-sim/CLAUDE.md` (5) |
| docs/jump/consignes.md | Lot 4 — morceaux | 11 | `apps/jump/CLAUDE.md` (1) + `packages/jump-sim/CLAUDE.md` (10) |
| docs/jump/consignes.md | Lot 5 — niveau du jour | 13 | `apps/jump/CLAUDE.md` (1) + `packages/jump-sim/CLAUDE.md` (12) |
| docs/jump/consignes.md | Lot 8 — sensations | 6 | `apps/jump/CLAUDE.md` |
| docs/jump/consignes.md | Lot 7b — chargement rapide, respirations, tension | 7 | `apps/jump/CLAUDE.md` (4) + `packages/jump-sim/CLAUDE.md` (3) |
| docs/jump/consignes.md | Lot 8b — animation du personnage, essai d'élan progressif | 3 | `apps/jump/CLAUDE.md` (1) + `packages/jump-sim/CLAUDE.md` (2) |
| docs/jump/consignes.md | Lot 9 — thèmes | 6 | `apps/jump/CLAUDE.md` |
| docs/jump/consignes.md | Lot 10 — arrivée, partage, archives | 8 | `apps/jump/CLAUDE.md` (7) + `packages/jump-sim/CLAUDE.md` (1) |
| docs/jump/consignes.md | Lot 11 — thèmes jouables | 9 | `apps/jump/CLAUDE.md` (1) + `packages/jump-sim/CLAUDE.md` (8) |
| docs/jump/consignes.md | Lot 12 — nuit et néon | 12 | `apps/jump/CLAUDE.md` (3) + `packages/jump-sim/CLAUDE.md` (9) |
| docs/jump/consignes.md | Lot 13 — forêt | 10 | `apps/jump/CLAUDE.md` (3) + `packages/jump-sim/CLAUDE.md` (7) |
| docs/jump/consignes.md | Règle du socle (`core`) | 2 | `packages/jump-sim/CLAUDE.md` |
| docs/jump/consignes.md | Règles de `jump-sim` | 5 | `packages/jump-sim/CLAUDE.md` |
| docs/jump/consignes.md | Lot 2b — points de passage | 3 | `packages/jump-sim/CLAUDE.md` |
| docs/jump/consignes.md | Lot 7 — variété | 15 | `packages/jump-sim/CLAUDE.md` |
| docs/jump/consignes.md | Lot 8c — jouable par un humain | 4 | `packages/jump-sim/CLAUDE.md` |
Les fichiers `docs/jump/consignes.md` et `docs/plateforme/consignes.md` restent comme **renvois** de quelques lignes (des README de lots et des lots futurs y pointent) ; le `CLAUDE.md` racine n'importe plus rien.
