import { Group, Mesh, MeshBasicMaterial, PlaneGeometry } from "three";
import { STEP, squashScale, type Look } from "../plateformes";

// Le personnage de plateformes (cube, deux yeux, deux pieds), **dessiné par Three.js** : un groupe à poser, une pose à donner à chaque image.
// Corps et pieds remplissent exactement la boîte de collision au repos (`largeur` × `hauteur`, en tuiles). Rien n'est créé après la construction.

/** Les pieds sont la couleur du corps assombrie de cette part. */
export const PIEDS_ASSOMBRIS = 0.45;

/** Mélange de la couleur avec le noir, arrondi par canal, (lot 8b) : la couleur des pieds est la même, au bit près, que depuis le premier jeu qui l'a dessinée. */
function assombrir(a: number, t: number): number {
  const m = (s: number) => Math.round(((a >> s) & 255) + (0 - ((a >> s) & 255)) * t) << s;
  return m(16) | m(8) | m(0);
}

export interface OptionsPersonnage {
  /** Couleur du corps (0xRRGGBB). */
  couleur: number;
  /** Boîte de collision du personnage (tuiles). */
  largeur: number;
  hauteur: number;
}

export interface PosePersonnage {
  look: Look;
  /** Part de l'écrasement appliquée (0 à 1). */
  squashAmount?: number;
  /** Clignement : 0 yeux ouverts, 1 fermés. */
  blink?: number;
}

export interface Personnage {
  /** Origine : bas-milieu de la boîte ; le jeu le pose (`position`) et l'ajoute à son monde. */
  groupe: Group;
  /**
   * Lot PG1 — **le point d'accroche d'un accessoire** (un bandeau, un chapeau, un sac) : un groupe vide, enfant du corps, que le jeu garnit comme il veut. Il **suit le corps** : l'écrasement et l'étirement (ancrés
   * en bas), le rebond, le penché (autour du bas du corps), la respiration, et le retournement que le jeu donne au `groupe` (`groupe.scale.y = -1` : la tête en bas). **Son origine est celle du `groupe` au repos** (bas-milieu de
   * la boîte de collision : un point à `y` = 0,7 est à 0,7 tuile au-dessus des pieds, comme les yeux à `PH × 0,62`) ; il ne se pose pas à chaque image (rien à faire : le corps l'emporte). Vide, il ne change rien au dessin.
   */
  accessoire: Group;
  /** Donne la pose de l'image : écrasement, rebond, penché, respiration, pieds, clignement et regard. */
  poser(pose: PosePersonnage): void;
}

export function creerPersonnage(options: OptionsPersonnage): Personnage {
  const { couleur, largeur: PW, hauteur: PH } = options;
  // `feet` : l'écrasement (ancré en bas) ; `torso` : corps et yeux (rebond, penché, respiration).
  const groupe = new Group();
  const feet = new Group();
  const torso = new Group();
  const bodyH = PH - STEP.leg;
  const body = new Mesh(new PlaneGeometry(PW, bodyH), new MeshBasicMaterial({ color: couleur }));
  body.position.set(0, bodyH / 2, 0);
  torso.add(body);
  torso.position.y = STEP.leg;
  const eyes = new Group();
  eyes.position.set(0, PH * 0.62 - STEP.leg, 0.05);
  const eyeWhite = new MeshBasicMaterial({ color: 0xffffff });
  const eyePupil = new MeshBasicMaterial({ color: 0x101820 });
  const pupils: Mesh[] = [];
  for (const dx of [-0.16, 0.16]) {
    const white = new Mesh(new PlaneGeometry(0.2, 0.26), eyeWhite);
    white.position.set(dx, 0, 0);
    const pupil = new Mesh(new PlaneGeometry(0.09, 0.14), eyePupil);
    pupil.position.set(dx, 0, 0.01);
    pupil.userData.baseX = dx;
    pupils.push(pupil);
    eyes.add(white, pupil);
  }
  // Lot PG1 : l'accroche d'un accessoire — enfant du corps, remise à l'origine de la boîte au repos (le corps est à `STEP.leg` du bas) : il suit l'écrasement, le rebond, le penché et la respiration.
  const accessoire = new Group();
  accessoire.position.y = -STEP.leg;
  torso.add(eyes, accessoire);
  feet.add(torso);
  const footMat = new MeshBasicMaterial({ color: assombrir(couleur, PIEDS_ASSOMBRIS) });
  const footGeo = new PlaneGeometry(STEP.footW, STEP.footH);
  const footMeshes = [new Mesh(footGeo, footMat), new Mesh(footGeo, footMat)];
  for (const f of footMeshes) {
    f.position.z = 0.02; // devant le corps : un pied replié se voit
    feet.add(f);
  }
  groupe.add(feet);

  return {
    groupe,
    accessoire,
    poser(pose) {
      const look = pose.look;
      const { sx, sy } = squashScale(look.squash, pose.squashAmount ?? 1);
      feet.scale.set(sx, sy, 1);
      // Rebond, penché (autour du bas du corps) et respiration ; les pieds, eux, restent où l'animation les pose.
      torso.position.y = STEP.leg + look.bob;
      torso.rotation.z = -look.lean;
      torso.scale.y = look.breath;
      for (let i = 0; i < 2; i++) footMeshes[i]!.position.set(look.feet[i * 2]!, look.feet[i * 2 + 1]! + STEP.footH / 2, 0.02);
      eyes.scale.y = 1 - 0.88 * (pose.blink ?? 0);
      const lookX = look.eyeX;
      eyes.position.x = lookX * 0.07;
      for (const p of pupils) {
        p.position.x = (p.userData.baseX as number) + lookX * 0.045;
        p.position.y = look.eyeY * 0.055;
      }
    },
  };
}
