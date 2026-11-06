import { CanvasTexture, CircleGeometry, Color, DoubleSide, DynamicDrawUsage, Group, IcosahedronGeometry, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry, Quaternion, RingGeometry, ShaderMaterial, SRGBColorSpace, Vector3 } from "three";
import { fusionner, teindre } from "./formes";
import { COULEURS } from "./palette";

// Les effets de Rush (lots BR0b, BR0c) : les éclats (un seul tas de petits solides), l'arc du coup, les cercles rouges annoncés au sol, les ondes du golem, les ombres douces, les lignes de vitesse de l'esquive, le réticule de la souris. **Rien ici ne touche à la simulation** : le rendu lit les
// événements et l'état, et pose des choses qui durent quelques images.

// --- Les éclats --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const MAX_ECLATS = 600;
export type GenreEclat = "etincelle" | "poussiere" | "gelee" | "pierre" | "chauve" | "feu";
/** Les éclats LUMINEUX (étincelles, feu) dépassent 1 : le post-traitement les fait fleurir (bloom) ; les autres restent des couleurs mates. */
const LUEUR: Partial<Record<GenreEclat, number>> = { etincelle: 2.2, feu: 1.9 };
const COULEURS_ECLATS: Record<GenreEclat, readonly number[]> = {
  etincelle: [COULEURS.etincelle, 0xffffff, 0xffd166],
  poussiere: [COULEURS.poussiere, 0xcdbb94, 0xf2e6c8],
  gelee: [COULEURS.gelee, COULEURS.geleeClair, 0x4fb583],
  pierre: [COULEURS.golem, COULEURS.golemSombre, 0x8a7a6c],
  chauve: [COULEURS.chauve, COULEURS.chauveClair, 0x4a2d7a],
  feu: [COULEURS.lueur, COULEURS.onde, 0xffe29a],
};

export class Eclats {
  readonly maillage: InstancedMesh;
  private readonly pos = new Float32Array(MAX_ECLATS * 3);
  private readonly vit = new Float32Array(MAX_ECLATS * 3);
  private readonly vie = new Float32Array(MAX_ECLATS);
  private readonly duree = new Float32Array(MAX_ECLATS);
  private readonly taille = new Float32Array(MAX_ECLATS);
  private readonly gravite = new Float32Array(MAX_ECLATS);
  private suivant = 0;
  private readonly m = new Matrix4();
  private readonly q = new Quaternion();
  private readonly s = new Vector3();
  private readonly p = new Vector3();
  private readonly c = new Color();
  /** Le facteur de quantité (le réglage « éclats »). */
  quantite = 1;

  constructor() {
    // Les éclats n'écrivent pas la profondeur : le contour du post-traitement ne les cerne pas.
    this.maillage = new InstancedMesh(new IcosahedronGeometry(1, 0), new MeshBasicMaterial({ depthWrite: false, fog: false }), MAX_ECLATS);
    this.maillage.instanceMatrix.setUsage(DynamicDrawUsage);
    this.maillage.frustumCulled = false;
    this.maillage.count = 0;
    for (let i = 0; i < MAX_ECLATS; i++) this.maillage.setColorAt(i, this.c.set(0xffffff));
  }

  /** Une gerbe de `n` éclats autour de (x, y, z), lancés dans la direction (dx, dz) avec un éventail. */
  gerbe(genre: GenreEclat, x: number, y: number, z: number, n: number, o: { vitesse?: number; taille?: number; haut?: number; dx?: number; dz?: number; eventail?: number; duree?: number; gravite?: number } = {}): void {
    const nombre = Math.round(n * this.quantite);
    const palette = COULEURS_ECLATS[genre];
    for (let k = 0; k < nombre; k++) {
      const i = this.suivant;
      this.suivant = (this.suivant + 1) % MAX_ECLATS;
      const dirAngle = o.dx !== undefined || o.dz !== undefined ? Math.atan2(o.dz ?? 0, o.dx ?? 0) : Math.random() * Math.PI * 2;
      const ouverture = o.dx !== undefined || o.dz !== undefined ? (o.eventail ?? 1.4) : Math.PI;
      const a = dirAngle + (Math.random() * 2 - 1) * ouverture;
      const v = (o.vitesse ?? 5) * (0.35 + Math.random() * 0.75);
      this.pos.set([x, y, z], i * 3);
      this.vit.set([Math.cos(a) * v, (o.haut ?? 4) * (0.4 + Math.random() * 0.8), Math.sin(a) * v], i * 3);
      this.duree[i] = (o.duree ?? 0.55) * (0.6 + Math.random() * 0.7);
      this.vie[i] = this.duree[i]!;
      this.taille[i] = (o.taille ?? 0.1) * (0.6 + Math.random() * 0.8);
      this.gravite[i] = o.gravite ?? 14;
      this.maillage.setColorAt(i, this.c.set(palette[Math.floor(Math.random() * palette.length)]!).multiplyScalar(LUEUR[genre] ?? 1));
    }
    if (this.maillage.instanceColor) this.maillage.instanceColor.needsUpdate = true;
  }

