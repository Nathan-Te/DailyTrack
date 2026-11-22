# Passation — Pinball (`pinball`)

> **Passation initiale** : la passation de départ de Nathan (la conversation d'où vient le jeu) est `docs/pinball/passation-initiale.md` ; elle ne sert qu'à démarrer, le dépôt fait foi. *(Ce renvoi est ajouté à la main au lot PB0 : `npm run nouveau-jeu -- --id pinball --passation` réécrit le fichier et le retire, à remettre.)*

> **À coller telle quelle** dans une nouvelle conversation d'orchestration du jeu, avec le seed (`docs/pinball/seed.md`). Sections 1 à 7 générées (ne pas retoucher ; `npm run nouveau-jeu -- --id pinball --passation` les remet à jour) ; **les trois dernières sont tenues par la conversation**, puis `npm run tableau`.

## 1. Où en est ce jeu
- **Pinball** (`pinball`) est un jeu de la plateforme **Du Jour** (un niveau par jour, identique pour tous, classement validé par rediffusion côté serveur). Il vient d'être créé par le générateur : l'état est `off` (absent de l'accueil, la page dit « Bientôt »), **Nathan le publie depuis `/admin/` › Jeux : `off` → `preview` → `on`**.
- **Le jeu de départ est un squelette** : « toucher des cibles » (classé au score décroissant : les cibles touchées en 30 secondes), copié du jeu témoin « Cibles ». Il est jouable, classé et rejoué par le serveur, avec tous les écrans de la plateforme ; **sa simulation, son rendu et ses textes sont à remplacer** par ceux du vrai jeu. Son vocabulaire (« pinball » pour des cibles dans le code) n'est pas à garder.
- **Classement** : `touches` ↓, `dernier` ↑ (fiche `config/jeux/pinball.json`). Variante de départ : `score` (`packages/pinball-sim/src/variante.ts` : tout ce qui dépend du sens du classement y est rangé).
- **Catégorie** : `arcade` (fiche, lot A3) — un jeu d'arcade a son niveau du jour et son classement, mais ne compte ni dans la journée (journée parfaite, série, ligne de partage), ni dans le classement cumulé ; il a sa section « Arcade » sur l'accueil et ses onglets après le séparateur « Arcade » de /classement/.
- **Vision** : `docs/pinball/seed.md` (**ne pas modifier**, c'est Nathan qui le fait).
- **Teinte de l'étiquette** : #C9B6F2 / #5B3FA0 — **à choisir par Nathan** (charte § 3 ; la fiche, `etiquette`) ; le générateur a pris la première teinte qu'aucun jeu n'utilise.
- **Identité** : `identite` de la fiche (police, motif, illustration, panneau « Aujourd'hui ») vaut « à choisir » — **le premier lot du jeu la remplit d'après une maquette validée par Nathan, illustration comprise** (`apps/pinball/public/illustration.svg`, charte rév. 18 § 4, § 5 et § 9). Pas de `preview` ni de `on` sans identité complète (test des fiches ; l'administration le refuse). `aujourdhui: false` n'est permis qu'avec une ligne de la liste d'exemptions du test (`packages/core/test/identite.test.ts`), raison « à fournir par la conversation du jeu » ; le panneau se branche par `brancherJeu(…, { aujourdhui })`. Une police nouvelle demande aussi sa découpe « profil » (`scripts/polices/decouper.mjs`) et ses deux feuilles (`packages/ui/src/polices/`, `polices-profil/`).
- **Premier jour** : celui du modèle, `2026-11-02` — à régler au lancement du jeu (`premierJour` de la fiche, une ligne).

## 2. La plateforme en bref — et où lire les règles (elles ne sont pas recopiées ici)
- **Du Jour** : un portail (`playdujour.com`) et des jeux quotidiens (un niveau par jour, identique pour tous, minuit à Paris), un profil commun, un serveur unique (`apps/api`) qui **rejoue chaque partie** pour classer. Un monorepo ; français et anglais.
- **Lis, dans cet ordre** : `CLAUDE.md` (racine : carte du dépôt, règles communes, ce qu'on n'ouvre pas, discipline de l'agent) ; `packages/kit/CLAUDE.md` (ce que le kit donne déjà) ; `docs/regles/racine/un-jeu-une-fiche.md`, `ajouter-une-fiche-suffit.md`, `creer-un-jeu.md`, `publication-des-jeux.md`, `tests-et-ci.md`, `adresses-et-mise-en-production.md` ; `docs/plateforme/kit-de-jeu.md`.

## 2 bis. Les jeux qui existent
- **Blocks** (`blocks`) — classement : score ↓
- **Cibles** (`cibles`) — classement : touches ↓ — jeu témoin, jamais en production
- **Gravity** (`gravity`) — classement : score ↓
- **Jump** (`jump`) — classement : ticks ↑
- **Rush** (`rush`) — classement : temps ↑
- **Tower** (`tower`) — classement : hauteur_mm ↓
- **Track** (`track`) — classement : ms ↑
- **Vertige** (`vertige`) — classement : temps ↑
- Les jeux **ne s'importent jamais l'un l'autre**. Track, Jump et Tower ne sont pas branchés par `brancherJeu` (le kit) ; ce jeu l'est.

## 3. Tes zones (liste fermée)
- `apps/pinball/**`
- `packages/pinball-sim/**`
- `apps/api/src/pinball*.ts`
- `apps/api/test/pinball*.test.ts`
- `apps/api/scripts/pinball-*.ts`
- `docs/pinball/**`
- **Exceptions tolérées, rien d'autre** : ta fiche `config/jeux/pinball.json` et ce que `npm run fiches` en tire, ta ligne de `docs/plateforme/budgets.md`, tes clés de catalogue (et `docs/plateforme/traductions.md` régénéré par `npm run traductions`).
- **Tout le reste est partagé** (le serveur hors de ces fichiers, `scripts/**`, `.github/**`, `packages/**` communs, la charte, ce fichier) : un lot de jeu qui en a besoin **s'arrête et le propose** dans son README. Une PR de ce jeu porte l'étiquette `jeu:pinball` (ou `pinball` dans son nom de branche) ; le job `zones` échoue si elle sort de ses zones.

## 4. Ce que le jeu écrit (le kit écrit le reste : `packages/kit/CLAUDE.md`)
- Sa simulation (`packages/pinball-sim`), le rendu et les entrées de sa scène (`apps/pinball/src/scene.ts`), sa définition (`definition.ts`, la glue de `brancherJeu`), ses catalogues fr + en, son contrat serveur (`apps/api/src/pinball.ts`) et son module d'essais (`apps/api/scripts/pinball-essais.ts`). **Aucun écran** : le kit les écrit. Si le jeu a besoin d'écrire une ligne hors de ses zones, c'est un défaut du kit à corriger dans un lot de la plateforme.

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
- Le son d'un jeu se mêle à celui du téléphone (lot S2)
- Toute interface hors partie suit la charte `docs/plateforme/identite.md`

## 6. La charte visuelle
- `docs/plateforme/identite.md` (direction « Cartouches ») prime. **Maquettes d'abord** pour l'étiquette et le HUD, validées par Nathan avant le code ; aucune couleur ni chaîne d'interface en dur (jetons et catalogues `fr` + `en` de `@cdj/ui`).

## 7. La méthode
- **Un lot = une session = une branche = une PR brouillon.** L'agent s'arrête quand les critères d'arrêt du lot sont verts ; rapport honnête (vérifié / non vérifié) ; README de lot de 150 lignes au plus ; section « Pour les joueurs » dans la PR (une ligne `- [Pinball] … // …` par changement visible, ou `rien`).
- Avant de pousser : `npm run verifier` ; attendre la CI : `npm run attendre-ci` (une seule commande, silencieuse). Fusionner `main` une seule fois, juste avant de s'arrêter.
- **Ordre conseillé** : (1) Nathan écrit le seed ; (2) maquettes de l'étiquette et du HUD ; (3) la simulation et son golden (`npm run golden:pinball -w @cdj/pinball-sim`, jamais sans monter la version) ; (4) le rendu et les sensations ; (5) le serveur (le contrat minimal suffit longtemps) ; (6) les textes fr + en ; (7) la publication, par Nathan.
- **Ne pas modifier** les visions (`docs/seed.md`, `docs/*/seed*.md`, `docs/plateforme/seed-phase-*.md`) ni la charte : c'est Nathan qui le fait.

## Où on en est
- Pinball (arcade, `off`, branché par le kit) ; dernier README de lot : PBT1 (21/11), les trois tables dessinées avec Nathan (A, B, C, chacune en miroir : 24 tables, le jour tire le thème, la table et le miroir), PR brouillon.
- Verrou et bouche de l'orbite redessinés sur l'éventail du geste (option 1 de Nathan) ; fenêtres de tir ≥ 30 ms partout, 24 tables valides ; versions sim 10, générateur 9, robot 9.
- Non vérifié : le jeu n'a pas été joué à la main (URL de test dans le README) ; poids : `pinball.rendu` et `pinball.demande` à moins de 1 Ko du plafond.
- « Rayon 25 au plus » de l'élément de la mission (table A) non appliqué ; banque inclinée de −26,6° au lieu de −28° (pixels entiers).

## Prochain lot
à compléter par la conversation du jeu (le README de PBT1 n'annonce pas de suite ; budgets de poids à relever ou à alléger d'abord).

## Décisions en attente
- Nathan : valider les écarts avec le dessin (tableau du README de PBT1 : verrous de A et C devant les batteurs, bouche de l'orbite large, banques et guides retouchés dans les 15 px) en jouant les URL du README.
- Nathan : **le haut de la table A est vide** (le verrou dessiné en haut à droite ne se vise pas : il est devant les batteurs) — que mettre en haut ? (README de PBT1, « Retour de Nathan du 22/11 »).
- Nathan : le rayon de l'élément de la mission (table A, « 25 au plus ») ; le relèvement chiffré des budgets `pinball.rendu` / `pinball.demande` si un prochain lot en a besoin.
