# Seed — « Circuit du Jour » (titre provisoire)

Source de vérité du projet. Vit dans `docs/seed.md`, n'est modifié que par Nathan. Projet **web, court**, conçu pour être développé **entièrement dans le cloud** (Claude Code sur le web), sans PC.

---

## 1. Le jeu en une phrase
Chaque jour, un nouveau circuit court, le même pour tout le monde : on le parcourt en une minute dans le navigateur, on retente pour battre son temps et le fantôme du meilleur, et on partage son résultat en une ligne, comme un score de Wordle.

## 2. Les piliers
1. **Une minute par jour.** Un circuit de 30 à 60 secondes. On joue en pause café ; on revient demain.
2. **Le même circuit pour tous.** Un circuit par jour, généré à partir de la date, identique pour chaque joueur. C'est ce qui rend le classement et le partage intéressants.
3. **Zéro friction.** Un lien, ça démarre. Pas de compte, pas d'installation : un pseudo choisi au premier temps, mémorisé dans le navigateur.
4. **Un temps est une preuve.** La physique est **déterministe** : une course est entièrement décrite par la suite des commandes du joueur. Le serveur rejoue la course pour valider le temps, et la même rediffusion sert de fantôme.
5. **Lisible et nerveux.** Low-poly coloré, caméra derrière la voiture, sensations de vitesse ; un circuit se lit en un coup d'œil.

## 3. Le jeu
- **La voiture** : une seule, arcade. Accélérer, freiner/reculer, tourner, **recommencer au dernier point de contrôle**, **recommencer depuis le départ**. Clavier et manette au premier jalon ; tactile ensuite.
- **Le circuit** : des **blocs** posés sur une grille, à la Trackmania — lignes droites, virages, pentes, bosses, tremplins, plaques d'accélération, banquettes relevées ; un départ, des points de contrôle, une arrivée. Pas de boucles ni de murs verticaux au premier jalon.
- **La course** : chronomètre au millième, temps intermédiaires aux points de contrôle (comparés à son meilleur et au fantôme), essais illimités dans la journée.
- **Les médailles** : bronze, argent, or et **temps de l'auteur**, calculés pour chaque circuit (§ 5).
- **Les fantômes** : son propre meilleur temps, et au choix celui du premier du classement ou du joueur juste devant soi.
- **L'écran d'arrivée** : temps, médaille, rang du jour, et la **ligne à partager** :
  `Circuit du Jour #142 — 47,312 s — 🥇 — 23e/812`
- **Les archives** : rejouer les circuits des jours précédents (sans classement, ou avec un classement figé).

## 4. Direction artistique
Low-poly coloré et propre : blocs aux couleurs vives par type (route grise, plaques d'accélération jaunes, points de contrôle bleus, arrivée à damier), ciel dégradé, quelques éléments de décor posés autour du circuit. Une palette différente par jour (thème « désert », « neige », « nuit », « néon »…) pour que chaque circuit ait une identité. Pas de textures lourdes : le jeu doit se charger en quelques secondes, sur mobile aussi.

## 5. Le circuit du jour
- **Généré à partir de la date** (graine = date en UTC), par un générateur qui enchaîne des blocs selon des règles : pas d'auto-intersection, longueur cible, rythme (alternance de lignes droites et de virages), un ou deux passages marquants (tremplin, enchaînement serré), nombre de points de contrôle.
- **Validé par un pilote automatique** : un petit bot qui parcourt le circuit avec la même physique. S'il ne finit pas, le générateur recommence avec une graine voisine. Le temps du bot donne le **temps de l'auteur**, d'où découlent les autres médailles.
- **Plus tard, peut-être** : un circuit dessiné à la main le dimanche ; un éditeur.

## 6. Le classement
- Un **classement par jour** : meilleur temps de chaque joueur, rang, nombre de participants.
- **Validation par rediffusion** : le navigateur envoie la suite de commandes de la course ; le serveur **rejoue la course avec le même code de simulation** et n'enregistre que le temps qu'il a lui-même recalculé. Un temps falsifié ne passe pas.
- **Identité légère** : un identifiant aléatoire stocké dans le navigateur et un pseudo modifiable ; pas d'e-mail, pas de mot de passe. (Changer de navigateur = nouveau joueur, c'est accepté au premier jalon.)
- **Fantômes** : le serveur sert la rediffusion du premier et des voisins de classement.

## 7. Technique
- **TypeScript partout**, en monorepo :
  - `packages/sim` — la **simulation pure** (physique de la voiture, blocs, collisions, chronométrage, générateur, bot) : **aucune dépendance au rendu ni au navigateur**, testée par Vitest en ligne de commande ;
  - `apps/web` — le jeu (Vite + **Three.js**), qui affiche ce que calcule `sim` ;
  - `apps/api` — le classement, qui importe le **même** `sim` pour rejouer les courses.
