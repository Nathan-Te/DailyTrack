import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { M, type Boite, type Niveau } from "@cdj/vertige-sim";
import { Fenetres } from "./fenetres";
import { Habillage, type RoleMat } from "./rendu";

// Le monde que l'on voit : le ciel en dégradé, les lumières, le soleil carré, les blocs du niveau (ceux de la simulation, à l'identique), puis le DÉCOR qui ne bloque jamais — bannières, braseros, gemmes, îlots
// lointains, nuages, et le cadre de pierre qui tourne de travers (un objet de travers n'a pas de collision : la simulation ne connaît que des boîtes alignées sur les axes). Tout vient de la maquette jouable.
// Lot V1 : les surfaces de gravité (des blocs bleu-violet cerclés de clair ; lot V2 : le seul déclencheur, les orbes sont retirées) et les fenêtres des portails (`fenetres.ts`).
export interface OptionsMonde {
  bloom: boolean;
  ombres: boolean;
  champ: number;
}

const DIR_SOLEIL = new THREE.Vector3(-0.35, 0.55, -1).normalize();
const metres = (v: number): number => v / M;
/** Un aléa déterministe pour le décor seulement (la simulation n'en a aucun). */
const alea = (graine: number): (() => number) => {
  let s = graine;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
};

export class Monde {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly hab: Habillage;
  private readonly composer: EffectComposer;
  private readonly bloom: UnrealBloomPass;
  private readonly ciel: THREE.Mesh;
  private readonly hemi: THREE.HemisphereLight;
  private readonly soleil: THREE.DirectionalLight;
  private readonly disque: THREE.Mesh;
  private readonly flammes: THREE.Mesh[] = [];
  private readonly bannieres: THREE.Mesh[] = [];
  private readonly gemmes: { mesh: THREE.Mesh; base: number }[] = [];
  readonly fenetres: Fenetres | null;
  private readonly nuages = new THREE.Group();
  private readonly cadre = new THREE.Group();
  private readonly cible = new THREE.Vector3();
  private readonly aretes: THREE.LineSegments[] = [];
  private bloomActif: boolean;
  private imagesDessinees = 0;
  private largeur = 1;
  private hauteur = 1;

  constructor(
    hote: HTMLElement,
    readonly niveau: Niveau,
    private readonly opts: OptionsMonde,
  ) {
    this.bloomActif = opts.bloom;
    const rendu = new THREE.WebGLRenderer({ antialias: true });
    rendu.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    rendu.shadowMap.enabled = opts.ombres;
    rendu.shadowMap.type = THREE.PCFShadowMap;
    rendu.domElement.className = "vertige-canevas";
    hote.append(rendu.domElement);
    this.renderer = rendu;
    this.camera = new THREE.PerspectiveCamera(opts.champ, 1, 0.05, 700);
    this.camera.rotation.order = "YXZ";
    this.scene.add(this.camera);
    this.hab = new Habillage();

    // Le ciel en dégradé.
    this.ciel = new THREE.Mesh(
      new THREE.SphereGeometry(500, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: { haut: { value: new THREE.Color("#5E97E0") }, horizon: { value: new THREE.Color("#F4E4D6") }, bas: { value: new THREE.Color("#EAF0F8") } },
        vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
        fragmentShader: "uniform vec3 haut; uniform vec3 horizon; uniform vec3 bas; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(horizon, haut, pow(smoothstep(0.0, 0.75, h), 0.8)) : mix(horizon, bas, smoothstep(0.0, -0.3, h)); gl_FragColor = vec4(c, 1.0); }",
      }),
    );
    this.scene.add(this.ciel);

