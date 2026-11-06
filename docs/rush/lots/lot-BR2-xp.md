# Lot BR2 — Rush : l'XP et les améliorations

Suite de BR1b (fusionné). Jeu `off` : golden et format libres (golden **régénéré**, `RUSH_SIM_VERSION` 5 → **6**, `RUSH_GENERATOR_VERSION` 3 → **4** ; ni l'une ni l'autre n'a été servie). **Pour les joueurs : rien** (jeu `off`). **DA figée** : seule la lisibilité (les gemmes ont un liseré d'encre pour se lire sur le sable). Règles qui en sont issues : `docs/rush/consignes.md` (« L'XP, le choix et le catalogue (lot BR2) »), `apps/rush/CLAUDE.md` (deux règles ajoutées, scénarios mis à jour).

## 1. Ce qui est livré
- **L'XP** : un monstre tué et un obstacle brisé lâchent une **gemme** (octaèdre ambre, liseré d'encre) ; elle vole vers le chevalier dans l'**aimant de 3 m** (13 m/s) et **ne disparaît jamais**. Gelée 12, chauve-souris 10, ronces 10, caisse 20 ; **un monstre de camp vaut ×3** (`xpCamp` 300 %). **Niveaux 2 à 8 à 40 / 100 / 180 / 280 / 400 / 540 / 700 XP** (`xpBase` 40, `xpPas` 20). HUD : pastille **« Nv 4 »** et barre d'XP sous les cœurs (les cœurs montent avec « Cœur en plus »).
- **Le choix** : chaque niveau gagné **fige le monde** (ni tick ni chrono) ; voile à rayures, titre « NIVEAU 5 ! », **trois cartes** (icône, nom, effet en une ligne, palier). Doigt : toucher ; souris : clic ; clavier : **1 2 3** ou **flèches / ZQSD puis Entrée** ; manette : **croix ou stick puis A**. La surbrillance suit le clavier et la manette.
- **Tirage** : un mélange du catalogue tiré de **la graine du jour + le numéro du niveau** (`tirageDeCartes`) ; on garde les trois premières **qui ne sont pas au maximum de leurs paliers** et dont le niveau minimal est atteint. Mêmes cartes pour tous, pas de relance.
- **Événement d'entrée** : le choix (`{ tick, nv, carte }`) est dans la charge de la rediffusion (entrée dont l'octet haut vaut `64 + index`, l'octet bas le niveau). **Le serveur le valide en rejouant** (`jouer`) : refus (`invalid_replay`) d'un choix hors d'un niveau gagné, d'un autre niveau que celui qui vient d'être gagné, d'une carte inexistante (index > 2 : illisible), d'un choix manquant ou en trop. Les choix entrent dans l'empreinte des entrées (copies) ; le fantôme refait ses choix tick pour tick.
- **Le catalogue (14 cartes, 3 paliers sauf mention)**, chaque valeur est un entier de `Reglages` et un curseur de `?debug&tune` :

| Famille | Carte (valeur par palier) | Niveau min. |
|---|---|---|
| Coup | **Lame lourde** +70 % dégâts, coup +5 % plus lent · **Allonge** +20 % portée, +8° d'arc · **Cadence** coup 25 % plus rapide (jamais sous la moitié) | 1 |
| Coup | **Tourbillon** le 3ᵉ coup frappe tout autour (1 fois) · **Onde d'épée** le 3ᵉ coup lance une onde de 7 m à 80 % (1 fois) | 4 · 6 |
| Mouvement | **Bottes légères** +30 % vitesse (marche et course) · **Esquive longue** +25 % · **Esquive vive** −10 ticks d'attente | 1 |
| Mouvement | **Esquive tranchante** l'esquive blesse, 100 % d'un coup, une fois par cible (1 fois) | 6 |
| Survie | **Soin** 1 cœur (jamais au maximum : peut revenir) · **Cœur en plus** +1 cœur max et un cœur rendu · **Vol de vie** 1 cœur tous les 8 monstres tués (1 fois) | 1 · 3 · 5 |
| Spécial | **Brise-pierre** +90 % de dégâts contre le boss · **Aimant** rayon +33 % (×2 au maximum) | 5 · 2 |

