# Lot 29 — Commandes tactiles fiables (DailyJump)

Retour de Nathan : sur iOS, une touche de déplacement reste parfois bloquée « en alternance » ; sans doigt, le personnage avance seul. Objectif : **aucune touche tenue sans un doigt posé dessus**, iOS comme Android. Simulation, rediffusions et versions inchangées.

## Causes (diagnostic du code d'avant)
Établi **par lecture du code et par tests** ; la panne d'iOS elle-même **n'a pas été reproduite** (pas d'iPhone ici) : c'est le rôle de la ligne `?debug` ci-dessous.

| Piste | Verdict |
|---|---|
| Glisser d'un bouton à l'autre | **Pas de blocage, mais une incohérence.** Aucun gestionnaire par bouton : le toucher se décidait par zone. Mais le rôle était **figé à la pose** : un doigt posé sur ← puis glissé sur SAUT continuait de tenir → (et ne sautait pas) ; posé sur SAUT et glissé à gauche, il sautait toujours. Un doigt posé dans la bande haute était oublié pour toujours. |
| `pointercancel` | Traité (sur la couche). |
| `touchcancel` | **Non écouté** (redondant avec `pointercancel` quand celui-ci arrive). |
| `lostpointercapture` | **Non traité.** |
| Perte de focus / visibilité / `pagehide` / rotation | `blur`, `visibilitychange` (page cachée seulement), `resize` et `orientationchange` traités ; **`pagehide` non**. |
| Multi-touch, lever attribué au mauvais doigt | Les doigts sont suivis par identifiant : pas de mauvaise attribution. **Mais aucun rattrapage d'un lever perdu** : `pointerup`/`pointercancel` n'étaient écoutés que **sur la couche** ; un doigt qui finit sa course sur un bouton du haut, ou dont l'événement de fin se perd (geste du système sur iOS), reste dans la liste **indéfiniment**. |
| Événements souris émulés | Pas de double enfoncement constaté (les événements de compatibilité sont supprimés par `preventDefault`), mais un événement `mouse` tardif créait un doigt qui n'était levé que par son `pointerup`. |
| `touch-action` | **Absent : non.** `#touch`, `html` et `body` ont `touch-action: none` (vérifié par `mobile.spec.ts`). |

**Cause la plus probable du symptôme** : un **doigt fantôme** (fin d'événement perdue) reste dans la liste. La direction, c'est « le doigt de direction posé en dernier » : un vrai doigt l'emporte tant qu'il est posé, puis, une fois levé, **le fantôme reprend la main** — d'où une touche qui revient « en alternance » et un personnage qui avance seul. C'est cohérent avec le retour, pas prouvé sur appareil.

## Correction (par principe)
- **L'état se déduit des doigts posés et de leur position** (`TouchPad`) : chaque doigt porte ce qu'il touche maintenant, recalculé à chaque déplacement et à chaque nouvel écran. Sortir d'une zone la relâche, entrer dans une autre l'enfonce ; bande haute et dehors de l'écran ne commandent rien. Plus de rôle figé ni de compteur par bouton.
- **Un doigt ne peut plus rester fantôme** : lever et annulation écoutés sur la fenêtre ; `lostpointercapture` ; **la liste des touchers du système** (`touches` des événements tactiles) rattrape un lever perdu (moins de touchers que de doigts suivis → on garde le plus proche de chaque toucher) ; la souris dont le bouton est lâché hors de la page est levée.
- **Tout est lâché** au focus perdu, à chaque changement de visibilité, à `pagehide` / `pageshow` / `freeze`, à la rotation et au redimensionnement.
- Les événements de souris qui suivent un toucher (< 1 s) sont ignorés. `touch-action: none` était déjà là.

## Track
**Code séparé, non partagé** (`apps/web/src/touchUi.ts` ; pas de zone partagée : rien à proposer comme lot de plateforme). **Même défaut de fond, non modifié** : son `pointerup`/`pointercancel` n'est écouté que sur sa zone de jeu, aucune écoute de `touchcancel`, de `visibilitychange` ni de `pagehide` (seul `blur` lâche tout), et aucun rattrapage d'un lever perdu. Il évite en revanche `lostpointercapture` pour une bonne raison (identifiant réutilisé), dont ce lot a repris la précaution. À traiter dans un lot de Track.

## Vérification
`test/touch.test.ts` (unitaire) et `e2e/mobile.spec.ts` « commandes tactiles fiables » (doigts émulés, Chromium) : glisser ← → saut, sortie du bouton, `pointercancel` + `touchcancel`, lever perdu, perte de capture, focus / visibilité / `pagehide` / rotation, deux doigts, souris émulée. **Famille des e2e : « Régression »** (nuit, « Run workflow », CI complète de la mise en production) — le budget de 900 s de la CI de PR n'a plus de marge (`apps/web/test/ciZones.test.ts` échoue dès +2 s d'Essentiel dans une PR large, et le budget est en zone partagée) ; chaque PR est gardée par `test/touch.test.ts`. Passés en local (21/21 de `mobile.spec.ts`, Chromium). Budget Jump : +691 o (marge 6 329 → 5 638 o). Non vérifié : Firefox et WebKit (ces tests ne sont pas `@navigateurs`), et tout appareil réel. Au passage, un test `@regression` de la nuit (« toutes les cibles font au moins 44 px », paysage) comptait le bouton fantôme (`ghostbtn`) comme un bouton tactile à cause de `includes("tbtn")` : corrigé (`startsWith`).

## Décisions pour Nathan
- **Mettre ces e2e dans l'Essentiel de chaque PR** (≈ 30 s) demande de relever `BUDGET_E2E_S` (zone partagée) ou de retirer ailleurs : à décider.
- **Sortir d'une zone relâche** : un pouce qui dérive du SAUT vers la bande haute ou hors de l'écran ne saute plus. Si c'est trop strict en jeu, la bande haute peut garder la commande du doigt qui y glisse.

## Scénario en 2 clics (téléphone)
Ouvrir le lien d'aperçu de la PR (commenté sur la PR) **sur le téléphone**, avec `?debug` au bout de l'adresse (ex. `…/jump/?debug&accueil=0`). Une ligne en bas de l'écran, au centre, dit « doigts N · touches tenues ».
1. **Glisser d'une flèche à l'autre** : poser le pouce sur ←, glisser sur → sans lever : « doigts 1 · ← tenue » puis « doigts 1 · → tenue ». Lever : « doigts 0 · aucune touche tenue ».
2. **Sortir du bouton** : poser sur →, glisser vers le haut de l'écran (bande haute) : « doigts 1 · aucune touche tenue » ; lever : « doigts 0 · aucune touche tenue ».
3. **Centre de contrôle iOS** : tenir ←, puis de l'autre main tirer le centre de contrôle (balayage depuis le coin haut-droit sur un iPhone à encoche, depuis le bas sur un iPhone à bouton) puis le refermer, doigt levé. La ligne doit revenir à « doigts 0 · aucune touche tenue » et le personnage ne plus avancer seul ; la fin de ligne dit **quel garde-fou a rattrapé le doigt** (« dernier relâchement : annulation », « toucher perdu »…). **Si la ligne montre « doigts 1 · ← tenue » alors que plus rien ne touche l'écran, le défaut subsiste** : noter l'enchaînement et la ligne exacte.
