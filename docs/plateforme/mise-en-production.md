# Mettre en production — la liste de contrôle (lot R6)

Depuis le lundi 26 octobre 2026, **des joueurs publics jouent chaque jour**. Une mise en production ne doit donc **jamais changer un jour déjà joué** (temps, fantômes, archives deviendraient faux), tout en **rechargeant les cartes des jours à venir** avec le nouveau code quand les générateurs évoluent. Ce guide dit comment, pas à pas, au téléphone ou à l'ordinateur. Le détail technique est dans `docs/plateforme/lots/lot-R6-garde-fou-des-jours.md`.

> **Un agent ne clique jamais** sur « Mettre en production » (ni sur sa répétition : un agent de session ne peut pas lancer un workflow). Il prépare ; tu cliques. Les agents n'ont pas accès à la production.

## 1. La règle en une page

- **Le jour de bascule** est **le premier jour de Paris qui commence après le déploiement**, calculé **au moment du clic** (jamais écrit en dur) :

  | tu cliques… | jour de bascule |
  |---|---|
  | un mardi à 10 h | le mercredi |
  | un lundi à 23 h 30 | le mardi |
  | la nuit du changement d'heure, le 28 mars 2027 (à 1 h 30 ou à 3 h 30) | le lundi 29 mars (le 28 mars dure 23 h : le calendrier compte, pas les heures) |

- **Avant la bascule** (jours passés et jour en cours, depuis la journée n° 1) : la carte de chaque jeu est **exactement** celle que la production sert aujourd'hui. Les temps, classements, fantômes et archives de ces jours restent vrais.
- **À partir de la bascule** : les jours sont **régénérés avec le nouveau code** puis validés (rediffusion de l'auteur ; règle « jouable par un humain » pour Jump ; temps d'auteur et seuils de médailles pour Track), et ne sont figés qu'à la mise en production **suivante** (avec le code qui les aura servis).
- Les jours **d'avant le lancement** (avant la journée n° 1, `config/lancement.json`) ne comptent plus : aucun résultat n'y existe.

### Comment chaque jeu protège ses jours passés

| | DailyJump | DailyTrack |
|---|---|---|
| Ce qui existait | **Jours figés** : un fichier par jour (`apps/jump/public/levels/AAAA-MM-JJ.json`), relu et rejoué par le serveur *et* le jeu (`thawLevel`). | **Version du générateur choisie selon la date** (`generatorVersionOf`, `dailyId.ts`) : un jour garde son générateur au bit près ; les médailles de même (`medals.ts`). Le circuit gardé en base ne sert qu'au serveur : le jeu, lui, recalcule dans le navigateur. |
| Ce qui manquait | Figer « jusqu'à demain » faisait figer **le jour de bascule** avec l'ancien code ; un jour que la production sert hors du commit de son étiquette (PR « Jours figés » pas encore fusionnée) était regénéré par le code d'aujourd'hui → faux conflit. | **Rien ne vérifiait** qu'une règle de générateur modifiée n'altérait pas un jour passé : seuls cinq jours d'avant le 28/10 étaient dans le *golden*. |
| Ce que ce lot ajoute | Figer **jusqu'à la veille du jour de bascule** ; remettre d'abord les jours que la production sert (`jours-servis`) ; le serveur accepte un onglet d'avant la mise en production pour un jour conservé (versions du niveau, pas celles du code). | `apps/api/test/jours-passes.json` : l'**empreinte** (identifiant, texte, temps du pilote, médailles, thème) de chaque jour passé, ajoutée à chaque mise en production avec le code qui le servait. Le test `jours-passes.test.ts` échoue **dès la PR** qui changerait un de ces jours. |
| Pour les deux | Le workflow compare les empreintes de chaque jour **avant la bascule** entre ce que sert la production et ce que servira la nouvelle construction : **la moindre différence arrête la mise en production**, avant tout déploiement. |

## 2. Avant le clic

À faire dans l'ordre. **Chaque ligne se coche.**

