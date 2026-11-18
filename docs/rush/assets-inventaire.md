# Rush — inventaire des packages Unity de Nathan et correspondance avec le bestiaire

Lot BR-A3 (2026-11-09). Source : le cache local de l'Asset Store (`%APPDATA%\Unity\Asset Store-5.x\`, 270 éditeurs). Les listes viennent du contenu des `.unitypackage` (lu sans extraire : `pathname` de chaque entrée). Licences : `docs/rush/licences-tiers.md`.
**Vérifié** = ouvert dans Blender (maillage, squelette, clips, rendu) ; **listé** = seulement le nom des fichiers.

## 1. Les trois « Monsters Ultimate Pack … Cute Series » (Meshtint Studio) — listés

Chaque créature : un maillage, une texture (1 à 4), un squelette, ~15 à 25 clips en FBX séparés (`<Nom>@<Clip>.FBX`), presque toujours en double « In Place » / « W Root ». Clips communs à presque toutes : Idle, Walk/Run/Fly Forward, Take Damage, Die, Cast Spell, Projectile Attack, Spawn, Underground, Turn Left/Right.

| pack | créatures (clips propres, en plus des communs) |
|---|---|
| **02 Cute** (152 Mo) | Bloom, Blossom (fleurs : Projectile Forward/Trajectory/Upward, Spawn, Underground), Bomb, Poison Bomb, Snow Bomb (Explode, Going To Explode, Dash), Bud (vole : Slash, Spin), Dragon Fire, Dragon Inferno (Tail, Wind, Jump), Dragon Spark, Hermit King (Hide, Hide And Spin, Stab, Summon), Practice Dummy, Target Dummy, Training Dummy (Stationary, Punch, Spin, Jump Smash), Shell (Hide, Roll), Snake, Snake Naga (Breath, Dash, Summon), Snakelet, Spike (Hide and Spin), Sun Blossom (Rest, Spin), Sunflora Pixie (Chanting, Channelling, Blow Petals), Sunflower Fairy, Werewolf (Pounce Smash), Wolf (Sniff, Happy), Wolf Pup |
| **09 Cute** (37 Mo) | Cyclops Bat, Cyclops Bat Mage (Summon, Clap, Slap, Spin), Cyclops Bat Wizard (Slice, Spin), Dragon Blizzard, Dragon Ice, Dragon Water (Blast, Wing), Imp Demon, Imp Devil (vol), Imp Mischief (Roll, Throw), **Treant Forest** (Clap, Kick, Smack, Step, Swing), Treant Minion, Treant Tree, Worm Creep, Worm Rot, Worm Stink (Roll) |
| **10 Cute Pro** (505 Mo) | Fish, Fish Man (Pierce, Pounce), Fish Merman (Trident), Octopus, Octopus Baby, **Octopus King** (Crown à part, Multishot), Shark, Shark Baby, Shark Humanoid, **Titan Turtle** (14 accessoires : casques, épées, carapace), Turtle, **Turtle Monster** (Roll Attack, Punch) |

Ni gelée, ni golem, ni hibou dans ces trois packs.

## 2. Les autres packages utiles

| pack | contenu | état |
|---|---|---|
| **Dungeon Mason — RPG Monster BUNDLE PBR** | Wave 01 : Slime, Golem, Bat, TurtleShell, MonsterPlant, Spider, Orc, Skeleton, EvilMage, Dragon ; Wave 02 : Beholder, Black Knight, Chest Monster, Crab, Flying Demon, Lizard Warrior, Rat Assassin, Specter, Werewolf, Worm ; Wave 03 : Battle Bee, Bishop Knight, Cactus, Cyclops, Demon King, Fishman, Mushroom, Naga Wizard, Salamander, Sting Ray. ~15 clips chacun (Idle Normal/Battle, Walk, Run, Attack01/02, GetHit, Dizzy, Die, Taunting, Victory, Sense Something). **Un seul atlas de couleur de 512 × 512 pour tout le pack** (des cases unies) | **vérifié** : Golem, Slime, Bat |
| **KayKit — Adventurers** (Kay Lousberg) | Knight, Barbarian, Mage, Rogue, Druid, Engineer, Ranger ; armes et boucliers à part ; ~90 clips partagés par le squelette `Rig_Medium` (Idle, Walking, Running, 1H/2H attacks, Dodge, Hit, Death, Block, Jump, Spawn…) | **vérifié** : Knight, sword_1handed, shield_round |
| KayKit — Skeletons | Skeleton Minion/Warrior/Mage/Rogue/Golem, Necromancer (même squelette `Rig_Medium`) | listé |
| Dungeon Mason — Modular Animal Knight Polyart | un corps, 8 têtes d'animaux (Hibou, Lion, Lapin…), 8 armures, 11 épées, 13 boucliers ; 60 clips (combo de 5 coups, roulades, esquives, Defend) | **vérifié** (facetté, écarté) |
| Dungeon Mason — Dog Knight PBR Polyart | un chien chevalier, épée, bouclier | listé |
| LilPupinduy — Enemy Golem | un golem, 9 clips (Attack1/2, AoE, Rise…) | listé |
| Décor (non ouverts, à inventorier au lot suivant) | JustCreate *Low Poly Fantasy Arena* (vol. 1 et 2), *Low Poly Dungeons*, *Stylized Low Poly Nature Lite* ; SICS Games *Toon Adventure Island* ; Polytope *Lowpoly Environment — Nature* ; Polyart *Dreamscape* ; MalkoVFX *Break Items — Toon VFX* ; YOHA *51 Low Poly Trees* | listés par nom seulement |

