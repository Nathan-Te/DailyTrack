// Lot 45 — **la mesure de la règle de qualité** (38b, § 5), à la demande : elle ne sert qu'à la première visite, chaque semaine ou quand l'écran change de
// taille (`qualite.ts` dit quand ; `main.ts` charge ce module à ce moment-là, à l'accueil). Logique pure, testée (`test/qualite.test.ts`) :
//   - on écarte les 30 premières images (compilation des programmes), puis on prend la **médiane de 90 intervalles d'image** ;
//   - seuils à 60 Hz, ramenés à la fréquence de l'écran (90, 120 Hz) : médiane ≤ 13 ms → on monte d'un palier et on remesure ; ≥ 22 ms → on descend ;
//   - deux mesures ratées de suite (« descendre ») au-dessus du palier 1 : on s'en souvient (plafond durable) ; une mesure interrompue ne compte pas.
import type { MemoireQualite, NiveauQualite } from "./qualite";

/** Images écartées au début d'une mesure (compilation des programmes, textures envoyées), puis intervalles mesurés. */
export const ECARTEES = 30;
export const INTERVALLES = 90;
/** Seuils à 60 Hz (ms) : à ramener à la fréquence de l'écran (`seuils`). */
export const MONTER_MS = 13;
export const DESCENDRE_MS = 22;
/** La fréquence de l'écran (Hz), estimée sur les intervalles les plus courts d'une mesure : 60, 90, 120 ou 144 (60 si l'image n'a jamais suivi l'écran). */
export function frequenceEcran(intervalles: readonly number[]): number {
  if (intervalles.length === 0) return 60;
  const tries = [...intervalles].sort((a, b) => a - b);
  const court = tries[Math.floor(tries.length * 0.1)]!;
  return [144, 120, 90].find((hz) => 1000 / court >= hz * 0.92) ?? 60;
}

/** Les seuils (ms) d'un écran : ceux de 60 Hz, ramenés à sa fréquence. */
export const seuils = (hz: number) => ({ monter: (MONTER_MS * 60) / hz, descendre: (DESCENDRE_MS * 60) / hz });

export function mediane(xs: readonly number[]): number {
  const t = [...xs].sort((a, b) => a - b);
  const m = t.length >> 1;
  return t.length % 2 ? t[m]! : (t[m - 1]! + t[m]!) / 2;
}

/** Ce que dit une mesure : monter, descendre ou rester. */
export function verdict(med: number, hz = 60): "monter" | "descendre" | "rester" {
  const s = seuils(hz);
  return med <= s.monter ? "monter" : med >= s.descendre ? "descendre" : "rester";
}

/** Une mesure en cours : on écarte les premières images, puis on garde les intervalles. */
export class MesureImages {
  private vues = 0;
  readonly intervalles: number[] = [];
  /** Ajoute l'intervalle d'une image (ms) ; vrai quand la mesure est complète. */
  ajouter(ms: number): boolean {
    if (this.vues++ >= ECARTEES) this.intervalles.push(ms);
    return this.intervalles.length >= INTERVALLES;
  }
}

/**
 * Après une mesure : le palier suivant et ce qu'on garde. `med` : la médiane (ms), ou `null` si la mesure n'a pas pu finir (l'accueil fermé, l'onglet caché) :
 * elle ne compte pas, on la refera. Une mesure **ratée** est une mesure qui dit « descendre » : on descend d'un palier ; deux de suite au-dessus du palier 1,
 * on s'en souvient (le plafond devient durable : la remesure de la semaine suivante ne remonte pas au-dessus). `encore` : il faut remesurer au nouveau palier.
 * Rien n'est changé en course : `main.ts` applique à l'accueil.
 */
