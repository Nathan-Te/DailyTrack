# Lot 6 — L'arrivée, le partage et les archives

**Livré**
- **Écran d'arrivée** : temps, médaille, record, rang du jour (si le classement est branché), **ligne à partager** façon Wordle :
  `Circuit du Jour #142 — 47,312 s — 🥇 — 23e/812`
  (morceaux omis quand on ne les connaît pas : pas de médaille, pas de classement ; la ligne porte le meilleur temps du jour, avec sa médaille et son rang). Boutons **Rejouer**, **Copier le résultat** (ligne + adresse du jeu, avec `?seed=` pour une archive), **Partager** (feuille de partage du téléphone, quand elle existe) et **Archives**. Tout est cliquable : pas besoin de clavier.
- **Archives** : touche **H** ou bouton 📅 (*Archives*) → liste des jours du lancement à aujourd'hui, avec numéro, date, thème et **ton meilleur temps et ta médaille** de chaque jour ; un clic ouvre ce jour (`?seed=`, réglages de test conservés). Un jour passé se joue **sans envoyer de temps** (le serveur le refuserait) et affiche « Classement figé » ; son classement reste consultable.
- **Menu cliquable** (🏆 classement, 👻 fantôme, 📅 archives) : mêmes actions que **L**, **G**, **H**.
- **Chargement rapide sur mobile**
  - *Écran de chargement* dans le HTML : visible dès **0,2 à 0,4 s** (avant : écran vide pendant ~1,45 s).
  - *Découpage du code* : Three.js (le gros du poids) dans son propre fichier, mis en cache d'un déploiement à l'autre ; le code du jeu ne pèse plus que **11 ko compressés** (+ 7 ko de simulation). Total JS ≈ **150 ko compressés**. Préchargement parallèle des modules.
  - *Mesure* (Chromium, processeur ralenti ×4, réseau 1,6 Mb/s + 150 ms) : **premier affichage 0,2–0,4 s, jeu prêt 1,9 s** (1,4 s sans ralentissement du processeur).
  - *Mise en page téléphone* : bandeau resserré (titre court, menu en icônes, chrono à gauche en très étroit), classement en fenêtre qu'on ouvre au toucher, panneau d'arrivée adapté au paysage, `touch-action`/`overscroll` neutralisés, boutons ≥ 34 px.

**Pas de commandes tactiles pour l'instant** (« Ensuite » dans le plan) : sur un téléphone, le jeu se charge vite et tout l'écran s'utilise, mais **on ne peut pas encore conduire sans clavier ni manette** (une manette Bluetooth marche). C'est la suite évidente avant de faire jouer des amis sur mobile.

**À tester** : finir un tour → copier le résultat et le coller dans une conversation ; ouvrir les archives (**H**) ; sur téléphone, ouvrir le jeu et regarder le chargement et la mise en page (regarder les circuits, ouvrir le menu, l'écran d'arrivée quand tu pousses une course à la manette).

**Garde-fous**
- `share.test.ts` (ligne à partager, rangs ordinaux, avec/sans médaille et classement, adresses), `archive.test.ts` (jours listés, plafond, liens, records locaux dont une entrée illisible au milieu).
- `e2e/share.spec.ts` : la ligne affichée = la ligne attendue ; **le bouton copie exactement « ligne + adresse »** (presse-papiers réel) ; Rejouer sans clavier ; archives (4 jours avec `?today=`, médaille d'un jour passé, ouverture d'un jour, H / Échap / clic à côté, lien d'aujourd'hui sans seed) ; un jour passé n'envoie rien au classement.
- `e2e/mobile.spec.ts` : sur **3 formats de téléphone** (390×844, 844×390 paysage, 360×640), en course (titre, médailles, chrono, intermédiaires, fantôme, menu, vitesse) puis à l'arrivée, **aucun élément ne chevauche un autre ni ne dépasse de l'écran**, boutons ≥ 34 px, classement ouvert/fermé au toucher. (Ce test a trouvé des défauts de mise en page, corrigés. Il **impose la police DejaVu Sans**, large : la police par défaut change d'une machine à l'autre — étroite sur ma machine, DejaVu sur la CI — et c'est la plus large qui décide si une ligne déborde. Sans cela, il passait ici et échouait sur la CI.)
- `e2e/perf.spec.ts` : budget de poids (JS compressé < 165 ko, hors Three.js < 40 ko, Three.js dans son fichier) et chargement sur téléphone simulé (premier affichage < 2,5 s, prêt < 8 s : larges, la CI est variable).
- `e2e/leaderboard.spec.ts` : la ligne à partager reprend le rang donné par le serveur (« …1er/1 »).
- Outil de test : `?debug&today=AAAA-MM-JJ` simule une autre date du jour.

**Limites**
- Les temps de chargement ci-dessus sont une **simulation** dans Chromium, pas un vrai téléphone en 4G ; à confirmer sur un vrai appareil.
- La touche d'archives est **H** et non A (A sert à tourner à gauche au clavier QWERTY).
- Pas de partage d'image (seulement du texte), pas de statistiques ni de série de jours (« streak »).

**Jalon suivant (seed § 10)** : une semaine de circuits joués par toi et quelques amis. Avant ça : l'hébergement de l'API (voir lot 5), les commandes tactiles, et le réglage des seuils des médailles.
