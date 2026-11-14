import { CASE, LARGEUR_MORCEAU, MORCEAUX_PAR_THEME, MULT_MAX, NB_THEMES, PIECES_PAR_PALIER, POINTS_GEMME, POINTS_PIECE } from "./constantes";
import { terrainDuJour, type Contenu } from "./generateur";
import type { Seuils } from "./types";

// Les seuils des médailles, **provisoires** (lot GR1) : calculés « sur le papier », comme `seuilsDuJour()` de la maquette — un robot qui prendrait toutes les pièces et toutes les gemmes de ce qu'il traverse, sans
// jamais en rater une, et qui irait jusqu'à la fin du 1er, du 2e et du 3e thème, puis de la boucle des cinq thèmes. **Chaque seuil vaut 60 % de la distance plus de tout ce qui se ramasse jusque-là** (arrondi à 10 près).
// Le lot GR2 remplace ce calcul par le vrai robot (qui suit le chemin sûr de chaque morceau) : `GRAVITY_BOT_VERSION` passera à 2. **Un jour figé garde les seuils de son fichier** (`jours.ts`), jamais ceux du calcul.

/** Le pourcentage du score du robot que vaut un seuil (seed : « 60 % »). Il se règle par Nathan. */
export const POURCENT_DU_ROBOT = 60;
/** Les fins de l'étape de chaque médaille, en nombre de thèmes parcourus : bronze 1, argent 2, or 3, Diamant la boucle des cinq. */
const THEMES_PAR_MEDAILLE = { bronze: 1, silver: 2, gold: 3, author: 5 } as const;

/** Le score d'un robot parfait arrêté à `distance` cases du départ : la distance plus pièces et gemmes dans l'ordre où elles se croisent, avec le multiplicateur. */
function scoreDuRobot(contenu: Contenu, distance: number): number {
  const terrain = terrainDuJour(contenu);
  const objets: { x: number; gemme: boolean }[] = [];
  const morceaux = Math.trunc((distance + LARGEUR_MORCEAU - 1) / LARGEUR_MORCEAU);
  for (let k = 0; k < morceaux; k++) {
    const m = terrain.morceau(k);
    for (const p of m.pieces) objets.push({ x: p.x, gemme: false });
    for (const g of m.gemmes) objets.push({ x: g.x, gemme: true });
  }
  objets.sort((a, b) => a.x - b.x);
  let chaine = 0;
  let mult = 1;
  let points = 0;
  for (const o of objets) {
    if (o.x >= distance * CASE) break;
    if (o.gemme) points += POINTS_GEMME * mult;
    else {
      chaine++;
      mult = Math.min(MULT_MAX, 1 + Math.trunc(chaine / PIECES_PAR_PALIER));
      points += POINTS_PIECE * mult;
    }
  }
  return distance + points;
}

/** Les seuils provisoires d'un jour (jamais ceux du fichier de jour : voir `seuilsDuJour`). */
export function seuilsSurLePapier(contenu: Contenu): Seuils {
  const seuil = (themes: number): number => Math.trunc((scoreDuRobot(contenu, themes * MORCEAUX_PAR_THEME * LARGEUR_MORCEAU) * POURCENT_DU_ROBOT + 500) / 1000) * 10;
  return { bronze: seuil(THEMES_PAR_MEDAILLE.bronze), silver: seuil(THEMES_PAR_MEDAILLE.silver), gold: seuil(THEMES_PAR_MEDAILLE.gold), author: seuil(NB_THEMES) };
}

/** Des seuils valides : quatre entiers positifs, strictement croissants. */
export const seuilsValides = (s: unknown): s is Seuils => {
  if (typeof s !== "object" || s === null) return false;
  const { bronze, silver, gold, author } = s as Partial<Seuils>;
  const ok = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n >= 1;
  return ok(bronze) && ok(silver) && ok(gold) && ok(author) && bronze < silver && silver < gold && gold < author;
};

/**
 * **Les seuils d'un jour tel qu'on le sert** : ceux figés avec le jour s'il vient d'un fichier de jour (`Contenu.seuilsFiges`), sinon le calcul provisoire. Le serveur et le jeu passent par cette seule fonction :
 * changer le calcul ne change jamais un jour déjà figé.
 */
export const seuilsDuJour = (contenu: Contenu): Seuils => contenu.seuilsFiges ?? seuilsSurLePapier(contenu);
