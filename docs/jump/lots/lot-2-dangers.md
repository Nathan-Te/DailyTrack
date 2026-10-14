# Lot 2 — Les dangers et la mort (DailyJump)

## À tester
- **`https://nathan-te.github.io/DailyTrack/b/lot-2-dangers-dailyjump/jump/?scenario=essai`** (aussi la page par défaut) : finir le niveau d'essai, au clavier, à la manette et au téléphone (paysage). Mourir souvent : la réapparition doit sembler immédiate, sans écran ; R (ou ↻, ou Start/Select) relance sans compter de mort. À l'arrivée : bandeau avec le temps, le meilleur de la session et les morts ; « Recommencer » ou R.
- **`https://nathan-te.github.io/DailyTrack/b/lot-2-dangers-dailyjump/jump/?scenario=dangers&debug&hitbox`** : la galerie, chaque danger seul, avec ses boîtes « justes » en vert (personnage, pics réduits, disques mortels des scies) et les limites des sections. Frôler un pic par le côté, passer sous les pics `v`, toucher une dent de scie sans le disque : on survit ; la surimpression dit la cause de la dernière mort.
- Avec `&fx=off` : ni éclatement ni tremblement. `&debug&tune` : deux curseurs de plus (délai des blocs friables, vitesse du ressort).

