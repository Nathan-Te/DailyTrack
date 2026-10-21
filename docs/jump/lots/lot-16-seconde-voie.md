# Lot 16 — Seconde voie sur les portions dures (DailyJump)

Idée de Nathan : sur les portions les plus dures, offrir une voie plus longue mais accessible. Règles validées : seconde voie **seulement sur les portions notées 4/5 ou 5/5** ; coût d'**au moins +50 % du temps de la portion, avec un minimum de +3 s**, mesuré entre les solutions enregistrées rapide et lente ; **or** atteignable seulement par les voies rapides, **bronze** atteignable en prenant toutes les voies lentes.

Versions : `JUMP_GENERATOR_VERSION` **11** (identifiants `…-g11`) · `JUMP_SIM_VERSION` **4, inchangée** (aucune ligne de la physique, de `level.ts`, `attempt.ts`, `player.ts` ou `replay.ts` n'a bougé ; golden v3 identiques). Consignes : `packages/jump-sim/CLAUDE.md` et `apps/jump/CLAUDE.md`, « Seconde voie (lot 16) ».

## 1. Note de difficulté
Les morceaux portaient déjà une note de 1 à 5 (lot 8c) : **`exigence`**, calculée par le solveur sur la solution enregistrée de chaque entrée (`exigenceOf`, `src/modules.ts`) :
- chaque changement de commande est décalé au hasard de ±1, ±2, ±3 pas (200 tirages chacun, graine fixe), les appuis rendus humains (appui ≥ 5 pas, relâchement ≥ 3 pas, lot 11) ;
- réussite = la sortie canonique sans mourir ; la note se lit sur ±3 : **1** au-dessus de 95 %, **2** de 85 %, **3** de 72 %, **4** de 60 %, **5** au-dessus de 50 % ; **0** (refusée) sous 50 % ou si le raccord (25 positions d'entrée) passe sous 90 % ;
- la note d'une variante est la plus haute de ses deux entrées (`variantExigence`).

Une **portion dure** est un morceau noté **4 ou 5** (`SLOW_MIN_EXIGENCE`). La voie lente est notée **de la même façon** (même gigue ±3, mêmes appuis humains : `tools/voies.ts`, `slowGigue`) et doit avoir **2 au plus** (≥ 85 % à ±3).

## 2. La voie lente (générateur g11)
Pour chaque portion dure (sauf le premier morceau, qui part à l'arrêt du départ : le générateur n'y pose jamais une portion dure), l'assemblage insère une **zone de bifurcation** de 6 colonnes entre le palier (son point de passage) et le morceau, et creuse la voie dans le plein (`src/voies.ts`, `assemble`) :

```
  galerie (3 rangées) au-dessus du haut du morceau ........  descente
  ┌──────────────────────────────────────────────────────┐   │
  cage : corniches d'une tuile, alternées, 3 rangées d'écart  │
  ouverture ▲▲ (repère)                                       ▼
C palier │mur│a b│mur│ palier bis │      morceau dur      │ palier C
═════════ piste rapide sous la cage (une rangée libre) ═══════════════
```
- **La piste rapide** court tout droit sous la cage (sol E, une rangée libre, toit en E−2) puis sur un **palier bis** de 2 colonnes, vide jusqu'en haut du morceau : l'entrée du morceau seul **à l'identique** (la validation toutes phases du lot 15 vaut : on y attend la bonne phase comme sur un palier).
- **L'entrée** : une ouverture de 3 rangées dans le mur gauche de la cage, au-dessus du toit, à portée d'un saut depuis le palier (2 tuiles).
- **La cage** : deux colonnes, corniches d'une tuile collées aux murs (a en E−5, b en E−8, a en E−11…) ; on saute de l'une à l'autre en tenant la direction de la suivante, le mur arrête la course ; jamais un plafond plus près que 5 rangées (un saut complet monte de 4,1 tuiles).
- **La galerie** : 3 rangées au-dessus du haut du morceau, de la cage au palier suivant ; **la descente** : on tombe dans le puits du palier suivant, **au plus tard au point de passage suivant** (on y reprend le parcours, sa sortie canonique en course propre). Si le haut du morceau suivant donnerait sur la descente au-dessus de la portée d'un saut, la colonne droite du puits est murée.
- **Rien n'y tourne** (ni scie, ni clignotant, ni vent) : la voie est la même à toute phase de l'horloge unique (lot 15) ; aucune scie ne touche une de ses cases sur tout son cycle (vérifié).
- **Sa solution enregistrée** (`SlowRoute.code`) : la preuve de l'auteur jusqu'au pas où il entre sur le palier, puis un pilote simple joué dans la simulation (`slowScript`) : s'arrêter sur le palier, sauter sur le toit, une corniche après l'autre (posé, un temps contre le mur, puis saut tenu 24 pas), la galerie, la descente, la sortie canonique. Notes mesurées : **1 ou 2 / 5** sur tous les jours régénérés.

**Coût** (`slowCostMin`) : la portion va de l'entrée sur le palier (pas `fork`) à la sortie canonique du palier suivant ; temps rapide = celui de la preuve de l'auteur, temps lent = celui de la voie enregistrée. Exigé : **lent ≥ rapide + max(50 %, 3 s)**. Si la cage la plus basse ne coûte pas assez, elle monte de 6 rangées (deux corniches) et tout est refait (`prove`, au plus 3 fois). Le niveau doit tenir dans 56 rangées avec ses galeries (`stack` réserve leur hauteur).

**Aucun raccourci** (`slowShortcutProblems`, règle du générateur, et tests) : chaque voie n'est reliée au niveau que par son ouverture (puits du palier d'entrée) et sa descente (puits du palier suivant) — vérifié case par case sur les cases creusées ; deux voies ne se touchent pas (sauf la descente de l'une contre l'ouverture de la suivante, qu'on prend de ce palier de toute façon) ; la grille du morceau contourné n'est jamais touchée. Et **le solveur** (`beamSolve`, appuis humains) ne trouve, sans entrer dans le morceau, aucune sortie du palier suivant sous `rapide + coût minimal` (`test/voies.test.ts`).

## 3. Voies parasites (`npm run voies:modules -w @cdj/jump-sim`)
Détection (`tools/voies-modules.ts`, ≈ 50 s sur 4 fils) sur les **59 variantes notées 4 ou 5** utilisables en v4 :
1. **le passage dur** : sur la solution de référence en élan, chaque changement de commande est décalé **seul** de −3 à +3 pas ; s'il fait mourir ou manquer la sortie, ce geste est précis, et une boîte de 3 colonnes × 5 rangées autour du personnage à cet instant marque le passage ;
2. **la recherche** (le solveur des morceaux, appuis humains) d'une sortie qui ne touche aucune boîte, en moins de `rapide + coût minimal` : un détour par ailleurs, qui ne coûte pas assez ; il est durci (attendre permis) pour savoir si un humain peut le prendre ;
3. **verdict** : un détour jouable (note ≥ 1) **ferme** la variante (`src/parasites.ts`, `PARASITE_CLOSED` : le générateur g11 ne la pose plus).

Résultat sur le catalogue actuel (`modules/voies.json`) :

| variante | rapide | détour trouvé | note du détour | verdict |
|---|---|---|---|---|
| `demi-tour` v2 | 2,07 s | 2,09 s | 0 (au pas près, même durci) | gardée, signalée |
| `escalier-friable` v0 | 2,86 s | 2,79 s | 0 (au pas près, même durci) | gardée, signalée |
| les 57 autres | — | aucun sous le coût minimal | — | gardées |

**Aucune voie parasite fermée ni allongée** : les deux détours trouvés ne sont jouables qu'au pas près. 9 variantes notées 4–5 (`chute-pics` v1, `demi-tour` v1, `neon-couloir` v2, `neon-pics` v0 et v3, `puits` v1, `ressort-mur-iles` v1, `ressort-scie` v2, `tapis-contraire` v1) n'ont **aucun geste précis à lui seul** (leur note vient de l'accumulation des décalages) : la détection n'y localise pas de passage et ne cherche rien (`precise: []` dans `voies.json`). L'**allongement** automatique d'un détour n'est pas fait : il demande de redessiner le morceau à la main (proposition par variante quand un détour jouable apparaîtra). **Question pour Nathan** : la « remontée par la gauche » que tu as vue — date et morceau ? Elle n'est pas sortie de cette détection ; avec son cas, je pourrai vérifier si c'est la boîte du passage qui est trop étroite ou un détour propre à l'assemblage.

## 4. Lisibilité (`apps/jump`)
- **Repère d'entrée** (`src/slowRoute.ts`, `scene.ts`) : l'ouverture est **cernée d'un cadre** et porte **deux chevrons qui montent**, en `--dj-papier` (#FFF6E0) cerné de `--dj-encre` (#2A1E16), les couleurs neutres de la charte « Cartouches » ; **jamais le rouge des dangers ni le jaune du personnage**, sans texte (`test/voieLente.test.ts` : couleur neutre, lisible à 3:1 sur le ciel et chaque plan de chaque thème, dans l'ouverture).
- **`?debug`** : les deux trajets de chaque portion dure (la preuve en cyan, la voie lente en crème) avec l'étiquette « morceau · rapide x s · lente y s (+z s) » au-dessus de la galerie ; la surimpression texte ajoute la ligne « voie lente » (dès le palier d'entrée) et « toutes voies lentes » au niveau ; `__jump.daily.slowRoutes`, `__jump.daily.slowTicks`.
- e2e `voie-lente.spec.ts` : la page a les mêmes voies et temps que le générateur ; la voie lente enregistrée, jouée pas à pas dans la vraie page, passe sans mourir, au-dessus du morceau, jusqu'au palier suivant, au chrono enregistré.

## 5. Médailles
- **Temps de référence** enregistrés pour chaque jour : rapide = **temps de l'auteur** ; **« toutes voies lentes »** = auteur + somme des surcoûts (`DailyLevel.slowTicks`, gardé dans le fichier figé : `lent`, et chaque voie : `voies`). Après une voie lente, l'horloge unique a avancé : la suite du niveau se reprend à une autre phase, ce que garantit la validation toutes phases (lot 15) ; la somme des surcoûts ne compte pas d'attente de réalignement.
- **Ajustement minimal** (`medalsWithSlow`) : or = min(×1,10, auteur + plus petit surcoût − 1 pas) ; bronze = max(×1,60, toutes voies lentes × **1,10**, `SLOW_BRONZE_MARGIN`) ; argent entre les deux. Vérifié sur chaque jour régénéré : aucune voie lente seule ne donne l'or ; toutes les voies lentes donnent au moins le bronze, avec 10 % de marge.
- Sur 120 dates (`measure:jump`) : **or jamais abaissé** (le plus petit surcoût, 3,19 s, dépasse toujours les ≈ 3 s du ×1,10) ; **bronze relevé sur 10 niveaux** (2 ou 3 voies lentes longues). Sur les 14 jours régénérés ci-dessous : **aucun ajustement**. La calibration complète est pour le lot 17.

## 6. Jours régénérés (g11) et jours figés
**Aucun jour public touché.** Avant de finir, le 23/10/2026 (« demain » à Paris le 22/10) a été **figé avec le code de `main` (g10)** dans un worktree séparé ; les jours figés du 16 au 23/10 se rejouent tels quels (v3 jusqu'au 22, v4 g10 le 23). **Les jours régénérés commencent le 24/10/2026.** Portion = de l'entrée sur le palier à la sortie du palier suivant (course sous la cage comprise) ; note = celle de la voie lente.

| date | thème | voies | portions dures (rapide → lente, surcoût, note de la voie) | auteur | toutes voies lentes | or | bronze | ajusté |
|---|---|---|---|---|---|---|---|---|
| 2026-10-24 | forêt | 3 | puits v0 (4/5) 2,867 → 7,033 s, +4,167 s, cage +1, 2/5 ; cheminee v0 (4/5) 3,042 → 7,542 s, +4,500 s, 1/5 ; mur-seul v1 (4/5) 3,142 → 6,908 s, +3,767 s, 1/5 | 29,242 s | 41,675 s | 32,167 s | 46,792 s | non |
| 2026-10-25 | nuit | 2 | cheminee-pics v2 (5/5) 2,992 → 7,583 s, +4,592 s, 1/5 ; nuit-portes v0 (5/5) 4,567 → 9,050 s, +4,483 s, cage +1, 2/5 | 30,733 s | 39,808 s | 33,808 s | 49,175 s | non |
| 2026-10-26 | glace | 2 | puits v0 (4/5) 2,867 → 7,033 s, +4,167 s, cage +1, 2/5 ; glace-cheminee v0 (5/5) 3,058 → 7,442 s, +4,383 s, 1/5 | 29,525 s | 38,075 s | 32,483 s | 47,242 s | non |
| 2026-10-27 | forêt | 2 | cheminee-pics v1 (5/5) 2,992 → 7,533 s, +4,542 s, 1/5 ; mur-seul v1 (4/5) 3,167 → 6,858 s, +3,692 s, 1/5 | 28,375 s | 36,608 s | 31,217 s | 45,400 s | non |
| 2026-10-28 | néon | 2 | neon-couloir v2 (5/5) 3,275 → 7,258 s, +3,983 s, 2/5 ; cheminee-scie v1 (4/5) 2,950 → 7,292 s, +4,342 s, 1/5 | 29,808 s | 38,133 s | 32,792 s | 47,700 s | non |
| 2026-10-29 | forêt | 2 | mur-friable v0 (4/5) 2,742 → 7,792 s, +5,050 s, 1/5 ; vent-rafale v4 (4/5) 3,092 → 6,333 s, +3,242 s, 2/5 | 30,108 s | 38,400 s | 33,125 s | 48,175 s | non |
| 2026-10-30 | néon | 2 | lucarne v1 (5/5) 2,725 → 6,633 s, +3,908 s, 1/5 ; escalier-scies v1 (4/5) 6,375 → 13,025 s, +6,650 s, 1/5 | 30,200 s | 40,758 s | 33,225 s | 48,325 s | non |
| 2026-10-31 | nuit | 2 | ressort-scie v2 (4/5) 2,067 → 9,442 s, +7,375 s, 2/5 ; escalier-friable v1 (5/5) 3,467 → 8,675 s, +5,208 s, 1/5 | 29,058 s | 41,642 s | 31,967 s | 46,500 s | non |
| 2026-11-01 | forêt | 1 | vent-piliers v1 (5/5) 2,792 → 6,325 s, +3,533 s, 2/5 | 28,308 s | 31,842 s | 31,142 s | 45,300 s | non |
| 2026-11-02 | glace | 1 | lucarne v1 (5/5) 2,725 → 6,633 s, +3,908 s, 2/5 | 28,775 s | 32,683 s | 31,658 s | 46,042 s | non |
| 2026-11-03 | forêt | 1 | escalier-friable v2 (5/5) 3,458 → 8,758 s, +5,300 s, 1/5 | 30,158 s | 35,458 s | 33,175 s | 48,258 s | non |
| 2026-11-04 | néon | 2 | mur-friable v0 (4/5) 2,775 → 7,300 s, +4,525 s, 1/5 ; neon-pics v3 (5/5) 3,150 → 7,133 s, +3,983 s, 1/5 | 30,467 s | 38,975 s | 33,517 s | 48,750 s | non |
| 2026-11-05 | glace | 2 | escalier-friable v1 (5/5) 3,458 → 8,750 s, +5,292 s, 1/5 ; mur-friable v0 (4/5) 2,783 → 7,317 s, +4,533 s, 1/5 | 28,317 s | 38,142 s | 31,150 s | 45,308 s | non |
| 2026-11-06 | usine | 2 | tapis-relais v1 (5/5) 6,542 → 11,067 s, +4,525 s, 1/5 ; chute-pics v0 (5/5) 2,583 → 6,883 s, +4,300 s, cage +1, 2/5 | 29,492 s | 38,317 s | 32,442 s | 47,192 s | non |

## 7. Le générateur g11 mesuré (`npm run measure:jump`, 120 dates)
- **Secours : 0.** Voies lentes : 1 à 3 par niveau (2,0 en moyenne) ; surcoût 3,19 à 7,42 s (4,55 s en moyenne), 63 à 358 % du temps de la portion ; 34 cages montées sur 239 voies ; « toutes voies lentes » = 1,13 à 1,56 × le temps de l'auteur.
- **Tirages validés : 33,0 %** (48,9 % des composés), contre 50,3 % au lot 15 ; 13 jours vont au-delà de 6 tirages (le plus loin : tirage 26). Refus principaux : exigence par minute hors fenêtre (la course sous la cage allonge le temps), impasses de composition (une portion dure ne peut plus être le premier morceau ; la galerie réserve de la hauteur), hauteur. **À regarder au lot 17** (calibration de la longueur et de la difficulté), pas relâché ici.
- Plus longue course au sol sans saut : 1,14 s en moyenne, 1,84 s au plus (cibles 1,2 s et 2 s). Sans correction, la piste sous la cage la portait à 1,23 s en moyenne (mesuré sur 60 dates) : en v4, le score d'un tirage compte ce qui dépasse 1,2 s (`LONGEST_RUN_TARGET`), la référence v3 ne change pas.
- Temps de l'auteur 27,98–31,04 s ; génération d'un niveau 281 ms en moyenne (1,2 s au plus).

## 8. Ce qui a changé ailleurs (zone Jump)
- **Joueurs fictifs (v4)** : une faute ne fait jamais sauter sur le palier d'un point de passage (un saut fortuit les posait sur le toit de la cage, où leur plan, droite tenue, les coinçait jusqu'à l'abandon) ; `apps/api/src/jumpHistory.ts` (jeu de données `?api=demo`) garde aussi les essais fictifs arrivés **sans mort mais plus lents que l'auteur** (« trébucher ») : en v4, un joueur fictif reprend rarement bien après une mort (il rejoue la preuve à l'aveugle sur une horloge qui ne s'arrête pas — limite du lot 15, notée pour Nathan), et le 23/10 n'avait plus qu'un classé. Jeu de données régénéré (`npm run jump:seed -w @cdj/api`) : 6 à 24 classés par jour.
- **Secours néon** : l'ancienne suite dépassait 56 rangées avec ses galeries ; rechoisie par `secours:modules -- --theme=neon` (l'ancienne est gardée pour la référence v3).
- **Charge du worker et du cache** : `PAYLOAD_FORMAT` 3 (voies lentes, temps « toutes voies lentes » ; les médailles en dépendent) ; fichier figé : champs facultatifs `voies` et `lent` (format 1 inchangé, la preuve seule fait foi).
- Références : `daily-golden-v4.json`, `replay-golden-v4.json` régénérées ; **golden v3 identiques**.

## 9. Vérifié / non vérifié
- **Vérifié** : `npm run typecheck` ; Vitest de `packages/jump-sim`, `apps/jump` et des tests DailyJump de l'API (1 014 tests, projet sqlite), dont `test/voies.test.ts` (une voie par portion dure, coût, difficulté ≤ 2, appuis humains, aucun raccourci case par case et par le solveur, parasites, médailles, zone) et `apps/jump/test/voieLente.test.ts` ; e2e Jump dans Chromium en local (voir la PR) ; budget de poids (`poids.spec.ts`).
- **Non vérifié en local** : Firefox et WebKit (la CI) ; le ressenti de la cage au téléphone (13 tuiles de haut : la cage la plus haute fait ≈ 25 rangées, on la monte en suivant la caméra).

## 10. Décisions laissées à Nathan
1. **Forme de la voie** : par le haut (cage + galerie) ; la piste rapide passe sous la cage (6 colonnes de course en plus par portion dure, ≈ 0,55 s). Une autre forme (par le bas, par un ressort) demanderait d'autres règles.
2. **Tirages validés 33 %** (50 % avant) : secours toujours à 0, mais la marge se réduit ; à reprendre avec la calibration du lot 17.
3. **Voies parasites** : aucune fermée ; la détection est-elle celle que tu voulais (cas de la « remontée par la gauche » à me donner) ?
4. **Marge du bronze** : 10 % au-dessus de « toutes voies lentes » (`SLOW_BRONZE_MARGIN`).
5. **Joueurs fictifs v4** après une mort (démo, carnage de démonstration) : ils reprennent mal (limite du lot 15) ; une vraie reprise (attendre la bonne phase pour chaque section) serait un petit lot.

## 11. Scénario en 2 clics
Le jour régénéré qui a le plus de voies lentes : le **24/10/2026** (3 voies : `puits`, `cheminee`, `mur-seul`). Liens de l'aperçu de la PR : voir la section suivante (ajoutée quand l'aperçu est publié).

En local (`npm run dev:jump`) : `http://localhost:5173/?seed=2026-10-24` et `…&debug`.

À voir : sur le palier avant chaque portion dure, l'ouverture cernée de crème avec ses deux chevrons au-dessus d'une piste basse ; arrêté sur le palier, un saut mène sur le toit, puis de corniche en corniche, la galerie au-dessus du morceau et la descente sur le palier suivant. Avec `?debug` : les deux trajets (cyan : rapide, crème : lent) et leurs temps.