- **Déterminisme** : pas de pas de temps variable (pas fixe, par exemple 120 par seconde, avec interpolation à l'affichage) ; **pas de moteur physique externe** (physique maison, simple, pensée pour une voiture arcade) ; pas de `Math.sin`, `Math.cos`, `Math.exp` ni de fonctions dont le résultat peut varier d'un navigateur à l'autre dans la simulation — des implémentations à soi, ou des tables. Un test vérifie qu'une même rediffusion donne **exactement** le même temps dans Node et dans un navigateur.
- **Hébergement, deux options** :
  - **Tout dans le cloud (recommandé, « sans PC »)** : le jeu en site statique (Cloudflare Pages ou GitHub Pages), l'API en fonctions serverless (Cloudflare Workers) avec une base légère (D1). Les offres gratuites suffisent pour commencer, et chaque branche a son **aperçu en ligne** automatique.
  - **Sur le serveur de Nathan** : le jeu et l'API dans un conteneur Docker, comme Vitrine. Plus de contrôle, mais il faut exposer le serveur au public.
- **Tests** : Vitest pour la simulation (déterminisme, générateur, validation par rediffusion) ; un test Playwright qui charge le jeu, joue une rediffusion et fait une capture.
- **Intégration continue** : GitHub Actions lance les tests à chaque push et publie l'aperçu.

## 8. Méthode : le développer dans le cloud
- **Claude Code sur le web** (claude.ai/code, ou l'onglet Code de l'application mobile) : chaque lot est une **session cloud** sur le dépôt GitHub du projet. La session tourne même si on ferme le navigateur ou le téléphone, et propose ses changements sous forme de branche et de pull request.
- **Tester un lot en deux clics** : chaque lot a son **aperçu en ligne** (une URL par branche) et, quand c'est utile, un **scénario d'essai** dans l'URL (`?scenario=tremplin`, `?seed=2026-10-06`, `?ghost=on`). Le README du lot donne le lien direct. On teste depuis n'importe quel appareil, puis on fusionne la pull request.
- **Les règles habituelles** : un lot = une session neuve = une branche ; README d'une page dans `docs/lots/` ; le prompt de lot indique les modifications du `CLAUDE.md` ; l'agent s'arrête quand les critères sont verts.
- **Le quota** : un projet web en TypeScript est bien plus léger qu'un projet Unity (pas d'éditeur à lancer, tests en quelques secondes). Sonnet en effort moyen suffit pour la plupart des lots ; Opus seulement pour la physique déterministe si elle résiste.

## 9. Hors du jeu
Multijoueur en direct, comptes, éditeur de circuits, plusieurs voitures, réglages de voiture, personnalisation, monétisation, boucles et murs verticaux (au premier jalon).

## 10. Plan en lots
- **Lot 0 — Le socle.** Monorepo, Vite + Three.js, `packages/sim` vide mais testé, Vitest, GitHub Actions, déploiement de l'aperçu par branche, `CLAUDE.md` court. Une page qui affiche une scène avec un cube qui tourne. **À tester** : l'aperçu en ligne s'ouvre.
- **Lot 1 — La voiture.** Physique arcade déterministe, pas fixe, contrôles clavier et manette, caméra derrière la voiture, une piste plate d'essai. **À tester** : la conduite est-elle agréable ? (`?scenario=plat`)
- **Lot 2 — Les blocs.** Le jeu de blocs, la grille, collisions avec les bords et les pentes, plaques d'accélération, tremplin ; départ, points de contrôle, arrivée ; chronomètre et temps intermédiaires ; recommencer au point de contrôle ou au départ. Un circuit d'essai écrit à la main. **À tester** : un tour complet chronométré.
- **Lot 3 — La rediffusion et le fantôme.** Enregistrement des commandes, rediffusion exacte (test Node ↔ navigateur), affichage du fantôme de son meilleur temps.
- **Lot 4 — Le circuit du jour.** Générateur à partir de la date, règles de construction, bot de validation, temps de l'auteur et médailles, palette du jour. **À tester** : trois dates différentes donnent trois circuits jouables (`?seed=…`).
- **Lot 5 — Le classement.** API, rejeu des courses côté serveur, pseudo, classement du jour, fantômes du premier et du voisin. **À tester** : deux appareils, deux temps, un classement.
- **Lot 6 — L'arrivée et le partage.** Écran d'arrivée, ligne à partager, archives des jours précédents, chargement rapide sur mobile. Puis jalon : une semaine de circuits joués par Nathan et quelques amis.
- **Ensuite** : commandes tactiles, thèmes visuels, circuit dessiné du dimanche, publication sur un portail de jeux web.

## 11. Concurrence
**Trackmania** propose déjà un « circuit du jour » (Track of the Day) ; **PolyTrack**, un jeu de course low-poly dans le navigateur, a trouvé son public. La différence visée : le **format quotidien très court**, sans compte et sans installation, et le **partage en une ligne**.
