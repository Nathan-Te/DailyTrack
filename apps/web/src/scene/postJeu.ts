// Lot 47 — **le post-traitement du jeu** (palier 3, ordinateur seulement), chargé à la demande (`PAS_DU_JEU.post`, un `import()`) : le halo des lumières fortes
// (fort la Nuit, discret le jour), l'étalonnage de chaque thème et l'anticrénelage FXAA, en passes plein écran sur une scène dessinée dans une cible
// en demi-flottants (`post.ts`, le code de la vitrine sans l'occlusion ni SMAA). **Aucune de ces passes sur un téléphone** : `main.ts` ne demande ce module que
// si `passesPermises` (qualite.ts : un ordinateur, des demi-flottants rendables, 4 Go) et que la scène est au palier 3 ; le réglage « Maximale » n'y change rien.
//
// - **Garde-fous** : une perte de contexte WebGL coupe la chaîne **à l'instant** (ses cibles n'existent plus ; le jeu dessine alors directement, la course
//   continue : elle ne dépend pas de l'image) et le jeu redescend au palier 2 avec la vie et le ciel à la prochaine pause ; une chaîne qui échoue deux images de suite
//   (cible refusée : `GardePost`) fait de même. **La chaîne ne s'allume ni ne s'éteint en course** : c'est `main.ts` qui choisit le moment (accueil, pause, arrivée,
//   podium) ; seule une panne ne peut pas attendre, et une chaîne qui ne dessine pas est déjà coupée.
// - **Les nuanceurs qui écrivent des couleurs d'écran** (halos, particules des effets) sont passés en lumière linéaire à la volée (`lineaire.ts`) tant que la chaîne
//   dessine, et rendus à l'écran direct quand elle s'éteint.
// Le temps d'image est celui de la carte graphique : la règle de qualité (lot 45) mesure la scène **avec** la chaîne à l'accueil et redescend si elle ne tient pas.
import { Vector2, type PerspectiveCamera, type Scene, type WebGLRenderer } from "three";
import type { PaletteName } from "@cdj/sim";
import { brancherPas } from "./socle";
import { ChainePost, type ReglagesPost } from "./post";
import { adapter, restituer } from "./lineaire";
import { POST_3 } from "./themesPost";

/** Ce qui a coupé la chaîne : la perte du contexte WebGL, ou deux images de suite où elle n'a pas pu dessiner. */
export type RaisonCoupure = "contexte" | "echecs";

/** Les parties de la chaîne (`?reglages=3-halo`, `3-etalonnage`, `3-fxaa`, `3-post` : sans rien). */
export interface PartiesPost {
  halo: boolean;
  etalonnage: boolean;
  anticrenelage: boolean;
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
  readonly chaine: ChainePost;
  readonly garde = new GardePost();
  private derniere: Scene | null = null;
  private vivante = true;
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
  ) {
    this.chaine = new ChainePost(renderer);
    renderer.domElement.addEventListener("webglcontextlost", this.perdu);
  }

  get active(): boolean {
    return this.vivante;
  }

  /** Dessine une image ; faux si la chaîne n'a pas pu (ou n'existe plus) : dessiner directement. */
  dessiner(scene: Scene, camera: PerspectiveCamera, palette: PaletteName, exposition: number): boolean {
    if (!this.vivante) return false;
    this.derniere = scene;
    adapter(scene);
    const d = this.renderer.getDrawingBufferSize(tampon);
    const r: ReglagesPost = { ...this.parties, theme: POST_3[palette], exposition };
    const ok = this.forcerEchec > 0 ? (this.forcerEchec--, false) : this.chaine.rendre(scene, camera, d.x, d.y, r);
    if (this.garde.image(ok)) {
      this.lacher();
      this.surCoupure("echecs");
    }
    return ok;
  }

  /** Mémoire des cibles (octets, calculée), pour `?debug`. */
  octets(): number {
    return this.vivante ? this.chaine.octets(this.parties) : 0;
  }

  /** Éteint la chaîne : les nuanceurs reviennent à l'écran direct, les cibles sont libérées. Sans effet la deuxième fois. */
  lacher(): void {
    if (!this.vivante) return;
    this.vivante = false;
    this.renderer.domElement.removeEventListener("webglcontextlost", this.perdu);
    if (this.derniere) restituer(this.derniere);
    this.chaine.dispose();
  }
}

const tampon = new Vector2();

/** Le module enregistre son pas dans la scène du jeu (un pas sans rien à poser : la scène sait ainsi que la chaîne est demandée). */
brancherPas("post", { id: "post" });
