import { parisDay, parisDayStart } from "@cdj/clock";
import { formatDay } from "@cdj/core";
import {
  ATTEMPT_DEAD,
  ATTEMPT_FINISHED,
  ATTEMPT_READY,
  DANGERS_LEVEL,
  DEATH_NAMES,
  DEFAULT_JUMP_PARAMS,
  ESSAI_LEVEL,
  ESSAI_SOLUTION_CODE,
  INPUT_MASK,
  JUMP_SIM_VERSION,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  RESPAWN_TICKS,
  SANDBOX_LEVEL,
  VENT_LEVEL,
  SPRINT_TRIAL_PARAMS,
  TICK_RATE,
  TILE_BELT_LEFT,
  TILE_BELT_RIGHT,
  UNITS_PER_TILE,
  decodeReplay,
  encodeReplay,
  groundTile,
  demoAttempts,
  fromRuns,
  lifeReplay,
  playerMode,
  replayAttempt,
  runsTicks,
  sawCenters,
  sectionAt,
  sectionPhases,
  windActive,
  windPhase,
  windPush,
  windZoneOf,
  buildModule,
  jumpMedalFor,
  jumpThemeForDay,
  replayStartState,
  type AttemptState,
  type DailyLevel,
  type JumpMedal,
  type JumpParams,
  type JumpReplay,
  type JumpThemeName,
  type Level,
  type PlayerState,
} from "@cdj/jump-sim";
import { CrowdMesh, GhostMesh, StainLayer } from "./actors";
import { Carnage, HERO, carnageLabel } from "./carnage";
import { Ghost } from "./ghost";
import { DayMemory, browserStorage, clearAll, loadGhostSetting, saveGhostSetting, type RecordedEssai } from "./memory";
import { stainFor } from "./stains";
import { followCamera, snapCamera, type CameraView, type Follow } from "./camera";
import { Controls } from "./input";
import { animateLook, motionOf, onSkid, onStep, restLook, stridePhase, type FeetPose, type Look } from "./look";
import { BurstMesh, BurstPool, Shake } from "./fx";
import { mountHud } from "./hud";
import { FixedStepper } from "./loop";
import { THEMES, themeByName, themeForDay } from "./themes";
import { createScene, type JumpScene, type SceneDetail, type SceneStats } from "./scene";
import type { DynamicStats } from "./dynamicArt";
import { blockLooks } from "./blocks";
import { windDirName, windLooks, windMix } from "./wind";
import type { WindStats } from "./windArt";
import { JumpSession, formatTicks, type SessionEvent } from "./session";
import { wantsTouch } from "./touch";
import { mountTouchUi, type TouchUi } from "./touchUi";
import { loadTuned, mountTunePanel } from "./tune";
import { LAUNCH_TILES, moduleTheme, nextModule, referenceTicks, solutionReplay } from "./modulesInfo";
import { archiveHref, dailyHref, homeHref, moduleHref, readUrlOptions, watchFirstHref, type Scenario } from "./urlOptions";
import { FIRST_GHOST_COLOR, OWN_GHOST_COLOR, checkFirstGhost, firstGhostLabel, showFirstGhost, type FirstGhost } from "./firstGhost";
import { browserFrozen, browserWorker, loadDaily, progressMessage, yieldToPaint, type DailyLoad } from "./dailyLoader";
import { MEDAL_ICON, NEW_DAY_TEXT, REFUSED_TEXT, chooseDay, dayLine, finishMedalText, isPreview, shortDate, type DayChoice } from "./dailyInfo";
import { FROZEN_DAYS } from "./frozen";
import { History, mayRecord, type DayRecord } from "./history";
import {
  ARCHIVE_STREAK_TEXT,
  archiveDays,
  archiveRow,
  countdownText,
  helpSeen,
  homeHeading,
  homeStatus,
  markHelpSeen,
  medalText,
  medalThresholds,
  plural,
  streakText,
  wantsHome,
} from "./homeLogic";
import { mountHome, type Home, type HomeView } from "./home";
import { mountArrival } from "./arrival";
import { shareText } from "./share";
import { sendShare } from "./clipboard";
import { CarnageFilter, EventLog, causeName, eventsBetween, type GameEvent } from "./events";
import { JumpAudio, type AudioDebug } from "./audio";
import { AMBIENCES, beltMix, sawMix } from "./audioLogic";
import { beltRuns } from "./surfaceArt";
import { textSeed } from "./decor";
import { NAME_KEY, ProfileSync, createIdentity, readIdentity, readPlayerId, type KeyValueStore } from "@cdj/profile";
import { applyJumpIdentity, applyJumpProfile, jumpStats, type JumpMe, type JumpMergeResult } from "./jumpProfile";
import { mountProfileUi } from "./profileUi";
import { copyText } from "./clipboard";
import { HttpRankSource, rankApiBase, type RankSource } from "./rankApi";
import { RankQueue } from "./rankQueue";
import { LIVES_EVERY_MS, LivesQueue, type LifeCandidate } from "./livesQueue";
import { LivesSender } from "./livesSender";
import { OTHERS_MAX_TILES, keepoutDistance as keepoutDistanceOf, keepoutOf, othersStains, type Keepout } from "./othersStains";
import { everyoneLives, everyonePlan, type EveryoneLives } from "./everyone";
import type { DeathMapData } from "./rankApi";
import { Ranking, mayRank } from "./ranking";
import { arrivalRankView, homeRankText } from "./rankView";
import { DEMO_TODAY, DemoRankSource } from "./demoRank";
import { BUILD_API_URL, demoStorage } from "./storage";
import { BELT_EVERY, Blink, ParticleMesh, Particles, SLIDE_EVERY, Trail, Vibrator, beltSpark, feelColors, feelEvent, slideSpark } from "./feel";
import { feelLevels, loadSettings, saveSettings, type FeelLevels, type PlayerSettings } from "./settings";
import { mountPauseMenu } from "./pauseMenu";

// Lot 11 (partie jeu) : le **thème est une donnée du générateur** (`daily.theme`, celui de la date ou un thème **forcé** par `?theme=`, qui est alors un
// **essai** : identifiant `…-t<thème>`, `DayMode` « essai », rien d'enregistré — ni mémoire du jour, ni historique, ni série, ni partage, bandeau
// d'essai). Deux surfaces dessinées en lecture seule (`tileArt.ts`, `surfaceArt.ts` : tapis à chevrons qui défilent dans un seul matériau, glace à
// reflets), trois événements par surface (`events.ts`), ronronnement spatialisé des tapis et crissement de la glace (`audioLogic.ts`), givre et
// étincelles de rouage (`feel.ts`), section « Tapis et glace » du panneau `?debug&tune` ; un morceau de mécanique s'ouvre dans son thème.
// Lot 10 : la boucle quotidienne. L'**accueil** (`home.ts`) s'ouvre sur la page par défaut, posé sur le niveau qui se charge derrière (Jouer
// = le geste qui réveille le son) ; on y revient par le menu ⏸ ou l'écran d'arrivée. L'**écran d'arrivée** (`arrival.ts`) remplace le
// bandeau pour le niveau du jour, **après** le carnage : temps, médaille, seuils, morts et essais du jour, série, Rejouer / Partager / Revoir
// le carnage / Accueil, compte à rebours. L'**historique** (`history.ts`, `jump:historique`) garde chaque jour joué (meilleur temps, médaille,
// morts, essais) et donne la série ; seul le niveau du jour, joué le jour même, y entre (une archive jamais). Les **niveaux figés**
// (`frozen.ts`) passent par `loadDaily`.
// Lot 8 : les sensations. Chaque pas, `eventsBetween` (events.ts, pur) compare les deux états de l'essai et en déduit les événements de jeu
// (saut, atterrissage, pas, glisse, mort, ressort, friable…) ; le son (`audio.ts`), les particules et les vibrations (`feel.ts`) ne
// s'abonnent qu'à eux. Le carnage n'en garde que les morts et les arrivées des autres vies, au débit plafonné. Menu ⏸ (Échap, P, Start,
// bouton) : pause, réglages du joueur (`jump:settings`, jamais `tuned`), commandes. `?fx=off` et le mouvement réduit coupent particules,
// secousses et traînée, jamais les taches.
// Lot 5 : le niveau du jour (`dailyLevel`) est la page par défaut ; `?seed=AAAA-MM-JJ` ouvre celui d'une date (archive, ou à venir sur un
// aperçu : le site publié refuse les dates futures, `dailyInfo.ts`) ; HUD « DailyJump #N » et médaille visée, médaille et temps de l'auteur
// à l'arrivée, `&solution` (la rediffusion de l'auteur), `?debug` (limites des morceaux, `__jump.daily`), passage de minuit.
// Lot 3 : rediffusions. Chaque essai est enregistré puis **rejoué** par la mémoire du jour (`memory.ts`), qui garde le meilleur essai, les
// vies et les morts du jour (stockage `jump:`, protégé : le jeu marche sans). Fantôme du meilleur essai calé sur le chrono (`ghost.ts`),
// carnage par vagues à l'arrivée (`carnage.ts`), taches de peinture (`stains.ts`), lecture `?watch=best`, démonstration `?carnage=demo`.
// Rien n'est enregistré avec des réglages modifiés.
// Lot 2 : dangers (pics, scies fixes et mobiles, blocs friables, ressorts), mort instantanée, réapparition en 0,15 s, chrono par essai,
// arrivée ; HUD (chrono, meilleur temps, morts), bandeau d'arrivée, éclatement et tremblement à la mort (`?fx=off` les coupe),
// `?debug&hitbox` (boîtes justes), scénarios `essai` (par défaut) et `dangers`.
// Lot 1b : commandes tactiles (zones sans trou, glissement ← →, saut au second doigt), page adaptée au téléphone, réglages au doigt.
// Lot 1 : le personnage. Boucle à pas fixe (120 Hz) sur `stepPlayer`, rendu interpolé, caméra qui suit, clavier et manette,
// surimpression et `window.__jump` avec `?debug`, panneau de réglages avec `?debug&tune`. Pas encore de danger ni d'arrivée.

/**
 * `ready` : l'essai attend la première commande ; `playing` : en course ; `dead` : éclaté, nouvel essai dans un instant ; `finished` : arrivé ;
 * `carnage` : toutes les vies du jour rejouées (lot 3).
 */
type Phase = "loading" | "ready" | "playing" | "dead" | "finished" | "carnage" | "no-webgl";

/** Le personnage tel que `__jump.player` le montre : unités humaines, plus l'état brut de la simulation. */
export interface PlayerView {
  /** Coin haut-gauche de la boîte, en tuiles (y vers le bas). */
  x: number;
  y: number;
  /** Vitesse, en tuiles/s (vy > 0 : vers le bas). */
  vx: number;
  vy: number;
  mode: "sol" | "air" | "mur";
  ground: boolean;
  /** Pas de coyote restants, de tampon, de verrou. */
  coyote: number;
  buffer: number;
  lock: number;
  raw: PlayerState;
}

/** L'essai tel que `__jump.attempt` le montre. */
export interface AttemptView {
  status: "attend" | "course" | "mort" | "arrivé";
  /** Chrono de l'essai, en pas, et affiché. */
  time: number;
  timeText: string;
  /** Pas depuis la mort (tant que mort) ; nouvel essai à `respawnTicks`. */
  deathTicks: number;
  respawnTicks: number;
  /** Session : morts, essais, meilleur temps (pas), dernière mort (cause, centre en tuiles, chrono). */
  deaths: number;
  attempts: number;
  best: number | null;
  bestText: string | null;
  lastDeath: { cause: string; x: number; y: number; time: number } | null;
  /** Point de passage retenu (indice, −1 aucun) et nombre de points du niveau (lot 2b). */
  checkpoint: number;
  checkpoints: number;
  /** Centres des scies, en tuiles. */
  saws: { x: number; y: number }[];
  crumbles: number[];
  sections: number[];
  raw: AttemptState;
}

/** Lot 9 : `__jump.theme`. */
export interface ThemeView {
  name: string;
  label: string;
  forced: boolean;
  /** Thème que la date aurait donné. */
  ofDay: string;
  ambience: string;
  detail: SceneDetail | null;
  stats: SceneStats | null;
}

/** Ce que `?debug` expose sur `window.__jump` (lu par les tests de navigateur). */
/** Lot 12 : état des blocs clignotants et alternés (`__jump.blocks`). */
export interface BlocksDebug extends Partial<DynamicStats> {
  /** Le jeu solide (0 : A, 1 : B) ; −1 sans blocs alternés. */
  alt: number;
  /** Phase de chaque section (pas depuis l'entrée du personnage) et cycle déclaré de chacune. */
  phases: number[];
  cycles: ({ cycle: number; solid: number; shift: number } | null)[];
  /** Plein (vrai) ou absent (faux), pour chaque bloc : clignotants puis alternés (ordre de la grille) ; `solid` / `absent` comptent ceux de la dernière image dessinée. */
  states: boolean[];
}

/** Lot 13 : `__jump.wind` — ce que le dessin a posé (particules ou flèches) et l'état des zones dans la simulation. */
export interface WindDebug extends Partial<WindStats> {
  zones: number;
  /** Les zones : rectangle, sens, force, rafale. */
  list: { c0: number; c1: number; r0: number; r1: number; dir: string; force: number; gust: { cycle: number; active: number; shift: number } | null }[];
  /** La zone où est le centre du personnage (−1 : aucune), et s'il est poussé. */
  inside: number;
  pushed: boolean;
  /** Par zone : souffle-t-elle dans l'état de l'essai, et la phase de sa section. */
  active: boolean[];
  phases: number[];
}

