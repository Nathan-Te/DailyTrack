# Retouche 18b — Cuves rapides, deux pédales par défaut, ménage

**Essayer** : https://nathan-te.github.io/DailyTrack/b/lot-18b-cuves-rapides/?scenario=cuves — l'élan, la **cuve droite** (4 `V`) : montez sur la paroi gauche en braquant à fond un instant, longez-la, puis redescendez vers l'axe avant la fin : la voiture **sort nettement plus vite** que sur le fond (compteur en haut à droite : ≈ 57 m/s contre ≈ 47) ; pareil pour le mur latéral, puis le **virage en cuve** large (`L2/c`) : par le mur on en sort à ≈ 49 m/s contre ≈ 43 par le fond.
**Au téléphone** : https://nathan-te.github.io/DailyTrack/b/lot-18b-cuves-rapides/?scenario=cuves&touch=1 — **deux pédales par défaut** (moitié droite : gaz au dernier quart, frein au troisième ; rien ne se passe tant qu'on ne touche pas le gaz). Réglages ⚙ → *Automatique* pour retrouver l'ancien accélérateur automatique.
**Puis deux circuits du jour** (même base, `?seed=` ; touche **T** pour le thème suivant, **N** pour une date au hasard) :
- Stade, **cuve droite** (6 blocs, 38,2 s d'auteur, 0,37 s de gagné par la paroi) : https://nathan-te.github.io/DailyTrack/b/lot-18b-cuves-rapides/?seed=2026-10-13
- Nuit, **cuve droite** (36,0 s, 0,38 s de gagné) : https://nathan-te.github.io/DailyTrack/b/lot-18b-cuves-rapides/?seed=2026-10-12
- (en plus) Stade, **virage en cuve** ample (36,8 s) : https://nathan-te.github.io/DailyTrack/b/lot-18b-cuves-rapides/?seed=2026-10-14

(Si l'environnement impose un autre nom de branche, remplacer `lot-18b-cuves-rapides` dans le lien ; une fois fusionné, les mêmes adresses marchent sur https://nathan-te.github.io/DailyTrack/ et `/admin/` propose toujours « Cuves et murs ».)

## Livré

**Physique de paroi** (`packages/sim/src/car.ts`, `substepShell`) — cinq clés de `CarParams`, toutes dans `?debug&tune` (« Copier les réglages » les reprend) :

| Clé | Défaut | Effet |
|---|---|---|
| `shellClimb` | 0,4 | la pesanteur le long de la paroi ne coûte que 40 % **en montant** (tant que la montée n'est pas franche : ce rabais s'éteint de 3 à 9 m/s de vitesse verticale, comme la « tenue » du lot 18) |
| `shellDescent` | 2,6 | la même pesanteur pousse 2,6 fois **en descendant** (au-delà de 0,5 m/s vers le bas, lissé) |
| `shellTop` | 1,15 | la **pointe de paroi** : 1,15 × la pointe du plat (55 m/s) ; poussée et traînée de pointe suivent |
| `shellPush` | 14 m/s² | **poussée** sous cette pointe, tant que la voiture est franchement sur la paroi (normale à plus de 37° de la verticale, pleine à 66°) ; zéro sur le fond |
| `shellGainTop` | 56 m/s | la **borne** : voir plus bas |

L'idée de Nathan (monter puis redescendre doit sortir plus vite) passe par l'asymétrie ; la poussée et la pointe de paroi font que les **virages en cuve**, où l'on ne « pompe » pas, gagnent aussi (la montée y est une rampe d'entrée de 30 % de l'arc, la descente la rampe de sortie).

**Pas d'exploitation.** Une poussée de paroi stocke de l'énergie en hauteur (piège du lot, voir `orchestration.md` § 8) : un zigzag dans une longue cuve atteignait 77 m/s à plat. Au-delà de `shellGainTop` de vitesse **totale** (verticale comprise), une traînée de 3 /s sur l'excès ramène la voiture, et le surplus de descente s'éteint dans les 6 m/s qui précèdent. Le gain d'un passage est donc borné quoi qu'on fasse ; la rabais de montée s'éteint dès que la montée est franche (sinon une voiture lancée vers la crête montait à 300 m).

**Pilote** (`autopilot.ts`) : sur une **cuve droite** il pompe (le profil en travers est lissé sur toute la série : monte sur les premiers 40 %, longe à 0,8 m du pied de la paroi verticale, redescend sur les derniers 40 %, les bouts de 10 % restent libres pour raccorder les blocs voisins sans cassure de courbure) ; sur un **virage en cuve** il prend la paroi extérieure (1 m / 1,5 m / 1,5 m du pied selon la taille). `bestPilotRun` garde la plus rapide des deux lignes ; **le virage serré sur la paroi n'est plus pris** (à 47 m/s il sort par-dessus la crête : le générateur n'en pose plus). La relaxation longue de la trajectoire (4000 itérations) ne vaut plus qu'à 4 blocs d'une cuve ; le reste du circuit garde le tracé du sol (piège : sinon la ligne « sur la paroi » coupait aussi les autres virages).

**Générateur** (`generator.ts`) : **cuve droite de 6 blocs** (4 donnaient un gain trop mince : 0,05 à 0,1 s) suivie de **4 droites** (`CUVE_RUNOUT` : on en sort à ≈ 57 m/s) ; **virage en cuve large ou ample** (plus de serré), suivi d'un créneau calme de **4 droites**, sans saut ni passage marquant juste derrière ; un créneau de moins quand la cuve est droite pour garder la durée. Les thèmes ne changent pas (Stade et Nuit 100 %, Banquise 25 %).

**Tactile** (`touch.ts`, `touchUi.ts`) : `autoThrottle` vaut `false` par défaut ; les réglages enregistrés portent `version: 2` (`TOUCH_SETTINGS_VERSION`) ; un enregistrement sans version est relu avec le nouveau défaut pour l'accélérateur (le mode de direction, la sensibilité, etc. sont gardés) ; un joueur qui repasse en automatique est respecté. Le menu propose « Bouton gaz » en premier. Zéro changement dans `sim` : les commandes restent des entiers.

**Ménage de `docs/orchestration.md`** : § 2 (n° de PR du lot 18 = #32, ligne 18b), § 6 « Modèles » alignés sur le seed, § 7 « Décidé » (murs et cuves autorisés depuis le lot 18 ; boucles, tunnels fermés et murs au plafond exclus ; décisions des lots 16 et 18 marquées **tranchées**) et « Ouvert » 1 (hébergement : serveur de Nathan en Docker + tunnel Cloudflare, Workers gratuit exclu — rejeu ≈ 38 ms —, Workers payant en repli), § 8 (quatre pièges de la 18b), § 9 « Suite » alignée sur le seed § 10 (lots 19 et 20, puis mise en ligne).

**Versions** : `SIM_VERSION` **10**, `GENERATOR_VERSION` **10** ; références golden (essai + circuits du jour), `history:seed` et `measure:generator` relancés. Jour de test de l'API : **14/10/2026** (le 12/10 n'a plus le même circuit ; ordre des temps vérifié sur les 30 premiers jours).

## Seuils mesurés

`packages/sim/test/cuves-rapides.test.ts` (6) :

| Mesure | Fond | Paroi | Écart |
|---|---|---|---|
| Cuve droite de 4 blocs, entrée à 30 m/s, pleins gaz, pompe (A = 6 m, λ = 102 m) | 46,8 m/s | 56,4 m/s | **+20,6 %** |
| Idem, entrée à 36 m/s | 47,1 m/s | 56,2 m/s | **+19,2 %** |
| Virage en cuve `L2/c`, pilote, vitesse en entrant dans le bloc suivant | 43,0 m/s | 48,7 m/s | **+13 %** |
| Virage en cuve `L3/c` | 46,2 m/s | 51,9 m/s | **+12 %** |
| Sans asymétrie ni poussée ni pointe (réglages « neutres ») | 47,1 | ≤ +4 % | la paroi n'est alors plus un raccourci |

- Critère de la retouche : sortie par la paroi **≥ fond + 8 %** (cuve droite et virage en cuve) — tenu avec 11 à 12 points de marge.
- **Zigzags** : 3 vitesses d'entrée (30 / 40 / 48 m/s) × 5 périodes (0,4 à 5 s) × 2 amplitudes dans 14 blocs de cuve : vitesse à plat maximale **62 m/s** (< 64 testé), jamais non finie. La « pompe » la mieux réglée (A = 5–7 m, λ = 96–160 m) reste sous `shellGainTop` × 1,06.
- **Le pilote d'auteur choisit la paroi** : sur les 60 premiers jours, **21 cuves sur 32** (voir `npm run measure:generator`) ; test : majorité des circuits à cuve des 24 premiers jours.

## Mesures (`npm run measure:generator`, 60 dates à partir du 06/10/2026)

| | avant (v9, `main` mesuré sur la même machine) | après (v10) |
|---|---|---|
| temps d'auteur min / moyen / max | 30,1 / 35,2 / 39,7 s | **30,1 / 35,7 / 40,0 s** |
| dans [30 ; 40] s | 60/60 | **60/60** |
| circuits de secours | 0 | **0** |
| tentative retenue (moyenne / max) | — / — | 2,5 / 17 |
| génération (moyenne / max) | 153 / 705 ms | 193 / 586 ms |
| **rejeu d'une course d'auteur** | **33,5 ms** (max 78,7) | **37,4 ms** (max 64,3) |

- **Cuves** : Stade 15/15, Nuit 14/14, Banquise 3/14, Rallye et Campagne 0 ; types : cuve droite × 15, mur latéral × 5, virage en cuve × 12 (étaient 13 / 8 / 11).
- **Choix du pilote d'auteur** : paroi dans **21 cuves sur 32** (droites 17/20, virages 4/12). Les virages en cuve restent le point faible (le trajet extérieur est plus long) : 33 % seulement par la paroi.
- Taux de validation par thème (12 dates × 6 tentatives) : Stade 33 % construits, pilote finit 96 %, **dans la fenêtre 54 %** (73 % avant la 18b) ; Nuit 40 %, 97 %, **55 %** (63 %) ; Banquise 64 %, 89 %, 43 % ; Rallye et Campagne inchangés (45 / 48 %). La cuve plus longue réduit la part de circuits dans 30–40 s, sans jamais obliger au repli (0 sur 60).
- **Coût d'un rejeu** : **+12 %** en moyenne (37,4 contre 33,5 ms, même machine, ce ne sont pas les mêmes circuits : 6 blocs de cuve au lieu de 4, plus de physique de paroi). Un pas de paroi ajoute le calcul des facteurs de montée / descente et du plafond (quelques multiplications), je n'ai **pas isolé** la part due au pas lui-même : à surveiller avec le coût de la décision 1 d'`orchestration.md` (hébergement).

## Garde-fous

- `packages/sim/test/cuves-rapides.test.ts` (nouveau, 6), `cuves.test.ts` (adapté : le virage serré sur la paroi n'est plus exigé ; les virages du test de vitesse passent à `L3/c` ; le pilote d'auteur n'est comparé au sol que quand le sol finit).
- `apps/web/test/touch.test.ts` : deux pédales par défaut, migration une fois, choix gardé, version future non crue, sauvegarde et relecture.
- `apps/web/e2e/tactile.spec.ts` : *deux pédales par défaut* (sans réglage enregistré, ni gaz ni frein jusqu'au toucher, gaz au dernier quart, frein au troisième) et *ancien réglage migré puis retour en automatique gardé au rechargement* (Android et iPhone) ; les autres tests partent de l'automatique, qu'ils enregistrent d'entrée.
- Le test de classement tronque le code à 12 caractères (à 30, il redevenait lisible sur le nouveau jour de test).

## Choix à connaître

- **Le gain est fort** (+19 à +21 % en pompant à fond, ordre de grandeur demandé : +8 à +15 %) : la sortie d'une cuve droite se fait à ≈ 57 m/s, soit plus que la plaque d'accélération de l'ancienne pointe (48) mais moins que la plaque (66). Pour l'adoucir sans toucher au pilote : `shellDescent` 2,0 et `shellPush` 8 (panneau `?debug&tune`) ; le pilote choisira alors la paroi dans moins de cas. **À essayer par Nathan.**
- **Le virage serré en cuve (`L/c`) reste dans la notation** mais le générateur n'en pose plus et le pilote ne le prend plus par la paroi.
- **La cuve droite s'est allongée** (6 blocs, ≈ 190 m de cuve + 4 droites derrière) : un circuit à cuve droite a un créneau de virage de moins.
- Le scénario `cuves` n'a pas changé de tracé (ses 4 `V` suffisent pour sentir le gain).

## Pas encore fait / à voir avec Nathan

- Sensation de la paroi à la manette ou au doigt : le pilote peut pomper, un joueur doit trouver la montée et la descente ; si c'est trop dur sans les valeurs ci-dessus, un guide visuel (ligne ou flèche au sol) serait un sujet pour un prochain lot.
- Sur téléphone, deux pédales au pouce droit demandent de lâcher le gaz pour freiner : à reconfirmer sur un **vrai téléphone**.