  maj(dt: number): void {
    let max = 0;
    for (let i = 0; i < MAX_ECLATS; i++) {
      if (this.vie[i]! <= 0) {
        this.s.set(0, 0, 0);
        this.m.compose(this.p.set(0, -50, 0), this.q.identity(), this.s);
        this.maillage.setMatrixAt(i, this.m);
        continue;
      }
      max = i + 1;
      this.vie[i] = this.vie[i]! - dt;
      const o = i * 3;
      this.vit[o + 1] = this.vit[o + 1]! - this.gravite[i]! * dt;
      this.pos[o] = this.pos[o]! + this.vit[o]! * dt;
      this.pos[o + 1] = Math.max(0.03, this.pos[o + 1]! + this.vit[o + 1]! * dt);
      this.pos[o + 2] = this.pos[o + 2]! + this.vit[o + 2]! * dt;
      if (this.pos[o + 1] === 0.03) {
        this.vit[o]! *= 0.8;
        this.vit[o + 2]! *= 0.8;
        this.vit[o + 1] = Math.abs(this.vit[o + 1]!) * 0.3;
      }
      const u = this.vie[i]! / this.duree[i]!;
      const t = this.taille[i]! * Math.min(1, u * 2.5);
      this.s.set(t, t, t);
      this.q.setFromAxisAngle(this.p.set(0.6, 0.8, 0.3).normalize(), (1 - u) * 9);
      this.m.compose(this.p.set(this.pos[o]!, this.pos[o + 1]!, this.pos[o + 2]!), this.q, this.s);
      this.maillage.setMatrixAt(i, this.m);
    }
    this.maillage.count = max;
    this.maillage.instanceMatrix.needsUpdate = true;
  }
}

// --- Les ombres ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
/** Les ombres en DISQUES (la basse qualité ; en haute, ce sont de vraies ombres portées) : un seul appel de dessin pour tous les disques sombres posés sous les personnages. Le bord est DOUX (un dégradé radial peint une fois sur un petit canvas). */
export class Ombres {
  readonly maillage: InstancedMesh;
  private n = 0;
  private readonly m = new Matrix4();
  private readonly q = new Quaternion();
  private readonly s = new Vector3();
  private readonly p = new Vector3();
  constructor(capacite = 96) {
    const g = new CircleGeometry(1, 20);
    g.rotateX(-Math.PI / 2);
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const x = c.getContext("2d")!;
    const d = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    d.addColorStop(0, "rgba(26,18,12,0.5)");
    d.addColorStop(0.55, "rgba(26,18,12,0.34)");
    d.addColorStop(1, "rgba(26,18,12,0)");
    x.fillStyle = d;
    x.fillRect(0, 0, 64, 64);
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    // Les UV d'un cercle vont de 0 à 1 : le dégradé remplit le disque.
    this.maillage = new InstancedMesh(g, new MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, fog: false }), capacite);
    this.maillage.instanceMatrix.setUsage(DynamicDrawUsage);
    this.maillage.frustumCulled = false;
    this.maillage.renderOrder = 1;
    this.maillage.count = 0;
  }
  debut(): void {
    this.n = 0;
  }
  poser(x: number, z: number, rayon: number, ecart = 0): void {
    if (this.n >= this.maillage.instanceMatrix.count) return;
    const r = rayon * (1 - Math.min(0.5, ecart * 0.25));
    this.m.compose(this.p.set(x, 0.02, z), this.q.identity(), this.s.set(r, 1, r));
    this.maillage.setMatrixAt(this.n++, this.m);
  }
  fin(): void {
    this.maillage.count = this.n;
    this.maillage.instanceMatrix.needsUpdate = true;
  }
}

