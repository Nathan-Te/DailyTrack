# Lot K2bc — Jump, puis Track, sur le module serveur commun

Branche `ccr-83c87127-srxgap`, PR brouillon. **Pour les joueurs : rien.** Règles : `apps/api/CLAUDE.md`, « Module des jeux » ; conception : `kit-de-jeu.md` § 4. Le lot a avancé par commits : **bancs** (Jump et Track, sur le code d'avant), **outil de mesure**, **Jump**. **Track n'est pas migré : arrêt propre** (§ « Arrêt propre »). Aucun commit de Track n'est à annuler : seuls son banc et l'inventaire ci-dessous sont livrés.

## Jump sur le module
- **Contrat** (`contratJump`, `src/jump.ts`) : règle et calcul du niveau du jour (fichier figé qui se vérifie, sinon le générateur ; `restaurer` recalcule un niveau gardé sans empreinte d'auteur tant que son jour est ouvert), `valider` (l'ordre des contrôles de Jump, repris tel quel : niveau du jour d'après `levelId`, versions du corps, rediffusion, niveau joué, essai qui part du départ, joueur, plafond proportionnel à la durée, rejeu), médailles lues sur le niveau (`medailleDeLigne`), `tableau` (le classement), `reponseEnvoi`, `etatSansEssai` (`en_cours`).
- **Adaptateur** (`ADAPTATEUR_JUMP`) : `jump_results`, temps (pas) ↑ ; `sansMedaille`, `lecturesPlus: ["deaths"]` ; niveau du jour dans `jump_levels`. Aucune table, aucune migration, aucune version.
- **`routesPropres`** : `POST lives`, `GET day/<date>/ghost/first`, `deaths`, `carnage`, `bundle`. `me` (format de Jump) passe par `config.profil`. Les vies (`jumpLives.ts`) sont inchangées et reçoivent leurs dépendances du module.
- **Points d'extension du module** (tous facultatifs, absents = Tower tel quel ; `apps/api/CLAUDE.md`) : `valider`/`corpsDeRegistre`/`unites`, `tableau` (**le point d'extension du board** : `levelId`, `deaths`, niveau lu seulement s'il y a des classés), `jourMin`, `messagesJournal`, `etatSansEssai`, `sansMedaille`/`lecturesPlus` (adaptateur), `avantRoute`, `recevoirOutils` (`OutilsModule`), `profil`, `memoClasses`, `surcharges` (portail, admin, rotation, effacement, après renommage / effacement). `ReponseEnvoi` reçoit en plus `jour` et `niveau`. Le module ne nomme aucun jeu.

## Lignes (avant → après)
`jump.ts` 1 013 → 879 (**−134**) ; `jumpLives.ts` 592 (inchangé) ; `cdj.ts` 1 187 (inchangé). Le module : `module.ts` 416 → 545, `contrat.ts` 111 → 168, `adaptateur.ts` 188 → 195 (**+193**). **Net : +59 lignes** : le module paie ici ses points d'extension ; le gain attendu est pour le jeu suivant, pas pour Jump seul (comme pour Tower en K2).

## Les trois bancs (`scripts/banc-*.ts`, `test/fixtures/banc-*.json`, SQLite **et** libSQL)
| Jeu | Traces | Contenu | Avant / après |
|---|---|---|---|
| Tower | 169 | (K2) | identique |
| **Jump** | 242 | envoi valide, **un refus par code** (27 codes), débit 429, plafond 503, grâce de minuit, niveau gardé abîmé (503), classements Tous / Amis / Mon groupe / Groupes / portail, `me`, `ghost/first`, `bundle`, vies (refus, doublons, plafond de 30), carte, carnage, **oubli de fin de jour**, copie, `off` / aperçu de PR / `preview` avec et sans clé / `on`, masquer / retirer / renommer, changement de code, effacement, jour figé (copie de la preuve, vieil onglet, fichier abîmé), état de la base | **identique, 0 différence** |
| Track | 266 (34 codes) | routes historiques sous `/api`, un refus par code, circuit et planning, médailles de chaque version du générateur (g15, g16, g18), Salon (envoi, grâce, oubli), Garage, `/run/<ref>`, `X-Player-Id` et `?player=`, mêmes interrupteur / administration / effacement | produit sur le code d'avant ; Track n'a pas changé (stable sur deux passages et deux bases) |
La référence de Jump et celle de Track ont été **produites par le code d'avant** (premier commit). Seul changement du banc partagé : `normaliser` masque `etat.api.ms` et `etat.base.ms` du tableau de bord (durées lues sur l'horloge réelle).

## Coûts (R14) et temps de rejeu
- `npm run measure:lignes` : **identique** pour les douze routes, à une attribution près — « portail classement (cumul) » : 458 → 462 lues, 2 → 6 parcourues. Le dump par requête (SQL identique, mêmes lignes rendues) montre que les 4 pas en plus sont attribués à `planning` et `jump_levels` (recherches par clé) : le module ajoute un tour de boucle avant la lecture du niveau, la lecture se recouvre alors avec le parcours de la table `jeux` (2 pas) et `nscan` (compteur global de la connexion) le compte deux fois. Aucun parcours réel de plus ; plafonds de `routesChaudes.test.ts` tenus, plans `EXPLAIN` inchangés.
- **Temps d'un envoi complet** (`npm run measure:rejeu`, 20 passes après 3 d'échauffement, libSQL `file:`, machine partagée de 4 cœurs : **bruitée**, deux séries) — médiane, avant → après : Jump 14,5 / 15,3 → 14,0 / 10,6 ms (rejeu seul ≈ 3,4–6,1) ; Track 26,7 / 18,6 → 27,1 / 26,1 ms (non touché) ; Tower 78,2 / 65,7 → 96,7 / 55,6 ms (non touché). **Aucun écart au-delà du bruit** ; le rejeu seul est le même code.