export function apresMesure(m: MemoireQualite, med: number | null, hz: number, maintenant: number, pixels: number, avecPost = false): { memoire: MemoireQualite; encore: boolean } {
  if (med === null) return { memoire: m, encore: true };
  // `mediane` reste `null` tant que le palier atteint n'est pas mesuré : un départ avant la fin de la série la reprend au prochain chargement.
  const base = { ...m, date: maintenant, pixels, mediane: null };
  const v = verdict(med, hz);
  // Lot 50 : au palier 3 avec le post-traitement (Auto, s'il y est), on descend d'abord la chaîne, et on remesure le palier 3 sans elle.
  if (v === "descendre" && avecPost) return { memoire: { ...base, sansPost: true }, encore: true };
  const plafond = m.plafond ?? 3;
  if (v === "descendre" && m.palier > 1) {
    const palier = (m.palier - 1) as NiveauQualite;
    const echecs = m.echecs + 1;
    // Une descente fixe le plafond de la série (on ne remonte pas aussitôt au palier qui ne tenait pas) ; deux de suite, il devient durable.
    return { memoire: { ...base, palier, echecs, plafond: Math.min(plafond, palier) as NiveauQualite, durable: m.durable || echecs >= 2 }, encore: true };
  }
  if (v === "monter" && m.palier < plafond) return { memoire: { ...base, palier: (m.palier + 1) as NiveauQualite, echecs: 0 }, encore: true };
  return { memoire: { ...base, mediane: med, echecs: 0 }, encore: false };
}

/**
 * Lot 47 : la chaîne de post-traitement vient d'être coupée par une panne (perte du contexte WebGL, deux images où elle n'a pas pu dessiner) : le jeu redescend au
 * palier 2 (avec la vie et le ciel) et s'en souvient — le plafond devient durable, la remesure ne remonte pas au palier 3 sur cet appareil.
 */
export function apresCoupure(m: MemoireQualite | null, maintenant: number, pixels: number): MemoireQualite {
  return { palier: 2, date: maintenant, mediane: null, pixels, echecs: m?.echecs ?? 0, plafond: 2, durable: true, ...souvenirs(m) };
}

/** La mémoire d'une série de mesures qui commence (le plafond durable est gardé ; une série pas finie reprend avec son plafond et ses échecs). */
export function memoireNeuve(palier: NiveauQualite, maintenant: number, pixels: number, avant: MemoireQualite | null): MemoireQualite {
  const suite = avant?.mediane === null;
  return { palier, date: maintenant, mediane: null, pixels, echecs: suite ? avant!.echecs : 0, plafond: suite || avant?.durable ? avant!.plafond : null, durable: !!avant?.durable, ...souvenirs(avant) };
}

/** Lot 50 : ce dont on se souvient d'une série à l'autre (le post-traitement refusé, « trop lourd »). */
const souvenirs = (m: MemoireQualite | null): Pick<MemoireQualite, "sansPost" | "trop"> => ({ ...(m?.sansPost ? { sansPost: true } : {}), ...(m?.trop ? { trop: true } : {}) });

/** Ce que la série de mesures demande au jeu (`main.ts`). */
export interface HoteMesure {
  /** Le palier où commence la série (`palierAuChargement` de `qualite.ts` : ce module ne l'importe pas, il resterait un morceau à part). */
  depart(): NiveauQualite;
  /** `cdj:qualite` tel qu'on le connaît (lu au chargement, puis après chaque mesure). */
  memoire(): MemoireQualite | null;
  /** Pixels dessinés (largeur × hauteur × densité²). */
  pixels(): number;
  /** Essais (`?intervalles=30,16`) : les médianes des mesures successives (la dernière se répète), à 60 Hz ; `null` : les vrais intervalles. */
  imposes: readonly number[] | null;
  /** Garde la mémoire (`cdj:qualite`) et demande le palier (la scène se reconstruit à l'accueil). */
  decider(m: MemoireQualite): void;
  /** Lot 50 : la scène mesurée a le post-traitement (une mesure ratée le retire d'abord). */
  post?(): boolean;
}

/**
 * Une série de mesures à l'accueil (la règle Auto) : mesure, monte ou descend d'un palier, remesure, jusqu'à un palier qui tient. `main.ts` lui donne chaque
 * intervalle d'image tant que l'accueil est ouvert et libre, et l'interrompt sinon (la mesure en cours ne compte pas, on la refera).
 */
