# Lot T3b — Calibrage du contenu du jour

Branche `claude/vibrant-fermi-3i2x7q`, PR brouillon. Consignes : `docs/tower/consignes.md` (mises à jour : « Le tirage du contenu », paliers, médailles, rediffusion, golden, `&bot`). Tower reste `off`. `lab/` intact ; aucune version ni aucun golden de Track ou de Jump touché ; **aucun fichier de jour commité** (deux fichiers de test de plus dans `packages/tower-sim/test/fixtures/jours/`). Pour les joueurs : rien.

## Livré
- **Le tirage** : `dailyTower(jour, version, tirage = 0)`. Un tirage n décale la graine (`generateur/v3.ts`) ; le tirage 0 de la version 3 suit les mêmes règles (sa graine est décalée comme les autres : ce n'est pas le contenu de la v2). Le thème (sac commun) ne dépend pas du tirage. Les versions 1 et 2 refusent un tirage non nul.
- **La préparation** (`preparer:tower`) essaie les tirages 0, 1, 2… et garde le premier dont le Diamant est dans `PLAGE_DIAMANT_MM` = [25 m ; 60 m]. `TIRAGES_MAX` = 4 (tirages 0 à 3) ; sinon le plus proche de la plage (`choisirTirage`, pure, `tirage.ts`). L'outil signale « HORS PLAGE ».
- **Le plafond** : Diamant = `min(hauteur du bot, 60 m)` (`diamantDe`, dès g3). La preuve reste la vraie partie du bot. Garde-fou : le fichier se régénère à l'identique **au tirage écrit**, et la preuve rejouée donne la hauteur du bot dont le Diamant écrit est `min(hauteur, plafond)` (avant g3 : exactement la hauteur).
- **Le fichier du jour** gagne `tirage` (dès g3 ; le texte des g1 et g2 ne change pas). Le jeu lit le tirage dans le fichier ; sans fichier, tirage 0 (médailles provisoires, plafonnées, en production ; Web Worker hors production). **La rediffusion nomme son tirage** (genre 2 ; le tirage 0 garde l'ancienne forme octet pour octet) et ne se rejoue que sur ce tirage.
- **Paliers tous les 8 m** (8 à 48 m, `PALIERS_METRES_V3`) ; les règles de tirage des effets ne changent pas. Les hauteurs vivent dans le contenu, pas dans la simulation : **`TOWER_SIM_VERSION` reste 3**, l'ancienne règle reste rejouable (les rediffusions du lot T2 du golden nomment `g = 2`).
- **Médailles** 15 / 30 / 50 % (`MEDAILLES_VERSION` = 2, `idiv`, clé `auteur`), à recalibrer au T5 sur des parties humaines. **`TOWER_GENERATOR_VERSION` = 3** ; v1 et v2 appelables et inchangées.
- **Golden** : v1 et v2 sous `anciennes` (empreintes inchangées), v3 (dix dates, six tirages 1 à 3) et deux rediffusions de plus (`jour-v3`, `tirage-v3`) ; les trois du T2 gardées telles quelles, l'outil refuse de les réécrire.
- **`&bot` montre la partie retenue** : le worker rend la preuve de la variante gagnante à la fin du calcul (« Le bot réfléchit… » reste affichée ≈ 1 min), plus de pièces à mesure.
- **`?tirage=0..3`** (hors production, fermé en production) : le tirage d'un jour sans fichier — voir « Aperçu » ci-dessous.

## Les mesures (`mesures-t3:tower`, 4 cœurs, les mêmes 30 jours du 05/11 au 04/12/2026)
| Diamant, en mètres | minimum | quartile bas | médiane | quartile haut | maximum |
|---|---|---|---|---|---|
| **Avant** (lot T3, g2, paliers à 10 m) | 4,1 | 37,0 | 49,4 | 74,0 | 103,4 |
| g3, tirage 0 : hauteur du bot, avant sélection et plafond | 4,5 | 33,0 | 46,5 | 61,3 | 101,8 |
| g3, tirage retenu : hauteur du bot, avant plafond | 25,2 | 33,9 | 47,5 | 61,3 | 101,8 |
| **g3, Diamant servi** (après plafond) | **25,2** | 33,9 | 47,5 | 60,0 | 60,0 |

- **Tirages** : retenu t0 25 jours · t1 4 · t2 1 · t3 0 ; **1,20 bot joué par jour** (36 pour 30 jours). **Aucun jour hors plage.** Bots au-dessus du plafond : 8 jours sur 30 (Diamant = 60 m).
- **Temps de préparation** (`preparer:tower`, 4 cœurs, dossier hors dépôt) : **14 jours en 4 min 49 s** (limite 8 min ; le 17/11 a besoin de 2 essais : 136 s sur un fil). Les 30 jours : 7 min 36 s ; par jour sur un fil : médiane 43 s, pire 179 s. Un tirage mal parti coûte une minute de plus : le budget tient avec marge.
- **Joueurs simulés, sur le contenu retenu, en % du Diamant** :

| joueur | médiane | ≥ Bronze (15 %) | ≥ Argent (30 %) | ≥ Or (50 %) | Diamant | paliers vus (moyenne · médiane · à la hauteur médiane) |
|---|---|---|---|---|---|---|
| glouton du T2 | 43 % (17,4 m) | 67 % | 67 % | 40 % | 3 % | 3,9 · 4 · 3 |
| bot imparfait (le plus proche d'un humain) | 26 % (8,9 m) | 60 % | 37 % | 23 % | 3 % | 2,4 · 2 · 1 |

  *Avant* (T3, mêmes seuils appliqués aux anciennes parties) : glouton 53 / 43 / 27 %, imparfait 50 / 37 / 30 % ; médiane à 9–14 m = **un seul palier** (10 m). Les chiffres d'après ne sont pas strictement comparables : le plafond abaisse le Diamant de 8 jours sur 30 (dénominateur plus petit) et les paliers sont plus bas.
- **Estimation géométrique** (repli sans fichier), sur le tirage 0 : coefficient mesuré **165 %** (constante : 195 %), écart médian 23 % (avant : 39 %), 15 jours sur 30 à moins de 25 %.

## Aperçu : ce qu'on ne peut pas voir sans fichier (important)
Aucun fichier de jour n'est commité, donc sur l'aperçu le jeu prend le **tirage 0**. **Le 17/11 y donne 21,8 m, pas 25–60 m** : c'est justement le tirage que la préparation écarte (le tirage 1 donne 25,201 m). Pour voir le jour tel qu'il serait servi, `?tirage=1` (hors production) ; les jours dont le tirage 0 est bon (05/11 : 46,982 m) se voient tels quels.

## Vérifié / non vérifié
- **Vérifié** : `tsc -b --force` ; `npm run verifier` (typecheck, 32 fichiers de tests unitaires dont golden, jours, rediffusion, tirage, médailles ; construction ; e2e Tower Chromium : déterminisme sur les **cinq** rediffusions de référence, une partie, poids) ; tests unitaires de la règle (plage, plus proche, arrêt à `TIRAGES_MAX`), du plafond (aux bords), des médailles aux bords, des paliers à 8 m, du garde-fou étendu (fixture du 07/11 : bot à 65,9 m, Diamant 60 m ; fixture du 17/11 : tirage 1), du tirage lu dans le fichier ; **Chromium à la main** : le worker donne 25,201 m (17/11, `?tirage=1&bot`, 59 s) et 46,982 m (05/11), identiques à Node au millimètre ; `&bot` joue la partie retenue (palier de 8 m affiché).
- **Non vérifié** : Firefox et WebKit sur les deux nouvelles rediffusions (le petit ensemble `@navigateurs` de la CI le fera) ; un téléphone ; la sensation d'un humain ; la CI de la PR.
- **Budget** `tower.jsCss` : **167 956 o** (plafond 168 000 inchangé, marge **44 o**). Les ajouts (≈ +200 o) sont compensés par les deux scénarios d'essai désormais **à la demande** (`scenarios/outils.ts`), le corps du générateur partagé entre v1 et v3 et le bloc `?bot` simplifié ; net **+34 o** contre les 167 922 d'avant le lot. Le prochain lot de Tower devra alléger ou demander à Nathan.

## Questions pour Nathan
1. **La plage est jugée sur le Diamant plafonné** : un bot à 74 m donne 60 m, dans la plage, sans nouveau tirage (seul un bot sous 25 m déclenche un tirage). Juger la hauteur brute rejetterait ≈ 8 jours sur 30 de plus pour un Diamant de toute façon plafonné. Convient-il ?
2. **Sans fichier, le tirage 0** peut être mauvais (5 jours sur 30 au tirage 0 sont hors plage : 11/11 15,0 m, 17/11 21,8 m…). En production, T4 doit préparer tous les jours servis ; acceptable ?
3. **Coefficient du repli** : 195 → 165 % (mesuré) ? Je ne l'ai pas changé (le repli disparaît en pratique avec T4).
4. **`?scenario=paliers`** garde sa tour à 9 m et ses paliers à 10 m (c'est un scénario, non versionné) : l'aligner sur 8 m ?
5. **`TIRAGES_MAX` = 4** s'entend comme quatre tirages (0 à 3). Confirmé ?

## Liens de test (aperçu de la PR : `/tower/…`)
- Le jour qui ratait : `/tower/?seed=2026-11-17&tirage=1&bot` → **25,201 m** (le lien sans `&tirage=1` donne le tirage 0 : 21,8 m, voir « Aperçu »). La ligne « Le bot réfléchit… » reste ≈ 1 min.
- Jouer pour une médaille : `/tower/?seed=2026-11-05` (tirage 0 retenu, Diamant 46,982 m : Bronze 7,047 m, Argent 14,094 m, Or 23,491 m ; le premier palier est à 8 m).
