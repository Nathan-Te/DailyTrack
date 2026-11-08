# Lot BR6 — Rush : le contenu (nouveaux ennemis, élites, run longue, équilibre)

Suite de BR5 (fusionné). Jeu `off` : golden **régénéré**, `RUSH_SIM_VERSION` 8 → **9**, `RUSH_GENERATOR_VERSION` 6 → **7**, `RUSH_BOT_VERSION` 2 → **3** (aucune n'a été servie). **Pour les joueurs : rien** (jeu `off`).

## 0. Décisions de Nathan appliquées
- Une alerte ne coupe pas une course lancée (gardé). **Aucun dégât de contact** pour tous les monstres : on ne blesse que par une attaque annoncée (bond, plongeon, projectile, coup de bouclier). Le bond a une légère secousse à l'atterrissage, pas d'arrêt sur image. Écho et délais (15 / 10 / 8 s) gardés.
- Médailles de la fiche : **150 / 200 / 300 %** (`medailles.bareme`) ; bronze plafonné sous 10 min. `rejeu.ticksParUnite` : **1 250 → 2 500** (voir §6).

## 1. Le bestiaire (`monstres.ts`, règles dans `partie.ts`, rendu dans `ennemisVue.ts`)
| ennemi | vie | rôle | comportement |
|---|---|---|---|
| gelée, chauve-souris, gélaton | 30 / 10 / 10 | horde | inchangés, sans contact |
| **cracheur** | 20 | distance | garde ses distances, ligne au sol annoncée puis projectile lent esquivable ; le bouclier ou un coup le détruit |
| **chaman** | 30 | soutien | −70 % de dégâts sur les alliés proches (aura + lien visibles), fuit, n'attaque pas ; sa mort lève la protection ; cible prioritaire |
| **totem** | 90 | invocateur | fixe, 3 gélatons toutes les ~6 s, 12 vivants au plus |
| **porte-bouclier** | 70 | tank | bloque les coups de face (étincelles et son distincts), coup de bouclier annoncé, vulnérable de dos / de flanc ou ~1,5 s après son coup ; le bond l'étourdit |
- Lisibilité : silhouettes distinctes, ΔE ≥ 40 contre les deux tons du sol de chaque thème, pas de rouge hors danger (tests de `apps/rush/test/lisibilite.test.ts`).
- **Élites** : n'importe quel monstre, taille ×1,5, vie ×5, attaques un peu plus rapides, couronne et halo, ×10 d'XP, un cœur garanti ; 1 par camp au plus, dans ~1 camp sur 2, à partir de 45 % du chemin.
- **Courbe** (`poidsAuProgres`) : début gelées / gélatons / chauves-souris ; dès 35 % cracheurs et chamans ; dès 65 % porte-boucliers et totems. Plafonds par camp : cracheur 2, chaman 2, totem 1, porte-bouclier 2.

## 2. La run longue
- Niveau de **140 à 205 m** (70 à 100 avant), 3 à 5 détours, camps de 13 à 22 monstres à 40-110 m du chemin, 4 à 9 groupes. Aucun passage de plus de ~4 s sans rencontre (test).
- **Salle d'épreuve** à mi-parcours (obligatoire) : les portes se ferment, 3 vagues (8 à 15 monstres, ~30-40 s), les portes rouvrent ; un cœur par vague à partir de la 2ᵉ et deux à la fin ; XP ×1,5 par vague de base 150. Même « foncer » y gagne 3 ou 4 niveaux.
- Niveaux jusqu'à ~20. **Boss : 7 500 points de vie** (2 200 avant) en gardant les rapports relatifs de BR3 ; un cœur chaque cinquième de vie perdu.
- **6 cartes de fin de partie** (24 au total) : frénésie (niv. 8), lame enflammée (9), écrasement (10), seconde charge (10), bond sismique (11, compétence bond), bouclier ricochet (11, compétence bouclier). Elles raccourcissent le boss de moitié environ avec la construction du pilote.

## 3. Temps et répartition (pilote de référence, 365 jours)
| stratégie | victoires | min / médiane / max | la plus rapide |
|---|---|---|---|
| foncer | 362 / 365 | 1:45 / **3:08** / 5:17 | 40 % |
| un peu d'XP | 349 / 365 | 1:41 / **2:58** / 5:12 | 42 % |
| beaucoup d'XP | 344 / 365 | 2:13 / **3:25** / 5:09 | 18 % |
- **Les cibles de durée ne tiennent pas avec la règle d'équilibre** (voir §7). Diamant 365 / 365 (médiane 166 s). Boss : ≥ 58 / 60 pour chacun, sans carte (combat 180-217 s, chêne 152 s) et 60 / 60 avec ses cartes.

## 4. Médailles et pilote humanisé
- Médiane Diamant / or / argent / bronze : 166 / 249 / 333 / 499 s. Pilote humanisé (meilleur de 3) : victoire 342 / 365 ; au moins or 93 %, argent 94 %, Diamant 42 %. Joueur 1,5× plus lent : or 42 %, argent 90 %, bronze 94 % ; 2× plus lent : 2 / 42 / 93 %.
- Le pilote apprend : chaman et totem d'abord, porte-boucliers par le flanc, esquive des crachats et du coup de bouclier, ramasse les cœurs.

## 5. Performance
- Rejeu (Node, cette machine) : foncer (2026-11-05, 13 856 ticks) **25 ms** (≤ 60) ; beaucoup d'XP (17 793 ticks) **43 ms** (≤ 120) ; pire jour de niveau 27 ms ; pire absolu artificiel (80 monstres éveillés groupés, 10 min) **1,06 s** (budget 1 s : dépassé de 6 % sur un cas que le jeu ne produit pas ; les vrais jours restent à 27 ms). Leviers : monstres loin non mis à jour (`actifs`, cellules de 12 m), balayage trié, aucune allocation par tick.
- Génération du niveau : ~50 ms en moyenne, cache de 64. Calcul des médailles d'un jour : 451 ms.
- Taille d'un rejeu de 3-5 min : ~12 à 16 k caractères (limite 40 000).
- `ticksParUnite` 2 500 : une partie normale pèse ~6 unités (~100 parties / minute), « beaucoup d'XP » ~8, la pire 15 (~40 / minute).

## 6. Scénarios (liens dans la réponse finale)
`bestiaire-monstres` (`&theme=`), `camp` (`&ennemis=…&elite=1&competence=`), `epreuve`, `jour`, `carte&jours=7`, `medailles&jours=7`. Captures : `docs/rush/lots/br6-*.png`.

## 7. Questions pour Nathan
1. **Cibles de durée vs répartition** : avec les cibles (foncer 2:30, beaucoup 4-5 min) et la règle de 15-60 %, impossible : « beaucoup d'XP » ne peut pas être plus long sans cesser d'être la plus rapide un jour sur six. Mesuré 3:08 / 2:58 / 3:25. Garder cet équilibre, ou ajuster les cibles ?
2. Pertes du pilote (3 à 6 % des jours) dans les camps et l'épreuve : acceptable pour un humain ?
3. Grille de médailles pour un joueur 1,5× plus lent : or seulement 42 %, voulu ?
4. Pire cas de rejeu à 1,06 s (artificiel) : je n'ai pas bridé le jeu pour ça.

## 8. Ce qui n'est pas vérifié
- Le ressenti en main (cracheur, bouclier, épreuve) et les 10 nouveaux sons : rien n'a été joué ni entendu.
- Les performances sur téléphone réel ; les appels de dessin et le poids du premier chargement : voir la section Mesures de la PR / `budgets.md`.
