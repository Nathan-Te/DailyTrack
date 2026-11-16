# Lot GR5 — Gravity : prêt pour la preview

Branche `ccr-36287547-q40dui` (la branche que la session impose ne contient pas « gravity » : la PR porte l'étiquette **`jeu:gravity`**, qui l'emporte sur le nom de branche dans `zones-jeu.mjs`), PR brouillon. Le jeu reste `off`. **Pour les joueurs : rien.** Sim, générateur, robot et **golden inchangés** (`golden:gravity` régénéré : aucune différence ; versions 2, 3, 2). Seed non modifié. **Aucun fichier partagé touché** hors ce que la passation tolère (fiche, ce que `npm run fiches` en tire, `traductions.md`).

## Vérifié d'abord
- **GR4 est fusionné** (PR #342, `c9d3d77`, dans `main`).
- **PG1, point par point** (PR #341, `8ba1b9b`, dans `main`) — j'adopte ce qui est fusionné, je dis le reste :
  | PG1 | fusionné | dans ce lot |
  |---|---|---|
  | 1 mentions de Gravity (deux pages) | oui | **adopté** : marqueur « À remplacer » retiré, `mentions.test.ts` traite Gravity comme livré |
  | 2 ligne `gravity.demande` | oui | gardée ; **189,7 Ko pour 203 Ko** |
  | 3 `three` dans `package.json` | oui | rien à faire |
  | 4 `chargerPartie` | oui | **adopté** |
  | 5 HUD en surimpression | oui | **adopté** |
  | 6 `@cdj/visuels` (piques, blocs, chevrons, vent, accessoire) | oui | **accessoire adopté** ; **les quatre dessins communs non adoptés** (ci-dessous) |
  | 0b `franchissabilite-30-jours` en Régression | oui | rien à faire |

## Livré
1. **Pièces du kit.** `hud: "surimpression"` (zones haut-gauche / centre / haut-droite / annonce ; plus aucune règle pour masquer la barre), `chargerPartie` (la scène au toucher de JOUER, **préchauffée** sans être attendue ; le panneau « Aujourd'hui » a son morceau `panneau-`), le bandeau dans `creerPersonnage(…).accessoire` (plus d'écrasement propre). **Captures avant / après** (`captures/GR5/`, outil `captures-lot-gr3`, qui attend maintenant la médaille au lieu d'un délai) : écarts de plus de 24 / 255 : **162 à 218 pixels sur 921 600** en paysage (le sous-pixel du texte centré, et le bandeau, qui suit désormais le rebond de la tête), **127 sur 280 800** en portrait. **La forêt n'est pas comparable pixel à pixel** : l'autocollant ×, animé en CSS sur l'horloge réelle, y est capturé à une autre phase (même écart entre deux prises « avant »).
2. **Jours préparés.** `npm run preparer:gravity -w @cdj/gravity-sim -- --du … --au …` (`jours.fabrication.preparer` : fenêtre veille de la bascule → J+14, garde `test/jours.test.ts`) écrit les jours avec leurs seuils **et fait passer le robot (2 280 m, contraintes d'humain)** : un jour infranchissable **fait échouer la préparation** (code 1, rien d'écrit pour lui) et dit **le jour, le morceau et le motif**. Essayé sur le vrai générateur : **45 jours (17/11 → 31/12/2026), 0 échec, 94 s** (2,1 s par jour). Le calcul du navigateur en arrière-plan **reste**, pour les essais et les jours sans fichier.
3. **Anciennes versions.** Registres `GENERATEURS` et `SIMS` : un jour figé se relit et se rejoue avec **ses** versions. Test : un jour figé en v3, une v4 et une sim 3 factices posées dans les registres → même contenu, seuils, terrain, rediffusion et résultat (sim : `versions.test.ts` ; jeu : `jourFige.test.ts` ; serveur : `gravityVersions.test.ts`). Règle écrite (garder / retirer) : `packages/gravity-sim/CLAUDE.md`. Le golden d'une version quittée est copié par l'outil, jamais écrasé, et rejoué.
4. **Mentions légales.** PG1 point 1 fusionné : marqueur retiré, `mentions.test.ts` (générique) passe pour Gravity livré, `identite.test.ts` garde l'absence du marqueur. **Plus de bloquant de ce côté.**
5. **Réglages d'essai** (recette, jamais classés, rien en production) : `?vitesse=` `?plafond=` `?pente=` `?gravite=` `?longueur=` `?medailles=` (plages et défauts : `apps/gravity/CLAUDE.md`) ; la scène affiche « Réglage d'essai · départ 9 m/s · gravité 40 » (ce qui a changé). **Analyse des parties** : `npm run analyser -w @cdj/gravity -- --cible recette --distant …` — par jour : effectif, scores et distances (p10 / médiane / p90 / max), durée, **part des joueurs à chaque médaille**, seuils du jour ; une requête vérifiée par son plan, aucun identifiant en sortie.

## La liste de la preview (`off` → `preview`) — chaque ligne a sa preuve
- [x] **Identité complète** (police, motif, illustration, panneau) : `apps/gravity/test/identite.test.ts`, `apps/api/test/jeuxIdentite.test.ts` (le serveur refuse `preview` sinon : `identite_incomplete`).
- [x] **Fiche à jour** (`npm run fiches`, projections) : `npm run fiches -- --verifier`.
- [x] **Mentions légales fr + en** (quatre clés, famille `gravity:`) : `apps/portail/test/mentions.test.ts`.
- [x] **Catalogues fr = en, traductions à jour** : `npm run traductions -- --verifier`, `apps/gravity/test/identite.test.ts`.
- [x] **Budgets** : premier chargement **44 732 o pour 48 Ko** (`gravity.jsCss`, +925 o sur `main`), à la demande 189 697 o pour 203 Ko : `node scripts/budgets-controle.mjs controler` (exit 0), `apps/gravity/e2e/poids.spec.ts` (l'accueil seul : ni scène, ni générateur).
- [x] **Jours préparés** : `preparer` dans la fiche (`apps/portail/test/miseEnProduction.test.ts`, `fiches.test.ts`), `packages/gravity-sim/test/preparation.test.ts` + `preparer-outil.test.ts`, 45 jours essayés.
- [x] **Jours figés relus avec leurs versions** : `versions.test.ts`, `jourFige.test.ts`, `gravityVersions.test.ts` (sauf la limite de la plateforme ci-dessous).
- [x] **Essais absents en production, jamais classés** : `test/essai.test.ts` (`production` → rien ; `classable` faux), `e2e/essais.spec.ts` (mention, « Partie d'essai : non classée »).
- [x] **Golden inchangé** : `npm run golden:gravity` ne change aucun octet ; `golden.test.ts` ; `e2e/determinisme.spec.ts`.
- [x] **Serveur** : rejeu, classement, copies, aperçu, effacement : `apps/api/test/gravity.test.ts` (SQLite et libSQL), `recette:seed` par `gravity-essais.ts`.
- [x] **Son mêlé à celui du téléphone** (règle S2) : `packages/core/test/sonMelange.test.ts`.
- [x] **Zones** : `zones-jeu.mjs` avec `jeu:gravity` : « les 57 fichiers restent dans ses zones ».
- [x] **« Pour les joueurs »** : `rien` (le jeu est `off`).

## Ce que Nathan fait lui-même
- Passer Gravity en **`preview`** dans `/admin/` › Jeux (puis le lien avec la clé d'aperçu).
- **La teinte** de l'étiquette (`#FFB892` / `#C9622E`, provisoire) et **le nom**, s'il change d'avis ; **`premierJour`** de la fiche (`2026-11-02` aujourd'hui).
- Décider des **dessins communs** (ci-dessous) ; **écouter** les effets (le son n'est testé que par sa logique).

## Ce qui revient à la plateforme (je me suis arrêté, je propose)
1. **`memeContenu` du module des jeux** (`apps/api/src/jeux/defauts.ts`) compare la rediffusion au **seul générateur courant** : après un passage à la version suivante, la route d'envoi refuserait (`409 version`) la rediffusion d'un jour figé sous l'ancienne, alors que Gravity sait la rejouer (même manque que Blocks, README B8). Correctif proposé : un champ facultatif du contrat minimal (`generateurDuNiveau?(niveau)`), `memeContenu` compare `r.g` à celui-ci. **Sans lui la règle « garder les anciennes versions » n'est complète qu'au niveau du jeu et du contrat** ; ça ne bloque pas la preview (aucun jour n'est figé tant que le jeu n'est pas `on`), mais **avant la première montée de version d'un jeu servi**. `gravityVersions.test.ts` le dit (409) : à retourner quand c'est corrigé.
2. **Le test « lot PG1 »** de `apps/portail/test/mentions.test.ts` est devenu redondant (le générique couvre Gravity) : à retirer (fichier du portail).
3. **Une piste de musique** pour Gravity (`musique/musiques.json`) ; **trois manques du kit** (README GR4 : bilan sur l'écran de fin, dessins dans « Comment jouer », ouverture de « Comment jouer » en haut). Aucun ne bloque la preview.

## Les dessins communs de PG1 : non adoptés, sur preuve
`creerPiques`, `creerBloc`, `buildBeltArt` et `ajouterFlecheDeVent` **ne donnent pas le même rendu** : un triangle franc par case (Gravity : deux pointes de 0,42 de large), des blocs animés avec pointillé, jauge et pastille (Gravity : quatre états de tampon fixe, annoncés par `etatDuBloc`), un shader de chevrons, une flèche de 0,5 × 0,7 (Gravity : 0,3). Les prendre **change ce que le joueur voit** (Gravity ressemblerait aux plateformes de Jump) : le critère du lot était un rendu identique, et c'est un choix de DA de Nathan. `dessins.ts` garde donc ces quatre dessins (ce sont les « doublons » que le lot voulait retirer : ils restent, par choix de rendu). Si Nathan veut les adopter : un lot à part, avec captures avant / après, et la règle « le rouge réservé aux dangers » à revérifier.

## Vérifié / non vérifié
**Vérifié** : `npm run typecheck` ; tous les unitaires de `gravity-sim`, `gravity`, `portail`, `core`, `kit` ; `apps/api/test/gravity*.test.ts` (SQLite) ; e2e Gravity complets, 28 / 28 (`classement` et `ecrans-kit` à 2560 × 1440 ont échoué une fois, la machine étant chargée par une préparation de 94 s lancée en parallèle, et passent seuls) ; budgets ; robot : 0,89 s par jour en moyenne (comme avant) ; `npm run verifier` et la CI : voir la PR.
**Non vérifié** : la CI complète et libSQL pour `gravityAnalyse.test.ts` (en CI) ; Firefox / WebKit ; la préparation **dans la chaîne de production** (le bouton) ; l'analyse **sur une vraie base Turso** (seulement un fichier local issu du vrai serveur) ; le HUD sur un vrai téléphone (portrait 360 × 780 comparé en capture).
**Écarts au prompt** : branche sans « gravity » (imposée), étiquette à la place ; dessins communs non adoptés (ci-dessus) ; le premier chargement a failli dépasser son plafond (+4,6 Ko) parce que le bundleur sortait `generateur-` et `couleurs-` en morceaux partagés : **ils sont nommés dans `budget.aLaDemande`** de la fiche (`+925 o` au final).

## Reste après la preview
**Le calibrage (lot GR6)** : régler vitesse, pente, longueur d'un thème et pourcentage avec les réglages d'essai et `npm run analyser` sur de vraies parties, **puis monter les versions et régénérer le golden** ; une piste de musique ; la limite de la plateforme ci-dessus avant le premier jour figé.
