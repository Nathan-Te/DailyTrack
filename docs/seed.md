# Seed — « Circuit du Jour » (titre provisoire)

Source de vérité du projet. Vit dans `docs/seed.md`, n'est modifié que par Nathan. Projet **web, court**, conçu pour être développé **entièrement dans le cloud** (Claude Code sur le web), sans PC.

*Version 6 (08/10/2026) : lots 0 à 20 livrés (avec la retouche 18b). Ajoutés : bas-côtés selon le thème, identité de jeu et de lumière propre à chaque thème (Stade en plein jour), mesure des moments de choix, trois nouveaux thèmes (Canyon, Col alpin, Ville) et le sable, refonte graphique (lisibilité, lumière, ambiance), bouton caméra sur mobile et caméra capot. Prompts au § 12.*

---

## 1. Le jeu en une phrase
Chaque jour, un nouveau circuit court, le même pour tout le monde : on le parcourt en 30 à 45 secondes dans le navigateur, on retente pour battre son temps et le fantôme du meilleur, et on partage son résultat en une ligne, comme un score de Wordle.

## 2. Les piliers
1. **Moins d'une minute par jour.** Une course de **30 à 45 secondes, grand maximum**. On joue en pause café ; on revient demain.
2. **Le même circuit pour tous.** Un circuit par jour, généré à partir de la date (ou une variante choisie à l'avance, § 5), identique pour chaque joueur.
3. **Zéro friction.** Un lien, ça démarre. Pas de compte, pas d'installation : un pseudo choisi au premier temps, mémorisé dans le navigateur.
4. **Un temps est une preuve.** La physique est **déterministe** : une course est entièrement décrite par la suite des commandes du joueur. Le serveur rejoue la course pour valider le temps, et la même rediffusion sert de fantôme.
5. **Vite, technique, lisible — et chaque jour a son caractère.** Low-poly coloré, de vraies pointes de vitesse et de vrais passages techniques ; un circuit se lit en un coup d'œil ; **on reconnaît le thème du jour au premier regard et à la conduite**. La conduite a la tenue de route, le mordant et la démesure d'un Trackmania.

## 3. Le jeu
- **La voiture** : une seule, arcade, inspirée de Trackmania — accélération franche, direction immédiate, adhérence forte avec une limite lisible, dérapage au frein, suspension qui suit le relief, vitesse qui grimpe dans les descentes et sur les turbos, capacité à rouler sur une paroi tant qu'on va assez vite.
- **En l'air** : la voiture garde la rotation de son décollage ; **le frein en l'air la fige** ; **à l'atterrissage, elle se pose** sans rebond ; une réception de travers coûte de la vitesse.
- **Commandes** : accélérer, freiner/reculer (et figer en l'air), tourner (analogique à la manette), **recommencer au dernier point de contrôle**, **recommencer depuis le départ**, **changer de caméra** (proche, loin, capot). Clavier, manette et tactile (**deux pédales par défaut**, accélérateur automatique en option ; **bouton caméra**).
- **Le circuit** : des **blocs** sur une grille, à la Trackmania, assemblés en **figures** (passages techniques, portions rapides, sauts sur éléments techniques, combinaisons) : lignes droites, virages serrés, courbes amples, virages relevés, plusieurs niveaux, crêtes, vrais sauts au-dessus du vide, **cuves** qui font gagner de la vitesse. La largeur de la piste varie. Pas de boucles au premier jalon.
- **Les bas-côtés** : là où la route n'a pas de rebord, elle est bordée d'une bande qui dépend du thème (**herbe**, **terre et gravier**, **neige poudreuse**, **sable**, vide) ; en sortir **ralentit** sans faire tomber ; couper un virage par le bas-côté est un choix risqué. Les virages ont des **vibreurs**.
- **Les revêtements** (par bloc) : **route**, **terre** (glisse et se rattrape), **glace** (rapide en ligne droite, très peu d'adhérence à l'accélérateur, redirection en roue libre), **herbe** (lente et glissante), **sable** (lent mais stable).
- **Les blocs à effet** : **plaque d'accélération**, **super turbo**, **moteur coupé**.
- **Tomber** : une voiture qui rate un saut ou quitte la piste par le vide reprend automatiquement au dernier point de contrôle (le chrono continue).
- **La course** : chronomètre au millième, temps intermédiaires aux points de contrôle, essais illimités dans la journée.
- **Les médailles** : bronze, argent, or et **temps de l'auteur** (§ 5).
- **Les fantômes** : son propre meilleur temps, et au choix celui du premier du classement ou du joueur juste devant soi.
- **L'écran d'arrivée** : temps, médaille, rang du jour, et la **ligne à partager** :
  `Circuit du Jour #142 — 37,312 s — 🥇 — 23e/812`
- **Les archives** : la liste des jours passés avec une **miniature en vue aérienne**, le thème, les médailles et ta place figée ; on rejoue un jour avec le fantôme du premier et le classement figé.

## 4. Direction artistique
Low-poly coloré et propre. **Chaque thème a sa lumière** (heure du jour, couleur du ciel, brume, intensité du soleil) et son décor : on ne confond pas deux thèmes. **Lisibilité d'abord** : panneaux de direction avant les virages, vibreurs, arche de départ et d'arrivée, portes de points de contrôle bien visibles, chaque revêtement, bas-côté et bloc à effet reconnaissable au premier coup d'œil. **La vitesse se voit** (bord de piste qui défile, marquages, champ de vision, lignes de vitesse, vent). Ombres portées, léger halo sur les néons et les turbos, phares la nuit. Les sections surélevées ont des piliers et laissent voir le vide ; les parois de cuve sont en damier. Une voiture low-poly originale et animée, des effets, des sons procéduraux et une ambiance sonore par thème. Pas de textures lourdes : le jeu se charge en quelques secondes, et reste fluide sur téléphone grâce aux niveaux de qualité.

## 5. Le circuit du jour
- **Généré à partir de la date** (graine = date en UTC) par **assemblage de figures** tirées d'une bibliothèque, avec leurs variantes. Règles : pas d'intersection au même niveau ; au moins deux largeurs ; peu de virages serrés (sauf thème qui en fait son identité) ; au moins deux passages techniques et une portion rapide ; selon le thème, un saut sur élément technique et/ou une cuve ; jamais la même figure deux fois dans un circuit ; peu de figures en commun d'un jour au suivant.
- **Durée** : le temps de l'auteur tombe entre **30 et 40 s**, pour qu'une course correcte tienne en 30 à 45 s.
- **Un thème par jour** — chacun avec **sa lumière, son bas-côté, ses revêtements, son relief, ses figures favorites, sa signature et son ambiance** :
  - *Stade* — **plein jour ensoleillé**, herbe et vibreurs, vitesse, cuves, sauts ;
  - *Rallye* — terre et gravier, route bosselée, épingles à prendre en dérapage, petits sauts ;
  - *Banquise* — jour blanc, neige poudreuse, glace et roue libre ;
  - *Nuit* — nuit, néons, vide en bas-côté, sections suspendues, turbos, moteur coupé ;
  - *Campagne* — fin d'après-midi, herbe haute et clôtures, route étroite, collines, virages aveugles ;
  - *Canyon* — soleil rasant, sable, parois rocheuses qui servent de murs, longs sauts au-dessus des ravins ;
  - *Col alpin* — matin clair, grosses descentes, épingles larges, sections au-dessus du vide, neige en bas-côté ;
  - *Ville* — jour, béton, route étroite entre des murs, virages à angle droit, lampadaires.
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
  - `packages/sim` — la **simulation pure** (physique, blocs, revêtements, bas-côtés, collisions, chronométrage, générateur, pilote) : **aucune dépendance au rendu ni au navigateur**, testée par Vitest ;
  - `apps/web` — le jeu (Vite + **Three.js**), les archives et le panneau d'admin ;
  - `apps/api` — le classement et le planning, qui importe le **même** `sim` pour rejouer les courses.
- **Déterminisme** : pas de temps fixe (120 par seconde, sous-pas fixes autorisés, interpolation à l'affichage) ; **pas de moteur physique externe** ; pas de `Math.sin`, `Math.cos`, `Math.exp`, `Math.atan2`, `Math.tanh`, `Math.random`, `Date` dans la simulation. Un test vérifie qu'une même rediffusion donne **exactement** le même temps dans Node et dans les navigateurs. Le rendu, les effets, les sons, les caméras et les miniatures ne modifient **jamais** un résultat de `sim`.
- **Sans API**, le jeu reste jouable (circuit par défaut de la date, course non classée).
- **Hébergement** : le jeu est un site statique (GitHub Pages), gratuit. **L'API** — piste retenue : **serveur Debian de Nathan en Docker**, exposé par un **tunnel Cloudflare** (gratuit, aucun port ouvert, HTTPS automatique ; seul coût : un nom de domaine, ou un sous-domaine d'un domaine existant). Workers gratuit exclu (un rejeu coûte ≈ 38 ms) ; Workers payant (5 $/mois) en repli. **Le coût d'un rejeu se mesure à chaque lot qui touche à la physique.**
- **Tests** : Vitest pour la simulation ; Playwright pour le jeu ; scripts de mesure pour le générateur (`npm run measure:generator`).
- **Intégration continue** : GitHub Actions lance les tests à chaque push et publie l'aperçu.

## 8. Méthode : le développer dans le cloud
- **Claude Code sur le web** : chaque lot est une **session cloud** sur le dépôt GitHub du projet ; elle propose ses changements sous forme de branche et de pull request.
- **Tester un lot en deux clics** : chaque lot a son **aperçu en ligne** (une URL par branche) et un **scénario d'essai** dans l'URL. Le README du lot commence par le lien direct.
- **Liens de test dans le message de fin** : le **dernier message de la session** (celui que Nathan lit en fin de lot) contient toujours, sans qu'il ait à le demander, une courte section **« À tester »** avec les **liens complets et cliquables** de l'aperçu de la branche (adresse réelle `…/b/<branche>/`, scénarios du lot déjà dans l'URL), dans l'ordre où les essayer, chacun suivi d'une ligne sur ce qu'il faut constater ; plus le lien à ouvrir sur téléphone quand le lot touche au tactile ou au rendu. Avant de les donner, l'agent vérifie que l'aperçu de la branche est bien publié (workflow `pages.yml` terminé) ; sinon il le dit et donne les liens quand même, avec le moment où ils fonctionneront.
- **Les règles habituelles** : un lot = une session neuve = une branche = une PR (si l'environnement impose un autre nom de branche, le garder et adapter le lien d'aperçu) ; README d'une page dans `docs/lots/` ; chaque prompt de lot indique les modifications du `CLAUDE.md` que l'agent applique lui-même ; l'agent met à jour `docs/orchestration.md` (y compris le numéro de PR de son lot) et s'arrête quand les critères sont verts.
- **Enchaîner les lots** : Nathan ouvre une **session neuve** avec simplement :
  > *Lis `docs/seed.md` § 8 et § 12, puis fais le prochain lot.*

  Le prochain lot est le **premier lot du § 12 dont la PR n'est pas fusionnée** dans `origin/main`. Si la PR du lot précédent est encore ouverte, l'agent **ne démarre rien** et le signale. À un **point d'arrêt** (⏸), il s'arrête et attend Nathan. Un seul lot par session.
- **Après tout changement de `SIM_VERSION` ou `GENERATOR_VERSION`** : références golden, `npm run history:seed`, `npm run measure:generator`, coût d'un rejeu mesuré (avant / après, même machine), jour de test de l'API revérifié.
- **Le quota** : Sonnet en effort moyen pour la plupart des lots ; Opus pour la physique et le générateur.

## 9. Hors du jeu
Multijoueur en direct, comptes, éditeur de circuits, plusieurs voitures, réglages de voiture par le joueur, personnalisation, monétisation, musique, **boucles, tunnels fermés, murs au plafond** (au premier jalon).

## 10. Plan en lots

**Livrés** (détail dans `docs/orchestration.md` et `docs/lots/`) : 0 Socle · 1 Voiture · 2 Blocs · 3 Rediffusion · 4 Circuit du jour · 5 Classement · 6 Arrivée & archives · 7 Conduite (+ 7b) · 10 Tactile (+ 10b) · 8 Surfaces & thèmes · 9 Feel & juice (+ 9b) · 11 Historique · 12 Circuits amples · 13 Miniatures · 14 Admin et planning · 15 Vitesse · 16 Glace · 17 Relief et sauts · 18 Cuves (+ 18b) · 19 Air · 20 Figures.

**À venir** (prompts au § 12) :
- **Lot 21 — Bas-côtés et identité des thèmes.** Bas-côtés selon le thème, vibreurs, identité de conduite et de lumière par thème (Stade en plein jour), mesure des moments de choix. **À tester** : `?scenario=bas-cotes`, puis un circuit par thème.
- **Lot 22 — Nouveaux thèmes.** Canyon (sable, parois rocheuses, ravins), Col alpin (descentes, épingles, vide), Ville (béton, murs, angles droits). **À tester** : un circuit de chaque nouveau thème.
- **Lot 23 — Graphismes, ambiance et caméras.** Panneaux, arche, ombres, lumière et brume par thème, halo, phares, décor plus dense, ambiance sonore, bouton caméra sur mobile, caméra capot. **À tester** : un circuit par thème sur ordinateur et sur téléphone.
- ⏸ **Ensuite** : mise en ligne (serveur de Nathan + tunnel Cloudflare, domaine, `PREMIER_JOUR` réel, `ADMIN_TOKEN`, sauvegarde) ; calibrage des médailles ; **jalon** : une semaine de circuits joués par Nathan et quelques amis.

## 11. Concurrence
**Trackmania** propose déjà un « circuit du jour » (Track of the Day) ; **PolyTrack**, un jeu de course low-poly dans le navigateur, a trouvé son public. La différence visée : le **format quotidien très court**, sans compte et sans installation, le **partage en une ligne**, et **un caractère différent chaque jour**.

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

### Lot 21 — Bas-côtés et identité des thèmes

**Modèle conseillé : Opus, effort moyen** (revêtement en travers de la route, générateur, pilote).

#### Contexte
- Lot 20 fusionné. Branche : `lot-21-identite`. Lis `docs/lots/lot-8-surfaces-themes.md`, `lot-12-circuits-amples.md`, `lot-17-relief.md`, `lot-20-figures.md`, `lot-9b-visuels.md` ; § 7 (décision du lot 8 : revêtement par bloc entier ; décision du lot 20 sur la part du temps à plein gaz) et § 9 (leviers proposés) de l'orchestration.
- Retours de Nathan :
  1. **L'herbe n'est pas utilisée** ; dans Trackmania, elle sert de **bordure de piste** selon le thème.
  2. Les thèmes manquent d'**identité** ; en particulier **Stade ressemble beaucoup à Nuit en termes de lumière**.
  3. D'accord pour remplacer la mesure « part du temps à plein gaz » (critère du lot 20 non tenu) par une **mesure des moments de choix**.

#### Objet
Donner à chaque thème une identité de conduite et de lumière, avec des bas-côtés qui créent de vrais choix.

#### À livrer
- **Bas-côtés** : sur les blocs **sans rebord** (attribut de bloc, chaîné comme la largeur), une bande de chaque côté de la route dont le revêtement dépend du thème — **herbe**, **terre et gravier**, **neige poudreuse** (nouveau : très lente, peu d'adhérence), ou **vide** (sections suspendues : comportement actuel). En sortir **ralentit nettement sans faire tomber** ; couper l'intérieur d'un virage par le bas-côté est un **pari** (gagner de la distance, perdre de la vitesse). La bande tient dans la cellule (route + deux bas-côtés ≤ 32 m) : sa largeur dépend donc de la largeur de route ; au-delà, un rebord bas ou le vide (à décider et documenter). Le revêtement d'un point dépend désormais de sa **position en travers** de la route : garder **au bit près** le comportement des blocs sans bas-côté (vérifier contre les références, comme au lot 12).
- **Vibreurs** dans les virages (bandes en bord intérieur et extérieur) : adhérence normale, petite vibration et son ; ils marquent la limite de la route.
- **Identité par thème** (règles du générateur, revêtements, bas-côtés, figures favorites, lumière) :
  - *Stade* : **plein jour ensoleillé** (ciel bleu, soleil haut, herbe verte, lumière chaude), bas-côtés d'herbe, vibreurs ; vitesse, cuves, sauts ;
  - *Rallye* : bas-côtés de terre et gravier ; **route bosselée** (petites ondulations du sol sur certains blocs, à ajouter dans la physique) ; épingles larges qui se prennent en dérapage ; petits sauts ;
  - *Banquise* : jour blanc, bas-côtés de neige poudreuse ; glace et roue libre ;
  - *Nuit* : nuit franche, **vide en bas-côté**, bordures néon ; sections suspendues, turbos, moteur coupé ;
  - *Campagne* : fin d'après-midi, bas-côtés d'herbe haute, clôtures en décor ; route étroite, collines, virages aveugles (crête suivie d'un virage).
  Lumière de base par thème (heure, couleur du ciel, intensité, couleur du sol) **dans ce lot** pour que Stade et Nuit ne se confondent plus ; la refonte graphique complète vient au lot 23.
- **Pilote** : il reste sur la route par défaut ; il peut prendre les vibreurs ; il ne coupe par un bas-côté que si c'est plus rapide (mesuré, sans obligation) ; il gère la route bosselée et la neige poudreuse.
- **Mesure des moments de choix** (remplace la « part du temps à plein gaz » comme critère, qui reste affichée) : nombre de freinages, de passages en roue libre, de choix mur / fond, de virages où un bas-côté est coupable, de sauts où le frein en l'air sert ; par circuit et par thème.
- **Scénario** `?scenario=bas-cotes` : un virage par type de bas-côté (herbe, terre, neige, vide), des vibreurs, une portion bosselée.
- **Versions** : `SIM_VERSION` +1, `GENERATOR_VERSION` +1.

#### Critères d'arrêt
- Tous les tests verts ; tests chiffrés : sortir sur chaque bas-côté ralentit selon un ordre documenté (neige poudreuse la plus lente) sans chute ; couper un virage par l'herbe peut être plus rapide **ou** plus lent selon l'angle (les deux cas existent) ; les blocs sans bas-côté rejouent au bit près ; sur 60 dates, chaque thème a ses bas-côtés et sa règle propre ; moments de choix mesurés par thème (aucun thème nettement plus pauvre que les autres, sinon le dire).
- README `docs/lots/lot-21-identite.md` avec le lien `?scenario=bas-cotes`, puis un circuit par thème (`?seed=…`) et **une capture par thème** (Stade et Nuit côte à côte en premier).

#### Modifications de `CLAUDE.md`
- Section **« Surfaces et blocs à effet »** : bas-côtés (attribut, largeur, revêtements, neige poudreuse), vibreurs, route bosselée, revêtement selon la position en travers.
- Section **« Thèmes »** : identité de chaque thème (lumière, bas-côtés, règles, figures favorites).
- Section **« Mesures »** : moments de choix.
- Commandes : `?scenario=bas-cotes`.

#### Mettre aussi à jour
`docs/orchestration.md` : § 7 (revêtement par position en travers ; critère « plein gaz » remplacé), § 9.

#### Hors périmètre
Nouveaux thèmes (lot 22), refonte graphique et caméras (lot 23).

### Lot 22 — Nouveaux thèmes : Canyon, Col alpin, Ville

**Modèle conseillé : Opus, effort moyen.**

#### Contexte
- Lot 21 fusionné. Branche : `lot-22-nouveaux-themes`. Lis `docs/lots/lot-8-surfaces-themes.md`, `lot-17-relief.md`, `lot-18-cuves.md`, `lot-18b-cuves-rapides.md`, `lot-20-figures.md`, `lot-21-identite.md`.

#### Objet
Ajouter trois thèmes au caractère net, qui se distinguent des cinq existants à la conduite et au premier regard.

#### À livrer
- **Sable** (nouveau revêtement de bloc et de bas-côté) : lent mais stable (adhérence correcte, forte résistance au roulement), poussière en traîne.
- **Canyon** : soleil rasant orangé, sable en bas-côté et sur certains blocs ; **parois rocheuses** qui servent de murs naturels (murs latéraux et virages en cuve habillés en roche) ; **longs sauts au-dessus de ravins** ; signature : une paroi rocheuse suivie d'un long saut.
- **Col alpin** : matin clair, neige en bas-côté, plaques de glace possibles ; **grosses descentes** sur plusieurs niveaux, **épingles larges** enchaînées, sections **au-dessus du vide sans rebord** ; signature : une descente en lacets.
- **Ville** : jour (pour ne pas ressembler à Nuit), béton, **route étroite entre des murs** (rebords hauts, pas de bas-côté), **virages à angle droit** (exception documentée à la limite de virages serrés : jusqu'à 4, sur route étroite ou normale, jamais deux de suite sans droite), lampadaires et immeubles en décor ; signature : un enchaînement d'angles droits en chicane.
- **Rotation des thèmes** sur huit au lieu de cinq, toujours tirée de la date ; chaque nouveau thème : palette, lumière, bas-côtés, revêtements, relief, figures favorites et interdites, chances de saut et de cuve, signature, décor ; nouvelles figures si un thème en a besoin (validées par le pilote et le script).
- **Pilote et générateur** : taux de validation et durées 30–40 s tenus pour chaque nouveau thème ; moments de choix mesurés.
- **Admin et miniatures** : les nouveaux thèmes apparaissent partout (planning, remplacement avec choix du thème, archives, miniatures cadrées sur leur signature).
- **Versions** : `SIM_VERSION` +1 (sable), `GENERATOR_VERSION` +1.

#### Critères d'arrêt
- Tous les tests verts ; mesures : sur 80 dates, chaque thème apparaît ; taux de validation et durées des nouveaux thèmes comparables aux anciens ; moments de choix des nouveaux thèmes au niveau des autres ; Ville respecte sa limite d'angles droits.
- README `docs/lots/lot-22-nouveaux-themes.md` avec, pour chaque nouveau thème, deux liens `?seed=…` (ou `?theme=`) et une capture.

#### Modifications de `CLAUDE.md`
- Section **« Thèmes »** : les trois nouveaux thèmes, la rotation sur huit, l'exception des angles droits de Ville.
- Section **« Surfaces et blocs à effet »** : sable.

#### Hors périmètre
Refonte graphique et ambiance sonore (lot 23).

### Lot 23 — Graphismes, ambiance et caméras

**Modèle conseillé : Sonnet, effort élevé** (rendu seul : aucune physique).

#### Contexte
- Lot 22 fusionné. Branche : `lot-23-graphismes`. Lis `docs/lots/lot-9-juice.md`, `lot-9b-visuels.md`, `lot-13-miniatures.md`, `lot-15-vitesse.md`, `lot-10b-zones-tactiles.md`, `lot-21-identite.md`, `lot-22-nouveaux-themes.md` ; pièges § 8 du rendu (mesurer le temps de fil principal, capture plutôt que compteur, rendu logiciel en CI).

#### Objet
Rendre le jeu plus lisible, plus beau et plus typé par thème, sans perdre en fluidité sur téléphone, et donner le choix de la caméra partout.

#### À livrer
- **Lisibilité** : **panneaux de direction** avant les virages (flèche selon le sens et la sévérité, calculés à partir du circuit), avant les sauts et les cuves ; vibreurs bien visibles ; **arche de départ et d'arrivée** ; portes de points de contrôle plus marquées.
- **Lumière et ambiance par thème** : **ombres portées** (voiture et proche de la voiture au minimum), éclairage et heure du jour propres à chaque thème, **brume** pour la profondeur, rendu des couleurs soigné (tonalité), **léger halo** sur les néons, turbos et lampadaires, **phares** qui éclairent la route sur les thèmes sombres.
- **Décor** : plus dense et typé (tribunes et drapeaux pour Stade, sapins et rochers pour Col alpin et Banquise, cactus et falaises pour Canyon, immeubles et lampadaires pour Ville, haies et clôtures pour Campagne…), **silhouettes lointaines** en couches pour la profondeur.
- **Ambiance sonore par thème** (procédurale de préférence, sinon CC0 crédité) : foule (Stade), vent (Banquise, Col alpin), grillons (Campagne), rumeur urbaine (Ville), vent chaud (Canyon), bourdonnement électrique (Nuit) ; sous le volume général, coupée par M.
- **Caméras** : trois caméras — proche, loin, **capot** (très basse, sur l'avant de la voiture) ; touche **C** et un bouton manette les font défiler ; **bouton caméra sur mobile**, placé loin des frontières entre zones, vérifié avec `?zones=1` ; choix mémorisé.
- **Niveaux de qualité** : chaque ajout lourd (ombres, halo, brume, décor dense, silhouettes) se règle par la qualité automatique ; mesure du temps de fil principal par image avant / après (profil mobile CPU ×4) et du poids ajouté au chargement.
- **Miniatures** : elles profitent de la nouvelle lumière sans coût excessif (mesurer).
- **Aucun changement de `sim`** : références golden inchangées, versions inchangées.

#### Critères d'arrêt
- Tous les tests verts, golden inchangés ; tests e2e : les trois caméras s'enchaînent au clavier et au bouton tactile ; le bouton caméra ne vole aucun appui (`?zones=1`) ; mesures de performance dans le README (avant / après, par qualité).
- README `docs/lots/lot-23-graphismes.md` avec un lien par thème (huit), puis le lien à ouvrir sur le téléphone (`?touch=1`), et **une capture par thème** plus une capture en caméra capot.

#### Modifications de `CLAUDE.md`
- Section **« Rendu, effets et sons »** : panneaux, arche, lumière par thème, ombres, brume, halo, phares, décor, ambiance sonore, niveaux de qualité et budget.
- Section **« Commandes »** : trois caméras, bouton caméra mobile.

#### Hors périmètre
Musique, personnalisation de la voiture, nouveaux thèmes.

### ⏸ Fin des lots écrits

Après le lot 23, l'agent s'arrête : la mise en ligne, le calibrage et le jalon seront rédigés avec Nathan.
