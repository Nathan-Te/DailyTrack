# Lot U3 — Amis et groupes, puis Profil

*7 novembre 2026. Plateforme (portail). Maquette : `docs/plateforme/maquettes/portail-classements-amis.html`. Charte : révision 19, § 9. Règles : `docs/regles/portail/amis-groupes-et-profil-lot-u3.md`.*

**Où j'en suis : les deux parties sont faites.** Reste à Nathan : juger l'aperçu (`/amis/?demo`, `/profil/?demo`) et trancher les écarts.

## Pour les joueurs
- [Du Jour] Amis et groupes et ton profil, refaits avec de grandes photos. // Friends & groups and your profile, redone with big profile pictures.

## Partie 1 — `/amis/` « Amis et groupes »
1. Fronton « AMIS ET GROUPES » (barre, navigation, compte à rebours, barre d'onglets du téléphone de la salle).
2. **Ajouter par pseudo** et « Inviter un ami (lien) » en haut (le parcours du lot F2, remonté).
3. **Mes amis en cartes** : photo de 88 px (76 sur téléphone), pastilles T / J, pseudo, état (ruban « Journée parfaite », « Track il y a 12 min », « Pas encore joué »), « Voir le profil » ; 3 cartes par ligne, 2 sur téléphone.
4. **Mon groupe** : emblème de 72 px, nom, membres, rang, **chaque membre en photo de 52 px avec sa journée**, « Copier le lien », « Classement » ; sans groupe : « Créer un groupe » et la phrase d'aide.

## Partie 2 — `/profil/`
5. En-tête : photo de 128 px + crayon moutarde (recadrage existant), pseudo, emblème et nom du groupe, nombre d'amis, « Changer de pseudo ».
6. Tous les jeux : série (tuile d'encre), journées parfaites, médailles de tous les jeux en cases pleines.
7. Par jeu : cartouches, jeux du jour puis arcade ; colonne de droite : Messages, Code de transfert, Langue, Mon groupe (la gestion du chef y reste).

## Écarts et décisions à relire
- **Aucune route de serveur touchée.** Les cartes viennent du classement « Amis » et « Mon groupe » du jour (jeux faits, parfaite, rang) ; le « il y a 12 min » vient de `GET /api/portail/jour`, qui ne détaille que **6 amis** : les autres montrent « n jeux sur m aujourd'hui ». Une cinquième lecture (`/api/groupes/moi`) ; les cinq partent ensemble. **À décider** : un champ « dernier jeu » pour tous les amis serait un lot de serveur.
- **« Rang de la semaine » d'un groupe** : le serveur n'a que le rang **du jour** (comme aux lots U1 et U2) ; la page dit « 2e sur 5 groupes ».
- **« Meilleure série »** (maquette) : absente — `GET /api/portail/profil` ne la donne pas ; la tuile n'est pas inventée.
- **« Voir le profil » d'un ami** : la page de profil d'un ami **n'existe pas** (hors périmètre) ; le bouton ouvre la feuille d'un joueur du classement (photo de 88 px, rang du jour, « Retirer »).
- **Track et Jump** au profil gardent leurs étiquettes dessinées à la main (leur fiche dit `illustration: "propre"` : pas de fichier) ; les jeux à illustration (Tower, Blocks, Rush, Cibles) ont la cartouche horizontale. **Mon groupe** du profil garde toute la gestion (e2e `groupes.spec.ts`) : la colonne est longue pour un chef.
- Un groupe est **toujours carré** : l'ancien rond de 96 px de `groupeProfil.ts` devient un emblème de 72 px.
- **Corrigé au passage** : un lien d'invitation vide s'affichait avant d'être créé (`hidden` perdu face à `display: flex`) ; le texte de « Ton groupe » en moutarde du classement ne passait pas axe (lot U2, spec de régression).
- **Specs modifiées** (pas de nouvelle spec) : `amis` (cartes), `avatars` (le crayon), `portail-jour` (retour au portail, langue de la barre).
- **Budget** : `portail.premier` inchangé (45,0 Ko) ; `portail.classement` 54,5 Ko (+0,8 : le catalogue des pages est partagé), plafond 57 Ko. Aucun plafond ne bouge.
- **Vérifié** : voir la PR (tests unitaires, `amis`, `avatars`, `groupes`, `portail-jour`, `portail-journee`).
