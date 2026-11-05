# Lot BR0b — Rush : caméra basse, rythme ralenti, commandes PC à la souris, DA vers la cible

Retouche du prototype BR0 (jeu `off`, arcade, non publié) après que Nathan y a joué : caméra trop haute, jeu trop rapide (l'enchaînement des attaques du golem, les vagues), commandes PC mauvaises (Espace pour frapper), DA à rapprocher de `docs/rush/maquettes/cible-ia.png` (la cible de rendu, pas une spécification au pixel) et de `boss-rush-3d.html` (la maquette d'origine, enfin reçue). **Pour les joueurs : rien** (jeu `off`). Le format de rediffusion et le golden changent (`RUSH_SIM_VERSION` 1 → **2**), les valeurs aussi : permis pour un prototype.

## Ce qui a changé
- **Caméra** (`camera.ts`, testée) : plongée de **40°** (60° au BR0), champ **35°** (30°), distance de base 14 m ; le chevalier est cadré **dans le tiers inférieur**, léger amorti ; face au golem elle **recule juste assez** (jamais plus de ×1,5) et se décale pour garder le golem (tête comprise), son cercle de poing et le chevalier. `?debug&tune` : « vue » est remplacée par **angle, distance, champ**.
- **Rythme** (`partie.ts`, valeurs en tête de fichier) : voir le tableau ci-dessous ; **curseur « rythme »** (`reglages.rythme`, 40 à 200 %, 100 = défaut) qui met à l'échelle en bloc toutes les durées (÷) et vitesses (×) de tous les ennemis. Vagues de l'arène : au plus **8 monstres**, pause de 3 s entre deux vagues ; `&monstres=30` reste le test de charge.
- **Commandes PC** : **la souris vise** (rayon de la caméra sur le plan du sol → 32 directions, `visee.ts`), **clic gauche = coup, maintenu = enchaînement**, **Espace = esquive** (dans le déplacement, à l'arrêt vers la visée), **ZQSD/WASD par `event.code`** + flèches ; réticule discret au sol (PC seulement). **Manette** : stick droit = visée (sinon visée assistée), A maintenu = enchaînement. **Doigt** : « Coup » maintenu = enchaînement, visée assistée comme avant. L'écran des commandes lit les nouvelles touches par défaut (`actions.ts`) ; « Comment jouer » (fr + en) les dit.
- **Entrée de la simulation** : **deux octets** — le bas (direction, coup, esquive) et le haut (la **visée**, séparée du déplacement). `PAS_MIN_VISEE` = 4 ticks (15 Hz), comme `PAS_MIN_DIRECTION` = 3. Un coup **tenu** enchaîne dans la simulation (le bit tenu rafraîchit la mémoire du coup à chaque tick) : la rediffusion d'un joueur qui maintient le clic tient en un changement.
- **DA en code, sans asset** : **golem** de rochers anguleux (icosaèdres déformés, coloration par face), 5,5 m, trapu, poings énormes, **yeux ambre**, arcades froncées ; **arène** : plateau en damier sable sur une **île flottante** (falaises, herbe), muret de bois à poteaux et touffes, autres îles et nuages, ciel en dégradé ; **chauve-souris** à vraies ailes membraneuses qui battent ; **cercles rouges** : disque plein translucide, bord épais, remplissage qui grandit jusqu'au coup ; débris et poussière à l'impact ; **lignes de vitesse** à l'esquive, poussière aux pas ; **ombres douces** ; **contour relatif** à la taille de la forme (10 % du rayon, 2 à 15 cm) ; **HUD** : cœurs en cartouche (haut gauche), barre du golem avec nom et phase (bas centre), « Coup » et « Esquive » côte à côte avec leur pictogramme (bas droite).
- **Scénario `?scenario=vitrine`** (nouveau) : scène figée qui reproduit la composition de `cible-ia.png`. Captures : `lot-BR0b-vitrine-844.png`, `lot-BR0b-vitrine-1920.png`, `lot-BR0b-comparaison.png` (cible | vitrine), `lot-BR0b-boss-844.png`, `lot-BR0b-arene-844.png`.
- **Tests** : sim (82, dont visée, coup tenu, rythme, vagues, vitrine), caméra et visée (12), acteurs (3), commandes ; e2e ajoutés dans `partie.spec.ts` (visée à la souris, clic maintenu, Espace ; vitrine figée). Golden **régénéré** (`npm run golden:rush -w @cdj/rush-sim`) : la version, le format d'entrée et les règles ont changé. Un test e2e (`jouerLeJour`) attend désormais **5** ticks au lieu de 7 : avec 7 le pilote perd ce jour-là (il n'est pas parfait) — décision de test, pas d'affaiblissement.