## Arrêt propre : Track
Je n'ai **pas** migré Track. Ce n'est pas une différence de banc que je n'aurais pu résorber, mais un inventaire que le module ne couvre pas et qui demande son propre lot (le banc de Track est là pour le sécuriser) :
- **Le niveau du jour** : `circuits` n'a pas de colonne `rule` (le module en écrit une) ; le circuit est choisi par le planning (variante, thème) et validé par `trackId`. Sans migration, il faut un mode de persistance du niveau configurable.
- **Le classement** : Track range `ms`, puis `submitted_at`, **sans** l'identifiant en dernier départage (deux joueurs au même instant ont le même rang) ; le module départage toujours par `player_id` (le rang d'égalité changerait). Départages à rendre configurables.
- **Routes** : `leaderboard` (et non `board`), `ghost?kind=`, `run/<ref>`, `GET /api/info` n'existe pas (le module l'ajouterait) ; réponses `no-store` (le module pose le cache des jeux) ; `?limit=` ; ancien `?player=` ; board sans `open` ni `generation`.
- **Validation** : date et rediffusion lues **avant** le débit, identifiant en en-tête **ou** dans le corps, joueur avant la validation du rejeu, copies après ; réponse d'envoi avec le Garage (`garage`, `nouvelles`) et la voiture de la course, lus avant l'écriture.
- Colonnes propres (`splits`, `respawns`, `car`, `final_rank`), médailles par version du générateur (G1), profil `/api/me` de la plateforme (`GameInstance.profile`), Salon, Garage, planning, outils d'administration : à garder en `routesPropres` ou en surcharges.
Ordre de grandeur : une dizaine de points d'extension de plus, et les 1 187 lignes de `cdj.ts` à reprendre sous le garde du banc de Track.

## Vérifié / non vérifié
Vérifié : `tsc -b` ; suite `apps/api` entière sur SQLite (831 tests) **et** libSQL (813, 7 ignorés comme avant) ; les trois bancs ; `measure:lignes` ; `measure:rejeu`. Étendu pour le lot : `codesErreur.test.ts` compte aussi les codes que seul un contrat lève (`RefusJeu`) — un test élargi, pas affaibli. Non vérifié : `smoke` sur la recette, la CI (voir ci-dessous).

## CI
(à compléter : runs de la CI de PR et du run en mode `main`)