export interface JumpDebug {
  /**
   * Lot P0 (plateforme) : l'identité commune lue dans ce navigateur (clés `cdj:*` de la plateforme, même stockage et même préfixe que
   * DailyTrack), sans rien créer ni afficher : existe-t-elle, et quel est son pseudo.
   */
  readonly profile: { exists: boolean; name: string | null };
  /** Lot 12 : les blocs clignotants et alternés (null : le niveau n'en a pas). */
  readonly blocks: BlocksDebug | null;
  /** Lot 13 : les courants d'air (null : le niveau n'en a pas). */
  readonly wind: WindDebug | null;
  phase: Phase;
  /** Jour du jeu affiché (AAAA-MM-JJ). */
  day: string;
  simVersion: number;
  palette: string;
  /** Lot 9 : le thème dessiné (imposé par `?theme=` ou celui du jour), ce que la scène a construit, l'ambiance. */
  readonly theme: ThemeView;
  /** Le niveau écrit à la main ouvert (`?scenario=`), null : le niveau du jour (lot 5) ou un morceau. */
  scenario: Scenario | null;
  /** Lot 5 : le niveau du jour (null pour un scénario ou un morceau). */
  readonly daily: DailyView | null;
  /** Lot 4 : le morceau joué (`?module=`), son temps de référence (pas) ; null pour un scénario. */
  module: { id: string; variant: number; entry: "arret" | "elan"; solution: boolean; levelId: string; reference: number | null; next: string } | null;
  readonly player: PlayerView;
  /** L'essai en cours et la session (lot 2). */
  readonly attempt: AttemptView;
  /** Effets de la mort : éclats émis, encore visibles, tremblement en cours ; `enabled` faux avec `?fx=off`. */
  readonly fx: { enabled: boolean; emitted: number; alive: number; shaking: boolean };
  /** Bandeau d'arrivée affiché. */
  readonly banner: boolean;
  /** Les réglages en vigueur (modifiés en place par le panneau). */
  params: JumpParams;
  /** Partie aux réglages modifiés : jamais enregistrée. */
  readonly tuned: boolean;
  /** Pas joués depuis le départ. */
  readonly ticks: number;
  /** Tactile (lot 1b) : interface active, doigts posés (rôle et position), commande qu'ils donnent, panneau de réglages ouvert (jeu en pause). */
  readonly touch: { active: boolean; fingers: { id: number; role: string; x: number; y: number }[]; bits: number; paused: boolean; panelOpen: boolean; viewTiles: number };
  /** Pas à pas : la boucle ne fait plus avancer la simulation, seul `advance` le fait (sans rendu). */
  manual(on: boolean): void;
  /** Joue `n` pas tout de suite (commande injectée, sinon clavier et manette) et renvoie le personnage. */
  advance(n: number): PlayerView;
  /** Impose les 3 bits de commande des pas suivants (`null` : rendre la main au clavier et à la manette). */
  input(bits: number | null): void;
  /** Comme la touche R. */
  restart(): void;
  /** Redessine, relit les pixels de l'image et compte les couleurs : preuve qu'un rendu non vide est à l'écran. */
  probe(): { width: number; height: number; colors: number; background: number };
  /** Lot 3 : rediffusions du jour (meilleur essai, vies) ; exporter et importer en base64url. */
  readonly replays: {
    list(): { kind: "meilleur" | "vie"; essai: number; ticks: number; time?: number; deaths?: number; code: string }[];
    /** Texte du meilleur essai (`"best"`) ou de la vie n° `i` (null s'il n'y en a pas). */
    export(which?: "best" | number): string | null;
    /** Importe une rediffusion comme meilleur essai, si le rejeu la valide. */
    import(code: string): { ok: true; time: number } | { ok: false; reason: string };
  };
  /** Lot 3 : le carnage. */
  readonly carnage: {
    readonly state: CarnageView;
    /** Démarre un carnage sur le meilleur essai du jour (héros) et les autres vies du jour. Faux s'il n'y a pas de meilleur essai. */
    start(): boolean;
    /**
     * Carnage de démonstration (`?carnage=demo`) : `lives` vies fictives (par défaut, celles de la démonstration ; plus, elles sont reprises).
     * `crowd` (mesure) : `lives` copies de la solution, qui courent toutes en même temps jusqu'au bout.
     */
    demo(lives?: number, crowd?: boolean): boolean;
    /** Comme une commande : passe le carnage. */
    skip(): void;
  };
  /** Lot 3 : stockage local (`jump:*`). */
  readonly storage: { clear(): number; size(): number; readonly memory: { best: number | null; lives: number; deaths: number; positions: { x: number; y: number }[] } };
  /** Lot 3 : fantôme (réglage, visible, où il en est). */
  readonly ghost: { enabled: boolean; available: boolean; visible: boolean; tick: number; status: string; x: number; y: number };
  /** Lot P2 : le fantôme du premier (date, réglage, chargé, montré, dessiné, étiquette, pseudo, temps rejoué, « c'est toi », raison d'absence). */
  readonly firstGhost: {
    date: string | null;
    enabled: boolean;
    loaded: boolean;
    shown: boolean;
    visible: boolean;
    labelled: boolean;
    name: string | null;
    label: string | null;
    ticks: number | null;
    mine: boolean;
    miss: string;
    tick: number;
    x: number;
    y: number;
  };
  /** Lot P2 : les couleurs des deux fantômes. */
  readonly ghostColors: { own: number; first: number };
  /** Bascule le fantôme (comme G ou le bouton 👻). */
  toggleGhost(): boolean;
  /** Lot 3 : taches à l'écran. */
  readonly stains: { count: number; discs: number; added: number };
  /**
   * Lot P3 (plateforme) : les taches de tout le monde — date, réglage, carte chargée, tuiles de la carte, taches dessinées et leurs disques,
   * couche visible, joueurs et morts du jour, raison d'absence ; `closest` : la plus petite distance (tuiles) d'un disque à un danger ou un fanion.
   */
  readonly othersStains: { date: string | null; enabled: boolean; loaded: boolean; tiles: number; drawn: number; discs: number; visible: boolean; players: number; deaths: number; miss: string; closest: number };
  /** Lot P3 : l'envoi des vies (branché, état, lots envoyés, file du jour, dernière réponse du serveur). */
  readonly lives: unknown;
  /** Lot P3 : l'échantillon du carnage de tout le monde (chargé, vies jouables, joueurs, écartées, à toi, bouton de l'arrivée). */
  readonly everyone: { loaded: boolean; lives: number; players: number; rejected: number; own: number; miss: string; button: string | null };
  /**
   * Lot P3 (tests) : le carnage de tout le monde, comme le bouton de l'arrivée ; faux sans échantillon ou sans essai héros. `max` (mesure) :
   * l'échantillon repris jusqu'à `max` vies.
   */
  startEveryone(max?: number): boolean;
  /** Lecture `?watch=best` en cours. */
  readonly watching: boolean;
  /** Lot 8 : les derniers événements de jeu (200 au plus), du plus ancien au plus récent. */
  readonly events: GameEvent[];
  clearEvents(): void;
  /** Lot 8 : le son (contexte, sons demandés et joués, scies audibles, glisse). */
  readonly audio: AudioDebug;
  /** Lot 8 : particules, secousse, traînée, vibrations, et les niveaux d'effets en vigueur. */
  readonly effects: { levels: FeelLevels; emitted: number; alive: number; shaking: boolean; trail: number; vibrations: number; carnageDropped: number };
  /** Lot 8 : réglages du joueur (mémorisés dans `jump:settings`). */
  readonly settings: PlayerSettings;
  /** Lot 8 : le menu ⏸ (ouvert : la partie est en pause). */
  readonly menu: { open: boolean };
  setMenu(open: boolean): void;
  /**
   * Temps de fil principal (ms), mesuré sur les 600 dernières images : par image (moyenne, 95e centile), et séparément la simulation **par
   * pas** et le dessin **par image** (le rendu logiciel fait peu d'images, donc beaucoup de pas par image : ces deux-là se comparent).
   */
  readonly frameTimes: { mean: number; p95: number; frames: number; stepMs: number; drawMs: number; reset(): void };
  /**
   * Lot 8b : l'animation du personnage (affichage seul) : pose des pieds, distance parcourue au sol (tuiles) et phase du cycle des pieds
   * (0 à 1, un cycle = deux pas), pieds (bas-milieu de la boîte, tuiles, y vers le haut), rebond (tuiles), penché (rad), respiration,
   * dérapage, et l'amplitude des mouvements du corps permise par les réglages (`body`).
   */
  readonly look: { pose: FeetPose; stride: number; phase: number; feet: number[]; bob: number; lean: number; breath: number; skid: number; squash: number; body: number };
  /** Lot 10 : l'accueil. */
  readonly home: HomeDebug;
  /** Lot 10 : l'historique persistant (`jump:historique`) et la série d'aujourd'hui (date de Paris). */
  readonly history: DayRecord[];
  readonly streak: number;
  /** Lot 10 : l'écran d'arrivée (affiché, dernier texte partagé, message du partage). */
  readonly arrival: { shown: boolean; share: string; message: string; rank: { shown: boolean; status: string; rows: number } };
  /**
   * Lot P1 (plateforme) : le classement du jour — branché (`enabled`, `demo`), état de l'envoi (`state.status` : `idle`, `sending`, `ranked`,
   * `offline`, `version`, `name`…), envois en attente (la file hors ligne), rang connu du jour, dernier classement lu, dernière réponse.
   */
  readonly rank: unknown;
  /** Lot P2 : la synchronisation du profil DailyJump (état, carte de l'accueil, dernier message de Réglages › Profil). */
  readonly sync: unknown;
  /** Lot P1 : le classement relit ce qui attend et repart (comme le retour du réseau). */
  rankWake(): void;
  /** Lot 10 (tests) : joue une rediffusion (par défaut la preuve de l'auteur) comme les commandes du joueur ; rend son nombre de pas. */
  autoplay(code?: string): number;
}

/** Le niveau du jour tel que `__jump.daily` le montre (lot 5). */
export interface DailyView {
  date: string;
  number: number;
  id: string;
  /** Lot 11 : le thème du niveau (donnée du générateur) et s'il est forcé (essai : rien n'est enregistré). */
  theme: string;
  forcedTheme: boolean;
  /** Aujourd'hui (date de Paris lue au chargement) ; `jour`, `archive` ou `futur` ; site publié ou aperçu ; date future refusée. */
  today: string;
  mode: DayChoice["mode"];
  preview: boolean;
  refused: boolean;
  hash: string;
  width: number;
  height: number;
  pieces: { id: string; variant: number; entry: string; exigence: number; tags: readonly string[]; family: string; long: boolean; mechanic: string | null; col0: number; col1: number; start: number; end: number }[];
  attempts: { index: number; status: string; reason: string; pieces: string[]; ticks: number; rate: number; score: number }[];
  chosen: number;
  fallback: boolean;
  authorTicks: number;
  medals: { author: number; gold: number; silver: number; bronze: number };
  exigence: { sum: number; rate: number; thirds: readonly number[] };
  /** La rediffusion de l'auteur (base64url). */
  code: string;
  /** Médaille de la dernière arrivée (null : aucune, ou pas encore d'arrivée). */
  lastMedal: string | null;
  /** Passage de minuit : un nouveau niveau attend la prochaine commande « recommencer ». */
  newDay: boolean;
  /** Message discret affiché (date refusée, nouveau niveau), "" sinon. */
  notice: string;
  /** Lot 7b : d'où vient le niveau (`cache`, `worker`, `principal`), s'il a été généré pendant ce chargement, pourquoi le cache a été refusé, durée du chargement et temps de fil principal (ms). */
  load: { source: string; generated: boolean; cacheMiss: string; frozenMiss: string; totalMs: number; blockedMs: number };
  /** Ligne du HUD. */
  line: string;
}

/** Lot 10 : l'accueil tel que `__jump.home` le montre. */
export interface HomeDebug {
  /** L'accueil existe sur cette page (niveau du jour), s'est ouvert au chargement, est ouvert ; Jouer répond ; aide et archives ouvertes. */
  available: boolean;
  atStart: boolean;
  open: boolean;
  ready: boolean;
  help: boolean;
  archives: boolean;
  /** Dates listées dans les archives (dernière ouverture). */
  archiveDates: string[];
  view: HomeView | null;
}

export interface CarnageView {
  active: boolean;
  demo: boolean;
  /** Lot P3 : le carnage de tout le monde (l'échantillon du serveur) ; sinon le tien. */
  everyone: boolean;
  /** Vies du carnage (héros compris), arrivées et morts jusqu'ici, vies en course, pas du héros. */
  lives: number;
  arrivals: number;
  deaths: number;
  running: number;
  tick: number;
  heroTicks: number;
  label: string;
}

declare global {
  interface Window {
    __jump?: JumpDebug;
  }
}

