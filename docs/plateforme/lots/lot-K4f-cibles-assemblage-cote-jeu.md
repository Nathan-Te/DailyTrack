# Lot K4f — « Cibles », le premier jeu assemblé par le kit (témoin, jamais en production)

*4 novembre 2026. Conception : `docs/plateforme/kit-de-jeu.md` ; consignes du jeu : `docs/cibles/consignes.md`. Pour les joueurs : rien.*

**Résultat.** `brancherJeu` (`@cdj/kit/jeu`) assemble un jeu neuf à partir des briques du kit. **« Cibles »** (30 s, grille 8 × 6, 20 cibles, état entier à 30 Hz, Canvas 2D) est jouable en local, sur les aperçus et sur la recette (`preview`), rejoué et classé par le serveur (Tous, Amis, Mon groupe), partageable, et écrit **seulement dans ses zones**, plus sa fiche. `smoke`, `recette:seed`, `routesChaudes` et le contrôle des jours figés de `api-image` bouclent sur les fiches (aucun nom de jeu neuf dans un script). Track, Jump, Tower : golden et bancs de réponses identiques, aucune de leurs briques touchée.

## `brancherJeu`
- **Branche** (détail : `packages/kit/CLAUDE.md`) : génération de données, interrupteur et aperçu, langue, identité ; **accueil** (record, série, classement, décompte, « Comment jouer », Réglages, Discord et Ko-fi, message en direct, « Jeu suivant », plein écran) ; à la demande : **partie** (pas fixe, HUD compact, pause, arrivée, fantôme Aucun → Ma meilleure → Diamant), **envoi** et file hors ligne (D2), records, pseudo, **classement + Amis + Mon groupe + feuille d'un joueur**, ligne à partager, version périmée, « Un bug ? », **manette** (M1), **commandes réglables** (M2).
- **Le jeu écrit** (lignes de code, hors commentaires et blancs) : simulation **270** (+ outils 57), rendu et entrées de la scène **155**, glue (`main`, `definition`, `fiche`) **74**, catalogues **43**, CSS **7**, serveur **123** (contrat 70, module d'essais 28, empreinte des jours 25). **Écrans écrits par le jeu : zéro.** Le kit en écrit 1 299 lignes de TypeScript et 308 de CSS, communes.
- **Défauts du kit trouvés en l'écrivant, corrigés dans le kit** : un écran fermé gardait ses clics (`.cadre[hidden]`) ; pas de crochet d'onglet périmé dans `FileEnvoi` (`surRefus`) ; « Un bug ? » ne nommait que trois jeux ; le serveur ne donnait ses jours figés qu'à Jump et Tower ; ni module d'essais, ni contrôle d'image par fiche ; le CSS de l'étiquette générique pesait sur Track dès le premier jeu générique.

## Fichiers touchés hors des zones de « Cibles », et pourquoi c'est commun
| Fichiers | Pourquoi |
|---|---|
| `config/jeux/cibles.json` | **sa fiche** (exception de la règle des zones) |
| `config/jeux/projections/*`, `*/fiches[.production].generated.ts`, `*/jeux[.production].generated.css`, `amis.generated.css`, `apps/api/src/{fiches,registre}.generated.ts`, `scripts/catalogues-jeux.generated.ts`, `apps/api/scripts/essais.generated.ts` | **générés** par `npm run fiches` |
| `packages/core/src/ficheSorties.ts`, `packages/core/test/fiches.test.ts` | le générateur écrit `essais.generated.ts` et **les variantes de production** (sans les témoins) ; le test liste les fichiers |
| `packages/kit/src/jeu/**`, `packages/kit/{package.json,tsconfig.json,CLAUDE.md}`, `packages/kit/test/jeu.test.ts`, `packages/kit/src/envoi.ts` | **`brancherJeu` et ses modules**, la brique commune du lot |
| `packages/ui/src/{retoursOuvrir.ts, catalogue.ts, catalogue.en.ts, styles.css}`, `apps/portail/src/{catalogue.ts, portail.css, vite.config.ts}` | « Un bug ? » pour un jeu de la fiche ; **clés de catalogue exigées par la fiche** ; la feuille de l'étiquette générique quitte le socle de toutes les applications (elle pèse sur le portail et les jeux assemblés seulement) |
| `scripts/{budgets,site}.mjs` | le portail de la production (et la mesure de son budget) n'embarque aucun jeu témoin (`PORTAIL_TEMOINS=0`, comme `PORTAIL_VITRINE=0`) |
| `apps/api/src/{api,server}.ts` | `joursFiges` : les jours figés de **tout** jeu des fiches entrent dans le serveur |
| `apps/api/scripts/{smoke,recette-seed,routesChaudes,baseDeReference,measure-lignes,essais}.ts`, `apps/api/test/routesChaudes.test.ts` | le point 3 : **boucle sur les fiches** par le module d'essais du jeu (`ModuleEssais`) ; la référence couvre `resultats_jeu` |
| `scripts/image-jours-figes.{mjs,d.mts}`, `apps/api/test/imageJoursFiges.test.ts`, `.github/workflows/ci.yml` | `api-image` : les jours figés **de chaque jeu selon sa fiche** (avant : Jump, en dur dans le YAML) |
| `apps/api/{Dockerfile,package.json,tsconfig.json}`, `tsconfig.json`, `package-lock.json` | le bloc du `Dockerfile` de « Cibles » (`dockerfile.test.ts` vert), les espaces de travail |
| `docs/plateforme/{budgets,kit-de-jeu,traductions}.md`, `docs/plateforme/lots/img/k4f-*.png` | la ligne `cibles.jsCss`, l'état du plan, le relevé des traductions, les captures |

## Budgets (ligne `cibles` seulement ; aucune autre ne bouge ni ne se relève)
- `cibles.jsCss` **42 616 o** (premier chargement : accueil, kit, records, envoi, catalogue français) ; plafond **51 300 o** = mesure + 20 %, **provisoire, à fixer par Nathan**.
- **Ce qui aurait fait bouger le portail (+372 o → 35 553 pour 35 200) et Track (+51 → 297 051 pour 297 000)** : le premier jeu à étiquette générique rend vive la feuille `jeux.generated.css` (importée par le socle de toutes les applications) et ajoute ses données au portail. Corrigé sans relever : la feuille n'est plus dans `styles.css` (Track −79 o) ; **le portail de la production n'embarque aucun témoin** (variantes `*.production.generated.*` écrites par `npm run fiches`, alias et catalogues allégés à la construction, `PORTAIL_TEMOINS=0` posé par `site.mjs --production` et par la mesure du budget) : `portail.premier` **35 189 o** (`main` : 35 181), `track.jsCss` **296 973 o**. `site.mjs --production` : aucun `cibles/` ni mot « cibles » dans le portail.
- `routesChaudes` : la table `jeux` (une ligne par jeu, lue en entier par instance) compte dans les lignes parcourues : plafond **7 + le nombre de jeux** (3 jeux : 10, comme avant). Un jeu neuf de la référence a un joueur sur six ; la mesure des amis (F2) garde les trois jeux publiés.

## Preuves
- **Simulation** (39 tests : pureté, contenu valide sur 400 jours, règles, rediffusion et refus, médailles, jours figés, **golden**) ; **serveur** (`cibles.test.ts` 7, SQLite et libSQL : serveur = jeu, ordre de la fiche, égalités, copies, partie vide, jour figé, profil, `game_unavailable`) ; `imageJoursFiges`, `routesChaudes`, `kit/jeu.test.ts`, `apps/cibles/test/fiche.test.ts`.
- **e2e** (`apps/cibles/e2e`, Chromium, **Essentiel**) : `partie` (accueil, partie scriptée, pause, arrivée, « Rejouer », « Comment jouer », **accueil portrait 390 × 844 et 360 × 640**), `classement` (partie rejouée et classée par le vrai serveur, **copie refusée**, **parcours Amis** : feuille d'un joueur, « Ajouter en ami », « Amis »), `poids`. **`@navigateurs`** : `determinisme` (rediffusions de référence au bit près).
- **Local** : `smoke` complet contre un serveur construit (5 contrôles de Cibles verts) ; `image-jours-figes` : Jump 18 jours, Tower 33, Cibles 0 ; unitaires **SQLite 6 414, libSQL 858** verts, `npm run build`, `budgets-controle` sans dépassement, `securite-workflows` 0 écart. Captures : `docs/plateforme/lots/img/k4f-*.png` (accueil portrait et paysage, partie, arrivée, classement Amis).

## Décisions et écarts
- **Deux thèmes sans « sac »** : le sac commun exige ≥ 5 thèmes ; avec deux, la parité du jour est l'alternance stricte (testé).
- **Mentions légales non touchées** : un témoin n'est jamais en production. À décrire dans le même lot si un jeu quitte ce statut.
- **Non fait (K4g)** : le générateur, le job de bout en bout, « Créer un jeu » ; Track, Jump, Tower sur `brancherJeu`.

## Scénario de test pour Nathan (2 clics, sur la recette après la fusion)
1. `/admin/` › Jeux : passer « Cibles » en `preview` (un jeu naît `off`, c'est à Nathan) → son **lien d'aperçu** (`/cibles/?apercu=<clé>`).
2. Jouer 30 s : score accepté ; classement (Tous, Amis, Mon groupe), arrivée, partage, menu à la manette, accueil complet sur téléphone en portrait. `playdujour.com/cibles/` reste « Bientôt ».

## Vérifié / non vérifié
- **CI de PR** : voir le dernier run de la PR #259 (verte au dernier commit).
- **Run en mode `main` forcé une fois** (forçage de `ci.yml` retiré ensuite) : **vert, 10 min** — https://github.com/Nathan-Te/DailyTrack/actions/runs/41800982466 : jeu fictif (3 parts), Budgets, api-image, unitaires, Essentiel de tous les specs (Track 3 parts, Jump, Tower, **Cibles**), petit ensemble **Firefox et WebKit** (dont `determinisme` de Cibles). Le premier run forcé (41799407323) n'avait qu'un rouge : `diffusion.spec` attendait en dur les quatre destinations du message en direct ; il lit maintenant celles des fiches (hors zone de Cibles, corrigé ici).
- **CI de PR après la fusion de `main` (D3)**, 1er run : deux rouges **hors de ma zone**, aucun test touché — `apps/web/e2e/profil.spec.ts:144` (« un record fait sur un appareil apparaît sur l'autre », Track, déjà vu isolé au lot K4e, vert à la relance) et `apps/api/test/mesures.test.ts` (D3, « blocage » : type `attente` au lieu de `calcul`, un test de durée sous charge). Règle d'arrêt : une seule relance (le commit suivant). **Relance : `profil.spec` vert ; `mesures.test.ts` (D3) rouge encore** (run de la PR après le commit de rapport : tout le reste vert — jeu fictif, Budgets, api-image, e2e de Cibles et de Track, unitaires 1/4 à 3/4). Le test classe un blocage « calcul » ou « attente » d'après le processeur consommé et échoue sur la part 4/4 du runner (2 cœurs, autres fichiers en parallèle) ; il passe seul en local (6/6) et ne touche ni Cibles ni le kit. **Je ne le corrige pas (zone de D3) : Nathan tranche** (le rendre insensible à la charge, ou le sortir de la part).
- **Non vérifié** : l'image Docker réelle du serveur avec Cibles (le job `api-image` est vert, il la construit et la lance) ; la recette elle-même et le lien d'aperçu (après la fusion) ; le jeu à la manette physique (les écrans sont déclarés, `ECRANS_MANETTE` du kit) ; l'anglais n'a pas de spec dédié (parité des catalogues testée).
