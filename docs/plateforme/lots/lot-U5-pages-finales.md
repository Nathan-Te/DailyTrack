# Lot U5 — Les dernières pages dans la salle de jeux

*7 novembre 2026. Plateforme (portail, court). Charte : révision 19, § 9. Règles : `apps/portail/CLAUDE.md`, « Les dernières pages dans la salle de jeux (lot U5) ».*

**Où j'en suis : fait.** Reste à Nathan : regarder les captures et dire si la page d'un groupe lui va.

## Pour les joueurs
rien

## Ce qui change
1. **`/nouveautes/`, `/messages/`, `/groupe/<nom>`** prennent la barre de la salle (navigation, cloche, avatar ; onglets en bas sur téléphone) et un fronton : « NOUVEAUTÉS », « MES MESSAGES », le nom du groupe. Mêmes pièces que `salleDePage.ts`, aucune requête de plus. Plus de flèche « ‹ DU JOUR » ni de section Langue (elle est dans la barre, ou dans le profil sur téléphone).
2. **`/groupe/<nom>`** : emblème de 72 px dans le fronton, **chaque membre en photo de 52 px** (48 sur téléphone), « Rejoindre le groupe » en tête sur fond moutarde, rang du jour à droite (sous les membres sur téléphone).
3. **Manette** : B ne revient plus par la flèche (elle n'existe plus) ; LB et RB changent de page. Les trois pages déclarent leur action principale dans `PAGES_MANETTE`, avec la navigation en dernier recours.
4. Onglet ouvert : « Profil » pour Messages, « Amis et groupes » pour un groupe, aucun pour Nouveautés.

## Écarts à relire
- **`/partage/` n'est pas une page** : `apps/portail/partage/images.html` est l'outil qui dessine les images de partage (jamais servi). Il y a donc trois pages, pas quatre. Les mentions légales et la 404 restent statiques et sans script, comme demandé.
- Le titre d'un groupe très long passe à la ligne dans le fronton ; sur téléphone le compte à rebours passe sous le nom.
- **Budgets mesurés** (aucune ligne ni plafond ajoutés, ces pages n'en ont pas) : nouveautés 49,4 Ko, messages 50,9 Ko, groupe 56,4 Ko (avant, sur `main` : 39,7 et 40,2 pour les deux premières ; la page du groupe, à chemins absolus, n'était pas mesurée). `portail.premier` **baisse** à 42,9 Ko (45,3 sur `main`) et `portail.classement` à 52,6 Ko (54,9) : le découpage des morceaux a changé, plafonds inchangés.
- Deux clés de catalogue retirées (`messagesPage.retour*`, le lien « Profil » de l'ancienne barre) ; `traductions.md` régénéré.

## Vérifié
Typecheck du portail, `vitest` portail et ui (581 tests), e2e Chromium : `groupes` (assertion de l'emblème mise à jour : il est dans le fronton), `retours`, `diffusion`, `iphone`, `portail`, `avatars` — verts. **Non vérifié** : l'aperçu sur un vrai téléphone ; la CI de la PR.
**CI** : au premier passage, « jeu fictif (3/3) » a échoué sur `apps/api/test/api.test.ts › rejouer une course coûte quelques dizaines de millisecondes` (208 ms pour un seuil de 150, libSQL, run 42420694424) : un test de durée dans une zone que le lot ne touche pas ; la même part passe en local (0 échec sur 2 657 + 347 tests). Relancé une fois par ce commit ; s'il échoue encore, c'est à Nathan de trancher.
**Hors lot** : les outils `captures-lot-c1` et `captures-lot-n2` échouent sur téléphone (ils attendent la pastille d'avatar, retirée au lot U1) ; je ne les ai pas touchés.

## Captures (`lot-U5-captures/`)
Les trois pages sur ordinateur (1280 × 800) et téléphone (390 × 844), site construit avec l'API simulée dans le navigateur (données d'exemple : un groupe de 7, une nouveauté, un fil).
