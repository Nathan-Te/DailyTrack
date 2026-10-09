// Accès de débogage exposé par le jeu avec `?debug` (voir src/main.ts), tel que les tests de navigateur le lisent.
interface CdjDebug {
  phase: string;
  ghost: { z: number; tick: number } | null;
  car: { x: number; y: number; z: number; vx: number; vy: number; vz: number; yaw: number; tick: number; nx: number; ny: number; nz: number; grounded: number };
  race: unknown;
  /** Dernière commande appliquée à la simulation. */
  input: { steer: number; throttle: number; brake: number; respawn: number };
  paused: boolean;
  /** Identifiant du circuit joué et planning en vigueur (lot 14) : variante, thème imposé, planning connu, essai, classement permis. */
  trackId: string | null;
  plan: { variant: number; theme: string | null; known: boolean; trial: boolean; ranked: boolean };
  /** Interface tactile active. */
  touch: boolean;
  /** Salon (lot 26) : déroulé, classement, fantômes, horloge pilotable ; `null` hors du Salon. */
  salon: {
    state: "playing" | "overrun" | "podium" | "switching";
    session: number;
    trackId: string;
    theme: string;
    sessionMs: number;
    demo: boolean;
    board: { version: number; participants: number; players: number; rows: { rank: number; ref: string; name: string; ms: number; gap: number; mine?: boolean }[]; me: { rank: number; name: string; ms: number } | null } | null;
    best: number | null;
    players: number;
    lastError: string;
    ghostMode: "all" | "top" | "off";
    ghosts: { names: string[]; count: number; shown: number; labels: number; loaded: number; rejected: number; cost: { stepMs: number; steps: number; placeMs: number; frames: number } } | null;
    podiumVisible: boolean;
    now: number;
    endMs: number;
    stats: { mainThreadGenerations: number; swaps: number; boardPolls: number; submits: number; prefetched: number; overtaken: number; buildMs: number; swapMs: number; swapAt: number; prebuilt: number; builtInSwap: number };
    setNow(ms: number): void;
    setGhostMode(mode: "all" | "top" | "off"): void;
    refresh(): Promise<void>;
  } | null;
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
    fov: number;
    wheelDroop: number[];
    tel: { wall: unknown; tilt: number; onWall: boolean };
  };
  /** Miniatures (lot 13) : compteurs et durées de fabrication, images en attente. */
  thumbs: {
    stats: { memoryHits: number; storeHits: number; made: number; generateMs: number[]; renderMs: number[]; encodeMs: number[]; bytes: number; ranWhileBlocked: number; mainThreadGenerations: number };
    pending: number;
  };
  /** Dessine tout de suite la miniature d'un jour (cadrage, vues) : adresse de l'image et durées (ms). */
  thumbnail(date: string, options?: { view?: "tilted" | "top"; webgl?: boolean; scale?: number; theme?: string }): { url: string; timing: { build: number; draw: number } };
  /** Rendu (lot 23) : qualité, ombres, phares, halos, décor dense, panneaux, brume. */
  render: { quality: number; shadowMap: number; headlights: number; halos: { count: number; visible: boolean }; denseDecor: boolean; hills: boolean; signs: number; fog: { near: number; far: number } | null; programs: number; calls: number; triangles: number; renderMs: number; renderFrames: number };
  /** Caméra active (lot 23). */
  camera: { name: string; carVisible: boolean; fov: number };
  cycleCamera(): void;
  /** Air (lot 19) : indicateur « figé » allumé, dernière réception (force et qualité ∈ [0, 1]), part « en vol » de la caméra. */
  air: { frozen: boolean; lastLanding: { strength: number; quality: number }; cameraMix: number };
  /** Sons (lot 9) : derniers sons joués, contexte démarré, réglages. */
  audio: { log: string[]; running: boolean; settings: { volume: number; last: number }; ambience: string | null };
}

interface Window {
  __cdj: CdjDebug;
}
