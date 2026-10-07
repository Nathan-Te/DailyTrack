# Seed — « Circuit du Jour » (titre provisoire)

Source de vérité du projet. Vit dans `docs/seed.md`, n'est modifié que par Nathan. Projet **web, court**, conçu pour être développé **entièrement dans le cloud** (Claude Code sur le web), sans PC.

*Version 3 (07/10/2026) : lots 0 à 11 livrés (avec les retouches 7b et 9b). Ajoutés : courses de 30 à 45 s, largeurs de piste variables, miniatures dans les archives, panneau d'admin avec planning et remplacement de circuits, correction des zones tactiles. Prompts au § 12.*

---

## 1. Le jeu en une phrase
Chaque jour, un nouveau circuit court, le même pour tout le monde : on le parcourt en 30 à 45 secondes dans le navigateur, on retente pour battre son temps et le fantôme du meilleur, et on partage son résultat en une ligne, comme un score de Wordle.

## 2. Les piliers
1. **Moins d'une minute par jour.** Une course de **30 à 45 secondes, grand maximum**. On joue en pause café ; on revient demain.
2. **Le même circuit pour tous.** Un circuit par jour, généré à partir de la date (ou une variante choisie à l'avance, § 5), identique pour chaque joueur. C'est ce qui rend le classement et le partage intéressants.
3. **Zéro friction.** Un lien, ça démarre. Pas de compte, pas d'installation : un pseudo choisi au premier temps, mémorisé dans le navigateur.
4. **Un temps est une preuve.** La physique est **déterministe** : une course est entièrement décrite par la suite des commandes du joueur. Le serveur rejoue la course pour valider le temps, et la même rediffusion sert de fantôme.
5. **Lisible et nerveux.** Low-poly coloré, caméra derrière la voiture, sensations de vitesse ; un circuit se lit en un coup d'œil. **La conduite a la tenue de route et le mordant d'un Trackmania.**

## 3. Le jeu
- **La voiture** : une seule, arcade, inspirée de Trackmania — accélération franche, direction immédiate, adhérence forte avec une limite lisible, dérapage au frein, suspension qui suit le relief, réceptions qui récompensent un atterrissage propre, rebords qu'on peut frôler. Commandes : accélérer, freiner/reculer, tourner (analogique à la manette), **recommencer au dernier point de contrôle** (avec la vitesse du passage), **recommencer depuis le départ**. Clavier, manette et tactile (glissement ou boutons).
- **Le circuit** : des **blocs** posés sur une grille, à la Trackmania — lignes droites, virages serrés, **courbes amples**, **virages relevés**, pentes, bosses, tremplins ; un départ, des points de contrôle, une arrivée. **La largeur de la piste varie** (étroite, normale, large, avec des transitions) ; les virages serrés restent rares. Pas de boucles ni de murs verticaux au premier jalon.
- **Les revêtements** (par bloc) : **route** (référence), **terre** (glisse et se rattrape), **glace** (on anticipe tout), **herbe** (lente et glissante).
- **Les blocs à effet** : **plaque d'accélération**, **super turbo**, **moteur coupé** (l'accélérateur n'agit plus jusqu'au point de contrôle suivant).
- **La course** : chronomètre au millième, temps intermédiaires aux points de contrôle (comparés à son meilleur et au fantôme), essais illimités dans la journée.
- **Les médailles** : bronze, argent, or et **temps de l'auteur**, calculés pour chaque circuit (§ 5).
- **Les fantômes** : son propre meilleur temps, et au choix celui du premier du classement ou du joueur juste devant soi.
- **L'écran d'arrivée** : temps, médaille, rang du jour, et la **ligne à partager** :
  `Circuit du Jour #142 — 37,312 s — 🥇 — 23e/812`
- **Les archives** : la liste des jours passés, chacun avec une **miniature en vue aérienne** d'une portion marquante du circuit, son thème, ses médailles et ta place figée ; on rejoue un jour avec le fantôme du premier et le classement figé.

