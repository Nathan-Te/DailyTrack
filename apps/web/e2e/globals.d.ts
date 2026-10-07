// Accès de débogage exposé par le jeu avec `?debug` (voir src/main.ts), tel que les tests de navigateur le lisent.
interface CdjDebug {
  phase: string;
  ghost: { z: number; tick: number } | null;
  car: { x: number; z: number; vx: number; vz: number; yaw: number; tick: number };
  race: unknown;
  /** Dernière commande appliquée à la simulation. */
  input: { steer: number; throttle: number; brake: number; respawn: number };
  paused: boolean;
  /** Identifiant du circuit joué et planning en vigueur (lot 14) : variante, thème imposé, planning connu, essai, classement permis. */
  trackId: string | null;
  plan: { variant: number; theme: string | null; known: boolean; trial: boolean; ranked: boolean };
  /** Interface tactile active. */
  touch: boolean;
  autoplay(code: string): void;
  /** Pas à pas : la simulation n'avance plus qu'avec `advance`. */
  manual(on: boolean): void;
  advance(ticks: number): Promise<void>;
  /** Effets visuels (lot 9) : particules émises par type, qualité, secousse, débattement des roues. */
  fx: {
    emitted: Record<"smoke" | "surface" | "spark" | "flame" | "land" | "confetti" | "flash" | "skid", number>;
    /** Segments de traces de pneus posés. */
    marks: number;
    quality: number;
    particles: number;
    enabled: boolean;
    shake: number;
    fovKick: number;
    wheelDroop: number[];
    tel: { wall: unknown };
  };
  /** Miniatures (lot 13) : compteurs et durées de fabrication, images en attente. */
  thumbs: {
    stats: { memoryHits: number; storeHits: number; made: number; generateMs: number[]; renderMs: number[]; encodeMs: number[]; bytes: number; ranWhileBlocked: number; mainThreadGenerations: number };
    pending: number;
  };
  /** Dessine tout de suite la miniature d'un jour (cadrage, vues) : adresse de l'image et durées (ms). */
  thumbnail(date: string, options?: { view?: "tilted" | "top"; webgl?: boolean; scale?: number; theme?: string }): { url: string; timing: { build: number; draw: number } };
  /** Sons (lot 9) : derniers sons joués, contexte démarré, réglages. */
  audio: { log: string[]; running: boolean; settings: { volume: number; last: number } };
}

interface Window {
  __cdj: CdjDebug;
}
