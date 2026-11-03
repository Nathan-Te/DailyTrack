# Lot K3 — les briques côté jeu (`@cdj/kit`) : Jump, puis Tower, puis Track

*3 novembre 2026. Conception : `docs/plateforme/kit-de-jeu.md` (§ 2 et § 4). Pour les joueurs : rien.*

**Résultat.** Les trois jeux sont passés sur le kit, dans l'ordre demandé, un commit chacun (kit, Jump, Tower, Track). **Aucun premier chargement ne grossit** : Jump −905 o, Tower −784 o (accueil) et −270 o (jeu), Track −13 o. Pas d'arrêt propre. Ce qui n'a **pas** été extrait, et pourquoi : plus bas.

## Les briques (`packages/kit`, un point d'entrée chacune ; `packages/kit/CLAUDE.md`)
| Brique | Point d'extension (ce que le jeu donne) | Chargement |
|---|---|---|
| `stockage` | rien (préfixe physique et drapeaux de construction communs) ; le jeu garde son préfixe logique | premier chargement |
| `branche` : `noterGeneration`, `brancherInterrupteur`, `messageALaDemande` | la démonstration ou non ; l'identifiant, le nom, `apercu` ; un `import()` | premier chargement, ≤ 0,8 ko (testé) |
| `interrupteur` | rien (le nom vient de `branche`) | à la demande |
| `message` | destination, langue, traducteur, emplacements des écrans, abonnement à la langue | à la demande |
| `suite` | `t`, trois identifiants, deux ou trois classes, la clé de la légende | à la demande |
| `ecrans` | classe de l'étiquette, jour, retour, nom lu, traducteur | à la demande |
| `partage` | les morceaux de la ligne ; la ligne par défaut d'un jeu neuf (`ligneParDefaut`) | pur |
| `fantome` | la liste ordonnée et ce qui est disponible (règle G1) | pur |
| `jour` | dossier, délai, la validation reste au jeu | premier chargement |
| `fiche` | — (tests et outillage seulement : les trois fiches pèseraient dans un jeu) | jamais dans un jeu |

`test/fiche.test.ts` relit la fiche de chaque jeu (préfixe, nom, destination du message) et vérifie qu'il donne au kit ce qu'elle dit ; `test/premierChargement.test.ts` suit le graphe de `branche.ts`.

## Budgets, ligne par ligne (octets compressés, `node scripts/budgets.mjs`, `main` reconstruit à part)
| Ligne | Avant | Après | Écart |
|---|---|---|---|
| `track.jsCss` (js · hors three.js) | 296 779 (284 634 · 150 977) | 296 766 (284 621 · 150 964) | −13 |
| `track.anglais` · `track.admin` | 7 866 · 12 279 | 7 863 · 12 278 | −3 · −1 |
| `track.miniatures` · `salon` · `polices` | inchangées | inchangées | 0 |
| `jump.jsCss` | 382 938 | 382 033 | −905 |
| `tower.jsCss` (accueil) | 39 768 | 38 984 | −784 |
| `tower.jeu` | 174 906 | 174 636 | −270 |
| `tower.anglais` | 5 208 | 5 210 | **+2** (voir ci-dessous) |
| `portail`, `musique`, `tower.physique`, polices | inchangées | inchangées | 0 |

**+2 o sur `tower.anglais`** : le catalogue anglais est identique octet pour octet ; seul le nom du morceau commun qu'il importe (`./src-<empreinte>.js`) change avec son contenu, et l'empreinte fait varier le gzip de ±2 o. Ligne à la demande (plafond 8 000, marge 2 790) : je le signale plutôt que de le masquer.

**Ce qui a fait baisser** : un morceau partagé n'allège pas un jeu qui n'en avait qu'une copie (mesuré : chaque couche de plus coûte 20 à 100 o). Le gain vient de **ce qui est chargé à la demande** : le message en direct (Jump, Tower) et le DOM de « jeu suivant » (les trois) quittent le premier chargement. Pour Jump, dont la mesure compte tout son JavaScript sauf les morceaux dont le nom commence par un préfixe de `aLaDemande`, **j'ai ajouté `message-` et `suite-` à cette liste** (`scripts/budgets.mjs`, une ligne) : ces deux morceaux sont chargés par `import()`, c'est ce que voit le joueur. **Décision pour Nathan** : c'est un changement de la mesure, pas du plafond ; à refuser, il suffit de retirer ces deux préfixes (Jump repasse à +300 o environ, dans sa marge de 1 028 o mais au-dessus de « égal »).

