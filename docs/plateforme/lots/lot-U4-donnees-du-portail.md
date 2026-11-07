# Lot U4 — Les données qui manquent au nouveau portail, et les photos nettes

Plateforme (serveur et portail). Branche `claude/lot-u4-portal-data-cp8x1j`, PR brouillon. Les deux parties sont faites.

## Partie 1 — les données (aucune requête de plus au chargement)
- **`groupe`** sur chaque ligne de `GET /api/portail/classement` (Tous, Amis, Mon groupe) : `{ id, nom, avatar? }` ou `null`. Une jointure (`groupe_membres`, `groupes`, clés primaires) dans la requête des pseudos et dans la liste des amis ; une lecture pour ta ligne. Vérifié en capture (`/classement/`, vue Amis : les emblèmes à côté des pseudos).
- **`dernier`** (`{ site, at }`) sur les lignes des autres joueurs du cumul « Amis » / « Mon groupe » : lu dans le classement gardé, **aucune requête**. Les cartes de « Amis et groupes » le lisent d'abord là (tous les amis), la réponse de l'accueil ne sert plus que de repli.
- **`meilleureSerie`** dans `GET /api/portail/profil` (`meilleureSerieDe`, sur les jours déjà gardés, rien de stocké) ; tuile « Meilleure série » au profil.
- **Rang du groupe : du jour.** Charte (`identite.md`, révision 20, § 9) corrigée ; aucun texte du portail ne disait « semaine ».
- **Plans** (`EXPLAIN QUERY PLAN`) : que des `SEARCH` par clé primaire. Aucun test ne touche Turso.
- **Bancs de réponses** réécrits (`UPDATE_BANC=1`). Clés ajoutées, aucune autre ne change : `groupe` (60 × `null`, 9 × objet `{ id, nom }`) et `meilleureSerie` (3 réponses de profil). Pas de `dernier` dans les bancs (aucun scénario ne lit le cumul filtré).

## Partie 2 — photos nettes, cloche partout
- Photo source en **256 × 256, 40 Ko** (WebP, sinon JPEG) : `avatarLogique.ts`, textes du profil, `imagesAvatar.ts`, mentions légales (FR et EN), coûts. Les images de 128 déjà envoyées restent valides ; même limite pour l'emblème d'un groupe. Poids réel d'une image de 256 non mesuré (pire cas 540 Mo pour 10 000 joueurs, `couts.md`).
- **Cloche** sur `/classement/`, « Amis et groupes » et « Profil » : la même feuille que l'accueil, chargée à la demande (`clochePage.ts`), lignes partagées (`clocheLignes.ts`), écran du menu à la manette de toutes les pages. Budgets : `portail.premier` +292 o (45 309 / 47 000), `portail.classement` +346 o (54 821 / 57 000).

## Trouvé en chemin (corrigé, à relire)
- Le plan de la liste des amis parcourait l'index `players_masques` en table directrice (tous les joueurs non masqués) : `AND +p.hidden = 0` sur les quatre requêtes de `amis.ts`.
- Le classement « Amis » n'envoyait pas `avatar` pour les amis (corrigé) ; l'accueil non plus (`amisDuJour`), laissé tel quel : ses images s'ajouteraient aux requêtes du premier chargement (`portail-journee.spec.ts`), à décider. Les cartes d'« Amis et groupes » reconvertissaient une adresse déjà faite : les photos des amis restaient des initiales.

## Pour Nathan
- `docs/plateforme/identite.md` modifié (consigne explicite du lot : rang du jour, révision 20).
- Scénario : `/classement/?demo` vue Amis, `/amis/?demo`, `/profil/?demo` (tuile, changer la photo, la voir nette sur le podium d'un écran Retina : non vérifié sur un vrai Retina).