const options = readUrlOptions(location.search);
const LEVELS: Record<Scenario, Level> = { essai: ESSAI_LEVEL, dangers: DANGERS_LEVEL, "bac-a-sable": SANDBOX_LEVEL, vent: VENT_LEVEL };
// Lot P1 (plateforme) : le classement du jour. Adresse du serveur : `?api=` (essais ; `demo` : la démonstration), sinon `VITE_API_URL` de la
// construction (production pour `main`, recette pour un aperçu), sinon aucune : pas de classement, le jeu marche comme avant.
const apiBase = rankApiBase(options.api, BUILD_API_URL);
const demoRank = apiBase === "demo";
/** La démonstration joue « son » aujourd'hui (`DEMO_TODAY`, celui du jeu de données) : toutes les dates du jeu sont décalées d'autant. */
const dayShift = demoRank ? DEMO_TODAY - parisDay(Date.now()) : 0;
/** « Aujourd'hui » du jeu : la date de Paris (décalée en démonstration). */
const gameDay = (ms = Date.now()): number => parisDay(ms) + dayShift;
// Lot 5 : « aujourd'hui » = la date de Paris (`@cdj/clock`), lue ici, hors de la simulation ; le niveau du jour en découle.
const today = gameDay();
const preview = isPreview(location);
const dayChoice: DayChoice | null = options.daily ? chooseDay(options.seed, today, preview) : null;
// Lot 11 : `?theme=` sur le niveau du jour qui force un thème **différent de celui de la date** est un **essai** : un autre niveau (identifiant
// `…-t<thème>`), qui n'entre ni dans l'historique, ni dans la série, ni dans le partage, et dont rien n'est enregistré. Le thème de la date
// lui-même donne le niveau ordinaire (le thème est alors une donnée de la date, pas un choix).
const trialTheme: JumpThemeName | null = dayChoice && options.theme !== null && options.theme !== jumpThemeForDay(dayChoice.day) ? options.theme : null;
const choice: DayChoice | null = dayChoice && trialTheme !== null ? { ...dayChoice, mode: "essai" } : dayChoice;
// Lot P1 : en démonstration, tout ce que le jeu garde est à part (`demo:` : mémoire du jour, historique, série, file, identité) ; seul ton
// pseudo de la plateforme y est recopié (lu, jamais écrit dans le vrai stockage).
const store = demoRank ? demoStorage(browserStorage()) : browserStorage();
if (demoRank && store) {
  try {
    const realName = browserStorage()?.getItem(NAME_KEY);
    if (realName && !store.getItem(NAME_KEY)) store.setItem(NAME_KEY, realName);
  } catch {
    /* stockage illisible : la démonstration demandera un pseudo */
  }
}
/** L'identifiant de la plateforme de ce navigateur s'il existe (jamais créé ici). */
const ownId = (): string | null => {
  try {
    return store ? readPlayerId(store) : null;
  } catch {
    return null;
  }
};
const rankSource: RankSource | null = apiBase === null ? null : demoRank ? new DemoRankSource(new URL("demo/", document.baseURI).href, store) : new HttpRankSource(apiBase);
const identity = createIdentity(() => {
  if (!store) throw new Error("stockage indisponible");
  return store;
});
// ——— Lot P2 (plateforme) : le profil DailyJump synchronisé par le serveur (`GET /api/jump/me`), fusionné avec l'historique local — le meilleur
// gagne, morts et essais locaux gardés, jours d'un autre appareil ajoutés (`jumpProfile.ts`). Au chargement, au retour sur l'accueil (au plus
// une fois par 30 s) et après chaque envoi accepté. Seulement avec un serveur (pas la démonstration) et une identité déjà là (jamais créée pour
// lire). Un code remplacé ailleurs (410) : la carte du profil le dit, rien n'est effacé ici.
const NO_STORE: KeyValueStore = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
type JumpSyncResult = JumpMergeResult & { nameChanged: boolean };
const jumpSync = new ProfileSync<JumpSyncResult, KeyValueStore, JumpMe>({
  api: () => {
    const src = rankSource;
    if (!src || demoRank || !src.jumpMe || !ownId()) return null;
    return { me: (id: string) => src.jumpMe!(id) };
  },
  playerId: () => ownId() ?? "",
  adopt: (id) => identity.setPlayerId(id),
  storage: store ?? NO_STORE,
  merge: (me, st) => {
    const r = applyJumpProfile(me, st, history.entries);
    if (r.changed) history.replaceAll(r.list);
    return r;
  },
  identity,
});
// ——— Lot P3 (plateforme) : les vies du niveau du jour qui finissent par une mort partent au serveur, qui les rejoue (au plus 30 par jour,
// choisies le long du niveau : `livesQueue.ts`) — à l'arrivée, toutes les 3 minutes pendant la partie et quand la page se cache (`keepalive`) ;
// jamais pour une archive, un thème forcé, une partie aux réglages modifiés, un morceau, un scénario, ni en démonstration. Le jeu ne bloque
// jamais sur ces envois ; sans identité ou pour un joueur pas encore classé, elles attendent la première arrivée acceptée.
const livesSender = new LivesSender({
  source: demoRank ? null : rankSource,
  queue: new LivesQueue(store, () => Date.now()),
  playerId: ownId,
  today: () => gameDay(),
  sinceMidnight: () => Date.now() - parisDayStart(parisDay(Date.now())),
  now: () => Date.now(),
  setTimer: (fn, ms) => setTimeout(fn, ms),
  clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
});
const ranking = new Ranking({
  source: rankSource,
  queue: new RankQueue(store, () => Date.now()),
  identity,
  sync: jumpSync,
  // Lot P2 : un envoi accepté : le profil est relu (le meilleur gagne) et le premier aussi (c'est peut-être toi maintenant).
  onAccepted: () => {
    void syncProfile(true);
    void loadFirst();
    // Lot P3 : le joueur existe maintenant sur le serveur : ses vies en attente partent.
    livesSender.wake();
  },
  identityStore: () => store,
  today: () => gameDay(),
  sinceMidnight: () => Date.now() - parisDayStart(parisDay(Date.now())),
  setTimer: (fn, ms) => setTimeout(fn, ms),
  clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  now: () => Date.now(),
});

// ——— Lot 10 : historique et accueil, montés avant le chargement du niveau (l'accueil s'affiche tout de suite, Jouer attend le niveau) ———
const history = new History(store);
/** L'accueil existe sur la page du niveau du jour (hors lecture) ; il s'ouvre au chargement si `wantsHome`, sinon par le menu ⏸ ou l'arrivée. */
const homeHere = choice !== null && choice.mode === "jour" && trialTheme === null && !options.solution && !options.watchBest && !options.watchFirst && !options.carnageDemo;
const homeAtStart = homeHere && wantsHome(options);
const homeTheme = themeByName(options.theme) ?? themeForDay(today);
/** Vrai une fois le jeu entièrement prêt : avant, ouvrir ou fermer une fenêtre de l'accueil ne touche pas encore à la pause. */
let gameReady = false;
const home: Home | null = homeHere
  ? mountHome({
      onPlay: () => playFromHome(),
      onSettings: () => setMenu(true),
      // Lot P2 : la carte du profil ouvre Réglages › Profil.
      onProfile: () => {
        setMenu(true);
        document.getElementById("profile")?.scrollIntoView({ block: "start" });
      },
      archiveRows: () => archiveDays(gameDay()).map((d) => archiveRow(d, themeForDay(d).label, history.forDate(formatDay(d)))),
      archiveHref: (date) => archiveHref(date, options),
      onChange: () => {
        if (gameReady) syncPause();
      },
    })
  : null;
if (home && homeAtStart) {
  home.open(homeView());
  if (options.archives) home.openArchives();
  else if (!helpSeen(store)) {
    // « Comment jouer » s'ouvre de lui-même à la toute première visite (puis depuis l'accueil).
    home.openHelp();
    markHelpSeen(store);
  }
}

/** Ce que montre l'accueil : le niveau d'aujourd'hui, l'état du joueur (historique), la série, le compte à rebours. */
function homeView(): HomeView {
  const now = Date.now();
  const heading = homeHeading(today, homeTheme.label);
  const status = homeStatus(history.forDate(formatDay(today)));
  // Lot P1 : ton rang du jour (un temps classé aujourd'hui).
  const rank = homeRankText(ranking.enabled, ranking.known(formatDay(today)));
  return { ...heading, status: status.text, finished: status.finished, streak: streakText(history.streak(gameDay(now))), countdown: countdownText(now), rank, profile: homeProfile() };
}

/** Lot P2 : la petite carte du profil de l'accueil : pseudo, série, nombre de médailles (historique fusionné) ; un code remplacé ailleurs le dit. */
function homeProfile(): NonNullable<HomeView["profile"]> {
  const st = jumpStats(history.entries, gameDay());
  const medals = st.medals.author + st.medals.gold + st.medals.silver + st.medals.bronze;
  return { name: readIdentity(store).name, streak: st.streak, medals, revoked: jumpSync.state.status === "revoked" };
}

/** Lot P2 : synchronise le profil (au plus une fois par 30 s, sauf `force`) ; l'accueil, Réglages › Profil et l'arrivée suivent. Ne bloque jamais. */
async function syncProfile(force = false): Promise<void> {
  const r = await jumpSync.run({ force });
  // Réglages › Profil suit la synchronisation par lui-même (`jumpSync.subscribe`).
  if (!r.ran) return;
  if (home?.isOpen) home.update(homeView());
}

// Lot 7b : le niveau se charge hors du fil principal (cache vérifié, sinon worker, sinon repli ; `dailyLoader.ts`). Attente au niveau du module.
// Lot 10 : un niveau figé passe avant tout (sa preuve rejouée) ; avec l'accueil ouvert, « Préparation du niveau… » est dans le bouton Jouer.
const loaded: DailyLoad | null = choice
  ? await loadDaily(choice.day, {
      store,
      today: formatDay(today),
      makeWorker: browserWorker,
      showProgress: homeAtStart ? undefined : progressMessage(document),
      yieldToPaint,
      frozen: { days: FROZEN_DAYS, read: browserFrozen },
      theme: trialTheme,
    })
  : null;
const daily: DailyLevel | null = loaded ? loaded.level : null;
// Lot 4 : un morceau du catalogue (`?module=<id>&variante=<n>&entree=arret|elan[&solution]`). En jeu humain avec l'entrée en élan, un
// couloir de lancement est ajouté devant le palier d'entrée ; la solution, elle, part lancée du départ du morceau (sans couloir).
const mod = options.module;
const built = mod ? buildModule(mod.id, mod.variant, { lancement: mod.entry === "elan" && !mod.solution ? LAUNCH_TILES : 0 }) : null;
const level = built ? built.level : daily ? daily.level : LEVELS[options.scenario ?? "essai"];
const reference = mod ? referenceTicks(mod.id, mod.variant, mod.entry, mod.entry === "elan" && !mod.solution) : null;
const nextId = mod ? nextModule(mod.id) : null;
const nextHref = mod && nextId ? moduleHref({ id: nextId, variant: 0, entry: mod.entry, theme: moduleTheme(nextId, 0) ?? undefined }, options) : null;

const dayText = formatDay(today);
// Lot 9 : le thème du jour, celui de la date du niveau (une archive garde le sien). Lot 11 : le thème est une donnée du générateur : un niveau du
// jour porte le sien (`daily.theme`, celui de la date ou le thème forcé d'un essai). Un morceau ou un scénario n'a pas de thème : `?theme=` leur en
// donne un (cosmétique, ils n'ont pas de mécanique de thème). La palette en vient.
const modTheme = mod ? moduleTheme(mod.id, mod.variant) : null;
// Lot 13 : la galerie des courants d'air (`?scenario=vent`) s'ouvre dans son thème (la forêt).
const theme = daily ? THEMES[daily.theme] : (themeByName(options.theme) ?? (modTheme ? THEMES[modTheme] : options.scenario === "vent" ? THEMES.foret : themeForDay(today)));
/** Lot 11 : essai (thème forcé) : rien n'est enregistré, comme avec des réglages modifiés. */
const isTrial = daily !== null && daily.forcedTheme;
const palette = theme.palette;

const stamp = document.getElementById("stamp")!;
stamp.textContent = `DailyJump · sim v${JUMP_SIM_VERSION} · ${dayText}`;
if (mod && built) {
  const entryText = mod.entry === "elan" ? "élan" : "arrêt";
  document.getElementById("modname")!.textContent = `${mod.solution ? "Solution · " : ""}${mod.id} · variante ${mod.variant} · ${entryText}`;
  document.title = `DailyJump · ${mod.id}`;
}
if (daily) document.title = daily.number >= 1 ? `DailyJump #${daily.number}` : "DailyJump";
document.documentElement.style.background = `#${palette.background.toString(16).padStart(6, "0")}`;

// Réglages : les défauts, sauf en `?debug&tune` où le panneau reprend ceux qu'on avait laissés (`jump:tune`).
const params: JumpParams = options.tune ? loadTuned() : { ...DEFAULT_JUMP_PARAMS };
// Lot 8b : `?debug&tune&sprint=1` : l'essai d'élan progressif, aux valeurs de départ (la partie est `tuned`).
if (options.sprint) Object.assign(params, SPRINT_TRIAL_PARAMS);

// ——— Mémoire du jour (lot 3) : par niveau, purgée au changement de jour ou de niveau ———
// Un morceau : `module:<id>:<variante>` (lot 4), rangé à part selon l'entrée (le niveau à couloir n'est pas le même).
const levelId: string = built ? built.levelId : daily ? daily.id : (options.scenario ?? "essai");
const memory = new DayMemory({ store, level, levelId, key: mod ? `${levelId}:${mod.entry}` : levelId, today: () => formatDay(gameDay()) });
// ——— Lot P2 (plateforme) : le fantôme du premier de ce jour (niveau du jour ou archive ; jamais un essai de thème forcé ni un jour à venir),
// lu sur le serveur (ou la démonstration) et **vérifié par le rejeu du jeu** (`checkFirstGhost` : une autre version est ignorée). Sans réseau :
// rien. `?watch=first` l'attend avant de commencer (lien direct : le délai du client, 8 s, borne l'attente ; sinon partie normale).
const firstDate = daily && choice && (choice.mode === "jour" || choice.mode === "archive") && !isTrial ? daily.date : null;
/** Le premier tel que le serveur l'a rendu et que le jeu l'a rejoué, ou `null`. */
let firstRemote = null as FirstGhost | null;
/** Pourquoi il n'y en a pas (« no_ghost », « network », « autre version du jeu »…) : `__jump.firstGhost`. */
let firstMiss = firstDate && rankSource?.firstGhost ? "" : "aucun serveur";
/** Demande le premier ; le garde s'il se vérifie, l'oublie si le serveur n'en a pas (ou d'une autre version), le garde tel quel hors ligne. */
async function fetchFirst(): Promise<void> {
  if (!firstDate || !rankSource?.firstGhost) return;
  const r = await rankSource.firstGhost(firstDate, ownId());
  if (!r.ok) {
    firstMiss = r.code;
    if (r.status !== 0) firstRemote = null;
    return;
  }
  const c = checkFirstGhost(r.data, level, levelId);
  firstMiss = c.ok ? "" : c.reason;
  firstRemote = c.ok ? c.ghost : null;
}
if (options.watchFirst) await fetchFirst();
// `?watch=best` : lecture du meilleur essai, sans jouer (rien n'est enregistré). Sans meilleur essai : partie normale et un message.
// `?module=…&solution` : lecture de la solution stockée du morceau (rejouée par la même simulation).
// `&solution` sur le niveau du jour (lot 5) : la rediffusion de l'auteur, la preuve du niveau.
// `?watch=first` (lot P2) : l'essai du premier du classement de ce jour.
const watchReplay = mod?.solution
  ? solutionReplay(mod.id, mod.variant, mod.entry)
  : daily && options.solution
    ? daily.replay
    : options.watchBest
      ? memory.bestReplay()
      : options.watchFirst
        ? (firstRemote?.replay ?? null)
        : null;
const watching = watchReplay !== null;
const watchInputs = watchReplay ? fromRuns(watchReplay.runs) : [];
let watchIndex = 0;

const session = new JumpSession(level, params, watching ? null : levelId);
session.best = memory.best?.time ?? null;
if (watchReplay) session.state = replayStartState(level, watchReplay.start);
session.prev = session.state;

// Lot 8 : réglages du joueur (son, vibrations, tremblement, effets, mouvement réduit), lus avant tout effet.
const systemCalm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
let settings: PlayerSettings = loadSettings(store, systemCalm);
let levels: FeelLevels = feelLevels(settings, options.fx);
// Les éclats de la mort existent toujours ; ils ne partent que si les réglages le permettent (`levels.particles`).
const burst = new BurstPool();
const shake = new Shake();
const particles = new Particles();
particles.amount = levels.particles;
const colors = feelColors(palette);
const trail = new Trail();
const blink = new Blink();
const vibrator = new Vibrator(typeof navigator.vibrate === "function" ? (p) => navigator.vibrate(p) : null);
const audio = new JumpAudio(settings);
// Lot 9 : l'ambiance du thème, sur le bus « ambiance » (elle démarre au premier geste, comme le reste du son).
audio.setAmbience(AMBIENCES[theme.ambience], textSeed(`${levelId}:${theme.name}:ambiance`));
const eventLog = new EventLog(200);
const carnageFilter = new CarnageFilter();
/** Pas joués depuis le chargement (partie et carnage) : l'horloge des événements et de leurs débits. */
let eventTick = 0;
/** Glisse en cours (côté du mur), d'après les événements : le frottement en sort. */
let slideSide = 0;
let slideClock = 0;
let scene: JumpScene | null = null;
try {
  // `?debug` sur le niveau du jour : les limites des morceaux, avec leur identifiant, leur variante et leur exigence.
  const pieces = options.debug && daily ? daily.pieces.map((p) => ({ col0: p.col0, col1: p.col1, row: p.entryRow, label: `${p.id} v${p.variant} · ${"●".repeat(p.exigence)}${"○".repeat(5 - p.exigence)} ${p.exigence}/5` })) : undefined;
  scene = createScene(document.body, level, theme, { hitbox: options.hitbox, burst, pieces, levelId, detail: sceneDetail(levels) });
  scene.animate = levels.animate;
  scene.windParticles = levels.particles;
} catch {
  scene = null;
}
const particleMesh = scene ? new ParticleMesh(particles, scene.world) : null;

