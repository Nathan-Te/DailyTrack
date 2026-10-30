# Lot 55 — Track : choisir ses fantômes dans le classement, et refondre le son

Branche `claude/practical-gauss-20xfi4` (nom imposé par la session ; le lot prévoyait `lot-55-fantomes-son`), partie de `main` à `e9436a9` (lot 51 fusionné). Zones : `apps/web/**`, `packages/sim/**`,
`cdj.ts` et `salon.ts`, leurs tests, `docs/lots/**`, la ligne de Track de `budgets.md`, `durees.json`, `applications.ts`, les clés de catalogue. Le nom de la branche ne porte ni `track` ni `jump` :
la PR est une PR « plateforme » pour le job `zones`. Golden, rediffusions, classements et identifiants de circuit **inchangés** (le son et le choix des fantômes ne touchent jamais la simulation).

## État

| Étape | État |
|---|---|
| **A1 — maquettes des fantômes** (`lot-55/maquettes-fantomes.html`) | **faites, en attente de validation de Nathan (arrêt)** |
| A2 à A5 — choix, course, serveur, chargement | à faire après validation |
| **B1 — planche sonore** (`/track/vitrine/?planche=son`) | à faire après la partie A (arrêt : Nathan écoute et choisit l'approche) |
| B2 à B7 — boîte de vitesses, voix par voiture, le reste des sons, Salon, réglages, téléphone | à faire après le choix de l'approche |

## Ce que le code offre déjà (relevé avant les maquettes)

- **Le Salon a déjà tout pour plusieurs fantômes** : `GhostField` (`salonGhosts.ts`) — jusqu'à `MAX_GHOSTS = 5` autres joueurs plus ton tour, chacun d'une couleur (`GHOST_COLORS`), translucide, sans
  collision, **pseudo au-dessus** (`createNameLabel`), la voiture de sa course (lot 51), et le **rattrapage** d'un fantôme arrivé après le départ (`catchUpTicks` : la rediffusion est rejouée en silence
  jusqu'au pas courant). Le jour n'a aujourd'hui qu'**un** fantôme (`session.ghost`, `ghostSource` dans `main.ts`) ; la proposition est de **réutiliser `GhostField`** pour la sélection, sans toucher à
  `session.ghost` (qui reste le fantôme de référence de l'écart du HUD).
- **Le classement du jour** : `GET /api/day/<date>/leaderboard` (≤ 50 lignes ; `BoardRow` = rang, pseudo, temps, médaille : **aucun identifiant**) ; `GET /api/day/<date>/ghost?kind=first|ahead`.
  Il n'existe pas de route « la rediffusion de cette ligne » : c'est la route du point 4 du lot. Les lignes sont montrées par `linesEls` (`boardView.ts`) à l'accueil (5 lignes), dans la page
  « Classement » (`boardScreen.ts`, 50 lignes) et dans le coin de la course (`boardPanel.ts`). **L'arrivée ne montre que ton rang** (pas de liste) et **la pause n'a pas de classement**.
- **Le cycle actuel** (`ghostModes`, `online.ts`) : ton record → le premier → le joueur devant → aucun ; touche G, `#btn-ghost`, `#pause-ghost`, `#home-ghost` (lot G1).

## A1 — Maquettes (arrêt)

`docs/lots/lot-55/maquettes-fantomes.html` (jetons et feuilles de `@cdj/ui` et de `apps/web`, ouvrir depuis le dépôt ; FR / EN par le bouton ou `?l=en`) : le classement avec une case par ligne
(téléphone en paysage et ordinateur), le compteur « 3 fantômes sur 5 » et ses trois états, l'accueil / l'arrivée / la pause, la course à cinq fantômes (voiture simple, teinte, pseudo), le bouton
simple et son cycle (dont le saut d'un mode vide), le chargement. **Décisions demandées à Nathan** (aussi au bas de la planche) :

1. **Serveur** : `GET /api/day/<date>/run/<ref>` ; `ref` = empreinte publique (SHA-256 de « jour + identifiant du joueur », tronquée), ajoutée aux lignes du classement, **aucune colonne de plus**.
2. **Pause** : cocher dans le coin de classement quand le jeu est gelé (proposé), ou seulement depuis la page « Classement » ?
3. **Écart en course** : garder la ligne « écart avec le fantôme le plus proche » (3 s après un point de contrôle) ?
4. **Fantôme en retard** : rejoindre à sa place (proposé, comme le Salon) ou attendre la course suivante ?
5. **Le joueur devant** n'a plus de mode à lui dans le bouton (proposé coché dans la sélection, comme le premier) — d'accord ?

## Fichiers hors zone

Aucun jusqu'ici (la route du point 4 est dans `cdj.ts`, zone de Track ; l'éventuelle ligne de `platformBudget` sera listée ici).
