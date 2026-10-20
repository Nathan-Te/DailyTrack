# Seed — Phase 3 : le portail Du Jour, l'anglais et l'identité visuelle

Source de vérité de la phase 3 de la plateforme. Vit dans `docs/plateforme/seed-phase-3.md`, n'est modifié que par Nathan. Suit la phase 2 (`seed-phase-2.md` : serveur commun, profil partagé, classement prouvé, morts de tout le monde) et la mise en ligne sur `playdujour.com` (lots R1 à R5).

---

## 1. La phase en une phrase
`playdujour.com` devient une vraie destination quotidienne : on y voit d'un coup d'œil les jeux du jour et où l'on en est, on y suit sa série et son rang tous jeux confondus, on y partage sa journée en une ligne — en français ou en anglais, avec une identité visuelle forte et propre à chaque jeu.

## 2. Les principes
1. **Le portail est la porte d'entrée du jour.** Un joueur qui ouvre `playdujour.com` sait en trois secondes ce qu'il lui reste à jouer aujourd'hui.
2. **Bilingue dès maintenant.** Français et anglais partout : portail, jeux, mentions, messages du serveur. Aucune chaîne écrite en dur dans le code.
3. **Une identité forte, jamais générique.** Une marque « Du Jour » commune, et une personnalité propre à chaque jeu. Le rendu ne doit pas avoir l'air d'un gabarit ou d'une interface générée par défaut (voir § 6).
4. **Mobile d'abord.** Tout se conçoit au téléphone, en portrait, puis s'étend.
5. **Rapide.** Le portail s'affiche en moins d'une seconde sur un téléphone moyen ; les règles de poids et de coûts des lots P4 et R4 restent.
6. **Rien ne change dans les règles des jeux.** Physique, générateurs, classements prouvés : intacts. Cette phase touche ce qu'on voit, pas ce qui se joue.
7. **Pas de publicité dans cette phase.** Elle viendra en phase 4, avec un statut d'éditeur professionnel et un bandeau de consentement.

## 3. Le portail
- **L'accueil** :
  - les **jeux du jour**, une carte par jeu : nom, numéro du jour, thème ou visuel du jour, et ton statut (pas encore joué · en cours · fini, avec temps, médaille et rang) ;
  - le **compte à rebours** jusqu'aux prochains jeux (minuit, heure de Paris) ;
  - ta **série** tous jeux confondus ;
  - ton **profil** en un coup d'œil (pseudo, médailles).
- **La série tous jeux confondus** : le nombre de jours consécutifs où tu as fini **au moins un** jeu du jour. Une **journée parfaite** (tous les jeux finis) est signalée à part.
- **Le classement du jour, tous jeux confondus** : des **points** par jeu selon la médaille obtenue (auteur, or, argent, bronze), additionnés ; à égalité, la somme des rangs départage. Barème à calibrer sur de vraies journées.
- **La ligne de partage de la journée** : une seule ligne pour tous les jeux, par exemple `Du Jour #12 — Track 🥇 · Jump 🥈 — 🔥 5`, avec le lien du portail. Elle existe en français et en anglais.
- **Le profil commun** : pseudo, code de transfert, statistiques par jeu, médailles, série, langue ; c'est l'écran de Réglages › Profil des jeux, partagé.
- **Le lien entre le portail et les jeux** : chaque jeu a un retour discret vers le portail ; à l'arrivée d'un jeu, l'écran propose « jeu suivant du jour » s'il en reste.

## 4. Le serveur
- Les lectures du portail passent par une **route regroupée** (`/api/portail/jour`, sur le modèle de la lecture regroupée du lot P4) : statut du joueur dans chaque jeu du registre, série, points et rang du jour. Une seule requête au chargement.
- Le classement du jour tous jeux confondus se calcule à partir des classements prouvés de chaque jeu : **aucun temps n'est cru**, comme partout.
- Chaque jeu du registre déclare ce que le portail affiche de lui (nom, numéro du jour, médailles, barème de points) : ajouter le jeu n° 3 ne touche pas au portail.
- Les messages d'erreur du serveur deviennent des **codes** ; leur texte est traduit côté client.

