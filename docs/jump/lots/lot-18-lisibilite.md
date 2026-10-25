# Lot 18 — Lisibilité des éléments à horloge (DailyJump)

Retours de Nathan après avoir joué : **nuit** — les plateformes qui clignotent changent trop vite et l'indicateur qui annonce la disparition arrive presque au moment où elle disparaît ; **forêt** — les feuilles des rafales bougent puis s'arrêtent net. Principe posé : **un élément à horloge annonce chacun de ses changements d'état, assez tôt, par un signe continu et simple ; jamais de clignotement rapide (rien au-dessus de 3 Hz, par lisibilité et pour la sécurité des personnes photosensibles) ; l'affichage ne ment jamais.**

Versions : `JUMP_GENERATOR_VERSION` **13** (identifiants `…-g13`) · `JUMP_SIM_VERSION` **4, inchangée** (aucune ligne de la physique, de `level.ts`, `attempt.ts`, `player.ts` ni `replay.ts` n'a bougé ; la force du vent de la simulation non plus) · **golden v3 identiques** (`golden.json`, `replay-golden.json`, `daily-golden.json`, `golden-daily.test.ts` côté v3 : aucun octet de modifié) · golden v4 régénérés (le tirage de la nuit change). Consignes ajoutées : `apps/jump/CLAUDE.md` (« Annonce des éléments à horloge (lot 18) »), `packages/jump-sim/CLAUDE.md` (« Rythme de la nuit (lot 18) »).

## 1. Affichage (`apps/jump`, tous les jours, v3 compris)

L'annonce se calcule à partir de la fonction de l'horloge (`announce.ts`, pur : `blinkPhase`, `gustPhase`) : elle connaît l'avenir de façon exacte et déterministe, et le dessin la lit sur le même état que la simulation.

### Durées retenues
| annonce | durée | réglage `?debug&tune` (section « Caméra et secousses ») |
|---|---|---|
| disparition d'un bloc clignotant : la face se vide | **0,6 s** (72 pas) | « Annonce : disparition d'un bloc clignotant » (`vanish`, 0,1 à 1,5 s) |
| réapparition : le contour pointillé se remplit | **0,4 s** (48 pas) | « … réapparition … » (`appear`) |
| début d'une rafale : les feuilles frémissent | **0,4 s** (48 pas) | « … début d'une rafale … » (`gustLead`, 0 à 1,5 s) |
| fin d'une rafale : les feuilles ralentissent | **0,4 s** (48 pas) | « … fin d'une rafale … » (`gustTail`) |

Si une phase est plus courte que l'annonce, **l'annonce couvre au plus la moitié de la phase** (`announceWindow`). Le carnage lisible (35 %, lot 17) s'applique toujours (face, contour, trait de niveau, feuilles, flèches). Les quatre curseurs sont mémorisés dans `jump:camera` comme les autres réglages de la section (`smoke.spec.ts` : 42 curseurs au lieu de 38).

### Nuit, blocs clignotants
- **Plein** : pendant les 0,6 dernières secondes de la phase présente, **la face se vide comme une jauge qui descend** (elle part du bas du bloc ; un trait clair marque le niveau) et finit **vide pile au pas de la disparition**. Le contour reste plein et franc : le bloc est solide jusqu'au pas où il disparaît. Pas de scintillement.
- **Absent** : le bloc reste visible en **contour pointillé discret** (cinq tirets par côté). Pendant les 0,4 s avant son retour, **ce contour se remplit** (remplissage translucide à 40 % — il n'est pas encore là —, contour qui se renforce) et la jauge est **pleine pile au pas de la réapparition**.
- La jauge vaut `pas restants / (fenêtre + 1)` : l'annonce compte exactement 72 (ou 48) pas, tous strictement entre 0 et 1, sans va-et-vient. Un bloc qui attend la sortie du personnage garde son contour épais, sans face. Les blocs alternés du néon ne changent pas.
- Couleurs : celles du bloc (bleu-violet de la charte, teinte à ≥ 30° du rouge des dangers et du jaune du personnage), **jamais le rouge**. **Retiré** : l'ancien vacillement (la face qui clignotait de 7 à 16 Hz pendant 0,25 s) et son repli « mouvement réduit » ; la jauge est la même avec ou sans mouvement réduit, puisque rien ne clignote.
- L'événement `blocVacille` (deux étincelles) part maintenant au début de l'annonce de la disparition (0,6 s avant ; au plus la moitié de la phase).

### Forêt, rafales
- Les feuilles **frémissent** environ 0,4 s avant le début (amplitude croissante, 2,9 Hz : `WIND_TREMBLE_RAD`), vont à **pleine vitesse** pendant la rafale, **ralentissent pendant les 0,4 s qui précèdent la fin** (vitesse proportionnelle aux pas restants) et sont **à l'arrêt exactement quand la rafale cesse** : l'ondulation et la rotation des feuilles sont cumulées au rythme du flux, donc elles s'arrêtent avec lui. Hors rafale il n'y a plus de dérive lente (`WIND_FLOAT` retirée).
- **Même logique pour les flèches du mouvement réduit** : éteintes, elles s'éclaircissent avant le début, sont allumées pendant la rafale, s'éteignent peu à peu avant la fin (éteintes pile au pas où elle cesse).
- **La force du vent dans la simulation ne change pas** (`windBlows` reste l'interrupteur de la simulation ; l'annonce n'est qu'un dessin).

### Tests
- `apps/jump/test/annonce.test.ts` (nouveau, 19 tests) : jauge pleine hors annonce ; **vide pile au pas de la disparition** ; **pleine pile à la réapparition** ; annonce de 72 et 48 pas exactement et monotone ; moitié de phase ; dessin = jauge de la simulation, opaque et à contour plein pour un bloc plein, pointillé et au plus translucide pour un absent ; identique avec ou sans mouvement réduit ; **feuilles à l'arrêt exactement quand la rafale cesse** (position des particules, pas à pas, pleine vitesse puis ralenti strictement décroissant) ; flèches ; **aucun clignotement au-dessus de 3 Hz** (maxima locaux par seconde de la jauge, des opacités dessinées, de la vitesse et des flèches ≤ 3, et garde-fou sur les sources : tout `sin(clock * …)` reste sous 3 Hz, aucune bascule `floor(clock * …) % 2`) ; curseurs de `?debug&tune`.
- `blocks.test.ts`, `vent.test.ts` adaptés ; e2e `nuit-neon.spec.ts` (la jauge dessinée = celle de la simulation, identique avec ou sans mouvement réduit, contour pointillé) et `foret.spec.ts` (dans la vraie page : pleine vitesse, 10/49 de la vitesse dix pas avant la fin, 1/49 au dernier pas, 0 pile au pas où elle cesse ; flèches).
- Captures (outil, `CAPTURES=1 npx playwright test captures-lot-18 --project=chromium` dans `apps/jump`) : `img/lot-18-nuit-*.png` (jauge pleine, à moitié, presque vide, absent pointillé, contour qui se remplit, presque plein, plein) et `img/lot-18-foret-*.png`.

## 2. Rythme de la nuit (générateur g13)

### La règle et la liste avant toute régénération
**Chaque phase d'un bloc clignotant, présente ou absente, dure au moins 1,5 s (180 pas, `BLINK_PHASE_MIN`)** : `solide ≥ 180` et `cycle − solide ≥ 180`, donc un cycle d'au moins 360. `npm run rythme:modules -w @cdj/jump-sim` liste les variantes à clignotants (outil nouveau, lancé **avant** de rien toucher) : **32 variantes ont des clignotants, 31 sont refusées** (toutes sauf `nuit-opposition` v5, déjà à 360 / 180 / 180) — les sept morceaux `nuit-*` et les variantes mutées `+clignotant:lent` de `marelle` et `piliers` (le profil `lent` a 144 pas d'absence). `blinkTooFast()` en tire la liste **sur les textes des morceaux** (rien à tenir à jour) ; le catalogue v4 ne les pose jamais, le catalogue v3 les connaît telles quelles.

### Méthode du lot 17 appliquée
Chaque refusée **garde son texte, sa place, sa grille et ses solutions** ; une **remplaçante plus lente** est ajoutée au bout de la liste (`V4_ONLY_VARIANTS`), passe `solve:modules`, `phases:modules` (toutes phases, attente ≤ 12 s), la règle du lot 8c (gigue ±3 ≥ 50 %, appuis humains) et `voies:modules`. Le profil de mutateur `lent` est doublé de `calme` (cycle 396, présent 216, absent 180). Présent / absent en pas, « note » = exigence (1 à 5) :

| variante refusée | texte | cycle · décalage | présent / absent (pas) | note | remplaçante ajoutée | cycle · décalage | présent / absent (pas) | note |
|---|---|---|---|---|---|---|---|---|
| marelle v5 | `ecart=1 +clignotant:lent` | 360 · 0 | 216 / 144 | 2 | v6 `ecart=1 +clignotant:calme` | 396 · 0 | 216 / 180 | 1 |
| nuit-cheminee v0 | `large=2 cycle=360 sol.=240 déc.=0` | 360 · 0 | 240 / 120 | 1 | v4 `large=2 cycle=420 sol.=240 déc.=0` | 420 · 0 | 240 / 180 | 2 |
| nuit-cheminee v1 | `large=2 cycle=300 sol.=180 déc.=0` | 300 · 0 | 180 / 120 | 1 | v5 `large=2 cycle=360 sol.=180 déc.=0` | 360 · 0 | 180 / 180 | 1 |
| nuit-cheminee v2 | `large=2 cycle=330 sol.=200 déc.=150` | 330 · 150 | 200 / 130 | 1 | v6 `large=2 cycle=380 sol.=200 déc.=150` | 380 · 150 | 200 / 180 | 5 |
| nuit-cheminee v3 | `large=1 cycle=300 sol.=200 déc.=0` | 300 · 0 | 200 / 100 | 4 | v7 `large=1 cycle=380 sol.=200 déc.=0` | 380 · 0 | 200 / 180 | 4 |
| nuit-escalier v0 | `cycle=280 sol.=140 déc.=0` | 280 · 0 | 140 / 140 | 1 | v4 `cycle=360 sol.=180 déc.=0` | 360 · 0 | 180 / 180 | 1 |
| nuit-escalier v1 | `cycle=240 sol.=120 déc.=120` | 240 · 120 | 120 / 120 | 2 | v5 `cycle=360 sol.=180 déc.=120` | 360 · 120 | 180 / 180 | 1 |
| nuit-escalier v2 | `cycle=200 sol.=100 déc.=0` | 200 · 0 | 100 / 100 | 3 | v6 `cycle=420 sol.=210 déc.=0` | 420 · 0 | 210 / 210 | 2 |
| nuit-escalier v3 | `cycle=300 sol.=150 déc.=40` | 300 · 40 | 150 / 150 | 3 | v7 `cycle=360 sol.=180 déc.=40` | 360 · 40 | 180 / 180 | 2 |
| nuit-marelle v0 | `paires=1 cycle=300 sol.=150 déc.=0` | 300 · 0 | 150 / 150 | 2 | v4 `paires=1 cycle=400 sol.=200 déc.=0` | 400 · 0 | 200 / 200 | 2 |
| nuit-marelle v1 | `paires=1 cycle=360 sol.=190 déc.=0` | 360 · 0 | 190 / 170 | 2 | v5 `paires=1 cycle=400 sol.=210 déc.=0` | 400 · 0 | 210 / 190 | 1 |
| nuit-marelle v2 | `paires=1 cycle=330 sol.=170 déc.=40` | 330 · 40 | 170 / 160 | 1 | v6 `paires=1 cycle=360 sol.=180 déc.=40` | 360 · 40 | 180 / 180 | 1 |
| nuit-marelle v3 | `paires=1 cycle=270 sol.=140 déc.=0` | 270 · 0 | 140 / 130 | 1 | v7 `paires=1 cycle=420 sol.=210 déc.=0` | 420 · 0 | 210 / 210 | 1 |
| nuit-opposition v0 | `paires=1 cycle=240 sol.=120 déc.=0` | 240 · 0 | 120 / 120 | 1 | v6 `paires=1 cycle=390 sol.=180 déc.=0` | 390 · 0 | 180 / 210 | 4 |
| nuit-opposition v1 | `paires=1 cycle=200 sol.=100 déc.=0` | 200 · 0 | 100 / 100 | 1 | v7 `paires=1 cycle=420 sol.=210 déc.=0` | 420 · 0 | 210 / 210 | 3 |
| nuit-opposition v2 | `paires=2 cycle=220 sol.=110 déc.=0` | 220 · 0 | 110 / 110 | 4 | v8 `paires=2 cycle=380 sol.=190 déc.=0` | 380 · 0 | 190 / 190 | 4 |
| nuit-opposition v3 | `paires=1 cycle=300 sol.=160 déc.=170` | 300 · 170 | 160 / 140 | 4 | v9 `paires=1 cycle=360 sol.=180 déc.=170` | 360 · 170 | 180 / 180 | 3 |
| nuit-opposition v4 | `paires=2 cycle=300 sol.=150 déc.=0` | 300 · 0 | 150 / 150 | 5 | v5 (lot 17) `paires=2 cycle=360 sol.=180 déc.=0` | 360 · 0 | 180 / 180 | 4 |
| nuit-pont v0 | `long=9 cycle=300 sol.=210 déc.=0` | 300 · 0 | 210 / 90 | 1 | v5 `long=9 cycle=390 sol.=210 déc.=0` | 390 · 0 | 210 / 180 | 1 |
| nuit-pont v1 | `long=9 cycle=300 sol.=210 déc.=240` | 300 · 240 | 210 / 90 | 1 | v6 `long=9 cycle=390 sol.=210 déc.=240` | 390 · 240 | 210 / 180 | 1 |
| nuit-pont v2 | `long=10 cycle=270 sol.=140 déc.=0` | 270 · 0 | 140 / 130 | 1 | v7 `long=10 cycle=360 sol.=180 déc.=0` | 360 · 0 | 180 / 180 | 1 |
| nuit-pont v3 | `long=11 cycle=330 sol.=170 déc.=250` | 330 · 250 | 170 / 160 | 1 | v8 `long=11 cycle=360 sol.=180 déc.=250` | 360 · 250 | 180 / 180 | 2 |
| nuit-pont v4 | `long=12 cycle=300 sol.=150 déc.=180` | 300 · 180 | 150 / 150 | 3 | v9 `long=12 cycle=360 sol.=180 déc.=180` | 360 · 180 | 180 / 180 | 3 |
| nuit-portes v0 | `cycle=240 sol.=120 déc.=0` | 240 · 0 | 120 / 120 | 5 | v4 `cycle=360 sol.=180 déc.=0` | 360 · 0 | 180 / 180 | 4 |
| nuit-portes v1 | `cycle=240 sol.=120 déc.=60` | 240 · 60 | 120 / 120 | 2 | v5 `cycle=360 sol.=180 déc.=60` | 360 · 60 | 180 / 180 | 5 |
| nuit-portes v2 | `cycle=200 sol.=100 déc.=0` | 200 · 0 | 100 / 100 | 4 | v6 `cycle=380 sol.=190 déc.=0` | 380 · 0 | 190 / 190 | 3 |
| nuit-portes v3 | `cycle=300 sol.=170 déc.=100` | 300 · 100 | 170 / 130 | 2 | v7 `cycle=360 sol.=180 déc.=100` | 360 · 100 | 180 / 180 | 4 |
| nuit-relais v0 | `paires=2 cycle=300 sol.=180 déc.=270` | 300 · 270 | 180 / 120 | 2 | v3 `paires=2 cycle=360 sol.=180 déc.=270` | 360 · 270 | 180 / 180 | 5 |
| nuit-relais v1 | `paires=2 cycle=330 sol.=200 déc.=300` | 330 · 300 | 200 / 130 | 2 | **aucune** (voir ci-dessous) | | | |
| nuit-relais v2 | `paires=2 cycle=300 sol.=160 déc.=270` | 300 · 270 | 160 / 140 | 5 | v5 `paires=2 cycle=420 sol.=210 déc.=270` | 420 · 270 | 210 / 210 | 4 |
| piliers v5 | `ecart=1 +clignotant:lent` | 360 · 0 | 216 / 144 | 1 | v6 `ecart=1 +clignotant:calme` | 396 · 0 | 216 / 180 | 2 |

**Verdicts** : les 30 remplaçantes ont des solutions jouables aux deux entrées (arrêt et élan), passent la validation toutes phases (8 phases chacune, attente ≤ 12 s), n'ont aucune voie parasite (`PARASITE_CLOSED` reste vide) et **tiennent les règles générales du catalogue** que les tests appliquent à toute variante : exigence 1 à 5 (≤ 2 pour la respiration `nuit-marelle`), solutions de 1 à 6 s, gigue ±3 ≥ 50 %, raccord ≥ 90 %.

**Essais écartés, sans relâcher aucune règle** (la candidate d'un test qui échoue reste dehors et on essaie la suivante, à indice de variante égal — les solutions en dépendent) :
- `nuit-marelle` (respiration : exigence ≤ 2) v4 : 360 / 180 (note 5), 390 / 180 (3 et 5) et 390 / 210 (3) refusées → **400 / 200** retenue (2) ; v5 : 370 / 190 (3) et 380 / 190 (3) refusées → **400 / 210** retenue (1).
- `nuit-opposition` v8 : 420 / 210 (solution de 769 pas), 390 / 180 (743) et 400 / 200 (736) dépassent les 720 pas permis (6 s) → **380 / 190** retenue ; `nuit-portes` v6 : 420 / 210 (763 pas), 390 / 200 (721) et 400 / 200 (732) refusées → **380 / 190** retenue (un cycle plus lent allonge la solution au-delà des 6 s) ; `nuit-opposition` v6 : 360 / 180 refusée par la validation toutes phases (phase 90 sur 360) → **390 / 180** retenue.
- **`nuit-relais` v1 n'a pas de remplaçante plus lente** : 17 cycles essayés (de 380 à 480 pas, présent de 200 à 300, décalages 240 à 330) sont fermés par une voie parasite (380 / 200, note 5 : détour de 7,40 s), « au pas près » pour le solveur (note 0 : injouable pour un humain), refusés par la validation toutes phases (440 / 200 : phases 110 à 330 ; 450 / 210 ; 480 / 300 : phases 300, 360 et 420), ou ont des solutions de plus de 6 s. Le morceau reçoit à la place **une variante en plus** (v4, `paires=2 cycle=360 solide=180 decalage=330`, note 3), qui passe tout ; ce n'est pas une remplaçante (son présent, 180 pas, est plus court que les 200 de v1). `nuit-relais` garde trois variantes utilisables (v3, v4, v5) au lieu de trois d'origine.
- **`MAX_VARIANTS` monte de 7 à 10** (signalé : `nuit-opposition` et `nuit-pont` ont 10 variantes ; les deux tests qui le disaient — `modules.test.ts`, `themes.test.ts` — lisent la constante).

### Secours et générateur
- **Secours de la nuit** rechoisi (`secours:modules -- --theme=nuit` : 80 niveaux valides sur 80 dates, retenu le 28/09/2027, 29,92 s, exigence 501) ; l'ancien reste pour la référence v3 (`FALLBACK_NUIT_V3`). Test : aucune variante refusée dans le secours.
- **Golden** : v3 identiques ; `daily-golden-v4.json` et `replay-golden-v4.json` régénérés. La journée de référence des rediffusions passe **du 25/10 au 31/10** (une nuit aussi) : le 25/10 en g13 n'a, parmi les 24 essais fictifs, aucune mort avant le premier point de passage, et le test exige de couvrir « reprise au départ » (couverture inchangée, 28 vies reprises au départ le 31/10).
- Démonstration `?api=demo` régénérée (`npm run jump:seed -w @cdj/api`, 15 jours).

### Mesures : g12 contre g13 (`npm run measure:jump`, 120 dates du 16/10/2026 au 12/02/2027, même machine, g12 mesuré sur `main`)
| mesure | g12 | g13 |
|---|---|---|
| tirages essayés | 800 | 780 |
| composés (sans impasse) | 541 (67,6 %) | 530 (67,9 %) |
| **tirages validés** | **263 (32,9 %)** · 48,6 % des composés | **261 (33,5 %)** · 49,2 % des composés |
| **niveau de secours utilisé** | **0** | **0** |
| temps de l'auteur (min · moyenne · max) | 27,98 · 29,41 · 31,04 s | 28,08 · 29,40 · 31,93 s |
| voies lentes par niveau · cages montées | 1 · 2,0 · 3 · 33 sur 240 | 1 · 2,0 · 3 · 35 sur 245 |
| surcoût d'une voie lente (min · moyenne · max) | 3,19 · 4,54 · 7,42 s | 3,19 · 4,51 · 7,42 s |
| « toutes voies lentes » ÷ auteur | 1,125 · 1,309 · 1,564 | 1,118 · 1,313 · 1,564 |
| exigence par minute · bronze relevé au-dessus de ×1,60 | 495,5 · 10 niveaux | 495,4 · 9 niveaux |
| hauteur (moyenne) · largeur (moyenne) | 48,4 · 285,3 | 48,1 · 284,9 |
| plus longue course au sol sans saut (moyenne · max) | 1,14 · 1,84 s | 1,12 · 1,80 s |
| morceaux en commun entre deux jours consécutifs (moyenne · max) | 0,64 · 2 | 0,61 · 3 |
| **thème nuit** : jours · tirages validés · secours | 27 · 28,9 % · 0 | 27 · **31,0 %** · 0 |
| thème nuit forcé (12 dates) : tirages validés · des composés | 25,6 % · 38,5 % | 24,7 % · 44,7 % |
| autres thèmes (forêt 34,7 %, usine 20,3 %, glace 35,3 %, néon 45,4 %) | — | **identiques** (aucun niveau ne change) |

**Pas d'effet de bord hors de la nuit** : le taux de tirages validés ne bouge pas (33 %) et les secours restent à 0 partout, thème forcé compris. Les nuits sont un peu plus faciles à composer (31,0 % contre 28,9 %), la nuit forcée un peu moins (24,7 % contre 25,6 %, sur 12 dates seulement).

## 3. Jours régénérés
**Aucun jour public ni figé n'est touché.** Les fichiers figés du dépôt (`apps/jump/public/levels/`) s'arrêtent au **23/10/2026** (g9, v3) : intacts. **Sur les 120 dates mesurées à partir du 24/10, 27 niveaux changent — tous des nuits ; les 93 autres (forêt, usine, glace, néon) sont identiques**, au bit près (sauf l'identifiant `-g13`) :

`2026-10-25` · `10-31` · `11-09` · `11-24` · `11-27` · `11-29` · `12-01` · `12-15` · `12-17` · `12-26` · `12-28` · `12-30` · `2027-01-01` · `01-03` · `01-05` · `01-12` · `01-15` · `01-19` · `01-21` · `01-23` · `01-28` · `01-30` · `02-02` · `02-08` · `02-12` · `02-14` · `02-18`.

Les jours g13 commencent à **J + 2 de la PR** (ouverte le 25/10 : le 27/10). **Attention au 25/10** (nuit) : dans le dépôt il n'est **pas** un fichier figé (les fichiers s'arrêtent au 23/10) ; il change de niveau avec ce lot (temps de l'auteur 30,733 s → 29,308 s). C'est la mise en production qui le fige, avec le code de l'étiquette précédente (g12), **avant** de déployer ce lot (`freeze:days -- demain`, `CLAUDE.md` racine) : si cette étape a déjà eu lieu pour le 25/10 (c'est ce que dit Nathan), il reste en g12 en production ; sinon, il passerait en g13 le jour même. **Le premier jour de nuit g13 « réel » est le 31/10** (29,058 s → 28,600 s) ; les 26/10 (glace) et 27/10 (forêt) sont identiques.

## 4. Budget de poids (`docs/plateforme/budgets.md`)
**Jump : −1 095 o** (377 003 → 375 908 o, marge 1 487 → 2 582 o), dans son budget sans relèvement. Le lot ajoute **+1 472 o de code** (l'annonce) et **+4 479 o de catalogue** (30 variantes de remplacement, deux copies : fichier principal et fil de travail du générateur), puis **retire 7 044 o** : le catalogue embarqué perd l'empreinte de la grille de chaque variante (`grid`, 8 caractères hexadécimaux incompressibles par variante, que personne ne lit à l'exécution). La péremption d'une solution se vérifie toujours, sur `modules/solutions.json` (qui garde `grid`) : le test exige que le catalogue embarqué en soit **exactement la projection** et compare chaque solution à la grille construite (`modules.test.ts`). Essayé puis écarté : sortir le panneau `?debug&tune` du fichier principal (−3 683 o) — plus nécessaire.

## 5. CI et vérifications
- **Vérifié en local** : `npm run typecheck` ; Vitest (projet SQLite) de tout le dépôt (voir la fin) ; `npm run traductions -- --verifier` (aucune chaîne de catalogue ne change : les réglages de `?debug&tune` sont un outil en français, exempté) ; construction et poids (`scripts/budgets.mjs`) ; e2e Chromium de `apps/jump` en entier (159 réussis, 19 sautés — outils de mesure et de capture —, 1 échec préexistant sur `main` aussi : voir § 6) ; captures lues à l'œil (jauge, contour pointillé, feuilles).
- **Non vérifié en local** : Firefox et WebKit, le projet de tests d'API sur libSQL (pas de `sqld`), le rendu sur un vrai GPU ou un téléphone ; la CI complète les lance (commit `[ci complet]` avant la fusion, consigne de `apps/jump/CLAUDE.md`, « Tests e2e et CI »).

## 6. Décisions et points ouverts pour Nathan
1. **`nuit-relais` v1 sans remplaçante plus lente** (§ 2) : à confirmer ; une variante en plus (v4) la compense.
2. **`MAX_VARIANTS` 7 → 10** (l'alternative était de ne pas remplacer toutes les variantes ; la consigne disait de le monter en le signalant).
3. **Le 25/10 n'est pas figé dans le dépôt** (§ 3) : le scénario « 25/10 sur l'ancien rythme » ne marche que s'il l'est déjà en production ; sur un aperçu de cette PR, le 25/10 est un niveau g13. Pour voir la nouvelle annonce sur l'ancien rythme avec certitude : les nuits figées du **18/10** et du **22/10** (g9, v3).
4. **`apps/jump/e2e/profil-commun.spec.ts` (zone plateforme) échoue dans la suite e2e complète en local, comme sur `main`** : la requête `GET /api/jump/me` de l'appareil B ne répond pas dans les 8 s du client (`error: "0:network"`). Mesuré : `main` seul, 6 réussis sur 6 ; `main` dans la suite complète : **1 échec (ce test), 158 réussis** ; ce lot dans la suite complète : le même échec, 159 réussis ; ce lot seul, 7 échecs sur une vingtaine d'essais pendant que la machine était chargée, 0 sur les 11 derniers à froid. Donc **préexistant et lié à la charge**, non corrigé (hors zone, règle d'arrêt : on le signale) ; à surveiller dans la CI complète.
5. **Journée de référence du déterminisme v4** : du 25/10 au 31/10 (§ 2).
6. La calibration (longueur, difficulté, médailles, taux de tirages à 33 %) reste pour le **lot 19** ; questions des lots 15 à 17 toujours ouvertes (voies parasites, joueurs fictifs v4 qui reprennent mal après une mort, durée du « Prêt… »).

## 7. Scénario en 2 clics
*(Les liens de l'aperçu sont donnés dans la PR.)*
- **Un jour de nuit g13** (rythme ralenti et nouvelle annonce) : `…/jump/?seed=2026-10-31` puis `…&debug&tune` (curseurs d'annonce) — première nuit g13 réelle.
- **Le 25/10** : `…/jump/?seed=2026-10-25` (voir la réserve du § 3) ; **nuit figée en g9, ancien rythme et nouvelle annonce** : `…/jump/?seed=2026-10-22`.
- **Un jour de forêt à rafales** : `…/jump/?seed=2026-10-27` (ou `?seed=2026-10-24`) ; pour le mouvement réduit (flèches), activer « mouvement réduit » dans le système ou les Réglages.
