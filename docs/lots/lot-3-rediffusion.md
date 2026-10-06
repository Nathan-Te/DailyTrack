# Lot 3 — La rediffusion et le fantôme

**Livré**
- **Enregistrement** (`packages/sim/src/replay.ts`) : une course = la suite des commandes appliquées, une par pas de simulation (`steer`, `throttle`, `brake`, `respawn`, en entiers). Stockées en séries (nombre de pas avec la même commande), encodées en octets puis en texte base64url : ~6 ko pour une course complète d'un pilote analogique, bien moins au clavier.
- **Rejeu exact** : `replayRace(circuit, rediffusion)` rejoue avec le même code que le jeu et renvoie ce que **la simulation** a recalculé (temps, intermédiaires, reprises, état final). C'est ce résultat, jamais un temps annoncé, qui fera foi pour le classement (lot 5).
- **Décodage prudent** : le texte vient du réseau, donc `decodeReplay` refuse tout ce qui est mal formé ou hors limites (caractères invalides, tronqué, commandes hors plage, série vide, plus de 10 min, identifiant de circuit invalide) ; `replayRace` refuse une autre version de la simulation ou un autre circuit.
- **Version de la simulation** (`SIM_VERSION`) : à incrémenter dès que la physique, un bloc ou le circuit change le résultat d'une course. Les rediffusions d'une autre version sont ignorées (pas de fantôme) ou refusées (serveur).
- **Fantôme** (`apps/web/src/session.ts`) : le meilleur temps est enregistré avec sa rediffusion dans le navigateur ; à la tentative suivante, il est rejoué en même temps que la course par la même simulation (voiture bleue translucide). **G** l'affiche/le masque, `?ghost=off` le désactive. Un ancien record sans rediffusion n'a simplement pas de fantôme.
- **Correction** : `makeInput` ne produit plus jamais `-0` (une commande enregistrée doit être identique une fois décodée).

**À tester** : fais un tour complet (le chrono s'enregistre comme meilleur temps), puis relance (**Entrée**) : une voiture bleue translucide refait ton tour pendant que tu roules. Essaie de la battre ; les écarts aux points de contrôle sont déjà affichés.

**Garde-fous**
- `golden.test.ts` : une rediffusion de référence (`packages/sim/test/fixtures/essai-autopilot.json`, une course complète du pilote de test) avec son résultat exact, **au bit près**. Si ce test casse, la physique a changé : incrémenter `SIM_VERSION` et régénérer (`UPDATE_GOLDEN=1 npx vitest run packages/sim/test/golden.test.ts`).
- `replay.test.ts` : aller-retour de l'encodage, rejeu identique à la course jouée (y compris les reprises), rejeu d'une rediffusion coupée ou falsifiée, rejets du décodeur.
- `apps/web/test/session.test.ts` : la session enregistre **exactement** les commandes appliquées (la rediffusion enregistrée est identique, octet pour octet, à celle qui a été jouée) ; le fantôme reproduit le meilleur temps à la milliseconde.
- **Test Node ↔ navigateur** (`apps/web/e2e/`, Playwright) : la page `verify.html` (sans rendu 3D) rejoue la rediffusion de référence et doit retrouver exactement les mêmes nombres que Node. Lancé en local sur Chromium (`npm run test:e2e`, avec `CHROMIUM_PATH` si besoin) ; **la CI le lance aussi dans Firefox et WebKit** (`E2E_ALL_BROWSERS=1`), ce qui est le vrai test de déterminisme entre moteurs JavaScript. Le rendu du fantôme et l'enregistrement du record sont vérifiés dans Chromium.

**Limites**
- Un seul fantôme (ton meilleur temps) ; celui du premier et du joueur juste devant viendront avec le serveur (lot 5).
- Le record est stocké dans le navigateur (`localStorage`) : changer de navigateur, c'est repartir de zéro.
- Les commandes sont échantillonnées une fois par image du navigateur et appliquées à tous les pas de cette image : une rediffusion reflète donc ce qui a réellement été appliqué, mais un joueur à 30 images/s a des commandes moins fines qu'à 144.
