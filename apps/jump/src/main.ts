import "./generationInit";
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
  INPUT_ATTEMPT_MASK,
  INPUT_RESPAWN,
  JUMP_SIM_VERSION,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  RESPAWN_TICKS,
  RESTART_VERSION,
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
  sectionPeriod,
  singleClock,
  cycleMod,
  platformPositions,
  MUSHROOM_NAMES,
  mushroomPad,
  pressBoxes,
  laserBarAt,
  laserBox,
  sectionClock,
  windActive,
  windPhase,
  windPush,
  windZoneOf,
  jumpMedalFor,
  jumpThemeForDay,
  levelNumber,
  replayStartState,
  type AttemptState,
  type DailyLevel,
  type PublicDailyLevel,
  type JumpMedal,
  type JumpParams,
  type JumpReplay,
  type JumpThemeName,
  type Level,
  type PlayerState,
} from "@cdj/jump-sim";
import { CrowdMesh, GhostMesh, StainLayer } from "./actors";
import { Carnage, HERO, carnageLabel, waveAt, waveStarts } from "./carnage";
import { Ghost, checkpointTimes } from "./ghost";
import { DayMemory, browserStorage, clearAll, loadGhostSetting, saveGhostSetting, type RecordedEssai } from "./memory";
import { stainFor } from "./stains";
import { CARNAGE, followCamera, snapCamera, type CameraView, type Follow } from "./camera";
import { Controls } from "./input";
import { animateLook, motionOf, onSkid, onStep, restLook, stridePhase, type FeetPose, type Look } from "./look";
import { BurstMesh, BurstPool, Shake } from "./fx";
import { mountHud, type Objective } from "./hud";
import { FixedStepper } from "./loop";
import { THEMES, themeByName, themeForDay } from "./themes";
import { createScene, type JumpScene, type SceneDetail, type SceneStats } from "./scene";
import { slowDebugPaths } from "./slowRoute";
import type { DynamicStats } from "./dynamicArt";
import { blockLooks } from "./blocks";
import { windDirName, windLooks, windMix } from "./wind";
import type { WindStats } from "./windArt";
import type { PlatformStats } from "./platformArt";
import type { MushroomStats } from "./mushroomArt";
import type { StalactiteStats } from "./stalactiteArt";
import type { LaserStats } from "./laserArt";
import type { BridgeStats } from "./bridgeArt";
import type { PressStats } from "./pressArt";
import { laserBarLook, laserLook, pressLook } from "./announce";
import { bridgeTileLooks } from "./bridge";
import { JumpSession, decompteDigit, formatTicks, readyTicks, type SessionEvent } from "./session";
import { wantsTouch } from "./touch";
import { mountTouchUi, type TouchUi } from "./touchUi";
import { loadCameraTune, loadTuned, mountTunePanel } from "./tune";
import { archiveHref, dailyHref, homeHref, moduleHref, readUrlOptions, watchFirstHref, type Scenario } from "./urlOptions";
import { FIRST_GHOST_COLOR, OWN_GHOST_COLOR, checkFirstGhost, firstGhostLabel, showFirstGhost, type FirstGhost } from "./firstGhost";
import { browserFrozen, loadDaily, progressMessage, yieldToPaint, type DailyLoad } from "./dailyLoader";
import { browserWorker } from "./workerNavigateur";
import { chooseDay, dayLine, finishMedalText, isPreview, originLine, medalWord, newDayText, nextMedal, refusedText, shortDate, type DayChoice } from "./dailyInfo";
import { FROZEN_DAYS } from "./frozen";
import { History, mayRecord, type DayRecord } from "./history";
import { archiveDays, archiveRow, archiveStreakText, arrivalLine, countdownText, etatDuJour, helpSeen, homeHeading, homeStatus, markHelpSeen, medalText, recordTile, streakText, wantsHome } from "./homeLogic";
import { mountHome, type Home, type HomeView } from "./home";
import { mountArrival, type ArrivalView } from "./arrival";
import { mountResult, resultGap, type ResultView } from "./resultat";
import { definirJour } from "./cadre";
import { mountHowto } from "./howtoUi";
import { mountSettings } from "./settingsUi";
import { mountArchives, mountBoard, type BoardView } from "./screensUi";
import { profilHref } from "./profilLien";
import { boutonPleinEcran, el, icone, majPleinEcran, svg } from "@cdj/ui";
import { chargerLangue, demarrerLangue, fNumero, fTicks, lier, nomTheme, onLangue, repliqueTheme, t } from "./i18n";
import { shareText } from "./share";
import { sendShare } from "./clipboard";
import { CarnageGovernor } from "./carnageGovernor";
import { CarnageFilter, EventLog, causeName, eventsBetween, type GameEvent } from "./events";
import { JumpAudio, type AudioDebug } from "./audio";
import { AMBIENCES, beltMix, sawMix } from "./audioLogic";
import { beltRuns } from "./surfaceArt";
import { textSeed } from "./decor";
import { NAME_KEY, ProfileSync, appliquerGeneration, createIdentity, generationDeReponse, readIdentity, readPlayerId, type KeyValueStore } from "@cdj/profile";
import { applyJumpProfile, followJumpIdentity, jumpStats, type JumpMe, type JumpMergeResult } from "./jumpProfile";
import { lireSuite, type Suite } from "@cdj/profile";
import { HttpRankSource, rankApiBase, type JumpBoard, type RankSource } from "./rankApi";
import { ARRIVAL_REFRESH_MS, DayReads, type DayBundle, type LoadOptions } from "./dayReads";
import { RankQueue } from "./rankQueue";
import { LIVES_EVERY_MS, LivesQueue, type LifeCandidate } from "./livesQueue";
import { LivesSender } from "./livesSender";
import { OTHERS_MAX_TILES, keepoutDistance as keepoutDistanceOf, keepoutOf, othersStains, type Keepout } from "./othersStains";
import { everyoneLabel, everyoneLives, everyonePlan, type EveryoneLives } from "./everyone";
import type { DeathMapData } from "./rankApi";
import { Ranking, mayRank } from "./ranking";
import { arrivalRankView, classesText, homeRankText, rowsOf } from "./rankView";
import { DEMO_TODAY, DemoRankSource } from "./demoRank";
import { BUILD_API_URL, BUILD_RESTRICTED, demoStorage } from "./storage";
import { BELT_EVERY, Blink, ParticleMesh, Particles, SLIDE_EVERY, Trail, Vibrator, beltSpark, feelColors, feelEvent, slideSpark } from "./feel";
import { feelLevels, loadSettings, saveSettings, type FeelLevels, type PlayerSettings } from "./settings";
import { mountPauseMenu, type PauseView } from "./pauseMenu";

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

/** Lot 20 : `__jump.platforms` — ce que le dessin a posé (position, vitesse et sens du chevron, opacité) et l'état des plateformes dans la simulation. */
export interface PlatformsDebug extends Partial<PlatformStats> {
  count: number;
  /** Par plateforme : où elle est dans la simulation (coin haut-gauche, unités), la phase de sa section, laquelle porte le personnage (−1 : aucune). */
  sim: { x: number; y: number }[];
  phases: number[];
  ride: number;
}

/** Lot 22 : `__jump.presses` — ce que le dessin a posé (position, annonce, empreinte, poussières, opacité) et l'état des presses dans la simulation. */
export interface PressesDebug extends Partial<PressStats> {
  count: number;
  /** Par presse : le rectangle mortel dans la simulation (unités), la phase de sa section et l'annonce de la simulation (0 à 1). */
  sim: { x: number; y: number; w: number; h: number }[];
  phases: number[];
  warn: number[];
}

/**
 * Lot 23 : `__jump.mushrooms` — ce que le dessin a posé (orientation, écrasement, dernier rebond renforcé) et ce que la simulation sait : la liste des champignons (position, orientation, zone de
 * contact en unités) et le dernier rebond lu dans l'événement `champignon`.
 */
export interface MushroomsDebug extends Partial<MushroomStats> {
  count: number;
  list: { col: number; row: number; dir: number; name: string; pad: { x: number; y: number; w: number; h: number } }[];
}

/**
 * Lot 25 : `__jump.lasers` — ce que le dessin a posé (rayon allumé, annonce, opacités, barres : position, vitesse, lueur) et ce que la simulation sait : les rayons fixes (boîte mortelle,
 * allumés ou non, annonce) et les barres (boîte mortelle) à l'état courant.
 */
export interface LasersDebug extends Partial<LaserStats> {
  /** Nombre de lasers fixes et de barres. */
  count: number;
  bars: number;
  /** Par laser fixe : sa boîte mortelle (unités), la phase de sa section, allumé ou non dans la simulation, et l'annonce de la simulation (0 à 1). */
  sim: { x: number; y: number; w: number; h: number }[];
  phases: number[];
  simOn: boolean[];
  simWarn: number[];
  /** Par barre : sa boîte mortelle à l'état courant (unités) et la phase de sa section. */
  simBars: { x: number; y: number; w: number; h: number }[];
  barPhases: number[];
  /** Par barre : sa vitesse dans la simulation, en part de sa pointe (0 à 1). */
  simBarSpeeds: number[];
}

/**
 * Lot 26 : `__jump.bridges` — ce que le dessin a posé (tuiles pleines, pointillées, jauges, plaques d'interrupteur, opacité) et ce que la simulation sait : l'âge de chaque pont (0 éteint,
 * sinon les pas depuis son allumage), la tuile de chaque rang (`simSolid`) et la jauge de la simulation (`simFills`, 0 à 1).
 */
export interface BridgesDebug extends Partial<BridgeStats> {
  /** Nombre de ponts. */
  count: number;
  /** Par pont : son interrupteur (col, rangée), son délai (pas), le nombre de ses tuiles. */
  list: { id: string; switchCol: number; switchRow: number; delay: number; tiles: number }[];
  /** Par pont : l'âge dans la simulation (`AttemptState.bridges`). */
  ages: number[];
  /** Par tuile (ordre des ponts puis de leurs tuiles) : pleine dans la simulation ? et la jauge qu'elle impose (0 vide … 1 pleine). */
  simSolid: boolean[];
  simFills: number[];
}

/**
 * Lot 24 : `__jump.stalactites` — ce que le dessin a posé (âge dessiné, hauteur, balancement, gouttes, opacité) et ce que la simulation sait : la liste des stalactites (tuile du corps, zone
 * de déclenchement en colonnes) et leur état courant (`ages` : 0 intacte, âge > 0 déclenchée, −1 brisée).
 */