1. [ ] **Plus de PR à fusionner.** Les lots de jeu peuvent continuer de fusionner, mais pas pendant les étapes suivantes. (Un lot qui change un générateur ne casse rien : le garde-fou est fait pour ça.)
2. [ ] **Le lot de préparation est fusionné** : la CI complète de `main` a été lancée, les tests rouges réparés (`docs/orchestration.md`, § 12). **Lien** : Actions › CI › le dernier run `push` de `main` → **tout vert** (le workflow le vérifie aussi et refuse sinon : `scripts/ci-complete.mjs`).
3. [ ] **La PR « Jours figés — prod-… » de la mise en production précédente est fusionnée** (Pull requests, branche `robot/jours-figes-…`). Le workflow refuse de partir sinon : les jours que la production sert n'y sont pas tous dans `main`.
4. [ ] **Fais la répétition** (§ 6) : Actions › « Mettre en production » › Run workflow › **mode répétition**, heure simulée = l'heure à laquelle tu comptes cliquer pour de vrai (par exemple `demain 10:00`). Le résumé doit dire : jour de bascule, N jours conservés **sans différence**, M jours régénérés **et validés**, ancien code sur la base migrée ✅, `smoke` vert. **Rouge = on ne clique pas.**
5. [ ] **Choisis l'heure du clic, donc le jour de bascule** (§ 1). Évite le soir tard : la validation de ton clic (« Review deployments ») peut durer ; si le jour de bascule commence avant que tu valides, le workflow **refuse de déployer** (« le jour de bascule a déjà commencé ») et il faut relancer. Un clic le matin laisse toute la journée.
6. [ ] **Note la carte du jour avant le déploiement** (pour la comparer après, § 4.4) : ouvre `https://playdujour.com/api/day/AAAA-MM-JJ` et `https://playdujour.com/api/jump/day/AAAA-MM-JJ` avec la date d'aujourd'hui (jour de Paris) ; garde `trackId` pour Track, et `id` + `hash` pour Jump (capture d'écran suffisante).
7. [ ] **Sauvegarde la base de production** (sur ton ordinateur — les agents n'y ont pas accès) :
   1. Dans un terminal, **hors du dépôt** :
      ```bash
      mkdir -p ~/sauvegardes-dujour
      turso db shell dailytrack-misterzcool .dump > ~/sauvegardes-dujour/dailytrack-misterzcool-AVANT-$(date +%F-%H%M).sql
      ```
      (Autre commande possible : `turso db export dailytrack-misterzcool --output-file ~/sauvegardes-dujour/dailytrack-misterzcool-AVANT-$(date +%F-%H%M).db`.)
   2. **Vérifie** : `ls -lh ~/sauvegardes-dujour/` (plusieurs ko au moins) et `grep -c "CREATE TABLE" ~/sauvegardes-dujour/*AVANT-*.sql` (≥ 10 tables).
   3. **Range-la sur ton ordinateur seulement** (jamais dans le dépôt, qui est public ; pas de nuage partagé, pas d'e-mail) : elle contient des pseudos et des empreintes d'adresses.
   4. **Garde-la 7 jours après la mise en production**, puis supprime-la (`rm ~/sauvegardes-dujour/*AVANT-<date>*`) ; ne garde que la plus récente. Note la date de suppression dans ton agenda.
   5. Elle sert si la **base** est abîmée (rare) : le retour arrière (§ 5) ne restaure **pas** la base.

## 3. Le clic

**Actions › « Mettre en production » › Run workflow**, branche **`main`**, **mode `production`**, « commit » et « heure_simulee » **vides**. Puis, quand le job du serveur l'attend, **Review deployments › Approve** (c'est ta validation ; elle ne contourne jamais un refus du workflow).

Ce que le **résumé du run** doit afficher (de haut en bas) :

1. « CI complète : verte — la production peut continuer ».
2. « **Jour de bascule : AAAA-MM-JJ** … » et la liste des PR, puis **« Ce qui part »** (§ 7).
3. « **Jours protégés et jours sans résultat** » (lot R11 : combien de jours sont protégés — d'avant le lancement, déjà figés, avec un résultat en production — et lesquels n'ont aucun résultat) ; « **Registre des jours de Track** » (jours du dépôt identiques à ce que la production sert, **0 différence**, jours ajoutés) ; puis « **Jours : ce qui est conservé, ce qui est rechargé** » : un tableau par jeu — **jours conservés (identiques)**, **0 jour en différence**, jours régénérés, **validés = régénérés** — et la ligne « ✅ Aucun jour protégé ne change ; tous les jours régénérés sont valides ». (Si c'est rouge : « ⛔ La mise en production s'arrête », avec les jours en cause. Rien n'est déployé. Voir « Si le workflow s'arrête », ci-dessous.)
4. « **Ancien code sur la base migrée (le retour arrière tourne)** » ✅✅.
5. Le tableau final : serveur ✅ (après ta validation), site ✅, vérification en lecture seule ✅, étiquette `prod-AAAA-MM-JJ-HHMM` ✅, jours figés dans le dépôt (PR « Jours figés » : fusion automatique, ou **à fusionner par toi**).

**Si le workflow s'arrête sur « un jour protégé changerait »** : c'est le garde-fou qui fait son travail. **Lot R11 : il n'y a plus de date de bascule à déplacer** (Track, comme Jump, fige ses jours à la mise en production : le registre des jours `packages/sim/src/jours-track.json`). Un jour protégé (d'avant le lancement, déjà figé, ou avec au moins un résultat en production) qui change vient d'un changement de **physique** (`SIM_VERSION`, médailles), d'un **thème** modifié sans nouvelle version, ou d'un générateur changé sans monter `GENERATOR_VERSION` : ne rien « arranger » en réécrivant le registre ou un fichier figé (un jour protégé ne change jamais) ; demander un lot. Si le résumé dit **« Registre des jours de Track … ⛔ »**, le registre du dépôt ne s'accorde pas avec ce que la production sert (jour au-delà de la veille de la bascule, version différente) : le dire, ne pas le corriger à la main. Si **« les résultats de la production n'ont pas pu être lus »** : la lecture seule du classement du jour a échoué (serveur injoignable) ; relancer quand `playdujour.com` répond.

**Jours sans résultat (lot R11)** : le résumé « Jours protégés et jours sans résultat » liste les jours d'avant la bascule qui n'ont aucun résultat (Track ni Jump) : ils sont **régénérés avec le nouveau code**, comme le jour de bascule. Au lancement (après la remise à zéro), la mise en production du 26 ou du 27 octobre régénère le 27. Si un joueur envoie un résultat sur un de ces jours entre le garde-fou et le déploiement (la validation peut durer), le serveur et le site le relisent et **arrêtent** : relancer.

## 4. Après le clic (10 minutes)

1. [ ] **`smoke --lecture-seule` vert** : la ligne « Vérification » du résumé est verte (le serveur répond comme prévu sur `playdujour.com/api/`).
2. [ ] **Le portail, Track et Jump s'ouvrent** : `https://playdujour.com/`, `/track/`, `/jump/` (« Journée n° N » en haut du portail).
3. [ ] **Les deux jeux jouent** : lance une course de Track (le décompte part, la voiture roule) et un début de Jump.
4. [ ] **La carte du jour est la même qu'avant le déploiement** — en un clic par jeu : rouvre `https://playdujour.com/api/day/AAAA-MM-JJ` (Track) et `https://playdujour.com/api/jump/day/AAAA-MM-JJ` (Jump), la date d'aujourd'hui, et compare avec ce que tu as noté à l'étape 2.6 : **`trackId` identique** (Track) ; **`id` et `hash` identiques** (Jump). (La lecture de Jump est gardée 30 s par le cache : si tu viens de déployer, attends une minute.) Tout écart : **retour arrière tout de suite** (§ 5) — c'est le seul cas où le jour d'aujourd'hui aurait changé, ce que le garde-fou interdit.
5. [ ] **Une archive ancienne de chaque jeu se rejoue** : Track — Archives (touche **H** ou le bouton), ouvre un jour d'avant la bascule, « Revoir le meilleur tour » (la rediffusion se rejoue au temps indiqué) ; Jump — ouvre une archive d'avant la bascule (par exemple celle du jour de lancement) : le niveau se charge et se joue, sans message d'erreur.
6. [ ] **Les cartes de partage s'affichent** : colle `https://playdujour.com/`, `/track/` et `/jump/` dans une messagerie (ou ouvre `https://playdujour.com/partage/portail.png`, `track.png`, `jump.png`) : l'image et le titre y sont.
7. [ ] **Fusionne la PR « Jours figés — prod-… »** si le résumé dit « à fusionner par Nathan » (la CI doit être verte), puis vérifie qu'elle est dans `main`. **C'est la condition de la prochaine mise en production.**
8. [ ] **Dis aux joueurs ce qui change à partir du jour de bascule** : les notes de version (§ 9), cinq lignes au plus, à publier où tu veux.

## 5. Si ça casse : le retour arrière

**Actions › « Retour arrière » › Run workflow** (branche `main`) ; « étiquette » vide = la mise en production d'avant la dernière. Validation demandée.

- **Ce qu'il restaure** : le **serveur** (l'image de la mise en production précédente, `gcloud run deploy --image`, réglages du service inchangés) et le **site** (la version Firebase notée dans l'étiquette), puis `smoke --lecture-seule`, puis une nouvelle étiquette `prod-…` sur le commit remis.
- **Ce qu'il ne restaure pas** :
  - **la base** : elle n'est jamais restaurée. Les migrations sont **en avant seulement** et compatibles avec le code d'avant (test `migrations.test.ts`, et chaque mise en production fait tourner l'ancien serveur sur la base migrée, `scripts/base-migree.mjs`) : l'ancien code tourne sur la base d'après. La sauvegarde du § 2.7 ne sert qu'à une base abîmée (restauration à la main, Turso) ;
  - **les jours figés après l'étiquette remise** : ils ne sont pas dans son image. Tant que le jour de bascule n'a pas commencé, ça ne compte pas (voir « quand l'utiliser ») ;
  - **les temps envoyés entre-temps** : ils restent en base (c'est voulu).
- **Quand l'utiliser** :
  - **Le jour même, avant minuit de Paris (avant le jour de bascule)** : aucun joueur n'a vu la carte du nouveau code ; le retour arrière ne change aucun jour ouvert. C'est le cas normal : un problème de serveur, de site, de jeu qui ne démarre pas, une vérification rouge.
  - **Après le début du jour de bascule** : le workflow **le refuse** (`apres_le_jour_j` à cocher pour passer outre). Les joueurs ont joué les cartes du nouveau code : revenir en arrière rendrait à ces jours les cartes de l'ancien. Il vaut mieux **corriger en avant** (une PR, une nouvelle mise en production : même procédure). N'utilise `apres_le_jour_j` qu'en connaissance de cause (une panne grave), et préviens les joueurs que le jour de bascule peut avoir changé.
- **À la main**, si GitHub ne répond pas : `docs/plateforme/domaine.md`, « Le retour arrière ».

## 6. La répétition générale sur la recette

Actions › « Mettre en production » › Run workflow › **mode `repetition`**, **heure_simulee** (à Paris) :

| à tester | heure simulée | jour de bascule attendu |
|---|---|---|
| un matin | `demain 10:00` | après-demain |
| un soir tard | `aujourdhui 23:30` | demain |
| la nuit d'un changement d'heure | `2027-03-28 03:30` (ou `01:30`) ; `02:30` n'existe pas et est refusée | le lundi 29/03/2027 |

Elle fait **tout contre la recette** : la CI complète (pour information), le calcul du jour de bascule, les jours figés avec le code en production, la **comparaison des empreintes des jours**, la régénération des 14 jours suivants, l'ancien code sur la base migrée, le déploiement de **la recette** (serveur et site), `smoke --lecture-seule` puis le **`smoke` complet** (qui crée des joueurs « Fumée » : la recette seulement). **Ni étiquette, ni PR des jours figés, ni production, ni validation.** Le résumé est celui de la vraie production.

- La recette sert ensuite `main` dès la fusion suivante, comme d'habitude. La répétition de la nuit du 28 mars 2027 fige ≈ 5 mois de niveaux de Jump avec le code en production (≈ 4 minutes de calcul) : la recette les sert jusqu'à sa prochaine mise à jour.
- **Le voir sur la recette** : `https://recette.playdujour.com/` ouvre le jour en cours de chaque jeu, le même qu'en production ; avec l'outil de date de la recette — Track : `/track/?seed=AAAA-MM-JJ` (ou la page `/track/admin/`) ; Jump : `/jump/?semaine=AAAA-MM-JJ` (les sept niveaux suivants, calculés par le code de la recette), tous deux fermés en production —, le **jour de bascule montre la nouvelle carte**, les jours d'avant la même qu'en production.

## 7. Ce qui part

Le script `scripts/mise-en-production.mjs inventaire <étiquette précédente> <commit>` écrit, **dans le résumé du run** et à chaque mise en production : les **PR fusionnées** depuis la dernière étiquette `prod-*` (titre, lot, zone), les **versions** qui changent (`JUMP_SIM_VERSION`, `JUMP_GENERATOR_VERSION`, `SIM_VERSION`, `GENERATOR_VERSION` et les dates de bascule de Track), les **migrations** de la base et les nouvelles tables, les **routes** ajoutées ou retirées du serveur. Chaque ligne a son **effet pour le joueur**, son **risque** et **comment on le vérifie** :

| changement | effet pour le joueur | risque | comment on le vérifie |
|---|---|---|---|
| `JUMP_GENERATOR_VERSION` | les niveaux de Jump **à partir du jour de bascule** changent | un jour passé qui changerait | le résumé « Jours » : 0 différence, N régénérés valides |
| `JUMP_SIM_VERSION` | la physique de Jump change pour les niveaux d'après la bascule | un onglet resté ouvert envoie l'ancienne version | accepté pour un jour conservé, « recharge la page » sinon (`jumpVieuxOnglets.test.ts`) ; les archives se rejouent |
| `GENERATOR_VERSION` de Track | les circuits de Track **à partir du jour de bascule** changent (le registre garde la version de chaque jour protégé) | un jour protégé que le registre ne nommerait pas | « Jours » et « Registre des jours de Track » : 0 différence ; `jours-passes.test.ts` |
| `SIM_VERSION` | la physique de Track change : les anciennes rediffusions ne se rejouent plus | tous les anciens fantômes | golden régénérés par le lot ; un temps envoyé après le déploiement |
| migration | rien de visible | le retour arrière sur la base migrée | `migrations.test.ts`, ancien code sur base migrée |
| nouvelle table | rien de visible | oubli de la remise à zéro et de l'effacement d'un joueur | `remiseAZero.test.ts` |
| route ajoutée / retirée | une nouvelle réponse / un 404 pour un vieil onglet | coût en requêtes ; appelant oublié | `smoke --lecture-seule` ; `codes-erreur.md` |

Exemple produit par le script entre `prod-2026-10-25-0933` et le dernier commit de `main` au moment du lot R6 :

<!-- Le contenu ci-dessous est la sortie du script ; il n'est pas à la main. -->

#### Ce qui part — de `prod-2026-10-25-0933` à `f501bce`

**PR fusionnées (16)**

| PR | titre | lot | zone |
|---|---|---|---|
| #155 | Lot 50 — Track : banc d'essai du rendu (?banc) et post-traitement pour carte intégrée | lot 50 | Track |
| #156 | Lot 23 — Champignons (DailyJump, forêt) : sim v7, générateur g17 | lot 23 | Jump |
| #154 | Lot R9 (plateforme) — Avant le partage : fermer les copies de temps | lot R9 | Track + Jump + plateforme |
| #153 | Lot 22 DailyJump : presses (usine, sim v6, générateur g16) | lot 22 | Jump |
| #152 | Retouche 47b — Track : le post-traitement n'est plus choisi par « Auto » | lot 47B | Track |
| #141 | Lot R7 (plateforme) — Audit de sécurité, et le dépôt public ou privé | lot R7 | Track + Jump + plateforme |
| #150 | Lot 21 (DailyJump) : poids, joueurs fictifs et économie | lot 21 | Jump |
| #151 | Plateforme : zone de plateformes.spec.ts dans e2e/zones.json | — | plateforme |
| #143 | Lot R8 (plateforme) : le lancement public, tout le monde repart de zéro, journée n° 1 | lot R8 | Track + Jump + plateforme |
| #142 | Lot 20 — Plateformes mobiles (DailyJump, sim v5, générateur g15) | lot 20 | Jump |
| #144 | Lot R10 (plateforme) — Une CI de PR courte, des agents plus sobres | lot R10 | Track + Jump + plateforme |
| #140 | Track : un seul réglage de qualité (« Qualité graphique ») | — | Track |
| #139 | Lot 19 DailyJump — Variété des passages (g14) | lot 19 | Jump |
| #138 | Lot 49 — Track : une identité de jeu par thème, des sauts plus techniques | lot 49 | Track + plateforme |
| #136 | Lot 48 — Track : l'herbe de la Campagne, une vraie surface de course | lot 48 | Track + plateforme |
| #137 | Lot 18 DailyJump : lisibilité des éléments à horloge, rythme de la nuit (g13) | lot 18 | Jump |

**Versions, base et routes qui changent**

| changement | effet pour le joueur | risque | comment on le vérifie |
|---|---|---|---|
| JUMP_GENERATOR_VERSION : 12 → 17 | Les niveaux de Jump **à partir du jour de bascule** changent (autres morceaux) ; avant, rien. | Un jour passé qui changerait arrête la mise en production. | Résumé « Jours » : 0 différence, N jours régénérés et valides. |
| JUMP_SIM_VERSION : 4 → 7 | La physique de Jump change pour les niveaux d'après la bascule ; les jours figés se rejouent comme avant. | Un onglet resté ouvert envoie l'ancienne version : accepté pour un jour d'avant la bascule, sinon « recharge la page ». | Tests `jumpVieuxOnglets` ; les archives se rejouent (liste de contrôle). |
| GENERATOR_VERSION : 16 → 18 | Les circuits de Track **à partir du jour de bascule de la mise en production** changent (lot R11 : le registre des jours garde la version de chaque jour protégé) ; les jours protégés gardent leur circuit au bit près. | Un jour protégé que le registre ne nommerait pas prendrait la nouvelle version : le registre est écrit par ce workflow, avant le déploiement. | Résumé « Jours » et « Registre des jours de Track » : 0 différence ; `jours-passes.json`. |
| migration : `ALTER TABLE results ADD COLUMN inputs_hash TEXT` | Aucun changement visible (la base gagne une colonne ou un index). | Le retour arrière doit tourner sur la base migrée : colonne vide ou valeur par défaut seulement. | Test des migrations ; « ancien code sur base migrée » (workflow). |
| migration : `ALTER TABLE circuits ADD COLUMN author_hash TEXT` | Aucun changement visible (la base gagne une colonne ou un index). | Le retour arrière doit tourner sur la base migrée : colonne vide ou valeur par défaut seulement. | Test des migrations ; « ancien code sur base migrée » (workflow). |
| migration : `ALTER TABLE jump_results ADD COLUMN inputs_hash TEXT` | Aucun changement visible (la base gagne une colonne ou un index). | Le retour arrière doit tourner sur la base migrée : colonne vide ou valeur par défaut seulement. | Test des migrations ; « ancien code sur base migrée » (workflow). |
| migration : `ALTER TABLE jump_levels ADD COLUMN author_hash TEXT` | Aucun changement visible (la base gagne une colonne ou un index). | Le retour arrière doit tourner sur la base migrée : colonne vide ou valeur par défaut seulement. | Test des migrations ; « ancien code sur base migrée » (workflow). |
| migration : `CREATE INDEX IF NOT EXISTS results_by_inputs ON results (day, inputs_hash)` | Aucun changement visible (la base gagne une colonne ou un index). | Le retour arrière doit tourner sur la base migrée : colonne vide ou valeur par défaut seulement. | Test des migrations ; « ancien code sur base migrée » (workflow). |
| migration : `CREATE INDEX IF NOT EXISTS jump_results_by_inputs ON jump_results (day, inputs_hash)` | Aucun changement visible (la base gagne une colonne ou un index). | Le retour arrière doit tourner sur la base migrée : colonne vide ou valeur par défaut seulement. | Test des migrations ; « ancien code sur base migrée » (workflow). |

Schéma de la base : 14 migration(s) en tout, 6 nouvelle(s) ; 16 table(s).

## 8. Les onglets restés ouverts

Un joueur qui a ouvert un jeu avant le déploiement et envoie son temps après :

- **Jump** : le jeu annonce `simVersion` et `generatorVersion` de **son** code. Pour un jour **conservé** (fichier figé, même identifiant), le serveur accepte les versions **du niveau** de ce jour (`apps/api/src/jump.ts`, `validateJump`) : l'envoi passe, le temps est rejoué par le serveur comme toujours. Pour un jour **régénéré**, ou pour un onglet « du futur », il reçoit `409 version` — traduit « Une nouvelle version du jeu est disponible : recharge la page » — et le jeu l'affiche (`rang.version`) : jamais une perte silencieuse.
- **Track** : une rediffusion porte `SIM_VERSION` et l'identifiant du circuit. Même `SIM_VERSION` et même identifiant de circuit (tout jour d'avant la bascule du générateur) : acceptée. `SIM_VERSION` changée : `409 sim_version` (« recharge la page ») — la physique a changé, l'ancienne course ne se rejouerait pas ; autre circuit : `409 track_mismatch`. Le meilleur temps reste dans le navigateur et repart à l'envoi suivant.

## 9. Notes de version (pour les joueurs)

Cinq lignes au plus, ton de la charte (§ 7). À adapter au contenu de la mise en production ; **ci-dessous celles de la mise en production qui suit le lot R6** (`<jour de bascule>` : la date que le résumé du run annonce).

**Français**

> **Du Jour — nouveautés à partir du `<jour de bascule>`**
> - **Jump** : des presses à l'usine, des plateformes mobiles, des champignons dans la forêt — et des niveaux qui se ressemblent moins d'un jour à l'autre.
> - **Jump, la nuit** : les blocs clignotants laissent enfin le temps de lire.
> - **Track** : à partir du 4 novembre, chaque thème a son caractère — sauts plus techniques, herbe de course à la Campagne.
> - Ce qui est joué ne bouge pas : tes temps, tes fantômes et tes archives d'avant restent comme ils étaient.
> - Une page restée ouverte ? Recharge-la pour jouer le niveau du jour.

**English**

> **Du Jour — what's new from `<switch day>`**
> - **Jump**: presses in the factory, moving platforms, mushrooms in the forest — and levels that look less alike from one day to the next.
> - **Jump at night**: blinking blocks finally give you time to read them.
> - **Track**: from 4 November, every theme has its own character — trickier jumps, racing grass in the Countryside.
> - What's been played stays put: your times, ghosts and past archives are untouched.
> - Left a page open? Reload it to play today's level.

## 10. Ce qui reste risqué

Voir le README du lot (`docs/plateforme/lots/lot-R6-garde-fou-des-jours.md`, « Ce qui reste risqué »).
