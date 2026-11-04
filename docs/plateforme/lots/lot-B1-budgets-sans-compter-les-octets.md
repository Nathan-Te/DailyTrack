# Lot B1 (plateforme) — des budgets qui protègent sans gêner

**Ce que Nathan lit** : les plafonds, le gain des polices, les temps d'affichage, la conclusion. Aucun clic. PR en brouillon.

## La règle (`docs/plateforme/budgets.md`, en tête)
- Plafonds **en Ko** (1 Ko = 1 000 o), arrondis au Ko supérieur, posés **une fois** : **premier chargement** mesure + 5 % et 2 Ko au moins ; **à la demande** + 10 % et 1 Ko au moins ; **polices et images** + 10 %. La famille est une colonne du tableau.
- Le job « Budgets » **échoue seulement si une ligne dépasse**. Il **avertit sans bloquer** (⚠️, avec le chiffre) d'une croissance de **plus de 3 Ko ou de plus de 1 %** par rapport à `main` ; un plancher de 200 o écarte le bruit de construction (ma précision : sans lui, 1 % de la ligne de 149 o avertirait pour deux octets). Résumé en Ko : ligne · plafond · mesure · marge · écart avec `main`.
- **Relever = décision de Nathan**, raison écrite dans la section « Relèvements » de `budgets.md` (un test refuse un plafond au-dessus de la règle sans cette ligne). Le job ne relève rien ; un lot n'a plus à remesurer ses lignes.
- `npm run budgets -- --recaler` **propose** (jamais n'écrit) les plafonds à baisser quand une mesure a baissé de plus que sa marge. L'ancien `budgets.md` (historique de chaque lot) est dans `budgets-historique.md`.

## Les nouveaux plafonds (tableau complet : `budgets.md`, 37 lignes)
| ligne | plafond | mesure | | ligne | plafond | mesure |
|---|---|---|---|---|---|---|
| Portail, premier | **38 Ko** | 35,2 | | Track, premier (JS + CSS) | **312 Ko** | 297,0 |
| Jump, premier | **402 Ko** | 382,9 | | Tower, accueil | **42 Ko** | 39,6 |
| Track / Jump / Tower / portail, polices | 129 / 86 / 70 / 120 Ko | 116,8 / 77,8 / 63,0 / 108,3 | | Image de partage | 48 Ko | 42,8 |
À la demande (+10 %) : Tower jeu 193 Ko, Track Garage 11 Ko, Salon 35 Ko, circuits 33 Ko… **À décider par Nathan** : (1) la règle donne `tower.physique` **1 055 Ko** (ancien : 1 000 Ko, le « ≈ 1 Mo accepté ») ; (2) plusieurs plafonds « à la demande » montent (Track anglais 8 → 9 Ko, Garage 10 → 11 Ko) et d'autres baissent (polices, image de partage 150 → 48 Ko, musique 8 → 6 Ko) : c'est la règle appliquée telle quelle.

## Les polices allégées
`scripts/polices/decouper.mjs` (à la main, une fois ; `pyftsubset` de fonttools, hors projet), jeu de caractères `scripts/polices/caracteres.mjs` : français et anglais (ASCII, latin-1 accentué pour les pseudos, `œ « » ’ …`) plus tout caractère hors ASCII écrit dans le code, les feuilles et les pages. Originaux gardés dans `packages/ui/polices/originaux/`. **11 fichiers : 198,7 → 165,9 Ko (−32,7 Ko, −16,5 %)** ; par ligne : portail −22,4 Ko, Track −22,8, Jump −16,4, Tower −14,7. Aucune face retirée (les onze sont importées). Tables de composition, noms et licence gardés. Le test `polices.test.ts` : rien de perdu par la découpe, chaque caractère des catalogues fr et en dans Archivo (sinon clé et caractère nommés), les signes du système (← → ≈ ✓…) listés.
**Captures avant / après** (portail, Track, Jump, Tower, mentions FR / EN, vitrine, profil, classement, nouveautés ; téléphone et ordinateur ; FR et EN ; 40 images, date figée) : 39 identiques au pixel ; la 40ᵉ diffère de 2 pixels d'un cran sur un coin de boîte (aucun texte).

## Le temps d'affichage (`npm run mesure-affichage`, outil hors CI)
Chromium, processeur ×4, 4G lente, cache vide, médiane de 5 passes, **machine de mesure en rendu logiciel : les écarts comptent plus que les valeurs**. Écran utile = bouton « Jouer » visible ; prêt = partie démarrable (outils d'essai : fermés en production).
| page | écran utile avant → après polices | prêt à jouer avant → après | production (avant le lot) |
|---|---|---|---|
| Portail | 1,12 → 1,05 s | = | 1,35 s |
| Track | 4,00 → 3,97 s | 3,87 → 3,71 s | 4,27 s |
| Jump | 2,64 → 2,55 s | 5,54 → 5,69 s | 3,02 s |
| Tower | 0,80 → 0,81 s | 7,10 → 7,10 s | — (`off`) |
Ce qui coûte (Track : réseau seul 2,9 s, processeur seul 1,7 s ; Jump : 2,3 s et 0,5 s) : **le téléchargement**, puis l'exécution. Les polices (swap, hors chemin critique) ne changent pas l'écran utile ; le prêt de Jump (5,6 s) et de Tower (7,1 s : Rapier, 960 Ko) vient du moteur.
**Conclusion : pas « on s'arrête là ».** Track dépasse 3 s (4,0 s ; 4,3 s en production) et Jump y est (3,0 s en production). À traiter en premier, un lot par jeu : **Track** — afficher « Courir » avant three.js (≈ 134 Ko de JS sur 297) ; **Jump** — piste : l'accueil avant le moteur (à confirmer par la mesure du lot). Portail et Tower : sous 1,5 s.

## Vérifié / non vérifié
- Local : `npm run verifier` vert (typecheck, unitaires SQLite 445 fichiers et libSQL 77, e2e Track, Jump, Tower, budgets) ; `securite-workflows` : 0 écart.
- **CI de la PR verte** (run 41803838288, commit 5eb8cee, « Budgets » compris). Le premier run (ef72fba) était rouge : ma ligne du jeu fictif (40 Ko) dépassait la règle (corrigé, 32 Ko) et `apps/api/test/mesures.test.ts` (lot D3, hors de ma zone) a échoué une fois, puis est passé sans changement de ma part.
- **Non vérifié** : mesure du temps d'affichage sur l'aperçu de la PR (non faite) ; seules la version locale et la production (avant le lot) sont mesurées.
