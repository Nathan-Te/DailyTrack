# Lot T2 — Rediffusion, contenu du jour et paliers

Branche `claude/sleepy-davinci-xrbho9`, PR brouillon. Consignes : `docs/tower/consignes.md` (mises à jour par ce lot). Tower reste `off` ; `lab/` intact ; aucune version ni aucun golden de Track, de Jump ou du banc du T0 touché. Pour les joueurs : rien.

## Livré
- **Rediffusion** (`packages/tower-sim/src/rediffusion.ts`) : la partie garde les masques de commandes de ses ticks de jeu ; `enregistrer` → `encoderRediffusion` (base64url, plages, en-tête : format, `TOWER_SIM_VERSION`, `TOWER_GENERATOR_VERSION`, jour ou scénario, `Reglages`) → `decoderRediffusion` → `rejouer(R, contenu, rediffusion)`, identique au bit près à la partie jouée. Huit refus propres à Tower (`ErreurRediffusion.code`) : version inconnue, format illisible, commandes inconnues, trop longue, réglages invalides, contenu différent, inachevée, surplus. **Borne : `MAX_TICKS_JEU` = 20 000** (écrite dans les consignes). Dans le jeu : la partie s'enregistre, l'écran de fin garde en mémoire la rediffusion de la meilleure partie, et **la silhouette du fantôme est l'état final de cette partie rejouée** (par tranches de 240 ticks, l'écran ne fige pas).
- **Contenu du jour** (`src/generateur/`) : `dailyTower(jour, version)`, pure, versionnée (`TOWER_GENERATOR_VERSION` = 1, registre `GENERATEURS`) ; 40 pièces par sacs de sept ; plateforme de 5, 6, 7 ou 8 m (`PLATEFORME_BORNES`) ; six paliers de 10 à 60 m, les six effets chacun une fois (premier = bonus, jamais deux malus de suite : le tirage alterne donc bonus et malus) ; sens du vent tiré du jour ; thème `port`.
- **Paliers** (`partie.ts`, `TOWER_SIM_VERSION` = 2) : lierre (joint fixe de Rapier au premier contact), pièce figée (corps fixe), petite et géante (moitié et double, huitièmes entiers), coup de vent (un huitième tous les 10 ticks, pièce active seulement, trois pièces), pièce glissante (frottement 0,05, règle « minimum »). Une partie sans palier est celle du T1 **au bit près** (l'empreinte inline de `partie.test.ts` est inchangée).
- **Dans le jeu** : `/tower/` (aujourd'hui), `?seed=AAAA-MM-JJ`, `?scenario=paliers&effet=…` ; trait pointillé du prochain palier, plaque « 10 m · Lierre » avec sa pastille bonus (vert) ou malus (encre, signe + ou −), annonce d'une ligne qui disparaît, traînées du vent, liseré des pièces à effet. Catalogues FR et EN.
- **Jours figés** : format `apps/tower/public/jours/AAAA-MM-JJ.json` (`format`, `g`, `sim`, contenu, `medailles: null`), `npm run figer:tower -w @cdj/tower-sim -- --du … --au …` (n'écrase jamais, aucun workflow, aucune base), lecture par le jeu (`jour.ts`), garde-fou unitaire. **Aucun jour n'est figé dans ce lot** (c'est la mise en production qui les fige).
- **Golden** `test/fixtures/golden-tower.json` : dix dates (bornes d'un sac de sept, chaque bonus en premier palier, chaque malus en deuxième, les deux sens du vent, les quatre plateformes) et trois rediffusions (essai à neuf vies, jour avec quatre paliers, partie à 0 vie).

## Options d'adresse et règle R9
Vérifié dans `apps/jump/src/urlOptions.ts` : Jump **ferme en production** `semaine`, `solution`, `carnage` et **refuse une date future** de `?seed=` (aperçu et local : tout ouvert). Tower fait pareil : `?scenario`, `?effet`, `?debug`, `?tune` fermés (`restreint`) ; **`?seed=` d'une date future refusée en production** (`choisirJour`, le contenu d'aujourd'hui s'ouvre et une ligne le dit), une date passée s'ouvre. La page se tait de toute façon en production (Tower `off`). Testé (`apps/tower/test/urlOptions.test.ts`).

## Mesures (`npm run mesures-t2:tower -w @cdj/tower-sim`, Xeon 2,1 GHz, 4 cœurs, Node 22, médiane de 20)
| | médiane | par tick |
|---|---|---|
| **Banc du T0** (moteur B, 7 200 pas), remesuré ici | 608 ms | 84 µs |
| **40 carrés, six paliers de bonus** (partie nominale entière : 40/40 posées, 6 paliers, 77,8 m ; 6 791 ticks) | **364 ms** | 53 µs |
| 40 carrés, les six effets du 02/11 (la tour s'effondre à la 22ᵉ pièce, 6 283 ticks) | 185 ms | 29 µs |
| idem bonus à 1 m/s (16 921 ticks : la plus longue partie qui tient dans la borne) | 480 ms | 28 µs |
Le rejeu d'une partie entière coûte **≈ 0,6 fois** celui du banc du T0 (le banc effondre une tour entière ; ici Rapier endort les pièces posées). Même ordre de grandeur : le plafond serveur (un fil de calcul, T4) reste celui du T0.

| Taille d'une rediffusion | octets bruts | caractères base64url |
|---|---|---|
| joueur d'essai, six jours (≈ 1 300 ticks) : **moyenne** | 173 | 230 |
| 40 pièces au clavier (touche répétée, quart de tour, descente), 6 720 ticks : **pire cas réaliste** | 1 451 | 1 935 |
| pire cas théorique (20 000 ticks, un masque différent à chaque tick) | 40 016 | 53 355 (le texte refusé avant décodage au-delà de `MAX_CARACTERES` = 53 504) |

**Borne retenue : 20 000 ticks de jeu** (+ 300 de stabilisation). Partie nominale : 40 pièces × 7 m à 2,5 m/s = 6 720 ticks ; la borne en est le triple (×2,98) : elle couvre une partie à la chute minimale où une vingtaine de pièces ratent la tour de plus de 25 m. Au pire, un rejeu à la borne coûte ≈ 0,5 s mesuré (16 921 ticks).

## Les définitions retenues
Voir `docs/tower/consignes.md`, « Les paliers ». En une ligne : **posée** (pièce figée) = endormie par Rapier **ou 120 ticks (2 s) après le lâcher**, puis corps fixe pour toujours ; **lierre** = contact à moins de 5 mm, joint fixe à **tous** les corps touchés ce tick (plateforme comprise, jamais la pièce active) ; **l'effet va à la première pièce qui naît après le franchissement** (celle de « Suivante ») ; deux paliers d'un coup : file, un effet couvre une pièce (trois pour le vent), puis le suivant.

## Vérifié / non vérifié
- **Vérifié** : `npm run typecheck` ; Vitest de `packages/tower-sim` (déterminisme du jeu, pureté dont `src/generateur/`, 15 tests de paliers dont **un par effet**, rediffusion : aller-retour, **chaque refus**, `rejouer` = partie jouée ; générateur sur 365 jours ; jours figés et garde-fou ; golden) ; `apps/tower` (options d'adresse) ; `npm run traductions` à jour ; `npm run build -w @cdj/tower` ; `npm run e2e -w @cdj/tower` dans **Chromium** (6 tests : le banc, la démonstration, **le rejeu des trois références au bit près**, le parcours d'une partie, avec la rediffusion gardée et le fantôme dérivé), puis le petit ensemble `@navigateurs` (3 tests, dont les trois références) dans **Firefox 155 et WebKit** (Linux) installés dans la session : **les trois références se rejouent au bit près dans les quatre environnements** ; 4 captures lues (paliers en paysage et en portrait, coup de vent, jour du 02/11).
- **Non vérifié** : `tower-essai.yml` sur la PR (les trois navigateurs en CI) ; Safari ARM et un iPhone (WebKit de Linux seulement) ; **la sensation** des effets (vent à 0,75 m/s, 2 s avant qu'une pièce figée se fige, frottement 0,05 : à régler au T5) ; un téléphone réel ; les sons, yeux, vent soigné (T5).
- **Zones partagées touchées** (imposées, additives) : `package-lock.json` (une ligne : `@cdj/clock`, déclaré dans `apps/tower/package.json` comme Jump pour lire le jour de Paris) et `docs/plateforme/traductions.md` (régénéré), `docs/plateforme/budgets.md` (section Tower : +1 602 o gzip). Ni `ci.yml`, ni `scripts/`, ni `e2e/zones.json`.
- **Modification d'un test existant** : `partie.test.ts` attendait `TOWER_SIM_VERSION` = 1 ; il attend 2, **l'empreinte de fin du T1 est inchangée**. `partie.spec.ts` attend la silhouette du fantôme (calculée après la fin) avec `expect.poll` au lieu de la lire tout de suite.

- **CI, premier passage** (run 41083857994) : tout vert sauf `unit (4/4)`, deux délais de 5 s dépassés **hors de la zone de Tower** (`apps/jump/test/surfaces.test.ts`, `apps/api/test/jump.test.ts`, générateur de Jump sous charge) ; la PR touche `package-lock.json`, donc toute la suite unitaire tourne. Relancé une fois par ce commit ; s'ils échouent encore, c'est à Nathan de trancher (règle d'arrêt, `CLAUDE.md`).

## Questions pour Nathan
1. **L'équilibre.** Un joueur glouton (`tools/joueur.ts`, pas le bot du T3) monte à **44 m en 14 pièces** ; 40 carrés au centre font 78 m sans rien toucher. Les paliers de 40 à 60 m sont donc à portée vite : plateforme, vitesse de chute et formes seront à calibrer aux T3 et T5. Le calibrage des largeurs (5 à 8 m) vient avec.
2. **Un seul effet à la fois, dans l'ordre** : deux paliers franchis d'un coup s'appliquent l'un après l'autre (le vent de trois pièces passe d'abord). Préfères-tu qu'ils se cumulent ?
3. **Effet sur la pièce de « Suivante »**, pas sur celle qui tombe déjà : l'annonce arrive donc une pièce avant l'effet. La plaque « Suivante » ne montre pas encore l'effet (un liseré, T5) ?
4. **Pièce figée** : 2 s après le lâcher au plus tard ; une pièce qui glisse encore à cet instant se fige là où elle est. Acceptable, ou plutôt « seulement endormie » ?
5. **Jours figés** : le branchement à « Mettre en production » (registre des versions à la manière de `jours-track.json`, copie dans l'image du serveur) est le lot T4 ; la version de la simulation du fichier (`sim`) devra y être nommée aussi.

## Liens de test (aperçu de la PR : `/tower/…`)
- **Trois jours** : `/tower/?seed=2026-11-02`, `/tower/?seed=2026-11-03`, `/tower/?seed=2026-11-04` (trois suites et trois plateformes ; recharger redonne la même chose) ; `/tower/` : aujourd'hui.
- **Paliers** (pose une pièce, franchis 10 m, regarde l'effet sur la pièce suivante) : `/tower/?scenario=paliers&effet=lierre`, `…&effet=figee`, `…&effet=petite`, `…&effet=geante`, `…&effet=vent`, `…&effet=glissante`.
