# Lot PB5a — maquettes de l'identité, du HUD et de l'accueil de Pinball

**État : en attente du choix de Nathan.** Ce lot n'écrit que dans `docs/pinball/maquettes/` : aucun code de jeu ni d'interface. « Pour les joueurs » : `rien`.

## À regarder, dans cet ordre (les PNG s'ouvrent sur le téléphone)
| # | Quoi | Capture | Page |
|---|---|---|---|
| 1 | **Étagère** : 3 étiquettes dans la salle d'arcade, à côté de Tower et Rush | `pinball-etagere.png` | `pinball-etagere.html` |
| 2 | **Illustration** : 3 propositions, en grand et à la taille du portail | `pinball-illustration.png` | `pinball-illustration.html` |
| 3 | **HUD portrait** 390 × 844, 3 états sur la vraie table | `pinball-hud-portrait.png` (les 3) ; `pinball-hud-portrait-1-avant.png`, `-2-en-cours.png`, `-3-mission-reussie.png` | `pinball-hud-portrait.html` |
| 4 | HUD paysage 844 × 390 et bureau 1440 × 900, en cours | `pinball-hud-paysage.png`, `pinball-hud-bureau.png` | `.html` du même nom |
| 5 | Accueil et panneau « Aujourd'hui » (téléphone et ordinateur) | `pinball-accueil.png` | `pinball-accueil.html` |
| 6 | Écran de fin | `pinball-fin.png` | `pinball-fin.html` |

Pages autonomes (CSS et jetons de `@cdj/ui` recopiés, polices du dépôt ; Righteous, absente du dépôt, est dans `polices/` avec sa licence OFL, pour la seule proposition A). Fonds : `fonds/`, captures du vrai jeu (rendu haute qualité, HUD masqué ; aperçus de la table : rendu à plat). Captures : Chromium de Playwright, `file://`.

## 1. L'étiquette — trois propositions
| | Teinte (fond / coque) | Police | Motif | Ce qu'elle coûte |
|---|---|---|---|---|
| **A** Lilas (actuelle) | `#C9B6F2` / `#5B3FA0` | Righteous | losanges | **une police à héberger** (12,8 Ko woff2 latin, plus le sous-ensemble « profil » et l'import au portail) : un lot de plateforme |
| **B** Néon | `#F6A2D8` / `#962170` | Barlow Condensed 800 italique | rayures | **rien** (police hébergée et déjà chargée par le portail, motif existant) |
| **C** Lampes | `#D3E77C` / `#4E6B14` | Lilita One | **pastilles** (neuf) | **un motif neuf** : une entrée dans `MOTIFS` et `fondDuMotif` (`packages/core`), et le test des fiches, par un petit lot de plateforme ; police hébergée et déjà chargée par le portail |

- **A se confond avec Rush** : même famille de lilas (écart de couleur ΔE 10 sur le fond comme sur la coque ; les autres jeux sont à 26 ou plus), **même motif losanges**, et les deux sont dans la salle d'arcade. Sur l'étagère, on ne les distingue que par le nom et l'illustration.
- **B** se distingue bien (Cibles, le témoin, est le plus proche à ΔE 19 ; Rush à 24). Contre : la police est celle de Track et rappelle Track, même sur fond clair.
- **C** est la plus éloignée de toutes (Jump à 34, Tower à 43). Les pastilles sont des lampes rondes en quinconce, comme les lampes d'une table : c'est l'idée du seed (« comme des lampes de table »), sans prendre les losanges de Rush. Le motif est dessiné en disques nets (`radial-gradient` à arrêt franc, comme les losanges en `linear-gradient`) : aucun dégradé visible.
- Contrastes (WCAG) : encre sur le fond A 8,8:1, B 8,5:1, C 12,0:1 ; encre sur le second ton du motif A 7,8:1, B 7,6:1, C 10,5:1 ; teinte sur encre (bouton JOUER du jeu) idem. Charte : 4,5:1.

## 2. L'illustration — trois propositions
**1 « Le tir »** (la bille part du batteur droit) · **2 « La bille inquiète »** (la bille a des yeux, elle regarde le trou entre les batteurs) · **3 « La table »** (meuble en arche, bumper à yeux, bille, batteurs). Couleurs : encre, papier, terre cuite, moutarde, bronze (le bois) et l'acier `#C9D2DE` (déjà dans l'illustration de Rush). Fichiers SVG prêts à copier en `apps/pinball/public/illustration.svg`.