## 2. L'équilibre (le vrai but) — et ce qu'il a fallu changer
Le pilote joue **foncer**, **un peu d'XP** (`peu` : les monstres du chemin et les camps à 25 m du chemin ou moins) et **beaucoup d'XP** (`beaucoup` : tous les camps), chacune avec **sa liste de priorités de cartes** (`PRIORITES`) ; il ramasse les gemmes proches. Outil : `npm run equilibre:rush -w @cdj/rush-sim -- --jours=60 [--detail]` (`REGLAGES='{…}'` essaie d'autres valeurs sans toucher au code).

**Répartition finale** (la stratégie la plus rapide de chaque jour ; une défaite vaut le pire temps) :

| | 60 jours | **365 jours** | temps min / médiane / max (365 j) | niveaux | combat du golem (médiane) |
|---|---|---|---|---|---|
| foncer | 22 % | **18 %** (65 j, écart médian 5,1 s) | 46,8 / 65,6 / 79,2 s, 363/365 victoires | 1 / 2 / 3 | 45,5 s |
| un peu d'XP | 57 % | **68 %** (247 j, 6,6 s) | 36,6 / 57,7 / 84,1 s, 365/365 | 2 / 5 / 11 | 29,3 s |
| beaucoup d'XP | 22 % | **15 %** (53 j, 3,7 s) | 48,5 / 66,8 / 89,2 s, 365/365 | 7 / 9 / 12 | 12,1 s |

Aucune stratégie ne gagne tous les jours ; chacune gagne ≥ ~15 % : cible atteinte, **de justesse pour « beaucoup » (15 %)**. `test/xp.test.ts` la garde sur 45 jours (≥ 12 % chacune, ≤ 80 %).

**Ce que la cible a exigé (décisions pour Nathan, §5)** — avec les valeurs de départ, tout nettoyer ne gagnait **jamais** (mesuré sur ~150 essais de valeurs, 0 à 8 % des jours) : le détour coûtait 20 à 40 s de marche, et le gain d'une carte est borné (le combat du golem ne descend pas sous ~4 s, la marche ~14 s) : **le coût d'un détour dépassait tout gain possible**. Trois leviers, chacun mesuré :
1. **Les camps sont plus proches** (`DECALAGE_CAMP` 60, `detourMax` 4 500 : **17-45 m**, médiane 28 m, au lieu de 17-85 m, médiane 54 m ; générateur 4). Le seul changement de niveau du lot.
2. **`golemVie` 1 000 → 1 400** : sans amélioration, le pilote qui fonce bat le golem en **46,4 s** (32 s avant). Avec 4 cartes (2 lames, cadence, brise-pierre) : **9,7 s**. C'est la valeur d'un niveau : sans elle, un build complet ne rattrape pas les détours. **Contredit « ~30 s avec 0 amélioration » du prompt** (il le bat dans 98 à 100 % des jours, pas 100 % : 2 défaites sur 60 jours, 2 sur 365).
3. **Les cartes les plus fortes sont rares** (niveau minimal) et **les camps rapportent ×3** : un camp donne 3 à 4 niveaux d'un coup, donc une carte rare.

Ce qui joue, par jour : un **camp proche** (ou une bonne carte tôt : bottes, lame) fait gagner `peu` ou `beaucoup` ; des camps loin font gagner `foncer`. **Limite** : `peu` gagne ~2 jours sur 3 (ses camps sont presque gratuits) : c'est le bon compromis du jeu ; le seuil « proche » (`SEUIL_PEU_CM`) déplace les jours entre `foncer` et `peu` (3 200 cm : `foncer` 40 %, `peu` 50 %, `beaucoup` 8 %).

## 3. Scénarios à 2 clics (en local : `npm run dev -w @cdj/rush`, puis JOUER)
- `/?debug&scenario=jour` : le niveau du jour, avec l'XP et les cartes (jouer au clavier ; le pilote : `__rush.jouerPilote`).
- `/?debug&scenario=cartes` : l'écran de choix tout de suite ; **`&nv=5`** : le tirage de ce niveau pour le jour.
- `/?debug&scenario=mannequin&ameliorations=tourbillon,lame-lourde` et `/?debug&scenario=boss&ameliorations=lame-lourde,lame-lourde,brise-pierre` : sentir une amélioration contre les gelées ou le golem (un identifiant répété = un palier de plus).
- `/?debug&scenario=carte&jours=7` : par jour, les temps des trois stratégies, **la plus rapide et l'écart avec la suivante**.
- Captures (`docs/rush/lots/`, outil `e2e/captures-lot-br2.spec.ts`, `CAPTURES=1`) : `br2-choix-844.png` (téléphone paysage 844 × 390), `br2-choix-pc.png` (1280 × 720), `br2-hud-xp.png` (Nv et barre d'XP en jeu), `br2-gemmes.png` (les gemmes), `br2-carte-7-jours.png`. **J'en ai regardé quatre** (choix 844, HUD, gemmes, avant puis après la correction) ; la gemme était trop petite et sans contour : corrigée (rayon 0,3, liseré d'encre).

## 4. Mesures (Node, `npm run mesures:rush`)
- **Rejeu** : **pire jour** (10 min, chevalier invincible qui court en rond) **248 ms** (243 au BR1b) ; pire partie « beaucoup d'XP » sur 60 jours **28,3 ms** ; partie du jour du pilote 22,5 ms.
- **Taille de la rediffusion** : « beaucoup d'XP » **4 303 caractères au plus** (60 jours ; 3 348 avec ses 9 choix le 05/11) ; foncer 2 516 ; limite 40 000. Un choix coûte 4 octets de charge ; au plus 40.
- **Poids** : premier chargement **43,62 Ko gzip pour 44** (43,01 au BR1b : **381 o de marge**) ; à la demande : scène `corps-` **181,5 Ko** (177,5), simulation `rediffusion-` **17,6 Ko** (14,8). Pour tenir : `essai.ts` (premier chargement) **ne lit plus les réglages** (`reglagesDe` est dans le corps du jeu) — la leçon : des réglages collés font **toujours** une partie d'essai (le test dit « même égaux aux défauts » : il l'affirmait faux, il affirme maintenant vrai, avec la validation vérifiée à part).
- **Générateur** : 6,5 ms par niveau (7,8 au BR1b), 48 tentatives en moyenne ; 91 % de détours en boucle.
- **Appels de dessin** : +2 (les gemmes et leur contour, un `InstancedMesh` chacun) ; spec BR1 « sous 200 » inchangé et vert.

## 5. Questions pour Nathan
- **Le chrono s'arrête-t-il pendant le choix ?** Oui dans ce lot (le monde est figé, le chrono compte les ticks) : le temps de réflexion ne coûte rien, donc le classement ne punit pas la lenteur de lecture. **À confirmer.**
- **La vie du golem à 1 400** (combat sans carte : 46 s au lieu de 32 s) **et les camps à 17-45 m** : sans eux, « beaucoup d'XP » ne gagnait jamais. **Confirmes-tu ?** Sinon, la cible « chacune gagne ~15 % des jours » est inatteignable par les seules valeurs (§2).
- **Cartes rares par niveau minimal** (tourbillon 4, onde et esquive tranchante 6, cœur 3, vol de vie et brise-pierre 5, aimant 2) : ajouté pour l'équilibre ; le prompt ne le demandait pas. À garder ?
- **Des cartes fortes** (+70 % de dégâts, +30 % de vitesse par palier, brise-pierre +90 %) : c'est ce que l'équilibre demande, au risque de rendre un build complet trop puissant. Au jeu de juger.
- **Touches du choix non réglables** : 1 2 3 et Entrée sont fixes (un menu a son propre clavier) ; les flèches, ZQSD, J et la manette suivent les actions du kit. La règle M2 (aucune touche en dur) demande peut-être des actions `carte1` à `carte3`. Et l'écran du choix n'est pas déclaré dans `manette.ts` du kit (règle M1 : zone partagée).
- **`peu` gagne 68 % des jours** : le jeu récompense « un peu » d'XP. Veux-tu plus de gain pour `foncer` et `beaucoup` (seuil de `peu` plus bas, camps rares) ?

## 6. Tests et ce qui n'est pas vérifié
- **Sim** : `xp.test.ts` (42 tests : gemmes et aimant, seuils, monde figé, tirage, **chacune des 14 cartes**, événement de choix valide et refusé, format, les trois stratégies, **équilibre sur 45 jours**) ; golden **régénéré** (rediffusions « pilote », « beaucoup », « agité », « vide », scénarios « boss », « arène », « boss amélioré », « cartes »). **API** : `rush.test.ts` valide les choix (6 cas). **App** : `cartes.test.ts` (textes fr / en, nombres), `commandes.test.ts` (adresse). **E2e** : `choix.spec.ts` (clavier, **manette simulée**, doigt 844 × 390, une partie du jour dont la rediffusion est rejouée par Node) ; les specs existants passent (21 tests, dont `classement.spec` avec le vrai serveur : la partie du pilote avec ses choix est classée).
- **Non vérifié** : le **ressenti** (rien n'a été joué à la main : la force des cartes, le poids du monde figé, la lisibilité des gemmes en mouvement) ; une **vraie manette** et un **vrai téléphone** (la manette est simulée) ; Firefox et WebKit (le déterminisme avec les choix y est dans `determinisme.spec` : pas lancé hors Chromium) ; l'équilibre contre de vrais joueurs (il est celui du **pilote**, qui n'est pas parfait) ; l'anglais n'a pas été relu par un humain.
