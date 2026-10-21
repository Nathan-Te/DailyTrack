# Budgets de poids — la référence (lot I6)

**Ce fichier est la référence des budgets de la plateforme** (`CLAUDE.md` racine). Pour chaque application : le budget, le chiffre actuel, la marge. Les limites sont celles que les tests imposent (colonne « gardé par ») ; `apps/portail/test/budgets.test.ts` vérifie que ce tableau dit les mêmes limites que les tests. Un lot qui change un poids **remesure** (`npm run build && node scripts/budgets.mjs`, même méthode que les tests) et met à jour ce tableau ; un budget ne se relève qu'avec Nathan.

Octets **compressés** (gzip) pour le JS, le CSS et le HTML ; octets des fichiers pour les polices (déjà compressées, `woff2`) et les images. Premier chargement d'un joueur **en français** : l'anglais est chargé à la demande.

## Le tableau

« Avant » = `main` au début du lot I6 (`df53a33`) ; « après » = la fin du lot I6, retouche avant fusion comprise (vocabulaire anglais, boutons de segment). Mesures locales (`node scripts/budgets.mjs`), identiques à celles des tests.

| Clé | Application | Mesure | Budget (o) | Avant | Après | Marge | Gardé par |
|---|---|---|---|---|---|---|---|
| `portail.premier` | Portail | premier chargement de l'accueil (HTML, JS, CSS) | 30 720 | 22 360 | 22 812 | 7 908 | `apps/portail/test/construction.test.ts` |
| `portail.polices` | Portail | polices de l'accueil | 153 600 | 117 992 | 117 992 | 35 608 | `apps/portail/test/construction.test.ts` |
| `track.jsCss` | Track | JS + CSS du premier chargement | 284 100 | 283 365 | 283 440 | 660 | `apps/web/e2e/perf.spec.ts` |
| `track.js` | Track | JS du premier chargement | 274 000 | 272 142 | 272 185 | 1 815 | `apps/web/e2e/perf.spec.ts` |
| `track.horsThree` | Track | le code du jeu, hors three.js | 141 000 | 139 376 | 139 419 | 1 581 | `apps/web/e2e/perf.spec.ts` |
| `track.anglais` | Track | catalogue anglais (à la demande) | 8 000 | 6 104 | 7 245 | 755 | `apps/web/e2e/perf.spec.ts` |
| `track.miniatures` | Track | fil de travail des miniatures (à la demande) | 26 000 | 25 385 | 25 385 | 615 | `apps/web/e2e/perf.spec.ts` |
| `track.salon` | Track | fil de travail du Salon (à la demande) | 30 000 | 27 372 | 27 372 | 2 628 | `apps/web/e2e/perf.spec.ts` |
| `track.polices` | Track | polices | 153 600 | 139 604 | 139 604 | 13 996 | `apps/web/e2e/perf.spec.ts` |
| `jump.jsCss` | Jump | JS + CSS du premier chargement | 378 490 | 375 298 | 376 242 | 2 248 | `apps/jump/e2e/poids.spec.ts` |
| `jump.anglais` | Jump | catalogue anglais (à la demande) | 8 000 | 4 226 | 5 483 | 2 517 | `apps/jump/e2e/poids.spec.ts` |
| `jump.polices` | Jump | polices | 153 600 | 94 212 | 94 212 | 59 388 | `apps/jump/e2e/poids.spec.ts` |
| `partage.image` | Site | chaque image de partage (1200 × 630, PNG) | 153 600 | — | 42 687 (portail ; Track 28 039, Jump 29 489) | 110 913 | `scripts/images-partage.mjs`, `apps/web/e2e/domaine.spec.ts` |

## Ce que le lot I6 a changé (avant / après)

- **Track : −115 o de marge** (735 → 620 o). Le lot ajoute le suivi du focus des écrans en surimpression (`suivreDialogue` de `@cdj/ui`, ≈ 600 o) et le lien des mentions selon la langue ; il retire 23 clés de catalogue jamais lues (≈ 100 o) et **sort l'anglais du catalogue commun du premier chargement** (≈ 420 o rendus : il voyage maintenant avec l'anglais du jeu, chargé à la demande — d'où +1 156 o au catalogue anglais, toujours sous son budget). Le nettoyage seul (clés, textes des aperçus de partage hors du paquet) rendait 101 o (283 264 o mesurés à mi-lot) ; c'est l'accessibilité qui les reprend. La retouche avant fusion rend 6 o (un `flex` de segment plus court, des libellés anglais plus courts).
- **Jump : −46 o de marge** (3 192 → 3 146 o) : mêmes ajouts et mêmes retraits (4 clés retirées).
- **Portail : +452 o** (les balises de partage dans `index.html`, comptées dans son premier chargement ; les textes des aperçus sont dans un catalogue lu seulement à la construction).
- **Les aperçus de partage ne coûtent rien aux jeux** : leurs textes (`apercu.*`) sont dans `catalogue.apercu.ts`, lus seulement par `vite.config.ts` ; les balises sont dans le HTML (hors budget JS + CSS des jeux).

## Lot 32 (Track) : l'identifiant du joueur dans l'en-tête

- **Track : −40 o** (283 480 → 283 440 o, marge 620 → 660 o ; JS 272 225 → 272 185 o, hors three.js 139 459 → 139 419 o ; catalogue anglais, fils de travail et polices inchangés). Les adresses n'ont plus `&player=…` ni `encodeURIComponent`, l'identifiant n'est plus dans le corps d'un envoi ; l'en-tête s'écrit par une seule fonction (`asPlayer`) et l'appel de `LeaderboardApi` passe par `ProfileClient.call`. Mesure : `npm run build && node scripts/budgets.mjs`, avant (`main` à `2bd5b93`) et après.

## Les marges les plus serrées (à surveiller)

1. **Track, JS + CSS : 660 o** (lot 32). Toute fonction ajoutée au jeu se paie ici ; pistes si un lot en a besoin : sortir d'autres textes rares du premier chargement (aide au clavier, textes du Salon), ou relever le budget avec Nathan (il date du lot I4 : lot R4 + 20 ko).
2. **Track, fil des miniatures : 615 o** (inchangé depuis le lot 21).
3. **Track, catalogue anglais : 755 o** (il porte maintenant l'anglais commun).
