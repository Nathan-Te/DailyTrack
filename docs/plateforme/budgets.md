# Budgets de poids — la référence (lot I6)

**Ce fichier est la référence des budgets de la plateforme** (`CLAUDE.md` racine). Pour chaque application : le budget, le chiffre actuel, la marge. Les limites sont celles que les tests imposent (colonne « gardé par ») ; `apps/portail/test/budgets.test.ts` vérifie que ce tableau dit les mêmes limites que les tests. Un lot qui change un poids **remesure** (`npm run build && node scripts/budgets.mjs`, même méthode que les tests) et met à jour ce tableau ; un budget ne se relève qu'avec Nathan.

Octets **compressés** (gzip) pour le JS, le CSS et le HTML ; octets des fichiers pour les polices (déjà compressées, `woff2`) et les images. Premier chargement d'un joueur **en français** : l'anglais est chargé à la demande.

## Le tableau

« Avant » = `main` au début du lot I7 (la fin du lot I6, lot 32 compris) ; « après » = la fin du lot I7. Mesures locales (`node scripts/budgets.mjs`), identiques à celles des tests.

| Clé | Application | Mesure | Budget (o) | Avant | Après | Marge | Gardé par |
|---|---|---|---|---|---|---|---|
| `portail.premier` | Portail | premier chargement de l'accueil (HTML, JS, CSS) | 30 720 | 22 812 | 23 931 | 6 789 | `apps/portail/test/construction.test.ts` |
| `portail.polices` | Portail | polices de l'accueil | 153 600 | 117 992 | 117 992 | 35 608 | `apps/portail/test/construction.test.ts` |
| `track.jsCss` | Track | JS + CSS du premier chargement | 285 100 | 283 440 | 284 973 | 127 | `apps/web/e2e/perf.spec.ts` |
| `track.js` | Track | JS du premier chargement | 274 000 | 272 185 | 273 557 | 443 | `apps/web/e2e/perf.spec.ts` |
| `track.horsThree` | Track | le code du jeu, hors three.js | 141 000 | 139 419 | 140 791 | 209 | `apps/web/e2e/perf.spec.ts` |
| `track.anglais` | Track | catalogue anglais (à la demande) | 8 000 | 7 245 | 7 333 | 667 | `apps/web/e2e/perf.spec.ts` |
| `track.miniatures` | Track | fil de travail des miniatures (à la demande) | 26 000 | 25 385 | 25 385 | 615 | `apps/web/e2e/perf.spec.ts` |
| `track.salon` | Track | fil de travail du Salon (à la demande) | 30 000 | 27 372 | 27 372 | 2 628 | `apps/web/e2e/perf.spec.ts` |
| `track.polices` | Track | polices | 153 600 | 139 604 | 139 604 | 13 996 | `apps/web/e2e/perf.spec.ts` |
| `jump.jsCss` | Jump | JS + CSS du premier chargement | 378 490 | 376 242 | 377 637 | 853 | `apps/jump/e2e/poids.spec.ts` |
| `jump.anglais` | Jump | catalogue anglais (à la demande) | 8 000 | 5 483 | 5 530 | 2 470 | `apps/jump/e2e/poids.spec.ts` |
| `jump.polices` | Jump | polices | 153 600 | 94 212 | 94 212 | 59 388 | `apps/jump/e2e/poids.spec.ts` |
| `partage.image` | Site | chaque image de partage (1200 × 630, PNG) | 153 600 | — | 42 687 (portail ; Track 28 039, Jump 29 489) | 110 913 | `scripts/images-partage.mjs`, `apps/web/e2e/domaine.spec.ts` |

## Ce que le lot I6 a changé (avant / après)