// --- Les cercles rouges annoncés au sol -----------------------------------------------------------------------------------------------------------------------------------------------------------
const VERTEX_PLAN = "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }";

/** Un cercle d'annonce (lot BR0c, la cible : `cible-ia.png`) : un disque rouge CORAIL translucide, un bord plus clair et fin (moins sombre qu'au BR0b), et un remplissage plus soutenu qui grandit du centre jusqu'au bord à l'instant du coup ; il clignote juste avant. */
export class Annonces {
  readonly groupe = new Group();
  private readonly libres: Mesh[] = [];
  private readonly utilises: Mesh[] = [];
  constructor() {
    for (let i = 0; i < 12; i++) {
      const g = new PlaneGeometry(2, 2);
      g.rotateX(-Math.PI / 2);
      const mat = new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { p: { value: 0 }, t: { value: 0 }, flash: { value: 0 }, col: { value: new Color(COULEURS.corail) }, bordCol: { value: new Color(COULEURS.corailClair) } },
        vertexShader: VERTEX_PLAN,
        fragmentShader: `varying vec2 vUv; uniform float p; uniform float t; uniform float flash; uniform vec3 col; uniform vec3 bordCol;
          void main(){
            vec2 q = vUv * 2.0 - 1.0; float d = length(q); if (d > 1.0) discard;
            float bord = smoothstep(0.925, 0.94, d);
            float rempli = 1.0 - smoothstep(p - 0.012, p, d);
            float front = smoothstep(p - 0.05, p - 0.02, d) * (1.0 - smoothstep(p - 0.02, p, d));
            vec3 c = mix(col, bordCol * 1.35, bord);
            c = mix(c, vec3(1.0, 0.86, 0.78), front * 0.5);
            c = mix(c, vec3(1.0, 0.95, 0.9), flash);
            float a = bord * 0.9 + (1.0 - bord) * (0.26 + rempli * 0.2);
            gl_FragColor = vec4(c, a);
            #include <colorspace_fragment>
          }`,
      });
      const m = new Mesh(g, mat);
      m.renderOrder = 2;
      m.visible = false;
      this.groupe.add(m);
      this.libres.push(m);
    }
  }
  debut(): void {
    for (const m of this.utilises) {
      m.visible = false;
      this.libres.push(m);
    }
    this.utilises.length = 0;
  }
  /** Pose un cercle : `p` de 0 (juste annoncé) à 1 (il frappe). */
  poser(x: number, z: number, rayon: number, p: number, temps: number): void {
    const m = this.libres.pop();
    if (!m) return;
    this.utilises.push(m);
    m.visible = true;
    m.position.set(x, 0.03, z);
    m.scale.set(rayon, 1, rayon);
    const u = (m.material as ShaderMaterial).uniforms;
    u.p!.value = Math.min(1, p) * 0.9;
    u.t!.value = temps;
    u.flash!.value = p > 0.8 ? (Math.floor(temps * 18) % 2 === 0 ? 0.65 : 0) : 0;
  }
}

/** Les anneaux des ondes : un anneau net qui s'élargit, avec un cœur clair. */
export class Anneaux {
  readonly groupe = new Group();
  private readonly libres: Mesh[] = [];
  private readonly utilises: Mesh[] = [];
  constructor() {
    for (let i = 0; i < 4; i++) {
      const g = new PlaneGeometry(2, 2);
      g.rotateX(-Math.PI / 2);
      const m = new Mesh(
        g,
        new ShaderMaterial({
          transparent: true,
          depthWrite: false,
          uniforms: { r: { value: 1 }, e: { value: 0.5 }, col: { value: new Color(COULEURS.onde) } },
          vertexShader: VERTEX_PLAN,
          fragmentShader: `varying vec2 vUv; uniform float r; uniform float e; uniform vec3 col;
            void main(){
              vec2 q = vUv * 2.0 - 1.0; float d = length(q) * 8.6;
              float k = abs(d - r); if (k > e) discard;
              vec3 c = k < e * 0.45 ? vec3(1.0, 0.96, 0.86) : col;
              gl_FragColor = vec4(c, 1.0);
              #include <colorspace_fragment>
            }`,
        }),
      );
      m.scale.set(8.6, 1, 8.6);
      m.renderOrder = 3;
      m.visible = false;
      this.groupe.add(m);
      this.libres.push(m);
    }
  }
  debut(): void {
    for (const m of this.utilises) {
      m.visible = false;
      this.libres.push(m);
    }
    this.utilises.length = 0;
  }
  poser(x: number, z: number, rayon: number, epaisseur: number): void {
    const m = this.libres.pop();
    if (!m) return;
    this.utilises.push(m);
    m.visible = true;
    m.position.set(x, 0.05, z);
    const u = (m.material as ShaderMaterial).uniforms;
    u.r!.value = rayon;
    u.e!.value = epaisseur / 2;
  }
}