## 4. Direction artistique
Low-poly coloré et propre : blocs aux couleurs vives par type (route grise, plaques d'accélération jaunes, points de contrôle bleus, arrivée à damier), chaque revêtement et chaque bloc à effet reconnaissable au premier coup d'œil, ciel dégradé, soleil ou lune, montagnes et décor propres à chaque thème. **Un thème par jour** (§ 5) avec sa palette. Une voiture low-poly **originale** et animée (roues, suspension, caisse), des effets (fumée, traces, particules par revêtement, turbo, étincelles) et des sons procéduraux. Pas de textures lourdes : le jeu doit se charger en quelques secondes, sur mobile aussi.

## 5. Le circuit du jour
- **Généré à partir de la date** (graine = date en UTC), par un générateur qui enchaîne des blocs selon des règles : pas d'auto-intersection, rythme (alternance de lignes droites et de courbes), **au moins deux largeurs de piste**, peu de virages serrés, un ou deux passages marquants, nombre de points de contrôle.
- **Durée** : le temps de l'auteur tombe entre **30 et 40 s**, pour qu'une course correcte tienne en 30 à 45 s.
- **Un thème par jour**, tiré de la date : palette + décor + poids des revêtements + largeurs dominantes + règles de blocs à effet + un passage signature. Thèmes : *Stade*, *Rallye*, *Banquise*, *Nuit*, *Campagne*.
- **Validé par un pilote automatique** qui parcourt le circuit avec la même physique. S'il ne finit pas, le générateur recommence avec une graine voisine. Le temps du pilote donne le **temps de l'auteur**, d'où découlent les autres médailles.
- **Planning et remplacement** : le panneau d'admin montre les circuits des jours à venir. Si l'un ne plaît pas, Nathan le remplace par une **variante** (même date, autre graine, thème au choix). Un jour commencé ou passé est **figé** : on ne remplace que les jours à venir.
- **Plus tard, peut-être** : un circuit dessiné à la main le dimanche ; un éditeur.

## 6. Le classement
- Un **classement par jour** : meilleur temps de chaque joueur, rang, nombre de participants.
- **Validation par rediffusion** : le navigateur envoie la suite de commandes de la course ; le serveur **rejoue la course avec le même code de simulation** (et la variante du planning) et n'enregistre que le temps qu'il a lui-même recalculé. Un temps falsifié ne passe pas.
- **Identité légère** : un identifiant aléatoire stocké dans le navigateur et un pseudo modifiable ; pas d'e-mail, pas de mot de passe. (Changer de navigateur = nouveau joueur, c'est accepté au premier jalon.)
- **Fantômes** : le serveur sert la rediffusion du premier et des voisins de classement.
- **Administration** : un jeton secret donne accès au planning ; aucun compte.

## 7. Technique
- **TypeScript partout**, en monorepo :
  - `packages/sim` — la **simulation pure** (physique, blocs, revêtements, collisions, chronométrage, générateur, pilote) : **aucune dépendance au rendu ni au navigateur**, testée par Vitest ;
  - `apps/web` — le jeu (Vite + **Three.js**), les archives et le panneau d'admin ;
  - `apps/api` — le classement et le planning, qui importe le **même** `sim` pour rejouer les courses.
