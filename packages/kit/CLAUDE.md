# `packages/kit` (`@cdj/kit`) : les briques communes côté jeu (lot K3)

Chargé quand on lit un fichier de `packages/kit`. **Zone partagée par les trois jeux** (un lot n'y touche que si son prompt le dit). Conception : `docs/plateforme/kit-de-jeu.md` (§ 2 et § 4) ; rapport : `docs/plateforme/lots/lot-K3-briques-cote-jeu.md`. Le kit **ne dépend d'aucun jeu** (ni simulation, ni `apps/*` : testé), n'ajoute aucune dépendance externe, et ne nomme jamais un jeu dans son code : ce qui change d'un jeu à l'autre (nom, identifiants, classes, destination du message) lui est **donné**, et les tests relisent la fiche du jeu (`config/jeux/projections/jeu.json`) pour vérifier que le jeu donne ce que sa fiche dit (`test/fiche.test.ts`).

## Les briques (un point d'entrée chacune : `@cdj/kit/<brique>`)
| Brique | Contient | Chargement |
|---|---|---|
| `stockage` | préfixe physique (`apercu:` en développement seulement), stockage préfixé, `gameStorage()`, `demoStorage`, drapeaux de construction (`BUILD_API_URL`, `BUILD_RESTRICTED`) | premier chargement |
| `branche` | `noterGeneration` (lot R8), `brancherInterrupteur` (lot P), `messageALaDemande` | premier chargement, **≤ 0,8 ko** (`test/premierChargement.test.ts`) |
| `interrupteur` | l'interrupteur des jeux (« Bientôt », bandeau d'aperçu, clé `X-Preview-Key`) | `import()` de `branche` |
| `message` | le message en direct : bandeau, surveillance, placement dans l'écran du moment ; `commanderSurveillance`, `baseDuMessage` | `import()` (`messageALaDemande`) |
| `suite` | « Jeu suivant du jour » : le DOM, `chargerSuite` | `import()` |
| `ecrans` | le cadre des écrans « dans le jeu » (barre, étiquette, Échap, focus) | `import()` |
| `partage` | le gabarit de la ligne à partager, l'adresse, `ligneParDefaut` | premier chargement (fonctions pures) |
| `fantome` | le cycle du bouton fantôme qui saute ce qui n'existe pas | premier chargement (pure) |
| `jour` | lecture d'un fichier de jour figé (requête, délai, refus) | premier chargement |
| `fiche` | la projection `jeu` de la fiche, **pour les tests et l'outillage** | **jamais dans un jeu** |

## Règles
- **Jamais `@cdj/kit` (l'index est vide) : un point d'entrée par brique.** Une brique à la demande n'est importée que par un `import()` du jeu ; `test/premierChargement.test.ts` suit le graphe de `branche.ts` et refuse qu'il tire autre chose que `stockage`.
- **Un premier chargement ne grossit jamais** : une brique qui n'a qu'une copie dans un jeu ne l'allège pas par elle-même (une couche de plus coûte quelques dizaines d'octets) ; le gain vient de ce qu'elle soit **chargée à la demande**. Mesurer avant et après (`node scripts/budgets.mjs`) ; la mesure de Jump compte tout son JavaScript sauf les morceaux dont le nom commence par un préfixe de `aLaDemande` (`scripts/budgets.mjs`, `message-` et `suite-` pour ces briques).
- **Les arguments positionnels sont voulus** pour `suite` : un nom de propriété ne se compresse pas, et les premiers chargements sont mesurés à l'octet.
- **Les fiches ne se lisent pas à l'exécution** dans un jeu (les trois jeux embarqueraient les trois fiches) ; le jeu passe son nom, son préfixe, sa destination, et le test de la fiche garde l'accord.
- Ce que le kit n'extrait pas, et pourquoi : `docs/plateforme/lots/lot-K3-briques-cote-jeu.md`.
