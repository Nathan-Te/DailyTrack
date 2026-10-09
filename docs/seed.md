# Seed — « Circuit du Jour » (titre provisoire)

Source de vérité du projet. Vit dans `docs/seed.md`, n'est modifié que par Nathan. Projet **web, court**, conçu pour être développé **entièrement dans le cloud** (Claude Code sur le web), sans PC.

*Version 7 (09/10/2026) : lots 0 à 24 livrés. Ajoutés : un **format de circuit propre à chaque thème**, mesuré (Canyon ≠ Rallye, Col alpin = vraie descente ≠ Banquise), et un deuxième mode, **le Salon** : un circuit qui change toutes les 10 minutes, avec les fantômes des autres joueurs et le classement de la session. Prompts au § 12.*

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
- **Identité légère** : identifiant aléatoire et pseudo dans le navigateur ; pas d'e-mail, pas de mot de passe.
- **Fantômes** : le serveur sert la rediffusion du premier et des voisins de classement.
- **Administration** : un jeton secret donne accès au planning ; aucun compte.
- **Classement du Salon** : un classement **par session de 10 minutes** (meilleur temps de chaque joueur), même validation par rejeu ; une course commencée avant la fin compte si elle est envoyée dans la minute qui suit ; classements de session éphémères (gardés 48 h), podiums des dernières sessions conservés.

## 7. Technique
- **TypeScript partout**, en monorepo :
  - `packages/sim` — la **simulation pure** (physique, blocs, revêtements, bas-côtés, collisions, chronométrage, générateur, pilote) : **aucune dépendance au rendu ni au navigateur**, testée par Vitest ;
  - `apps/web` — le jeu (Vite + **Three.js**), les archives, le Salon et le panneau d'admin ;
  - `apps/api` — le classement, le planning et le Salon, qui importe le **même** `sim` pour rejouer les courses.
- **Déterminisme** : pas de temps fixe (120 par seconde, sous-pas fixes autorisés, interpolation à l'affichage) ; **pas de moteur physique externe** ; pas de `Math.sin`, `Math.cos`, `Math.exp`, `Math.atan2`, `Math.tanh`, `Math.random`, `Date` dans la simulation (le numéro de session du Salon est calculé hors de `sim` et lui est passé en entier). Un test vérifie qu'une même rediffusion donne **exactement** le même temps dans Node et dans les navigateurs. Le rendu, les effets, les sons, les caméras et les miniatures ne modifient **jamais** un résultat de `sim`.
- **Sans API**, le circuit du jour reste jouable (circuit par défaut de la date, course non classée) ; **le Salon a besoin du serveur** (sauf en mode démo, § 8).
- **Le Salon** : pas de connexion en temps réel au premier jalon — le jeu interroge le serveur toutes les quelques secondes (classement, fantômes) ; l'heure de référence est celle du serveur (décalage mesuré par le client). Voir les voitures des autres **en direct** (WebSocket) est une évolution possible, hors du premier jalon.
- **Hébergement** : le jeu est un site statique (GitHub Pages), gratuit. **L'API** — piste retenue : **serveur Debian de Nathan en Docker**, exposé par un **tunnel Cloudflare** (gratuit, aucun port ouvert, HTTPS automatique ; seul coût : un nom de domaine, ou un sous-domaine d'un domaine existant). Workers gratuit exclu (un rejeu coûte ≈ 38 ms) ; Workers payant (5 $/mois) en repli. **Le coût d'un rejeu se mesure à chaque lot qui touche à la physique** ; le Salon multiplie les envois : sa charge se mesure aussi (§ 12, lot 27).
- **Tests** : Vitest pour la simulation ; Playwright pour le jeu ; scripts de mesure pour le générateur (`npm run measure:generator`).
- **Intégration continue** : GitHub Actions lance les tests à chaque push et publie l'aperçu.

