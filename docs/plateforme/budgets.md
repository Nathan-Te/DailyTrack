# Budgets de poids — la référence (lot I6)

**Ce fichier est la référence des budgets de la plateforme** (`CLAUDE.md` racine). Pour chaque application : le budget, le chiffre actuel, la marge. Les limites sont celles que les tests imposent (colonne « gardé par ») ; `apps/portail/test/budgets.test.ts` vérifie que ce tableau dit les mêmes limites que les tests. Un lot qui change un poids **remesure** (`npm run build && node scripts/budgets.mjs`, même méthode que les tests) et met à jour ce tableau ; un budget ne se relève qu'avec Nathan.

Octets **compressés** (gzip) pour le JS, le CSS et le HTML ; octets des fichiers pour les polices (déjà compressées, `woff2`) et les images. Premier chargement d'un joueur **en français** : l'anglais est chargé à la demande.

## Le tableau

« Avant » = `main` au début du lot I6 (`df53a33`) ; « après » = la fin du lot I6, retouche avant fusion comprise (vocabulaire anglais, boutons de segment). Mesures locales (`node scripts/budgets.mjs`), identiques à celles des tests.

| Clé | Application | Mesure | Budget (o) | Avant | Après | Marge | Gardé par |
|---|---|---|---|---|---|---|---|
| `portail.premier` | Portail | premier chargement de l'accueil (HTML, JS, CSS) | 30 720 | 22 360 | 23 694 | 7 026 | `apps/portail/test/construction.test.ts` |
| `portail.polices` | Portail | polices de l'accueil | 153 600 | 117 992 | 117 992 | 35 608 | `apps/portail/test/construction.test.ts` |
| `track.jsCss` | Track | JS + CSS du premier chargement | 285 124 | 283 365 | 285 067 | 57 | `apps/web/e2e/perf.spec.ts` |
| `track.js` | Track | JS du premier chargement | 274 000 | 272 142 | 273 655 | 345 | `apps/web/e2e/perf.spec.ts` |
| `track.horsThree` | Track | le code du jeu, hors three.js | 141 000 | 139 376 | 140 889 | 111 | `apps/web/e2e/perf.spec.ts` |
| `track.anglais` | Track | catalogue anglais (à la demande) | 8 000 | 6 104 | 7 297 | 703 | `apps/web/e2e/perf.spec.ts` |
| `track.miniatures` | Track | fil de travail des miniatures (à la demande) | 26 000 | 25 385 | 25 385 | 615 | `apps/web/e2e/perf.spec.ts` |
| `track.salon` | Track | fil de travail du Salon (à la demande) | 30 000 | 27 372 | 27 372 | 2 628 | `apps/web/e2e/perf.spec.ts` |
| `track.polices` | Track | polices | 153 600 | 139 604 | 139 604 | 13 996 | `apps/web/e2e/perf.spec.ts` |
| `jump.jsCss` | Jump | JS + CSS du premier chargement | 378 490 | 375 298 | 377 325 | 1 165 | `apps/jump/e2e/poids.spec.ts` |
| `jump.anglais` | Jump | catalogue anglais (à la demande) | 8 000 | 4 226 | 5 531 | 2 469 | `apps/jump/e2e/poids.spec.ts` |
| `jump.polices` | Jump | polices | 153 600 | 94 212 | 94 212 | 59 388 | `apps/jump/e2e/poids.spec.ts` |
| `partage.image` | Site | chaque image de partage (1200 × 630, PNG) | 153 600 | — | 42 687 (portail ; Track 28 039, Jump 29 489) | 110 913 | `scripts/images-partage.mjs`, `apps/web/e2e/domaine.spec.ts` |

## Ce que le lot I6 a changé (avant / après)

- **Track : −115 o de marge** (735 → 620 o). Le lot ajoute le suivi du focus des écrans en surimpression (`suivreDialogue` de `@cdj/ui`, ≈ 600 o) et le lien des mentions selon la langue ; il retire 23 clés de catalogue jamais lues (≈ 100 o) et **sort l'anglais du catalogue commun du premier chargement** (≈ 420 o rendus : il voyage maintenant avec l'anglais du jeu, chargé à la demande — d'où +1 156 o au catalogue anglais, toujours sous son budget). Le nettoyage seul (clés, textes des aperçus de partage hors du paquet) rendait 101 o (283 264 o mesurés à mi-lot) ; c'est l'accessibilité qui les reprend. La retouche avant fusion rend 6 o (un `flex` de segment plus court, des libellés anglais plus courts).
- **Jump : −46 o de marge** (3 192 → 3 146 o) : mêmes ajouts et mêmes retraits (4 clés retirées).
- **Portail : +452 o** (les balises de partage dans `index.html`, comptées dans son premier chargement ; les textes des aperçus sont dans un catalogue lu seulement à la construction).
- **Les aperçus de partage ne coûtent rien aux jeux** : leurs textes (`apercu.*`) sont dans `catalogue.apercu.ts`, lus seulement par `vite.config.ts` ; les balises sont dans le HTML (hors budget JS + CSS des jeux).

