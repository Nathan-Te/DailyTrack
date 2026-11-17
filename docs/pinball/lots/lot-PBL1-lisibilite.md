# Lot PBL1 — Pinball : la lisibilité des tables, et le poteau sauveur une fois par bille

Retour de Nathan après PBG3 : « avec tous les éléments et toutes les étiquettes, on s'y perd ». Branche `claude/pinball-lisibilite-9ivsm8` (le prompt disait `claude/pinball-lisibilite-1`), PR brouillon `jeu:pinball` ([#359](https://github.com/Nathan-Te/DailyTrack/pull/359)). Règles en vigueur : `apps/pinball/CLAUDE.md` (« Les plaques, les flèches au sol et la lisibilité »), `packages/pinball-sim/CLAUDE.md` (« poteau »). **Le jeu reste `off`.**

**Les deux captures de Nathan ont bien été reçues** : `captures-pbl1/retour-volcan-doublette.png` et `retour-ocean-tremplin.png`. Les comparaisons sont en JPEG (`avant-*` / `apres-*`, 390 × 844) dans le même dossier.

## Pourquoi les plaques s'empilaient (Volcan × doublette)
Chaque module avait sa plaque (neuf par table) et la table est pleine d'obstacles (rails de 22 px épaissis de 3,5 px, flèches, lampes, voisins). `placerEtiquettes` cherchait la place libre la moins chère, avec une pénalité douce pour les voisins mais **aucune distance maximale** : un module caché sous un rail n'avait plus de place près de lui, et la plus proche place libre était le milieu de la table. La plaque flottait alors, sans lien visible avec son élément. Corrigé à la racine : il n'y a plus que deux ou trois plaques, et **la distance à l'élément est une règle dure** (trait et pointe de liaison).

