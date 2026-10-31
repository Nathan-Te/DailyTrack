# Lot 56 — Track : nouvelles ambiances sonores par thème

Branche `claude/lot-56-ambiances-e1nwq4` (nom imposé par la session). Zones : `apps/web/**`, `docs/lots/**`, la ligne de Track de `budgets.md`, `durees.json`, les clés de catalogue (+ `traductions.md` régénéré), `e2e/zones.json` (une ligne de plus : le spec de la planche). **`packages/sim`, golden, rediffusions, classement : non touchés.**

## État — le lot s'arrête ici pour ton écoute

| Étape | État |
|---|---|
| **1 — retirer l'existant** | **faite** (voir ci-dessous) |
| **2 — planche d'écoute** `/track/vitrine/?planche=ambiances` | **faite — à écouter** |
| **3 — dans le jeu** (mixage en course, stéréo du décor, foule à l'arrivée, curseur « Ambiance », **constante unique**, Salon et spectateur, budget) | **attend ton choix** : le moteur d'ambiance est déjà écrit pour s'y brancher (`creerAmbiance`) |

## 1. Ce qui a été retiré
Inventaire de l'existant (lot 23) : **sept recettes de bruit filtré** (`AMBIENCE` : foule, brise, vent, vent chaud, grillons, rumeur, bourdonnement ; `AmbienceKind`, `ambienceFor`, `ambienceLevel` dans `audioLogic.ts`), leur **construction en direct** (`buildAmbience`, `setAmbience`, `ambienceKind` dans `audio.ts`), les deux appels de `main.ts`, le **curseur « Ambiance »** des Réglages et ses deux textes (fr + en), leurs tests. Aucun fichier sonore : tout était du code. **Gardés** : la valeur `ambience` de `cdj:audio` et le bus « ambiance » (aucune source n'y est branchée) — un joueur qui avait réglé son curseur ne perd rien quand l'ambiance reviendra. `test/ambiances.test.ts` échoue si un reste de l'ancien code réapparaît.

**Ce que le premier chargement y gagne** (`node scripts/budgets.mjs`, même arbre, avant / après) : **JS + CSS 294 386 → 293 408 o (−978)**, `track.js` −978, `track.horsThree` −978, catalogue anglais 7 966 → 7 933 (−33). `budgets.md` mis à jour (marge de `track.jsCss` 326 → **1 304 o**).

