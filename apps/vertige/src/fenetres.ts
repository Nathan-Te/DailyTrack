import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { M, PORTAIL_DEMI_H, PORTAIL_DEMI_L, PORTAIL_PROFONDEUR, geo, liaisons, type Liaison, type Niveau } from "@cdj/vertige-sim";

// Les fenêtres des portails (lot V1) : ce que l'on voit à travers un portail, sur UN SEUL niveau de profondeur.
//   · Chaque portail est une « fenêtre » : un pavé fin juste DERRIÈRE son plan (dans la poche, 15 cm), dessiné par ses faces arrière, qui montre une texture en coordonnées d'écran.
//   · Cette texture est la scène vue par la caméra VIRTUELLE : la caméra du joueur passée à travers le portail (même rotation et même translation que la traversée de la simulation), coupée au plan de l'autre portail
//     (rien de ce qui est derrière l'autre mur ne se dessine). Les autres fenêtres y sont des aplats roses : un portail vu dans un portail n'a pas de profondeur de plus.
//   · La COUTURE est invisible : quand l'œil passe le plan d'un portail (avant ou après le centre de la boîte, que la simulation téléporte), la caméra est replacée de l'autre côté par la même transformation ; la vue
//     est donc continue, image par image (`poser`).
const BORD = 0.01; // la fenêtre est plus petite que l'ouverture de 1 cm par côté : pas de scintillement avec les murs de la poche
const FOND = 0.15; // elle est au fond de la poche, à 15 cm du plan : la caméra ne la coupe jamais avec son plan proche
const TOLERANCE = 0.3; // marge latérale et en profondeur du test « l'œil est dans la poche »

const metres = (v: readonly [number, number, number]): THREE.Vector3 => new THREE.Vector3(v[0] / M, v[1] / M, v[2] / M);
const unite = (v: readonly [number, number, number]): THREE.Vector3 => new THREE.Vector3(v[0], v[1], v[2]);

interface Fenetre {
  liaison: Liaison;
  centre: THREE.Vector3;
  n: THREE.Vector3;
  u: THREE.Vector3;
  r: THREE.Vector3;
  vers: { centre: THREE.Vector3; n: THREE.Vector3 };
  quat: THREE.Quaternion;
  fenetre: THREE.Mesh;
  plat: THREE.Mesh;
  boite: THREE.Box3;
  /** L'autre portail de la paire (la sortie), dont l'aplat n'est jamais dessiné dans la vue virtuelle d'ici : la caméra virtuelle est juste derrière lui. */
  sortie: Fenetre | null;
  cible: THREE.WebGLRenderTarget | null;
  uniformes: { carte: { value: THREE.Texture | null }; res: { value: THREE.Vector2 } };
}

export interface Pose {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
}

export class Fenetres {
  readonly liste: Fenetre[] = [];
  private readonly virtuelle = new THREE.PerspectiveCamera();
  private readonly frustum = new THREE.Frustum();
  private readonly matrice = new THREE.Matrix4();
  private readonly taille = new THREE.Vector2();
  private readonly geometrie: THREE.BoxGeometry;
  private readonly aplat: THREE.MeshBasicMaterial;
  private readonly cadre: THREE.BufferGeometry;
  private readonly cadreMat: THREE.MeshBasicMaterial;
  private readonly materiaux: THREE.ShaderMaterial[] = [];
  private readonly cadres: THREE.Mesh[] = [];
  /** Les fenêtres dessinées à la dernière image (une texture par fenêtre visible). */
  dessinees = 0;

