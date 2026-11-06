# Lot 33 — Incident du 06/11/2026 : le niveau du jour de Jump changé par une mise en production

Branche `claude/keen-mayer-a3ud8s`, PR brouillon étiquetée `jeu:jump`. Règle absolue : **un jour déjà servi aux joueurs ne change jamais.** Aucune écriture en base de production : tout ce qui a lu la production est en `GET` (API publique : niveau du jour, classement, premier fantôme).

## Pour les joueurs
- [Jump] Le niveau du jour et les archives du 3 au 6 novembre retrouvent le niveau que tout le monde a joué. // Today's level and the November 3–6 archives are back to the level everyone played.

## 1. Diagnostic

**Les deux révisions.** Avant : `prod-2026-11-02-1604` (`9c067e5`). Déployée : `prod-2026-11-06-1556` (`f0006b9`, run 42238329623, serveur déployé à 15 h 17 UTC, site à 15 h 19). **`JUMP_GENERATOR_VERSION` (26) et `JUMP_SIM_VERSION` (14) n'ont pas bougé, et `packages/jump-sim` est identique entre les deux** (seul son `CLAUDE.md` diffère) : ce n'est ni un nouveau générateur ni une date de bascule. Mesuré en faisant tourner les deux codes : même niveau, bit pour bit, pour chaque date.

**La cause exacte.** Le thème d'un jour et la règle de variété dépendent des niveaux déjà figés d'un ancien générateur (les fichiers g21 jusqu'au 02/11) : le serveur et le jeu les *déclarent* à la simulation (`declareFrozenGenerators`) au démarrage. **L'outil de figeage `freeze:days` ne les déclarait pas** (la liste est écrite par la construction du jeu ; l'outil tourne dans Node). Lancé par « Mettre en production » avec le code en production, il a donc écrit, pour les jours 03 à 06/11 (servis jusque-là *sans* fichier), des niveaux calculés sans ce que le serveur savait : **autre thème pour le 03/11 (forêt au lieu d'usine) et autre variété pour les suivants**. Les fichiers entrés dans l'image du serveur ont remplacé les niveaux générés. Le garde-fou ne l'a pas vu : il comparait des empreintes de fichiers à des empreintes de fichiers (le code en production relisait les mêmes fichiers que la nouvelle construction) — jamais à ce que la production *servait* avant, ni à ce que le code servait *sans* eux. Les pistes de l'énoncé : jours servis sans fichier figé → **oui** (le trou) ; date de bascule du générateur → non ; fichier figé ignoré par le nouveau code → non ; figeage fait avec le nouveau code → non (avec le code en production, mais avec un outil faux).

**Comparaison, jour par jour** (hash du niveau, avant → servi après) :

| jour | avant (servi pendant 3 à 4 jours) | après (incident) | thème avant → après |
|---|---|---|---|
| 02/11 | g21 `5d6ebecd` (fichier) | identique | — |
| 03/11 | `be47f97c` | `a1ecd408` | usine → forêt |
| 04/11 | `3c564234` | `87339d47` | nuit → nuit (autres morceaux) |
| 05/11 | `37283e5a` | `b3032d69` | néon → néon (autres morceaux) |
| 06/11 (aujourd'hui) | `29108be0` | `4aa5e402` | usine → usine (autres morceaux) |
| 07/11 (demain) | `c8cc3123` | non figé, non servi | — |

L'identifiant (`jour-AAAA-MM-JJ-g26`) est le **même** dans les deux cas : c'est l'empreinte, les morceaux, les médailles (et, le 03/11, le thème) qui ont changé. **Preuve par les joueurs** : le fantôme du premier de chaque jour (`GET /api/jump/day/<date>/ghost/first`) arrive sur le niveau d'avant et ne finit pas sur le niveau de l'incident (06/11 : BiBi, 3 432 pas, arrive sur `29108be0`, 16 morts et aucune arrivée sur `4aa5e402`).

**Jours touchés** : le jour même (06/11) et **trois archives** (03, 04, 05/11). Aucune autre archive : les 18 fichiers du 16/10 au 02/11 sont intacts. Au moment du diagnostic **le retour arrière n'avait pas été fait** (aucun run « Retour arrière », la production sert toujours les niveaux de l'incident).

## 2. Réparation des jours servis
- `apps/jump/public/levels/2026-11-03.json` … `2026-11-06.json`, **figés avec la révision d'avant** (`prod-2026-11-02-1604`) par l'outil corrigé (`freeze:days`, qui déclare désormais les jours figés) : hashs `be47f97c`, `3c564234`, `37283e5a`, `29108be0` (= ce que le serveur d'avant servait sans fichier, test `apps/api/test/jumpJourServiImmuable.test.ts`).
- **Vérifié en lecture seule** contre les résultats enregistrés : le premier fantôme de chaque jour (03 à 06/11, tel que la production le sert) se rejoue **jusqu'à l'arrivée, au temps enregistré, sur chacun de ces quatre fichiers** (`thawLevel` + `replayAttempt`) : 3 399, 3 505, 3 744 et 3 432 pas. Sur les fichiers de l'incident, aucun n'arrive (ou pas au même pas).
- **À ne pas faire : fusionner la PR #291 « Jours figés — prod-2026-11-06-1556 »** (ouverte par la mise en production, le versement a échoué) : elle contient les **mauvais** fichiers (`a1ecd408`…). La fermer ; elle bloque d'ailleurs le bouton tant qu'elle est ouverte. Les jours de Track et de Tower qu'elle versait (registre, empreintes) seront reversés par la mise en production suivante.
- **Mise en œuvre** : fusionner cette PR, **faire le retour arrière** (la production sert le niveau d'incident), puis lancer « Mettre en production » : `servi-verifier` compare les fichiers au niveau que la production sert et s'arrête si la production sert encore l'incident.

**Résultats posés sur un niveau différent pendant l'incident — non mesuré, à faire avec une lecture de la base (je n'y ai pas accès).**
- Jours fermés 03, 04, 05/11 : **0 résultat posé pendant l'incident** (plus d'envoi accepté après la grâce) ; en revanche leur classement affiche aujourd'hui les médailles du mauvais niveau (ex. 05/11 : 4 médailles d'or au lieu de « auteur »).
- 06/11 : les envois acceptés **après le déploiement du serveur (15 h 17 min 41 s UTC, `submitted_at` ≥ 1793978261000)** ont été rejoués sur `4aa5e402`. 11 classés au total au moment du diagnostic. Le nombre exact : `SELECT COUNT(*) FROM jump_results WHERE day = 20763 AND submitted_at >= 1793978261000;` (lecture seule) ; le contrôle sûr : rejouer chaque `replay` du jour sur les deux fichiers (`29108be0` et `4aa5e402`) — un temps qui n'arrive que sur `4aa5e402` est un résultat de l'incident. **Rien n'est supprimé** : la décision (garder, retirer, refaire jouer) revient à Nathan.

