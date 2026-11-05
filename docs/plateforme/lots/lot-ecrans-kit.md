# Lot de plateforme — les écrans du kit au niveau des jeux maison

Branche `claude/kit-screens-styling-g09uul` (le prompt disait `plateforme/ecrans-kit`), PR brouillon. Lot de **plateforme** : `packages/kit/**`, `packages/ui/**`. **Pour les joueurs : `rien`** (Blocks n'est pas `on`, Cibles n'est jamais en production).

## Ce que le lot change
- **Les écrans écrits par le kit sont ceux de Tower.** Un écran = une coque (la couleur de coque de la fiche, ses stries, une ombre nette) qui porte un panneau de la teinte de l'étiquette, sur le décor du thème et sous le voile à rayures. Titre dans la police du jeu avec l'ombre papier de Tower, tuiles papier à trait fort (la série inversée, penchée), bouton principal en plaque d'encre à l'accent du jeu.
- **La cause des boutons collés** : l'espacement (`gap`) était posé sur `main.jeu-ecran` alors que le contenu vit dans son enfant `.etiquette__corps` : aucun écart n'a jamais existé. Corrigé, avec une **échelle d'espacement** (`--jeu-esp-*`, jetons `--dj-espace-*`) : 12 px entre blocs, **8 px entre deux boutons**, 6 px serré, 16 px le retrait d'une carte, 24 px entre colonnes.
- **Accueil** : à gauche titre (et illustration), réplique, record, série ; à droite classement du jour, décompte, profil ; **JOUER et les deux boutons sur toute la largeur en dessous** ; une colonne sous 700 px (JOUER avant le classement). Carte de 900 px (celle de Tower) ; autres écrans 640 px ; **au grand écran (≥ 2 200 × 1 200) agrandis de 1,25** (`zoom`) : ≈ 47 % de la largeur à 1 920 comme à 2 560.
- « Comment jouer » (points, puis schéma des commandes en touches), Réglages (segments, lignes intitulé / réglage), pause, fin (résultat dans une tuile, JOUER = « Rejouer »), classement (lignes encadrées, la tienne en moutarde).
- **La peau** (ci-dessous). Deux feuilles : `jeu.css` (premier chargement) et **`ecrans.css`** (à la demande, importée par `partie.ts` seulement).

## L'API de la peau
`DefinitionJeu.peau?: PeauJeu`, tout facultatif, couleurs en `#RRGGBB` seulement (`couleurValide` : le reste est refusé) :
```ts
interface PeauJeu {
  dessin?(): SVGElement;                              // illustration, à droite du titre de l'accueil
  fond?(theme: string): { ciel: string; sol: string }; // décor du thème du jour derrière l'accueil et ses sous-écrans
  accent?: string;                                    // texte des boutons principaux, pastilles actives, tuile inversée
}
```
**Par défaut, tirée de la fiche** (aucune ligne à écrire) : `etiquette.fond` (panneau, décor, accent), `etiquette.coque` (coque, épaisseur du bouton, sol du décor), `etiquette.police`. `npm run fiches` écrit `--jeu-fond`, **`--jeu-coque` (nouveau)**, `--jeu-police` sur `.jeu-etiquette--<id>` ; `habillerPage` pose cette classe sur la page. Documenté dans `packages/kit/CLAUDE.md` (« Écrans et peau du jeu ») et `docs/plateforme/kit-de-jeu.md`.

## Ce que Blocks peut fournir en plus (un lot de Blocks, pas celui-ci)
1. `peau.fond(theme)` : `PALETTE_PORT` et `PALETTES[theme]` de `@cdj/visuels/blocs` ont déjà `ciel` et `sol` pour ses six thèmes (ceux de Tower).
2. `peau.dessin()` : un petit tas de pièces à yeux (comme `petiteTour` de Tower), dessiné avec `decrirePiece` / `disposerYeux` de `@cdj/visuels/blocs`, en SVG.
3. **Retirer de `blocks.css`** la largeur (`--cadre-largeur`), le zoom (`--zoom-cadre`, `.cadre__defile { zoom }`) et `.jeu-jouer { width: 100% }` : le kit les fait. La largeur de Blocks n'a déjà plus d'effet ; son zoom (1,25 dès 1 700 px, 1,5 dès 2 200 px) s'applique encore, d'où une carte de ≈ 1 125 px à 1 920 contre 900 px chez Cibles et Tower. `disposition.spec.ts` (« JOUER prend la largeur de la carte ») reste vrai avec le kit seul.

