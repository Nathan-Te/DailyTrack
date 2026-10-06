# Seed — « Circuit du Jour » (titre provisoire)

Source de vérité du projet. Vit dans `docs/seed.md`, n'est modifié que par Nathan. Projet **web, court**, conçu pour être développé **entièrement dans le cloud** (Claude Code sur le web), sans PC.

*Version 2 (06/10/2026) : lots 0 à 6 livrés ; plan des lots 7 à 11 et leurs prompts ajoutés (§ 10 et § 12) ; surfaces, blocs à effet, virages relevés et thèmes intégrés au jeu ; hébergement corrigé (§ 7).*

---

## 1. Le jeu en une phrase
Chaque jour, un nouveau circuit court, le même pour tout le monde : on le parcourt en une minute dans le navigateur, on retente pour battre son temps et le fantôme du meilleur, et on partage son résultat en une ligne, comme un score de Wordle.

## 2. Les piliers
1. **Une minute par jour.** Un circuit de 30 à 60 secondes. On joue en pause café ; on revient demain.
2. **Le même circuit pour tous.** Un circuit par jour, généré à partir de la date, identique pour chaque joueur. C'est ce qui rend le classement et le partage intéressants.
3. **Zéro friction.** Un lien, ça démarre. Pas de compte, pas d'installation : un pseudo choisi au premier temps, mémorisé dans le navigateur.
4. **Un temps est une preuve.** La physique est **déterministe** : une course est entièrement décrite par la suite des commandes du joueur. Le serveur rejoue la course pour valider le temps, et la même rediffusion sert de fantôme.
5. **Lisible et nerveux.** Low-poly coloré, caméra derrière la voiture, sensations de vitesse ; un circuit se lit en un coup d'œil. **La conduite doit avoir la tenue de route et le mordant d'un Trackmania.**

## 3. Le jeu
- **La voiture** : une seule, arcade, au comportement inspiré de Trackmania — accélération franche, direction immédiate, adhérence forte avec une limite lisible, dérapage volontaire au frein, suspension qui suit le relief, réceptions qui récompensent un atterrissage propre, rebords qu'on peut frôler. Commandes : accélérer, freiner/reculer, tourner (analogique à la manette), **recommencer au dernier point de contrôle** (avec la vitesse du passage), **recommencer depuis le départ**. Clavier et manette, puis tactile.
- **Le circuit** : des **blocs** posés sur une grille, à la Trackmania — lignes droites, virages, **virages relevés**, pentes, bosses, tremplins ; un départ, des points de contrôle, une arrivée. Pas de boucles ni de murs verticaux au premier jalon.
- **Les surfaces** : **route** (référence), **terre** (glisse et se rattrape), **glace** (on anticipe tout), **herbe** (lente et glissante, à éviter).
- **Les blocs à effet** : **plaque d'accélération**, **super turbo**, **moteur coupé** (l'accélérateur n'agit plus jusqu'au point de contrôle suivant).
- **La course** : chronomètre au millième, temps intermédiaires aux points de contrôle (comparés à son meilleur et au fantôme), essais illimités dans la journée.
- **Les médailles** : bronze, argent, or et **temps de l'auteur**, calculés pour chaque circuit (§ 5).
- **Les fantômes** : son propre meilleur temps, et au choix celui du premier du classement ou du joueur juste devant soi.
- **L'écran d'arrivée** : temps, médaille, rang du jour, et la **ligne à partager** :
  `Circuit du Jour #142 — 47,312 s — 🥇 — 23e/812`
- **Les archives** : rejouer les circuits des jours précédents, avec le classement figé du jour et le fantôme du premier.

