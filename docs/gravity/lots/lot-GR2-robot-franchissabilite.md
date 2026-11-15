# Lot GR2 — Gravity : le robot, la franchissabilité, les médailles définitives

Branche `claude/gravity-robot-passability-1nq2j4`, PR brouillon `jeu:gravity`. Le jeu reste `off`. **Pour les joueurs : rien.** Seed non modifié. **Aucune zone partagée touchée** (propositions en fin de document).

## Livré
- **Le robot** (`packages/gravity-sim/src/robot.ts`, remplace `pilote.ts`) : il joue la vraie simulation sur des copies de l'état (`Partie.copier(true)` : même physique, sans ramassage donc **sans bouclier**), cherche **avec retour en arrière** les suites d'appuis qui laissent la partie jouable jusqu'à la fin du morceau `k + 2` (un choix au morceau m qui condamne m + 1 est refusé), et prend celle qui ramasse le plus. L'algorithme en cinq lignes est dans `packages/gravity-sim/CLAUDE.md`.
- **Contraintes d'humain**, des constantes nommées et documentées : `ROBOT_ECART_MIN` = 12 pas entre deux appuis ; `ROBOT_FENETRE_MIN` = 8 pas, éprouvée des deux côtés (`ROBOT_MARGE` = 4 pas plus tôt ou plus tard : la fenêtre réelle fait au moins 9 pas) ; `ROBOT_SANS_BOUCLIER` ; `ROBOT_HORIZON` = 2 ; `ROBOT_VUE_PAS` = 120. **Chaque appui joué est éprouvé pas à pas** ; ceux de la suite, jugés d'avance, le sont sur des échantillons tous les 4 pas (dit dans l'en-tête du fichier).
- **Le chemin sûr ne guide le robot que par ses pièces** : il n'utilise pas `Morceau.chemin` (jamais un rail) ; il va où sont les pièces, gemmes et bonus tant que la partie reste jouable. Sa preuve ne dépend donc pas de l'exactitude de `chemin`. Il prend ≈ 90 % des pièces des morceaux traversés ; **les autres sont lâchées pour survivre ou pour mieux ramasser plus loin, et le rapport les compte**.
- **Générateur v3** (`GRAVITY_GENERATOR_VERSION` 2 → 3 ; la physique est inchangée : `GRAVITY_SIM_VERSION` reste 2 ; `partie.ts` gagne seulement `copier(true)`) : les surfaces suivent la vitesse à laquelle le morceau est abordé (`pasDeTraversee`, `colonnesParcourues`, entiers). **Golden régénéré** (`sim` 2, `generateur` 3, `bot` 2), avec les seuils du robot d'un jour sur trois.
- **Seuils définitifs** (`seuils.ts`, `GRAVITY_BOT_VERSION` 1 → 2) : 60 % (`POURCENT_DU_ROBOT`) du score du robot à la fin du 1er, du 2e, du 3e thème puis de la boucle (`THEMES_D_ARRET` : 304, 608, 912, 1 520 m), arrondis à 10. Ils **remplacent** ceux « sur le papier » (supprimés) ; figés avec le niveau (`figerJour`), couverts par l'empreinte du jour ; `seuilsDuJour` lit le fichier avant tout calcul.
- **Rapport** : `npm run robot:gravity -w @cdj/gravity-sim -- --jours 30 --serres 5 [--motifs] [--liens <adresse>]` : une ligne par jour (distance, score, pièces prises / total, appuis, durée, cinq passages les plus serrés : morceau, motif, fenêtre en pas).
- **Essais de recette** `?robot` et `?morceau=<n>` (`apps/gravity/src/essai.ts`, `niveau.ts`, `scene.ts`) : hors production, jamais classés, testés (unitaire + `e2e/essais.spec.ts`).

## Qui calcule les seuils, et quand
- **`npm run figer:gravity`** (job `figer` de « Mettre en production », avec le code alors en production) écrit `seuils` et `bot` dans le fichier de chaque jour protégé : serveur et jeu les y lisent, **le robot ne tourne pas**.
- **Un jour sans fichier** : le serveur le calcule **une fois par instance et par jour** (le module des jeux garde le niveau d'un jour ; `seuils.ts` garde huit jours), **jamais à chaque partie** ; le jeu le calcule **en arrière-plan** pendant la première partie (tranches de 4 ms) et termine d'un trait à l'écran de fin si la partie finit avant.
- **À décider avant `preview`** : sans fichier, chaque navigateur recalcule (≈ 1 à 2 s réparties, davantage sur téléphone). Le remède est `jours.fabrication.preparer` de la fiche (comme Tower : un `preparer:gravity` qui écrit les jours à venir avec leurs seuils). C'est dans mes zones (fiche, script) mais ça touche la chaîne de production : **proposé, pas fait**.

## Franchissabilité : ce que le robot a trouvé, ce que j'ai corrigé
Sur les 30 jours du lot (02/11 au 01/12/2026, première boucle et moitié de la seconde : 2 280 m) le robot passait **18 jours sur 30** avec la v2 du générateur ; presque tous les échecs venaient des **îlots** (17 sur 30 jours aux vitesses de la boucle : quatre îlots tous les quatre colonnes quelle que soit la vitesse, alors qu'un vol de 3 cases fait 3 colonnes à 7 m/s et 5 à 12,5), les autres de l'horizon. Corrections, toutes selon la vitesse du morceau :
- **Îlots** : écart `vol + 4` colonnes, largeur `vol`, une « queue » après le dernier îlot pour rejoindre le sol ou le plafond avant le bout du morceau — **donc un seul îlot par morceau dès 8 m/s** (la place manque dans 16 colonnes ; c'est la conséquence à connaître : des îlots enchaînés demanderaient des morceaux plus longs, une règle). À plus de 10 m/s ils deviennent un trou **après** étages, milieu ou escalier.
- **Étages** : trou de l'étage haut large de `trav + 3` colonnes, 5 colonnes d'étage haut pour se poser, étage bas de 13 ; **les deux chemins finissent au plafond** (ils finissaient à mi-hauteur sous l'étage haut : impossible pour le morceau suivant).
- **Milieu** : la plateforme finit assez tôt (`16 − descente − 1`) pour qu'on ait rejoint le sol ou le plafond avant le bout du morceau (13 colonnes de trou à 7 m/s, 8 à 12,5 m/s).
- **Escalier montant** (arrivée du sol) : à plus de 10 m/s trois vols de 3, 5 et 5 colonnes ne tiennent pas dans 16 : il devient un trou ; l'escalier qui descend reste.
- **Néon** : la seconde couleur est posée où le vol plafond → sol atterrit (`vol − 1` colonnes après la première), le vide la suit.
- **Résultat** : TODO_RESULTAT

## Pour Nathan : tester en 2 clics (recette, jamais classé ; le jeu est `off`, l'aperçu de la PR le sert)
TODO_LIENS

## Mesures (machine du lot : 4 cœurs, Node 22)
TODO_MESURES

## Vérifié / non vérifié
TODO_VERIFIE

## Décisions et propositions pour Nathan (zones partagées : rien n'y est touché)
- **`preparer`** (ci-dessus) avant la publication, et **garder les anciennes versions du générateur** dès qu'un jour est figé (`dailyGravity` n'accepte que la version courante : aucun fichier n'existe encore, le jeu est `off`) — comme `GENERATEURS` de Tower.
- **Test long en « Régression »** : `packages/gravity-sim/test/franchissabilite-30-jours.test.ts` (≈ 30 s) y irait (`regressionUnitaires` de `e2e/zones.json`, partagé) ; en attendant il tourne avec les unitaires, et `franchissabilite.test.ts` rejoue six autres jours.
- **Pourcentage (60 %) et points d'arrêt** : constantes nommées (`seuils.ts`), à régler au GR4 (ils montent `GRAVITY_BOT_VERSION`).
- Toujours à faire par la plateforme (GR1) : mentions légales FR + EN avant `preview`, identité de la fiche (GR5), teinte de l'étiquette.
