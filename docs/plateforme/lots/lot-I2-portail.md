# Lot I2 (plateforme, phase 3) — Le portail

Le portail devient la porte d'entrée du jour : en ouvrant `playdujour.com`, on voit ce qu'il reste à jouer, combien de temps il reste (compte à rebours calé sur l'heure du serveur) et où en est sa série. Vision : `docs/plateforme/seed-phase-3.md` §§ 3-4 ; charte : `docs/plateforme/identite.md` (révision 2) ; socle : README du lot I1.

**Aucun changement** de `packages/sim`, `packages/jump-sim`, `core`, `clock`, d'une règle de jeu, d'un générateur, d'un classement ou d'une rediffusion : **golden des deux jeux inchangés**. **Aucune dépendance npm ajoutée.** Les jeux ne changent que par le lien « ‹ Du Jour » (§ 5).

## 0. Reprises
- **Charte révision 2** placée telle quelle (`docs/plateforme/identite.md`) : elle inscrit les écarts 1 à 5 du lot I1. `@cdj/ui` y était déjà conforme : **aucun jeton ne change** ; le test des contrastes recalcule les rapports annoncés (vert).
- **`decodeURIComponent` non protégé** (`apps/api/src/cdj.ts`) : `decodeDate` rend **400 `invalid_date`** pour `/api/day/%E0`, `/api/day/%E0/leaderboard` et `PUT /api/admin/planning/%E0` (comme le Salon et DailyJump). Le parcours de `codesErreur.test.ts` les essaie et **exige zéro réponse 500** sur une entrée mal formée.

## 1. Le registre déclare ce que le portail montre (`apps/api`)
Crochet **`portail`** de chaque jeu (`GameInstance.portail`, type `PortailDuJeu`, `games.ts`) — le portail et la route ne connaissent aucun jeu :

| déclaration | DailyTrack (`cdj.ts`) | DailyJump (`jump.ts`) |
|---|---|---|
| `premierJour` | `PREMIER_JOUR` (13/10/2026) | `PREMIER_JOUR_JUMP` (16/10/2026) |
| `jour(day)` → numéro, thème (code), seuils (ms) | circuit en vigueur (planning compris) : `circuitNumber`, thème imposé ou `themeForDay`, `medalsFor(authorMs)` | niveau du jour (figé ou généré) : `number`, `theme`, médailles en pas → ms (`TICK_RATE`) |
| `etat(joueur, day)` | `fini` si `results` a sa ligne (temps rejoué, médaille, rang, classés) ; sinon `pas_joue` (**jamais `en_cours`** : le jeu ne peut pas le savoir) | `fini` si `jump_results` a sa ligne ; sinon `en_cours` si `jump_lives` a des morts ce jour-là (`morts`) ; sinon `pas_joue` |
| `joursFinis(joueur)` | `SELECT day FROM results WHERE player_id = ?` (index) | `SELECT day FROM jump_results WHERE player_id = ?` (index) |
| `profil(joueur)` | les statistiques de `GET /api/me` (même calcul, places finales gardées) | jours, médailles, meilleure place — places finales des jours fermés **calculées une fois et gardées** (`jump_results.final_rank`, `final_total` : deux colonnes, `MIGRATIONS`) |

**Aucun temps n'est cru** : `fini` vient du classement prouvé. Le nombre de classés du jour est gardé 30 s par instance (jamais moins que le rang). **Jeu n° 3** : `portail.test.ts` ajoute un faux jeu (`games` de `createApi`, tests seulement) ; il apparaît dans la réponse et compte dans les journées parfaites dès son premier jour, sans toucher à la route.

## 2. La route `GET /api/portail/jour` (et `GET /api/portail/profil`)
- **Sans `X-Player-Id`** : `{ date, maintenant, prochainJour, jeux: [{ jeu, premierJour, numero, theme, seuils }] }` ; `maintenant` et `prochainJour` en ISO UTC (le prochain minuit de Paris). `Cache-Control: public, max-age=min(60, secondes jusqu'à minuit)` + `Vary: X-Player-Id`.
- **Avec `X-Player-Id`** : en plus `jeux[].etat` (`{ statut: "fini", tempsMs, medaille, rang, classes }` · `{ statut: "en_cours", morts? }` · `{ statut: "pas_joue" }`) et `joueur: { pseudo, serie, aProlonger, journeesParfaites, aujourdhuiParfaite }`. `Cache-Control: private, no-cache` + `Vary: X-Player-Id` (règle du lot P4).
- **Erreurs** (codes de la liste unique, aucun nouveau) : joueur inconnu 404 `unknown_player`, code révoqué 410 `code_revoked` — **le corps porte quand même les jeux du jour** (le portail n'a qu'une requête) ; identifiant illisible 400 `invalid_player` ; débit 429 `rate_limited` (en mémoire : 120 lectures par adresse, 60 par joueur et par fenêtre de 10 min ; adresse de connexion du lot R5 comprise).
- `GET /api/portail/profil` (`X-Player-Id` obligatoire) : `{ pseudo, renameRequired, date, serie, aProlonger, journeesParfaites, aujourdhuiParfaite, jeux: [{ jeu, joursFinis, medailles, meilleurRang }] }`, `private, no-cache`. (Ajoutée pour que le profil commun du portail tienne en une requête.)
- **`smoke`** (complet : l'état du joueur d'essai dans les deux jeux, sa journée parfaite, le profil) et **`smoke --lecture-seule`** (la réponse publique, son cache) lisent la route ; vérifiés en local contre `dist/server.mjs`.

**Coût mesuré** (`npm run measure:portail -w @cdj/api`, sqld local, 20/10/2026 ; 50 autres classés par jour et par jeu) :

| lecture | instructions | lignes lues | écrites |
|---|---|---|---|
| jour, sans joueur (en mémoire / instance neuve / premier appel du jour) | 1 / 3 / 5 | 1 / 3 / 5 | 0 / 0 / 2 (le circuit et le niveau du jour, une fois) |
| **jour, joueur de 30 jours** | 12 | **275** | 0 |
| **jour, joueur de 365 jours** | 10 | **841** | 0 |
| profil, 30 jours (ensuite) | 11 | 393 | 0 |
| profil, 365 jours (ensuite / premier appel) | 11 / 13 | 2 404 / 81 146 | 0 / 728 |

Borné : une ligne par jour fini, plus le rang du jour (une ligne par classé devant) et les classés du jour (30 s en mémoire). Le premier appel du profil calcule une fois les places finales (règle du lot 30 de DailyTrack). Détail et projection : `docs/plateforme/couts.md` § 6 ; `PORTAIL_VISITOR` (2 requêtes, 550 lignes lues, 0 écrite par visiteur et par jour) dans `scripts/platformBudget.ts`, `measure:platform -- --portail N`.

## 3. Définitions retenues et cas limites testés
- **Série tous jeux confondus** : jours de Paris consécutifs où le joueur a fini **au moins un** jeu du jour ; aujourd'hui pas encore fini → la série court jusqu'à hier et `aProlonger` (si elle vaut au moins 1) ; cassée → 0. Track un jour, Jump le suivant : la série tient.
- **Journée parfaite** : tous les jeux **qui existaient ce jour-là** finis. Avant le 16/10/2026 (premier jour de Jump), Track seul suffit. Un jour futur ne compte pas.
- **Jours de Paris** : `serieEtParfaites` travaille sur des numéros de jours de Paris (`parisDay`) — testé sur le **25/10/2026** (25 h : à 23 h 30 de Paris, encore le 25 ; série sur 24-25-26) et le **28/03/2027** (23 h : 0 h 30 de Paris, déjà le 29). `prochainJour` : à 0 h 30 le 25/10, minuit est **24 h 30** plus tard (`2026-10-25T23:00:00Z`) ; le 28/03/2027, `2027-03-28T22:00:00Z`. Le cache public ne dépasse jamais minuit (20 s avant : `max-age=20`).
- Tests : `apps/api/test/portail.test.ts` (15, SQLite **et** libSQL), `portailDemo.test.ts`, `codesErreur.test.ts` (routes du portail dans le parcours), `smokeLecture.test.ts`, `platformBudget.test.ts`.

## 4. L'accueil riche et le profil commun (`apps/portail`)
- **Une seule requête au chargement** (`src/jour.ts`) ; changer de langue ne relit rien ; à minuit, une de plus. `cache: "no-store"` ; l'heure du serveur est corrigée de l'en-tête `Age` d'un cache partagé (la réponse publique peut venir du CDN de Hosting).
- **Compte à rebours** (`afficheur`) sur l'heure du serveur ; à zéro, le nouveau jour est relu sans recharger la page (si le serveur rend encore l'ancien, nouvel essai toutes les 2 s, 5 fois au plus) ; plus de 24 h un jour de 25 h.
- **Cartouches tout de suite** (numéro local), **place réservée** pour le thème (« n° 8 · Nuit », numéro et thème sur leur propre ligne) et le statut (deux rangées) : rien ne saute. Statuts, boutons (« Jouer », « Continuer », « Rejouer »), « 1 fini sur 2 », tuile Série (« 5 jours », « 2 journées parfaites », « Joue aujourd'hui pour la garder », journée parfaite : bordure épaisse et drapeau, sans animation). **Joueur neuf** : « Pas encore joué », phrase d'accueil, pas de tuile. **Serveur injoignable** : sans statut, compte à rebours local, message discret du catalogue (`erreur.<code>` ou `portail.horsLigne`).
- **Thèmes traduits** (la liste vient des jeux : `THEME_NAMES`, `JUMP_THEME_NAMES`, test `catalogue.test.ts`) et **une réplique de Jump par thème** (fr / en adaptées) : forêt « Le vent souffle. Rarement dans ton sens. » / “The wind is blowing. Hardly ever your way.” ; usine « Les tapis roulants ne t'attendront pas. La scie non plus. » / “The conveyor belts won't wait for you. Neither will the saw.” ; glace « Ça glisse. Les pics, eux, ne bougent pas. » / “It's slippery. The spikes, sadly, aren't.” ; nuit « Les plateformes clignotent. Toi, tu ne verras rien venir. » / “The platforms blink. You won't see it coming.” ; néon « Une plateforme sur deux. Devine laquelle. » / “Every other platform is there. Guess which.” (à relire par Nathan).
- **Profil commun `/profil/`** (avatar → lien) : pseudo (règles et refus du serveur, pseudos libres), code de transfert (affiché, copié ; charger un code : lu sur le serveur, montré, confirmé, puis `writeIdentity` + `noteIdentityChange("code")` — les jeux vident leur cache à leur prochain démarrage), série, journées parfaites, par jeu (l'étiquette du jeu) jours finis, médailles par type, meilleure place, langue. Les écrans Réglages › Profil des jeux ne changent pas.
- **`@cdj/ui`** (zone partagée, ajouts minimes) : `avatar({ href })` (un lien de 44 px, montré dans la vitrine dans ses états), `barrePortail({ profil })`, option `suite` des étiquettes ; clé commune `profil.ouvrir`. Aucun jeton ni couleur nouvelle ; la pastille « Fini » reprend la paire de la médaille auteur (`dj-auteur-texte` sur `dj-auteur`, déjà vérifiée), le rappel « Joue aujourd'hui… » est en encre (la terre cuite sur crème 2 n'aurait que 3,6:1).
- **Budget** (vraie construction de production) : **premier chargement 19,2 ko compressés** hors polices (I1 : 12,3 ko ; limite 30 ko) ; polices inchangées (115,2 ko, 7 faces).

## 5. Le retour au portail depuis les jeux
« ‹ Du Jour » vers `../` : accueil (`#home-portail`) et menu ⏸ (`#pause-portail` dans DailyTrack, `#menu-portail` dans DailyJump), cibles de 44 px, `aria-label` « Retour au portail Du Jour », clé prête `barre.retour` (`data-t`). Rien d'autre ne change dans les jeux. e2e : `domaine.spec.ts` (portail → jeu → « ‹ Du Jour » → portail, au doigt en portrait, dans les deux jeux).

## 6. Le joueur de démonstration (recette et aperçus seulement)
- **Serveur** : `recette:seed` crée « Démo » (`apps/api/src/portailDemo.ts`, identifiant fixe `de30…de30`) par le vrai `createApi` (`demoPlayers`) : Track fini les 5 derniers jours (aujourd'hui **or** : le pilote automatique, de plus en plus prudent, jusqu'au seuil de l'or), Jump fini avant-hier et hier (essais rejoués), **12 morts aujourd'hui** (vies rejouées, aucun essai classé) → série 5, journées parfaites 2. **Effacé puis recréé** à chaque passage (route d'admin de la plateforme, en mémoire du script) : la série reste de 5 jours quand le script repasse chaque jour (`recette-seed.yml`). `--demo-seulement` : lui seul (≈ 4 s, e2e).
- **Client** : `/?demo=joueur` installe son identité (confirmation s'il y a déjà une autre identité ; « Garder mon profil » ne change rien) et retire le paramètre de l'adresse.
- **Preuve de l'absence en production** : (1) la construction de production (`PORTAIL_VITRINE=0`) ne contient ni l'identifiant, ni « demo », ni les textes (test `construction.test.ts` sur la vraie construction, qui vérifie aussi leur présence dans la construction de recette) ; (2) aucun module du serveur n'importe `portailDemo.ts` (test) ; seul `recette:seed` l'appelle, qui refuse tout sauf `ENVIRONMENT=recette` et une base « recette » (`recetteSeedTarget`, testé depuis le lot R1).

## 7. Captures
`docs/plateforme/lots/img/` (e2e `portail-jour.spec.ts` avec `CAPTURES=1`, Chromium, aussi jointes au rapport du run) :
- portail **plein** (joueur démo) : `lot-I2-portail-plein-portrait-fr.png`, `…-portrait-en.png`, `…-paysage-fr.png`, `…-paysage-en.png` ;
- **joueur neuf** : `lot-I2-portail-neuf-{portrait,paysage}-{fr,en}.png` ;
- **serveur injoignable** : `lot-I2-portail-injoignable-{portrait,paysage}-{fr,en}.png` ;
- **profil** : `lot-I2-profil-{portrait,paysage}-{fr,en}.png` ;
- **minuit passé** : `lot-I2-portail-minuit-portrait-fr.png`.

e2e (`apps/web/e2e/portail-jour.spec.ts`, 8 tests, ≈ 45 s ; ports 4179–4181, 8794–8796) : portail plein et **une seule requête** au chargement, confirmation du lien de démonstration, joueur neuf (aucun identifiant envoyé), serveur injoignable, profil (avatar, statistiques, langue, retour), code chargé dans le profil, **minuit** (serveur à 23 h 59 min 40 s : le compte à rebours passe zéro, le 21 se charge sans recharger la page, « 0 fini sur 2 », la série demande à être prolongée), **25 octobre** (compte à rebours « 24:29:xx »). `portail.spec.ts` (lot I1) suit l'avatar devenu lien.

## 8. Écarts à la charte proposés
1. **Statut sur l'étiquette** : la maquette met « n° 12 · Canyon » à droite du titre ; ici le numéro et le thème passent **sous** le titre (le thème arrive après le chargement : à droite, il ferait passer la ligne à la ligne et sauter la mise en page sur 390 px).
2. **« Rejouer »** prend toute la largeur (la maquette l'aligne à gauche) et la hauteur du bouton principal (46 px) : le statut qui arrive ne fait rien bouger.
3. **Profil** : pas de maquette ; les statistiques par jeu sont posées sur l'étiquette de chaque jeu (la cartouche agrandie, charte § 1) ; médailles en cases, deux par ligne. À juger à l'œil.
4. Pas de « Journée n° 12 » ni de tuile « Classement du jour » (lot I3).

## 9. Vérifié / non vérifié
**Vérifié en local** : `npm run typecheck`, `npx tsc -p apps/portail` ; Vitest (SQLite et libSQL) des zones touchées (`apps/api`, `apps/portail`, `packages`) ; `measure:portail` contre un sqld local ; `smoke` complet et `--lecture-seule` contre `dist/server.mjs` ; e2e Chromium `portail-jour.spec.ts` (8/8), `portail.spec.ts` et `domaine.spec.ts` (14/14 avec le retour depuis les jeux), `accueil.spec.ts` de DailyTrack (27/27 : chevauchements et cibles de l'accueil avec le lien) et `mobile`, `arrivee`, `sensations` de DailyJump (43/43) ; captures regardées.
**Non vérifié** : Firefox et WebKit (le run complet de `main` les lance) ; l'aperçu de la PR et la recette (commentaires « Aperçu » / « Recette » de la PR) ; un vrai téléphone ; le comportement du CDN de Hosting avec `Vary: X-Player-Id` sur la réponse publique (documenté par Firebase ; s'il l'ignorait, une réponse publique pourrait être servie à un joueur : il verrait le portail sans statut, jamais les données d'un autre — les réponses personnelles sont `private`).
**CI** : voir la PR (runs et résultats).

## 10. Pour le lot I3
- **Points et classement du jour** : un champ de plus dans le crochet `portail` (le barème de points par médaille) et dans `etat` (déjà : médaille et rang) ; la route agrège sans connaître les jeux (comme la série). Côté portail : la deuxième tuile de la grille (`tuileSerie`, `rendre` dans `src/portail.ts`), comme la maquette.
- **Ligne de partage** : tout est déjà dans la réponse avec joueur (médaille de chaque jeu, série) ; « Du Jour #… » demande un numéro de journée commun (à décider : premier jour de la plateforme ?).
- **« Jeu suivant du jour »** à l'arrivée d'un jeu : `GET /api/portail/jour` donne l'état de chaque jeu en une lecture.
