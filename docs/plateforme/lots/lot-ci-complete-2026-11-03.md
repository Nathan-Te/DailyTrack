# Lot de mise en production du 3 novembre 2026 — rendre la CI complète verte

Origine : le run « Mettre en production » (mode `essai`) de la branche K4b s'est arrêté ⛔ au verdict de la CI complète (runs 41669392985 et 41669441316) ; la nuit du 03/11 (run 41622586532) était déjà rouge sur les mêmes parts (`chromium 1/8` et `3/8`). Zone : exception écrite à la règle des zones (tests de Track).

## Tests rouges, cause, correction
| Test | Cause | Correction |
|---|---|---|
| `apps/web/e2e/hud-compact.spec.ts:14` (`<= 9` attendu, 10 reçu) | Le test comptait **tous** les `button:visible` de `#pause`. Le 10ᵉ est `#pause-retours` (« Un bug ? Une idée ? », lot C1), posé exprès dans le **pied** de la pause, en lien (`.lien`) : ce n'est pas une action. La charte (pause allégée, § 9) dit « Reprendre et huit actions au plus » : Reprendre + les huit de `.pause__actions` = 9 `.dj-bouton`. Aucun élément en trop au HUD : **pas un défaut**. | Le test compte `#pause .dj-bouton:visible` (≤ 9, la règle de la charte) et vérifie que le lien du pied est présent ; la hauteur de 44 px reste contrôlée pour tous les boutons visibles. |
| `apps/web/e2e/scene.spec.ts:42` (« `#home .etiquette` dépasse en bas », paysage et portrait) | Le test appliquait l'ancienne règle « l'étiquette tient dans l'écran sans défiler ». Le lot S1b (charte rév. 15, `apps/web/CLAUDE.md`, « L'accueil ne coupe jamais l'étiquette ») l'a remplacée : l'étiquette garde toute sa hauteur et **l'écran défile**. Vérifié : c'est bien un défilement (`.cadre__defile`), pas une étiquette rognée. **Pas un défaut.** | Pour l'accueil, `etiquetteIntacte` : l'étiquette n'est pas rognée (`scrollHeight ≤ clientHeight`), l'écran défile jusqu'au bas, le bas de l'étiquette se voit à la fin du défilement, elle commence sous la barre des jeux. Les autres écrans gardent `tientDansLEcran`. Les invariants complets de l'accueil (plaques de 44 px, anneau de focus, blocs non écrasés) restent dans `accueil.spec.ts` (Essentiel). |

Essai : `verifierAccueilTelephone` appliqué tel quel à ce spec échoue sur `span.who` (pseudo du classement tronqué par `text-overflow: ellipsis`, voulu) : le test n'est donc pas réutilisable ici sans affaiblir l'aide ; il n'a pas été modifié.

## Instables vus sur des PR (non corrigés : non réapparus)
- `apps/tower/e2e/classement.spec.ts` (« une copie est refusée… ») : l'attente du formulaire du pseudo après la fin de partie a un délai de 40 s (`choisirPseudo`) ; la page reste occupée 5 à 16 s (rendu logiciel) et jusqu'à 42 s sous charge. À fiabiliser s'il revient dans la CI complète : la cause est le fil principal saturé après la fin de partie, pas le délai.
- `apps/web/e2e/profil.spec.ts:144` : non étudié.

## Vérifié / non vérifié
- Vérifié en local (Chromium, rendu logiciel) : `hud-compact.spec.ts` et `scene.spec.ts` rouges avant (même message qu'en CI), verts après (5 tests).
- Non vérifié : la CI complète sur la branche (un agent ne lance pas de workflow ; une branche jetable demanderait une autre branche) ; `profil.spec.ts`.
- Aucun comportement de jeu ni de serveur modifié, golden inchangés, aucun `CLAUDE.md` modifié.