## 3. La correspondance proposée (la sim ne voit que des rayons : une créature peut changer d'apparence)

| Rush | meilleure candidate | ce qui manque / remarque |
|---|---|---|
| **chevalier** | KayKit Knight (+ épée, bouclier) — **essai fait** | pas de plume rouge ni d'armure jaune d'origine (les UV de l'armure et du casque sont déplacées vers d'autres cases de la palette) ; la roulade est un « Dodge » de 13 images ; pas de « coup d'élan » (le coup 1 suffit) |
| **gelée** | DM Slime — **essai faite** | un seul gros œil (la cible : deux points) ; plus petite et plus basse que la gelée de la cible à rayon égal (0,96 m de large, 0,81 m de haut) |
| **gélaton** | DM Slime réduit, recoloré en bleu (même modèle, une autre texture) | rien ; la horde demande l'animation cuite en texture (§ 5 du README) |
| **chauve-souris** | DM Bat — **essai faite** ; ou Meshtint Cyclops Bat | ailes repliées vers le bas dans tous ses clips : petite vue d'en haut ; la Cyclops Bat (ailes ouvertes) est à essayer |
| **cracheur** | Meshtint Bloom / Blossom (une fleur qui crache : Projectile Forward, Spawn, Underground) ; ou DM MonsterPlant | le crapaud devient une plante (acceptable : il ne bouge presque pas) |
| **chaman** | Meshtint Sunflora Pixie (Chanting, Channelling Attack : un soigneur qui « canalise ») ; ou DM EvilMage | rien |
| **totem** | Meshtint Target Dummy (Stationary, Cast Spell) ; ou Treant Tree | un totem animé est un mannequin : à juger |
| **porte-bouclier** | DM Bishop Knight (Defend, DefendHit, grand bouclier) ; ou Meshtint Hermit King (Hide) | rien |
| **golem** (boss) | DM Golem — **essai fait** ; ou LilPupinduy Enemy Golem (non ouvert) | penché en avant, « robot » plus que tas de roches ; deux attaques seulement (Attack01, Attack02) pour poing, onde et pierres |
| **reine gelée** | DM Slime ×3, recoloré turquoise, la couronne de l'Octopus King (Meshtint 10) | la division se fait par la sim (des petites gelées naissent) : aucun clip propre |
| **grand-duc** | aucun hibou ; Meshtint Cyclops Bat Mage (vole, Summon, Slap) ou DM Flying Demon | le hibou devient une grande chauve-souris mage (changement d'apparence assumé) |
| **bélier de carrière** | aucun bélier ; Meshtint Turtle Monster (Roll Attack : une charge roulée en boule) ou Titan Turtle | « étourdi contre le muret » : pas de clip Dizzy (le reprendre en procédural) |
| **vieux chêne** | Meshtint **Treant Forest** (Clap, Step, Projectile, Spawn) et ses Treant Minion (les sbires) | rien : la meilleure correspondance du lot |
| **vases** | aucun modèle repéré dans les packs de personnages ; à chercher dans JustCreate *Low Poly Dungeons* et MalkoVFX *Break Items* | les vases restent ceux du lot BR-A1 |
| **décor** | JustCreate *Low Poly Fantasy Arena* (une arène !) et *Toon Adventure Island* (îles flottantes) | non ouverts : à inventorier au lot suivant |

**Héros mignon** : KayKit Knight (rond, lisse, tête énorme) est le plus proche de la cible ; les chevaliers animaux de Dungeon Mason (hibou, chien) sont facettés et moins « cute ». **Cohérence de style** : Dungeon Mason (golem, gelée, chauve-souris) et KayKit vont bien ensemble (rond, aplats) ; Meshtint est plus détaillé et plus brillant (à essayer avant de mélanger).
