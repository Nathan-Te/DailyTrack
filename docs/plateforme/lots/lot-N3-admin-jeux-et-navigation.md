# Lot N3 — Les jeux en un geste, un menu rangé

Branche `ccr-fa71c3a3-pmeti6`, PR brouillon. Maquette validée le 20/11 (elle fait foi) : `docs/plateforme/maquettes/admin-jeux-et-navigation.html`. Règles : `apps/portail/CLAUDE.md` et `docs/regles/portail/le-panneau-d-administration-lot-n1.md` (« Le menu, les jeux en un geste et les confirmations (lot N3) »), `apps/api/CLAUDE.md` (« Publication des jeux »).

## Fait (les deux parties)
- **Page « Jeux »** : une ligne par jeu, rangées En ligne · En aperçu · Fermés (vignette à la couleur de la fiche, catégorie de la fiche, « depuis le… », joueurs du jour, interrupteur Off · Aperçu · On, menu « ⋯ »). Un clic change l'état sans fenêtre ; **« Annuler » 8 s** (remet l'état d'avant). **On → Aperçu ou Off** garde sa confirmation, qui dit combien de joueurs ont joué aujourd'hui. Changements et annulations au journal.
- **Ce qui bloque** est écrit sur la ligne (« Il manque la police et l'illustration »), la position est grisée (`aria-disabled`, raison en `aria-describedby`). Le serveur reste le juge (refus sur la ligne, `ctx.refuser`).
- **Lien d'aperçu** : « Nouveau lien d'aperçu » crée la clé et copie le lien en un geste, dit que l'ancien cesse de marcher ; « Révoquer le lien » dans « ⋯ » avec confirmation. Recherche et filtres par catégorie (tirés des fiches).
- **Serveur** : `GET /api/admin/jeux` ajoute `categorie`, `couleur`, `etatDepuis`, `joueursAujourdhui`, `bloque` ; `POST …/etat` accepte `annulation`. Migration réversible `jeux.etat_le` (`DROP COLUMN`). Compteur = un `COUNT` indexé gardé 30 s, aucune donnée de joueur (plans vérifiés par le banc R14).
- **Menu en quatre rubriques** avec compteurs (images à voir, retours non lus, lignes « Pour les joueurs » à rédiger) ; sur téléphone, **barre d'onglets en bas** (plus de bouton « Menu »). Environnement en clair en haut (PRODUCTION en terre, RECETTE en moutarde). Les autres pages prennent l'en-tête commun (`adminEntete.ts`). CSP inchangée.

## À savoir (écarts et limites, décidez)
- **« Premier jour à fixer » n'existe pas côté serveur** : `premierJour` est obligatoire dans toute fiche (validée), aucune règle ne l'interdit aujourd'hui. Seule l'**identité incomplète** bloque. La structure (`bloque`, `blocage()` de `jeux.ts`, `texteBlocage`) accepte une règle de plus : à ajouter quand elle existera.
- **Barre d'onglets : 5 onglets comme la maquette** (Tableau, Jeux, puis Communauté, Diffusion, Suivi), pas 4 : « Aujourd'hui » n'a pas d'onglet, ses deux liens sont en un toucher.
- **« Annuler » ne rend pas les résultats d'aperçu** effacés quand un jeu passe On (règle du lot P).
- « depuis le… » d'un jeu sans `etat_le` (Track, Jump semés) : le premier jour de leur fiche ; autre cas : la dernière écriture de la ligne.
- Le compteur « Nouveautés » compte les lignes des PR de la fenêtre lue absentes de toute nouveauté ; il coûte la lecture de GitHub déjà faite par « Nouveautés ».
- **Références des bancs régénérées** (`banc-track`, `banc-jump`, `banc-tower`) : seule la réponse de `GET /api/admin/jeux` change (champs ajoutés) ; `fiches.generated.ts` et `serveur.json` par `npm run fiches` (champ `fond`).
- Sur téléphone, le nombre de joueurs du jour n'est pas montré sur la ligne (maquette).

## Vérifié
`npm run verifier`, `npx vitest run apps/portail`, tests d'API (SQLite et libSQL `file:`), e2e `admin-panneau` (parcours complet, axe sur la page « Jeux » ordinateur et téléphone), `diffusion`. **Non vérifié** : le panneau sur la recette réelle (Google, GitHub, Turso).

## Captures (`img/lot-N3-*`, avant / après ; `CAPTURES=1 npx playwright test captures-lot-n3`)
Jeux : `lot-N3-avant-jeux-{ordinateur,telephone}.png` · `lot-N3-apres-jeux-{ordinateur,telephone}.png` · `lot-N3-apres-jeux-apercu-annuler-*.png` (bandeau). Menu : `lot-N3-{avant,apres}-menu-*.png`. Autres pages : `lot-N3-apres-tableau-*.png`, `lot-N3-apres-joueurs-ordinateur.png`.

## Scénario pour Nathan (recette, après fusion)
1. Admin › Jeux : un jeu fermé en « Aperçu », puis « Annuler ». 2. Au téléphone : barre d'onglets, « Communauté » › Retours.

## Pour les joueurs
rien
