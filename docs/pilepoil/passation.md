# Passation — Pile poil (`pilepoil`)

> **À coller telle quelle** dans une nouvelle conversation d'orchestration du jeu, avec le seed (`docs/pilepoil/seed.md`). Sections 1 à 7 générées (ne pas retoucher ; `npm run nouveau-jeu -- --id pilepoil --passation` les remet à jour) ; **les trois dernières sont tenues par la conversation**, puis `npm run tableau`.

## 1. Où en est ce jeu
- **Pile poil** (`pilepoil`) est un jeu de la plateforme **Du Jour** (un niveau par jour, identique pour tous, classement validé par rediffusion côté serveur). Il vient d'être créé par le générateur : l'état est `off` (absent de l'accueil, la page dit « Bientôt »), **Nathan le publie depuis `/admin/` › Jeux : `off` → `preview` → `on`**.
- **Le jeu de départ est un squelette** : « toucher des cibles » (classé au score décroissant : les cibles touchées en 30 secondes), copié du jeu témoin « Cibles ». Il est jouable, classé et rejoué par le serveur, avec tous les écrans de la plateforme ; **sa simulation, son rendu et ses textes sont à remplacer** par ceux du vrai jeu. Son vocabulaire (« pilepoil » pour des cibles dans le code) n'est pas à garder.
- **Classement** : `touches` ↓, `dernier` ↑ (fiche `config/jeux/pilepoil.json`). Variante de départ : `score` (`packages/pilepoil-sim/src/variante.ts` : tout ce qui dépend du sens du classement y est rangé).
- **Catégorie** : `party` (fiche, lot A3) — un jeu Party (lot PA1) ne change pas d'un jour à l'autre : son « niveau » est la graine du jour, sans générateur de niveaux, sans thèmes, sans robot ni médailles, sans jours figés ; hors de la journée et du cumul comme l'arcade ; identité allégée (la police et le motif sont ceux de la catégorie : seules la couleur d'étiquette et l'illustration restent à choisir).
- **Vision** : `docs/pilepoil/seed.md` — **à écrire par Nathan** (un gabarit vide avec ses titres). Tant qu'il est vide, le jeu de départ n'a pas de direction.
- **Teinte de l'étiquette** : #C7E9A8 / #3F6B1E — **à choisir par Nathan** (charte § 3 ; la fiche, `etiquette`) ; le générateur a pris la première teinte qu'aucun jeu n'utilise.
- **Identité** : `identite` de la fiche (police, motif, illustration, panneau « Aujourd'hui ») vaut « à choisir » — **le premier lot du jeu la remplit d'après une maquette validée par Nathan, illustration comprise** (`apps/pilepoil/public/illustration.svg`, charte rév. 18 § 4, § 5 et § 9). Pas de `preview` ni de `on` sans identité complète (test des fiches ; l'administration le refuse). `aujourdhui: false` n'est permis qu'avec une ligne de la liste d'exemptions du test (`packages/core/test/identite.test.ts`), raison « à fournir par la conversation du jeu » ; le panneau se branche par `brancherJeu(…, { aujourdhui })`. Une police nouvelle demande aussi sa découpe « profil » (`scripts/polices/decouper.mjs`) et ses deux feuilles (`packages/ui/src/polices/`, `polices-profil/`).
- **Premier jour** : celui du modèle, `2026-11-02` — à régler au lancement du jeu (`premierJour` de la fiche, une ligne).

## 2. La plateforme en bref — et où lire les règles (elles ne sont pas recopiées ici)
- **Du Jour** : un portail (`playdujour.com`) et des jeux quotidiens (un niveau par jour, identique pour tous, minuit à Paris), un profil commun, un serveur unique (`apps/api`) qui **rejoue chaque partie** pour classer. Un monorepo ; français et anglais.
- **Lis, dans cet ordre** : `CLAUDE.md` (racine : carte du dépôt, règles communes, ce qu'on n'ouvre pas, discipline de l'agent) ; `packages/kit/CLAUDE.md` (ce que le kit donne déjà) ; `docs/regles/racine/un-jeu-une-fiche.md`, `ajouter-une-fiche-suffit.md`, `creer-un-jeu.md`, `publication-des-jeux.md`, `tests-et-ci.md`, `adresses-et-mise-en-production.md` ; `docs/plateforme/kit-de-jeu.md`.

## 2 bis. Les jeux qui existent
- **Blocks** (`blocks`) — classement : score ↓
- **Cibles** (`cibles`) — classement : touches ↓ — jeu témoin, jamais en production
- **Gravity** (`gravity`) — classement : score ↓
- **Jump** (`jump`) — classement : ticks ↑
- **Pinball** (`pinball`) — classement : score ↓
- **Rush** (`rush`) — classement : temps ↑
- **Tower** (`tower`) — classement : hauteur_mm ↓
- **Track** (`track`) — classement : ms ↑
- **Vertige** (`vertige`) — classement : temps ↑
- Les jeux **ne s'importent jamais l'un l'autre**. Track, Jump et Tower ne sont pas branchés par `brancherJeu` (le kit) ; ce jeu l'est.

## 3. Tes zones (liste fermée)
- `apps/pilepoil/**`
- `packages/pilepoil-sim/**`
- `apps/api/src/pilepoil*.ts`
- `apps/api/test/pilepoil*.test.ts`
- `apps/api/scripts/pilepoil-*.ts`
- `docs/pilepoil/**`
- **Exceptions tolérées, rien d'autre** : ta fiche `config/jeux/pilepoil.json` et ce que `npm run fiches` en tire, ta ligne de `docs/plateforme/budgets.md`, tes clés de catalogue (et `docs/plateforme/traductions.md` régénéré par `npm run traductions`).
- **Tout le reste est partagé** (le serveur hors de ces fichiers, `scripts/**`, `.github/**`, `packages/**` communs, la charte, ce fichier) : un lot de jeu qui en a besoin **s'arrête et le propose** dans son README. Une PR de ce jeu porte l'étiquette `jeu:pilepoil` (ou `pilepoil` dans son nom de branche) ; le job `zones` échoue si elle sort de ses zones.

## 4. Ce que le jeu écrit (le kit écrit le reste : `packages/kit/CLAUDE.md`)
- Sa simulation (`packages/pilepoil-sim`), le rendu et les entrées de sa scène (`apps/pilepoil/src/scene.ts`), sa définition (`definition.ts`, la glue de `brancherJeu`), ses catalogues fr + en, son contrat serveur (`apps/api/src/pilepoil.ts`) et son module d'essais (`apps/api/scripts/pilepoil-essais.ts`). **Aucun écran** : le kit les écrit. Si le jeu a besoin d'écrire une ligne hors de ses zones, c'est un défaut du kit à corriger dans un lot de la plateforme.

## 5. Les règles de la plateforme (intitulés seulement ; le texte est dans `CLAUDE.md`, « Règles communes à tous les lots »)
- Un lot = une session = une branche = une PR brouillon.
- Rapport honnête
- Tests jamais affaiblis
- Zones partagées
- Toute nouvelle table liée à un joueur ou à une partie rejoint la liste de la remise à […]
- Un jour figé fige aussi ses seuils (lot « manques de Blocks »)
- Mentions légales et confidentialité (lot R5 ; lot I6 : aussi en anglais)
- Sécurité (lot R7)
- Fin de lot (lot O1)
- « Pour les joueurs » dans toute PR de lot (lot N2) — obligatoire
- Recette avant production
- Le son d'un jeu se mêle à celui du téléphone (lot S2)
- Toute interface hors partie suit la charte `docs/plateforme/identite.md`

## 6. La charte visuelle
- `docs/plateforme/identite.md` (direction « Cartouches ») prime. **Maquettes d'abord** pour l'étiquette et le HUD, validées par Nathan avant le code ; aucune couleur ni chaîne d'interface en dur (jetons et catalogues `fr` + `en` de `@cdj/ui`).

## 7. La méthode
- **Un lot = une session = une branche = une PR brouillon.** L'agent s'arrête quand les critères d'arrêt du lot sont verts ; rapport honnête (vérifié / non vérifié) ; README de lot de 150 lignes au plus ; section « Pour les joueurs » dans la PR (une ligne `- [Pile poil] … // …` par changement visible, ou `rien`).
- Avant de pousser : `npm run verifier` ; attendre la CI : `npm run attendre-ci` (une seule commande, silencieuse). Fusionner `main` une seule fois, juste avant de s'arrêter.
- **Ordre conseillé** : (1) Nathan écrit le seed ; (2) maquettes de l'étiquette et du HUD ; (3) la simulation et son golden (`npm run golden:pilepoil -w @cdj/pilepoil-sim`, jamais sans monter la version) ; (4) le rendu et les sensations ; (5) le serveur (le contrat minimal suffit longtemps) ; (6) les textes fr + en ; (7) la publication, par Nathan.
- **Ne pas modifier** les visions (`docs/seed.md`, `docs/*/seed*.md`, `docs/plateforme/seed-phase-*.md`) ni la charte : c'est Nathan qui le fait.

## Où on en est
- Lot PA2 : le jeu de la maquette, jouable et rejoué par le serveur (rejeu ≈ 0,08 ms, rediffusion de 34 caractères) ; `off`.
- Scène Canvas 2D, HUD en surimpression, sons de synthèse, vibration, `?debug&tune` avec export JSON.
- Étiquette rose `#F6B3A4` / coque `#B8473A`, illustration (`apps/pilepoil/public/illustration.svg`) ; CI rouge sur trois points de plateforme (README du lot PA2).
- Réplique et « Comment jouer » encore préfixés « À remplacer » : attendent les mentions légales.

## Prochain lot
Plateforme : mentions `pilepoil:*`, exemption Party du test d'identité ; puis réglages de Nathan (export `?debug&tune`).

## Décisions en attente
- Nathan : les réglages (`?debug&tune`), `attenteMax` (15 s), Entrée partagée avec « Recommencer ».
- Plateforme : les manques du moule listés dans `docs/pilepoil/lots/lot-PA2-pile-poil.md`.
