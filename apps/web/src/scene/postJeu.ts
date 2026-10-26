// Lot 47 — **le post-traitement du jeu** (palier 3, ordinateur seulement), chargé à la demande (`PAS_DU_JEU.post`, un `import()`) : le halo des lumières fortes
// (la Nuit et le Néon seulement depuis le lot 50), l'étalonnage de chaque thème et l'anticrénelage FXAA. Lot 50 : la chaîne de `post.ts` (une seule passe de
// fin, une cible de 4 octets par pixel, le halo sans passe à la taille de l'écran) ; `?chaine=47` (recette, aperçus, le temps du lot) reprend celle du lot 47.
// **Mode copie** (lot 50) : un moteur créé sans multi-échantillonnage (la chaîne était voulue au chargement) qui n'a plus la chaîne dessine quand même par elle,
// toutes parties coupées (`COPIE`) : la scène multi-échantillonnée dans sa cible, puis la tonalité seule — jamais une image crénelée. **Aucune de ces passes sur un téléphone** : `main.ts` ne demande ce module que
// si `passesPermises` (qualite.ts : un ordinateur, des demi-flottants rendables, 4 Go) et que la scène est au palier 3 ; le réglage « Maximale » n'y change rien.
//
// - **Garde-fous** : une perte de contexte WebGL coupe la chaîne **à l'instant** (ses cibles n'existent plus ; le jeu dessine alors directement, la course
//   continue : elle ne dépend pas de l'image) et le jeu redescend au palier 2 avec la vie et le ciel à la prochaine pause ; une chaîne qui échoue deux images de suite
//   (cible refusée : `GardePost`) fait de même. **La chaîne ne s'allume ni ne s'éteint en course** : c'est `main.ts` qui choisit le moment (accueil, pause, arrivée,
//   podium) ; seule une panne ne peut pas attendre, et une chaîne qui ne dessine pas est déjà coupée.
// - **Les nuanceurs qui écrivent des couleurs d'écran** (halos, particules des effets) lisent `SORTIE_LINEAIRE` (halo.ts), que la chaîne met à 1 le temps de
//   dessiner la scène : plus aucun parcours des matériaux à chaque image (lot 50).
// Le temps d'image est celui de la carte graphique : la règle de qualité (lot 45) mesure la scène **avec** la chaîne à l'accueil et redescend si elle ne tient pas.
import { Vector2, type Object3D, type PerspectiveCamera, type WebGLRenderer } from "three";
import type { PaletteName } from "@cdj/sim";
import { brancherPas } from "./socle";
import { ChainePost, avecHalo, type ReglagesPost } from "./post";

export { ChainePost, formeDuJeu } from "./post";
import { POST_3 } from "./themesPost";

/** Ce qui a coupé la chaîne : la perte du contexte WebGL, ou deux images de suite où elle n'a pas pu dessiner. */
export type RaisonCoupure = "contexte" | "echecs";

/** Les parties de la chaîne (`?reglages=3-halo`, `3-etalonnage`, `3-fxaa`, `3-post` : sans rien). */
export interface PartiesPost {
  halo: boolean;
  etalonnage: boolean;
  anticrenelage: boolean;
}
/** Lot 50 : le mode copie (moteur sans multi-échantillonnage, chaîne non voulue) : la scène multi-échantillonnée et la tonalité, rien d'autre. */
export const COPIE: PartiesPost = { halo: false, etalonnage: false, anticrenelage: false };

/** Ce que `PostJeu` demande à une chaîne (`ChainePost` du lot 50, ou celle du lot 47 sous `?chaine=47`). */
export interface Chaine {
  appels: number;
  triangles: number;
  /** La cible de la scène (`?debug` : ses échantillons). */
  scene: { samples: number } | null;
  /** Lot 50 : l'échelle de la scène par rapport à l'écran (plafond de pixels) ; absente : 1. */
  readonly echelle?: number;
  rendre(scene: Object3D, camera: PerspectiveCamera, w: number, h: number, r: ReglagesPost): boolean;
  octets(r: Pick<ReglagesPost, "halo" | "theme">): number;
  preparer?(scene: Object3D, camera: PerspectiveCamera, w: number, h: number, r: Omit<ReglagesPost, "exposition">): Promise<void>;
  dispose(): void;
}

