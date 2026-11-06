# Passation — Rush (`rush`)

> **À coller telle quelle** dans une nouvelle conversation d'orchestration du jeu, avec le seed (`docs/rush/seed.md`). Générée par `npm run nouveau-jeu` à partir des `CLAUDE.md` du dépôt : **ne pas la retoucher à la main** ; pour la mettre à jour après un changement des règles de la plateforme : `npm run nouveau-jeu -- --id rush --passation`.

## 1. Où en est ce jeu
- **Rush** (`rush`) est un jeu de la plateforme **Du Jour** (un niveau par jour, identique pour tous, classement validé par rediffusion côté serveur). L'état de départ est `off` (absent de l'accueil, la page dit « Bientôt »), **Nathan le publie depuis `/admin/` › Jeux : `off` → `preview` → `on`**.
- **Le jeu a dépassé son squelette** : sa simulation, son rendu et ses textes sont ceux de Rush. L'état exact (ce qui est fait, ce qui reste, les décisions à relire) est dans `docs/rush/consignes.md`, `apps/rush/CLAUDE.md` et les README de `docs/rush/lots/` ; **cette passation ne le résume pas**.
- **Classement** : `temps` ↑ (fiche `config/jeux/rush.json`). Variante de départ : `temps` (`packages/rush-sim/src/variante.ts` : tout ce qui dépend du sens du classement y est rangé).
- **Catégorie** : `arcade` (fiche, lot A3) — un jeu d'arcade a son niveau du jour et son classement, mais ne compte ni dans la journée (journée parfaite, série, ligne de partage), ni dans le classement cumulé ; il a sa section « Arcade » sur l'accueil et ses onglets après le séparateur « Arcade » de /classement/.
- **Vision** : `docs/rush/seed.md` (**ne pas modifier**, c'est Nathan qui le fait).
- **Teinte de l'étiquette** : #D9C4F0 / #4B2E83 — **à choisir par Nathan** (charte § 3 ; la fiche, `etiquette`).
- **Identité** : `identite` de la fiche (police, motif, illustration, panneau « Aujourd'hui ») vaut « à choisir » — **le premier lot du jeu la remplit d'après une maquette validée par Nathan, illustration comprise** (`apps/rush/public/illustration.svg`, charte rév. 18 § 4, § 5 et § 9). Pas de `preview` ni de `on` sans identité complète (test des fiches ; l'administration le refuse). `aujourdhui: false` n'est permis qu'avec une ligne de la liste d'exemptions du test (`packages/core/test/identite.test.ts`), raison « à fournir par la conversation du jeu » ; le panneau se branche par `brancherJeu(…, { aujourdhui })`. Une police nouvelle demande aussi sa découpe « profil » (`scripts/polices/decouper.mjs`) et ses deux feuilles (`packages/ui/src/polices/`, `polices-profil/`).
- **Premier jour** : `2026-11-02` — à régler au lancement du jeu (`premierJour` de la fiche, une ligne).

## 2. La plateforme en bref — et où lire les règles (elles ne sont pas recopiées ici)
- **Du Jour** : un portail (`playdujour.com`) et des jeux quotidiens (un niveau par jour, identique pour tous, minuit à Paris), un profil commun, un serveur unique (`apps/api`) qui **rejoue chaque partie** pour classer. Un monorepo ; français et anglais.
- **Lis, dans cet ordre** : `CLAUDE.md` (racine : carte du dépôt, règles communes, ce qu'on n'ouvre pas, discipline de l'agent) ; `packages/kit/CLAUDE.md` (ce que le kit donne déjà) ; `docs/regles/racine/un-jeu-une-fiche.md`, `ajouter-une-fiche-suffit.md`, `creer-un-jeu.md`, `publication-des-jeux.md`, `tests-et-ci.md`, `adresses-et-mise-en-production.md` ; `docs/plateforme/kit-de-jeu.md`.

## 2 bis. Les jeux qui existent
- **Blocks** (`blocks`) — classement : score ↓
- **Cibles** (`cibles`) — classement : touches ↓ — jeu témoin, jamais en production
- **Jump** (`jump`) — classement : ticks ↑
- **Tower** (`tower`) — classement : hauteur_mm ↓
- **Track** (`track`) — classement : ms ↑
- Les jeux **ne s'importent jamais l'un l'autre**. Track, Jump et Tower ne sont pas branchés par `brancherJeu` (le kit) ; ce jeu l'est.

## 3. Tes zones (liste fermée)
- `apps/rush/**`
- `packages/rush-sim/**`
- `apps/api/src/rush*.ts`
- `apps/api/test/rush*.test.ts`
- `apps/api/scripts/rush-*.ts`
- `docs/rush/**`
- **Exceptions tolérées, rien d'autre** : ta fiche `config/jeux/rush.json` et ce que `npm run fiches` en tire, ta ligne de `docs/plateforme/budgets.md`, tes clés de catalogue (et `docs/plateforme/traductions.md` régénéré par `npm run traductions`).
- **Tout le reste est partagé** (le serveur hors de ces fichiers, `scripts/**`, `.github/**`, `packages/**` communs, la charte, ce fichier) : un lot de jeu qui en a besoin **s'arrête et le propose** dans son README. Une PR de ce jeu porte l'étiquette `jeu:rush` (ou `rush` dans son nom de branche) ; le job `zones` échoue si elle sort de ses zones.

## 4. Ce que le jeu écrit (le kit écrit le reste : `packages/kit/CLAUDE.md`)
- Sa simulation (`packages/rush-sim`), le rendu et les entrées de sa scène (`apps/rush/src/scene.ts`), sa définition (`definition.ts`, la glue de `brancherJeu`), ses catalogues fr + en, son contrat serveur (`apps/api/src/rush.ts`) et son module d'essais (`apps/api/scripts/rush-essais.ts`). **Aucun écran** : le kit les écrit. Si le jeu a besoin d'écrire une ligne hors de ses zones, c'est un défaut du kit à corriger dans un lot de la plateforme.

## 5. Les règles de la plateforme (intitulés seulement ; le texte est dans `CLAUDE.md`, « Règles communes à tous les lots »)
- Un lot = une session = une branche = une PR brouillon.
- Rapport honnête
- Tests jamais affaiblis
- Zones partagées
- Toute nouvelle table liée à un joueur ou à une partie rejoint la liste de la remise à […]
- Un jour figé fige aussi ses seuils (lot « manques de Blocks »)
- Mentions légales et confidentialité (lot R5 ; lot I6 : aussi en anglais)
- Sécurité (lot R7)
- « Pour les joueurs » dans toute PR de lot (lot N2) — obligatoire
- Recette avant production
- Toute interface hors partie suit la charte `docs/plateforme/identite.md`

## 6. La charte visuelle
- `docs/plateforme/identite.md` (direction « Cartouches ») prime. **Maquettes d'abord** pour l'étiquette et le HUD, validées par Nathan avant le code ; aucune couleur ni chaîne d'interface en dur (jetons et catalogues `fr` + `en` de `@cdj/ui`).

## 7. La méthode
- **Un lot = une session = une branche = une PR brouillon.** L'agent s'arrête quand les critères d'arrêt du lot sont verts ; rapport honnête (vérifié / non vérifié) ; README de lot de 150 lignes au plus ; section « Pour les joueurs » dans la PR (une ligne `- [Rush] … // …` par changement visible, ou `rien`).
- Avant de pousser : `npm run verifier` ; attendre la CI : `npm run attendre-ci` (une seule commande, silencieuse). Fusionner `main` une seule fois, juste avant de s'arrêter.
- **Ordre conseillé** : (1) Nathan écrit le seed ; (2) maquettes de l'étiquette et du HUD ; (3) la simulation et son golden (`npm run golden:rush -w @cdj/rush-sim`, jamais sans monter la version) ; (4) le rendu et les sensations ; (5) le serveur (le contrat minimal suffit longtemps) ; (6) les textes fr + en ; (7) la publication, par Nathan.
- **Ne pas modifier** les visions (`docs/seed.md`, `docs/*/seed*.md`, `docs/plateforme/seed-phase-*.md`) ni la charte : c'est Nathan qui le fait.
