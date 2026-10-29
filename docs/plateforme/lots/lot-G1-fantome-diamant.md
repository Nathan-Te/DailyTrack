# Lot G1 (plateforme) — le bouton fantôme en vue, et des médailles plus accessibles

Branche `ccr-1979a954-nmkwuq`, PR brouillon. Charte `docs/plateforme/identite.md`, **révision 12** (§ 9). Consignes : `apps/web/CLAUDE.md` (« Bouton fantôme (lot G1) »), `apps/jump/CLAUDE.md` (« Plateforme (lot G1) »), `packages/ui/CLAUDE.md`, `packages/sim/CLAUDE.md` et `packages/jump-sim/CLAUDE.md` (médailles).

Le nom du fichier garde « fantôme Diamant » : c'était le sujet d'origine du lot. **Le fantôme Diamant a été retiré** (demande de Nathan du 29/10 : « ça n'est pas accurate, on fait simple ») : ni course du pilote rejouée (Track), ni trajectoire de l'auteur (Jump), ni route `GET /api/jump/fantome-diamant`, ni code `ghost_locked`, ni ligne « débloqué / verrouillé ». Ce qui reste : le bouton fantôme en vue et les médailles.

## 1. Le bouton fantôme en vue (révision 12)
Icône `fantome` au trait dans le socle (`iconeFantome`, `boutonFantome`), 44 px, nom lu « Fantôme : {nom} » / “Ghost: {name}” mis à jour à chaque appui et au changement de langue.
- **Jump** : en haut à gauche, juste après le plein écran (`#ghostbtn`) — `img/lot-G1-jump-hud-{fr,en}.png`. Cycle : le tien → le premier → aucun (le premier est sauté s'il n'existe pas ou si c'est toi). Mémorisé sous `jump:fantome` (aucune clé nouvelle : `1`, `0`, `premier` ; une autre valeur redevient « le tien »).
- **Track** : dans le groupe de droite, devant l'objectif de médaille (`#btn-ghost`) ; à 740 × 360 la caméra et le fantôme sont côte à côte — `img/lot-G1-track-hud-paysage-{fr,en}.png` (844 × 390), `img/lot-G1-track-hud-compact-{fr,en}.png` (740 × 360), accueil `img/lot-G1-track-accueil-{fr,en}.png`. Cycle : ton record → le premier → le joueur devant → aucun.
- Même cycle pour la touche **G**, le bouton, l'entrée de la pause et la ligne de l'accueil (`#home-ghost`, un toucher change le fantôme). Caché en petit portrait (comme le plein écran) et, pour Track, en spectateur. Centre libre, bande du haut inchangée. Un fantôme ne touche jamais la simulation.

## 2. Médailles assouplies, sans date (demandes de Nathan des 28 et 29/10)
- **Track** : le Diamant passe de 0,84 à **0,92 × le temps du pilote** ; or, argent et bronze gardent leurs écarts (×1,045, ×1,07, ×1,13 du Diamant) : or 0,961, argent 0,984, bronze 1,040 (rouler comme le pilote rapporte le bronze). **Liées à la version du générateur, v19** (`GENERATOR_MEDAILLES_G1` ; mêmes circuits que la v18, seuls l'identifiant `-g19` et les médailles changent : golden comparé, identifiants seulement).
- **Jump** : le Diamant à **105 %** du temps de l'auteur (la preuve, que personne ne bat), or 115 %, argent 137 %, bronze 170 % (avant : 100, 110, 130, 160). **Liées à la version des niveaux, v12** (`MEDAILLES_ASSOUPLIES_VERSION`, celle du lot 28, pas encore servie) ; golden v12 : **les médailles seulement** changent (niveau, preuve et empreinte identiques) ; v3 à v11 intacts.
- **Aucune date dans le code** : à la mise en production, le registre des jours de Track et les niveaux figés de Jump gardent les médailles des jours servis ; **le lendemain** (jour de bascule) et les suivants prennent les nouvelles, tout seuls — comme les circuits et les niveaux. Recalibrer plus tard = de nouveaux facteurs pour une nouvelle version, jamais une date.
- **À savoir** : la médiane des meilleurs temps de Track du 22/10 était à 0,90 du pilote : à 0,92 le Diamant devient courant (cible du lot 35 : 5–10 %) et débloque plus vite les voitures du Garage. Les pourcentages de Jump sont choisis sans données de joueurs. Deux constantes à ajuster (`MEDAL_FACTORS_G1`, `MEDAL_PERCENT_G1`).

## 3. Nouvelle version d'un générateur : les jours J+1 suivent seuls (question de Nathan)
Rien de nouveau à construire : c'est le mécanisme des lots R6, R11 et R12, que les médailles suivent depuis ce lot.
- **Track** : un lot qui change le générateur monte `GENERATOR_VERSION` (ici 19). Au clic sur « Mettre en production », le job `figer` écrit dans `packages/sim/src/jours-track.json`, avec le code en production, la version des **jours protégés** (avant le lancement, déjà figés, ou avec au moins un résultat). Tout jour que le registre ne nomme pas — le jour de bascule (le premier jour de Paris après le déploiement, J+1) et les suivants, et un jour sans aucun résultat — prend la dernière version : nouveau circuit, nouvelles médailles.
- **Jump** : même chose avec les fichiers figés (`apps/jump/public/levels/`) : les jours protégés sont figés avec le code en production (niveau, preuve, médailles) ; les autres sont régénérés par le nouveau code.
- Le garde-fou compare chaque jour protégé entre le code en production et la nouvelle construction ; la moindre différence arrête la mise en production.

## 4. Budgets (`docs/plateforme/budgets.md`, « Lot G1 »)
| | avant (`main`, lot 53 compris) | après | plafond |
|---|---|---|---|
| Track JS + CSS | 293 581 | 294 001 | 294 000 → **294 512** (+512, sur les 2 048 autorisés) |
| Track JS / hors three.js | 281 823 / 148 166 | 282 186 / 148 529 | 282 200 → **282 712** / 148 500 → **149 012** |
| Track anglais · fil des circuits | 7 935 · 29 422 | 7 939 · 29 452 | 8 000 · 30 000 (inchangés) |
| Jump JS + CSS | 371 110 (lot 28 compris) | 371 820 | 378 490 (inchangé) |
| Portail, premier chargement | 32 210 | 32 225 | 32 768 (inchangé) |

## 5. Vérifié / non vérifié
**Vérifié** : typecheck ; tests unitaires (cycle et mémorisation du fantôme de Jump, médailles par version des deux jeux, golden, codes d'erreur) ; `npm run verifier` et la CI de la PR (voir la PR) ; e2e étendus, **aucun spec nouveau** : `plein-ecran`, `hud-compact`, `mobile` (Track) ; `plein-ecran`, `hud-compact`, `carnage` (Jump) — bouton visible, 44 px, sans chevauchement, hors zone centrale à 844 × 390 et 740 × 360, chaque appui passe au suivant, la touche G et la pause font de même.
**Non vérifié** : le rendu sur un téléphone réel ; la répartition réelle des nouvelles médailles (aucun export de joueurs).

## 6. Décisions laissées à Nathan
1. Modification de `docs/plateforme/identite.md` (révision 12 et § 9, ligne fournie par la demande) ; à relire.
2. Les facteurs des médailles (`MEDAL_FACTORS_G1`, `MEDAL_PERCENT_G1`), à revoir avec les premiers résultats des joueurs.

## 7. Tickets à ouvrir
- Mémoriser le choix de fantôme de Track entre deux pages (aujourd'hui : la page).
- Un lecteur de rediffusion pour Jump (aujourd'hui « Revoir » n'existe que pour Track).

## Pour les joueurs
- [Track] Le bouton fantôme est en vue pendant la course : un appui passe au fantôme suivant. // The ghost button is on screen during the race: one tap switches to the next ghost.
- [Jump] Le bouton fantôme est en vue pendant le niveau : un appui passe au fantôme suivant. // The ghost button is on screen during the level: one tap switches to the next ghost.
- [Track] Les médailles sont plus faciles à décrocher sur les nouveaux circuits. // Medals are easier to earn on new circuits.
- [Jump] Les médailles sont plus faciles à décrocher sur les nouveaux niveaux. // Medals are easier to earn on new levels.
