# Lot I4 (plateforme, phase 3) — Track : nouvelle interface et anglais

Aucun changement de `packages/sim`, `packages/core`, `packages/clock`, de la physique, du générateur, d'un classement, d'une rediffusion ni du Salon (règles) : **golden des deux jeux inchangés**. Le rendu 3D, les voitures, les effets et les sons ne changent pas. **Aucune dépendance npm ajoutée** (le verrou ne gagne qu'une ligne : `@cdj/ui` déclaré dans `apps/web/package.json`, un espace de travail déjà là). Vision : `docs/plateforme/seed-phase-3.md` ; charte : `docs/plateforme/identite.md` (**révision 5**, placée par ce lot) ; consignes : `apps/web/CLAUDE.md` (« Interface Du Jour (lot I4) »).

## 0. Préalables
- **Charte révision 5** : `docs/plateforme/identite.md` remplacée par le fichier joint (surimpressions de course de Track, § 9). **Sept maquettes** placées dans `docs/plateforme/maquettes/cartouches/` : `track-hud.html`, `track-hud-paysage.html`, `track-arrivee.html`, `track-pause.html`, `track-classement.html`, `track-salon.html`, `track-reglages.html` (références : jamais construites ni servies ; la charte prime en cas d'écart).
- **`jeuSuivant.ts` remonté dans `@cdj/profile`** : la logique pure (`suiteDuJour`) et la lecture (`lireSuite`, une requête vers `GET /api/portail/jour`) sont dans `packages/profile/src/jeuSuivant.ts` ; **tests déplacés sans changement** dans `packages/profile/test/jeuSuivant.test.ts` (les deux séries — Track puis Jump — dans un seul fichier, une boucle par jeu) ; les deux jeux importent depuis `@cdj/profile`. Le DOM (le bouton, « Journée parfaite ! ») reste dans chaque jeu : Track le compose avec le socle (`apps/web/src/jeuSuivant.ts`), Jump garde le sien jusqu'au lot I5. Aucun DOM dans le module (test `purete.test.ts`).
- **Nom anglais du Salon : “Room”** (décision de Nathan) : dans les codes d'erreur du Salon du catalogue commun (« Invalid Room session. »…) et dans tout le catalogue de Track. Test : `apps/web/test/catalogue.test.ts` (aucun « Lounge » nulle part).

## 1. Inventaire des écrans et des surimpressions
| Écran / surimpression | Avant (lots 29 à 31) | Après (lot I4) | Fichiers |
|---|---|---|---|
| **Accueil** `#home` | panneau bleu nuit translucide, titre « Circuit du Jour », cartes, carte du profil | cadre crème de Du Jour (`barreJeu` : « ‹ DU JOUR », date, n° du circuit) + étiquette Track : « TRACK », « Circuit du jour · Canyon », aperçu du tracé (miniature du lot 13), meilleur temps en grand et « 14e sur 212 », quatre médailles en cases, fantôme à battre, **« Courir »** (principal Track), « Revoir le meilleur tour », Salon (“Room”), archives, réglages, aide, « Mon profil Du Jour › » | `homeUi.ts`, `homeLogic.ts`, `accueil.css` |
| **Classement du jour** | 10 lignes dans la carte de l'accueil, coin de la course | page `#board-screen` (maquette `track-classement.html`, ta ligne en moutarde, médaille en pastille et en toutes lettres), cinq lignes à l'accueil, coin compact de la course | `boardScreen.ts`, `boardView.ts`, `boardPanel.ts` |
| **Archives** `#archive` | fenêtre translucide | cadre « ‹ TRACK » : dé, thèmes, jours avec miniatures (inchangées), seuils, « Revoir le meilleur tour » | `archive.ts`, `archiveExtras.ts` |
| **Réglages** `#settings` | fenêtre à onglets (Graphismes, Son, Jeu, Commandes, **Profil**) | cadre « ‹ TRACK » (maquette `track-reglages.html`), mêmes onglets **sans Profil**, curseurs et choix de la charte, **langue** (`choixLangue`), liens « Mon profil Du Jour › » et « Mentions légales » | `settingsUi.ts`, `settings.ts`, `reglages.css` |
| **Aide** `#howto` | fenêtre | cadre « ‹ TRACK », conseils en cartes, schéma des zones tactiles, touches en `kbd` | `howto.ts`, `howtoUi.ts` |
| **Profil** | carte (accueil) et onglet (Réglages) : pseudo, statistiques, copier / charger un code | **supprimé** : lien vers le profil commun du portail `/profil/?retour=<chemin du jeu>` (le profil y met « ‹ TRACK ») | `profilLien.ts`, `apps/portail/src/{profil,retour}.ts` |
| **Pause** `#pause` | fenêtre translucide, bouton ⏸ dans une barre de quatre boutons | dialogue asphalte sur un voile à rayures (maquette `track-pause.html`) : Reprendre, Recommencer, Dernier point de contrôle, Fantôme, Son, Réglages, Comment jouer, Archives, Accueil de Track, « ‹ DU JOUR », Mentions | `index.html`, `arrivee.css` |
| **Arrivée** `#finish` | panneau translucide au milieu de la scène | cadre crème pleine page (maquette `track-arrivee.html`) : « ARRIVÉE », temps en grand, badge de record et écart, autocollant de médaille, rang et « +9 places », envoi et pseudo, ligne à partager, « Recourir » / « Revoir le tour » / « Partager mon temps » / « Accueil de Track », puis sous l'étiquette « Il te reste aujourd'hui » et **« Jeu suivant du jour : Jump › »** (`bouton({ href })`) | `arriveeUi.ts`, `arrivee.css`, `jeuSuivant.ts` |
| **Salon, finale, podium, arrivée de session** | panneaux translucides, compte à rebours dans `#medals` | HUD de course dans la plaque `#medals` (compte à rebours), finale `#finale` en plaque nette, classement de la session, podium et arrivée en cadre ; **« Room »** en anglais | `salonUi.ts`, `salonArrivee.ts`, `salonMode.ts`, `salon.css` |
| **Revoir le meilleur tour** | barre de lecture translucide | plaque asphalte, boutons de 44 px, icônes SVG, textes traduits | `watchUi.ts`, `watch.ts` |
| **Commandes tactiles** | boutons translucides, barre d'actions avec émojis | **même disposition et même comportement** (zones de `touch.ts` inchangées) ; plaques asphalte, « GAZ » en livrée, icônes SVG | `touchUi.ts`, `tactile.css` |
| **HUD** (chrono, point de contrôle, objectif, annonces, vitesse, effets, titre) | texte blanc sur le décor, bandeau de médailles, liste de tous les points de contrôle | **variante A « Plaques en haut »** : voir § 2 | `index.html`, `hud.css`, `main.ts` |
| **Outils internes** | `?debug&tune`, administration et planning (lot 14) | **inchangés** (français), exemptés du test des chaînes en dur ; seul l'habillage du panneau de réglage suit les jetons | voir § 6 |
Chaînes : **450 clés** par langue (base 26, accueil 61 + classement, course et pause et arrivée 129, réglages 152, Salon 82), dont les pluriels ; plus le catalogue commun du socle (composants, erreurs du serveur).

## 2. Les surimpressions de course (variante A « Plaques en haut »)
⟦à compléter : décisions de mise en page, captures, performance⟧

## 3. L'anglais
⟦à compléter⟧

## 4. Construction, poids et polices
⟦à compléter⟧

## 5. Garder ce qui marche
⟦à compléter⟧

## 6. Exemptions du test des chaînes en dur
⟦à compléter⟧

## 7. Captures
⟦à compléter⟧

## 8. Écarts à la charte proposés
⟦à compléter⟧

## 9. Vérifié / non vérifié
⟦à compléter⟧

## 10. Pour le lot I5 (Jump)
⟦à compléter⟧
