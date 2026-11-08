import { CircleGeometry, Color, DoubleSide, Group, Mesh, MeshBasicMaterial, PlaneGeometry, RingGeometry, ShaderMaterial, TorusGeometry, CylinderGeometry, SphereGeometry } from "three";
import type { Bouclier } from "@cdj/rush-sim";
import { piece } from "./cel";
import { fusionner, placer, teindre } from "./formes";
import { COULEURS } from "./palette";

// Les COMPÉTENCES à l'écran (lot BR5), en formes simples : la lame du tourbillon, le cercle d'atterrissage du bond (un cyan, JAMAIS rouge : le rouge est réservé au danger, y compris pour ce que le joueur annonce) et son onde de choc, le bouclier lancé, la
// traînée du coup d'élan. **Rien ici ne touche à la simulation** : le rendu lit l'état (`Partie.c`, `Partie.boucliers`) et les événements.

const VERTEX_PLAN = "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }";

/** Les transparences du cercle d'atterrissage du joueur (le test de lisibilité les lit : le fond du disque, le remplissage, le liseré). */
export const ALPHAS_JOUEUR = { fond: 0.26, rempli: 0.2, bord: 0.9 } as const;

/** La LAME du tourbillon : un anneau fin au rayon de la zone, trois lames en croissant qui tournent, un disque très léger. Un groupe, visible seulement pendant la compétence. */
export class LameTourbillon {
  readonly groupe = new Group();
  private readonly lames = new Group();
  private readonly matieres: { disque: MeshBasicMaterial; anneau: MeshBasicMaterial; lames: MeshBasicMaterial[] };
  constructor() {
    const matiere = (a: number, k = 1.5): MeshBasicMaterial => new MeshBasicMaterial({ color: new Color(COULEURS.lame).multiplyScalar(k), transparent: true, opacity: a, side: DoubleSide, depthWrite: false, fog: false });
    const anneau = new Mesh(new RingGeometry(0.93, 1, 56).rotateX(-Math.PI / 2), matiere(0.85));
    const disque = new Mesh(new CircleGeometry(1, 40).rotateX(-Math.PI / 2), matiere(0.1, 1));
    anneau.renderOrder = disque.renderOrder = 4;
    this.groupe.add(disque, anneau, this.lames);
    const mats: MeshBasicMaterial[] = [];
    for (let k = 0; k < 3; k++) {
      const m = matiere(0.5);
      const l = new Mesh(new RingGeometry(0.5, 0.98, 20, 1, 0, 1.25).rotateX(-Math.PI / 2), m);
      l.rotation.y = (k * Math.PI * 2) / 3;
      l.renderOrder = 4;
      this.lames.add(l);
      mats.push(m);
    }
    this.matieres = { disque: disque.material as MeshBasicMaterial, anneau: anneau.material as MeshBasicMaterial, lames: mats };
    this.groupe.visible = false;
  }
  /** Le chevalier en (x, z) ; `rayon` en mètres ; `ticks` : les ticks écoulés dans la compétence (la lame tourne) ; `reste` de 0 à 1 : la part de la durée restante (elle s'estompe à la fin). */
  maj(actif: boolean, x: number, z: number, rayon: number, ticks: number, reste: number): void {
    this.groupe.visible = actif;
    if (!actif) return;
    this.groupe.position.set(x, 0.32, z);
    this.groupe.scale.set(rayon, 1, rayon);
    this.lames.rotation.y = -ticks * 0.42;
    const u = Math.min(1, ticks / 4) * Math.min(1, reste * 4);
    this.matieres.disque.opacity = 0.1 * u;
    this.matieres.anneau.opacity = 0.85 * u;
    for (const m of this.matieres.lames) m.opacity = 0.5 * u;
  }
}