// ——— Lot 3 : fantôme, taches ———
let ghostOn = !options.ghostOff && loadGhostSetting(store);
let ghost: Ghost | null = null;
const refreshGhost = () => {
  const best = memory.bestReplay();
  try {
    ghost = best && !watching ? new Ghost(level, best) : null;
  } catch {
    ghost = null;
  }
};
refreshGhost();
// Lot P2 : ton fantôme a sa couleur (cyan clair), plus le jaune du personnage ; celui du premier est mauve, avec son pseudo.
const ghostMesh = scene ? new GhostMesh(scene.world, OWN_GHOST_COLOR) : null;
let firstGhost: Ghost | null = null;
const firstGhostMesh = scene ? new GhostMesh(scene.world, FIRST_GHOST_COLOR) : null;
/** Le fantôme du premier est-il voulu ? Le réglage du menu (« Fantôme du premier »), sauf `?ghost=off|best`. */
const firstGhostOn = (): boolean => settings.firstGhost && !options.firstGhostOff;
/**
 * Lot P2 : monte (ou retire) le fantôme du premier : pas en lecture, pas de doublon (si le premier, c'est toi, ton fantôme est le sien :
 * `showFirstGhost`). Calé sur le chrono de l'essai en cours, comme le tien.
 */
function refreshFirstGhost(): void {
  const own = memory.best ? { ticks: memory.best.time, code: memory.best.code } : null;
  const f = firstRemote;
  if (!watching && f && showFirstGhost(f, own)) {
    if (firstGhost?.replay !== f.replay) {
      try {
        firstGhost = new Ghost(level, f.replay);
        firstGhost.sync(session.state.time);
        firstGhostMesh?.setLabel(firstGhostLabel(f.name), FIRST_GHOST_COLOR);
      } catch {
        firstGhost = null;
      }
    }
  } else if (firstGhost) {
    firstGhost = null;
    firstGhostMesh?.setLabel(null, FIRST_GHOST_COLOR);
  }
}
/** Lot P2 : relit le premier (au chargement, puis à chaque arrivée) ; ne bloque jamais, rien sans réseau. */
async function loadFirst(): Promise<void> {
  if (!firstDate) return;
  await fetchFirst();
  refreshFirstGhost();
  if (arrival.shown) arrival.setFirst(firstRemote && !watching && showFirstGhost(firstRemote, memory.best ? { ticks: memory.best.time, code: memory.best.code } : null) ? `Regarder le premier (${firstRemote.name})` : null);
}
const stains = scene ? new StainLayer(scene.world, palette.player, palette.tile) : null;
const storedStains = () => memory.deaths.map((d) => stainFor(level, d.x, d.y));
stains?.reset(storedStains());
// ——— Lot P3 (plateforme) : les taches de tout le monde — la carte des morts du jour (serveur ou démonstration), plus pâles et plus petites que
// les tiennes, une seconde couche du même système, dessinée dessous ; jamais sur un danger ni un fanion (`othersStains.ts`). Chargée avec le
// niveau, rafraîchie à l'arrivée ; une archive montre la carte figée de son jour. Réglage « Taches de tout le monde » (menu ⏸, mémorisé).
const othersLayer = scene ? new StainLayer(scene.world, palette.player, palette.tile, { capacity: OTHERS_MAX_TILES, z: 0.005 }) : null;
let othersMap: DeathMapData | null = null;
let othersMiss = firstDate && rankSource?.deaths ? "" : "aucun serveur";
let othersKeepout: Keepout | null = null;
let othersDrawn: { count: number; discs: number; closest: number } = { count: 0, discs: 0, closest: Infinity };
const othersOn = (): boolean => settings.othersStains && !watching;
function drawOthers(): void {
  othersKeepout ??= keepoutOf(level);
  const list = othersMap ? othersStains(level, othersMap.tiles, othersKeepout) : [];
  let closest = Infinity;
  if (options.debug) for (const o of list) for (const d of o.discs) closest = Math.min(closest, othersKeepoutDistance(d.x, d.y));
  othersDrawn = { count: list.length, discs: list.reduce((n, o) => n + o.discs.length, 0), closest };
  othersLayer?.reset(list);
  showOthers();
}
function othersKeepoutDistance(x: number, y: number): number {
  return keepoutDistanceOf(othersKeepout!, x, y);
}
/** La couche des autres : visible selon le réglage, jamais pendant un carnage ni une lecture. */
function showOthers(): void {
  if (othersLayer) othersLayer.visible = othersOn() && !carnage;
}
/** Lit la carte des morts du jour (ne bloque jamais ; un échec réseau garde la carte déjà lue). */
async function loadOthers(): Promise<void> {
  if (!firstDate || !rankSource?.deaths) return;
  const r = await rankSource.deaths(firstDate);
  if (!r.ok) {
    othersMiss = r.code;
    return;
  }
  const other = r.data.levelId !== null && r.data.levelId !== levelId;
  othersMiss = other ? "autre niveau" : "";
  othersMap = other ? null : r.data;
  drawOthers();
}

const T = UNITS_PER_TILE;
const touchOn = wantsTouch(options.touch, window.matchMedia?.("(pointer: coarse)").matches ?? false);
let panelOpen = false;
let touchUi: TouchUi | null = null;
let phase: Phase = "loading";
let manual = false;
let injected: number | null = null;
let look: Look = restLook();
/** Lot 8b : l'allure du héros du carnage (il court comme le personnage). */
let heroLook: Look = restLook();
const controls = new Controls();
const stepper = new FixedStepper();

function view(s: PlayerState = session.state.player): PlayerView {
  const p = session.params;
  return {
    x: s.x / T,
    y: s.y / T,
    vx: (s.vx * TICK_RATE) / T,
    vy: (s.vy * TICK_RATE) / T,
    mode: playerMode(s),
    ground: s.ground === 1,
    coyote: s.ground ? p.coyote : s.air <= p.coyote ? p.coyote - s.air : 0,
    buffer: s.buffer,
    lock: s.lock,
    raw: { ...s },
  };
}

const STATUS_NAMES = ["attend", "course", "mort", "arrivé"] as const;

function attemptView(): AttemptView {
  const s = session.state;
  const d = session.lastDeath;
  return {
    status: STATUS_NAMES[s.status]!,
    time: s.time,
    timeText: formatTicks(s.time),
    deathTicks: s.status === ATTEMPT_DEAD ? s.deathTicks : 0,
    respawnTicks: RESPAWN_TICKS,
    deaths: session.deaths,
    attempts: session.attempts,
    best: session.best,
    bestText: session.best === null ? null : formatTicks(session.best),
    lastDeath: d ? { cause: DEATH_NAMES[d.cause] ?? "?", x: d.x / T, y: d.y / T, time: d.time } : null,
    checkpoint: s.checkpoint,
    checkpoints: level.checkpoints.length,
    saws: sawCenters(level, s).map((p) => ({ x: p.x / T, y: p.y / T })),
    crumbles: [...s.crumbles],
    sections: [...s.sections],
    raw: { ...s, player: { ...s.player }, crumbles: [...s.crumbles], sections: [...s.sections], tiles: [] },
  };
}

function phaseOf(s: AttemptState): Phase {
  if (s.status === ATTEMPT_READY) return "ready";
  if (s.status === ATTEMPT_DEAD) return "dead";
  if (s.status === ATTEMPT_FINISHED) return "finished";
  return "playing";
}

/** Confie les essais clos à la mémoire du jour (qui les rejoue) ; rend le dernier enregistré. */
function drainEssais(): RecordedEssai | null {
  let last: RecordedEssai | null = null;
  for (let e = session.takeEssai(); e; e = session.takeEssai()) {
    const rec = memory.recordEssai(e.essai, e.tuned || isTrial);
    if (!rec) continue;
    last = rec;
    offerLives(rec, e.tuned);
    if (rec.newBest) {
      refreshGhost();
      refreshFirstGhost();
      // Lot P1 : un meilleur essai du niveau du jour part au classement (en arrière-plan ; la file garde le meilleur s'il n'y a pas de réseau).
      if (!e.tuned) offerBest();
    }
  }
  // Le meilleur temps affiché est celui que le rejeu a recalculé.
  if (last && memory.best) session.best = memory.best.time;
  if (last) recordHistory();
  return last;
}

/**
 * Lot P1 : un essai peut-il entrer au classement ? Seulement le niveau du jour joué le jour même (la règle de l'historique : `mayRecord`),
 * jamais une archive, un jour à venir, un thème forcé, une partie aux réglages modifiés, une lecture, un carnage de démonstration ; un
 * morceau ou un scénario n'est pas le niveau du jour (`daily` est nul).
 */
function rankable(): boolean {
  return mayRank({ mode: daily && choice ? choice.mode : null, levelDay: daily?.day ?? -1, today: gameDay(), watching, tuned: session.tuned, trial: isTrial, carnageDemo: options.carnageDemo });
}

/** Lot P3 : les morts d'un essai du niveau du jour (rejouées par la mémoire : fin, position et section viennent du rejeu) entrent dans la file des vies. */
function offerLives(rec: RecordedEssai, tuned: boolean): void {
  if (!daily || tuned || !livesSender.enabled || !rankable()) return;
  const lives: LifeCandidate[] = [];
  for (const life of rec.result.lives) if (life.end === "mort" && life.death) lives.push({ code: encodeReplay(lifeReplay(rec.replay, life)), section: sectionAt(level, life.death.x) });
  livesSender.offer(daily.date, daily.id, level.sections.length, lives, rec.result.finished);
}

/** Lot P1 : propose le meilleur essai du jour (rejoué par la mémoire) au classement ; la file ne garde que ce qui bat le meilleur envoyé. */
function offerBest(): void {
  const best = memory.best;
  if (!best || !daily || !rankable()) return;
  ranking.offer({ date: daily.date, levelId: daily.id, replay: best.code, ticks: best.time, deaths: best.deaths });
}

/**
 * Lot 10 : l'historique reprend l'état du jour de la mémoire (meilleur temps rejoué, sa médaille, morts et essais du jour) — **seulement**
 * pour le niveau du jour joué le jour même (une archive, un jour à venir, une lecture n'y entrent jamais ; un essai aux réglages modifiés
 * n'est pas enregistré par la mémoire, donc n'arrive pas ici).
 */
function recordHistory(): void {
  if (!daily || !choice) return;
  if (!mayRecord({ mode: choice.mode, levelDay: daily.day, today: gameDay(), watching, tuned: false })) return;
  const best = memory.best;
  const rec: DayRecord = { id: daily.id, date: daily.date, best: best?.time ?? null, medal: best ? jumpMedalFor(best.time, daily.medals) : null, deaths: memory.totalDeaths, attempts: memory.attempts };
  history.put(rec);
}

// ——— Carnage (lot 3) ———
interface CarnageRun {
  run: Carnage;
  crowd: CrowdMesh;
  demo: boolean;
  /** Commande au pas précédent : seule une nouvelle commande (un appui) passe le carnage. */
  prevBits: number;
  /** Lot P3 : le carnage de tout le monde et son compteur (« 142 vies de 37 joueurs »), `null` : le tien. */
  everyone: string | null;
}
let carnage: CarnageRun | null = null;
/** Lot 10 : le dernier carnage joué (héros et autres vies), pour « Revoir le carnage ». */
let lastCarnage: { hero: JumpReplay; others: JumpReplay[] } | null = null;
let carnageBurst: { pool: BurstPool; mesh: BurstMesh } | null = null;
/** Zoom arrière du carnage : on voit plus large autour du héros. */
const CARNAGE_ZOOM = 1.3;

function startCarnage(hero: JumpReplay, others: JumpReplay[], demo: boolean, bits = 0, everyone: string | null = null): boolean {
  if (!scene || carnage) return false;
  let run: Carnage;
  try {
    run = new Carnage(level, hero, others);
  } catch {
    return false;
  }
  const crowd = new CrowdMesh(scene.world, palette.player, others.length);
  crowd.show(true);
  if (options.fx && !carnageBurst) {
    // Éclats plafonnés : un seul pool, recyclé (les plus vieux éclats repartent d'abord).
    const pool = new BurstPool(384);
    carnageBurst = { pool, mesh: new BurstMesh(pool, palette.player, scene.world) };
  }
  carnage = { run, crowd, demo, prevBits: bits, everyone };
  // Lot 10 : « Revoir le carnage » (écran d'arrivée) le relance tel quel (le tien, pas celui de tout le monde).
  if (!demo && everyone === null) lastCarnage = { hero, others };
  arrival.hide();
  carnageFilter.reset();
  audio.stopLoops();
  slideSide = 0;
  trail.clear();
  hud.hideFinish();
  ghostMesh?.hide();
  firstGhostMesh?.hide();
  stains?.reset([]);
  showOthers();
  scene.zoom = CARNAGE_ZOOM;
  scene.resize(touchOn);
  camera = snapCamera(follow(run.hero.state.player), scene.frame);
  stepper.reset();
  phase = "carnage";
  heroLook = restLook();
  hud.carnage(everyone ?? carnageLabel(run.total, 0));
  return true;
}

function endCarnage(): void {
  const c = carnage;
  if (!c || !scene) return;
  carnage = null;
  c.crowd.dispose(scene.world);
  carnageBurst?.pool.clear();
  audio.stopLoops();
  slideSide = 0;
  hud.carnage(null);
  stains?.reset(storedStains());
  showOthers();
  scene.zoom = 1;
  scene.resize(touchOn);
  stepper.reset();
  if (c.demo) {
    restart();
    hud.toast("Fin de la démonstration");
  } else {
    phase = phaseOf(session.state);
    camera = snapCamera(follow(session.state.player), scene.frame);
    showFinish();
  }
}