- **Track : −115 o de marge** (735 → 620 o). Le lot ajoute le suivi du focus des écrans en surimpression (`suivreDialogue` de `@cdj/ui`, ≈ 600 o) et le lien des mentions selon la langue ; il retire 23 clés de catalogue jamais lues (≈ 100 o) et **sort l'anglais du catalogue commun du premier chargement** (≈ 420 o rendus : il voyage maintenant avec l'anglais du jeu, chargé à la demande — d'où +1 156 o au catalogue anglais, toujours sous son budget). Le nettoyage seul (clés, textes des aperçus de partage hors du paquet) rendait 101 o (283 264 o mesurés à mi-lot) ; c'est l'accessibilité qui les reprend. La retouche avant fusion rend 6 o (un `flex` de segment plus court, des libellés anglais plus courts).
- **Jump : −46 o de marge** (3 192 → 3 146 o) : mêmes ajouts et mêmes retraits (4 clés retirées).
- **Portail : +452 o** (les balises de partage dans `index.html`, comptées dans son premier chargement ; les textes des aperçus sont dans un catalogue lu seulement à la construction).
- **Les aperçus de partage ne coûtent rien aux jeux** : leurs textes (`apercu.*`) sont dans `catalogue.apercu.ts`, lus seulement par `vite.config.ts` ; les balises sont dans le HTML (hors budget JS + CSS des jeux).

## Lot 32 (Track) : l'identifiant du joueur dans l'en-tête

- **Track : −40 o** (283 480 → 283 440 o, marge 620 → 660 o ; JS 272 225 → 272 185 o, hors three.js 139 459 → 139 419 o ; catalogue anglais, fils de travail et polices inchangés). Les adresses n'ont plus `&player=…` ni `encodeURIComponent`, l'identifiant n'est plus dans le corps d'un envoi ; l'en-tête s'écrit par une seule fonction (`asPlayer`) et l'appel de `LeaderboardApi` passe par `ProfileClient.call`. Mesure : `npm run build && node scripts/budgets.mjs`, avant (`main` à `2bd5b93`) et après.

## Lot I7 : le plein écran et la caméra en vue

- **Track : budget JS + CSS relevé de 1 000 o** (284 100 → 285 100 o ; autorisé par Nathan, au plus 1 024 o) ; **la marge tombe à 127 o**. Le lot ajoute 1 533 o compressés (283 440 → 284 973 o : JS +1 372 o, tout dans le code du jeu et du socle hors three.js, CSS +161 o) : la logique de plein écran du socle (`pleinEcran.ts`), le bouton et l'astuce de l'iPhone (`composants.ts`), deux icônes, la plaque de caméra de la course et la décision de sa place (`main.ts`), les clés de catalogue (français : commun et jeu ; l'anglais, chargé à la demande, +88 o) et un peu de CSS. **Répartition non mesurée poste par poste** (une seule mesure avant / après). Ce qui a été retiré** : la logique de plein écran de la pause de Track (`touchUi.ts`, avec ses types préfixés WebKit) et l'icône `plein-ecran` propre à Track, le bouton caméra réutilisant `cycleCamera` (aucune fonction de plus). Pistes si un lot en a besoin : charger l'astuce de l'iPhone à la demande (`import()` : elle ne sert que sur un iPhone), ou retirer la prise en charge du préfixe WebKit du plein écran (iPad avant iPadOS 16.4).
- **Jump : −1 395 o de marge** (2 248 → 853 o), dans son budget (pas de relèvement) : mêmes ajouts, sans le bouton caméra.
- **Portail : +1 119 o** (premier chargement 22 812 → 23 931 o, marge 6 789 o) : le socle a grandi du plein écran (la barre des jeux importe le bouton).
- Mesure : `npm run build && node scripts/budgets.mjs`, avant (`main` à `d804705`) et après.

## Les marges les plus serrées (à surveiller)

1. **Track, JS + CSS : 127 o** (lot I7, après un relèvement de 1 000 o ; 660 o au lot 32). Toute fonction ajoutée au jeu se paie ici ; pistes si un lot en a besoin : sortir d'autres textes rares du premier chargement (aide au clavier, textes du Salon), ou relever le budget avec Nathan (il date du lot I4 : lot R4 + 20 ko).
2. **Track, fil des miniatures : 615 o** (inchangé depuis le lot 21).
3. **Track, catalogue anglais : 667 o** (755 o avant le lot I7) (il porte maintenant l'anglais commun).
