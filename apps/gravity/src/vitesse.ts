// La sensation de VITESSE (lot GR6) : au-delà d'un seuil de vitesse réelle de la caméra, des **lignes de vitesse** défilent en fond et la caméra **recule un peu** pour mieux voir devant. **Présentation seulement** : la vitesse
// est celle de la simulation (`vitesseCamera`, portails de vitesse compris), rien ici ne la change. Tout suit les pas (`temps` = pas / 120 : la pause fige les lignes) ; aucun hasard (`Math.random`) : les lignes sont tirées
// une fois par un petit générateur entier. **Secousses : jamais pour un portail.**
import { BufferGeometry, DoubleSide, Float32BufferAttribute, Mesh, MeshBasicMaterial } from "three";
import { CASE, VITESSE_PLAFOND } from "@cdj/gravity-sim";

/** Le seuil (cases par seconde) au-delà duquel les lignes de vitesse apparaissent : juste au-dessus de la plus haute croisière (15 cases/s à partir de la 3e boucle, lot GR7), donc **seulement avec un portail de vitesse**. */
export const SEUIL_LIGNES = 15.1;
/** La vitesse (cases par seconde) où les lignes sont à leur pleine intensité : le plafond absolu de la simulation (17). */
export const VITESSE_PLEINE = VITESSE_PLAFOND / CASE;
/** Le recul de la caméra, au plus (cases) : le héros se voit un peu plus près du bord gauche, on voit plus loin devant. Proportionnel à (vitesse − seuil), borné. */
export const RECUL_MAX = 1.4;
/** La rapidité du lissage (par seconde) du recul et de l'intensité : une seconde et demie pour se poser, jamais d'à-coup quand un portail change la vitesse. */
export const TAUX_RECUL = 3;
export const TAUX_LIGNES = 6;

const borne = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v));
/** L'intensité des lignes, de 0 (sous le seuil) à 1 (vitesse maximale). */
export const intensiteLignes = (vitesse: number): number => borne((vitesse - SEUIL_LIGNES) / (VITESSE_PLEINE - SEUIL_LIGNES), 0, 1);
/** Le recul voulu de la caméra (cases) à cette vitesse (cases par seconde) : nul sous le seuil, `RECUL_MAX` au maximum. */
export const reculVoulu = (vitesse: number): number => RECUL_MAX * intensiteLignes(vitesse);
/** Un pas de lissage exponentiel de `courant` vers `cible` (`dt` en secondes, `taux` par seconde) : `dt` nul (la pause) ne bouge rien. */
export const lisser = (courant: number, cible: number, dt: number, taux: number): number => courant + (cible - courant) * (1 - Math.exp(-taux * Math.max(0, dt)));

/** Les lignes : 16 traits horizontaux au plus, un petit générateur entier (aucun hasard du navigateur). */
export const NB_LIGNES = 16;

interface Trait {
  /** La hauteur dans la vue (−0,5 à 0,5 de sa hauteur), la longueur (cases), la rapidité relative et la phase de départ (0 à 1). */
  y: number;
  longueur: number;
  rapidite: number;
  phase: number;
}

/** Le tirage des traits : le même à chaque partie, sur tous les appareils (entiers). */
export function tirerLesTraits(n = NB_LIGNES): Trait[] {
  let graine = 0x2f6e2b1;
  const suite = (): number => {
    graine = (Math.imul(graine, 1664525) + 1013904223) >>> 0;
    return graine / 4294967296;
  };
  return Array.from({ length: n }, (_, i) => ({ y: (i + 0.15 + suite() * 0.7) / n - 0.5, longueur: 2.4 + suite() * 3.6, rapidite: 0.85 + suite() * 0.7, phase: suite() }));
}

/** La position (cases, depuis le bord gauche de la vue) du début d'un trait au temps `temps` : il file vers la gauche, plus vite quand la vitesse monte, et reparaît à droite. Pure. */
export function departDuTrait(t: Trait, temps: number, vitesse: number, largeur: number): number {
  const periode = largeur + t.longueur;
  const brut = t.phase * periode - temps * vitesse * t.rapidite * 0.9;
  return (((brut % periode) + periode) % periode) - t.longueur;
}

/** Les lignes de vitesse : un seul tampon mis à jour à chaque image, derrière le monde (z < 0), collé à l'écran (il suit la caméra). */
export class LignesDeVitesse {
  readonly mesh: Mesh;
  private readonly geo = new BufferGeometry();
  private readonly mat = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: DoubleSide, depthWrite: false });
  private readonly pos = new Float32Array(NB_LIGNES * 12);
  private readonly traits = tirerLesTraits();

  constructor() {
    const idx: number[] = [];
    for (let i = 0; i < NB_LIGNES; i++) idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
    this.geo.setIndex(idx);
    this.geo.setAttribute("position", new Float32BufferAttribute(this.pos, 3).setUsage(35048));
    this.geo.setDrawRange(0, 0);
    this.mesh = new Mesh(this.geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  /** La couleur des traits (papier sur un décor sombre, encre sur un décor clair). */
  colorer(couleur: number): void {
    this.mat.color.setHex(couleur);
  }

  /**
   * `intensite` : 0 à 1 ; `temps` : secondes de pas ; `vitesse` : cases par seconde ; `vue` : la largeur et la hauteur de la vue (cases) et `gauche`, `centreY` : son bord gauche et son centre vertical (monde).
   * Sous une intensité presque nulle, rien n'est dessiné.
   */
  maj(intensite: number, temps: number, vitesse: number, vue: { largeur: number; hauteur: number; gauche: number; centreY: number }): void {
    const visible = intensite > 0.02;
    this.mesh.visible = visible;
    if (!visible) return;
    this.mat.opacity = 0.18 + 0.42 * intensite;
    const n = Math.max(2, Math.ceil(NB_LIGNES * intensite));
    const epaisseur = 0.035 + 0.05 * intensite;
    for (let i = 0; i < n; i++) {
      const t = this.traits[i]!;
      const x0 = departDuTrait(t, temps, vitesse, vue.largeur);
      const l = t.longueur * (0.6 + 0.4 * intensite);
      const y = t.y * vue.hauteur * 0.92;
      const o = i * 12;
      this.pos.set([x0, y - epaisseur, 0, x0 + l, y - epaisseur, 0, x0 + l, y + epaisseur, 0, x0, y + epaisseur, 0], o);
    }
    (this.geo.getAttribute("position") as Float32BufferAttribute).needsUpdate = true;
    this.geo.setDrawRange(0, n * 6);
    this.mesh.position.set(vue.gauche, vue.centreY, -0.3);
  }

  detruire(): void {
    this.geo.dispose();
    this.mat.dispose();
  }
}
