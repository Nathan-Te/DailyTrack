# Lot 52 — Track : nouvelles commandes mobiles (gyroscope, glissière, volant)

Branche : `claude/affectionate-sagan-a1akqg` (imposée par la session ; l'énoncé disait `lot-52-commandes-mobiles`). PR brouillon : [#173](https://github.com/Nathan-Te/DailyTrack/pull/173).
Guide des consignes : `apps/web/CLAUDE.md` § « Commandes tactiles (lot 10) », bloc « Lot 52 ». Budgets : `docs/plateforme/budgets.md` § « Lot 52 (Track) ».

## Ce que fait le lot
Quatre façons de tourner sur téléphone en paysage, **toutes la même direction analogique** (−64 à 64) : la simulation, la rediffusion, le serveur et les golden ne changent pas.
- **Boutons** (défaut, inchangé), **Glissière** (remplace le joystick ; un ancien choix « joystick » devient « glissière », sensibilité et zone morte gardées), **Volant** (tourné au doigt, autour de son centre), **Gyroscope** (le téléphone incliné comme un volant). Les pédales restent ; **disposition inversée** (pédales à gauche, direction à droite) commune aux quatre.
- **Chargés à la demande** : la glissière, le volant, le gyroscope et leurs réglages ne sont jamais dans le premier chargement ; un joueur qui a déjà choisi un mode le charge **avant le décompte** (le décompte attend).
- **Gyroscope** : autorisation (iPhone : `requestPermission` au geste du joueur), calibrage au décompte (moyenne des 0,5 dernières secondes), « Recentrer » (pause et Réglages, 1,5 s après l'appui), les deux paysages (`screen.orientation`), lissage léger, zone morte et sensibilité réglables. Refus, capteur absent ou muet : message clair et **retour au mode d'avant**. **Aucune donnée du capteur n'est gardée ni envoyée** (le réglage seul l'est, dans `cdj:touch` — la clé des réglages tactiles existante ; l'énoncé écrivait `cdj:settings`).

## Maquettes (validées par Nathan)
`docs/lots/lot-52-commandes/maquettes.html` (planche fr + en, jetons de `@cdj/ui`) — validée avec ses six propositions : volant à prise relative ; angle maximal = sensibilité du volant ; glissière en position absolue ; gyroscope à pédales séparées (frein à gauche, gaz à droite) ; jauge d'inclinaison à côté de la vitesse ; « Recentrer » 1,5 s après l'appui ; disposition inversée commune.

## Réglages par défaut proposés
| Réglage | Défaut | Plage |
|---|---|---|
| Direction | Boutons | Boutons · Glissière · Volant · Gyroscope |
| Taille des commandes | Moyenne | Petite · Moyenne · Grande (volant 101 / 140 / 182 px ; glissière 170 × 46 / 236 × 64 / 239 × 83 px) |
| Glissière : sensibilité · zone morte | ×1 · 8 % | ×0,5 à ×2 · 0 à 30 % (repris du joystick) |
| Volant : angle maximal · zone morte | 90° · 6 % | 90° ou 135° · 0 à 30 % de l'angle maximal |
| Gyroscope : sensibilité · zone morte · jauge | ×1 (plein braquage à 35°) · 5 % · oui | ×0,5 à ×2 (70° à 17,5°) · 0 à 30 % · oui / non |
| Disposition inversée | Non | Oui / Non |

## Budget (détail : `budgets.md`)
- **Premier chargement : +976 o** (290 217 → 291 193 o, `main` reconstruit à part), sous le +1 ko demandé ; marge 407 o.
- **À la demande** : glissière 1 197 o, volant 1 784 o, gyroscope 4 515 o, réglages tactiles 843 o (+ feuilles 0,4 à 0,8 ko), gardés par `perf.spec.ts`.
- Le piège rencontré : un module à la demande qui importe une valeur de `touch.ts` / `touchUi.ts` fait de ces deux fichiers des morceaux à part du premier chargement (+1 928 o au lieu de +976 o). Règle écrite dans `apps/web/CLAUDE.md`.

## Tests
- Unitaires : `touch.test.ts` (zones et boutons de tous les modes, sur sept écrans dont avec encoche, disposition inversée, migration du joystick, réglages), `steerSlider`, `steerWheel` (angle, butoir 90° et 135°, retour au centre), `steerGyro` (calibrage, zone morte, sensibilité, les deux paysages, filtrage, autorisation), `steerMath`, et **`commandesMobiles.test.ts` : chaque mode conduit un vrai tour, la rediffusion encodée comme pour l'envoi puis rejouée par `replayRace` (le code du serveur) donne exactement le même temps** — la preuve que le format des commandes ne change pas, dans la CI de PR.
- e2e (Chromium, profil téléphone), bloc « Lot 52 » de `tactile.spec.ts` : chaque mode piloté par de vrais événements tactiles et des événements `deviceorientation` simulés ; plusieurs doigts ; gyroscope refusé / absent → retour au mode d'avant avec le message ; **une course jouée au volant sur le circuit du jour, envoyée au vrai serveur, rejouée par lui au même temps** ; chargement à la demande. `tactile.spec.ts` existant adapté (glissière à la place du joystick), non affaibli.
- **Famille « Régression », pas « Essentiel » — à décider par Nathan.** La CI de PR de Track n'a plus de marge dans son budget de 900 s de specs (`ciZones.test.ts` : moins de 3 s mesurés ; une nouvelle ligne de 15 s fait reporter un autre spec), et un nouveau fichier de spec demanderait une ligne dans `e2e/zones.json`, zone de la plateforme (le job `zones` refuse la PR). Les nouveaux e2e sont donc dans `tactile.spec.ts` (déjà déclaré) et étiquetés `@regression` : ils tournent la nuit, par « Run workflow » et par `npm run verifier -- --regression` (verts en local, 11 tests, ≈ 100 s). Pour les passer en Essentiel : relever `BUDGET_E2E_S` et déclarer `steer*.ts` dans une zone (lot de plateforme).

## Captures (fr et en, téléphone 844 × 390, `CAPTURES=1 npx playwright test captures-lot52`)
| | fr | en |
|---|---|---|
| Boutons | [img](lot-52-commandes/img/boutons-fr.jpg) | [img](lot-52-commandes/img/boutons-en.jpg) |
| Glissière | [img](lot-52-commandes/img/glissiere-fr.jpg) | [img](lot-52-commandes/img/glissiere-en.jpg) |
| Volant | [img](lot-52-commandes/img/volant-fr.jpg) | [img](lot-52-commandes/img/volant-en.jpg) |
| Gyroscope | [img](lot-52-commandes/img/gyroscope-fr.jpg) | [img](lot-52-commandes/img/gyroscope-en.jpg) |
| Pause du gyroscope (« Recentrer ») | [img](lot-52-commandes/img/pause-gyroscope-fr.jpg) | [img](lot-52-commandes/img/pause-gyroscope-en.jpg) |
| Réglages › gyroscope | [img](lot-52-commandes/img/reglages-gyroscope-fr.jpg) | [img](lot-52-commandes/img/reglages-gyroscope-en.jpg) |
| Réglages › volant | [img](lot-52-commandes/img/reglages-volant-fr.jpg) | [img](lot-52-commandes/img/reglages-volant-en.jpg) |

## Changements hors du cœur du lot
- `main.ts` : le décompte attend le chargement du mode, `pad.begin()` / `pad.go()` (calibrage), la pause lève les doigts posés, l'aide d'une ligne n'est plus effacée par le gaz automatique **pendant le décompte** (elle disparaissait aussitôt), `?steer=glissiere|volant|gyro`.
- `adminLogic.ts`, `admin/index.html` : les nouvelles valeurs de `?steer=`. `settingsUi.ts` : les réglages tactiles se chargent à l'ouverture de l'onglet « Commandes ».
- `e2e/durees.json` (durée de `tactile.spec.ts`) ; `docs/plateforme/traductions.md` régénéré. **Pas de zone pour `steer*.ts`** dans `e2e/zones.json` (zone de la plateforme) : une PR qui ne touche que ces fichiers ne lance pas `tactile.spec.ts` (ses tests unitaires, eux, sont choisis par le graphe des imports).

## Vérifié / non vérifié
- Vérifié : tout ce qui précède, en local (typecheck, unitaires `apps/web`, `packages/ui`, `apps/portail/test/budgets`, e2e `tactile` en entier — Essentiel et Régression —, `perf`).
- **Non vérifié : un vrai téléphone.** Le sens de l'inclinaison dans les deux paysages est prouvé par le calcul et par des événements simulés, pas par un iPhone ni un Android. Pour l'iPhone, on suppose que `touchend`, `pointerup` ou `click` comptent comme un geste pour `requestPermission` (comportement de Safari) ; le test simule ce comportement.
- Décision laissée à Nathan : ajouter les quatre morceaux à la demande comme lignes du tableau de `budgets.md` (il faut modifier `apps/portail/test/budgets.test.ts`, zone de la plateforme) ; ils sont déjà gardés par `perf.spec.ts`.
