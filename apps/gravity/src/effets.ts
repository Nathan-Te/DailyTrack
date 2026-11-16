// Les sensations de la scène (lot GR3) : les particules (poussière, étincelles, traînée, éclat de mort) et la secousse de la caméra. **Tout suit les pas de la simulation** (`avancerPas`) : la pause les fige, et une partie rejouée
// les refait à l'identique — un petit générateur entier à elles, jamais `Math.random`. Les particules sont des carrés (ou des traits) qui rapetissent ; un seul tampon, mis à jour à chaque image.
import { BufferGeometry, DoubleSide, Float32BufferAttribute, Mesh, MeshBasicMaterial } from "three";

const MAX = 360;
const DT = 1 / 120;

interface Particule {
  x: number;
  y: number;
  vx: number;
  vy: number;
  vie: number;
  vieMax: number;
  /** Largeur et hauteur (cases). */
  w: number;
  h: number;
  r: number;
  g: number;
  b: number;
}

export class Effets {
  readonly mesh: Mesh;
  private readonly geo = new BufferGeometry();
  private readonly mat = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
  private readonly pos = new Float32Array(MAX * 12);
  private readonly col = new Float32Array(MAX * 12);
  private liste: Particule[] = [];
  private graine = 0x9e3779b1;
  private finSecousse = -1;
  private dureeSecousse = 1;
  private ampSecousse = 0;

  constructor(private readonly reduit: boolean) {
    const idx: number[] = [];
    for (let i = 0; i < MAX; i++) idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
    this.geo.setIndex(idx);
    this.geo.setAttribute("position", new Float32BufferAttribute(this.pos, 3).setUsage(35048));
    this.geo.setAttribute("color", new Float32BufferAttribute(this.col, 3).setUsage(35048));
    this.geo.setDrawRange(0, 0);
    this.mesh = new Mesh(this.geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.position.z = 0.3;
  }

  private alea(): number {
    this.graine = (Math.imul(this.graine, 1664525) + 1013904223) >>> 0;
    return this.graine / 4294967296;
  }
  private ajouter(p: Omit<Particule, "r" | "g" | "b" | "vieMax"> & { couleur: number }): void {
    if (this.liste.length >= MAX) return;
    const { couleur, ...reste } = p;
    this.liste.push({ ...reste, vieMax: p.vie, r: LIN[(couleur >> 16) & 255]!, g: LIN[(couleur >> 8) & 255]!, b: LIN[couleur & 255]! });
  }

  /** Des étincelles qui partent dans toutes les directions (ramassage, bouclier crevé). */
  etincelles(x: number, y: number, couleur: number, n = 8, vitesse = 5): void {
    if (this.reduit) n = Math.ceil(n / 3);
    for (let i = 0; i < n; i++) {
      const a = this.alea() * Math.PI * 2;
      const s = 0.55 + this.alea() * 0.6;
      this.ajouter({ x, y, vx: Math.cos(a) * vitesse * s, vy: Math.sin(a) * vitesse * s, vie: 0.45, w: 0.13, h: 0.13, couleur });
    }
  }
  /** De la poussière qui retombe : au départ et à l'atterrissage. `sens` : −1 si le sol est en haut (elle monte). */
  poussiere(x: number, y: number, n: number, couleur: number, sens: 1 | -1 = 1): void {
    if (this.reduit) n = Math.ceil(n / 2);
    for (let i = 0; i < n; i++) {
      const r = 0.1 + this.alea() * 0.1;
      this.ajouter({ x, y, vx: (this.alea() - 0.5) * 4.5, vy: sens * (0.3 + this.alea() * 1.4), vie: 0.42, w: r, h: r, couleur });
    }
  }
  /** La traînée courte d'une inversion : des traits fins derrière le héros, le long de la gravité qu'il quitte. */
  trainee(x: number, y: number, vers: 1 | -1, couleur: number): void {
    if (this.reduit) return;
    for (let i = 0; i < 4; i++) this.ajouter({ x: x - 0.1 - i * 0.18, y: y + vers * (0.05 + this.alea() * 0.25), vx: -2.5, vy: vers * 1.5, vie: 0.22, w: 0.07, h: 0.5, couleur });
  }
  /** L'éclat de la mort : des morceaux du cube (jaune) et d'encre qui partent en tous sens. */
  eclat(x: number, y: number, jaune: number, encre: number): void {
    const n = this.reduit ? 10 : 28;
    for (let i = 0; i < n; i++) {
      const r = 0.12 + this.alea() * 0.14;
      this.ajouter({ x, y, vx: (this.alea() - 0.5) * 13, vy: (this.alea() - 0.5) * 13, vie: 0.9, w: r, h: r, couleur: this.alea() < 0.6 ? jaune : encre });
    }
  }

  /** Une secousse de la caméra : seulement pour les moments forts (la mort, un bouclier consommé), jamais à chaque inversion. */
  secouer(tick: number, ticks: number, amplitude: number): void {
    if (this.reduit) return;
    this.finSecousse = tick + ticks;
    this.dureeSecousse = ticks;
    this.ampSecousse = amplitude;
  }
  /** Le décalage de la caméra (cases) à ce pas : une valeur par pas (déterministe), qui s'éteint avec la secousse. */
  decalage(tick: number): { x: number; y: number } {
    const reste = this.finSecousse - tick;
    if (reste <= 0) return { x: 0, y: 0 };
    const k = (reste / this.dureeSecousse) * this.ampSecousse;
    const h1 = (Math.imul(tick, 0x9e3779b1) >>> 0) / 4294967296 - 0.5;
    const h2 = (Math.imul(tick + 7919, 0x85ebca6b) >>> 0) / 4294967296 - 0.5;
    return { x: h1 * 2 * k, y: h2 * 2 * k };
  }

  /** Un pas de simulation. */
  avancerPas(): void {
    for (const p of this.liste) {
      p.x += p.vx * DT;
      p.y += p.vy * DT;
      p.vie -= DT;
    }
    this.liste = this.liste.filter((p) => p.vie > 0);
  }

  /** Écrit le tampon : à appeler à chaque image. */
  dessiner(): void {
    let n = 0;
    for (const p of this.liste) {
      const k = Math.sqrt(Math.max(0, p.vie / p.vieMax));
      const w = (p.w * k) / 2;
      const h = (p.h * k) / 2;
      const o = n * 12;
      this.pos.set([p.x - w, p.y - h, 0, p.x + w, p.y - h, 0, p.x + w, p.y + h, 0, p.x - w, p.y + h, 0], o);
      for (let v = 0; v < 4; v++) {
        this.col[o + v * 3] = p.r;
        this.col[o + v * 3 + 1] = p.g;
        this.col[o + v * 3 + 2] = p.b;
      }
      n++;
    }
    this.geo.setDrawRange(0, n * 6);
    this.geo.attributes.position!.needsUpdate = true;
    this.geo.attributes.color!.needsUpdate = true;
  }

  detruire(): void {
    this.geo.dispose();
    this.mat.dispose();
  }
}

/** sRGB → linéaire (les couleurs de sommet sont lues dans l'espace de travail linéaire, comme ceux de `@cdj/visuels`). */
const LIN = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const s = i / 255;
  LIN[i] = s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}