export interface StalactitesDebug extends Partial<StalactiteStats> {
  count: number;
  list: { id: string; col: number; row: number; before: number; after: number; zone: [number, number] }[];
  ages: number[];
}

export interface JumpDebug {
  /**
   * Lot P0 (plateforme) : l'identité commune lue dans ce navigateur (clés `cdj:*` de la plateforme, même stockage et même préfixe que
   * DailyTrack), sans rien créer ni afficher : existe-t-elle, et quel est son pseudo.
   */
  readonly profile: { exists: boolean; name: string | null };
  /** Lot 12 : les blocs clignotants et alternés (null : le niveau n'en a pas). */
  readonly blocks: BlocksDebug | null;
  /** Lot 20 : les plateformes mobiles (null : le niveau n'en a pas) : où elles sont dans la simulation et ce qui est dessiné (position, vitesse et sens du chevron, opacité). */
  readonly platforms: PlatformsDebug | null;
  /** Lot 22 : les presses (null : le niveau n'en a pas). */
  readonly presses: PressesDebug | null;
  /** Lot 23 : les champignons (null : le niveau n'en a pas). */
  readonly mushrooms: MushroomsDebug | null;
  /** Lot 24 : les stalactites (null : le niveau n'en a pas). */
  readonly stalactites: StalactitesDebug | null;
  /** Lot 25 : les lasers (null : le niveau n'en a pas). */
  readonly lasers: LasersDebug | null;
  /** Lot 26 : les ponts à interrupteur (null : le niveau n'en a pas). */
  readonly bridges: BridgesDebug | null;
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
  /** Lot 27 : la touche R (reprise au dernier point de passage, sinon recommencer à zéro). */
  respawn(): void;
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
    /** Lot P4 : impose un palier au carnage de tout le monde (0 : complet … 4 : 60 vies, sans particules) ; `null` : l'appareil décide. */
    govern(level: number | null): void;
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
  /** Lot P4 : les lectures du jour (requêtes parties, lectures regroupées, lectures servies sans réseau, repli sur les routes séparées, jours lus). */
  readonly reads: unknown;
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
  /** Lot I5 (captures) : pose la suite de la journée sur l'écran d'arrivée sans serveur (« Jeu suivant du jour », « Journée parfaite ! »). */
  showSuite(suite: Suite | null): void;
  /** Lot 10 (tests) : joue une rediffusion (par défaut la preuve de l'auteur) comme les commandes du joueur ; rend son nombre de pas. */
  autoplay(code?: string): number;
  /** Lot 15 : donne le départ tout de suite (fin du « Prêt… » d'un niveau à une seule horloge). */
  go(): void;
  /** Lot 15 : pas du « Prêt… » qui restent, sa durée, la version de la simulation du niveau. */
  readonly pret: { ticks: number; total: number; level: number };
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
  code?: string | undefined;
  /** Lot 16 : les voies lentes (morceau contourné, zone, temps rapide et lent en pas) et le temps « toutes voies lentes ». */
  slowRoutes: { piece: number; zone: number; entryRow: number; galleryRow: number; fastTicks: number; slowTicks: number; code: string }[];
  slowTicks: number;
  /** Médaille de la dernière arrivée (null : aucune, ou pas encore d'arrivée). */
  lastMedal: string | null;
  /** Passage de minuit : un nouveau niveau attend la prochaine commande « recommencer ». */
  newDay: boolean;
  /** Message discret affiché (date refusée, nouveau niveau), "" sinon. */
  notice: string;
  /** Lot 7b : d'où vient le niveau (`fige`, `cache`, `worker`, `principal`), s'il a été généré pendant ce chargement, lot 21 : où le catalogue et le générateur ont été chargés (`non`, `worker`, `principal`), pourquoi le cache a été refusé, durée du chargement et temps de fil principal (ms). */
  load: { source: string; generated: boolean; catalog: string; cacheMiss: string; frozenMiss: string; totalMs: number; blockedMs: number };
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
  /** Lot P4 : le carnage de tout le monde s'adapte à l'appareil (palier, vies montrées au plus, part des particules, fenêtres mesurées). */
  governor?: { level: number; maxLives: number; particles: number; windows: { work: number; interval: number; level: number }[] } | null;
}

declare global {
  interface Window {
    __jump?: JumpDebug;
  }
}

