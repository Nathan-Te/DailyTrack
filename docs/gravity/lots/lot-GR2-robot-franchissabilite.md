# Lot GR2 — Gravity : le robot, la franchissabilité, les médailles définitives

Branche `claude/gravity-robot-passability-1nq2j4`, PR brouillon `jeu:gravity`. Le jeu reste `off`. **Pour les joueurs : rien.** Le seed n'est pas modifié. Aucune zone partagée touchée (propositions plus bas).

## Livré
- **Le robot** (`packages/gravity-sim/src/robot.ts`, remplace `pilote.ts`) : il joue la vraie simulation sur des copies de l'état (`Partie.copier(true)` : même physique, sans ramassage donc sans bouclier), cherche **avec retour en arrière** les suites d'appuis qui laissent la partie jouable jusqu'à la fin du morceau `k + 2`, et prend celle qui ramasse le plus. Algorithme en cinq lignes : `packages/gravity-sim/CLAUDE.md`.
- **Contraintes d'humain** (constantes nommées et documentées, `robot.ts`) : `ROBOT_ECART_MIN` = 12 pas entre deux appuis ; `ROBOT_FENETRE_MIN` = 8 pas, éprouvée des deux côtés (`ROBOT_MARGE` = 4 pas plus tôt ou plus tard : la fenêtre réelle mesure au moins 9 pas) ; `ROBOT_SANS_BOUCLIER` ; `ROBOT_HORIZON` = 2 morceaux d'avance ; `ROBOT_VUE_PAS` = 160. **Chaque appui joué est éprouvé pas à pas** ; ceux de la suite, jugés d'avance, le sont sur des échantillons tous les 4 pas (précision dite dans l'en-tête du fichier).
- **Le chemin sûr ne guide le robot que par ses pièces** : le robot n'utilise pas `Morceau.chemin` (jamais un rail) ; il va où les pièces et les gemmes sont, tant que la partie reste jouable. La preuve de franchissabilité ne dépend donc pas de l'exactitude de `chemin`.
- **Générateur v3** (`GRAVITY_GENERATOR_VERSION` 2 → 3, la physique est inchangée : `GRAVITY_SIM_VERSION` reste 2) : les surfaces suivent la vitesse à laquelle le morceau est abordé (`pasDeTraversee`, `colonnesParcourues`, entiers). Motifs retouchés ci-dessous. **Golden régénéré** (`sim` 2, `generateur` 3, `bot` 2) ; il porte les seuils du robot d'un jour sur trois.
- **Seuils définitifs** (`seuils.ts`, `GRAVITY_BOT_VERSION` 1 → 2) : 60 % (`POURCENT_DU_ROBOT`) du score du robot à la fin du 1er, du 2e, du 3e thème puis de la boucle (`THEMES_D_ARRET`, 304, 608, 912 et 1 520 m), arrondis à 10 près ; ils **remplacent** les seuils « sur le papier ». Figés avec le niveau (`figerJour`, `jours.ts`), couverts par l'empreinte du jour ; `seuilsDuJour` lit le fichier avant tout calcul.
- **Rapport** : `npm run robot:gravity -w @cdj/gravity-sim -- --jours 30 --serres 5 [--motifs] [--liens <adresse>]` : une ligne par jour (distance, score, pièces prises / total, appuis, durée, les cinq passages les plus serrés : morceau, motif, fenêtre en pas).
- **Essais de recette** (`?robot`, `?morceau=<n>`) : voir « Pour Nathan ».

## Qui calcule les seuils, et quand
- **`npm run figer:gravity`** (le job `figer` de « Mettre en production », avec le code alors en production) écrit `seuils` et `bot` dans le fichier de chaque jour protégé : le serveur et le jeu les y lisent, **le robot ne tourne pas**.
- **Un jour sans fichier** : le serveur le calcule **une fois par instance et par jour** (le module des jeux garde le niveau d'un jour en mémoire, plus `seuils.ts` : huit jours), **jamais à chaque partie** ; le jeu le calcule **en arrière-plan** pendant la première partie (tranches de 4 ms, `seuilsEnTranches`) et le termine d'un trait à l'écran de fin si la partie finit avant.
- **À décider avant `preview`** (le serveur peut y rester, pas les navigateurs) : sans fichier, **chaque navigateur recalcule les seuils** (≈ 1 à 2 s de calcul réparti, plus sur un téléphone). Le remède de la plateforme est `jours.fabrication.preparer` de la fiche (comme Tower : un `preparer:gravity` qui écrit les jours à venir avec leurs seuils, `joursApresBascule`, un fichier `garde`). Il est dans mes zones (la fiche, le script) mais touche la chaîne de production : **proposé, pas fait**.

## Franchissabilité : ce que le robot a trouvé, ce que j'ai corrigé
Sur 30 jours (02/11 au 01/12/2026, première boucle et moitié de la seconde, 2 280 m) le robot de la v2 du générateur passait **18 jours sur 30**. Cause dominante : **les îlots** (17 échecs sur 30 jours, aux vitesses de la boucle). Les autres échecs étaient pour la plupart l'effet de l'horizon (le robot voit deux morceaux plus loin) : étages, escalier, pilier, milieu, forêt, inverseur. Corrections (toutes selon la vitesse du morceau) :
- **Îlots** : écart `vol + 4` colonnes (le vol d'un îlot à l'autre dure 45 pas : 3 colonnes à 7 m/s, 5 à 12,5 m/s), largeur `vol`, le vide s'arrête après le dernier îlot. Avant : 4 îlots tous les 4 colonnes quelle que soit la vitesse.
- **Étages** : le trou de l'étage haut fait `trav + 3` colonnes (`trav` : colonnes parcourues en descendant de 1,8 case), l'étage haut commence par 5 colonnes, l'étage bas dure 13 colonnes ; **les deux chemins finissent au plafond** (ils finissaient à mi-hauteur, sous l'étage haut, et le morceau suivant — milieu, escalier — y était impossible).
- **Néon** : la seconde couleur est posée là où le vol plafond → sol atterrit (`vol − 1` colonnes après la première), le vide la suit.
- Résultat : **30/30**, puis … jours de plus d'affilée sans un échec (voir « Vérifié »). Fenêtres les plus étroites par motif (30 jours) : … .

## Pour Nathan : tester en 2 clics (recette, jamais classé, le jeu est `off`)
Base : `<aperçu de la PR>/gravity/` (l'adresse est commentée sur la PR). Pour le jour … :
- **Le robot joue** : … 
- **Les cinq passages les plus serrés** (on commence 12 colonnes avant le morceau, dans l'état où le robot y arrive ; à jouer soi-même) : …
- `?morceau=<n>` : n de 1 à 190 ; `?jour=AAAA-MM-JJ` choisit le jour ; `?robot` et `?morceau=` ensemble : on regarde le robot depuis ce morceau.

## Mesures
…

## Vérifié / non vérifié
…

## Décisions et propositions (zones partagées, jamais touchées ici)
…
