# Seed — « Circuit du Jour » (titre provisoire)

Source de vérité du projet. Vit dans `docs/seed.md`, n'est modifié que par Nathan. Projet **web, court**, conçu pour être développé **entièrement dans le cloud** (Claude Code sur le web), sans PC.

*Version 9 (13/10/2026) : lots 0 à 28 livrés, **jeu en ligne depuis le 13/10/2026** (GitHub Pages + Cloud Run + Turso). Ajoutés : un **écran d'accueil**, un **menu de pause** et des **réglages** complets ; tour d'amélioration de l'interface et de la compréhension ; **profil visible à l'accueil** ; **pseudos réservés** (lots 29 à 31 au § 12) ; finale du Salon en 15 s ; plus de circuit futur visible.*

---

## 1. Le jeu en une phrase
Chaque jour, un nouveau circuit court, le même pour tout le monde : on le parcourt en 30 à 45 secondes dans le navigateur, on retente pour battre son temps et le fantôme du meilleur, et on partage son résultat en une ligne, comme un score de Wordle. Et quand on veut jouer plus : **le Salon**, un circuit toutes les 10 minutes avec les fantômes des joueurs présents.

## 2. Les piliers
1. **Moins d'une minute par course.** Une course de **30 à 45 secondes, grand maximum**. On joue en pause café ; on revient demain.
2. **Le même circuit pour tous.** Un circuit par jour, généré à partir de la date (ou une variante choisie à l'avance, § 5), identique pour chaque joueur ; dans le Salon, un circuit par session de 10 minutes, identique pour tous.
3. **Zéro friction.** Un lien, ça démarre. Pas de compte, pas d'installation : un pseudo choisi au premier temps, mémorisé dans le navigateur.
4. **Un temps est une preuve.** La physique est **déterministe** : une course est entièrement décrite par la suite des commandes du joueur. Le serveur rejoue la course pour valider le temps, et la même rediffusion sert de fantôme.
5. **Vite, technique, lisible — et chaque jour a son caractère.** Low-poly coloré, de vraies pointes de vitesse et de vrais passages techniques ; un circuit se lit en un coup d'œil ; **on reconnaît le thème du jour au premier regard et surtout à la conduite** : chaque thème a son format de circuit, pas seulement son décor. La conduite a la tenue de route, le mordant et la démesure d'un Trackmania.

## 3. Le jeu
- **La voiture** : une seule, arcade, inspirée de Trackmania — accélération franche, direction immédiate, adhérence forte avec une limite lisible, dérapage au frein, suspension qui suit le relief, vitesse qui grimpe dans les descentes et sur les turbos, capacité à rouler sur une paroi tant qu'on va assez vite.
- **En l'air** : la voiture garde la rotation de son décollage ; **le frein en l'air la fige** ; **à l'atterrissage, elle se pose** sans rebond ; une réception de travers coûte de la vitesse.
- **Commandes** : accélérer, freiner/reculer (et figer en l'air), tourner (analogique à la manette), **recommencer au dernier point de contrôle**, **recommencer depuis le départ**, **changer de caméra** (proche, loin, capot). Clavier, manette et tactile (deux pédales par défaut, accélérateur automatique en option ; bouton caméra).
- **Le circuit** : des **blocs** sur une grille, à la Trackmania, assemblés en **figures** (passages techniques, portions rapides, sauts sur éléments techniques, combinaisons) : lignes droites, virages serrés, courbes amples, virages relevés, plusieurs niveaux, crêtes, vrais sauts au-dessus du vide, **cuves** qui font gagner de la vitesse. La largeur de la piste varie. Pas de boucles au premier jalon.
- **Les bas-côtés** : là où la route n'a pas de rebord, elle est bordée d'une bande qui dépend du thème (herbe, terre et gravier, neige poudreuse, sable, vide) ; en sortir **ralentit** sans faire tomber ; couper un virage par le bas-côté est un choix risqué. Les virages ont des **vibreurs**.
- **Les revêtements** (par bloc) : **route**, **terre** (glisse et se rattrape), **glace** (rapide en ligne droite, très peu d'adhérence à l'accélérateur, redirection en roue libre), **herbe** (lente et glissante), **sable** (lent mais stable).
- **Les blocs à effet** : **plaque d'accélération**, **super turbo**, **moteur coupé**.
- **Tomber** : une voiture qui rate un saut ou quitte la piste par le vide reprend automatiquement au dernier point de contrôle (le chrono continue).
- **La course** : chronomètre au millième, temps intermédiaires aux points de contrôle, essais illimités dans la journée.
- **Les médailles** : bronze, argent, or et **temps de l'auteur** (§ 5).
- **Les fantômes** : son propre meilleur temps, et au choix celui du premier du classement ou du joueur juste devant soi.
- **Revoir le meilleur tour** : depuis l'écran d'arrivée, le classement ou les archives, on regarde la rediffusion du meilleur tour (du jour, d'un jour passé ou de la session du Salon) comme un spectateur : caméras au choix, pause, ralenti, retour en arrière de quelques secondes, chrono et temps intermédiaires du tour affichés ; on peut lancer sa propre course juste après, avec ce fantôme.
- **L'écran d'accueil** : c'est ce qu'on voit en ouvrant le jeu — le titre, le circuit du jour (numéro, date, thème, aperçu, médailles, ton meilleur temps et ton rang), le **classement du jour**, et deux grands choix : **jouer le circuit du jour** ou **rejoindre le Salon** (circuit en cours, temps restant, joueurs présents) ; plus la **carte de ton profil** (pseudo, jours joués, médailles gagnées, meilleur rang ; boutons « Copier mon code » et « Charger un code »), les archives, les réglages et « Comment jouer ». On y revient à tout moment par le bouton **Accueil**.
- **En course** : le classement (du jour ou de la session du Salon) est **affiché par défaut** dans un coin, repliable ; une barre courte en haut : Accueil, Réglages, Fantôme, Son. **Pause** (Échap / P / Start) : reprendre, recommencer, dernier point de contrôle, réglages, comment jouer, accueil.
- **Les réglages** : graphismes (qualité automatique ou fixée, effets, secousses, intensité de la sensation de vitesse, ombres), son (volume général, moteur, effets, ambiance), jeu (caméra par défaut, fantômes affichés, classement affiché, unité de vitesse), commandes (rappel clavier et manette, réglages tactiles), profil (pseudo, code de transfert) ; tout est mémorisé et s'applique immédiatement.
- **L'écran d'arrivée** : temps, médaille, rang du jour, et la **ligne à partager** :
  `Circuit du Jour #142 — 37,312 s — 🥇 — 23e/812`
- **Les archives** : la liste des jours passés avec une **miniature en vue aérienne**, le thème, les médailles et ta place figée ; on rejoue un jour avec le fantôme du premier et le classement figé.
- **Le Salon** (deuxième mode, le circuit du jour reste le mode principal) : un circuit qui **change toutes les 10 minutes**, à heure fixe pour tout le monde (xx:00, xx:10, xx:20…) ; tous ceux qui sont dans le Salon jouent le même circuit ; on voit **les fantômes des meilleurs tours des autres joueurs de la session**, avec leur pseudo, et le **classement de la session** qui se met à jour pendant qu'on joue ; un compte à rebours indique le temps restant ; **dans les 15 dernières secondes, plus aucune course ne peut partir** : c'est la « dernière chance » pour ceux qui roulent, avec un grand compte à rebours et le classement qui bouge en direct ; **à l'heure pile, le circuit change pour tout le monde en même temps** (une course pas finie ne compte pas), le podium final s'affiche par-dessus le départ du circuit suivant. Ligne à partager : `Salon 14:20 — 31,402 s — 3e/17`. Le Salon ne touche jamais aux records ni au classement du circuit du jour.

## 4. Direction artistique
Low-poly coloré et propre. **Chaque thème a sa lumière** (heure du jour, couleur du ciel, brume, intensité du soleil) et son décor : on ne confond pas deux thèmes. **Lisibilité d'abord** : panneaux de direction avant les virages, vibreurs, arche de départ et d'arrivée, portes de points de contrôle bien visibles, chaque revêtement, bas-côté et bloc à effet reconnaissable au premier coup d'œil. **La vitesse se voit** (bord de piste qui défile, marquages, champ de vision, lignes de vitesse, vent). Ombres portées, léger halo sur les néons et les turbos, phares la nuit. Les sections surélevées ont des piliers et laissent voir le vide ; les parois de cuve sont en damier. Une voiture low-poly originale et animée, des effets, des sons procéduraux et une ambiance sonore par thème. Dans le Salon, les fantômes des autres joueurs sont translucides, d'une couleur chacun, avec leur pseudo au-dessus. Pas de textures lourdes : le jeu se charge en quelques secondes, et reste fluide sur téléphone grâce aux niveaux de qualité.

## 5. Le circuit du jour
- **Le circuit du jour change à minuit, heure de Paris, pour tout le monde** : tous les joueurs découvrent le nouveau circuit au même instant (minuit en France, 6 h à Delhi…). « Aujourd'hui » est la date à Paris (heure d'été comprise). L'accueil affiche « Prochain circuit dans HH:MM:SS » et se recharge à minuit de Paris.
- **Généré à partir de la date** (graine = la date du jour, au sens de Paris) par **assemblage de figures** tirées d'une bibliothèque, avec leurs variantes. Règles : pas d'intersection au même niveau ; peu de virages serrés (sauf thème qui en fait son identité) ; au moins deux passages techniques et une portion rapide ; selon le thème, un saut sur élément technique et/ou une cuve ; jamais la même figure deux fois dans un circuit ; peu de figures en commun d'un jour au suivant.
- **Durée** : le temps de l'auteur tombe entre **30 et 40 s**, pour qu'une course correcte tienne en 30 à 45 s.
- **Un thème par jour, avec son format de circuit.** Chaque thème a une **fiche de format** (dénivelé, largeur dominante, densité de virages, longueur des droites, vitesse, sauts, revêtements, figures) que le générateur respecte et que le script de mesure vérifie ; deux thèmes ne doivent jamais se jouer pareil :
  - *Stade* — **le spectacle** : plein jour ensoleillé, herbe et vibreurs ; vitesse, cuves, sauts, turbos ;
  - *Rallye* — **la spéciale** : route étroite, terre et gravier, route bosselée ; **virages enchaînés sans longues droites**, épingles larges à prendre en dérapage, petits sauts sur des bosses ; pas de super turbo, pas de vide ;
  - *Canyon* — **les grands espaces** : soleil rasant, sable ; **route large, longues droites et courbes amples prises à fond**, super turbos, **longs sauts au-dessus des ravins**, parois rocheuses à prendre ; aucun virage serré ;
  - *Banquise* — **la patinoire** : jour blanc, neige poudreuse ; **tout plat**, large, **glace dominante**, slaloms et grandes courbes en roue libre ; pas de vide ;
  - *Col alpin* — **la descente** : matin clair, neige en bas-côté ; **départ en haut, arrivée tout en bas**, la vitesse vient de la pente, descentes raides entre des **lacets à freinage franc**, sections au-dessus du vide sans rebord ; pas de glace (sinon par plaques) ;
  - *Nuit* — nuit, néons, vide en bas-côté, sections suspendues, turbos, moteur coupé ;
  - *Campagne* — fin d'après-midi, herbe haute et clôtures, route étroite, collines, virages aveugles ;
  - *Ville* — jour, béton, route étroite entre des murs, virages à angle droit, lampadaires.
- **Validé par un pilote automatique** qui parcourt le circuit avec la même physique. S'il ne finit pas, le générateur recommence avec une graine voisine. Son temps donne le **temps de l'auteur**, d'où découlent les médailles.
- **Planning et remplacement** : le panneau d'admin montre les circuits à venir (avec leurs figures) ; Nathan peut remplacer un jour par une **variante**. Un jour commencé ou passé est **figé**.
- **Circuits du Salon** : même générateur, mêmes thèmes et même durée, graine tirée du **numéro de session** (`floor(heure UTC en secondes / 600)`), jamais deux fois le même thème de suite ; distincts des circuits du jour.
- **Plus tard, peut-être** : un circuit dessiné à la main le dimanche ; un éditeur.

## 6. Le classement
- Un **classement par jour** : meilleur temps de chaque joueur, rang, nombre de participants.
- **Validation par rediffusion** : le serveur **rejoue la course avec le même code de simulation** (et la variante du planning) et n'enregistre que le temps qu'il a lui-même recalculé.
- **Identité légère** : identifiant aléatoire et pseudo dans le navigateur ; pas d'e-mail, pas de mot de passe. Un **code de transfert** permet d'utiliser son profil sur plusieurs appareils à la fois (et de le retrouver le jour où le jeu change d'adresse) : records, fantôme, médailles et pseudo sont gardés par le serveur et synchronisés ; un code partagé par erreur se **révoque** (« Changer mon code »). **Un pseudo est réservé** à son premier propriétaire : pour l'utiliser ailleurs, il faut charger son code.
- **Comptes (plus tard, peut-être)** : si le jeu (ou d'autres jeux de Nathan) se monétise, un compte **facultatif** (connexion Google, Apple ou Discord, ou lien par e-mail) pourra être **relié** à l'identité anonyme existante sans rien perdre ; pas avant d'en avoir besoin.
- **Fantômes** : le serveur sert la rediffusion du premier et des voisins de classement.
- **Administration** : un jeton secret donne accès au planning ; aucun compte.
- **Classement du Salon** : un classement **par session de 10 minutes** (meilleur temps de chaque joueur), même validation par rejeu ; les courses doivent **finir avant l'heure pile** de fin de session (15 dernières secondes : plus de départ) ; le serveur n'accepte un envoi que jusqu'à quelques secondes après la fin (marge réseau) ; **tout ce qui concerne une session (courses, classement, podium) est oublié dès qu'elle est finie** : on ne garde aucun historique du Salon.

## 7. Technique
- **TypeScript partout**, en monorepo :
  - `packages/sim` — la **simulation pure** (physique, blocs, revêtements, bas-côtés, collisions, chronométrage, générateur, pilote) : **aucune dépendance au rendu ni au navigateur**, testée par Vitest ;
  - `apps/web` — le jeu (Vite + **Three.js**), les archives, le Salon et le panneau d'admin ;
  - `apps/api` — le classement, le planning et le Salon, qui importe le **même** `sim` pour rejouer les courses.
- **Déterminisme** : pas de temps fixe (120 par seconde, sous-pas fixes autorisés, interpolation à l'affichage) ; **pas de moteur physique externe** ; pas de `Math.sin`, `Math.cos`, `Math.exp`, `Math.atan2`, `Math.tanh`, `Math.random`, `Date` dans la simulation (le numéro de session du Salon est calculé hors de `sim` et lui est passé en entier). Un test vérifie qu'une même rediffusion donne **exactement** le même temps dans Node et dans les navigateurs. Le rendu, les effets, les sons, les caméras et les miniatures ne modifient **jamais** un résultat de `sim`.
- **Sans API**, le circuit du jour reste jouable (circuit par défaut de la date, course non classée) ; **le Salon a besoin du serveur** (sauf en mode démo, § 8).
- **Le Salon** : pas de connexion en temps réel au premier jalon — le jeu interroge le serveur toutes les quelques secondes (classement, fantômes) ; l'heure de référence est celle du serveur (décalage mesuré par le client). Voir les voitures des autres **en direct** (WebSocket) est une évolution possible, hors du premier jalon.
- **Hébergement (retenu le 13/10/2026)** — tout gratuit au démarrage, sans dépendre du PC de Nathan :
  - **jeu** : site statique sur **GitHub Pages** (gratuit ; 100 Go de bande passante par mois ; usage commercial interdit) ;
  - **API** : le conteneur Docker existant sur **Google Cloud Run** (offre gratuite mensuelle : 2 millions de requêtes, 180 000 vCPU-secondes ; s'éteint sans joueurs, se réveille en 1 à 2 s ; adresse `https://….run.app`) ; **nombre d'instances plafonné** (2) pour borner le coût, les alertes de budget de Google ne bloquant rien ;
  - **base** : **Turso** (compatible SQLite ; offre gratuite : 5 Go, 500 millions de lignes lues, 10 millions de lignes écrites par mois) — le disque d'un conteneur Cloud Run est effacé à chaque redémarrage ;
  - **pas de nom de domaine** au démarrage. **Plus tard, si le jeu prend** : un domaine (≈ 10 €/an) pour le jeu et l'API, le même conteneur sur Cloud Run payant à l'usage, ou Cloudflare Workers payant (5 $/mois, adaptateur existant) avec D1. Le jour où le jeu change d'adresse, les joueurs gardent leur identité grâce au **code de transfert**.
  - Workers gratuit reste exclu (10 ms de calcul par requête ; un rejeu coûte ≈ 18–38 ms). **Le coût d'un rejeu et le nombre de requêtes du Salon se surveillent** : ce sont eux qui consomment l'offre gratuite.
- **Tests** : Vitest pour la simulation ; Playwright pour le jeu ; scripts de mesure pour le générateur (`npm run measure:generator`).
- **Intégration continue** : GitHub Actions lance les tests à chaque push et publie l'aperçu.

## 8. Méthode : le développer dans le cloud
- **Claude Code sur le web** : chaque lot est une **session cloud** sur le dépôt GitHub du projet ; elle propose ses changements sous forme de branche et de pull request.
- **Tester un lot en deux clics** : chaque lot a son **aperçu en ligne** (une URL par branche) et un **scénario d'essai** dans l'URL. Le README du lot commence par le lien direct. Ce qui a besoin du serveur (classement, Salon) a un **mode démo** qui marche dans l'aperçu (`?api=demo`).
- **Liens de test dans le message de fin** : le **dernier message de la session** (celui que Nathan lit en fin de lot) contient toujours, sans qu'il ait à le demander, une courte section **« À tester »** avec les **liens complets et cliquables** de l'aperçu de la branche (adresse réelle `…/b/<branche>/`, scénarios du lot déjà dans l'URL), dans l'ordre où les essayer, chacun suivi d'une ligne sur ce qu'il faut constater ; plus le lien à ouvrir sur téléphone quand le lot touche au tactile ou au rendu. Avant de les donner, l'agent vérifie que l'aperçu de la branche est bien publié (workflow `pages.yml` terminé) ; sinon il le dit et donne les liens quand même, avec le moment où ils fonctionneront.
- **Les règles habituelles** : un lot = une session neuve = une branche = une PR (si l'environnement impose un autre nom de branche, le garder et adapter le lien d'aperçu) ; README d'une page dans `docs/lots/` ; chaque prompt de lot indique les modifications du `CLAUDE.md` que l'agent applique lui-même ; l'agent met à jour `docs/orchestration.md` (y compris le numéro de PR de son lot) et s'arrête quand les critères sont verts.
- **Enchaîner les lots** : Nathan ouvre une **session neuve** avec simplement :
  > *Lis `docs/seed.md` § 8 et § 12, puis fais le prochain lot.*

  (Si un lot a besoin d'une information de Nathan, par exemple une date, il l'ajoute à la suite de cette phrase ; s'il l'a oubliée, l'agent la lui demande avant de commencer.)

  Le prochain lot est le **premier lot du § 12 dont la PR n'est pas fusionnée** dans `origin/main`. Si la PR du lot précédent est encore ouverte, l'agent **ne démarre rien** et le signale. À un **point d'arrêt** (⏸), il s'arrête et attend Nathan. Un seul lot par session.
- **Tests : cibler en local, laisser la CI faire le run complet.** Pendant un lot, l'agent lance les tests unitaires en entier (`npm test`, rapide) mais, pour les e2e, **seulement les specs concernées par les fichiers modifiés** (`npx playwright test <spec> …` ou `--grep`). Il les liste dans le README du lot, rubrique « Vérifications », avec le critère de choix. Repères :
  - interface (HUD, accueil, pause, réglages, arrivée) → specs qui lisent `#meta`, `#menu`, `#pause`, `#board`, `#finish`, plus `mobile`, `tactile` et celles du lot ;
  - physique ou générateur → scénarios (`air`, `cuves`, `glace`…), `daily`, `replay`, golden ;
  - API ou Salon → `leaderboard`, `salon*`, `watch*`.

  **Avant de modifier ou supprimer un identifiant, une classe ou un texte de l'interface**, l'agent cherche ses usages dans `apps/web/e2e` (`grep`) et corrige ces specs dans le même lot. Il **ne lance pas le run e2e complet en local** (≈ 1 h en rendu logiciel) : **la CI (Chromium, Firefox, WebKit) est le seul critère de fusion**. Un run complet local n'est justifié que pour un lot qui touche tout (rendu, boucle de jeu).
- **Après tout changement de `SIM_VERSION` ou `GENERATOR_VERSION`** : références golden, `npm run history:seed`, `npm run measure:generator`, coût d'un rejeu mesuré (avant / après, même machine), jour de test de l'API revérifié.
- **Le quota** : Sonnet en effort moyen pour la plupart des lots ; Opus pour la physique et le générateur.

## 9. Hors du jeu
Comptes (e-mail, mot de passe), éditeur de circuits, plusieurs voitures, réglages de voiture par le joueur, personnalisation, monétisation, musique, **boucles, tunnels fermés, murs au plafond**, **voitures des autres joueurs en temps réel** et collisions entre joueurs (au premier jalon : le Salon montre des fantômes).

## 10. Plan en lots

**Livrés** (détail dans `docs/orchestration.md` et `docs/lots/`) : 0 Socle · 1 Voiture · 2 Blocs · 3 Rediffusion · 4 Circuit du jour · 5 Classement · 6 Arrivée & archives · 7 Conduite (+ 7b) · 10 Tactile (+ 10b) · 8 Surfaces & thèmes · 9 Feel & juice (+ 9b) · 11 Historique · 12 Circuits amples · 13 Miniatures · 14 Admin et planning · 15 Vitesse · 16 Glace · 17 Relief et sauts · 18 Cuves (+ 18b) · 19 Air · 20 Figures · 21 Bas-côtés et identité · 22 Nouveaux thèmes · 23 Graphismes · 24 Relevé doux · 26 Salon (jeu) · 27 Salon (serveur) (+ 27b oubli, revoir le meilleur tour) · 25 Formats de thèmes · 28 Mise en ligne (+ 28b déploiement réel, 13/10/2026).

**À venir** (prompts au § 12) :
- **Lot 29 — Accueil, réglages et compréhension.** Écran d'accueil (titre, classement du jour, choix circuit du jour / Salon, réglages), classement affiché par défaut en course, barre du haut refaite (Accueil et Réglages ; plus de bouton Salon), menu de pause, réglages complets, aide « Comment jouer », messages plus clairs. **À tester** : ouvrir le jeu, lancer le circuit du jour, revenir à l'accueil, passer au Salon, changer la qualité graphique.
- **Retouche 29b — Une CI fiable.** Tests e2e en parallèle (un job par navigateur, découpés en parts), une relance signalée, familles instables corrigées, horloge maîtrisée, `main` protégée. **À tester** : rien à jouer, retour du README (trois runs verts, moins de 20 min).
- **Lot 30 — Pseudos réservés et profil synchronisé.** Un pseudo appartient à son premier propriétaire ; le profil (records, fantôme, médailles, pseudo) est le même sur tous les appareils, le serveur fait foi ; un code peut être révoqué ; les doublons actuels sont réglés. **À tester** : prendre ton pseudo sur un autre navigateur (refusé) ; battre ton record sur le téléphone puis le retrouver sur le PC ; changer ton code.
- **Lot 31 — Jour de Paris, pas de circuit futur, et finale du Salon.** Le circuit change à minuit heure de Paris pour tout le monde (compte à rebours sur l'accueil) ; plus de touches N et T ni d'adresse qui montre un circuit à venir (on ne remonte que dans le passé) ; Salon : 15 dernières secondes de « dernière chance », puis changement de circuit pour tout le monde à l'heure pile. **À tester** : `?day=` d'un jour futur (refusé) ; une fin de session au Salon (`?mode=salon&api=demo&salonMinutes=2`).
- ⏸ **Ensuite** : calibrage des médailles ; **jalon** : une semaine de circuits et de Salons joués par Nathan et quelques amis ; nom de domaine si le jeu prend.

## 11. Concurrence
**Trackmania** propose déjà un « circuit du jour » (Track of the Day) et des serveurs où la carte tourne ; **PolyTrack**, un jeu de course low-poly dans le navigateur, a trouvé son public. La différence visée : le **format quotidien très court**, sans compte et sans installation, le **partage en une ligne**, **un caractère différent chaque jour**, et un Salon qui s'ouvre d'un clic dans le navigateur.

---

## 12. Prompts des lots

Chaque prompt se suffit à lui-même. L'agent exécute le prompt du prochain lot (règle d'enchaînement au § 8), dans une session neuve. Les prompts des lots livrés ont été retirés (historique Git et `docs/lots/`).

**Règles communes à tous les lots ci-dessous** :
- Pars de `main` à jour : `git fetch origin main && git checkout -B <branche du lot> origin/main` (ou la branche imposée par la session).
- Lis d'abord `docs/orchestration.md` (règles § 4, décisions § 7, pièges § 8) et le README des lots cités.
- Déterminisme strict de `sim` ; versions incrémentées dès qu'un résultat ou un circuit change ; après un changement de version : golden, `npm run history:seed`, `npm run measure:generator`, jour de test de l'API revérifié ; seul le temps rejoué par le serveur compte ; le jeu marche sans API ; ne jamais désactiver un test.
- **Toute nouvelle règle de générateur se valide par le script de mesure** (taux de validation par thème, durées 30–40 s, temps de génération), pas seulement par les tests ; la **durée estimée** (`estimateSeconds`) est réajustée si un nouveau bloc ou revêtement la fausse.
- **Mesurer le coût d'un rejeu** avant et après, sur la même machine, et le noter dans le README.
- **Tester la physique par des commandes variées**, pas seulement figées (braquages francs, durées et vitesses multiples, tirages au hasard à graine fixe).
- Un effet visuel se vérifie sur **une capture** jointe au README ; un changement d'ambiance se montre par **une capture par thème**.
- Les nouveaux paramètres de physique apparaissent dans le panneau `?debug&tune`.
- Tout bouton tactile ajouté reste **loin des frontières entre zones** (piège de la retouche 10b) et se vérifie avec `?zones=1`.
- README d'une page dans `docs/lots/`, qui **commence par le lien direct de l'aperçu** avec le scénario du lot ; PR en brouillon avec « À tester », « Garde-fous », « Vérifications faites », « Non vérifié » ; numéro de PR reporté dans `docs/orchestration.md` § 2.
- Rapport : vérifié (et comment) / non vérifié / décisions pour Nathan.
- **Tests** : `npm test` en entier, e2e **ciblés** seulement (règle du § 8), liste et critère de choix dans « Vérifications » ; « tous les tests verts » veut dire **la CI verte** sur la PR.
- **Message de fin de session** : il se termine par la section **« À tester »** avec les liens cliquables de l'aperçu (règle du § 8), sans attendre que Nathan les demande.

### Lot 29 — Accueil, réglages et compréhension

**Modèle conseillé : Sonnet, effort élevé** (interface et parcours ; aucune physique).

#### Contexte
- Lot 28 (et 28b) fusionnés ; **le jeu est en ligne** (GitHub Pages + Cloud Run + Turso). Branche : `lot-29-accueil-ux`. Lis `docs/lots/lot-6-arrivee-et-archives.md`, `lot-9-juice.md` (qualité automatique), `lot-10-tactile.md`, `lot-10b-zones-tactiles.md`, `lot-23-graphismes.md` (niveaux de qualité, caméras), `lot-26-salon.md`, `lot-27b-salon-oubli.md` (revoir le meilleur tour), `lot-28-mise-en-ligne.md` (code de transfert) ; pièges § 8 de l'orchestration (police de la CI, zones tactiles, identifiants HTML déjà pris).
- Retour de Nathan, capture à l'appui : en ouvrant le jeu, on tombe directement en course, avec en haut à droite une rangée de boutons peu parlants (Classement, Fantôme, Son, Archives, Salon), une ligne d'aide minuscule en bas, des médailles en petites icônes ; on comprend mal quoi faire. Demandes :
  1. arriver sur un **écran d'accueil** : titre du jeu, **classement du jour**, choix entre **le circuit du jour** et **le serveur live (Salon)**, accès aux **réglages** ;
  2. **le classement s'affiche par défaut** ;
  3. un **bouton Réglages** ; le **bouton Salon disparaît** au profit d'un **retour à l'accueil** ; même chose dans le **menu de pause** ;
  4. des **réglages plus complets** (qualité graphique, etc.) ;
  5. un tour d'amélioration de l'interface et surtout de la **compréhension**.

#### Objet
Qu'un joueur qui ouvre le lien pour la première fois comprenne en dix secondes ce qu'est le jeu, ce qu'il peut faire, et comment conduire.

#### À livrer
- **Écran d'accueil** (au chargement) :
  - titre du jeu ; carte du **circuit du jour** : numéro, date, thème, miniature (ou la scène du jour survolée lentement en fond, si le coût le permet : mesurer), médailles avec leur nom et leur temps, **ton meilleur temps, ta médaille et ton rang** s'il existe ;
  - **classement du jour** (les 10 premiers + ta ligne), « Revoir le meilleur tour » ;
  - deux grands boutons : **« Circuit du jour »** et **« Salon live »** (circuit en cours, thème, temps restant avant le prochain, joueurs présents ; état clair si le serveur ne répond pas) ;
  - **carte du profil**, bien visible : pseudo (modifiable), jours joués, médailles gagnées (par type), meilleur rang, série de jours consécutifs ; deux boutons **« Copier mon code »** (copie dans le presse-papiers, avec un avertissement : ce code donne accès à ton profil, ne le partage pas) et **« Charger un code »** (coller, aperçu du profil trouvé, confirmation, puis rechargement de l'identité et des records) ; les mêmes actions restent dans Réglages › Profil ;
  - liens secondaires : **Archives**, **Réglages**, **Comment jouer** ;
  - les liens de test directs (`?seed=`, `?day=`, `?scenario=`, `?mode=salon`, `?watch=best`, `?demo`) **sautent l'accueil** comme aujourd'hui ; `?home=1` le force.
- **En course** :
  - **classement affiché par défaut** (du jour, ou de la session dans le Salon), compact dans un coin, repliable (touche L, bouton), état mémorisé ; ta ligne marquée « toi » ; **deux joueurs au même pseudo** se distinguent (court suffixe, ex. « Nowy·2 ») ;
  - **barre du haut** refaite : **Accueil**, **Réglages**, Fantôme, Son (icône muet) ; **plus de bouton Salon** ; Archives depuis l'accueil et la pause ;
  - en-tête lisible : « Circuit du Jour n° 1 · 13 oct. · Rallye », médailles nommées (Auteur, Or, Argent, Bronze) avec leur temps, fantôme suivi ;
  - la ligne d'aide minuscule en bas est remplacée par l'aide « Comment jouer » ;
  - **vérifier le chrono** : sur la capture de Nathan, il affiche 1:01,717 alors que la voiture est arrêtée sur la ligne de départ ; s'il tourne avant le départ ou après une pause, corriger ; sinon expliquer ce qu'il affiche.
- **Menu de pause** (Échap / P / Start, bouton pause tactile) : Reprendre, Recommencer, Dernier point de contrôle, Réglages, Comment jouer, **Accueil** (avec confirmation si une course est en cours).
- **Réglages** (panneau à onglets, appliqués immédiatement, mémorisés et versionnés comme les réglages tactiles) :
  - **Graphismes** : qualité (Automatique, Basse, Moyenne, Haute — les trois niveaux du lot 23), effets (particules, traces), secousses de caméra, intensité de la sensation de vitesse (champ de vision, lignes), ombres ;
  - **Son** : volume général, moteur, effets, ambiance, muet ;
  - **Jeu** : caméra par défaut, fantômes affichés (aucun, mon record, le premier, le joueur devant), classement affiché par défaut, temps intermédiaires, unité de vitesse (km/h, mph) ;
  - **Commandes** : rappel clavier et manette ; réglages tactiles existants (mode de direction, sensibilité, taille des boutons, accélérateur automatique, vibration) ;
  - **Profil** : pseudo, code de transfert (copier / coller).
- **Comprendre le jeu** :
  - **« Comment jouer »** : une page courte et visuelle (commandes selon l'appareil : clavier, manette ou tactile ; reprise au point de contrôle ; frein en l'air ; médailles ; Salon) ; montrée automatiquement **à la première visite**, puis accessible partout ;
  - messages clairs : « Hors ligne : course non classée », « Temps enregistré · 4e sur 7 », « Nouveau record ! », envoi en cours ;
  - écran d'arrivée revu : temps, médaille, rang, et les actions Rejouer, Revoir le meilleur tour, Partager, Accueil.
- **Style** : une seule direction visuelle pour l'accueil, la pause, les réglages et le HUD (couleurs, typographie, boutons), lisible sur la scène 3D ; tout en français.
- **Mobile** : l'accueil et les réglages marchent aussi en portrait (le paysage n'est demandé que pour conduire) ; cibles d'au moins 44 px ; boutons de jeu loin des frontières de zones (`?zones=1`).
- **Ménage** de `docs/orchestration.md` : le § 9 dit encore « lot 25 en cours » et les versions citées au § 4 sont à vérifier.
- **Aucun changement de `sim`** ni de l'API (versions inchangées).

#### Critères d'arrêt
- Tous les tests verts, golden inchangés.
- Tests e2e : ouvrir le jeu → accueil (titre, classement, deux boutons) ; « Circuit du jour » lance la course avec le classement visible ; Accueil (barre et pause) ramène à l'accueil ; « Salon live » ouvre le Salon (démo) ; les liens de test sautent l'accueil ; un changement de qualité s'applique et survit au rechargement ; « Comment jouer » s'affiche à la première visite et pas à la seconde ; « Copier mon code » puis « Charger un code » dans un autre contexte de navigateur retrouve le même pseudo et les mêmes records ; mise en page sans chevauchement en paysage et en portrait (police DejaVu Sans).
- **Captures jointes au README** : accueil avec la carte du profil (ordinateur et téléphone), course avec classement, pause, chaque onglet des réglages, « Comment jouer ».
- README `docs/lots/lot-29-accueil-ux.md` : liens de l'aperçu — l'accueil en démo (`?api=demo`), puis `?api=demo&touch=1` à ouvrir sur le téléphone, puis le jeu en ligne une fois fusionné.

#### Modifications de `CLAUDE.md`
- Nouvelle section **« Interface »** : écrans (accueil, course, pause, réglages, comment jouer, arrivée), navigation, liens qui sautent l'accueil, `?home=1`, réglages (clés, version, application immédiate), règle « tout texte en français, cibles de 44 px, vérifié en portrait et en paysage ».

#### Mettre aussi à jour
`docs/orchestration.md` : § 2, § 3 (fichiers de l'interface), § 5 (commandes et touches), § 9.

#### Hors périmètre
Nouveaux modes, comptes, traduction, refonte du rendu 3D.

### Retouche 29b — Une CI fiable

**Modèle conseillé : Sonnet, effort élevé** (diagnostic de tests instables, CI ; aucune physique).

#### Contexte
- Lot 29 fusionné **avec la CI rouge**, en connaissance de cause. Branche : `lot-29b-ci-fiable`. Lis `.github/workflows/ci.yml`, `apps/web/playwright.config.*`, `apps/web/e2e/`, pièges § 8 de l'orchestration (timing de la CI, tests tactiles en pas à pas, rendu logiciel, horloge réelle).
- Constat de l'agent du lot 29 : **la CI est rouge sur `main` depuis au moins le 8 octobre**, uniquement le job `e2e` (le job `test`, 844 tests unitaires, et les déploiements sont verts). Cause principale : **un seul job en série de 30 à 55 min** (3 navigateurs × ≈ 190 tests, rendu logiciel, 2 cœurs), tests sensibles à la charge, aucun relancé, plusieurs dépendants du temps réel. Familles qui échouent : `planning` (Firefox), `thumbnails`, `watch`, parfois `salon-serveur`, `tactile`, `share` ; un cas lié à **minuit UTC** (le run a changé de jour en cours de route). Conséquence : « échec connu » est devenu une habitude et la CI ne protège plus rien.
- Règle du seed (§ 8) : **la CI est le seul critère de fusion**. Ce lot la rend vraie avant les lots 30 et 31.

#### Objet
Une CI verte, rapide et digne de confiance : rouge = vrai problème.

#### À livrer
- **Paralléliser** : le job `e2e` devient une **matrice** (un job par navigateur) et chaque navigateur est **découpé en parts** (`--shard`) ; rapports fusionnés en un seul (blob reporter + merge) ; objectif : **moins de 20 min** du push au verdict.
- **Relance encadrée** : `retries: 1` **en CI seulement** ; un test qui passe à la relance est **signalé « instable »** dans le résumé du run (pas caché) ; la liste des instables est écrite dans le README du lot et suivie dans `docs/orchestration.md` § 8.
- **Corriger chaque famille instable** (pas la masquer) : pour chacune, la cause trouvée et la correction — attendre un état plutôt qu'une durée (`__cdj.phase`, événements), pas à pas (`__cdj.manual` + `advance`) au lieu du temps réel, ressources partagées isolées (serveur de test, base, ports), **horloge maîtrisée** : `page.clock` de Playwright côté navigateur et une heure injectable côté API en test (variable réservée aux tests, refusée en production), pour qu'aucun test ne dépende de l'heure réelle ni ne puisse changer de jour en cours de route.
- **Interdits rappelés** : ne jamais désactiver, sauter ou affaiblir un test pour être vert (`skip`, `fixme`, seuils relâchés sans mesure) ; si un test est faux, le corriger et dire pourquoi.
- **Protection de `main`** : documenter dans le README les réglages GitHub que **Nathan** active (règle de protection de branche : statuts `test` et `e2e` obligatoires avant fusion), puisque l'agent ne peut pas les changer lui-même.
- **Garde-fou** : un petit job planifié (une fois par nuit, à une heure sans changement de jour) relance la suite complète sur `main` pour détecter les instabilités qui reviennent.

#### Critères d'arrêt
- **Trois runs complets verts d'affilée** sur la branche (relancés à la main), puis vert sur la PR ; durée de chaque run notée (objectif < 20 min) ; nombre de tests instables à la relance = **0** sur ces trois runs, sinon chacun expliqué.
- `npm test` vert ; aucun test supprimé, sauté ou affaibli (liste des tests modifiés et pourquoi dans le README).
- README `docs/lots/lot-29b-ci-fiable.md` : avant / après (durée, échecs), cause et correction par famille, réglages GitHub à activer par Nathan (pas à pas, avec ce qu'il doit voir), lien vers les trois runs verts. Pas de scénario de jeu à tester : **un simple retour du README suffit**.

#### Modifications de `CLAUDE.md`
- Section **« Tests »** : CI en matrice et en parts, relance unique en CI et signalement des instables, horloge maîtrisée dans les tests, interdits, « rouge = vrai problème ».

#### Mettre aussi à jour
`docs/orchestration.md` : § 5 (commandes de test), § 6 (méthode : CI obligatoire), § 8 (pièges : chaque famille instable et sa correction).

#### Hors périmètre
Nouvelles fonctions du jeu, changement de navigateurs testés.

### Lot 30 — Pseudos réservés et profil synchronisé

**Modèle conseillé : Sonnet, effort élevé** (API, identité, synchronisation).

#### Contexte
- Retouche 29b fusionnée (CI verte). Branche : `lot-30-pseudos`. Lis `docs/lots/lot-5-classement.md` (identité, sécurité), `lot-28-mise-en-ligne.md` (code de transfert, Turso), `lot-29-accueil-ux.md` (carte du profil).
- Constat de Nathan : le classement en ligne montre deux « Nathan » et trois « Nowy » (mêmes personnes sur plusieurs appareils). Décision : **un pseudo appartient à son premier propriétaire** ; pour l'utiliser sur un autre appareil, on charge son code.
- Aujourd'hui le code de transfert copie l'identité **et une photo des records locaux** : ensuite chaque appareil vit sa vie (record, fantôme « ton record », médailles des archives, pseudo affiché). Décision : **le profil devient vraiment multi-appareils**, le serveur fait foi, le stockage local n'est plus qu'un cache ; et un code peut être **révoqué**.

#### À livrer
- **Unicité côté serveur** : pseudo normalisé (minuscules, accents retirés, espaces réduits) unique sur toute la base ; règles de forme rappelées (longueur, caractères permis) ; contrainte en base (Turso et SQLite), vérifiée aussi à la création d'un joueur par sa première course.
- **Refus clair** : choisir un pseudo pris → « Ce pseudo est déjà utilisé. C'est le tien ? Charge ton code. » avec le bouton « Charger un code » ; suggestions libres (« Nowy2 », « Nowy_FR »…).
- **Doublons existants** : script de migration qui garde le pseudo pour le joueur **le plus ancien** (première course) ; les autres reçoivent un suffixe provisoire (« Nowy·2 ») et voient, à leur prochaine visite, un message leur proposant de choisir un nouveau pseudo ou de charger leur code. Rapport du script dans le README (qui a été renommé). Aucun temps perdu.
- **Sécurité** : le changement de pseudo passe par le débit limité existant ; pas de liste de pseudos exposée (la vérification répond seulement « libre » ou « pris ») ; mots interdits de base (liste courte, modifiable).
- **Profil synchronisé** (le serveur fait foi) :
  - route `GET /api/me` (identifiant secret dans un en-tête, jamais dans l'adresse) : pseudo, stats du profil (jours joués, médailles par type, meilleur rang, série de jours), meilleur temps du jour et sa rediffusion (pour le fantôme « ton record »), meilleurs temps des jours passés (pour les médailles des archives) ;
  - au lancement et au retour sur l'accueil, le jeu se **synchronise** : il fusionne serveur et local (le meilleur gagne ; un record local jamais envoyé, par exemple fait hors ligne, est **envoyé** au serveur pour validation par rejeu) ; un temps battu sur un appareil apparaît sur l'autre à sa prochaine synchronisation ;
  - changer de pseudo sur un appareil se voit sur l'autre ;
  - hors ligne : le cache local sert, le jeu le dit discrètement ;
  - coût mesuré : requêtes et lignes lues par synchronisation (offre gratuite Turso / Cloud Run).
- **Révocation du code** : « Changer mon code » (Réglages › Profil et carte du profil) : le serveur associe le profil à un **nouvel identifiant secret**, l'ancien devient inutilisable (réponse claire « ce code n'est plus valide ») ; l'appareil qui change le code reçoit le nouveau ; les autres appareils doivent charger le nouveau code ; tous les temps et le pseudo sont conservés. Confirmation obligatoire, débit limité.
- **Code de transfert simplifié** : il ne contient plus que l'identifiant secret (et une somme de contrôle) ; charger un code récupère le profil **depuis le serveur** ; les anciens codes (avec records) restent acceptés : leurs records sont envoyés pour validation, puis ignorés.
- **Salon et classements** : affichent le pseudo réservé ; le suffixe « ·2 » du lot 29 ne sert plus qu'aux comptes migrés.
- **Versions** : aucune (ni `sim` ni générateur).

#### Critères d'arrêt
- Tous les tests verts (SQLite et libSQL) ; tests d'API : pseudo pris refusé (casse et accents compris), libéré après changement de pseudo de son propriétaire, création par première course avec un pseudo pris refusée proprement ; migration testée sur une base avec doublons ; `GET /api/me` renvoie le bon profil ; après « Changer mon code », l'ancien identifiant est refusé partout et le nouveau garde tout.
- Test e2e à deux contextes de navigateur sur le même code : un record fait sur l'un apparaît sur l'autre après synchronisation (temps, fantôme « ton record », médaille dans les archives) ; un pseudo changé sur l'un se voit sur l'autre ; un record fait hors ligne est envoyé et classé au retour du réseau.
- README `docs/lots/lot-30-pseudos.md` : lien de l'aperçu en démo, puis les scénarios à faire en ligne après fusion : (1) deux navigateurs : le second tente ton pseudo → refusé → « Charger un code » → il devient toi ; (2) bats ton record sur le téléphone, ouvre l'accueil sur le PC → ton nouveau temps et ton fantôme y sont ; (3) « Changer mon code » sur le PC → le téléphone signale que son code n'est plus valide, tu y charges le nouveau ; commande de la migration et son rapport.

#### Modifications de `CLAUDE.md`
- Section **« Interface »** ou **« Classement »** : règle d'unicité, normalisation, migration, message de refus.
- Nouvelle section **« Profil »** : le serveur fait foi, `GET /api/me`, synchronisation et fusion, envoi des records hors ligne, révocation du code, format du code de transfert.

#### Hors périmètre
Comptes (e-mail, connexion Google…), modération avancée, expiration des pseudos inactifs, synchronisation des réglages entre appareils.

### Lot 31 — Jour de Paris, pas de circuit futur, et finale du Salon

**Modèle conseillé : Sonnet, effort moyen.**

#### Contexte
- Lot 30 fusionné. Branche : `lot-31-futur-finale`. Lis `docs/lots/lot-9b-visuels.md` (touches N et T), `lot-11-historique.md` (`?day=`), `lot-14-admin-planning.md` (`?variant=`, planning), `lot-26-salon.md`, `lot-27-salon-serveur.md`, `lot-27b-salon-oubli.md`, `lot-29-accueil-ux.md`.
- Demandes de Nathan :
  1. **désactiver les touches N et T** (circuit au hasard, thème suivant) et **interdire de voir un circuit à venir** par l'adresse : on ne peut remonter que dans le **passé** ;
  2. **le circuit du jour change à minuit, heure de Paris, pour tout le monde** (décision du 14/10/2026) : cela remplace la règle « jour UTC » de `CLAUDE.md` ; les circuits de chaque date ne changent pas, seul l'instant où « aujourd'hui » passe au jour suivant bouge : **aucune version à monter** ;
  3. au Salon, au moment de changer de circuit : **un compte à rebours de 15 s** pour les retardataires, puis **le circuit change pour tout le monde en même temps** ; on n'attend plus que les joueurs finissent, ils ont une limite de temps.

#### À livrer
- **Jour de Paris** (jeu, API, admin, démo) :
  - une seule fonction « date du jour » (hors de `sim`, qui reçoit toujours une date) : la date à **Europe/Paris** à l'instant donné, heure d'été comprise (`Intl.DateTimeFormat` avec `timeZone: "Europe/Paris"`, ou table des changements d'heure si l'environnement ne l'a pas : le vérifier sur Cloud Run et dans les trois navigateurs) ;
  - l'API l'utilise partout où elle utilisait le jour UTC : jour accepté pour un envoi, **grâce de 10 min après minuit de Paris**, classement du jour, jours figés du planning, `GET /api/day`, archives ;
  - **accueil** : « Prochain circuit dans HH:MM:SS » jusqu'à minuit de Paris ; à zéro, l'accueil se recharge sur le nouveau circuit (une course en cours n'est pas interrompue : elle reste sur son circuit, et son temps compte s'il est envoyé pendant la grâce) ;
  - **tests** du passage d'un jour à l'autre à 23 h 59 et 0 h 01 (Paris) en été et en hiver, et **autour du changement d'heure du dimanche 25/10/2026** (nuit de 25 h) et de mars ; un joueur à Delhi et un à New York voient le même circuit au même instant ;
  - mettre à jour la règle « jour UTC » partout où elle est écrite (`CLAUDE.md`, `docs/orchestration.md`, README des lots concernés si nécessaire).
- **Pas de circuit futur en production** (le site publié depuis `main`) :
  - touches **N** et **T** retirées (et de l'aide « Comment jouer ») ;
  - `?seed=` / `?day=` d'un jour **après aujourd'hui (date de Paris)** : refusé, on tombe sur le circuit du jour avec un message court ; les jours passés restent accessibles (archives) ;
  - `?variant=` et `?theme=` : refusés pour aujourd'hui et le futur (ils ne servent qu'à l'admin et aux essais) ;
  - les **aperçus de branche** et le mode `?debug` gardent ces outils pour les tests des agents (garde-fou testé : impossible en production) ;
  - l'admin (`/admin/`, sous jeton) garde le planning des jours à venir ;
  - le dire honnêtement dans le README : le générateur tourne dans le navigateur, donc quelqu'un de très motivé peut encore calculer un circuit futur en lisant le code ; on supprime l'accès facile, pas la possibilité technique (pour la supprimer, il faudrait une graine secrète côté serveur : à proposer dans le rapport, sans l'appliquer).
- **Finale du Salon** (jeu, serveur et démo) :
  - à **fin − 15 s** : plus aucun départ possible (le bouton « départ » est grisé, message « Dernière chance : plus de départ ») ; ceux qui roulent continuent ; grand compte à rebours **15 → 0** au centre ; classement de la session affiché d'office et rafraîchi plus souvent (toutes les 2 s) pour voir les derniers changements ;
  - à **l'heure pile** (`fin`, heure du serveur) : la course en cours s'arrête pour tous (non comptée), le **podium final** s'affiche par-dessus le circuit suivant, déjà chargé, dont le décompte de départ commence ; plus d'attente des retardataires ;
  - serveur : un envoi n'est accepté que jusqu'à `fin + 3 s` (marge réseau, mesurée et justifiée), au lieu de `fin + 60 s` ; la session est oubliée juste après (règle de la 27b) ;
  - sessions toujours alignées sur l'horloge (xx:00, xx:10…) ; `?salonMinutes` (démo et essais) suit la même règle.
- **Aucun changement de `sim`** (versions inchangées).

#### Critères d'arrêt
- Tous les tests verts, golden inchangés.
- Tests e2e : en production simulée, N et T ne font rien ; `?day=` futur → circuit du jour ; `?day=` passé → ce jour ; en `?debug` sur aperçu, les outils restent ; Salon en démo avec `?salonMinutes=1` : à `fin − 15 s` le départ est refusé, une course en cours peut finir avant `fin` et compte, une course non finie à `fin` est coupée et ne compte pas, le changement de circuit a lieu au même instant pour deux contextes de navigateur.
- Tests d'API : envoi à `fin + 2 s` accepté, à `fin + 5 s` refusé ; jour de Paris : envoi à 23 h 59 Paris compté pour ce jour, à 0 h 05 Paris compté pour la veille (grâce), à 0 h 15 refusé pour la veille ; changement d'heure du 25/10/2026 couvert.
- README `docs/lots/lot-31-futur-finale.md` : liens de l'aperçu — `?mode=salon&api=demo&salonMinutes=2` (attendre la fin d'une session : dernière chance, puis changement pour tous), puis l'adresse d'un jour futur (refusée), puis un jour passé (accepté), puis l'accueil (compte à rebours jusqu'à minuit de Paris).

#### Modifications de `CLAUDE.md`
- Section **« Salon »** : finale de 15 s, changement à l'heure pile, `fin + 3 s` côté serveur.
- Section **« Interface »** : outils d'essai (N, T, `?variant=`, `?theme=`, jours futurs) réservés aux aperçus et à `?debug`, jamais en production ; compte à rebours de l'accueil.
- Section **« Classement »** (ou règles) : **« aujourd'hui » = date à Paris**, grâce de 10 min après minuit de Paris (remplace la règle « jour UTC »).

#### Hors périmètre
Graine secrète côté serveur, nouveaux modes.

### ⏸ Fin des lots écrits

Après le lot 31, l'agent s'arrête : le calibrage et le jalon seront rédigés avec Nathan.
