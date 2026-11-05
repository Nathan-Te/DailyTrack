# Lot K5 — Les jeux du kit au niveau de Track, Jump et Tower

*5 novembre 2026. Plateforme (kit). Maquette : `docs/plateforme/maquettes/jeux-du-kit-au-niveau.html`. Charte : révision 18 (`docs/plateforme/identite.md`). Captures : `docs/plateforme/lots/lot-K5-captures/`.*

**Où j'en suis : les deux parties sont faites.** Reste à Nathan : relire les écarts ci-dessous et les captures.

## Pour les joueurs
- [Blocks] Blocks et les nouveaux jeux ont un accueil et une carte de profil à leurs couleurs. // Blocks and the new games get a home screen and a profile card in their own style.

## Partie 1 — l'accueil du kit aux proportions de Tower
- **Deux colonnes** (`packages/kit/src/jeu/index.ts`, `jeu.css`) : à gauche titre · « Partie n° N · Thème » · illustration · réplique · record et série · **Jouer** · Comment jouer / Archives / Réglages ; à droite « Aujourd'hui » · classement du jour avec ta ligne · pied. Une colonne sous 760 px ; le téléphone en paysage garde deux colonnes dès 560 px.
- **Plus de « #N »** ; **pluriels** `{ one, other }` (« 1 jour / 17 jours », « 1 classé / 17 classés ») réunis au catalogue du jeu par `creerI18n` (`CATALOGUE_KIT_PLURIELS_FR`, anglais dans `catalogue.en.ts` du kit, chargé avec l'anglais). Aucun autre « (s) » dans le kit.
- **Arcade** : `suiteDuJour` (`@cdj/profile`) ne rend plus « Journée parfaite » si le serveur dit `categorie: "arcade"` (Tower aussi).
- **Archives** : `brancherJeu(…, { archives })` ; sans lui, bouton désactivé (charte § 5) avec « Bientôt ». **« Aujourd'hui »** : `brancherJeu(…, { aujourdhui(contenu, hote, ctx) })` ; sans lui, le thème et la réplique (la réplique quitte alors la colonne de gauche pour ne pas être écrite deux fois).

## Partie 2 — l'identité de chaque jeu, et le profil
- **Fiche** : bloc `identite` (`police`, `motif`, `illustration`, `aujourdhui`) validé par `validerFiche`. `npm run fiches` écrit `packages/ui/src/identites/<id>.generated.css` (face de la police, motif à deux tons : teinte + 7 % d'encre) ; `pagesDuSocle` l'aliase pour le jeu construit : **chaque jeu ne charge que le sien** (couleurs, face, motif, plus la structure `jeux.structure.generated.css`, partagée) : un jeu de plus ne grossit pas les autres (le « Kit de bout en bout » en génère deux). Track et Jump : `illustration: "propre"`.
- **`nouveau-jeu`** écrit « à choisir » (sans copier l'illustration de Cibles) ; passation, `CLAUDE.md`, `orchestration.md`, `creer-un-jeu.md` portent la règle.
- **Pas de `preview` ni de `on` sans identité complète** : `etatPermis`, `packages/core/test/identite.test.ts` (exemptions `aujourdhui: false` : Blocks et Rush, « à fournir par la conversation du jeu »), refus de l'administration (`apps/api/src/jeux.ts`, `invalid_action`).
- **Profil › Par jeu** : cartes tirées de la fiche pour Tower, Blocks, Rush, Cibles ; **cases de médailles pleines pour tous** (Track et Jump compris). Découpe « profil » des polices : 3,6 Ko (Rubik Mono One), 4,1 Ko (Bungee). **Bungee** ajoutée (OFL) ; Rush passe à Bungee. Quatre `illustration.svg` (Cibles dessinée pour l'occasion).

## Écarts et décisions à relire
- **Hors « seuls fichiers dans les zones des jeux »** : `apps/blocks/e2e/disposition.spec.ts` (il exigeait que JOUER prenne toute la carte : le défaut que le lot corrige ; il exige maintenant la largeur de sa colonne). Rien d'autre.
- **Budgets** : Cibles 44,93 / 45,00 Ko et Blocks 46,80 / 47,00 Ko (marges de 0,07 et 0,20 Ko) ; Rush 43,06 / 44. Je n'ai rien relevé : si le lot suivant les dépasse, c'est à Nathan de décider.
- **Charte** : le fichier fourni numérote « 18 » sur une base plus ancienne que le dépôt (déjà à 17) ; seuls ses passages sur ce lot sont repris (dont le joystick, § 9). Cases pleines : au profil seulement (les grilles de seuils gardent « obtenue / pas encore »).
- **Golden** : aucun golden d'écran dans le dépôt ; ceux des simulations (Track, Jump, Tower, Blocks, Cibles) ne bougent pas.
- Cibles : motif `uni` (budget). Le sous-titre « PARTIE N° 4 · BANQUISE » passe sur deux lignes à côté de l'illustration.

## Vérifié
- Unitaires SQLite complets après la fusion de `main` (500 fichiers, 7 017 tests). `tsc -b` vert ; `npm run consignes`, `npm run fiches`, `npm run traductions` à jour. Budgets : `budgets-controle.mjs` sans dépassement.
- e2e Chromium verts : Cibles (kit, partie, poids, déterminisme, classement), Blocks (disposition, partie, poids, arcade, classement, bot-themes, partage, aperçu), Rush, Tower, vitrine et accessibilité du portail.
- **Non vérifié** : le job « Kit de bout en bout » et « jeu-fictif » (la CI le dit) ; libSQL. `apps/web/e2e/profil.spec.ts` › « un record fait sur un appareil… » (course Track) échoue **aussi sur la base non modifiée** dans ce bac à sable (deux essais chacun) : non corrigé, hors zone.
