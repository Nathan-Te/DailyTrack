# Lot BR5 — Rush : un vrai hack & slash (compétences, horde, vases, coup d'élan)

Suite de BR4 (fusionné). Jeu `off` : golden **régénéré**, `RUSH_SIM_VERSION` 7 → **8**, `RUSH_GENERATOR_VERSION` 5 → **6**, `RUSH_BOT_VERSION` 1 → **2** (aucune n'a été servie). **Pour les joueurs : rien** (jeu `off`). Règles : `docs/rush/consignes.md` (« Le hack & slash (lot BR5) »), `apps/rush/CLAUDE.md`. **Ce lot casse l'équilibre de BR2 à BR4 exprès** : BR6 le refait.

## 0. Révision après le premier jet (demandes de Nathan)
- **Un temps de recharge plutôt qu'une barre de rage** : la compétence est prête au départ, la lancer la met en recharge (**tourbillon 15 s, bond 10 s, bouclier 8 s**) ; plus de gains au coup, à la mort, au vase ni au temps. « Rage vive » devient **« Recharge vive »** (−15 % par palier, jamais sous 40 %), Écho = la première utilisation n'attend que la moitié du délai, et **un vase peut rendre 3 s de recharge** (pastille violette). Dans un scénario d'essai le délai est divisé par 4.
- **Il faut farmer un minimum** : **XP réduite** (gelée 12 → 8, chauve-souris 10 → 7, gélaton 3 → 2, vase 5 → 3 ; niveau 2 à 70 XP au lieu de 40 puis +25 par niveau au lieu de +20 ; camps ×6 au lieu de ×4,5), **plus d'unités** (camps de 12 à 22 au lieu de 10 à 20, jusqu'à 5 épars au lieu de 3, jusqu'à 6 groupes au lieu de 5 : **~72 monstres par niveau**, 59 avant) et **un boss plus costaud** (`golemVie` 1 400 → **2 200**). Les vases rendent plus de cœurs (**60 % gemme / 25 % recharge / 15 % cœur**, 70 / 25 / 5 avant) : farmer des vases aide à tenir le coup. Effet mesuré au §5.

## 0 bis. Décisions que j'ai prises au premier jet (à valider)
- **Une alerte ne coupe plus la course lancée** (elle empêche seulement d'en commencer une) : sinon le coup d'élan ne servait que contre des vases (l'alerte tombe à 7-12 m, la fente fait 3 m). Conséquence réglée : **s'arrêter coupe la course** (le chevalier tient sa ligne devant une foule) et le pilote freine devant une foule au lieu de foncer dedans (sans cela « un peu d'XP » passait de 60/60 à 53/60).
- **Un gélaton ne blesse que pendant son bond** (22 ticks d'écrasement annoncé, 14 de bond, 6 de repos) : sinon une meute de 12, qui blesse même au repos, vidait les trois cœurs en ~5 s (le pilote humanisé : 7 victoires sur 36 au premier jet).
- **Les vases sont pleins pour le chevalier, pas pour les monstres** (un disque : le chevalier glisse le long) ; « rien ne bloque le chemin » est **validé** (grille de 50 cm, 365 graines).
- **Écho** = « la première utilisation n'attend que la moitié du délai, la suivante le délai plein » (une seconde utilisation à moitié prix juste après).
- Un dégât **n'interrompt pas** une compétence ; l'atterrissage du bond n'a **ni secousse ni arrêt sur image** (règle d'impact de BR0c : à toi de dire si le bond mérite une exception).
- « Tourbillon » (carte, le 3ᵉ coup) devient **`moulinet`** (même place dans la liste) ; 4 cartes de compétence : **Recharge vive, Maîtrise, Écho, Signature** (une carte, un effet par compétence : tourbillon +40 % de durée, bond +60 ticks d'étourdissement, bouclier +2 cibles) ; les affinités visent Maîtrise (la reine : Moulinet + Maîtrise ; le grand-duc : Esquive vive + Maîtrise).
- Le jeu garde `rejeu.ticksParUnite` à **1 250** (2 500 au BR4) : voir §7.

## 1. Les compétences (valeurs par défaut, toutes dans `?debug&tune`)
- **Recharge** : voir §0 ; la compétence est prête au départ et le pilote la relance dès qu'elle est rechargée (mesuré au §5).
- **Choix au départ** : un écran de trois cartes avant que le chrono parte ; **événement d'entrée** (premier de la charge, tick 0, octet haut `136 + index`) **validé par le serveur** : absent, hors des trois, avec un octet bas, à un autre tick ou en double → `invalid_replay` (testé côté sim et API). Le « Recommencer » du kit le ramène. L'octet haut d'une entrée ordinaire reste sous 128 (la compétence est le bit 6) : **les événements d'entrée se reconnaissent à `≥ 128`** (format changé : choix de carte `64 + i` → `128 + i`).
- **Tourbillon** : 72 ticks, 6 passes (à 6, 18…) à 100 % d'un coup sur tout dans 2,8 m (monstres, vases, boss), avance à 45 % de la marche. **Bond** : 8 ticks accroupi, 20 en l'air (invulnérable), atterrit à 7 m (au dernier point libre), onde de 3,8 m à 250 %, **étourdi 90 ticks** ; **le cercle d'atterrissage est cyan** (test de contraste ΔE ≥ 25 contre les deux tons de chaque thème, teinte non rouge). **Bouclier** : 15 m/s sur 9 m, **3 ennemis traversés** (le boss compte, les vases non) à 220 %, puis il revient (60 % à ce qu'il n'avait pas touché).
- **Commandes** : doigt, un 3ᵉ bouton « Compétence » avec l'anneau de recharge (il pulse quand c'est prêt) ; PC, **clic droit et E** ; manette **RB** ; l'action est déclarée dans `ACTIONS_RUSH` (remappable).

## 2. La horde
- **Gélatons** (rayon 30 cm, 10 points de vie : **un coup**, 2 XP de base) : meutes de **6 à 12** (au moins une par niveau, parmi **3 à 6 groupes** sur le chemin) ; **une meute s'alerte d'un seul mouvement** (7 m autour du premier alerté). **Camps de 12 à 22 monstres** (médiane 16 ; 45 % gélatons, 33 % gelées, 22 % chauves-souris), de 38 à 106 monstres par niveau (médiane 70), **jusqu'à 80 en même temps dans l'arène d'essai**.
- **Rendu** : les gélatons sont **instanciés** ; **appels de dessin** (`?debug&fps`, `?scenario=arene&monstres=N`, Chromium sans GPU) : **40 monstres : 136 (haute) / 150 (basse) ; 60 monstres : 180 / 164** — sous 200 partout, mais **près de la limite à 60 en haute** (gelées et chauves-souris ne sont pas instanciées). Les i/s de ce Chromium (20) ne disent rien d'un téléphone : **non mesuré sur appareil**.
- **Sim** : rejeu d'un tick ≈ 11 µs (BR4 : 6 µs) avec ~70 monstres ; deux monstres au repos ne se comparent plus (150 monstres endormis coûtaient 11 000 paires par tick).

## 3. Les vases
- **Groupes de 4 à 12** (6 au moins, 110 vases au plus ; mesuré : 33 à 77 par niveau, médiane 56) : clairières, camps (en anneau), le long des chemins (à 2,3 m de l'axe), recoins contre un mur ; jarre, tonneau, petite caisse. **Un coup en arc ou une compétence en casse plusieurs** (testé).
- **Contenu tiré de la graine** (`tirage` 0-99 écrit par le générateur, lu avec les taux des réglages) : **60 % une gemme d'XP (3), 25 % une recharge (−3 s), 15 % un cœur** (il attend au sol tant que les cœurs sont pleins ; le pilote ne le poursuit pas alors — un bug trouvé par le détecteur de blocage). Taux : `vaseGemme`, `vaseRecharge`.
- **Retour** : éclats de la couleur du vase, son de céramique ou de bois procédural, **les voisins à ~1,2 m sautent un peu**, pastille de butin qui vole au chevalier. Captures : `br5-vases-avant.png`, `br5-vases-eclats.png`.

## 4. La course et le coup d'élan
- La course part après **0,7 s** (42 ticks ; 1,2 s) et monte en **0,2 s** (12 ticks ; 0,4 s). **Coup d'élan** : frapper à partir de 70 % de la course → **fente de 3 m**, **dégâts ×1,5**, **recul ×2** ; la course s'arrête ensuite. Lisibilité : traînée, champ de la caméra poussé en pleine course, son de la fente (`br5-elan.png`).
- **La course sert-elle encore dans un niveau plus dense ?** Oui, plus qu'avant — mais seulement grâce à la décision du §0. Chez le pilote, la course couvre **23 % (foncer), 37 % (peu), 38 % (beaucoup) du trajet avant l'arène** et déclenche **0,6 à 2,3 coups d'élan par partie**. Sans la règle « une alerte ne la coupe plus », elle ne servait qu'entre deux rencontres (les rencontres sont à 12 m en moyenne, les alertes à 7-12 m). Le risque est inverse : un joueur qui fonce dans une meute à 7,5 m/s. À juger à la main.

## 5. Équilibre (après la révision du §0 : « il faut farmer un minimum »)
Pilote de référence, **365 jours** (`npm run equilibre:rush -- --jours=365`, `npm run medailles:rush -- --jours=365 --md`) :

| stratégie | victoires | temps min / médiane / p95 / max (s) | niveaux (médiane) | combat du boss (médiane) | la plus rapide |
|---|---|---|---|---|---|
| foncer | 353 / 365 | 53,1 / 85,6 / 99,0 / 116,6 | 1 | 66 s | **96 jours (26 %)** |
| un peu d'XP | 355 / 365 | 48,5 / 74,3 / 96,7 / 113,7 | 8 | 20 s | **243 (67 %)** |
| beaucoup d'XP | 354 / 365 | 51,5 / 83,3 / 108,0 / 123,9 | 9 | 19 s | **26 (7 %)** |
| **Diamant (le meilleur des trois)** | **365 / 365** | **48,5 / 72,4 / 98,8** | — | — | — |

**Farmer un minimum paie** : sans carte, foncer met ~66 s à battre le boss (2 200 points de vie) ; avec le farm d'un peu d'XP, ~20 s — le détour de quelques camps est gagnant deux jours sur trois. Avant la révision (premier jet) : foncer 67 %, un peu 31 %, beaucoup 2 % ; BR4 : 31 / 57 / 12 %. **« Beaucoup d'XP » reste rare (7 %, 15 % sur les 60 premiers jours)** : au-delà de ~8 niveaux les cartes n'accélèrent plus le combat, et les camps lointains coûtent du temps. Le plancher de ~15 % par stratégie reste suspendu (`test/xp.test.ts`).
**Le pilote gagne toujours** (~97 % par stratégie sur 365 jours : les défaites sont dans les camps ou face au chêne, au golem et à la reine ; le Diamant, lui, existe 365 jours sur 365) : `boss:rush` (60 jours forcés, sans carte, avec la compétence du pilote) golem 60/60, reine 58/60, grand-duc 60/60, bélier 60/60, chêne 59/60 ; combat du boss sans carte **40 à 80 s** (bornes de `test/bosses.test.ts` : 35 à 85 s, BR3 : 38 à 56 s) ; `foncer` 60/60 sur les 60 premiers jours (bornes de temps 40-125 s, médiane 65-100 s).
**Médailles** (recalculées d'elles-mêmes, `RUSH_BOT_VERSION` 2) : Diamant médiane **72,4 s**, or 94,1, argent 115,8, bronze 144,7 (BR4 : 53,4 / 69,4 / 85,4 / 106,8 : la run est plus longue d'un tiers) ; le pilote humanisé (meilleur des trois) gagne **332 / 365** jours, atteint l'argent 91 %, l'or 88 %, le Diamant 41 % ; grille de sensibilité (×1,5 plus lent : or 3 %, argent 66 %, bronze 88 % ; ×2 : bronze 41 %) : **les pourcentages 130 / 160 / 200 % de la fiche sont à revoir** si tes joueurs sont ≥ ×1,5 plus lents que ce pilote (la grille 150 / 200 / 300 % est dans `medailles:rush`), je n'y ai pas touché.

## 6. Scénarios à 2 clics (en local : `npm run dev -w @cdj/rush`, puis le port affiché)
- La horde : `/?debug&scenario=horde&competence=tourbillon` (`bond`, `bouclier`)
- La compétence à froid : `/?debug&scenario=mannequin&competence=bond`
- Une compétence contre un boss : `/?debug&scenario=boss&boss=grand-duc&competence=bouclier`
- Le jour complet, choix au départ : `/?debug&scenario=jour`
- Le test de charge : `/?debug&fps&scenario=arene&monstres=60`
- Captures (`docs/rush/lots/`, `e2e/captures-lot-br5.spec.ts`, `CAPTURES=1`) : `br5-choix-competence-844.png` / `-pc.png`, `br5-tourbillon.png`, `br5-bond.png`, `br5-bond-atterrissage.png`, `br5-bouclier.png`, `br5-vases-avant.png`, `br5-vases-eclats.png`, `br5-horde.png`, `br5-elan.png`. **Regardées** : le choix (844 × 390), la horde, le tourbillon, le bond, les vases éclatés, le bouclier ; l'élan et le choix PC ne sont vérifiés que par les e2e.

## 7. Mesures (Node, cette machine, 4 cœurs)
- **Rejeu** : partie du jour du pilote qui fonce (5 024 ticks) **54 ms** (BR4 : ~20 ms) ; **pire jour (10 min, chevalier invincible qui court en rond) 744 ms** (BR1b : 243 ms). **`ticksParUnite` 2 500 → 1 250** : une partie normale (~5 000 ticks) pèse 5 unités du plafond (54 ms ≈ 4 unités de 15 ms), la pire 29 (elle en vaut ~50 : le cas « invincible » est artificiel, mais le plafond de 600 unités par minute n'absorbe plus que ~20 de ces parties : à surveiller).
- **Rediffusion** : une partie du pilote 3 000 à 5 200 caractères (+3 caractères pour la compétence) ; la pire permise 32 014 (limite 40 000, inchangée). **Génération du niveau 14 ms** (BR4 : 6,5 ms ; 37 tentatives en moyenne, 271 au plus). Temps de calcul des seuils d'un jour : ~385 ms (3 parties du pilote + 3 humanisées) ; le serveur en garde une copie, le jeu le paie une fois à l'écran de fin.
- **Poids** : premier chargement **44 488 o** gzip (BR4 : 44 043 ; **+445**), sous le plafond de 46 080 (marge 1 592) : **aucun relèvement** ; les libellés des nouveaux curseurs de `tune` sont dans la partie à la demande. Scène à la demande (`corps-`) 753 Ko brut, **203 647 o gzip** (BR4 : 198 Ko).

## 8. Tests et ce qui n'est pas vérifié
- **Sim** : `test/hackslash.test.ts` (32 tests : temps de recharge, choix de départ — valide, refusé, format —, les trois compétences, les quatre cartes, gélatons et meutes, la horde, vases, élan, pilote), `niveau.test.ts` (365 graines : camps, meutes, vases, `passageBloque` qui voit un mur de vases), `course.test.ts`, `xp.test.ts` (18 cartes), `bosses.test.ts`, `medailles.test.ts`, golden **régénéré** (+ la horde avec chaque compétence, un bouclier contre le grand-duc). **API** : `rush.test.ts` (compétence validée, coût d'un rejeu). **App** : `competences.test.ts`, `commandes`, `lisibilite`, `fin`. **E2e** (Chromium) : `competences.spec.ts` (le choix, chaque compétence au clic droit / E, un vase brisé, la horde) ; `partie`, `choix`, `boss`, `medailles`, `classement`, `determinisme`, `poids` adaptés (une compétence se choisit au départ).
- **Tests ajustés (l'économie a changé, ce n'est pas un affaiblissement)** : bornes de durée de `foncer` (40-95 s → 40-125 s, médiane 65-100 s) et du combat de boss (38-56 s → 35-85 s ; 6 cartes : 20 → 28 s), plancher de 15 % par stratégie suspendu (§5), `boss.spec` 120 → 240 ticks (une meute peut garder l'entrée de l'arène), le jour 295 de « blocage » remplacé par le jour 112 (le niveau a changé), `xpCamp` borné à 1 000 (la borne de 500 écrêtait le défaut). **« Foncer » ne gagne plus de niveau** : les essais qui jouent un jour entier avec des cartes (API, `choix.spec`) prennent « un peu d'XP », et deux essais du Diamant prennent le 7 novembre (`medailles.spec`).
- **Non vérifié** : **le ressenti** (rien n'a été joué à la main : la fauche, la lisibilité d'une meute, la dureté des meutes pour un humain) ; un vrai téléphone (poids de la horde, i/s, boutons) ; Firefox et WebKit (seul `determinisme` y tourne) ; l'anglais des nouvelles chaînes ; les sons (jamais écoutés) ; manette (RB) ; la règle M1 du kit pour l'écran du choix de départ.

## 9. Questions pour Nathan
1. **Une alerte ne coupe plus la course lancée** (§0, §4) : tu préfères l'ancien comportement et un coup d'élan réservé aux vases et aux monstres endormis ?
2. **L'économie** (§0, §5) : XP réduite, camps de 12 à 22, boss à 2 200 points de vie : farmer un minimum gagne deux jours sur trois, « beaucoup d'XP » reste à 7 %. Trop ? pas assez ? Les leviers sont `xpBase`, `xpPas`, `xpCamp`, `golemVie`, `campMax`.
3. **Un gélaton ne blesse que pendant son bond** : à garder pour tous les monstres (la gelée blesse encore au contact) ?
4. **Le bond mérite-t-il une secousse à l'atterrissage** (exception à la règle d'impact) ?
5. **Écho** (la première utilisation n'attend que la moitié du délai, une fois sur deux) te convient ? Les délais (15 / 10 / 8 s) sont à régler à la main.
6. **`ticksParUnite` 1 250** : à valider ; le pire rejeu coûte 0,5 à 0,8 s (BR1b : 0,24 s).
7. Hors lot (reporté de BR4) : actions `carte1` à `carte3` réglables (règle M2) et la règle M1 du kit pour les écrans de choix.
