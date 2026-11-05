import { type Anim, type DecorTheme, type Forme, HAUTEUR_PLANCHE, LARGEUR_PLANCHE, calmer, contour } from "./logique";

// Lot B5 — le DESSINATEUR Canvas 2D des décors : il pose le décor d'un thème derrière la grille. **Des aplats, aucun dégradé, aucune image.** La planche (400 × 300 px de dessin) est mise à l'échelle de la hauteur de l'écran (ou de sa
// largeur en portrait), ancrée au bas de l'écran et répétée en largeur, en miroir une tuile sur deux ; le ciel monte au-dessus (la première bande) quand l'écran est un portrait. Le décor fixe est peint UNE fois dans un canevas de
// cache à chaque changement de taille ; à chaque image on le recopie, puis on peint les animations lentes (neige, houle, fenêtres, oiseaux) — figées avec « mouvements réduits ». Affichage seulement.

/** La planche couvre au moins cette largeur de dessin : sur un écran étroit (portrait) elle est agrandie pour que la tuile du milieu le remplisse. */
const LARGEUR_MIN = 200;

export class DecorCanvas {
  private cache: HTMLCanvasElement | null = null;
  private w = 1;
  private h = 1;
  private dpr = 1;
  private s = 1;
  private y0 = 0;
  private readonly ciel: string;
  private readonly teintes = new Map<string, string>();

  constructor(private readonly d: DecorTheme) {
    this.ciel = d.bandes[0]!.c;
  }

  private teinte(c: string): string {
    let t = this.teintes.get(c);
    if (t === undefined) this.teintes.set(c, (t = calmer(c, this.ciel, this.d.calme)));
    return t;
  }

  /** À appeler à chaque changement de taille : `w` × `h` en pixels CSS. */
  dimensionner(w: number, h: number, dpr: number): void {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.dpr = dpr;
    this.s = Math.min(this.h / HAUTEUR_PLANCHE, this.w / LARGEUR_MIN);
    this.y0 = this.h - HAUTEUR_PLANCHE * this.s;
    const c = this.cache ?? document.createElement("canvas");
    c.width = Math.round(this.w * dpr);
    c.height = Math.round(this.h * dpr);
    this.cache = c;
    const g = c.getContext("2d");
    if (!g) return;
    this.peindreFixe(g);
  }

  /** Les tuiles à poser de chaque côté de celle du milieu : seulement celles que l'écran voit (aucune sur un portrait, une de chaque côté à 1 920 px). */
  private get tuiles(): number {
    return Math.max(0, Math.ceil((this.w / 2 - (LARGEUR_PLANCHE / 2) * this.s) / (LARGEUR_PLANCHE * this.s)));
  }

  /** Pose la transformation d'une tuile : `j` = 0 est celle du milieu ; une tuile sur deux est en miroir. */
  private poser(g: CanvasRenderingContext2D, j: number, dx = 0, dy = 0): void {
    const { s, dpr } = this;
    const tx = this.w / 2 + j * LARGEUR_PLANCHE * s;
    const miroir = Math.abs(j) % 2 === 1;
    g.setTransform(dpr * (miroir ? -s : s), 0, 0, dpr * s, dpr * (miroir ? tx + (LARGEUR_PLANCHE / 2) * s + dx * -s : tx - (LARGEUR_PLANCHE / 2) * s + dx * s), dpr * (this.y0 + dy * s));
  }

  private forme(g: CanvasRenderingContext2D, f: Forme): void {
    const c = this.teinte(f.c);
    g.fillStyle = c;
    switch (f.t) {
      case "r":
        g.fillRect(f.x, f.y, f.w, f.h);
        if (f.ink) {
          g.strokeStyle = contour(c);
          g.lineWidth = 1;
          g.strokeRect(f.x + 0.5, f.y + 0.5, f.w - 1, f.h - 1);
        }
        break;
      case "p":
      case "c": {
        g.beginPath();
        if (f.t === "c") g.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        else {
          g.moveTo(f.pts[0]!, f.pts[1]!);
          for (let i = 2; i < f.pts.length; i += 2) g.lineTo(f.pts[i]!, f.pts[i + 1]!);
          g.closePath();
        }
        g.fill();
        if (f.ink) {
          g.strokeStyle = contour(c);
          g.lineWidth = 1;
          g.stroke();
        }
        break;
      }
      case "l":
        g.strokeStyle = c;
        g.lineWidth = f.w;
        g.beginPath();
        g.moveTo(f.x1, f.y1);
        g.lineTo(f.x2, f.y2);
        g.stroke();
        break;
    }
  }

  private peindreFixe(g: CanvasRenderingContext2D): void {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.cache!.width, this.cache!.height);
    const K = this.tuiles;
    // Le ciel : la première bande part du haut de l'écran, chaque bande va jusqu'à la suivante ; la dernière jusqu'au bas.
    this.poser(g, 0);
    const haut = -this.y0 / this.s - 1;
    this.d.bandes.forEach((b, i) => {
      const de = i === 0 ? haut - 10 : b.de;
      const a = i + 1 < this.d.bandes.length ? this.d.bandes[i + 1]!.de : HAUTEUR_PLANCHE + 10;
      g.fillStyle = this.teinte(b.c);
      g.fillRect(-this.w / this.s, de, 2 * this.w / this.s + LARGEUR_PLANCHE, a - de);
    });
    for (const plan of this.d.plans) {
      this.poser(g, 0);
      for (const f of plan.centre) this.forme(g, f);
      for (let j = -K; j <= K; j++) {
        this.poser(g, j);
        for (const f of plan.repete) this.forme(g, f);
      }
    }
  }

  private anim(g: CanvasRenderingContext2D, a: Anim, t: number, reduit: boolean): void {
    const phase = reduit ? 0 : t / a.T + (a.ph ?? 0);
    const sin = Math.sin(phase * 2 * Math.PI);
    if (a.mode === "scintille" && !(reduit || sin > -0.25)) return;
    const dx = a.mode === "derive" ? sin * a.a : 0;
    const dy = a.mode === "bob" ? sin * a.a : 0;
    const tuiles = a.repete || a.mode === "tombe" ? this.tuiles : 0;
    for (let j = -tuiles; j <= tuiles; j++) {
      if (a.mode === "tombe") {
        // La neige : un bloc de formes de `a` px de haut, recopié vers le haut pour couvrir l'écran, qui descend en boucle.
        const haut = -this.y0 / this.s;
        const decal = ((phase % 1) + 1) % 1 * a.a;
        for (let m = Math.floor(haut / a.a) - 1; m * a.a < HAUTEUR_PLANCHE; m++) {
          this.poser(g, j, 0, decal + m * a.a);
          for (const f of a.formes) this.forme(g, f);
        }
      } else {
        this.poser(g, j, dx, dy);
        for (const f of a.formes) this.forme(g, f);
      }
    }
  }

  /** Peint le décor : à appeler à chaque image, avant tout le reste de la scène. `t` : secondes ; `reduit` : « mouvements réduits ». */
  dessiner(g: CanvasRenderingContext2D, t: number, reduit: boolean): void {
    if (!this.cache) return;
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(this.cache, 0, 0);
    for (const a of this.d.anims) this.anim(g, a, t, reduit);
    g.restore();
  }
}