/** Un pas du carnage ; une nouvelle commande le passe. */
function stepCarnage(): void {
  const c = carnage!;
  const bits = injected ?? controls.sample();
  const pressed = bits & ~c.prevBits;
  c.prevBits = bits;
  if (pressed) {
    c.run.stop();
    endCarnage();
    return;
  }
  const tick = eventTick++;
  const lifeEvents: GameEvent[] = [];
  for (const e of c.run.step()) {
    // Les taches : toutes les morts (elles portent une information, jamais filtrées).
    if (e.kind === "death") stains?.add(stainFor(level, e.x, e.y));
    // Les autres vies : seulement leurs morts et leurs arrivées, au débit plafonné (le héros a tous ses événements, plus bas).
    if (e.life === HERO || e.kind === "depart") continue;
    const ev: GameEvent =
      e.kind === "death"
        ? { kind: "mort", cause: causeName(e.cause), x: e.x / T, y: e.y / T, tick, source: "vie" }
        : { kind: "arrivee", ...centerOf(c.run.lives[e.life]!.runner?.state.player), tick, source: "vie" };
    if (carnageFilter.admit(ev)) lifeEvents.push(ev);
  }
  const h = c.run.hero;
  if (h.state.status !== ATTEMPT_DEAD && h.prev.status !== ATTEMPT_DEAD && h.state !== h.prev) heroLook = onStep(heroLook, h.prev.player, h.state.player, DEFAULT_JUMP_PARAMS.fallSpeed);
  else if (h.state.status === ATTEMPT_DEAD) heroLook = restLook();
  dispatch([...eventsBetween(h.prev, h.state, level, DEFAULT_JUMP_PARAMS, tick, "heros"), ...lifeEvents]);
  hud.carnage(c.everyone ?? carnageLabel(c.run.total, c.run.arrivals));
  if (c.run.done) endCarnage();
}

/** Centre du personnage en tuiles (y vers le bas). */
function centerOf(p: PlayerState | undefined): { x: number; y: number } {
  return p ? { x: (p.x + PLAYER_WIDTH / 2) / T, y: (p.y + PLAYER_HEIGHT / 2) / T } : { x: 0, y: 0 };
}

/**
 * Lot 8 : les événements d'un pas vont au journal (`__jump.events`), aux particules, à la secousse, aux vibrations et au son. Rien d'autre
 * ne déclenche un effet ; rien ici ne touche à la simulation.
 */
function dispatch(events: readonly GameEvent[]): void {
  if (events.length === 0) return;
  for (const e of events) {
    eventLog.push(e);
    const out = feelEvent(e, particles, colors, levels);
    if (out.shake > 0) shake.start(out.shake);
    if (out.vibrate !== null && !watching) vibrator.play(out.vibrate, performance.now());
    if (e.kind === "mort" && levels.particles > 0) {
      // Éclatement à la couleur du personnage : celui de la partie, ou le pool du carnage (héros et autres vies).
      if (e.source === "jeu") burst.burst(e.x, -e.y, Math.max(1, Math.round(28 * levels.particles)));
      else if (carnageBurst) carnageBurst.pool.burst(e.x, -e.y, Math.max(1, Math.round((e.source === "heros" ? 20 : 8) * levels.particles)));
    }
    if (e.source !== "vie") {
      if (e.kind === "glisseDebut") slideSide = e.side;
      else if (e.kind === "glisseFin" || e.kind === "mort" || e.kind === "reapparition" || e.kind === "arrivee") slideSide = 0;
      if (e.kind === "reapparition") trail.clear();
    }
    // Lot 12 : un éclat bref sur les blocs alternés à chaque bascule (le rendu ne le joue pas sans mouvement).
    if (e.kind === "bascule" && e.source !== "vie") scene?.flashBlocks(e.reset ? 1 : 0.8);
    if (e.kind === "derapage") {
      if (e.source === "jeu") look = onSkid(look, e.side);
      else if (e.source === "heros") heroLook = onSkid(heroLook, e.side);
    }
  }
  // Lot 12 : `?metronome=off` coupe le tempo de la nuit (les autres sons restent).
  audio.handle(options.metronome ? events : events.filter((e) => e.kind !== "metronome"));
}

/** Le carnage de démonstration : la solution de l'auteur en héros, des essais fictifs déterministes pour les autres vies. */
function demoLives(max = 0): JumpReplay[] {
  const solution = decodeReplay(ESSAI_SOLUTION_CODE);
  const lives: JumpReplay[] = [];
  const attempts = demoAttempts(ESSAI_LEVEL, solution, 2026, { attempts: max > 50 ? Math.ceil(max / 3) : 14 });
  for (const a of attempts) for (const life of replayAttempt(ESSAI_LEVEL, a.replay).lives) lives.push(lifeReplay(a.replay, life));
  if (max <= 0) return lives;
  // Mesures à 150 ou 300 vies : on reprend les mêmes vies autant qu'il faut.
  const out: JumpReplay[] = [];
  for (let i = 0; out.length < max && lives.length > 0; i++) out.push(lives[i % lives.length]!);
  return out;
}

function startDemo(max = 0, crowd = false): boolean {
  if (level !== ESSAI_LEVEL) {
    hud.toast("Démonstration : seulement sur ?scenario=essai");
    return false;
  }
  const solution = decodeReplay(ESSAI_SOLUTION_CODE);
  return startCarnage(solution, crowd ? new Array(max).fill(solution) : demoLives(max), true, lastBits);
}

function onEvent(e: SessionEvent): void {
  if (e.kind === "death") {
    // Éclats et tremblement : par les événements de jeu (`dispatch`, lot 8). Tache de la journée (pas en lecture, pas avec des réglages modifiés).
    if (!watching && memory.recordDeath({ x: e.x, y: e.y, cause: e.cause }, session.tuned || isTrial)) stains?.add(stainFor(level, e.x, e.y));
  } else if (e.kind === "checkpoint") hud.toast("Point de passage");
  else if (e.kind === "respawn") {
    look = restLook();
    if (scene) camera = snapCamera(follow(session.state.player), scene.frame);
    stepper.reset();
  } else if (e.kind === "finish") {
    if (watching) {
      // Une lecture n'est pas un temps du joueur : le meilleur affiché reste celui du jour.
      session.best = memory.best?.time ?? null;
      hud.finish(session, {
        ...finishOptions(),
        title: mod?.solution ? "Solution" : daily && options.solution ? "Rediffusion de l'auteur" : options.watchFirst && firstRemote ? `Rediffusion du premier : ${firstRemote.name}` : "Rediffusion",
        watching: true,
      });
      return;
    }
    // Lot 8 : la médaille obtenue sur le niveau du jour a sa phrase musicale (après la fanfare d'arrivée). Lot 10 : avec l'écran d'arrivée,
    // elle sonne à son ouverture, après le carnage, avec l'animation de la médaille.
    const medal = daily ? jumpMedalFor(session.state.time, daily.medals) : null;
    const screen = arrivalScreen();
    if (medal && !screen) dispatch([{ kind: "medaille", medal, ...centerOf(session.state.player), tick: eventTick, source: "jeu" }]);
    pendingMedal = screen ? medal : null;
    const rec = drainEssais();
    finishNewBest = rec?.newBest ?? false;
    // Lot P3 : les vies du jour partent à l'arrivée (en arrière-plan).
    void livesSender.flush();
    // Le carnage démarre de lui-même ; sans essai enregistré (réglages modifiés), l'arrivée tout de suite.
    if (!(rec?.result.finished && startCarnage(rec.replay, memory.liveReplays(rec.essai), false, lastBits))) showFinish();
  }
}

/** Lot 10 : la médaille de l'arrivée, à faire sonner à l'ouverture de l'écran d'arrivée (une seule fois). */
let pendingMedal: JumpMedal | null = null;
/** Lot 10 : la dernière arrivée a battu le meilleur temps du jour. */
let finishNewBest = false;

/** Lot 10 : l'écran d'arrivée sert au niveau du jour joué (pas une lecture, pas des réglages modifiés) ; ailleurs, le bandeau du lot 2. */
function arrivalScreen(): boolean {
  return daily !== null && choice !== null && !watching && !session.tuned && !isTrial;
}

/** L'arrivée : l'écran d'arrivée (niveau du jour), sinon le bandeau. */
function showFinish(): void {
  if (!arrivalScreen()) {
    hud.finish(session, finishOptions());
    return;
  }
  const d = daily!;
  const c = choice!;
  const time = session.state.time;
  const medal = jumpMedalFor(time, d.medals);
  lastMedal = medal;
  if (pendingMedal) {
    dispatch([{ kind: "medaille", medal: pendingMedal, ...centerOf(session.state.player), tick: eventTick, source: "jeu" }]);
    pendingMedal = null;
  }
  const best = memory.best?.time ?? session.best;
  const bestMedal = best === null ? null : jumpMedalFor(best, d.medals);
  const now = Date.now();
  const title = c.mode === "jour" ? "Arrivée !" : c.mode === "archive" ? `Arrivée · archive du ${shortDate(d.date)}` : "Arrivée · à venir (aperçu)";
  arrival.show({
    title,
    time: formatTicks(time),
    medal,
    medalIcon: medal ? MEDAL_ICON[medal] : "",
    medalText: medalText(medal),
    best: finishNewBest ? "Nouveau meilleur temps du jour !" : best === null ? "Meilleur du jour : —" : `Meilleur du jour : ${formatTicks(best)}${bestMedal ? ` ${MEDAL_ICON[bestMedal]}` : ""}`,
    newBest: finishNewBest,
    thresholds: medalThresholds(d.medals, time),
    stats: `${plural(memory.totalDeaths, "mort", "morts")} aujourd'hui · ${plural(memory.attempts, "essai", "essais")}`,
    run: session.attemptDeaths === 0 ? "Essai sans faute" : `${plural(session.attemptDeaths, "mort", "morts")} dans cet essai`,
    streak: c.mode === "jour" ? streakText(history.streak(gameDay(now))) : c.mode === "archive" ? ARCHIVE_STREAK_TEXT : "Aperçu : ne compte pas dans ta série",
    countdown: countdownText(now),
    canCarnage: lastCarnage !== null && scene !== null,
    canShare: memory.best !== null,
  });
  // Lot P1 : le classement (jour : rang et top 10 après l'envoi ; archive : le classement figé de ce jour, rien n'est envoyé).
  refreshRank();
  // Lot P2 : le fantôme du premier est relu (un autre a pu passer devant, ou c'est toi maintenant) ; « Regarder le premier » s'il y en a un.
  arrival.setFirst(null);
  void loadFirst();
  // Lot P3 : la carte des morts est rafraîchie ; « Le carnage de tout le monde » apparaît quand l'échantillon est là.
  void loadOthers();
  arrival.setEveryone(null);
  void loadEveryone();
  // Le top 10 se lit tout de suite, même pendant l'envoi ou le choix du pseudo (il est relu après la réponse du serveur).
  if (ranking.enabled && (c.mode === "archive" || c.mode === "jour")) void ranking.loadBoard(d.date);
}

/** Lot P1 : le classement de l'écran d'arrivée et le rang de l'accueil suivent l'état du classement. */
function refreshRank(): void {
  if (daily && choice && arrival.shown) {
    arrival.setRank(
      arrivalRankView({
        enabled: ranking.enabled,
        mode: choice.mode,
        date: daily.date,
        state: ranking.state,
        pending: ranking.pendingFor(daily.date) !== null,
        known: ranking.known(daily.date),
        board: ranking.boards.get(daily.date) ?? null,
      }),
    );
  }
  if (home?.isOpen) home.update(homeView());
}

/** Lot 10 : le texte partagé en dernier (`__jump.arrival.share`). */
let lastShare = "";

/** Lot 10 : « Partager » : la feuille de partage au téléphone, sinon le presse-papiers, sinon le texte à sélectionner. */
async function share(): Promise<void> {
  if (!daily || !choice || !memory.best || choice.mode === "essai") return; // un essai de thème ne se partage pas
  const best = memory.best.time;
  // Lot P1 : le rang s'ajoute à la fin (`3ᵉ/128`) s'il est celui de ce temps ; sinon (hors ligne, pas encore envoyé) la ligne du lot 10.
  const rank = choice.mode === "jour" ? ranking.shareRank(daily.date, best) : null;
  const text = shareText({ number: daily.number, date: daily.date, ticks: best, medal: jumpMedalFor(best, daily.medals), deaths: memory.totalDeaths, kind: choice.mode, rank }, location);
  lastShare = text;
  const r = await sendShare(text, touchOn);
  if (r === "partage") arrival.shareResult("Partagé", null);
  else if (r === "copie") arrival.shareResult("Copié dans le presse-papiers", null);
  else if (r === "annule") arrival.shareResult("", null);
  else arrival.shareResult("Copie impossible : sélectionne le texte ci-dessous", text);
}

// ——— Lot P3 : le carnage de tout le monde : l'échantillon du serveur (≈ 150 vies d'autres joueurs), ton essai en héros, par vagues ———
let everyone: EveryoneLives | null = null;
let everyoneAt = 0;
let everyoneMiss = firstDate && rankSource?.carnage ? "" : "aucun serveur";
/** Lit l'échantillon (au plus une fois par 3 minutes : le serveur ne le recalcule pas plus souvent) ; ne bloque jamais. */
async function loadEveryone(): Promise<void> {
  if (!firstDate || !rankSource?.carnage) return;
  if (!everyone || Date.now() - everyoneAt > LIVES_EVERY_MS) {
    const r = await rankSource.carnage(firstDate);
    if (r.ok) {
      everyone = everyoneLives(level, levelId, r.data, new Set(memory.lives.map((l) => l.code)));
      everyoneAt = Date.now();
      everyoneMiss = everyone.lives.length ? "" : "échantillon vide";
    } else everyoneMiss = r.code;
  }
  if (arrival.shown) arrival.setEveryone(canEveryone() ? "Le carnage de tout le monde" : null);
}
const canEveryone = (): boolean => !!(scene && lastCarnage && everyone && everyone.lives.length > 0);
/** Le carnage de tout le monde : ton dernier essai arrivé en héros, les vies de l'échantillon par vagues ; le compteur « N vies de M joueurs ». */
function startEveryone(max = 0): boolean {
  if (!canEveryone() || carnage) return false;
  const hero = lastCarnage!.hero;
  let e = everyone!;
  // Mesure (`__jump.startEveryone(150)`) : l'échantillon repris autant qu'il faut pour atteindre `max` vies.
  if (max > e.lives.length) e = { ...e, lives: Array.from({ length: max }, (_, i) => e.lives[i % e.lives.length]!), players: Array.from({ length: max }, (_, i) => e.players[i % e.players.length]!) };
  const plan = everyonePlan(level, hero, e);
  return startCarnage(hero, e.lives, false, lastBits, plan.label);
}

/** Lot 10 : « Revoir le carnage » : le dernier carnage, tel quel ; l'écran d'arrivée revient à sa fin. */
function replayCarnage(): void {
  if (!lastCarnage || carnage) return;
  startCarnage(lastCarnage.hero, lastCarnage.others, false, lastBits);
}

