# Grammaire des sauts et des transitions (lot 57)

> Règle du lot 57 (Track). Le renvoi est dans [`packages/sim/CLAUDE.md`](../../../packages/sim/CLAUDE.md). README : `docs/lots/lot-57-sauts-transitions.md`.
> **État : prototypes jouables, en attente du choix de Nathan** (garder, retoucher, écarter). Le générateur ne les tire pas encore : aucune version publiée ne change.

## Les blocs nouveaux (aucun circuit d'avant n'en a : `SIM_VERSION` inchangée, anciens circuits et rediffusions au bit près)
Champs **optionnels** de `Block` (absents des blocs d'avant : leurs objets ne changent pas) ; la géométrie est dans `liftAt` (`track.ts`), lue par `world.sample` / `collide` (hauteur, gradient, rebords), la ligne médiane, le pilote et le rendu (`scene/route.ts`, `trackMesh.ts`). `hasLift(b)` est faux pour tout bloc d'avant : leur chemin de calcul est inchangé.
- **Dévers d'une droite** `/i` (la route penche vers la gauche) et `/j` (vers la droite) : pente en travers `TILT_SLOPE` (0,25), **chaînée comme la largeur** — un bloc part de la sortie du précédent (`tilt0`) et va à la sienne (`tilt`) en lissage cubique ; un vide la remet à plat ; **elle doit finir avant un virage** (sinon `parseTrack` refuse : un virage a son propre relevé). Sur `S`, `U`, `D`, `B`, `K`, `P`, `T`, `C`.
- **Virage en pente** `/+` (monte d'un niveau par signe), `/-` (descend) : `rise × S(t)`, t la fraction d'arc du relevé (`bankAt`), S le lissage cubique — pente nulle à l'entrée et à la sortie, donc aucun coude avec une droite à plat. Se combine avec `/b` (`L2/b-`). Pas sur une cuve.
- **Virage-tremplin** `/k` : les `CURVE_KICK` (16) derniers mètres de l'arc montent d'un niveau (pente ≈ 0,25 sur l'axe, comme `K`) ; on décolle en tournant. Ni relevé, ni en pente, ni en cuve ; bords à rebords (comme `K`).
- **Appel sur une crête** : une montée (`U`, `U2`, `U3`) suivie d'un vide est un appel (`appelSlope`, jump.ts : sa pente est celle de la montée).

## Les sauts : cinq parties
`classerSauts` (`sautsClasse.ts`, pur) range chaque saut : **approche** (droite, virage, descente, chicane : les trois blocs d'avant), **appel** (tremplin plat, en dévers, crête, bord de cuve, virage-tremplin), **vol** (dans l'axe, tournant : appel en dévers ou en virage), **réception** (dans l'axe, décalée, en angle, plus basse, plus haute, en virage, autre revêtement, plus étroite), **sortie** (droite, virage, chicane : les deux blocs après la réception), **vitesse** (plaque ou turbo dans les cinq blocs d'avant, sinon élan). `combinaison(s)` en fait une clé ; `sautDansLAxe` = ligne droite → tremplin plat → réception dans l'axe (plus bas ou plus haut compris).
- **Fenêtre** : `trackJumps` donne le plancher et le plafond de vitesse au bord (balistique, pente de l'appel) ; **chaque saut de la grammaire est vérifié par la simulation** sur toute sa fenêtre (du plancher × 1,08 au plafond, borné à la vitesse du pilote + 6 m/s) et d'angle (cap ± 4°, ± 2 m de l'axe) : `test/grammaire.test.ts` (`helpers/fenetre.ts`).
- **Jamais de saut à l'aveugle** : la réception porte deux **balises** (poteau, panneau à flèche verte) dont la tête dépasse le bord de l'appel, d'autant plus hautes que la réception est basse (`addLandingBeacons`, `scene/route.ts`), en plus du damier et des chevrons peints dans l'axe de la réception. Un virage-tremplin porte ses chevrons et sa bande d'alerte sur les derniers mètres de l'arc (`addCurveKickMarks`).
- **Pilote** : un appel compte comme une rampe (au milieu de la route) ; sur un virage-tremplin, la trajectoire rejoint l'axe sur `RAMP_TAPER` × 16 m avant la rampe (mesuré : plus court, le coude fait tomber la vitesse de passage sous le plancher) ; le bord d'un virage-tremplin est sa sortie (`runPilot`, `lips`). Ces trois règles ne valent que pour les blocs nouveaux : un circuit d'avant roule exactement comme avant.

## Les prototypes (`grammaire.ts`)
`SAUTS_LOT57` (11) et `TRANSITIONS_LOT57` (7), même forme qu'une figure (`since: 22` : aucun générateur publié ne les tire), avec leurs parties et des thèmes proposés. Chacun se joue seul : `?scenario=<nom>` (`saut-…`, `transition-…`, `&v=1`, `&m=1`), la page `?scenario=sauts` les liste (deux touchers jusqu'à un élément). `test/grammaire.test.ts` : le pilote finit chaque variante, deux sens, trois largeurs.

## Mesure
`packages/sim/scripts/mesure-sauts.ts` (hors CI, ≈ 30 s) : 25 circuits par thème, sauts rangés par parties, part « droite → tremplin → axe », raccords par genre et part qui demande un geste au pilote d'auteur (lâcher, freiner, braquer, décoller à moins de 16 m).

## À faire après le choix de Nathan (phase 3)
Combinaisons tirées par le générateur sous des règles de compatibilité et un budget de technicité, poids par thème (fiches du lot 49 / V2), au plus un saut « droite → tremplin → axe » par circuit, deux sauts consécutifs jamais de même combinaison ; nouvelle version du générateur (sans date, R11), golden par thème, ressemblance et temps de génération avant / après.