## Par jeu : lignes retirées
- **Jump** : −358 / +51 lignes (`interrupteur.ts`, `storage.ts` −100, `messageEnDirect*` −104, `jeuSuivant`, `generationInit`, `share`, `ghostChoice`, lecture du jour).
- **Tower** : −272 / +66 (`stockage.ts`, `ecrans.ts` −46, `messageDirect.ts`, `jeuSuivant.ts`, `partage`, `jour`, `fantomeEtat`, les deux inits ; `interrupteur.ts` −35).
- **Track** : −125 / +26 (`storage.ts` −53, `interrupteur.ts` −35, `jeuSuivant`, `interrupteurInit`).

## Rediffusions de référence (au bit près)
Aucun golden ni `*_VERSION` touché (le diff ne contient aucun fichier de simulation). Rejouées dans le navigateur par les specs `@navigateurs` : Jump `replay.spec.ts` (3 tests), Tower `determinisme.spec.ts` (banc A et B, simulations 3 et 4), Track `replay.spec.ts` (2 tests).

## Ce qui n'est PAS extrait, et pourquoi
- **L'enveloppe de rediffusion** : elle vit dans les simulations (`tower-sim`, `jump-sim`, `sim`) et le serveur l'importe ; la déplacer vers un paquet client toucherait la zone du golden. À faire dans `@cdj/core`, pas dans le kit.
- **La file d'envoi et les records** (`Envoi` de Tower, `RankQueue` de Jump, `Online` de Track) : trois logiques différentes (délais 15 s → 5 min contre 5 s → 5 min, une attente par jour ou par record, clés de stockage différentes). Les fusionner changerait un comportement visible ou des clés gardées. Seul le gabarit de la ligne de partage et le cycle du fantôme sont communs.
- **La colle des amis** (`classementAmis.ts` 287 l., `amisClassement.ts` 216 l., `amisClassement.ts` de Track 271 l.) : déjà à la demande, mais écrite contre les types de chaque classement (temps, hauteur) et leur DOM ; 475 lignes de différences entre Jump et Tower.
- **Track** : le message en direct (déjà à la demande, placé par `querySelector`, autre pilote), la ligne de partage (+40 o) et la génération (+27 o) restent locaux : les migrer dépasserait le budget « à l'octet près ». Son bouton fantôme (cinq modes) aussi.
- **Jump** : le cadre des écrans utilisait déjà `creerCadre` de `@cdj/ui` ; rien à extraire.

## Ce qu'un 4ᵉ jeu obtient par défaut (K4)
En une ligne chacun : le stockage (`@cdj/kit/stockage`), la génération de données, l'interrupteur « Bientôt » / aperçu (`brancherInterrupteur(id, nom, base, apercu)`), le message en direct à la demande, « jeu suivant du jour », le cadre des écrans, la ligne de partage (`ligneParDefaut`), la lecture d'un jour figé, le cycle du fantôme. **Il doit fournir** : son préfixe logique, son nom, ses identifiants et classes, ses catalogues (`arrivee.*`, `barre.*`), ses emplacements d'écran, la validation de son fichier de jour. **Il n'a pas** : la file d'envoi hors ligne, les records locaux, la colle des amis (à écrire, ou lot suivant).

## Vérifié / non vérifié
- Vérifié en local : `tsc -b` complet ; tests unitaires (SQLite) ; e2e Chromium Jump (41), Tower (20), Track (40 : accueil, interrupteur, nouveau départ, perf, replay, partage, jeu suivant dans les deux sens, langue, accessibilité) ; budgets ci-dessus.
- **CI** : un run en mode `main` forcé une fois, **vert** (16 min, tous les jobs dont Budgets, Firefox et WebKit petit ensemble, libSQL compris) : https://github.com/Nathan-Te/DailyTrack/actions/runs/41618244765 ; le forçage est retiré (commit suivant). La CI de PR normale : voir le résumé de la PR.
- Non vérifié : les captures (aucune n'était à produire : rien ne change pour les joueurs).