/** Lot 10 : l'accueil. Sur la page du niveau du jour, il se pose sur la partie (en pause) ; ailleurs, on va à la page du niveau du jour. */
function goHome(): void {
  if (!home) {
    location.assign(location.pathname + homeHref(options));
    return;
  }
  if (carnage) {
    carnage.run.stop();
    endCarnage();
  }
  setMenu(false);
  arrival.hide();
  hud.hideFinish();
  home.open(homeView());
  syncPause();
  // Lot P2 : le profil, relu (au plus une fois par 30 s).
  void syncProfile();
  // Lot P1 : le rang du jour, relu (sans attendre : l'accueil se met à jour quand la réponse arrive).
  if (ranking.enabled && daily && ranking.known(daily.date)) void ranking.loadBoard(daily.date);
}

/** Lot 10 : Jouer (le geste réveille aussi le son). Après une arrivée, un nouvel essai ; après minuit, le niveau du nouveau jour. */
function playFromHome(): void {
  if (newDay) {
    location.replace(location.pathname + dailyHref(options));
    return;
  }
  audio.unlock();
  home?.close();
  if (session.state.status === ATTEMPT_FINISHED) restart();
  controls.resetLatch();
  syncPause();
}

/** Médaille de la dernière arrivée sur le niveau du jour (`__jump.daily.lastMedal`). */
let lastMedal: string | null = null;

/** Bandeau d'arrivée : niveau du jour (lot 5) : la médaille obtenue et le temps de l'auteur ; morceau (lot 4) : le temps de la solution, « Morceau suivant ». */
function finishOptions(): { reference: string | null; next: string | null; title?: string } {
  if (daily && isTrial) {
    // Lot 11 : un essai de thème (rien n'est enregistré) : le bandeau le dit, sans médaille ni temps de l'auteur.
    return { reference: `Essai du thème ${theme.label} : rien n'est enregistré · Temps de l'auteur : ${formatTicks(daily.medals.author)}`, next: null, title: `Arrivée · essai ${theme.label}` };
  }
  if (daily) {
    const m = finishMedalText(session.state.time, daily.medals);
    lastMedal = m.medal;
    return { reference: m.text, next: null };
  }
  if (!mod) return { reference: null, next: null };
  const ref = reference === null ? "Solution : —" : `Solution : ${formatTicks(reference)}${mod.entry === "elan" && !mod.solution ? " (couloir compris)" : ""}`;
  return { reference: ref, next: nextHref };
}

/** Commande du dernier pas joué (le carnage ne se passe que sur une nouvelle commande). */
let lastBits = 0;
/** Lot 10 : commandes d'une rediffusion jouées comme celles du joueur (`__jump.autoplay`). */
let autoplayInputs: number[] | null = null;
let autoplayIndex = 0;

function stepOnce(): void {
  if (carnage) {
    stepCarnage();
    return;
  }
  let bits = watching ? (watchInputs[watchIndex++] ?? 0) : (injected ?? controls.sample());
  // Lot 10 (tests) : `__jump.autoplay(code)` joue une rediffusion comme si c'étaient les commandes du joueur (l'essai est enregistré).
  if (autoplayInputs && !watching) {
    bits = autoplayInputs[autoplayIndex++] ?? 0;
    if (autoplayIndex >= autoplayInputs.length) autoplayInputs = null;
  }
  const prevBits = lastBits;
  lastBits = bits;
  const prev = session.state;
  const event = session.step(bits);
  dispatch(eventsBetween(prev, session.state, level, session.params, eventTick++, "jeu", { bits, prevBits }));
  if (session.state.status !== ATTEMPT_DEAD && prev.status !== ATTEMPT_DEAD) look = onStep(look, prev.player, session.state.player, session.params.fallSpeed);
  ghost?.sync(session.state.time);
  firstGhost?.sync(session.state.time);
  if (phase !== "loading" && phase !== "no-webgl") phase = phaseOf(session.state);
  if (event) onEvent(event);
  if (!carnage) drainEssais();
}

function follow(s: PlayerState): Follow {
  return { cx: (s.x + PLAYER_WIDTH / 2) / T, cy: -(s.y + PLAYER_HEIGHT / 2) / T, vx: (s.vx * TICK_RATE) / T, ground: s.ground === 1 };
}

let camera: CameraView = { x: 0, y: 0, ahead: 0 };

function restart(): void {
  // Passage de minuit (lot 5) : la partie en cours a continué ; « recommencer » ouvre le nouveau niveau du jour.
  if (newDay) {
    location.replace(location.pathname + dailyHref(options));
    return;
  }
  if (carnage) {
    carnage.run.stop();
    carnage.demo = false;
    endCarnage();
  }
  session.restart();
  drainEssais();
  audio.stopLoops();
  slideSide = 0;
  trail.clear();
  if (watchReplay) {
    watchIndex = 0;
    session.state = replayStartState(level, watchReplay.start);
    session.prev = session.state;
  }
  ghost?.sync(0);
  firstGhost?.sync(0);
  controls.resetLatch();
  stepper.reset();
  look = restLook();
  hud.hideFinish();
  arrival.hide();
  if (scene) camera = snapCamera(follow(session.state.player), scene.frame);
  if (phase !== "loading" && phase !== "no-webgl") phase = phaseOf(session.state);
}

const hud = mountHud({ onRestart: () => controls.requestRestart() });
const arrival = mountArrival({
  onReplay: () => controls.requestRestart(),
  onShare: () => void share(),
  onCarnage: () => replayCarnage(),
  onHome: () => goHome(),
  // Lot P1 : le premier pseudo (ou un autre après un refus) : vérifié par le serveur, puis l'envoi en attente part avec lui.
  onName: (name) => void ranking.chooseName(name).then(() => refreshRank()),
  onReload: () => location.reload(),
  // Lot P2 : « Regarder le premier » : la lecture de son essai (`?watch=first`, la date pour une archive).
  onEveryone: () => void startEveryone(),
  onFirst: () => location.assign(location.pathname + watchFirstHref(choice?.mode === "archive" && daily ? daily.date : null, options)),
});
// Lot P1 : l'état du classement change (envoi, réponse, lecture) : l'écran d'arrivée et l'accueil suivent. Le réseau revient : ce qui attend repart.
ranking.onChange(() => {
  refreshRank();
  // Lot P2 : un envoi refusé parce que le code a été remplacé ailleurs (410) : la synchronisation le constate, la carte du profil le dit.
  if (ranking.state.status === "revoked" && jumpSync.state.status !== "revoked") void syncProfile(true);
});
window.addEventListener("online", () => ranking.wake());
window.addEventListener("online", () => livesSender.wake());
// Lot P3 : pendant la partie, un lot de vies toutes les 3 minutes au plus (page visible).
setInterval(() => {
  if (document.visibilityState === "visible") void livesSender.flush();
}, LIVES_EVERY_MS);
document.addEventListener("visibilitychange", () => {
  // Lot P3 : la page se cache : les vies dues partent (`keepalive` : l'envoi survit à la fermeture de la page).
  if (document.visibilityState === "hidden") void livesSender.flush({ keepalive: true });
  if (document.visibilityState === "visible") livesSender.wake();
  if (document.visibilityState === "visible") ranking.wake();
});
// Au chargement : un meilleur essai du jour pas encore classé (joué avant ce lot, ou la file d'une autre page) part ; ce qui attend repart ;
// le rang du jour de l'accueil est relu (les autres joueurs ont pu passer devant).
offerBest();
void ranking.flush();
if (ranking.enabled && home && ranking.known(formatDay(today))) void ranking.loadBoard(formatDay(today));
// Lot P2 : le profil DailyJump, au chargement (le meilleur gagne) ; puis le fantôme du premier (déjà lu pour `?watch=first`).
void syncProfile();
if (options.watchFirst) refreshFirstGhost();
else void loadFirst();
// Lot P3 : les vies en attente (une autre page, une coupure) repartent ; la carte des morts du jour se charge avec le niveau.
void livesSender.flush();
void loadOthers();

// ——— Lot 5 : ligne du jour (DailyJump #N, mode, médaille visée), message discret, passage de minuit ———
const dayLineEl = document.getElementById("dayline")!;
const dayNoteEl = document.getElementById("daynote")!;
let shownLine = "";
let notice = "";
/** Un nouveau jour a commencé pendant que la page était ouverte : le prochain « recommencer » ouvre son niveau. */
let newDay = false;
function setNotice(text: string, sticky: boolean): void {
  notice = text;
  dayNoteEl.textContent = text;
  dayNoteEl.classList.toggle("sticky", sticky);
  dayNoteEl.classList.remove("show");
  void dayNoteEl.offsetWidth; // relance l'animation
  dayNoteEl.classList.toggle("show", text !== "");
}
function updateDayLine(): void {
  if (!daily || !choice) return;
  const text = dayLine(daily, choice, preview, session.best);
  if (text === shownLine) return;
  shownLine = text;
  dayLineEl.textContent = text;
}
if (daily && choice) {
  dayLineEl.hidden = false;
  document.body.classList.add("daily");
  // Lot 10 : le mode archive se voit dans le HUD (il ne compte pas dans la série).
  const modeTag = document.getElementById("modetag")!;
  modeTag.hidden = choice.mode !== "archive" && choice.mode !== "essai";
  if (choice.mode === "essai") modeTag.textContent = `Essai · ${theme.label}`;
  updateDayLine();
  if (choice.refused) setNotice(REFUSED_TEXT, false);
  // Le niveau d'aujourd'hui est ouvert (ou une date future refusée) : à minuit de Paris, un nouveau niveau attend. La partie continue.
  if (choice.mode === "jour") {
    const shownDay = choice.day;
    const watchDay = () => {
      if (newDay || gameDay() === shownDay) return;
      newDay = true;
      setNotice(NEW_DAY_TEXT, true);
    };
    setInterval(watchDay, 1000);
  }
}
// Lot 10 : le compte à rebours jusqu'au prochain niveau (minuit, heure de Paris), sur l'accueil et l'écran d'arrivée.
setInterval(() => {
  if (!home?.isOpen && !arrival.shown) return;
  const text = countdownText(Date.now());
  home?.setCountdown(text);
  arrival.setCountdown(text);
}, 1000);

// ——— Surimpression de `?debug` ———
const overlay = options.debug ? document.getElementById("debug") : null;
const tunedBadge = document.getElementById("tuned")!;
const fmt = (v: number, d = 1) => v.toFixed(d).replace(".", ",");

