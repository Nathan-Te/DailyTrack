# Lot GR1 — Gravity : cœur jouable (simulation, générateur, rediffusion, serveur)

Branche `claude/gravity-playable-core-1lfho4`, PR brouillon `jeu:gravity`. Le squelette « Cibles » est remplacé par le vrai jeu : jouable de bout en bout, classé et rejoué par le serveur. **Pour les joueurs : rien** (le jeu est `off`). La maquette est bien dans le dépôt (`docs/gravity/maquettes/`) ; le seed n'est pas modifié.

## Livré
- **Simulation entière** (`packages/gravity-sim`) : 120 pas/s (la fréquence de Jump), 1 case = 4 096 unités, vitesses en unités/s, la physique de `pas()` à ses constantes, les 10 types de case, l'inversion au contact (tampon 14 pas, grâce 8 pas, jamais sur la glace), bouclier, aimant (positions des pièces dans l'état), multiplicateur, score, 4 morts + temps écoulé à 72 000 pas. Détail : `packages/gravity-sim/CLAUDE.md`.
- **Générateur infini et versionné** (`GRAVITY_GENERATOR_VERSION` = 2, `GRAVITY_SIM_VERSION` = 2 : on monte, jamais une date) : morceaux de 16 colonnes tirés de (graine du jour, numéro, gravité d'entrée), cinq thèmes de Jump dans un ordre mélangé par jour, 19 morceaux par thème, boucle plus dense, trois premiers morceaux calmes, tous les motifs de la maquette, gemmes, bouclier (morceau 11 mod 23) et aimant (19 mod 23) à des endroits fixes. **Le chemin sûr de chaque morceau** est `Morceau.chemin` (étapes `{c0, c1, y, g}`).
- **Rediffusion** = la liste des pas des appuis en deltas, refusée si mal formée, trop longue (16 100 caractères, 4 000 appuis), deux appuis au même pas, appui après 72 000, mauvaises versions, autre jour. **Serveur** (`apps/api/src/gravity.ts`) : rejoue jusqu'à la mort ou aux 10 min et retrouve le score lui-même (la plateforme ne lit jamais de score annoncé).
- **Seuils provisoires** (60 % de la distance + tout ce qui se ramasse, fin des 1er/2e/3e thèmes et de la boucle) **figés avec le niveau** : le jour figé les porte (`jours.ts`), `seuilsDuJour` lit le fichier avant de recalculer, l'empreinte du jour (`gravity-empreintes.ts`) les couvre.
- **Fiche** : classement `score` ↓ puis `ticks` ↑ (puis `submitted_at`, `player_id`), comme Blocks (score puis combo) et Tower (hauteur, vies, ticks) ; médailles `figees-niveau` ; 5 thèmes ; `rejeu` 72 000 pas (comme Jump) ; scènes de musique des 5 thèmes. `variante.ts` ne garde que la variante « score ». **Golden** régénéré (versions montées) : 10 jours (ordre, empreinte, seuils) et 3 rediffusions (vide, appuis réguliers, pilote d'essai de 30 785 pas : 21 250 points sur les cinq thèmes).
- **Scène provisoire** (`apps/gravity/src/scene.ts`, en tête : « provisoire, remplacé par @cdj/visuels au GR3 ») : le dessin canvas de la maquette interpolé entre les pas ; entrées toucher / clic / Espace / flèches / W / S / A, appuis datés au pas ; HUD du kit (score ; distance et ×) ; nom du thème quand il change ; mort montrée 0,9 s avec sa cause. Le niveau est chargé à la demande (`niveau.ts`).
- **Essais** (hors production, jamais classés) : `?theme=<id>`, touche **T** (thème suivant, seulement avec `?theme=`), `?jour=AAAA-MM-JJ` (alias du `?seed=` du kit). Module d'essais du serveur (`gravity-essais.ts`) : le pilote d'essai arrêté plus ou moins tôt.
- **Catalogues** fr + en : nom, une ligne par thème, « Comment jouer » court, causes de mort, ligne du HUD.

## Décisions et écarts à la maquette (à valider par Nathan)
- **Défaut (a)** : l'élan `vy = −g × 2` de l'inversion était annulé par le sol (et celui de l'inverseur écrasé par `vy = 0`) : l'élan est **nul**, même jeu sans un pas perdu.
- **Défaut (b)** : le bouclier qui sauve du bord replace le joueur dans la case libre la plus proche (`placerLibre`), jamais dans un mur (testé).
- **Défauts de la maquette corrigés au générateur** : des pièces posées au-dessus d'un trou (appât mortel) ; la case spéciale de la **Nuit** n'existait pas (le trou effaçait les clignotants) : cinq colonnes de cases qui battent sur une surface, l'autre trouée ; la **Forêt** : le vent ne porte que vers le haut, le chemin quitte le sol avant le trou.
- **Cases qui battent alignées** : le décalage de chaque morceau est calé sur l'arrivée attendue du joueur (`camera.ts`) : sans cela Néon et Nuit étaient une loterie de phase.
- **Gravité d'entrée** : un morceau est posé à l'endroit ou en miroir pour que son chemin commence du côté d'où l'on arrive : exiger une inversion à l'entrée n'est faisable qu'à basse vitesse. Conséquence : un morceau de trou / piques / pilier ne force plus d'inversion à l'entrée ; les inversions sont dans le motif (zigzag, inverseur, glace, usine, néon, forêt, milieu, escalier, étages, îlots).
- **Vitesse** : plafonnée à 12,5 comme la maquette (atteinte à 1 210 m, avant la boucle de 1 520 m) : « la boucle reprend plus vite » = plus dense seulement.
- **Départage** : score ↓, durée ↑. Un autre choix (la distance ?) est une ligne de fiche et de `variante.ts` + golden.
- **`rejeu`** : `unitesServeur` 1, `ticksParUnite` 5 000 comme Jump. Mesuré : 63 000 pas rejoués en ≈ 30 ms, 72 000 pas de couloir en 77 ms : le plafond est large, à baisser si Nathan veut.

## Vérifié
- `npm run typecheck` ; unitaires du paquet (119 : règles — inversion, tampon, grâce, glace, inverseur, bouclier, aimant, multiplicateur, gemmes, chaque mort —, déterminisme jeu = serveur, golden, rediffusion valide / trafiquée / trop longue, jours figés, absence de flottant) ; serveur `apps/api/test/gravity.test.ts` (SQLite) ; fiche, portail, consignes.
- E2E Chromium sur les fichiers modifiés : `partie.spec.ts` (3 parcours + Comment jouer + portrait), `classement.spec.ts` (le vrai serveur : classée, copie refusée, Amis), `determinisme.spec.ts` (golden rejoué dans le navigateur), `poids.spec.ts` ; `ecrans-kit.spec.ts` non modifié, passe. Firefox et WebKit : `determinisme.spec.ts` seulement en CI complète.
- Premier chargement : 45 043 o (plafond 48 Ko ; le niveau est à la demande : `budget.aLaDemande` + `niveau-`, `rediffusion-`).
- Captures : 3 images regardées (Néon paysage, Usine portrait, bandeau de thème) ; en portrait le monde est centré.

## Non vérifié / défauts connus de génération
- **Les sensations** (vitesse, gravité, tampon) ne sont réglées par personne : c'est la physique de la maquette. Pas de `?debug&tune` (hors périmètre de ce prompt).
- **Le chemin sûr n'est pas prouvé franchissable partout.** Un pilote d'essai (`src/pilote.ts`, qui ne connaît que le chemin et essaie ses coups sur des copies) sur 40 jours : **médiane 1 974 m, maximum 6 562 m, aucun n'atteint les 10 minutes** ; morts : îlots 22/40, milieu 9, étages 6, néon 2, forêt 1. Soit le pilote est naïf (horizon de 45 pas, un seul coup d'avance), soit îlots / étages sont trop serrés à 12 cases/s. **À trancher par le robot du GR2** (le test ne garantit que > 400 m sur quatre jours).
- Le battement aligné suppose que le joueur suit la caméra (arrivée à `caméra + 4,2`) : un joueur retardé par un mur sort de la fenêtre. Les seuils « sur le papier » ne tiennent pas compte des bonus.
- Mort en dessous d'une plateforme au milieu à très haute vitesse, particules, sons, vibrations : non traités. Pas de fantôme ni de Diamant (`sansFantome`).
- Mentions légales : voir ci-dessous (marqueur « À remplacer » gardé à dessein). Firefox / WebKit hors `determinisme.spec.ts` non essayés ; libSQL non rejoué en local (CI).

## Zones partagées touchées (à valider, une ligne chacune)
- `apps/portail/src/catalogue.ts` : les clés `portail.theme.gravity.*` passent de clair / sombre aux cinq thèmes (le test des fiches l'exige : ce sont « ses clés de catalogue »).
- `apps/portail/test/consignes.test.ts` : deux lignes dans la liste des `CLAUDE.md` (`apps/gravity`, `packages/gravity-sim`, demandés par le prompt).
- **À proposer à la plateforme** : (1) **mentions légales** (FR + EN) pour les clés `gravity:records`, `:reglages`, `:aide:vu`, `:identite:vue` avant `preview` : `aide.point3` garde « À remplacer » pour que `mentions.test.ts` ne le traite pas encore comme livré ; (2) identité de la fiche (illustration, motif, police) au GR5 ; (3) la teinte corail reste provisoire.

## Pour tester en 2 clics (recette, le jeu est `off`)
Les liens de la recette (aperçu de la PR) sont dans le commentaire de la PR : un lien par thème (`?theme=foret|usine|glace|nuit|neon`, puis **T** pour passer au suivant) et un lien « partie normale » sans paramètre. `?jour=AAAA-MM-JJ` essaie un autre jour. Ces parties d'essai ne sont pas classées ; la partie normale l'est (sur la base de la recette).

## Attend les lots suivants
GR2 : le robot (chemin sûr, seuils définitifs, fantôme Diamant, `GRAVITY_BOT_VERSION` 2) · GR3 : `@cdj/visuels` (la DA de Jump, le héros à bandeau) · GR4 : textes complets · GR5 : identité, accueil, fin de partie, mentions, publication.