    // Les lumières, le soleil carré.
    this.hemi = new THREE.HemisphereLight("#BFD8FF", "#C9AFC4", 1.1);
    this.scene.add(this.hemi);
    this.soleil = new THREE.DirectionalLight("#FFE9C7", 2.6);
    this.soleil.castShadow = opts.ombres;
    this.soleil.shadow.mapSize.set(2048, 2048);
    this.scene.add(this.soleil, this.soleil.target);
    this.disque = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), new THREE.MeshBasicMaterial({ color: "#FFF7DE", fog: false, toneMapped: false }));
    this.scene.add(this.disque);

    this.construireNiveau();
    this.construireDecorLointain();
    this.fenetres = (niveau.portails?.length ?? 0) > 0 ? new Fenetres(this.scene, niveau) : null;

    // Le post-traitement de « Lumière douce » : le halo (bloom) puis la sortie (tons ACES).
    this.composer = new EffectComposer(rendu);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.45, 0.6, 0.85);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.configurer();
  }

  // ---------------------------------------------------------------- le niveau
  private bloc(c: THREE.Vector3, t: THREE.Vector3, role: RoleMat, ombre = true): THREE.Mesh {
    const m = this.hab.habiller(new THREE.Mesh(new THREE.BoxGeometry(t.x, t.y, t.z)), role);
    m.position.copy(c);
    m.castShadow = ombre;
    m.receiveShadow = true;
    this.scene.add(m);
    return m;
  }
  private blocBoite(b: Boite, role: RoleMat): THREE.Mesh {
    return this.bloc(new THREE.Vector3(metres(b.x0 + b.x1) / 2, metres(b.y0 + b.y1) / 2, metres(b.z0 + b.z1) / 2), new THREE.Vector3(metres(b.x1 - b.x0), metres(b.y1 - b.y0), metres(b.z1 - b.z0)), role);
  }
  /** Un décor plat, sans collision : un tapis rouge sur une dalle. */
  private tapis(x: number, y: number, z: number, w: number, d: number): void {
    this.bloc(new THREE.Vector3(x, y + 0.03, z), new THREE.Vector3(w, 0.06, d), "rouge", false);
  }
  private banniere(x: number, y: number, z: number, ry = 0, k = 1): void {
    const s = new THREE.Shape();
    s.moveTo(-0.45, 0);
    s.lineTo(0.45, 0);
    s.lineTo(0.45, -2.2);
    s.lineTo(0.2, -1.85);
    s.lineTo(0, -2.2);
    s.lineTo(-0.2, -1.85);
    s.lineTo(-0.45, -2.2);
    s.lineTo(-0.45, 0);
    const m = this.hab.habiller(new THREE.Mesh(new THREE.ShapeGeometry(s)), "rouge");
    m.position.set(x, y, z);
    m.rotation.y = ry;
    m.scale.setScalar(k);
    m.castShadow = true;
    this.scene.add(m);
    this.bannieres.push(m);
  }
  private brasero(x: number, y: number, z: number): void {
    const pied = this.hab.habiller(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 0.9, 6)), "bois");
    pied.position.set(x, y + 0.45, z);
    pied.castShadow = true;
    const coupe = this.hab.habiller(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.3, 0.3, 6)), "bois");
    coupe.position.set(x, y + 1.0, z);
    coupe.castShadow = true;
    const f = this.hab.habiller(new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.75, 5)), "flamme");
    f.position.set(x, y + 1.5, z);
    const l = new THREE.PointLight("#FFB347", 6, 7, 2);
    l.position.set(x, y + 1.7, z);
    this.scene.add(pied, coupe, f, l);
    this.flammes.push(f);
  }

  private construireNiveau(): void {
    const n = this.niveau;
    const bb = new THREE.Box3();
    for (const b of n.blocs) {
      const m = this.blocBoite(b.boite, b.gravite ? "surface" : b.role);
      if (b.gravite) {
        // Une surface de gravité : ses arêtes en clair, pour la reconnaître de loin.
        const aretes = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), new THREE.LineBasicMaterial({ color: "#FFFFFF" }));
        m.add(aretes);
        this.aretes.push(aretes);
      }
      bb.expandByPoint(new THREE.Vector3(metres(b.boite.x0), metres(b.boite.y0), metres(b.boite.z0)));
      bb.expandByPoint(new THREE.Vector3(metres(b.boite.x1), metres(b.boite.y1), metres(b.boite.z1)));
    }
    // Le soleil éclaire le niveau : sa boîte d'ombre suit la taille du niveau.
    const centre = bb.getCenter(new THREE.Vector3());
    const t = bb.getSize(new THREE.Vector3());
    const demi = Math.min(90, Math.max(30, Math.max(t.x, t.z) / 2 + 15));
    this.cible.set(centre.x, 0, centre.z);
    this.soleil.target.position.copy(this.cible);
    Object.assign(this.soleil.shadow.camera, { left: -demi, right: demi, top: demi, bottom: -demi, near: 10, far: 260 });
    this.soleil.shadow.camera.updateProjectionMatrix();

    // Le décor qui ne bloque pas : un tapis sur les dalles du sol, des bannières sur les murs sombres, des braseros au départ.
    for (const b of n.blocs) {
      const w = metres(b.boite.x1 - b.boite.x0);
      const h = metres(b.boite.y1 - b.boite.y0);
      const d = metres(b.boite.z1 - b.boite.z0);
      const cx = metres(b.boite.x0 + b.boite.x1) / 2;
      const cz = metres(b.boite.z0 + b.boite.z1) / 2;
      const haut = metres(b.boite.y1);
      if (b.role === "pierre" && haut === 0 && w >= 3 && d >= 3) this.tapis(cx, 0, cz, Math.min(2.4, w * 0.3), d - 0.6);
      if (b.role === "sombre" && h >= 8) {
        const long = d >= w;
        const pas = 8;
        for (let u = -Math.floor((long ? d : w) / 2 / pas) * pas; u <= (long ? d : w) / 2 - 3; u += pas) {
          if (long) {
            this.banniere(metres(b.boite.x0) - 0.02, haut - 1.5, cz + u, -Math.PI / 2, 1.2);
            this.banniere(metres(b.boite.x1) + 0.02, haut - 1.5, cz + u, Math.PI / 2, 1.2);
          } else {
            this.banniere(cx + u, haut - 1.5, metres(b.boite.z0) - 0.02, Math.PI, 1.2);
            this.banniere(cx + u, haut - 1.5, metres(b.boite.z1) + 0.02, 0, 1.2);
          }
        }
      }
    }
    const d = n.depart;
    if (n.nom === "parcours") this.decorParcours();
    else this.brasero(metres(d.x) + 3.4, 0, metres(d.z) - 2);

    // Les gemmes.
    for (const g of n.gemmes) {
      const m = this.hab.habiller(new THREE.Mesh(new THREE.OctahedronGeometry(0.38)), "or");
      m.position.set(metres(g.x), metres(g.y), metres(g.z));
      m.castShadow = true;
      this.scene.add(m);
      this.gemmes.push({ mesh: m, base: metres(g.y) });
    }
    // L'arrivée : un cadre de pierre et sa lueur rose (le portail de la maquette, qui ne mène plus nulle part).
    if (n.arrivee) {
      const a = n.arrivee;
      const porte = new THREE.Group();
      for (const [x, y, w, h] of [[0, 1.75, 2.9, 0.35], [-1.3, 0, 0.35, 3.5], [1.3, 0, 0.35, 3.5]] as const) {
        const m = this.hab.habiller(new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.5)), "sombre");
        m.position.set(x, y, 0);
        m.castShadow = true;
        porte.add(m);
      }
      const lueur = this.hab.habiller(new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.3, 0.1)), "portail");
      porte.add(lueur);
      porte.position.set(metres(a.x0 + a.x1) / 2, metres(a.y0) + 1.75, metres(a.z0 + a.z1) / 2);
      if (a.z1 - a.z0 > a.x1 - a.x0) porte.rotation.y = Math.PI / 2;
      this.scene.add(porte);
    }
  }

  /** Le décor propre au parcours de la maquette : les bannières des piliers et du mur, les braseros, le château lointain. */
  private decorParcours(): void {
    this.banniere(-4.98, 9.5, 2, Math.PI / 2, 1.6);
    this.banniere(0, -0.1, -4.48);
    this.banniere(0.6, 0.9, -10.48);
    this.banniere(2.5, 1.9, -16.48);
    this.brasero(-3.4, 0, 0.5);
    this.brasero(4, 0, -51.5);
    // Le château, au loin : la plateforme haute du portail B, ses tours, ses bannières. Décor seulement.
    const chateau = (x: number, y: number, z: number, w: number, h: number, d: number, role: RoleMat = "pierre"): void => void this.bloc(new THREE.Vector3(x, y, z), new THREE.Vector3(w, h, d), role);
    chateau(-14, 14, -71, 6, 2, 8);
    chateau(-14, 13, -86, 16, 2, 16);
    this.tapis(-14, 14, -84, 2.4, 12);
    chateau(-19, 20, -93, 4, 12, 4);
    chateau(-9, 20, -93, 4, 12, 4);
    chateau(-14, 24.5, -93, 6, 3, 4, "sombre");
    chateau(-14, 30, -95, 8, 8, 6);
    chateau(-14, 36, -95, 3, 8, 3);
    chateau(-14, 40.5, -95, 3.6, 1, 3.6, "rouge");
    for (const x of [-22, -6]) {
      chateau(x, 22, -92, 3, 18, 3);
      chateau(x, 31.5, -92, 3.6, 1, 3.6, "sombre");
      this.banniere(x, 29, -90.48, 0, 1.3);
    }
    this.banniere(-14, 22.8, -90.98, 0, 1.4);
    this.brasero(-17.5, 14, -88);
    this.brasero(-10.5, 14, -88);
    const voile = this.hab.habiller(new THREE.Mesh(new THREE.PlaneGeometry(6, 9)), "portail");
    voile.position.set(-14, 18.5, -92.9);
    this.scene.add(voile);
  }

  private construireDecorLointain(): void {
    const r = alea(12345);
    // Des îlots et des tours au loin.
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2;
      const rayon = 70 + r() * 120;
      const x = Math.cos(a) * rayon - 10;
      const z = Math.sin(a) * rayon - 50;
      const y = -10 + r() * 40;
      const w = 3 + r() * 6;
      const h = 4 + r() * 18;
      this.bloc(new THREE.Vector3(x, y, z), new THREE.Vector3(w, h, w), r() < 0.2 ? "sombre" : "pierre");
      if (r() < 0.5) this.bloc(new THREE.Vector3(x, y + h / 2 + 0.3, z), new THREE.Vector3(w + 0.4, 0.6, w + 0.4), r() < 0.4 ? "rouge" : "sombre");
    }
    // Le cadre de pierre qui flotte de travers.
    this.cadre.position.set(26, 14, -38);
    for (const [x, y, w, h] of [[0, 6, 14, 2.2], [0, -6, 14, 2.2], [6, 0, 2.2, 14], [-6, 0, 2.2, 14]] as const) {
      const m = this.hab.habiller(new THREE.Mesh(new THREE.BoxGeometry(w, h, 2.2)), "pierre");
      m.position.set(x, y, 0);
      m.castShadow = true;
      this.cadre.add(m);
    }
    this.cadre.rotation.set(0.5, -0.6, 0.4);
    this.scene.add(this.cadre);
    // Les nuages : chaque nuage est UN maillage (plusieurs icosaèdres fondus), pour garder peu d'appels de dessin.
    for (let i = 0; i < 70; i++) {
      const n = 3 + Math.floor(r() * 4);
      const morceaux: THREE.BufferGeometry[] = [];
      for (let j = 0; j < n; j++) {
        const g = new THREE.IcosahedronGeometry(2 + r() * 3, 0);
        g.scale(1, 0.6, 1);
        g.translate(j * 2.6 - n, r() * 1.5, r() * 2);
        morceaux.push(g);
      }
      const geo = mergeGeometries(morceaux)!;
      for (const g of morceaux) g.dispose();
      const nuage = this.hab.habiller(new THREE.Mesh(geo), "nuage");
      const a = r() * Math.PI * 2;
      const rayon = 20 + r() * 160;
      nuage.position.set(Math.cos(a) * rayon - 6, -26 + r() * 22, Math.sin(a) * rayon - 50);
      nuage.scale.setScalar(1 + r() * 1.5);
      this.nuages.add(nuage);
    }
    this.scene.add(this.nuages);
  }

  // ---------------------------------------------------------------- le rendu et la taille
  /** « Lumière douce » : tons ACES, brume, lumières, ombres douces. */
  private configurer(): void {
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.bloom.enabled = this.bloomActif;
    this.scene.fog = new THREE.Fog("#DCE7F5", 90, 460);
    this.hemi.intensity = 1.0;
    this.soleil.intensity = 3.2;
    this.soleil.shadow.radius = 4;
    this.soleil.shadow.bias = -0.0008;
    this.soleil.shadow.normalBias = 0.06;
  }

  redimensionner(w: number, h: number): void {
    this.largeur = Math.max(1, Math.floor(w));
    this.hauteur = Math.max(1, Math.floor(h));
    this.renderer.setSize(this.largeur, this.hauteur, false);
    this.composer.setSize(this.largeur, this.hauteur);
    this.camera.aspect = this.largeur / this.hauteur;
    this.camera.updateProjectionMatrix();
  }

  /** La vie du décor : flammes, gemmes, bannières, cadre, nuages, soleil ; `prises` : les gemmes déjà prises. */
  animer(t: number, dt: number, prises: readonly boolean[]): void {
    this.gemmes.forEach((g, i) => {
      g.mesh.visible = !prises[i];
      g.mesh.rotation.y += dt * 1.6;
      g.mesh.position.y = g.base + Math.sin(t * 2 + g.base) * 0.15;
    });
    for (const f of this.flammes) f.scale.set(1, 0.85 + Math.sin(t * 13 + f.position.x) * 0.15, 1);
    for (const b of this.bannieres) b.rotation.x = Math.sin(t * 1.3 + b.position.z * 0.3) * 0.05;
    this.cadre.rotation.z += dt * 0.05;
    this.cadre.rotation.y += dt * 0.02;
    this.nuages.position.x = Math.sin(t * 0.05) * 3;
    this.placerDisque(this.camera.position);
    this.soleil.position.copy(this.cible).addScaledVector(DIR_SOLEIL, 120);
  }

  /** Dessine l'image : d'abord les fenêtres des portails visibles (une texture chacune, vue par la caméra virtuelle), puis la scène, avec le halo. La caméra a déjà sa pose. */
  dessiner(): void {
    this.camera.updateMatrixWorld(true);
    this.fenetres?.rendre(this.renderer, this.camera, (c) => this.placerDisque(c.position), () => undefined, this.imagesDessinees > 0);
    this.placerDisque(this.camera.position);
    this.composer.render();
    this.imagesDessinees++;
  }

  /** Le disque du soleil est à 420 m dans la direction du soleil, vu de la caméra qui dessine. */
  private placerDisque(p: THREE.Vector3): void {
    this.disque.position.copy(p).addScaledVector(DIR_SOLEIL, 420);
    this.disque.lookAt(p);
  }

  /** Le halo se coupe et se rallume (pour mesurer ce qu'il coûte). */
  reglerHalo(actif: boolean): void {
    this.bloomActif = actif;
    this.bloom.enabled = actif;
  }

  detruire(): void {
    this.fenetres?.detruire();
    for (const a of this.aretes) {
      a.geometry.dispose();
      (a.material as THREE.Material).dispose();
    }
    this.hab.dispose();
    this.composer.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
