# Lot BR0c — Rush : des coups lourds, et un rendu au niveau de la cible

Suite de BR0b. Jeu `off`, non publié : golden et format libres (golden **régénéré**, `RUSH_SIM_VERSION` 2 → **3** : le coup, les dégâts, le recul, l'engagement et les points de vie ont changé). **Pour les joueurs : rien** (jeu `off`). Règles qui en sont issues : `docs/rush/consignes.md` (« L'impact », « Le pipeline de rendu… », « La caméra »), `apps/rush/CLAUDE.md` (nouveau : la section « Rush »).

## 1. Le coup : plus lent, plus lourd (`packages/rush-sim`)
| | BR0b | **BR0c** (toutes dans `?debug&tune`) |
|---|---|---|
| Durée d'un coup · du coup final | 17 · 24 ticks | **30 · 42** (`cadence`) |
| Anticipation · phase active · récupération | impact au tick 5 | **6 · 4 · ~20** (`anticipation` ; le coup final 8 · 4 · 30) |
| Dégâts d'un coup · du coup final | 1 · 2 (gelée 3, chauve 1, golem 120) | **16 · 40** (×1,6 ; ×2,5 : `degats`, `coupFinal` ; gelée 30, chauve 10, **golem 1 000**) |
| Engagement pendant un coup | élan de 30 à 80 cm | **40 % de la vitesse** (`engagement`), dans la direction tenue, sinon vers le coup pendant la phase active |
| Marche | 520 cm/s | **468** (−10 %) ; la course de l'esquive garde sa longueur |
| Recul des monstres | 36 · ×1,8 au coup final | **48 · ×2** ; puis **ils titubent** (16 ticks, 32 au coup final) : une cible touchée ne fait rien |
| Enchaînement tenu | le 2ᵉ coup partait 3 ticks après l'impact | **à la fin du coup, jamais avant** (mémoire de l'appui : 16 ticks) |
Le golem a un sursaut sous chaque coup (rendu), sans être interrompu. **Combat du pilote : ~32 s** (boss : 31,9 s ; 60 jours : 32,0 / 35,9 / 45,9 s min / médiane / max ; la partie du jour mesurée : 35,8 s) avec 1 000 points de vie. Un joueur immobile perd en 11,9 s (inchangé). *Interprétation* : « ×1,6 par coup et ×2,5 sur le 3ᵉ » = 16 aux coups 1 et 2, 40 au 3ᵉ (×2,5 d'un coup ordinaire).
**Le pilote** (`bot.ts`) a dû être retouché : un coup de 30 ticks engage (il ne marche qu'à 40 % pendant), donc il part dès qu'un cercle est posé (80 ticks), esquive (ce qui coupe le coup) si le cercle le rattrape, **esquive l'onde dès qu'elle part quand il est collé au golem** (l'ancienne formule ignorait la demi-épaisseur de l'anneau) et garde l'esquive pour l'onde. Il gagne **58 jours sur 60** (60 au BR0b) : deux jours perdus restent, le test e2e du jour (`jouerLeJour`, 5 ticks d'attente) gagne.
Nouveau scénario `?scenario=mannequin` (`partie.ts`, `monterMannequin`) : six gelées immobiles qui rentrent à leur place après un coup, un golem qui ne frappe pas ; rien ne meurt, rien ne blesse.

## 2. L'impact sans saccade (`corps.ts`, `sons.ts`)
Coups 1 et 2 : **aucun arrêt sur image** — éclair blanc (4 images), écrasement-rebond de la cible (ressort amorti), recul (sim), poussée de caméra de 7 cm dans le sens du coup, éclats. **Arrêt sur image seulement au coup final (90 ms) et au coup qui passe le golem en phase 2 (150 ms)** ; `arretDuCoup` garantit un seul arrêt par coup (`coupId`) et 300 ms d'écart. Plus d'arrêt à la mort, à la victoire, au dégât reçu ni aux impacts du golem. **Secousse** : coup final et attaques du golem seulement. Son : couche grave sous chaque impact ; souffle d'épée plus long (0,3 s, 0,4 s au coup final) qui part ~0,07 s après le début du coup ; l'arc blanc ne paraît qu'à la phase active.

## 3. Rendu (`apps/rush`)
a. **Cadrage** : 46°, 34 m, champ 25° (curseurs conservés) ; le chevalier fait ~7,5 % de la hauteur de l'écran (test), sans déformation ; la vitrine a le même cadre que le jeu. b. **Golem** : une douzaine de gros blocs arrondis irréguliers à l'ombrage lisse, torse penché, poings énormes, yeux ambre à halo qui pulsent, sourcils froncés. c. **Contour** : en haute, post-traitement sur la profondeur (~2,5 px à 1080, silhouettes) ; en basse, coque inversée à épaisseur constante à l'écran. d. **Lumière** : rampe toon à 5 paliers doux, hémisphérique, liseré, **vraies ombres portées** (1 024, bord adouci), brume. e. **Post-traitement** (`rendu.ts`) : bloom demi-résolution, **une passe de composition** (contour, bloom, étalonnage chaud, vignettage, sRGB), FXAA. f. **Fond** : falaises de blocs, 5 îles lointaines à sommet d'herbe, nuages, ciel en dégradé. g. **Sol et muret** : petites dalles (1,3 m) à deux tons, variation par dalle, joints, dalles fêlées, grains (canvas) ; cailloux, touffes d'herbe, muret à gros poteaux. h. **Personnages** : chevalier chibi (casque à fente, plume, épée longue), gelée en dôme écrasé à petit reflet, chauve-souris à grandes ailes à doigts. i. **Effets** : cercles corail translucides à bord clair, cratère et poussière à l'impact, lignes de vitesse plus longues. j. **HUD** : pastilles à bord d'encre de 3 px, cœurs de 34 px, barre du golem épaisse (nom, phase), « Coup » (112 px) et « Esquive » (104 px) grands avec grosses icônes, Archivo Black (police importée). k. **Qualité** : `?qualite=haute|basse` ; sinon haute avec passage automatique en basse sous 30 i/s pendant ~1,5 s. **En basse** : ombres en disques, pas de post-traitement ni de carte d'ombre, contour par coque.
Pas de nouvelle clé de stockage : les mentions légales ne bougent pas.

## 4. Boucle de comparaison (captures 1920 × 1080 de `?scenario=vitrine`, à côté de `cible-ia.png`)
- **Tour 1** (`vitrine-BR0c-1.png`) — écarts : golem illisible en vue de trois quarts (blocs empilés, tête cachée derrière les épaules, yeux invisibles) ; sol trop orange ; golem coupé par le haut ; îles envahissantes ; ombres bleues.
- **Tour 2** (`-2.png`) — corrections : lumière hémisphérique chaude, sol plus clair, îles réduites et reculées, tête agrandie et relevée, couleurs des blocs séparées ; écarts : golem encore de profil (pose figée trop tournée), haut du golem au ras du bord, yeux faibles, gelées petites.
- **Tour 3** (`-3.png`, et `vitrine-BR0c-comparaison.png` : cible | vitrine) — corrections : golem de face, repositionné, yeux plus brillants (×3,4), gelées ×1,15. **Écarts restants**, ce que le code seul n'atteindra pas ou pas encore : la **matière** de la pierre (le golem de la cible a des plans taillés, des fissures, un ombrage peint ; ici des blocs lisses de deux ou trois tons — le choix « sans facettes » demandé donne un golem plus doux, plus « jouet ») ; **les traits intérieurs** du golem (le contour par la profondeur cerne les silhouettes et peu les arêtes entre blocs) ; le **chevalier** est plus blanc (le casque cache le corps jaune vu d'en haut) et plus petit que celui de la cible ; **chemin, gemmes et décor du coin haut gauche** (BR1, BR2) ; l'**angle** : la cible est vue plus bas, avec un sol plus allongé (nous : 46°, dans la fourchette demandée) ; la bande du kit en haut (question ci-dessous) ; la poussière et le cratère ne sont pas dans la vitrine figée (ils naissent d'un impact).

## 5. Performances et poids (Chromium sans GPU, processeur ralenti ×4, 844 × 390, `?debug&fps`)
| | haute | basse |
|---|---|---|
| `scenario=arene&monstres=30` | 133 appels · 143 k triangles · 9,4 ms de dessin · 30 i/s | 109 appels · 156 k · 8,9 ms · 33 i/s |
| `scenario=boss` | 48 appels · 123 k · 22,7 ms · 34 i/s | 32 appels · 138 k · 40,9 ms · 38 i/s |
| `scenario=boss&phase=2` | 51 appels · 125 k · 20,2 ms · 33 i/s | 49 appels · 148 k · 19,7 ms · 37 i/s |
**Moins de 200 appels partout** (les appels comptent l'image entière : carte d'ombre, scène, quatre passes). Les **triangles dépassent la cible de 40 000 du BR0b** : les blocs arrondis (golem, décor) en comptent beaucoup et la haute les dessine deux fois (carte d'ombre) ; la basse les double avec les coques. Les i/s sont ceux d'un rastériseur logiciel ralenti, **pas ceux d'un téléphone** : à mesurer sur un vrai appareil (la bascule automatique est faite pour cela). **Poids** : premier chargement **42,97 Ko gzip** pour 44 Ko (42,72 au BR0b : le catalogue, la police Archivo Black et les curseurs) ; la scène à la demande `corps-` : **174,8 Ko gzip** (164,5 au BR0b : +10,3 Ko, dont le pipeline de rendu et le FXAA).
Simulation (`npm run mesures:rush -w @cdj/rush-sim`) : rejeu 2 min / 30 monstres 19 ms, 5 min 49 ms, pire rejeu du jour 26 ms ; rediffusion de la partie du jour du pilote 786 caractères (un coup tenu = un changement), pire permis 32 014 pour 40 000 (inchangé).

## 6. Scénarios à 2 clics (en local : `npm run dev -w @cdj/rush`, puis ces adresses)
- `/?debug&scenario=mannequin` : le coup, l'impact, l'enchaînement tenu (clic maintenu).
- `/?debug&scenario=vitrine` : la composition de la cible ; `&qualite=basse` pour comparer ; `&tactile=1` montre les boutons.
- `/?debug&scenario=boss` (et `&phase=2`) : le combat complet ; `&tune` : les curseurs ; `&fps` : les chiffres.
Ils n'existent pas en production. Je n'ai pas pu vérifier l'adresse d'aperçu de la PR.

## 7. Tests et ce qui n'est pas vérifié
Sim entière (86 tests : rythme du coup, dégâts, engagement, recul, mannequin, phase 2), camera (10), acteurs (6), e2e Rush (13, dont deux nouveaux : mannequin, niveaux de qualité), consignes, traductions régénérées ; golden régénéré. **Une ligne hors de la zone de Rush** : `apps/portail/test/consignes.test.ts` (« un CLAUDE.md de plus s'ajoute à cette liste »), et `docs/plateforme/traductions.md` régénéré (exception prévue). **Non vérifié** : le ressenti (rien n'a été joué à la main ni sur téléphone), la manette, Firefox et WebKit (job `@navigateurs`), les i/s d'un vrai appareil, la lisibilité du contour par la profondeur sur d'autres GPU (`derivée seconde de 1/z` : seuils réglés sur le rendu logiciel).

## Questions pour Nathan
- **Qualité** : le kit n'a pas de réglage de qualité (Track a le sien, `cdj:qualite`, hors du kit) ; faut-il en créer un commun (un lot de la plateforme) ou garder « haute + bascule automatique » ?
- **Bande du kit** (rappel du BR0b) : la cible n'a pas de bande, son HUD flotte (chrono en pastille centrée, pause en pastille, nom « RUSH · DAILY RUN » au-dessus des cœurs). Un lot de la plateforme devrait laisser le jeu prendre toute la hauteur et transformer la bande en surimpression de pastilles à bord d'encre de 3 px.
- **Dégâts** : « ×1,6 et ×2,5 sur le 3ᵉ » lu comme 16 / 16 / 40 ; si tu voulais 16 / 16 / 64 (×2,5 de l'ancien coup final ×1,6), c'est `coupFinal` = 400.
- **Golem plus « taillé » ?** Les blocs lisses demandés sont plus doux que la cible : un compromis (blocs lisses + quelques plans taillés) est possible sans asset.
- **Triangles** : viser de nouveau 40 000 (blocs moins arrondis, moins de segments) ou accepter ~130 000 ? À décider avec une mesure sur téléphone.
- **Pilote** : 58 jours sur 60 gagnés au lieu de 60 ; le Diamant provisoire reste jouable, mais les deux jours perdus donneraient un Diamant « perdu » : à traiter avec la vraie méthode des médailles.
- **Racine** : `CLAUDE.md` n'a toujours pas de ligne « Rush » dans sa carte du dépôt (hors zone) ; la section Rush est dans le nouveau `apps/rush/CLAUDE.md`.
