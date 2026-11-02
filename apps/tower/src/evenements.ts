import type { Effet, NomMedaille, Taille, VuePartie, VuePiece } from "@cdj/tower-sim";
import { boitesE, COMMANDE, estBonus, TICKS_PAR_SECONDE } from "@cdj/tower-sim";

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
//   taquet / choc / cale / souffle   (lot T9) les quatre temps du taquet, lus dans la vue et dans les commandes du tick : le coup part (la pièce en main file de côté), il percute un bloc (la pièce est lâchée net contre lui),
//                   la pièce percutée repose calée, ou le coup s'arrête dans le vide ou au bord (un petit souffle). **Affichage seulement** : la simulation n'en sait rien.
export type EvenementJeu =
  | { genre: "deplacement" }
  | { genre: "rotation" }
  | { genre: "contact"; taille: Taille; vitesse: number; id?: number; x?: number; y?: number }
  | { genre: "taquet"; id: number; sens: -1 | 1 }
  | { genre: "choc"; id: number; sens: -1 | 1 }
  | { genre: "cale"; id: number }
  | { genre: "souffle"; id: number; sens: -1 | 1 }
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
export const GENRES_EVENEMENTS: readonly GenreEvenement[] = ["deplacement", "rotation", "contact", "palier", "effet", "perte", "effondrement", "ventDebut", "ventFin", "cri", "plouf", "fin", "medaille", "taquet", "choc", "cale", "souffle"];

/** Le coup de taquet avance la pièce de 0,25 m par tick (`taquetPas8` = 2 huitièmes) : au moins cela (moins une marge) la fait compter comme « en train de filer ». */
export const COUP_AVANCE_MIN = 0.15;
/** Une pièce percutée qui reste sous cette vitesse (m/s) pendant `CALE_TICKS` ticks, ou qui s'endort, est calée ; passé `CALE_MAX_TICKS` on n'attend plus. */
const CALE_VITESSE = 0.12;
const CALE_TICKS = 10;
const CALE_MAX_TICKS = 300;
/** Les ticks d'un coup (`taquetTicks` = 6 par défaut) : au bout, le coup est fini. */
const COUP_TICKS = 6;
/** Une pièce est « contre » un bloc si son bord, dans le sens du coup, est à moins de cela du bord du bloc (m) et si elles se recouvrent d'au moins `RECOUVREMENT_MIN` en hauteur. */
const ECART_CONTRE = 0.12;
const RECOUVREMENT_MIN = 0.15;

/** Les rectangles d'une pièce de la vue (mètres) : chacune de ses boîtes, tournée de l'angle de la pièce, réduite à sa boîte englobante. */
function rectangles(p: VuePiece): { x0: number; x1: number; y0: number; y1: number }[] {
  const c = Math.cos(p.angle);
  const s = Math.sin(p.angle);
  return boitesE(p.kind, p.rot, p.taille).map((b) => {
    const xs: number[] = [];
    const ys: number[] = [];
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
      const lx = (b.cx + sx * b.hw) / 8;
      const ly = (b.cy + sy * b.hh) / 8;
      xs.push(p.x + lx * c - ly * s);
      ys.push(p.y + lx * s + ly * c);
    }
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  });
}