## 4. Direction artistique
Low-poly coloré et propre : blocs aux couleurs vives par type (route grise, plaques d'accélération jaunes, points de contrôle bleus, arrivée à damier), chaque surface et chaque bloc à effet reconnaissable au premier coup d'œil, ciel dégradé, quelques éléments de décor posés autour du circuit. **Un thème par jour** (§ 5) avec sa palette, pour que chaque circuit ait une identité. Une voiture low-poly **originale** et animée (roues, suspension, caisse), des effets (fumée, traces, particules par surface, turbo, étincelles) et des sons procéduraux. Pas de textures lourdes : le jeu doit se charger en quelques secondes, sur mobile aussi.

## 5. Le circuit du jour
- **Généré à partir de la date** (graine = date en UTC), par un générateur qui enchaîne des blocs selon des règles : pas d'auto-intersection, longueur cible, rythme (alternance de lignes droites et de virages), un ou deux passages marquants (tremplin, enchaînement serré), nombre de points de contrôle.
- **Un thème par jour**, tiré de la date : palette + poids des surfaces + règles de blocs à effet + un passage signature. Thèmes de départ : *Stade* (route, turbos, virages relevés), *Rallye* (terre), *Banquise* (glace), *Nuit* (route, moteur coupé, super turbos), *Campagne* (terre et herbe).
- **Validé par un pilote automatique** : un petit bot qui parcourt le circuit avec la même physique. S'il ne finit pas, le générateur recommence avec une graine voisine. Le temps du bot donne le **temps de l'auteur**, d'où découlent les autres médailles. Le bot doit approcher le niveau d'un bon joueur.
- **Plus tard, peut-être** : un circuit dessiné à la main le dimanche ; un éditeur.

## 6. Le classement
- Un **classement par jour** : meilleur temps de chaque joueur, rang, nombre de participants.
- **Validation par rediffusion** : le navigateur envoie la suite de commandes de la course ; le serveur **rejoue la course avec le même code de simulation** et n'enregistre que le temps qu'il a lui-même recalculé. Un temps falsifié ne passe pas.
- **Identité légère** : un identifiant aléatoire stocké dans le navigateur et un pseudo modifiable ; pas d'e-mail, pas de mot de passe. (Changer de navigateur = nouveau joueur, c'est accepté au premier jalon.)
- **Fantômes** : le serveur sert la rediffusion du premier et des voisins de classement.

## 7. Technique
- **TypeScript partout**, en monorepo :
  - `packages/sim` — la **simulation pure** (physique de la voiture, blocs, surfaces, collisions, chronométrage, générateur, bot) : **aucune dépendance au rendu ni au navigateur**, testée par Vitest en ligne de commande ;
  - `apps/web` — le jeu (Vite + **Three.js**), qui affiche ce que calcule `sim` ;
  - `apps/api` — le classement, qui importe le **même** `sim` pour rejouer les courses.
- **Déterminisme** : pas de temps fixe (120 par seconde, sous-pas fixes autorisés, interpolation à l'affichage) ; **pas de moteur physique externe** ; pas de `Math.sin`, `Math.cos`, `Math.exp`, `Math.atan2`, `Math.tanh` ni de fonctions dont le résultat peut varier d'un navigateur à l'autre dans la simulation — des implémentations à soi, ou des tables. Un test vérifie qu'une même rediffusion donne **exactement** le même temps dans Node et dans les navigateurs. Le rendu, les effets et les sons ne modifient **jamais** un résultat de `sim`.
- **Hébergement de l'API — à trancher avant la mise en ligne** : l'offre gratuite de Cloudflare Workers **ne suffit pas** (10 ms de calcul par requête, alors qu'un rejeu coûte ≈ 6 ms et une génération de circuit jusqu'à 500 ms). Options : **serveur de Nathan en Docker** (comme Vitrine, aucune limite) ou **Workers payant** (5 $/mois). Le jeu statique reste sur GitHub Pages / Cloudflare Pages, avec un aperçu par branche.
- **Tests** : Vitest pour la simulation (déterminisme, comportements de conduite chiffrés, générateur, validation par rediffusion) ; Playwright pour le jeu (rediffusion, rendu, mobile, tactile).
- **Intégration continue** : GitHub Actions lance les tests à chaque push et publie l'aperçu.

## 8. Méthode : le développer dans le cloud
- **Claude Code sur le web** (claude.ai/code, ou l'onglet Code de l'application mobile) : chaque lot est une **session cloud** sur le dépôt GitHub du projet. La session tourne même si on ferme le navigateur ou le téléphone, et propose ses changements sous forme de branche et de pull request.
- **Tester un lot en deux clics** : chaque lot a son **aperçu en ligne** (une URL par branche) et un **scénario d'essai** dans l'URL (`?scenario=pilotage`, `?seed=2026-10-06`, `?demo`…). Le README du lot commence par le lien direct. On teste depuis n'importe quel appareil, puis on fusionne la pull request.
- **Les règles habituelles** : un lot = une session neuve = une branche = une PR ; README d'une page dans `docs/lots/` ; chaque prompt de lot indique les modifications du `CLAUDE.md` que l'agent applique lui-même ; l'agent s'arrête quand les critères sont verts.
- **Enchaîner les lots** : pour lancer le lot suivant, Nathan ouvre une **session neuve** avec simplement :
  > *Lis `docs/seed.md` § 8 et § 12, puis fais le prochain lot.*

  L'agent détermine le prochain lot ainsi : c'est le **premier lot du § 12 dont la PR n'est pas fusionnée** dans `main` (voir le tableau § 2 de `docs/orchestration.md` et l'historique Git). Si la PR du lot précédent est encore ouverte, il **ne démarre rien** et le signale. S'il rencontre un **point d'arrêt** (marqué ⏸ au § 12), il s'arrête et attend Nathan. Il exécute ensuite le prompt du lot tel qu'il est écrit, et un seul lot par session.
