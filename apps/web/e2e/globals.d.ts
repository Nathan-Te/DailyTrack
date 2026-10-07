// Accès de débogage exposé par le jeu avec `?debug` (voir src/main.ts), tel que les tests de navigateur le lisent.
interface CdjDebug {
  phase: string;
  ghost: { z: number; tick: number } | null;
  car: { x: number; z: number; vx: number; vz: number; yaw: number; tick: number };
  race: unknown;
  /** Dernière commande appliquée à la simulation. */
  input: { steer: number; throttle: number; brake: number; respawn: number };
  paused: boolean;
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
  /** Sons (lot 9) : derniers sons joués, contexte démarré, réglages. */
  audio: { log: string[]; running: boolean; settings: { volume: number; last: number } };
}

interface Window {
  __cdj: CdjDebug;
}