const options = readUrlOptions(location.search, BUILD_RESTRICTED);
// Lot I5 : la langue de la plateforme (`cdj:langue`) : l'anglais se charge avant le premier écran (un fichier à part), puis le titre, `<html lang>` et les textes du HTML.
await chargerLangue();
demarrerLangue();
/** Tactile (lot 1b) : `?touch=1` le force, `?touch=0` le coupe, sinon l'appareil décide (pointeur grossier). Lu tôt : « Comment jouer » montre le schéma qui convient. */
const touchOn = wantsTouch(options.touch, window.matchMedia?.("(pointer: coarse)").matches ?? false);
const LEVELS: Record<Scenario, Level> = { essai: ESSAI_LEVEL, dangers: DANGERS_LEVEL, "bac-a-sable": SANDBOX_LEVEL, vent: VENT_LEVEL };
// Lot P1 (plateforme) : le classement du jour. Adresse du serveur : `?api=` (essais ; `demo` : la démonstration), sinon `VITE_API_URL` de la
// construction (production pour `main`, recette pour un aperçu), sinon aucune : pas de classement, le jeu marche comme avant.
const apiBase = rankApiBase(options.api, BUILD_API_URL, location.origin, BUILD_RESTRICTED);
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
// Lot P4 (plateforme) : un code chargé dans un autre jeu (DailyTrack) depuis la dernière visite : les rangs connus et les jours passés de
// l'ancienne identité sont oubliés, comme quand le code est chargé ici. Avant la file du classement et l'historique (ils lisent ces clés).
if (store && !demoRank) followJumpIdentity(store, new History(store).entries, formatDay(gameDay()));
/** L'identifiant de la plateforme de ce navigateur s'il existe (jamais créé ici). */
const ownId = (): string | null => {
  try {
    return store ? readPlayerId(store) : null;
  } catch {
    return null;
  }
};
const rankSource: RankSource | null = apiBase === null ? null : demoRank ? new DemoRankSource(new URL("demo/", document.baseURI).href, store) : new HttpRankSource(apiBase);
// Lot P4 (plateforme) : les lectures du jour regroupées (classement, fantôme du premier, carte des morts ; le profil au chargement) en une
// requête, jamais deux fois en moins de 30 s (`dayReads.ts`).
const reads = new DayReads({ source: rankSource, now: () => Date.now() });
// Lot R8 : la lecture regroupée dit la génération de données du serveur ; une plus récente que celle de ce navigateur (remise à zéro du lancement) :
// ses données de jeu sont effacées (ses réglages gardés) et la page recharge, en joueur neuf (le message le dit une fois, sur l'accueil).
reads.onLoad((b) => {
  if (store && appliquerGeneration(store, generationDeReponse(b)) === "efface") location.reload();
});
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
/** Lot P4 : la prochaine lecture du profil doit-elle ignorer la lecture du jour gardée (`syncProfile(true)`) ? */
let profileForce = false;
const jumpSync = new ProfileSync<JumpSyncResult, KeyValueStore, JumpMe>({
  api: () => {
    const src = rankSource;
    if (!src || demoRank || !src.jumpMe || !ownId()) return null;
    // Lot P4 : le profil vient de la lecture regroupée du jour (celle du chargement s'il a moins de 30 s).
    return {
      me: (id: string) => {
        const force = profileForce;
        profileForce = false;
        return reads.profile(formatDay(gameDay()), id, { force });
      },
    };
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
  // Lot P2 : un envoi accepté : le premier est revu (c'est peut-être toi maintenant). Lot P4 : sans relecture — le classement est dans la
  // réponse de l'envoi, l'historique local a déjà cet essai (le profil n'est plus relu après un envoi) ; le fantôme du premier n'est relu que
  // si le premier de ce classement n'est plus celui qu'on a (un autre est passé devant).
  onAccepted: (result) => {
    if (jumpSync.state.status !== "ok") void syncProfile(true); // un joueur que le serveur ne connaissait pas : son profil, avec le jour (une lecture)
    else if (firstStale(result.board)) void refreshDay({ force: true });
    else {
      if (result.board?.me?.rank === 1) noteOwnFirst(result.board.me.name, result.board.me.ticks);
      if (dayReady) showFirst();
    }
    // Lot P3 : le joueur existe maintenant sur le serveur : ses vies en attente partent.
    livesSender.wake();
    // Lot I3 : l'envoi est accepté : la suite de la journée (une lecture de `GET /api/portail/jour`).
    void loadSuite(true);
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
/** L'accueil existe sur la page du niveau du jour (hors lecture) ; il s'ouvre au chargement si `wantsHome`, sinon par la pause ou l'arrivée. */
const homeHere = choice !== null && choice.mode === "jour" && trialTheme === null && !options.solution && !options.watchBest && !options.watchFirst && !options.carnageDemo;
const homeAtStart = homeHere && wantsHome(options);
const homeTheme = themeByName(options.theme) ?? themeForDay(today);
/** Vrai une fois le jeu entièrement prêt : avant, ouvrir ou fermer une fenêtre de l'accueil ne touche pas encore à la pause. */
let gameReady = false;
/**
 * Lot I5 : ce que l'accueil lit de la partie, rempli au fil du chargement (l'accueil s'ouvre avant que le niveau soit là) : les médailles du jour, le total des
 * morts de tout le monde (carte des morts du serveur), et si le carnage du jour peut se jouer (ton meilleur essai, la scène).
 */
const accueilDonnees = { medals: null as DailyLevel["medals"] | null, morts: null as number | null, carnage: false };
/** Lot I5 : le profil commun du portail (`/profil/?retour=/jump/`) : plus de profil dans le jeu. */
const profil = profilHref(location.pathname);
// Lot I5 : la barre des jeux (date et numéro du niveau) ; le numéro du niveau du jour se calcule sans le niveau (`levelNumber`).
definirJour(today, levelNumber(today));
const syncIfReady = () => {
  if (gameReady) syncPause();
};
// Lot I5 : « Comment jouer » dans le jeu (posé sur la scène, sous le voile à rayures), une seule fois au premier lancement ; puis par la pause et l'accueil.
const howto = mountHowto(touchOn ? "touch" : "keys", { onChange: syncIfReady });
// Lot I5 : les archives et le classement du jour du jeu, deux écrans du cadre crème ouverts depuis l'accueil (« ‹ JUMP » les ferme).
const archivesUi = mountArchives({ href: (date) => archiveHref(date, options), onToggle: () => (syncIfReady(), home?.focus()) });
const boardUi = mountBoard({ onToggle: () => (syncIfReady(), home?.focus()) });
const home: Home | null = homeHere
  ? mountHome({
      onPlay: () => playFromHome(),
      onSettings: () => settingsUi.open(),
      onHelp: () => howto.open(() => home?.focus()),
      onArchives: () => archivesUi.open(() => archiveDays(gameDay()).map((d) => archiveRow(d, themeForDay(d).name, history.forDate(formatDay(d))))),
      onBoard: () => openBoard(),
      onCarnage: () => carnageFromHome(),
      profilHref: profil,
      store,
      onChange: syncIfReady,
    })
  : null;
if (home && homeAtStart) {
  home.open(homeView());
  if (options.archives) home.update(homeView()), archivesUi.open(() => archiveDays(gameDay()).map((d) => archiveRow(d, themeForDay(d).name, history.forDate(formatDay(d)))));
  else if (!helpSeen(store)) {
    // « Comment jouer » s'ouvre de lui-même à la toute première visite (puis depuis la pause et l'accueil), dans le jeu, par-dessus l'accueil posé sur la scène.
    howto.open(() => home?.focus());
    markHelpSeen(store);
  }
}

/** Ce que montre l'accueil : le niveau d'aujourd'hui, ton record et ta série (historique), le carnage et le classement du jour, le compte à rebours. */
function homeView(): HomeView {
  const now = Date.now();
  const heading = homeHeading(today, homeTheme.name);
  const rec = history.forDate(formatDay(today));
  const status = homeStatus(rec);
  const st = jumpStats(history.entries, gameDay());
  const medals = st.medals.author + st.medals.gold + st.medals.silver + st.medals.bronze;
  // Lot P1 : ton rang du jour (un temps classé aujourd'hui), les cinq premiers du classement lu.
  const rank = homeRankText(ranking.enabled, ranking.known(formatDay(today)));
  const b = ranking.enabled ? (ranking.boards.get(formatDay(today))?.board ?? null) : null;
  return {
    ...heading,
    replique: repliqueTheme(homeTheme.name),
    record: recordTile(rec?.best ?? null, accueilDonnees.medals),
    serie: { valeur: streakText(history.streak(gameDay(now))), sous: t("accueil.serie.medailles", { n: medals }) },
    etat: etatDuJour(rec),
    status: status.text,
    finished: status.finished,
    countdown: countdownText(now),
    rank,
    carnage: accueilDonnees.morts === null ? null : { morts: accueilDonnees.morts, peut: accueilDonnees.carnage },
    board: ranking.enabled ? { rows: rowsOf(b).rows, participants: b?.participants ?? 0 } : null,
    revoked: jumpSync.state.status === "revoked",
  };
}

/** Lot P2 : synchronise le profil (au plus une fois par 30 s, sauf `force`) ; l'accueil et l'arrivée suivent. Ne bloque jamais. */
async function syncProfile(force = false): Promise<void> {
  if (force) profileForce = true;
  const r = await jumpSync.run({ force });
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
      showProgress: homeAtStart ? undefined : progressMessage(document, t("page.preparation")),
      yieldToPaint,
      frozen: { days: FROZEN_DAYS, read: browserFrozen },
      theme: trialTheme,
    })
  : null;
const daily: PublicDailyLevel | null = loaded ? loaded.level : null;
accueilDonnees.medals = daily?.medals ?? null;
// Lot 4 : un morceau du catalogue (`?module=<id>&variante=<n>&entree=arret|elan[&solution]`). En jeu humain avec l'entrée en élan, un
// couloir de lancement est ajouté devant le palier d'entrée ; la solution, elle, part lancée du départ du morceau (sans couloir).
const mod = options.module;
// Lot 21 : le catalogue des morceaux n'est chargé que pour jouer un morceau (`?module=`), pas pour le niveau du jour ni un scénario.
const modApi = mod ? await import("./modulesInfo") : null;
// Lot 21 : les joueurs fictifs du carnage de démonstration d'un jour (qui reprennent bien après une mort) demandent le catalogue : chargés à la demande, avec `?carnage=demo` seulement.
const demoApi = options.carnageDemo && choice ? await import("./demoFictifs") : null;
const built = mod && modApi ? modApi.buildModule(mod.id, mod.variant, { lancement: mod.entry === "elan" && !mod.solution ? modApi.LAUNCH_TILES : 0 }) : null;
const level = built ? built.level : daily ? daily.level : LEVELS[options.scenario ?? "essai"];
const reference = mod && modApi ? modApi.referenceTicks(mod.id, mod.variant, mod.entry, mod.entry === "elan" && !mod.solution) : null;
const nextId = mod && modApi ? modApi.nextModule(mod.id) : null;
const nextHref = mod && modApi && nextId ? moduleHref({ id: nextId, variant: 0, entry: mod.entry, theme: modApi.moduleTheme(nextId, 0) ?? undefined }, options) : null;

const dayText = formatDay(today);
// Lot 9 : le thème du jour, celui de la date du niveau (une archive garde le sien). Lot 11 : le thème est une donnée du générateur : un niveau du
// jour porte le sien (`daily.theme`, celui de la date ou le thème forcé d'un essai). Un morceau ou un scénario n'a pas de thème : `?theme=` leur en
// donne un (cosmétique, ils n'ont pas de mécanique de thème). La palette en vient.
const modTheme = mod && modApi ? modApi.moduleTheme(mod.id, mod.variant) : null;
// Lot 13 : la galerie des courants d'air (`?scenario=vent`) s'ouvre dans son thème (la forêt).
const theme = daily ? THEMES[daily.theme] : (themeByName(options.theme) ?? (modTheme ? THEMES[modTheme] : options.scenario === "vent" ? THEMES.foret : themeForDay(today)));
/** Lot 11 : essai (thème forcé) : rien n'est enregistré, comme avec des réglages modifiés. */
const isTrial = daily !== null && daily.forcedTheme;
const palette = theme.palette;

// Lot I5 : l'étiquette de version ne s'affiche plus qu'avec `?debug` (et en petit dans la pause) ; le titre de la page est « Jump — Du Jour » (i18n.ts).
const stamp = document.getElementById("stamp")!;
stamp.hidden = !options.debug;
const majStamp = () => (stamp.textContent = t("commun.versionDebug", { sim: JUMP_SIM_VERSION, jour: dayText }));
majStamp();
onLangue(majStamp);
if (mod && built) {
  const modname = document.getElementById("modname")!;
  const majModname = () => (modname.textContent = t(mod.solution ? "outil.module.solution" : "outil.module", { id: mod.id, variante: mod.variant, entree: t(mod.entry === "elan" ? "outil.entree.elan" : "outil.entree.arret") }));
  majModname();
  onLangue(majModname);
}
document.documentElement.style.background = `#${palette.background.toString(16).padStart(6, "0")}`;

// Réglages : les défauts, sauf en `?debug&tune` où le panneau reprend ceux qu'on avait laissés (`jump:tune`).
const params: JumpParams = options.tune ? loadTuned() : { ...DEFAULT_JUMP_PARAMS };
// Lot 15 : la durée du « Prêt… » (section Caméra de `?debug&tune`) vaut dès le premier départ.
if (options.tune) loadCameraTune();
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
let firstMiss = firstDate && rankSource ? "" : "aucun serveur";
/** Lot P3 : pourquoi la carte des morts n'est pas là (`__jump.othersStains`) ; déclaré ici : une lecture du jour peut arriver avant la scène. */
let othersMiss = firstDate && rankSource ? "" : "aucun serveur";
/** Lot P4 : vrai une fois le jeu monté (scène, taches, écran d'arrivée) : une lecture arrivée avant n'est appliquée qu'alors (`showDay`). */
let dayReady = false;
/**
 * Lot P4 : lit le jour (classement, fantôme du premier, carte des morts ; le profil du jour avec une identité) **en une requête**, sauf si la
 * dernière lecture suffit (moins de 30 s, ou `maxAgeMs`). Ne bloque jamais ; un échec réseau garde ce qu'on avait.
 */
async function refreshDay(o: LoadOptions = {}): Promise<void> {
  if (!firstDate || !reads.enabled) return;
  ranking.noteBoardLoading(firstDate);
  const r = await reads.load(firstDate, ownId(), o);
  if (r.ok) return; // appliquée par `onDay` (toute lecture réussie l'est)
  firstMiss = r.code;
  othersMiss = r.code;
  if (r.status !== 0) firstRemote = null;
  ranking.noteBoardFailed(firstDate, r.status === 0, r.code);
}
/** Une lecture du jour réussie (quelle qu'en soit la raison) : le premier (vérifié par le rejeu du jeu), le classement ; puis l'affichage. */
function onDay(b: DayBundle): void {
  if (b.date !== firstDate) return;
  if (!b.ghost) {
    firstMiss = "no_ghost";
    firstRemote = null;
  } else {
    const c = checkFirstGhost(b.ghost, level, levelId);
    firstMiss = c.ok ? "" : c.reason;
    firstRemote = c.ok ? c.ghost : null;
  }
  ranking.noteBoard(b.date, b.board);
  if (dayReady) showDay(b);
}
reads.onLoad(onDay);
/** Lot P4 : le serveur dit que tu es premier (réponse de ton envoi) : le premier, c'est ton meilleur essai (sans relire le fantôme). */
function noteOwnFirst(name: string, ticks: number): void {
  const best = memory.best;
  const replay = memory.bestReplay();
  if (!best || !replay || best.time !== ticks) return;
  firstRemote = { name, replay, code: best.code, ticks: best.time, deaths: best.deaths, mine: true };
  firstMiss = "";
}
/** Le premier d'un classement (réponse d'un envoi) n'est plus celui qu'on a : à relire. Toi premier : ton fantôme suffit. */
function firstStale(board: JumpBoard | undefined): boolean {
  if (!firstDate) return false;
  if (!board) return true; // serveur d'avant le lot P4 : relire, comme avant
  const top = board.top[0];
  if (!top || board.me?.rank === 1) return false;
  return !firstRemote || firstRemote.name !== top.name || firstRemote.ticks !== top.ticks;
}
if (options.watchFirst) await refreshDay();
// `?watch=best` : lecture du meilleur essai, sans jouer (rien n'est enregistré). Sans meilleur essai : partie normale et un message.
// `?module=…&solution` : lecture de la solution stockée du morceau (rejouée par la même simulation).
// `&solution` sur le niveau du jour (lot 5) : la rediffusion de l'auteur, la preuve du niveau.
// `?watch=first` (lot P2) : l'essai du premier du classement de ce jour.
const watchReplay = mod?.solution && modApi
  ? modApi.solutionReplay(mod.id, mod.variant, mod.entry)
  : daily && options.solution
    ? (daily.replay ?? null) // lot R9 : `options.solution` est fermé en production, et le fichier publié n'a plus la preuve
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
  // i18n-ok: étiquettes de débogage (`?debug`) dessinées sur le niveau : outil interne, pas un texte d'interface
  // Lot 15 : à une seule horloge, la phase de la section et sa période (pas), calculées sur la référence.
  const clockLabel = (k: number) => (singleClock(level) && sectionPeriod(level, k) > 0 ? ` · phase ${level.sections[k]!.phase} / ${sectionPeriod(level, k)}` : "");
  const pieces = options.pieces && daily ? daily.pieces.map((p, k) => ({ col0: p.col0, col1: p.col1, row: p.entryRow, label: `${p.id} v${p.variant} · ${"●".repeat(p.exigence)}${"○".repeat(5 - p.exigence)} ${p.exigence}/5${clockLabel(k)}` })) : undefined; // i18n-ok: outil ?debug (limites des morceaux et horloge)
  // Lot 16 : le repère d'entrée des voies lentes (toujours) ; avec `?debug`, leurs deux trajets et leurs temps.
  const slowRoutes = daily ? daily.slowRoutes : undefined;
  const slowDebug = options.pieces && daily && daily.replay ? slowDebugPaths({ level: daily.level, replay: daily.replay, slowRoutes: daily.slowRoutes, pieces: daily.pieces }) : undefined; // lot R9 : sans preuve (fichier publié), pas de trajets de débogage
  scene = createScene(document.body, level, theme, { hitbox: options.hitbox, burst, pieces, levelId, detail: sceneDetail(levels), slowRoutes, slowDebug });
  scene.animate = levels.animate;
  scene.windParticles = levels.particles;
} catch {
  scene = null;
}
const particleMesh = scene ? new ParticleMesh(particles, scene.world) : null;

// ——— Lot 3 : fantôme, taches ———
let ghostOn = !options.ghostOff && loadGhostSetting(store);
let ghost: Ghost | null = null;
/** Lot I5 : le record du jour (pas) et ses temps de passage : l'écart signé de la bande du HUD s'y compare. */
let recordTime: number | null = null;
let recordSplits: (number | undefined)[] = [];
/** Vrai une fois le HUD monté (plus bas) : le fantôme se calcule avant lui. */
let hudReady = false;
const refreshGhost = () => {
  const best = memory.bestReplay();
  try {
    ghost = best && !watching ? new Ghost(level, best) : null;
  } catch {
    ghost = null;
  }
  recordTime = memory.best?.time ?? null;
  try {
    recordSplits = best ? checkpointTimes(level, best) : [];
  } catch {
    recordSplits = [];
  }
  accueilDonnees.carnage = memory.best !== null && scene !== null;
  if (hudReady) hud.setObjective(objective());
};
/** Lot I5 : l'objectif de la bande de droite : la prochaine médaille à viser d'après ton record du jour, ou « auteur battu » ; rien hors du niveau du jour. */
function objective(): Objective {
  if (!daily) return null;
  const next = nextMedal(memory.best?.time ?? null, daily.medals);
  return next ?? "battu";
}
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
        firstLabelName = f.name;
      } catch {
        firstGhost = null;
      }
    }
  } else if (firstGhost) {
    firstGhost = null;
    firstGhostMesh?.setLabel(null, FIRST_GHOST_COLOR);
  }
}
/** Lot I5 : l'étiquette du fantôme du premier (« Nom · 1er ») suit la langue. */
let firstLabelName: string | null = null;
onLangue(() => {
  if (firstGhost && firstLabelName) firstGhostMesh?.setLabel(firstGhostLabel(firstLabelName), FIRST_GHOST_COLOR);
});
/** Lot P2 : le fantôme du premier tel qu'on le connaît (dans le niveau, et « Regarder le premier » à l'arrivée). Lot P4 : sans requête. */
function showFirst(): void {
  if (!firstDate) return;
  refreshFirstGhost();
  if (arrival.shown) arrival.setFirst(firstRemote && !watching && showFirstGhost(firstRemote, memory.best ? { ticks: memory.best.time, code: memory.best.code } : null) ? firstRemote.name : null);
}
/** Lot P4 : ce qu'une lecture du jour change à l'écran : le fantôme du premier, les taches de tout le monde. */
function showDay(b: DayBundle): void {
  showFirst();
  const other = b.deaths.levelId !== null && b.deaths.levelId !== levelId;
  othersMiss = other ? "autre niveau" : "";
  othersMap = other ? null : b.deaths;
  drawOthers();
  // Lot I5 : l'accueil montre le carnage du jour (les morts de tout le monde) et les cinq premiers du classement.
  accueilDonnees.morts = othersMap && othersMap.levelId !== null ? othersMap.deaths : null;
  if (home?.isOpen) home.update(homeView());
}
const stains = scene ? new StainLayer(scene.world, palette.player, palette.tile) : null;
const storedStains = () => memory.deaths.map((d) => stainFor(level, d.x, d.y));
stains?.reset(storedStains());
// ——— Lot P3 (plateforme) : les taches de tout le monde — la carte des morts du jour (serveur ou démonstration), plus pâles et plus petites que
// les tiennes, une seconde couche du même système, dessinée dessous ; jamais sur un danger ni un fanion (`othersStains.ts`). Chargée avec le
// niveau, rafraîchie à l'arrivée ; une archive montre la carte figée de son jour. Réglage « Taches de tout le monde » (menu ⏸, mémorisé).
const othersLayer = scene ? new StainLayer(scene.world, palette.player, palette.tile, { capacity: OTHERS_MAX_TILES, z: 0.005 }) : null;
let othersMap: DeathMapData | null = null;
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

