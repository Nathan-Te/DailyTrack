# Seed — « Circuit du Jour » (titre provisoire)

Source de vérité du projet. Vit dans `docs/seed.md`, n'est modifié que par Nathan. Projet **web, court**, conçu pour être développé **entièrement dans le cloud** (Claude Code sur le web), sans PC.

*Version 8 (13/10/2026) : lots 0 à 27 livrés (formats de thèmes, Salon jeu et serveur). Ajoutés : le Salon **oublie tout d'une session dès qu'elle est finie** ; **hébergement retenu** : jeu sur GitHub Pages, API sur Google Cloud Run, base sur Turso (offres gratuites) ; **code de transfert** d'identité ; **revoir le meilleur tour** (rediffusion du premier, caméra libre) ; retouche 27b et lot 28 au § 12.*

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
- **L'écran d'arrivée** : temps, médaille, rang du jour, et la **ligne à partager** :
  `Circuit du Jour #142 — 37,312 s — 🥇 — 23e/812`
- **Les archives** : la liste des jours passés avec une **miniature en vue aérienne**, le thème, les médailles et ta place figée ; on rejoue un jour avec le fantôme du premier et le classement figé.
- **Le Salon** (deuxième mode, le circuit du jour reste le mode principal) : un circuit qui **change toutes les 10 minutes**, à heure fixe pour tout le monde (xx:00, xx:10, xx:20…) ; tous ceux qui sont dans le Salon jouent le même circuit ; on voit **les fantômes des meilleurs tours des autres joueurs de la session**, avec leur pseudo, et le **classement de la session** qui se met à jour pendant qu'on joue ; un compte à rebours indique le temps restant ; à la fin, **podium**, puis le circuit suivant se charge tout seul. Ligne à partager : `Salon 14:20 — 31,402 s — 3e/17`. Le Salon ne touche jamais aux records ni au classement du circuit du jour.

## 4. Direction artistique
Low-poly coloré et propre. **Chaque thème a sa lumière** (heure du jour, couleur du ciel, brume, intensité du soleil) et son décor : on ne confond pas deux thèmes. **Lisibilité d'abord** : panneaux de direction avant les virages, vibreurs, arche de départ et d'arrivée, portes de points de contrôle bien visibles, chaque revêtement, bas-côté et bloc à effet reconnaissable au premier coup d'œil. **La vitesse se voit** (bord de piste qui défile, marquages, champ de vision, lignes de vitesse, vent). Ombres portées, léger halo sur les néons et les turbos, phares la nuit. Les sections surélevées ont des piliers et laissent voir le vide ; les parois de cuve sont en damier. Une voiture low-poly originale et animée, des effets, des sons procéduraux et une ambiance sonore par thème. Dans le Salon, les fantômes des autres joueurs sont translucides, d'une couleur chacun, avec leur pseudo au-dessus. Pas de textures lourdes : le jeu se charge en quelques secondes, et reste fluide sur téléphone grâce aux niveaux de qualité.

## 5. Le circuit du jour
- **Généré à partir de la date** (graine = date en UTC) par **assemblage de figures** tirées d'une bibliothèque, avec leurs variantes. Règles : pas d'intersection au même niveau ; peu de virages serrés (sauf thème qui en fait son identité) ; au moins deux passages techniques et une portion rapide ; selon le thème, un saut sur élément technique et/ou une cuve ; jamais la même figure deux fois dans un circuit ; peu de figures en commun d'un jour au suivant.
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
- **Identité légère** : identifiant aléatoire et pseudo dans le navigateur ; pas d'e-mail, pas de mot de passe. Un **code de transfert** permet de récupérer son identité et ses records sur un autre appareil ou à une autre adresse du jeu (utile le jour où le jeu change d'adresse).
- **Fantômes** : le serveur sert la rediffusion du premier et des voisins de classement.
- **Administration** : un jeton secret donne accès au planning ; aucun compte.
- **Classement du Salon** : un classement **par session de 10 minutes** (meilleur temps de chaque joueur), même validation par rejeu ; une course commencée avant la fin compte si elle est envoyée dans la minute qui suit ; **tout ce qui concerne une session (courses, classement, podium) est oublié dès qu'elle est finie** : on ne garde aucun historique du Salon.

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
- **Après tout changement de `SIM_VERSION` ou `GENERATOR_VERSION`** : références golden, `npm run history:seed`, `npm run measure:generator`, coût d'un rejeu mesuré (avant / après, même machine), jour de test de l'API revérifié.
- **Le quota** : Sonnet en effort moyen pour la plupart des lots ; Opus pour la physique et le générateur.

