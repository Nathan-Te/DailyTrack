# Lot 7 — La variété (DailyJump)

## À tester
Aperçu de la branche `claude/dailyjump-lot-7-variete` (toutes les dates y sont ouvertes) :
- **La galerie : [`https://nathan-te.github.io/DailyTrack/b/claude-dailyjump-lot-7-variete/jump/?modules`](https://nathan-te.github.io/DailyTrack/b/claude-dailyjump-lot-7-variete/jump/?modules)** — 51 morceaux, deux listes en tête (**Étiquette**, **Famille**) qui filtrent les cartes, la famille et « enchaînement long » sur chaque carte, les **mutateurs** de chaque variante (« mutateurs plafond:pics · denivele:2 »). Au téléphone aussi (la page défile, cibles ≥ 44 px).
- **Cinq nouveaux morceaux conseillés** (chacun aussi avec `&solution` pour regarder la solution, `&entree=elan` pour l'entrée lancée) :
  - enchaînement long : [`?module=mur-trous`](https://nathan-te.github.io/DailyTrack/b/claude-dailyjump-lot-7-variete/jump/?module=mur-trous) — un mur à remonter seul, puis un toit percé dont les bords s'effritent (6 s) ;
  - enchaînement long : [`?module=ressort-mur-iles`](https://nathan-te.github.io/DailyTrack/b/claude-dailyjump-lot-7-variete/jump/?module=ressort-mur-iles) — le ressort lance contre un mur, puis cinq îlots friables (5,9 s) ;
  - [`?module=chute-pics`](https://nathan-te.github.io/DailyTrack/b/claude-dailyjump-lot-7-variete/jump/?module=chute-pics) — tomber dans un puits étroit en esquivant les pics des parois (finit 20 rangées plus bas) ;
  - [`?module=paroi-friable`](https://nathan-te.github.io/DailyTrack/b/claude-dailyjump-lot-7-variete/jump/?module=paroi-friable) — remonter seul un mur de blocs friables (friable × mural) ;
  - [`?module=scies-jumelles`](https://nathan-te.github.io/DailyTrack/b/claude-dailyjump-lot-7-variete/jump/?module=scies-jumelles) — deux scies tournent en sens contraires autour de chaque borne.
- **Trois dates conseillées** (chacune avec `&solution` : la rediffusion de l'auteur ; `&debug` montre les limites des morceaux) :
  - la moins découpée (9 morceaux, deux enchaînements longs) : [`?seed=2026-11-15`](https://nathan-te.github.io/DailyTrack/b/claude-dailyjump-lot-7-variete/jump/?seed=2026-11-15) · [`&solution`](https://nathan-te.github.io/DailyTrack/b/claude-dailyjump-lot-7-variete/jump/?seed=2026-11-15&solution)
  - cheminée-quinconce et toit percé : [`?seed=2026-10-21`](https://nathan-te.github.io/DailyTrack/b/claude-dailyjump-lot-7-variete/jump/?seed=2026-10-21) · [`&solution`](https://nathan-te.github.io/DailyTrack/b/claude-dailyjump-lot-7-variete/jump/?seed=2026-10-21&solution)
  - exigeante (53,6 points/min) : [`?seed=2026-11-02`](https://nathan-te.github.io/DailyTrack/b/claude-dailyjump-lot-7-variete/jump/?seed=2026-11-02) · [`&solution`](https://nathan-te.github.io/DailyTrack/b/claude-dailyjump-lot-7-variete/jump/?seed=2026-11-02&solution)

## Les mutateurs en bref
Un **mutateur** transforme le **gabarit** d'un morceau dans une **zone** déclarée par le bloc annexe ; une variante combine des paramètres et **au plus deux** mutateurs, **six variantes au plus** par morceau. Sept mutateurs, purs et déterministes (`mutateTemplate`, `src/modules.ts`) : `plafond` (nu ou `:pics`), `fosse` (fond vide ↔ fond de pics), `sol-friable`, `patrouille` (une scie mobile de plus, `:cycle`), `garde` (des pics sur une face de mur), `ressort` (une marche devient ressort), `denivele:<k>` (la fin du morceau descend de k rangées, ou monte). Chaque variante mutée est **résolue, notée, et retirée du fichier** si elle est au pas près, si son raccord passe sous 90 % ou si elle n'a pas de solution. Format complet : `docs/jump/consignes.md`, « Lot 7 — variété ».

Exemple, `cheminee` :
```
famille: cheminee
mutateurs: plafond fosse denivele
variante: large=1 haut=2
variante: large=2 haut=4
variante: large=2 haut=4 +fosse +denivele:3      ← le trou du sommet a des pics au fond, la sortie est 3 rangées plus bas
variante: large=1 haut=6 +denivele:-2            ← la sortie est 2 rangées plus haut
zone plafond 6-13 2
zone fosse 8-10 16
zone denivele 11-13
```
```
 v0 (large=1 haut=2)          v2 (large=2 haut=4 +fosse +denivele:3)
 ...###...............        ...###...........(…)
 ...###..###.........F        ...###...###..........
 ...###..###...#######        ...###...###.........F
 ....##..###...#######        ...###...###...#######
 ........###...#######        .........###...#######
 .S......###...#######        .S.......###^^^#######
 ###########...#######        ######################
```
(extraits ; le trou du sommet s'ouvre sur le vide en v0, sur un fond de pics en v2.)

**Mutateurs dans le catalogue** : 115 variantes mutées sur 233 (dénivelé 45, plafond 22, sol friable 21, fosse 15, garde 8, patrouille 5, ressort 1). **Dans les niveaux** (120 dates) : 52,5 % des morceaux joués portent au moins un mutateur.

## Le catalogue : 51 morceaux, 233 variantes, 466 solutions
26 morceaux du lot 6 retravaillés (`plaine` retiré, `tunnel` devenu une respiration à bosses), 25 nouveaux dont **10 enchaînements longs** (5,2 à 6,6 s) ; **32 familles** ; **9 morceaux finissent plus bas** qu'ils ne commencent (variante 0, sans compter les dénivelés) ; 6 respirations, jamais une course à plat. Exigence des variantes : 1 → 77 · 2 → 83 · 3 → 33 · 4 → 12 · 5 → 28. Durées des solutions (élan) : 1,34 à 6,58 s, médiane 2,42 s. La règle des plats (≤ 6 tuiles sans défi, 9 pour `saut-long`, marqué `elan`) est vérifiée sur chaque variante.

| id | famille | intention | étiquettes | variantes (paramètres, **mutateurs**) | durée en élan (s) | exigence |
|---|---|---|---|---|---|---|
| `ascenseur` | trou-scie | Franchir deux fossés où des scies montent et descendent à contretemps : sauter chaque fois qu'elle est en bas. | scie | trou=1 cycle=240 · trou=1 cycle=180 · trou=2 cycle=240 · trou=1 cycle=240 **+sol-friable** · trou=2 cycle=200 **+fosse** · trou=1 cycle=180 **+denivele:2** | 1,55–1,73 | 2 · 2 · 1 · 1 · 1 · 2 |
| `cheminee-pics` | cheminee | Monter une cheminée dont chaque mur porte une plaque de pics : choisir le bon mur à chaque hauteur, puis redescendre. | mural precision vertical | plaque=1 · plaque=2 · plaque=1 **+denivele:3** | 2,24–2,59 | 3 · 4 · 4 |
| `cheminee-quinconce` **(long)** | cheminee | Monter une cheminée d'un mur à l'autre, puis traverser en haut un couloir de scies en quinconce et sauter ses deux fosses sans casser son rythme. | mural scie vertical precision | haut=5 ecart=2 · haut=5 ecart=2 **+fosse** | 5,28–5,28 | 5 · 5 |
| `cheminee-scie` | cheminee | Monter une cheminée large pendant qu'une scie va et vient dans sa partie haute : la croiser au bon moment. | mural scie vertical | haut=1 cycle=390 · haut=2 cycle=480 · haut=3 cycle=420 · haut=1 cycle=390 **+denivele:3** | 2,20–2,33 | 5 · 5 · 5 · 4 |
| `cheminee-vide` | entre-murs | S'élancer dans une cheminée sans fond au-dessus des pics, et la remonter d'un mur à l'autre sans jamais retomber. | mural vertical | large=1 haut=1 · large=2 haut=2 · large=1 haut=3 · large=1 haut=1 **+garde** · large=2 haut=1 **+fosse** · large=1 haut=2 **+denivele:2** | 1,34–1,57 | 2 · 4 · 3 · 2 · 3 · 4 |
| `cheminee` | cheminee | Monter une cheminée en sautant d'un mur à l'autre, puis sortir par le haut et franchir le trou du sommet. | mural vertical | large=1 haut=2 · large=2 haut=4 · large=2 haut=4 **+fosse** **+denivele:3** · large=1 haut=6 **+denivele:-2** | 2,04–2,33 | 5 · 3 · 2 · 5 |
| `chute-pics` | chute | Tomber au fond d'un puits étroit en esquivant les pics des parois, à gauche puis à droite. | precision vertical | prof=1 · prof=3 · prof=1 **+patrouille** · prof=2 **+garde** · prof=1 **+denivele:2** | 1,76–1,82 | 2 · 2 · 2 · 2 · 1 |
| `corniches` | corniches | Suivre une vague de corniches, un petit bond pour chacune, en montant puis en redescendant plus bas qu'au départ. | respiration | large=1 · large=2 · large=1 **+sol-friable** · large=2 **+denivele:2** | 2,18–2,64 | 1 · 1 · 1 · 1 |
| `demi-tour-ressorts` **(long)** | demi-tour | Enchaîner les ressorts au-dessus d'une fosse à pics, puis rebondir en arrière contre un mur hérissé pour le franchir. | mural ressort precision | ecart=1 · ecart=1 **+denivele:2** | 5,54–5,55 | 5 · 5 |
| `demi-tour` | demi-tour | Sauter contre le bas d'un mur hérissé, rebondir en arrière sur une corniche, puis repartir par-dessus le mur. | mural | ecart=1 · ecart=2 · ecart=4 · ecart=2 **+sol-friable** · ecart=1 **+plafond** · ecart=2 **+denivele:-2** | 1,74–2,31 | 2 · 1 · 2 · 1 · 2 · 2 |
| `descente-scies` **(long)** | descente | Dévaler des corniches de plus en plus basses pendant que des scies montent et descendent entre elles. | scie vertical precision | cycle=240 · cycle=180 · cycle=300 · cycle=200 **+fosse** · cycle=180 **+sol-friable** · cycle=240 **+denivele:2** | 5,37–5,37 | 1 · 2 · 1 · 1 · 2 · 1 |
| `descente` | descente | Se laisser tomber de corniche en corniche jusqu'en bas, sans freiner. | respiration | large=1 · large=2 · large=3 · large=2 **+denivele:3** | 2,00–2,91 | 1 · 1 · 1 · 1 |
| `escalier-friable` | escalier | Gravir un escalier de blocs friables suspendu au-dessus du vide, d'une seule traite. | friable vertical | large=2 · large=1 **+patrouille** · large=2 **+denivele:2** | 2,41–2,73 | 2 · 5 · 3 |
| `escalier-scies` **(long)** | escalier | Gravir un long escalier pendant que des scies roulent d'un bout à l'autre des marches : passer derrière chacune. | scie vertical | cycle=300 · cycle=360 · cycle=240 · cycle=300 **+sol-friable** · cycle=360 **+plafond:pics** | 5,64–5,64 | 3 · 4 · 3 · 3 · 5 |
| `escalier` | escalier | Gravir un escalier de grandes marches, un bond par marche, sans casser son élan. | respiration vertical | large=1 · large=2 · large=3 · large=2 **+sol-friable** · large=1 **+denivele:2** · large=2 **+ressort** | 1,91–2,82 | 2 · 4 · 2 · 5 · 2 · 2 |
| `grande-scie` | trou-scie | Sauter deux trous sous deux grandes scies : un petit saut passe, un grand s'y jette. | scie precision | trou=1 · trou=2 · trou=3 · trou=2 **+fosse** · trou=1 **+plafond:pics** · trou=2 **+denivele:2** | 1,55–1,91 | 2 · 3 · 4 · 3 · 2 · 2 |
| `iles-friables` | iles | Sauter d'îlot friable en îlot friable, chacun un peu plus haut, sans jamais s'y poser longtemps. | friable precision | ecart=1 · ecart=2 · ecart=1 **+plafond:pics** · ecart=2 **+fosse** · ecart=1 **+denivele:3** | 2,37–2,82 | 2 · 2 · 2 · 2 · 2 |
| `iles-scie` | iles | Sauter d'îlot friable en îlot friable sous une scie qui fait le pendule au-dessus d'eux. | friable scie precision | ecart=1 cycle=240 · ecart=2 cycle=300 · ecart=1 cycle=180 · ecart=2 cycle=240 **+fosse** · ecart=1 cycle=240 **+plafond** · ecart=1 cycle=300 **+denivele:2** | 2,18–2,46 | 2 · 1 · 2 · 2 · 1 · 2 |
| `lucarne` | lucarne | Passer d'un saut par les fenêtres de trois murs minces, chacune à une autre hauteur. | precision | fenetre=2 · fenetre=1 · fenetre=1 **+denivele:2** | 1,99–2,00 | 3 · 4 · 3 |
| `marelle` | marelle | Sauter de dalle en dalle, une haute, une basse, au-dessus d'un sol hérissé. | precision | ecart=1 · ecart=2 · ecart=1 **+sol-friable** · ecart=2 **+plafond:pics** · ecart=1 **+denivele:2** | 2,46–2,73 | 1 · 1 · 2 · 1 · 2 |
| `mur-friable` | cheminee | Monter une cheminée au-dessus d'un puits de pics : son mur gauche s'effrite, pas question de traîner, puis le seuil cède aussi. | mural friable vertical | haut=2 · haut=4 · haut=6 · haut=4 **+plafond:pics** | 1,98–2,23 | 5 · 5 · 4 · 5 |
| `mur-seul` | mur | Remonter deux grands murs tout seul, saut mural après saut mural, en revenant vers chacun. | mural vertical | haut=1 · haut=3 · haut=5 · haut=3 **+garde** · haut=1 **+sol-friable** · haut=3 **+denivele:2** | 2,01–2,94 | 2 · 3 · 3 · 2 · 1 · 2 |
| `mur-trous` **(long)** | mur | Remonter un mur tout seul, puis courir sur un toit percé dont les bords s'effritent sous les pieds. | mural friable vertical | haut=1 trou=1 · haut=3 trou=1 · haut=1 trou=2 · haut=2 trou=1 **+garde** · haut=1 trou=1 **+plafond:pics** · haut=1 trou=2 **+denivele:2** | 5,96–6,58 | 2 · 2 · 2 · 2 · 2 · 2 |
| `paroi-friable` | mur | Remonter seul un mur de blocs friables : chaque appui le fait céder, il faut monter sans hésiter. | mural friable vertical | haut=1 · haut=5 · haut=5 **+garde** · haut=1 **+denivele:2** | 2,88–3,33 | 1 · 2 · 3 · 1 |
| `pendule` | pendule | Traverser une salle où trois scies descendent du plafond tour à tour, en passant sous chacune quand elle remonte. | scie | cycle=180 · cycle=240 · cycle=150 · cycle=240 **+sol-friable** · cycle=180 **+plafond:pics** · cycle=240 **+denivele:2** | 2,00–2,00 | 1 · 1 · 1 · 1 · 1 · 2 |
| `petits-trous` | trous | Sauter une file de petits trous en courant, sans lever le pied de l'accélérateur. | respiration | trou=1 · trou=2 · trou=3 · trou=2 **+sol-friable** · trou=1 **+denivele:2** | 2,46–3,18 | 1 · 2 · 2 · 1 · 1 |
| `piliers-scie` **(long)** | piliers | Bondir de pilier en pilier, passer sous un bloc dont une scie fait le tour, puis reprendre les piliers. | precision scie | cycle=240 · cycle=180 · cycle=300 · cycle=240 **+sol-friable** · cycle=180 **+fosse** · cycle=240 **+denivele:2** | 5,35–5,37 | 2 · 2 · 2 · 3 · 3 · 2 |
| `piliers` | piliers | Bondir de pilier en pilier, chacun large d'une seule tuile, au-dessus du vide. | precision | ecart=1 · ecart=2 · ecart=1 **+patrouille** · ecart=2 **+sol-friable** · ecart=1 **+denivele:2** | 2,37–2,82 | 2 · 3 · 2 · 2 · 2 |
| `plafond-pics` | plafond | Courir sous un plafond hérissé et enjamber les pics du sol par petits sauts : un grand saut s'y empale. | precision | pics=1 · pics=2 · pics=3 · pics=2 **+sol-friable** · pics=1 **+denivele:2** | 2,46–3,18 | 3 · 2 · 3 · 2 · 5 |
| `plongeon` | plongeon | Plonger d'une corniche haute dans un couloir bas où une scie roule au sol, et la sauter sans se cogner au plafond. | scie vertical | cycle=240 · cycle=300 · cycle=240 **+sol-friable** | 1,93–1,94 | 2 · 3 · 2 |
| `pont-friable` | pont | Traverser un pont friable coupé de trous, tronçon après tronçon, sans jamais s'arrêter. | friable | ecart=1 · ecart=2 · ecart=3 · ecart=2 **+plafond** · ecart=1 **+plafond:pics** · ecart=2 **+fosse** **+denivele:2** | 2,27–2,82 | 1 · 1 · 1 · 1 · 2 · 1 |
| `pont-patrouille` **(long)** | pont | Traverser un pont friable pendant que deux scies patrouillent juste au-dessus, puis grimper d'îlot en îlot. | friable scie precision vertical | ecart=1 cycle=420 · ecart=1 cycle=300 · ecart=1 cycle=480 **+fosse** · ecart=1 cycle=420 **+plafond** | 5,10–5,15 | 5 · 5 · 5 · 5 |
| `puits-descente` **(long)** | puits | Se laisser glisser contre le mur d'un puits pour attraper sa porte basse, puis dévaler une cascade de corniches jusqu'en bas. | mural vertical | large=1 ecart=2 · large=1 ecart=2 **+garde** · large=1 ecart=3 **+denivele:1** | 5,19–5,47 | 5 · 5 · 4 |
| `puits` | puits | Se laisser glisser contre le mur d'un puits pour ne pas manquer la porte de sortie, puis sauter le trou du couloir. | mural vertical | large=1 prof=6 · large=1 prof=4 **+garde** · large=2 prof=3 **+fosse** · large=1 prof=3 **+denivele:2** | 1,96–2,11 | 2 · 2 · 2 · 2 |
| `quinconce` | quinconce | Passer entre des scies en quinconce : sauter celles du sol, rester sous celles du haut. | scie precision | ecart=1 · ecart=2 · ecart=3 · ecart=2 **+plafond:pics** · ecart=2 **+sol-friable** · ecart=1 **+denivele:2** | 2,27–3,18 | 3 · 2 · 2 · 2 · 1 · 3 |
| `rebonds-doux` | rebonds-doux | Courir sur une piste semée de ressorts : chaque rebond porte loin, il suffit de garder le rythme. | respiration ressort | long=1 · long=3 · long=2 **+plafond** · long=1 **+denivele:2** | 1,73–2,09 | 1 · 1 · 1 · 1 |
| `ressort-mur-iles` **(long)** | ressort | Le ressort lance contre un mur à finir d'escalader, puis des îlots friables à enchaîner sans s'arrêter. | ressort mural friable precision vertical | ecart=1 · ecart=2 · ecart=1 **+patrouille** · ecart=2 **+plafond:pics** · ecart=1 **+denivele:3** | 5,88–6,15 | 3 · 2 · 3 · 2 · 3 |
| `ressort-mur` | ressort | Prendre le ressort au pied d'un mur hérissé et retomber sur son sommet, sans frôler les pics. | ressort vertical | ecart=1 · ecart=2 · ecart=1 **+plafond:pics** · ecart=2 **+garde** · ecart=1 **+denivele:3** | 1,37–1,46 | 1 · 1 · 1 · 2 · 1 |
| `ressort-plafond` | ressort | Le ressort lance sous un plafond à pics : arriver assez vite pour le dépasser et se poser sur la corniche. | ressort precision | bord=1 · bord=2 · bord=4 · bord=2 **+sol-friable** · bord=1 **+denivele:2** | 1,46–2,02 | 1 · 2 · 1 · 1 · 1 |
| `ressort-scie` | ressort-scie | Le ressort lance dans un puits que traverse une scie : partir au bon moment pour passer derrière elle. | ressort scie vertical | cycle=180 · cycle=240 | 1,48–1,52 | 5 · 5 |
| `ressorts-escalier` | rebonds | Monter de ressort en ressort, chacun posé sur une corniche plus haute, au-dessus du vide. | ressort vertical precision | ecart=1 · ecart=2 · ecart=1 **+plafond:pics** · ecart=2 **+fosse** · ecart=1 **+denivele:-2** | 3,17–3,48 | 1 · 1 · 1 · 2 · 2 |
| `ressorts-trous` | rebonds | Rebondir de ressort en ressort au-dessus d'une fosse à pics, sans lâcher la course. | ressort precision | ecart=1 · ecart=2 · ecart=1 **+plafond** · ecart=1 **+denivele:2** | 3,83–4,09 | 1 · 5 · 2 · 1 |
| `saut-long` | saut-long | Prendre tout son élan et franchir un grand trou d'un seul saut. | precision | trou=5 · trou=6 · trou=7 · trou=5 **+plafond** · trou=6 **+fosse** · trou=5 **+denivele:3** | 1,73–1,91 | 1 · 1 · 1 · 1 · 1 · 1 |
| `saut-plafond` | saut-long | Franchir deux trous sous un plafond bas : un saut s'y cogne la tête, seule la pleine vitesse fait passer. | precision | trou=1 · trou=2 · trou=1 **+plafond:pics** · trou=1 **+fosse** · trou=2 **+denivele:1** | 2,18–2,37 | 2 · 1 · 2 · 2 · 1 |
| `scie-ronde` | scie-ronde | Passer sous deux blocs suspendus pendant que la scie qui fait le tour de chacun est au-dessus. | scie | cycle=240 · cycle=180 · cycle=240 **+sol-friable** · cycle=180 **+denivele:2** | 1,71–1,71 | 1 · 1 · 1 · 1 |
| `scie-sol` | scie-sol | Sauter au bon moment par-dessus deux scies qui font l'aller-retour au sol d'un couloir bas, en sens contraires. | scie | cycle=300 · cycle=240 · cycle=180 · cycle=300 **+patrouille** · cycle=240 **+sol-friable** · cycle=240 **+denivele:2** | 2,18–2,18 | 1 · 1 · 5 · 1 · 1 · 1 |
| `scies-jumelles` | scies-jumelles | Deux scies tournent en sens contraires autour de chaque borne : la sauter au moment où elles s'écartent. | scie precision | cycle=240 · cycle=180 · cycle=300 · cycle=240 **+sol-friable** · cycle=300 **+plafond** · cycle=180 **+denivele:2** | 1,91–1,91 | 2 · 1 · 2 · 1 · 4 · 1 |
| `toboggan` | toboggan | Dévaler un escalier dont chaque marche porte un pic là où l'on retombe en courant : sauter chaque marche au lieu de s'en laisser tomber. | precision | large=1 · large=1 **+sol-friable** · large=1 **+denivele:1** | 2,91–2,91 | 3 · 2 · 3 |
| `tremplin` | tremplin | Un ressort au bord d'un grand trou : rebondir à pleine vitesse pour le franchir, deux fois de suite. | ressort precision | trou=1 · trou=1 **+denivele:2** | 2,73–2,73 | 5 · 5 |
| `tunnel-scies` **(long)** | tunnel-scies | Traverser un couloir bas où roulent des scies en sens contraires, puis remonter la cheminée qui l'achève. | scie mural vertical | large=1 cycle=720 · large=1 cycle=600 **+sol-friable** | 5,29–5,38 | 2 · 2 |
| `tunnel` | tunnel | Traverser un tunnel bas semé de bosses : de petits sauts rythmés, la tête sous le plafond. | respiration | long=2 · long=3 · long=4 · long=3 **+plafond:pics** · long=2 **+denivele:2** | 1,63–2,18 | 3 · 3 · 3 · 3 · 3 |

Étiquettes (morceaux) : mural 15 · précision 24 · vertical 23 · scie 17 · friable 9 · ressort 9 · respiration 6. Familles (32) : cheminee 5 · escalier 3 · mur 3 · ressort 3 · demi-tour, descente, iles, piliers, pont, puits, rebonds, saut-long, trou-scie 2 · les 19 autres 1. Détail par variante (gigue, raccord, course à vide, plus long plat) : `npm run measure:modules -w @cdj/jump-sim`.

## Avant / après
| mesure (120 dates) | lot 6 (`g2`) | lot 7 (`g3`) | cible |
|---|---|---|---|
| morceaux en commun entre deux jours consécutifs : moyenne · max | 4,19 · 7 | **1,05 · 4** | ≤ 1,5 · ≤ 4 |
| un même morceau sur 7 jours glissants, au plus | — | 4 (30 morceaux l'atteignent) | ≤ 3 (mesure seulement) |
| plus longue course au sol sans saut : moyenne · max | 2,49 s · 4,99 s | **0,97 s · 1,83 s** | ≤ 1,2 s · ≤ 2 s |
| morceaux par niveau : min · moyenne · max | 11 · 11,7 · 13 | 9 · **10,7** · 13 | moins |
| enchaînements longs par niveau · part du temps | — | 1,62 · 30,5 % | ≥ 1 |
| course à vide aux raccords : moyenne · max | 4,5 % · 6,0 % | 4,1 % · 6,0 % (règle < 6 %) | < 6 % |
| tirages validés | 56,8 % | **66,3 %** | ≥ lot 6 |
| niveau de secours utilisé | 0 | **0** | 0 |

## Le niveau du jour (`JUMP_GENERATOR_VERSION` 3, identifiants `…-g3`)
| constante | lot 6 | lot 7 | pourquoi |
|---|---|---|---|
| `MIN_LONG` / `MAX_LONG` / `FORCE_LONG_AT` (nouveaux) | — | 1 / 2 / 300 ‰ | au moins un enchaînement long, imposé à partir de 30 % du temps ; 3 au plus ne faisait gagner que 0,3 morceau et usait les 10 longs |
| famille (règle nouvelle) | — | une seule de chaque | `compose` et `dailyProblems` |
| `LONGEST_RUN_MAX` (nouveau) | — | 2 s | plus longue course au sol sans saut, règle du générateur (`DailyLevel.longestRun`) ; la moyenne ≤ 1,2 s est vérifiée par les tests |
| `REST_GROUPS` / `REST_OPEN` (nouveau) / `REST_SALT` | 3 / 2 / `repos4310:` | **7 / 4** / `repos2527:` | le repos est généralisé : `REST_OPEN` groupes ouverts par jour, la fenêtre avance de `REST_OPEN` ; deux jours de suite partagent 1 groupe sur 7 au lieu de 1 sur 3. Avec 3 groupes : 1,92 morceau en commun (max 5), mesuré. Sel cherché par `npm run repos:modules` : groupes de 7 ou 8, chaque jour (fenêtre de 4 groupes) a au moins 6 murals, 7 scies, 2 respirations, 4 enchaînements longs |
| `EXIGENCE_RATE_MIN` / `_MAX` / `_CENTER` | 430 / 520 / 475 | **445 / 540 / 492** | recentrée sur la médiane des tirages du nouveau catalogue, même largeur relative (±10 %) |
| `PROFILE_START` → `PROFILE_END` | 1,3 → 3,3 | 1,0 → 3,0 | avec la correction ci-dessous |
| `EXIGENCE_STEER` / `STEER_FROM` (nouveaux) | — | 60 % / 333 ‰ | après le premier tiers, la variante visée corrige 60 % de l'écart entre l'exigence accumulée et celle du centre : sans elle, 44 % des tirages rejoués tombaient hors de la fenêtre |
| `REST_WEIGHT` (nouveau) | — | ×4 | une respiration qui peut tomber au milieu est préférée tout de suite (sinon 20 % d'impasses : 2 à 4 respirations par jour, parfois prises par leur famille) |
| `FALLBACK_PIECES` | 12 morceaux | 10 morceaux | tirage valide le plus central de 400 dates (30,13 s, exigence 497) |

Inchangés : durée (estimation 28–32 s, auteur 25–40 s), `MAX_PIECES` 13 (le maximum observé est 13), `MAX_DAILY_HEIGHT` 56 (à 70, aucune impasse de moins : mesuré), `EMPTY_RUN_MAX`, médailles. **Golden régénérés** : chaque date change (nouveau catalogue, familles, enchaînements longs, repos sur 7 groupes, correction d'exigence) ; ceux de DailyTrack, du personnage, de l'essai et des rediffusions n'ont pas bougé ; **`JUMP_SIM_VERSION` toujours 3**.

## `measure:jump` (sortie complète, `npm run measure:jump -w @cdj/jump-sim`)
### Niveau du jour — 120 dates (du 2026-10-16 au 2027-02-12)

#### Tirages
| mesure | valeur |
|---|---|
| tirages essayés (6 par jour, jusqu'à 40 sans tirage valide) | 720 |
| composés (sans impasse) | 622 (86,4 %) |
| **validés** (rejeu sans mort, toutes les règles) | **477** (66,3 % des tirages, 76,7 % des composés) |
| tirage retenu (indice) : moyenne · maximum | 2,35 · 5 |
| jours sans tirage valide parmi les 6 premiers | 0 |
| **niveau de secours utilisé** | **0** |

Refus et impasses :

- 77 × impasse (impasse au morceau n (imposés : respiration))
- 70 × le dernier tiers (n) est moins exigeant que le premier (n)
- 66 × exigence n hors de [n, n]
- 9 × impasse (impasse au morceau n)
- 6 × exigence n hors de [n, n] ; le dernier tiers (n) est moins exigeant que le premier (n)
- 5 × impasse (impasse au morceau n (imposés : respiration, mural))
- 3 × impasse (impasse au morceau n (imposés : respiration, pointe))
- 2 × impasse (impasse au morceau n (imposés : pointe))
- 1 × impasse (impasse au morceau n (imposés : respiration, scie))
- 1 × course à vide sur les paliers n ‰ (moins de n ‰)
- 1 × pont-patrouille:n meurt (morceau n)
- 1 × impasse (impasse au morceau n (imposés : scie))
- 1 × le dernier tiers (n) est moins exigeant que le premier (n) ; course à vide sur les paliers n ‰ (moins de n ‰)

#### Temps de l'auteur
min **28,17 s** · moyenne **29,69 s** · max **32,00 s** (permis : 25,00–40,00 s, centre 30 s)

| tranche | niveaux |
|---|---|
| 26–28 s | 0  |
| 28–30 s | 79 ███████████████████████████████████████████████████████████████████████████████ |
| 30–32 s | 40 ████████████████████████████████████████ |
| 32–34 s | 1 █ |
| 34–36 s | 0  |
| 36–38 s | 0  |
| 38–40 s | 0  |

Écart temps de l'auteur − estimation (somme des solutions de l'entrée à la sortie, aucune course entre deux) : min -6 · moyenne -0,4 · max 43 pas.

#### Course à vide (rediffusion de l'auteur)
Temps **au sol sans appui de saut**, centre du personnage au-dessus d'un palier ; plus longue course au sol sans saut du niveau.

| mesure | moyenne | max |
|---|---|---|
| par raccord (1158 raccords) | 0,13 s | 0,18 s |
| total des raccords, en % du temps de l'auteur | 4,1 % | 6,0 % |
| palier de départ (accélération comprise) | 0,18 s | 0,22 s |
| palier d'arrivée (jusqu'à `F`) | 0,11 s | 0,16 s |
| plus longue course au sol sans saut (cible : moyenne ≤ 1,2 s, max ≤ 2 s) | 0,97 s · 10,7 tuiles | 1,83 s · 20,1 tuiles |

#### Forme
| mesure | min | moyenne | max |
|---|---|---|---|
| morceaux par niveau | 9 | 10,7 | 13 |
| hauteur (rangées, ≤ 56) | 31 | 48,9 | 56 |
| largeur (colonnes) | 260 | 292,7 | 332 |

#### Exigence
| mesure | min | moyenne | max |
|---|---|---|---|
| somme des exigences | 23 | 24,6 | 27 |
| par minute (dixièmes de point ; fenêtre 445–540) | 457 | 497,0 | 539 |
| exigence du morceau le plus exigeant | 4 | 4,7 | 5 |
| premier tiers (moyenne pondérée, dixièmes) | 10 | 15,1 | 29 |
| deuxième tiers (moyenne pondérée, dixièmes) | 15 | 27,6 | 44 |
| dernier tiers (moyenne pondérée, dixièmes) | 17 | 27,1 | 44 |

Par jour de la semaine (exigence par minute, moyenne) : lundi 497 · mardi 491 · mercredi 494 · jeudi 495 · vendredi 499 · samedi 505 · dimanche 498.

#### Étiquettes (morceaux par niveau, moyenne ; niveaux qui en ont)
| étiquette | par niveau | niveaux |
|---|---|---|
| mural | 3,03 | 120/120 |
| precision | 4,83 | 120/120 |
| vertical | 4,65 | 120/120 |
| scie | 3,62 | 120/120 |
| friable | 1,76 | 111/120 |
| ressort | 1,43 | 102/120 |
| respiration | 1,00 | 120/120 |

#### Emploi des morceaux (niveaux qui le contiennent ; jours où il est disponible ; variantes)
| morceau | niveaux | disponible | variantes (emplois) |
|---|---|---|---|
| scie-sol | 40 | 68 | 0:5 1:7 2:9 3:5 4:8 5:6 |
| plafond-pics | 39 | 68 | 0:7 1:11 2:3 3:14 4:4 |
| toboggan | 38 | 68 | 0:12 1:17 2:9 |
| ascenseur | 37 | 69 | 0:6 1:5 2:7 3:7 4:8 5:4 |
| cheminee-vide | 36 | 69 | 0:9 1:4 2:4 3:12 4:4 5:3 |
| cheminee | 36 | 69 | 0:2 1:16 2:16 3:2 |
| scies-jumelles | 36 | 68 | 0:6 1:6 2:6 3:7 4:8 5:3 |
| mur-seul | 35 | 68 | 0:1 1:3 2:8 3:0 4:20 5:3 |
| escalier | 34 | 68 | 0:1 1:14 2:0 3:17 4:0 5:2 |
| ressorts-trous | 34 | 69 | 0:6 1:3 2:20 3:5 |
| pendule | 33 | 69 | 0:4 1:1 2:1 3:0 4:3 5:24 |
| plongeon | 33 | 68 | 0:8 1:15 2:10 |
| puits | 33 | 68 | 0:9 1:6 2:8 3:10 |
| tunnel-scies | 33 | 68 | 0:18 1:15 |
| descente-scies | 32 | 69 | 0:4 1:1 2:4 3:8 4:7 5:8 |
| iles-scie | 32 | 69 | 0:7 1:10 2:5 3:1 4:6 5:3 |
| quinconce | 32 | 68 | 0:7 1:4 2:2 3:4 4:13 5:2 |
| escalier-friable | 31 | 69 | 0:13 1:4 2:14 |
| piliers | 31 | 68 | 0:2 1:15 2:5 3:3 4:6 |
| ressort-mur-iles | 30 | 68 | 0:3 1:15 2:2 3:10 4:0 |
| tunnel | 30 | 69 | 0:6 1:5 2:9 3:6 4:4 |
| chute-pics | 29 | 69 | 0:6 1:5 2:2 3:7 4:9 |
| lucarne | 29 | 69 | 0:7 1:16 2:6 |
| demi-tour | 28 | 69 | 0:3 1:8 2:3 3:8 4:4 5:2 |
| marelle | 28 | 69 | 0:3 1:7 2:8 3:3 4:7 |
| scie-ronde | 28 | 69 | 0:5 1:6 2:9 3:8 |
| pont-friable | 25 | 69 | 0:1 1:1 2:2 3:2 4:18 5:1 |
| grande-scie | 24 | 69 | 0:5 1:5 2:3 3:1 4:8 5:2 |
| paroi-friable | 24 | 69 | 0:5 1:5 2:7 3:7 |
| puits-descente | 24 | 69 | 0:0 1:0 2:24 |
| mur-friable | 23 | 68 | 0:3 1:0 2:19 3:1 |
| piliers-scie | 23 | 69 | 0:1 1:3 2:5 3:1 4:4 5:9 |
| ressort-mur | 23 | 69 | 0:5 1:1 2:0 3:12 4:5 |
| iles-friables | 22 | 68 | 0:5 1:2 2:5 3:1 4:9 |
| petits-trous | 20 | 68 | 0:0 1:7 2:12 3:0 4:1 |
| saut-plafond | 20 | 69 | 0:7 1:3 2:6 3:3 4:1 |
| ressorts-escalier | 19 | 68 | 0:2 1:1 2:5 3:8 4:3 |
| corniches | 18 | 69 | 0:5 1:4 2:6 3:3 |
| mur-trous | 18 | 69 | 0:3 1:1 2:9 3:2 4:0 5:3 |
| ressort-plafond | 16 | 69 | 0:2 1:7 2:3 3:1 4:3 |
| tremplin | 16 | 69 | 0:11 1:5 |
| cheminee-pics | 14 | 69 | 0:6 1:4 2:4 |
| cheminee-scie | 14 | 69 | 0:1 1:1 2:2 3:10 |
| ressort-scie | 13 | 69 | 0:5 1:8 |
| saut-long | 13 | 68 | 0:1 1:1 2:2 3:3 4:4 5:2 |
| escalier-scies | 12 | 68 | 0:1 1:6 2:2 3:3 4:0 |
| demi-tour-ressorts | 10 | 68 | 0:4 1:6 |
| rebonds-doux | 10 | 68 | 0:1 1:3 2:3 3:3 |
| descente | 8 | 68 | 0:2 1:2 2:3 3:1 |
| cheminee-quinconce | 6 | 69 | 0:3 1:3 |
| pont-patrouille | 6 | 69 | 0:2 1:1 2:3 3:0 |

Morceaux qui ne sortent jamais : aucun.
Variantes qui ne sortent jamais : escalier-scies:4, escalier:2, escalier:4, mur-friable:1, mur-seul:3, mur-trous:4, pendule:3, petits-trous:0, petits-trous:3, pont-patrouille:3, puits-descente:0, puits-descente:1, ressort-mur-iles:4, ressort-mur:2.

#### D'un jour au suivant
Morceaux en commun entre deux jours consécutifs : min 0 · moyenne 1,05 · max 4 (répartition : 0→40 1→48 2→18 3→11 4→2 5→0 6→0).
Sur 7 jours glissants, nombre maximal d'apparitions d'un même morceau : 4 (morceaux par maximum : 1→1 2→3 3→17 4→30 5→0 6→0 7→0) ; au-delà de 3 : ressort-plafond (4), pendule (4), piliers-scie (4), ascenseur (4), iles-scie (4), cheminee (4), chute-pics (4), ressort-mur-iles (4), toboggan (4), tunnel-scies (4), escalier (4), cheminee-vide (4), scies-jumelles (4), puits (4), plafond-pics (4), mur-seul (4), descente-scies (4), scie-ronde (4), pont-friable (4), escalier-friable (4), puits-descente (4), quinconce (4), ressorts-trous (4), mur-friable (4), grande-scie (4), plongeon (4), piliers (4), saut-long (4), scie-sol (4), paroi-friable (4).

#### Familles, enchaînements longs, mutateurs
| mesure | min | moyenne | max |
|---|---|---|---|
| familles par niveau (une seule de chaque) | 9 | 10,7 | 13 |
| enchaînements longs par niveau | 1 | 1,62 | 2 |
| part du temps de l'auteur dans les enchaînements longs | 16,5 % | 30,5 % | 42,4 % |

Morceaux joués avec au moins un mutateur : 671 sur 1278 (52,5 %) ; par mutateur : plafond 115 · fosse 73 · sol-friable 174 · patrouille 18 · garde 46 · ressort 2 · denivele 260.

#### Coûts (Node, une date à la fois)
| mesure | valeur |
|---|---|
| génération d'un niveau (tous ses tirages, rejeux compris) : moyenne · max | 136,5 ms · 229,0 ms |
| rejeu de la preuve (`replayAttempt`) : moyenne · max | 4,81 ms · 9,74 ms (1350 ns par pas) |
| taille de la preuve (base64url) : moyenne | 228 caractères |

## Le solveur
`npm run solve:modules -w @cdj/jump-sim`, tout le catalogue (466 solutions, `measure:modules -- --solveur`, c.-à-d. `--force --dry`) : **968,7 s (16,1 min) sur 4 fils** (3 871 s de calcul, Node 22) ; aucune variante sans solution ni au pas près : les solutions stockées sont exactement celles qu'il retrouve. Au premier essai le catalogue aurait demandé ≈ 33 min ; ce qui a changé (outil seulement, hors de `src/`) :
- **deux recherches** (paquets de 4 et 6 pas) au lieu de trois, faisceau de **600** au lieu de 800 ;
- parmi les solutions à 2 % de la plus rapide, **seule la plus tolérante avant durcissement est durcie** (le durcissement de chacune coûtait la moitié du temps) ;
- une recherche suivante s'arrête à la durée où sa solution serait écartée (exact : vérifié sur trois morceaux, mêmes solutions au pas près) ;
- la file est **triée** (enchaînements longs et grandes grilles d'abord ; le commentaire le disait, le code ne le faisait pas) ;
- `--only=a,b` ne résout vraiment que ces morceaux (un morceau sans solution était résolu aussi) ;
- un enchaînement long est cherché jusqu'à 11 s.

Toutes les solutions ont été re-résolues par le solveur final (`--force`).

## Morceaux et variantes retirés
- **Morceau** : `plaine` (une course à plat ; la règle des plats l'interdit). `tunnel` est gardé mais refait (des bosses à sauter sous un plafond bas).
- **Variantes retirées au solveur** (au pas près, raccord < 90 % ou sans solution, avec le solveur final) : `cheminee` large=1 haut=4 +plafond:pics, large=2 haut=6 ; `cheminee-pics` plaque=0, plaque=0 +garde, plaque=1 +garde ; `cheminee-scie` haut=2 +patrouille ; `escalier-friable` large=1 ; `lucarne` +sol-friable, +garde ; `mur-friable` haut=2 +denivele:3 ; `ressort-scie` cycle=150, +garde, +denivele:-1 ; `scie-ronde` cycle=135 ; `tremplin` trou=2, +plafond, +fosse ; `toboggan` large=2, +plafond:pics ; `paroi-friable` haut=3, +garde ; `puits` prof=1 et 3 (élan) ; `plongeon` cycle=150, +plafond, +denivele (le plafond descendait avec le sol) ; `ressort-plafond` +denivele:-3 ; enchaînements longs : `cheminee-quinconce` (7 essais, 2 variantes gardées), `demi-tour-ressorts` (le demi-tour lancé était au pas près : refait ressorts d'abord, 2 variantes), `tunnel-scies` (scies plus lentes, 2 variantes), `pont-patrouille` écart 2 et cycle 360, `puits-descente` écart 3 et +fosse, `descente-scies` écart 2 (raccord 48 %), `escalier-scies` +denivele.
- **Adoucis en route** : `marelle` (dalles de 3, deux hauteurs au lieu de trois), `plongeon` (la scie roule au sol du couloir au lieu de balayer l'entrée), `tremplin` (ressort posé sur une marche : un ressort dans le sol ne se déclenche pas en courant), `toboggan` (le pic là où l'on retombe en courant : sinon droite tenue suffisait), les enchaînements longs allongés jusqu'à 5 s au moins.

## Vérifié / non vérifié / décisions
**Vérifié** : typecheck ; Vitest DailyJump et socle (407 tests) dont : format 3 et ses refus, chaque mutateur sur un gabarit d'essai (zone exacte, plage répétée recopiée, dénivelé dans les deux sens), pureté et déterminisme, zones refusées, **toutes les variantes mutées conformes** (paliers, hauteur, plats), règle des plats (≤ 6, 9 pour `elan` qui en a besoin), respirations à trois sauts au moins, familles (≤ 5 par famille, 32 familles), **8 enchaînements longs ou plus, de 5 à 8 s**, 6 morceaux qui finissent plus bas, chaque solution stockée sort de façon canonique, aucune au pas près, raccord ≥ 90 %, le catalogue généré à jour ; sur **60 dates** : une famille de chaque, 1 ou 2 enchaînements longs, **morceaux en commun ≤ 1,5 en moyenne et ≤ 4**, **plus longue course ≤ 1,2 s en moyenne et ≤ 2 s**, repos (7 groupes, 4 ouverts, un seul groupe commun d'un jour au suivant), et toutes les règles des lots 5 et 6 ; golden du générateur ; **fuzz d'intégrité étendu** (une variante par mutateur et deux enchaînements longs, réglages par défaut et au hasard) ; e2e DailyJump **Chromium** (62 réussis, 1 sauté comme avant — WebGL indisponible pour ce test — : la galerie filtre par étiquette et par famille au téléphone, `?module=cheminee-quinconce&solution` finit au temps stocké, `?seed=2026-11-03&solution` finit au temps de l'auteur et la surimpression nomme le bon morceau au pas près) ; `npm test` complet (1 342 tests SQLite + 158 libSQL) ; build ; golden de DailyTrack inchangés. Aucune zone partagée, aucune dépendance ajoutée.
**Non vérifié** : Firefox et WebKit (la CI tranche) ; vrai téléphone ; **le ressenti** : est-ce qu'on reconnaît encore des blocs ? Les mesures disent que les raccords ne se sentent plus et que la répétition a fondu ; le jeu le dira.

**Décisions pour Nathan**
1. **Branche** : la session imposait `main`, le lot demande une PR brouillon : `claude/dailyjump-lot-7-variete` (comme au lot 5).
2. **Morceaux par niveau : 10,7 (11,7 au lot 6)**, pas beaucoup moins : les enchaînements longs prennent 30 % du temps, mais les morceaux ordinaires restent courts (médiane 2,4 s, plats d'approche raccourcis par la règle des plats). En baisser davantage demanderait des morceaux ordinaires plus longs (3–4 s, deux ou trois temps chacun) : au solveur, chaque seconde coûte (budget de 20 min).
3. **Répétition** : le repos passe à **7 groupes dont 4 ouverts** (la fenêtre avance de 4 chaque jour) ; c'est lui, plus que le catalogue, qui fait tomber les morceaux en commun à 1,05 (avec 3 groupes : 1,92). Revers : deux jours d'écart partagent 3 groupes sur 7 ; sur 7 jours, un morceau peut sortir 4 fois (cible indicative 3, mesure seulement).
4. **Exigence** : fenêtre recentrée (445–540) et **correction vers le centre** après le premier tiers ; le profil devient 1,0 → 3,0. Le dernier tiers reste au moins égal au premier (règle), mais le deuxième et le dernier sont maintenant proches (2,8 et 2,7 en moyenne).
5. **Règle des plats, définition géométrique** : colonnes au même sol (plein ou friable), sans pic ni scie dans les 3 rangées au-dessus ; un plafond bas sans pics n'est pas un défi. Seul `saut-long` est marqué `elan` (`saut-plafond` n'en a pas eu besoin).
6. **Dénivelé** : appliqué après le déroulé des plages (sinon la sortie tombait dans une plage répétée) ; il décale toute la colonne, donc **jamais dans un couloir** (le plafond descend avec le sol : `plongeon` l'a montré).
7. **Familles** : un enchaînement long prend la famille de sa première intention (`cheminee-quinconce` → `cheminee`, `puits-descente` → `puits`…) : un niveau n'a jamais deux cheminées.
8. **Le solveur a changé** (voir plus haut) : solutions un peu différentes de celles qu'aurait données le solveur du lot 6 (à 2 % de la plus rapide, comme avant).
9. **Tests e2e adaptés au contenu** (aucune assertion retirée) : le passage de minuit court 15 + 15 pas au lieu de 30 + 30 (le premier morceau d'un niveau `g3` peut tuer un coureur aveugle) ; le morceau joué au doigt est `descente` (le pont friable a maintenant des trous à sauter).
10. **Correctif `?debug`** : la surimpression compte le morceau à partir de sa première colonne (le palier partagé appartient au morceau d'avant) ; une seule ligne dans `apps/jump/src/main.ts` (et `family`/`long` dans `__jump.daily`).
11. `--only` du solveur est maintenant strict ; outils ajoutés : `npm run voir:module -w @cdj/jump-sim -- <id>` (chaque variante construite et ses plats) et `npm run repos:modules` (sel du repos).
