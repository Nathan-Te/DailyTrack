import type { Effet, NomMedaille, Taille, VuePartie, VuePiece } from "@cdj/tower-sim";
import { estBonus, TICKS_PAR_SECONDE } from "@cdj/tower-sim";

// Les événements de la partie (lot T5), **lus dans la vue** : on compare deux vues successives et on dit ce qui s'est passé — de quoi donner un son, une secousse, un clignement des vies. Comme
// `eventsBetween` de Jump : **les effets s'abonnent aux événements, jamais à la simulation** ; la liste est pure, testée, et rien n'en retourne dans la simulation.
//
//   deplacement   la pièce active s'est décalée d'une demi-case (un ordre du joueur ; la poussée du vent, d'un huitième, n'en est pas un)
//   rotation      la pièce active a tourné d'un quart de tour
//   contact       une pièce se pose (le lâcher : elle touche la tour) ou heurte quelque chose (elle ralentit d'un coup) : sa taille et la vitesse du choc
//   palier        un palier est franchi (bonus ou malus)
//   effet         l'effet entre en jeu : la première pièce qui le porte vient de naître
//   perte         une pièce passe sous la plateforme (une vie de moins) : `cascade` dit combien d'autres viennent d'être perdues avec elle
//   effondrement  plusieurs pièces perdues d'affilée, ou la tour qui perd plus de `CHUTE_TOUR_MM` en une seconde et demie
//   ventDebut / ventFin   la pièce active est soumise au coup de vent / ne l'est plus
//   cri           une pièce passe à l'état le plus affolé (voir `panique.ts`)
//   plouf         une pièce tombée touche l'eau (levé par la scène, pas par la vue)
//   fin / medaille  la partie est finie / la médaille obtenue (levés par le jeu)
export type EvenementJeu =
  | { genre: "deplacement" }
  | { genre: "rotation" }
  | { genre: "contact"; taille: Taille; vitesse: number }
  | { genre: "palier"; effet: Effet; bonus: boolean }
  | { genre: "effet"; effet: Effet; bonus: boolean }
  | { genre: "perte"; x: number; taille: Taille; cascade: number }
  | { genre: "effondrement"; force: 1 | 2 }
  | { genre: "ventDebut" }
  | { genre: "ventFin" }
  | { genre: "cri"; id: number }
  | { genre: "plouf"; x: number; taille: Taille }
  | { genre: "fin"; motif: "pieces" | "vies" }
  | { genre: "medaille"; nom: NomMedaille };

export type GenreEvenement = EvenementJeu["genre"];
export const GENRES_EVENEMENTS: readonly GenreEvenement[] = ["deplacement", "rotation", "contact", "palier", "effet", "perte", "effondrement", "ventDebut", "ventFin", "cri", "plouf", "fin", "medaille"];

/** Un ordre de déplacement vaut une demi-case (0,5 m) ; la poussée du vent, 0,125 m : la limite est entre les deux. */
const DEPLACEMENT_MIN = 0.3;
/** Une pièce libre qui perd plus que cela de vitesse (m/s) en un tick a heurté quelque chose. */
export const CHOC_MIN = 1.2;
/** Fenêtre d'une cascade (ticks) et temps d'attente entre deux grondements. */
export const FENETRE_CASCADE = 90;
const ATTENTE_EFFONDREMENT = 180;
/** La tour qui perd cette hauteur (mm) en `FENETRE_TOUR` ticks s'effondre, même sans perdre de pièce. */
export const CHUTE_TOUR_MM = 1500;
const FENETRE_TOUR = 90;

const parId = (v: VuePartie): Map<number, VuePiece> => new Map(v.pieces.map((p) => [p.id, p]));

/** L'observateur d'une partie : à appeler une fois par tick avec la vue (et les cris de l'analyseur de panique) ; il rend les événements de ce tick. */
export class Observateur {
  private avant: VuePartie | null = null;
  private plusGrandId = -1;
  private effetDerniere: Effet | null = null;
  private vent = false;
  private pertes: number[] = [];
  private hauteurs: { tick: number; mm: number }[] = [];
  private dernierGrondement = -Infinity;
  /** La vitesse de chaque pièce au tick précédent (m/s), pour reconnaître un choc. */
  private vitesses = new Map<number, number>();