const T = UNITS_PER_TILE;
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
  /** Lot P4 : le carnage de tout le monde s'allège sur un appareil lent (vies montrées, particules) ; `null` : le tien, jamais allégé. */
  governor: CarnageGovernor | null;
  /** Lot I5 : de quoi rejouer le carnage depuis une vague (le héros et les autres vies), les pas où commence chaque vague, la lecture en pause. */
  hero: JumpReplay;
  others: JumpReplay[];
  starts: number[];
  paused: boolean;
  /** Lot I5 : lancé depuis l'accueil (« Voir le carnage ») : on y revient à la fin. */
  fromHome: boolean;
}
let carnage: CarnageRun | null = null;
/** Lot P4 (`__jump.carnage.govern(palier)`, mesure et tests) : le palier imposé aux carnages de tout le monde, ou `null` (l'appareil décide). */
let forcedGovernorLevel: number | null = null;
/** Lot P4 : le gouverneur décide (ou le palier imposé) : vies montrées au plus. Le compteur garde le vrai total. */
function applyGovernor(c: CarnageRun): void {
  if (c.governor) c.run.limit = c.governor.maxLives;
}
/** Lot P4 : les réglages d'effets du carnage allégé (particules réduites), gardés tant que ni les réglages ni la part ne changent. */
let governed: { from: FeelLevels; part: number; levels: FeelLevels } | null = null;
function governedLevels(part: number): FeelLevels {
  if (!governed || governed.from !== levels || governed.part !== part) governed = { from: levels, part, levels: { ...levels, particles: levels.particles * part } };
  return governed.levels;
}
/** Lot 10 : le dernier carnage joué (héros et autres vies), pour « Revoir le carnage ». */
let lastCarnage: { hero: JumpReplay; others: JumpReplay[] } | null = null;
let carnageBurst: { pool: BurstPool; mesh: BurstMesh } | null = null;
/** Zoom arrière du carnage : on voit plus large autour du héros. */
const CARNAGE_ZOOM = 1.3;

function startCarnage(hero: JumpReplay, others: JumpReplay[], demo: boolean, bits = 0, everyone: string | null = null, fromHome = false, result: ResultView | null = null): boolean {
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
  // Lot P4 : seul le carnage de tout le monde (≈ 150 vies d'autres joueurs) s'adapte à l'appareil ; le tien reste tel quel.
  carnage = {
    run,
    crowd,
    demo,
    prevBits: bits,
    everyone,
    governor: everyone !== null ? new CarnageGovernor({ locked: forcedGovernorLevel }) : null,
    hero,
    others,
    starts: waveStarts(run.lives.map((l) => l.depart)),
    paused: false,
    fromHome,
  };
  applyGovernor(carnage);
  // Lot 10 : « Revoir le carnage » (écran d'arrivée) le relance tel quel (le tien, pas celui de tout le monde).
  if (!demo && everyone === null) lastCarnage = { hero, others };
  arrival.hide();
  // Lot 27 : le résultat reste affiché pendant la rediffusion et le carnage (celui de ton essai, pas la démonstration ni le carnage de tout le monde).
  if (result && !demo && everyone === null && !fromHome) {
    resultat.show(result);
    resultat.setSuite(suiteDuJour);
    refreshRank();
    void loadSuite();
  } else resultat.hide();
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
  showCarnageBar(carnage);
  return true;
}

/** Lot I5 : la barre du carnage (titre en autocollant, compteur, « Vague 3 / 12 », lecture ou pause). */
function showCarnageBar(c: CarnageRun): void {
  hud.carnage({ label: c.everyone ?? carnageLabel(c.run.total, c.run.arrivals), wave: waveAt(c.starts, c.run.tick), paused: c.paused });
}

/**
 * Lot I5 : la barre de lecture du carnage. Aller à une vague = rejouer le carnage **sans rendu ni son** jusqu'au pas où elle commence (chaque vie dans sa
 * simulation, comme d'habitude : le même carnage, rien d'inventé) ; vers l'arrière, on repart du départ. Les taches suivent les morts rejouées.
 */
