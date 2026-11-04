# Tests e2e et CI (lots 15b et 17)

> Déplacé **mot pour mot** de `apps/jump/CLAUDE.md` (lot T1, économie de jetons) : rien n'est réécrit, les règles sont en vigueur. Le renvoi est dans [`apps/jump/CLAUDE.md`](../../../apps/jump/CLAUDE.md).

## Tests e2e et CI (lots 15b et 17)
Deux erreurs de CI se sont répétées (lot I7 : plein écran sur WebKit ; lot 15 : « Prêt… » et secousse de la mort) : un test qui échoue sur Firefox ou WebKit n'apparaît qu'à la CI complète (`main`, nuit, lot de mise en production). Détail : `docs/jump/lots/lot-15b-ci-webkit.md`.
- **Un lot Jump s'arrête quand la CI de sa PR est verte** ; la CI complète (Firefox, WebKit) est contrôlée et réparée par le lot de mise en production (`docs/orchestration.md` § 12). Un lot qui touche la simulation, l'horloge, le générateur ou des tests e2e teste en local ce que la CI de PR lancera (`npm run verifier`) et **ne pousse pas de commit « à vide »** pour avoir les trois navigateurs (le mot-clé `[ci complet]` n'existe plus, lot R10). Une différence entre navigateurs (WebKit : plein écran, secousse…) se traite par la capacité (`hasWebGL`, `pleinEcranDisponible`), pas par le nom du navigateur.
- **Étiquette de PR (lot 21)** : si le nom de la branche ne contient pas « jump », le lot **pose lui-même l'étiquette `jeu:jump`** sur sa PR (sinon la CI la traite comme une PR de la plateforme : job `zones`, `scripts/zones-jeu.mjs`).
- **Un test e2e lit un état dans la même évaluation que le pas qui le produit**, jamais après une image en temps réel : entre deux `page.evaluate`, le jeu dessine (la secousse de la mort s'use à chaque image, l'horloge d'un « Prêt… » avance) ; un navigateur plus lent laisse passer des images, et le test devient une course sur une durée. Un état que seul le dessin pose (`scene.clockFade`…) s'**attend** (`waitForFunction` sur l'état), il ne se lit pas après un délai.
- **Une capacité absente se teste, jamais le nom du navigateur** (`hasWebGL`, `pleinEcranDisponible` : `test.skip` motivé sur la capacité).
- **Ce qui est long se calcule avant d'ouvrir la page** (un essai fictif, un niveau du jour) : le jeu tourne en temps réel dès qu'il est prêt, et le temps passé à chercher décalerait une rediffusion jouée ensuite.
- Un nouveau spec s'ajoute à `e2e/durees.json` **et à la fiche du jeu** (`config/jeux/jump.json`, `e2e.specs` : ses zones, ce que sa PR doit lancer ; puis `npm run fiches`).
