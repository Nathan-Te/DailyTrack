# Lot GR4 — Gravity : identité, textes complets, son

Branche `ccr-8d3a28ac-3cdm03`, PR brouillon. Sim, générateur et golden **inchangés** (versions sim 2, générateur 3, robot 2 : comme avant le lot). « Pour les joueurs » : `rien` (le jeu est `off`).

## Ce qui est livré
1. **Identité** (`config/jeux/gravity.json`, puis `npm run fiches`) : police **Lilita One**, motif **`lignes`** (des bandes horizontales : le sol et le plafond, les deux strates entre lesquelles on court), `aujourdhui: true`, illustration `apps/gravity/public/illustration.svg` (96 × 80 : cube à bandeau au sol, son reflet pâle aux tirets au plafond, arc en tirets de l'inversion, gemme ; aplats bordés d'encre, aucune opacité). Étiquette `#FFB892` / `#C9622E` inchangée (provisoire). **Le test des fiches voit une identité complète, sans exemption.**
2. **Panneau « Aujourd'hui »** (`panneau.ts`, `panneau.css`) : les 5 thèmes du jour dans l'ordre, en tuiles à la couleur sombre du thème avec leur mécanique (texte papier, 4,5:1 testé), « un thème tous les 300 m… », puis les 4 médailles en cases pleines. Les thèmes viennent de `contenu.ordre` (tout de suite) ; les seuils de `contenu.pretSeuils()` (relu toutes les 500 ms, « calcul en cours… » en attendant, jamais `seuilsFiges` ni calcul forcé). Vit dans le morceau `scene-` : rien au premier chargement.
3. **Textes fr + en** : réplique d'accueil (celle de la maquette pour la Forêt, mot pour mot ; les quatre autres thèmes ont la leur, une par écran) ; « Comment jouer » complet (3 pas, 6 blocs, bouclier, aimant, multiplicateur : 12 points) ; **la mort montre sa cause et son bilan** (distance, pièces × 10, gemmes × 100, thème atteint, multiplicateur max) pendant 1,5 s (au lieu de 0,9 s) avant l'écran de fin. Anglais relu : « same deal », « gravity switch » (l'inverseur ; « flipper » dirait Pinball), « So do the void… », couleurs à l'américaine.
4. **Le son** (`sonsLogique.ts` pur, `sons.ts`) : Web Audio sans fichier, ouvert par `ouvrirContexteAudio` (règle S2, session `ambient`) au premier geste ; 11 événements (inversion, inverseur, atterrissage, pièce — +½ ton toutes les 2 pièces —, palier, chute du multiplicateur, gemme, bonus, bouclier consommé, mort, changement de thème), sinus et triangles, jamais au-dessus de 0,3. **Volume des effets** du kit (`effets: true`, séparé de la musique). **Musique** : la scène annonce `theme:<code>` à chaque changement de thème (`musiqueDuJeu.ts`).
5. Captures `docs/gravity/captures/GR4/` (outil `e2e/captures-lot-gr4.spec.ts`, hors CI) : `accueil-pc`, `accueil-pc-en`, `accueil-portrait`, `comment-jouer-pc`, `comment-jouer-portrait`, `mort-pc`, `mort-portrait`, `fin-pc`, `fin-portrait`.

## Pour tester en 2 clics (recette, clé d'aperçu, jamais classé)
Remplace `<clé>` par la clé d'aperçu (elle se range dans le stockage local, puis part de l'adresse).
- **Accueil** (identité, panneau, seuils après quelques secondes) : `https://recette.playdujour.com/gravity/?apercu=<clé>`
- **En anglais** : le même lien, après avoir mis la langue en anglais dans ton profil Du Jour (il n'y a pas de paramètre d'adresse pour la langue) ou avec un navigateur en anglais.
- **Comment jouer** : le même lien, bouton « Comment jouer » (il s'ouvre seul au tout premier JOUER d'un navigateur neuf : fenêtre privée).
- **Écran de fin en quelques secondes** : `https://recette.playdujour.com/gravity/?apercu=<clé>&morceau=34` — JOUER puis ne touche à rien : tu meurs en 5 secondes environ (mesuré : mort entre 2,5 et 5 s de jeu ; avec `morceau=11` ou sans paramètre, 5 à 10 s), le bilan s'affiche 1,5 s, puis l'écran de fin (« Partie d'essai : non classée »). Pour voir le thème changer (son et musique) : `&theme=glace`, touche **T**.

## Vérifié
- `npm run typecheck` ; tests unitaires de `apps/gravity` (44), des fiches et de l'identité, de `packages/ui`, `packages/musique`, `packages/kit`, de `apps/portail` (mentions comprises), `sonMelange` (S2).
- e2e : `partie`, `poids`, `determinisme` (+ un test de l'accueil : ordre des thèmes, seuils, 12 points d'aide) ; captures regardées : accueil PC, accueil portrait, mort portrait, fin PC, Comment jouer portrait.
- Premier chargement mesuré (`mesureJeuNeuf`) : **43 805 o** gzip, sous les 48 Ko (plafond de la ligne `gravity.jsCss`, inchangé).
- `npm run traductions` à jour ; clés fr = en.

## Non vérifié
- **Le son à l'oreille** : seuls la décision (tests purs) et le branchement (faux contexte audio) sont testés ; hauteurs et niveaux sont à écouter par Nathan.
- La musique : voir « Ce qui reste ». Aucun essai sur iPhone ni avec la vraie recette (aucun accès ici).
- L'accueil en anglais n'a été capturé qu'au PC.

## Sorties des zones (accord de Nathan en session)
Le test des fiches exige, pour tout jeu qui a un fichier d'illustration, la **découpe « profil » de sa police**. Lilita One (Jump) n'en avait pas (son illustration est « propre », sans fichier). Générée par `node scripts/polices/decouper.mjs --seulement=lilita` (fonttools 4.68.0, mêmes fichiers qu'avant pour les autres polices) : `packages/ui/polices/profil/lilita-one-latin-400-normal.woff2` (4 100 o), `packages/ui/polices/decoupe.json`, `packages/ui/src/polices-profil/lilita-one-400.css`, `apps/portail/src/profil.ts` (une ligne d'import, **avant** la feuille complète, qui l'emporte : le portail charge la même police qu'avant, aucun octet de plus), `scripts/polices/decouper.mjs` (Lilita dans `PROFIL`). **La PR n'est donc pas étiquetée `jeu:gravity`** (le job `zones` refuserait ces fichiers) : à relire comme PR mixte par la plateforme.

## Ce qui manque au kit (à proposer à un lot de la plateforme)
1. **Un bilan sur l'écran de fin** : le kit n'affiche que le score, la médaille et le rang ; aucun emplacement pour « cause de la mort, distance, pièces, gemmes, thème, multiplicateur max ». Proposition : `PartieDuJeu.bilan?(): { cle: string; valeur: string }[]`, rendu en tuile sous le score. En attendant le bilan se lit 1,5 s sur la scène (puis disparaît sous le voile de l'écran de fin).
2. **Des dessins dans « Comment jouer »** : le kit n'écrit que des `<li>` de texte. Proposition : `DefinitionJeu.aide` accepte `{ cle, dessin?(): SVGElement }` (les 3 pas et les blocs de la maquette ont des pastilles dessinées).
3. **Ouverture en haut de « Comment jouer »** : avec 12 points, la fenêtre s'ouvre défilée jusqu'au bouton « C'est parti » (le focus y est posé) et le titre est coupé (`comment-jouer-pc.png`). `aide.ts` devrait poser le focus sans défiler (`focus({ preventScroll: true })`) ou ouvrir en haut.
4. `OptionsPartie` ne donne pas la musique : la scène passe par `musiqueDuJeu.ts` (instance commune). Un `musique` dans `OptionsPartie` serait plus propre.

## Ce qui reste pour `preview`
- **GR5** : `preparer`, anciennes versions du générateur, calibrage (seuils, vitesse).
- **Mentions légales de Gravity** (lot de la plateforme, les deux pages) : **le marqueur « À remplacer » reste** dans `catalogue.fr.ts` — dans un **commentaire**, plus dans un texte visible : le test `apps/portail/test/mentions.test.ts` traite le jeu en squelette tant qu'il y est. Les mentions ne sont pas fusionnées (aucune clé `gravity:` dans les deux pages).
- **Une piste de musique** : `musique/musiques.json` ne nomme aucun morceau pour `gravity` ; les scènes sont annoncées et le réglage de volume est celui du kit, mais **la musique reste muette** tant qu'une piste n'est pas ajoutée (zone partagée, procédure `docs/plateforme/musique.md`).
- Teinte de l'étiquette (choix de Nathan).