## 2. La planche d'écoute
**À écouter** : `<aperçu de la PR>/track/vitrine/?planche=ambiances` (lien commenté sur la PR). « Activer le son », puis un thème (huit boutons).
- **Seule** : l'ambiance au niveau du jeu, avec **la vitesse au curseur** (0 = à l'arrêt ; plus on va vite, plus elle s'efface), le décor (proximité et côté de la tribune / des lampadaires), « Un événement maintenant » pour ne pas attendre, « Point de contrôle » et « Arrivée » (la foule du Stade), « Sans ambiance » et « Ambiance (×) » pour comparer.
- **Sous le moteur** : la course virtuelle du lot 55 (31 s : ralenti, accélération, freinage, terre, turbo, saut) avec le moteur B de la voiture choisie, les pneus et le vent ; ou **une vitesse fixe** (0, 20, 40, 60, 80 m/s). Dans ce mode la tribune du Stade passe sur ta gauche (au départ et vers 560 m), les lampadaires de la Nuit défilent de chaque côté à leur tour, la clameur part à 9 s et 20 s (points de contrôle), l'ovation à 28 s (arrivée).
- En bas : le coût de chaque thème sur ton appareil, « Charge du fil audio » (Chrome : **lis-la sur ton téléphone**, c'est le vrai coût).

| Thème | Ce qu'on y entend |
|---|---|
| **Stade** | rumeur de foule lointaine (du babil : 10 voix de bruit dans des formants de voyelles, syllabes irrégulières) ; **la tribune de départ enfle** quand on passe devant (gauche) ; **clameur** au point de contrôle, **ovation** (voix puis applaudissements) à l'arrivée ; claquements de mains isolés |
| **Rallye** | vent sec par rafales, broussaille, sifflement dans les rochers ; **graviers qui roulent** ; **cri d'un rapace** au loin (avec son écho) |
| **Banquise** | vent froid et fin, deux sifflements mobiles ; la glace : **« pings » qui plongent**, **craquements secs**, **longs gémissements graves** |
| **Campagne** | brise, feuillage, **champ d'insectes** ; **mésange, merle, tourterelle, pinson** (trois variantes chacun) ; **cloche de village** (1 à 3 coups) |
| **Canyon** | rafales amples, grondement creux, « tuyaux d'orgue » de la roche, **écho** des parois ; **corbeau** et **pierres qui roulent** répétés par l'écho ; coups de vent dans une anfractuosité |
| **Col alpin** | grand vent d'altitude, souffle sourd et sifflement mince ; **sonnailles de troupeau** au loin ; sifflement de marmotte |
| **Ville** | grondement de la circulation, chuintement de pneus ; **voitures qui passent** d'un côté à l'autre (le son monte puis s'éloigne) ; **klaxon** de temps en temps |
| **Nuit** | **champ de grillons** (« tri-tri-tri » en groupes, chacun son tempo), souffle de nuit ; **bourdonnement électrique des lampadaires** (100 Hz et harmoniques, un arc qui crépite) quand on passe devant ; une chouette, très rarement |

**Fabrication — « échantillons rendus par le code au chargement du thème »**, aucun fichier, aucune source tierce (`src/son/ambiance/`, à la demande, un morceau par thème). Le lit continu est rendu par un `OfflineAudioContext` (calcul natif, plus vite que le temps réel) en **mono**, son canal droit étant le même son décalé de 37 % (large pour la moitié du calcul), **fermé sans couture** (équipuissance) ; il est lu **à deux hauteurs** (1 et 0,87) pour que la boucle ne se retrouve jamais, avec une dérive lente du volume. Les événements sont synthétisés échantillon par échantillon dans une banque (3 à 5 variantes par groupe), joués à intervalles **tirés au hasard** (semé, jamais d'horloge murale), à une hauteur, un volume et une place stéréo tirés. **Pourquoi pas des fichiers comme les moteurs (lot 55)** : des bruits de fond (vent, foule) passés en AAC à bas débit « grésillent » (le défaut que tu as relevé sur les moteurs) ; ≈ 100 ko par thème de fichiers contre ≈ 1 ko de code ; et aucun CPU au chargement dans l'autre cas. **Si le coût au chargement sur ton téléphone te gêne**, on passe à des fichiers rendus par un outil de Node (même code de synthèse) : dis-le.

## Mixage (mesuré, `e2e/vitrine-ambiances.spec.ts`)
Niveau efficace (RMS, signal hors ligne) — **moteur de la Sparrow avec pneus et vent** (planche du lot 55) : 0,03 à 0,04 au ralenti, **0,20 à 0,29** en accélération ; **ambiance** (lit seul, sans décor) : **0,033 à 0,041 à l'arrêt**, 0,027 à 20 m/s, **0,014 à 0,017 à 40 m/s** (≈ −24 dB sous le moteur), **0,008 à 0,009 à partir de 60 m/s** (≈ −30 dB ; plancher de 22 %, passe-bas de 9 000 à 2 800 Hz : à vitesse, les grillons de la Nuit disparaissent, c'est voulu). Les événements dépassent le lit de quelques dB (crête 0,19 à 0,33) ; rien ne sature. Chaque lit a **≥ 20 % de son énergie entre 250 et 6 000 Hz** (un haut-parleur de téléphone ne rend rien sous 250 Hz : un premier réglage avait un Stade à 95 % de grave, corrigé). Spectrogrammes des huit thèmes : `lot-56/img/spectres-des-huit-themes.png` ; la planche : `lot-56/img/planche-ambiances.png`.

## Coûts
- **Code à la demande** (`node apps/web/vitrine/poids-parties.mjs`, esbuild + gzip) : commun (lecteur 2,0 ko + boîte à outils 2,8 ko) **≈ 4,9 ko** ; thèmes **0,9 à 1,6 ko** (Stade 0,9, Rallye 0,9, Banquise 1,1, Campagne 1,6, Canyon 1,2, Col 1,0, Ville 1,1, Nuit 1,3), **somme ≈ 14,1 ko**. **Plafond proposé pour la ligne « ambiances à la demande » : commun ≤ 6 000 o, chaque thème ≤ 2 000 o, somme ≤ 16 000 o** (à valider ; la ligne de `budgets.md` et son garde dans `perf.spec.ts` viennent avec l'étape 3, quand le code est dans le jeu : le test qui lit le tableau est dans `apps/portail`).
- **Premier chargement : −978 o** (retrait), **+0 o** pour la planche (la vitrine est une construction à part). L'étape 3 ajoute un crochet dans `audio.ts` (≈ 200 à 400 o) : **net négatif ou nul**, comme demandé.
- **Fabrication d'un thème** (rendu, Chromium de CI, un cœur) : 0,15 à 0,65 s à ×1 ; **processeur ×4** (profil téléphone) 0,6 à 1,8 s au total, **aucune tâche de plus de 81 ms à ×1, 245 ms à ×4** (la fabrication rend la main entre deux morceaux). Une fois par thème et par page (les deux derniers sont gardés : le Salon change de thème toutes les dix minutes). Tampons : 4,4 à 7,2 Mo par thème.
- **À l'image** : `maj()` ≈ **0,002 à 0,005 ms** ; nœuds Web Audio permanents : **7 à 10**, plus des nœuds brefs (au plus 14, détachés à la fin de leur source). **Charge du fil audio sur téléphone : non mesurée** (l'API manque au Chromium d'essai) — la planche l'affiche sur ton Chrome.

## Décisions pour toi
1. **Écoute thème par thème** (casque, puis téléphone) : garder / retoucher / écarter. Dis-moi ce qui gêne en un mot (« trop de souffle », « l'oiseau sonne faux », « la foule est molle ») ; chaque thème est un seul fichier de recette (`themes/<thème>.ts`).
2. **Rendu au chargement ou fichiers** (voir plus haut) selon ce que ton téléphone en dit.
3. **Plafonds** de la ligne « ambiances à la demande » (ci-dessus).
4. À l'étape 3 : la **constante unique** (`AMBIANCES_ACTIVES` dans `audio.ts` : `false` = aucun chargement, aucun réglage affiché) et le curseur « Ambiance » qui revient avec un cran « coupée ».

## Vérifié / non vérifié
**Vérifié** (`npm run typecheck`, 1 249 tests unitaires de `apps/web` et `packages/ui` verts, dont `ambiances.test.ts` ; e2e `vitrine-ambiances` (7 tests, Régression : huit thèmes rendus et mesurés, vitesse, événements espacés, foule au Stade, tribune et lampadaires, **aucune fuite de nœuds au recommencement ni au changement de thème**, planche), `vitrine-son`, `son-jeu`, `perf`, `graphismes`, `juice`) : rien ne sature, aucune valeur cassée, lits sans couture, deux canaux décorrélés, la vitesse efface l'ambiance, les événements restent espacés (jamais deux d'un coup), la foule réagit à l'arrivée (×1,8 au moins), l'ambiance **ne lit que quatre champs** et ne modifie pas son entrée, aucun `Math.random` ni horloge murale. **Non vérifié : que ça sonne bien** (aucune oreille ici), iPhone et Safari (`StereoPannerNode` : Safari ≥ 14.1), Firefox, la charge du fil audio sur téléphone, une longue partie.
**Test instable signalé, hors du diff** : `juice.spec.ts` « le contexte audio démarre au premier geste, pas avant » échoue au hasard (3 fois sur 8 **sur `main` sans ce lot**, 1 sur 3 avec : le contexte s'annonce déjà « running » avant le geste dans le Chromium piloté) ; non corrigé ici.

## Fichiers hors zone
`e2e/zones.json` (le spec `vitrine-ambiances` : zones `track-son` et `track-vitrine`, Régression) ; `docs/plateforme/traductions.md` (régénéré : deux clés de moins) ; `docs/credits.md` (une ligne : aucune source tierce). **À proposer à un lot de plateforme** : la ligne « ambiances à la demande » du tableau de `budgets.md` (avec l'étape 3) et la rubrique « Ambiances (lot 56) » dans l'index du `CLAUDE.md` racine.