  /** `cris` : les numéros des pièces qui viennent de passer à l'état le plus affolé (`AnalyseurPanique.nouveauxAffoles`). */
  observer(vue: VuePartie, cris: readonly number[] = []): EvenementJeu[] {
    const sortie: EvenementJeu[] = [];
    const a = this.avant;
    const maintenant = parId(vue);
    if (a) {
      const passe = parId(a);
      const dt = Math.max(1, vue.tick - a.tick) / TICKS_PAR_SECONDE;
      // Les ordres du joueur, sur la pièce active.
      const pa = a.active >= 0 ? passe.get(a.active) : undefined;
      const pn = vue.active >= 0 ? maintenant.get(vue.active) : undefined;
      if (pa && pn && pa.id === pn.id && pa.etat === "active" && pn.etat === "active") {
        if (Math.abs(pn.x - pa.x) >= DEPLACEMENT_MIN) sortie.push({ genre: "deplacement" });
        if (pn.rot !== pa.rot) sortie.push({ genre: "rotation" });
      }
      // Le lâcher : la pièce active devient libre (elle touche la tour).
      let choc: { taille: Taille; vitesse: number } | null = null;
      const vitesses = new Map<number, number>();
      for (const p of vue.pieces) {
        const q = passe.get(p.id);
        if (!q) continue;
        const v = Math.hypot(p.x - q.x, p.y - q.y) / dt;
        vitesses.set(p.id, v);
        if (q.etat === "active" && p.etat === "libre") {
          const w = Math.max(v, this.vitesses.get(p.id) ?? 0);
          sortie.push({ genre: "contact", taille: p.taille, vitesse: w });
        } else if (q.etat === "libre" && p.etat === "libre" && !p.fixe && !p.endormie) {
          const avantV = this.vitesses.get(p.id) ?? 0;
          const chute = avantV - v;
          if (avantV > CHOC_MIN && chute >= CHOC_MIN && (!choc || chute > choc.vitesse)) choc = { taille: p.taille, vitesse: chute };
        }
      }
      this.vitesses = vitesses;
      // Au plus un choc par tick (le plus fort) : une avalanche ne fait pas cent sons.
      if (choc) sortie.push({ genre: "contact", taille: choc.taille, vitesse: choc.vitesse });
      // Les pièces perdues.
      const perdues = vue.pieces.filter((p) => p.etat === "perdue" && passe.get(p.id) && passe.get(p.id)!.etat !== "perdue");
      for (const p of perdues) {
        this.pertes.push(vue.tick);
        this.pertes = this.pertes.filter((t) => vue.tick - t <= FENETRE_CASCADE);
        sortie.push({ genre: "perte", x: p.x, taille: p.taille, cascade: this.pertes.length - 1 });
      }
      if (perdues.length > 0 && this.pertes.length >= 2 && vue.tick - this.dernierGrondement >= ATTENTE_EFFONDREMENT) {
        this.dernierGrondement = vue.tick;
        sortie.push({ genre: "effondrement", force: 2 });
      }
      // La tour qui s'effondre sans rien perdre.
      this.hauteurs.push({ tick: vue.tick, mm: a.hauteurMm });
      this.hauteurs = this.hauteurs.filter((h) => vue.tick - h.tick <= FENETRE_TOUR);
      const haut = this.hauteurs.reduce((m, h) => Math.max(m, h.mm), 0);
      if (haut - vue.hauteurMm >= CHUTE_TOUR_MM && vue.tick - this.dernierGrondement >= ATTENTE_EFFONDREMENT) {
        this.dernierGrondement = vue.tick;
        sortie.push({ genre: "effondrement", force: 1 });
      }
      // Le palier franchi, puis l'effet quand la pièce qui le porte naît.
      if (vue.declenches > a.declenches && vue.dernierEffet) sortie.push({ genre: "palier", effet: vue.dernierEffet, bonus: estBonus(vue.dernierEffet) });
    }
    // Une pièce vient de naître avec un effet : il se déclenche (le coup de vent, trois pièces, ne sonne qu'à la première).
    for (const p of vue.pieces) {
      if (p.id <= this.plusGrandId) continue;
      this.plusGrandId = p.id;
      if (p.effet && p.effet !== this.effetDerniere) sortie.push({ genre: "effet", effet: p.effet, bonus: estBonus(p.effet) });
      this.effetDerniere = p.effet;
    }
    // Le vent : la pièce active est soumise au coup de vent.
    const active = vue.active >= 0 ? maintenant.get(vue.active) : undefined;
    const venteuse = active?.effet === "vent" && vue.phase === "jeu";
    if (venteuse && !this.vent) sortie.push({ genre: "ventDebut" });
    if (!venteuse && this.vent) sortie.push({ genre: "ventFin" });
    this.vent = venteuse;
    for (const id of cris) sortie.push({ genre: "cri", id });
    this.avant = vue;
    return sortie;
  }

  reinitialiser(): void {
    this.avant = null;
    this.plusGrandId = -1;
    this.effetDerniere = null;
    this.vent = false;
    this.pertes = [];
    this.hauteurs = [];
    this.dernierGrondement = -Infinity;
    this.vitesses.clear();
  }
}

/** Les événements de la fin d'une partie : la fin elle-même, puis la médaille obtenue s'il y en a une. */
export function evenementsDeFin(motif: "pieces" | "vies", medaille: NomMedaille | null): EvenementJeu[] {
  return medaille ? [{ genre: "fin", motif }, { genre: "medaille", nom: medaille }] : [{ genre: "fin", motif }];
}
