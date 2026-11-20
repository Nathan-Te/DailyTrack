# Lot PA1 (plateforme, kit et serveur) — La catégorie « Party » et le jeu Party du jour

**État : la partie 1 (catégorie et moule) est faite ; la partie 2 (jeu du jour, classement, portail, mentions) n'est PAS faite** — arrêt prévu par le prompt. Le lot n'est donc pas terminé.

## À savoir d'abord
- **`docs/party/seed.md` n'existe pas** : le seed n'était pas joint au prompt (ni dans le dépôt). Il reste à verser par Nathan ; rien n'a été inventé. Les consignes disent « catégorie `party` » sans le citer.
- **« Pour les joueurs » : rien** (aucun jeu Party n'est ouvert ; rien ne se voit).

## Livré (partie 1)
- **Fiche** : `categorie: "party"` (`packages/core/src/fiche.ts`, `jeux.ts`) : `cumul: false`, `themes: []`, **pas de bloc `jours`** (optionnel pour Party seulement), pas de `categorieDepuis`. `horsJournee()` ; le serveur écrit `categorie: "party"` / `compte: false` (hors journée parfaite, série, partage, cumul) ; la forme des réponses des autres jeux est inchangée (bancs inchangés, jamais réécrits).
- **Identité allégée** : police `Lilita One` (déjà chargée, aucune face de plus) et motif `losanges` pour la catégorie (`POLICE_PARTY`, `MOTIF_PARTY`) ; seule l'**illustration** bloque `preview` / `on`. Choix de la police et du motif : **proposition à valider par Nathan**.
- **Niveau = graine du jour** : `graineDuJour` (`@cdj/core/graine`, FNV-1a 32 bits). Serveur : `definirJeuParty` (`apps/api/src/jeux/party.ts`), le rejeu valide le score ; aucune médaille.
- **Garde-fou et `figer`** : la chaîne de production (`chaineDesFiches`), `site.mjs`, `build-node.mjs`, `image-jours-figes`, `ci-zones` ignorent un jeu sans `jours` (test : `apps/portail/test/partieChaine.test.ts`).
- **Kit** : `DefinitionJeuParty` + `definitionDeParty` (thème unique `unique`, pas de médailles ni de fantôme) ; `brancherJeu` la complète.
- **Moule** : `npm run nouveau-jeu -- --id <id> --categorie party` (`scripts/nouveau-jeu-party.mjs`, fichiers Party dans `scripts/modele-party/*.modele`) : sans générateur de niveaux, thèmes, robot ni jours figés.
- **Preuve CI** : `kit-bout-en-bout` génère `essaiparty` (jeu Party) ; `jeu-fictif` pose un second jeu fictif `partyessai` (Party). Joué en local : voir « Vérifié ».
- Consignes : `CLAUDE.md` racine, `docs/regles/racine/{publication-des-jeux,creer-un-jeu}.md`, `apps/api/CLAUDE.md` + détail `docs/regles/api/un-jeu-party-lot-pa1.md` (contrat serveur, côté kit, côté portail).

## Pas fait (partie 2)
Tour de rôle du jeu Party du jour ; seul le jeu du jour accepte des envois classés (un autre jour : jeu libre, record local) ; section « Party » du portail et onglet du jeu du jour (aujourd'hui un jeu Party est rangé avec l'arcade) ; mentions légales (clé du record personnel) ; l'étape « refusé au classement un autre jour » de la preuve ; consignes `apps/portail/CLAUDE.md`.

## Vérifié (local)
- `npm run typecheck`, `npm run consignes`, tests core / api (SQLite et libSQL) des nouveaux fichiers, `nouveauJeu.test.ts`, `consignes.test.ts` verts.
- `kit-bout-en-bout --jeux essaiparty` : typage, unitaires (sqlite, libsql), construction, budgets, e2e Chromium, aucun fichier hors zones : **vert**.
- **Budgets** : `portail.premier` 43,61 Ko pour 47 Ko (pas de relèvement à proposer) ; toutes les lignes tiennent.
- Plafond de jetons des consignes de Track (54 000) : atteint à 53 98x ; les détails du lot sont dans `docs/regles/`.
- `jeu-fictif` (suite complète) : voir le résultat de la CI ; deux échecs trouvés en local (chevauchement de noms `essai*`, plafond de jetons) sont corrigés.
- **Non vérifié** : la CI complète sur la PR ; l'e2e de `essaitemps` / `essai` (inchangés, non relancés).