## 9. Hors du jeu
Comptes (e-mail, mot de passe), éditeur de circuits, plusieurs voitures, réglages de voiture par le joueur, personnalisation, monétisation, musique, **boucles, tunnels fermés, murs au plafond**, **voitures des autres joueurs en temps réel** et collisions entre joueurs (au premier jalon : le Salon montre des fantômes).

## 10. Plan en lots

**Livrés** (détail dans `docs/orchestration.md` et `docs/lots/`) : 0 Socle · 1 Voiture · 2 Blocs · 3 Rediffusion · 4 Circuit du jour · 5 Classement · 6 Arrivée & archives · 7 Conduite (+ 7b) · 10 Tactile (+ 10b) · 8 Surfaces & thèmes · 9 Feel & juice (+ 9b) · 11 Historique · 12 Circuits amples · 13 Miniatures · 14 Admin et planning · 15 Vitesse · 16 Glace · 17 Relief et sauts · 18 Cuves (+ 18b) · 19 Air · 20 Figures · 21 Bas-côtés et identité · 22 Nouveaux thèmes · 23 Graphismes · 24 Relevé doux · 26 Salon (jeu) · 27 Salon (serveur) · 25 Formats de thèmes.

**À venir** (prompts au § 12) :
- **Retouche 27b — Le Salon oublie, et on revoit le meilleur tour.** Courses, classement et podium d'une session effacés dès qu'elle est finie ; présence allégée ; nouveau « Revoir le meilleur tour » en spectateur. **À tester** : `?mode=salon&api=demo&salonMinutes=2` (après une bascule, plus aucune trace), puis `?api=demo` → archives → « Revoir le meilleur tour ».
- **Lot 28 — Mise en ligne (Cloud Run + Turso).** Base Turso, conteneur prêt pour Cloud Run, Salon sans tâche de fond, déploiement par la CI, `VITE_API_URL`, `PREMIER_JOUR` réel, code de transfert, guide pas à pas pour Nathan. **À tester** : le jeu en ligne sur deux appareils, un temps classé, le Salon à deux.
- ⏸ **Ensuite** : calibrage des médailles ; **jalon** : une semaine de circuits et de Salons joués par Nathan et quelques amis.

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
- **Message de fin de session** : il se termine par la section **« À tester »** avec les liens cliquables de l'aperçu (règle du § 8), sans attendre que Nathan les demande.

### Retouche 27b — Le Salon oublie chaque session ; revoir le meilleur tour

**Modèle conseillé : Sonnet, effort moyen.**

#### Contexte
- Lots 25, 26 et 27 fusionnés. Branche : `lot-27b-salon-oubli`. Lis `docs/lots/lot-26-salon.md` et `lot-27-salon-serveur.md` ; § 7 de l'orchestration (décisions des lots 26 et 27 : purge à 48 h, podiums gardés 30 jours, présence écrite à chaque lecture).
- Décision de Nathan : **une fois le circuit changé, on ne garde rien** de la session précédente — ni courses, ni classement, ni podium.
- Préparation de la mise en ligne (lot 28) : la base sera **Turso** (offre gratuite : 10 millions de lignes écrites par mois) et l'API tournera sur Cloud Run ; chaque écriture compte.

