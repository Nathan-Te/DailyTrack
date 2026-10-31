import { Group, type Mesh } from "three";
import type { Expression } from "./expression";
import { cercle, rect } from "./formes";
import { SCENE } from "./palette";

// Les yeux d'une pièce (lot T5) — le dessin : deux yeux (contour d'encre, blanc, pupille) et deux sourcils, posés dans la plus grande boîte de la pièce, **droits dans son repère**. Ce module ne
// décide de rien : `expression.ts` (pure) dit comment les dessiner ; `appliquer` pose ces nombres sur les formes. Affichage seulement.
// Un œil qui se ferme s'écrase en hauteur (un trait d'encre) ; les sourcils sont deux barres d'encre ; aplats seulement, aucun dégradé.

interface Oeil {
  groupe: Group;
  pupille: Mesh;
  sourcil: Mesh;
  cote: -1 | 1;
}

/** Les distances de l'œil normal, en mètres pour une pièce de taille 1 (celles d'avant le lot T5). */
const ECART = 0.17;
const R_ENCRE = 0.21;
const R_BLANC = 0.18;
const R_PUPILLE = 0.075;

export class Yeux {
  private readonly yeux: Oeil[] = [];
  /** La phase de tremblement de cette pièce (tirée du hasard d'affichage) : deux pièces n'ont pas le même. */
  constructor(
    readonly parent: Group,
    private readonly ex: number,
    private readonly ey: number,
    private readonly echelle: number,
    private readonly phase = 0,
  ) {
    for (const cote of [-1, 1] as const) {
      const g = new Group();
      g.position.set(ex + cote * ECART * echelle, ey, 0);
      g.add(cercle(SCENE.encre, 0, 0, R_ENCRE * echelle, 0.02));
      g.add(cercle(SCENE.papier, 0, 0, R_BLANC * echelle, 0.03));
      const pupille = cercle(SCENE.encre, 0.02 * echelle, -0.04 * echelle, R_PUPILLE * echelle, 0.04);
      g.add(pupille);
      parent.add(g);
      const sourcil = rect(SCENE.encre, ex + cote * ECART * echelle, ey + 0.3 * echelle, 0.3 * echelle, 0.065 * echelle, 0.045);
      sourcil.visible = false;
      parent.add(sourcil);
      this.yeux.push({ groupe: g, pupille, sourcil, cote });
    }
  }

  /** Pose une expression : l'échelle et la fermeture des yeux, la place et la taille des pupilles (avec leur tremblement), les sourcils. `t` : le temps d'affichage (secondes). */
  appliquer(x: Expression, t: number): void {
    const e = this.echelle;
    const libre = (R_BLANC - R_PUPILLE * x.pupille) * e * 0.85;
    for (const o of this.yeux) {
      o.groupe.scale.set(x.ouverture, x.ouverture * (1 - 0.9 * x.fermeture), 1);
      const tx = x.tremble > 0 ? Math.sin(t * 41 + this.phase + o.cote) * x.tremble : 0;
      const ty = x.tremble > 0 ? Math.cos(t * 37 + this.phase * 1.7 + o.cote) * x.tremble : 0;
      o.pupille.position.set(Math.max(-1, Math.min(1, x.regardX + tx)) * libre, Math.max(-1, Math.min(1, x.regardY + ty)) * libre, 0.04);
      o.pupille.scale.set(R_PUPILLE * e * x.pupille, R_PUPILLE * e * x.pupille, 1);
      o.sourcil.visible = x.sourcils && x.fermeture < 0.9;
      if (o.sourcil.visible) {
        o.sourcil.position.set(this.ex + o.cote * ECART * e, this.ey + (0.27 + x.sourcilHaut) * e * x.ouverture, 0.045);
        // Inquiet : le bout intérieur monte (l'œil gauche, côté +x ; le droit, côté −x).
        o.sourcil.rotation.z = -o.cote * x.sourcilAngle;
      }
    }
  }
}
