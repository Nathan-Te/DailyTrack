# Lot U2 — Classements : le podium et les photos

*6 novembre 2026. Plateforme (portail). Maquette : `docs/plateforme/maquettes/portail-classements-amis.html`. Charte : révision 19, § 9. Règles : `docs/regles/portail/classements-lot-u2.md`.*

**Où j'en suis : la partie 1 est faite. La partie 2 est sautée** (le prompt ne la note pas « validée » : voir plus bas). Reste à Nathan : juger l'aperçu, valider le plafond, trancher les écarts.

## Pour les joueurs
- [Du Jour] Classements : un podium et des photos en grand. // Leaderboards: a podium and big profile pictures.

## Partie 1 — la page `/classement/`
1. **Fronton** « CLASSEMENTS » avec la date, la journée et le compte à rebours ; barre, navigation et barre d'onglets du téléphone de la salle (U1).
2. **Onglets de vue** : Cumulé, un onglet par jeu, `ARCADE`, les jeux d'arcade ; **pastille de la couleur du jeu**, tirée de `etiquette.fond` de la fiche par `npm run fiches` (`.classement-vue--<id>` dans `jeux.generated.css`).
3. Sélecteurs **Tous · Amis · Mon groupe** et **‹ Veille · date · Lendemain ›** : ceux qui existaient, déplacés sous les onglets.
4. **Podium** dès 3 classés : 112 px, 92 px (téléphone 84 · 68), pastille moutarde de la place, marches d'encre. Au cumul, il faut que les trois aient tout fini.
5. **Liste** : photo de 48 px (44 sur téléphone), une colonne par jeu du jour et le cumul quand la colonne est assez large, ta ligne en moutarde.
6. **Groupes** : panneau à droite de la liste dès 1 100 px (sous elle en dessous), emblèmes carrés de 48 px, ton groupe en moutarde ; « Tous les groupes › » ouvre `?mode=groupes`, aux emblèmes carrés eux aussi.
7. **Feuille d'un joueur** : photo de 88 px (`taillePhoto` de `feuilleJoueur`, 44 par défaut : les classements des jeux ne changent pas).

## Partie 2 — sautée
La source 256 × 256 et le plafond de 40 Ko changent le serveur (« Avatars »), `avatarLogique.ts` et les textes du profil ; le prompt demande l'accord de Nathan et ne le note pas « validé ». **Rien n'est changé** (ni `apps/api`, ni le profil, ni leurs consignes) ; à 112 px, une photo de 128 px est agrandie, sans erreur.

## Écarts et décisions à relire
- **Emblème du groupe à côté du pseudo (22 px)** : **le serveur n'envoie pas le groupe d'une ligne de classement** (`GET /api/portail/classement`). Le client sait le dessiner (`LigneClassement.groupe`, optionnel) ; aucun emblème n'apparaît tant que le serveur ne le dit pas. Ajouter `groupe` aux lignes est un lot de serveur (zone `apps/api`) : à décider.
- **« Groupes de la semaine »** : le serveur ne rend que le classement **du jour** des groupes ; le panneau s'intitule « Groupes ». Même écart qu'au lot U1.
- **Couleur de Track** : la fiche donne `#1E1B19` (presque noir), pas l'orange de la maquette ; la pastille suit la fiche.
- **Cloche** : un lien (nouveautés, ou « Mes messages » quand seule une réponse attend), point terre lu dans la copie de l'accueil du navigateur — sans requête de plus. La feuille de l'accueil est un écran du menu à la manette : la reprendre ici est un petit lot.
- **Manette** : plus de flèche « ‹ » sur la page : B ne fait rien (comme sur l'accueil) ; LB / RB changent d'onglet de vue.
- **Langue** : le sélecteur est dans la barre (ordinateur) ou le profil (téléphone) ; la section « Langue » du bas de page est retirée.
- **Colonnes par jeu** seulement quand la colonne de la liste est assez large (requêtes de conteneur ; corrigé après un retour de Nathan sur tablette : le pseudo était écrasé) ; sur téléphone la ligne garde la place, la photo, le pseudo et le temps (la maquette aussi). La médaille de chaque jeu n'y est donc plus visible.
- **`?demo`** ouvre le joueur de démonstration, comme `?demo=joueur`.
- **Touche aux zones partagées** : `packages/core` (une ligne de teinte par jeu dans la feuille générée), `packages/ui` (tailles de photo, `avatar-grand.css`, `taillePhoto`), `scripts/budgets.mjs`.
- **Budget** : ligne nouvelle `portail.classement` (53 663 o mesurés, **plafond 57 Ko, à valider**) ; l'accueil grossit de ≈ 0,6 Ko (45 163 o, plafond 47 Ko inchangé). Détail : `budgets.md`.
- **Vérifié** : voir la PR. `towerImage.test.ts` est rouge hors zone (déjà rouge sur `main`, lot U1).
