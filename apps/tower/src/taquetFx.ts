import { Group } from "three";
import { pointesEncre, rondEncre, trait } from "./polygones";
import { ENCRE } from "./couleurs";

// Lot T9 — **les effets du taquet** : le coup (traînées de vitesse cerclées d'encre, une bouffée d'air), le choc (un éclat étoilé jaune bordé d'encre au point d'impact, des éclats, deux confettis), la pièce calée (de la
// poussière qui retombe, une étincelle) et le petit souffle d'un coup qui s'arrête dans le vide ; plus la poussière et les fissures de la pose d'une pièce géante. Des aplats bordés d'encre, sans dégradé ni image.
// **Affichage seulement** : ces effets s'abonnent aux événements de la partie (`evenements.ts`) et ne lisent que la vue ; rien n'entre dans la simulation. Le hasard est celui de l'AFFICHAGE (`hasardAffichage.ts`).
// Chargé À LA DEMANDE avec `habits.ts` (jamais dans l'accueil). Avec le mouvement réduit : ni traînées, ni poussière, ni confettis ; l'éclat reste, immobile.

const JAUNE = "#F2B544";
const ROSE = "#F07FB0";
const BLANC = "#FFF6E0";
/** Devant toutes les pièces (les pièces vont de z = 1 à 3). */
const Z = 5;

interface Item {
  groupe: Group;
  age: number;
  duree: number;
  /** `k` : l'avancement (0 à 1). */
  anim(k: number): void;
}

/** Le décor d'une pièce dont les effets ont besoin : sa position et sa demi-taille (mètres, dans le monde). */
export interface Cadre {
  x: number;
  y: number;
  demiX: number;
  demiY: number;
}

export class EffetsTaquet {
  readonly racine = new Group();
  private items: Item[] = [];

  constructor(
    private readonly hasard: () => number,
    private readonly reduit: () => boolean = () => false,
  ) {
    this.racine.position.z = Z;
  }

  private lancer(groupe: Group, duree: number, anim: (k: number) => void): void {
    this.racine.add(groupe);
    anim(0);
    this.items.push({ groupe, age: 0, duree, anim });
  }

  /** Le temps 2 — le coup part : trois traînées derrière la pièce, une bouffée d'air. */
  coup(c: Cadre, sens: -1 | 1): void {
    if (this.reduit()) return;
    const g = new Group();
    const queue = c.x - sens * c.demiX;
    const barres = [[0.35, 1.7], [0, 2.1], [-0.35, 1.4]].map(([dy, l], i) => {
      const b = new Group();
      b.add(trait(ENCRE, 0, 0, -sens * l!, 0, 0.17, 0), trait("#FFFFFF", -sens * 0.04, 0, -sens * (l! - 0.04), 0, 0.085, 0.001));
      b.position.set(queue - sens * 0.1 * i, c.y + Math.max(-c.demiY * 0.7, Math.min(c.demiY * 0.7, dy!)), 0);
      g.add(b);
      return b;
    });
    const bouffees = [[0.45, -0.4, 0.2], [0.8, 0.15, 0.14]].map(([dx, dy, r]) => {
      const b = rondEncre("#FFFFFF", 0, 0, r!, 0.04, 0.002);
      b.position.set(queue - sens * dx!, c.y + dy! * c.demiY, 0);
      g.add(b);
      return b;
    });
    this.lancer(g, 0.22, (k) => {
      barres.forEach((b, i) => {
        b.scale.x = 1 - 0.6 * k;
        b.position.x = queue - sens * (0.1 * i + k * 0.9);
      });
      bouffees.forEach((b, i) => {
        b.scale.setScalar(0.6 + 1.3 * k);
        b.position.x = queue - sens * ((i === 0 ? 0.45 : 0.8) + k * 0.7);
        b.visible = k < 0.9;
      });
    });
  }

  /** Le temps 3 — le choc contre un bloc : un éclat étoilé au point d'impact, des éclats qui en partent, deux confettis. `intensite` : le curseur de l'éclat (1 normal, 0 aucun). */
  choc(c: Cadre, sens: -1 | 1, intensite: number): void {
    if (intensite <= 0) return;
    const g = new Group();
    const x = c.x + sens * c.demiX;
    const r = 0.75 * intensite;
    const etoile = pointesEncre(JAUNE, 0, 0, r, r * 0.42, 8, 0.01, this.hasard() * 0.4);
    const coeur = pointesEncre(BLANC, 0, 0, r * 0.45, r * 0.18, 4, 0.02, 0.4);
    const eclat = new Group();
    eclat.add(etoile, coeur);
    eclat.position.set(x, c.y, 0);
    g.add(eclat);
    // Les éclats : trois traits d'encre qui partent de l'impact, vers l'arrière et de côté.
    const traits = [-0.9, 0.1, 0.95].map((a, i) => {
      const t = trait(ENCRE, 0, 0, Math.cos(a + (sens > 0 ? Math.PI : 0)) * 0.5 * intensite, Math.sin(a + (sens > 0 ? Math.PI : 0)) * 0.5 * intensite, 0.09, 0.03 + i * 0.001);
      t.position.set(x, c.y, 0);
      g.add(t);
      return { t, a: a + (sens > 0 ? Math.PI : 0) };
    });
    const confettis = this.reduit() ? [] : [ROSE, BLANC].map((couleur, i) => {
      const m = pointesEncre(couleur, 0, 0, 0.1, 0.1, 2, 0.04, i);
      m.position.set(x, c.y, 0);
      g.add(m);
      return { m, vx: (-sens * (1.2 + 0.8 * this.hasard())) * (i ? 1 : 0.7), vy: 1.6 + this.hasard() };
    });
    this.lancer(g, 0.5, (k) => {
      const e = this.reduit() ? 1 : k < 0.5 ? 0.3 + 1.7 * (k / 0.5) : 1.15 - 0.15 * ((k - 0.5) / 0.5);
      eclat.scale.setScalar(e);
      eclat.visible = this.reduit() ? k < 0.4 : k < 0.7;
      for (const { t, a } of traits) {
        t.position.set(x + Math.cos(a) * k * 0.7, c.y + Math.sin(a) * k * 0.7, 0);
        t.visible = k < 0.6;
      }
      for (const { m, vx, vy } of confettis) {
        m.position.set(x + vx * k * 0.5, c.y + vy * k * 0.5 - 4 * k * k * 0.5, 0);
        m.rotation.z = k * 8;
      }
    });
  }

