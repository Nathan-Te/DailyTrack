# Lot I4b (plateforme, phase 3, retouche) — Track : on reste dans le jeu

Le lot I5 a posé la règle de Nathan : **« quand on entre dans un jeu, on y reste tant qu'on ne choisit pas de le quitter »** ; Jump l'applique. Ce lot aligne Track : plus aucun écran de Track n'est une page crème qui remplace la scène. Charte : `docs/plateforme/identite.md` **révision 8** (jointe au brief, placée telle quelle : § 9). Consignes : `apps/web/CLAUDE.md` (« On reste dans le jeu (lot I4b) »), `packages/ui/CLAUDE.md` (`creerCadre`), `apps/jump/CLAUDE.md` (renvoi).

Aucun changement de `packages/sim`, `packages/jump-sim`, `packages/core`, du rendu 3D, de la conduite, du générateur, du Salon (règles) ni des classements : **golden inchangés**. **Aucune dépendance ajoutée.** Le contenu de chaque écran ne change pas (mêmes éléments, mêmes identifiants, mêmes textes : aucune clé de catalogue de Track ou de Jump ajoutée ni retirée).

## 1. Écrans déplacés
| Écran | Avant (lot I4) | Après (lot I4b) |
|---|---|---|
| **Arrivée** du circuit du jour `#finish` | cadre crème pleine page, « Jeu suivant du jour » sur le crème sous l'étiquette | **sur la scène** sous le voile à rayures, barre « ‹ DU JOUR » en plaque crème ; « Il te reste aujourd'hui » et « Jeu suivant du jour » / « Journée parfaite ! » **sous l'étiquette**, sur la plaque crème du pied du cadre (`.cadre__pied`) ; les plaques et boutons de la course s'effacent dessous |
| **Arrivée du Salon** et de la rediffusion (même `#finish`) | cadre crème | sur la scène, comme l'arrivée du jour |
| **Podium** du Salon `#podium` | cadre crème | sur la scène, **sous-écran** : l'arrivée de la session s'efface dessous |
| **Classement du jour** `#board-screen` | cadre crème, « ‹ TRACK » | sur la scène, sous-écran (l'accueil s'efface), « ‹ TRACK » ou Échap |
| **Archives** `#archive` | cadre crème, « ‹ TRACK » | sur la scène, sous-écran, « ‹ TRACK » ou Échap |
| **Réglages** `#settings` | cadre crème au-dessus des autres | sur la scène, sous-écran (l'accueil ou la **pause** s'efface dessous), « ‹ TRACK » ou Échap |
| **« Comment jouer »** `#howto` | dialogue sur le voile (depuis la retouche 2 du lot I4) | inchangé dans sa forme (dialogue, comme `#help` de Jump) ; **un seul voile** : l'accueil, la pause ou les réglages s'effacent dessous (avant, le voile de l'aide se posait sur celui de l'accueil) |
| **Accueil** `#home` | déjà sur la scène (retour de Nathan au lot I4), règles propres à `#home` | même rendu, par le cadre commun (les règles propres à `#home` sont devenues celles de tous les cadres) |
| **Pause** `#pause` | dialogue sur le voile | inchangée ; son voile prend le motif des cadres ; elle s'efface sous les réglages, l'aide et les archives |

**Un seul voile** (`apps/web/src/interface.css`, `packages/ui/src/cadre.css`) : un écran ouvert efface les plaques et les boutons de la course (tout sauf la scène, ses effets de rendu, les écrans et les dialogues) ; un sous-écran (`haut: true` → `.cadre--haut` : archives, classement, réglages, podium) efface aussi la pause et l'écran du dessous ; « Comment jouer » efface tout ce qu'il recouvre. **Échap** ferme l'écran du dessus (`onEscape`, `main.ts`, inchangé : aide, réglages, archives, classement, puis la pause) ; « ‹ TRACK » de même au doigt.