// --- L'arc du coup -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
/** L'arc blanc d'un coup d'épée : un croissant à plat qui balaie la zone touchée, en quelques images ; il ne paraît qu'à la PHASE ACTIVE du coup (après l'anticipation : `attente`). */
export class ArcCoup {
  readonly maillage: Mesh;
  private cle = "";
  private readonly matiere = new MeshBasicMaterial({ color: 0xffffff, transparent: true, side: DoubleSide, depthWrite: false });
  /** Les images restantes (60 par seconde) et leur total ; l'attente avant que l'arc paraisse (l'anticipation du coup). */
  reste = 0;
  private attente = 0;
  private total = 8;
  private sens = 1;
  private cap = 0;
  constructor() {
    this.maillage = new Mesh(new RingGeometry(0.5, 1, 2), this.matiere);
    this.maillage.visible = false;
    this.maillage.renderOrder = 4;
  }
  /** Déclenche l'arc d'un coup : au point (x, z), vers le cap (radians, repère de l'écran), de portée `portee` mètres et de demi-ouverture `demi` radians. */
  lancer(x: number, z: number, cap: number, portee: number, demi: number, combo: number, attenteTicks = 0): void {
    const cle = `${portee.toFixed(2)}|${demi.toFixed(2)}|${combo}`;
    if (cle !== this.cle) {
      this.cle = cle;
      this.maillage.geometry.dispose();
      const g = new RingGeometry(portee * (combo === 2 ? 0.45 : 0.6), portee * (combo === 2 ? 1.08 : 1.0), 28, 1, -demi, demi * 2);
      g.rotateX(-Math.PI / 2);
      this.maillage.geometry = g;
    }
    this.maillage.position.set(x, 0.55, z);
    this.cap = cap;
    this.sens = combo === 1 ? -1 : 1;
    this.total = combo === 2 ? 10 : 7;
    this.reste = this.total;
    this.attente = attenteTicks;
    this.maillage.visible = attenteTicks <= 0;
    this.demi = demi;
  }
  private demi = 1;
  maj(dt: number, x: number, z: number): void {
    if (this.reste <= 0) {
      this.maillage.visible = false;
      return;
    }
    if (this.attente > 0) {
      this.attente -= dt * 60;
      if (this.attente > 0) return;
      this.maillage.visible = true;
    }
    this.reste -= dt * 60;
    const u = 1 - Math.max(0, this.reste) / this.total;
    // l'arc balaie de l'un à l'autre bord et s'éteint ; il suit le chevalier
    this.maillage.position.x = x;
    this.maillage.position.z = z;
    this.maillage.rotation.y = -(this.cap + this.sens * this.demi * (0.9 - 1.8 * u) * 0.55);
    this.maillage.scale.setScalar(0.85 + 0.25 * u);
    this.matiere.opacity = Math.max(0, 1 - u * u * 1.1);
    if (this.reste <= 0) this.maillage.visible = false;
  }
}