## Vérifié
- Spec de mise en page `apps/cibles/e2e/ecrans-kit.spec.ts` (6 tailles : 2560 × 1440, 1920 × 1080, 1366 × 768, 844 × 390, 390 × 844, 360 × 640 ; accueil, « Comment jouer », Réglages, pause, fin) : pas de défilement horizontal, aucun recouvrement entre éléments touchables, ≥ 8 px entre deux boutons, cibles ≥ 44 px, carte dans la fenêtre et bornée au PC (900 / 640 px, ×1,25 au grand écran), plaques Discord / Ko-fi hors de la carte, peau tirée de la fiche, Tab atteint JOUER, « Comment jouer », Réglages dans l'ordre. Lancé 3 fois de suite : stable. **Famille « Régression »** (`e2e.regression` de la fiche de Cibles, `docs/tests.md` : les mises en page) : le budget de 900 s de la CI d'une PR large n'a plus une seconde de marge (`ciZones.test.ts` échoue dès qu'un spec Essentiel de 1 s s'ajoute) ; il tourne donc dans la CI complète de `main`, la nuit, et quand une PR le modifie (celle-ci). **À décider avec Nathan** : le faire entrer dans l'Essentiel demande de libérer du budget ailleurs.
- E2E de **Blocks (67), Cibles (22) et Rush (9)** verts **sans toucher à un seul de leurs tests** (un premier essai avait échoué sur `disposition.spec.ts` : deux colonnes avec JOUER dans la colonne de gauche le rendaient trop étroit ; JOUER passe donc sur toute la largeur, et la carte du téléphone a moins de retrait).
- **Track, Jump et Tower ne bougent pas** : leurs e2e (étape « verifier ») ; captures de Tower avant / après **identiques au pixel** près le décompte (accueil, « Comment jouer », Réglages ; PC et téléphone). Seul changement partagé : un jeton CSS (`--dj-ombre-titre`) et `--jeu-coque` dans la feuille générée (+1 à +22 o).
- Tests unitaires (`packages/kit/test/peau.test.ts`) : validation des couleurs, décor par thème, feuilles sans couleur ni police en dur, **chaque `gap` vient d'un jeton**, `ecrans.css` importée par `partie.ts` seul. Navigation clavier : la même (ids et ordre des boutons inchangés ; manette : `manette.ts` inchangé).
- **Budgets** (premier chargement, `budgets-controle.mjs`) : Cibles +0,68 Ko, Rush +0,69 Ko, Blocks +0,64 Ko (marges restantes : 0,45 / 1,63 / 0,66 Ko) ; portail +22 o, Track +1 o, Jump +3 o, Tower −1 o. Sans le découpage en `ecrans.css`, +1,3 Ko : Cibles et Blocks dépassaient.

## Non vérifié
- **Aucun appareil réel** : Chromium (Playwright) seulement ; `zoom` au grand écran à regarder sur Firefox et Safari ; pas d'iPhone.
- `peau.dessin`, `peau.fond` et `peau.accent` **ne sont exercés par aucun jeu** : leur validation est testée en unitaire ; leur rendu a été regardé une fois avec une définition d'essai sur Cibles (illustration, décor de nuit, accent jaune : le titre tient à côté d'une illustration de 90 px grâce à une unité de conteneur), **non commitée** — aucun test ne le garde.
- Le classement en écran (ses lignes encadrées) n'est pas dans le spec de mise en page (il faut des joueurs classés) ; le message en direct sur l'accueil non plus.
- La section « SON » des Réglages reste un intitulé sans contenu tant que la musique n'est pas chargée (déjà le cas avant ; sans musique dans les essais locaux).

## Écarts aux consignes, à valider
- **Hors des zones annoncées** (mécanique, minimal) : `packages/core/src/ficheSorties.ts` (une ligne : `--jeu-coque` dans la feuille générée, seul moyen de lire la coque de la fiche côté CSS) ; `config/jeux/cibles.json` et `apps/cibles/e2e/{ecrans-kit.spec.ts,durees.json}` (le spec du kit vit chez Cibles, le kit n'ayant pas de navigateur à lui : c'est déjà là que ses écrans sont essayés) ; `docs/plateforme/kit-de-jeu.md` (demandé). Le générateur `nouveau-jeu` copie ce spec dans un jeu neuf (≈ 10 s).
- `packages/kit/test/jeu.test.ts` : la lecture de `.jeu-scene { padding-top: var(--dj-apercu-reserve…) }` vise `ecrans.css` (la règle y a déménagé, la même assertion).
- **JOUER sur toute la largeur** de l'accueil (et non dans la colonne de gauche comme chez Tower) : conséquence de `disposition.spec.ts` de Blocks (« JOUER prend la largeur de la carte », ≥ 900 px à 1 920). Si Nathan préfère la disposition exacte de Tower, c'est un lot de Blocks qui adapte ce test.

## Propositions hors charte (non codées)
- Une **illustration par défaut** pour un jeu qui n'en fournit pas (un tas de blocs aux couleurs de la fiche) : aujourd'hui rien n'est dessiné.
- Un **décor par défaut par thème** (teinte légèrement différente d'un thème à l'autre) : aujourd'hui seule la peau du jeu donne un décor par thème.
- Un voile **opaque** sur le décor de l'accueil (la scène de la partie n'existe pas encore à cet endroit) : inchangé.
- Cacher un intitulé de réglage dont la section est vide (« SON » sans musique).

## Captures (avant / après)
`docs/plateforme/lots/ecrans-kit/` : `<jeu>-<écran>-<pc|tel>-<avant|apres>.png` pour **Blocks** et **Cibles** (accueil, aide = « Comment jouer », fin ; PC 1 920 × 1 080, téléphone 390 × 844) et `tower-<écran>-<pc|tel>.png` (Tower, inchangé) pour comparer. La fin de Blocks est une partie d'essai (`scenario=blocage`), celle de Cibles une partie sans cible touchée.
