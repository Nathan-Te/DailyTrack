# Lot K4e — un 4ᵉ jeu sans retouche : tout ce que la plateforme lisait encore en dur

*3 novembre 2026. Conception : `docs/plateforme/kit-de-jeu.md`. Pour les joueurs : rien.*

**Résultat.** Ajouter une fiche suffit à la plateforme (typage, portail, `@cdj/ui`, tests, serveur, site, budgets, musique) : **un jeu fictif `essai` passe le typage et toute la suite unitaire (SQLite et libSQL) avec zéro échec**, sans un fichier à son nom hors de sa zone. Track, Jump et Tower ne changent pas d'un octet (captures non utiles : aucune règle de style, aucun dessin n'a bougé). **Pas fait** : voir « Ce qui reste nommé ».

## La preuve : 17 → 0 (`node scripts/jeu-fictif.mjs`)
Le banc copie le dépôt, y pose la fiche `essai` (`dessin: "generique"`, `tableCommune`, `temoin: true`, score en points), ses clés de catalogue, son module serveur et quelques fichiers **dans ses zones**, puis lance `npm run fiches`, `npm run traductions`, `tsc -b` et la suite. La fiche arrive par `CDJ_FICHES_SUPPLEMENTAIRES` (refusée hors essai) ; aucun fichier de test n'entre dans `config/jeux/`.
- **Avant** (code de K4d, même banc) : **1 erreur de typage et 18 tests en échec dans 13 fichiers** (K4d en avait compté 17 / 11) : `composants.ts` (étiquette), `ui/fiches.test` (feuille du sélecteur), `ui/traductions.test`, `portail/{jeuxFiches ×2, site, miseEnProduction ×2}`, `api/zonesNouveautes`, `web/{ciZones ×3, e2eSuite ×2, mesureCi, outilsAgent}`, `core/fiches`, `musique/{description, preparation}`.
- **Après** : **0** — SQLite 0 / 6 351 tests, libSQL 0 / 854, typage, aucun fichier créé hors des zones du jeu (banc relancé sur l'état fusionné avec D2). Le jeu fictif est maintenant **dans le registre du serveur** (il l'était à la main avant) : 9 tests qui énuméraient « les jeux » ont dû lire les fiches (`admin`, `effacement`, `jeux`, `horsProduction`) et les trois bancs montent le serveur avec leurs trois jeux (`jeuxDesBancs`) : **les références des bancs sont intactes**.

## Ce qui est livré
| Point | Fait |
|---|---|
| 1 Étiquette générique | `etiquetteDe` : un jeu sans dessin propre (`ETIQUETTES_PROPRES`) a `jeu-etiquette` (fond, police, coque de la fiche). **Code mort tant qu'aucun jeu n'est générique** (`A_DES_JEUX_GENERIQUES`, généré) : `portail.premier` **35 175 o = `main`** (une première version, avec un corps partagé avec Jump et Tower, coûtait +25 o : retirée). |
| 2 Styles | `npm run fiches` écrit `ui/jeux.generated.css`, `ui/amis.generated.css`, `portail/jeux.generated.css` (étiquette, cartouche, sélecteur d'amis, étiquettes de zone) : vides sans jeu générique. Les 3 jeux gardent leurs règles à la main. |
| 3 Catalogues | `clesDeCatalogue(fiche)` / `clesManquantes` (`@cdj/core/fiche`) ; **un seul test** (`portail/jeuxFiches`) : « fiche « essai » : la clé « jeu.essai.nom » manque au catalogue commun de @cdj/ui (en) ». |
| 4 Tests | « les jeux des fiches » (`lireFichesBrutes`) dans les 9 fichiers demandés ; rien d'affaibli. |
| 5 `temoin: true` | Absent de `site.mjs --production` (revérifié sur le site assemblé), du registre de production (`jeuxPourEnvironnement`), de « Mettre en production » (`IDS_PRODUCTION`, `CHAINE`, `VERSIONS_DES_JEUX`). **Aucune table à lui** (la validation l'impose). |
| 6 Scripts | Registre (`registre.generated.ts`), `build-node.mjs` (jours de chaque fiche, fils de calcul), `budgets.mjs` (`mesureJeuNeuf`, champ `budget.aLaDemande`), `traductions.ts` + `applications.ts`, `smokeRead`, `smoke` (lectures), `platformBudget` (`JEU_NEUF_PLAYER`). `SCENES` (musique) lisait déjà les fiches. **Dockerfile** : ne boucle pas (un `COPY` ne se calcule pas, et je ne peux pas construire d'image ici) ; son bloc par jeu est écrit par le générateur, et `api/test/dockerfile.test.ts` échoue si une fiche n'a pas le sien. |
| 7 Job de CI | `jeu-fictif` (3 parts, `ci.yml`) : tout run non-PR et toute PR qui touche ce que lisent les fiches ; dans le verdict `test`. |

## Champs de fiche ajoutés
`temoin` ; `budget.aLaDemande` (sa façon de mesurer son chargement, défaut : les briques du kit). Projections `serveur`, `ci`, `jeu` : `temoin`. Fichiers générés de plus : 3 feuilles, `registre.generated.ts`, `catalogues-jeux.generated.ts`.

## Ce qui reste nommé (lot K4f)
Écritures du `smoke` complet et de `recette:seed` (une partie scriptée est le module d'essais du jeu), `routesChaudes` / `baseDeReference` (des données de référence), `api-image` (jours figés de Jump), l'assemblage côté jeu, le générateur (qui écrit aussi le bloc du `Dockerfile`, les clés de catalogue et la ligne de `budgets.md`), « Cibles ».

## Vérifié / non vérifié
- **Local** : `npm run verifier -- --sans-e2e` vert (typage, unitaires SQLite 187 fichiers et libSQL 69, construction, budgets) ; banc du jeu fictif à zéro ; `profil.spec.ts` (7 tests) vert en local après un échec isolé en CI de PR (voir ci-dessous).
- **CI** : PR `ccr-9af267d0-uwlrif` — **run 41736361315 : tout vert** (jeu fictif en 3 parts, `Budgets`, `api-image`, unitaires, e2e, verdict `test`). Deux runs précédents (41728952944, 41733843452) n'avaient échoué que sur `e2e-pr (1/4)`, `profil.spec.ts › un record fait sur un appareil apparaît sur l'autre` (`#finish .online .rank` introuvable) : **hors de mes zones, instable** — vert en local (la suite de 29 specs de la part rejouée dans l'ordre), vert dans le run `main` forcé, vert au run suivant sans changement de code. **Run en mode `main` forcé une fois** (forçage de `ci.yml` retiré ensuite) : **vert, 11,4 min** — run 41732140540 (jeu fictif, Essentiel de tous les specs, Firefox et WebKit). Budgets : aucun relèvement ; `portail.premier` 35 175 o (= `main`).
- **Non vérifié** : une vraie image Docker (aucun Docker ici : le bloc du `Dockerfile` n'est vérifié que par `dockerfile.test.ts`), le site assemblé avec un jeu fictif (`site.mjs` n'est vérifié que sur ses fonctions pures : un jeu sans application n'a pas de `dist`), un jeu fictif construit en navigateur (ni build ni e2e), `variete365.test.ts` (mesure de temps) peut dépasser son seuil si la machine est chargée (vu une fois pendant que deux suites tournaient).
