# Lot U6 — Classements : un seul format, un podium partout

*18 novembre 2026. Plateforme (interface). Maquette validée le 18/11 : `docs/plateforme/maquettes/classements-podium-partout.html`. Règles : `packages/ui/CLAUDE.md` (« Le classement »), `docs/regles/portail/classements-lot-u2.md` (« Lot U6 »).*

**Où j'en suis : les deux parties sont faites.** Le classement à l'intérieur des jeux reste le lot U7.

## Pour les joueurs
- [Du Jour] Les classements ont un podium partout, avec les écarts et les seuils des médailles. // Every ranking now has a podium, with gaps and medal thresholds.
- [Du Jour] « Ta course » te dit ce qu'il te manque pour passer devant. // "Your race" tells you what you need to move up.

## Ce qui change
1. **Composant commun dans `@cdj/ui`** (`classement.ts`, pur, ne nomme aucun jeu, à la demande) : podium de trois marches or / argent / bronze, couronne, « Place à prendre » en pointillés, liste avec écart au premier, seuils, places gagnées ; **« Ta course » à part** (`tacourse.ts`).
2. **`/classement/`** : podium toujours là (même vide), écart sous chaque place et chaque ligne, seuils « Or · 32,000 s » dans les vues par jeu, fronton « Il reste pour faire mieux » le jour en cours.
3. **« Ta course »** (si tu es classé) : barre fixe sur téléphone, panneau en tête de la colonne de droite dès 1 100 px ; « Rejouer <jeu> » ; groupes : « Ton temps compte : tu es 2e de ton groupe ».
4. **Groupes** : même podium (emblème carré, trois photos), « Moins de 3 classés » avec « encore N pour entrer », panneau d'ordinateur = petit podium.
5. **Places gagnées ou perdues** (▲2, ▼2) dans `cdj:classement:rangs` ; **les deux pages des mentions légales** le disent (test de fidélité ajouté).
6. Vitrine `/ui/` : section « Classements » (plein, marche libre, vide, clair et sombre, groupes, « Ta course »).

## Décisions à relire
- **Serveur : `trio` ajouté à `GET /api/groupes/classement`** (`ref`, `pseudo`, `avatar?` des trois membres qui comptent). **Sans lecture de plus** : la requête d'appartenance de `calculerVues` fait une jointure sur la clé primaire de `players` ; le calcul reste fait une fois par fenêtre de 30 s.
- **Seuils des médailles : ceux de la copie de l'accueil** (aucune requête de plus). **Pas de seuils sur un jour passé**, ni si le joueur n'a pas ouvert l'accueil ce jour-là : le classement du serveur ne les porte pas. Les lui faire porter est un petit lot serveur si vous voulez les seuils partout.
- **Écarts à la maquette** : photos de 112 / 92 px (charte § 9, la maquette a 120 / 96) ; écart sous le podium en encre douce (la terre fait 4,07:1 sur la crème) ; ▲ en encre et ▼ en terre (pas de vert dans la charte) ; « Or · 32,000 s » sans capitales (le « s »).
- Au cumul, « Ta course » n'existe que si le joueur a tout fini ; hors du haut (50) l'écart est celui au premier.

## Budget `portail.classement` — à valider
Mesuré (`node scripts/budgets.mjs`) : **53 232 o avant, 56 938 o après, plafond 57 Ko : marge de 62 o.** Tenu en mettant à la demande « Ta course » (module, feuille, textes), les places gagnées et le podium des groupes. **Je propose de relever le plafond à 60 Ko** (mesure + 5 %) : la prochaine retouche de cette page le dépassera. Je n'ai pas modifié `budgets.md`. `portail.premier` : 43 519 → 43 628 o (feuille partagée allégée, plafond 47 Ko).

## Vérifié
Typecheck, `vitest` ui, portail, profil (643 tests), `groupes.test.ts` du serveur (trio, plans) ; e2e Chromium `groupes`, `amis`, `portail-journee`, `accessibilite`, `portail`, `avatars`, `nouveau-depart`, `diffusion`. **Non vérifié** : Firefox et WebKit ; la manette (pas de nouvel écran : « Ta course » est un lien) ; un appareil réel.

## Captures (`lot-U6-captures/`)
Quatre vues (Cumulé, Track, Amis, Groupes), téléphone (390 × 844) et ordinateur (1280 × 1060), avant (`main`) et après, sur la recette garnie du 24/10 (`captures-lot-u6.spec.ts`, outil).