  /** Le temps 4 — la pièce calée : un peu de poussière qui retombe, une étincelle. */
  cale(c: Cadre): void {
    const g = new Group();
    const etincelle = pointesEncre(JAUNE, 0, 0, 0.2, 0.07, 4, 0.03, 0.4);
    etincelle.position.set(c.x + c.demiX * 0.85, c.y + c.demiY + 0.25, 0);
    g.add(etincelle);
    const poussiere = this.reduit() ? [] : [[-0.8, 0.28], [-0.2, 0.2], [0.5, 0.24]].map(([dx, r]) => {
      const p = rondEncre("#FFFFFF", 0, 0, r!, 0.035, 0.01);
      p.position.set(c.x + dx! * c.demiX * 1.2, c.y - c.demiY, 0);
      g.add(p);
      return { p, dx: dx! };
    });
    this.lancer(g, 0.8, (k) => {
      etincelle.scale.setScalar(this.reduit() ? 1 : 0.5 + Math.sin(Math.min(1, k * 2.2) * Math.PI) * 0.7);
      etincelle.visible = k < 0.55;
      for (const { p, dx } of poussiere) {
        p.position.set(c.x + dx * c.demiX * 1.2 + dx * k * 0.5, c.y - c.demiY + 0.2 - k * 0.45, 0);
        p.scale.setScalar(0.7 + 0.9 * k);
        p.visible = k < 0.92;
      }
    });
  }

  /** Sans choc — le coup s'arrête dans le vide ou au bord : un petit souffle au bout de la pièce. */
  souffle(c: Cadre, sens: -1 | 1): void {
    if (this.reduit()) return;
    const g = new Group();
    const p = rondEncre("#FFFFFF", 0, 0, 0.14, 0.03, 0.01);
    g.add(p);
    this.lancer(g, 0.35, (k) => {
      p.position.set(c.x + sens * (c.demiX + 0.2 + k * 0.6), c.y + 0.1 + k * 0.15, 0);
      p.scale.setScalar(0.6 + 1.2 * k);
      p.visible = k < 0.9;
    });
  }

  /** La pose d'une pièce géante : de la poussière aux deux pieds et des fissures sur ce qu'elle écrase (dessinées sous son milieu, quelques secondes). */
  poseGeante(c: Cadre): void {
    const g = new Group();
    const bas = c.y - c.demiY;
    const fissures = [[-0.2, -0.45], [0.25, 0.4]].map(([dx, inc], j) => {
      const f = new Group();
      const pts: [number, number][] = [[0, 0], [inc! * 0.5, -0.35], [-inc! * 0.3, -0.7], [inc! * 0.45, -1.05]];
      for (let i = 0; i + 1 < pts.length; i++) f.add(trait(ENCRE, pts[i]![0], pts[i]![1], pts[i + 1]![0], pts[i + 1]![1], 0.07, 0.002 + j * 0.001));
      f.position.set(c.x + dx! * c.demiX, bas, 0);
      g.add(f);
      return f;
    });
    const poussiere = this.reduit() ? [] : [[-1, 0.45], [-1.1, 0.3], [1, 0.45], [1.1, 0.3]].map(([s, r], i) => {
      const p = rondEncre("#FFFFFF", 0, 0, r!, 0.04, 0.01 + i * 0.001);
      p.position.set(c.x + s! * c.demiX, bas + 0.2, 0);
      g.add(p);
      return { p, s: s! };
    });
    this.lancer(g, 3, (k) => {
      for (const f of fissures) f.scale.y = k < 0.8 ? 1 : 1 - (k - 0.8) / 0.2;
      for (const { p, s } of poussiere) {
        const d = Math.min(1, k * 3.4);
        p.position.set(c.x + s * (c.demiX + d * 0.8), bas + 0.2 + d * 0.3, 0);
        p.scale.setScalar(0.6 + d);
        p.visible = d < 0.95;
      }
    });
  }

  /** À appeler à chaque image : fait avancer les effets et retire ceux qui sont finis. */
  maj(dt: number): void {
    for (const it of this.items) {
      it.age += dt;
      it.anim(Math.min(1, it.age / it.duree));
    }
    this.items = this.items.filter((it) => {
      if (it.age < it.duree) return true;
      this.racine.remove(it.groupe);
      it.groupe.traverse((o) => (o as { geometry?: { dispose(): void } }).geometry?.dispose());
      return false;
    });
  }

  /** Le nombre d'effets en cours (pour les tests). */
  get enCours(): number {
    return this.items.length;
  }

  vider(): void {
    for (const it of this.items) this.racine.remove(it.groupe);
    this.items = [];
  }
}