## Les nouvelles valeurs (rythme 100 %)
| | BR0 | **BR0b** |
|---|---|---|
| Annonce de chaque attaque du golem (second coup compris) | 50 (22 le second coup) | **70 en phase 1, 50 en phase 2** (second poing annoncé 50 à l'impact du premier) |
| Récupération sans frapper (poing / onde / pierres) | 50 / 55 / 40 | **90 / 100 / 80 en phase 1, 60 / 65 / 55 en phase 2** |
| Écart des deux ondes de la phase 2 | 48 | **70** |
| Gelée : écrasement avant de foncer · bond · vitesse | 10 · 18 · 4,8 m/s | **30** · 24 · **3,36 m/s** |
| Chauve-souris : annonce du plongeon · vitesse d'orbite · plongeon | 22 · 5,6 · 11,5 m/s | **45** · **3,92** · **8,05 m/s** (34 ticks) |
| Vagues d'arène | 6 + 2 par vague, jusqu'à 30 | **8 au plus**, pause de 180 ticks |
| Niveau du jour | 3 monstres / 8 s, 5 au plus | 3 monstres / 10 s, 4 au plus |
| Premières attaques du golem | 120 ticks (40 en phase 2) | 150 ticks (50 en phase 2) |

## Mesures
| Quoi | Résultat |
|---|---|
| **Le pilote (Diamant provisoire)** | bat le golem en **20,3 s** (1 219 ticks, scénario boss), **20,6 / 22,1 / 24,9 s** (min / médiane / max) sur 60 jours : **60 jours sur 60 gagnés** (59 sur 60 au BR0, ~22 s). Il tient le coup au lieu de le répéter, donc il gagne un peu plus vite malgré le rythme. |
| **Joueur immobile** (le pire cas pour l'attaque) | **perd en 11,9 s** (714 ticks, 3 cœurs) au lieu de ~9 s |
| **Rediffusion** | partie du jour du pilote : **87 changements, 363 caractères** (349 / 943 au BR0 : un coup tenu = un seul changement) ; 2 min, 30 monstres : 1 027 changements, 4 122 caractères ; 5 min : 2 705, 10 834. **Nouveau pire permis** : 8 000 changements (le plafond), une entrée à chaque tick où la direction (tous les 3) ou la visée (tous les 4) peut changer, **32 014 caractères pour 40 000 acceptés** (16 014 au BR0) |
| **Rejeu serveur** (Node, Xeon 2,1 GHz) | 2 min : **16 ms** (2,3 µs par tick), 5 min : **42 ms**, pire rejeu du jour (10 min, invincible) : **39 ms** (24 et 27 ms au BR0 : le pilote tient le coup, donc plus de combats). Cloud Run estimé 2 à 3 fois plus : < 120 ms. Une unité de plafond suffit |
| **Appels / triangles** (`?debug&fps`, Chromium sans GPU, processeur ralenti ×4, 844 × 390) | **arène, 30 monstres : 116 appels, ~40 000 triangles, 11 ms de dessin côté processeur** (×1 : 124, 42 600, 2,5 ms) ; **boss : 27 appels, 17 300 triangles, 5 ms** ; boss phase 2 : 38 appels, 19 800, 9 ms ; arène en 1920 × 1080 : 54 appels, 25 000, 7 ms. Le BR0 : ~317 appels. **Moins de 200 appels partout** (les décors, les membres et les yeux sont fusionnés). Les i/s (23 à 49) sont ceux du **rastériseur logiciel**, pas d'un téléphone : à confirmer sur un vrai appareil |
| **Poids** | premier chargement **42 715 o gzip** pour 44 Ko de plafond `rush.jsCss` (41 411 au BR0 : +1,3 Ko de catalogue, d'actions et de phase) ; la scène à la demande `corps-` : **164,5 Ko gzip** (161,5 au BR0 avec le kit) |

## Ce que je n'ai pas pu faire / vérifier
- **Rien n'a été joué dans des mains** : la souris, le clic maintenu, le stick droit sont vérifiés par des tests (sim, géométrie de la visée, e2e Playwright avec une vraie souris) mais **le stick droit n'a pas été essayé avec une vraie manette** (aucun test automatique de manette). Le ressenti du rythme est le travail de `?debug&tune`.
- **Firefox et WebKit non lancés** ici (le job `@navigateurs` de la CI les joue) ; le golden est le même rejoué dans Chromium (`determinisme.spec.ts` vert) — Node et Chromium sont tous deux V8.
- **Images par seconde sur téléphone : non mesurables ici.** Les captures sont celles d'un Chromium sans GPU, 844 × 390 et 1920 × 1080. J'ai regardé **plus de cinq captures** (la règle du lot R10 en demande cinq au plus) : régler la silhouette du golem sans les voir n'était pas possible ; les tailles du golem sont maintenant gardées par un test.
- **Ce que le rendu ne fait pas comme la cible** (en code, sans asset) : l'ombrage peint et les textures de la pierre (ici des aplats par face), le halo lumineux des yeux, les gemmes et le chemin en haut à gauche (BR1, BR2), les falaises détaillées. Le golem est **plus large que sa collision** (8 m de bras pour un disque de 1,7 m de rayon) : question ci-dessous.
- **Pas de nouvelle clé de stockage du navigateur** : les mentions légales ne bougent pas. Les `rush:*` restent à décrire avant `on` (règle R5).

## Ce que la plateforme devrait faire pour se rapprocher de la cible (hors zone, pour un lot de la plateforme)
La bande du haut est celle du kit (54 px, 14 % de la hauteur à 844 × 390) : chrono à gauche, fantôme et pause à droite. La cible n'a **pas de bande** : le HUD flotte sur la scène — le **chrono en pastille centrée** en haut, la **pause en pastille** en haut à droite, le nom « RUSH · DAILY RUN » en cartouche au-dessus des cœurs. Il faudrait que `@cdj/kit/jeu.css` laisse le jeu prendre toute la hauteur et que la bande devienne une surimpression en pastilles (papier, bordure de 2 px, ombre nette) ; le jeu y gagnerait 54 px de scène.

## Scénarios à 2 clics (derrière l'adresse du jeu ; en local `npm run dev -w @cdj/rush`)
- `?debug&scenario=boss` et `?debug&scenario=boss&phase=2` : le golem au nouveau rythme.
- `?debug&scenario=arene` : les vagues (8 au plus) ; `&monstres=30` : le test de charge.
- `?debug&scenario=vitrine` : la scène de la cible, figée ; `&tactile=1` montre le joystick et les boutons. `&tune` : les réglages (angle, distance, champ, rythme) ; `&fps` : les chiffres de la scène.
- Je n'ai pas pu vérifier l'adresse d'aperçu de la PR (le jeu est `off` : l'aperçu peut ne pas le publier) ; les scénarios n'existent pas en production.

## Questions pour Nathan
- **Rythme** : le golem laisse 80 à 100 ticks pour taper après chaque attaque, annonce 70 (50 en phase 2) : assez lent ? Le curseur « rythme » règle tout d'un coup (essayer 70 à 130 %). Le **pilote bat le golem en 20 s** : trop court pour un boss ? (120 points de vie ; le joueur humain reste à mesurer).
- **Coup tenu** : « maintenir = enchaîner » rend le pilote plus efficace qu'au BR0 ; faut-il une petite pause entre deux boucles de trois coups ?
- **Golem** : sa collision (1,7 m de rayon) est plus petite que ses bras (3,5 m du centre). Agrandir `RAYON_GOLEM` (une règle de la simulation, golden à refaire) ou le laisser ?
- **Visée** : sans assistance à la souris, avec une zone morte de 30 cm autour du chevalier ; trop exigeant ? **Manette** : stick droit seul, ou aussi la gâchette ?
- **Caméra** : 40° / 35° / 14 m, chevalier au tiers inférieur : plus proche encore ? Le recul face au golem (×1,5 au plus) fait-il « pomper » l'image à chaque attaque ?
- **Seed** : `docs/rush/seed.md` § 6 (« Les commandes ») dit encore « les mêmes au clavier et à la manette » : à toi de la mettre à jour (souris, clic maintenu, Espace, stick droit). **Carte du dépôt** : la racine `CLAUDE.md` n'a pas de ligne « Rush » et `apps/rush` n'a pas de `CLAUDE.md` propre ; le point d'entrée est `docs/rush/consignes.md` (mis à jour) — un lot de la plateforme peut ajouter la ligne.
