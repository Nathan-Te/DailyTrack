# Seed — « Circuit du Jour » (titre provisoire)

Source de vérité du projet. Vit dans `docs/seed.md`, n'est modifié que par Nathan. Projet **web, court**, conçu pour être développé **entièrement dans le cloud** (Claude Code sur le web), sans PC.

*Version 5 (08/10/2026) : lots 0 à 18 livrés. Ajoutés : cuves qui font gagner de la vitesse, deux pédales par défaut sur téléphone, atterrissages sans rebond et contrôle en l'air à la Trackmania, générateur à « figures » (passages techniques, sauts sur éléments techniques, moins de répétition). Prompts au § 12.*

---

## 1. Le jeu en une phrase
Chaque jour, un nouveau circuit court, le même pour tout le monde : on le parcourt en 30 à 45 secondes dans le navigateur, on retente pour battre son temps et le fantôme du meilleur, et on partage son résultat en une ligne, comme un score de Wordle.

## 2. Les piliers
1. **Moins d'une minute par jour.** Une course de **30 à 45 secondes, grand maximum**. On joue en pause café ; on revient demain.
2. **Le même circuit pour tous.** Un circuit par jour, généré à partir de la date (ou une variante choisie à l'avance, § 5), identique pour chaque joueur.
3. **Zéro friction.** Un lien, ça démarre. Pas de compte, pas d'installation : un pseudo choisi au premier temps, mémorisé dans le navigateur.
4. **Un temps est une preuve.** La physique est **déterministe** : une course est entièrement décrite par la suite des commandes du joueur. Le serveur rejoue la course pour valider le temps, et la même rediffusion sert de fantôme.
5. **Vite, technique et lisible.** Low-poly coloré, caméra derrière la voiture, de vraies pointes de vitesse **et de vrais passages techniques** ; un circuit se lit en un coup d'œil. **La conduite a la tenue de route, le mordant et la démesure d'un Trackmania** : relief, sauts, murs, contrôle en l'air.

## 3. Le jeu
- **La voiture** : une seule, arcade, inspirée de Trackmania — accélération franche, direction immédiate, adhérence forte avec une limite lisible, dérapage au frein, suspension qui suit le relief, rebords qu'on peut frôler, vitesse qui grimpe dans les descentes et sur les turbos, capacité à rouler sur une paroi tant qu'on va assez vite.
- **En l'air** : la voiture garde la rotation que lui a donnée son décollage (elle peut piquer du nez, se cabrer, pencher) ; **appuyer sur le frein en l'air la fige** dans son orientation. **À l'atterrissage, elle se pose** : pas de rebond ; une réception bien alignée garde la vitesse, une réception de travers en coûte.
- **Commandes** : accélérer, freiner/reculer (et figer la voiture en l'air), tourner (analogique à la manette), **recommencer au dernier point de contrôle** (avec la vitesse du passage), **recommencer depuis le départ**. Clavier, manette et tactile (**deux pédales par défaut** : gaz et frein ; accélérateur automatique en option).
- **Le circuit** : des **blocs** sur une grille, à la Trackmania — lignes droites, virages serrés, courbes amples, virages relevés, montées et descentes sur plusieurs niveaux, crêtes, vrais sauts au-dessus du vide, **cuves** (demi-tubes, murs latéraux, virages en cuve). La largeur de la piste varie. Le circuit s'assemble à partir de **figures** : passages **techniques**, **portions rapides**, **sauts sur des éléments techniques** (atterrir dans un virage, dans une cuve, sur une route étroite…), combinaisons. Pas de boucles au premier jalon.
- **Les cuves font gagner de la vitesse** : monter sur la paroi puis redescendre fait sortir plus vite que rester au fond.
- **Les revêtements** (par bloc) : **route**, **terre** (glisse et se rattrape), **glace** (la plus rapide en ligne droite, très peu d'adhérence à l'accélérateur ; en roue libre, gauche-droite permet de se rediriger), **herbe** (lente et glissante).
- **Les blocs à effet** : **plaque d'accélération**, **super turbo**, **moteur coupé**.
- **Tomber** : une voiture qui rate un saut ou quitte la piste par le vide reprend automatiquement au dernier point de contrôle (le chrono continue).
- **La course** : chronomètre au millième, temps intermédiaires aux points de contrôle, essais illimités dans la journée.
- **Les médailles** : bronze, argent, or et **temps de l'auteur** (§ 5).
- **Les fantômes** : son propre meilleur temps, et au choix celui du premier du classement ou du joueur juste devant soi.
- **L'écran d'arrivée** : temps, médaille, rang du jour, et la **ligne à partager** :
  `Circuit du Jour #142 — 37,312 s — 🥇 — 23e/812`
- **Les archives** : la liste des jours passés avec une **miniature en vue aérienne**, le thème, les médailles et ta place figée ; on rejoue un jour avec le fantôme du premier et le classement figé.

## 4. Direction artistique
Low-poly coloré et propre : blocs aux couleurs vives par type, chaque revêtement et chaque bloc à effet reconnaissable au premier coup d'œil, ciel dégradé, soleil ou lune, montagnes et décor propres à chaque thème. La vitesse se voit (bord de piste qui défile, marquages, champ de vision, lignes de vitesse, vent). Les sections surélevées ont des piliers et laissent voir le vide ; les parois de cuve sont en damier. Une voiture low-poly originale et animée, des effets et des sons procéduraux. Pas de textures lourdes : le jeu se charge en quelques secondes, sur mobile aussi.

## 5. Le circuit du jour
- **Généré à partir de la date** (graine = date en UTC) par **assemblage de figures** tirées d'une bibliothèque (techniques, rapides, sauts techniques, combinaisons), avec leurs variantes (miroir, largeur, revêtement, niveau). Règles : pas d'intersection au même niveau ; au moins deux largeurs ; peu de virages serrés ; **au moins deux passages techniques et une portion rapide** ; selon le thème, un saut sur élément technique et/ou une cuve ; **jamais la même figure deux fois dans un circuit** ; **peu de figures en commun d'un jour au suivant**.
- **Durée** : le temps de l'auteur tombe entre **30 et 40 s**, pour qu'une course correcte tienne en 30 à 45 s.
- **Un thème par jour** : palette + décor + poids des revêtements + largeurs dominantes + relief + figures favorites + passage signature. Thèmes : *Stade*, *Rallye*, *Banquise*, *Nuit*, *Campagne*.
- **Validé par un pilote automatique** qui parcourt le circuit avec la même physique. S'il ne finit pas, le générateur recommence avec une graine voisine. Son temps donne le **temps de l'auteur**, d'où découlent les médailles.
- **Planning et remplacement** : le panneau d'admin montre les circuits à venir (avec leurs figures) ; Nathan peut remplacer un jour par une **variante**. Un jour commencé ou passé est **figé**.
- **Plus tard, peut-être** : un circuit dessiné à la main le dimanche ; un éditeur.

## 6. Le classement
- Un **classement par jour** : meilleur temps de chaque joueur, rang, nombre de participants.
- **Validation par rediffusion** : le serveur **rejoue la course avec le même code de simulation** (et la variante du planning) et n'enregistre que le temps qu'il a lui-même recalculé.
- **Identité légère** : identifiant aléatoire et pseudo dans le navigateur ; pas d'e-mail, pas de mot de passe.
- **Fantômes** : le serveur sert la rediffusion du premier et des voisins de classement.
- **Administration** : un jeton secret donne accès au planning ; aucun compte.

## 7. Technique
- **TypeScript partout**, en monorepo :
  - `packages/sim` — la **simulation pure** (physique, blocs, revêtements, collisions, chronométrage, générateur, pilote) : **aucune dépendance au rendu ni au navigateur**, testée par Vitest ;
  - `apps/web` — le jeu (Vite + **Three.js**), les archives et le panneau d'admin ;
  - `apps/api` — le classement et le planning, qui importe le **même** `sim` pour rejouer les courses.
- **Déterminisme** : pas de temps fixe (120 par seconde, sous-pas fixes autorisés, interpolation à l'affichage) ; **pas de moteur physique externe** ; pas de `Math.sin`, `Math.cos`, `Math.exp`, `Math.atan2`, `Math.tanh`, `Math.random`, `Date` dans la simulation. Un test vérifie qu'une même rediffusion donne **exactement** le même temps dans Node et dans les navigateurs. Le rendu, les effets, les sons et les miniatures ne modifient **jamais** un résultat de `sim`.
- **Sans API**, le jeu reste jouable (circuit par défaut de la date, course non classée).
- **Hébergement** : le jeu est un site statique (GitHub Pages), gratuit. **L'API** — piste retenue : **serveur Debian de Nathan en Docker**, exposé par un **tunnel Cloudflare** (gratuit, aucun port ouvert, HTTPS automatique ; seul coût : un nom de domaine, ou un sous-domaine d'un domaine existant). L'offre gratuite de Cloudflare Workers est exclue (10 ms de calcul par requête ; un rejeu coûte ≈ 38 ms depuis le lot 16) ; les hébergeurs gratuits classiques mettent en veille et effacent la base SQLite. Repli si le jeu prend : Workers payant (5 $/mois), l'adaptateur existe. **Le coût d'un rejeu se mesure à chaque lot qui touche à la physique.**
- **Tests** : Vitest pour la simulation (déterminisme, comportements de conduite chiffrés, générateur, rejeu) ; Playwright pour le jeu ; scripts de mesure pour le générateur (`npm run measure:generator`).
- **Intégration continue** : GitHub Actions lance les tests à chaque push et publie l'aperçu.

## 8. Méthode : le développer dans le cloud
- **Claude Code sur le web** : chaque lot est une **session cloud** sur le dépôt GitHub du projet ; elle propose ses changements sous forme de branche et de pull request.
- **Tester un lot en deux clics** : chaque lot a son **aperçu en ligne** (une URL par branche) et un **scénario d'essai** dans l'URL. Le README du lot commence par le lien direct.
- **Les règles habituelles** : un lot = une session neuve = une branche = une PR (si l'environnement impose un autre nom de branche, le garder et adapter le lien d'aperçu) ; README d'une page dans `docs/lots/` ; chaque prompt de lot indique les modifications du `CLAUDE.md` que l'agent applique lui-même ; l'agent met à jour `docs/orchestration.md` (y compris le numéro de PR de son lot) et s'arrête quand les critères sont verts.
- **Enchaîner les lots** : Nathan ouvre une **session neuve** avec simplement :
  > *Lis `docs/seed.md` § 8 et § 12, puis fais le prochain lot.*

  Le prochain lot est le **premier lot du § 12 dont la PR n'est pas fusionnée** dans `origin/main`. Si la PR du lot précédent est encore ouverte, l'agent **ne démarre rien** et le signale. À un **point d'arrêt** (⏸), il s'arrête et attend Nathan. Un seul lot par session.
- **Après tout changement de `SIM_VERSION` ou `GENERATOR_VERSION`** : références golden, `npm run history:seed`, `npm run measure:generator`, coût d'un rejeu mesuré (avant / après, même machine, cf. pièges du lot 18), jour de test de l'API revérifié.
- **Le quota** : Sonnet en effort moyen pour la plupart des lots ; Opus pour la physique et le générateur.

## 9. Hors du jeu
Multijoueur en direct, comptes, éditeur de circuits, plusieurs voitures, réglages de voiture par le joueur, personnalisation, monétisation, musique, **boucles, tunnels fermés, murs au plafond** (au premier jalon).

## 10. Plan en lots

**Livrés** (détail dans `docs/orchestration.md` et `docs/lots/`) : 0 Socle · 1 Voiture · 2 Blocs · 3 Rediffusion · 4 Circuit du jour · 5 Classement · 6 Arrivée & archives · 7 Conduite (+ 7b) · 10 Tactile (+ 10b) · 8 Surfaces & thèmes · 9 Feel & juice (+ 9b) · 11 Historique · 12 Circuits amples · 13 Miniatures · 14 Admin et planning · 15 Vitesse · 16 Glace · 17 Relief et sauts · 18 Cuves.

**À venir** (prompts au § 12) :
- **Retouche 18b — Cuves rapides, deux pédales, ménage.** La paroi fait gagner de la vitesse ; deux pédales par défaut sur téléphone ; incohérences d'`orchestration.md` corrigées. **À tester** : `?scenario=cuves`, passer par le mur puis par le fond.
- **Lot 19 — Atterrissages et contrôle en l'air.** Plus de rebond à la réception ; rotation héritée du décollage ; frein en l'air qui fige la voiture. **À tester** : `?scenario=air`.
- **Lot 20 — Générateur à figures.** Bibliothèque de passages techniques, rapides et de sauts techniques, assemblés sans répétition. **À tester** : `?scenario=figures`, puis cinq circuits du jour.
- ⏸ **Ensuite** : mise en ligne (serveur de Nathan + tunnel Cloudflare, domaine, `PREMIER_JOUR` réel, `ADMIN_TOKEN`, sauvegarde) ; calibrage des médailles ; **jalon** : une semaine de circuits joués par Nathan et quelques amis.

## 11. Concurrence
**Trackmania** propose déjà un « circuit du jour » (Track of the Day) ; **PolyTrack**, un jeu de course low-poly dans le navigateur, a trouvé son public. La différence visée : le **format quotidien très court**, sans compte et sans installation, et le **partage en une ligne**.

---

## 12. Prompts des lots

Chaque prompt se suffit à lui-même. L'agent exécute le prompt du prochain lot (règle d'enchaînement au § 8), dans une session neuve. Les prompts des lots livrés ont été retirés (historique Git et `docs/lots/`).

**Règles communes à tous les lots ci-dessous** :
- Pars de `main` à jour : `git fetch origin main && git checkout -B <branche du lot> origin/main` (ou la branche imposée par la session).
- Lis d'abord `docs/orchestration.md` (règles § 4, décisions § 7, pièges § 8) et le README des lots cités.
- Déterminisme strict de `sim` ; versions incrémentées dès qu'un résultat ou un circuit change ; après un changement de version : golden, `npm run history:seed`, `npm run measure:generator`, jour de test de l'API revérifié ; seul le temps rejoué par le serveur compte ; le jeu marche sans API ; ne jamais désactiver un test.
- **Toute nouvelle règle de générateur se valide par le script de mesure** (taux de validation par thème, durées 30–40 s, temps de génération), pas seulement par les tests.
- **Mesurer le coût d'un rejeu** avant et après, sur la même machine, et le noter dans le README.
- **Tester la physique par des commandes variées**, pas seulement figées (cf. piège du lot 18 : braquages francs, durées et vitesses multiples, tirages au hasard à graine fixe).
- Un effet visuel se vérifie sur **une capture** jointe au README.
- Les nouveaux paramètres de physique apparaissent dans le panneau `?debug&tune` (et dans « Copier les réglages »).
- README d'une page dans `docs/lots/`, qui **commence par le lien direct de l'aperçu** avec le scénario du lot ; PR en brouillon avec « À tester », « Garde-fous », « Vérifications faites », « Non vérifié » ; numéro de PR reporté dans `docs/orchestration.md` § 2.
- Rapport : vérifié (et comment) / non vérifié / décisions pour Nathan.

### Retouche 18b — Cuves rapides, deux pédales par défaut, ménage

**Modèle conseillé : Opus, effort moyen** (physique de paroi).

#### Contexte
- Lot 18 fusionné. Branche : `lot-18b-cuves-rapides`. Lis `docs/lots/lot-18-cuves.md`, `lot-16-glace.md`, `lot-10-tactile.md`, `lot-10b-zones-tactiles.md` ; § 7 (décisions des lots 16 et 18) et § 8 (pièges du lot 18) de l'orchestration.
- Décisions de Nathan :
  1. **Les cuves doivent faire gagner de la vitesse** : monter sur la paroi puis redescendre doit faire sortir plus vite que rester au fond (aujourd'hui la paroi ne fait rien gagner : le pilote préfère le fond dans 11 cas sur 11).
  2. **Sur téléphone, le mode deux pédales** (gaz manuel + frein, déjà existant) **devient le mode par défaut** ; l'accélérateur automatique reste une option. Cela règle aussi la roue libre sur glace.
  3. **Corriger les incohérences de `docs/orchestration.md`.**

#### À livrer
- **Cuves qui accélèrent** : la descente le long de la paroi accélère **plus** que la montée ne freine (pesanteur le long de la paroi asymétrique, comme `slopeGravity` en descente, et/ou résistance réduite sur la paroi) ; une ligne « monter puis redescendre » bien prise sort de la cuve **nettement plus vite** que le fond (ordre de grandeur : +8 à +15 % de vitesse de sortie, et du temps gagné sur la portion). Les virages en cuve se prennent plus vite par le mur que par le fond.
- **Pas d'exploitation** : on ne peut pas gagner de la vitesse sans fin en zigzaguant haut-bas dans une cuve droite ; la vitesse gagnée par passage est bornée (test avec zigzags variés, cf. piège du lot 18).
- **Pilote** : il prend la paroi quand c'est plus rapide ; le générateur place les cuves là où le choix compte (entrée à vitesse moyenne, sortie vers une portion qui récompense la vitesse).
- **Tactile** : deux pédales par défaut pour tous ; le réglage enregistré d'un joueur qui avait l'ancien défaut est remis une fois au nouveau défaut (version des réglages) ; un joueur peut toujours repasser en accélérateur automatique.
- **Ménage de `docs/orchestration.md`** :
  - § 7 « Décidé » : retirer « toujours pas de boucles ni de murs verticaux » → « murs et cuves autorisés depuis le lot 18 ; boucles, tunnels fermés et murs au plafond exclus » ;
  - § 7 « Ouvert » 1 (hébergement) : piste retenue = serveur de Nathan en Docker + tunnel Cloudflare ; Workers gratuit exclu (rejeu ≈ 38 ms) ; Workers payant en repli ;
  - § 7 : décisions du lot 16 (roue libre sur téléphone) et du lot 18 (paroi sans gain) marquées tranchées ;
  - § 2 : numéro de PR du lot 18 ;
  - § 6 « Modèles » aligné sur le seed ; § 9 : « Suite » aligné sur le seed § 10.
- **Versions** : `SIM_VERSION` +1, `GENERATOR_VERSION` +1.

#### Critères d'arrêt
- Tous les tests verts ; tests chiffrés : vitesse de sortie par la paroi ≥ fond + 8 % sur une cuve droite et un virage en cuve ; zigzags répétés dans une cuve droite : vitesse bornée ; le pilote d'auteur choisit la paroi dans la majorité des cuves mesurées ; deux pédales par défaut en tactile (test e2e) ; réglage ancien migré une fois.
- README `docs/lots/lot-18b-cuves-rapides.md` avec le lien `?scenario=cuves`, puis `?scenario=cuves&touch=1`, puis deux circuits *Stade* / *Nuit*.

#### Modifications de `CLAUDE.md`
- Section **« Conduite »** : gain de vitesse sur paroi et garde-fou anti-zigzag.
- Section **« Commandes tactiles »** : deux pédales par défaut, migration des réglages.

#### Hors périmètre
Contrôle en l'air (lot 19), nouvelles figures (lot 20).

### Lot 19 — Atterrissages et contrôle en l'air

**Modèle conseillé : Opus, effort élevé** (contact, suspension et rotation en l'air).

#### Contexte
- Retouche 18b fusionnée. Branche : `lot-19-air`. Lis `docs/lots/lot-7-conduite.md`, `lot-17-relief.md`, `lot-18-cuves.md`, `lot-18b-cuves-rapides.md` ; pièges § 8 (décollage et freinage, chute, contact).
- Retour de Nathan : **la voiture rebondit en touchant le sol au lieu de simplement atterrir**. Il veut le **contrôle en l'air de Trackmania** : par défaut la voiture tourne en l'air selon la façon dont elle a sauté ; **en appuyant sur le frein en l'air, elle reste fixe**.

#### À livrer
- **Atterrissage sans rebond** : à l'impact, la composante de vitesse **normale au sol** est absorbée (suspension qui encaisse, amortissement à l'impact), la composante **tangentielle** est conservée selon l'**alignement** de la voiture avec le sol : bien alignée → quasiment toute la vitesse ; de travers ou sur le nez → perte graduée, sans rebond ni décollage parasite. Vaut aussi pour les chutes de plusieurs niveaux et les réceptions sur pente, sur virage relevé et dans une cuve.
- **Rotation héritée** : au décollage, la voiture garde la vitesse angulaire que lui donne la façon dont elle quitte le sol (rampe, crête, bosse prise en braquant, une roue qui part avant l'autre, sortie de paroi) : elle peut piquer, se cabrer, pencher, pivoter ; la rotation se poursuit en l'air (amortissement aérien faible).
- **Frein en l'air = figer** : tant que le frein est appuyé en l'air, la rotation s'amortit très vite et l'orientation reste fixe ; le frein en l'air **ne ralentit pas** la voiture. Accélérateur et direction en l'air : sans effet (proposer dans le rapport un léger lacet à la direction si ça te semble utile, sans l'appliquer).
- **Pilote** : il utilise le frein en l'air quand la rotation compromettrait la réception ; les fenêtres de vitesse des sauts (`jump.ts`) sont recalculées ; le générateur revalide tous les sauts.
- **Rendu et retours** : petit indicateur discret « figé » quand le frein agit en l'air (optionnel), son d'atterrissage qui dépend de la qualité de la réception, caméra stable en l'air.
- **Paramètres** dans `?tune` : amortissement à l'impact, perte selon l'alignement, amortissement aérien, force du « figer ».
- **Scénario** `?scenario=air` : crête à haute vitesse (nez qui pique), tremplin pris en braquant (roulis), long saut, saut vers un virage relevé, chute de trois niveaux, sortie de paroi en l'air.
- **Versions** : `SIM_VERSION` +1, `GENERATOR_VERSION` +1.

#### Critères d'arrêt
- Tous les tests verts ; tests chiffrés, avec commandes variées : après une réception (chutes de 4 à 12 m, sauts du générateur), la voiture ne remonte jamais de plus de quelques centimètres ; réception alignée ≥ 97 % de vitesse tangentielle conservée ; réception de travers à 30° : perte mesurée et bornée ; sur une crête prise à haute vitesse, la voiture tourne en l'air ; frein en l'air : vitesse angulaire < 5 % de l'initiale en moins de 0,3 s et vitesse linéaire inchangée ; tous les circuits du jour sur 60 dates restent validés par le pilote (taux par thème comparé à l'avant-lot).
- README `docs/lots/lot-19-air.md` avec le lien `?scenario=air`, puis `?scenario=air&debug&tune`, puis `?scenario=relief`, et une capture d'une voiture figée en l'air.

#### Modifications de `CLAUDE.md`
- Section **« Conduite »** : réception (absorption normale, conservation tangentielle selon l'alignement), rotation héritée, frein en l'air ; nouvelles clés de `CarParams`.
- Commandes : `?scenario=air`.

#### Hors périmètre
Contrôle du tangage à l'accélérateur, figures du générateur (lot 20).

### Lot 20 — Générateur à figures

**Modèle conseillé : Opus, effort élevé** (générateur, pilote et mesures).

#### Contexte
- Lot 19 fusionné. Branche : `lot-20-figures`. Lis `docs/lots/lot-4-circuit-du-jour.md`, `lot-8-surfaces-themes.md`, `lot-12-circuits-amples.md`, `lot-15-vitesse.md`, `lot-17-relief.md`, `lot-18-cuves.md`, `lot-19-air.md` ; pièges § 8 du générateur (chaque règle se compte et se mesure ; effets de piste et virages ; décollage et freinage).
- Retour de Nathan : la génération manque de ce qui fait un circuit de Trackmania ; **on retrouve beaucoup les mêmes motifs** ; il manque des **moments techniques** et des **sauts sur des éléments techniques**, pas seulement un gros test de vitesse en ligne droite.

#### Objet
Assembler chaque circuit à partir d'une **bibliothèque de figures** variées, avec un vrai rythme entre technique et vitesse, et peu de répétition d'un jour à l'autre.

#### À livrer
- **Bibliothèque de figures** (au moins 20), chacune = une courte suite de blocs avec une intention, un nom, une catégorie et des variantes (miroir, largeur, revêtement, niveau, longueur). Pistes, à compléter :
  - **techniques** : S serré-large, rétrécissement suivi d'un virage, virage relevé enchaîné sur un virage plat inverse, épingle large sur terre, slalom de glace en roue libre, moteur coupé avant un virage, changement de revêtement en plein enchaînement, virage en descente, virage aveugle en haut d'une montée, crête suivie d'un virage ;
  - **sauts techniques** : saut avec réception directement dans un virage, saut vers un virage relevé, saut dans une cuve, saut vers une section étroite, saut avec changement de niveau vers une épingle large, saut sur une plaque à la réception, double saut, saut en sortie de paroi ;
  - **rapides** : les portions rapides du lot 15 ;
  - **combinaisons** : turbo → saut → virage relevé ; descente → cuve → saut ; glace → moteur coupé → virage.
- **Composition** : départ, 5 à 7 figures, **au moins deux techniques et une rapide**, un saut technique et/ou une cuve selon le thème ; **jamais la même figure deux fois dans un circuit** ; pas de longue ligne droite sans figure (seuil à fixer et mesurer) ; durée d'auteur 30–40 s inchangée.
- **Peu de répétition d'un jour à l'autre**, **sans générer les jours précédents** (le coût de génération doit rester celui d'un seul jour) : par exemple une rotation déterministe des figures calculée à partir de la date, avec les figures favorites de chaque thème.
- **Thèmes** : figures favorites et interdites par thème (ex. *Banquise* : slalom de glace ; *Rallye* : sauts sur terre ; *Stade* et *Nuit* : sauts techniques et cuves).
- **Pilote** : il franchit chaque figure (freinage avant les passages techniques, roue libre sur glace, frein en l'air si besoin) ; une figure qu'il ne sait pas franchir est corrigée ou retirée, pas contournée.
- **Admin** : la carte d'un jour du planning liste ses figures (aide au remplacement).
- **Scénarios** : `?scenario=figures` (circuit écrit à la main qui enchaîne une dizaine de figures marquantes) et `?scenario=figure&f=<nom>` (une seule figure, départ juste avant, pour l'essayer en boucle) ; le README liste les noms.
- **Mesures** ajoutées au script : nombre de figures distinctes par circuit, répartition par catégorie, **part du temps à plein gaz** (doit baisser par rapport à l'avant-lot), nombre de freinages ou relâchements par circuit, plus longue ligne droite sans figure, **figures en commun entre jours consécutifs** (moyenne et maximum sur 60 dates), taux de validation par thème, temps de génération.
- **Versions** : `GENERATOR_VERSION` +1 (et `SIM_VERSION` +1 si un bloc ou la physique change).

#### Critères d'arrêt
- Tous les tests verts ; mesures dans le README : au moins 20 figures utilisées sur 60 dates ; aucune figure répétée dans un circuit ; au moins deux techniques par circuit ; part du temps à plein gaz en baisse nette ; figures en commun entre deux jours consécutifs : moyenne ≤ 2 ; taux de validation par thème et temps de génération comparables à l'avant-lot (sinon le dire et expliquer).
- README `docs/lots/lot-20-figures.md` avec le lien `?scenario=figures`, la liste des figures avec leur lien `?scenario=figure&f=…`, puis cinq circuits du jour choisis pour leur variété (un par thème) et deux captures.

#### Modifications de `CLAUDE.md`
- Nouvelle section **« Figures »** : structure d'une figure, catégories, variantes, comment en ajouter une (et la faire valider par le pilote et le script), règles de composition et de non-répétition.
- Commandes : `?scenario=figures`, `?scenario=figure&f=`.

#### Hors périmètre
Éditeur de circuits, circuit dessiné du dimanche, calibrage des médailles.

### ⏸ Fin des lots écrits

Après le lot 20, l'agent s'arrête : la mise en ligne, le calibrage et le jalon seront rédigés avec Nathan.
