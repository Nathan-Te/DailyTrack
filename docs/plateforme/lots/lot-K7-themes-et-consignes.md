# Lot K7 (plateforme, kit, court) — un jeu qui change ses thèmes ne sort plus de ses zones

**Source choisie pour les noms des thèmes : la fiche** (`config/jeux/<id>.json`, champ `nomsThemes` `{ fr, en }`, une entrée par code de `themes`, validée : ni plus ni moins). Pourquoi la fiche plutôt que les catalogues du jeu : le portail lit déjà la projection `portail.json` (et sa variante de production, sans les témoins), le fichier généré existe donc déjà, il est déjà dans les exceptions des zones, et le jeu n'a aucune dépendance de plus (un catalogue de jeu ne peut pas être importé par le portail : « les jeux ne s'importent jamais »). `catalogue.ts` du portail ne garde plus les 78 clés `portail.theme.*` : il en tire `portail.theme.<code du jeu>.<thème>` des fiches (Track : code `cdj`). **Les 39 noms × 2 langues sont migrés sans un mot changé** (`jeuxFiches.test.ts` compare chaque nom du catalogue à celui de la fiche).

## Ce qui change
1. `fiche.ts` : champ `nomsThemes`, validation, projection portail ; `JEUX_SANS_NOM_DE_THEME` (exception de Track) disparaît.
2. `consignes.test.ts` découvre tous les `CLAUDE.md` (`claudeMd()`, hors `node_modules`). `ci-zones.mjs` : règle explicite (`TEST_DES_CONSIGNES`) — un `CLAUDE.md` changé lance ce test ; `ciZones.test.ts` le prouve (PR qui ne change que `apps/<jeu>/CLAUDE.md`).
3. `zones-jeu.mjs` : **toutes** les sorties de `npm run fiches` sont des exceptions (dont `fiches.production.generated.ts` de `musique`, qui manquait, et 10 autres : variantes de production, CSS, `registre`, `essais`, `catalogues-jeux`) ; un test (`zonesJeu.test.ts`) compare la liste aux fichiers que la commande écrit.
4. Preuve : `jeu-fictif.mjs` ajoute un thème (`aube`), en renomme un (`sombre` → `nuit`), crée ses deux `CLAUDE.md`, relance `npm run fiches` / `traductions`, compare l'arbre avant / après et échoue si un fichier partagé a changé. `kit-bout-en-bout.mjs` fait de même sur les deux jeux générés (ajout de `aube`, renommage d'un nom, `CLAUDE.md`).
5. `nouveau-jeu` écrit `nomsThemes` (« Clair (à remplacer) » en exemple) et plus rien dans le catalogue du portail hors l'accroche.

## Vérifié / non vérifié
- Vérifié en local (Windows) : `tsc -b` propre ; `consignes`, fiches, zones, `ciZones`, portail, `ui`, `kit` : mêmes échecs qu'avant le lot (50, défauts Windows : CRLF, chemins), aucun nouveau ; `jeu-fictif.mjs --sans-suite` : zones « aucun fichier partagé touché » ; le pas « thèmes » du kit joué sur un jeu généré (fiches, traductions, consignes, `jeuxFiches` ok).
- **Non vérifié ici** : budgets (`portail.premier` : les noms passent du catalogue au JSON, net ≈ nul, à confirmer par le job « Budgets »), suite complète du jeu fictif et du kit (e2e, build), captures du portail (aucun texte changé).
- `docs/plateforme/traductions.md` : 78 lignes se déplacent (les clés de thème viennent en fin de catalogue), aucun texte ne change.

## Pour les joueurs
rien
