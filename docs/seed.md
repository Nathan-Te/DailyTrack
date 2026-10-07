# Seed — « Circuit du Jour » (titre provisoire)

Source de vérité du projet. Vit dans `docs/seed.md`, n'est modifié que par Nathan. Projet **web, court**, conçu pour être développé **entièrement dans le cloud** (Claude Code sur le web), sans PC.

*Version 4 (07/10/2026) : lots 0 à 14 livrés. Ajoutés : portions à grande vitesse et sensation de vitesse, glace refaite (rapide, peu d'adhérence, redirection en roue libre), relief et vrais sauts au-dessus du vide, cuves et murs où l'on roule. Hébergement : piste gratuite (serveur de Nathan + tunnel Cloudflare). Prompts au § 12.*

---

## 1. Le jeu en une phrase
Chaque jour, un nouveau circuit court, le même pour tout le monde : on le parcourt en 30 à 45 secondes dans le navigateur, on retente pour battre son temps et le fantôme du meilleur, et on partage son résultat en une ligne, comme un score de Wordle.

## 2. Les piliers
1. **Moins d'une minute par jour.** Une course de **30 à 45 secondes, grand maximum**. On joue en pause café ; on revient demain.
2. **Le même circuit pour tous.** Un circuit par jour, généré à partir de la date (ou une variante choisie à l'avance, § 5), identique pour chaque joueur.
3. **Zéro friction.** Un lien, ça démarre. Pas de compte, pas d'installation : un pseudo choisi au premier temps, mémorisé dans le navigateur.
4. **Un temps est une preuve.** La physique est **déterministe** : une course est entièrement décrite par la suite des commandes du joueur. Le serveur rejoue la course pour valider le temps, et la même rediffusion sert de fantôme.
5. **Vite, lisible et nerveux.** Low-poly coloré, caméra derrière la voiture, **de vraies pointes de vitesse** ; un circuit se lit en un coup d'œil. **La conduite a la tenue de route, le mordant et la démesure d'un Trackmania** : relief, sauts, murs.

## 3. Le jeu
- **La voiture** : une seule, arcade, inspirée de Trackmania — accélération franche, direction immédiate, adhérence forte avec une limite lisible, dérapage au frein, suspension qui suit le relief, réceptions qui récompensent un atterrissage propre, rebords qu'on peut frôler, **vitesse qui grimpe nettement dans les descentes et sur les turbos**, et capacité à **rouler sur une paroi très inclinée** tant qu'on va assez vite. Commandes : accélérer, freiner/reculer, tourner (analogique à la manette), **recommencer au dernier point de contrôle** (avec la vitesse du passage), **recommencer depuis le départ**. Clavier, manette et tactile.
- **Le circuit** : des **blocs** sur une grille, à la Trackmania — lignes droites, virages serrés, courbes amples, virages relevés, **montées et descentes sur plusieurs niveaux**, bosses et crêtes, tremplins, **vrais sauts au-dessus du vide** vers une rampe de réception, **cuves** (demi-tubes, murs latéraux, virages en cuve où l'on prend le mur) ; départ, points de contrôle, arrivée. La largeur de la piste varie (étroite, normale, large). Chaque circuit a une ou deux **portions rapides**. Pas de boucles au premier jalon.
- **Les revêtements** (par bloc) : **route** (référence), **terre** (glisse et se rattrape), **glace** (la plus rapide en ligne droite, très peu d'adhérence à l'accélérateur ; en **roue libre**, gauche-droite permet de se rediriger proprement), **herbe** (lente et glissante).
- **Les blocs à effet** : **plaque d'accélération**, **super turbo**, **moteur coupé**.
- **Tomber** : une voiture qui rate un saut ou quitte la piste par le vide reprend automatiquement au dernier point de contrôle (le chrono continue).
- **La course** : chronomètre au millième, temps intermédiaires aux points de contrôle, essais illimités dans la journée.
- **Les médailles** : bronze, argent, or et **temps de l'auteur** (§ 5).
- **Les fantômes** : son propre meilleur temps, et au choix celui du premier du classement ou du joueur juste devant soi.
- **L'écran d'arrivée** : temps, médaille, rang du jour, et la **ligne à partager** :
  `Circuit du Jour #142 — 37,312 s — 🥇 — 23e/812`
- **Les archives** : la liste des jours passés avec une **miniature en vue aérienne**, le thème, les médailles et ta place figée ; on rejoue un jour avec le fantôme du premier et le classement figé.

## 4. Direction artistique
Low-poly coloré et propre : blocs aux couleurs vives par type, chaque revêtement et chaque bloc à effet reconnaissable au premier coup d'œil, ciel dégradé, soleil ou lune, montagnes et décor propres à chaque thème. **La vitesse se voit** : éléments réguliers au bord de la piste (poteaux, arches, panneaux) qui défilent, marquages au sol, champ de vision qui s'ouvre, lignes de vitesse, vent. Les sections surélevées ont des **piliers** et laissent voir le **vide** en dessous. Une voiture low-poly originale et animée, des effets et des sons procéduraux. Pas de textures lourdes : le jeu se charge en quelques secondes, sur mobile aussi.

## 5. Le circuit du jour
- **Généré à partir de la date** (graine = date en UTC) : pas d'intersection au même niveau, rythme (alternance de lignes droites et de courbes), au moins deux largeurs, peu de virages serrés, **une ou deux portions rapides**, **du relief**, selon le thème **un vrai saut** et/ou **une cuve**, un passage signature, des points de contrôle.
- **Durée** : le temps de l'auteur tombe entre **30 et 40 s**, pour qu'une course correcte tienne en 30 à 45 s.
- **Un thème par jour** : palette + décor + poids des revêtements + largeurs dominantes + relief + blocs à effet + figures (sauts, cuves) + passage signature. Thèmes : *Stade*, *Rallye*, *Banquise*, *Nuit*, *Campagne*.
- **Validé par un pilote automatique** qui parcourt le circuit avec la même physique. S'il ne finit pas, le générateur recommence avec une graine voisine. Son temps donne le **temps de l'auteur**, d'où découlent les médailles.
- **Planning et remplacement** : le panneau d'admin montre les circuits à venir ; Nathan peut remplacer un jour par une **variante**. Un jour commencé ou passé est **figé**.
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
- **Hébergement** : le jeu est un site statique (GitHub Pages), gratuit. **L'API** (rejeu, classement, planning) — piste retenue : **serveur Debian de Nathan en Docker**, exposé par un **tunnel Cloudflare** (gratuit, aucun port ouvert, HTTPS automatique ; seul coût : un nom de domaine, ou un sous-domaine d'un domaine existant). L'offre gratuite de Cloudflare Workers ne convient pas (10 ms de calcul par requête ; un rejeu en coûte ≈ 10–12 ms) ; les hébergeurs gratuits classiques mettent en veille et effacent la base SQLite. Repli si le jeu prend : Workers payant (5 $/mois), l'adaptateur existe déjà. **Le coût d'un rejeu se mesure à chaque lot qui touche à la physique.**
- **Tests** : Vitest pour la simulation (déterminisme, comportements de conduite chiffrés, générateur, rejeu) ; Playwright pour le jeu ; scripts de mesure pour le générateur (`npm run measure:generator`).
- **Intégration continue** : GitHub Actions lance les tests à chaque push et publie l'aperçu.

## 8. Méthode : le développer dans le cloud
- **Claude Code sur le web** : chaque lot est une **session cloud** sur le dépôt GitHub du projet ; elle propose ses changements sous forme de branche et de pull request.
- **Tester un lot en deux clics** : chaque lot a son **aperçu en ligne** (une URL par branche) et un **scénario d'essai** dans l'URL. Le README du lot commence par le lien direct.
- **Les règles habituelles** : un lot = une session neuve = une branche = une PR (si l'environnement impose un autre nom de branche, le garder et adapter le lien d'aperçu) ; README d'une page dans `docs/lots/` ; chaque prompt de lot indique les modifications du `CLAUDE.md` que l'agent applique lui-même ; l'agent met à jour `docs/orchestration.md` et s'arrête quand les critères sont verts.
- **Enchaîner les lots** : Nathan ouvre une **session neuve** avec simplement :
  > *Lis `docs/seed.md` § 8 et § 12, puis fais le prochain lot.*

  Le prochain lot est le **premier lot du § 12 dont la PR n'est pas fusionnée** dans `origin/main`. Si la PR du lot précédent est encore ouverte, l'agent **ne démarre rien** et le signale. À un **point d'arrêt** (⏸), il s'arrête et attend Nathan. Un seul lot par session.
- **Après tout changement de `SIM_VERSION` ou `GENERATOR_VERSION`** : références golden, `npm run history:seed`, `npm run measure:generator`, et coût d'un rejeu mesuré.
- **Le quota** : Sonnet en effort moyen pour la plupart des lots ; Opus pour la physique et le générateur.

## 9. Hors du jeu
Multijoueur en direct, comptes, éditeur de circuits, plusieurs voitures, réglages de voiture par le joueur, personnalisation, monétisation, musique, **boucles** (au premier jalon).

## 10. Plan en lots

**Livrés** (détail dans `docs/orchestration.md` et `docs/lots/`) : 0 Socle · 1 Voiture · 2 Blocs · 3 Rediffusion · 4 Circuit du jour · 5 Classement · 6 Arrivée & archives · 7 Conduite (+ 7b) · 10 Tactile (+ 10b zones) · 8 Surfaces & thèmes · 9 Feel & juice (+ 9b visuels) · 11 Historique · 12 Circuits amples · 13 Miniatures · 14 Admin et planning.

**À venir** (prompts au § 12) :
- **Lot 15 — Vitesse.** Portions rapides (descentes, turbos enchaînés, grandes courbes à fond), pointe qui n'est plus un plafond dur, sensation de vitesse. **À tester** : `?scenario=vitesse`, puis un circuit du jour.
- **Lot 16 — Glace.** Plus rapide en ligne droite, très peu d'adhérence à l'accélérateur, redirection propre en roue libre. **À tester** : `?scenario=glace`.
- **Lot 17 — Relief et sauts.** Plusieurs niveaux, descentes et montées marquées, crêtes, vrais sauts au-dessus du vide, reprise automatique en cas de chute. **À tester** : `?scenario=relief`.
- **Lot 18 — Cuves.** Demi-tubes, murs latéraux, virages en cuve où l'on roule sur la paroi. **À tester** : `?scenario=cuves`.
- ⏸ **Ensuite** : mise en ligne (serveur de Nathan + tunnel Cloudflare, domaine, `PREMIER_JOUR` réel, `ADMIN_TOKEN`, sauvegarde) ; calibrage des médailles ; **jalon** : une semaine de circuits joués par Nathan et quelques amis.

## 11. Concurrence
**Trackmania** propose déjà un « circuit du jour » (Track of the Day) ; **PolyTrack**, un jeu de course low-poly dans le navigateur, a trouvé son public. La différence visée : le **format quotidien très court**, sans compte et sans installation, et le **partage en une ligne**.

---

## 12. Prompts des lots

Chaque prompt se suffit à lui-même. L'agent exécute le prompt du prochain lot (règle d'enchaînement au § 8), dans une session neuve. Les prompts des lots livrés ont été retirés (historique Git et `docs/lots/`).

**Règles communes à tous les lots ci-dessous** (rappelées une fois ici, elles s'appliquent à chacun) :
- Pars de `main` à jour : `git fetch origin main && git checkout -B <branche du lot> origin/main` (ou la branche imposée par la session).
- Lis d'abord `docs/orchestration.md` (règles § 4, pièges § 8) et le README des lots cités.
- Déterminisme strict de `sim` ; versions incrémentées dès qu'un résultat ou un circuit change ; après un changement de version : golden, `npm run history:seed`, `npm run measure:generator` ; seul le temps rejoué par le serveur compte ; le jeu marche sans API ; ne jamais désactiver un test.
- **Toute nouvelle règle de générateur se valide par le script de mesure** (taux de validation par thème, durées 30–40 s, temps de génération), pas seulement par les tests.
- **Mesurer le coût d'un rejeu** avant et après (il conditionne l'hébergement) et le noter dans le README.
- Un effet visuel se vérifie sur **une capture** jointe au README, pas seulement par un compteur.
- Les nouveaux paramètres de physique apparaissent dans le panneau `?debug&tune` (et dans « Copier les réglages »).
- README d'une page dans `docs/lots/`, qui **commence par le lien direct de l'aperçu** avec le scénario du lot ; PR en brouillon avec « À tester », « Garde-fous », « Vérifications faites », « Non vérifié ».
- Rapport : vérifié (et comment) / non vérifié / décisions pour Nathan.

### Lot 15 — Vitesse : portions rapides et sensation de vitesse

**Modèle conseillé : Opus, effort moyen.**

#### Contexte
- Lots 0 à 14 fusionnés. Branche : `lot-15-vitesse`. Lis `docs/lots/lot-7-conduite.md`, `lot-7b-reglages.md`, `lot-9-juice.md`, `lot-9b-visuels.md`, `lot-12-circuits-amples.md`.
- Retour de Nathan : il manque la démesure de Trackmania — **plus de vitesse par portions** et **plus de sensation de vitesse**. Aujourd'hui la pointe est de 48 m/s (≈ 173 km/h) et agit comme un plafond.

#### Objet
Que chaque circuit ait des moments où l'on va **beaucoup** plus vite, et que la vitesse se sente.

#### À livrer
- **Physique** : la pointe sur le plat reste du même ordre (à régler), mais elle n'est **plus un plafond dur** : une traînée qui croît avec la vitesse laisse les **descentes** (gravité), les **plaques** et **super turbos** pousser nettement au-delà (ordre de grandeur visé : 80–90 m/s, soit ≈ 300 km/h, sur les portions rapides), puis la voiture retombe progressivement. Les virages amples et relevés se prennent à fond à haute vitesse ; les virages serrés restent lents.
- **Pas de traversée** : à la vitesse maximale atteignable, aucune traversée de rebord ni de sol (sous-pas fixes si besoin) ; test dédié.
- **Générateur** : chaque circuit a **une ou deux portions rapides** (longue descente, turbos enchaînés sur une ligne droite, grande courbe relevée prise à fond, S large rapide), la durée restant dans 30–40 s (les circuits s'allongent en cellules) ; le pilote vise la pleine vitesse sur ces portions.
- **Sensation de vitesse** (dans `apps/web`, aucun effet sur `sim`) :
  - éléments réguliers en bord de piste qui défilent (poteaux, arches, panneaux, plots), plus serrés sur les portions rapides ;
  - marquages au sol à haute fréquence (pointillés, chevrons sur les turbos, bordures rayées) ;
  - champ de vision qui s'ouvre davantage au-delà de la pointe, caméra un peu plus basse et en léger retard, petite vibration au-delà d'un seuil, lignes de vitesse et vent plus intenses ;
  - compteur qui change de couleur au-delà de la pointe.
  Réglables par la qualité automatique ; aucun malaise (pas de secousse permanente).
- **Scénario** `?scenario=vitesse` : départ, longue descente, turbos enchaînés, grande courbe relevée à fond, freinage avant un virage serré.
- **Mesures** ajoutées au script : vitesse maximale par circuit, part du temps au-delà de la pointe sur le plat.
- **Ménage** dans `docs/orchestration.md` : numéro de PR de la retouche 10b, « route de 14 m » au § 7 (désormais 14/20/26 m), mention « aucun vrai téléphone essayé » (Nathan a essayé) au § 9.
- **Versions** : `SIM_VERSION` +1, `GENERATOR_VERSION` +1.

#### Critères d'arrêt
- Tous les tests verts ; tests chiffrés : en descente la vitesse dépasse la pointe du plat ; après un super turbo la vitesse dépasse la pointe puis y redescend progressivement ; aucune traversée à vitesse maximale ; sur 60 dates, chaque circuit contient au moins une portion où le pilote dépasse la pointe du plat de 30 % ou plus.
- README `docs/lots/lot-15-vitesse.md` avec le lien `?scenario=vitesse`, puis trois circuits du jour, et une capture d'une portion rapide.

#### Modifications de `CLAUDE.md`
- Section **« Conduite »** : traînée et vitesse au-delà de la pointe, garde-fou anti-traversée.
- Section **« Circuits »** : portions rapides et leur règle de générateur.
- Section **« Rendu, effets et sons »** : éléments de bord de piste, marquages, caméra à haute vitesse.
- Commandes : `?scenario=vitesse`.

#### Hors périmètre
Glace (lot 16), relief et sauts (lot 17), cuves (lot 18).

### Lot 16 — Glace refaite

**Modèle conseillé : Sonnet, effort élevé** (Opus si le pilote ne sait pas conduire sur glace).

#### Contexte
- Lot 15 fusionné. Branche : `lot-16-glace`. Lis `docs/lots/lot-8-surfaces-themes.md` et `lot-15-vitesse.md`.
- Retour de Nathan : sur la glace on doit **aller plus vite**, au prix de l'adhérence et de la maniabilité ; mais **relâcher l'accélérateur et simplement faire gauche-droite** doit permettre de **se rediriger proprement**, comme dans Trackmania.

#### Objet
Une glace rapide, piégeuse à l'accélérateur, maîtrisable en roue libre.

#### À livrer
- **Ligne droite** : sur glace, résistance au roulement et traînée plus faibles que sur route : à distance égale, on y va **plus vite** ; l'accélération est plus molle (patinage au départ).
- **Accélérateur appuyé** : adhérence latérale très faible ; la voiture sous-vire et glisse largement, la direction mord à peine.
- **Roue libre** (accélérateur relâché, sans frein) : la voiture **pivote volontiers** à la direction, et le **vecteur vitesse se réaligne progressivement sur le cap** avec peu de perte de vitesse ; alterner gauche-droite corrige la trajectoire proprement.
- **Frein** sur glace : peu efficace, la voiture part en glisse.
- Paramètres glace dans `SurfaceParams` et dans le panneau `?tune` (adhérence accélérateur appuyé / relâché, vitesse de réalignement, traînée, freinage).
- **Pilote** : il relâche l'accélérateur pour tourner sur glace et réaccélère en ligne droite ; le générateur tient compte de la nouvelle glace (espace avant les virages), thème *Banquise* revalidé.
- **Scénario** `?scenario=glace` : longue ligne droite de glace (comparée à une ligne droite de route), deux virages, un slalom.
- **Versions** : `SIM_VERSION` +1, `GENERATOR_VERSION` +1.

#### Critères d'arrêt
- Tous les tests verts ; tests chiffrés : vitesse en fin de longue ligne droite lancée glace > route ; rayon de virage accélérateur appuyé ≥ 2 × rayon en roue libre à même vitesse ; en roue libre, l'angle de dérive est divisé par deux en moins de 0,6 s en braquant dans le bon sens, avec moins de 10 % de perte de vitesse ; *Banquise* garde un taux de validation comparable aux autres thèmes.
- README `docs/lots/lot-16-glace.md` avec le lien `?scenario=glace`, puis `?scenario=glace&debug&tune`, puis deux circuits *Banquise*.

#### Modifications de `CLAUDE.md`
- Section **« Surfaces et blocs à effet »** : comportement de la glace (accélérateur appuyé / roue libre / frein), paramètres.

#### Hors périmètre
Autres revêtements (sauf si la nouvelle glace oblige à les retoucher : le dire).

### Lot 17 — Relief et vrais sauts

**Modèle conseillé : Opus, effort moyen.**

#### Contexte
- Lot 16 fusionné. Branche : `lot-17-relief`. Lis `docs/lots/lot-2-blocs.md`, `lot-7-conduite.md`, `lot-12-circuits-amples.md`, `lot-15-vitesse.md` ; pièges § 8 sur les décollages (un décollage coupe le freinage).
- Retour de Nathan : **tout est plat** ; il veut de la verticalité et **de vrais sauts à réussir**.

#### Objet
Des circuits qui montent, descendent et sautent, avec un vrai risque de tomber.

#### À livrer
- **Relief** : blocs de dénivelé sur **plusieurs niveaux** (montées et descentes de 1 à 3 niveaux, plus longues et plus raides qu'aujourd'hui), **crêtes** qui font décoller à haute vitesse, descentes qui nourrissent les portions rapides du lot 15 ; sections **surélevées** sur piliers.
- **Vrais sauts** : tremplin → **vide** → **rampe de réception** (pente descendante qui conserve la vitesse) ; longueur et hauteur calculées pour une **fenêtre de vitesse** : trop lent, on tombe ; dans la fenêtre, réception propre ; réception de travers = perte de vitesse. Variantes : saut court, long saut, saut avec changement de niveau.
- **Chute** : une voiture qui tombe sous la piste (seuil de hauteur) ou quitte une section surélevée **reprend automatiquement au dernier point de contrôle** après un court délai (≈ 1 s, chrono qui continue), de façon déterministe ; effet visuel et sonore de chute.
- **Sections sans rebord** possibles sur certaines parties surélevées (selon le thème), pour que le risque soit réel.
- **Générateur** : pas d'intersection au même niveau ; dénivelé minimal par circuit ; **au moins un vrai saut** par circuit pour les thèmes qui s'y prêtent (indicatif : *Stade*, *Nuit*, *Rallye*) ; le pilote aborde chaque saut dans sa fenêtre de vitesse. **Croisement à deux niveaux (pont)** : seulement si la structure de la grille le permet simplement, sinon le dire dans le rapport.
- **Rendu** : piliers, vide visible (sol lointain en dessous), ombre de la voiture en l'air pour juger la réception.
- **Scénario** `?scenario=relief` : montée sur deux niveaux, crête, longue descente, un saut court, un long saut avec changement de niveau, une section sans rebord.
- **Versions** : `SIM_VERSION` +1, `GENERATOR_VERSION` +1.

#### Critères d'arrêt
- Tous les tests verts ; tests chiffrés : chaque saut généré est franchi par le pilote dans sa fenêtre et **raté** en dessous de la fenêtre ; une chute ramène au dernier point de contrôle dans le délai prévu, de façon identique au rejeu ; sur 60 dates, dénivelé minimal respecté et proportion de circuits avec un vrai saut par thème mesurée.
- README `docs/lots/lot-17-relief.md` avec le lien `?scenario=relief`, puis trois circuits du jour choisis pour leur relief, et une capture d'un saut.

#### Modifications de `CLAUDE.md`
- Section **« Circuits »** : niveaux, crêtes, sauts et fenêtres de vitesse, sections sans rebord, règles du générateur.
- Section **« Conduite »** : chute et reprise automatique.
- Commandes : `?scenario=relief`.

#### Hors périmètre
Cuves et murs (lot 18), boucles.

### Lot 18 — Cuves : rouler sur les murs

**Modèle conseillé : Opus, effort élevé** (extension du modèle de contact au-delà d'une simple hauteur de sol).

#### Contexte
- Lot 17 fusionné. Branche : `lot-18-cuves`. Lis `docs/lots/lot-7-conduite.md` et `lot-8-surfaces-themes.md` (virages relevés et leurs pièges § 8 : bord intérieur en contrebas, collision avec le sol réel), `lot-15-vitesse.md`, `lot-17-relief.md`.
- Retour de Nathan : il veut des **cuves** où l'on roule sur des murs. La décision « pas de murs verticaux » est levée ; les **boucles restent exclues**.

#### Objet
Des portions où la voiture roule sur une paroi très inclinée, jusqu'à la verticale, tant qu'elle va assez vite.

#### À livrer
- **Physique** : contact orienté par la **normale de la surface** (la voiture s'aligne sur la paroi, la gravité se projette sur le plan de contact) pour tenir sur une paroi jusqu'à ≈ 85–90° grâce à la vitesse ; **trop lent, la voiture décroche** et glisse vers le fond sans traverser ni se coincer. Si une hauteur de sol ne suffit plus pour ces blocs, utiliser une **surface paramétrée par bloc** (abscisse le long du bloc, position latérale) ; les blocs existants doivent rejouer **au bit près** (vérifier avec la référence du circuit d'essai, comme au lot 12).
- **Blocs** (avec entrées et sorties progressives) :
  - **cuve droite** : fond plat et parois incurvées des deux côtés (demi-tube) ;
  - **mur latéral** : une paroi qui monte jusqu'à la verticale sur un côté, pour rouler dessus en ligne droite ;
  - **virage en cuve** : le mur extérieur monte jusqu'à la verticale, on prend le virage à pleine vitesse sur le mur.
- **Caméra** : suit le roulis de la voiture avec douceur (pas de rotation brutale), reste lisible sur le mur.
- **Pilote** : trajectoire sur la paroi dans les virages en cuve ; **générateur** : une cuve ou un mur par circuit pour les thèmes qui s'y prêtent (indicatif : *Stade*, *Nuit*), durée toujours dans 30–40 s.
- **Rendu** : parois lisibles (couleur et motif propres), traces de pneus et étincelles sur la paroi.
- **Scénario** `?scenario=cuves` : cuve droite, mur latéral, virage en cuve à pleine vitesse, puis le même virage en cuve abordé trop lentement.
- **Versions** : `SIM_VERSION` +1, `GENERATOR_VERSION` +1.

#### Critères d'arrêt
- Tous les tests verts ; tests chiffrés : à vitesse suffisante, la voiture tient sur une paroi à 80° ou plus sur toute la longueur d'un mur latéral ; en dessous d'une vitesse seuil, elle décroche et revient au fond sans traverser la paroi ni rester bloquée (sortie en moins de 2 s) ; aucune traversée à vitesse maximale ; les circuits sans cuve rejouent au bit près ; coût d'un rejeu mesuré (rester raisonnable : le dire s'il augmente beaucoup).
- README `docs/lots/lot-18-cuves.md` avec le lien `?scenario=cuves`, puis deux circuits du jour contenant une cuve, et une capture de la voiture sur un mur.

#### Modifications de `CLAUDE.md`
- Section **« Conduite »** : contact par normale, surface paramétrée, décrochage.
- Section **« Circuits »** : blocs de cuve, règles du générateur ; « boucles toujours exclues ».
- Commandes : `?scenario=cuves`.

#### Hors périmètre
Boucles, tunnels fermés, murs au plafond.

### ⏸ Fin des lots écrits

Après le lot 18, l'agent s'arrête : la mise en ligne, le calibrage et le jalon seront rédigés avec Nathan.