## 3. Le HUD
- **Portrait** : la caméra cadre déjà toute la table ; le meuble laisse une bande libre en haut et en bas. **Tout le HUD y tient, rien ne touche le plateau** : en haut, pause (44 px) · score dans **l'afficheur encastré** de la charte (fond `--dj-ecran`, chiffres ambre JetBrains Mono : l'afficheur d'un flipper) · multiplicateur (papier à ×1, **moutarde dès ×2**) · billes (rondes en acier, une perdue = rond en pointillés) ; en bas, **la mission** (nom, jauge à cases, « 3/5 »).
- **Avant le lancer** : une aide d'une ligne sur le haut du meuble, qui part au premier lancer. **Mission réussie** : l'afficheur montre « +10 000 » deux secondes, la plaque de la mission passe en moutarde (et le reste), le multiplicateur monte.
- **Paysage et bureau** : tout dans la marge de gauche (et la mission à droite sur bureau) ; plein écran en haut à droite ; sur bureau, l'aide du clavier en bas à gauche à la première partie.

## 4. Le panneau « Aujourd'hui » — proposé **activé** (`aujourdhui: true`)
L'aperçu de la table du jour, la mission du thème (« Fais 5 tours de manège », sa jauge, ce qu'elle rapporte), les modules du thème présents sur la table, les quatre médailles du jour avec leurs seuils. Aucune raison contre : tout vient du fichier du jour, déjà chargé par l'accueil.

## 5. L'écran de fin
Score de la partie, ce qu'il vaut (« Nouveau record » / « Pas mieux que ton record du jour »), **la meilleure partie du jour** et son rang (c'est elle qui compte), les quatre médailles en cases pleines (la suivante en pointillés, avec « Diamant : encore 33 250 »), Rejouer, puis Partager · Classement · Accueil.

## Ma recommandation
1. **Étiquette C** (Lampes). Si tu ne veux pas de lot de plateforme : **C en motif `uni`** ne coûte rien (la teinte et la police font déjà l'essentiel) ; ou B. **Pas A**, à cause de Rush.
2. **Illustration 2** (la bille inquiète) : le sujet du seed, avec les yeux qui relient Pinball à ses bumpers et à la famille de Tower ; à 70 px, la 3 se lit un peu mieux.
3. **HUD portrait tel quel** (afficheur, plaques, mission en bas).

## Vérifié / non vérifié
**Vérifié** : les sept pages se rendent sans erreur ni ressource manquante, toutes les polices chargées ; captures regardées (étagère, illustrations, HUD portrait, paysage, bureau, accueil, fin) ; tous les liens et boutons font au moins 44 × 44 (mesuré dans la page) ; aucun émoji, aucune ombre floue, aucun dégradé (motifs et voile seulement, arrêts francs) ; couleurs : jetons recopiés de `@cdj/ui`, plus les teintes proposées et l'acier de la bille ; contrastes ci-dessus, et encre-douce sur crème-2 4,7:1, ambre sur l'afficheur 7,3:1, encre sur bronze 4,7:1.
**Non vérifié** : le rendu sur un vrai téléphone et les marges de sécurité (encoche, barre d'accueil de l'iPhone) ; les animations (images fixes) ; l'anglais.

## Ce que le PB5b devra faire (à savoir avant de choisir)
- **Le HUD passe en surimpression** (`DefinitionJeu.hud: "surimpression"` du kit, lot PG1) au lieu de la barre crème actuelle, et **la caméra cadre la table entre les deux bandes**, marges de sécurité comprises (avec l'encoche d'un iPhone, la bande du haut descend d'environ 47 px : la table doit lui laisser cette place).
- **L'aperçu de la table** se dessine avec le rendu à plat (`dessin.ts`) dans un petit canvas, **chargé à la demande** après l'accueil : jamais three.js ni le rendu au premier chargement. Son poids est à mesurer (`pinball.jsCss`).
- **Textes à ajouter** au catalogue du jeu, fr et en : `aujourdhui.mission`, `aujourdhui.table`, `aujourdhui.medailles`, `hud.aide.lancer` (« Maintiens, puis relâche pour lancer »), `hud.mission.reussie`, `fin.meilleure` (« Ta meilleure partie du jour »), `fin.meilleure.compte` (« c'est elle qui compte »), et les noms lus (`hud.score.aria`, `hud.mult.aria`, `hud.billes.aria`).
- Rappel (déjà au `docs/pinball/consignes.md`) : les mentions légales doivent nommer les clés `pinball:*` avant que le catalogue perde son dernier « À remplacer » — un lot de plateforme.

## Questions pour Nathan
1. Étiquette **A, B ou C** (et, pour C, motif « pastilles » ou « uni ») ?
2. Illustration **1, 2 ou 3** ?
3. Le HUD portrait te va-t-il ? En particulier : **la mission en bas** (loin du score) ; **les billes en ronds** plutôt qu'un chiffre « Billes : 2 ».
4. Le plein écran : en paysage et sur bureau seulement (comme proposé), ou aussi en portrait ?
