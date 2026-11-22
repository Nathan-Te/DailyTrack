# Lot PA2 — « Pile poil », le premier jeu Party (pilote du moule)

**Fait.** `npm run nouveau-jeu -- --id pilepoil --nom "Pile poil" --categorie party` (fiche `off`) ; maquette versée (`docs/pilepoil/maquettes/`).
- **Simulation** (`packages/pilepoil-sim`) reprise de la maquette : dix jauges, 120 pas/s, entiers, sinus en table, réglages = `DEFAUT` de la maquette dans un seul objet (`reglages.ts`). Les tests **lisent la maquette telle quelle** et comparent jauges, sinus, centre de la cible pas à pas, points et score (graine du 22/11/2026 → 1 167 points, 5 « pile »). Refus testés : appui pendant une pause, plus de dix appuis, pas qui recule ou répété, appui après la fin.
- **Écart voulu** : `attenteMax` = 1 800 pas (15 s) sans appui → jauge ratée (la maquette ne finissait jamais ; le kit et le rejeu ont besoin d'une fin). À valider par Nathan.
- **Serveur** : contrat Party, rejeu qui valide le score ; classement score ↓ puis « pile » ↓. **Mesures** : un rejeu ≈ 0,08 ms ; rediffusion de 34 caractères pour dix appuis (charge : 2 à 3 octets par pas).
- **Écran** : Canvas 2D de la maquette (lampes, jauge, cible et zone « pile », curseur interpolé, mot et points, éclats et secousse coupés en mouvement réduit), HUD en surimpression du kit (score, « n/10 », « PILE ×n »), vibration, bilan dans l'écran de fin. Scène et sons à la demande (`chargerPartie`).
- **Une commande** : toucher, Espace, Entrée, A de la manette. **`?debug&tune`** : curseurs de la maquette + `attenteMax`, export JSON ; partie jamais classée (`classable`).
- **Partie 2** : étiquette `#F6B3A4` / `#B8473A`, `illustration.svg` (déclarée dans la fiche), textes fr + en, sons de synthèse par `ouvrirContexteAudio` (tic au rebond, un son par sorte, « pile » enchaîné +1 demi-ton).
- **Budgets** : `pilepoil.jsCss` 45 611 o (48 Ko), `pilepoil.demande` 30 101 o (34 Ko, nouvelle ligne, mesure + 10 %).

**CI rouge, à cause de la plateforme (zones partagées, interdites à ce lot) — je m'arrête et propose**
- `packages/core/test/identite.test.ts` : la fiche **impose** `identite.aujourdhui: false` à un jeu Party, ce test le **refuse** hors liste d'exemptions dès que l'identité est complète. Correctif : y sauter `categorie === "party"`. (Laisser l'illustration « à choisir » fait à la place échouer l'axe du panneau `/admin/` : l'alerte « identité incomplète » d'une ligne `off` manque de contraste, `admin-panneau.spec.ts`.)
- **Deux jeux Party** (Pile poil + celui que génèrent « Kit de bout en bout » et « jeu fictif ») : le tour de rôle n'en classe qu'un par jour, or le test Party du modèle (`scripts/modele-party/apps/api/test/cibles.test.ts.modele`, « aperçu de PR ») et la base de référence (`apps/api/scripts/baseDeReference.ts`, `routesChaudes.test.ts` : un envoi refusé `not_party_of_the_day`, puis 31 instructions pour 30) supposent un seul jeu Party. Mon propre test a été rendu robuste (il cherche le jour de Pile poil).
- **Mentions légales** : les pages ne nomment pas `pilepoil:*` ; la réplique et les trois lignes de « Comment jouer » gardent donc le préfixe « À remplacer » (textes de la maquette derrière). Un lot de plateforme, puis retirer le préfixe.

**Retours sur le moule (pour les jeux Party suivants)**
1. Le générateur n'écrit pas les clés du jeu dans les mentions, et écrit dans le Dockerfile `COPY apps/<id>/public/jours` sans créer le dossier pour un jeu Party (image cassée : `public/jours/.gitkeep` ajouté ici).
2. Les deux points « CI rouge » ci-dessus (identité Party, plusieurs jeux Party).
3. Le kit met « Recommencer » sur Entrée et B2. Ici Entrée est sur l'action du jeu (elle passe devant en partie), mais un réglage des touches enregistré est alors refusé au rechargement (une touche sur deux actions : `coherent`). Une action n'a qu'une liaison de manette : « n'importe quel bouton de face » est impossible (A seul). Proposer `recommencer` sans touche pour un jeu à une commande, et plusieurs liaisons par action.
4. Le générateur copie les essais du témoin (`?debug&chargement|hud|bilan|dessins`) et trois specs du kit (chargement, surimpression, fin-et-aide) : retirés ici (ils tournent sur Cibles), comme `variante.ts`, inutile à un jeu Party au score.
5. `jeu-surimpression__valeur` (papier, ombre d'encre) est illisible sur une scène claire : le jeu ajoute sa classe. Le kit ne donne pas à `dessiner` l'avancement entre deux pas : la scène interpole avec sa propre horloge.
6. Copies : deux parties sans aucun appui ont les mêmes entrées, la seconde est refusée (`replay_copy`).

**Vérifié** : unitaires du jeu, de la simulation et du serveur (SQLite) ; e2e Chromium du jeu ; typage ; budgets (`budgets-controle.mjs controler`) ; `npm run verifier` (résultat dans la PR). **Non vérifié** : téléphone réel (vibration, son), Firefox et WebKit hors déterminisme.

## Pour les joueurs
rien
