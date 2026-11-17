# Lot PG2 — retours de Nathan (pieds, écran de fin) et restes du GR5 de Gravity

Lot de la **plateforme** (branche sans « gravity », PR brouillon étiquetée `plateforme`). Un lot GR6 de Gravity tourne en parallèle : **aucun fichier** de `apps/gravity/`, `packages/gravity-sim/`, `apps/api/src/gravity*.ts` ni `apps/api/test/gravity*.test.ts` n'est touché.

## Pour les joueurs
- [Jump] Les pieds du personnage courent dans le bon sens // The character's feet now run the right way
- [Du Jour] L'écran de fin des jeux du kit peut montrer un bilan de la partie (cause de la fin, distance, pièces…) // The end screen of kit games can show a game recap (cause of the end, distance, coins…)
- [Du Jour] « Comment jouer » s'ouvre toujours en haut, avec de petits dessins à côté des pas quand le jeu en fournit // "How to play" always opens at the top, with small drawings next to the steps when the game provides them

(Seul Jump change à l'image aujourd'hui ; le bilan, les dessins et l'ouverture en haut attendent qu'un jeu les adopte — Gravity au GR6.)

## Point par point
| # | Point | État |
|---|---|---|
| 1 | Pieds du personnage à l'envers | **fait** |
| 2 | Bilan de partie dans l'écran de fin du kit | **fait** |
| 3 | Anciennes versions servies par le serveur (`generateurDuNiveau`) | **fait** |
| 4 | CI : durées, plafond de 60 s, deux e2e instables, test « lot PG1 » | **fait** |
| 5 | « Comment jouer » : dessins, ouverture en haut | **fait** |

### 1. Les pieds (`@cdj/visuels`, Jump change volontairement)
Cause : `feetTarget` (`packages/visuels/src/plateformes/personnage.ts`) levait le pied quand `sin(phase) > 0` **et** le faisait reculer pendant la levée, avancer pendant la pose : la pédale tournait à l'envers. Un seul signe change (`base − sens · swing · k · cos`) : le pied posé recule par rapport au corps, à l'opposé de la course, le pied levé revient vers l'avant. Amplitude, levée, lissage, couleur : inchangés. **La cadence suivait déjà la distance au sol** (`Look.stride`, jamais le temps) : un test le dit. Jeux qui s'en servent : Jump (`apps/jump/src/look.ts`, `main.ts`, `scene.ts`) et Gravity (`apps/gravity/src/heros.ts`), tous deux par `animateLook` / `creerPersonnage` : **la correction est dans le module commun, Gravity la reçoit sans rien changer** (son retournement pose le personnage dans un pivot `scale.y = −1` : testé, les pieds sont du côté de la surface et reculent dans le même sens).
- Tests : `packages/visuels/test/pieds.test.ts` (quatre vitesses et sens de course, pied posé jamais vers l'avant, pieds en opposition, cadence, pivot retourné) ; il **échoue sur l'ancien code** (vérifié). Les tests de Jump (`animation.test.ts`, `dessinFige.test.ts`) passent inchangés.
- **Captures avant / après de Jump** : `docs/plateforme/lots/img/pg2/jump-pieds-avant-apres.png` (course lente, vx 4,5 → 10,5 tuiles/s, puis pleine vitesse, 8,5 ; quatre moments du cycle, 844 × 390 × 4) ; outil `apps/jump/e2e/captures-lot-pg2.spec.ts`. Le corps, les yeux et le décor sont identiques ; seuls les pieds diffèrent (les feuilles du fond bougent d'une prise à l'autre : horloge réelle).

### 2. Le bilan (kit)
`PartieDuJeu.bilan?(): BilanPartie | null` (**écart au prompt : sur la partie et non sur `DefinitionJeu`** — la cause de la mort et les totaux vivent dans l'état de la partie, c'est aussi ce que proposait le README du GR4). Le kit le lit une fois quand `finie()` devient vrai et le montre dans une tuile « Bilan » du vrai écran de fin (cause, puis libellé / valeur ; textes par les catalogues fr + en ; huit lignes au plus). Le passage de l'animation de fin à l'écran de fin n'a **aucun écran intermédiaire** (un seul écran ouvert : testé). Un jeu sans bilan : markup inchangé. Captures : `kit-fin-bilan-portrait.png`, `kit-fin-bilan-paysage.png` (même dossier d'images).
- Tests : `packages/kit/test/bilan.test.ts` (pur) et `apps/cibles/e2e/fin-et-aide.spec.ts` (Régression : le jeu fictif — « Cibles », `?debug&bilan=1` — fournit un bilan ; 390 × 844, 360 × 640, 844 × 390, anglais, sans bilan). Le spec est déclaré dans la fiche (`e2e.specs`, `e2e.regression`) et `durees.json` ; il est recopié par `npm run nouveau-jeu` (textes sans le mot « Cibles » exprès, le générateur le renomme).

### 3. Les anciennes versions côté serveur
`ContratMinimal.generateurDuNiveau?(niveau): number` (`apps/api/src/jeux/defauts.ts`) : `memeContenu` compare `rediffusion.g` à ce générateur-là, à défaut au courant. Test : `apps/api/test/jeuNeufVersions.test.ts` (jeu jouet après la montée de version : jour figé sous le 1, courant 2 ; accepté avec le champ, refusé sans — le manque ; un autre générateur que celui du niveau reste refusé ; il **échoue sans le correctif**, vérifié). Doc : `docs/regles/api/un-jeu-neuf-sur-le-module-lot-k4c.md`.