function updateOverlay(): void {
  updateDayLine();
  tunedBadge.textContent = session.tuned ? "réglages modifiés : rien n'est enregistré" : "";
  if (!overlay) return;
  const v = view();
  const st = session.state;
  const side = st.player.slide < 0 ? " (gauche)" : st.player.slide > 0 ? " (droite)" : "";
  const d = session.lastDeath;
  const death = d ? `${DEATH_NAMES[d.cause]} (colonne ${fmt(d.x / T, 1)} · rangée ${fmt(d.y / T, 1)})` : "aucune";
  overlay.textContent = [
    `essai     n° ${session.attempts} · ${STATUS_NAMES[st.status]} · ${formatTicks(st.time)} · morts ${session.deaths} · point ${st.checkpoint < 0 ? "aucun" : `${st.checkpoint + 1}/${level.checkpoints.length}`}`,
    `mort      ${death}`,
    `vitesse   → ${fmt(v.vx)}  ↑ ${fmt(-v.vy)} tuiles/s`,
    `état      ${v.mode}${side}`,
    `coyote    ${v.coyote}/${params.coyote}   tampon ${v.buffer}/${params.jumpBuffer}   verrou ${v.lock}`,
    `position  colonne ${fmt(v.x, 2)} · rangée ${fmt(v.y, 2)}   pas ${session.ticks}`,
    options.hitbox ? "boîtes justes (hitbox)" : "",
    manual ? "pas à pas (manual)" : "",
    watching
      ? mod?.solution
        ? "lecture de la solution du morceau (solution)"
        : daily && options.solution
          ? "lecture de la rediffusion de l'auteur (solution)"
          : options.watchFirst
            ? "lecture de l'essai du premier (watch=first)"
            : "lecture du meilleur essai (watch=best)"
      : "",
    daily ? dailyOverlay() : "",
    `jour      meilleur ${memory.best ? formatTicks(memory.best.time) : "—"} · vies ${memory.lives.length} · taches ${stains?.count ?? 0}${ghost ? ` · fantôme ${ghostOn ? "montré" : "caché"}` : ""}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Surimpression `?debug` du niveau du jour : le morceau où se trouve le personnage. */
function dailyOverlay(): string {
  if (!daily) return "";
  const col = Math.floor((session.state.player.x + PLAYER_WIDTH / 2) / T);
  // Un morceau commence quand le centre passe le bord droit du palier qui le précède (sa première colonne) et va jusqu'au morceau suivant :
  // le palier partagé appartient au morceau d'avant (lot 7 : le décompte commençait une colonne trop tôt) ; avant le premier, le premier.
  let k = 0;
  while (k + 1 < daily.pieces.length && col >= daily.pieces[k + 1]!.col0) k++;
  const p = daily.pieces[k];
  const where = p ? `${k + 1}/${daily.pieces.length} ${p.id} v${p.variant} · exigence ${p.exigence}/5 · ${p.entry === "arret" ? "arrêt" : "élan"}` : "—";
  return `morceau   ${where}\nniveau    ${daily.id} · auteur ${formatTicks(daily.authorTicks)} · tirage ${daily.chosen}${daily.fallback ? " (secours)" : ""}`;
}

const info: JumpDebug = {
  get profile() {
    return readIdentity(store);
  },
  get phase() {
    return phase;
  },
  set phase(p: Phase) {
    phase = p;
  },
  day: dayText,
  simVersion: JUMP_SIM_VERSION,
  palette: palette.name,
  get theme(): ThemeView {
    return {
      name: theme.name,
      label: theme.label,
      forced: daily ? daily.forcedTheme : themeByName(options.theme) !== null,
      ofDay: themeForDay(daily ? daily.day : today).name,
      ambience: AMBIENCES[theme.ambience].label,
      detail: scene ? sceneDetail(levels) : null,
      stats: scene ? { ...scene.stats } : null,
    };
  },
  scenario: options.scenario,
  get daily(): DailyView | null {
    if (!daily || !choice) return null;
    return {
      date: daily.date,
      number: daily.number,
      id: daily.id,
      theme: daily.theme,
      forcedTheme: daily.forcedTheme,
      today: dayText,
      mode: choice.mode,
      preview,
      refused: choice.refused,
      hash: daily.hash,
      width: daily.level.width,
      height: daily.level.height,
      pieces: daily.pieces.map((p) => ({ id: p.id, variant: p.variant, entry: p.entry, exigence: p.exigence, tags: p.tags, family: p.family, long: p.long, mechanic: p.mechanic, col0: p.col0, col1: p.col1, start: p.start, end: p.end })),
      attempts: daily.attempts.map((a) => ({ ...a, pieces: [...a.pieces] })),
      chosen: daily.chosen,
      fallback: daily.fallback,
      authorTicks: daily.authorTicks,
      medals: { ...daily.medals },
      exigence: { ...daily.exigence },
      code: daily.code,
      lastMedal,
      newDay,
      notice,
      load: loaded
        ? { source: loaded.source, generated: loaded.generated, cacheMiss: loaded.cacheMiss, frozenMiss: loaded.frozenMiss, totalMs: loaded.totalMs, blockedMs: loaded.blockedMs }
        : { source: "aucun", generated: false, cacheMiss: "", frozenMiss: "", totalMs: 0, blockedMs: 0 },
      line: shownLine,
    };
  },
  module: mod && built ? { ...mod, levelId: built.levelId, reference, next: nextHref! } : null,
  get player() {
    return view();
  },
  get attempt() {
    return attemptView();
  },
  get fx() {
    return { enabled: levels.particles > 0, emitted: burst.emitted, alive: burst.alive, shaking: shake.active };
  },
  get banner() {
    return hud.finishShown;
  },
  params,
  get tuned() {
    return session.tuned;
  },
  get ticks() {
    return session.ticks;
  },
  get touch() {
    const fingers = touchUi?.pad.list() ?? [];
    return {
      active: touchOn,
      fingers,
      bits: touchUi?.pad.bits ?? 0,
      paused: panelOpen,
      panelOpen,
      viewTiles: scene ? scene.frame.halfH * 2 : 0,
    };
  },
  manual(on: boolean) {
    manual = on;
    stepper.reset();
  },
  advance(n: number) {
    for (let i = 0; i < n; i++) stepOnce();
    return view();
  },
  input(bits: number | null) {
    if (bits !== null && (!Number.isInteger(bits) || bits < 0 || bits > INPUT_MASK)) throw new RangeError(`Commande invalide : ${bits}`);
    injected = bits;
  },
  restart,
  replays: {
    list() {
      const out: ReturnType<JumpDebug["replays"]["list"]> = [];
      if (memory.best) out.push({ kind: "meilleur", essai: memory.best.essai, ticks: memory.best.time, time: memory.best.time, deaths: memory.best.deaths, code: memory.best.code });
      for (const l of memory.lives) {
        let ticks = 0;
        try {
          ticks = runsTicks(decodeReplay(l.code).runs);
        } catch {
          ticks = 0;
        }
        out.push({ kind: "vie", essai: l.essai, ticks, code: l.code });
      }
      return out;
    },
    export(which = "best") {
      if (which === "best") return memory.best?.code ?? null;
      return memory.lives[which]?.code ?? null;
    },
    import(code: string) {
      const r = memory.importBest(code);
      if (r.ok) {
        session.best = memory.best?.time ?? null;
        refreshGhost();
      }
      return r;
    },
  },
  carnage: {
    get state(): CarnageView {
      const c = carnage;
      if (!c) return { active: false, demo: false, everyone: false, lives: 0, arrivals: 0, deaths: 0, running: 0, tick: 0, heroTicks: 0, label: "" };
      return {
        active: true,
        demo: c.demo,
        everyone: c.everyone !== null,
        lives: c.run.total,
        arrivals: c.run.arrivals,
        deaths: c.run.deaths,
        running: c.run.running,
        tick: c.run.tick,
        heroTicks: c.run.heroTicks,
        label: c.everyone ?? carnageLabel(c.run.total, c.run.arrivals),
      };
    },
    start() {
      const best = memory.bestReplay();
      if (!best || !memory.best) return false;
      return startCarnage(best, memory.liveReplays(memory.best.essai), false, lastBits);
    },
    demo(lives?: number, crowd?: boolean) {
      return startDemo(lives ?? 0, crowd ?? false);
    },
    skip() {
      if (!carnage) return;
      carnage.run.stop();
      endCarnage();
    },
  },
  storage: {
    clear() {
      const n = clearAll(store);
      memory.purge();
      refreshGhost();
      session.best = null;
      stains?.reset([]);
      return n;
    },
    size() {
      return memory.storedSize();
    },
    get memory() {
      return { best: memory.best?.time ?? null, lives: memory.lives.length, deaths: memory.deaths.length, positions: memory.deaths.map((d) => ({ x: d.x / T, y: d.y / T })) };
    },
  },
  get ghost() {
    const g = ghost;
    const p = g?.state.player;
    return {
      enabled: ghostOn,
      available: !!g,
      visible: ghostMesh?.group.visible ?? false,
      tick: g?.tick ?? 0,
      status: g ? STATUS_NAMES[g.state.status]! : "aucun",
      x: p ? p.x / T : 0,
      y: p ? p.y / T : 0,
    };
  },
  toggleGhost() {
    return toggleGhost();
  },
  get firstGhost() {
    const g = firstGhost;
    const p = g?.state.player;
    return {
      date: firstDate,
      enabled: firstGhostOn(),
      loaded: firstRemote !== null,
      shown: g !== null,
      visible: firstGhostMesh?.group.visible ?? false,
      labelled: firstGhostMesh?.labelled ?? false,
      name: firstRemote?.name ?? null,
      label: firstRemote ? firstGhostLabel(firstRemote.name) : null,
      ticks: firstRemote?.ticks ?? null,
      mine: firstRemote?.mine ?? false,
      miss: firstMiss,
      tick: g?.tick ?? 0,
      x: p ? p.x / T : 0,
      y: p ? p.y / T : 0,
    };
  },
  ghostColors: { own: OWN_GHOST_COLOR, first: FIRST_GHOST_COLOR },
  get stains() {
    return { count: stains?.count ?? 0, discs: stains?.discs ?? 0, added: stains?.added ?? 0 };
  },
  get othersStains() {
    return {
      date: firstDate,
      enabled: othersOn(),
      loaded: othersMap !== null,
      tiles: othersMap?.tiles.length ?? 0,
      drawn: othersDrawn.count,
      discs: othersDrawn.discs,
      visible: othersLayer?.visible ?? false,
      players: othersMap?.players ?? 0,
      deaths: othersMap?.deaths ?? 0,
      miss: othersMiss,
      closest: othersDrawn.closest,
    };
  },
  get lives() {
    return livesSender.debug(formatDay(today));
  },
  get everyone() {
    return { loaded: everyone !== null, lives: everyone?.lives.length ?? 0, players: new Set(everyone?.players ?? []).size, rejected: everyone?.rejected ?? 0, own: everyone?.own ?? 0, miss: everyoneMiss, button: arrival.everyone };
  },
  startEveryone(max?: number) {
    return startEveryone(max ?? 0);
  },
  get watching() {
    return watching;
  },
  get events() {
    return eventLog.list();
  },
  clearEvents() {
    eventLog.clear();
  },
  get audio() {
    return audio.debug();
  },
  get effects() {
    return {
      levels: { ...levels },
      emitted: particles.emitted,
      alive: particles.alive,
      shaking: shake.active,
      trail: trail.points.filter((p) => p.alpha > 0.01).length,
      vibrations: vibrator.count,
      carnageDropped: carnageFilter.dropped,
    };
  },
  get settings() {
    return { ...settings };
  },
  get look() {
    return { pose: look.pose, stride: look.stride, phase: stridePhase(look.stride), feet: [...look.feet], bob: look.bob, lean: look.lean, breath: look.breath, skid: look.skid, squash: look.squash, body: levels.body };
  },
  get menu() {
    return { open: menuOpen };
  },
  /** Lot 13 : les courants d'air (null sans eux). */
  get wind() {
    if (level.winds.length === 0) return null;
    const state = session.state;
    const inside = windZoneOf(level, state);
    return {
      ...(scene?.wind ?? {}),
      zones: level.winds.length,
      list: level.winds.map((w) => ({ c0: w.c0, c1: w.c1, r0: w.r0, r1: w.r1, dir: windDirName(w), force: w.force, gust: w.gust ? { ...w.gust } : null })),
      inside,
      pushed: windPush(level, state) !== null,
      active: level.winds.map((_, i) => windActive(level, state, i)),
      phases: level.winds.map((_, i) => windPhase(level, state, i)),
    };
  },
  /** Lot 12 : état des blocs clignotants et alternés (null sans eux) : ce qui est dessiné (pleins, absents, vacillants, en attente), le jeu solide, l'éclat, et l'état de la simulation. */
  get blocks() {
    const stats = scene?.blocks ?? null;
    if (!stats && level.blinks.length === 0 && level.alts.length === 0) return null;
    const state = session.state;
    const looks = blockLooks(level, state);
    return {
      // Ce que le dessin a posé à la dernière image (opacité de la face qui vacille, contours épais, éclat) ; le reste se lit de l'état de l'essai.
      ...(stats ?? {}),
      blinks: level.blinks.length,
      alts: level.alts.length,
      solid: looks.filter((l) => l.solid).length,
      absent: looks.filter((l) => !l.solid).length,
      wobbling: looks.filter((l) => l.wobble > 0).length,
      waiting: looks.filter((l) => l.waiting).length,
      alt: level.alts.length > 0 ? (state.alt ?? 0) : -1,
      phases: sectionPhases(level, state),
      cycles: level.blinkCycles.map((c) => (c ? { ...c } : null)),
      states: looks.map((l) => l.solid),
    };
  },
  get home(): HomeDebug {
    return {
      available: home !== null,
      atStart: homeAtStart,
      open: home?.isOpen ?? false,
      ready: home?.ready ?? false,
      help: home?.helpOpen ?? false,
      archives: home?.archivesOpen ?? false,
      archiveDates: home ? home.rows.map((r) => r.date) : [],
      view: home ? homeView() : null,
    };
  },
  get history() {
    return history.entries.map((r) => ({ ...r }));
  },
  get streak() {
    return history.streak(gameDay());
  },
  get arrival() {
    return { shown: arrival.shown, share: lastShare, message: arrival.message, rank: arrival.rank };
  },
  get rank() {
    return { ...(ranking.debug(today) as object), demo: demoRank };
  },
  get sync() {
    return { ...jumpSync.state, profile: homeProfile(), message: profileUi.message };
  },
  rankWake() {
    ranking.wake();
  },
  autoplay(code?: string) {
    const c = code ?? daily?.code ?? (level === ESSAI_LEVEL ? ESSAI_SOLUTION_CODE : null);
    if (!c) throw new Error("rien à jouer : donne une rediffusion");
    autoplayInputs = fromRuns(decodeReplay(c).runs);
    autoplayIndex = 0;
    return autoplayInputs.length;
  },
  setMenu(open: boolean) {
    setMenu(open);
  },
  get frameTimes() {
    const list = [...frameWork];
    const sorted = list.slice().sort((a, b) => a - b);
    return {
      mean: list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0,
      p95: sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]! : 0,
      frames: list.length,
      stepMs: workStats.steps ? workStats.stepMs / workStats.steps : 0,
      drawMs: workStats.draws ? workStats.drawMs / workStats.draws : 0,
      reset() {
        frameWork.length = 0;
        workStats.steps = workStats.stepMs = workStats.draws = workStats.drawMs = 0;
      },
    };
  },
  probe() {
    if (!scene) return { width: 0, height: 0, colors: 0, background: 0 };
    draw(1, 0);
    const gl = scene.renderer.getContext();
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    const px = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const seen = new Set<number>();
    // Lot 9 : le fond = le ciel et les plans de parallaxe (aplats : à 2 près par canal, l'arrondi des couleurs de sommet).
    const backdrop = scene.backdrop;
    const near = (rgb: number, c: number) => Math.abs(((rgb >> 16) & 255) - ((c >> 16) & 255)) <= 2 && Math.abs(((rgb >> 8) & 255) - ((c >> 8) & 255)) <= 2 && Math.abs((rgb & 255) - (c & 255)) <= 2;
    let background = 0;
    let total = 0;
    for (let i = 0; i < px.length; i += 4 * 5) {
      const rgb = (px[i]! << 16) | (px[i + 1]! << 8) | px[i + 2]!;
      seen.add(rgb);
      total++;
      if (backdrop.some((c) => near(rgb, c))) background++;
    }
    return { width, height, colors: seen.size, background: total ? background / total : 0 };
  },
};
if (options.debug) {
  window.__jump = info;
  overlay?.removeAttribute("hidden");
}

/** Ouvre ou ferme le panneau de réglages (téléphone) : ouvert, la partie est en pause et la couche tactile ne capte plus rien. */
function setPanel(open: boolean): void {
  panelOpen = open;
  document.getElementById("tune")!.hidden = !open;
  touchUi?.suspend(open || menuOpen || homeOpen());
  controls.setTouch(0, false);
  audio.setActive(!open && !menuOpen && !homeOpen());
  stepper.reset();
}

// ——— Lot 8 : menu ⏸ (Échap, P, Start, bouton) : la partie est en pause, les réglages du joueur s'appliquent tout de suite ———
let menuOpen = false;
let lastPreview = 0;
function applySettings(next: PlayerSettings, changed: keyof PlayerSettings): void {
  settings = next;
  saveSettings(store, settings);
  levels = feelLevels(settings, options.fx);
  particles.amount = levels.particles;
  if (scene) {
    scene.animate = levels.animate;
    scene.windParticles = levels.particles;
    scene.setDetail(sceneDetail(levels));
  }
  if (!levels.continuous) trail.clear();
  audio.setSettings(settings);
  if (changed === "othersStains") showOthers();
  // Un aperçu, pour entendre le niveau choisi (au plus quatre fois par seconde pendant qu'on glisse le curseur).
  const now = performance.now();
  if ((changed === "volume" || changed === "sfx") && now - lastPreview > 250) {
    lastPreview = now;
    audio.preview();
  }
  if (changed === "vibration" && settings.vibration) vibrator.play(25, now);
}
// Lot P2 : Réglages › Profil (le profil commun de la plateforme, le même que DailyTrack), dans le menu ⏸.
const profileUi = mountProfileUi({
  online: rankSource !== null && !demoRank && !!rankSource.jumpMe,
  name: () => readIdentity(store).name,
  playerId: ownId,
  ensurePlayerId: () => identity.getPlayerId(),
  stats: () => jumpStats(history.entries, gameDay()),
  sync: () => jumpSync.state,
  rename: (name) => ranking.profile.rename(name),
  changeCode: async () => {
    const r = await ranking.profile.changeCode();
    if (r.ok) void syncProfile(true);
    return r;
  },
  fetchProfile: (id) => rankSource!.jumpMe!(id),
  applyIdentity: (who) => (store ? applyJumpIdentity(who, store, history.entries, formatDay(gameDay())) : false),
  copy: copyText,
  reload: () => location.reload(),
  onChange: () => {
    if (home?.isOpen) home.update(homeView());
  },
});
jumpSync.subscribe(() => profileUi.refresh());
const menu = mountPauseMenu({
  profile: profileUi.root,
  settings,
  canVibrate: typeof navigator.vibrate === "function",
  onChange: applySettings,
  onResume: () => setMenu(false),
  onRestart: () => {
    setMenu(false);
    if (home?.isOpen) home.close();
    controls.requestRestart();
    syncPause();
  },
  onHome: () => goHome(),
});
function setMenu(open: boolean): void {
  if (open === menuOpen) return;
  menuOpen = open;
  if (open) menu.open();
  else menu.close();
  document.body.classList.toggle("paused", open);
  syncPause();
}
/** Lot 10 : l'accueil ouvert met la partie en pause, comme le menu. */
const homeOpen = (): boolean => home?.isOpen ?? false;
/** Menu ⏸ ou accueil ouverts : le clavier et les doigts ne commandent plus le personnage, le son de jeu se tait, aucun pas ne se joue. */
let suspendedNow = false;
function syncPause(): void {
  const blocked = menuOpen || homeOpen();
  if (blocked !== suspendedNow) {
    suspendedNow = blocked;
    controls.setSuspended(blocked);
  }
  touchUi?.suspend(blocked || panelOpen);
  controls.setTouch(0, false);
  audio.setActive(!blocked && !panelOpen);
  stepper.reset();
}
const pauseButton = document.getElementById("pausebtn") as HTMLButtonElement;
pauseButton.addEventListener("click", () => {
  pauseButton.blur();
  setMenu(true);
});

// ——— Fantôme : réglage mémorisé (`jump:fantome`), bouton 👻 (téléphone), bouton du coin et touche G (ordinateur) ———
const ghostButton = document.getElementById("ghostbtn") as HTMLButtonElement;
function showGhostSetting(): void {
  ghostButton.setAttribute("aria-pressed", ghostOn ? "true" : "false");
  ghostButton.textContent = `👻 Fantôme : ${ghostOn ? "oui" : "non"}`;
  touchUi?.setGhost(ghostOn);
}
function toggleGhost(): boolean {
  ghostOn = !ghostOn;
  saveGhostSetting(store, ghostOn);
  showGhostSetting();
  return ghostOn;
}
ghostButton.addEventListener("click", () => {
  ghostButton.blur();
  toggleGhost();
});
window.addEventListener("keydown", (e) => {
  if (e.code === "KeyG" && !e.repeat && !menuOpen) toggleGhost();
});

if (touchOn) {
  touchUi = mountTouchUi({
    controls,
    forced: options.touch === "1",
    zones: options.zones,
    tune: options.tune,
    onRestart: () => controls.requestRestart(),
    onGear: () => setPanel(true),
    onMenu: () => setMenu(true),
    onGhost: () => toggleGhost(),
    ghostOn,
  });
}
showGhostSetting();

// La page se ferme (ou passe en arrière-plan) : l'essai en cours est clos comme un abandon, ses vies sont gardées.
const flushEssai = () => {
  if (watching || carnage) return;
  session.flush();
  drainEssais();
};
window.addEventListener("pagehide", flushEssai);

if (options.tune) {
  const panel = document.getElementById("tune")!;
  mountTunePanel(panel, params, () => updateOverlay(), touchOn ? { onClose: () => setPanel(false) } : {});
}

/** Dessine l'image : personnage interpolé entre l'état précédent et l'état courant (`alpha`), caméra lissée sur `dt` secondes. */
let clock = 0;
function draw(alpha: number, dt: number): void {
  if (!scene) return;
  clock += dt;
  burst.update(dt);
  stains?.update(dt);
  particles.update(dt);
  particleMesh?.sync();
  if (carnage) {
    drawCarnage(scene, carnage, alpha, dt);
    return;
  }
  const sa = session.prev;
  const sb = session.state;
  const a = sa.player;
  const b = sb.player;
  const x = (a.x + (b.x - a.x) * alpha) / T;
  const y = (a.y + (b.y - a.y) * alpha) / T;
  look = animateLook(look, dt, motionOf(b, session.params.runSpeed, session.params.fallSpeed), levels.body);
  const alive = sb.status !== ATTEMPT_DEAD;
  scene.setPlayer({ x, y, look, visible: alive, blink: blink.update(dt), squashAmount: levels.squash });
  scene.setWorld(sa, sb, alpha, clock);
  feelFrame(scene, sb, x, y, alive, dt, session.params.runSpeed);
  drawGhost(alpha);
  drawFirstGhost(alpha);
  // Mort : la caméra reste où l'on est mort (l'éclatement se voit) ; le nouvel essai la repose au départ.
  if (sb.status !== ATTEMPT_DEAD) {
    const f = follow(b);
    camera = followCamera(camera, { ...f, cx: x + PLAYER_WIDTH / T / 2, cy: -(y + PLAYER_HEIGHT / T / 2) }, scene.frame, dt);
  }
  const jolt = shake.offset(dt);
  scene.setView(camera.x + jolt.x, camera.y + jolt.y);
  scene.render();
  hud.update(session);
}

/** Lot 9 : ce que les réglages demandent au décor et à la parallaxe. */
function sceneDetail(l: FeelLevels): SceneDetail {
  return { decorLite: l.decorLite, parallaxLite: l.parallaxLite, parallaxMotion: l.parallaxMotion };
}

let beltClock = 0;
/** Lot 11 : les plages de tapis roulant du niveau (leur ronronnement est spatialisé, `beltMix`). Calculées une fois. */
const belts = beltRuns(level);

/**
 * Lot 8, à chaque image : traînée à pleine vitesse, frottement de la glisse (tant qu'elle dure, d'après les événements), scies audibles
 * (les trois plus proches du personnage, stéréo selon leur position). `x`, `y` : coin haut-gauche affiché du personnage (tuiles).
 */
function feelFrame(sc: JumpScene, st: Readonly<AttemptState>, x: number, y: number, alive: boolean, dt: number, runSpeed: number): void {
  // Lot 8b : la traînée seulement à pleine vitesse ou en élan (au-delà de la course : un peu plus marquée).
  const speed = Math.abs(st.player.vx);
  const fast = alive && speed >= runSpeed;
  if (levels.continuous) trail.update(dt, x, y, fast && !menuOpen, 1 + Math.max(0, speed - runSpeed) / Math.max(1, runSpeed));
  else trail.clear();
  sc.setTrail(trail.points);
  slideClock += dt;
  if (slideSide !== 0 && alive && levels.continuous && slideClock >= SLIDE_EVERY) {
    slideClock = 0;
    slideSpark(particles, colors, x + PLAYER_WIDTH / T / 2 + (slideSide * PLAYER_WIDTH) / T / 2, -(y + (PLAYER_HEIGHT / T) * 0.85), slideSide);
  }
  // Lot 11 : sur un tapis roulant, des étincelles de rouage (lues de l'état : la tuile sous les pieds ; rien n'est écrit dans la simulation).
  beltClock += dt;
  if (belts.length > 0 && alive && levels.continuous && beltClock >= BELT_EVERY) {
    beltClock = 0;
    const under = st.player.ground === 1 ? groundTile(level, st.player.x, st.player.y) : 0;
    const side = under === TILE_BELT_LEFT ? -1 : under === TILE_BELT_RIGHT ? 1 : 0;
    if (side !== 0) beltSpark(particles, colors, x + PLAYER_WIDTH / T / 2, -(y + PLAYER_HEIGHT / T), side);
  }
  const listener = { x: x + PLAYER_WIDTH / T / 2, y: y + PLAYER_HEIGHT / T / 2 };
  audio.update(
    level.saws.length === 0 ? [] : sawMix(sawCenters(level, st).map((p) => ({ x: p.x / T, y: p.y / T })), listener),
    belts.length === 0 ? [] : beltMix(belts, listener),
    // Lot 13 : le souffle des zones de vent (trois voix, plus fort au centre d'une zone, un murmure quand une rafale ne souffle pas).
    level.winds.length === 0 ? [] : windMix(level, windLooks(level, st), listener),
  );
}

/** Position interpolée (tuiles, coin haut-gauche) entre deux états ; pas d'interpolation à travers un saut (reprise sur un point). */
function poseBetween(a: PlayerState, b: PlayerState, alpha: number): { x: number; y: number } {
  if (Math.abs(b.x - a.x) + Math.abs(b.y - a.y) > T) return { x: b.x / T, y: b.y / T };
  return { x: (a.x + (b.x - a.x) * alpha) / T, y: (a.y + (b.y - a.y) * alpha) / T };
}

/** Le fantôme du meilleur essai : carré translucide ; mort, un anneau qui s'ouvre là où il est mort ; puis sa reprise. */
function drawGhost(alpha: number): void {
  if (!ghostMesh) return;
  const g = ghost;
  if (!g || !ghostOn || watching) {
    ghostMesh.hide();
    return;
  }
  const gs = g.state;
  if (gs.status === ATTEMPT_DEAD) ghostMesh.set(null, { x: gs.deathX / T, y: gs.deathY / T, dying: Math.min(1, gs.deathTicks / RESPAWN_TICKS) });
  else ghostMesh.set(poseBetween(g.prev.player, gs.player, alpha), null);
}

/** Lot P2 : le fantôme du premier, dessiné comme le tien (sa couleur, son pseudo au-dessus). */
function drawFirstGhost(alpha: number): void {
  if (!firstGhostMesh) return;
  const g = firstGhost;
  if (!g || !firstGhostOn() || watching) {
    firstGhostMesh.hide();
    return;
  }
  const gs = g.state;
  if (gs.status === ATTEMPT_DEAD) firstGhostMesh.set(null, { x: gs.deathX / T, y: gs.deathY / T, dying: Math.min(1, gs.deathTicks / RESPAWN_TICKS) });
  else firstGhostMesh.set(poseBetween(g.prev.player, gs.player, alpha), null);
}

/** Le carnage : le héros (le personnage, avec ses yeux), la foule (un carré translucide par vie), le monde du héros, la caméra sur lui. */
function drawCarnage(sc: NonNullable<typeof scene>, c: CarnageRun, alpha: number, dt: number): void {
  const h = c.run.hero;
  const hero = poseBetween(h.prev.player, h.state.player, alpha);
  const heroAlive = h.state.status !== ATTEMPT_DEAD;
  heroLook = animateLook(heroLook, dt, motionOf(h.state.player, DEFAULT_JUMP_PARAMS.runSpeed, DEFAULT_JUMP_PARAMS.fallSpeed), levels.body);
  sc.setPlayer({ ...hero, look: heroLook, visible: heroAlive, blink: blink.update(dt), squashAmount: levels.squash });
  sc.setWorld(h.prev, h.state, alpha, clock);
  feelFrame(sc, h.state, hero.x, hero.y, heroAlive, dt, DEFAULT_JUMP_PARAMS.runSpeed);
  const lives = c.run.lives;
  for (let i = 0; i < lives.length; i++) {
    const life = lives[i]!;
    const r = life.runner;
    if (life.status !== "court" || !r || r.state.status === ATTEMPT_DEAD) c.crowd.set(i, null);
    else {
      const p = poseBetween(r.prev.player, r.state.player, alpha);
      c.crowd.set(i, p.x, p.y);
    }
  }
  c.crowd.commit();
  if (carnageBurst) {
    carnageBurst.pool.update(dt);
    carnageBurst.mesh.sync();
  }
  if (h.state.status !== ATTEMPT_DEAD) {
    const f = follow(h.state.player);
    camera = followCamera(camera, { ...f, cx: hero.x + PLAYER_WIDTH / T / 2, cy: -(hero.y + PLAYER_HEIGHT / T / 2) }, sc.frame, dt);
  }
  sc.setView(camera.x, camera.y);
  sc.render();
  hud.update(session, h.state.time);
}

/** Temps de fil principal par image (ms), les 600 dernières images : mesure du carnage (`__jump.frameTimes`). */
const frameWork: number[] = [];
const workStats = { steps: 0, stepMs: 0, draws: 0, drawMs: 0 };

if (!scene) {
  document.getElementById("nogl")!.style.display = "flex";
  phase = "no-webgl";
} else {
  const s = scene;
  s.resize(touchOn);
  camera = snapCamera(follow(session.state.player), s.frame);
  const onResize = () => {
    s.resize(touchOn);
    draw(manual ? 1 : stepper.alpha, 0);
  };
  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", onResize);
  let last = performance.now();
  const frame = (now: number) => {
    const t0 = performance.now();
    const dt = Math.min(Math.max((now - last) / 1000, 0), 0.25);
    last = now;
    controls.pollPad();
    if (controls.takeMenu()) setMenu(!menuOpen);
    if (controls.takeRestart()) restart();
    if (!manual && !panelOpen && !menuOpen && !homeOpen()) {
      const steps = stepper.advance(dt);
      for (let i = 0; i < steps; i++) stepOnce();
      workStats.steps += steps;
    }
    const t1 = performance.now();
    draw(manual ? 1 : stepper.alpha, dt);
    updateOverlay();
    const t2 = performance.now();
    workStats.stepMs += t1 - t0;
    workStats.drawMs += t2 - t1;
    workStats.draws++;
    frameWork.push(t2 - t0);
    if (frameWork.length > 600) frameWork.shift();
    requestAnimationFrame(frame);
  };
  draw(1, 0);
  updateOverlay();
  phase = "ready";
  requestAnimationFrame(frame);
  if (daily && options.solution) hud.toast("Rediffusion de l'auteur");
  else if (mod?.solution && !watching) hud.toast("Pas de solution stockée pour ce morceau");
  else if (mod?.solution) hud.toast("Solution du morceau");
  else if (options.watchBest && !watching) hud.toast("Pas encore de meilleur essai aujourd'hui : à toi de jouer");
  else if (options.watchFirst && !watching) hud.toast(firstMiss === "no_ghost" ? "Personne n'est encore classé ce jour-là : à toi de jouer" : "Fantôme du premier indisponible : à toi de jouer");
  else if (options.watchFirst && firstRemote) hud.toast(`Rediffusion de ${firstRemote.name}, premier du jour`);
  else if (watching) hud.toast("Rediffusion de ton meilleur essai");
  if (options.carnageDemo) startDemo();
}
// Lot 10 : le jeu est prêt : Jouer et Réglages répondent ; l'accueil ouvert tient la partie en pause.
gameReady = true;
home?.setReady(true);
syncPause();