## Ce que le lot livre
- **Les plaques** (les deux rendus, `dessin.ts` / `corps.ts`) : seuls **l'élément de la mission** (« JACKPOT » pendant la multibille ; au portail A de l'espace : « PORTAILS »), **le verrou** (éteinte ; allumée et clignotante en bleu quand il est allumé) et **la porte, seulement ouverte**. Aucune plaque sur bumpers, mini-bumpers, cibles, spinner, trou simple, couloirs, rampes, orbite. **Chaque plaque est collée à son élément** (écart médian 0,1 px pour la mission, 0,7 pour le verrou ; 90 % à moins de 24 et 32 px, reliées par un trait et une pointe ; maximum 44 px). La plaque grandit par défaut (taille médiane 0,84 pour la mission, 1 pour le verrou) et ne descend sous 68 % que 27 et 31 fois sur 500 tables.
- **Les flèches au sol** (`indications.ts`) : toutes peintes éteintes et discrètes ; elles s'allument et clignotent selon le moment, **trois au plus** : élément de la mission tant qu'elle n'est pas réussie (et la porte ouverte), verrou allumé et rampe dont l'aiguillage y mène, élément du thème pendant la multibille (et la rampe qui y mène), autre rail pendant un combo. **Une couleur par intention, la même partout** : jaune mission, bleu verrou, rose jackpot, vert combo ; reprises par la lame de l'aiguillage, les halos et les plaques allumées. Expliquées dans « Comment jouer » (dixième point, fr + en).
- **Les rails** : fins (18 px, 16 pour l'orbite, contre 22 et 20), moins saturés, fond de plexi / verre / eau translucide (16 à 32 %), filets et traverses rares, **aucune lueur au Volcan**, ombre plus légère (3D et à plat). La bille sur un rail reste par-dessus tout. **Mesure** (`rails3d.test.ts`, caméra par défaut) : les parties opaques recouvrent au plus **21 %** de l'empreinte d'un module (**68 % avant le lot** ; seuil du test : 25 %).
- **La hiérarchie** : bille et objectifs du moment (flèches vives, plaques allumées, halos) > modules > rails > décor ; le décor du sol est atténué là où la bille passe (fissures du Volcan à 45 % de contraste au milieu, reflets de l'Océan à 40 %).
- **Le poteau, une fois par bille** (simulation) : voir plus bas.
- **Mesure de lisibilité** : `apps/pinball/test/lisibilite.test.ts`, sur les **500 tables**, fr et en : deux plaques permanentes au plus ; aucune plaque à plus de 44 px de son élément, ni sur un rail, un module, une flèche, la porte, une autre plaque ; jamais plus de trois flèches vives dans tous les états (repos, verrou, multibille, porte, combo, cumuls) ; couleurs par intention. `etiquettes.test.ts` ne garde plus que la largeur estimée et les styles.

## Les modules sous un rail — et ce que je propose (non fait : ça change la simulation)
Sept emplacements étaient sous un rail (avant). Part de l'empreinte d'un module couverte par le ruban d'un rail (caméra par défaut) / par ses parties opaques, au pire sur les quatre thèmes :
- **doublette** : (190, 150) — 22-24 % / 17 % ;
- **tremplin** : (268, 215) — 20 % / 7 % ;
- **bretelle** : (99, 290) — 31-52 % / 11 % ; (150, 195) : maintenant dégagé ;
- **boucle** : (112, 190) — 47-57 % / 21 % ; (190, 130) — 38-52 % / 16 % ; (262, 190) — 30 % / 13 %.
À travers des rails translucides, tous restent lisibles sauf, à mon avis, les plus couverts : **boucle (112, 190), (190, 130) et bretelle (99, 290)** (ruban à 50 %). **Proposition** (chaque déplacement laisse le module à moins de 5 % de ruban, sans rapprocher les voisins) : bretelle (99, 290) → (73, 290) ; boucle (112, 190) → (92, 178), (262, 190) → (250, 194), (190, 130) → (198, 164) ; doublette (190, 150) → (190, 158). Changerait la simulation (générateur et validation à refaire).
**Un cas où la plaque n'a pas de place** : le geyser de l'emplacement (250, 252) de la « doublette » au Volcan (12 tables sur 500) est enserré (rampe, bumpers, coulée) : sa plaque n'a de place que sur le rail (`surUnRail`, seule exception du test). Des déplacements de 10 px autour n'y changent rien (essayé) : il faudrait descendre ou monter nettement ce geyser, à décider avec Nathan.

## Le poteau, une fois par bille — changement par rapport au PBG3
`Partie.servie` (par bille, échangé avec elle) : la bille qu'il a servie n'allume plus les lampes et n'est plus servie ; la bille suivante a de nouveau son poteau ; la bille « sauvée » garde son état. Au plus **trois sauvetages par partie** ; en multibille, une fois par bille (armé, il sert la première bille qui le touche *et qu'il n'a pas servie* ; une bille déjà servie le traverse). **Interprétation à valider** : « une fois par bille en multibille » = chaque bille physique (lâchée par le trou ou lancée) a son poteau.
Versions : `PINBALL_SIM_VERSION` **7**, `PINBALL_BOT_VERSION` **6**, `PINBALL_GENERATOR_VERSION` **7** (la liste des tables refusées change : `valider:pinball --ecrire`, 471 valides et **29 refusées** contre 27 ; 3 165 s sur 3 fils). Golden régénéré (dix rediffusions). Le serveur rejoue les mêmes scores (`apps/api/test/pinball.test.ts`, déterminisme, absence de flottant : verts).
| | PBG3 | PBL1 |
|---|---|---|
| Sauvetages par partie de 15 min (16 parties) | 19 en moyenne (2 à 38) | **8,9** (3 à 15) |
| Diamant (30 jours) | 710 700 à 4,92 M, **médiane 2,36 M** | 713 700 à 5,74 M, **médiane 1,96 M** |
| Partie du robot / Diamant : min, p10, p25, médiane | 2 %, 21 %, 33 %, 67 % | 1 %, 21 %, 32 %, **62 %** |
| Mission réussie | 119 / 120 | 119 / 120 |
| Diamant médian par plan (boucle, bretelle, doublette, tremplin) | 2,36 / 2,63 / 1,56 / 2,96 M | 2,14 / 2,19 / 1,10 / 2,03 M |
| Parties entières : médiane à 6 min / 15 min | 1,24 M / 3,12 M | 0,95 M / 3,54 M |
Or / Argent / Bronze toujours 60 / 35 / 15 % (non touchés). Les parties de 15 min de la dernière ligne ne sont pas les mêmes tables qu'au PBG3 (le générateur a changé de liste) : indicatif. La répartition reste saine ; les seuils baissent d'environ 17 % (le robot perd plus de billes) sans changer de forme.

## Mesures
- **Fluidité** (comme au PBG3 : Chromium de Playwright, 390 × 844, processeur ralenti ×4, WebGL logiciel, bloom compris, multibille sur `doublette`, porte ouverte et poteau armé). Machine bruyante (±4 ms d'un passage à l'autre), avant puis après deux fois chacun : foire 24,5 / 17,2 ms → 23,0 / 18,8 ; océan 20,6 / 18,8 → 20,5 / 19,9 ; espace 19,5 / 18,4 → 17,5 / 17,5 ; volcan 18,7 / 21,2 → 19,7 / 17,3. **Pas de dégradation** ; appels 160 / 136 / 143 / 144 → 159 / 134 / 141 / 141, triangles −3 %.
- **Budgets** (gzip) : premier chargement 46 368 o (plafond 48 Ko ; +263 o : le dixième point d'aide), `pinball.rendu` 187 807 o (190 Ko), `pinball.demande` 249 845 o (255 Ko) : **sous leurs plafonds, aucun relèvement**.

## Vérifié, et non vérifié
- **Vérifié** : tests du paquet (398, dont 6 nouveaux « une fois par bille » : poteau, multibille, bille sauvée) ; tests de l'application (155, dont `lisibilite`) ; e2e Chromium `essais`, `rendu`, `themes`, `hud` (le poteau ne se réarme pas sur la bille servie) ; captures regardées (retour de Nathan ×2, verrou, multibille, rendu de secours) ; typecheck.
- **Non vérifié** : le ressenti en jouant (la lisibilité d'un coup d'œil, les couleurs sur un vrai téléphone) ; les captures des 16 plans × thèmes ne sont pas toutes regardées (les tests les gardent) ; daltonisme (jaune / vert se distinguent par la forme et la place, pas testé) ; Firefox, WebKit ; **le calcul des seuils de production** (`preparer:pinball` à relancer sur les jours servis, geste de plateforme).
- **Latent, pas nouveau** : la bille posée dans le coin de la coulée (README du PBG3) n'est pas traitée.

## Décisions à valider par Nathan
1. « Une fois par bille » en multibille (chaque bille physique) ; 2. les seuils qui baissent (médiane 1,96 M) ; 3. les déplacements d'emplacements ci-dessus (rien n'a été déplacé) ; 4. les couleurs des intentions ; 5. les plaques « PORTAILS » (espace) et « JACKPOT » sur l'élément de la mission.

## Scénario de test pour Nathan (2 clics)
Base de l'aperçu de la PR : `<aperçu>` (jeu `off` ; essais jamais classés).
- **Ses deux tables** : `<aperçu>/pinball/?plan=doublette&theme=volcan` et `<aperçu>/pinball/?plan=tremplin&theme=ocean` ;
- **Les flèches selon le moment** : `<aperçu>/pinball/?plan=doublette&theme=volcan&essai=verrou`, puis `&essai=multibille` ;
- **Le poteau** : `<aperçu>/pinball/?essai=poteau` : il sauve une fois, puis ne se réarme plus sur cette bille.
Ce qu'il regarde : en un coup d'œil, ce qu'il doit viser maintenant, et une table moins encombrée.

Pour les joueurs : rien (le jeu est `off`).