## Lot 32 (Track) : l'identifiant du joueur dans l'en-tête

- **Track : −40 o** (283 480 → 283 440 o, marge 620 → 660 o ; JS 272 225 → 272 185 o, hors three.js 139 459 → 139 419 o ; catalogue anglais, fils de travail et polices inchangés). Les adresses n'ont plus `&player=…` ni `encodeURIComponent`, l'identifiant n'est plus dans le corps d'un envoi ; l'en-tête s'écrit par une seule fonction (`asPlayer`) et l'appel de `LeaderboardApi` passe par `ProfileClient.call`. Mesure : `npm run build && node scripts/budgets.mjs`, avant (`main` à `2bd5b93`) et après.

## Lot 33 (Track) : partage qui se copie, classement final du Salon

- **Track : +404 o** (283 440 → 283 844 o, marge 660 → 256 o ; JS 272 185 → 272 589 o, hors three.js 139 419 → 139 823 o ; catalogue anglais 7 245 → 7 224 o). Le lot ajoute le champ de repli de « Copier » et la séparation classement final / circuit suivant, et compense en partie en retirant l'ancienne copie par `execCommand`, 7 clés de catalogue (dont l'ancien « Partager mon temps ») et la reconstruction du podium à chaque seconde (le décompte seul est mis à jour). Fils de travail et polices inchangés. Mesure : `npm run build && node scripts/budgets.mjs`, avant (`main` à `eb6647d`) et après.

## Lot I7 : le plein écran et la caméra en vue

- **Track : budget JS + CSS relevé de 1 024 o** (284 100 → 285 124 o ; autorisé par Nathan, au plus 1 024 o) ; **la marge tombe à 57 o**. Le lot ajoute 1 223 o compressés à `main` (283 844 → 285 067 o : JS +1 066 o, CSS +157 o) **après avoir été resserré** : la première version ajoutait 1 529 o (285 373 o) ; le budget de JS hors three.js (141 000 o) et celui du JS (274 000 o) tiennent sans relèvement (marges 111 o et 345 o). Ce qui a été retiré de Track : la logique de plein écran de la pause (`touchUi.ts`, types préfixés WebKit compris) et l'icône `plein-ecran` propre à Track ; le bouton caméra réutilise `cycleCamera` (aucune fonction de plus) et **ses noms réutilisent les clés existantes** (`course.camera.proche|loin|capot` s'écrivent désormais « Caméra : proche » : le bandeau et la pause aussi, au lieu de « Caméra proche »).
- **Ce qui coûte** (mesuré en retirant chaque pièce de la première version) : l'astuce de l'iPhone ≈ 370 o (code seul), les deux boutons du HUD, leur place et leur nom lu ≈ 240 o, le plein écran de la barre de l'accueil ≈ 45 o ; le reste est le module de plein écran, le composant du bouton, les textes du catalogue commun et la feuille. **Ce qui a été coupé pour tenir** : la prise en charge du préfixe WebKit du plein écran (−65 o ; Track l'avait, Jump non : iPad avant iPadOS 16.4, qui n'a désormais pas de bouton), le test `navigator.standalone` du mode application (le `display-mode: standalone` suffit, iOS 13 et plus), l'injection d'un navigateur fictif dans les fonctions (−145 o : les tests remplacent la page par `vi.stubGlobal`), les quatre clés de nom de caméra.
- **Jump : −1 083 o de marge** (2 248 → 1 165 o), dans son budget (pas de relèvement) : mêmes ajouts, sans le bouton caméra. **Portail : +882 o** (22 812 → 23 694 o, marge 7 026 o) : le socle a grandi du plein écran (la barre des jeux importe le bouton).
- Piste si un lot Track en a besoin ensuite : charger l'astuce de l'iPhone à la demande (`import()` : elle ne sert que sur un iPhone ; son fichier serait à sortir du décompte du premier chargement, comme le catalogue anglais — décision de budget à prendre avec Nathan).
- Mesure : `npm run build && node scripts/budgets.mjs`, avant (`main` à `e5658f9`) et après.

## Les marges les plus serrées (à surveiller)

1. **Track, JS + CSS : 57 o** (lot I7, après un relèvement de 1 024 o ; 256 o au lot 33). Toute fonction ajoutée au jeu se paie ici ; pistes si un lot en a besoin : sortir d'autres textes rares du premier chargement (aide au clavier, textes du Salon), ou relever le budget avec Nathan (il date du lot I4 : lot R4 + 20 ko).
2. **Track, fil des miniatures : 615 o** (inchangé depuis le lot 21).
3. **Track, catalogue anglais : 755 o** (il porte maintenant l'anglais commun).
