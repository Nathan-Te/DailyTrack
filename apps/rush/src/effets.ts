import { BackSide, type BufferGeometry, CanvasTexture, CircleGeometry, Color, ConeGeometry, DoubleSide, DynamicDrawUsage, Euler, ExtrudeGeometry, Group, IcosahedronGeometry, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, OctahedronGeometry, PlaneGeometry, Quaternion, RingGeometry, ShaderMaterial, Shape, SRGBColorSpace, Vector3 } from "three";
import { plat } from "./cel";
import { fusionner, teindre } from "./formes";
import { COULEURS } from "./palette";

// Les effets de Rush (lots BR0b, BR0c) : les éclats (un seul tas de petits solides), l'arc du coup, les cercles rouges annoncés au sol, les ondes du golem, les ombres douces, les lignes de vitesse de l'esquive, le réticule de la souris. **Rien ici ne touche à la simulation** : le rendu lit les
// événements et l'état, et pose des choses qui durent quelques images.

// --- Les éclats --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const MAX_ECLATS = 600;
export type GenreEclat = "etincelle" | "poussiere" | "gelee" | "pierre" | "chauve" | "feu" | "spore" | "reine" | "gelaton" | "jarre" | "bois" | "planche" | "rage" | "lame";
/** Les éclats LUMINEUX (étincelles, feu) dépassent 1 : le post-traitement les fait fleurir (bloom) ; les autres restent des couleurs mates. */
const LUEUR: Partial<Record<GenreEclat, number>> = { etincelle: 2.2, feu: 1.9, rage: 1.8, lame: 1.9 };
const COULEURS_ECLATS: Record<GenreEclat, readonly number[]> = {
  etincelle: [COULEURS.etincelle, 0xffffff, 0xffd166],
  poussiere: [COULEURS.poussiere, 0xcdbb94, 0xf2e6c8],
  gelee: [COULEURS.gelee, COULEURS.geleeClair, 0x4fb583],
  pierre: [COULEURS.golem, COULEURS.golemSombre, 0x8a7a6c],
  chauve: [COULEURS.chauve, COULEURS.chauveClair, 0x4a2d7a],
  feu: [COULEURS.lueur, COULEURS.onde, 0xffe29a],
  // Lot BR3 : les volutes de spores du vieux chêne (vert-jaune) et l'éclaboussure de la reine gelée qui se divise (bleu).
  spore: [COULEURS.sporesClair, 0x9dbb2a, 0xe4ee86],
  reine: [0x2f78b8, 0xa6d6f2, 0x6fb0e0],
  // Lot BR5 : un gélaton qui éclate (bleu), les morceaux d'une jarre (terre cuite) et d'un tonneau / d'une caisse (bois), la rage (violet) et l'or pâle du tourbillon.
  gelaton: [0x3f8fe0, 0xb9dcff, 0x6fb4f0],
  jarre: [0xc9733e, 0xe7a468, 0x8f4a25, 0xf0c9a0],
  bois: [0xb07a43, 0x7c5230, 0xd2a468],
  planche: [0xd9a65f, 0x8f4a25, 0xb07a43],
  rage: [COULEURS.rage, COULEURS.rageClair, 0xffffff],
  lame: [COULEURS.lame, 0xffffff, 0xfff2a8],
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
  constructor(capacite = 256) {
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

/** Les transparences d'une annonce au sol (le fond du disque, avec le remplissage en plus ; le liseré) : le test de lisibilité les lit pour mesurer l'écart contre chaque sol. Lot BR3 : la bande a les mêmes. */
export const ALPHAS_ANNONCE = { fond: 0.26, fondInvocation: 0.16, rempli: 0.2, bord: 0.9 } as const;

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
        uniforms: { p: { value: 0 }, t: { value: 0 }, flash: { value: 0 }, col: { value: new Color(COULEURS.corail) }, bordCol: { value: new Color(COULEURS.corailClair) }, fond: { value: ALPHAS_ANNONCE.fond }, gain: { value: 1.35 } },
        vertexShader: VERTEX_PLAN,
        fragmentShader: `varying vec2 vUv; uniform float p; uniform float t; uniform float flash; uniform vec3 col; uniform vec3 bordCol; uniform float fond; uniform float gain;
          void main(){
            vec2 q = vUv * 2.0 - 1.0; float d = length(q); if (d > 1.0) discard;
            float bord = smoothstep(0.925, 0.94, d);
            float rempli = 1.0 - smoothstep(p - 0.012, p, d);
            float front = smoothstep(p - 0.05, p - 0.02, d) * (1.0 - smoothstep(p - 0.02, p, d));
            vec3 c = mix(col, bordCol * gain, bord);
            c = mix(c, vec3(1.0, 0.86, 0.78), front * 0.5);
            c = mix(c, vec3(1.0, 0.95, 0.9), flash);
            float a = bord * 0.9 + (1.0 - bord) * (fond + rempli * 0.2);
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
  /** Pose un cercle : `p` de 0 (juste annoncé) à 1 (il frappe). Lot BR3 : `invocation` est l'anneau où une gelée va naître — violet pâle, plus léger, qui ne clignote pas : ce n'est PAS un danger (le corail est réservé au danger). */
  poser(x: number, z: number, rayon: number, p: number, temps: number, invocation = false): void {
    const m = this.libres.pop();
    if (!m) return;
    this.utilises.push(m);
    m.visible = true;
    m.position.set(x, 0.03, z);
    m.scale.set(rayon, 1, rayon);
    const u = (m.material as ShaderMaterial).uniforms;
    u.p!.value = Math.min(1, p) * 0.9;
    u.t!.value = temps;
    u.flash!.value = !invocation && p > 0.8 ? (Math.floor(temps * 18) % 2 === 0 ? 0.65 : 0) : 0;
    (u.col!.value as Color).set(invocation ? COULEURS.invocation : COULEURS.corail);
    (u.bordCol!.value as Color).set(invocation ? COULEURS.invocationClair : COULEURS.corailClair);
    u.fond!.value = invocation ? ALPHAS_ANNONCE.fondInvocation : ALPHAS_ANNONCE.fond;
    u.gain!.value = invocation ? 1 : 1.35;
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

// --- Lot BR2 : les gemmes d'XP et l'onde de l'épée -----------------------------------------------------------------------------------------------------------------------------------------------
const MAX_GEMMES = 96;
/** Lot BR5 : trois sortes de butin — la gemme d'XP (octaèdre ambre), la RAGE (un cristal violet, plus haut) et le CŒUR (rose) ; chacune a son tas instancié et son liseré d'encre. */
function formeCoeur(): BufferGeometry {
  const f = new Shape();
  f.moveTo(0, -0.3);
  f.bezierCurveTo(-0.6, 0.1, -0.35, 0.5, 0, 0.24);
  f.bezierCurveTo(0.35, 0.5, 0.6, 0.1, 0, -0.3);
  const g = new ExtrudeGeometry(f, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 1 });
  g.translate(0, 0, -0.08);
  return g;
}
export const GEMME_COULEURS = [new Color(COULEURS.lueur).multiplyScalar(1.25), new Color(COULEURS.rage).multiplyScalar(1.3), new Color(COULEURS.coeur).multiplyScalar(1.15)] as const;
/** Les butins : des aplats sans lumière, un peu au-dessus de 1 : le bloom les fait briller. Elles tournent, flottent un peu et jaillissent à leur chute. */
export class Gemmes {
  readonly maillage: InstancedMesh;
  /** Le liseré d'encre qui les détache du sable (la lisibilité : l'ambre sur le sable ne se lit pas) : la même forme, plus grosse, vue de dos. */
  readonly contour: InstancedMesh;
  readonly groupe = new Group();
  private readonly corps: InstancedMesh[] = [];
  private readonly contours: InstancedMesh[] = [];
  private readonly m = new Matrix4();
  private readonly q = new Quaternion();
  private readonly p = new Vector3();
  private readonly s = new Vector3();
  private readonly axe = new Vector3(0, 1, 0);
  constructor() {
    const formes: BufferGeometry[] = [new OctahedronGeometry(0.3, 0), new OctahedronGeometry(0.22, 0).scale(0.8, 1.9, 0.8), formeCoeur()];
    formes.forEach((geo, k) => {
      const c = new InstancedMesh(geo, new MeshBasicMaterial({ color: GEMME_COULEURS[k]!, fog: false }), MAX_GEMMES);
      const o = new InstancedMesh(geo, new MeshBasicMaterial({ color: COULEURS.encre, side: BackSide, fog: false }), MAX_GEMMES);
      for (const mm of [c, o]) {
        mm.instanceMatrix.setUsage(DynamicDrawUsage);
        mm.frustumCulled = false;
        mm.count = 0;
        this.groupe.add(mm);
      }
      this.corps.push(c);
      this.contours.push(o);
    });
    this.maillage = this.corps[0]!;
    this.contour = this.contours[0]!;
  }
  /** Pose les butins de la simulation (mètres = unités / 4096) ; `tick` : le tick courant (l'âge d'un butin), `temps` : les secondes du jeu (la rotation). `k` : 0 une gemme d'XP, 1 de la rage, 2 un cœur. */
  maj(gemmes: readonly { id: number; x: number; y: number; v: number; k: number; vers: boolean; age: number }[], tick: number, temps: number, metres: (u: number) => number): void {
    const n = [0, 0, 0];
    for (const g of gemmes) {
      const k = g.k;
      const i = n[k]!;
      if (i >= MAX_GEMMES) continue;
      n[k]!++;
      const age = tick - g.age;
      // à sa chute elle jaillit (un petit saut), puis flotte
      const saut = age < 18 ? Math.sin((age / 18) * Math.PI) * 0.7 : 0;
      const taille = (k === 0 ? 0.9 + Math.min(0.9, Math.sqrt(g.v) * 0.05) : k === 1 ? 1.15 : 1.1) * Math.min(1, 0.35 + age / 10);
      this.p.set(metres(g.x), 0.6 + saut + Math.sin(temps * 3 + g.id) * 0.06, metres(g.y));
      this.q.setFromAxisAngle(this.axe, temps * (k === 2 ? 1.6 : 2.2) + g.id);
      this.s.setScalar(taille);
      this.m.compose(this.p, this.q, this.s);
      this.corps[k]!.setMatrixAt(i, this.m);
      this.s.setScalar(taille * 1.28);
      this.m.compose(this.p, this.q, this.s);
      this.contours[k]!.setMatrixAt(i, this.m);
    }
    for (let k = 0; k < 3; k++) {
      this.corps[k]!.count = this.contours[k]!.count = n[k]!;
      this.corps[k]!.instanceMatrix.needsUpdate = this.contours[k]!.instanceMatrix.needsUpdate = true;
    }
  }
}

/** L'onde de l'épée (« Onde d'épée ») : un croissant à plat sur le sol qui file droit devant le chevalier ; quatre au plus à la fois. */
export class OndesEpee {
  readonly groupe = new Group();
  private readonly pool: Mesh[] = [];
  constructor() {
    const geo = new RingGeometry(0.7, 1.0, 24, 1, -0.9, 1.8);
    geo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 4; i++) {
      const m = new Mesh(geo, new MeshBasicMaterial({ color: new Color(0xfff2a8).multiplyScalar(1.6), transparent: true, side: DoubleSide, depthWrite: false, fog: false }));
      m.visible = false;
      m.renderOrder = 4;
      this.groupe.add(m);
      this.pool.push(m);
    }
  }
  maj(ondes: readonly { x: number; y: number; dir: number; d: number; portee: number }[], metres: (u: number) => number): void {
    this.pool.forEach((m, i) => {
      const o = ondes[i];
      if (!o) {
        m.visible = false;
        return;
      }
      const a = (o.dir * Math.PI * 2) / 128;
      const d = metres(o.d);
      m.visible = true;
      m.position.set(metres(o.x) + Math.cos(a) * d, 0.5, metres(o.y) + Math.sin(a) * d);
      m.rotation.y = -a;
      m.scale.setScalar(1.1 + (o.d / o.portee) * 0.5);
      (m.material as MeshBasicMaterial).opacity = Math.max(0, 1 - (o.d / o.portee) ** 2);
    });
  }
}

// --- Lot BR3 : les bandes, les nuages de spores et les racines ----------------------------------------------------------------------------------------------------------------------------------
/** Une BANDE annoncée au sol (le plongeon du grand-duc, la charge du bélier, les racines du chêne) : le même langage que les cercles — un rectangle corail translucide, un bord plus clair, un remplissage qui AVANCE le long de la bande jusqu'à l'impact, un clignotement juste avant. Un appel de dessin par bande (huit au plus : six racines en étoile en phase 2 + les autres). */
export class Bandes {
  readonly groupe = new Group();
  private readonly libres: Mesh[] = [];
  private readonly utilises: Mesh[] = [];
  constructor(n = 8) {
    for (let i = 0; i < n; i++) {
      const g = new PlaneGeometry(1, 1);
      g.rotateX(-Math.PI / 2);
      const mat = new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { p: { value: 0 }, flash: { value: 0 }, len: { value: 1 }, demi: { value: 1 }, fond: { value: ALPHAS_ANNONCE.fond }, col: { value: new Color(COULEURS.corail) }, bordCol: { value: new Color(COULEURS.corailClair) } },
        vertexShader: VERTEX_PLAN,
        fragmentShader: `varying vec2 vUv; uniform float p; uniform float flash; uniform float len; uniform float demi; uniform float fond; uniform vec3 col; uniform vec3 bordCol;
          void main(){
            float along = vUv.x;
            float across = abs(vUv.y * 2.0 - 1.0) * demi;
            float de = min(along * len, (1.0 - along) * len);
            float bord = max(smoothstep(demi - 0.2, demi - 0.12, across), 1.0 - smoothstep(0.08, 0.2, de));
            float rempli = 1.0 - smoothstep(p - 0.012, p, along);
            float front = smoothstep(p - 0.05, p - 0.02, along) * (1.0 - smoothstep(p - 0.02, p, along));
            vec3 c = mix(col, bordCol * 1.35, bord);
            c = mix(c, vec3(1.0, 0.86, 0.78), front * 0.5);
            c = mix(c, vec3(1.0, 0.95, 0.9), flash);
            float a = bord * ${ALPHAS_ANNONCE.bord.toFixed(2)} + (1.0 - bord) * (fond + rempli * ${ALPHAS_ANNONCE.rempli.toFixed(2)});
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
  /** Pose la bande de (x, z) à (x2, z2) (mètres), de demi-largeur `demi` ; `p` de 0 (annoncée) à 1 (elle frappe). */
  poser(x: number, z: number, x2: number, z2: number, demi: number, p: number, temps: number): void {
    const m = this.libres.pop();
    if (!m) return;
    this.utilises.push(m);
    const dx = x2 - x;
    const dz = z2 - z;
    const len = Math.max(0.01, Math.hypot(dx, dz));
    m.visible = true;
    m.position.set((x + x2) / 2, 0.03, (z + z2) / 2);
    m.rotation.y = -Math.atan2(dz, dx);
    m.scale.set(len, 1, demi * 2);
    const u = (m.material as ShaderMaterial).uniforms;
    u.p!.value = Math.min(1, p) * 1.02;
    u.flash!.value = p > 0.8 ? (Math.floor(temps * 18) % 2 === 0 ? 0.65 : 0) : 0;
    u.len!.value = len;
    u.demi!.value = demi;
  }
}

/** Les NUAGES de spores du vieux chêne : un disque vert-jaune sombre aux volutes plus claires, un liseré olive, qui paraît à l'éclatement des spores, reste, puis s'estompe avant `fin`. **Pas rouge** (le rouge est le danger d'une annonce ; un nuage qui reste n'est plus annoncé) mais il se lit sur chaque sol. Un appel de dessin par nuage (trois au plus). */
export class Nuages {
  readonly groupe = new Group();
  private readonly libres: Mesh[] = [];
  private readonly utilises: Mesh[] = [];
  constructor(n = 3) {
    for (let i = 0; i < n; i++) {
      const g = new PlaneGeometry(2, 2);
      g.rotateX(-Math.PI / 2);
      const mat = new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { t: { value: 0 }, u: { value: 1 }, col: { value: new Color(COULEURS.spores) }, clair: { value: new Color(COULEURS.sporesClair) }, lisere: { value: new Color(COULEURS.sporesLisere) } },
        vertexShader: VERTEX_PLAN,
        fragmentShader: `varying vec2 vUv; uniform float t; uniform float u; uniform vec3 col; uniform vec3 clair; uniform vec3 lisere;
          void main(){
            vec2 q = vUv * 2.0 - 1.0; float d = length(q); if (d > 1.0) discard;
            float a = atan(q.y, q.x);
            float volute = 0.5 + 0.5 * sin(a * 3.0 + d * 8.0 - t * 1.4) * sin(a * 2.0 - d * 5.0 + t * 0.9);
            float bord = smoothstep(0.86, 0.91, d) * (1.0 - smoothstep(0.97, 1.0, d));
            vec3 c = mix(col, clair, volute * 0.5 * (1.0 - d * 0.5));
            c = mix(c, lisere, bord);
            float alpha = mix(0.72 + 0.08 * volute, 0.92, bord) * u;
            gl_FragColor = vec4(c, alpha);
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
  /** Pose un nuage de rayon `rayon` ; `opacite` de 0 à 1 (il paraît, reste, s'estompe). */
  poser(x: number, z: number, rayon: number, opacite: number, temps: number): void {
    const m = this.libres.pop();
    if (!m) return;
    this.utilises.push(m);
    m.visible = true;
    m.position.set(x, 0.04, z);
    m.scale.set(rayon, 1, rayon);
    const u = (m.material as ShaderMaterial).uniforms;
    u.t!.value = temps;
    u.u!.value = opacite;
  }
}

/** Les RACINES qui jaillissent du sol (le vieux chêne) : des pointes de bois brun, un seul tas (un appel de dessin), qui poussent en un clin d'œil le long de la bande puis se rétractent. */
const MAX_RACINES = 96;
export class Racines {
  readonly maillage: InstancedMesh;
  private readonly x = new Float32Array(MAX_RACINES);
  private readonly z = new Float32Array(MAX_RACINES);
  private readonly h = new Float32Array(MAX_RACINES);
  private readonly r = new Float32Array(MAX_RACINES);
  private readonly inclinaison = new Float32Array(MAX_RACINES * 2);
  private readonly delai = new Float32Array(MAX_RACINES);
  private readonly age = new Float32Array(MAX_RACINES).fill(99);
  private suivant = 0;
  private readonly duree = 1.15;
  private readonly m = new Matrix4();
  private readonly q = new Quaternion();
  private readonly e = new Euler();
  private readonly s = new Vector3();
  private readonly pos = new Vector3();
  private readonly c = new Color();
  constructor() {
    const g = new ConeGeometry(1, 1, 7);
    g.translate(0, 0.5, 0);
    this.maillage = new InstancedMesh(g, plat(0xffffff, false, 0.18), MAX_RACINES);
    this.maillage.instanceMatrix.setUsage(DynamicDrawUsage);
    this.maillage.frustumCulled = false;
    this.maillage.castShadow = true;
    this.maillage.count = 0;
    for (let i = 0; i < MAX_RACINES; i++) this.maillage.setColorAt(i, this.c.set(0x5a3d26));
  }
  private pointe(x: number, z: number, h: number, r: number, delai: number): void {
    const i = this.suivant;
    this.suivant = (this.suivant + 1) % MAX_RACINES;
    this.x[i] = x;
    this.z[i] = z;
    this.h[i] = h;
    this.r[i] = r;
    this.inclinaison[i * 2] = (Math.random() - 0.5) * 0.5;
    this.inclinaison[i * 2 + 1] = (Math.random() - 0.5) * 0.5;
    this.delai[i] = delai;
    this.age[i] = 0;
    this.maillage.setColorAt(i, this.c.set(Math.random() < 0.5 ? 0x5a3d26 : 0x3f2a1a));
    if (this.maillage.instanceColor) this.maillage.instanceColor.needsUpdate = true;
  }
  /** Des racines tout le long de la bande de (x, z) à (x2, z2) (mètres), de demi-largeur `demi` : elles poussent à la file, depuis le départ. */
  bande(x: number, z: number, x2: number, z2: number, demi: number): void {
    const dx = x2 - x;
    const dz = z2 - z;
    const len = Math.max(0.01, Math.hypot(dx, dz));
    const n = Math.max(2, Math.min(10, Math.round(len / 1.3)));
    const nx = -dz / len;
    const nz = dx / len;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const lateral = (i % 2 === 0 ? 1 : -1) * demi * 0.45 * (0.3 + Math.random() * 0.7);
      this.pointe(x + dx * t + nx * lateral, z + dz * t + nz * lateral, 1.6 + Math.random() * 1.1, 0.5 + Math.random() * 0.2, t * 0.3);
    }
  }
  /** Des racines dans un disque (la chute de « pierres » du chêne : ici des racines). */
  cercle(x: number, z: number, rayon: number): void {
    this.pointe(x, z, 2.0 + Math.random() * 0.6, 0.62, 0);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + Math.random() * 0.5;
      this.pointe(x + Math.cos(a) * rayon * 0.62, z + Math.sin(a) * rayon * 0.62, 1.2 + Math.random() * 0.9, 0.45 + Math.random() * 0.15, 0.04 + Math.random() * 0.1);
    }
  }
  maj(dt: number): void {
    let max = 0;
    for (let i = 0; i < MAX_RACINES; i++) {
      if (this.age[i]! >= this.duree + this.delai[i]!) {
        this.s.set(0, 0, 0);
        this.m.compose(this.pos.set(0, -50, 0), this.q.identity(), this.s);
        this.maillage.setMatrixAt(i, this.m);
        continue;
      }
      max = i + 1;
      this.age[i] = this.age[i]! + dt;
      const u = Math.max(0, this.age[i]! - this.delai[i]!) / this.duree;
      const pousse = Math.min(1, u / 0.14);
      const rentre = u > 0.7 ? 1 - (u - 0.7) / 0.3 : 1;
      const k = Math.max(0.001, pousse * (2 - pousse) * rentre);
      this.q.setFromEuler(this.e.set(this.inclinaison[i * 2]!, 0, this.inclinaison[i * 2 + 1]!));
      this.m.compose(this.pos.set(this.x[i]!, 0, this.z[i]!), this.q, this.s.set(this.r[i]! * Math.min(1, 0.4 + k), this.h[i]! * k, this.r[i]! * Math.min(1, 0.4 + k)));
      this.maillage.setMatrixAt(i, this.m);
    }
    this.maillage.count = max;
    this.maillage.instanceMatrix.needsUpdate = true;
  }
}