## 3. Garde-fous dans Jump
- **Calendrier des bascules du générateur** (`packages/jump-sim/src/bascules.json`, `bascules.ts`) : un jour se génère avec le générateur actif **à sa date** ; `dailyLevel` lève `GenerateurDuJourError` pour un jour sans fichier d'un autre générateur que celui du code, et le serveur répond `503 level_unavailable` (journalisé) au lieu de servir un autre niveau. La règle de variété garde son calcul interne (`calculerNiveau`).
- **Une bascule fixée à aujourd'hui ou avant est refusée** : `verifierBascules` (au clic, avec le jour de bascule) ; bascule à demain au plus tôt, 14 jours au plus.
- **Outil de figeage corrigé** : `freeze:days` déclare les jours figés ; `apps/jump/test/figeageDeclare.test.ts` le lance pour de vrai (sans la correction : `a1ecd408` au lieu de `be47f97c` — l'incident reproduit).
- Tests : `packages/jump-sim/test/bascules.test.ts` (« un générateur g27 déployé alors qu'aujourd'hui n'est pas figé ne génère ni aujourd'hui ni aucun jour passé »), `apps/api/test/jumpJourServiImmuable.test.ts` (les fichiers = ce que le serveur d'avant servait ; refus 503 ; un jour figé reste tel quel).

## 4. Chaîne de mise en production (exception de Nathan : `scripts/`, `.github/`)
Nouveau déroulé pour Jump (détail : `docs/orchestration.md` § 12) :
1. **tout jour non figé, du dernier jour figé à demain**, est figé avec le code en production — l'**outil d'aujourd'hui** est copié dans ce code (celui du code en production peut se tromper) —, les jours sans résultat compris ;
2. chaque fichier écrit est **comparé à ce que le code en production sert sans lui** (empreintes de l'image d'avant et de l'image avec les fichiers) ; essayé en local avec l'outil fautif : la chaîne s'arrête sur 03, 04, 05, 06 et 07/11 ;
3. en production : `servi-verifier` compare ces fichiers (jusqu'à aujourd'hui) au niveau que le serveur sert, en lecture seule ;
4. **refus de déployer** s'il reste un jour déjà servi (ou demain) sans fichier figé ;
5. le calendrier des bascules est vérifié (bascule à aujourd'hui ou avant : refus).
Tests : `apps/jump/test/jourServiChaine.test.ts`.

**Track — même risque ?** Non, pas par ce mécanisme : Track n'a aucun état déclaré (le registre `jours-track.json` est une donnée du dépôt, la version d'un jour en vient) et il n'a pas d'outil de figeage de fichiers. Mesuré : les empreintes de Track du 02 au 08/11 sont identiques entre `prod-2026-11-02-1604` et `prod-2026-11-06-1556`. Reste une règle, voulue par Nathan (R11), qui n'est pas ce bug : **un circuit de Track sans résultat est régénéré par le code déployé** ; un jour ouvert mais pas joué peut changer. À Nathan de dire s'il veut aussi figer tous les jours jusqu'à demain pour Track (décision de produit, pas du correctif).

## 5. Répétition sur la recette

**Non lancée par moi : le workflow « Mettre en production » n'est pas lançable avec mon accès (`403 Resource not accessible by integration` sur `workflow_dispatch`).** Ce qui est fait à la place, en local, avec les vrais scripts de la chaîne et un faux générateur g27 (`lot-33-repetition-g27.patch` : `JUMP_GENERATOR_VERSION = 27` et une entrée `{ depuis: "2026-11-07", generateur: 27 }`), code en production = `prod-2026-11-06-1556`, jour non figé, clic simulé le 06/11 à 17 h (bascule le 07/11) :
- `figer-jeux` : « g27 à partir du 2026-11-07 » accepté ; **3, 4, 5, 6 et 7/11 figés avec le code en production, « tous identiques à ce qu'il servait sans fichier »** ; tous les jours jusqu'à demain ont leur fichier.
- Empreintes (`empreintes`) du **code g27** avec ces fichiers, comparées à celles du code d'avant l'incident : **02, 03, 04, 05, 06 (aujourd'hui) et 07/11 identiques** (`d7046a41…`, `c210947b…`, `d07298a5…`, `0262916a…`, `c337263c…`), seul le 08/11 devient `…-g27` (comme le calendrier le dit).
- Même essai avec la bascule g27 fixée au 06/11 (aujourd'hui) : **refusé** (« un nouveau générateur ne s'applique qu'à partir de DEMAIN au plus tôt »).
- Avec l'outil fautif d'avant : la chaîne s'arrête sur 03 à 07/11.

**Pour la répétition réelle (Nathan, ou une session qui peut lancer le workflow)** — `docs/plateforme/mise-en-production.md`, annexe E : sur une branche jetable partie de celle-ci, appliquer le patch (`git apply docs/jump/lots/lot-33-repetition-g27.patch`), pousser, puis Actions → « Mettre en production » → Run workflow sur cette branche : `mode: repetition`, `heure_simulee: aujourdhui 10:00`, `reference: <le commit de cette branche avant le patch>`. Elle ne touche que la recette. **Après la répétition** :
- le niveau du jour : <https://recette.playdujour.com/jump/?debug> — la ligne « origine » doit dire « fichier figé » et le niveau `jour-2026-11-06-g26` (empreinte `29108be0`, thème usine) ;
- une archive : <https://recette.playdujour.com/jump/?debug&seed=2026-11-04> — « fichier figé », `jour-2026-11-04-g26` (`3c564234`, nuit).
Avant la répétition la recette sert ces mêmes niveaux **générés** (relevé à 16 h 10 : `29108be0` et `3c564234`, `source: "genere"`) : l'identifiant et l'empreinte ne bougent pas, seule l'origine passe de « généré » à « fichier figé ». Contrôle sans navigateur : `curl https://recette.playdujour.com/api/jump/day/2026-11-06` (`source`, `id`, `hash`).

## 6. État de la CI et décisions pour Nathan
- **Étiquette `jeu:jump` retirée de la PR** (après « CI KO » de Nathan) : seul le job `zones` était rouge — tout le reste (unitaires, e2e-pr, jeu fictif, api-image, budgets) était vert sur le run 42257359850 — et il refusait quatre fichiers hors des zones de Jump : `.github/workflows/production.yml` et `scripts/mise-en-production.mjs` (l'exception que tu as accordée), `docs/orchestration.md` (la règle que tu m'as demandé d'y écrire) et `scripts/unit-durees.json` (la durée estimée de mes trois tests : sans elle une PR de Jump dépasse la minute de tests unitaires, `ciZones.test.ts`). Une PR sans étiquette ni nom de jeu dans la branche est une PR de la plateforme, sans garde de zones : c'est ce qu'elle est devenue, puisqu'elle touche la chaîne de mise en production. Je n'ai pas élargi `scripts/zones-jeu.mjs` (affaiblir une garde est ta décision). Pour remettre l'étiquette, ajoute ces quatre fichiers aux exceptions de la garde.
- Les tests de la chaîne sont dans `apps/jump/test/jourServiChaine.test.ts` et `apps/api/test/jumpJourServiImmuable.test.ts` (zones de Jump) ; `docs/plateforme/mise-en-production.md` n'est pas modifié (zone de la plateforme) : y ajouter, au prochain lot de la plateforme, la ligne de `servi-verifier` et la phrase de `figer-jeux` (voir `docs/orchestration.md` § 12).
- À décider : fermer la PR #291 ; les 4 fichiers du 03 au 06/11 sont-ils servis tels quels (retour arrière puis bouton) ; que faire des résultats du 06/11 posés après 15 h 17 UTC ; figer aussi Track jusqu'à demain (R11) ?
