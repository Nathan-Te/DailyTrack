# Lot 3 — rediffusion

> Déplacé **mot pour mot** de `apps/jump/CLAUDE.md` (lot T1, économie de jetons) : rien n'est réécrit, les règles sont en vigueur. Le renvoi est dans [`apps/jump/CLAUDE.md`](../../../apps/jump/CLAUDE.md).

## Lot 3 — rediffusion
- **Rien n'est enregistré en `tuned`** : ni meilleur essai, ni vies, ni taches (le badge le dit : « réglages modifiés : rien n'est enregistré ») ; ni en lecture (`?watch=best`) ni pendant le carnage.
- **Le stockage est protégé et le jeu marche sans** : tout accès passe par `try/catch` (`memory.ts`, interface `KeyValue` pour les tests) ; clés `jump:jour|meilleur|vies|morts:<niveau>`, `jump:fantome` ; purge au changement de jour, de niveau (empreinte `levelHash`) ou de version.
- **Le carnage et les taches sont du rendu seul, plafonnés et instanciés** : chaque vie a sa propre simulation (`carnage.ts`, logique pure testée), le dessin ne fait que lire (`actors.ts` : un `InstancedMesh` pour la foule, un pour les taches, pool d'éclats recyclé) ; au plus 300 vies et 300 taches gardées par niveau et par jour (au-delà, les plus anciennes s'estompent) ; les taches sont découpées au pochoir par les blocs pleins (jamais dans le vide). Les dangers montrés pendant le carnage sont ceux du monde du héros (léger décalage de phase des scies pour les autres vies, accepté).
- **`?fx=off` ne coupe pas les taches** (elles portent une information) : seulement les éclats et le tremblement.
- Outils : `?carnage=demo`, `?watch=best`, `?ghost=off` (dans `urlOptions.ts`) ; `?debug` → `__jump.replays` (lister, exporter, importer), `__jump.carnage` (`start`, `demo`, `skip`, `state`), `__jump.storage.clear()`, `__jump.ghost`, `__jump.stains`, `__jump.frameTimes`. Touche **G**, bouton fantôme de la partie, pause et accueil : le choix du fantôme (lot G1 : « Plateforme (lot G1) » plus bas).
