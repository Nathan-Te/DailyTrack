# Crédits

- **Code, voiture, effets et sons** : écrits pour ce projet.
- **Sons** (lot 9) : **entièrement procéduraux** (Web Audio : oscillateurs et bruit blanc filtré, voir `apps/web/src/audio.ts` et `audioLogic.ts`). **Aucun fichier audio, aucun échantillon, aucune licence tierce.**
- **Sons de la planche sonore** (lot 55, `/track/vitrine/?planche=son`, recette et aperçus seulement — **pas dans le jeu**) : six boucles de moteur **CC0** de l'auteur « racing car engine sound loops » sur OpenGameArt (licence CC0, dérivées d'un enregistrement du domaine public) ; sources, empreintes et conversion : `apps/web/vitrine/son/LISEZMOI.md`. Les boucles de l'approche B sont rendues par du code du dépôt (`apps/web/outils/son/`).
- **Voiture** : modèle low-poly **original** construit en code (`apps/web/src/carMesh.ts`) ; aucun modèle ni forme de véhicule existant n'a été repris.
- **Bibliothèques** : [Three.js](https://threejs.org) (licence MIT), Vite, Vitest, Playwright (outils de développement).
- **Police** : celle du système (aucune police chargée).