export class SerieMesures {
  private serie: MemoireQualite | null = null;
  private imposees = 0;
  /** La mesure en cours, `null` entre deux mesures. */
  mesure: MesureImages | null = null;
  /** La dernière mesure faite (`?debug`). */
  derniere: { mediane: number; hz: number; palier: NiveauQualite } | null = null;
  constructor(private readonly h: HoteMesure) {}

  /** Une image de l'accueil : rend vrai tant qu'il reste à mesurer. */
  image(ms: number): boolean {
    const h = this.h;
    this.serie ??= memoireNeuve(h.depart(), Date.now(), h.pixels(), h.memoire());
    if (!this.mesure) {
      this.mesure = new MesureImages();
      return true;
    }
    if (!this.mesure.ajouter(h.imposes?.[Math.min(this.imposees, h.imposes.length - 1)] ?? ms)) return true;
    const { intervalles } = this.mesure;
    this.mesure = null;
    const med = mediane(intervalles);
    const hz = h.imposes ? 60 : frequenceEcran(intervalles);
    if (h.imposes) this.imposees++;
    const r = apresMesure(this.serie, med, hz, Date.now(), h.pixels(), h.post?.() ?? false);
    this.derniere = { mediane: med, hz, palier: this.serie.palier };
    this.serie = r.memoire;
    h.decider(r.memoire);
    return r.encore;
  }

  interrompre(): void {
    this.mesure = null;
  }
}

// --- Lot 50 : la règle surveille aussi la course ---------------------------------------------------------------------------------------------------------------
/** La fenêtre de la surveillance en course (ms d'images cumulées). */
export const FENETRE_COURSE_MS = 5000;

/**
 * La surveillance de la course : la médiane des intervalles d'image sur 5 s de course ; au-delà du seuil de descente (22 ms à 60 Hz, ramené à la fréquence de l'écran
 * estimée sur la fenêtre), une descente est proposée. **Rien ne change en course** : `main.ts` l'applique à la prochaine occasion hors course (`descenteCourse`).
 */
export class SurveillanceCourse {
  private intervalles: number[] = [];
  private somme = 0;
  /** La dernière fenêtre jugée (`?debug`). */
  derniere: { mediane: number; hz: number } | null = null;
  /** Une image de course (ms) ; vrai quand une fenêtre de 5 s finit au-delà du seuil. */
  image(ms: number): boolean {
    if (!(ms > 0) || ms > 500) return false; // un onglet en pause n'est pas une mesure
    this.intervalles.push(ms);
    this.somme += ms;
    if (this.somme < FENETRE_COURSE_MS) return false;
    const med = mediane(this.intervalles);
    const hz = frequenceEcran(this.intervalles);
    this.interrompre();
    this.derniere = { mediane: med, hz };
    return med >= seuils(hz).descendre;
  }
  /** Pause, arrivée, onglet caché : la fenêtre en cours ne compte pas. */
  interrompre(): void {
    this.intervalles = [];
    this.somme = 0;
  }
}

/**
 * Lot 50 : la descente d'un cran que la course a proposée, **d'abord la chaîne, puis le palier** — et on s'en souvient (`sansPost`, ou un plafond durable) ; `trop` dit aux
 * Réglages « Trop lourd pour cet appareil » (même en « Maximale », où rien n'est appliqué : c'est `main.ts` qui décide).
 */
export function descenteCourse(m: MemoireQualite | null, scene: { niveau: NiveauQualite; post: boolean }, maintenant: number, pixels: number): MemoireQualite {
  const base: MemoireQualite = m ?? { palier: scene.niveau, date: maintenant, mediane: null, pixels, echecs: 0, plafond: null, durable: false };
  if (scene.post) return { ...base, sansPost: true, trop: true };
  const palier = Math.max(1, scene.niveau - 1) as NiveauQualite;
  return { ...base, palier, plafond: palier, durable: true, trop: true };
}