## 8. Méthode : le développer dans le cloud
- **Claude Code sur le web** : chaque lot est une **session cloud** sur le dépôt GitHub du projet ; elle propose ses changements sous forme de branche et de pull request.
- **Tester un lot en deux clics** : chaque lot a son **aperçu en ligne** (une URL par branche) et un **scénario d'essai** dans l'URL. Le README du lot commence par le lien direct. Ce qui a besoin du serveur (classement, Salon) a un **mode démo** qui marche dans l'aperçu (`?api=demo`).
- **Liens de test dans le message de fin** : le **dernier message de la session** (celui que Nathan lit en fin de lot) contient toujours, sans qu'il ait à le demander, une courte section **« À tester »** avec les **liens complets et cliquables** de l'aperçu de la branche (adresse réelle `…/b/<branche>/`, scénarios du lot déjà dans l'URL), dans l'ordre où les essayer, chacun suivi d'une ligne sur ce qu'il faut constater ; plus le lien à ouvrir sur téléphone quand le lot touche au tactile ou au rendu. Avant de les donner, l'agent vérifie que l'aperçu de la branche est bien publié (workflow `pages.yml` terminé) ; sinon il le dit et donne les liens quand même, avec le moment où ils fonctionneront.
- **Les règles habituelles** : un lot = une session neuve = une branche = une PR (si l'environnement impose un autre nom de branche, le garder et adapter le lien d'aperçu) ; README d'une page dans `docs/lots/` ; chaque prompt de lot indique les modifications du `CLAUDE.md` que l'agent applique lui-même ; l'agent met à jour `docs/orchestration.md` (y compris le numéro de PR de son lot) et s'arrête quand les critères sont verts.
- **Enchaîner les lots** : Nathan ouvre une **session neuve** avec simplement :
  > *Lis `docs/seed.md` § 8 et § 12, puis fais le prochain lot.*

  Le prochain lot est le **premier lot du § 12 dont la PR n'est pas fusionnée** dans `origin/main`. Si la PR du lot précédent est encore ouverte, l'agent **ne démarre rien** et le signale. À un **point d'arrêt** (⏸), il s'arrête et attend Nathan. Un seul lot par session.
- **Après tout changement de `SIM_VERSION` ou `GENERATOR_VERSION`** : références golden, `npm run history:seed`, `npm run measure:generator`, coût d'un rejeu mesuré (avant / après, même machine), jour de test de l'API revérifié.
- **Le quota** : Sonnet en effort moyen pour la plupart des lots ; Opus pour la physique et le générateur.

## 9. Hors du jeu
Comptes, éditeur de circuits, plusieurs voitures, réglages de voiture par le joueur, personnalisation, monétisation, musique, **boucles, tunnels fermés, murs au plafond**, **voitures des autres joueurs en temps réel** et collisions entre joueurs (au premier jalon : le Salon montre des fantômes).

## 10. Plan en lots

**Livrés** (détail dans `docs/orchestration.md` et `docs/lots/`) : 0 Socle · 1 Voiture · 2 Blocs · 3 Rediffusion · 4 Circuit du jour · 5 Classement · 6 Arrivée & archives · 7 Conduite (+ 7b) · 10 Tactile (+ 10b) · 8 Surfaces & thèmes · 9 Feel & juice (+ 9b) · 11 Historique · 12 Circuits amples · 13 Miniatures · 14 Admin et planning · 15 Vitesse · 16 Glace · 17 Relief et sauts · 18 Cuves (+ 18b) · 19 Air · 20 Figures · 21 Bas-côtés et identité · 22 Nouveaux thèmes · 23 Graphismes · 24 Relevé doux.

**À venir** (prompts au § 12) :
- **Lot 25 — Formats de thèmes.** Une fiche de format par thème, mesurée ; Rallye (spéciale sinueuse) ≠ Canyon (grands espaces à fond) ; Col alpin (vraie descente) ≠ Banquise (patinoire plate). **À tester** : deux circuits de chacun de ces quatre thèmes, l'un après l'autre.
- **Lot 26 — Le Salon (jeu, avec mode démo).** Circuit toutes les 10 minutes, fantômes et classement de la session, compte à rebours, podium, enchaînement ; joueurs fictifs en mode démo. **À tester** : `?mode=salon&api=demo`, puis une session raccourcie à 2 minutes.
- **Lot 27 — Le Salon (serveur).** Routes de l'API, validation par rejeu, heure du serveur, présence, purge, mesure de charge. **À tester** : le mode démo reste intact ; le vrai Salon se teste en local (commandes du README) ou à la mise en ligne.
- ⏸ **Ensuite** : mise en ligne (serveur de Nathan + tunnel Cloudflare, domaine, `PREMIER_JOUR` réel, `ADMIN_TOKEN`, sauvegarde, Salon ouvert) ; calibrage des médailles ; **jalon** : une semaine de circuits et de Salons joués par Nathan et quelques amis.

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

### Lot 25 — Formats de thèmes : chaque thème se joue autrement

**Modèle conseillé : Opus, effort élevé** (générateur, pilote, relief, mesures).

#### Contexte
- Lot 24 fusionné. Branche : `lot-25-formats`. Lis `docs/lots/lot-12-circuits-amples.md`, `lot-15-vitesse.md`, `lot-16-glace.md`, `lot-17-relief.md`, `lot-20-figures.md`, `lot-21-identite.md`, `lot-22-nouveaux-themes.md` ; pièges § 8 du générateur (chaque règle se compte et se mesure ; signatures longues qui sortent de la fenêtre ; favorites bloquées par les plafonds ; saut puis virage).
- Retour de Nathan après avoir joué les lots 21 à 24 :
  1. **Canyon et Rallye se ressemblent** : il faut un écart net de **format et de gameplay**, pas seulement de décor.
  2. Même chose pour **Col alpin et Banquise** ; **le Col alpin doit être vraiment une descente rapide**.

#### Objet
Donner à chaque thème un format de circuit qui se reconnaît à la conduite, et le prouver par des mesures.

#### À livrer
- **Fiche de format** par thème (dans `themes.ts`, un objet par thème, lu par le générateur et par le script de mesure) : dénivelé net visé (arrivée − départ), amplitude de relief, largeur dominante, densité de virages (virages par 100 m), plus longue droite permise, vitesse visée (moyenne et pointe), sauts au-dessus du vide (nombre, longueur), revêtements dominants, figures favorites et interdites, turbos permis.
- **Les quatre formats demandés** (valeurs indicatives : ajuste, mesure et documente) :
  - **Rallye — la spéciale** : route étroite (14 m) sur la plus grande partie ; terre et gravier, route bosselée ; **virages enchaînés** (S, épingles larges, courbes moyennes) avec **des droites courtes** (≤ 3 blocs) ; relief faible (bosses, petites crêtes) ; petits sauts sur bosse seulement, **aucun vide** ; **pas de super turbo**, au plus une plaque ; c'est le thème le plus sinueux et le plus riche en freinages et en dérapages.
  - **Canyon — les grands espaces** : route large (26 m) sur la plus grande partie ; **longues droites** et **courbes amples prises à fond**, super turbos ; **au moins deux sauts au-dessus d'un ravin**, dont un long (vide de deux cellules) ; parois rocheuses (murs latéraux, virages en cuve) ; **aucun virage serré** ; c'est le thème le plus rapide en moyenne avec le Col, et celui où l'on passe le plus de temps en l'air.
  - **Banquise — la patinoire** : **plat** (amplitude de relief ≤ 8 m, bosses permises) ; large ; **glace sur au moins 40 % de la longueur** ; slaloms et grandes courbes qui se prennent en roue libre ; **aucun vide**, aucun saut au-dessus du vide ; vitesses modestes, beaucoup de passages en roue libre.
  - **Col alpin — la descente** : **départ en haut, arrivée en bas** ; **dénivelé net d'au moins 40 m** (élargis la plage de hauteurs pour ce thème, aujourd'hui −24 / +24 m) ; **au moins 70 % de la longueur en descente**, aucune montée de plus d'un niveau ; **la vitesse vient de la pente** : descentes raides où le pilote dépasse 70 m/s **sans super turbo** (si les blocs de pente actuels ne le permettent pas, ajoute une descente plus raide : nouveau bloc, `SIM_VERSION` +1) ; **lacets** (épingles larges) à freinage franc entre les descentes ; sections au-dessus du vide sans rebord ; neige en bas-côté ; pas de figures de glace (glace par plaques au plus).