/** La pièce `p` est-elle collée, dans le sens `sens`, contre une autre pièce de la vue ? (Le choc d'un taquet : elle est lâchée arrêtée contre un bloc, alors qu'un lâcher ordinaire se fait sur ce qui est dessous.) */
export function estContre(p: VuePiece, sens: -1 | 1, vue: VuePartie): boolean {
  const a = rectangles(p);
  return vue.pieces.some((q) => {
    if (q.id === p.id || q.etat !== "libre") return false;
    const b = rectangles(q);
    return a.some((r) =>
      b.some((u) => {
        const ecart = sens > 0 ? u.x0 - r.x1 : r.x0 - u.x1;
        return ecart <= ECART_CONTRE && ecart >= -0.2 && Math.min(r.y1, u.y1) - Math.max(r.y0, u.y0) >= RECOUVREMENT_MIN;
      }),
    );
  });
}

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
  /** Lot T9 : le coup de taquet en cours (la pièce, son sens, les ticks qu'il lui reste) et la pièce percutée qu'on attend de voir calée. */
  private coup: { id: number; sens: -1 | 1; reste: number } | null = null;
  private percutee: { id: number; depuis: number; calme: number } | null = null;

  /** `cris` : les numéros des pièces qui viennent de passer à l'état le plus affolé (`AnalyseurPanique.nouveauxAffoles`). `commandes` : le masque de commandes du tick (lot T9 : le bit du taquet ouvre un coup). */
  observer(vue: VuePartie, cris: readonly number[] = [], commandes = 0): EvenementJeu[] {
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
          sortie.push({ genre: "contact", taille: p.taille, vitesse: w, id: p.id, x: p.x, y: p.y });
        } else if (q.etat === "libre" && p.etat === "libre" && !p.fixe && !p.endormie) {
          const avantV = this.vitesses.get(p.id) ?? 0;
          const chute = avantV - v;
          if (avantV > CHOC_MIN && chute >= CHOC_MIN && (!choc || chute > choc.vitesse)) choc = { taille: p.taille, vitesse: chute };
        }
      }
      this.vitesses = vitesses;
      // Au plus un choc par tick (le plus fort) : une avalanche ne fait pas cent sons.
      if (choc) sortie.push({ genre: "contact", taille: choc.taille, vitesse: choc.vitesse });
      // Lot T9 — le taquet, en quatre temps.
      this.lireTaquet(sortie, passe, maintenant, vue, commandes);
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

  /**
   * Les temps du taquet : (2) le coup part — le bit du taquet est levé et la pièce en main file de côté d'un quart de mètre ou plus ; (3) le choc — la pièce est lâchée net, arrêtée contre un bloc, alors qu'elle
   * filait au tick d'avant (ou le coup est parti à bout portant) ; (4) calée — la pièce percutée reste immobile quelques ticks ; sinon le coup s'arrête dans le vide ou au bord et ne laisse qu'un souffle.
   */
  private lireTaquet(sortie: EvenementJeu[], passe: Map<number, VuePiece>, maintenant: Map<number, VuePiece>, vue: VuePartie, commandes: number): void {
    const bit = commandes & COMMANDE.TAQUET_GAUCHE ? -1 : commandes & COMMANDE.TAQUET_DROITE ? 1 : 0;
    const c = this.coup;
    if (c) {
      const p = maintenant.get(c.id);
      const q = passe.get(c.id);
      if (!p || !q || p.etat === "perdue" || p.etat === "abandonnee") this.coup = null;
      else if (q.etat === "active" && p.etat === "libre") {
        // Lâchée pendant un coup : le choc, si elle est collée contre un bloc (un lâcher ordinaire se fait sur ce qui est dessous).
        if (estContre(p, c.sens, vue)) {
          sortie.push({ genre: "choc", id: p.id, sens: c.sens });
          this.percutee = { id: p.id, depuis: vue.tick, calme: 0 };
        }
        this.coup = null;
      } else if ((p.x - q.x) * c.sens < COUP_AVANCE_MIN || --c.reste <= 0) {
        // Le coup finit (arrêté net, ou au bout de ses ticks). Collée contre un bloc, la pièce a frappé : c'est un choc (elle sera calée dès qu'elle repose) ; sinon il ne reste qu'un petit souffle.
        if (estContre(p, c.sens, vue)) {
          sortie.push({ genre: "choc", id: p.id, sens: c.sens });
          this.percutee = { id: p.id, depuis: vue.tick, calme: 0 };
        } else sortie.push({ genre: "souffle", id: p.id, sens: c.sens });
        this.coup = null;
      }
    } else if (bit !== 0) {
      const id = vue.active;
      const q = passe.get(id);
      const p = maintenant.get(id);
      if (q && p && q.etat === "active") {
        const dx = (p.x - q.x) * bit;
        if (p.etat === "active" && dx >= COUP_AVANCE_MIN) {
          sortie.push({ genre: "taquet", id, sens: bit });
          this.coup = { id, sens: bit, reste: COUP_TICKS - 1 };
        } else if (p.etat === "libre" && dx < 0.05 && estContre(p, bit, vue)) {
          // Parti à bout portant : le coup et le choc dans le même tick.
          sortie.push({ genre: "taquet", id, sens: bit }, { genre: "choc", id, sens: bit });
          this.percutee = { id, depuis: vue.tick, calme: 0 };
        }
      }
    }
    const e = this.percutee;
    if (e) {
      const p = maintenant.get(e.id);
      const q = passe.get(e.id);
      if (!p || !q || p.etat === "perdue" || p.etat === "abandonnee" || vue.tick - e.depuis > CALE_MAX_TICKS) this.percutee = null;
      else if (p.etat === "libre") {
        const lent = Math.hypot(p.x - q.x, p.y - q.y) * TICKS_PAR_SECONDE < CALE_VITESSE;
        e.calme = lent ? e.calme + 1 : 0;
        if (p.endormie || e.calme >= CALE_TICKS) {
          sortie.push({ genre: "cale", id: e.id });
          this.percutee = null;
        }
      }
    }
  }

  reinitialiser(): void {
    this.coup = null;
    this.percutee = null;
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
