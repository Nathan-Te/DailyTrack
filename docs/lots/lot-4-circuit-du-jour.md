# Lot 4 — Le circuit du jour

**Livré**
- **Générateur** (`packages/sim/src/generator.ts`) : la graine est la date UTC (`dailyCircuit(jour)`), le circuit est donc identique pour tout le monde. Il enchaîne des segments (lignes droites, plaques, bosses, côtes, virages) en **alternant calme et virages**, avec **1 ou 2 passages marquants** (tremplin + deux lignes droites pour atterrir, chicane, épingle), **2 à 4 points de contrôle** répartis, 30 à 45 blocs. Chaque segment est posé sur la grille en refusant les croisements ; si un passage marquant ne tient pas, la tentative échoue.
- **Validation par un pilote automatique** (`autopilot.ts`) : il parcourt le circuit avec la même physique (poursuite de la ligne médiane, ralentit avant les virages, 4 vitesses de virage essayées). S'il ne le finit pas sans chute, ou si sa durée sort de la fenêtre **28–48 s**, le générateur recommence avec une **graine voisine** (jusqu'à 40 tentatives ; en pratique 0 à 9). Le pilote n'utilise que des opérations déterministes (pas d'arctangente, pas de `hypot`) : mêmes décisions partout.
- **Temps de l'auteur et médailles** : le temps du pilote est le temps de l'auteur 🏆 ; **or ×1,08, argent ×1,20, bronze ×1,40** (`MEDAL_FACTORS`). Affichés en haut à gauche pendant la course, et sur l'écran d'arrivée avec la médaille obtenue.
- **Palette du jour** : désert, neige, nuit ou néon, selon la date (`paletteForDay`).
- **Calendrier sans `Date`** (`calendar.ts`) : numéro de jour, `AAAA-MM-JJ`, numéro du circuit (« #1 » le 06/10/2026, jour du lancement).
- **PRNG à graine** (`rng.ts`, mulberry32, entiers uniquement).
- **Identifiant du circuit** `jour-AAAA-MM-JJ-g1` : la version du générateur en fait partie, donc les records et rediffusions d'un autre générateur ne se mélangent pas.

**Jouer** : par défaut, le circuit d'aujourd'hui (UTC). `?seed=2026-10-07` : n'importe quelle autre date (date invalide → aujourd'hui, avec un message). `?scenario=essai` : le circuit écrit à la main des lots 2-3. `?scenario=plat` : le terrain d'essai du lot 1. Le record et le fantôme sont gardés **par circuit**.

**À tester** : ouvrir `?seed=2026-10-06`, `?seed=2026-10-07` et `?seed=2026-10-08` : trois circuits différents, jouables, de trois thèmes différents. Pour chacun : la longueur est-elle bonne (30 à 60 s pour toi) ? Les passages marquants sont-ils lisibles ? Les médailles sont-elles atteignables ?

**Garde-fous**
- `generator.test.ts` (110 jours : 50 consécutifs + 60 espacés sur ~3 ans) : jamais de circuit de secours ; départ, arrivée, 2 à 4 points de contrôle ; longueur 25–60 blocs ; pas d'auto-intersection ; jamais plus de deux virages d'affilée, jamais de plaque avant un virage ; toujours un passage marquant ; deux lignes droites après chaque tremplin ; **chaque circuit finissable par le pilote dans la fenêtre de durée** ; tous différents ; le temps de l'auteur se rejoue exactement via la rediffusion du pilote ; médailles ; palettes.
- `golden-daily.test.ts` : le texte exact, le temps d'auteur et la palette de 7 dates de référence (`fixtures/daily-golden.json`). S'il casse, le circuit d'une date a changé : incrémenter `GENERATOR_VERSION` puis régénérer (`UPDATE_GOLDEN=1 npx vitest run packages/sim/test/golden-daily.test.ts`).
- **Test navigateur** (`apps/web/e2e/daily.spec.ts`) : Chromium, Firefox et WebKit (en CI) régénèrent ces 7 circuits via `verify.html` et doivent retrouver exactement les mêmes. Dans Chromium : 3 dates se chargent, se jouent (la voiture roule), affichent titre et médailles, donnent 3 circuits différents ; date invalide ; circuit d'essai toujours accessible.

**Choix à connaître**
- **Les seuils des médailles ne sont pas calibrés sur de vrais joueurs** : le pilote suit la ligne médiane et ne cherche pas la trajectoire idéale, donc un bon joueur peut battre le temps de l'auteur. Les facteurs (`MEDAL_FACTORS`) et la fenêtre de durée se règlent d'un coup, au jalon « une semaine de circuits joués ».
- Le circuit est **généré dans le navigateur** au chargement (~50 ms en moyenne, jusqu'à ~0,5 s). Le serveur du lot 5 le régénérera de la même façon pour valider les courses (à mettre en cache).
- Pas encore : archives des jours précédents et partage (lot 6), palettes plus riches (décor), circuit dessiné à la main le dimanche.
