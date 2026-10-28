# Lot A1 — Médaille Diamant, classement au chrono, « Prochains niveaux »

Lot de plateforme (touche le portail, Track et Jump). Charte : `identite.md` **révision 11** (la demande disait « 10 » : ce numéro était déjà pris par l'écart du Garage de Track, le texte de la charte est repris tel quel sauf ce numéro). Aucune règle de jeu ne change : seuils, temps de l'auteur, validation, golden inchangés.

## 1. Les textes changés (FR / EN)
| où | avant | après |
|---|---|---|
| compte à rebours de l'accueil et vitrine `/ui/` | Prochains jeux dans / Next games in | **Prochains niveaux dans / Next levels in** |
| nom de la médaille (`medaille.diamant`, catalogue commun) | Auteur / Author | **Diamant / Diamond** |
| Garage de Track (conditions, progrès) | « l'or (ou l'auteur) », « médaille d'auteur » | « l'or (ou le Diamant) », « médaille Diamant » ; EN gold (or Diamond), Diamond medal |
| objectif atteint (Jump, `hud.objectif.auteurBattu`) | Auteur battu / Author beaten | Diamant obtenu / Diamond earned |
| administration de Track (tableaux des médailles) | « ≥ Auteur », « moy. jour Auteur » | « ≥ Diamant », « moy. jour Diamant » |
| tuile du classement | « 38 points, tous jeux » | « 1:42,315 cumulés » / “combined” ; un seul jeu : « Finis Jump pour le cumul » / “Finish Jump for the combined time” |

