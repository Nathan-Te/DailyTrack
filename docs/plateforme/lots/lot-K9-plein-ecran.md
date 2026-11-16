# Lot K9 — Le plein écran en portrait (plateforme, kit, court)

Demande de Nathan (16/11/2026) : le bouton plein écran en vue portrait pour Pinball, Tower et Blocks. Relevé : `docs/pinball/maquettes/README.md`, « Le plein écran en portrait ». Branche `claude/lot-k9-plein-ecran-portrait-k2o8s6`.

## Les deux défauts, et leur correction
| Défaut | Correction |
|---|---|
| `basculerPleinEcran` verrouillait **toujours le paysage** (écrit pour Track et Jump) : sur Android, un appui en portrait tournait Pinball, Tower ou Blocks | `basculerPleinEcran(orientation?)` : `"actuelle"` (**défaut**, celle du moment), `"paysage"` ou `"portrait"`. `boutonPleinEcran` et `barreJeu` reçoivent l'option `orientation`. Track et Jump (accueil, partie, pause) **passent `"paysage"`** : rien ne change pour eux. Tower n'en passe aucune : il ne verrouille plus le paysage |
| Les jeux du kit n'avaient le plein écran que dans la pause et la barre de l'accueil | le HUD de la partie porte `#jeu-hud-plein-ecran`, à droite avant le fantôme et la pause, en portrait comme en paysage ; caché si le plein écran n'est pas possible ; sur iPhone il ouvre l'astuce « Sur l'écran d'accueil » (partie en pause), comme avant |

## Où le jeu choisit son orientation
**`DefinitionJeu.orientation`** (kit), pas la fiche : c'est une affaire de rendu, lue quand le kit pose ses boutons ; une valeur dans la fiche demanderait une projection, un champ dans `npm run fiches` et un test pour rien. Défaut : `"actuelle"`. Un jeu qui ne se joue qu'à l'horizontale écrit `orientation: "paysage"`.

## Vérifié
- `packages/ui/test/pleinEcran.test.ts` : les trois orientations (verrou demandé, orientation du moment lue sur `screen.orientation.type` puis `matchMedia`), le verrou refusé et l'entrée refusée sans erreur pour chacune.
- `apps/blocks/e2e/plein-ecran.spec.ts` (déclaré dans la fiche de Blocks, `e2e.specs` **et `e2e.regression`** : même à 1 s il dépassait les 900 s de l'Essentiel d'une PR large, `ciZones.test.ts` ; comme les specs de Cibles, il tourne quand la PR le modifie — ici —, sur `main` et la nuit — et `durees.json`) : bouton visible dans le HUD à 390 × 844, 360 × 640 et 844 × 390, 44 px, dans la fenêtre, sans recouvrir la pause ni le fantôme ; le clic demande le plein écran et le verrou `portrait` (portrait) / `landscape` (paysage) ; bouton absent quand le plein écran n'est pas possible.
- `npm run consignes` vert. Aucun golden, aucune version de simulation, aucun fichier de `apps/pinball`, `packages/pinball-sim` ou `apps/api/src/pinball*.ts` touché.

## CI : un échec dans le Kit de bout en bout
Au premier run, `surimpression.spec.ts` (jeu généré, 390 × 844) a lu `#jeu-hud-score` vide : la barre n'était remplie qu'à la première image. **Non reproduit en local** (32 exécutions sur 32 vertes avant la correction) : la cause est une course probable, antérieure au lot, pas démontrée. Correction dans le kit (`partie.ts`) : le texte de la barre est écrit dès la création de la partie.

## Non vérifié
- **Le vrai verrouillage d'orientation ne se teste que sur un téléphone Android.** Le spec remplace `requestFullscreen`, `screen.orientation.lock` et `.type` par des témoins : il prouve ce que le bouton **demande**, pas ce que l'appareil en fait. Sur iPhone il n'y a pas de plein écran de page (l'astuce, inchangée).
- Aucun essai sur un vrai téléphone dans ce lot ; Track et Jump n'ont pas de spec nouveau (leur appel n'a changé que par un argument explicite : specs existants et `npm run verifier`).

## Scénario pour Nathan (aperçu de la PR, téléphone Android)
1. **Blocks** (`/blocks/`) : lancer une partie, toucher le plein écran en portrait : l'écran reste en portrait.
2. **Track** (`/track/`) : le plein écran passe toujours en paysage.

## Pour les joueurs
- [Du Jour] Le plein écran garde la vue en portrait dans Tower, Blocks et les jeux qui s'y jouent. // Fullscreen keeps portrait view in Tower, Blocks and other portrait games.
- [Blocks] Le bouton plein écran est maintenant à l'écran pendant la partie. // The fullscreen button is now on screen during a game.

*Écart avec la demande : la zone `[Plateforme]` n'existe pas (zones = `ZONES_NOUVEAUTES`, la plateforme est `Du Jour`) ; la ligne utilise `[Du Jour]`.*

## Reste à faire ailleurs
Le HUD de Pinball (PB5b) pose son bouton ; il héritera de l'orientation du moment.
