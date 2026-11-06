# Lot BR1 — Rush : le niveau du jour (chemin, détours, arène du golem)

Suite de BR0c. Jeu `off`, non publié : golden et format libres (golden **régénéré**, `RUSH_SIM_VERSION` 3 → **4**, `RUSH_GENERATOR_VERSION` 1 → **2** ; la version 1 du prototype n'a jamais été servie : aucun jour figé, donc elle n'est pas gardée). **Pour les joueurs : rien** (jeu `off`). Règles qui en sont issues : `docs/rush/consignes.md` (« Le niveau du jour », « Les thèmes », « La caméra qui suit », « La lisibilité »), `apps/rush/CLAUDE.md`. **DA figée jusqu'à BR-A : lisibilité seulement.**

## 1. Le niveau (`packages/rush-sim/src/niveau.ts`, entiers, déterministe)
- **Grille** de cases de **2 m** : sol, mur bas, vide, pont ; la simulation collisionne contre elle (glissement par axe, quatre coins du carré du corps) ; la chauve-souris vole. **Structure** : départ, 2 ou 3 étapes, arène, reliés par des chemins (6,4 m de large, haies) ou des ponts (4,4 m) ; **2 à 4 détours** vers des camps de **4 à 8 monstres** ; **3 à 5 monstres épars** sur le chemin principal (étapes et liens, à 22 m du départ au moins).
- **Valeurs choisies** (`BORNES_NIVEAU`) : chemin principal **120 à 160 m** mesuré sur la grille (chanfrein 5-7), camp à **20-40 m** du chemin, clairières de 5 à 9 m de rayon, arène de 11,5 m (centrée sur une case : toujours la même taille), écart de 8 m entre éléments qui ne se touchent pas.
- **Monstres** : au repos à leur place ; **alerte 7 m (gelée), 10 m (chauve-souris)**, **laisse 20 m** (ou le chevalier au-delà du double du rayon d'alerte) : ils lâchent et rentrent. Un joueur qui file passe (le pilote qui fonce subit **0,05 dégât par partie** en moyenne).
- **Arène** : le golem dort au fond ; quand le chevalier passe à 9,5 m du centre, la **barrière se referme** sur la porte, le disque de l'arène le retient, le golem se réveille (rugit 1 s, invulnérable) ; le combat est celui de BR0c. Défaite = pire temps, « Recommencer » relance le niveau, pas de point de passage ; le chrono va du départ à la chute du golem et exclut l'arrêt sur image.

## 2. Le générateur
- Tiré de la graine du jour (`mixSeed(jour, SEL)`), tentatives successives tirées de la graine jusqu'à un plan qui respecte les écarts **et** `problemesDuNiveau` (chemin du départ à l'arène, longueur, nombre de détours et de monstres, aucune case accessible isolée, rien près du départ, arène de même taille). **Testé sur 365 graines** (`test/niveau.test.ts` : 365 niveaux valides, 365 empreintes différentes, 3 nombres de détours, ponts variés, plus de 100 tailles de grille).
- **Temps de génération : 1,33 ms par niveau** (365 niveaux en 487 ms sur un Xeon 2,1 GHz), 1,33 tentative en moyenne, 5 au plus ; grille de 7 668 cases au plus ; **chemin principal 123 à 160 m** ; 11 à 35 monstres. Pas de date de bascule écrite : la mise en production décide du premier jour concerné.
- **Variété** : jugée sur `?scenario=carte&jours=7` (`br1-carte-7-jours.png`) : forme du chemin (cap, virages, 2 ou 3 étapes), côté et longueur des détours, taille des clairières, ponts ; on ne reconnaît pas le même niveau d'un jour à l'autre. Limite honnête : la structure reste « un tronc et des branches » (les détours partent toujours d'une clairière du chemin).

## 3. Les thèmes (purement visuels)
`prairie`, `carriere`, `sousbois` (`themes.ts`, fiche, `PALETTES`) : palette du sol, couleur et forme des murs bas (haies arrondies, rochers), 3 éléments de décor simples par thème (arbres, fleurs, touffes / cristaux, caisses / sapins, champignons, souches). **Jamais deux jours de suite le même** (testé sur deux ans). `clair` et `sombre` sont retirés (fiche, catalogues, palettes, musique : `npm run fiches`).

## 4. La caméra qui suit
Amorti, regard devant dans le sens du déplacement (2,4 m + vitesse × 0,6 s, 3,4 m au plus), **41°** (46° avant) ; elle se fond dans le cadrage de l'arène entre 24 m et 13 m du centre ; dans l'arène elle cadre comme en BR0c (`test/camera.test.ts`, 10 tests, passent à 41°). Aucun mur ne cache le chevalier : murs ≤ 1,3 m (1,05 m en pratique) et **fondu à 25 %** des arbres entre la caméra et lui (par vraie transparence : le tramage, essayé d'abord, faisait un nuage de points d'encre avec le contour par la profondeur). **Pastille « BOSS → 38 m »** : distance par le chemin, flèche vers le point du chemin qui vient. L'ombre portée suit la caméra.

## 5. Lisibilité (rien de plus)
- **Golem** : pierre gris-brun nettement plus sombre que tous les sols. **Chevalier** : casque plus petit et reculé, corps jaune plus large, plume en crête : on voit le corps et la direction (vu de dos il montre l'épée et la plume ; la fente se voit quand il regarde vers le bas de l'écran).
- **Mesure** (`test/lisibilite.test.ts`, écart CIELAB ΔE76 minimal sur les deux tons du sol de chaque thème) : pierre du golem ≥ 40 partout (prairie 50 / 59 / 67 pour les trois teintes sombres, 40 pour la tête ; carrière 51 / 60 / 68, 41 ; sous-bois 54 / 62 / 69, 46) ; gelée 42 / 45 / **29** (sous-bois : le plus faible, au-dessus du seuil de 25) ; chauve-souris 77 à 104 ; armure du chevalier 41 / 70 / 41 ; cercle d'annonce (corail à 55 %) 34 / 39 / 41. Les murs se distinguent du sol (≥ 25). Les sols ont été éclaircis pour cela.

## 6. Le pilote (`bot.ts`)
Chemin le plus court sur la grille (champ de distance), ne combat que ce qui lui barre la route ; esquive les plongeons ; arène : le combat du BR0c. **Foncer = Diamant provisoire.** Sur **60 jours** (`npm run mesures:rush -w @cdj/rush-sim`) :
| | victoires | temps min / médiane / max | dégâts subis | rediffusion |
|---|---|---|---|---|
| **foncer** | **60 / 60** (≥ 58 demandé) | **59,7 / 65,8 / 74,0 s** (golem compris) | 0,05 | 2 675 caractères au plus |
| **tout nettoyer** (partie scriptée : chaque monstre, puis l'arène) | 59 / 60 | 87,6 / 120,0 / 186,5 s | 0,23 | **8 927** au plus (pour 40 000) |
**Écart nettoyer − foncer** (parties gagnées des deux côtés) : **médiane ≈ 55 s** (25 à 120 s selon le jour) — un peu **sous** le « +1 min à 1 min 30 » visé : le pilote va droit à chaque monstre, un joueur humain sera plus lent. Foncer tombe dans « ≈ 1 min à 1 min 15 ». À régler (nombre de monstres, taille des camps) quand on aura joué.

## 7. Performances
- **Rendu** (`?debug&fps`, Chromium sans GPU, processeur ralenti ×4, 844 × 390, jour 2026-11-06) :
| | haute | basse |
|---|---|---|
| carrefour (camp 2) | 35 appels · 23 k triangles · 6,2 ms · 21 i/s | 47 · 32 k · 3,1 ms · 23 i/s |
| camp 1 | 38 appels · 25 k · 5,2 ms · 21 i/s | 51 · 36 k · 3,2 ms · 21 i/s |
| devant l'arène | 38 · 107 k · 7,6 ms · 25 i/s | 49 · 131 k · 6,8 ms · 26 i/s |
  Le sous-agent du décor a mesuré, sur trois jours et tous les carrefours, **56 à 78 appels** (haute) et 54 à 76 (basse) pour l'image entière, 28 à 55 k triangles dans le niveau et **117 à 137 k triangles dans l'arène** (le golem et l'île du BR0c : 123 à 148 k alors). **Moins de 200 appels partout** (spec e2e). Les i/s sont ceux d'un rastériseur logiciel ralenti, **pas ceux d'un téléphone**. Regroupement : morceaux de 16 × 16 cases (≤ 3 maillages chacun, coupés hors du champ), nuages en blocs de 64 m, carte d'ombre calée sur la caméra, seul le relief projette ; construction du décor 70 à 150 ms par niveau.
- **Poids** : premier chargement **44,00 Ko gzip pour 44** (marge nulle : j'ai raccourci des chaînes du catalogue pour tenir, 44,11 d'abord) ; **à la demande** : scène `corps-` **179,7 Ko** gzip (174,8 au BR0c), simulation `rediffusion-` **12,3 Ko** (le générateur et le pilote y sont).
- **Rejeu** (Cloud Run estimé 2 à 3 fois plus) : partie du jour du pilote 8 ms ; **pire jour** (10 min, chevalier invincible) **83 ms** ; pire partie « tout nettoyer » sur 60 jours **44 ms** ; **taille de la rediffusion d'une partie « tout nettoyer » : 8 927 caractères au plus** ; génération du niveau 1,3 ms.

## 8. Scénarios à 2 clics (en local : `npm run dev -w @cdj/rush`, puis JOUER ; `&api=…` d'essai comme les autres)
- `/?debug&scenario=jour` : le niveau du jour complet ; `&jour=2026-11-10` un autre jour ; `&theme=carriere` un autre thème.
- `/?debug&scenario=carte&jours=7` : la vue de dessus des 7 prochains jours (chemin orange, détours bleus, camps rouges, épars jaunes, S, G, longueur, temps du pilote).
- `/?debug&scenario=boss` et `/?debug&scenario=mannequin` : restent. Aucun n'existe en production. Je n'ai pas pu vérifier l'adresse d'aperçu de la PR.
- **Captures** (1280 × 720, Chromium sans GPU ; une par thème et par lieu, jour 2026-11-06) : `br1-<thème>-chemin.png`, `-camp.png`, `-arene.png` pour `prairie`, `carriere`, `sousbois` ; `br1-carte-7-jours.png` ; `br1-vitrine-prairie.png` (1920 × 1080, rendu comparé à la cible : le golem se détache enfin du sol, le chevalier montre son corps ; **écarts restants** : le chevalier reste plus blanc et plus petit que celui de la cible, la matière de la pierre est toujours plus douce que celle de la cible, les traits intérieurs du golem sont peu marqués : ce sont des sujets de BR-A). J'en ai regardé quatre (prairie-chemin, carrière-camp, sous-bois-arène, vitrine) ; les autres ne sont pas relues.

## 9. Tests et ce qui n'est pas vérifié
- **Sim** : 108 tests dont `niveau.test.ts` (21 : 365 graines, grille, collisions, veille, barrière, pilote) ; app : camera, acteurs, lisibilité, niveauVue ; **e2e Rush : 16 passent** en local (Chromium), dont trois nouveaux (niveau et barrière, `&jour=` et carte, moins de 200 appels). Golden régénéré. Hors zone de Rush, exceptions prévues : `config/jeux/rush.json` et ses projections (thèmes, scènes de musique), `docs/plateforme/traductions.md`, **et une ligne hors zone que le test du kit exige** : `apps/portail/src/catalogue.ts` (noms français et anglais des trois thèmes : `portail.theme.rush.<thème>`, qui remplacent ceux de `clair` et `sombre`). **Le code du thème est `sousbois`** (sans trait d'union : une clé de catalogue n'en accepte pas).
- **Non vérifié** : le ressenti (rien n'a été joué à la main ni sur téléphone) ; un vrai GPU ; les ponts (leur géométrie est testée, je n'en ai pas regardé un à l'écran) ; Firefox et WebKit (job `@navigateurs`) ; en basse qualité les arbres n'ont pas de contour (la coque serait visible à travers le fondu).

## Questions pour Nathan
- **Médailles** : « foncer » reste le Diamant provisoire. Pour BR4, les trois stratégies (foncer, nettoyer à moitié, tout nettoyer) sont prêtes dans le pilote ; l'écart mesuré (~55 s) est un peu court : veux-tu plus de monstres ou des camps plus loin ?
- **Alerte** : 7 m et 10 m, laisse 20 m : le pilote subit presque aucun coup en fonçant (0,05). Plus de danger (rayons plus grands, chauves-souris plus nombreuses) ou on laisse l'XP du BR2 en faire le prix ?
- **Premier chargement** à 44,00 Ko : plafond à relever, ou retirer ailleurs ?
- **Triangles de l'arène** (107 à 137 k) : toujours à décider avec une mesure sur téléphone (BR-A).
- **Thèmes** : veux-tu aussi des variantes de lumière (jour / nuit) en plus des trois décors ?
- **Racine** : `CLAUDE.md` n'a toujours pas de ligne « Rush » dans sa carte du dépôt (hors zone).
