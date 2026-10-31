// Accès de débogage exposé par le jeu avec `?debug` (voir src/main.ts), tel que les tests de navigateur le lisent.
interface CdjDebug {
  phase: string;
  /** Interface (lot 29) : accueil, réglages, aide ouverts ; classement replié ou masqué ; réglages courants ; qualité. */
  ui: {
    home: boolean;
    settings: boolean;
    howto: boolean;
    boardFolded: boolean;
    boardHidden: boolean;
    settingsValues: { graphismes: string; particles: boolean; skids: boolean; shake: boolean; speedFeel: string; shadows: boolean; ghost: string; board: boolean; splits: boolean; unit: string };
    paused: boolean;
    quality: number;
    qualityLocked: boolean;
    homeAllowed: boolean;
  };
  /** Synchronisation du profil (lot 30) : état, pseudo vu par le serveur, record du jour gardé ici, identifiant et pseudo locaux. */
  sync: {
    status: "idle" | "syncing" | "ok" | "offline" | "revoked" | "unknown" | "disabled";
    at: number | null;
    known: boolean | null;
    renameRequired: boolean;
    nameProblem: { message: string; suggestions: string[] } | null;
    error: string | null;
    best: { ms: number; replay: boolean } | null;
    playerId: string;
    name: string | null;
  };
  ghost: { z: number; tick: number } | null;
  car: { x: number; y: number; z: number; vx: number; vy: number; vz: number; yaw: number; tick: number; nx: number; ny: number; nz: number; grounded: number };
  race: unknown;
  /** Dernière commande appliquée à la simulation. */
  input: { steer: number; throttle: number; brake: number; respawn: number };
  paused: boolean;
  /** Identifiant du circuit joué et planning en vigueur (lot 14) : variante, thème imposé, planning connu, essai, classement permis. */
  trackId: string | null;
  plan: { variant: number; theme: string | null; known: boolean; trial: boolean; ranked: boolean };
  /** Le circuit du jour tel que le fil de travail l'a rendu (lot 36) ; `null` hors du circuit du jour. */
  circuit: { number: number; attempt: number; spec: string; authorMs: number; palette: string; theme: string; trackId: string; medals: { author: number; gold: number; silver: number; bronze: number }; fallback: boolean } | null;
  /** Interface tactile active. */
  touch: boolean;
  /** Salon (lot 26) : déroulé, classement, fantômes, horloge pilotable ; `null` hors du Salon. */
  salon: {
    state: "playing" | "podium" | "switching";
    finaleOn: boolean;
    startLocked: boolean;
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
    stats: { mainThreadGenerations: number; swaps: number; boardPolls: number; submits: number; prefetched: number; overtaken: number; buildMs: number; swapMs: number; swapAt: number; prebuilt: number; builtInSwap: number; prebuilds: number };
    setNow(ms: number): void;
    setGhostMode(mode: "all" | "top" | "off"): void;
    refresh(): Promise<void>;
  } | null;
  /** Spectateur (lot 27b) : tour regardé, vitesse, pause, pas courant et total, caméra ; `null` hors du mode. */
  watch: {
    waiting: boolean;
    name: string | null;
    announcedMs: number | null;
    mode: "first" | "mine" | "salon" | null;
    speed: number;
    paused: boolean;
    tick: number;
    total: number;
    finishMs: number;
    phase: string;
    free: boolean;
    label: boolean;
    carVisible: boolean;
    orbit: { yaw: number; pitch: number; dist: number };
    seek(tick: number): void;
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
  thumbnail(date: string, options?: { view?: "tilted" | "top"; webgl?: boolean; scale?: number; theme?: string }): Promise<{ url: string; timing: { build: number; draw: number } }>;
  /** Lot 44 : le décor du thème, chargé à la demande (ms depuis l'ouverture de la page) ; posé à l'arrêt seulement. */
  decor: { palette: string; demandeMs: number | null; pretMs: number | null; poseMs: number | null; posePhase: string | null; poseDureeMs: number; poseEnCourse: number; dansScene: boolean; pret: boolean };
  /** Socle par paliers (lot 39) : enregistrer un pas factice et un composeur, demander un palier, lire le palier et l'identité de la scène courante. */
  /** La voiture (retouche 40b) : le choix en vigueur, la voiture d'essai (`?voiture=`), la voiture vue est-elle celle voulue, compteurs, course classée ou non. */
  voiture: {
    choix: { id: string; couleur: number; motif: string };
    essai: { id: string; couleur: number; motif: string } | null;
    aJour: boolean;
    stats: { construites: number; remplacees: number; chargements: number; civileMs: number; remplaceeA: number };
    maillages: number;
    triangles: number;
    counted: boolean;
    /** Lot 41 : le Garage, une fois chargé (sinon `null`) : la voiture regardée, les voitures débloquées, hors connexion, la réponse du serveur. */
    garage: { regardee: string; debloquees: string[]; horsLigne: boolean; statut: unknown } | null;
    /** Le fantôme du record est-il dessiné (dernière image) ? */
    fantome: boolean;
    /** Lot 51 : le modèle du fantôme affiché (celui de la voiture de sa course) et la voiture qu'on voit (celle qui part avec le temps, ou celle d'une rediffusion regardée). */
    fantomeVoiture: string;
    affichee: { id: string; couleur: number; motif: string; teinteMotif: number };
  };
  /** Lot 47 : le post-traitement du palier 3 (ordinateur) — voulu par la scène, permis par l'appareil, allumé, ce qui l'a coupé ; essais : `echouer(n)`, `chaine` (lecture). */
  post: {
    demande: boolean;
    permis: boolean;
    actif: boolean;
    /** Lot 50 : la chaîne, le mode copie (moteur sans multi-échantillonnage de l'écran, sans la chaîne) ou rien ; l'écran du moteur ; le halo dessiné. */
    mode: "chaine" | "copie" | null;
    ecranMsaa: boolean;
    halo: boolean;
    coupe: "contexte" | "echecs" | null;
    contexteHS: boolean;
    parties: { halo: boolean; etalonnage: boolean; anticrenelage: boolean } | null;
    echantillons: number | null;
    octets: number;
    appels: number;
    triangles: number;
    echecs: number;
    echouer(n: number): void;
    chaine: { scene: { width: number; height: number; samples: number } | null } | null;
  };
  /** Lot 45 : la qualité graphique (règle automatique et réglage). */
  qualite: {
    choix: "auto" | "economie" | "equilibree" | "maximale";
    appareil: { ordinateur: boolean; logiciel: boolean; demiFlottants: boolean; memoire?: number };
    passes: boolean;
    memoire: { palier: 1 | 2 | 3; date: number; mediane: number | null; pixels: number; echecs: number; plafond: 1 | 2 | 3 | null; durable: boolean; sansPost?: boolean; trop?: boolean } | null;
    aMesurer: boolean;
    mesure: number | null;
    derniere: { mediane: number; hz: number; palier: 1 | 2 | 3 } | null;
    enAttente: boolean;
    /** Lot 50 : la dernière fenêtre de 5 s de course, la descente qui attend l'arrêt ; `ralentir(ms)` impose la durée des images vue par la surveillance. */
    course: { mediane: number; hz: number } | null;
    descente: boolean;
    ralentir(ms: number | null): void;
  };
  socle: {
    composer(track: unknown, palette: string, palier: string, options?: unknown): unknown;
    brancherComposeur(palier: string, composeur: (track: unknown, palette: string, options: unknown) => unknown): void;
    PAS_DU_JEU: Record<string, () => Promise<unknown>>;
    PAS_DU_PALIER: Record<string, string[]>;
    demander(palier: string, plus?: string[]): void;
    palier(): string;
    /** Lot 46 : les pas que la scène prend en plus de ceux de son palier (`?reglages=2+vie+ciel`). */
    plus(): string[];
    scene(): string;
    /** Lot 43 : durée de construction de la scène du premier circuit (ms). */
    constructionMs: number;
    /** Lot 43 : le compteur d'images de `?debug`. */
    images: { ips: number; pireMs: number } | null;
  };
  /** Lot 43 : les feux de départ, lus dans l'état du décompte. */
  feux: { rouges: number; vert: boolean };
  /** Lot 51 : la résolution — le tampon, la densité, les cibles de la chaîne (la scène : largeur, hauteur, échantillons ; le halo) et le FXAA. */
  resolution: { tampon: [number, number]; densite: number; sceneCible: [number, number, number] | null; haloCibles: [number, number][]; fxaa: boolean };
  /** Rendu (lot 23) : qualité, ombres, phares, halos, décor dense, panneaux, brume. */
  render: { quality: number; shadowMap: number; headlights: number; halos: { count: number; visible: boolean }; denseDecor: boolean; decor?: boolean; hills: boolean; signs: number; fog: { near: number; far: number } | null; feux?: { rouges: number; vert: boolean }; chrono?: number; pas?: Record<string, Record<string, unknown>>; programs: number; textures: number; calls: number; triangles: number; renderMs: number; renderFrames: number; moteurImages: number };
  /** Caméra active (lot 23). */
  camera: { name: string; carVisible: boolean; fov: number };
  cycleCamera(): void;
  /** Air (lot 19) : indicateur « figé » allumé, dernière réception (force et qualité ∈ [0, 1]), part « en vol » de la caméra. */
  air: { frozen: boolean; lastLanding: { strength: number; quality: number }; cameraMix: number };
  /** Sons (lot 9) : derniers sons joués, contexte démarré, réglages. */
  audio: {
    log: string[];
    running: boolean;
    settings: { volume: number; last: number };
    ambience: string | null;
    /** Lot 55 : le nouveau son (null tant qu'il n'est pas chargé) : la voiture qu'on entend, moteur prêt, version légère, compresseur, boîte virtuelle, nœuds, boucles qui jouent. */
    ext: { voiture: string; pret: boolean; leger: boolean; compresseur: boolean; rapport: number; rpm: number; noeuds: number; brefs: number; sources: number; chargements: number; ponctuels: string[] } | null;
  };
}

/** Outils de la vitrine de la scène (lot 38 et retouche 38b, `/track/vitrine/`, voir src/vitrine/vitrine.ts). */
/** Lot 40 : les outils de la planche « Voiture » (src/vitrine/voiture.ts). */
interface VoitureDebug {
  toutDessiner(theme?: string): Promise<{ col: string; palier: number; sorte: "arret" | "fantome"; triangles: number; maillages: number; appels: number }[]>;
  planche(theme: string, largeur?: number, hauteur?: number): Promise<string>;
  planchesCouleurs(col: "civile" | "A" | "B" | "C", toile: HTMLCanvasElement, largeur?: number, hauteur?: number): Promise<string>;
  /** Retouche 40b, lot 40c : le motif de la livrée de toutes les voitures de la planche (huit motifs), sa teinte (rang), la couleur de la caisse, le thème des vues à l'arrêt. */
  choisirMotif(m: "course" | "flancs" | "filet" | "bicolore" | "chevrons" | "damier" | "rond" | "unie"): Promise<void>;
  choisirTeinte(rang: number): Promise<void>;
  choisirCouleur(hex: number): Promise<void>;
  motifsDisponibles(): readonly ("course" | "flancs" | "filet" | "bicolore" | "chevrons" | "damier" | "rond" | "unie")[];
  reglerTheme(theme: string): void;
  /** Une vue à l'arrêt ; `cible` : le point regardé dans le repère de la voiture (un gros plan). */
  apercu(col: string, palier: 1 | 2 | 3, azimut: number, elevation: number, distance: number, largeur: number, hauteur: number, cible?: readonly [number, number, number]): Promise<string>;
  mesurerColonne(col: string, palier: 1 | 2 | 3, largeur: number, hauteur: number, images: number): Promise<{ imageMs: number; sceneSeuleMs: number; appels: number; appelsScene: number }>;
}

/** Lot 55 : les outils de la planche « Son » (src/vitrine/son.ts). */
type ApprocheSon = "actuel" | "A" | "B";
interface MesureSon {
  noeuds: number;
  octets: number;
  decodageMs: number;
  memoire: number;
  jsMs: number;
  images: number;
  charge: { moyenne: number; pic: number } | null;
}
interface SonDebug {
  module: {
    rendreHorsLigne(approche: ApprocheSon, voiture: string, secondes?: number, avecRoues?: boolean): Promise<{
      sr: number;
      crete: number;
      rms: number;
      nonFinis: number;
      noeuds: number;
      donnees: Float32Array;
      fenetres: { t: number; rpm: number; attendu: number; trouve: number; rms: number; brillance: number }[];
    }>;
    verifierFuites(approche: ApprocheSon, voiture: string): Promise<{ crees: number; deconnectes: number; sourcesDemarrees: number; sourcesArretees: number }>;
  };
  planche: {
    activer(): Promise<void>;
    choisir(approche: ApprocheSon, voiture?: string): Promise<void>;
    etat(): { actif: boolean; approche: ApprocheSon; voiture: string; rapport: number; rpm: number; vitesse: number; t: number; lecture: boolean; noeuds: number; mesures: Partial<Record<ApprocheSon, MesureSon>> };
    aller(t: number): void;
    mesurer(approche: ApprocheSon, images?: number, ms?: number): Promise<MesureSon>;
    arreter(): void;
  };
}

interface VitrineDebug {
  /** La planche : les paliers (retouche 38b, par défaut), les directions (lot 38, `?planche=directions`) ou la voiture (lot 40, `?planche=voiture`). */
  planche: "paliers" | "directions" | "voiture" | "son";
  erreurs: string[];
  vues(): { sujet: string; variante: string; etat: string; constructionMs: number; appels: number; triangles: number; textures: number; cibles: number }[];
  construireTout(sujet?: string): Promise<void>;
  capture(sujet: string, variante: string, largeur: number, hauteur: number): Promise<string | null>;
  mesurer(sujet: string, variante: string, largeur: number, hauteur: number, images: number): Promise<{ constructionMs: number; moyenneMs: number; pireMs: number; envoiMs: number; appels: number; triangles: number; textures: number; cibles: number } | null>;
  /** Les réglages de la colonne « à la carte » et de la vue en mouvement (« 2 », « 1+halo », « 3-halo ») : les change si on en donne, les rend. */
  reglages(texte?: string): string;
  /** La vue en mouvement (retouche 38b). */
  mouvement: {
    ouvrir(sujet: string, scene?: "existant" | "paliers"): Promise<void>;
    etat(): Promise<{
      ouverte: boolean;
      theme: string;
      scene: "existant" | "paliers";
      reglages: string;
      roule: boolean;
      images: number;
      ips: number;
      imageMs: number;
      pireMs: number;
      appels: number;
      triangles: number;
      constructionMs: number;
      memoire: { generees: number; cibles: number; post: number };
      distanceCamera: number;
      pas: number;
      erreur: string | null;
    } | null>;
    fermer(): void;
  };
  /** Lot 40 : la planche « Voiture » (`?planche=voiture`), une fois montée (sinon `null`). */
  voiture(): Promise<VoitureDebug | null>;
  /** Lot 55 : la planche « Son » (`?planche=son`), une fois montée (sinon `null`). */
  son(): Promise<SonDebug | null>;
}

interface Window {
  __cdj: CdjDebug;
  __vitrine?: VitrineDebug;
}