### 4. La CI
- **Plafond de 60 s rendu** (`ciZones.test.ts`) : 58 fichiers de tests de Gravity et de Pinball mesurés ajoutés à `scripts/unit-durees.json` (les trois `validation-30-jours` de Pinball ≈ 22 s chacun, `franchissabilite-30-jours` 14 s) ; le total de la PR de Jump passe à **57 s** (marge de 3 s seulement : un fichier de plus sans durée pèse 5 s). Règle ajoutée à `tests-et-ci.md`. **Non fait, à décider** : les trois `validation-30-jours` de Pinball dépassent ~10 s et seraient « Régression » selon la règle PG1 (avec une version courte en Essentiel) ; c'est le lot Pinball qui le décide.
- **`surimpression.spec.ts`** : le kit écrit déjà le texte de la barre dès la création de la partie (lot K9, base de ce lot) ; le spec attend maintenant explicitement le texte de la barre **et** des quatre zones avant de mesurer. Pas reproduit en local (il passait déjà), donc non prouvé « sur le runner » : à surveiller dans « Kit de bout en bout ».
- **Tower `classement.spec.ts:201`** : reproduit en local (2 échecs sur 4 en répétant le fichier ; 205 : `toContainText(/Hors ligne…/)` avec les 5 s par défaut alors que l'envoi coupé demande le délai des envois). Corrigé en lui donnant `ENVOI` (40 s) comme les autres attentes d'état ; ensuite 25 / 25 en local (5 répétitions du fichier, 0 relance). La preuve de stabilité de la CI (`e2e/stabilite.json`) n'accepte que `web` et `jump` : pas de ligne ajoutée (`stabilite.test.ts` la refuse).
- **Test « lot PG1 » de `mentions.test.ts` retiré** : Gravity n'a plus le marqueur « À remplacer », le test générique le couvre (vérifié : `blocks, gravity, pinball, rush`).

### 5. « Comment jouer »
`DefinitionJeu.dessinsAide?: Record<clé, () => SVGElement>` (**écart à la proposition du GR4** : `aide` garde sa forme `string[]`, parce qu'`aide: (string | {cle, dessin})[]` cassait le typage des tests de Gravity, de Pinball, de Rush, de Blocks et de Vertige, que je ne pouvais pas toucher). Le dessin est à gauche du pas (56 × 56, `aria-hidden`). **Ouverture en haut** : `focus({ preventScroll: true })` et `scrollTop = 0` (aide, pause, fin). Le défilement jusqu'au bouton n'arrivait **que par le bouton « Comment jouer »** (pas à l'ouverture automatique du premier lancement) : le spec teste les deux chemins et **échoue sans le correctif** (vérifié : scrollTop 102 à 360 × 640, 304 à 844 × 390). Capture : `kit-aide-dessins-portrait.png`.

## Ce que Gravity doit adopter (lot GR6)
1. **Pieds** : rien à faire (module commun). Vérifier en capture, en gravité inversée, que les pieds sont côté surface.
2. **Bilan** : implémenter `bilan()` sur sa `PartieDuJeu` (cause = clé `gravity` du catalogue, lignes : distance, pièces, gemmes, thème, multiplicateur max ; valeurs écrites avec `o.langue` / `o.t`) ; **retirer le bilan dessiné par la scène** (les 1,5 s sous le voile) : la scène ne joue que l'animation de mort, `finie()` devient vrai quand elle est jouée (`finEnCours()` pour que la musique retombe avant).
3. **Dessins de l'aide** : `dessinsAide` (les 3 pas et les blocs de la maquette), des `<svg>` aux jetons `--dj-*`.
4. **Anciennes versions** : `generateurDuNiveau: (n) => n.contenu.g` dans `apps/api/src/gravity.ts`, puis retourner `gravityVersions.test.ts` (aujourd'hui 409) en 200. **Blocks** (`apps/api/src/blocks.ts`, commentaire d'en-tête) a le même manque : son lot l'adopte.
5. `chargerPartie` et `hud: "surimpression"` (lot PG1) : toujours à migrer (voir `packages/kit/CLAUDE.md`) ; retirer la règle de feuille qui masque la barre dans `hud.css`.
6. **Durées** : ajouter ses nouveaux fichiers de test à `scripts/unit-durees.json`.
Reste à Nathan / à d'autres lots : une piste de musique pour Gravity (`musique/musiques.json`), la teinte de l'étiquette, les mentions légales de Gravity.

## Vérifié / non vérifié
**Vérifié** : `npm run typecheck` ; tous les unitaires (sqlite) — voir la PR pour le verdict final ; e2e de Cibles (`fin-et-aide` 12 / 12, `surimpression`), e2e Tower `classement` ×5 ; captures de Jump ; `npm run consignes`, `npm run traductions -- --verifier`, `npm run fiches`. **Non vérifié** : libSQL (en CI), Firefox / WebKit, « Kit de bout en bout » (copie et génère des jeux : en CI), le bilan et les dessins sur un vrai jeu (aucun ne les fournit encore), les pieds de Gravity à l'image.