  constructor(
    private readonly scene: THREE.Scene,
    niveau: Niveau,
  ) {
    this.geometrie = new THREE.BoxGeometry(2 * (PORTAIL_DEMI_L / M) - 2 * BORD, 2 * (PORTAIL_DEMI_H / M) - 2 * BORD, FOND);
    this.aplat = new THREE.MeshBasicMaterial({ color: new THREE.Color("#FF7A9C").multiplyScalar(1.6), side: THREE.BackSide, toneMapped: false });
    // Le cadre lumineux de chaque ouverture (quatre barres de 8 cm, en saillie de 3 cm) : on voit où est un portail de loin.
    const L = PORTAIL_DEMI_L / M;
    const H = PORTAIL_DEMI_H / M;
    const barre = (w: number, h: number, x: number, y: number): THREE.BufferGeometry => new THREE.BoxGeometry(w, h, 0.03).translate(x, y, 0.015);
    this.cadre = mergeGeometries([barre(2 * L + 0.16, 0.08, 0, H + 0.04), barre(2 * L + 0.16, 0.08, 0, -H - 0.04), barre(0.08, 2 * H, -L - 0.04, 0), barre(0.08, 2 * H, L + 0.04, 0)])!;
    this.cadreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color("#FF7A9C").multiplyScalar(1.6), toneMapped: false });
    for (const paire of niveau.portails ?? []) {
      for (const l of liaisons(paire)) {
        const g = l.de;
        const [centre, n, u, r] = [metres(g.centre), unite(g.n), unite(g.u), unite(g.r)];
        const base = new THREE.Matrix4().makeBasis(r, u, n);
        const quat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().set(l.R[0]!, l.R[1]!, l.R[2]!, 0, l.R[3]!, l.R[4]!, l.R[5]!, 0, l.R[6]!, l.R[7]!, l.R[8]!, 0, 0, 0, 0, 1));
        const uniformes = { carte: { value: null as THREE.Texture | null }, res: { value: new THREE.Vector2(1, 1) } };
        const materiau = new THREE.ShaderMaterial({
          side: THREE.BackSide,
          fog: false,
          uniforms: uniformes,
          vertexShader: "void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
          fragmentShader: "uniform sampler2D carte; uniform vec2 res; void main(){ gl_FragColor = vec4(texture2D(carte, gl_FragCoord.xy / res).rgb, 1.0); }",
        });
        this.materiaux.push(materiau);
        const placer = (m: THREE.Mesh): void => {
          m.quaternion.setFromRotationMatrix(base);
          m.position.copy(centre).addScaledVector(n, -FOND / 2);
          m.matrixAutoUpdate = true;
        };
        const fenetre = new THREE.Mesh(this.geometrie, materiau);
        const plat = new THREE.Mesh(this.geometrie, this.aplat);
        placer(fenetre);
        placer(plat);
        plat.visible = false;
        fenetre.frustumCulled = plat.frustumCulled = false;
        const cadre = new THREE.Mesh(this.cadre, this.cadreMat);
        cadre.quaternion.setFromRotationMatrix(base);
        cadre.position.copy(centre);
        cadre.frustumCulled = false;
        this.cadres.push(cadre);
        this.scene.add(fenetre, plat, cadre);
        const boite = new THREE.Box3().setFromCenterAndSize(centre, new THREE.Vector3(2.6, 2.6, 2.6));
        this.liste.push({ liaison: l, centre, n, u, r, vers: { centre: metres(l.vers.centre), n: unite(l.vers.n) }, quat, fenetre, plat, boite, sortie: null, cible: null, uniformes });
      }
    }
    for (const f of this.liste) f.sortie = this.liste.find((g) => g !== f && g.centre.equals(f.vers.centre)) ?? null;
  }

  /** La pose passée à travers une liaison : R (p − centre) + centre d'arrivée, et la rotation composée. */
  private passer(f: Fenetre, pose: Pose): Pose {
    const position = pose.position.clone().sub(f.centre).applyQuaternion(f.quat).add(f.vers.centre);
    return { position, quaternion: f.quat.clone().multiply(pose.quaternion) };
  }

  /**
   * La pose de la CAMÉRA, à partir de celle de l'œil : si l'œil est dans la poche d'un portail (derrière son plan, dans l'ouverture), la caméra est replacée de l'autre côté, avec la rotation du portail — ce que la
   * simulation fera (ou vient de faire) à la boîte. `transforme` dit si c'est le cas. La couture est invisible : la vue ne saute pas.
   */
  poser(oeil: Pose): { pose: Pose; transforme: boolean } {
    for (const f of this.liste) {
      const d = new THREE.Vector3().subVectors(oeil.position, f.centre);
      const prof = d.dot(f.n);
      if (prof < 0 && prof > -(PORTAIL_PROFONDEUR / M + TOLERANCE) && Math.abs(d.dot(f.r)) < PORTAIL_DEMI_L / M + TOLERANCE && Math.abs(d.dot(f.u)) < PORTAIL_DEMI_H / M + TOLERANCE) return { pose: this.passer(f, oeil), transforme: true };
    }
    return { pose: oeil, transforme: false };
  }

  /**
   * Dessine les textures des fenêtres que la caméra voit (devant leur plan, dans le champ) : pour chacune, la scène vue par la caméra virtuelle, coupée au plan de l'autre portail. `avant` et `apres` encadrent chaque passe
   * (le disque du soleil suit la caméra), les ombres ne sont pas recalculées. Les fenêtres qu'on ne voit pas ne sont pas dessinées du tout.
   */
  rendre(renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera, avant: (c: THREE.Camera) => void, apres: () => void, ombresPretes: boolean): void {
    this.dessinees = 0;
    renderer.getDrawingBufferSize(this.taille);
    this.matrice.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.matrice);
    const visibles = this.liste.filter((f) => new THREE.Vector3().subVectors(camera.position, f.centre).dot(f.n) > 0 && this.frustum.intersectsBox(f.boite));
    for (const f of this.liste) f.fenetre.visible = false;
    if (visibles.length === 0) return;
    const ombres = renderer.shadowMap.autoUpdate;
    // Les ombres du soleil ne sont pas recalculées pour chaque fenêtre (la carte de la dernière image sert) — sauf à la toute première image, où elle n'existe pas encore.
    if (ombresPretes) renderer.shadowMap.autoUpdate = false;
    for (const f of this.liste) f.plat.visible = true;
    const v = this.virtuelle;
    v.fov = camera.fov;
    v.aspect = camera.aspect;
    v.near = camera.near;
    v.far = camera.far;
    v.updateProjectionMatrix();
    for (const f of visibles) {
      if (!f.cible || f.cible.width !== this.taille.x || f.cible.height !== this.taille.y) {
        f.cible?.dispose();
        f.cible = new THREE.WebGLRenderTarget(this.taille.x, this.taille.y, { type: THREE.HalfFloatType, depthBuffer: true });
      }
      const pose = this.passer(f, { position: camera.position, quaternion: camera.quaternion });
      v.position.copy(pose.position);
      v.quaternion.copy(pose.quaternion);
      v.updateMatrixWorld(true);
      for (const g of this.liste) g.plat.visible = g !== f.sortie;
      // Ne reste que ce qui est devant le plan de l'autre portail (à 2 cm près : sa face avant est dans ce plan).
      renderer.clippingPlanes = [new THREE.Plane(f.vers.n.clone(), -f.vers.n.dot(f.vers.centre) + 0.02)];
      avant(v);
      renderer.setRenderTarget(f.cible);
      renderer.render(this.scene, v);
      apres();
      f.uniformes.carte.value = f.cible.texture;
      f.uniformes.res.value.copy(this.taille);
      this.dessinees++;
    }
    renderer.setRenderTarget(null);
    renderer.clippingPlanes = [];
    renderer.shadowMap.autoUpdate = ombres;
    for (const f of this.liste) {
      f.plat.visible = false;
      f.fenetre.visible = visibles.includes(f);
    }
  }

  detruire(): void {
    for (const f of this.liste) {
      f.cible?.dispose();
      this.scene.remove(f.fenetre, f.plat);
    }
    for (const m of this.materiaux) m.dispose();
    for (const c of this.cadres) this.scene.remove(c);
    this.aplat.dispose();
    this.cadre.dispose();
    this.cadreMat.dispose();
    this.geometrie.dispose();
  }
}