- **Déterminisme** : pas de temps fixe (120 par seconde, sous-pas fixes autorisés, interpolation à l'affichage) ; **pas de moteur physique externe** ; pas de `Math.sin`, `Math.cos`, `Math.exp`, `Math.atan2`, `Math.tanh`, `Math.random`, `Date` dans la simulation — des implémentations à soi, ou des tables. Un test vérifie qu'une même rediffusion donne **exactement** le même temps dans Node et dans les navigateurs. Le rendu, les effets, les sons et les miniatures ne modifient **jamais** un résultat de `sim`.
- **Sans API**, le jeu reste jouable (circuit par défaut de la date, course non classée).
- **Hébergement de l'API — à trancher avant la mise en ligne** : l'offre gratuite de Cloudflare Workers **ne suffit pas** (10 ms de calcul par requête ; un rejeu coûte ≈ 10–12 ms, une génération de circuit ≈ 100 ms). Options : **serveur de Nathan en Docker** (comme Vitrine, aucune limite, mise en route manuelle) ou **Workers payant** (5 $/mois, déploiement par la CI, 100 % cloud). Le jeu statique reste sur GitHub Pages / Cloudflare Pages, avec un aperçu par branche.
- **Tests** : Vitest pour la simulation (déterminisme, comportements de conduite chiffrés, générateur, validation par rediffusion) ; Playwright pour le jeu (rediffusion, rendu, mobile, tactile, archives, admin) ; scripts de mesure pour le générateur (durées, taux de validation par thème).
- **Intégration continue** : GitHub Actions lance les tests à chaque push et publie l'aperçu.

## 8. Méthode : le développer dans le cloud
- **Claude Code sur le web** : chaque lot est une **session cloud** sur le dépôt GitHub du projet. La session tourne même si on ferme le navigateur ou le téléphone, et propose ses changements sous forme de branche et de pull request.
- **Tester un lot en deux clics** : chaque lot a son **aperçu en ligne** (une URL par branche) et un **scénario d'essai** dans l'URL. Le README du lot commence par le lien direct. On teste depuis n'importe quel appareil, puis on fusionne la pull request.
- **Les règles habituelles** : un lot = une session neuve = une branche = une PR (si l'environnement impose un autre nom de branche, le garder et adapter le lien d'aperçu) ; README d'une page dans `docs/lots/` ; chaque prompt de lot indique les modifications du `CLAUDE.md` que l'agent applique lui-même ; l'agent met à jour `docs/orchestration.md` et s'arrête quand les critères sont verts.
- **Enchaîner les lots** : pour lancer le lot suivant, Nathan ouvre une **session neuve** avec simplement :
  > *Lis `docs/seed.md` § 8 et § 12, puis fais le prochain lot.*

  Le prochain lot est le **premier lot du § 12 dont la PR n'est pas fusionnée** dans `main` (voir le tableau § 2 de `docs/orchestration.md` et l'historique Git). Si la PR du lot précédent est encore ouverte, l'agent **ne démarre rien** et le signale. À un **point d'arrêt** (⏸), il s'arrête et attend Nathan. Un seul lot par session.
- **Le quota** : Sonnet en effort moyen pour la plupart des lots ; Opus quand la physique ou le générateur résistent.

## 9. Hors du jeu
Multijoueur en direct, comptes, éditeur de circuits, plusieurs voitures, réglages de voiture par le joueur, personnalisation, monétisation, musique, boucles et murs verticaux (au premier jalon).

## 10. Plan en lots

**Livrés** (détail dans `docs/orchestration.md` et `docs/lots/`) : 0 Socle · 1 Voiture · 2 Blocs · 3 Rediffusion · 4 Circuit du jour · 5 Classement · 6 Arrivée & archives · 7 Conduite (+ 7b réglages) · 10 Tactile · 8 Surfaces & thèmes · 9 Feel & juice (+ 9b visuels) · 11 Historique.

**À venir** (prompts au § 12) :
- **Retouche 10b — Zones tactiles.** Les boutons ← → et gaz / frein en paysage répondent là où on les touche. **À tester** : sur ton téléphone, mode boutons, avec l'affichage des zones.
- **Lot 12 — Circuits plus amples.** Courses de 30 à 45 s, largeurs de piste variables, courbes amples, peu de virages serrés. **À tester** : `?scenario=largeurs`, puis un circuit par thème.
- **Lot 13 — Miniatures.** Vue aérienne d'une portion de chaque circuit dans les archives. **À tester** : `?api=demo`, touche H.
- **Lot 14 — Admin et planning.** Panneau refait, planning des jours à venir, remplacement d'un circuit par une variante. **À tester** : `/admin/?api=demo`, remplacer un jour, le jouer.
- ⏸ **Ensuite** : mise en ligne (hébergement de l'API, nom de domaine, `PREMIER_JOUR` réel, `ADMIN_TOKEN`) ; calibrage des médailles sur courses réelles ; **jalon** : une semaine de circuits joués par Nathan et quelques amis ; puis circuit dessiné du dimanche, portail de jeux web.

## 11. Concurrence
**Trackmania** propose déjà un « circuit du jour » (Track of the Day) ; **PolyTrack**, un jeu de course low-poly dans le navigateur, a trouvé son public. La différence visée : le **format quotidien très court**, sans compte et sans installation, et le **partage en une ligne**.

---

## 12. Prompts des lots

Chaque prompt se suffit à lui-même. L'agent exécute le prompt du prochain lot (règle d'enchaînement au § 8), dans une session neuve. Les prompts des lots 7 à 11, livrés, ont été retirés (historique Git et `docs/lots/`).