#### À livrer
- **Oubli** : à la fin d'une session (après la minute de grâce et l'affichage du podium), ses courses, son classement et son podium sont **effacés** ; plus de table ni de route d'historique des podiums (`GET /api/salon/podiums` retiré, côté jeu aussi) ; le podium de fin se calcule à partir du classement encore présent pendant la grâce. Le nettoyage se fait **à la demande** (à la première requête qui voit une session terminée), pas par une tâche de fond : sur Cloud Run, le service peut être éteint.
- **Présence allégée** : plus d'écriture à chaque lecture du classement ; au plus **une écriture par joueur et par 30 s** (ou présence gardée en mémoire si cela reste juste avec 2 instances : choisir, mesurer, documenter).
- **Mode démo** : même comportement (rien de la session précédente après la bascule).
- **Mesure** : relancer `npm run measure:salon` ; noter **les écritures en base par joueur et par heure** (avant / après) et le nombre de requêtes par joueur et par heure.
- **Revoir le meilleur tour** (demande de Nathan : pouvoir *jouer* le fantôme du meilleur temps, c'est-à-dire le regarder) : un mode **spectateur** qui rejoue la rediffusion du premier, sans voiture du joueur.
  - Accès : bouton « Revoir le meilleur tour » sur l'écran d'arrivée, dans le classement du jour, sur la carte d'un jour des archives, dans le classement du Salon (session en cours) ; adresse directe `?watch=best` (avec `?day=` ou `?mode=salon`).
  - Pendant la lecture : la voiture du meilleur (pas translucide, couleur du fantôme, pseudo au-dessus), les trois caméras (C) plus une **caméra libre** autour de la voiture, **pause**, **ralenti** (×0,25, ×0,5) et **accéléré** (×2), **retour de 5 s**, barre de progression ; chrono, temps intermédiaires et vitesse **du tour regardé** ; bandeau « Rediffusion de <pseudo> — <temps> ».
  - Fin : « Rejouer la rediffusion » ou « Courir contre ce fantôme » (lance une course normale avec ce fantôme).
  - Tactile : boutons de lecture loin des frontières de zones (`?zones=1`).
  - **Aucun changement de `sim`** : la lecture rejoue la rediffusion avec le même code (le retour en arrière rejoue depuis le départ ou depuis un instantané mis en mémoire toutes les quelques secondes : choisir et mesurer) ; rien n'est envoyé au serveur ; un spectateur ne compte pas dans la présence du Salon.

#### Critères d'arrêt
- Tous les tests verts, golden inchangés, aucune version changée.
- Tests d'API : après la fin d'une session (+ grâce), plus aucune ligne de cette session en base ; le podium reste servi pendant la grâce ; présence correcte avec l'écriture espacée.
- Tests e2e de la rediffusion : depuis les archives en démo, la lecture se termine sur **exactement** le temps du premier ; pause, ralenti et retour de 5 s ne changent pas ce temps ; « Courir contre ce fantôme » lance une course avec le bon fantôme.
- README `docs/lots/lot-27b-salon-oubli.md` : liens `?mode=salon&api=demo&salonMinutes=2` (laisser passer une bascule : le classement repart de zéro, aucun ancien podium accessible), `?api=demo&day=2026-09-30&watch=best` (revoir le meilleur tour d'un jour passé), puis `?mode=salon&api=demo&watch=best` ; les chiffres d'écritures et de requêtes ; une capture du mode spectateur.

#### Modifications de `CLAUDE.md`
- Section **« Salon »** : règle « une session finie est oubliée », nettoyage à la demande, présence espacée ; retrait des podiums gardés.
- Nouvelle section **« Revoir le meilleur tour »** : accès, `?watch=best`, commandes de lecture, retour en arrière (méthode retenue), règle « la lecture ne modifie jamais `sim` ».

#### Hors périmètre
Hébergement (lot 28).

### Lot 28 — Mise en ligne : Cloud Run + Turso

**Modèle conseillé : Sonnet, effort élevé** (adaptateurs, CI, déploiement ; aucune physique).

#### Contexte
- Retouche 27b fusionnée. Branche : `lot-28-mise-en-ligne`. Lis `docs/lots/lot-5-classement.md` (sécurité, adaptateurs), `lot-11-historique.md` (`PREMIER_JOUR`), `lot-14-admin-planning.md` (`ADMIN_TOKEN`), `lot-27-salon-serveur.md`, `lot-27b-salon-oubli.md` ; seed § 7 (hébergement retenu).
- **Date du jour n° 1** : Nathan la donne à la suite de la phrase de lancement (« Premier jour : AAAA-MM-JJ ») ; si elle manque, la lui demander avant de commencer.
- Un agent cloud **ne peut ni créer les comptes ni entrer une carte bancaire** : il prépare tout dans le dépôt et écrit un guide que Nathan suit en une demi-heure.

#### Objet
Mettre le jeu en ligne gratuitement : jeu sur GitHub Pages, API sur Cloud Run, base sur Turso, déploiement automatique depuis `main`.

#### À livrer
- **Base Turso** : implémentation de l'interface `SqlDb` sur le client libSQL (`@libsql/client`), choisie par variables d'environnement (`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`) ; SQLite locale inchangée pour le développement et les tests ; schéma créé ou mis à jour au démarrage ; mêmes tests d'API passés sur les deux bases (Turso simulé localement par un fichier libSQL si un vrai compte n'est pas disponible en CI).
- **Conteneur pour Cloud Run** : écoute sur `PORT` ; démarrage rapide (mesurer le temps de réveil) ; **aucune tâche de fond indispensable** : le circuit du jour et celui d'une session du Salon sont générés **à la première requête** qui en a besoin, puis gardés en base (un seul calcul même si deux requêtes arrivent en même temps) ; limite de débit qui reste juste avec 2 instances (en base, pas en mémoire, ou le dire).
- **Origines autorisées (CORS)** : l'adresse GitHub Pages du jeu (et les aperçus de branche), configurable (`ALLOWED_ORIGINS`).
- **Déploiement par la CI** : workflow `deploy-api.yml` sur `main` : construit l'image, la pousse dans Artifact Registry, déploie sur Cloud Run (**région européenne au tarif de niveau 1**, `--max-instances=2`, `--min-instances=0`, mémoire et concurrence choisies et justifiées) ; ignoré proprement tant que les secrets ne sont pas définis. Le workflow du site injecte `VITE_API_URL` (variable GitHub) dans la construction de `main`.
- **Secrets** : `ADMIN_TOKEN`, `TURSO_AUTH_TOKEN` en secrets Cloud Run (jamais dans le dépôt ni dans les journaux) ; `SALON_MINUTES` absente en production (l'API refuse de démarrer en production si elle est définie).
- **`PREMIER_JOUR`** réglé sur la date donnée par Nathan ; golden des circuits du jour (numéros) et `history:seed` régénérés ; le mode démo reste intact.
- **Code de transfert** : dans les réglages du jeu, « Copier mon code » (identifiant secret + pseudo + records locaux, encodé et vérifié par une somme de contrôle) et « Coller un code » (remplace l'identité locale après confirmation) ; aucune donnée envoyée au serveur pour cela.
- **Surveillance minimale** : `/api/health` (version, base joignable, `SALON_MINUTES` absente) ; journaux structurés courts.
- **Guide pour Nathan** `docs/mise-en-ligne.md`, pas à pas, chaque étape avec ce qu'il doit voir à l'écran :
  1. créer le projet Google Cloud, activer la facturation (carte), **alerte de budget à 1 €** ;
  2. activer Cloud Run et Artifact Registry ; créer le compte de service du déploiement et le relier à GitHub (fédération d'identité de préférence, sinon clé JSON en secret) ;
  3. créer la base Turso et son jeton ;
  4. renseigner les secrets et variables GitHub (liste exacte) ;
  5. fusionner, vérifier `/api/health`, renseigner `VITE_API_URL`, relancer la publication du site ;
  6. essai final : deux appareils, un temps classé, le Salon à deux.
- **Budget mesuré** : estimation documentée des requêtes, des vCPU-secondes et des écritures Turso par joueur et par jour (circuit du jour seul, et avec 30 min de Salon), et le nombre de joueurs que tient l'offre gratuite.

#### Critères d'arrêt
- Tous les tests verts (SQLite et libSQL), golden régénérés pour les seuls numéros des circuits.
- L'image Docker construite localement démarre avec une base libSQL et répond à `/api/health` ; temps de réveil mesuré.
- Workflow de déploiement validé (syntaxe, étapes ignorées sans secrets) ; aucun secret dans le dépôt.
- README `docs/lots/lot-28-mise-en-ligne.md` : lien de l'aperçu (code de transfert visible dans les réglages, mode démo intact), puis **le lien vers `docs/mise-en-ligne.md`** ; le message de fin de session dit clairement que la mise en ligne réelle se fait en suivant ce guide.

#### Modifications de `CLAUDE.md`
- Nouvelle section **« Production »** : Cloud Run (région, instances, secrets), Turso (variables, schéma), CORS, `VITE_API_URL`, déploiement par la CI, `/api/health`, règle « pas de tâche de fond indispensable » ; `PREMIER_JOUR` réel ; code de transfert.

#### Mettre aussi à jour
`docs/orchestration.md` : § 2, § 4 (règles de production), § 5, § 7 (hébergement tranché), § 9.

#### Hors périmètre
Nom de domaine, calibrage des médailles, comptes, Workers.

### ⏸ Fin des lots écrits

Après le lot 28, l'agent s'arrête : le calibrage et le jalon seront rédigés avec Nathan.
