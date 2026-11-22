# Lot PA2 — « Pile poil », le premier jeu Party (pilote du moule)

**Fait.** `npm run nouveau-jeu -- --id pilepoil --nom "Pile poil" --categorie party` (fiche `off`) ; maquette versée (`docs/pilepoil/maquettes/`).
- **Simulation** (`packages/pilepoil-sim`) reprise de la maquette : dix jauges, 120 pas/s, entiers, sinus en table, réglages = `DEFAUT` de la maquette dans un seul objet (`reglages.ts`). Les tests **lisent la maquette telle quelle** et comparent jauges, sinus, centre de la cible pas à pas, points et score (graine du 22/11/2026 → 1 167 points, 5 « pile »). Refus testés : appui pendant une pause, plus de dix appuis, pas qui recule ou répété, appui après la fin.
- **Écart voulu** : `attenteMax` = 1 800 pas (15 s) sans appui → jauge ratée (la maquette ne finissait jamais ; le kit et le rejeu ont besoin d'une fin). À valider par Nathan.
- **Serveur** : contrat Party, rejeu qui valide le score ; classement score ↓ puis « pile » ↓. **Mesures** : un rejeu ≈ 0,08 ms ; rediffusion de 34 caractères pour dix appuis (charge : 2 à 3 octets par pas).
- **Écran** : Canvas 2D de la maquette (lampes, jauge, cible et zone « pile », curseur interpolé, mot et points, éclats et secousse coupés en mouvement réduit), HUD en surimpression du kit (score, « n/10 », « PILE ×n »), vibration, bilan dans l'écran de fin. Scène et sons à la demande (`chargerPartie`).
- **Une commande** : toucher, Espace, Entrée, A de la manette. **`?debug&tune`** : curseurs de la maquette + `attenteMax`, export JSON ; partie jamais classée (`classable`).
- **Partie 2** : étiquette `#F6B3A4` / `#B8473A`, `illustration.svg`, textes fr + en, sons de synthèse par `ouvrirContexteAudio` (tic au rebond, un son par sorte, « pile » enchaîné +1 demi-ton).
- **Budgets** : `pilepoil.jsCss` 45 611 o (48 Ko), `pilepoil.demande` 30 101 o (34 Ko, nouvelle ligne, mesure + 10 %).

**Pas fait / bloqué (zones partagées, interdites à ce lot)**
- **Mentions légales** : les pages ne nomment pas `pilepoil:*`. La réplique et les trois lignes de « Comment jouer » gardent donc le préfixe « À remplacer » (les textes de la maquette sont derrière) : sans lui, `mentions.test.ts` échoue. Lot de plateforme, puis retirer le préfixe.
- **Illustration** : fichier livré, mais la fiche dit encore « à choisir » (voir moule, 2).

**Retours sur le moule (pour les jeux Party suivants)**
1. Le générateur n'ajoute pas les clés du jeu aux mentions : tout jeu qui écrit ses textes casse le test. Proposer que `nouveau-jeu` les écrive, ou une phrase générique « jeux du kit » dans les pages.
2. Contradiction : la fiche **impose** `identite.aujourdhui: false` à un jeu Party, `packages/core/test/identite.test.ts` le **refuse** hors liste d'exemptions dès que l'identité est complète. Correctif : y sauter `categorie === "party"`.
3. Le kit met « Recommencer » sur Entrée et B2. Ici Entrée est sur l'action du jeu (elle passe devant en partie), mais un réglage des touches enregistré est alors refusé au rechargement (une touche sur deux actions : `coherent`). Et une action n'a qu'une liaison de manette : « n'importe quel bouton de face » est impossible (A seul). Proposer `recommencer` sans touche pour un jeu à une commande, et plusieurs liaisons par action.
4. Le générateur copie au jeu les essais du témoin (`?debug&chargement|hud|bilan|dessins`) et trois specs du kit (chargement, surimpression, fin-et-aide) : retirés ici, ils tournent sur Cibles. `variante.ts` (score / temps) est inutile à un jeu Party au score : retiré aussi.
5. `jeu-surimpression__valeur` (papier, ombre d'encre) est illisible sur une scène claire : le jeu ajoute sa classe.
6. Le kit ne donne pas à `dessiner` l'avancement entre deux pas : la scène interpole avec sa propre horloge.
7. Copies : deux parties sans aucun appui ont les mêmes entrées : la seconde est refusée (`replay_copy`). Proposer d'admettre une partie vide.

**Vérifié** : unitaires du jeu, de la simulation et du serveur (SQLite) ; e2e Chromium du jeu ; typage ; budgets (`budgets-controle.mjs controler`) ; `npm run verifier` (résultat dans la PR). **Non vérifié** : téléphone réel (vibration, son), Firefox et WebKit hors déterminisme.

## Pour les joueurs
rien
