# Rush — licences des assets tiers

Tenu à jour par chaque lot qui convertit un asset tiers (lot BR-A3 : premier essai). **Aucun fichier issu d'un pack ne se commite : le dépôt `Nathan-Te/DailyTrack` est PUBLIC** (vérifié le 2026-11-09 par `gh repo view --json visibility` : `PUBLIC`). Les packs restent dans le cache de l'Asset Store de la machine de Nathan ; la chaîne de conversion (`apps/rush/modeles-tiers/`, des scripts) les lit là, écrit ses fichiers dans des dossiers ignorés par git (`apps/rush/modeles-tiers/.brut/`, `build/`, `apps/rush/public/modeles-tiers/`), et le jeu ne les charge que hors production, s'ils sont présents.

## Les packs

Licences lues le 2026-11-09 sur les pages de l'Asset Store (encadré de licence ; la description de la page demande JavaScript et n'a pas été lue). Aucun n'est marqué « Restricted Asset », aucun n'affiche de licence non standard.

| pack | éditeur | page | licence | ce qu'on en utilise (essai BR-A3) |
|---|---|---|---|---|
| RPG Monster BUNDLE PBR | Dungeon Mason | [260493](https://assetstore.unity.com/packages/3d/characters/creatures/rpg-monster-bundle-pbr-260493) | Standard Unity Asset Store EULA | Golem, Slime, Bat (maillages, 31 clips) et l'atlas de couleur commun (`Albedo.png`, recoloré) |
| KayKit - Adventurers Character Pack (for Unity) | Kay Lousberg | [290679](https://assetstore.unity.com/packages/package/290679) | Standard Unity Asset Store EULA | Knight (sans la cape), `sword_1handed`, `shield_round`, la texture du chevalier, 11 clips du squelette `Rig_Medium` |
| Modular Animal Knight Polyart | Dungeon Mason | [135722](https://assetstore.unity.com/packages/3d/characters/animals/modular-animal-knight-polyart-135722) | Standard Unity Asset Store EULA | rien (inventorié, essayé dans Blender, écarté pour le chevalier) |
| Dog Knight PBR Polyart | Dungeon Mason | [135227](https://assetstore.unity.com/packages/3d/characters/animals/dog-knight-pbr-polyart-135227) | Standard Unity Asset Store EULA | rien (inventorié) |
| Monsters Ultimate Pack 02 Cute Series | Meshtint Studio | [179083](https://assetstore.unity.com/packages/3d/characters/creatures/monsters-ultimate-pack-02-cute-series-179083) | Standard Unity Asset Store EULA | rien (inventorié : `docs/rush/assets-inventaire.md`) |
| Monsters Ultimate Pack 09 Cute Series | Meshtint Studio | [237084](https://assetstore.unity.com/packages/3d/characters/creatures/monsters-ultimate-pack-09-cute-series-237084) | Standard Unity Asset Store EULA | rien (inventorié) |
| Monsters Ultimate Pack 10 Cute Pro Series | Meshtint Studio | [330576](https://assetstore.unity.com/packages/3d/characters/creatures/monsters-ultimate-pack-10-cute-pro-series-330576) | Standard Unity Asset Store EULA | rien (inventorié) |
| Enemy Golem | Lil_Pupinduy | [211406](https://assetstore.unity.com/packages/3d/characters/creatures/enemy-golem-211406) | Standard Unity Asset Store EULA | rien (repéré, non ouvert) |

Le champ « License type : Extension Asset » paraît sur toutes ces pages (et sur des packs d'art témoins) : il règle le nombre de postes de travail, pas l'usage dans un jeu. **KayKit** existe aussi en CC0 sur itch.io d'après des sources tierces (non vérifié sur place) : en prendre les fichiers là ôterait l'EULA pour le chevalier — à vérifier par Nathan sur la page itch.io de l'offre.

## Ce que l'EULA standard permet et interdit (lecture, pas un avis juridique)

- **Permis** (EULA du 4 décembre 2024, § 2.2.1 ; FAQ d'Unity de juillet 2025) : intégrer l'asset dans un produit, le **modifier** pour cela (conversion glTF, recoloration, échelle), le distribuer **incorporé et embarqué** dans ce produit, y compris hors du moteur Unity (un jeu Three.js).
- **Interdit** : le redistribuer comme fichier autonome (téléchargement séparé, dépôt public, paquet de fichiers sources), le partager avec qui ne l'a pas acheté, entraîner une IA dessus. Un jeu web sert forcément ses glTF au navigateur : la limite concrète est de ne jamais les proposer comme fichiers à part.
- Donc : **les assets ne vivent que dans le jeu construit**, jamais dans le dépôt, jamais en téléchargement séparé.

## Avant de les mettre en production (décision de Nathan)

Deux voies, à trancher avant tout lot qui servirait ces modèles aux joueurs :
1. **Rendre le dépôt privé** : les `.glb` convertis se commitent alors avec le jeu (comme ceux du lot BR-A1), la CI les construit et les sert.
2. **Garder le dépôt public** et brancher un **stockage privé hors dépôt** au déploiement : un seau privé (par exemple un bucket Google Cloud non public) où `npm run modeles-tiers` dépose les `.glb`, que l'étape de construction de la mise en production télécharge dans `apps/rush/public/modeles-tiers/` avec un secret de la CI. La CI de PR, elle, n'en a pas besoin (le jeu retombe sur les formes procédurales et `e2e/modeles-tiers.spec.ts` vérifie les deux cas).