- **Le quota** : Sonnet en effort moyen suffit pour la plupart des lots ; Opus effort élevé seulement pour la physique (lot 7).

## 9. Hors du jeu
Multijoueur en direct, comptes, éditeur de circuits, plusieurs voitures, réglages de voiture par le joueur, personnalisation, monétisation, musique, boucles et murs verticaux (au premier jalon).

## 10. Plan en lots

**Livrés** (détail dans `docs/orchestration.md` et `docs/lots/`) :
- **Lot 0 — Le socle** (#1) · **Lot 1 — La voiture** (#3) · **Lot 2 — Les blocs** (#6) · **Lot 3 — La rediffusion et le fantôme** (#7) · **Lot 4 — Le circuit du jour** (#8) · **Lot 5 — Le classement** (#9) · **Lot 6 — L'arrivée et le partage** (#10) · correctif CI (#11).

**À venir** (prompts au § 12) :
- **Lot 7 — Refonte de la conduite.** Modèle à deux essieux, suspension, réceptions, rebords, dérapage, direction analogique, caméras, panneau de réglage en direct, pilote adapté. **À tester** : la sensation sur `?scenario=pilotage`, puis réglages au panneau. ⏸ Retouche **7b** avec les réglages de Nathan.
- **Lot 8 — Surfaces, blocs à effet, thèmes.** Route, terre, glace, herbe ; super turbo, moteur coupé ; virages relevés ; un thème par jour. **À tester** : `?scenario=surfaces` et un circuit par thème.
- **Lot 9 — Feel & juice.** Voiture modélisée et animée, effets visuels, sons, mode `?demo`. **À tester** : `?scenario=surfaces&demo`, puis conduire soi-même.
- **Lot 10 — Tactile.** Direction au glissé, frein, accélérateur automatique, réglages. **À tester** : finir un tour au doigt sur téléphone.
- **Lot 11 — Historique.** Deux semaines de circuits passés avec pilotes fictifs, mode démo des archives. **À tester** : `?api=demo`, touche H.
- **Ensuite** : mise en ligne (hébergement de l'API, nom de domaine, `PREMIER_JOUR` réel) ; calibrage des médailles sur courses réelles ; **jalon** : une semaine de circuits joués par Nathan et quelques amis ; puis décor par thème, circuit dessiné du dimanche, publication sur un portail de jeux web.

## 11. Concurrence
**Trackmania** propose déjà un « circuit du jour » (Track of the Day) ; **PolyTrack**, un jeu de course low-poly dans le navigateur, a trouvé son public. La différence visée : le **format quotidien très court**, sans compte et sans installation, et le **partage en une ligne**.

---

## 12. Prompts des lots

Chaque prompt se suffit à lui-même. L'agent exécute le prompt du prochain lot (règle d'enchaînement au § 8), dans une session neuve.

### Lot 7 — Refonte de la conduite (tenue de route « à la Trackmania »)

**Modèle conseillé : Opus, effort élevé** (physique déterministe).

#### Contexte
- Lis `docs/orchestration.md` (état des lots 0–6, règles § 4, pièges § 8).
- Lots 0 à 6 et correctif #11 fusionnés. Pars de `main` à jour : `git fetch origin main && git checkout -B lot-7-conduite origin/main`.
- Retour de Nathan après avoir joué : la conduite actuelle fait **archaïque et bon marché**. On veut une vraie sensation Trackmania : tenue de route, handling, dérapage, réceptions, contacts avec les rebords. Constat annexe : sur le circuit du 06/10, Nathan a fait 37,903 s pour un temps d'auteur de 39,188 s — le pilote automatique est nettement plus lent qu'un humain correct.

#### Objet
Remplacer le modèle de voiture de `packages/sim` par un modèle arcade plus riche, réglable en direct, sans rien perdre du déterminisme.

#### Comportements visés (ce que Nathan doit ressentir)
1. **Accélération franche** : départ vif, courbe qui s'aplatit en approchant la vitesse de pointe. Garde la vitesse de pointe du même ordre que l'actuelle (mesure-la d'abord) pour ne pas casser les échelles du générateur, ou assume l'écart et retouche le générateur.
2. **Direction immédiate** : réponse sans mollesse ; angle de braquage qui diminue avec la vitesse ; la voiture pivote autour de son centre, pas de sous-virage pâteux.
3. **Adhérence avec une limite lisible** : grip latéral fort jusqu'à un seuil, puis **glisse contrôlée** ; une glisse coûte de la vitesse en proportion de son angle.
4. **Dérapage volontaire** : frein bref en virage à haute vitesse → l'arrière décroche, on tient la glisse à la direction, sortie propre en relâchant. Sur route, une trajectoire propre en grip reste plus rapide qu'un dérapage ; le dérapage sert dans les virages serrés.
5. **Freinage puissant**, marche arrière.
6. **Suspension** : la caisse suit les pentes et les bosses (4 points de contact), roulis et tangage ; une réception à plat garde la vitesse, une réception de travers en coûte et peut faire rebondir.
7. **En l'air** : gravité un peu appuyée pour des sauts lisibles ; pas de contrôle aérien (au plus un léger maintien de l'orientation).
8. **Rebords** : contact rasant = la voiture longe le rebord avec une petite perte ; choc de face = grosse perte et rebond ; **jamais coincé**.
9. **Plaque d'accélération** : poussée qui dépasse temporairement la vitesse de pointe, puis retour progressif.
10. **Reprise au point de contrôle** avec la vitesse et le cap du passage, départ arrêté pour « recommencer depuis le départ ».

#### À livrer
- **Modèle** : plan horizontal en modèle « bicyclette » (deux essieux, forces latérales avant/arrière selon le glissement : c'est l'équilibre entre les deux qui donne le caractère), hauteur et inclinaison par 4 points de contact sur `world`, balistique en l'air. Si la raideur de la suspension l'exige : **sous-pas fixes** dans `stepCar` (ex. 2 × 240 Hz), jamais variables.
- **Paramètres regroupés** dans un objet `CarParams` (valeurs par défaut dans `packages/sim`), passé à la simulation. **Prévoir l'accroche du lot 8** : l'adhérence et la résistance au roulement se lisent par roue via une fonction `surfaceAt(...)` qui renvoie des `SurfaceParams` (une seule surface « route » pour l'instant).
- **Direction analogique** : si la direction est aujourd'hui tout-ou-rien, la passer en entier analogique (ex. −64…64) ; manette = axe analogique avec zone morte ; clavier = plein braquage avec une montée très courte. Accélérateur et frein restent tout-ou-rien. Encodage de rediffusion mis à jour (version de format), toujours sans `-0`.
- **Caméra** (dans `apps/web`) : poursuite avec léger retard, champ de vision qui s'ouvre avec la vitesse, deux caméras (proche / loin) sur la touche **C** (et un bouton manette libre).
- **Panneau de réglage** `?debug&tune` : curseurs pour une quinzaine de paramètres clés (grip avant/arrière, seuil et perte de glisse, braquage, accélération, freinage, raideur et amortissement, gravité, perte sur rebord…), effet immédiat, bouton **« Copier les réglages »** (JSON). Une course jouée avec des réglages non par défaut **n'est jamais envoyée au classement** (et le dit à l'écran).
- **Scénario** `?scenario=pilotage` : circuit écrit à la main avec longue ligne droite, épingle, chicane rapide, grande courbe, bosses, tremplin avec réception, rebord à frôler, plaque d'accélération.
- **Pilote automatique** adapté au nouveau modèle (vitesses cibles par virage, points de freinage) pour que chaque circuit du jour reste validé dans la fenêtre 28–48 s ; il doit se rapprocher d'un humain correct.
- **Versions** : `SIM_VERSION` → 2, `GENERATOR_VERSION` → 2, rediffusions de référence régénérées. Aucun joueur réel : pas de migration, mais l'API refuse proprement une rediffusion d'une ancienne version (message clair), et les records locaux d'une ancienne version sont ignorés.

#### Critères d'arrêt
- `npm run typecheck && npm test` et `npm run test:e2e` verts (déterminisme Node ↔ Chromium/Firefox/WebKit inclus).
- **Tests de comportement chiffrés** dans `packages/sim/test/` (fixe les seuils, écris-les dans le README) : temps 0 → 100 km/h ; vitesse conservée dans la grande courbe en grip ; dérapage déclenché par un coup de frein en virage rapide ; contact rasant sur rebord ≥ 85 % de vitesse conservée ; réception à plat ≥ 95 % ; sortie d'un rebord de face en moins de 2 s ; 60 dates consécutives générées et validées par le pilote, avec le temps de génération mesuré.
- README `docs/lots/lot-7-conduite.md` (une page) qui **commence par le lien direct de l'aperçu de la branche** avec `?scenario=pilotage`, puis un second lien avec `?scenario=pilotage&debug&tune`.

#### Modifications de `CLAUDE.md` (à appliquer toi-même à la livraison)
- Nouvelle section **« Conduite »** : modèle (bicyclette + 4 contacts + balistique), fichiers concernés, `CarParams` et `SurfaceParams`, panneau `?tune`, tests de comportement.
- Section déterminisme : ajouter les fonctions mathématiques maison éventuellement créées (saturations en fonctions rationnelles, approximation d'angle…) et rappeler : pas de `Math.tanh/atan2/exp` ; modifier une valeur par défaut de `CarParams` = incrémenter `SIM_VERSION` + régénérer les références.
- Commandes : `?scenario=pilotage`, `?tune`, touche C.

#### Mettre aussi à jour
`docs/orchestration.md` : ligne du lot 7 dans le tableau § 2, décisions § 7, pièges nouveaux § 8.

#### Hors périmètre
Nouvelles surfaces et blocs à effet (lot 8), modèle 3D de la voiture, sons, particules (lot 9), tactile (lot 10). Pas de moteur physique externe.

#### Règles rappelées
Déterminisme strict de `sim` ; seul le temps rejoué par le serveur compte ; le jeu marche sans API ; ne jamais désactiver un test pour être vert.

#### Rapport attendu
Vérifié (et comment) / non vérifié / **décisions pour Nathan**, dont les 3–4 réglages qui changent le plus la sensation et ce que tu lui conseilles d'essayer en premier dans le panneau.

### ⏸ Point d'arrêt — retouche 7b (réglages de Nathan)

Après la fusion du lot 7, l'agent ne démarre **pas** le lot 8 tant que Nathan n'a pas fourni ses réglages. Nathan lance alors une session neuve (**Sonnet, effort moyen**) avec :
> *Lis `docs/seed.md` § 12, retouche 7b. Réglages : `{ …JSON copié depuis le panneau… }`*

**Objet** : appliquer ce JSON comme valeurs par défaut de `CarParams`, réajuster le pilote si besoin, `SIM_VERSION` et `GENERATOR_VERSION` +1, références régénérées, tests de comportement mis à jour. README `docs/lots/lot-7b-reglages.md` qui commence par le lien `?scenario=pilotage`. `CLAUDE.md` : mettre à jour les valeurs citées dans la section « Conduite ». Si Nathan écrit « pas de retouche », la 7b est considérée faite : noter-le dans `docs/orchestration.md` § 2.

### Lot 8 — Surfaces, blocs à effet et circuits à thèmes

**Modèle conseillé : Sonnet, effort moyen** (Opus si le pilote automatique résiste sur glace).

#### Contexte
- Lis `docs/orchestration.md`, puis `docs/lots/lot-7-conduite.md` (et `lot-7b-reglages.md` s'il existe).
- Lot 7 et retouche 7b fusionnés. Pars de `main` à jour : `git fetch origin main && git checkout -B lot-8-surfaces origin/main`.
- Le lot 7 a prévu l'accroche : `surfaceAt(...)` renvoie des `SurfaceParams` par roue, aujourd'hui une seule surface « route ».

#### Objet
Varier les circuits à la Trackmania : plusieurs surfaces au comportement distinct, quelques blocs à effet, virages relevés, et un **thème par jour** qui oriente le générateur.

#### À livrer
- **Surfaces** (attribut d'un bloc), chacune lisible au premier coup d'œil (couleur + motif léger, pas de texture lourde) :
  - **route** — la référence ;
  - **terre** — grip réduit, la voiture glisse facilement et se rattrape, accélération un peu plus molle ;
  - **glace** — grip très faible, direction lente à mordre, freinage long : on anticipe ;
  - **herbe** — ralentit nettement et glisse : à éviter, sert de raccourci risqué ou de bas-côté.
- **Blocs à effet** (couleur dédiée, effet lisible dans le HUD) :
  - **super turbo** (plus fort et plus long que la plaque actuelle) ;
  - **moteur coupé** : l'accélérateur n'agit plus jusqu'au prochain point de contrôle (on vit sur son élan).
  L'état de l'effet vit dans l'état de course, rejoué à l'identique.
- **Virages relevés**, au moins deux rayons, qui permettent de passer vite.
- **Thèmes** tirés de la date (§ 5), chacun = palette (réutilise et étends les 4 existantes) + poids des surfaces + règles de blocs à effet + un **passage signature** : *Stade*, *Rallye*, *Banquise*, *Nuit*, *Campagne*. Le nom du thème s'affiche dans l'en-tête comme aujourd'hui.
- **Générateur et pilote** : le pilote tient compte de la surface pour ses vitesses cibles et ses points de freinage ; chaque thème produit des circuits validés dans la fenêtre 28–48 s ; temps de génération mesuré (rester sous ~1 s au pire, le serveur met en cache).
- **Scénarios** :
  - `?scenario=surfaces` — circuit écrit à la main qui enchaîne chaque surface, chaque bloc à effet et un virage relevé ;
  - `?seed=AAAA-MM-JJ&theme=<nom>` — force un thème pour les essais. Une course avec thème forcé n'est **jamais** envoyée au classement.
- **Versions** : `SIM_VERSION` +1, `GENERATOR_VERSION` +1, références régénérées.

#### Critères d'arrêt
- `npm run typecheck && npm test` et `npm run test:e2e` verts.
- Tests chiffrés : distance de freinage glace > terre > route ; vitesse de passage d'un même virage route > terre > glace ; le moteur coupé s'arrête exactement au point de contrôle suivant ; sur 60 dates, chaque thème apparaît et tous les circuits sont validés par le pilote.
- README `docs/lots/lot-8-surfaces-themes.md` qui **commence par le lien direct de l'aperçu** avec `?scenario=surfaces`, puis un lien par thème (`?seed=…&theme=…`).

#### Modifications de `CLAUDE.md` (à appliquer toi-même à la livraison)
- Nouvelle section **« Surfaces et blocs à effet »** : liste, `SurfaceParams` de chacune, où les ajouter, règle « nouvelle surface ou nouveau bloc = `SIM_VERSION` +1 ».
- Nouvelle section **« Thèmes »** : comment un thème est choisi à partir de la date, ce qu'il règle, comment en ajouter un, règle « changer un thème = `GENERATOR_VERSION` +1 ».
- Commandes : `?scenario=surfaces`, `?theme=`.

#### Mettre aussi à jour
`docs/orchestration.md` (§ 2 ; § 7 : la décision « pas de banquettes » est levée ; § 8).

#### Hors périmètre
Particules, sons et effets de surface visuels poussés (lot 9) ; décor riche autour du circuit ; boucles et murs verticaux ; éditeur.

#### Règles rappelées
Déterminisme strict de `sim` ; seul le temps rejoué par le serveur compte ; le jeu marche sans API ; ne jamais désactiver un test.

#### Rapport attendu
Vérifié / non vérifié / décisions pour Nathan (thèmes retenus, fréquence de chacun, l'herbe doit-elle rester une surface jouable ou seulement un bas-côté).

### Lot 9 — Feel & juice : voiture, effets visuels, sons

**Modèle conseillé : Sonnet, effort moyen.**

#### Contexte
- Lis `docs/orchestration.md`, `docs/lots/lot-7-conduite.md` et `docs/lots/lot-8-surfaces-themes.md` ; direction artistique au § 4 de ce document.
- Lot 8 fusionné. Pars de `main` à jour : `git fetch origin main && git checkout -B lot-9-juice origin/main`.
- Aujourd'hui la voiture est un assemblage de boîtes, sans son ni effet.

#### Objet
Rendre chaque course vivante et nerveuse **sans toucher au résultat d'une course** : tout se passe dans `apps/web`.

#### À livrer
- **Voiture** : modèle low-poly **original** construit en code (pas de copie de la voiture Stadium ni d'aucun véhicule existant) — carrosserie profilée, habitacle, aileron, **4 roues séparées** qui tournent selon la vitesse et braquent, suspension visible (les roues suivent les points de contact), roulis et tangage de la caisse, feux stop au freinage. Fantôme visuellement distinct (translucide, teinte froide).
- **Effets visuels** :
  - fumée de pneus en glisse ; **traces de pneus** au sol (rubans en nombre limité, recyclés) ;
  - particules par surface : poussière (terre), éclats (glace), brins (herbe) ;
  - flamme / traînée sur turbo et super turbo, indicateur « moteur coupé » ;
  - étincelles au contact d'un rebord, poussière et petite secousse de caméra à la réception ;
  - lignes de vitesse au-delà d'un seuil, coup de champ de vision au turbo ;
  - flash au point de contrôle, confettis à l'arrivée, éclat de médaille.
- **Sons** (Web Audio, **procéduraux de préférence**, sinon fichiers CC0 listés avec leur licence dans `docs/credits.md`) : moteur (régime lié à la vitesse, rapports simulés côté son seulement), crissement selon le glissement, roulement selon la surface, vent, impacts, turbo, bip de point de contrôle, décompte, arrivée, médaille. Le son démarre au premier geste du joueur (règle des navigateurs). **Volume + muet** (touche **M**), mémorisés.
- **Télémétrie en lecture seule** : si le rendu a besoin d'infos de `sim` (glissement par roue, contact, surface, impact, réception), expose-les **sans modifier aucun résultat** : les tests golden doivent passer **sans régénération** et `SIM_VERSION` ne bouge pas.
- **Performance** : mesure le coût image par image (Playwright, Chromium, profil mobile avec CPU ralenti ×4) ; qualité automatique qui réduit particules et traces si l'image dépasse le budget ; poids ajouté au chargement ≤ 300 Ko compressés.
- **Scénario démo** `?demo` : le pilote automatique conduit le circuit (du jour, ou celui de `?scenario=`/`?seed=`) en boucle, toutes les caméras et effets actifs — pour juger le rendu en un clic (et servir plus tard de bande-annonce).

#### Critères d'arrêt
- `npm run typecheck && npm test` et `npm run test:e2e` verts, **références golden inchangées**, aucune modification de résultat dans `packages/sim`.
- Mesure de performance consignée dans le README (ms par image avant/après, profil mobile).
- README `docs/lots/lot-9-juice.md` qui **commence par le lien direct de l'aperçu** avec `?scenario=surfaces&demo`, puis `?scenario=pilotage` pour conduire soi-même.

#### Modifications de `CLAUDE.md` (à appliquer toi-même à la livraison)
- Nouvelle section **« Rendu, effets et sons »** : fichiers, budget de performance, qualité automatique, règle « le rendu ne modifie jamais un résultat de `sim` ; la télémétrie est en lecture seule », sons procéduraux ou CC0 crédités.
- Commandes : `?demo`, touche M.

#### Mettre aussi à jour
`docs/orchestration.md` (§ 2, § 8 si pièges, notamment perf et audio).

#### Hors périmètre
Commandes tactiles (lot 10), décor riche autour du circuit, personnalisation de la voiture, musique.

#### Règles rappelées
Déterminisme strict de `sim` ; le jeu marche sans API ; ne jamais désactiver un test ; mesurer plutôt que supposer.

#### Rapport attendu
Vérifié / non vérifié (dont : rendu réel sur téléphone, son sur iOS) / décisions pour Nathan (style des sons, intensité des secousses).

### Lot 10 — Commandes tactiles

**Modèle conseillé : Sonnet, effort moyen.**

#### Contexte
- Lis `docs/orchestration.md` (§ 7 question 3 : sur téléphone on ne peut pas conduire), `docs/lots/lot-7-conduite.md` (direction analogique entière) et `docs/lots/lot-9-juice.md`.
- Lot 9 fusionné. Pars de `main` à jour : `git fetch origin main && git checkout -B lot-10-tactile origin/main`.

#### Objet
Pouvoir finir un tour au doigt sur téléphone, avec une conduite aussi fine qu'à la manette.

#### À livrer
- **Détection** : interface tactile si l'appareil est tactile (`pointer: coarse`), forçable sur ordinateur avec `?touch=1` (la souris simule le doigt).
- **Disposition (paysage)** :
  - moitié gauche : **direction par glissement horizontal** relatif au point de pose (analogique, zone morte, sensibilité réglable) ; option « deux boutons ← → » ;
  - moitié droite : **frein / marche arrière** ; **accélérateur automatique** par défaut, option « accélérateur manuel » (bouton) ;
  - boutons **reprise au point de contrôle**, **recommencer**, **pause** ; menus (fantôme, archives, partage) en cibles d'au moins 44 px ;
  - multi-doigts : diriger et freiner en même temps.
- **Confort** : en portrait, invitation à tourner le téléphone ; bouton plein écran quand le navigateur le permet ; pas de zoom, de défilement, de menu d'appui long ni de double-tap ; vibration courte au point de contrôle et au choc si disponible (désactivable).
- **Réglages** mémorisés : mode de direction, sensibilité, zone morte, accélérateur auto, vibration.
- Le tactile passe par la **même chaîne de commandes** que le clavier et la manette : commandes entières, rediffusions identiques, rien ne change dans `sim`.

#### Critères d'arrêt
- `npm run typecheck && npm test` et `npm run test:e2e` verts, références golden inchangées.
- Test Playwright en émulation mobile (`hasTouch`, gabarits téléphone Android et iPhone) : des gestes tactiles synthétiques produisent les commandes attendues et **terminent le circuit `?scenario=plat`** ; mise en page sans chevauchement (police DejaVu Sans imposée, cf. piège § 8 de l'orchestration) en paysage et en portrait.
- README `docs/lots/lot-10-tactile.md` qui **commence par le lien direct de l'aperçu à ouvrir sur le téléphone** avec `?scenario=pilotage`, puis le lien du circuit du jour.

#### Modifications de `CLAUDE.md` (à appliquer toi-même à la livraison)
- Nouvelle section **« Commandes tactiles »** : fichiers, disposition, réglages, `?touch=1`, règle « le tactile produit les mêmes commandes entières que les autres entrées ».
- Retirer la mention « tactile non fait » si elle y figure.

#### Mettre aussi à jour
`docs/orchestration.md` (§ 2 ; § 7 question 3 marquée résolue).

#### Hors périmètre
Gyroscope (inclinaison du téléphone) — à proposer dans le rapport si tu le juges utile ; application installable.

#### Règles rappelées
Déterminisme strict de `sim` ; le jeu marche sans API ; ne jamais désactiver un test.

#### Rapport attendu
Vérifié / non vérifié (un vrai téléphone n'a pas été testé par toi : le dire) / décisions pour Nathan (mode de direction par défaut, accélérateur auto ou non).

### Lot 11 — Historique de circuits et mode démo des archives

**Modèle conseillé : Sonnet, effort moyen.**

#### Contexte
- Lis `docs/orchestration.md`, `docs/lots/lot-5-classement.md` et `docs/lots/lot-6-arrivee-et-archives.md`.
- Lot 10 fusionné. Pars de `main` à jour : `git fetch origin main && git checkout -B lot-11-historique origin/main`.
- Problème : le circuit #1 est celui du 06/10/2026, les archives sont donc vides ; et l'aperçu de branche n'a pas d'API (hébergement pas encore décidé), donc aucun classement visible en deux clics.

#### Objet
Disposer d'un historique de circuits passés, avec classements et fantômes crédibles, consultable depuis les archives — en local comme dans l'aperçu — **sans jamais polluer un futur classement réel**.

#### À livrer
- **Premier jour configurable** : une constante unique `PREMIER_JOUR` (numéro #1), réglée **provisoirement sur 2026-09-22** pour avoir deux semaines d'archives ; elle sera fixée à la vraie date de lancement à la mise en ligne. Les circuits ne changent pas (graine = date), seule la numérotation bouge.
- **Pilotes fictifs** : script `npm run history:seed` qui, pour chaque jour passé, fait courir 8 à 15 pilotes au pseudo manifestement fictif, conduits par le pilote automatique avec des niveaux variés (bruit de trajectoire, vitesses de virage) pour obtenir des temps étalés autour des médailles. Leurs courses **passent par le même chemin de validation** que les vraies (rejeu serveur, aucune voie de contournement). Joueurs marqués `demo` en base ; le script refuse de tourner sur une base de production.
- **Mode démo** `?api=demo` : le jeu lit un jeu de données statique généré par le script (`apps/web/public/demo/…`, classements + rediffusions des premiers) à la place de l'API, pour que l'aperçu de branche montre des archives complètes. Taille du jeu de données mesurée et raisonnable.
- **Archives** : liste des jours (numéro, date, thème, médailles, ton meilleur temps et ta médaille s'il existe, rang figé du jour) ; ouvrir un jour = le rejouer avec le fantôme du premier et le classement figé affiché ; accès direct `?day=AAAA-MM-JJ`.
- **Régénérable** : après chaque changement de `SIM_VERSION` ou `GENERATOR_VERSION`, relancer `history:seed` suffit ; un test vérifie que le jeu de données démo correspond aux versions actuelles (sinon message clair : « relancer history:seed »).

#### Critères d'arrêt
- `npm run typecheck && npm test` et `npm run test:e2e` verts, références golden inchangées.
- Test e2e : avec `?api=demo`, les archives listent 14 jours, l'ouverture d'un jour affiche son classement figé et charge le fantôme du premier.
- README `docs/lots/lot-11-historique.md` qui **commence par le lien direct de l'aperçu** avec `?api=demo` (puis touche H ou bouton Archives), et un second lien `?api=demo&day=2026-09-30`.

#### Modifications de `CLAUDE.md` (à appliquer toi-même à la livraison)
- Nouvelle section **« Historique et mode démo »** : `PREMIER_JOUR` et sa valeur provisoire, `npm run history:seed`, `?api=demo`, `?day=`, règle « les joueurs `demo` n'existent jamais en production ; relancer le script après tout changement de version ».

#### Mettre aussi à jour
`docs/orchestration.md` (§ 2 ; § 7 : décision `PREMIER_JOUR` provisoire à revoir à la mise en ligne).

#### Hors périmètre
Hébergement réel de l'API, calibrage des médailles, circuit dessiné du dimanche.

#### Règles rappelées
Ne jamais faire confiance à un temps annoncé (même pour les pilotes fictifs) ; déterminisme strict de `sim` ; le jeu marche sans API.

#### Rapport attendu
Vérifié / non vérifié / décisions pour Nathan (nombre de jours d'historique, faut-il garder le mode démo après la mise en ligne).

### ⏸ Fin des lots écrits

Après le lot 11, l'agent s'arrête : les lots suivants (mise en ligne, calibrage, jalon) seront rédigés avec Nathan.
