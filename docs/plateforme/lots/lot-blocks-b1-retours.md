# Lot plateforme — retours de Blocks (B1) : kit, module des blocs, générateur

Branche `claude/blocks-b1-feedback-kit-g7jjco` (PR brouillon de la plateforme). « Pour les joueurs » = `rien` : Blocks est `off`, Cibles et les autres jeux ne changent pas.

## Le point urgent était déjà réglé
Les trois changements demandés (`apps/portail/test/consignes.test.ts`, `scripts/zones-jeu.mjs`, `apps/api/test/zonesJeu.test.ts`) sont **déjà dans `main`** (commits 092e1a6 et 44d1b8c, fusionnés avec la PR #269 de B1). Rien à refaire ; le test des consignes passe.

## Fait
1. **`OptionsPartie.langue` et `.t(cle, params)`** : un jeu écrit un texte en scène sans contournement.
2. **`DefinitionJeu.classable(adresse)`** : `false` = partie d'essai, ni classée ni envoyée ni gardée aux records, message « Partie d'essai : non classée » (`kit.fin.essai`), **sans passer en archive** (`ContexteJeu.essai`). Blocks peut supprimer son contournement de `essai.ts`.
3. **`DefinitionJeu.sansMedaille`** : l'écran de fin n'affiche ni la liste des médailles ni « encore … » ; `seuils` / `medaille` ne sont pas appelées. (Choix : un drapeau, pas `seuils` nul, pour ne casser aucun test de jeu existant.)
4. **`@cdj/visuels` déclaré d'office** : le générateur l'ajoute au `package.json`, au `tsconfig.json` et à la ligne du verrou de tout jeu neuf ; `apps/blocks/package.json` le déclare (verrou régénéré par `npm install`, 1 ligne).
5. **Module des blocs** : `interieur` (`relief.ts`) recouvre le point que quatre quarts de plan remplis se partagent (quatre cases, ou deux cases sur une troisième). **Tower inchangé** : les sept formes aux quatre quarts de tour gardent exactement les mêmes rectangles (test), donc le même rendu. Je n'ai pas fait de captures avant / après : le test sur les rectangles est plus fort. Blocks peut abandonner sa fusion en rectangles (`boites.ts`) quand il le décide.
6. **Générateur** : la passation lit l'état du jeu (catalogue encore « À remplacer » ? seed encore le gabarit ?) et ne dit « squelette » / ne nomme Cibles que pour un jeu de départ ; `docs/blocks/passation.md` régénéré. **Carte du `CLAUDE.md` racine** : ligne Blocks ajoutée.
7. **Pour B2** : réglage **« Vibration »** (oui / non) dans les Réglages du kit, **dans la clé `<id>:reglages` existante** (aucune nouvelle clé du navigateur : les mentions légales ne changent pas), montré seulement si le jeu déclare `vibration: true` et que l'appareil tactile sait vibrer ; `OptionsPartie.vibrer(motif)` le respecte à chaque appel. **Regard et fermeture des yeux existent déjà** dans le module commun (`regard`, `regardVers`, `fermeture`, genre `figee`, clignement) : rien à ajouter.

## Vérifié
`npm run typecheck`, tests unitaires (SQLite) du kit, de `@cdj/ui`, de `@cdj/visuels`, de Tower (dessin des pièces), de Cibles et de Blocks, du générateur et des consignes ; `npm run consignes`, `fiches --verifier`, `traductions --verifier` ; `npm run verifier` sur les zones `blocks-jeu`, `cibles-jeu`, `tower-jeu` (voir la PR pour le verdict). Les deux tests du trou du module échouent sans le correctif.

## Non vérifié
- L'écran Réglages et la vibration sur un vrai téléphone ; `amisDom` et les écrans du kit n'ont pas de test DOM : les nouveaux chemins (`classable`, `sansMedaille`) ne sont essayés que si un jeu les utilise (Blocks, au lot qui les adoptera).
- Budgets : le kit grossit de quelques dizaines d'octets au premier chargement (`index.ts`) ; à remesurer par `node scripts/budgets.mjs` après `npm run build` (voir la PR).

## Reste pour Nathan / pour la suite
- **Avant `on`** : décrire les clés `blocks:*` dans les deux pages de mentions légales (règle R5) — **pas fait ici**, à faire dans un lot de plateforme au moment où Blocks se prépare à passer `on`.
- Côté Blocks (zone du jeu) : adopter `classable`, `sansMedaille`, `t` ; retirer le contournement de `essai.ts`.
