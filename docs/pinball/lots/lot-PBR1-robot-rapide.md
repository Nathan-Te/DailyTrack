# Lot PBR1 — Pinball : un robot des médailles 4,5 fois plus rapide

Branche `claude/pinball-robot-rapide-1`, PR brouillon, étiquette `jeu:pinball`. **Pour les joueurs : rien** (le jeu est `off`). Machine de mesure : 4 cœurs, Node 22, 4 fils ; 30 jours = du 02/11/2026 au 01/12/2026.

## Résultat
- **Le calcul des seuils d'une table (4 parties de 6 minutes) passe de 14,6 s à 3,3 s en moyenne, et de 18,4 s à 4,6–4,8 s au pire** (30 jours). Pas simulés pour décider : 14,3 M → 7,1 M en moyenne, 17,0 M → 8,6 M au pire.
- **Les médailles ne bougent pas : les 120 parties du robot des 30 jours ont exactement les mêmes scores** (et **les 500 tables que le générateur peut tirer : 2 000 parties sur 2 000 identiques** à celles d'avant). Diamant médian, répartition « partie / Diamant », mission : identiques. On n'a donc touché ni au nombre ni à la durée des parties.
- `PINBALL_SIM_VERSION` inchangée (golden, rediffusion et serveur identiques). **`PINBALL_BOT_VERSION` ne monte pas** (voir « Décisions »).

## 1. Le profil d'une table (`npm run profil-robot:pinball -w @cdj/pinball-sim`, 8 tables, 32 parties)
Avant le lot : 120,8 M de pas simulés pour décider contre 6,5 M de pas de vraie partie (18,6 par pas joué), 133 s de calcul.

| Où va le temps (avant → après) | avant | après |
|---|---|---|
| **la simulation de la partie elle-même** | **4,8 %** | 9,7 % (0,96 → 0,55 µs le pas) |
| recherches du robot, en tout | **95,2 %** | 90,3 % |
| · bille jouée d'avance (quand arrive-t-elle ?) | 4,6 % | 8,4 % |
| · copies de départ des essais | 3,0 % | 5,7 % |
| · « ne rien frapper » | 2,1 % | 3,9 % |
| · frappes, situation **batteur** (une bille, plateau) | 45,1 % | 34,5 % |
| · frappes, situation **multibille** | 33,8 % | 30,5 % |
| · frappes, situation **rail** | 2,8 % | 4,6 % |
| · frappes, situation **porte** ouverte | 3,7 % | 2,8 % |
| temps total des 8 tables | 133 s | 39 s |

Les pas, par situation (avant) : batteur 66 %, multibille 22 %, porte 6 %, rail 6 % ; par étape : essais de frappe 91 %, bille jouée d'avance 4,6 %, copies 2,8 %, « rien » 2,1 %. Le temps des essais est rangé selon la situation qui domine chaque essai (une multibille coûte plus par pas : 34 % du temps pour 22 % des pas). Ce que le profil dit : 76 % des pas sont des essais qui finissent à l'horizon de 360 pas (la bille est encore en jeu) ; 44 % des essais ont la même note que « ne rien frapper » mais **seuls 8,5 % des pas sont des essais sans aucun contact avec un batteur** (pas de convergence à exploiter) ; 96 % des décisions donnent un coup (rien à « garder ») ; en multibille on ne cherche déjà que pour la bille la plus menacée.

## 2. Ce qui a été fait, sans changer un score (temps moyen / pire sur 30 jours, chaque étape mesurée sur les 120 parties, scores comparés à ceux d'avant)
| étape | moyen | pire |
|---|---|---|
| départ | 14,6 s | 18,4 s |
| **recherche grossier puis fin** (exacte, voir ci-dessous) : la moitié des essais | 7,8 | 9,6 |
| **grille des murs** : la bille n'essaie que les murs de sa case | 5,1 | 6,8 |
| écritures inutiles évitées, poteaux par bande de y | 4,7 | 6,3 |
| **atelier** : parties d'essai réutilisées (`Partie.recopier`), plus d'allocation par essai | 4,4 | 5,8 |
| bandes de y des batteurs, des voies et des bouches de rail | 3,7 | 5,2 |
| copies d'essai sans l'état de rendu ; grille de 16 px, marge de 32 px | 3,4 | 4,8 |
| cosinus/sinus des batteurs gardés, billes de la multibille sans allocation | **3,3** | **4,6–4,8** |

- **Grossier puis fin** : le coup choisi maximise la plus mauvaise note de 5 moments voisins ; la note d'un moment sur cinq borne par le haut celle de chaque voisinage, on n'essaie que ceux qui peuvent encore battre le meilleur (ou l'égaler en étant plus près de l'arrivée de la bille). **Même coup que d'essayer toutes les frappes** : le mode `exhaustif` de `choisir` est la référence, `test/robot.test.ts` le compare sur des états réels (multibille comprise, le test échoue si on casse la borne : vérifié).
- **Garanties** : la grille a une marge de 32 px alors que la poussée d'un mur ne dépasse pas 2,5 px (2,3 mesurés), `test/grille.test.ts` ; `Partie.recopier` joue comme `copier` (test) ; golden, déterminisme et traversée verts sans toucher au golden.

## 3. Essayé et écarté (chiffres sur les mêmes 30 jours)
- **Horizon plus court** (`ROBOT_HORIZON` 360 → 300 / 240) : 3,8 s / 2,8 s, mais **Diamant médian −42 % / −69 %** : le robot ne voit plus la multibille. Écarté ; consigne écrite.
- **Rail** : 6 % des pas seulement (7 % après) ; prévoir leur issue ne peut pas rapporter plus, et changerait les notes. Non fait.
- **Convergence vers « ne rien frapper »** (arrêter un essai qui n'a touché aucun batteur) : 8,5 % des pas au plus. Non fait.
- **Moins de décisions / décision gardée** : 96 % des décisions donnent un coup, la réaction de 90 pas fixe l'instant de la décision. Rien à gagner sans changer le jeu du robot.
- **Nombre ou durée des parties : non changés** (la cible est tenue). À titre de levier suivant (Diamant médian sur 30 tables, mêmes parties jouées jusqu'à D minutes ; **le bruit de cette mesure est de ±11 %**, voir §4) : 3 × 6 min (18 min de jeu) −25 % ; 4 × 5 min −24 % ; 3 × 5 min −25 % ; 4 × 4 min −39 % ; 6 + 6 + 2 + 2 min −25 %. Tous dépassent 15 % : une durée plus courte exigerait de réétalonner (Diamant = meilleur score × un facteur), c'est une décision de Nathan. `npm run jalons-robot:pinball`.

## 4. Les médailles, avant / après (30 jours)
| | avant | après |
|---|---|---|
| Diamant médian (min / max) | 2 032 300 (898 100 / 5 394 700) | **2 032 300** (idem) |
| partie du robot / Diamant : min, 10 %, 25 %, médiane | 1, 14, 32, 57 % | **1, 14, 32, 57 %** |
| mission réussie | 119/120 parties, 30/30 tables | **119/120, 30/30** |
| tables dont les 4 scores sont identiques | | **30/30** (120/120 parties) |
- **Le bruit** (même robot, 8 graines au lieu de 4, 70 groupes de 4) : le Diamant médian des 30 tables va de 1,43 M à 2,27 M, **10–90 % : 1,81 M à 2,26 M (±11 %)**. Tout changement du robot qui modifie des scores se noie donc dans ce bruit ; c'est pourquoi on a gardé des scores *identiques*.
- 500 tables possibles : 2 000 parties comparées une à une avec le robot d'avant (`mesure-robot:pinball -- --tables`) : **500/500 tables, scores identiques** ; Diamant médian 1 734 400 des deux côtés, mission 1 943/2 000 (498/500 tables), partie / Diamant 1, 20, 37, 61 %. Coût sur ces 500 tables : 16,7 s en moyenne et 26,7 s au pire avant (la fourchette de 17 à 28 s du message), 2,9 s et 5,4 s après (au plus 9,52 M de pas).

## 5. Version, golden, tables refusées
- Scores identiques : `PINBALL_BOT_VERSION` (7) ne monte pas, le golden des seuils est inchangé (`golden.test.ts` vert sans régénération), les jours figés et l'empreinte des jours protégés ne bougent pas. **La validation des 500 tables (`valider:pinball`, sans `--ecrire`) refuse exactement les mêmes 28 tables** que `refusees.ts` : aucune ne change de statut, donc `PINBALL_GENERATOR_VERSION` ne monte pas non plus. Elle prend 8 min au lieu de ≈ 40 (3,9 s par table en moyenne, 6,4 au pire). Parties plus longues pour la validation : inutile, elle garde ses 4 × 6 minutes.

## 6. La garde du budget
`BUDGET_PAS_TABLE` = 10,4 M de pas (mesure 8,64 M, pire jour 2026-11-27, plus 20 %) et `BUDGET_PAS_PAR_MILLE` = 13,5 (mesure : 11,3 pas simulés pour 1 000 joués à 2 min, plus 20 %) dans `seuils.ts`. `test/budget-robot.test.ts` joue la table la plus coûteuse en entier (≈ 5 s) ; les tests de 30 jours (`aide30.ts`) gardent le rapport sur chaque table servie. Sur les 500 tables : au plus 9,52 M de pas, 11,0 pour 1 000 : sous les plafonds. Ils comptent des pas, pas des secondes. Consigne : `packages/pinball-sim/CLAUDE.md`, « Le budget du robot… ».

## 7. Le calcul dans le navigateur, sans fichier de jour
Mesuré dans le Chromium de Playwright (`seuilsDuRobot` d'une table, jours 6 et 22) : **ordinateur 2,4–2,8 s** (avant 12,5–13,9 s) ; **processeur ralenti ×4, ordre de grandeur d'un téléphone moyen : ≈ 10,6 s** (avant 57–60 s, les « plus d'une minute » du PBG2). C'est du calcul pur : dans le jeu il tourne par tranches de 4 ms toutes les 16 ms, donc l'attente réelle est ≈ 4 fois plus longue (≈ 11 s sur ordinateur, ≈ 42 s sur téléphone émulé, avant ≈ 50 s et ≈ 4 min) ; si la partie finit avant, l'écran de fin termine le calcul d'un trait. **En production les jours servis ont leur fichier** (`figer`, `preparer`) : ce calcul ne sert qu'aux archives, essais et recettes. Le téléphone reste lent sans fichier : voir décision 2.

## Vérifié / non vérifié
- Vérifié : tests du paquet verts (robot : contraintes humaines et déterminisme, seuils, validation, budget de pas, aucun flottant, pureté : `performance.` et `**` interdits dans `src`, l'horloge du profil est donc donnée par l'outil) ; `npm run consignes`. `npm run verifier` et la CI de la PR : voir la PR.
- Non vérifié : la vitesse sur un vrai téléphone (émulation seulement) ; l'aperçu `/pinball/?robot` n'a pas été regardé par un humain (le robot joue exactement les mêmes parties qu'avant : scores identiques).

## Décisions pour Nathan
1. **`PINBALL_BOT_VERSION` ne monte pas** : le prompt le prévoyait, mais les résultats sont identiques ; monter la version changerait l'empreinte des jours protégés sans fichier (la mise en production s'arrêterait) pour rien. Une ligne à changer si tu veux la trace.
2. Levier suivant si 3,3 s reste trop : l'attente dans le navigateur est ≈ 4 × le calcul (tranches de 4 ms toutes les 16 ms, `niveau.ts`) ; passer à 8 ms/16 ms la divise par deux sans toucher au jeu. Hors périmètre du lot, non fait.
3. Scénario : un simple retour (tableaux ci-dessus + CI verte). Pour regarder le robot : `/pinball/?robot` sur l'aperçu de la PR.

## Outils ajoutés (`npm run … -w @cdj/pinball-sim`)
`mesure-robot:pinball` (`--sortie`, `--comparer avant apres`, `--tables`), `profil-robot:pinball`, `jalons-robot:pinball` (`--evaluer fichier 4x6 3x5 6,6,2,2`).
