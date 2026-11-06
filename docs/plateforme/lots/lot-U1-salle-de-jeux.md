# Lot U1 — L'accueil devient une salle de jeux

*6 novembre 2026. Plateforme (portail). Maquette : `docs/plateforme/maquettes/portail-cartouches-salle.html`. Charte : révision 19 (`docs/plateforme/identite.md`). Règles : `docs/regles/portail/la-salle-de-jeux-lot-u1.md`.*

**Où j'en suis : les deux parties sont faites.** Prérequis K5 : fusionné (bloc `identite` des fiches, `illustration.svg` des jeux d'arcade). Reste à Nathan : relire les écarts ci-dessous, valider le plafond du budget, juger l'aperçu de la PR.

## Pour les joueurs
- [Du Jour] Nouvel accueil : les jeux du jour côte à côte, une salle d'arcade, ta semaine en un coup d'œil, et tes amis à côté. // New home page: today's games side by side, an arcade room, your week at a glance, and your friends right there.

## Partie 1 — le cadre et les jeux
- **Barre** : logo, navigation (Aujourd'hui · Classements · Amis et groupes · Profil), langue, **cloche**, avatar. Sous 760 px : barre d'onglets en bas, langue dans le profil. La cloche remplace la ligne « Nouveautés » et le point de l'avatar : sa feuille donne la dernière nouveauté et les réponses non lues de « Mes messages » (point terre tant que l'un n'est pas lu).
- **Fronton** (date, « Journée n° N », semaine en lampes, compte à rebours), **deux colonnes** dès 760 px, **jeux du jour de même taille**, **salle d'arcade** (illustration, police et motif de la fiche ; horizontale sur téléphone), **épinglés en tête de leur zone** (plus de « Mes jeux »).
- **Manette** : LB / RB passent d'une page de navigation à l'autre (`packages/ui/src/manette.ts`, `[data-nav-onglets]`) ; la feuille de la cloche est un écran du menu ; « Jouer » reste l'action principale.

## Partie 2 — la colonne de droite, toujours une seule requête
- `GET /api/portail/jour` ajoute dans `joueur` : `semaine`, `classementAmis` (3 premiers + ta ligne), `amisDuJour` (6 au plus), `nbAmis`, `groupe`. Tout vient du classement gardé et d'**une** lecture indexée (la liste des amis) ; le groupe : trois lectures indexées. Les plans sont vérifiés par le test des plans (R14, SQLite et libSQL) ; aucun test ne touche Turso.
- Panneaux : Ta journée, Classement du jour (Tous · Amis · Mon groupe, Amis par défaut), Tes amis aujourd'hui (photos de 48 px), Ton groupe ; sans amis ou groupe, une ligne propose l'action.

## Écarts et décisions à relire
- **Charte** : le fichier fourni repose sur une base plus ancienne que le dépôt (il retire la section Tower) ; seuls ses passages de la révision 19 sont repris (comme au lot K5). Jetons ajoutés : `--dj-salle`, `--dj-salle-ombre`.
- **Rang du groupe** : la charte dit « de la semaine » ; le serveur n'a que le classement **du jour** des groupes (`groupes.ts`) : c'est lui qui est montré. Un classement hebdomadaire est un calcul à décider.
- **« Tous » et « Mon groupe »** montrent ta place (tuile, groupe) et un lien vers le classement entier, pas un top 3 : celui de « Tous » demanderait les pseudos des 3 premiers, donc une requête de plus.
- **Track et Jump** gardent leur étiquette dessinée (`illustration: "propre"`, hors de ma zone) ; sur téléphone ils sont l'un sous l'autre (maquette : côte à côte). Sous ~900 px de large, la colonne de gauche est étroite et ils s'empilent aussi.
- **Tuiles Série et Classement** gardées dans « Ta journée » (leurs `#serie` et `#classement` servent les tests) au lieu des trois chiffres de la maquette.
- **Avatar de la barre à 44 px** (cible tactile, § 10) et non 42 px.
- **Pages Classements, Amis et groupes, Profil** : leur barre « ‹ DU JOUR » **n'a pas changé** (la navigation et les onglets y viendront avec U2 et U3 : la flèche de retour sert B à la manette et leurs specs). Le prompt disait qu'elles « suivent » la partie 1 : à confirmer.
- **Budget** : `portail.premier` 35 193 → 44 527 o (plafond 38 Ko dépassé). **Plafond proposé : 47 Ko (mesure + 5 %), à valider par Nathan** (`budgets.md`).
- **Bancs de réponses réécrits** (`UPDATE_BANC=1`, différence voulue) : 12 réponses de `GET /api/portail/jour` (Track 5, Jump 4, Tower 3) gagnent les cinq clés `semaine`, `classementAmis`, `amisDuJour`, `nbAmis`, `groupe` ; vérifié clé par clé : aucune autre réponse ne change, aucune valeur existante non plus.
- Specs adaptés : un clic de langue sur l'accueil se fait sur ≥ 760 px (`choisirLangue`) ; aucune nouvelle spec (la cloche est couverte par `diffusion.spec.ts` et `retours.spec.ts`).

## Vérifié / non vérifié
- Vérifié : `tsc` (portail, API), tests unitaires du portail, du socle et du noyau, tests de l'API (portail, amis, groupes, plans, erreurs, démonstration ; SQLite et libSQL), `npm run consignes`, `npm run traductions`, e2e Chromium `portail`, `portail-jour`, `portail-journee`, `diffusion`, `retours`, `groupes`, `domaine`, `iphone` (marges de sécurité).
- **Captures** (`lot-U1-captures/`, à côté de la maquette) : produites sur le serveur de démonstration **avec la réponse du serveur complétée par interception** (arcade, amis, groupe, semaine : la base locale n'a que Track et Jump). Sur l'aperçu de la PR, `/?demo=joueur` montre les vraies données.
- **CI rouge hors de ma zone (à trancher par Nathan)** : après la fusion de `main` (run 42308193768, 23:06 UTC = 00:06 à Paris le 07/11), « jeu fictif (3/3) » échoue sur `apps/api/test/towerImage.test.ts` (`{"error":"version"}: expected 409 to be 200`, envoi d'une partie Tower du jour). **Le même test échoue sur `origin/main` propre** (vérifié dans un checkout séparé, 23:08 UTC) : il dépend du jour de Paris (vert avant minuit, rouge après), pas de ce lot. Tous les autres jobs sont verts (dont les quatre `unit`, `e2e-pr`, `Budgets`).
- Non vérifié : Firefox et WebKit ; l’aperçu de la PR et la CI complète (la CI dira).
