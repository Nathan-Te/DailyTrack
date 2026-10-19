// Le carnage de tout le monde s'adapte à l'appareil (lot P4 de la plateforme), à la manière du `QualityGovernor` de DailyTrack — **logique
// pure, sans DOM** (testée sous Node) ; le jeu ne fait que lui donner la durée de chaque image et appliquer ce qu'il décide (rendu seul : la
// simulation de chaque vie ne change pas, le compteur « N vies de M joueurs » garde le vrai total).
//
// Pendant les **premières secondes** du carnage (`GOVERNOR_WATCH_MS`), par fenêtres d'une seconde (après un court échauffement), le jeu mesure
// le **travail du fil principal par image** (pas de simulation + préparation du dessin) et l'**intervalle entre images**. Une fenêtre trop
// lourde (travail moyen au-delà de `FRAME_WORK_LIMIT_MS`, ou moins de 50 images/s) fait descendre d'un palier :
//   0. 150 vies montrées, particules normales ;  1. 100 vies ;  2. 60 vies ;  3. 60 vies, particules à moitié ;  4. 60 vies, sans particules.
// On ne remonte jamais pendant un carnage (pas de va-et-vient visible) ; après la fenêtre d'observation, le palier reste. Chaque carnage repart
// du palier 0 (l'appareil a pu changer d'état). Une image de plus de 250 ms (onglet caché, ralentissement ponctuel) n'est pas une mesure.

/** Vies montrées à chaque palier (au plus : un échantillon plus petit est montré en entier). */
export const EVERYONE_LIVES_STEPS = [150, 100, 60, 60, 60] as const;
/** Part des particules (éclats des morts) à chaque palier. */
export const EVERYONE_PARTICLE_STEPS = [1, 1, 1, 0.5, 0] as const;
export const GOVERNOR_LEVELS = EVERYONE_LIVES_STEPS.length;
/** Les premières images ne comptent pas (construction de la foule, premier dessin). */
export const GOVERNOR_WARMUP_MS = 300;
/** Une fenêtre de mesure. */
export const GOVERNOR_WINDOW_MS = 1000;
/** Au-delà, le palier ne bouge plus. */
export const GOVERNOR_WATCH_MS = 5000;
/**
 * Travail moyen du fil principal par image au-delà duquel le carnage s'allège : 12 ms. Le budget d'une image à 60 i/s est 16,7 ms ; on garde
 * au moins 2 ms de marge (14,7 ms), et le navigateur a encore sa part (composition, événements) hors de ce que le jeu mesure.
 */
export const FRAME_WORK_LIMIT_MS = 12;
/** Intervalle moyen entre images au-delà duquel le carnage s'allège : 20 ms (moins de 50 images/s : le processeur graphique ne suit pas). */
export const FRAME_INTERVAL_LIMIT_MS = 20;
/** Une image plus longue n'est pas une mesure (onglet caché, pause). */
const IGNORED_FRAME_MS = 250;

export interface GovernorWindow {
  frames: number;
  workMs: number;
  intervalMs: number;
}

export class CarnageGovernor {
  /** Palier courant (0 : le carnage complet). */
  level = 0;
  /** Les fenêtres mesurées (moyennes), pour `__jump.carnage.state.governor` et la mesure. */
  readonly windows: { work: number; interval: number; level: number }[] = [];
  private start: number | null = null;
  private window: GovernorWindow = { frames: 0, workMs: 0, intervalMs: 0 };
  private windowStart = 0;

  constructor(
    private readonly options: { workLimitMs?: number; intervalLimitMs?: number; locked?: number | null } = {},
  ) {
    if (options.locked !== undefined && options.locked !== null) this.level = clampLevel(options.locked);
  }

  /** Vies d'autres joueurs montrées au palier courant. */
  get maxLives(): number {
    return EVERYONE_LIVES_STEPS[this.level]!;
  }

  /** Part des particules au palier courant. */
  get particles(): number {
    return EVERYONE_PARTICLE_STEPS[this.level]!;
  }

  /** Le palier est-il encore surveillé ? */
  watching(now: number): boolean {
    return this.locked === null && (this.start === null || now - this.start < GOVERNOR_WATCH_MS);
  }

  private get locked(): number | null {
    return this.options.locked ?? null;
  }

  /**
   * Une image vient d'être dessinée : `workMs` = travail du fil principal (pas + dessin), `intervalMs` = temps depuis l'image précédente, `now`
   * = l'heure de la page. Rend vrai si le palier a changé (le jeu applique alors `maxLives` et `particles`).
   */
  observe(workMs: number, intervalMs: number, now: number): boolean {
    if (this.locked !== null) return false;
    if (this.start === null) {
      this.start = now;
      this.windowStart = now + GOVERNOR_WARMUP_MS;
      return false;
    }
    if (now - this.start >= GOVERNOR_WATCH_MS || now < this.windowStart) return false;
    if (!(workMs >= 0) || !(intervalMs > 0) || intervalMs > IGNORED_FRAME_MS || workMs > IGNORED_FRAME_MS) return false;
    const w = this.window;
    w.frames++;
    w.workMs += workMs;
    w.intervalMs += intervalMs;
    if (now - this.windowStart < GOVERNOR_WINDOW_MS || w.frames < 5) return false;
    const work = w.workMs / w.frames;
    const interval = w.intervalMs / w.frames;
    this.window = { frames: 0, workMs: 0, intervalMs: 0 };
    this.windowStart = now;
    const heavy = work > (this.options.workLimitMs ?? FRAME_WORK_LIMIT_MS) || interval > (this.options.intervalLimitMs ?? FRAME_INTERVAL_LIMIT_MS);
    const changed = heavy && this.level < GOVERNOR_LEVELS - 1;
    if (changed) this.level++;
    this.windows.push({ work, interval, level: this.level });
    return changed;
  }
}

const clampLevel = (n: number): number => Math.max(0, Math.min(GOVERNOR_LEVELS - 1, Math.floor(n)));