**Portes de sortie** (des choix du joueur) : « ‹ DU JOUR » (barre de l'accueil, de l'arrivée, du podium ; « ‹ DU JOUR » de la pause), « Jeu suivant du jour », « Mon profil Du Jour › », « Mentions légales ».

**Défilement** : l'étiquette Track se resserre à la hauteur de l'écran et c'est **son corps** qui défile (comme au lot I4 : « Courir » reste collé en bas de l'accueil) ; le pied reste visible sous l'étiquette. En paysage (≤ 520 px de haut) le cadre se resserre (marges de 6 px).

## 2. Mise en commun du cadre
Le mode scène de `creerCadre` existait en **deux copies** (`apps/jump/src/cadre.ts` avec `scene: true` ; l'accueil de Track avec ses propres règles `#home`). Il est **remonté dans `@cdj/ui`** :
- `packages/ui/src/cadre.ts` — `creerCadre({ racine?, id?, etiquette, haut?, barre(), aria() })` → `{ racine, etiquette, corps, pied, defile, majBarre }` : un `.cadre` (`role="dialog"`, `aria-modal`) avec la barre des jeux donnée par le jeu, `.cadre__defile` (l'étiquette `main` aux classes du jeu, puis le pied `.cadre__pied`). Exporté par `@cdj/ui`.
- `packages/ui/src/cadre.css` — voile à rayures (`--cadre-voile`, encre par défaut), barre en plaque crème, défilement sans barre visible, pied en plaque crème caché tant qu'il n'a rien de visible, et la règle « un sous-écran efface les autres cadres ». **Pas dans `styles.css`** : le portail ne la charge pas (son poids ne bouge pas) ; chaque jeu l'importe (`main.ts`, `boot.ts`) et règle `--cadre-voile`, `--cadre-largeur`, `--z-cadre`, `--z-cadre-haut`.
- **Track** : `apps/web/src/cadre.ts` ne fait plus qu'envelopper le socle (barre de Track « ‹ DU JOUR » / « ‹ TRACK », étiquette `etiquette dj-sombre`, langue, jour, un cadre par élément) ; plus aucune règle de cadre crème.
- **Jump** : `apps/jump/src/cadre.ts` de même (barre de Jump, étiquette jaune posée dans sa coque moutarde) ; l'option `scene` disparaît (tous ses cadres étaient déjà sur la scène) ; `interface.css` perd ses règles de cadre (≈ 80 lignes) et garde son réglage (`--cadre-largeur: 760px`, couches, `.cadre--arrivee`, accueil et pause effacés sous un cadre).
- **Vitrine `/ui/`** : section « Écran posé sur la scène d'un jeu » (Track puis Jump, en français et en anglais), dans une boîte qui figure la scène (`apps/portail/src/vitrine.ts`, `vitrine.css`, trois clés de `catalogueVitrine.ts`).
- Test du socle : `jetons.test.ts` vérifie aussi `cadre.ts` (aucune couleur ni police en dur) ; `cadre.css` est vérifiée comme toutes les feuilles du socle.

## 3. Budget (gzip, construction locale ; même mesure que `e2e/perf.spec.ts` de Track et `e2e/poids.spec.ts` de Jump)
| | `main` (`234efa0`) | après le lot | budget |
|---|---|---|---|
| **Track** JS du premier chargement | 272 033 o | 272 142 o (+109) | < 274 000 o |
| **Track** CSS | 11 218 o | 11 223 o (+5) | — |
| **Track JS + CSS** | **283 251 o** (marge **849 o**) | **283 365 o** (+114 o, marge **735 o**) | < 284 100 o (**inchangé**) |
| Track hors three.js | 139 267 o | 139 376 o | < 141 000 o |
| **Jump JS + CSS** | **375 131 o** (marge 3 359 o) | **375 298 o** (+167 o, marge 3 192 o) | ≤ 378 490 o (**inchangé**) |
| Portail | — | inchangé (`cadre.css` hors de `styles.css`) | — |

Note sur la marge : le brief parle de 1,4 ko (mesure du lot I4) ; mesurée sur `main` au début de ce lot elle n'était plus que de **849 o** (le lot I5 a fait passer le compte à rebours de Track par `formatDecompte` du socle).

**Le budget n'est pas relevé et le lot y tient.** Mais **la mise en commun ne rend pas d'octets à Track** : chaque jeu est construit à part et embarque sa propre copie du socle (`@cdj/ui` n'est pas un fichier partagé entre les jeux) ; remonter `creerCadre` déplace le code, il ne l'enlève d'aucun des deux paquets. Ce qui coûte (≈ +110 o à Track) : le pied du cadre et son élément de défilement, l'enveloppe du socle (barre et nom de l'écran passés en fonctions), et la règle « un seul voile ». Pour le compenser en partie, j'ai retiré du CSS de Track des règles mortes (classes que plus aucun code ne pose : `.hud-statique`, `.message--erreur`, `.message--ok`, `.separateur`, `.ligne__action`), les règles propres au cadre crème et à `#home` (devenues celles du socle), et fondu la livrée des dialogues dans celle de l'étiquette.

## 4. Tests
- **Nouveau** `apps/web/e2e/scene.spec.ts` (ajouté à `durees.json`, 30 s estimées) : en **paysage 844 × 390 et 740 × 360, portrait 390 × 844, ordinateur 1280 × 720** (police large de la CI) — l'accueil, le classement, les archives et les réglages sont **sur la scène** (fond = le voile à rayures, aucun aplat crème, barre en plaque crème, la scène 3D visible), **un seul voile** (l'accueil s'efface sous chaque sous-écran et sous « Comment jouer » ; la pause et les plaques de course sous les réglages ouverts en course), barre, étiquette et pied **ne se chevauchent pas** et tiennent dans l'écran, chaque bouton et lien visible fait **44 px** ; **Échap** (au clavier) ou **« ‹ TRACK »** (au doigt) ramène à l'accueil, Échap ferme les réglages et rend la pause.
- `apps/web/e2e/mobile.spec.ts` (quatre formats de téléphone) : l'arrivée est sur la scène (voile, scène visible), `#hud-centre`, `#menu`, `#hud-droite`, `#speed`, `#touch` effacés dessous, « Jeu suivant du jour » **sous l'étiquette** ; le bloc vérifié s'appelle maintenant `#finish .cadre__pied` (au lieu de `.arrivee__pied`, qui n'existe plus : le pied est celui du cadre commun).
- `apps/web/e2e/accueil.spec.ts` (inchangé) : accueil, réglages, aide, pause en portrait, paysage, petit portrait ; Échap ferme d'abord la fenêtre du dessus.
- Captures : `apps/web/e2e/captures-lot-i4b.spec.ts` (outil, `CAPTURES=1`, ajouté à `durees.json` à 0 comme les autres).

## 5. Captures
`CAPTURES=1 npx playwright test captures-lot-i4b --project=chromium` (dans `apps/web`), Chromium, **paysage 844 × 390, portrait 390 × 844, ordinateur 1440 × 900, français et anglais**, `docs/plateforme/lots/img/lot-I4b-<écran>-<paysage|portrait|bureau>-<fr|en>.png` :
- `accueil`, `classement`, `archives`, `reglages` (depuis l'accueil), `comment-jouer` (depuis l'accueil : un seul voile), `reglages-pause` (depuis la pause en course : la pause s'efface) ;
- `arrivee` (le haut, avec « Jeu suivant du jour : Jump › » sous l'étiquette) et `arrivee-bas` (le corps défilé jusqu'en bas) ;
- `salon-arrivee` et `salon-podium` (paysage et portrait).

## 6. Écarts proposés (à trancher par Nathan)
1. **« Comment jouer » et la pause restent des dialogues** sur le voile, sans barre des jeux (comme `#help` et `#menu` de Jump, et comme le décrivait le lot I4 retouche 2) ; la charte rév. 8 § 9 parle de « barre des jeux en plaque crème » pour tous les écrans. Les mettre dans un cadre avec « ‹ TRACK » est possible (même `creerCadre`), mais ferait deux façons de fermer l'aide (« C'est parti » et « ‹ TRACK »).
2. **L'étiquette de Track n'a pas de coque** (comme son accueil depuis le lot I4) ; la charte § 9 dit « étiquette du jeu dans sa coque ». Jump a sa coque moutarde. Une coque Track (`--track-coque`) se poserait comme celle de Jump (une ligne dans `cadre.ts` de Track), au prix de ≈ 10 px de chaque côté et de quelques dizaines d'octets.
3. **Petits changements visuels dus à la mise en commun** : le voile de la pause de Track prend le motif des cadres (rayures de 5 px sur 8 au lieu de 3 sur 9) ; la livrée des dialogues est celle de l'étiquette (6 px plus large) ; dans Jump, la barre et le pied en plaque crème ont l'ombre nette de 2 px du socle (`--dj-ombre-bouton`, avant 3 px), 8 px sous la barre (avant 10) et des marges de 10 px autour du cadre (avant 12 sur les côtés).
4. **La mise en commun ne rend pas d'octets** (§ 3) : chaque jeu embarque sa copie du socle.
5. **Retours de Nathan sur téléphone** : aucun joint à cette session ; rien à traiter.

## 7. Vérifié / non vérifié
**Vérifié ici (Chromium, rendu logiciel)** :
- `npm run typecheck` ; `npx vitest run` (sqlite et libsql) : **199 fichiers / 2 655 tests verts** (jetons — dont `cadre.ts` et `cadre.css` —, contrastes, catalogues, chaînes en dur, `e2eParts` et `durees.json`, interface de Track et de Jump, golden) ; `npm run build` ; `node scripts/site.mjs site`.
- e2e Chromium de Track, lancés ici : `scene` (4/4), `mobile` (4/4), `accueil` (25/25), `hud-compact`, `salon`, `watch`, `portail`, `portail-jour`, `portail-journee`, `domaine`, `profil`, `identite-plateforme`, `tactile`, `perf`, `archive`, `classement` : **108 réussis, 1 échec** — `watch.spec.ts` › « pause, ralenti, accéléré et retour de 5 s… » (le second clic sur « −5 s » arrive après la fin de la rediffusion : barre de lecture déjà cachée). **Il échoue aussi sur `main` dans ce conteneur, 3 fois sur 3** (`--repeat-each=3`, construction de `main`) : machine locale plus rapide que la CI, rien à voir avec ce lot (hors zone : non corrigé ; la CI tranche, § 8).
- e2e Chromium de Jump : **toute la suite, 137 réussis, 13 sautés (outils, `CAPTURES` / `MESURE`), 0 échec**.
- Mesures de poids (§ 3), captures (§ 5), vues à l'œil (FR et EN, trois formats). Vu en passant, déjà là au lot I4 : en portrait anglais, « AUTOMATIC » (Réglages › Qualité) touche le bord de sa case (même rendu sur `lot-I4-reglages-portrait-en.png`).

**Non vérifié** :
- **Sur un vrai téléphone** : à valider par Nathan sur l'aperçu de la PR (scénario ci-dessous).
- Firefox et WebKit en local (non installés ici) : la CI les exécute (sous-ensemble multi-navigateurs sur la PR, tout sur `main`).

**Scénario pour Nathan (2 clics)** : (1) sur le téléphone, l'aperçu de la PR → Track → finir un tour : l'arrivée s'affiche sur la course, sous les rayures, plus de page crème ; « Jeu suivant du jour » sous l'étiquette. (2) Depuis l'accueil de Track, ouvrir Réglages puis Archives : tous deux sur la scène ; Échap ou « ‹ TRACK » ramène à l'accueil.

## 8. Runs de CI
À compléter après le push.