- **Les quatre autres thèmes** (Stade, Nuit, Campagne, Ville) reçoivent aussi leur fiche, tirée de ce qu'ils font déjà, pour que la comparaison porte sur les huit.
- **Générateur et pilote** : le générateur respecte chaque fiche ; le pilote gère les longues descentes (point de freinage avec la pente, vitesse d'entrée des lacets) et les enchaînements du Rallye ; durées toujours **30–40 s** (une descente rapide allonge le circuit en blocs : le budget se règle par `estimateSeconds` et le script) ; taux de validation par thème comparables à l'avant-lot.
- **Empreinte mesurée** (ajout à `npm run measure:generator`, sur 60 dates et sur au moins 12 circuits par thème forcé) : par thème, dénivelé net et amplitude, part de la longueur en descente, largeur moyenne, virages par 100 m, plus longue droite, vitesse moyenne et pointe du pilote, temps en l'air, sauts au-dessus du vide, part de chaque revêtement, moments de choix ; puis une **table de distance** entre thèmes (empreintes normalisées) qui nomme **les deux thèmes les plus proches**.
- **Rendu** : le Col montre sa descente (vue de départ plongeante, piliers, vallée en contrebas) ; la miniature du Col cadre une descente en lacets. Rien d'autre côté rendu.
- **Versions** : `GENERATOR_VERSION` +1 (et `SIM_VERSION` +1 si un bloc est ajouté) ; `history:seed` relancé.

#### Critères d'arrêt
- Tous les tests verts ; mesures dans le README, avec le tableau des empreintes des huit thèmes.
- **Écarts tenus** (seuils à fixer, écrire en test et vérifier au script) : Rallye et Canyon diffèrent nettement sur au moins **quatre** axes (largeur, virages par 100 m, plus longue droite, vitesse moyenne, temps en l'air) ; Col alpin et Banquise diffèrent nettement sur au moins **quatre** axes (dénivelé net, part en descente, pointe du pilote, part de glace, passages en roue libre) ; chaque circuit de Col a un dénivelé net ≤ −40 m ; chaque circuit de Banquise reste dans 8 m d'amplitude ; aucune paire de thèmes n'est plus proche qu'avant le lot.
- README `docs/lots/lot-25-formats.md` qui commence par les liens directs de l'aperçu : **deux circuits de Rallye puis deux de Canyon**, **deux de Banquise puis deux de Col alpin** (`?seed=…` ou `?theme=`), et une capture de chacun de ces quatre thèmes.

#### Modifications de `CLAUDE.md`
- Section **« Thèmes »** : fiche de format (champs, où elle vit, comment elle est mesurée), format de chacun des huit thèmes en une ligne, plage de hauteurs du Col.
- Section **« Mesures »** : empreinte par thème et table de distance ; règle « un thème nouveau ou modifié se valide par son empreinte ».

#### Mettre aussi à jour
`docs/orchestration.md` : § 7 (formats de thèmes), § 9.

#### Hors périmètre
Le Salon (lots 26 et 27), nouveaux thèmes, refonte du rendu.

### Lot 26 — Le Salon : un circuit toutes les 10 minutes (côté jeu, avec mode démo)

**Modèle conseillé : Opus, effort moyen** (nouveau mode, contrat avec le serveur, synchronisation d'horloge).

#### Contexte
- Lot 25 fusionné. Branche : `lot-26-salon`. Lis `docs/lots/lot-3-rediffusion.md`, `lot-5-classement.md`, `lot-11-historique.md` (mode démo, pilotes fictifs), `lot-13-miniatures.md` (génération dans un fil de travail), `lot-14-admin-planning.md`, `lot-20-figures.md`, `lot-23-graphismes.md` ; seed § 3, § 5, § 6, § 7 (le Salon).
- Demande de Nathan : un mode « serveur communautaire » avec **une carte qui change toutes les 10 minutes**, où les joueurs voient **le fantôme des autres joueurs** et un **classement de la session**.
- Décisions déjà prises (seed) : fantômes des meilleurs tours (pas de voitures en direct) ; un seul Salon pour tous ; sessions alignées sur l'horloge (xx:00, xx:10…) ; le serveur n'existe pas encore en ligne → ce lot livre le jeu **et un mode démo complet** ; le serveur est le lot 27.

#### Objet
Livrer le mode Salon jouable de bout en bout dans le navigateur, avec des joueurs fictifs, sur un contrat d'API que le lot 27 n'aura qu'à servir.

#### À livrer
- **Circuits du Salon** (`packages/sim`) : `salonCircuit(session: number)` — graine propre au Salon (distincte des circuits du jour), thème tiré du numéro de session, **jamais le même thème que la session précédente** (calcul du seul thème précédent, pas de son circuit), même générateur, mêmes fiches de format, mêmes durées ; id `salon-<session>-g<GENERATOR_VERSION>`. Aucun changement des circuits du jour (golden inchangés, versions inchangées). Le numéro de session (`floor(secondes UTC / 600)`) est calculé **hors de `sim`**.
- **Contrat d'API** (interface `SalonApi`, décrite dans le README et dans `CLAUDE.md`, implémentée ici en démo et au lot 27 par le serveur) :
  - `GET /api/salon/now` → heure du serveur (ms), session en cours, fin de session, id du circuit, nombre de joueurs présents ;
  - `GET /api/salon/<session>/board` → classement de la session (rang, pseudo, temps, écart), version du classement ;
  - `GET /api/salon/<session>/ghosts?players=…` → rediffusions demandées ;
  - `POST /api/salon/<session>/submit` → rediffusion d'une course ; réponse : temps validé, rang, classement à jour.
- **Déroulé d'une session** : arrivée dans le Salon sur la session en cours (même en cours de route) ; **compte à rebours** du temps restant toujours visible ; à 30 s de la fin, bandeau « dernier essai » ; une course commencée avant la fin peut se terminer (envoi accepté jusqu'à 60 s après la fin) ; à la fin, **podium** (trois premiers, ta place, ligne à partager `Salon 14:20 — 31,402 s — 3e/17`) pendant 10 s ; puis le circuit suivant, **préparé à l'avance** dans le fil de travail pendant les deux dernières minutes (aucun gel à la bascule).
- **Horloge** : l'heure de référence vient de `now` (décalage mesuré, demi-aller-retour) ; en démo, l'horloge locale.
- **Fantômes des autres** : jusqu'à **5 fantômes** (les trois premiers, le joueur juste devant et le juste derrière) **plus le tien** ; chacun d'une couleur, translucide, **pseudo au-dessus** ; ils repartent avec ta course ; rechargés quand le classement change ; touche **G** : tous / premiers seulement / aucun ; ne gênent jamais la conduite (pas de collision).
- **Classement de la session** : panneau compact sur le côté (touche **Tab** ; bouton sur mobile, loin des frontières de zones), rafraîchi toutes les 5 s ; rang, pseudo, temps, écart au premier ; ta ligne en évidence ; éclair quand quelqu'un te dépasse ou quand tu bats ton record ; nombre de joueurs présents.
- **Accès** : bouton **« Salon »** sur l'écran d'accueil et `?mode=salon` ; le circuit du jour reste le mode par défaut ; le Salon n'écrit jamais dans les records ni dans le classement du jour. Sans API (et hors démo) : message clair « le Salon a besoin du serveur » et retour au circuit du jour.
- **Mode démo** `?mode=salon&api=demo` (marche dans l'aperçu) : `DemoSalonApi` dans le navigateur ; **8 à 15 joueurs fictifs** qui arrivent au fil de la session et envoient des courses de plus en plus rapides (pilote automatique à niveaux variés, calculé dans le fil de travail, déterministe par session) ; tes courses entrent dans le classement de démo ; `?salonMinutes=N` raccourcit les sessions (démo et essais seulement, jamais avec le vrai serveur).
- **Tactile** : tout est jouable au doigt ; bouton du classement vérifié avec `?zones=1`.
- **Aucun changement de physique** : `SIM_VERSION` et `GENERATOR_VERSION` inchangées.

#### Critères d'arrêt
- Tous les tests verts, golden inchangés.
- Tests unitaires : `salonCircuit` déterministe, deux sessions de suite n'ont jamais le même thème (sur 500 sessions), temps de génération mesuré, durées 30–40 s.
- Tests e2e en démo, avec `?salonMinutes=1` (horloge pilotable en `?debug`) : arrivée en cours de session, joueurs fictifs dans le classement, fantômes chargés avec leur pseudo, course du joueur classée, bandeau de fin, podium, bascule vers un circuit d'un autre id **sans gel** (temps de fil principal mesuré pendant la bascule), course commencée avant la fin et finie après acceptée.
- Mesure : coût par image de cinq fantômes et de leurs étiquettes (profil mobile ×4).
- README `docs/lots/lot-26-salon.md` qui commence par les liens directs : `?mode=salon&api=demo`, puis `?mode=salon&api=demo&salonMinutes=2` (pour voir une bascule en deux minutes), puis le lien téléphone (`&touch=1`) ; une capture en course avec les fantômes, une du podium.

#### Modifications de `CLAUDE.md`
- Nouvelle section **« Salon »** : sessions et numéro de session, `salonCircuit`, contrat `SalonApi`, déroulé, fantômes, mode démo, `?mode=salon`, `?salonMinutes`, touches G et Tab ; règle « le Salon ne touche jamais au circuit du jour ».

#### Mettre aussi à jour
`docs/orchestration.md` : § 2, § 3 (fichiers du Salon), § 5 (commandes), § 7 (décisions du Salon).

#### Hors périmètre
Le serveur du Salon (lot 27), voitures en direct, plusieurs salons, points cumulés sur la journée.

### Lot 27 — Le Salon côté serveur

**Modèle conseillé : Sonnet, effort élevé** (API et charge ; aucune physique).

#### Contexte
- Lot 26 fusionné. Branche : `lot-27-salon-serveur`. Lis `docs/lots/lot-5-classement.md` (sécurité de l'API), `lot-14-admin-planning.md`, `lot-26-salon.md` (contrat `SalonApi`) ; règles § 4 de l'orchestration.

#### Objet
Servir le contrat du Salon depuis l'API, avec la même exigence que le classement du jour : seul le temps rejoué compte.

#### À livrer
- **Routes** du contrat du lot 26, dans `apps/api/src/api.ts` (adaptateur Node + SQLite en priorité ; l'adaptateur Workers suit s'il ne coûte rien de plus, sinon le dire).
- **Validation** : chaque envoi est **rejoué** sur `salonCircuit(session)` ; accepté pour la session en cours ou terminée depuis moins de 60 s ; refusé sinon (message clair) ; meilleur temps par joueur et par session ; un joueur n'existe qu'après une course valide (comme pour le jour).
- **Données** : tables `salon_runs` (session, joueur, temps, rediffusion, date) et `salon_podiums` (trois premiers de chaque session) ; **purge** des courses de plus de 48 h (podiums gardés) ; classement servi depuis la base, avec une version pour éviter les rechargements inutiles.
- **Circuits** : le circuit de la session suivante est généré **à l'avance** (deux minutes avant) et mis en cache, pour éviter un pic au changement de session.
- **Heure** : `now` donne l'heure du serveur ; **présence** = joueurs ayant interrogé le Salon dans les 30 dernières secondes (identifiants hachés, rien d'autre de conservé).
- **Sécurité et débit** : mêmes règles qu'au § 4 de l'orchestration (requêtes paramétrées, corps bornés, adresses hachées) ; au plus un envoi toutes les 5 s par joueur, limitation par adresse avant tout rejeu ; `SALON_MINUTES` (variable d'environnement, **tests et local seulement**) pour raccourcir les sessions.
- **Charge mesurée** : script qui simule 50 joueurs envoyant une course toutes les 40 s pendant une session, plus leurs lectures du classement toutes les 5 s ; temps de calcul et mémoire du serveur notés dans le README ; estimation du nombre de joueurs que tient le serveur de Nathan.
- **Jeu** : le Salon utilise l'API réelle quand une adresse est configurée (`VITE_API_URL` ou `?api=…`) ; le mode démo reste intact.
- **Docker** : rien à changer sauf les variables documentées (`SALON_MINUTES` absente en production).

#### Critères d'arrêt
- Tous les tests verts, golden inchangés.
- Tests d'API : envoi valide classé ; rediffusion falsifiée refusée ; envoi hors délai refusé ; meilleur temps conservé ; débit limité ; purge à 48 h (horloge simulée) ; podium conservé.
- Test e2e avec le **vrai serveur local** (`SALON_MINUTES=1`) et **deux navigateurs** : chacun termine une course, chacun voit le fantôme et la ligne de l'autre, la bascule de session se fait pour les deux au même moment.
- Mesure de charge dans le README.
- README `docs/lots/lot-27-salon-serveur.md` : lien de l'aperçu en démo (`?mode=salon&api=demo`, inchangé), puis **les commandes pour lancer le vrai Salon en local** (API avec `SALON_MINUTES=2`, jeu avec `?mode=salon&api=http://localhost:8787`), en disant clairement que le vrai Salon en ligne se testera à la mise en ligne.

#### Modifications de `CLAUDE.md`
- Section **« Salon »** : routes, validation, tables, purge, débit, `SALON_MINUTES`, mesure de charge.

#### Mettre aussi à jour
`docs/orchestration.md` : § 2, § 4 (règles du Salon), § 5, § 7 (hébergement : charge du Salon), § 9.

#### Hors périmètre
Mise en ligne, voitures en direct (WebSocket), plusieurs salons, modération des pseudos au-delà de l'existant.

### ⏸ Fin des lots écrits

Après le lot 27, l'agent s'arrête : la mise en ligne (qui ouvrira le Salon), le calibrage et le jalon seront rédigés avec Nathan.
