# Lot de plateforme — La musique de Du Jour (Track, Jump, Tower)

Branche `ccr-940b060e-42wk5d` (désignée par la session). Demande de Nathan (31/10/2026) : **un système de musique commun aux trois jeux, où il ajoute facilement des morceaux qui tournent selon le jeu.** Procédure de Nathan : **`docs/plateforme/musique.md`** ; règles : `packages/musique/CLAUDE.md`.

## Livré
- **`packages/musique` (`@cdj/musique`)** — le lecteur commun, **chargé à la demande au premier geste** : deux voix en flux (un élément `Audio` chacune, jamais un fichier en mémoire), tirage pondéré **sans répétition immédiate**, **fondu enchaîné** à puissance constante, compresseur doux, niveau de base sous les effets des jeux, **reprise du même morceau là où il en était** d'une page à l'autre, pause en arrière-plan, iPhone (`touchend`/`click`, `audioSession`). **Un jeu se branche en une ligne** : `brancherMusique("track", gameStorage)` (`@cdj/musique/branche`, 298 o).
- **Ajouter un morceau** : `musique/pistes/` (la source), **`musique/musiques.json`** (la description), **`npm run musique`** : vérifie (licence, jeux, id, fichier, crédit, source ; **refuse** un morceau sans licence ou avec un jeu inconnu), prépare (**AAC 96 kbit/s**, −18 LUFS, `faststart`) avec ffmpeg, écrit `musique/servi/liste.json` et **les crédits des deux pages de mentions** ; `--verifier` (la CI) ; `--essai` (un morceau généré par le code, CC0). `musique/servi/` est commité (la CI n'a pas besoin de ffmpeg).
- **Réglages communs** (`cdj:musique`, réglage gardé) : volume, « Couper la musique », « Morceau suivant », « En écoute : Titre — Artiste » et le crédit — **le même bloc** (`packages/ui/src/panneauMusique.ts`, fr + en) dans Track (Réglages › Son), Jump (Réglages › Son) et Tower (la pause). Caché tant qu'il n'y a rien à écouter.
- **Site** : `/musique/` (`scripts/site.mjs`, `copierMusique` : seul le dossier préparé, jamais les sources), cache sans fin des `.m4a` (`firebase.json`), `vite.config.ts` des trois jeux : le plugin `musiqueServie` sert `/musique/` en développement et en aperçu local.
- **Mentions légales** (`/mentions-legales/`, `/legal/`) : rubrique « La musique » et crédits générés ; date du 31/10/2026.

## Retour de Nathan (31/10/2026) : un morceau par menu et par thème
- **Les scènes** (`scenes` d'un morceau : `menu`, `theme:<code>`) : chaque jeu annonce où il en est (`musique.scene(…)`) ; la musique choisit les morceaux de la scène, sinon ceux qui passent partout, sinon le silence, et passe en fondu (2 s), en gardant le morceau en cours s'il y passe aussi. **Extensible** : un thème ou un jeu de plus = une ligne de `packages/musique/src/scenes.ts` (le test de chaque jeu échoue sinon). Track : 8 thèmes, Jump : 5, Tower : `port`. Détail : `docs/plateforme/musique.md`.
- **Sources hors du dépôt** (les boucles Ovani pèsent 25 Mo) : `musique/pistes/*` est ignoré par git, seul le morceau préparé (AAC 96 kbit/s, ≈ 1,4 Mo pour 2 minutes) est commité ; `liste.json` garde l'empreinte de chaque source ; la CI vérifie sans les sources.
- **Budget** (après la fusion de `main`, qui a retiré l'ambiance de Track au lot 56 : −1 023 o) : le branchement avec les scènes pèse Track +382 o, Jump +355 o, Tower +366 o ; **Track a 967 o de marge sans relever son plafond** (le relèvement de +1 000 o accordé par Nathan n'a pas servi) ; **Tower avait 44 o de marge sur `main` : son plafond passe de 168 000 à 168 500 o** (à confirmer par Nathan).
- **Trois boucles générées par le code, à écouter** (`musique/generateur/`, `docs/plateforme/musique.md`) : « Pole position » (menu de Track, 112 BPM, électro moderne), « Périphérique » (thème Nuit de Track, 128 BPM, électro nerveuse), « Sous les feuilles » (thème Forêt de Jump, 140 BPM, chiptune rétro). 32 mesures chacune (55 à 69 s), ≈ 0,7 à 0,9 Mo en AAC, −18 LUFS, boucle sans coupure. Vérifié sans les entendre : niveau, jonction de boucle, structure au spectre ; **dans Chromium, chaque scène joue son morceau** (menu de Track, Nuit de Track, forêt de Jump) et l'usine de Jump reste silencieuse.

## Fichiers touchés dans les jeux (rien d'autre n'a bougé)
- **Track** : `apps/web/src/main.ts` (import, `brancherMusique`, `MUSIQUE_EN_COURSE`, `musique.baisser` à côté de `gameAudio.update`, `musique.sourdine` dans `syncSoundButton`, `musique` dans l'hôte des réglages), `apps/web/src/settingsUi.ts` (le bloc dans l'onglet Son), `vite.config.ts`, `package.json`, `tsconfig.json`.
- **Jump** : `apps/jump/src/main.ts` (import, `brancherMusique`, `MUSIQUE_EN_NIVEAU`, `baisser` dans `syncPause`, `sourdine` au démarrage et dans `applySettings`), `apps/jump/src/settingsUi.ts` (le bloc dans la section Son), `vite.config.ts`, `package.json`, `tsconfig.json`.
- **Tower** : `apps/tower/src/jeu.ts` (import, `brancherMusique`, `MUSIQUE_EN_PARTIE`, `baisser` à l'ouverture et à la reprise de la pause et à l'écran de fin), `apps/tower/src/pause.ts` (le bloc dans la pause), `vite.config.ts`, `package.json`, `tsconfig.json`.
- **Plateforme** : `packages/ui` (panneau, feuille, catalogue ; `test/applications.ts`), `packages/profile/src/generation.ts` (`cdj:musique` gardée), `scripts/site.mjs`, `scripts/budgets.mjs`, `scripts/traductions.ts`, `scripts/unit-durees.json`, `firebase.json`, `package.json` + verrou, `tsconfig.json`, mentions, `docs/plateforme/budgets.md` et `traductions.md`, les `CLAUDE.md`.
- **Le jeu n'est pas réécrit** : aucun jeu n'avait de musique ; les sons de Track (moteur, effets, ambiance) et de Jump (effets, ambiance) restent ceux des jeux, leurs volumes aussi (**pas de doublon** : la musique a son volume, commun ; le muet / « Son : non » d'un jeu la coupe sans toucher à son volume).

## Mesures (`node scripts/budgets.mjs`, contre `main` reconstruit)
| | Premier chargement | Limite |
|---|---|---|
| Track | **+382 o** (`track.jsCss` : 293 745, 967 o de marge) | 500 o |
| Jump | **+355 o** | 500 o |
| Tower | **+366 o** (plafond relevé de 168 000 à 168 500 o, à confirmer) | 500 o |
| Portail | +10 o (la clé gardée de `@cdj/profile`) | — |
| Lecteur + panneau, à la demande | **4 458 o** (ligne `musique.lecteur`, 8 000 o) | — |
| Morceaux (non comptés) | AAC 96 kbit/s : ≈ 0,7 Mo par minute (le morceau d'essai : 73 698 o pour 6 s) | — |

## Vérifié
- `npx vitest run packages/musique` (59 tests) : la commande refuse licence manquante / non admise, jeu inconnu, id mal formé ou en double, fichier absent, champ inconnu ; liste par jeu ; **tirage jamais deux fois le même** (2 000 tirages, tous les hasards) ; **fondu** (courbes, deux voix, durée) ; **reprise** au changement de page (même morceau à la même position, autre morceau en fondu, reprise périmée) ; **démarrage au premier geste seulement** ; **pause en arrière-plan** et reprise ; **réglages communs relus** par les trois jeux ; baisse et sourdine ; **rien dans le premier chargement** (graphe statique des quatre applications) ; branchement ≤ 0,5 ko ; **crédits des mentions** (parité fr / en, à jour) ; liste préparée à jour ; site.
- Tests unitaires d'`ui`, `profile`, `portail`, `web`, `jump`, `tower` (catalogues, chaînes en dur, clés lues, traductions, mentions, budgets, zones de CI) ; `npx tsc -b`.
- **Vrai ffmpeg, vrai Chromium** (hors CI) : `npm run musique -- --essai` prépare un AAC 44,1 kHz stéréo ≈ 95 kbit/s ; dans Track et Jump (construits, `vite preview`) **aucune requête avant le premier clic, puis `liste.json` et le morceau en flux (`Range: bytes=0-`)**, aucune erreur de console ; Tower, sans morceau pour lui : seule la liste est lue ; le bloc de réglages s'affiche dans Track et Jump (captures regardées), le volume et « Couper » s'écrivent dans `cdj:musique`.

## Un test rouge sans lien avec le lot (à signaler, non corrigé)
- `apps/jump/e2e/profil-commun.spec.ts:99` (« deux appareils : finir → le code chargé sur l'autre… ») **échoue de la même façon sur `main` seul** (worktree propre, construit à part : `#arrival-rank` reste sur « Choisis ton pseudo pour entrer au classement » après la validation du pseudo, 30 s). Rejoué deux fois ici, deux fois sur `main`. - Deux tests `@regression` (la nuit seulement), rouges ici avec les morceaux de test, **sans lien avec la musique** (non corrigés) : `apps/web/e2e/accueil.spec.ts:567` (« ordinateur : le HUD de course… », `#speed` chevauche `#helpchip` en police large : le HUD de course, que la musique ne touche pas ; **non vérifié sur `main`** — le serveur de test d'un worktree propre n'a pas démarré) ; `apps/jump/e2e/mobile.spec.ts:67` (paysage, « toutes les cibles font au moins 44 px, réglages ouverts compris » : il attend 3 boutons tactiles et en trouve 4, **le bouton fantôme du lot G1**, `ghostbtn`, qui n'est pas dans sa liste). Les réglages avec le bloc de la musique visible passent l'axe de Jump et de Track (specs de langue et d'accessibilité vertes).
- Les 32 autres specs Jump de la sélection de la PR, les 22 de Track et les 3 de Tower passent.

## Non vérifié
- **L'écoute elle-même** (le son qui sort, le fondu entendu) : aucun navigateur ici n'a de sortie audio. Le fondu, la reprise, la pause sont testés sur un contexte et des éléments audio fictifs ; le chemin réseau est vérifié en navigateur réel.
- **iPhone, Safari, Firefox** : non essayés (le lecteur suit les règles de Track pour l'iPhone ; à essayer sur l'aperçu).
- **Les e2e de la CI** (axe sur les réglages avec le bloc visible). Le bloc dans la pause de Tower a été vu (capture, morceau d'essai activé pour Tower puis retiré) : **en 844 × 390 la pause défile** (`overflow-y: auto`) quand un morceau existe pour Tower ; sans morceau le bloc est caché et la pause est celle d'avant.
- **La préparation par la CI** : non faite (`musique/servi/` est commité).

## Décisions laissées à Nathan
1. **Par défaut : musique allumée, volume 80 %** (le curseur est quadratique ; proposé) — ou éteinte au premier lancement ? (une constante : `VOLUME_PAR_DEFAUT` de `logique.ts`, `coupee` de `REGLAGES_DEFAUT`).
2. **La baisse en jeu** : Track 70 % en course (pleine aux menus), Jump 60 % en niveau, Tower 60 % en partie (proposé ; constantes `MUSIQUE_EN_COURSE`, `MUSIQUE_EN_NIVEAU`, `MUSIQUE_EN_PARTIE`).
3. **Le portail** : silence (proposé) ou une liste à lui (une ligne + des morceaux `portail`).
4. **iPhone et interrupteur silence** : la musique passe quand l'interrupteur est sur silence, comme le son de Track. À inverser ? (retirer `audioSession` de `navigateur.ts`).
5. **`tous` = Track, Jump, Tower** (pas le portail) ; licences admises : `mienne`, `CC0`, `CC-BY-4.0`, `achetee` — ajouter CC-BY-SA ?
6. **Tower** : son plafond de premier chargement passe de 168 000 à 168 500 o (le branchement pèse +366 o, `main` n'avait que 44 o de marge) — à confirmer. Track garde 967 o de marge sans toucher à son plafond.
7. Les sources (`musique/pistes/`) sont commitées : un wav ou un flac pèse lourd dans le dépôt — préférer un mp3 de bonne qualité, ou ajouter un stockage de fichiers volumineux.

## À tester (aperçu de la PR)
1. `npm run musique -- --essai` (ou ton propre morceau, `docs/plateforme/musique.md`) pour **Track seulement**.
2. Portail, puis Track : la musique démarre au premier geste, plus basse en course.
3. Jump, puis Tower : chacun sa liste (celle d'essai n'est que pour Track).
4. Réglages : volume, « Morceau suivant », couper — le même réglage dans les trois jeux.