function seekCarnage(target: number): void {
  const c = carnage;
  if (!c || !scene) return;
  if (target < c.run.tick) {
    let run: Carnage;
    try {
      run = new Carnage(level, c.hero, c.others);
    } catch {
      return;
    }
    c.run = run;
    applyGovernor(c);
    stains?.reset([]);
    carnageBurst?.pool.clear();
  }
  while (c.run.tick < target && !c.run.done) for (const e of c.run.step()) if (e.kind === "death") stains?.add(stainFor(level, e.x, e.y));
  carnageFilter.reset();
  heroLook = restLook();
  camera = snapCamera(follow(c.run.hero.state.player), scene.frame);
  stepper.reset();
  showCarnageBar(c);
  if (c.run.done) endCarnage();
}
function carnageWave(delta: -1 | 1): void {
  const c = carnage;
  if (!c) return;
  const { current } = waveAt(c.starts, c.run.tick);
  // Précédente : le début de la vague en cours si elle a commencé depuis plus d'une seconde, sinon celui de la vague d'avant.
  const index = delta > 0 ? current : c.run.tick - (c.starts[current - 1] ?? 0) > TICK_RATE ? current - 1 : current - 2;
  if (delta > 0 && current >= c.starts.length) {
    c.run.stop();
    endCarnage();
    return;
  }
  seekCarnage(c.starts[Math.max(0, index)] ?? 0);
}

