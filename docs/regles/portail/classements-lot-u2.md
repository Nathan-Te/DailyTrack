# Classements : le podium et les photos (lot U2)

README : `docs/plateforme/lots/lot-U2-classements.md` ; charte : `docs/plateforme/identite.md` § 9 (révision 19) ; maquette `docs/plateforme/maquettes/portail-classements-amis.html` (écran « Classements »).

## La page `/classement/`
- **Fichiers** : `src/classement.ts` (l'assemblage : `rendre()`), `src/classementPodium.ts` (logique **pure** : qui monte sur le podium, tailles, colonnes), `src/classementSalle.ts` (pièces de présentation : `frontonDePage`, `clocheLien`, `podium`), `src/classementSalle.css` (la feuille, importée **après** `salle.css`), `src/classementGroupes.ts` (le panneau et la vue des groupes, à la demande). La page prend la barre, la navigation et la barre d'onglets du téléphone de la salle (`src/salle.ts`, lot U1) : `<main class="portail salle classement">`.
- **Ordre du DOM = ordre sur téléphone** : barre → fronton → filtres (onglets de vue, Joueurs · Groupes, sélecteur Tous · Amis · Mon groupe, ‹ Veille · date · Lendemain ›) → liste (`.classement-gauche`) → panneau des groupes (`.classement-droite`, à droite de la liste dès 760 px) → pied → barre d'onglets du bas.
- **Fronton** : « CLASSEMENTS » (moutarde, ombre terre), la date et « Journée n° N », le compte à rebours « Prochains niveaux dans » (`battre()`, horloge de l'appareil recalée sur Paris : la page ne reçoit pas l'heure du serveur ; à zéro et sur aujourd'hui, le classement est relu **une fois**, jamais en boucle).
- **Onglets de vue** : Cumulé, un onglet par jeu du jour, `ARCADE`, les jeux d'arcade. Chaque onglet porte la **pastille de la couleur de son jeu** : `.classement-vue--<id>` donne `--vue-teinte`, **écrit par `npm run fiches` dans `jeux.generated.css` depuis `etiquette.fond` de la fiche** (jamais une couleur écrite à la main ; Cumulé : moutarde). Le nom est toujours écrit. Les repères des tests (`#vue-<vue>`, `data-cle="vue-<vue>"`, `role="tab"`) n'ont pas changé.
- **Le cumul** ne montre que les jeux au temps du jour (`jeuxDuCumul` : ni un jeu à la hauteur ou aux points, ni un jeu d'arcade).

## Les photos (charte § 9)
| où | taille |
|---|---|
| 1er du podium · 2e et 3e | 112 px · 92 px (téléphone : 84 · 68) |
| ligne de classement | 48 px (téléphone : 44) |
| emblème d'un groupe à côté d'un pseudo · dans le panneau des groupes | 22 px · 48 px (carré, jamais rond) |
| photo en tête de la feuille d'un joueur | 88 px (`taillePhoto: 88` de `feuilleJoueur` ; les classements des jeux gardent 44) |
- **Toujours ronde** pour un joueur, **toujours carrée** pour un groupe ; contour encre de 3 px dès 48 px. `avatar({ taille })` accepte 24 · 32 · 44 · 48 · 52 · 68 · 84 · 88 · 92 · 96 · 112 · 128 ; **les tailles de 48 px et plus sont dans `avatar-grand.css`**, que l'accueil ne paie pas (il importe `avatar-liste.css` seulement). L'emblème est `emblemeDeGroupe({ taille: 22 | 48 | 52 | 72 })` de `salle.ts`.
- La source d'une photo envoyée reste de 128 × 128 (partie 2 du lot **non faite**, en attente de l'accord de Nathan : voir le README) : à 112 px elle est agrandie, sans erreur.

## Le podium
- **Quand** : `lignesDuPodium` — au moins 3 classés ; au cumul, les trois premiers doivent avoir tout fini (sinon ils sont sous « Un jeu sur deux » et il n'y a pas de podium). Le podium montre le haut de `top` tel que le serveur le rend : il ne change aucun rang ; la liste garde le reste (`resteDuHaut`), ta ligne hors du haut reste à part, en moutarde, à sa vraie place.
- **Forme** : `<ol class="classement-podium">` de trois `li.classement-ligne.classement-place` **dans l'ordre du classement** (1er, 2e, 3e : l'ordre des lecteurs d'écran) que la feuille range en 2e · 1er · 3e (`order`). Chaque place : la photo, la pastille moutarde de la place (`.classement-badge`, ronde, 34 px, en bas à droite), le pseudo, le temps, la marche d'encre (100 / 70 / 48 px ; 76 / 54 / 38 sur téléphone, `aria-hidden`). Une place est un bouton (la feuille du joueur) sauf la tienne ; mêmes repères qu'une ligne : `data-rang`, `data-moi`, `.classement-pseudo`, `.classement-rang`, `.classement-temps`, `.classement-toi`.
- **L'emblème du groupe (22 px)** à côté du pseudo n'est dessiné que si la ligne porte `groupe` (`LigneClassement.groupe`, `groupeDeLigne`) : **le serveur ne l'envoie pas encore** — décision laissée à Nathan (README), rien n'est inventé.

## La liste
- Une ligne = `li.classement-ligne` > `.classement-ligne__corps` (un bouton, sauf la tienne) : la place, la photo, le pseudo (premier enfant : l'ordre du DOM sert aux tests) avec l'emblème et « Toi », une colonne par jeu du jour (**ordinateur seulement** : `data-jeux="N"` sur `#classement-liste` et `#classement-moi` règle les colonnes ; le nom du jeu est dans l'en-tête, il reste lu dans chaque case), le temps de la vue. Sur téléphone : place, photo, pseudo, temps.
- Les amis qui n'ont rien fini : `ligneAbsente`, avec leurs initiales (le serveur ne dit pas leur image).

## Les groupes
- **Panneau** (`monterPanneau`, titre « Groupes ») : les trois premiers groupes de la vue, emblème de 48 px, ton groupe en moutarde, « Tous les groupes › » qui ouvre la vue complète (`?mode=groupes`, `monterGroupes`, emblèmes carrés de 48 px aussi). Les deux partagent **une seule lecture gardée 30 s** (`lire`) : le panneau ne coûte aucune requête de plus quand on passe de l'un à l'autre. Le serveur ne rend que le classement **du jour** des groupes (pas de la semaine) : le titre ne dit donc pas « de la semaine ».

## La cloche et la manette
- La cloche de la barre est **un lien** (`clocheLien` : `../nouveautes/`, ou `../messages/` quand seule une réponse attend), avec le point terre lu dans la **copie de l'accueil** gardée dans le navigateur (`jourGarde`) : aucune requête de plus, et pas de feuille (celle de l'accueil est un écran du menu à la manette).
- Plus de flèche « ‹ » sur cette page : **B ne fait rien** (comme sur l'accueil) ; LB / RB changent d'onglet de vue (inchangé : les onglets `role="tab"` passent avant la navigation).

## Budget
`portail.classement` (ligne nouvelle de `docs/plateforme/budgets.md`, mesurée par `mesurePortail` : HTML, JS et feuilles du premier chargement de `/classement/`). Les amis, les groupes et la feuille d'un joueur restent à la demande.

## Tests
`test/classementPodium.test.ts` (pur), `classementVues.test.ts`, `classementAmis.test.ts`, `catalogue.test.ts`, `manette.test.ts`, `construction.test.ts`, `budgets.test.ts` ; e2e existants (`amis`, `groupes`, `avatars`, `portail-journee`, `accessibilite`) : aucune nouvelle spec.