## Légende des caractères (`packages/jump-sim/src/level.ts`)
| Car. | Élément | Collision |
|---|---|---|
| `#` `.` | bloc plein, vide | — |
| `S` `F` | départ, arrivée (tuiles vides) | arrivée : la boîte touche la tuile |
| `^` `v` `<` `>` | pics, pointe vers le haut / bas / gauche / droite | tuile traversable ; boîte mortelle = moitié côté base, ½ tuile de large au milieu (dans le triangle) |
| `o` `O` | scie fixe, rayon mortel 7/16 et 11/8 de tuile (dents dessinées jusqu'à ½ et 1,5), centrée sur sa tuile | cercle contre boîte, distances au carré entières, d² = r² ne tue pas |
| `x` | bloc friable | plein ; tombe `crumbleDelay` pas après le premier contact (posé dessus, ou poussé contre en l'air) ; revient à la mort ou à « recommencer » |
| `*` | ressort (vers le haut) | plein ; s'y poser lance à `springSpeed` (≈ 7 tuiles), saut que relâcher ne coupe pas |
| bas de la grille | — | ouvert : en sortir tue ; gauche, droite, haut restent pleins |

**Bloc annexe** (après une ligne vide sous la grille ; `//` commente une ligne) :
```
section <nom> <col0>-<col1>                                   // colonnes, bornes comprises, sans chevauchement
scie <id> <rayon : o | O | tuiles> <cycle en pas> <aller-retour|boucle> <col,rangée> <col,rangée>…
```
Une scie mobile appartient à la section de son premier point ; son cycle démarre au premier pas où le centre du personnage entre dans la section ; avant, elle attend à son premier point (et tue). Position = interpolation entière (`idiv`) le long du trajet fermé, temps proportionnels aux longueurs (Manhattan) ; retour exact au départ à chaque cycle.

## Le niveau d'essai (228 × 30, 4 sections)
1. **échauffement** : pics au sol, trou ouvert jusqu'en bas, marche, petite scie au sol, ressort dans le sol au pied d'un mur de 6 (pics `>` sur sa face), champ de pics ;
2. **murs** : cheminée de 3 haute de 13 (sauts muraux du lot 1, entrée sous le mur gauche), quatre plates-formes friables au-dessus du vide, dalle friable avec une scie dessus ;
3. **scies** : scie « ascenseur » entre deux marches, couloir bas où une scie va et vient au sol (pics sur le toit), bloc dont une scie fait le tour, grande scie au-dessus d'un trou (saut court) ;
4. **final** : trois ressorts en escalier (pics `<` sur la face du deuxième mur), longue course sous un plafond à pics (petits sauts seulement) au-dessus de trois rangées de pics et d'un pont friable.

**Temps de l'auteur : 2 595 pas = 21,625 s** (`test/fixtures/essai-solution.json`, 112 séries de commandes, trouvée par le chercheur hors simulation `test/solver.ts` : recherche par faisceau, paquets de 4 pas, points de passage). Un bon joueur humain devrait finir vers 26–30 s. La galerie a aussi sa solution (1 521 pas).

## Mesures (`MESURES=1 npx vitest run packages/jump-sim/test/mesures.test.ts --silent=false`, Node 22)
| Mesure | Valeur |
|---|---|
| Hauteur du ressort (`springSpeed` 1 056 = 30,9 tuiles/s) | **7,04 tuiles** |
| Délai mort → nouvel essai | **18 pas = 0,150 s** (`RESPAWN_TICKS`), commandes ignorées |
| Coût moyen d'un `stepAttempt` sur `essai` (commandes tenues au hasard, 2 M pas, 1 953 morts) | **≈ 960 ns** (contre ≈ 430 ns pour `stepPlayer` seul) : 0,01 % d'un cœur à 120 pas/s |
| Délai des blocs friables (`crumbleDelay`) | 30 pas = 0,25 s |

## Vérifié / non vérifié / décisions
**Vérifié** : typecheck ; Vitest (`jump-sim` : 105 tests — pics dans les 4 orientations de face et le long, cercle contre boîte au carré près, bornes sur la plus grande carte, périodicité exacte aller-retour et boucle, activation par section, friables (minuterie, chute, glisse murale), ressort (hauteur, non coupable, plafond `MAX_SPEED`), mort par le bas, remise à zéro en égalité profonde, monde qui attend, arrivée prioritaire, pas de saut automatique, fuzz de 150 000 pas sur `essai` (réglages par défaut et au hasard) et déterminisme ; `apps/jump` : 72 tests dont session (morts, recommencer ≠ mort, meilleur temps, essais aux réglages modifiés exclus) et effets) ; **golden du lot 1 inchangés** (mêmes empreintes de trajectoire ; seul `params` gagne les deux réglages) et golden de l'essai ajouté ; e2e **Chromium** en local (39 tests, dont les 4 du lot 2 : pics, réapparition ≤ 24 pas, remise à zéro, solution rejouée jusqu'au bandeau, au clavier puis au doigt en paysage) ; captures relues à l'œil. Aucune zone partagée ni fichier de DailyTrack touché, aucune dépendance ajoutée.
**Non vérifié** : Firefox et WebKit (absents ici, la CI tranche) ; vraie manette, vrai téléphone ; le ressenti de la difficulté (montée en difficulté, durée « ~30 s pour un bon joueur ») : c'est à toi de jouer.

**Décisions pour Nathan**
1. **`JUMP_SIM_VERSION` reste à 1** : aucune trajectoire du lot 1 n'a bougé (mêmes empreintes) et aucune rediffusion n'existe encore (lot 3). Les nouveaux réglages s'ajoutent à `JumpParams`. Le bas de la grille devient ouvert (aucun effet sur le bac à sable, qui a un sol partout).
2. **La page par défaut est maintenant `essai`** (c'était le bac à sable). `?scenario=bac-a-sable` reste, inchangé ; son `F` est désormais une vraie arrivée.
3. **Réapparition à 0,15 s** (18 pas) : assez pour voir l'éclatement, sous les 0,2 s. **Saut tenu depuis la mort** : il ne démarre pas l'essai et ne fait pas sauter tant qu'il n'est pas relâché ; une direction démarre tout de suite.
4. **Boîtes justes** : pics = moitié côté base (frôler la pointe ne tue pas, s'enfoncer d'une demi-tuile tue) ; scies = disque plein (les dents ne tuent pas). Plus sévère si tu préfères : `SPIKE_DEPTH`, `SAW_*_RADIUS`.
5. **Contact friable** : posé dessus, ou poussé contre lui en l'air (pas un simple frôlement de tête). **Ressort** : tuile pleine qui lance dès qu'on s'y pose, même en y marchant depuis le sol voisin.
6. **Temps de l'auteur 21,6 s** : la recherche ne rate rien ; si le niveau te paraît trop court ou trop dur, je l'ajuste (chaque changement ⇒ `SOLVE=1`, golden, version).
7. Les tests e2e de DailyJump tournent toujours dans la part 1 de la matrice CI (aucun workflow touché) ; le lot 2 y ajoute ≈ 15 s par navigateur.