/** Les garde-fous, sans WebGL (testés) : images ratées de suite, et ce qui a coupé la chaîne. */
export class GardePost {
  echecs = 0;
  raison: RaisonCoupure | null = null;
  /** Une image : `ok` ou non ; rend vrai si deux échecs de suite viennent de couper la chaîne. */
  image(ok: boolean): boolean {
    this.echecs = ok ? 0 : this.echecs + 1;
    if (this.echecs >= 2 && !this.raison) {
      this.raison = "echecs";
      return true;
    }
    return false;
  }
  /** Le contexte WebGL est perdu. */
  perte(): void {
    this.raison ??= "contexte";
  }
}

/** La chaîne du jeu : dessine la scène du jeu avec ses passes, ou rend faux (l'appelant dessine alors directement). */
export class PostJeu {
  readonly chaine: Chaine;
  readonly garde = new GardePost();
  private vivante = true;
  private palette: PaletteName = "stade";
  /** Essais : les prochaines images échouent (`__cdj.post.echouer(2)`). */
  forcerEchec = 0;
  private readonly perdu = () => {
    this.garde.perte();
    this.lacher();
    this.surCoupure("contexte");
  };

  constructor(
    private readonly renderer: WebGLRenderer,
    readonly parties: PartiesPost,
    /** La chaîne vient d'être coupée (perte du contexte, deux échecs) : `main.ts` redescend au palier 2 avec la vie et le ciel. */
    private readonly surCoupure: (raison: RaisonCoupure) => void,
    fabrique: (r: WebGLRenderer) => Chaine = (r) => new ChainePost(r),
  ) {
    this.chaine = fabrique(renderer);
    renderer.domElement.addEventListener("webglcontextlost", this.perdu);
  }

  get active(): boolean {
    return this.vivante;
  }

  /** Lot 50 : l'échelle de la scène par rapport à l'écran (1 sans plafond de pixels) : la taille à l'écran de ce qui est dessiné en pixels s'y règle. */
  get echelle(): number {
    return this.vivante ? (this.chaine.echelle ?? 1) : 1;
  }

  /** Lot 50 : le halo est-il dessiné (la Nuit et le Néon seulement, et pas coupé) ? */
  get halo(): boolean {
    return this.vivante && this.parties.halo && avecHalo(POST_3[this.palette]);
  }

  /** Dessine une image ; faux si la chaîne n'a pas pu (ou n'existe plus) : dessiner directement. */
  dessiner(scene: Object3D, camera: PerspectiveCamera, palette: PaletteName, exposition: number): boolean {
    if (!this.vivante) return false;
    this.palette = palette;
    const d = this.renderer.getDrawingBufferSize(tampon);
    const r: ReglagesPost = { ...this.parties, theme: POST_3[palette], exposition };
    const ok = this.forcerEchec > 0 ? (this.forcerEchec--, false) : this.chaine.rendre(scene, camera, d.x, d.y, r);
    if (this.garde.image(ok)) {
      this.lacher();
      this.surCoupure("echecs");
    }
    return ok;
  }

  /** **Hors course** (lot 50) : compile d'avance les programmes de la scène dans la cible et ceux des passes (`compileAsync`). */
  preparer(scene: Object3D, camera: PerspectiveCamera, palette: PaletteName): Promise<void> {
    if (!this.vivante || !this.chaine.preparer) return Promise.resolve();
    const d = this.renderer.getDrawingBufferSize(tampon);
    return this.chaine.preparer(scene, camera, d.x, d.y, { ...this.parties, theme: POST_3[palette] }).catch(() => undefined);
  }

  /** Mémoire des cibles (octets, calculée), pour `?debug`. */
  octets(): number {
    return this.vivante ? this.chaine.octets({ halo: this.parties.halo, theme: POST_3[this.palette] }) : 0;
  }

  /** Éteint la chaîne : les cibles sont libérées. Sans effet la deuxième fois. */
  lacher(): void {
    if (!this.vivante) return;
    this.vivante = false;
    this.renderer.domElement.removeEventListener("webglcontextlost", this.perdu);
    this.chaine.dispose();
  }
}

const tampon = new Vector2();

/** Le module enregistre son pas dans la scène du jeu (un pas sans rien à poser : la scène sait ainsi que la chaîne est demandée). */
brancherPas("post", { id: "post" });