**Autres « prochains jeux »** : dans le code, seulement la ligne ci-dessus (+ le commentaire de `portail.ts` et `apps/portail/CLAUDE.md`, mis à jour). Restent, **non modifiés** : `docs/plateforme/seed-phase-3.md` (vision de Nathan : « jusqu'aux prochains jeux »), la maquette `maquettes/cartouches/portail.html`. Les jeux disaient déjà « Prochain circuit / niveau dans ».
**Gardés tels quels (notion du temps de l'auteur)** : « Meilleur que l'auteur ! », « Temps de l'auteur battu ! », « Rediffusion de l'auteur », la légende « Auteur » du temps de référence de l'arrivée de Track, `bandeau.medailleAuteur`.

## 2. Diamant : jeton, symbole, données
- `--dj-auteur` / `--dj-auteur-texte` → **`--dj-diamant` `#4FC3DC` / `--dj-diamant-texte` `#0B2530`** (`@cdj/ui`, Track, Jump, portail, image de partage), **sans alias**. Contraste du texte sur l'aplat vérifié par `PAIRES` (test vert). `TypeMedaille` du socle : `"diamant"`.
- **Symbole de la ligne à partager : 🏆 → 💎** (portail `EMOJIS`, Track `MEDAL_ICON`, Jump `MEDAL_ICON`). Le 🏆 du bouton « classement » du Salon n'est pas une médaille : inchangé.
- **Données inchangées** : `author` / `auteur` (API, base, rediffusions, niveaux figés, `DEBLOCAGES`). Écrit dans `apps/api/CLAUDE.md` : « médaille diamant = clé `auteur` dans les données ».
- ⚠ **À valider (Nathan)** : le vert d'`--dj-auteur` servait aussi, dans Track, d'accent « devant » (écart `−` du HUD, badge « NOUVEAU RECORD », gain de places) : ces accents sont maintenant **bleu Diamant**. Un vert distinct serait un jeton de plus (non demandé).

## 3. Le classement du jour au chrono
- **Jump classe bien au temps** (pas, puis premier envoyé, puis identifiant) ; Track en ms. Les deux crochets `classes(day)` rendent en plus `tempsMs` (temps rejoué ; Jump arrondit ses pas en ms).
- **Règle** (`classementDuJour.ts`) : vue d'un jeu = ordre du jeu ; **Cumulé** = d'abord ceux qui ont fini tous les jeux du jour (somme des temps, croissante), puis « Un jeu sur deux » : leur meilleur rang (1er Track, 1er Jump, 2es…) ; égalité : premier arrivé à ce temps (essai classé le plus tardif), puis identifiant. Un jeu non fini : « — » dans la ligne, `⬜` seulement dans le texte à partager.
- **`GET /api/portail/classement?date=&vue=cumul|track|jump`** → `{ date, journee, ouvert, vue, jeux[], classes, top[≤50]{ rang, pseudo, tempsMs, complet, resultats{ jeu: {rang, tempsMs, medaille}|null } }, moi }` (`tempsMs` null et `complet` faux = un jeu sur deux ; plus de `bareme` ni `points`). Vue inconnue : **400 `invalid_view`** (nouveau code : liste, doc, `erreur.invalid_view` FR/EN). **`GET /api/portail/jour`** : `joueur.{ cumulMs (null si un jeu manque), rangDuJour, classesDuJour }` à la place de `points`.
- Mêmes règles qu'au lot I3 : seul le prouvé compte, un calcul par fenêtre et par instance (les 3 vues le partagent), cache public ≤ 30 s et jamais au-delà de minuit, `private` avec identifiant, jours passés relus avec la nouvelle règle (rien n'est réécrit), futurs refusés.
- **Portail** : onglets Cumulé · Track · Jump en haut de `/classement/` (`role=tablist`, flèches au clavier), vue dans `?vue=` ; ligne = temps de la vue + en petit temps et pastille de chaque jeu ; séparation « Un jeu sur deux » ; tuile « 9e » / « 1:42,315 cumulés ». Choix : avec un seul jeu fini la tuile garde **sa place** et dit « Finis Jump pour le cumul » en sous-texte.
- **Ce que devenaient les points** : plus rien ne les lisait hors la tuile, `/classement/`, `smoke` et `measure:portail` (le profil commun, la série et la « journée parfaite » ne comptent que des jours finis). `BAREME_POINTS`, `pointsDe`, `sommeDesRangs`, `classement.bareme`, `classement.pts`, `portail.classement.points` sont retirés.
- **`recette:seed`** : les 20 joueurs « Démo » couvrent les deux jeux, un seul jeu et des égalités (le joueur d'indice 1 de chaque dizaine rejoue la course du joueur 0 : mêmes temps dans chaque jeu et au cumul).

## 4. Coûts
Mêmes requêtes qu'au lot I3 (le temps était déjà lu) ; ajout : les pseudos du haut de chaque vue, une requête de ≤ 50 lignes par vue et par fenêtre. `platformBudget.ts` et `couts.md` (note ajoutée) : chiffres inchangés. **Non mesuré sur sqld** : aucun démon Docker dans cet environnement (`measure:portail` mis à jour pour les nouvelles réponses mais non lancé).

## 5. Captures (Chromium, 844 × 390 et 390 × 844, FR et EN)
`docs/plateforme/lots/img/lot-A1-*.png` (24), produites par `CAPTURES=1 npx playwright test captures-lot-a1` : `accueil`, `classement-cumul|track|jump`, `arrivee-track`, `arrivee-jump` (médaille Diamant, bleue). Regardées : cumul portrait FR, accueil portrait FR, arrivées Track et Jump paysage FR.

## 6. Vérifié / non vérifié
- Vérifié en local : `npm run typecheck`, `tsc -p apps/portail`, `npm test` (SQLite et libSQL, voir ci-dessous), e2e Chromium `portail-journee` (Essentiel et @regression, dont le nouveau test des onglets), `portail-jour`, captures.
- Nouveaux tests : `classementDuJour.test.ts` (pur), `classement.test.ts` (3 vues, séparation, égalités, 50 + ta ligne, `invalid_view`, jeu n° 3), `classementDemo.test.ts`, `classementVues.test.ts`, e2e des onglets (`?vue=`, clavier, séparation) ; `durees.json` mis à jour.
- Non vérifié : e2e Jump et Track complets (la CI de PR les lance), Firefox et WebKit, coûts sur Turso.
- Runs de CI : voir la PR.