// --- Les lignes de vitesse de l'esquive ----------------------------------------------------------------------------------------------------------------------------------------------------------
/** Les traits blancs que laisse une esquive : quelques bandes fines, couchées, derrière le chevalier, le long de sa course, qui s'allongent et s'éteignent en un quart de seconde. Un seul appel de dessin. */
export class Traits {
  readonly maillage: InstancedMesh;
  private readonly matiere = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: DoubleSide });
  private readonly m = new Matrix4();
  private readonly q = new Quaternion();
  private readonly s = new Vector3();
  private readonly p = new Vector3();
  private readonly lignes: { x: number; z: number; cap: number; ecart: number; haut: number; longueur: number }[] = [];
  /** Les secondes restantes et la durée totale. */
  private reste = 0;
  private static readonly DUREE = 0.28;
  private static readonly N = 6;
  constructor() {
    const g = new PlaneGeometry(1, 1);
    g.rotateX(-Math.PI / 2);
    g.translate(-0.5, 0, 0); // la bande part de l'origine vers l'arrière (−x local)
    this.maillage = new InstancedMesh(g, this.matiere, Traits.N);
    this.maillage.instanceMatrix.setUsage(DynamicDrawUsage);
    this.maillage.frustumCulled = false;
    this.maillage.renderOrder = 5;
    this.maillage.visible = false;
  }
  /** Une esquive au point (x, z), vers le cap (radians dans le repère x, z : 0 vers +x, π/2 vers +z). */
  lancer(x: number, z: number, cap: number): void {
    this.lignes.length = 0;
    const decalages = [-0.42, -0.24, -0.06, 0.12, 0.3, 0.46];
    for (let i = 0; i < Traits.N; i++) this.lignes.push({ x, z, cap, ecart: decalages[i]!, haut: 0.16 + ((i * 37) % 7) * 0.08, longueur: 1.7 + ((i * 53) % 5) * 0.4 });
    this.reste = Traits.DUREE;
    this.maillage.visible = true;
  }
  maj(dt: number): void {
    if (this.reste <= 0) {
      this.maillage.visible = false;
      return;
    }
    this.reste -= dt;
    const u = 1 - Math.max(0, this.reste) / Traits.DUREE;
    this.matiere.opacity = Math.max(0, 0.9 * (1 - u * u));
    this.lignes.forEach((l, i) => {
      // la bande se détache du chevalier (elle reste où elle est née) et s'étire vers l'arrière
      const lon = l.longueur * (0.5 + u);
      const ax = Math.cos(l.cap);
      const az = Math.sin(l.cap);
      this.q.setFromAxisAngle(this.p.set(0, 1, 0), -l.cap);
      this.m.compose(this.p.set(l.x - az * l.ecart - ax * 0.2 * u, l.haut, l.z + ax * l.ecart - az * 0.2 * u), this.q, this.s.set(lon, 1, 0.06));
      this.maillage.setMatrixAt(i, this.m);
    });
    this.maillage.instanceMatrix.needsUpdate = true;
    if (this.reste <= 0) this.maillage.visible = false;
  }
}

// --- Les lignes de vitesse de la course (lot BR1b) -------------------------------------------------------------------------------------------------------------------------------------------------
/** Quelques bandes fines, d'un brun d'encre pâle (le blanc ne se lit pas sur le sable), derrière le chevalier tant qu'il court : plus la course est pleine, plus elles sont longues et claires. Un seul appel de dessin ; rien tant qu'il marche. */
export class LignesCourse {
  readonly maillage: InstancedMesh;
  private readonly matiere = new MeshBasicMaterial({ color: 0x4a3524, transparent: true, opacity: 0, depthWrite: false, side: DoubleSide });
  private readonly m = new Matrix4();
  private readonly q = new Quaternion();
  private readonly s = new Vector3();
  private readonly p = new Vector3();
  private static readonly N = 5;
  constructor() {
    const g = new PlaneGeometry(1, 1);
    g.rotateX(-Math.PI / 2);
    g.translate(-0.5, 0, 0);
    this.maillage = new InstancedMesh(g, this.matiere, LignesCourse.N);
    this.maillage.name = "lignes-course";
    this.maillage.instanceMatrix.setUsage(DynamicDrawUsage);
    this.maillage.frustumCulled = false;
    this.maillage.renderOrder = 5;
    this.maillage.visible = false;
  }
  /** Le chevalier en (x, z), tourné vers `cap` (radians), à la course `u` (0 à 1) ; `temps` fait glisser les bandes. */
  maj(x: number, z: number, cap: number, u: number, temps: number): void {
    if (u <= 0.05) {
      this.maillage.visible = false;
      return;
    }
    this.maillage.visible = true;
    this.matiere.opacity = 0.7 * u;
    const ax = Math.cos(cap);
    const az = Math.sin(cap);
    this.q.setFromAxisAngle(this.p.set(0, 1, 0), -cap);
    for (let i = 0; i < LignesCourse.N; i++) {
      const ecart = (i - (LignesCourse.N - 1) / 2) * 0.3 + Math.sin(temps * 9 + i * 2.1) * 0.05;
      const recul = 0.5 + ((temps * 6 + i * 0.37) % 1) * 0.9;
      const lon = (0.9 + (i % 3) * 0.35) * u;
      this.m.compose(this.p.set(x - ax * recul - az * ecart, 0.25 + (i % 3) * 0.28, z - az * recul + ax * ecart), this.q, this.s.set(lon * 1.4, 1, 0.12));
      this.maillage.setMatrixAt(i, this.m);
    }
    this.maillage.instanceMatrix.needsUpdate = true;
  }
}

