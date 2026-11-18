# Lot C1d — un membre compte dans son groupe dès le jour de son arrivée

Plateforme, court. Décision de Nathan (18/11) : un membre compte le jour même ; le risque (rejoindre en fin de journée, ses temps faits) est accepté. Cause du « 0 groupes classés » du 18/11 : `arrivee = today + 1` (lot C1).

## Ce qui change
- `apps/api/src/groupes.ts` : `arrivee = today` à la création et en rejoignant (réponse `rejoindre` comprise). La règle n'est lue qu'à un endroit par vue (`arrivee <= day`) : classement des groupes, page d'un groupe, « Mon groupe », résumé de l'accueil (`joueur.groupe`) en profitent sans autre code ni requête de plus. Un membre parti ne compte plus tout de suite ; un membre qui change de groupe dans la journée compte pour le nouveau seulement (une ligne par joueur).
- **Migration** `migrerArriveesDesGroupes` (`apps/api/src/groupesArrivee.ts`, appelée par `ensureSchemaOn`, identifiant dans l'empreinte du schéma) : ramène `arrivee` au jour de Paris de `rejoint_le` quand il le dépasse. Idempotente, appliquée par le serveur déployé au premier démarrage ; aucun outil n'écrit en production. **Réversible** : `UPDATE groupe_membres SET arrivee = arrivee + 1` (le code d'avant ne lit que `arrivee`). Attendu après la mise en production : « Fan 2 Orisha » et « Lakaka » classés le jour même.
- Lecture de toute la table `groupe_membres` une fois par changement de schéma : justifiée dans `PARCOURS_PERMIS` (`plans.ts`), pas d'index de plus.
- Textes : catalogues du portail (`groupePage.rejoindre.aide`, `groupePage.rejoint`, fr + en), les deux pages des mentions légales, `docs/regles/api/groupes-lot-c1-partie-c.md`, commentaires ; `traductions.md` régénéré. `recette:seed` n'avance plus l'arrivée à la veille.

## Bancs de réponses (différence voulue)
`banc-track.json`, `banc-jump.json`, `banc-tower.json` : 4 réponses « mon groupe » par banc portent `arrivee` = le jour même au lieu du lendemain (ex. `2026-10-15` → `2026-10-14`). Rien d'autre ne bouge.

## Tests
`apps/api/test/groupes.test.ts` : groupe créé aujourd'hui, 3 membres classés → classé aujourd'hui ; changement de groupe dans la journée ; migration (remise, idempotence, passage par `ensureSchemaOn`) ; l'arrivée du jour compte. SQLite et libSQL.

## Vérifié / non vérifié
Vérifié en local : `npm run typecheck`, `npm run consignes`, tests de `apps/api`, `apps/portail`, `packages/ui`, `packages/profile` (SQLite), groupes + bancs + remise à zéro (libSQL). Non vérifié : CI de la PR, scénario de recette sur l'aperçu (à faire par Nathan, 2 clics ci-dessous).

## Pour Nathan (aperçu)
1. Créer un groupe avec le joueur de la recette, ouvrir Classements › Groupes : « Moins de 3 classés », 1 classé, dès aujourd'hui.
2. Ouvrir la page du groupe : le rang du jour, ou « Moins de 3 classés » avec le bon nombre de classés.