function endCarnage(): void {
  const c = carnage;
  if (!c || !scene) return;
  carnage = null;
  resultat.hide();
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
    hud.toast(t("toast.finDemo"));
  } else if (c.fromHome) {
    phase = phaseOf(session.state);
    camera = snapCamera(follow(session.state.player), scene.frame);
    goHome();
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
  // Lot I5 : la lecture en pause (barre du carnage) : rien n'avance.
  if (c.paused) return;
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
  showCarnageBar(c);
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
  const part = carnage?.governor?.particles ?? 1;
  for (const e of events) {
    eventLog.push(e);
    const out = feelEvent(e, particles, colors, part < 1 && e.source !== "jeu" ? governedLevels(part) : levels);
    if (out.shake > 0) shake.start(out.shake, out.shakeDuration);
    if (out.vibrate !== null && !watching) vibrator.play(out.vibrate, performance.now());
    // Lot P4 : le carnage de tout le monde allégé (gouverneur) a moins de particules, ou aucune.
    const amount = e.source === "jeu" ? levels.particles : levels.particles * part;
    if (e.kind === "mort" && amount > 0) {
      // Éclatement à la couleur du personnage : celui de la partie, ou le pool du carnage (héros et autres vies).
      if (e.source === "jeu") burst.burst(e.x, -e.y, Math.max(1, Math.round(28 * amount)));
      else if (carnageBurst) carnageBurst.pool.burst(e.x, -e.y, Math.max(1, Math.round((e.source === "heros" ? 20 : 8) * amount)));
    }
    if (e.source !== "vie") {
      if (e.kind === "glisseDebut") slideSide = e.side;
      else if (e.kind === "glisseFin" || e.kind === "mort" || e.kind === "reapparition" || e.kind === "arrivee") slideSide = 0;
      if (e.kind === "reapparition") trail.clear();
    }
    // Lot 23 : un champignon rebondit : il s'écrase (les autres vies du carnage ne passent pas ici : seuls la mort et l'arrivée de ces vies sont gardées).
    if (e.kind === "champignon" && e.source !== "vie") scene?.bounceMushroom(e.index, e.boost);
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

/**
 * Lot 17 : le carnage de démonstration du niveau du jour (`?carnage=demo` sur un jour, par exemple `?seed=…&carnage=demo`) : la preuve de l'auteur en
 * héros, les vies des essais fictifs (les joueurs de la démonstration) ; rien n'est gardé ni envoyé. De quoi voir un carnage sans finir le niveau.
 */
function dayDemoLives(d: DailyLevel): JumpReplay[] {
  // Lot 21 : avec `?carnage=demo`, les joueurs fictifs qui reprennent bien (`demoFictifs.ts`) ; appelé autrement (`__jump.carnage.demo()`), les essais d'avant.
  if (demoApi) return demoApi.dayDemoLives(d);
  const lives: JumpReplay[] = [];
  for (const a of demoAttempts(d.level, d.replay, 0xa11, { attempts: 14 })) for (const life of replayAttempt(d.level, a.replay, d.id).lives) lives.push(lifeReplay(a.replay, life));
  return lives;
}

function startDemo(max = 0, crowd = false): boolean {
  if (daily && level === daily.level) {
    // Lot R9 : la démonstration d'un jour a besoin de la preuve de l'auteur (héros) : un niveau lu dans un fichier publié sans elle n'en a pas.
    if (!daily.replay || !daily.code) return false;
    const withProof = daily as DailyLevel;
    return startCarnage(withProof.replay, dayDemoLives(withProof), true, lastBits);
  }
  if (level !== ESSAI_LEVEL) {
    hud.toast(t("toast.demoEssai"));
    return false;
  }
  const solution = decodeReplay(ESSAI_SOLUTION_CODE);
  return startCarnage(solution, crowd ? new Array(max).fill(solution) : demoLives(max), true, lastBits);
}

function onEvent(e: SessionEvent): void {
  if (e.kind === "death") {
    // Éclats et tremblement : par les événements de jeu (`dispatch`, lot 8). Tache de la journée (pas en lecture, pas avec des réglages modifiés).
    if (!watching && memory.recordDeath({ x: e.x, y: e.y, cause: e.cause }, session.tuned || isTrial)) stains?.add(stainFor(level, e.x, e.y));
  } else if (e.kind === "checkpoint") {
    hud.toast(t("toast.pointDePassage"));
    // Lot I5 : l'écart signé au record, à ce point de passage (le temps du meilleur essai du jour au même point).
    const ref = recordSplits[e.index];
    hud.setProgress(e.index, level.checkpoints.length, ref === undefined || watching ? null : session.state.time - ref);
  } else if (e.kind === "respawn" || e.kind === "resume") {
    // Lot 27 : « respawn » sans point = un nouvel essai à zéro (v11 : la mort avant le premier point), « resume » = la reprise volontaire au dernier point (le chrono continue).
    if (e.kind === "respawn" && !e.checkpoint) hud.setProgress(-1, level.checkpoints.length, null);
    look = restLook();
    if (scene) camera = snapCamera(follow(session.state.player), scene.frame);
    stepper.reset();
  } else if (e.kind === "finish") {
    if (watching) {
      // Une lecture n'est pas un temps du joueur : le meilleur affiché reste celui du jour.
      session.best = memory.best?.time ?? null;
      hud.finish(session, {
        ...finishOptions(),
        title: mod?.solution ? t("bandeau.solution") : daily && options.solution ? t("bandeau.rediffAuteur") : options.watchFirst && firstRemote ? t("bandeau.rediffPremier", { nom: firstRemote.name }) : t("bandeau.rediffusion"),
        watching: true,
      });
      return;
    }
    // Lot I5 : à l'arrivée, l'écart avec le record d'avant (celui du début de l'essai).
    if (recordTime !== null) hud.setProgress(session.state.checkpoint, level.checkpoints.length, e.time - recordTime);
    // Lot 27 : le résultat, calculé avant que le rejeu ne change le record (l'écart se lit contre celui d'avant) ; il reste affiché pendant la rediffusion et le carnage.
    lastResult = resultViewOf(e.time, recordTime);
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
    if (!(rec?.result.finished && startCarnage(rec.replay, memory.liveReplays(rec.essai), false, lastBits, null, false, lastResult))) showFinish();
  }
}

/** Lot 27 : le résultat du dernier essai arrivé (l'autocollant du carnage, y compris « Revoir le carnage »). */
let lastResult: ResultView | null = null;
/** Lot 27 : ce que l'autocollant dit d'une arrivée au temps `time` (pas), `record` étant le record d'avant (ou `null`). */
function resultViewOf(time: number, record: number | null): ResultView {
  const medal = daily && !isTrial && !session.tuned ? jumpMedalFor(time, daily.medals) : null;
  const deaths = session.attemptDeaths === 0 ? t("arrivee.sansFaute") : t("commun.morts", { n: session.attemptDeaths });
  const canBoard = !!daily && !!choice && (choice.mode === "jour" || choice.mode === "archive") && ranking.enabled && !session.tuned && !isTrial;
  return { time: fTicks(time), medal, deaths, gap: session.tuned ? null : resultGap(time, record), canBoard };
}

/** Lot 10 : la médaille de l'arrivée, à faire sonner à l'ouverture de l'écran d'arrivée (une seule fois). */
let pendingMedal: JumpMedal | null = null;
/** Lot 10 : la dernière arrivée a battu le meilleur temps du jour. */
let finishNewBest = false;

/** Lot 10 : l'écran d'arrivée sert au niveau du jour joué (pas une lecture, pas des réglages modifiés) ; ailleurs, le bandeau du lot 2. */
function arrivalScreen(): boolean {
  return daily !== null && choice !== null && !watching && !session.tuned && !isTrial;
}

/** Lot I5 : ce que montre l'écran d'arrivée (recalculé au changement de langue). */
function arrivalView(): ArrivalView {
  const d = daily!;
  const c = choice!;
  const time = session.state.time;
  const medal = jumpMedalFor(time, d.medals);
  const best = memory.best?.time ?? session.best;
  const next = nextMedal(time, d.medals);
  const now = Date.now();
  const deaths = memory.totalDeaths;
  return {
    mode: c.mode === "archive" ? t("arrivee.mode.archive", { date: shortDate(d.date) }) : c.mode === "futur" ? t("arrivee.mode.futur") : "",
    time: fTicks(time),
    medal,
    medalText: medalText(medal),
    next: next ? { label: t("arrivee.prochaine", { medaille: medalWord(next.medal) }), time: fTicks(next.ticks) } : null,
    best: finishNewBest ? t("arrivee.record") : best === null ? "" : t("arrivee.meilleur", { temps: fTicks(best) }),
    newBest: finishNewBest,
    deaths,
    phrase: arrivalLine(deaths),
    stats: t("arrivee.jour", { morts: t("commun.morts", { n: deaths }), essais: t("commun.essais", { n: memory.attempts }) }),
    run: session.attemptDeaths === 0 ? t("arrivee.sansFaute") : t("arrivee.mortsEssai", { morts: t("commun.morts", { n: session.attemptDeaths }) }),
    streak: c.mode === "jour" ? t("arrivee.serie.jour", { jours: streakText(history.streak(gameDay(now))) }) : c.mode === "archive" ? archiveStreakText() : t("arrivee.serie.apercu"),
    countdown: countdownText(now),
    canCarnage: lastCarnage !== null && scene !== null,
    canShare: memory.best !== null,
  };
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
  arrival.show(arrivalView());
  // Lot P1 : le classement (jour : rang et top 10 après l'envoi ; archive : le classement figé de ce jour, rien n'est envoyé).
  refreshRank();
  // Lot P2 : le fantôme du premier ; « Regarder le premier » s'il y en a un. Lot P3 : la carte des morts ; « Le carnage de tout le monde »
  // apparaît quand l'échantillon est là. Lot P4 : le top 10 et le premier connus s'affichent tout de suite ; le jour n'est relu (une requête :
  // classement, premier, carte) que si la dernière lecture a plus de 3 minutes ; après ton envoi, le classement vient de sa réponse.
  arrival.setFirst(null);
  // Lot I3 : la suite de la journée, si elle est déjà connue (envoi accepté pendant le carnage) ; sinon elle arrive avec l'envoi.
  arrival.setSuite(suiteDuJour);
  void loadSuite();
  showFirst();
  void refreshDay({ maxAgeMs: ARRIVAL_REFRESH_MS });
  arrival.setEveryone(null);
  void loadEveryone();
}

// ——— Lot I3 (plateforme) : « Jeu suivant du jour » à l'arrivée : une lecture de `GET /api/portail/jour` après l'envoi accepté (le classement prouvé dit que ce jeu est
// fini), jamais d'une connaissance codée de l'autre jeu. Serveur injoignable : pas de bouton, rien de bloquant. ———
let suiteDuJour: Suite | null = null;
let suiteLue = 0;
let suiteEnCours = false;
/** Lit la suite (au plus une fois par 10 s, sauf `force` : un envoi vient d'être accepté) ; le niveau du jour classé seulement, jamais en démonstration. */
async function loadSuite(force = false): Promise<void> {
  if (suiteEnCours || !apiBase || demoRank || !daily || !choice || choice.mode !== "jour" || watching || session.tuned || isTrial) return;
  // Sans envoi accepté à l'instant, seulement si le serveur connaît déjà le résultat du jour (envoyé plus tôt, ou relu au chargement).
  if (!force && ((ranking.state.status !== "ranked" && ranking.known(daily.date) === null) || Date.now() - suiteLue < 10_000)) return;
  const id = ownId();
  if (!id) return;
  suiteEnCours = true;
  suiteLue = Date.now();
  const lue = await lireSuite(apiBase, id, "jump");
  suiteEnCours = false;
  if (lue === null) return; // injoignable, ou ce jeu n'est pas encore fini côté serveur : rien
  suiteDuJour = lue;
  if (arrival.shown) arrival.setSuite(lue);
  if (resultat.shown) resultat.setSuite(lue);
}

/** Lot P1 : le classement de l'écran d'arrivée et le rang de l'accueil suivent l'état du classement. */
function refreshRank(): void {
  if (daily && choice && (arrival.shown || resultat.shown)) {
    const view = arrivalRankView({
      enabled: ranking.enabled,
      mode: choice.mode,
      date: daily.date,
      state: ranking.state,
      pending: ranking.pendingFor(daily.date) !== null,
      known: ranking.known(daily.date),
      board: ranking.boards.get(daily.date) ?? null,
    });
    if (arrival.shown) arrival.setRank(view);
    // Lot 27 : l'autocollant ne dit que la place ou l'envoi en cours ; un refus, une panne, le pseudo à choisir sont l'affaire de l'écran d'arrivée.
    if (resultat.shown) resultat.setRank(view.shown && !view.askName && view.tone !== "warn" && view.status ? view.status : null);
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
  if (r === "partage") arrival.shareResult(t("arrivee.partage.ok"), null);
  else if (r === "copie") arrival.shareResult(t("arrivee.partage.copie"), null);
  else if (r === "annule") arrival.shareResult("", null);
  else arrival.shareResult(t("arrivee.partage.echec"), text);
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
  if (arrival.shown) arrival.setEveryone(canEveryone() ? everyoneLabel(everyone!.lives.length, new Set(everyone!.players).size) : null);
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
  startCarnage(lastCarnage.hero, lastCarnage.others, false, lastBits, null, false, lastResult);
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
  settingsUi.close();
  arrival.hide();
  hud.hideFinish();
  home.open(homeView());
  syncPause();
  // Lot P2 : le profil, relu (au plus une fois par 30 s). Lot P1 : le rang du jour. Lot P4 : les deux dans la même lecture du jour (au plus
  // une fois par 30 s ; la synchronisation prend le profil dans cette lecture).
  void refreshDay();
  void syncProfile();
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
    return { reference: t("bandeau.essaiRef", { theme: nomTheme(theme.name), temps: fTicks(daily.medals.author) }), next: null, title: t("bandeau.essaiTitre", { theme: nomTheme(theme.name) }) };
  }
  if (daily) {
    const m = finishMedalText(session.state.time, daily.medals);
    lastMedal = m.medal;
    return { reference: m.text, next: null };
  }
  if (!mod) return { reference: null, next: null };
  const ref = reference === null ? t("bandeau.solutionAucune") : t(mod.entry === "elan" && !mod.solution ? "bandeau.solutionCouloir" : "bandeau.solutionRef", { temps: fTicks(reference) });
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
  // Lot 15 : le « Prêt… » d'un niveau à une seule horloge : l'horloge tourne, aucune commande n'est jouée (ni rediffusion consommée).
  if (session.ready) {
    // Lot 27 : le décompte « 3, 2, 1, Partez ! » (un chiffre par tiers du décompte), puis « Partez ! » quand le chrono part.
    hud.decompte(decompteDigit(session.countdown, readyTicks()));
    const go = session.step(injected ?? controls.sample());
    if (go) hud.decompte("go");
    return;
  }
  let bits = watching ? (watchInputs[watchIndex++] ?? 0) : (injected ?? controls.sample());
  // Lot 10 (tests) : `__jump.autoplay(code)` joue une rediffusion comme si c'étaient les commandes du joueur (l'essai est enregistré).
  if (autoplayInputs && !watching) {
    bits = autoplayInputs[autoplayIndex++] ?? 0;
    if (autoplayIndex >= autoplayInputs.length) autoplayInputs = null;
  }
  // Lot 27 : une reprise volontaire demandée (touche R, Y, plaque, pause) se joue à ce pas : quatrième bit de la commande, enregistré dans la rediffusion.
  if (resumePending) {
    resumePending = false;
    if (!watching && session.canResume) bits |= INPUT_RESPAWN;
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

/** Lot 27 : une reprise volontaire attend le prochain pas de simulation (elle s'y joue, avec son bit dans la commande). */
let resumePending = false;
/**
 * Lot 27 : « reprendre au dernier point de passage » (touche R, Y à la manette, plaque tactile, pause) — comme DailyTrack. Un niveau en version 11 avec un point franchi : la reprise se
 * joue au prochain pas (le chrono continue, ce n'est pas une mort). **Avant le premier point** (ou dans un niveau d'avant la version 11, qui ne sait pas enregistrer une reprise) :
 * comme « recommencer à zéro ». Mort et en attente de la reprise automatique sur un point : rien (elle vient toute seule).
 */
function respawnRequest(): void {
  if (!newDay && !carnage && !watching && session.canResume) {
    resumePending = true;
    return;
  }
  if (!newDay && !carnage && !watching && session.state.status === ATTEMPT_DEAD && session.state.checkpoint >= 0) return;
  restart();
}

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
  resumePending = false;
  hud.decompte(null);
  resultat.hide();
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
  hud.setProgress(session.state.checkpoint, level.checkpoints.length, null);
  arrival.hide();
  if (scene) camera = snapCamera(follow(session.state.player), scene.frame);
  if (phase !== "loading" && phase !== "no-webgl") phase = phaseOf(session.state);
}

const hud = mountHud({
  onRestart: () => controls.requestRestart(),
  // Lot I5 : la barre de lecture du carnage (vague précédente, pause, vague suivante, fermer).
  carnage: {
    onPrev: () => carnageWave(-1),
    onNext: () => carnageWave(1),
    onToggle: () => {
      if (!carnage) return;
      carnage.paused = !carnage.paused;
      stepper.reset();
      showCarnageBar(carnage);
    },
    onClose: () => {
      if (!carnage) return;
      carnage.run.stop();
      endCarnage();
    },
  },
});
hudReady = true;
hud.setObjective(objective());
hud.setProgress(session.state.checkpoint, level.checkpoints.length, null);
const arrival = mountArrival({
  onBoard: () => openBoard(),
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
// Lot 27 : le résultat pendant la rediffusion et le carnage (un autocollant compact à gauche, sous le titre du carnage) ; REJOUER recommence à zéro, « Classement » ouvre l'écran du classement.
const resultat = mountResult({ onReplay: () => controls.requestRestart(), onBoard: () => openBoard() });
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
// Lot P4 : **une** lecture du jour au chargement — le rang (lot P1), le fantôme du premier (lot P2, déjà lu pour `?watch=first`), la carte
// des morts (lot P3) et le profil DailyJump (lot P2 : la synchronisation le prend dans cette lecture) — au lieu de quatre requêtes.
dayReady = true;
const keptDay = firstDate ? reads.last(firstDate) : null;
if (keptDay) showDay(keptDay.data);
void refreshDay();
void syncProfile();
// Lot P3 : les vies en attente (une autre page, une coupure) repartent.
void livesSender.flush();

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
/** Lot I5 : le titre du niveau ne s'affiche qu'**au départ** (charte rév. 7, § 9 : le centre reste libre, rien d'empilé sous la bande en permanence) : tant que
 * la partie n'a pas commencé, puis 2,5 s après la première commande ; il revient au départ suivant d'une page neuve seulement. */
let introUntil = Number.POSITIVE_INFINITY;
const INTRO_MS = 2500;
function updateDayLine(): void {
  if (!daily || !choice) return;
  const text = dayLine({ number: daily.number, date: daily.date, theme: daily.theme }, choice, preview);
  if (text !== shownLine) {
    shownLine = text;
    dayLineEl.textContent = text;
  }
  if (introUntil === Number.POSITIVE_INFINITY && phase === "playing") introUntil = performance.now() + INTRO_MS;
  const show = performance.now() < introUntil; // l'accueil ouvert le cache (hud.css : body.home-open)
  if (dayLineEl.hidden === show) dayLineEl.hidden = !show;
}
onLangue(() => {
  shownLine = "";
  updateDayLine();
  if (notice) setNotice(noticeKey ? t(noticeKey) : notice, newDay);
});
/** La clé du message du jour affiché (il suit la langue). */
let noticeKey = "";
if (daily && choice) {
  document.body.classList.add("daily");
  // Lot 10 : le mode archive se voit dans le HUD (il ne compte pas dans la série) : une petite plaque en haut à gauche, à côté de la pause.
  const modeTag = document.getElementById("modetag")!;
  modeTag.hidden = choice.mode !== "archive" && choice.mode !== "essai";
  const majModeTag = () => (modeTag.textContent = choice.mode === "essai" ? t("hud.mode.essai", { theme: nomTheme(theme.name) }) : t("hud.mode.archive"));
  majModeTag();
  onLangue(majModeTag);
  updateDayLine();
  if (choice.refused) {
    noticeKey = "jour.refuse";
    setNotice(refusedText(), false);
  }
  // Le niveau d'aujourd'hui est ouvert (ou une date future refusée) : à minuit de Paris, un nouveau niveau attend. La partie continue.
  if (choice.mode === "jour") {
    const shownDay = choice.day;
    const watchDay = () => {
      if (newDay || gameDay() === shownDay) return;
      newDay = true;
      noticeKey = "jour.nouveau";
      setNotice(newDayText(), true);
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
  const badge = session.tuned ? t("hud.reglagesModifies") : "";
  if (tunedBadge.textContent !== badge) tunedBadge.textContent = badge;
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
    originLine(loaded, modApi !== null),
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
  // Lot 16 : une portion dure commence à sa zone de bifurcation (la course sous la cage fait partie de sa portion, comme `DailyPiece.start`).
  const startCol = (j: number) => daily.slowRoutes.find((r) => r.piece === j)?.zone ?? daily.pieces[j]!.col0;
  while (k + 1 < daily.pieces.length && col >= startCol(k + 1)) k++;
  const p = daily.pieces[k];
  const where = p ? `${k + 1}/${daily.pieces.length} ${p.id} v${p.variant} · exigence ${p.exigence}/5 · ${p.entry === "arret" ? "arrêt" : "élan"}` : "—";
  // Lot 15 : l'horloge de la section du morceau (v4 : phase de la section, période, position dans le cycle à cet instant).
  const period = p && singleClock(level) ? sectionPeriod(level, k) : 0;
  const clock = !singleClock(level)
    ? `v${level.simVersion} · une horloge par section`
    : period === 0
      ? `v${level.simVersion} · rien ne tourne dans ce morceau`
      : `v${level.simVersion} · phase ${level.sections[k]!.phase} · période ${period} · cycle ${cycleMod(session.state.time + level.sections[k]!.phase, period)}`;
  // Lot 16 : la seconde voie du morceau (temps rapide et lent, surcoût), et les temps de référence du niveau.
  // Sur le palier d'entrée et dans la zone de bifurcation, c'est déjà la voie du morceau qui suit.
  const slow = daily.slowRoutes.find((r) => col >= r.palierIn.col0 && col <= daily.pieces[r.piece]!.col1);
  const voie = slow ? `${daily.pieces[slow.piece]!.id} · rapide ${formatTicks(slow.fastTicks)} · lente ${formatTicks(slow.slowTicks)} (+${formatTicks(slow.slowTicks - slow.fastTicks)})` : "aucune ici (portions notées 4 ou 5 seulement)";
  return `morceau   ${where}\nhorloge   ${clock}${session.ready ? ` · Prêt… ${session.countdown}` : ""}\nvoie lente ${voie}\nniveau    ${daily.id} · auteur ${formatTicks(daily.authorTicks)} · toutes voies lentes ${formatTicks(daily.slowTicks)} · ${daily.slowRoutes.length} voie(s) lente(s) · tirage ${daily.chosen}${daily.fallback ? " (secours)" : ""}`;
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
      code: BUILD_RESTRICTED ? undefined : daily.code, // lot R9 : jamais la preuve de l'auteur dans la page de production
      slowRoutes: daily.slowRoutes.map((r) => ({ piece: r.piece, zone: r.zone, entryRow: r.entryRow, galleryRow: r.galleryRow, fastTicks: r.fastTicks, slowTicks: r.slowTicks, code: r.code })),
      slowTicks: daily.slowTicks,
      lastMedal,
      newDay,
      notice,
      load: loaded
        ? { source: loaded.source, generated: loaded.generated, catalog: loaded.catalog, cacheMiss: loaded.cacheMiss, frozenMiss: loaded.frozenMiss, totalMs: loaded.totalMs, blockedMs: loaded.blockedMs }
        : { source: "aucun", generated: false, catalog: modApi ? "principal" : "non", cacheMiss: "", frozenMiss: "", totalMs: 0, blockedMs: 0 },
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
    if (bits !== null && (!Number.isInteger(bits) || bits < 0 || bits > INPUT_ATTEMPT_MASK)) throw new RangeError(`Commande invalide : ${bits}`);
    injected = bits;
  },
  restart,
  /** Lot 27 : « reprendre au dernier point de passage » (la touche R) : au prochain pas dans un niveau en version 11 avec un point franchi, sinon « recommencer à zéro ». */
  respawn: respawnRequest,
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
        governor: c.governor ? { level: c.governor.level, maxLives: c.governor.maxLives, particles: c.governor.particles, windows: [...c.governor.windows] } : null,
      };
    },
    /** Lot P4 : impose un palier au carnage de tout le monde (celui en cours et les suivants) ; `null` : l'appareil décide de nouveau. */
    govern(level: number | null) {
      forcedGovernorLevel = level;
      const c = carnage;
      if (c?.governor) {
        c.governor = new CarnageGovernor({ locked: level });
        applyGovernor(c);
      }
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
  get reads() {
    return reads.debug();
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
  /** Lot 20 : les plateformes mobiles (null sans elles) : ce que le dessin a posé, et l'état de la simulation. */
  get platforms() {
    if (level.platforms.length === 0) return null;
    const state = session.state;
    return {
      ...(scene?.platforms ?? {}),
      count: level.platforms.length,
      sim: platformPositions(level, state),
      phases: level.platforms.map((p) => sectionClock(level, state.sections, state.time, p.section)),
      ride: state.ride ?? -1,
    };
  },
  /** Lot 22 : les presses (null sans elles) : ce que le dessin a posé, et l'état de la simulation. */
  get presses() {
    if (level.presses.length === 0) return null;
    const state = session.state;
    const phases = level.presses.map((p) => sectionClock(level, state.sections, state.time, p.section));
    return {
      ...(scene?.presses ?? {}),
      count: level.presses.length,
      sim: pressBoxes(level, state),
      phases,
      warn: level.presses.map((p, i) => pressLook(p, phases[i]!).warn),
    };
  },
  /** Lot 23 : les champignons (null sans eux) : ce que le dessin a posé, et la liste de la simulation. */
  get mushrooms() {
    if (level.mushrooms.length === 0) return null;
    return {
      ...(scene?.mushrooms ?? {}),
      count: level.mushrooms.length,
      list: level.mushrooms.map((m) => ({ col: m.col, row: m.row, dir: m.dir, name: MUSHROOM_NAMES[m.dir]!, pad: mushroomPad(m) })),
    };
  },
  /** Lot 25 : les lasers (null sans eux) : ce que le dessin a posé, et l'état de la simulation. */
  get lasers() {
    if (level.lasers.length === 0 && level.laserBars.length === 0) return null;
    const state = session.state;
    const phases = level.lasers.map((l) => sectionClock(level, state.sections, state.time, l.section));
    const looks = level.lasers.map((l, i) => laserLook(l, phases[i]!));
    const barPhases = level.laserBars.map((b) => sectionClock(level, state.sections, state.time, b.section));
    return {
      ...(scene?.lasers ?? {}),
      count: level.lasers.length,
      bars: level.laserBars.length,
      sim: level.lasers.map((l) => laserBox(l)),
      phases,
      simOn: looks.map((k) => k.on),
      simWarn: looks.map((k) => k.warn),
      simBars: level.laserBars.map((_, i) => laserBarAt(level, state.sections, state.time, i)),
      barPhases,
      simBarSpeeds: level.laserBars.map((b, i) => laserBarLook(b, barPhases[i]!).speed),
    };
  },
  /** Lot 26 : les ponts à interrupteur (null sans eux) : ce que le dessin a posé, et l'état de la simulation. */
  get bridges() {
    if (level.bridges.length === 0) return null;
    const state = session.state;
    const looks = bridgeTileLooks(level, state);
    return {
      ...(scene?.bridges ?? {}),
      count: level.bridges.length,
      list: level.bridges.map((b) => ({ id: b.id, switchCol: b.switchCol, switchRow: b.switchRow, delay: b.delay, tiles: b.tiles.length })),
      ages: level.bridges.map((_, i) => state.bridges?.[i] ?? 0),
      simSolid: looks.map((k) => k.solid),
      simFills: looks.map((k) => k.fill),
    };
  },
  /** Lot 24 : les stalactites (null sans elles) : ce que le dessin a posé, la liste de la simulation et l'état courant. */
  get stalactites() {
    if (level.stalactites.length === 0) return null;
    return {
      ...(scene?.stalactites ?? {}),
      count: level.stalactites.length,
      list: level.stalactites.map((s) => ({ id: s.id, col: s.col, row: s.row, before: s.before, after: s.after, zone: [s.col - s.before, s.col + s.after] as [number, number] })),
      ages: [...(session.state.stalactites ?? level.stalactites.map(() => 0))],
    };
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
      // Ce que le dessin a posé à la dernière image (jauges, contours épais et pointillés, éclat) ; le reste se lit de l'état de l'essai.
      ...(stats ?? {}),
      blinks: level.blinks.length,
      alts: level.alts.length,
      solid: looks.filter((l) => l.solid).length,
      absent: looks.filter((l) => !l.solid).length,
      // Lot 18 : le niveau de jauge de chaque clignotant tel que le calcule la simulation (`fills` de `stats` : celui qui est dessiné).
      simFills: looks.slice(0, level.blinks.length).map((l) => l.fill),
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
      help: howto.isOpen,
      archives: archivesUi.isOpen,
      archiveDates: archivesUi.rows.map((r) => r.date),
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
    // Lot I5 : plus de profil dans le jeu (le profil commun du portail) ; l'accueil dit seulement si le code a été remplacé ailleurs.
    return { ...jumpSync.state, revoked: jumpSync.state.status === "revoked" };
  },
  rankWake() {
    ranking.wake();
  },
  showSuite(suite: Suite | null) {
    arrival.setSuite(suite);
  },
  autoplay(code?: string) {
    const c = code ?? (BUILD_RESTRICTED ? undefined : daily?.code) ?? (level === ESSAI_LEVEL ? ESSAI_SOLUTION_CODE : null);
    if (!c) throw new Error("rien à jouer : donne une rediffusion");
    autoplayInputs = fromRuns(decodeReplay(c).runs);
    autoplayIndex = 0;
    // Lot 15 : la rediffusion part au chrono 0 : le départ est donné tout de suite (pas de « Prêt… »).
    session.go();
    return autoplayInputs.length;
  },
  go() {
    session.go();
  },
  get pret() {
    return { ticks: session.countdown, total: readyTicks(), level: level.simVersion };
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
// Lot I5 : les Réglages, un écran du cadre crème (ouvert depuis la pause ou l'accueil ; « ‹ JUMP » le ferme) : son, sensations, fantôme du premier, taches,
// commandes, langue, « Mon profil Du Jour › » (le profil commun du portail : plus de profil dans le jeu) et les mentions légales.
const settingsUi = mountSettings({
  settings,
  canVibrate: typeof navigator.vibrate === "function",
  onChange: applySettings,
  profilHref: profil,
  onToggle: (open) => {
    syncPause();
    if (!open) {
      if (menuOpen) menu.update(pauseView());
      else home?.focus();
    }
  },
});
// Lot I5 : la pause, posée sur la scène sous le voile à rayures (maquette jump-pause.html).
const menu = mountPauseMenu({
  onResume: () => setMenu(false),
  onRestart: () => {
    setMenu(false);
    if (home?.isOpen) home.close();
    controls.requestRestart();
    syncPause();
  },
  // Lot 27 : « Depuis le point de passage » (la reprise volontaire, le chrono continue).
  onRespawn: () => {
    setMenu(false);
    controls.requestRespawn();
    syncPause();
  },
  onGhost: () => toggleGhost(),
  onSound: () => {
    applySettings({ ...settings, sound: !settings.sound }, "sound");
    settingsUi.set(settings);
    menu.update(pauseView());
  },
  onSettings: () => settingsUi.open(),
  onHelp: () => howto.open(),
  onHome: () => goHome(),
});
/** Lot I5 : ce que montre la pause : le niveau, les morts et le point de passage, la réplique du thème, fantôme et son, la version du jeu. */
function pauseView(): PauseView {
  const cp = session.state.checkpoint;
  const morts = t("commun.morts", { n: session.deaths });
  const total = level.checkpoints.length;
  return {
    niveau: daily ? (daily.number >= 1 ? t("accueil.niveau", { numero: fNumero(daily.number), theme: nomTheme(daily.theme) }) : nomTheme(daily.theme)) : "",
    etat: total > 0 ? t("pause.etat", { morts, pc: `${Math.max(0, cp + 1)}/${total}` }) : morts,
    replique: daily ? repliqueTheme(daily.theme) : "",
    ghost: ghostOn,
    sound: settings.sound,
    version: t("commun.version", { sim: JUMP_SIM_VERSION, jour: dayText }),
    canResume: session.canResume,
  };
}
function setMenu(open: boolean): void {
  if (open === menuOpen) return;
  menuOpen = open;
  if (open) menu.open(pauseView());
  else menu.close();
  document.body.classList.toggle("paused", open);
  syncPause();
}
/** Lot 10 : l'accueil ouvert met la partie en pause, comme le menu ; lot I5 : les écrans posés par-dessus aussi (réglages, aide, archives, classement). */
const homeOpen = (): boolean => (home?.isOpen ?? false) || settingsUi.isOpen || howto.isOpen || archivesUi.isOpen || boardUi.isOpen;
/** Menu ⏸ ou un écran ouvert : le clavier et les doigts ne commandent plus le personnage, le son de jeu se tait, aucun pas ne se joue. */
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
// Lot I7 : le plein écran reste en vue, juste après la pause (la plaque du HUD) ; caché s'il n'est pas possible. Même logique que l'accueil et la pause (socle).
pauseButton.after(boutonPleinEcran({ t, id: "fullscreenbtn", classe: ["plaque", "plaque--bouton"] }));
onLangue(majPleinEcran);
// Lot 27 (comme DailyTrack, à la même place : en haut à gauche, à côté de la pause, aux doigts seulement) : la plaque « dernier point de passage » (le drapeau) et la plaque
// « recommencer à zéro ». Elles font ce que font R et Entrée ; le drapeau n'existe que dans un niveau de la version 11 (les anciens ne savent pas enregistrer une reprise).
{
  const plaque = (id: string, icon: SVGSVGElement, cle: string, onClick: () => void): HTMLButtonElement => {
    const b = el("button", { classe: "plaque plaque--bouton plaque--action", attrs: { id, type: "button" } }, icon) as HTMLButtonElement;
    lier(b, cle, undefined, "aria-label");
    b.addEventListener("click", () => {
      b.blur();
      onClick();
    });
    return b;
  };
  const recommencer = svg(
    "svg",
    { classe: ["dj-icone", "dj-icone--recommencer"], attrs: { viewBox: "0 0 24 24", width: 20, height: 20, fill: "none", stroke: "currentColor", "stroke-linecap": "square", "stroke-linejoin": "miter", focusable: "false", "aria-hidden": "true" } },
    svg("path", { attrs: { d: "M20 12a8 8 0 1 1-2.6-5.9" } }),
    svg("path", { attrs: { d: "M20 3v5h-5" } }),
  );
  const point = plaque("btn-respawn", icone("drapeau", { taille: 20 }), "tactile.pointDePassage", () => controls.requestRespawn());
  point.hidden = level.simVersion < RESTART_VERSION;
  pauseButton.after(point, plaque("btn-restart", recommencer, "tactile.depart", () => controls.requestRestart()));
}
pauseButton.addEventListener("click", () => {
  pauseButton.blur();
  setMenu(true);
});
onLangue(() => {
  if (menuOpen) menu.update(pauseView());
  if (home?.isOpen) home.update(homeView());
  if (arrival.shown) {
    arrival.show(arrivalView());
    refreshRank();
    showFirst();
    if (canEveryone()) arrival.setEveryone(everyoneLabel(everyone!.lives.length, new Set(everyone!.players).size));
  }
  if (boardUi.isOpen) boardUi.update(boardView());
  updateOverlay();
});

// ——— Fantôme : réglage mémorisé (`jump:fantome`), dans la pause et touche G ———
function toggleGhost(): boolean {
  ghostOn = !ghostOn;
  saveGhostSetting(store, ghostOn);
  if (menuOpen) menu.update(pauseView());
  else hud.toast(t(ghostOn ? "toast.fantome.oui" : "toast.fantome.non"));
  return ghostOn;
}
window.addEventListener("keydown", (e) => {
  if (e.code === "KeyG" && !e.repeat && !menuOpen && !homeOpen()) toggleGhost();
});

if (touchOn) {
  touchUi = mountTouchUi({
    controls,
    forced: options.touch === "1",
    zones: options.zones,
    tune: options.tune,
    onGear: () => setPanel(true),
  });
}

/** Lot I5 : l'écran du classement du jour du jeu (depuis l'accueil et l'arrivée). */
function boardView(): BoardView {
  const date = daily?.date ?? formatDay(today);
  const entry = ranking.boards.get(date) ?? null;
  const b = entry?.board ?? null;
  const { rows, gap } = rowsOf(b);
  const theme = nomTheme(daily?.theme ?? homeTheme.name);
  const message = !ranking.enabled ? t("classement.sansServeur") : b === null ? t(entry?.status === "loading" || !entry ? "rang.chargement" : "rang.indisponible") : rows.length === 0 ? t("classement.vide") : "";
  return { subtitle: b ? t("classement.sousTitre", { theme, classes: classesText(b.participants) }) : theme, rows, gap, message };
}
function openBoard(): void {
  boardUi.open(boardView());
  void refreshDay();
}
/** Lot I5 : « Voir le carnage » de l'accueil : ton meilleur essai du jour en héros et toutes les vies du jour ; à la fin, retour à l'accueil. */
function carnageFromHome(): void {
  const best = memory.bestReplay();
  if (!best || !memory.best || carnage) return;
  home?.close();
  syncPause();
  startCarnage(best, memory.liveReplays(memory.best.essai), false, lastBits, null, true);
}

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
  // Lot 17 : pendant le carnage, ce qui suit l'horloge (scies mobiles, clignotants, rafales) est estompé ; partout ailleurs, rien ne change.
  scene.clockFade = carnage ? CARNAGE.clockOpacity : 1;
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
    const interval = now - last;
    const dt = Math.min(Math.max((now - last) / 1000, 0), 0.25);
    last = now;
    controls.pollPad();
    if (controls.takeMenu()) setMenu(!menuOpen);
    if (controls.takeRestart()) restart();
    if (controls.takeRespawn()) respawnRequest();
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
    // Lot P4 : le carnage de tout le monde s'adapte à l'appareil (pas en pas à pas : les tests et la mesure imposent leur palier).
    const c = carnage;
    if (c?.governor && !manual && c.governor.observe(t2 - t0, interval, now)) applyGovernor(c);
    requestAnimationFrame(frame);
  };
  draw(1, 0);
  updateOverlay();
  phase = "ready";
  requestAnimationFrame(frame);
  if (daily && options.solution) hud.toast(t("toast.rediffAuteur"));
  else if (mod?.solution && !watching) hud.toast(t("toast.pasDeSolution"));
  else if (mod?.solution) hud.toast(t("toast.solution"));
  else if (options.watchBest && !watching) hud.toast(t("toast.pasDeMeilleur"));
  else if (options.watchFirst && !watching) hud.toast(t(firstMiss === "no_ghost" ? "toast.personneClasse" : "toast.premierIndisponible"));
  else if (options.watchFirst && firstRemote) hud.toast(t("toast.rediffPremier", { nom: firstRemote.name }));
  else if (watching) hud.toast(t("toast.rediffMeilleur"));
  if (options.carnageDemo) startDemo();
}
// Lot 10 : le jeu est prêt : Jouer et Réglages répondent ; l'accueil ouvert tient la partie en pause.
gameReady = true;
home?.setReady(true);
syncPause();