## 5. Les langues
- **Français et anglais**, avec détection à la première visite (langue du navigateur) et choix mémorisé, commun à toute la plateforme.
- **Toutes les chaînes** passent par des catalogues, par application ; un test refuse une chaîne d'interface écrite en dur.
- Nombres, durées et dates au format de la langue (`31,402 s` / `31.402 s`) ; les lignes à partager existent dans les deux langues.
- La page des mentions légales et de confidentialité existe en anglais.
- Les traductions sont écrites par les agents, relues par Nathan ; le ton suit la charte (§ 6).

## 6. L'identité visuelle
- **D'abord une direction, choisie par Nathan**, avant tout code : des pistes visuelles montrées en maquettes, une seule retenue, consignée dans une **charte** (`docs/plateforme/identite.md`).
- **La marque Du Jour** : logo, couleurs, typographies, ton des textes, composants communs (boutons, cartes, fenêtres, notifications), mouvement.
- **Chaque jeu a sa personnalité** sous la marque :
  - **Track** : la course, la vitesse, le chronométrage (typographie tendue, rythme, lisibilité au premier coup d'œil) ;
  - **Jump** : le jeu de plateforme brutal et drôle (formes franches, énergie, humour).
- **Ce qui fait « générique », à éviter** : dégradés bleu-violet par défaut, cartes translucides partout, police système et coins arrondis uniformes, émojis comme seules icônes, mises en page centrées sans hiérarchie, animations décoratives sans raison. Chaque choix de la charte a une raison écrite.
- Les jeux gardent leur rendu procédural (zéro asset dans le monde du jeu) ; l'interface, elle, peut utiliser des polices et des icônes dessinées pour la marque, hébergées sur le site.
- **Accessibilité** : contrastes vérifiés, tailles de texte, cibles tactiles ≥ 44 px, mouvement réduit respecté.

## 7. Technique
- Un paquet commun d'interface (`packages/ui`) : jetons de la charte, composants de base, moteur de traduction. Zone partagée, comme `packages/profile`.
- Le portail devient une application à part entière (`apps/portail`), avec ses tests, sous les mêmes règles que les jeux (CI, recette, aperçus par PR).
- Les jeux adoptent `packages/ui` pour leur interface hors du jeu (accueil, menus, arrivée, profil), sans toucher à leur rendu en jeu.

## 8. Méthode
- Les règles de la plateforme s'appliquent (un lot = une session = une branche = une PR ; aperçu par PR ; recette ; bouton de production).
- **Les lots d'identité visuelle se jugent à l'œil** : chaque lot livre des captures portrait et paysage, et l'aperçu ; Nathan valide le rendu avant la fusion.
- Les consignes de la charte vont dans le `CLAUDE.md` de `packages/ui` et de chaque application.

## 9. Plan en lots
- **Lot I0 — La direction artistique.** Pistes visuelles pour la marque et chaque jeu, choix de Nathan, charte écrite (`identite.md`), noms d'affichage des jeux confirmés.
- **Lot I1 — Le socle : interface commune et traductions.** `packages/ui` (jetons, composants, traduction), langue commune, codes d'erreur du serveur, le portail actuel passé au socle.
- **Lot I2 — Le portail.** Accueil riche, compte à rebours, série tous jeux confondus, profil commun, retour au portail depuis les jeux, route regroupée du serveur.
- **Lot I3 — La journée partagée.** Classement du jour tous jeux confondus (points), ligne de partage de la journée, « jeu suivant du jour » à l'arrivée.
- **Lot I4 — Track : nouvelle interface et anglais.**
- **Lot I5 — Jump : nouvelle interface et anglais.**
- **Lot I6 — Finitions.** Mentions en anglais, titres et aperçus de partage (image et description quand on colle un lien), relecture des traductions.
- **Ensuite** : le travail sur le jeu de chaque titre (calibration de DailyJump, etc.), puis la **phase 4** (statut d'éditeur, publicité, consentement).

## 10. Questions ouvertes
- Le barème de points du classement du jour.
- Les noms d'affichage des jeux (Track et Jump sous la marque Du Jour, ou d'autres) : tranchés au lot I0.
- La langue des pseudos et des contenus des joueurs : rien à traduire, mais filtrage des pseudos commun aux deux langues ?
