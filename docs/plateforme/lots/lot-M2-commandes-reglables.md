# Lot M2 — Les commandes réglables, par jeu

Charte rév. 14, § 10 ; maquette `manette-et-commandes.html` (planches 2 et 3). Lot de la plateforme (touche Track, Jump, le socle et les budgets). Tower : la règle seulement (pas de Réglages).

## Ce qui est livré
- **`@cdj/ui`** : `commandes.ts` (premier chargement : lire les touches, `cdj:commandes:<jeu>`, noms selon la disposition du clavier, paramètres des aides), `commandesEdition.ts` + `commandesEcran.ts` + `commandes.css` + `catalogue.commandes.ts` (**à la demande** : échange, touches fixes, « Rétablir », l'écran Clavier · Manette · Tactile).
- **Track et Jump** : un `commandes.ts` déclare les actions ; `input.ts` / `main.ts` lisent les touches par `commandes`, jamais en dur ; Réglages › Commandes charge l'écran du socle ; l'onglet Tactile reprend les réglages tactiles existants (ouvert par défaut sur un appareil tactile).
- **Aides en paramètres** (`{sauter}`, `{m_sauter}`) : « Comment jouer », Réglages, ligne `#astuces` / `course.aide.puce`, indices de l'arrivée et du Salon, aides des réglages (son, caméra, classement). Un changement de touche redessine les textes liés.

## Les actions et leurs touches d'origine
| Jeu | Action | Clavier | Manette |
|---|---|---|---|
| Jump | `gauche` / `droite` | ← A / → D | stick, croix (fixes) |
| Jump | `sauter` | Espace ↑ W | A |
| Jump | `reprendre` · `recommencer` | R · Entrée | Y · X |
| Jump | `pause` · `fantome` | P · G | Start (fixe) |
| Track | `gauche` / `droite` | ← A / → D | stick, croix (fixes) |
| Track | `accelerer` · `freiner` | ↑ W · ↓ S Espace | RT · LT |
| Track | `point` · `recommencer` · `camera` | R · Entrée · C | Y · X · Vue |
| Track | `pause` · `classement` · `fantome` · `son` | P · L · G · M | Start (fixe) |

**Fixes** : Échap (clavier), Start (manette), stick et croix (courir / tourner) ; B reste « retour » dans les menus mais peut servir en partie. Hors réglage : N, T, H, Tab (Salon), Espace et flèches du spectateur.

## Stockage
`localStorage`, une clé par jeu : `cdj:commandes:track`, `cdj:commandes:jump` = `{ v: 1, clavier: { action: [codes] }, manette: { action: "b0" | "a0-" | null } }`, sous `try/catch`. Absent, abîmé, d'un autre format ou incohérent (une touche sur deux actions, une action sans touche, Start pris) : touches d'origine, sans erreur. Réglage gardé de l'appareil (pas encore dans le profil commun : hors périmètre).

## Les rediffusions ne changent pas
La correspondance touche → action est avant les bits (Jump) et `makeInput` (Track). Preuves : `apps/jump/test/commandes.test.ts` (même scénario d'intentions joué avec d'autres touches : **mêmes bits, même `encodeReplay`, même état de session**) et `apps/web/test/commandes.test.ts` (mêmes axes, mêmes `CarInput`). Aucun golden touché, aucune version montée.

## Décisions à confirmer par Nathan
1. **B ne saute plus par défaut (Jump)** et **A / B ne conduisent plus (Track : RT accélère, LT freine seuls)** : une action n'a qu'un bouton (« un bouton ou un axe par action »). On les remet dans Réglages › Commandes › Manette. Garder A **et** B par défaut demanderait deux liaisons par action.
2. **« Recommencer » dans `bandeau.aide` (Jump)** : le texte disait « R » (l'ancienne touche de recommencement, avant le lot 27) ; il cite maintenant l'action `recommencer` (Entrée).
3. **Budget** : Track **+2 190 o** mesurés contre `main` (293 473 → 295 663), plafond `track.jsCss` relevé de **1 024 o** (la limite du lot : marge 73 o) ; `track.js` et `track.horsThree` de même. **Jump +2 350 o** (375 291), sous son plafond, **à condition d'exclure l'écran à la demande de `mesureJump`** (`commandesEcran-*`, `commandes-*.css`, comme `manette-`) : sans cela +7,2 ko. **Tower inchangé** (167 998 o, plafond 168 000). Ce qui a coûté : la logique de lecture (1,8 ko), les actions et l'aide en paramètres ; ce qui a été sorti du premier chargement : l'édition, l'écran, ses catalogues et les noms des actions de Track, et l'import de `manetteLogique` (≈ 1 ko, ramené par une constante).
4. **Tower** : pas de Réglages, donc pas d'écran ; la règle est dans `docs/tower/consignes.md` (le lot qui lui donnera des Réglages déclare ses quatre actions).

## Vérifié / non vérifié
- **Vérifié en local** : `npx tsc -b` ; Vitest `packages/ui`, `apps/web`, `apps/jump` (parité FR / EN, clés lues, `npm run traductions`, budgets du portail) ; e2e Jump `smoke.spec.ts` « Réglages › Commandes : Sauter sur Z, puis Z saute en partie » (**le seul test navigateur du lot**, règle R13) ; captures Chromium (`CAPTURES=1`).
- **Tests unitaires** : échange en cas de conflit, touches fixes refusées, stockage absent / abîmé / incohérent, nom des touches selon la disposition (AZERTY : KeyW → Z), même rediffusion avec des touches changées (`packages/ui/test/commandes.test.ts`, `apps/jump/test`, `apps/web/test`).
- **Non vérifié** : une vraie manette (le moteur est testé sur des manettes fictives : la capture d'un bouton lit `navigator.getGamepads` en boucle, essayée seulement par le code) ; WebKit et Firefox sur l'écran ; la carte du clavier sur Safari / Firefox (repli sur la table : « W » au lieu de « Z » sur un AZERTY) ; iPhone en mode application.
- **CI** : voir la PR (run de la dernière poussée).

## Captures (`docs/plateforme/lots/img/`)
`lot-M2-jump-clavier.png`, `lot-M2-jump-manette.png`, `lot-M2-track-clavier.png`, `lot-M2-track-manette.png` (Chromium, ordinateur 1100 × 760, français ; Sauter / Accélérer mis sur Z).

## Scénario de test pour Nathan (aperçu de la PR, 2 clics)
1. Jump › Réglages › Commandes › Clavier : Sauter sur Z. En partie Z saute ; « Comment jouer » dit « Z ».
2. Onglet Manette : Sauter sur B. En partie B saute ; dans un menu B revient en arrière. Même chose dans Track (Accélérer).
