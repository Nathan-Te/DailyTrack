import { vitesseCamera } from "./camera";
import { CASE, CIBLE_CAMERA, FACTEUR_NORMAL, TICKS_PAR_SECONDE, VY_MAX } from "./constantes";
import { REGLES_COURANTES, type Regles } from "./regles";

// Le temps d'un vol et la longueur d'une course (lot GR1, déplacés ici au lot GR7 pour que le plan du jour et le générateur les partagent sans cycle d'imports).

/** Le nombre de pas d'une traversée verticale de `h` unités, partie de l'arrêt (la gravité de la partie, plafonnée à `VY_MAX`) : le temps d'un vol d'une surface à l'autre. Entier, comme tout ici. */
export function pasDeTraversee(h: number, regles: Regles = REGLES_COURANTES): number {
  let vy = 0;
  let y = 0;
  let pas = 0;
  while (y < h && pas < 1000) {
    vy = Math.min(VY_MAX, vy + regles.gravite);
    y += Math.trunc(vy / TICKS_PAR_SECONDE);
    pas++;
  }
  return pas;
}

/** Combien de colonnes (arrondi au-dessus) le joueur parcourt en `pas` pas quand il arrive à la colonne `colonne` : la vitesse de la caméra y est connue d'avance (elle ne dépend que de la distance). **C'est ce qui permet de poser les surfaces à la vitesse à laquelle le morceau sera abordé.** */
export function colonnesParcourues(pas: number, colonne: number, regles: Regles = REGLES_COURANTES, facteur: number = FACTEUR_NORMAL): number {
  const parPas = Math.trunc(vitesseCamera(Math.max(0, colonne * CASE - CIBLE_CAMERA), regles, facteur) / TICKS_PAR_SECONDE);
  return Math.trunc((pas * parPas + CASE - 1) / CASE);
}