// --- Le réticule de la souris ---------------------------------------------------------------------------------------------------------------------------------------------------------------------
/** Le réticule discret posé au sol sous le curseur (PC seulement) : un petit anneau et un point, blancs, translucides. Un seul appel de dessin ; rien de visible au doigt. */
export class Reticule {
  readonly maillage: Mesh;
  constructor() {
    const anneau = new RingGeometry(0.24, 0.31, 28);
    const point = new CircleGeometry(0.05, 12);
    const g = fusionner([teindre(anneau, 0xffffff), teindre(point, 0xffffff)]);
    g.rotateX(-Math.PI / 2);
    this.maillage = new Mesh(g, new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false, depthTest: false, vertexColors: true }));
    this.maillage.renderOrder = 6;
    this.maillage.visible = false;
  }
  poser(x: number, z: number): void {
    this.maillage.position.set(x, 0.05, z);
    this.maillage.visible = true;
  }
  cacher(): void {
    this.maillage.visible = false;
  }
}

// --- Le cratère de l'impact du golem --------------------------------------------------------------------------------------------------------------------------------------------------------------
/** Les cratères (lot BR0c) : une tache sombre aux bords irréguliers, des fissures et un anneau de poussière claire, peints sur un canvas, posés au sol à l'impact d'un poing ou d'une pierre ; ils s'effacent en quelques secondes. Un appel de dessin par cratère (quatre au plus). */
export class Cratere {
  readonly groupe = new Group();
  private readonly pool: { m: Mesh; vie: number; max: number }[] = [];
  private suivant = 0;
  constructor() {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    const d = g.createRadialGradient(64, 64, 6, 64, 64, 62);
    d.addColorStop(0, "rgba(58,34,14,0.82)");
    d.addColorStop(0.55, "rgba(70,42,18,0.6)");
    d.addColorStop(0.82, "rgba(90,58,26,0.22)");
    d.addColorStop(1, "rgba(90,58,26,0)");
    g.fillStyle = d;
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = "rgba(40,22,8,0.7)";
    g.lineWidth = 2.2;
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3;
      g.beginPath();
      g.moveTo(64 + Math.cos(a) * 12, 64 + Math.sin(a) * 12);
      let x = 64 + Math.cos(a) * 12;
      let y = 64 + Math.sin(a) * 12;
      for (let k = 0; k < 4; k++) {
        const aa = a + (((i * 7 + k * 3) % 5) - 2) * 0.12;
        x += Math.cos(aa) * (9 + ((i + k) % 3) * 3);
        y += Math.sin(aa) * (9 + ((i + k) % 3) * 3);
        g.lineTo(x, y);
      }
      g.stroke();
    }
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    const geo = new PlaneGeometry(2, 2);
    geo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 4; i++) {
      const m = new Mesh(geo, new MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -2 }));
      m.visible = false;
      m.renderOrder = 1;
      this.groupe.add(m);
      this.pool.push({ m, vie: 0, max: 5 });
    }
  }
  poser(x: number, z: number, rayon: number, duree = 5): void {
    const e = this.pool[this.suivant]!;
    this.suivant = (this.suivant + 1) % this.pool.length;
    e.m.position.set(x, 0.035 + this.suivant * 0.002, z);
    e.m.scale.set(rayon, 1, rayon);
    e.m.rotation.y = this.suivant * 1.7;
    e.vie = e.max = duree;
    e.m.visible = true;
  }
  maj(dt: number): void {
    for (const e of this.pool) {
      if (e.vie <= 0) continue;
      e.vie -= dt;
      const u = Math.max(0, e.vie / e.max);
      (e.m.material as MeshBasicMaterial).opacity = Math.min(1, u * 2.2);
      if (e.vie <= 0) e.m.visible = false;
    }
  }
}