/** Le CERCLE D'ATTERRISSAGE du bond : un disque cyan translucide, un liseré plus vif, un remplissage qui grandit du centre jusqu'à l'atterrissage. Il ne clignote pas (ce n'est pas un danger). Deux au plus (« Écho »). */
export class CerclesJoueur {
  readonly groupe = new Group();
  private readonly libres: Mesh[] = [];
  private readonly utilises: Mesh[] = [];
  constructor() {
    for (let i = 0; i < 2; i++) {
      const g = new PlaneGeometry(2, 2);
      g.rotateX(-Math.PI / 2);
      const mat = new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { p: { value: 0 }, col: { value: new Color(COULEURS.joueur) }, bordCol: { value: new Color(COULEURS.joueurClair) }, fond: { value: ALPHAS_JOUEUR.fond } },
        vertexShader: VERTEX_PLAN,
        fragmentShader: `varying vec2 vUv; uniform float p; uniform vec3 col; uniform vec3 bordCol; uniform float fond;
          void main(){
            vec2 q = vUv * 2.0 - 1.0; float d = length(q); if (d > 1.0) discard;
            float bord = smoothstep(0.925, 0.94, d);
            float rempli = 1.0 - smoothstep(p - 0.012, p, d);
            vec3 c = mix(col, bordCol, bord);
            float a = bord * ${ALPHAS_JOUEUR.bord.toFixed(2)} + (1.0 - bord) * (fond + rempli * ${ALPHAS_JOUEUR.rempli.toFixed(2)});
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
  /** Un cercle de `rayon` mètres en (x, z) ; `p` de 0 à 1 : la préparation du bond jusqu'à l'atterrissage. */
  poser(x: number, z: number, rayon: number, p: number): void {
    const m = this.libres.pop();
    if (!m) return;
    this.utilises.push(m);
    m.visible = true;
    m.position.set(x, 0.04, z);
    m.scale.set(rayon, 1, rayon);
    (m.material as ShaderMaterial).uniforms.p!.value = Math.min(1, p) * 0.9;
  }
}

/** Les ONDES DE CHOC du joueur (atterrissage du bond) : un anneau clair qui s'élargit en un tiers de seconde et s'efface. Quatre au plus. */
export class OndesChoc {
  readonly groupe = new Group();
  private readonly pool: { m: Mesh; t: number; rayon: number }[] = [];
  private suivant = 0;
  constructor() {
    const geo = new RingGeometry(0.86, 1, 48).rotateX(-Math.PI / 2);
    for (let i = 0; i < 4; i++) {
      const m = new Mesh(geo, new MeshBasicMaterial({ color: new Color(COULEURS.joueurClair).multiplyScalar(1.5), transparent: true, side: DoubleSide, depthWrite: false, fog: false }));
      m.visible = false;
      m.renderOrder = 4;
      this.groupe.add(m);
      this.pool.push({ m, t: 1, rayon: 1 });
    }
  }
  lancer(x: number, z: number, rayon: number): void {
    const o = this.pool[this.suivant]!;
    this.suivant = (this.suivant + 1) % this.pool.length;
    o.t = 0;
    o.rayon = rayon;
    o.m.position.set(x, 0.12, z);
    o.m.visible = true;
  }
  maj(dt: number): void {
    for (const o of this.pool) {
      if (o.t >= 1) {
        o.m.visible = false;
        continue;
      }
      o.t = Math.min(1, o.t + dt / 0.36);
      const u = 1 - (1 - o.t) * (1 - o.t);
      o.m.scale.set(o.rayon * (0.25 + 0.75 * u), 1, o.rayon * (0.25 + 0.75 * u));
      (o.m.material as MeshBasicMaterial).opacity = 0.95 * (1 - o.t);
    }
  }
}

/** Les BOUCLIERS lancés : un disque d'acier cerclé d'or qui file à plat, tourne sur lui-même et laisse une traînée (les éclats de `corps.ts`). Trois au plus. */
export class BouclierVu {
  readonly groupe = new Group();
  private readonly pool: Group[] = [];
  constructor() {
    const forme = fusionner([
      teindre(new CylinderGeometry(0.5, 0.5, 0.1, 22), COULEURS.bouclier),
      teindre(placer(new TorusGeometry(0.5, 0.06, 6, 22), { rx: Math.PI / 2 }), COULEURS.armure),
      teindre(placer(new SphereGeometry(0.17, 10, 8), { y: 0.07 }), COULEURS.armure),
    ]);
    for (let i = 0; i < 3; i++) {
      const p = piece(forme, 0xffffff, true, true);
      p.groupe.visible = false;
      this.groupe.add(p.groupe);
      this.pool.push(p.groupe);
    }
  }
  /** Pose les boucliers de la simulation (`metres` convertit les unités). Rend la position du premier (de quoi semer la traînée), ou `null`. */
  maj(boucliers: readonly Pick<Bouclier, "x" | "y" | "d" | "etat" | "age">[], temps: number, metres: (u: number) => number): { x: number; z: number }[] {
    const lieux: { x: number; z: number }[] = [];
    this.pool.forEach((g, i) => {
      const b = boucliers[i];
      g.visible = b !== undefined && b.age < 9000;
      if (!b || !g.visible) return;
      g.position.set(metres(b.x), 0.95, metres(b.y));
      g.rotation.set(0.25, temps * 22 + i, 0.15);
      lieux.push({ x: metres(b.x), z: metres(b.y) });
    });
    return lieux;
  }
}

/** La TRAÎNÉE du coup d'élan : une bande claire du point de départ de la fente jusqu'au chevalier, qui s'efface en un instant. */
export class TraineeElan {
  readonly maillage: Mesh;
  private readonly matiere = new MeshBasicMaterial({ color: new Color(COULEURS.lame).multiplyScalar(1.5), transparent: true, opacity: 0, depthWrite: false, side: DoubleSide, fog: false });
  private debut: { x: number; z: number; cap: number } | null = null;
  private vie = 0;
  constructor() {
    const g = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    g.translate(0.5, 0, 0);
    this.maillage = new Mesh(g, this.matiere);
    this.maillage.renderOrder = 5;
    this.maillage.visible = false;
  }
  /** La fente commence en (x, z), tournée vers `cap` (radians). */
  lancer(x: number, z: number, cap: number): void {
    this.debut = { x, z, cap };
    this.vie = 1;
  }
  /** Chaque image : le chevalier en (cx, cz) ; la bande va du départ à lui et s'efface en ~0,3 s après la fente. */
  maj(dt: number, cx: number, cz: number, enFente: boolean): void {
    if (!this.debut || this.vie <= 0) {
      this.maillage.visible = false;
      return;
    }
    if (!enFente) this.vie = Math.max(0, this.vie - dt / 0.3);
    const d = this.debut;
    const lon = Math.hypot(cx - d.x, cz - d.z);
    this.maillage.visible = lon > 0.2;
    this.maillage.position.set(d.x, 0.45, d.z);
    this.maillage.rotation.y = -d.cap;
    this.maillage.scale.set(lon, 1, 0.75);
    this.matiere.opacity = 0.7 * this.vie;
  }
}