### Retouche 10b — Zones de toucher en paysage

**Modèle conseillé : Sonnet, effort moyen.**

#### Contexte
- Lis `docs/orchestration.md` (§ 8 : pièges des tests tactiles) et `docs/lots/lot-10-tactile.md`.
- Lot 11 fusionné. Pars de `main` à jour : `git fetch origin main && git checkout -B lot-10b-zones-tactiles origin/main`.
- Retour de Nathan **sur un vrai téléphone, en paysage** : en mode boutons (pas le glissement), les boutons **← →** et **gaz / frein** n'ont pas de bonnes zones de toucher — des appuis ne sont pas pris ou tombent sur la mauvaise commande. Causes possibles : zones plus petites que le visuel ou décalées, trous entre deux zones, doigt qui glisse hors du bouton et relâche la commande, encoche et bandes de gestes système, comportement par défaut du navigateur.

#### Objet
Que chaque appui tombe là où le joueur l'attend, sans avoir à viser.

#### À livrer
- **Diagnostic d'abord** : affichage `?zones=1` qui dessine les zones actives (semi-transparentes, avec leur nom) et un point par doigt posé, de la couleur de la zone touchée, rouge si aucune. Le rapport dit quelles causes ont été trouvées.
- **Grandes zones, petit visuel** : en mode boutons, l'écran est découpé en grandes zones **sans trou** (ex. moitié gauche en deux colonnes ← | →, moitié droite en frein | gaz, ou gaz en haut et frein en bas selon la disposition retenue) ; les boutons dessinés restent compacts, la zone active s'étend jusqu'aux bords et aux zones voisines.
- **Glisser d'une zone à l'autre** sans lever le doigt change la commande (← vers →, frein vers gaz) ; suivi par identifiant de doigt (événements pointeur), plusieurs doigts à la fois (diriger et accélérer ou freiner en même temps).
- **Bords et encoche** : respecter `env(safe-area-inset-*)` pour le **visuel** (encoche, barre d'accueil iOS) sans réduire la zone active ; le visuel s'écarte des bandes de gestes système (retour Android).
- **Aucun toucher perdu** : `touch-action: none` sur la couche de jeu, `preventDefault` sur `touchstart` / `touchmove`, pas de délai de clic, pas de sélection de texte, pas de menu d'appui long, pas de zoom.
- **Réglage « taille des boutons »** (petite / moyenne / grande), mémorisé. Paramètre d'URL `?steer=boutons|glisser` pour forcer le mode.
- Le mode glissement ne régresse pas ; rien ne change dans `sim`.

#### Critères d'arrêt
- `npm run typecheck && npm test` et `npm run test:e2e` verts, références golden inchangées.
- Tests Playwright tactiles, en **paysage**, gabarits iPhone (avec encoche) et Android : un appui en n'importe quel point de chaque zone (coins compris, à 8 px du bord) déclenche la bonne commande ; glisser de ← à → sans lever change la direction ; direction et gaz en même temps ; aucun point de l'écran de jeu hors zone dans la moitié basse. Utiliser le pas à pas (`__cdj.manual(true)` + `advance`) comme au lot 10.
- README `docs/lots/lot-10b-zones-tactiles.md` qui **commence par le lien à ouvrir sur le téléphone** : `?scenario=pilotage&touch=1&steer=boutons&zones=1`, puis le même sans `zones=1`.

#### Modifications de `CLAUDE.md` (à appliquer toi-même à la livraison)
- Section **« Commandes tactiles »** complétée : découpage des zones, glissement entre zones, zones actives vs visuel et zones sûres, `?zones=1`, `?steer=`, réglage de taille.

#### Mettre aussi à jour
`docs/orchestration.md` (§ 2, § 5 commandes, § 8 pièges).

#### Hors périmètre
Gyroscope, nouvelle disposition en portrait.

#### Règles rappelées
Le tactile produit les mêmes commandes entières que les autres entrées ; déterminisme strict de `sim` ; ne jamais désactiver un test.

#### Rapport attendu
Causes trouvées, ce qui a changé, vérifié / non vérifié (vrai téléphone : à faire par Nathan, avec `zones=1`).

### Lot 12 — Circuits plus amples : durée et largeurs

**Modèle conseillé : Opus, effort moyen** (générateur et géométrie de la piste ; cf. pièges des lots 7b et 8).

#### Contexte
- Lis `docs/orchestration.md` (§ 7 décisions, § 8 pièges : **mesurer le taux de circuits validés par thème**, plaques et virages, décollages), `docs/lots/lot-8-surfaces-themes.md` et `docs/lots/lot-7b-reglages.md`.
- Retouche 10b fusionnée. Pars de `main` à jour : `git fetch origin main && git checkout -B lot-12-circuits-amples origin/main`.
- Retour de Nathan : les courses sont trop longues ; tout se joue sur une piste peu large (14 m) avec des virages relativement serrés, c'est monotone.

#### Objet
Des circuits de 30 à 45 s qui alternent les largeurs de piste et privilégient des courbes amples.

#### À livrer
- **Durée** : fenêtre du temps de l'auteur ramenée à **30–40 s** (au lieu de 28–48), pour qu'une course correcte tienne en 30–45 s (or ≈ ×1,08 de l'auteur). Le rapport donne la répartition obtenue.
- **Largeur variable** : trois largeurs de route en attribut de bloc (indicatif : étroite 14 m, normale ≈ 20 m, large ≈ 26 m, dans une cellule de 32 m) ; **blocs de transition** (élargissement / rétrécissement progressifs, rebords continus, sans marche ni angle vif) ; départ, arrivée et portes de points de contrôle adaptés à la largeur ; revêtements et blocs à effet disponibles dans chaque largeur où c'est géométriquement possible (documenter ce qui ne l'est pas, ex. virage serré en large).
- **Courbes amples** : davantage de virages larges (L2/R2), et une courbe encore plus ample (3 cellules) si la grille le permet ; **virages serrés limités** (indicatif : au plus 2 par circuit, jamais deux d'affilée) ; enchaînements rapides (S larges).
- **Générateur** : chaque circuit mélange **au moins deux largeurs** ; la largeur dominante dépend du thème (indicatif : *Stade* et *Banquise* plutôt larges, *Rallye* et *Campagne* plus étroits, *Nuit* mélangé) ; un rétrécissement peut servir de passage signature.
- **Pilote** : sa trajectoire de course exploite la largeur (corde plus ouverte), marge aux rebords adaptée.
- **Scénario** `?scenario=largeurs` écrit à la main : les trois largeurs, les transitions, une courbe ample, un S large, un rétrécissement avant un virage.
- **Versions** : `SIM_VERSION` +1, `GENERATOR_VERSION` +1, références régénérées, **`npm run history:seed` relancé**.

#### Critères d'arrêt
- `npm run typecheck && npm test` et `npm run test:e2e` verts.
- **Script de mesure** versionné dans le dépôt, résultats dans le README : sur 60 dates, temps d'auteur tous dans [30, 40] s ; au moins deux largeurs par circuit ; nombre de virages serrés dans la limite ; **taux de validation par thème** (pas de chute silencieuse : comparer à l'avant-lot) ; temps de génération moyen et maximal ; coût d'un rejeu.
- README `docs/lots/lot-12-circuits-amples.md` qui **commence par le lien direct de l'aperçu** avec `?scenario=largeurs`, puis un lien `?seed=…` par thème (choisis des dates qui montrent bien la variété).

#### Modifications de `CLAUDE.md` (à appliquer toi-même à la livraison)
- Section **« Thèmes »** (ou nouvelle section **« Circuits »**) : largeurs, transitions, limite de virages serrés, fenêtre 30–40 s, largeur dominante par thème.
- Règle ajoutée : « toute règle de générateur se valide par le script de mesure (durées, taux de validation par thème), pas seulement par les tests ».
- Commandes : `?scenario=largeurs`, script de mesure.

#### Mettre aussi à jour
`docs/orchestration.md` (§ 2, § 4 versions actuelles, § 7 décisions, § 8 pièges).

#### Hors périmètre
Miniatures (lot 13), admin et planning (lot 14), calibrage des médailles.

#### Règles rappelées
Déterminisme strict de `sim` ; versions incrémentées dès qu'un résultat ou un circuit change ; seul le temps rejoué par le serveur compte ; ne jamais désactiver un test.

#### Rapport attendu
Vérifié / non vérifié / décisions pour Nathan : largeurs retenues, durées obtenues, et si le bronze (×1,40) dépasse trop les 45 s (proposer des facteurs pour le futur calibrage, sans les appliquer).

### Lot 13 — Miniatures des circuits dans les archives

**Modèle conseillé : Sonnet, effort moyen.**

#### Contexte
- Lis `docs/orchestration.md` (§ 8 : pièges du lot 9b — un effet visuel se vérifie sur une **capture**), `docs/lots/lot-11-historique.md` et `docs/lots/lot-9b-visuels.md`.
- Lot 12 fusionné. Pars de `main` à jour : `git fetch origin main && git checkout -B lot-13-miniatures origin/main`.

#### Objet
Chaque jour des archives montre une miniature : une vue aérienne d'une portion marquante de son circuit.

#### À livrer
- **Fonction réutilisable** `renderThumbnail(circuit, options)` dans `apps/web` (le panneau d'admin du lot 14 s'en servira) : un seul moteur de rendu partagé hors écran ; caméra aérienne légèrement inclinée ou d'aplomb (choisis sur captures et justifie) ; cadrée sur la portion la plus parlante (le passage signature, sinon la zone la plus sinueuse) ; palette, revêtements, blocs à effet et décor du thème ; format 16:9 (ex. 320 × 180, ×2 sur écran haute densité).
- **À la demande** : rendue quand la ligne apparaît à l'écran (au fil du défilement), étalée dans le temps, **jamais pendant une course** ; mise en **cache** en mémoire et dans le navigateur (IndexedDB ou Cache Storage, toujours sous try/catch), clé = id du circuit (versions et variante incluses).
- **Repli** sans WebGL : tracé 2D du circuit vu de dessus (canvas), aux couleurs du thème.
- **Archives** : chaque ligne montre la miniature, le numéro, la date, le thème, les médailles, ta médaille et ta place figée. La même miniature apparaît à l'ouverture d'un jour.
- **Performance mesurée** : ms par miniature (bureau, profil mobile CPU ×4), mémoire ; l'ouverture des archives ne gèle pas l'interface.

#### Critères d'arrêt
- `npm run typecheck && npm test` et `npm run test:e2e` verts, références golden inchangées, aucune modification de `sim`.
- Test e2e en `?api=demo` : les 14 miniatures apparaissent (contenu non vide vérifié par l'image, pas seulement un compteur) ; **une capture de la liste jointe au README**.
- README `docs/lots/lot-13-miniatures.md` qui **commence par le lien direct de l'aperçu** avec `?api=demo` (puis touche H ou bouton Archives).

#### Modifications de `CLAUDE.md` (à appliquer toi-même à la livraison)
- Nouvelle section **« Miniatures »** : fonction, cadrage, cache et clé, repli 2D, règle « jamais de rendu de miniature pendant une course ».

#### Mettre aussi à jour
`docs/orchestration.md` (§ 2, § 3 architecture, § 8 si pièges).

#### Hors périmètre
Image d'aperçu pour les liens partagés (à proposer dans le rapport), panneau d'admin.

#### Règles rappelées
Le rendu ne modifie jamais un résultat de `sim` ; le jeu marche sans API ; mesurer plutôt que supposer ; ne jamais désactiver un test.

#### Rapport attendu
Vérifié / non vérifié (vrai téléphone) / décisions pour Nathan (cadrage, inclinaison).

### Lot 14 — Panneau d'admin et planning des circuits

**Modèle conseillé : Sonnet, effort moyen.**

#### Contexte
- Lis `docs/orchestration.md` (§ 4 règles, dont la sécurité de l'API), `docs/lots/lot-5-classement.md`, `docs/lots/lot-11-historique.md` (page `admin/`, mode `?api=demo`), `docs/lots/lot-12-circuits-amples.md` et `docs/lots/lot-13-miniatures.md`.
- Lot 13 fusionné. Pars de `main` à jour : `git fetch origin main && git checkout -B lot-14-admin-planning origin/main`.
- Retour de Nathan : la page `/admin/` actuelle est trop sommaire et peu pratique ; il veut voir les circuits à venir et **remplacer** un circuit qui ne lui plaît pas.

#### Objet
Un panneau d'admin clair qui montre le planning et permet de remplacer un circuit à venir, sans casser « le même circuit pour tous » ni la validation par rejeu.

#### À livrer
- **Variantes** : `dailyCircuit(jour, variante = 0, theme?)`. La variante 0 donne **exactement** les circuits actuels (références golden inchangées, versions inchangées) ; une variante n change la graine (date + n) ; le thème peut être imposé. Id : `jour-AAAA-MM-JJ-g<G>-v<n>` (plus le thème s'il est imposé).
- **Planning côté API** : table `planning` (date → variante, thème, date du choix) ; `GET /api/day/AAAA-MM-JJ` (public) renvoie la variante en vigueur ; le serveur **rejoue toujours avec la variante du planning** ; remplacement **refusé pour aujourd'hui et le passé** (UTC, grâce de minuit comprise) : un jour commencé est figé.
- **Accès admin** : jeton secret `ADMIN_TOKEN` (variable d'environnement, jamais dans le dépôt), comparaison à temps constant, limitation de débit ; saisi une fois dans le panneau et gardé dans le navigateur.
- **Jeu** : au lancement, il demande la variante du jour à l'API (délai court). Sans API ou en cas d'échec : variante 0, course jouable mais **marquée « hors ligne, non classée »** (mettre à jour la règle 6 de l'orchestration).
- **Panneau `/admin/` refait**, en français, simple, utilisable sur téléphone :
  - **Aujourd'hui** : miniature, thème, médailles, nombre de joueurs, meilleur temps, répartition des temps (petit histogramme) ;
  - **Planning** (14 prochains jours) : une carte par jour — miniature, thème, temps de l'auteur, largeurs, revêtements, blocs à effet, nombre de virages serrés ; boutons **Jouer**, **Regarder le pilote** (`?demo`), **Remplacer** ;
  - **Remplacer** : génère **dans le navigateur** 4 à 6 variantes (même thème par défaut, thème modifiable), chacune avec miniature, chiffres, Jouer et Regarder ; **Choisir** avec confirmation ; **Revenir à l'original** ;
  - **Historique** : jours passés en lecture seule (joueurs, meilleur temps, variante utilisée) ;
  - **Outils** : l'actuel constructeur d'adresses du jeu, repris.
- **Mode démo** : `/admin/?api=demo` fonctionne sans serveur — remplacements gardés dans ce navigateur seulement (bandeau explicite), et le jeu en `?api=demo` les respecte, pour tester en deux clics.

#### Critères d'arrêt
- `npm run typecheck && npm test` et `npm run test:e2e` verts, références golden inchangées.
- Tests API : remplacement d'un jour futur accepté ; aujourd'hui et passé refusés ; sans jeton ou mauvais jeton refusé ; une course sur un jour remplacé est rejouée avec la bonne variante.
- Test e2e : dans `/admin/?api=demo`, remplacer le jour J+2, puis ouvrir le jeu sur ce jour → c'est bien la variante choisie (même id de circuit).
- README `docs/lots/lot-14-admin-planning.md` qui **commence par le lien direct** `/admin/?api=demo`, puis le lien du jeu `?api=demo&day=<J+2>` ; il explique aussi comment définir `ADMIN_TOKEN` pour l'API locale.

#### Modifications de `CLAUDE.md` (à appliquer toi-même à la livraison)
- Nouvelle section **« Admin et planning »** : variantes et id, table `planning`, routes, jeton, règle « un jour commencé est figé », mode démo.
- Règle « le jeu marche sans API » mise à jour : variante 0, course non classée.

#### Mettre aussi à jour
`docs/orchestration.md` (§ 2, § 3, § 4 règles nouvelles ou modifiées, § 5 commandes, § 7 décisions).

#### Hors périmètre
Déploiement réel (mise en ligne), plusieurs comptes admin, éditeur de circuits.

#### Règles rappelées
Ne jamais faire confiance à un temps annoncé ; sécurité de l'API (requêtes paramétrées, corps bornés, débit limité) ; déterminisme strict de `sim` ; ne jamais désactiver un test.

#### Rapport attendu
Vérifié / non vérifié / décisions pour Nathan (nombre de jours de planning affichés, comportement si l'API tombe le jour même).

### ⏸ Fin des lots écrits

Après le lot 14, l'agent s'arrête : la mise en ligne (hébergement à choisir), le calibrage et le jalon seront rédigés avec Nathan.
