// Lot I4 : le socle `@cdj/ui` (jetons, base, composants), les 7 faces de polices de Track (hébergées, mêmes fichiers que le portail), puis les feuilles du jeu.
import "@cdj/ui/src/styles.css";
import "@cdj/ui/src/cadre.css";
import "@cdj/ui/src/polices/archivo-black-400.css";
import "@cdj/ui/src/polices/archivo-400.css";
import "@cdj/ui/src/polices/archivo-700.css";
import "@cdj/ui/src/polices/jetbrains-mono-700.css";
import "@cdj/ui/src/polices/barlow-condensed-600.css";
import "@cdj/ui/src/polices/barlow-condensed-700-italique.css";
import "@cdj/ui/src/polices/barlow-condensed-800-italique.css";
import "./interface.css";
import "./hud.css";
import "./accueil.css";
import "./arrivee.css";
import "./reglages.css";
import "./tactile.css";
import "./salon.css";
import { appliquerTextes, chargerLangue, demarrerLangue, fDateCourte, fEcart, fNombre, fNumero, fRang, fTemps, langueCourante, messageErreur, nomTheme, onLangue, t, traducteurDuSocle } from "./i18n";
import { boutonPleinEcran, icone, majPleinEcran, nomMedaille, pleinEcranPossible, suivreDialogue } from "@cdj/ui";
import { iconeTrack } from "./icones";
import { definirJour } from "./cadre";
import { actionArrivee, autocollantMedaille, badgeEtEcart, creerArrivee, ligneRang, tempsEnGrand, typeDeMedaille, type Arrivee } from "./arriveeUi";
import { buzzAllowed, buzzAmplitude, flatRatio, speedCamera, speedLevel, speedLinesOpacity } from "./speedFeel";
import { SPEED_FEEL_FACTOR, formatSpeed, loadSettings, qualityPlan, saveSettings, type GameSettings } from "./settings";
import { dailyTitle, homeHref, lookupSalon, medalWord, wantsHome, withoutHome } from "./homeLogic";
import { mountHome, type HomeUi } from "./homeUi";
import { mountBoardScreen } from "./boardScreen";
import { mountSettings, type SettingsTab } from "./settingsUi";
import { profilHref } from "./profilLien";
import { mountHowto } from "./howtoUi";
import { howtoSeen, markHowtoSeen } from "./howto";
import { mountBoardPanel } from "./boardPanel";
import { boardErrorEl, boardTitle, dayLines, linesEls, watchLinkEl } from "./boardView";
import { loadRanks, rememberRank } from "./profile";
import { button, el as makeEl } from "./dom";
import { NeutralToneMapping, PerspectiveCamera, Quaternion, Vector3, WebGLRenderer } from "three";
import {
  AXLE_FRONT,
  AXLE_REAR,
  HALF_TRACK,
  DEFAULT_CAR_PARAMS,
  AXIS_MAX,
  DT,
  FLAT_WORLD,
  SIM_VERSION,
  NO_GROUND,
  carSpeed,
  copyCar,
  forwardSpeed,
  steerLimit,
  createCar,
  THEMES,
  createSurface,
  FALL_TICKS,
  themeByName,
  dailyTrackId,
  formatDay,
  isDefaultParams,
  parseTrack,
  ReplayPlayer,
  replayTicks,
  decodeReplay,
  encodeReplay,
  medalFor,
  parseDay,
  isVariant,
  raceElapsedMs,
  stepCar,
  wrapAngle,
  type CarInput,
  type CarParams,
  type Medal,
  type PilotRun,
  type CarState,
  type RaceState,
  type Track,
} from "@cdj/sim";
import { isRestricted, judgeAddress, trialKeysAllowed, withoutRefused } from "./access";
import { msUntilNextParisDay, parisDay } from "@cdj/clock";
import { sharedCircuitEngine, type DailyCircuit } from "./circuitEngine";
import { archiveDays, disposeArchive, mountArchive, nextTheme, randomSeedHref, themeHref, type ArchiveArgs, type ThumbSource } from "./archive";
import { loadArchiveExtras } from "./archiveExtras";
import { DEMO_BASE, apiBase } from "./api";
import { lireSuite } from "@cdj/profile";
import { elementsDeSuite } from "./jeuSuivant";
import { DEMO_TODAY } from "./demo";
import { NO_PLAN, fetchDayPlan, fetchPlanning, loadDemoPlan, type PlanEntry } from "./planning";
import { buildFlatArena } from "./arena";
import { createThumbnailService, type ThumbJob } from "./thumbnails";
import { renderThumbnail, type ThumbnailOptions } from "./thumbnail";
import { canNativeShare, copyShare, nativeShare } from "./clipboard";
import { GameAudio } from "./audio";
import { ambienceFor, landingQuality, volumeIcon } from "./audioLogic";
import { CAMERAS, HOOD_GHOST_CLEARANCE, HOOD_MAX_TILT, cameraIndexOf, nextCameraIndex } from "./cameras";
import { createCarMesh, createShadow, placeShadow, type CarModel, type WheelPose } from "./carMesh";
import { CarPose } from "./carPose";
import { predictLanding } from "./landing";
import { Effects, QualityGovernor, type Quality } from "./fx";
import { createTelemetry, readTelemetry } from "./telemetry";
import { formatDelta, formatTime } from "./format";
import type { Leaderboard } from "./api";
import { isValidName, normalizeName, setName, getName } from "./identity";
import { Controls, isTyping } from "./input";
import { IMPACT_COOLDOWN_MS, TouchPad, impactFelt, loadTouchSettings, vibrate, wantsTouch } from "./touch";
import { hintText, mountTouchUi } from "./touchUi";
import { Online, ghostModes, nextGhostMode, type GhostMode } from "./online";
import type { GhostEntry, NameLabel } from "./salonGhosts";
import { ORBIT_MIN_DIST, clampOrbit, nextWatchCamera, orbitOffset, progressOf, seekTick, tickAt, unwatchHref, wantsWatch, watchHref, watchTitle, REWIND_TICKS, WATCH_SPEEDS, type WatchEntry, type WatchSpeed } from "./watch";
import type { WatchUi } from "./watchUi";
import type { SalonController, SalonHost, SalonRunResult } from "./salonMode";
import { modeHref, sessionMsFromParams } from "./salonLien";
import type { LoadedSalonCircuit } from "./salonEngine";
import { listDayBests, loadBest, saveBest, type BestRun } from "./records";
import { MEDAL_ICON, shareLine, shareUrl, type ShareResult } from "./share";
import { RunSession } from "./session";
import type { TrackScene } from "./trackMesh";
import { PAS_DU_JEU, PAS_DU_PALIER, brancherComposeur, buildTrackScene, composer, creerReconstructeur, type Palier } from "./scene/socle";
import { gameStorage } from "./storage";
import { followIdentityRevision } from "./transfer";

// Lot P4 (plateforme) : un code chargé dans un autre jeu de la plateforme (DailyJump) depuis la dernière visite : le cache des records de
// l'ancienne identité est vidé, comme quand le code est chargé ici (`applyIdentity`). Avant toute lecture des records. Sinon, rien ne change.
followIdentityRevision(gameStorage(), formatDay(parisDay(Date.now())));
// Lot I4 : la langue de la plateforme (`cdj:langue`) pour `<html lang>`, le titre et les textes du HTML. L'anglais est un fichier à part, chargé ici s'il est la
// langue du joueur (les joueurs en français ne le téléchargent pas : budget de chargement).
await chargerLangue();
demarrerLangue();

const params = new URLSearchParams(location.search);
// Scénarios : `jour` (par défaut : le circuit du jour, `?seed=AAAA-MM-JJ` pour une autre date),
// `essai` (le circuit écrit à la main des lots 2-3), `pilotage` (le circuit de mise au point de la conduite, lot 7),
// `surfaces` (lot 8), `largeurs` (lot 12 : les trois largeurs de route et leurs transitions), `vitesse` (lot 15 : portions à plus de 80 m/s), `glace` (lot 16 : ligne droite de glace, virages en roue libre, slalom), `relief` (lot 17 : montées, descentes, deux sauts au-dessus du vide, section surélevée sans rebords), `cuves` (lot 18 : cuve droite, mur latéral, virage en cuve à pleine vitesse puis abordé trop lentement), `air` (lot 19 : dos d'âne, tremplin, long saut, saut vers un virage relevé, chute de trois niveaux, mur latéral quitté en l'air), `figures` (lot 20 : onze figures marquantes de la bibliothèque), `figure` (lot 20 : une seule figure, `&f=<nom>` avec `&v=<variante>` et `&m=1` pour le miroir) et `plat` (le terrain d'essai du lot 1).
const requested = params.get("scenario");
// Revoir le meilleur tour (lot 27b) : `?watch=best` (avec `?day=` ou `?mode=salon`). Mode spectateur, voir plus bas.
const watchWanted = wantsWatch(params);
// `?debug&spec=<blocs>` : un circuit écrit à la main (notation de `parseTrack`), pour les tests de navigateur.
let customTrack: ReturnType<typeof parseTrack> | null = null;
if (params.has("debug") && params.has("spec")) {
  try {
    customTrack = parseTrack("test", params.get("spec")!);
  } catch (e) {
    console.error("spec invalide", e);
  }
}
// Le Salon (lot 26) : `?mode=salon`. Un circuit qui change toutes les 10 minutes ; il a besoin du serveur (ou de la démonstration
// `?api=demo`). Sans lui, un message clair et le circuit du jour. Un scénario demandé explicitement l'emporte (outils de test).
let salon: SalonController | null = null;
let salonNotice = "";
const wantsSalon = params.get("mode") === "salon" && !customTrack && requested === null;
// Le Salon et le spectateur ne sont pas dans le premier chargement (lot 36) : chargés ici seulement si l'adresse les demande.
const salonMod = wantsSalon || watchWanted ? await import("./salonBundle") : null;
if (wantsSalon) {
  const base = apiBase();
  if (!base) salonNotice = t("salon.boot.repli", { raison: t("salon.boot.sansServeur") });
  else {
    const booted = await salonMod!.bootSalon({ search: location.search, base, startAt: params.has("debug") ? Number(params.get("salonAt")) || null : null, spectator: watchWanted });
    if (salonMod!.isBootError(booted)) salonNotice = t("salon.boot.repli", { raison: booted.error });
    else salon = booted;
  }
}
// Les circuits des scénarios d'essai (lot 36) : chargés seulement quand l'adresse en demande un (`?scenario=…`), pas dans le premier chargement.
const scenarios = !customTrack && !salon && requested !== null ? await import("./scenarios") : null;
// `?scenario=figure&f=<nom>` : une seule figure (lot 20). Un nom inconnu, ou une variante impossible, ramène au circuit d'essai.
const figureTrack = scenarios && requested === "figure" ? scenarios.scenarioTrack("figure", params) : null;
const scenario: string = salon ? "salon" : customTrack ? "essai" : requested === "figure" ? (figureTrack ? "figure" : "essai") : scenarios && (scenarios.SCENARIOS as readonly string[]).includes(requested!) ? requested! : "jour";
// `?today=AAAA-MM-JJ` (avec `?debug`) simule une autre date du jour : pour tester les archives.
// Production (lot 31) : outils d'essai coupés, aucun circuit à venir (voir `access.ts`).
const restricted = isRestricted(location.search);
const fakeToday = params.has("debug") && !restricted ? parseDay(params.get("today") ?? "") : null;
// `?api=demo` : jeu de données statique d'archives (lot 11) ; « aujourd'hui » y est figé au lendemain de l'historique.
const demoApiMode = apiBase() === DEMO_BASE;
// « Aujourd'hui » = la date à Paris (lot 31), la même pour tout le monde au même instant. La démonstration fige le sien au lendemain de
// son historique ; en production ce lendemain ne dépasse jamais la vraie date (pas de circuit à venir, même par la démonstration).
const realToday = parisDay(Date.now());
const todayParis = fakeToday ?? (demoApiMode ? (restricted ? Math.min(DEMO_TODAY, realToday) : DEMO_TODAY) : realToday);
// `?day=AAAA-MM-JJ` : accès direct à un jour (même chose que `?seed=`). En production, un jour à venir est refusé : circuit du jour.
const seedParam = params.get("seed") ?? params.get("day");
const requestedSeedDay = seedParam === null ? null : parseDay(seedParam);
// `?theme=<nom>` force le thème du jour (essais) : autre circuit, jamais classé.
const themeParam = params.get("theme");
const requestedTheme = themeByName(themeParam);
// `?variant=N` (avec `?seed=`) : une variante du planning pour l'essayer (l'admin l'ouvre ainsi) ; comme un thème forcé, jamais classée.
const variantParam = params.get("variant") === null ? null : Number(params.get("variant"));
const requestedVariant = variantParam !== null && isVariant(variantParam) ? variantParam : null;
const verdict = judgeAddress({ seedDay: requestedSeedDay, trial: !!requestedTheme || requestedVariant !== null, today: todayParis, restricted });
const seedDay = verdict.seedDay;
const forcedTheme = verdict.dropTrial ? null : requestedTheme;
const trialVariant = verdict.dropTrial ? null : requestedVariant;
const addressNotice = verdict.notice;
if (addressNotice) {
  try {
    history.replaceState(null, "", location.pathname + withoutRefused(location.search, verdict, requestedSeedDay !== null && seedDay === null) + location.hash);
  } catch {
    /* tant pis : l'adresse garde les paramètres refusés (le jeu les ignore de toute façon) */
  }
}
let daily: DailyCircuit | null = null;
const trial = !!forcedTheme || trialVariant !== null; // circuit d'essai : choisi par l'adresse, jamais classé
// Planning (lot 14) : le circuit en vigueur ce jour-là peut avoir été remplacé par l'admin. On le demande à l'API (délai court) ;
// sans API, ou si elle ne répond pas, c'est le circuit d'origine, course jouable mais non classée.
const planDay = seedDay ?? todayParis;
let plan: PlanEntry = NO_PLAN;
let planKnown = false;
// Le circuit du jour se calcule dans un fil de travail (lot 36) : pendant qu'on interroge le planning, il fait déjà le circuit d'origine (le cas de presque tous les
// jours) ; si le planning en choisit un autre, c'est celui-là qu'on lui demande. Le résultat ne dépend que de la date, de la variante et du thème : rien n'est perdu.
const engine = sharedCircuitEngine();
const originDaily = scenario === "jour" && !trial ? engine.daily(planDay, null, 0) : null;
originDaily?.catch(() => undefined); // si le planning en choisit un autre, ce résultat-ci ne sera jamais lu : pas d'erreur non rattrapée
if (scenario === "jour" && !trial) {
  const base = apiBase();
  if (base === DEMO_BASE) {
    plan = loadDemoPlan().get(formatDay(planDay)) ?? NO_PLAN; // mode démo : remplacements gardés dans ce navigateur
    planKnown = true;
  } else if (base) {
    const r = await fetchDayPlan(base, formatDay(planDay));
    if (r.ok && r.data.trackId === dailyTrackId(planDay, r.data.theme, r.data.variant)) {
      plan = { variant: r.data.variant, theme: r.data.theme };
      planKnown = true;
    }
  }
}
if (scenario === "jour") {
  daily = trial ? await engine.daily(planDay, forcedTheme?.name ?? null, trialVariant ?? 0) : plan.variant === 0 && !plan.theme ? await originDaily! : await engine.daily(planDay, plan.theme, plan.variant);
}
definirJour(daily?.day ?? todayParis, daily?.number); // la date et le numéro de la barre des jeux (cadre.ts)
// Accueil (lot 29) : au chargement, sauf lien direct (`?seed=`, `?day=`, `?scenario=`, `?mode=`, `?watch=`, `?demo`, `?debug`…) ; `?home=1` le force.
// Il ne s'affiche que sur le circuit d'aujourd'hui, jamais sur un scénario, un essai, le Salon ou une rediffusion.
const homeAllowed = !!daily && daily.day === todayParis && (seedParam === null || seedDay === null) && !trial && !salon && !watchWanted && !customTrack && !params.has("demo");
let homeOpen = homeAllowed && wantsHome(params);
if (params.has("home")) {
  try {
    history.replaceState(null, "", withoutHome(location.search)); // l'accueil forcé une fois ne doit pas coller aux liens suivants
  } catch {
    /* tant pis : l'adresse garde home= */
  }
}
let track: Track | null = salon ? salon.circuit.track : scenario === "plat" ? null : daily ? daily.track : customTrack ?? (scenario === "figure" ? figureTrack! : scenarios!.scenarioTrack(scenario, params)!);
// Réglages de la voiture : ceux du classement, sauf avec le panneau `?debug&tune` (courses alors jamais classées).
const tuning = params.has("debug") && params.has("tune");
// L'outil de réglage (`?debug&tune`, interne) n'est chargé que s'il est demandé : il ne pèse pas sur le premier chargement (lot I4, budget).
const tune = tuning ? await import("./tune") : null;
const carParams: CarParams = tune ? tune.loadTunedParams() : { ...DEFAULT_CAR_PARAMS };
const COUNTDOWN_S = 3;

const renderer = new WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

let view = track ? buildTrackScene(track, salon?.circuit.palette ?? daily?.palette ?? "desert") : buildFlatArena();
// Rendu (lot 23) : tonalité douce (les hautes lumières ne brûlent pas, les couleurs de la palette restent), exposition propre au thème, ombres portées.
renderer.toneMapping = NeutralToneMapping;
renderer.toneMappingExposure = view.look.exposure;
renderer.shadowMap.enabled = true;
let carModel: CarModel = createCarMesh();
let carMesh = carModel.group;
view.scene.add(carMesh);
const castShadows = (group: typeof carMesh) =>
  group.traverse((o) => {
    o.castShadow = true; // la voiture projette son ombre sur la route (qualité ≥ 1)
  });
castShadows(carMesh);
const carShadow = createShadow();
view.scene.add(carShadow);
const ghostModel = createCarMesh(true);
const ghostMesh = ghostModel.group;
ghostMesh.visible = false;
view.scene.add(ghostMesh);
// Fantômes du Salon (lot 26) : plusieurs voitures translucides colorées, avec leur pseudo.
const ghostField = salonMod && salon ? new salonMod.GhostField() : null;
if (ghostField) view.scene.add(ghostField.group);

// --- Rendu, effets et sons (lot 9) : présentation seule, lecture seule de la simulation --------------------
// `?fx=off` coupe les effets ; `?quality=0|1|2` fige la qualité (sinon : réglage automatique selon la fluidité) ;
// `?shake=0` coupe les secousses de caméra ; `?demo` : le pilote automatique boucle sur le circuit.
const effects = new Effects(view.scene);
effects.enabled = params.get("fx") !== "off";
// Réglages du joueur (lot 29) : qualité, effets, secousses, sensation de vitesse, ombres… `?quality=`, `?fx=off` et `?shake=0` les surpassent (essais).
const settings: GameSettings = loadSettings();
const qualityParam = params.get("quality");
const qualityStart = qualityPlan(settings.quality, qualityParam);
const governor = new QualityGovernor(26, 19, qualityStart.fixed);
governor.level = qualityStart.level;
effects.quality = governor.level;
view.setQuality(governor.level, settings.shadows);
effects.particlesOn = settings.particles;
effects.skidMarksOn = settings.skids;
let shakeScale = params.get("shake") === "0" || !settings.shake ? 0 : 1;
/** Intensité de la sensation de vitesse (champ de vision, lignes, vibration) : 0 à 1,5. */
let feel = SPEED_FEEL_FACTOR[settings.speedFeel];
const demo = params.has("demo");
const tel = createTelemetry();
const gameAudio = new GameAudio(() => syncSoundButton());
gameAudio.setAmbience(track ? ambienceFor(salon?.circuit.palette ?? daily?.palette ?? "desert") : null); // ambiance du thème (lot 23)
const wheelDroop: [number, number, number, number] = [0, 0, 0, 0];
const WHEEL_F = [AXLE_FRONT, AXLE_FRONT, -AXLE_REAR, -AXLE_REAR];
const WHEEL_L = [HALF_TRACK, -HALF_TRACK, HALF_TRACK, -HALF_TRACK];
const wheelPose: WheelPose = { forward: 0, steerAngle: 0, braking: false, droop: wheelDroop, dt: 0 };
const ghostPose: WheelPose = { forward: 0, steerAngle: 0, braking: false, droop: [0, 0, 0, 0], dt: 0 };
const hudLines = document.getElementById("lines")!;
const hudFlash = document.getElementById("flash")!;
const hudFall = document.getElementById("fall")!;
let demoClock = 0;
let shake = 0;
let lastKerbBuzz = 0;
let lastGround = 0;
let fovKick = 0;
let flash = 0;
/** Chute en cours (voile sombre qui monte, caméra qui ne suit plus la voiture vers le bas) et opacité du voile. */
let wasFalling = false;
let fallVeil = 0;
let lastCountdown = 0;
/** Aide « le chrono tourne » déjà montrée pour cette tentative. */
let idleHintShown = false;
let demoReplay: PilotRun | null = null;
let demoTimer = 0;

// Classement : seulement pour le circuit du jour, et si une adresse d'API est configurée (`?api=` ou VITE_API_URL).
// Sans le planning de l'API (hors ligne, serveur muet, version différente) on ne sait pas quel circuit le serveur rejouera : pas de classement.
const online = new Online(track ? track.id : null, daily && !trial && planKnown ? daily.date : null);
// On ne peut classer que le circuit d'aujourd'hui (un jour passé est figé : le serveur refuse).
const submitAllowed = !!daily && daily.day === todayParis && !trial && planKnown && !online.demo;
// Outils de test (`?debug`) : accélérer le temps et jouer une rediffusion à la place du clavier.
const timeScale = params.has("debug") ? Math.max(1, Number(params.get("timescale")) || 1) : 1;
let autoplay: ReplayPlayer | null = null;

const camera = new PerspectiveCamera(65, 1, 0.1, 700);
function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  effects.setViewport(window.innerHeight, camera.fov, renderer.getPixelRatio());
  view.setView(window.innerHeight * renderer.getPixelRatio(), camera.fov);
}
window.addEventListener("resize", resize);
resize();

const $ = (id: string) => document.getElementById(id)!;
const hudSpeed = $("speed");
const hudTimerText = $("timer-texte");
const hudSpeedText = $("speed-texte");
/** Le chrono change à chaque image : on n'écrit dans le DOM que si le texte a changé. Seul le texte de la plaque change (`.plaque__chiffres`, largeur réservée, `contain` : hud.css) : la plaque et son liseré ne sont jamais repeints. */
let timerShown = "";
function setTimerText(text: string) {
  if (text === timerShown) return;
  timerShown = text;
  hudTimerText.textContent = text;
}
/** La vitesse de même : le texte seulement, et seulement s'il change. */
let speedShown = "";
function setSpeedText(text: string) {
  if (text === speedShown) return;
  speedShown = text;
  hudSpeedText.textContent = text;
}
/** La colonne du centre n'a son propre calque que pendant la course (hud.css : `body.en-course`) ; retiré dès que le jeu est gelé, en pause, à l'arrivée ou à l'accueil. */
let enCourse = false;
function syncCalqueHud(live: boolean) {
  if (live === enCourse) return;
  enCourse = live;
  document.body.classList.toggle("en-course", live);
}
const hudSplits = $("splits");
const hudBanner = $("banner");
const hudFinish = $("finish");
/** L'écran d'arrivée du circuit du jour : posé sur la scène (lot I4b), l'étiquette Track (arriveeUi.ts). */
const arrivee: Arrivee = creerArrivee(hudFinish);
const hudBoard = $("board");
const hudIntro = $("intro");
const hudAide = $("aide");
const rangBtn = $("rang") as HTMLButtonElement;
/** Classement en course : un panneau compact, replié ou déplié (réglage `board`). Le Salon y écrit aussi. */
const boardPanel = mountBoardPanel(hudBoard, (folded) => applySettings({ board: !folded }));
const hudArchive = $("archive");
let splash: HTMLElement | null = document.getElementById("splash");

// Titre du circuit (#meta : une petite plaque sous le chronomètre) et objectif de médaille (#medals : en haut à droite) — surimpressions de course, lot I4.
/** Les messages qui accompagnent le titre : essai, hors ligne, démonstration (clés du catalogue). */
function metaNotices(): string[] {
  if (!daily) return [];
  const notices: string[] = [];
  if (trial) notices.push(trialVariant !== null ? t(forcedTheme ? "course.notice.essaiVarianteTheme" : "course.notice.essaiVariante", { variante: trialVariant }) : t("course.notice.essaiTheme"));
  else if (!planKnown && !demoApiMode) notices.push(t("course.notice.horsLigne"));
  if (demoApiMode) notices.push(t("course.notice.demo"));
  if (seedParam !== null && seedDay === null && !addressNotice) notices.push(t("course.notice.dateInvalide"));
  return notices;
}

/** Le titre de la plaque `#meta` : « Circuit n° 8 · mar. 20 oct. · Canyon (hors ligne, non classé) » ; les scénarios d'essai ont leur nom. */
function renderHudTitle() {
  if (salon) return; // le Salon écrit son propre titre (salonMode.ts)
  const meta = $("meta");
  let text = "";
  if (daily) {
    const notices = metaNotices();
    const base = daily.number >= 1 ? t("course.meta.jour", { numero: fNumero(daily.number), date: fDateCourte(daily.day), theme: nomTheme(daily.theme) }) : t("course.meta.sansNumero", { date: fDateCourte(daily.day), theme: nomTheme(daily.theme) });
    text = notices.length ? `${base} (${notices.join(", ")})` : base;
  } else if (track) {
    text = scenario === "figure" ? t("course.scenario.figure", { nom: scenarios!.figureLabel(params.get("f")) }) : t(`course.scenario.${scenario === "bas-cotes" ? "basCotes" : scenario}`);
  }
  const notice = salonNotice || (addressNotice ? t(addressNotice) : "");
  if (notice) text += ` · ${notice}`;
  if (meta.textContent !== text) meta.textContent = text;
  renderObjective();
}

/** L'objectif de médaille : la première médaille que tu n'as pas encore (la plus haute si tu les as toutes : l'auteur reste à battre). */
const MEDAL_ORDER = ["bronze", "silver", "gold", "author"] as const;
function renderObjective() {
  const box = $("medals");
  if (!daily || salon) return;
  const mine = best ? (best.medal ?? medalFor(best.ms, daily.medals)) : null;
  const target = mine === null ? "bronze" : mine === "author" ? "author" : MEDAL_ORDER[MEDAL_ORDER.indexOf(mine) + 1]!;
  const type = typeDeMedaille(target);
  const name = nomMedaille(traducteurDuSocle(), type);
  const time = fTemps(daily.medals[target]);
  const key = `${target}|${time}|${langueCourante()}`;
  if (box.dataset.key === key) return;
  box.dataset.key = key;
  // Charte rév. 7 : pastille et seuil, sans le mot « Objectif » ; le nom de la médaille est dans le libellé pour les lecteurs d'écran.
  const legend = makeEl("span", "objectif__legende");
  legend.append(Object.assign(makeEl("span", `pastille pastille--${type}`), { ariaHidden: "true" }));
  box.replaceChildren(legend, makeEl("span", "objectif__valeur", time));
  box.setAttribute("aria-label", t("course.objectif.aria", { medaille: name, temps: time }));
}

// --- Surimpressions compactes (charte rév. 7, § 9) ---------------------------------------------------------------------------------------------------------
// Pause, dernier point de contrôle et recommencer en haut à gauche (les deux derniers sur appareil tactile seulement : le clavier a ses touches) ; la barre du bas n'existe plus.
(function mountMenuActions() {
  const menu = $("menu");
  const bouton = (id: string, icon: SVGSVGElement, cle: string, onClick: () => void, tactile = true) => {
    const b = makeEl("button", tactile ? "plaque plaque--bouton plaque--action" : "plaque plaque--bouton");
    b.type = "button";
    b.id = id;
    b.setAttribute("data-t-aria-label", cle);
    b.append(icon);
    b.addEventListener("click", () => {
      b.blur();
      onClick();
    });
    menu.append(b);
  };
  bouton("btn-respawn", icone("drapeau", { taille: 20 }), "tactile.pointDeControle", () => {
    if (!watch && !paused) controls.requestRespawn();
  });
  bouton("btn-restart", iconeTrack("recommencer", 20), "tactile.depart", () => {
    if (!watch) controls.requestRestart();
  });
  // Lot I7 : la caméra (celle de la touche C et de la pause, même fonction) et le plein écran restent en vue, à droite de la pause.
  bouton("btn-camera", icone("camera", { taille: 20 }), "course.camera.proche", () => cycleCamera(), false);
  $("btn-camera").removeAttribute("data-t-aria-label"); // son nom lu porte la caméra courante : `syncCameraButton`
  menu.append(boutonPleinEcran({ t, id: "btn-fullscreen", classe: ["plaque", "plaque--bouton"] }));
  appliquerTextes(menu);
})();
onLangue(majPleinEcran);

/**
 * Le bouton caméra (lot I7) : son nom lu suit la caméra courante (touche C, pause, réglages, démo : une seule vérité, `cameraIndex`) ; il tient dans la rangée du haut à gauche
 * tant que celle-ci laisse la place à la bande du centre (`BANDE_MAX_PX`), sinon il passe en tête du groupe de droite. Appelé à chaque image : ne touche au DOM que si la clé change.
 */
const BANDE_MAX_PX = 300;
const cameraBtn = $("btn-camera");
let cameraShown = "";
function syncCameraButton() {
  const rangee = 1 + (document.body.classList.contains("touch") ? 2 : 0) + (pleinEcranPossible() ? 1 : 0) + 1; // pause, [point de contrôle, recommencer], caméra, [plein écran]
  const dansLaRangee = 10 + rangee * 44 + (rangee - 1) * 6 <= innerWidth / 2 - BANDE_MAX_PX / 2 - 6;
  const key = `${cameraIndex}|${langueCourante()}|${dansLaRangee}`;
  if (key === cameraShown) return;
  cameraShown = key;
  cameraBtn.setAttribute("aria-label", t(`course.camera.${CAMERAS[cameraIndex]!.name}`));
  if (dansLaRangee) $("menu").insertBefore(cameraBtn, $("btn-fullscreen"));
  else $("hud-droite").prepend(cameraBtn);
}

/** Ta place dans le classement du jour (la dernière lue) : la pastille « 14e ˅ » du haut à droite l'affiche ; le Salon donne celle de la session (`salon.myRank`). */
let dayRank: number | null = null;
let rangShown = "";
function syncRang() {
  const rank = salon ? (salon.myRank?.rank ?? null) : dayRank;
  const key = `${rank}|${boardPanel.folded()}|${langueCourante()}|${hudBoard.hidden}`;
  if (key === rangShown) return;
  rangShown = key;
  const text = rank === null ? "" : fRang(rank);
  rangBtn.hidden = !text || hudBoard.hidden;
  rangBtn.setAttribute("aria-expanded", String(!boardPanel.folded()));
  rangBtn.setAttribute("aria-label", t(salon ? "course.rang.salon.aria" : "course.rang.aria", { rang: text }));
  const chevron = icone("chevron", { taille: 12 });
  chevron.classList.add("rang__chevron");
  rangBtn.replaceChildren(makeEl("span", "rang__rang", text), chevron);
}
rangBtn.addEventListener("click", () => {
  rangBtn.blur();
  setBoardVisible(boardPanel.folded());
});

/** Une ligne d'aide sous la bande, puis elle disparaît (au premier appui sur le gaz, ou après quelques secondes). */
let aideTimer = 0;
/** Le temps de l'image où l'aide apparaît ne compte pas (en pas à pas, une image porte tout le décompte). */
let aideFraiche = false;
function showAide(text: string, seconds: number) {
  hudAide.textContent = text;
  aideTimer = seconds;
  aideFraiche = true;
}
const clearAide = () => {
  aideTimer = 0;
  if (hudAide.textContent) hudAide.textContent = "";
};
/** Le titre du circuit et le fantôme ne s'affichent qu'au départ (décompte, puis une seconde et demie) : la plaque `#intro`. */
let introShown = false;
function syncIntro() {
  const on = !watch && !!race && (phase === "countdown" || (phase === "racing" && raceElapsedMs(race) < 1500));
  if (on === introShown) return;
  introShown = on;
  hudIntro.classList.toggle("on", on);
}

if (salon) {
  $("meta").textContent = salon.title();
  onLangue(() => ($("meta").textContent = salon!.title()));
  salon.dom = { countdown: $("medals"), finale: $("finale"), board: boardPanel, podium: $("podium") };
}
function updateInfo() {
  // La ligne d'aide minuscule des lots précédents est remplacée par « Comment jouer » (bouton en bas à gauche, page d'aide, pause).
  // Seul le spectateur (lot 27b) garde un rappel de ses touches : elles ne sont nulle part ailleurs.
  $("info").textContent = watch ? t("revoir.touches") : "";
}

// --- État de la partie ----------------------------------------------------------------------
type Phase = "countdown" | "racing" | "finished";

// Commandes tactiles : appareil tactile (`pointer: coarse`) ou `?touch=1`. Mêmes axes que le clavier et la manette.
const touchMode = wantsTouch(params, matchMedia("(pointer: coarse)").matches);
const touchPad = touchMode ? new TouchPad(loadTouchSettings()) : null;
// `?steer=boutons|glisser` force le mode de direction (essais et diagnostic) ; `?zones=1` dessine les zones actives.
const steerParam = params.get("steer");
if (touchPad && (steerParam === "boutons" || steerParam === "glisser")) touchPad.settings.steerMode = steerParam === "boutons" ? "buttons" : "drag";
const controls = new Controls(window, touchPad);
if (touchMode) document.body.classList.add("touch");
let paused = false;
// --- Revoir le meilleur tour (lot 27b) ---------------------------------------------------------------------------------------
// Le spectateur rejoue une rediffusion avec le même code que le fantôme et que le serveur : la voiture « du joueur » est celle du tour
// regardé, poussée par les commandes enregistrées (`autoplay`). Rien n'est envoyé au serveur ni enregistré ; `packages/sim` n'a pas bougé.
interface WatchState {
  entry: WatchEntry;
  replay: ReturnType<typeof decodeReplay>;
  /** Nombre de pas de la rediffusion (le dernier est celui de l'arrivée). */
  total: number;
  speed: WatchSpeed;
  paused: boolean;
}
let watch: WatchState | null = null;
/** Salon : aucun temps dans la session pour l'instant, la lecture commence dès qu'il y en a un. */
let watchWait = false;
let watchUi: WatchUi | null = null;
let nameLabel: NameLabel | null = null;
/** Caméra libre (autour de la voiture) : lacet, hauteur et distance, réglés au doigt ou à la souris. */
let freeCam = false;
const orbit = { yaw: 0, pitch: 0.4, dist: 12 };
/** Position de la barre de progression à rejouer à la prochaine image (déplacée à la souris : au plus un rejeu par image). */
let pendingSeek: number | null = null;
// En spectateur (lot 27b), pas de commandes de conduite : aucune zone tactile, donc aucune frontière entre zones à éviter ; elles sont
// montées si l'on repart courir (ou si la rediffusion est introuvable).
let touchUi: ReturnType<typeof mountTouchUi> | null = null;
function mountDrivingTouch() {
  if (touchUi || !touchPad) return;
  touchUi = mountTouchUi(touchPad, { showZones: params.get("zones") === "1" });
  touchUi.setPaused(paused);
}
if (!watchWanted) mountDrivingTouch();
// Outil de test (`?debug`) : « pas à pas ». La simulation n'avance plus avec l'horloge mais d'un nombre exact de pas
// à chaque `__cdj.advance(n)` ; les commandes sont lues comme d'habitude (clavier, doigts…). Un test ne dépend ainsi
// plus de la vitesse de la machine.
let manual = false;
let manualTicks = 0;
let manualWaiters: (() => void)[] = [];
/** Dernière commande appliquée à la simulation (outil de test : `__cdj.input`). */
let lastInput: CarInput = { steer: 0, throttle: 0, brake: 0, respawn: 0 };
let lastImpactAt = -1e9;
/** Dernière réception (force de chute et qualité d'alignement, ∈ [0, 1]) : outil de test `__cdj.air`. */
let lastLanding = { strength: 0, quality: 1 };
let lastImpactSoundAt = -1e9;

function setPaused(value: boolean) {
  if (watch) {
    watch.paused = value; // la pause du spectateur : pas de fenêtre, la barre de lecture reste là
    return;
  }
  if (value && (phase === "finished" || homeOpen || settingsPanel?.isOpen() || howto.isOpen())) return;
  paused = value;
  document.body.classList.toggle("paused", paused);
  touchUi?.setPaused(paused);
  if (!paused) showPauseConfirm(false);
  else renderPause();
}

/** Le contenu vivant du dialogue de pause : le circuit, ton record, le fantôme et le son (le reste est du HTML fixe, traduit par `data-t`). */
function renderPause() {
  const info = $("pause-info");
  const circuit = daily ? (daily.number >= 1 ? t("pause.info.circuit", { numero: fNumero(daily.number), theme: nomTheme(daily.theme) }) : t("pause.info.circuitSansNumero", { theme: nomTheme(daily.theme) })) : $("meta").textContent ?? "";
  const record = best && !salon ? makeEl("span", "", `${t("pause.info.record")} `) : null;
  if (record) record.append(makeEl("b", "", fTemps(best!.ms)));
  info.replaceChildren(makeEl("span", "", circuit), ...(record ? [record] : []));
  const ghostBtn = $("pause-ghost");
  ghostBtn.textContent = t("pause.fantome", { nom: ghostText(ghostTag) });
  ghostBtn.hidden = !track;
  $("pause-camera").textContent = t(`course.camera.${CAMERAS[cameraIndex]!.name}`);
  syncSoundButton();
}
let best: BestRun | null = track && !salon ? loadBest(track.id) : null;
// Fantôme affiché : son record par défaut (`G` pour passer au premier, au joueur devant, ou à aucun).
let ghostMode: GhostMode = params.get("ghost") === "off" || settings.ghost === "none" ? "off" : "mine";
let ghostSource: BestRun | null = ghostMode === "mine" ? best : null;
/** Le fantôme choisi, sans texte : le nom s'écrit à l'affichage, dans la langue courante (`ghostText`). */
type GhostTag = { mode: GhostMode; name?: string; custom?: string };
let ghostTag: GhostTag = { mode: "mine" };
const ghostText = (g: GhostTag): string => g.custom ?? (g.mode === "mine" ? t("course.fantome.tonRecord") : g.mode === "off" ? t("course.fantome.aucun") : t(g.mode === "first" ? "course.fantome.premier" : "course.fantome.devantToi", { nom: g.name ?? "" }));
let ghostBusy = false;
let session: RunSession | null = track ? new RunSession(track, ghostSource, carParams) : null;
// Vrai si cette tentative a roulé, ne serait-ce qu'un instant, avec des réglages modifiés : ni record, ni classement.
let tunedRun = !isDefaultParams(carParams);
// Le fantôme qui roule vraiment dans cette tentative, et celui choisi en cours de course (effectif au prochain départ).
type GhostLabel = { tag: GhostTag; ms: number | null };
let activeGhost: GhostLabel | null = session?.ghost && ghostSource ? { tag: ghostTag, ms: ghostSource.ms } : null;
let pendingGhost: GhostLabel | null = null;
let race: RaceState | null = session ? session.race : null;
let car: CarState = race ? race.car : createCar();
let previous: CarState = session ? session.previous : createCar();
copyCar(car, previous); // sinon la voiture s'afficherait à l'origine pendant le décompte
updateInfo();
renderHudTitle();
let phase: Phase = track ? "countdown" : "racing";
let countdown = COUNTDOWN_S;
let bannerTimer = 0;
let accumulator = 0;
let pendingRespawn = false;
let shownSplits = 0;
let lastRespawns = 0;

// --- Écrans : accueil, réglages, aide, pause (lot 29) --------------------------------------------------------------------------
// Tout ce qui suit est de la présentation : rien ici ne touche à la simulation (les mêmes commandes, les mêmes rediffusions).
let settingsPanel: ReturnType<typeof mountSettings> | null = null;
const howto = mountHowto(document.body, touchMode ? "touch" : "keyboard", { onSeen: () => markHowtoSeen() });
/** L'aide s'ouvre d'elle-même à la première visite ; pas pour les liens de test (`?debug`, sauf `?howto=1`). */
const autoHowto = !howtoSeen() && (!params.has("debug") || params.get("howto") === "1");
const needsHowto = () => autoHowto && !howtoSeen();

/** Applique un changement de réglage tout de suite (qualité, effets, secousses, sensation de vitesse, ombres, classement…), puis le mémorise. */
function applySettings(patch: Partial<GameSettings> = {}) {
  const wasQuality = settings.quality;
  Object.assign(settings, patch);
  saveSettings(settings);
  const plan = qualityPlan(settings.quality, qualityParam);
  governor.locked = plan.fixed;
  if (plan.fixed || wasQuality !== settings.quality) governor.level = plan.level; // retour à l'automatique : on repart de haut, la fluidité redescendra si besoin
  effects.quality = governor.level;
  syncSceneQuality();
  effects.particlesOn = settings.particles;
  effects.skidMarksOn = settings.skids;
  shakeScale = params.get("shake") === "0" || !settings.shake ? 0 : 1;
  feel = SPEED_FEEL_FACTOR[settings.speedFeel];
  document.body.classList.toggle("no-splits", !settings.splits);
  syncBoardFold();
  if ("ghost" in patch) applyGhostSetting();
  settingsPanel?.sync();
}

/** Qualité de la scène : celle du jeu, sauf derrière l'accueil, où elle ne dépasse pas « moyenne » (« basse » sur appareil tactile : la batterie d'abord). */
function syncSceneQuality() {
  const level = (homeOpen ? Math.min(governor.level, touchMode ? 0 : 1) : governor.level) as Quality;
  view.setQuality(level, settings.shadows);
}

function setCameraByName(name: string) {
  cameraIndex = cameraIndexOf(name);
  snapCamera = true;
  try {
    gameStorage().setItem("cdj:camera", CAMERAS[cameraIndex]!.name);
  } catch {
    /* tant pis */
  }
}

settingsPanel = mountSettings(document.body, {
  settings,
  apply: applySettings,
  audio: () => gameAudio.settings,
  setAudio: (a) => gameAudio.setSettings(a),
  camera: () => CAMERAS[cameraIndex]!.name,
  setCamera: setCameraByName,
  qualityLevel: () => governor.level,
  touch: touchPad ? { pad: touchPad, changed: () => touchUi?.refresh() } : null,
  qualityFromUrl: qualityParam === "0" || qualityParam === "1" || qualityParam === "2",
  openHowto: () => howto.open(),
});
function openSettings(tab?: SettingsTab) {
  showPauseConfirm(false);
  settingsPanel!.open(tab);
}

// Pause : Reprendre, Recommencer, Dernier point de contrôle, Réglages, Comment jouer, Archives, Accueil (avec confirmation si une course est en cours).
function showPauseConfirm(show: boolean) {
  $("pause-menu").hidden = show;
  $("pause-confirm").hidden = !show;
}
$("pause-resume").addEventListener("click", () => setPaused(false));
// Lot I6 : la pause est un dialogue : le focus va sur « Reprendre » à l'ouverture et revient à la partie à la fermeture (`suivreDialogue`).
suivreDialogue($("pause"), { ouvert: () => paused, observer: [document.body], focusInitial: () => $("pause-resume") });
$("pause-restart").addEventListener("click", () => controls.requestRestart());
$("btn-pause").addEventListener("click", () => {
  ($("btn-pause") as HTMLButtonElement).blur();
  setPaused(!paused);
});
$("pause-ghost").addEventListener("click", () => {
  ghostAction();
  setTimeout(renderPause, 300); // le fantôme choisi s'écrit quand la réponse du serveur arrive
});
$("pause-sound").addEventListener("click", () => gameAudio.mute());
$("pause-camera").addEventListener("click", () => {
  cycleCamera();
  renderPause();
});
// Lot I7 : le plein écran de la pause est le bouton du socle, en texte (même logique que celui du HUD et de l'accueil).
$("pause-fullscreen").replaceWith(boutonPleinEcran({ t, id: "pause-fullscreen", classe: ["dj-bouton", "dj-bouton--secondaire"], texte: true }));
$("pause-respawn").addEventListener("click", () => {
  setPaused(false);
  controls.requestRespawn();
});
$("pause-settings").addEventListener("click", () => openSettings());
$("pause-howto").addEventListener("click", () => howto.open());
$("pause-archive").addEventListener("click", () => openArchive());
$("pause-archive").hidden = !!salon; // le Salon n'a pas d'archives
$("pause-home").addEventListener("click", () => goHome());
$("pause-stay").addEventListener("click", () => showPauseConfirm(false));
$("pause-leave").addEventListener("click", () => leaveToHome());
$("helpchip").addEventListener("click", () => howto.open());

/** Une course est en cours (décompte passé, arrivée pas franchie) : quitter la fait perdre ce tour. */
const raceInProgress = () => !watch && phase === "racing" && !!race && race.finishMs < 0;

/** « Accueil » (barre du haut, pause) : avec confirmation si une course est en cours. */
function goHome() {
  if (raceInProgress()) {
    setPaused(true);
    showPauseConfirm(true);
    return;
  }
  leaveToHome();
}

/** Revient à l'accueil : sur place pour le circuit du jour (rien à recharger), par la page sinon (Salon, archive, scénario, rediffusion). */
function leaveToHome() {
  if (!homeAllowed) {
    location.assign(homeHref(location.search));
    return;
  }
  settingsPanel?.close();
  howto.close();
  closeArchive();
  showPauseConfirm(false);
  startAttempt(); // la voiture revient au départ, le décompte attendra le bouton « Circuit du jour »
  homeOpen = true;
  syncSceneQuality();
  homeUi.open();
  void syncProfile(); // un temps battu sur un autre appareil apparaît ici
}

function playDaily() {
  homeOpen = false;
  syncSceneQuality();
  homeUi.close();
  startAttempt();
  snapCamera = true;
  // Première fois : « Comment jouer » s'ouvre **dans le jeu**, sur la scène, le jeu gelé dessous ; « C'est parti » la ferme et le décompte démarre (charte rév. 7, § 9).
  if (needsHowto()) howto.open();
}

/** Le Salon est une autre page : l'aide s'y ouvre d'elle-même au chargement (même règle que pour un lien direct), pas ici sur l'accueil. */
function playSalon() {
  location.assign(modeHref(location.search, true));
}

/** Classement du jour (accueil, coin de la course) : en démonstration, « aujourd'hui » est vide, on montre alors la veille (figée). */
async function fetchBoard(limit: number) {
  const r = await online.leaderboard(limit);
  if (online.demo && r.ok && r.data.participants === 0 && online.api) {
    const yesterday = await online.api.leaderboard(formatDay(todayParis - 1), online.playerId, limit);
    if (yesterday.ok) return yesterday;
  }
  return r;
}
const homeLeaderboard = (limit: number) => fetchBoard(limit);
const noBoardReason = apiBase() === null ? "sans_serveur" : "hors_ligne";

const homeUi: HomeUi = mountHome($("home"), {
  daily: {
    get number() {
      return daily?.number ?? 0;
    },
    get date() {
      return daily?.date ?? "";
    },
    get theme() {
      return daily?.theme ?? "stade"; // sans circuit du jour (Salon, essai, rediffusion) l'accueil ne s'ouvre jamais : ses textes sont seulement montés
    },
    get medals() {
      return daily!.medals;
    },
  },
  best: () => (best ? { ms: best.ms, medal: best.medal ?? (daily ? medalFor(best.ms, daily.medals) : null) } : null),
  leaderboard: online.enabled ? homeLeaderboard : null,
  noBoardReason,
  // Compte à rebours jusqu'à minuit de Paris : seulement pour le vrai « aujourd'hui » (pas en démonstration ni avec `?today=`).
  msUntilNextDay: () => {
    if (!daily || todayParis !== realToday || daily.day !== todayParis) return null;
    return parisDay(Date.now()) !== todayParis ? 0 : msUntilNextParisDay(Date.now()); // page restée ouverte après minuit : le nouveau circuit
  },
  onNewDay: () => location.reload(),
  salon: () => lookupSalon(apiBase(), sessionMsFromParams(location.search)),
  preview: () =>
    daily && thumbsParam !== "off"
      ? thumbService.request({ day: daily.day, theme: daily.forcedTheme ? daily.theme : null, variant: daily.variant, circuit: { track: daily.track, palette: daily.palette, theme: daily.theme } }, () => homeOpen)
      : Promise.resolve(null),
  profileHref: () => profilHref(location.origin, location.pathname),
  touch: touchMode,
  playDaily,
  playSalon,
  watchBest: () => location.assign(watchHref(location.search)),
  openArchive: () => openArchive(),
  openSettings: () => openSettings(),
  openHowto: () => howto.open(),
  openBoard: () => boardScreen.open(),
});
// Le classement du jour en pleine page (lot I4) : ouvert depuis l'accueil, fermé par « ‹ TRACK » ou Échap.
const boardScreen = mountBoardScreen({
  daily: {
    get theme() {
      return daily?.theme ?? "stade";
    },
    get date() {
      return daily?.date ?? "";
    },
  },
  leaderboard: online.enabled ? homeLeaderboard : null,
  noBoardReason,
  watchBest: () => location.assign(watchHref(location.search)),
});

// --- Synchronisation du profil (lot 30) -------------------------------------------------------------------
// Le serveur fait foi, le stockage local n'est qu'un cache : au lancement et au retour sur l'accueil, le jeu fusionne le profil du serveur
// (pseudo, meilleur temps du jour et sa rediffusion, temps des jours passés, meilleure place) avec le cache — le meilleur gagne — puis envoie au
// serveur un record local qu'il n'a pas (fait hors ligne) : il le rejoue. Rien de tout cela ne touche à la simulation.

/** Le cache a reçu un record du serveur : fantôme « ton record », accueil et réglages le montrent. */
function applySyncedRecord() {
  if (!track || salon || watch) return;
  const fresh = loadBest(track.id);
  if (fresh && (!best || fresh.ms !== best.ms || fresh.replay !== best.replay)) {
    best = fresh;
    if (ghostMode === "mine") {
      ghostSource = best;
      if (homeOpen || phase === "countdown") startAttempt(); // aucune course en cours : on repart avec le fantôme du serveur
    }
  }
  homeUi.refresh({ board: true }); // ton temps (et donc ta place) vient peut-être de changer
  settingsPanel?.sync();
}

async function syncProfile(force = false) {
  if (!track || !daily || trial || salon || watch || online.demo || !online.profileApi) return;
  const o = await online.sync.run({ force });
  if (!o.ran) return;
  if (o.merged && (o.merged.todayChanged || o.merged.pastChanged > 0 || o.merged.nameChanged)) applySyncedRecord();
  // Un record local que le serveur n'a pas (fait hors ligne, ou avant que le serveur ne réponde) part maintenant : il le rejoue et le classe.
  if (o.status !== "revoked" && submitAllowed && best && online.name && online.needsSubmit(best)) {
    const r = await online.submit(best, online.name);
    if (r.ok) {
      online.sync.noteNameProblem(null);
      rememberRank(daily.date, { rank: r.data.rank, participants: r.data.participants });
      lastRank = { rank: r.data.rank, participants: r.data.participants };
      homeUi.refresh({ board: true });
    } else if (r.code === "name_taken") {
      online.sync.noteNameProblem({ message: r.message, suggestions: r.suggestions ?? [] }); // la carte du profil propose un autre pseudo ou le code
    }
  }
}

/** « Charger un code » (depuis un message d'erreur qui y mène) : lot I4, le code se charge dans le profil commun du portail (`/profil/`), qui ramène au jeu. */
function openLoadCode() {
  location.assign(profilHref(location.origin, location.pathname));
}

// --- Partage et archives --------------------------------------------------------------------
let lastRank: { rank: number; participants: number } | null = null;
let shareEl: HTMLElement | null = null;
/** Lot I3 de la plateforme : l'emplacement de « Jeu suivant du jour » de l'écran d'arrivée en cours (rempli une fois le classement connu). */
let finishNext: HTMLElement | null = null;
/** « Jeu suivant du jour » (lot I3) : une lecture de `GET /api/portail/jour` après l'envoi accepté, jamais d'une connaissance codée de l'autre jeu ; serveur injoignable : rien. */
async function showNextGame(): Promise<void> {
  const box = finishNext;
  const base = apiBase();
  if (!box || box.dataset.lu || !base || base === DEMO_BASE || online.demo) return;
  box.dataset.lu = "1";
  const suite = await lireSuite(base, online.playerId, "cdj");
  if (!suite || finishNext !== box || phase !== "finished" || !box.isConnected) return;
  box.replaceChildren(...elementsDeSuite(suite));
  box.hidden = false;
}

/** Le résultat à partager : le meilleur temps du jour, avec sa médaille et son rang si le serveur l'a donné. */
function currentShare(): ShareResult | null {
  if (!daily || !best) return null;
  return { number: daily.number, date: daily.date, ms: best.ms, medal: medalFor(best.ms, daily.medals), rank: lastRank?.rank ?? null, participants: lastRank?.participants ?? null };
}

function updateShareLine() {
  const share = currentShare();
  if (shareEl && share) shareEl.textContent = shareLine(share);
}

const shareLink = () => shareUrl(location, daily!.date, daily!.day === todayParis);

// Miniatures (lot 13) : fabriquées à la demande, une par une, jamais pendant une course (sauf si tout est gelé : pause, ou
// fenêtre ouverte au toucher). `?thumbs=2d|top` : repli 2D / vue d'aplomb (essais) ; `?thumbs=off` les coupe.
const thumbsParam = params.get("thumbs");
const thumbService = createThumbnailService(() => phase !== "racing" || isFrozen(), window.devicePixelRatio, {
  webgl: thumbsParam !== "2d",
  view: thumbsParam === "top" ? "top" : "tilted",
});
// Les jours remplacés par l'admin ont une autre miniature : le planning public est demandé à l'ouverture des archives
// (les miniatures attendent son arrivée ; sans lui on ne montrerait que le circuit d'origine).
let archivePlan: Map<string, PlanEntry> = new Map();
let archivePlanReady = apiBase() === null;
let archivePlanLoad: Promise<void> | null = null;
function loadArchivePlan(): Promise<void> {
  const base = apiBase();
  if (!base) return Promise.resolve();
  return (archivePlanLoad ??= (async () => {
    archivePlan = base === DEMO_BASE ? loadDemoPlan() : ((await fetchPlanning(base)) ?? new Map());
    archivePlanReady = true;
  })());
}
const dayJob = (d: { day: number }): ThumbJob => {
  const p = archivePlan.get(formatDay(d.day));
  return { day: d.day, ...(p ? { variant: p.variant, theme: p.theme } : {}) };
};
const thumbSource: ThumbSource | null =
  thumbsParam === "off"
    ? null
    : {
        peek: (d) => (archivePlanReady ? thumbService.peek(dayJob(d)) : null),
        request: async (d, wanted) => {
          await loadArchivePlan();
          return wanted() ? thumbService.request(dayJob(d), wanted) : null;
        },
      };

// Ouvrir un jour passé (ou un circuit d'essai) : sa miniature s'affiche pendant le décompte, jamais une fois la course lancée.
const hudDayCard = $("daycard");
let dayCardShown = false;
if (daily && !daily.fallback && daily.day !== todayParis && thumbsParam !== "off") {
  const circuit = { track: daily.track, palette: daily.palette, theme: daily.theme };
  void thumbService.request({ day: daily.day, theme: daily.forcedTheme ? daily.theme : null, variant: daily.variant, circuit }, () => phase === "countdown").then((url) => {
    if (!url) return;
    const img = new Image();
    img.alt = t("miniature.alt", { date: daily!.date });
    img.src = url;
    hudDayCard.replaceChildren(img);
    dayCardShown = true;
  });
}

function openArchive() {
  const days = archiveDays(todayParis, listDayBests());
  let shownExtras: ArchiveArgs["extras"] = null;
  const draw = (extras: ArchiveArgs["extras"]) =>
    archiveView.render({ days, search: location.search, currentDate: daily?.date ?? null, currentTheme: forcedTheme?.name ?? null, extras: (shownExtras = extras ?? shownExtras), thumbs: thumbSource, trialTools: trialKeysAllowed(restricted) });
  draw(null);
  hudArchive.hidden = false;
  void loadArchivePlan().then(() => {
    if (!hudArchive.hidden) draw(null); // les miniatures des jours remplacés sont maintenant connues
  });
  // Seuils de médailles, nombre de pilotes et ta place figée : chargés après coup (jeu de données de démo ou API).
  void loadArchiveExtras(days).then((extras) => {
    if (extras && !hudArchive.hidden) draw(extras);
  });
}

function closeArchive() {
  hudArchive.hidden = true;
  disposeArchive(); // plus de miniature demandée ; ce qui n'a pas commencé est abandonné
  thumbService.clearQueue();
}
// Les archives (lot I4) : un sous-écran posé sur la scène (lot I4b), « ‹ TRACK » ou Échap les ferme.
const archiveView = mountArchive(hudArchive, closeArchive);

/** Finale du Salon (lot 31) : plus aucun départ dans les 15 dernières secondes (ni au clavier, ni à la manette, ni au doigt). */
let startLocked = false;

function startAttempt(force = false) {
  if (watch) return restartWatch(0); // spectateur : « recommencer » = la rediffusion repart du début
  if (!force && salon && salon.state !== "playing") return; // podium, bascule : pas de nouveau départ
  if (!force && startLocked) {
    showBanner("Dernière chance : plus de départ", 1.6, true);
    return;
  }
  if (track) {
    session = new RunSession(track, ghostSource, carParams);
    ghostField?.restart(track); // Salon : les fantômes des autres repartent avec toi
    activeGhost = session.ghost && ghostSource ? { tag: ghostTag, ms: ghostSource.ms } : null;
    pendingGhost = null;
    race = session.race;
    car = race.car;
    previous = session.previous;
    phase = "countdown";
    countdown = COUNTDOWN_S;
    clearAide();
  } else {
    car = createCar();
    previous = createCar();
  }
  copyCar(car, previous);
  updateInfo();
  updateGhostInfo();
  setPaused(false);
  touchPad?.releaseAll();
  tunedRun = !isDefaultParams(carParams);
  updateTunedLabel();
  autoplay = null;
  lastRank = null;
  shareEl = null;
  finishNext = null;
  accumulator = 0;
  pendingRespawn = false;
  shownSplits = 0;
  lastRespawns = 0;
  snapCamera = true;
  effects.reset();
  lastCountdown = 0;
  idleHintShown = false;
  shake = 0;
  demoTimer = 0;
  if (demo && track && demoReplay) autoplay = new ReplayPlayer(demoReplay.replay); // la démo : le pilote reprend à chaque tour
  hudSplits.replaceChildren();
  hudFinish.hidden = true;
  document.body.classList.remove("finished");
  bannerTimer = 0;
}

/** Bandeau « réglages modifiés » : rappelle qu'une course réglée n'est ni classée ni enregistrée. */
function updateTunedLabel() {
  $("tuned").textContent = tunedRun ? t("course.notice.reglages") : "";
}

if (tuning) {
  tune!.mountTunePanel($("tune"), carParams, () => {
    if (phase !== "finished") tunedRun = true; // la course en cours a roulé avec ces réglages
    updateTunedLabel();
  });
}
updateTunedLabel();

// Changer de langue (Réglages › Langue) met les surimpressions à jour sans recharger : titre, objectif, point de contrôle, fantôme, pause, effets.
onLangue(() => {
  renderHudTitle();
  renderSplits();
  updateGhostInfo();
  updateTunedLabel();
  renderPause();
  updateInfo();
  fxShown = "";
  timerShown = "";
});

function showBanner(text: string, seconds: number, small = false) {
  hudBanner.textContent = text;
  hudBanner.classList.toggle("small", small);
  bannerTimer = seconds;
}

/** La plaque « vs ton record · 31,402 s » : le fantôme qui roule, et — si on en a choisi un autre en pleine course — celui du prochain départ. */
function updateGhostInfo() {
  const el = $("ghostinfo");
  if (watch) return el.replaceChildren(watchTitle(watch.entry.name, watch.entry.ms));
  if (!activeGhost && !pendingGhost) return el.replaceChildren();
  const now = activeGhost ? `${ghostText(activeGhost.tag)}${activeGhost.ms !== null ? ` · ${fTemps(activeGhost.ms)}` : ""}` : t("course.fantome.aucun");
  const text = pendingGhost ? t("course.fantome.vsPuis", { nom: now, suivant: ghostText(pendingGhost.tag) }) : t("course.fantome.vs", { nom: now });
  if (el.textContent !== text) el.textContent = text;
}

/** Choisit le fantôme : `tag` dit lequel (son texte est écrit à l'affichage) ; une chaîne vient d'un appelant qui a déjà son texte (Salon, rediffusion). */
function setGhost(mode: GhostMode, source: BestRun | null, tag: GhostTag | string) {
  const chosen: GhostTag = typeof tag === "string" ? { mode, custom: tag } : tag;
  ghostMode = mode;
  ghostSource = source;
  ghostTag = chosen;
  if (phase === "racing") {
    pendingGhost = { tag: chosen, ms: source ? source.ms : null };
    updateGhostInfo();
    showBanner(t("course.fantome.suivant", { nom: ghostText(chosen) }), 2, true);
  } else {
    startAttempt(); // pas de course en cours : on repart tout de suite avec le nouveau fantôme
    showBanner(t("course.fantome.annonce", { nom: ghostText(chosen) }), 1.6, true);
  }
}

/** `G` : fantôme suivant (son record → le premier → le joueur devant → aucun), en sautant ceux qui n'existent pas. */
async function cycleGhost() {
  if (!track || ghostBusy) return;
  ghostBusy = true;
  try {
    const modes = ghostModes(!!best?.replay, online.enabled);
    let mode = ghostMode;
    for (let i = 0; i < modes.length; i++) {
      mode = nextGhostMode(mode, modes);
      if (mode === "off") return setGhost("off", null, { mode: "off" });
      if (mode === "mine") return setGhost("mine", best, { mode: "mine" });
      const choice = await online.remoteGhost(mode);
      if (choice) return setGhost(choice.mode, choice.source, { mode: choice.mode, name: choice.name });
      showBanner(t(mode === "first" ? "course.fantome.pasDePremier" : "course.fantome.personneDevant"), 1.4, true);
    }
  } finally {
    ghostBusy = false;
  }
}

// --- Classement -----------------------------------------------------------------------------
// Affiché par défaut dans un coin (du jour, ou de la session dans le Salon), repliable (touche L, bouton de l'en-tête) ; le choix est mémorisé.
const boardAvailable = () => online.enabled || !!salon;
const boardOpen = () => !boardPanel.folded();
const compactScreen = () => matchMedia("(max-width: 900px), (max-height: 520px)").matches;
/** Combien de lignes en course (le coin est petit : 3 sur petit écran, 5 sinon) ; l'accueil en montre dix. */
const boardRows = () => (compactScreen() ? 3 : 5);
let boardLoadedAt = -1e9;

function renderBoard(lb: Leaderboard) {
  boardPanel.setTitle(boardTitle(lb, submitAllowed));
  if (lb.me) {
    dayRank = lb.me.rank;
    rememberRank(lb.date, { rank: lb.me.rank, participants: lb.participants }); // le profil garde ta meilleure place
  }
  boardPanel.body.replaceChildren(...linesEls(dayLines(lb), { compact: true }), ...(lb.participants > 0 && !watch ? [watchLinkEl(watchHref(location.search))] : []));
}

async function refreshBoard() {
  if (!online.enabled) return;
  boardLoadedAt = performance.now();
  const r = await fetchBoard(boardRows());
  if (r.ok) renderBoard(r.data);
  else boardPanel.body.replaceChildren(boardErrorEl(r.code));
}

/** Affiche ou masque le panneau (rien à montrer sans classement) et le plie selon le réglage ; le Salon est prévenu pour son rythme de mise à jour. */
function syncBoardFold() {
  hudBoard.hidden = !boardAvailable();
  boardPanel.setFolded(!settings.board);
  if (salon) salon.boardOpen = settings.board;
  if (hudBoard.hidden) return;
  if (!settings.board) {
    if (!salon && dayRank === null && performance.now() - boardLoadedAt > 1500) void refreshBoard(); // replié : on lit quand même le classement, pour la pastille du rang
    return;
  }
  if (salon) salon.renderBoard();
  else if (performance.now() - boardLoadedAt > 1500) void refreshBoard();
}

/** Plie ou déplie le classement (touche L, Tab dans le Salon) : le choix est mémorisé. */
function setBoardVisible(visible: boolean) {
  if (!boardAvailable()) return;
  applySettings({ board: visible });
}

/** Après un envoi ou une arrivée : le classement se remet à jour tout seul (il est déjà affiché, ou se déplie à la demande). */
function autoShowBoard() {
  void refreshBoard();
}

/** `G` / bouton Fantôme : dans le Salon, les fantômes de la session ; sinon, le fantôme suivant du circuit du jour. */
function ghostAction() {
  if (salon && ghostField) ghostField.setMode(salon.cycleGhostMode());
  else void cycleGhost();
}

/** Réglage « Fantôme affiché » : au prochain départ (ou tout de suite, avant la course). Le premier et le joueur devant demandent le classement. */
function applyGhostSetting() {
  if (!track || salon || watch) return;
  const wanted = settings.ghost;
  if (wanted === "none") return setGhost("off", null, { mode: "off" });
  if (wanted === "mine" || !online.enabled) return setGhost("mine", best, { mode: "mine" });
  void online.remoteGhost(wanted).then((choice) => {
    if (choice) setGhost(choice.mode, choice.source, { mode: choice.mode, name: choice.name });
    else setGhost("mine", best, { mode: "mine" }); // personne devant toi, ou pas de premier : ton record
  });
}

/** Échap : ferme la fenêtre du dessus ; sinon, pause (ou reprise). */
function onEscape() {
  if (howto.isOpen()) return howto.close();
  if (settingsPanel?.isOpen()) return settingsPanel.close();
  if (!hudArchive.hidden) return closeArchive();
  if (boardScreen.isOpen()) return boardScreen.close();
  if (homeOpen || watch) return;
  if (paused) {
    if (!$("pause-confirm").hidden) showPauseConfirm(false);
    else setPaused(false);
    return;
  }
  if (phase !== "finished") setPaused(true);
}

window.addEventListener("keydown", (e) => {
  if (e.repeat || isTyping(e)) return;
  if (e.code === "Escape") {
    e.preventDefault();
    return onEscape();
  }
  if (homeOpen || howto.isOpen() || settingsPanel?.isOpen()) return; // une fenêtre est ouverte : les touches du jeu attendent
  if (watch) {
    if (e.code === "Space") {
      e.preventDefault();
      setPaused(!watch.paused);
    }
    if (e.code === "ArrowLeft") watchSkip(-REWIND_TICKS);
    if (e.code === "ArrowRight") watchSkip(REWIND_TICKS);
    const digit = ["Digit1", "Digit2", "Digit3", "Digit4"].indexOf(e.code);
    if (digit >= 0) watch.speed = WATCH_SPEEDS[digit]!;
  }
  if (e.code === "KeyG" && !watch) ghostAction();
  if (e.code === "Tab" && salon) {
    e.preventDefault();
    setBoardVisible(!boardOpen());
  }
  if (e.code === "KeyM") gameAudio.mute();
  // N et T (circuit au hasard, thème suivant) sont des outils d'essai : aperçus et `?debug` seulement, jamais en production (lot 31).
  if (e.code === "KeyN" && track && scenario === "jour" && trialKeysAllowed(restricted)) location.assign(randomSeedHref(location.search)); // circuit au hasard (essai, jamais classé)
  if (e.code === "KeyT" && track && scenario === "jour" && trialKeysAllowed(restricted)) location.assign(themeHref(location.search, nextTheme(forcedTheme?.name ?? null))); // thème suivant
  if (e.code === "KeyL") setBoardVisible(!boardOpen());
  if (e.code === "KeyH" && !salon) (hudArchive.hidden ? openArchive : closeArchive)();
});

// Le bouton Son du dialogue de pause (Fantôme et Son ne sont plus dans la barre du haut : la variante A du HUD ne garde que la pause). Mêmes actions que les touches G et M.
function syncSoundButton() {
  const muted = gameAudio.settings.volume <= 0;
  const soundBtn = $("pause-sound");
  const label = t(muted ? "pause.son.coupe" : "pause.son.actif");
  if (soundBtn.textContent !== label) soundBtn.textContent = label;
  soundBtn.setAttribute("aria-pressed", String(muted));
  if (settingsPanel?.isOpen()) settingsPanel.sync();
}
syncSoundButton();

/**
 * Envoi du meilleur temps au classement, et messages clairs dans la zone du classement de l'arrivée : envoi en cours, « 14e sur 212 », « Hors ligne : course
 * non classée », erreur avec « Réessayer ». Le serveur rejoue la course : seul son temps compte. Les erreurs du serveur s'écrivent par leur code
 * (`messageErreur`, catalogue commun) : le champ `message` n'est plus lu.
 */
function startOnlineFlow(box: HTMLElement) {
  const text = (msg: string, cls = "") => {
    const d = document.createElement("div");
    d.className = `status ${cls}`.trim();
    d.textContent = msg;
    return d;
  };
  const link = (label: string, onClick: () => void) => button(label, "link", onClick);

  const showRank = (rank: number, participants: number, extra = "") => {
    const before = loadRanks().get(daily!.date)?.rank; // ta place d'avant, pour « +9 places »
    lastRank = { rank, participants };
    rememberRank(daily!.date, { rank, participants });
    updateShareLine();
    void showNextGame();
    box.replaceChildren(ligneRang({ rang: fRang(rank), total: fNombre(participants), gain: before !== undefined ? before - rank : 0 }), ...(extra ? [text(extra)] : []), link(t("arrivee.changerPseudo"), () => nameForm()));
    autoShowBoard();
  };

  const send = async () => {
    const name = online.name;
    if (!best || !name) return nameForm();
    box.replaceChildren(text(t("arrivee.envoi")));
    const r = await online.submit(best, name);
    if (r.ok) {
      online.sync.noteNameProblem(null);
      const gap = r.data.bestMs !== best.ms ? t("arrivee.tempsServeur", { temps: fTemps(r.data.bestMs) }) : "";
      showRank(r.data.rank, r.data.participants, gap);
    } else if (r.code === "name_taken") {
      nameForm({ code: r.code, suggestions: r.suggestions }); // pseudo pris entre-temps : on en choisit un autre, ou on retrouve son code dans le profil
    } else if (r.code === "code_revoked") {
      box.replaceChildren(text(messageErreur(r.code), "error"), profileLink());
    } else {
      box.replaceChildren(text(r.status === 0 ? t("arrivee.horsLigneDetail", { detail: messageErreur(r.code) }) : messageErreur(r.code), "error"), link(t("commun.reessayer"), () => void send()));
    }
  };

  const nameForm = (problem?: { code: string; suggestions?: string[] }) => {
    const form = document.createElement("form");
    const input = document.createElement("input");
    input.type = "text";
    input.className = "champ";
    input.maxLength = 20;
    input.placeholder = t("arrivee.pseudo.placeholder");
    input.autocomplete = "off";
    input.setAttribute("aria-label", t("arrivee.pseudo.placeholder"));
    input.value = online.name ?? "";
    const ok = button(t("arrivee.pseudo.ok"), "primary");
    ok.type = "submit";
    const error = text("", "error");
    const extras = document.createElement("div");
    extras.className = "suggestions";
    /** Pseudo refusé : le motif (par son code), des pseudos libres à toucher, et le profil Du Jour (le pseudo est peut-être le tien, sur un autre appareil). */
    const showProblem = (code: string, suggestions: readonly string[] = [], offerProfile = false) => {
      error.textContent = code ? messageErreur(code) : "";
      extras.replaceChildren(
        ...suggestions.map((s) =>
          link(s, () => {
            input.value = s;
            form.requestSubmit();
          }),
        ),
        ...(offerProfile ? [profileLink()] : []),
      );
    };
    const label = text(online.name ? t("arrivee.nouveauPseudo") : t("arrivee.choisirPseudo"), "label");
    form.append(label, input, ok, error, extras);
    if (problem) showProblem(problem.code, problem.suggestions, true);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = normalizeName(input.value);
      showProblem("");
      if (!isValidName(name)) {
        error.textContent = t("arrivee.pseudo.invalide");
        return;
      }
      ok.disabled = true;
      const pending = online.needsSubmit(best);
      const renamed = await online.rename(name, { viaSubmit: pending }); // pas encore classé : le pseudo part avec la course
      if (!renamed.ok) {
        ok.disabled = false;
        showProblem(renamed.code, renamed.suggestions, renamed.code === "name_taken");
        return;
      }
      settingsPanel?.sync();
      if (pending) await send();
      else {
        box.replaceChildren(text(t("arrivee.pseudo.enregistre", { nom: name })));
        autoShowBoard();
      }
    });
    box.replaceChildren(form);
    input.focus();
    input.select();
  };

  if (!submitAllowed) {
    box.replaceChildren(text(t("arrivee.jourPasse")));
    autoShowBoard();
  } else if (online.needsSubmit(best)) {
    void send();
  } else {
    // Ce temps n'améliore pas le record, déjà classé : on affiche simplement la place actuelle.
    box.replaceChildren(text(t("arrivee.chargement")));
    void online.leaderboard().then((r) => {
      if (r.ok && r.data.me) showRank(r.data.me.rank, r.data.participants);
      else if (r.ok) box.replaceChildren();
      else box.replaceChildren(text(r.status === 0 ? t("arrivee.horsLigneDetail", { detail: messageErreur(r.code) }) : messageErreur(r.code), "error"));
      if (r.ok) autoShowBoard();
    });
  }
}

/** « Mon profil Du Jour › » : le profil commun de la plateforme (charger un code, retrouver son pseudo), avec le retour vers ce jeu. */
function profileLink(): HTMLAnchorElement {
  const a = document.createElement("a");
  a.className = "lien";
  a.href = profilHref(location.origin, location.pathname);
  a.textContent = t("arrivee.monProfil");
  return a;
}

/** La plaque du dernier point de contrôle : « PC 3/5 » collé à l'écart (orange et « + » derrière, vert et « − » devant) ; sans référence, le temps intermédiaire. */
function renderSplits() {
  if (!race) return;
  const n = race.splits.length;
  if (n === 0) return hudSplits.replaceChildren();
  const total = track ? track.gates.filter((g) => g.kind !== "finish").length : n;
  const ms = race.splits[n - 1]!;
  const ref = watch ? undefined : (ghostSource ?? best)?.splits[n - 1];
  const label = makeEl("span", "pc", t("course.pc", { n, total }));
  const gap = makeEl("span", ref === undefined ? "ecart ecart--neutre" : ms <= ref ? "ecart ecart--devant" : "ecart ecart--derriere", ref === undefined ? fTemps(ms) : fEcart(ms - ref));
  hudSplits.replaceChildren(label, gap);
  hudSplits.setAttribute("aria-label", ref === undefined ? t("course.pc.sansReference", { n, total }) : t("course.pc.aria", { n, total, ecart: fEcart(ms - ref) }));
}

/** Salon (lot 26) : l'arrivée d'une course de session. Ni record local, ni classement du jour : seulement la session. */
function finishSalonRun() {
  if (!race || !track || !session || !salon) return;
  const sal = salon;
  phase = "finished";
  const ms = race.finishMs;
  const counted = !tunedRun && !demo; // réglages modifiés ou démo du pilote : jamais classé
  const sessionNo = sal.session;
  const result: SalonRunResult = { session: sessionNo, ms, splits: [...race.splits], respawns: race.respawns, replay: encodeReplay(session.toReplay()) };
  const improved = counted && sal.recordRun(result);
  const prior = sal.best && !improved ? sal.best.ms : null;
  // Le cadre de l'arrivée (barre « ‹ DU JOUR », étiquette Track) et son contenu : salonArrivee.ts ; ici les décisions (record, envoi, pseudo, partage).
  salonMod!.showSalonArrival({
    racine: hudFinish,
    sousTitre: `${sal.label} · ${nomTheme(sal.circuit.theme)}`,
    ms,
    respawns: race.respawns,
    counted,
    improved,
    prior,
    shareLine: () => sal.shareLine(),
    myRank: () => sal.myRank,
    canSubmit: () => sal.canSubmit(sessionNo),
    submit: (name) => sal.submit(result, name),
    getName,
    rename: (name) => online.rename(name, { viaSubmit: true }), // le serveur dit si le pseudo est libre (réservé à son premier propriétaire)
    openLoadCode,
    onReplay: () => startAttempt(),
    onWatch: () => location.assign(watchHref(location.search)),
    lineNow: () => sal.shareLine() ?? salonMod!.salonShareLine(sal.label, ms),
    shareUrl: `${location.origin}${location.pathname}?mode=salon`,
    onHome: () => goHome(),
  });
  document.body.classList.add("finished");
  showBanner(t("salon.arrivee.titre"), 2.5);
  effects.confetti(car.x, car.y, car.z);
  gameAudio.play("finish");
}

/** Le sous-titre de l'arrivée : « Circuit n° 8 · Canyon ». */
function arrivalSubtitle(): string {
  if (!daily) return $("meta").textContent ?? "";
  return daily.number >= 1 ? t("arrivee.circuit", { numero: fNumero(daily.number), theme: nomTheme(daily.theme) }) : t("arrivee.circuitSansNumero", { theme: nomTheme(daily.theme) });
}

function finishRun() {
  if (watch) return finishWatch();
  if (salon) return finishSalonRun();
  if (!race || !track || !session) return;
  phase = "finished";
  const ms = race.finishMs;
  // Réglages modifiés : le temps s'affiche, mais n'est ni enregistré ni envoyé (ce n'est pas la voiture de tout le monde).
  const counted = !tunedRun && !demo; // la démo n'est jamais enregistrée
  const isRecord = counted && (!best || ms < best.ms);
  const previousBest = best;
  if (isRecord) {
    best = { ms, splits: [...race.splits], replay: encodeReplay(session.toReplay()), simVersion: SIM_VERSION, medal: daily ? medalFor(ms, daily.medals) : null };
    saveBest(track.id, best);
    if (ghostMode === "mine") ghostSource = best; // le prochain fantôme sera ce nouveau record
    renderObjective();
  }
  const zones = arrivee.ouvrir({ sousTitre: arrivalSubtitle() });
  document.body.classList.add("finished");
  // Le résultat : le temps en grand, puis le badge de record et l'écart (réglages modifiés : rien n'est enregistré).
  zones.resultat.append(tempsEnGrand(ms));
  if (!counted) zones.resultat.append(badgeEtEcart({ texte: t("arrivee.reglagesModifies") }));
  else if (isRecord) zones.resultat.append(badgeEtEcart(previousBest ? { badge: t("arrivee.recordNouveau"), ton: "ok", ecartMs: ms - previousBest.ms } : { badge: t("arrivee.premierTemps"), ton: "ok" }));
  else zones.resultat.append(badgeEtEcart({ texte: t("arrivee.recordActuel", { temps: fTemps(best!.ms) }), ecartMs: ms - best!.ms }));
  zones.resultat.append(makeEl("div", "note", race.respawns > 0 ? t("arrivee.reprises", { n: race.respawns }) : t("arrivee.sansReprise")));
  if (daily) zones.medaille.append(autocollantMedaille({ medal: medalFor(ms, daily.medals), bronzeMs: daily.medals.bronze, authorMs: daily.medals.author, ms }));
  else zones.medaille.hidden = true;
  const onlineBox = zones.classement;
  const showOnline = online.enabled && counted;
  // Sans classement, on le dit : la course n'est pas perdue, elle n'est simplement pas envoyée.
  if (counted && !online.enabled) onlineBox.append(Object.assign(document.createElement("div"), { className: "status", textContent: apiBase() === null ? t("arrivee.sansServeur") : t("arrivee.horsLigne") }));
  else if (!counted) zones.classement.hidden = true;
  // Ligne à partager (circuits du jour) et boutons : tout est cliquable, pour le tactile.
  shareEl = daily ? zones.partage : null;
  updateShareLine();
  if (!(shareEl && best)) zones.partage.hidden = true;
  // Les actions : Recourir (livrée), Revoir le tour, Partager / Copier, Accueil de Track (les archives sont à l'accueil et dans la pause).
  actionArrivee(zones, { texte: t("arrivee.recourir"), principal: true, classe: "restart", onClick: () => startAttempt() });
  actionArrivee(zones, { texte: t("arrivee.revoir"), ariaLabel: t("arrivee.revoir.aria"), id: "finish-watch", onClick: () => location.assign(watchHref(location.search)) });
  if (daily) {
    // Lot 33 : « Copier » (le message et le lien) partout ; la feuille de partage du système seulement sur téléphone.
    if (canNativeShare()) actionArrivee(zones, { texte: t("partage.partager"), onClick: async () => void (currentShare() && (await nativeShare({ text: shareLine(currentShare()!), url: shareLink() }))) });
    actionArrivee(zones, { texte: t("partage.copier"), id: "finish-copy", onClick: async (b) => void (currentShare() && (await copyShare(b, shareLine(currentShare()!), shareLink()))) });
  }
  actionArrivee(zones, { texte: t("arrivee.accueil"), onClick: () => goHome() });
  zones.indice.textContent = t("arrivee.indice");
  // Lot I3 de la plateforme : « Jeu suivant du jour », sous l'étiquette (rempli quand le classement est connu).
  finishNext = zones.suite;
  if (showOnline) startOnlineFlow(onlineBox);
  showBanner(t("course.arrivee"), 2.5);
  effects.confetti(car.x, car.y, car.z);
  gameAudio.play("finish");
  const medal = daily && counted ? medalFor(ms, daily.medals) : null;
  if (medal) gameAudio.play("medal", { bronze: 0, silver: 1, gold: 2, author: 3 }[medal]);
  demoTimer = 6;
}


// --- Revoir le meilleur tour : lecture (lot 27b) -------------------------------------------------------------------------------
/**
 * Retour en arrière, mesuré : on **rejoue depuis le départ** jusqu'au pas voulu (aucun instantané en mémoire). Un tour dure ≈ 5 000 pas
 * et se rejoue en ≈ 15–30 ms (voir `docs/lots/lot-27b-salon-oubli.md`) : un retour de 5 s, ou un saut sur la barre de progression, ne se
 * remarque pas, et l'on évite un état copié (donc un risque de dérive) en plus. Le temps final reste celui du même code de simulation.
 */
function restartWatch(tick: number) {
  if (!watch || !track) return;
  session = new RunSession(track, null); // aucune voiture fantôme, réglages par défaut : ceux de la rediffusion
  race = session.race;
  car = race.car;
  previous = session.previous;
  const player = new ReplayPlayer(watch.replay);
  for (let i = 0; i < tick && race.finishMs < 0; i++) session.step(player.next()); // silencieux : ni son ni effet pendant le rejeu
  autoplay = player;
  session.cutInterpolation();
  phase = "racing";
  countdown = 0;
  accumulator = 0;
  pendingRespawn = false;
  shownSplits = race.splits.length;
  lastRespawns = race.respawns;
  wasFalling = false;
  fallVeil = 0;
  snapCamera = true;
  effects.reset();
  shake = 0;
  flash = 0;
  lastCountdown = 0;
  renderSplits();
  hudFinish.hidden = true;
  document.body.classList.remove("finished");
  hudBanner.textContent = "";
  bannerTimer = 0;
}

function setFreeCamera(on: boolean) {
  freeCam = on;
  renderer.domElement.style.touchAction = on ? "none" : "";
  if (on) {
    orbit.yaw = camYaw + Math.PI; // derrière la voiture, comme la caméra de poursuite
    orbit.pitch = 0.4;
    orbit.dist = 12;
  }
}

const orbitPointers = new Map<number, { x: number; y: number }>();
renderer.domElement.addEventListener("pointerdown", (e) => {
  if (!(watch && freeCam)) return;
  renderer.domElement.setPointerCapture(e.pointerId);
  orbitPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
});
renderer.domElement.addEventListener("pointermove", (e) => {
  const p = orbitPointers.get(e.pointerId);
  if (!p || !(watch && freeCam)) return;
  if (orbitPointers.size === 1) {
    orbit.yaw -= (e.clientX - p.x) * 0.008;
    Object.assign(orbit, clampOrbit(orbit.pitch + (e.clientY - p.y) * 0.006, orbit.dist));
  } else if (orbitPointers.size === 2) {
    // Pincement : la distance entre les deux doigts règle le zoom.
    const other = [...orbitPointers.entries()].find(([id]) => id !== e.pointerId)![1];
    const before = Math.hypot(p.x - other.x, p.y - other.y);
    const after = Math.hypot(e.clientX - other.x, e.clientY - other.y);
    if (before > 8 && after > 8) Object.assign(orbit, clampOrbit(orbit.pitch, orbit.dist * (before / after)));
  }
  orbitPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
});
for (const type of ["pointerup", "pointercancel"] as const) renderer.domElement.addEventListener(type, (e) => orbitPointers.delete(e.pointerId));
renderer.domElement.addEventListener(
  "wheel",
  (e) => {
    if (!(watch && freeCam)) return;
    e.preventDefault();
    Object.assign(orbit, clampOrbit(orbit.pitch, orbit.dist * Math.exp(e.deltaY * 0.0012)));
  },
  { passive: false },
);

const watchSpeedTo = (speed: WatchSpeed) => {
  if (watch) watch.speed = speed;
};
const watchTick = () => (watch ? Math.min(car.tick, watch.total) : 0);
function watchSkip(deltaTicks: number) {
  if (watch) restartWatch(seekTick(watchTick(), watch.total, deltaTicks));
}

/** Passe en mode spectateur sur cette rediffusion. `false` si elle n'est pas rejouable ici (autre circuit, autre version, illisible). */
function beginWatch(entry: WatchEntry): boolean {
  if (!track || entry.simVersion !== SIM_VERSION) return false;
  let replay: ReturnType<typeof decodeReplay>;
  try {
    replay = decodeReplay(entry.replay);
  } catch {
    return false;
  }
  if (replay.trackId !== track.id || replay.simVersion !== SIM_VERSION) return false;
  watch = { entry, replay, total: replayTicks(replay), speed: 1, paused: false };
  document.body.classList.add("watch");
  // La voiture du tour regardé : pleine (pas translucide), à la couleur du fantôme, son pseudo au-dessus.
  view.scene.remove(carMesh);
  carModel = createCarMesh(true, entry.color, false, true);
  carMesh = carModel.group;
  view.scene.add(carMesh);
  castShadows(carMesh);
  nameLabel = salonMod!.createNameLabel();
  nameLabel.set(entry.name, entry.color);
  carMesh.add(nameLabel.sprite);
  watchUi = salonMod!.mountWatchUi($("watchbar"), {
    onTogglePause: () => setPaused(!watch!.paused),
    onRewind: () => watchSkip(-REWIND_TICKS),
    onSpeed: watchSpeedTo,
    onCamera: () => cycleCamera(),
    onSeek: (fraction) => (pendingSeek = fraction),
  });
  watchUi.show(true);
  activeGhost = null;
  pendingGhost = null;
  ghostMesh.visible = false;
  updateInfo();
  updateGhostInfo();
  restartWatch(0);
  return true;
}

/** Quitte le mode spectateur (on repart courir) : voiture d'origine, commandes de conduite, adresse sans `watch`. */
function endWatch() {
  document.body.classList.remove("watch", "finished");
  hudFinish.hidden = true;
  watchUi?.show(false);
  watchUi = null;
  nameLabel = null;
  setFreeCamera(false);
  view.scene.remove(carMesh);
  carModel = createCarMesh();
  carMesh = carModel.group;
  view.scene.add(carMesh);
  castShadows(carMesh);
  watch = null;
  autoplay = null;
  pendingSeek = null;
  mountDrivingTouch();
  try {
    history.replaceState(null, "", unwatchHref(location.search));
  } catch {
    /* tant pis : l'adresse garde watch=best */
  }
  updateInfo();
  updateGhostInfo();
}

/** « Courir contre ce fantôme » : une course normale avec la rediffusion regardée en fantôme (dans le Salon : la session, qui les montre déjà). */
function raceAgainstWatched() {
  const w = watch;
  if (!w) return;
  if (salon) return location.assign(unwatchHref(location.search));
  const e = w.entry;
  endWatch();
  if (e.mode === "mine" && best) setGhost("mine", best, "ton record");
  else setGhost("first", { ms: e.ms, splits: e.splits, replay: e.replay, simVersion: e.simVersion }, e.label);
}

/** Fin de la rediffusion : le temps recalculé par la simulation, puis rejouer ou courir contre ce fantôme. */
function finishWatch() {
  if (!race || !watch) return;
  phase = "finished";
  const w = watch;
  w.paused = false; // « Rejouer » repart en lecture, même si l'on avait mis en pause avant de sauter à la fin
  salonMod!.showWatchArrival({ racine: hudFinish, titre: watchTitle(w.entry.name, w.entry.ms), ms: race.finishMs, onReplay: () => restartWatch(0), onRace: () => raceAgainstWatched() });
  document.body.classList.add("finished");
  showBanner(t("revoir.arrivee.titre"), 2.5);
  gameAudio.play("finish");
}

/** Le tour à revoir : le premier du classement (jour ou session), sinon ton propre record de ce circuit. */
async function loadWatchEntry(): Promise<WatchEntry | null> {
  if (salon) {
    const g = await salon.bestGhost();
    return g ? { name: g.name, ms: g.ms, splits: g.splits, replay: g.replay, simVersion: g.simVersion, mode: "salon", label: t("salon.premier", { nom: g.name }), color: salonMod!.GHOST_COLORS[0]! } : null;
  }
  if (online.enabled) {
    const c = await online.remoteGhost("first");
    if (c?.source?.replay) return { name: c.name ?? t("revoir.premierNom"), ms: c.source.ms, splits: c.source.splits, replay: c.source.replay, simVersion: c.source.simVersion ?? 0, mode: "first", label: t("course.fantome.premier", { nom: c.name ?? "" }), color: salonMod!.MY_GHOST_COLOR };
  }
  if (best?.replay) return { name: getName() ?? t("commun.toi"), ms: best.ms, splits: best.splits, replay: best.replay, simVersion: best.simVersion ?? 0, mode: "mine", label: t("course.fantome.tonRecord"), color: salonMod!.MY_GHOST_COLOR };
  return null;
}

// --- Boucle : simulation à pas fixe, rendu interpolé ------------------------------------------
let last = performance.now();
/** Accueil ouvert : la caméra tourne lentement autour de la voiture au départ (temps écoulé, en secondes). */
let homeSpin = 0;
let lastHomeRender = 0;
let camYaw = 0;
/** Part « en vol » de la caméra ∈ [0, 1] (lissée) : 1 = elle suit la direction du déplacement. */
let airMix = 0;
/** En l'air depuis plus de ça (sous-pas), la voiture vole pour de bon (une bosse ou un frôlement de paroi ne compte pas). */
const AIR_HOP_SUBSTEPS = 12;
const hudFreeze = $("freeze");
/** Temps passé dans `renderer.render` (ms cumulées, images) : mesure du coût du rendu (`__cdj.render`). */
const renderCost = { ms: 0, frames: 0 };
/** Idem, seulement avec l'accueil ouvert (mesure du coût de la scène en fond : `__cdj.render.home`). */
const homeCost = { ms: 0, frames: 0 };
let camBaseY = 0;
let snapCamera = true;
const camPos = { x: 0, y: 0, z: 0 };
// Orientation de la voiture et du fantôme sur la paroi d'une cuve (lot 18) : normale lissée, caméra qui penche avec elle.
const carPose = new CarPose();
const ghostPose3d = new CarPose();
const camLift = new Vector3();
// Vue capot : l'œil dans le repère de la voiture, et le regard « rivé à la caisse » (axe +z de la voiture = −z de la caméra).
const hoodEye = new Vector3();
const hoodBody = new Quaternion();
const FACE_FORWARD = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI);
const lerp =(a: number, b: number, t: number) => a + (b - a) * t;

// Caméras (touche C / bouton Vue de la manette / bouton 🎥 du toucher) : proche, loin, capot (`cameras.ts`).
let cameraIndex = 0;
try {
  cameraIndex = cameraIndexOf(gameStorage().getItem("cdj:camera"));
} catch {
  /* stockage indisponible : caméra proche */
}
// `?camera=proche|loin|capot` (lot 23) : impose la caméra au chargement, sans toucher au choix mémorisé.
if (params.has("camera")) cameraIndex = cameraIndexOf(params.get("camera"));
syncCameraButton();

function cycleCamera() {
  if (watch) {
    // Spectateur : proche, loin, capot, puis la caméra libre autour de la voiture.
    const next = nextWatchCamera(cameraIndex, freeCam, CAMERAS.length);
    cameraIndex = next.index;
    setFreeCamera(next.free);
    showBanner(freeCam ? t("course.camera.libre") : t(`course.camera.${CAMERAS[cameraIndex]!.name}`), freeCam ? 2.2 : 1, true);
    return;
  }
  cameraIndex = nextCameraIndex(cameraIndex);
  try {
    gameStorage().setItem("cdj:camera", CAMERAS[cameraIndex]!.name);
  } catch {
    /* tant pis */
  }
  showBanner(t(`course.camera.${CAMERAS[cameraIndex]!.name}`), 1, true);
}

// Indicateur d'effets (HUD) : super turbo, turbo, moteur coupé, et revêtement quand ce n'est pas la route.
const hudFx = $("fx");
const fxSample = createSurface();
const SURFACES_HUD = new Set(["dirt", "ice", "grass", "sand", "gravel", "snow"]);
let fxShown = "";
function updateEffects() {
  const parts: string[] = [];
  let cut = false;
  if (race && phase !== "countdown") {
    const c = race.car;
    if (c.cut) {
      parts.push(t("course.effet.moteurCoupe"));
      cut = true;
    }
    if (c.turbo > 0) parts.push(t("course.effet.superTurbo"));
    else if (c.boost > 0) parts.push(t("course.effet.turbo"));
    if (c.grounded) {
      race.world.sample(c.x, c.z, fxSample);
      if (SURFACES_HUD.has(fxSample.kind)) parts.push(t(`course.sol.${fxSample.kind}`));
    }
  }
  const text = parts.join(" · ");
  if (text !== fxShown) {
    fxShown = text;
    hudFx.textContent = text;
    hudFx.dataset.cut = cut ? "1" : "0";
  }
}

function stepOnce(input: CarInput) {
  lastInput = input;
  const respawnsBefore = race ? race.respawns : 0;
  if (session) {
    session.step(input); // course + enregistrement des commandes + fantôme, ensemble
    ghostField?.step(); // Salon : les fantômes des autres, au même pas
  } else {
    copyCar(car, previous);
    stepCar(car, input, FLAT_WORLD, carParams);
  }
  // Choc et réception : lecture seule de la vitesse avant / après le pas (jamais d'effet sur la simulation).
  if (!race || race.respawns === respawnsBefore) {
    const t = performance.now();
    if (impactFelt(carSpeed(previous), carSpeed(car)) && t - lastImpactAt > IMPACT_COOLDOWN_MS) {
      lastImpactAt = t;
      if (touchPad) vibrate(touchPad.settings, 40);
      const strength = Math.min(1, (carSpeed(previous) - carSpeed(car)) / 8);
      shake = Math.max(shake, 0.35 + 0.5 * strength);
      if (t - lastImpactSoundAt > 120) {
        lastImpactSoundAt = t;
        gameAudio.play("impact", strength);
      }
    }
    if (previous.grounded === 0 && car.grounded === 1 && previous.vy < -3) {
      // Lot 19 : la qualité de la réception (part de la vitesse gardée au contact) règle le son et la secousse ; lecture seule.
      const strength = Math.min(1, -previous.vy / 14);
      const quality = landingQuality(carSpeed(previous), carSpeed(car));
      lastLanding = { strength, quality };
      effects.landing(car.x, car.y, car.z, strength);
      gameAudio.play("land", strength, quality);
      shake = Math.max(shake, (0.2 + 0.7 * strength) * (1 + 0.6 * (1 - quality)));
    }
  }
}

/**
 * Gelé : pause, archives ouvertes, ou (au toucher) réglages ouverts. Avec l'accélérateur automatique, la voiture ne doit pas
 * rouler pendant qu'on lit une fenêtre ; et aux archives (lot 13) on ne dessine des miniatures que si la course ne tourne pas :
 * le chrono compte des pas de simulation, donc geler ne coûte rien au temps de course (exact).
 */
function isFrozen(): boolean {
  return paused || homeOpen || !hudArchive.hidden || !!settingsPanel?.isOpen() || howto.isOpen() || salon?.state === "podium" || salon?.state === "switching" || watchWait || !!watch?.paused;
}

function frame(now: number) {
  salon?.tick(); // Salon : compte à rebours, fin de session, podium, bascule
  if (reconstructeur.enAttente()) void reconstructeur.essayer(); // un autre palier demandé : reconstruit à l'accueil, à la pause, à l'arrivée, au podium (jamais en course)
  const frozen = isFrozen();
  if (dayCardShown) hudDayCard.hidden = phase !== "countdown";
  const manualTicksNow = manual ? manualTicks : 0;
  manualTicks = 0;
  const elapsed = manual ? manualTicksNow * DT : frozen ? 0 : Math.min((now - last) / 1000, 0.5) * timeScale * (watch ? watch.speed : 1); // borne : pas de spirale après un onglet en pause ; 0,5 s : la course reste à l'heure jusqu'à 2 images/s (téléphone lent, rendu logiciel)
  const frameMs = now - last;
  last = now;
  if (homeOpen) homeSpin += Math.min(frameMs, 100) / 1000;
  if (!frozen && !manual && governor.observe(frameMs)) {
    effects.quality = governor.level;
    syncSceneQuality(); // qualité basse : décor, ombres et halos allégés (téléphone lent)
    if (settingsPanel?.isOpen()) settingsPanel.sync();
  }

  if (pendingSeek !== null && watch) {
    const target = tickAt(pendingSeek, watch.total);
    pendingSeek = null;
    restartWatch(target);
  }
  const { input, restart, camera: nextCamera, pause: togglePause } = controls.poll();
  if (togglePause) setPaused(watch ? !watch.paused : !paused);
  if (nextCamera) cycleCamera();
  if (restart) startAttempt();
  else if (watch) {
    /* spectateur : aucune commande de conduite (la voiture suit la rediffusion) */
  } else if (input.respawn && frozen) {
    /* pas de reprise pendant la pause : elle s'appliquerait en reprenant */
  } else if (input.respawn) {
    if (race) pendingRespawn = true;
    else startAttempt(); // sol plat : « reprise » = retour au départ
  }

  if (watchWait) {
    /* Salon, spectateur : on attend le premier temps de la session */
  } else if (phase === "countdown") {
    countdown -= elapsed;
    if (countdown <= 0) {
      phase = "racing";
      accumulator = 0;
      const hadNotice = !!salonNoticePending;
      showBanner(salonNoticePending || t("course.depart"), salonNoticePending ? 5 : 0.9, hadNotice);
      salonNoticePending = "";
      if (touchPad && !watch && !hadNotice) showAide(hintText(touchPad.settings), 6); // l'aide de départ : une ligne sous la bande, jusqu'au premier appui sur le gaz
      gameAudio.play("go");
    } else {
      showBanner(String(Math.ceil(countdown)), 0.2);
      if (Math.ceil(countdown) !== lastCountdown) {
        lastCountdown = Math.ceil(countdown);
        if (!frozen) gameAudio.play("countdown", lastCountdown);
      }
    }
  } else if (manual) {
    for (let i = 0; i < manualTicksNow && !frozen; i++) {
      stepOnce(autoplay ? autoplay.next() : pendingRespawn ? input : { ...input, respawn: 0 });
      pendingRespawn = false;
    }
    accumulator = 0;
  } else {
    accumulator += elapsed;
    while (accumulator >= DT) {
      stepOnce(autoplay ? autoplay.next() : pendingRespawn ? input : { ...input, respawn: 0 });
      pendingRespawn = false;
      accumulator -= DT;
    }
  }
  const alpha = phase === "countdown" ? 0 : accumulator / DT;

  if (race) {
    if (race.splits.length > shownSplits) {
      shownSplits = race.splits.length;
      renderSplits(); // la plaque du point de contrôle porte l'écart : plus d'annonce par-dessus la route
      if (touchPad) vibrate(touchPad.settings, 25);
      effects.checkpoint(car.x, car.y, car.z);
      gameAudio.play("checkpoint");
      flash = 1;
    }
    if (race.fallTicks > 0 && !wasFalling) {
      // Chute (lot 17) : la voiture a quitté la route par le bas ; la reprise suit après FALL_TICKS pas.
      showBanner(t("course.chute"), 1.1, true);
      gameAudio.play("fall");
      if (touchPad) vibrate(touchPad.settings, 60);
    }
    wasFalling = race.fallTicks > 0;
    if (race.respawns !== lastRespawns) {
      lastRespawns = race.respawns;
      session?.cutInterpolation(); // pas d'interpolation à travers une téléportation
      snapCamera = true;
      gameAudio.play("respawn");
    }
    if (race.finishMs >= 0 && phase === "racing") finishRun();
    setTimerText(phase === "countdown" ? fTemps(0) : fTemps(raceElapsedMs(race)));
    syncCalqueHud((phase === "racing" || phase === "countdown") && !frozen);
    // Le chrono part au « PARTEZ ! », voiture immobile ou non (comme sur Trackmania) : si le joueur n'a pas bougé, on lui dit quoi faire.
    if (phase === "racing" && !frozen && !idleHintShown && !watch && race.splits.length === 0 && carSpeed(car) < 0.5 && raceElapsedMs(race) > 2500) {
      idleHintShown = true;
      showAide(t(touchMode ? "course.chronoTourne.tactile" : "course.chronoTourne.clavier"), 4);
    }
  } else {
    setTimerText("");
    syncCalqueHud(false);
  }

  if (bannerTimer > 0) {
    bannerTimer -= elapsed;
    if (bannerTimer <= 0) hudBanner.textContent = "";
  }
  if (aideTimer > 0) {
    if (aideFraiche) aideFraiche = false;
    else aideTimer -= elapsed;
    if (aideTimer <= 0 || (!frozen && !watch && input.throttle > 0)) clearAide();
  }
  syncIntro();
  syncRang();

  const x = lerp(previous.x, car.x, alpha);
  const y = lerp(previous.y, car.y, alpha);
  const z = lerp(previous.z, car.z, alpha);
  const yaw = previous.yaw + wrapAngle(car.yaw - previous.yaw) * alpha;
  const speed = carSpeed(car);
  // Lot 19 : en l'air la caisse garde sa rotation ; le frein la fige. Petit indicateur discret tant que le frein agit (présentation seule).
  const freezing = phase === "racing" && !frozen && !car.grounded && car.air > AIR_HOP_SUBSTEPS && lastInput.brake > 0;
  if (freezing !== hudFreeze.classList.contains("on")) hudFreeze.classList.toggle("on", freezing);

  // Voiture : tangage et roulis de la caisse calculés par la simulation (suspension), en pentes → angles ;
  // roues : chacune suit le sol sous elle (lecture seule du monde), tourne avec la vitesse et braque.
  readTelemetry(car, race ? race.world : FLAT_WORLD, tel);
  // Vibreur (lot 21) : petite vibration (téléphone) et frémissement de la caméra tant qu'une roue roule dessus ; présentation seule.
  if (tel.kerb > 0 && tel.speed > 8 && phase === "racing" && !frozen) {
    shake = Math.max(shake, 0.08 + 0.03 * tel.kerb);
    if (touchPad && now - lastKerbBuzz > 160) {
      lastKerbBuzz = now;
      vibrate(touchPad.settings, 12);
    }
  }
  const pitchS = lerp(previous.pitch, car.pitch, alpha);
  const rollS = lerp(previous.roll, car.roll, alpha);
  carMesh.position.set(x, y, z);
  carPose.follow(car.nx, car.ny, car.nz, elapsed, snapCamera);
  carPose.apply(carMesh, pitchS, yaw, rollS);
  const wheelFollow = 1 - Math.exp(-30 * elapsed);
  for (let i = 0; i < 4; i++) {
    const ground = tel.wheels[i]!.ground;
    // Sur une paroi, les roues sont dans le plan de la caisse : pas de débattement à rendre.
    const target = tel.tilt > 0 ? 0 : ground < NO_GROUND / 2 ? 1 : y + WHEEL_F[i]! * pitchS + WHEEL_L[i]! * rollS - ground;
    wheelDroop[i] = wheelDroop[i]! + (target - wheelDroop[i]!) * wheelFollow;
  }
  wheelPose.forward = tel.forward;
  wheelPose.steerAngle = -car.steer * steerLimit(tel.forward, carParams);
  wheelPose.braking = phase !== "countdown" && lastInput.brake > 0;
  wheelPose.dt = elapsed;
  carModel.update(wheelPose);
  let groundSum = 0;
  let groundN = 0;
  for (const w of tel.wheels) {
    if (w.ground > NO_GROUND / 2) {
      groundSum += w.ground;
      groundN++;
    }
  }
  const groundY = groundN ? groundSum / groundN : lastGround;
  lastGround = groundY;
  // Ombre : sous la voiture ; en l'air au-dessus d'un vide, à son point de réception prévu (lot 17) — pas d'ombre du tout si elle ne
  // retombe sur rien : c'est la chute.
  carShadow.visible = car.ny > 0.95; // sur une paroi, une tache posée à plat ne dirait rien
  if (race && !car.grounded && groundN < 4 && race.fallTicks === 0 && y - groundY > 1.5) {
    const landing = predictLanding(race.world, car, carParams);
    if (landing) placeShadow(carShadow, landing.x, landing.z, yaw, landing.y, Math.min(6, 1 + landing.t * 4));
    else carShadow.visible = false;
  } else {
    placeShadow(carShadow, x, z, yaw, groundY, y - groundY);
  }

  // Fantôme : la rediffusion du meilleur temps, interpolée comme la voiture.
  const ghost = session?.ghost;
  ghostMesh.visible = !!ghost;
  if (ghost) {
    const gc = ghost.race.car;
    const gp = ghost.previous;
    ghostMesh.position.set(lerp(gp.x, gc.x, alpha), lerp(gp.y, gc.y, alpha), lerp(gp.z, gc.z, alpha));
    ghostPose3d.follow(gc.nx, gc.ny, gc.nz, elapsed);
    ghostPose3d.apply(ghostMesh, lerp(gp.pitch, gc.pitch, alpha), gp.yaw + wrapAngle(gc.yaw - gp.yaw) * alpha, lerp(gp.roll, gc.roll, alpha));
    ghostPose.forward = forwardSpeed(gc);
    ghostPose.steerAngle = -gc.steer * steerLimit(ghostPose.forward, carParams);
    ghostPose.dt = elapsed;
    ghostModel.update(ghostPose);
  }

  // Étiquettes des fantômes du Salon : taille constante à l'écran (la caméra de l'image précédente suffit).
  ghostField?.place(alpha, elapsed, { x: camera.position.x, y: camera.position.y, z: camera.position.z, pixelAtOneMeter: Math.tan((camera.fov * Math.PI) / 360) / window.innerHeight, clearance: CAMERAS[cameraIndex]!.mount ? HOOD_GHOST_CLEARANCE : 0 });

  // Démo : on change de caméra de temps en temps, et on repart après l'arrivée.
  if (demo) {
    demoClock += elapsed;
    if (demoClock > 7) {
      demoClock = 0;
      cameraIndex = nextCameraIndex(cameraIndex);
    }
    if (phase === "finished" && demoTimer > 0 && (demoTimer -= elapsed) <= 0) startAttempt();
  }

  // Caméra poursuite : cap, hauteur et position suivent la voiture avec un léger retard ; le champ de vision
  // s'ouvre avec la vitesse (sensation de vitesse).
  syncCameraButton();
  const rig = CAMERAS[cameraIndex]!;
  // Au-delà de la pointe du plat (lot 15) : champ de vision plus ouvert, caméra plus basse et plus en retard, petite vibration.
  const speedRatio = flatRatio(speed);
  const fastCam = speedCamera(speed);
  // Caméra stable en l'air (lot 19) : la caisse peut tourner sur elle-même, la caméra suit alors la direction du déplacement, pas le cap.
  airMix += ((!car.grounded && car.air > AIR_HOP_SUBSTEPS ? 1 : 0) - airMix) * (1 - Math.exp(-6 * elapsed));
  const heading = speed > 8 ? Math.atan2(car.vx, car.vz) : yaw;
  const viewYaw = yaw + wrapAngle(heading - yaw) * airMix;
  if (snapCamera) {
    camYaw = viewYaw;
    camBaseY = y;
  }
  camYaw += wrapAngle(viewYaw - camYaw) * (1 - Math.exp(-rig.yawLag * elapsed));
  // En chute, la caméra reste où elle est : la voiture s'enfonce dans le vide sous le regard, sans que l'écran plonge avec elle.
  if (!(race && race.fallTicks > 0)) camBaseY += (y - camBaseY) * (1 - Math.exp(-8 * elapsed));
  const freeActive = !!watch && freeCam; // spectateur : caméra libre autour de la voiture
  const mount = freeActive ? undefined : rig.mount; // capot : la caméra est fixée à la carrosserie ; la vitesse ne la recule ni ne l'abaisse
  const hood = mount !== undefined;
  document.body.classList.toggle("cam-hood", hood);
  const back = rig.back + speedRatio * rig.backAtSpeed + (hood ? 0 : fastCam.back);
  // Sur la paroi d'une cuve, la caméra penche avec la voiture (en partie) : son « haut » est entre la verticale et la normale.
  const camUp = carPose.cameraUp;
  camLift.copy(camUp).multiplyScalar(rig.height - (hood ? 0 : fastCam.lower));
  const tx = x - Math.sin(camYaw) * back + camLift.x;
  const ty = camBaseY + camLift.y;
  const tz = z - Math.cos(camYaw) * back + camLift.z;
  const follow = snapCamera ? 1 : 1 - Math.exp(-(rig.posLag - (hood ? 0 : fastCam.lag)) * elapsed);
  camPos.x += (tx - camPos.x) * follow;
  camPos.y += (ty - camPos.y) * follow;
  camPos.z += (tz - camPos.z) * follow;
  snapCamera = false;
  // Secousse (chocs, réceptions) : décalage de la caméra qui s'éteint vite ; coupée avec `?shake=0`.
  shake *= Math.max(0, 1 - 7 * elapsed);
  // Vue capot : la secousse reste bien en deçà du jeu entre l'œil et la carrosserie (`HOOD_CLEARANCE`).
  const sh = (shakeScale * shake * 0.22 + (buzzAllowed(governor.level) ? shakeScale * feel * buzzAmplitude(speed) * 2 : 0)) * (hood ? 0.3 : 1);
  if (mount) {
    // L'œil est un point de la carrosserie : même position que la caisse (pas de retard, tangage et roulis compris), donc jamais à travers.
    carMesh.updateMatrixWorld();
    hoodEye.set(mount.x, mount.y, mount.z).applyMatrix4(carMesh.matrixWorld);
    camPos.x = hoodEye.x;
    camPos.y = hoodEye.y;
    camPos.z = hoodEye.z;
  }
  camera.position.set(camPos.x + (Math.random() - 0.5) * sh, camPos.y + (Math.random() - 0.5) * sh, camPos.z + (Math.random() - 0.5) * sh);
  camera.up.copy(camUp);
  if (mount) {
    // Regard : le cap lissé de la caméra (horizon stable, en l'air le déplacement), mêlé à l'axe de la caisse (la route monte et descend
    // avec le capot) puis borné : la caisse peut tourner en l'air, le regard reste à moins de `HOOD_MAX_TILT` de son axe.
    camera.lookAt(hoodEye.x + Math.sin(camYaw) * rig.ahead, hoodEye.y - 0.35,hoodEye.z + Math.cos(camYaw) * rig.ahead);
    hoodBody.copy(carMesh.quaternion).multiply(FACE_FORWARD);
    camera.quaternion.slerp(hoodBody, (rig.bodyFollow ?? 0.6) * (1 - airMix * 0.75));
    const excess = camera.quaternion.angleTo(hoodBody) - HOOD_MAX_TILT;
    if (excess > 0) camera.quaternion.rotateTowards(hoodBody, excess);
  } else {
    camera.lookAt(x + Math.sin(camYaw) * rig.ahead + camUp.x * rig.lookHeight, camBaseY + camUp.y * rig.lookHeight, z + Math.cos(camYaw) * rig.ahead + camUp.z * rig.lookHeight);
  }
  if (freeActive) {
    // Caméra libre : sur une sphère autour de la voiture (lacet et hauteur au doigt, distance à la molette), le regard sur elle.
    const o = orbitOffset(orbit.yaw, orbit.pitch, orbit.dist);
    camera.position.set(x + o.x, y + 1 + o.y, z + o.z);
    camera.up.set(0, 1, 0);
    camera.lookAt(x, y + 1, z);
  }
  if (homeOpen) {
    // Accueil : la scène du jour est survolée lentement, la voiture au départ au centre. Présentation seule (la course est gelée).
    const o = orbitOffset(0.9 + homeSpin * (matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 0.14), 0.3, 15);
    camera.position.set(x + o.x, y + 1 + o.y, z + o.z);
    camera.up.set(0, 1, 0);
    camera.lookAt(x, y + 1.3, z);
  }
  // Étiquette au pseudo du tour regardé : masquée tout près de la caméra (vue capot).
  if (nameLabel) nameLabel.place(camera.position.distanceTo(carMesh.position), Math.tan((camera.fov * Math.PI) / 360) / window.innerHeight, 3.5);
  if (watch) watchUi?.update({ paused: watch.paused, speed: watch.speed, progress: progressOf(Math.min(car.tick, watch.total), watch.total), camera: freeCam ? "libre" : CAMERAS[cameraIndex]!.name });
  // Vue capot : un fantôme tout près de l'œil (départ côte à côte, dépassement) n'est pas dessiné, la caméra serait dans sa caisse.
  if (hood && ghostMesh.visible && ghostMesh.position.distanceToSquared(camera.position) < HOOD_GHOST_CLEARANCE * HOOD_GHOST_CLEARANCE) ghostMesh.visible = false;
  // Turbo : le champ de vision s'ouvre encore (coup de zoom arrière), puis revient.
  fovKick += ((car.turbo > 0 ? 7 : car.boost > 0 ? 4 : 0) - fovKick) * (1 - Math.exp(-5 * elapsed));
  const fov = rig.fov + feel * (speedRatio * rig.fovAtSpeed + (hood ? fastCam.fov * 0.5 : fastCam.fov) + fovKick);
  if (Math.abs(camera.fov - fov) > 0.01) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }

  view.followGround(x, z);
  view.followCar(x, y, z, yaw, hood);
  view.setView(window.innerHeight * renderer.getPixelRatio(), camera.fov);
  effects.setViewport(window.innerHeight, camera.fov, renderer.getPixelRatio());
  effects.update({ dt: elapsed, x, y, z, yaw, tel, braking: wheelPose.braking, boost: car.boost > 0, turbo: car.turbo > 0, racing: phase !== "countdown" });
  gameAudio.update({
    speed,
    throttle: lastInput.throttle / AXIS_MAX,
    brake: lastInput.brake > 0,
    slide: tel.slide,
    grounded: tel.grounded,
    surface: tel.surface,
    kerb: tel.kerb,
    boost: car.boost > 0,
    turbo: car.turbo > 0,
    cut: car.cut > 0,
    active: phase === "racing" && !frozen && !manual,
  });
  // Lignes de vitesse au-delà de 75 % de la pointe, éclair du point de contrôle.
  const lines = Math.min(0.6, speedLinesOpacity(speed, car.turbo > 0) * feel);
  hudLines.style.opacity = phase === "countdown" ? "0" : lines.toFixed(2);
  flash = Math.max(0, flash - elapsed * 2.2);
  hudFlash.style.opacity = flash.toFixed(2);
  // Voile de la chute : il monte pendant les FALL_TICKS pas de la chute, et s'efface vite à la reprise.
  const veilTarget = race && race.fallTicks > 0 ? Math.min(1, (race.fallTicks / FALL_TICKS) * 1.25) : 0;
  fallVeil += (veilTarget - fallVeil) * (1 - Math.exp(-(veilTarget > fallVeil ? 14 : 7) * elapsed));
  hudFall.style.opacity = fallVeil < 0.01 ? "0" : fallVeil.toFixed(2);
  setSpeedText(formatSpeed(speed, settings.unit));
  const speedLevelNow = String(speedLevel(speed));
  if (hudSpeed.dataset.level !== speedLevelNow) hudSpeed.dataset.level = speedLevelNow; // jaune, orange puis rouge au-delà de la pointe
  updateEffects();
  // Accueil ouvert : la scène tourne derrière, mais à 30 images par seconde (20 sur téléphone) : c'est un décor, pas une course.
  const homeSkip = homeOpen && lastHomeRender > 0 && now - lastHomeRender < (touchMode ? 48 : 31);
  if (!manual && !homeSkip) {
    // pas à pas (outil de test) : pas de rendu, seulement la simulation et l'interface
    const t0 = performance.now();
    renderer.render(view.scene, camera);
    renderCost.ms += performance.now() - t0;
    renderCost.frames++;
    if (homeOpen) {
      lastHomeRender = now;
      homeCost.ms += performance.now() - t0;
      homeCost.frames++;
    }
  }
  splash?.remove(); // premier rendu fait : on retire l'écran de chargement
  splash = null;
  if (manualWaiters.length) {
    const waiters = manualWaiters;
    manualWaiters = [];
    for (const done of waiters) done();
  }
}

// Un jour passé, avec un classement (API ou mode démo) : on l'ouvre comme une archive — le fantôme du premier au départ, le
// classement figé affiché. `G` change de fantôme comme d'habitude.
if (online.enabled && daily && !submitAllowed && params.get("ghost") !== "off") {
  void online.remoteGhost("first").then((choice) => {
    if (choice && phase !== "finished" && !tuning) setGhost(choice.mode, choice.source, { mode: choice.mode, name: choice.name });
    autoShowBoard();
  });
}
if (demo && track) {
  // La démo (`?demo`, le pilote boucle sur le circuit) : le pilote automatique est chargé à la demande (lot 36), pas dans le premier chargement.
  void import("./demoPilot").then(({ bestPilotRun }) => {
    demoReplay = bestPilotRun(track!);
    if (demoReplay) startAttempt();
  });
}

// --- Le socle par paliers (lot 39) ---------------------------------------------------------------------------------------------
// La scène se construit par `composer` (scene/socle.ts), au palier courant (aujourd'hui « existant », le seul branché). Un autre palier se demande
// (`reconstructeur.demander`) : ses modules se chargent à la demande, puis la scène est reconstruite **hors course seulement** (accueil, pause, arrivée,
// podium du Salon : `peutReconstruire`) ; la voiture, les fantômes et les effets passent dans la nouvelle (`adopterScene`), l'ancienne est libérée.
let scenePalette = salon?.circuit.palette ?? daily?.palette ?? "desert";

function adopterScene(next: TrackScene) {
  const old = view;
  next.scene.add(carMesh, carShadow, ghostMesh);
  if (ghostField) next.scene.add(ghostField.group);
  effects.attach(next.scene);
  next.setQuality(governor.level, settings.shadows);
  view = next;
  renderer.toneMappingExposure = view.look.exposure;
  view.setView(window.innerHeight * renderer.getPixelRatio(), camera.fov);
  (old as Partial<TrackScene>).dispose?.();
}

const reconstructeur = creerReconstructeur({
  peutReconstruire: () => isFrozen() || phase === "finished",
  construire: (palier) => (track ? composer(track, scenePalette, palier) : null),
  adopter: adopterScene,
});

// --- Le Salon : changement de circuit sans recharger la page (lot 26) ---------------------------------------------------------
// Une nouvelle scène par session : la voiture, son ombre, les fantômes et les effets passent de l'ancienne à la nouvelle, puis l'ancienne
// est libérée (rien ne s'accumule côté carte graphique en une soirée de sessions). Le circuit vient du fil de travail, déjà préparé.
// `prebuilds` : scènes construites d'avance (outil de test : une scène se construit sur le fil principal, les mesures d'images l'attendent).
const salonStats = { buildMs: 0, swapMs: 0, swapAt: 0, prebuilt: 0, builtInSwap: 0, prebuilds: 0 };
let prebuilt: { id: string; scene: ReturnType<typeof buildTrackScene> } | null = null;

function buildSalonScene(c: LoadedSalonCircuit) {
  const t0 = performance.now();
  const next = composer(c.track, c.palette, reconstructeur.palier());
  salonStats.buildMs = performance.now() - t0;
  return next;
}

function swapSalonCircuit(c: LoadedSalonCircuit) {
  if (watch || watchWait) {
    // Spectateur : la session regardée est finie. On retourne au Salon normal (la nouvelle session, sans rediffusion).
    location.assign(unwatchHref(location.search));
    return;
  }
  const t0 = performance.now();
  salonStats.swapAt = t0;
  let next: ReturnType<typeof buildTrackScene>;
  if (prebuilt && prebuilt.id === c.id) {
    next = prebuilt.scene; // construite pendant le podium
    salonStats.prebuilt++;
  } else {
    prebuilt?.scene.dispose();
    next = buildSalonScene(c);
    salonStats.builtInSwap++;
  }
  prebuilt = null;
  adopterScene(next);
  scenePalette = c.palette;
  track = c.track;
  gameAudio.setAmbience(ambienceFor(c.palette));
  $("meta").textContent = salon!.title();
  best = null;
  ghostSource = null;
  ghostField?.clear();
  startAttempt(true); // décompte neuf sur le nouveau circuit (gelé tant que le podium est affiché)
  salonStats.swapMs = performance.now() - t0;
}

const salonHost: SalonHost = {
  swapCircuit: swapSalonCircuit,
  prebuild(c) {
    if (prebuilt?.id === c.id) return;
    prebuilt?.scene.dispose();
    prebuilt = { id: c.id, scene: buildSalonScene(c) };
    renderer.compile(prebuilt.scene.scene, camera); // shaders compilés derrière le classement final : pas de saccade quand le décompte repart (lot 33)
    salonStats.prebuilds++;
  },
  // « Une course est en cours » : elle roule vraiment (une voiture immobile sur la ligne n'a rien commencé : le podium n'attend pas).
  isRacing: () => !watch && !watchWait && phase === "racing" && !!race && (carSpeed(car) > 2 || race.splits.length > 0),
  abortRun() {
    if (phase === "racing") {
      phase = "finished";
      salonMod!.showSessionOver(hudFinish);
    }
  },
  finale(on) {
    startLocked = on;
    document.body.classList.toggle("start-locked", on);
    for (const b of document.querySelectorAll<HTMLElement>("#pause-restart, #btn-restart, #finish .restart")) b.setAttribute("aria-disabled", String(on));
    if (on) {
      boardPanel.setFolded(false); // classement affiché d'office pendant la finale
      hudBoard.hidden = false;
    } else syncBoardFold(); // rendu au réglage du joueur
  },
  banner: showBanner,
  flash() {
    flash = 1;
  },
  ghostsChanged(entries: GhostEntry[]) {
    if (watch || watchWait) return; // un spectateur ne court pas : pas de fantômes autour de la voiture regardée
    ghostField?.setEntries(entries);
    // Décompte : les fantômes partent avec ce départ. Course déjà commencée : les premiers fantômes rattrapent ta course tout de suite (le
    // classement peut arriver après le départ) ; ensuite, un changement de classement attend le prochain départ.
    if (!track || !ghostField) return;
    if (phase === "countdown") ghostField.restart(track);
    else if (phase === "racing" && ghostField.count === 0 && race) ghostField.restart(track, race.car.tick);
  },
};
if (salon) {
  document.body.classList.add("salon"); // le compte à rebours du Salon est plus large que l'objectif (hud.css)
  salon.attachHost(salonHost);
  syncBoardFold();
}
// Salon injoignable (lot 26) : dit dans l'en-tête (`renderHudTitle`), et rappelé au départ (le décompte écrase le bandeau jusque-là).
let salonNoticePending = salonNotice || (addressNotice ? t(addressNotice) : "");

// Revoir le meilleur tour (lot 27b) : `?watch=best`. Le tour vient du classement (jour ou session), sinon de ton record local ; s'il n'y
// en a pas, une course normale (dans le Salon : on attend le premier temps de la session).
if (watchWanted && track) {
  const entry = await Promise.race([loadWatchEntry(), new Promise<null>((r) => setTimeout(() => r(null), 4000))]);
  if (entry && beginWatch(entry)) {
    /* en lecture */
  } else if (salon && !entry) {
    watchWait = true;
    document.body.classList.add("watch");
    showBanner(t("salon.attente"), 3600, true);
    const waiting = setInterval(() => {
      void salon!.bestGhost().then((g) => {
        if (!g || !watchWait) return;
        clearInterval(waiting);
        watchWait = false;
        hudBanner.textContent = "";
        bannerTimer = 0;
        const e: WatchEntry = { name: g.name, ms: g.ms, splits: g.splits, replay: g.replay, simVersion: g.simVersion, mode: "salon", label: t("salon.premier", { nom: g.name }), color: salonMod!.GHOST_COLORS[0]! };
        if (!beginWatch(e)) location.replace(unwatchHref(location.search));
      });
    }, 2500);
  } else if (salon) {
    location.replace(unwatchHref(location.search)); // tour illisible ici : le Salon normal
  } else {
    salonNoticePending = t(entry ? "revoir.illisible" : "revoir.aucune");
    mountDrivingTouch();
  }
}
document.body.classList.toggle("no-splits", !settings.splits);
syncBoardFold();
if (!watchWanted && !salon && (settings.ghost === "first" || settings.ghost === "ahead") && params.get("ghost") !== "off" && online.enabled && !(daily && !submitAllowed)) applyGhostSetting();
if (homeOpen) {
  syncSceneQuality();
  homeUi.open();
} else if (needsHowto() && !watchWanted) howto.open();
void syncProfile(); // au lancement // première visite sans passer par l'accueil (lien direct) : l'aide d'abord
renderer.setAnimationLoop(frame);

// Accès de débogage pour les tests de navigateur (`?debug`) : état de la course, sans effet sur le jeu.
if (params.has("debug")) {
  Object.defineProperty(window, "__cdj", {
    value: {
      get race() {
        return race;
      },
      get car() {
        return car;
      },
      get phase() {
        return phase;
      },
      /** Dernière commande appliquée à la simulation. */
      get input() {
        return lastInput;
      },
      get paused() {
        return paused;
      },
      /** Pas à pas : la simulation n'avance plus qu'avec `advance`. */
      manual(on: boolean) {
        manual = on;
      },
      /** Avance de `n` pas de simulation (mode pas à pas) ; rendu une fois fait, la promesse se résout. */
      advance(n: number) {
        manualTicks += n;
        return new Promise<void>((resolve) => manualWaiters.push(resolve));
      },
      /** Effets : particules émises, qualité, particules vivantes (tests de navigateur). */
      get fx() {
        return { emitted: effects.emitted, marks: effects.marks, quality: effects.quality, particles: effects.particles, enabled: effects.enabled, shake, fovKick, fov: camera.fov, wheelDroop: [...wheelDroop], tel };
      },
      /** Rendu (lot 23) : qualité, ombres, phares, halos, décor dense, panneaux, brume. */
      /** Le socle par paliers (lot 39) : essais seulement (`e2e/socle.spec.ts` : un pas factice, un palier demandé en course puis à la pause). */
      socle: { composer, brancherComposeur, PAS_DU_JEU, PAS_DU_PALIER, demander: (p: Palier) => reconstructeur.demander(p), palier: () => reconstructeur.palier(), scene: () => view.scene.uuid },
      get render() {
        return { ...view.stats(), programs: renderer.info.programs?.length ?? 0, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, renderMs: renderCost.ms, renderFrames: renderCost.frames, home: { ...homeCost } };
      },
      /** Caméra active (lot 23) : nom, carrosserie visible ; `camera` change de caméra comme la touche C. */
      get camera() {
        return { name: CAMERAS[cameraIndex]!.name, carVisible: carMesh.visible, fov: camera.fov };
      },
      cycleCamera() {
        cycleCamera();
      },
      /** Air (lot 19) : indicateur « figé » allumé, dernière réception (force, qualité), part « en vol » de la caméra. */
      get air() {
        return { frozen: hudFreeze.classList.contains("on"), lastLanding, cameraMix: airMix };
      },
      /** Sons : derniers sons joués, contexte démarré, réglages. */
      get audio() {
        return { log: gameAudio.log, running: gameAudio.running, settings: gameAudio.settings, ambience: gameAudio.ambienceKind };
      },
      /** Dessine tout de suite la miniature d'un jour (outil de test : cadrage, vues, repli 2D) ; adresse de l'image. */
      async thumbnail(date: string, options: ThumbnailOptions & { theme?: string } = {}) {
        const c = await engine.daily(parseDay(date)!, themeByName(options.theme ?? null)?.name ?? null, 0);
        const timing = { build: 0, draw: 0 };
        const url = renderThumbnail({ track: c.track, palette: c.palette, theme: c.theme }, { ...options, timing }).toDataURL("image/png");
        return { url, timing };
      },
      /** Miniatures (lot 13) : compteurs, durées de fabrication, file d'attente. */
      get thumbs() {
        return { stats: thumbService.stats, pending: thumbService.pending };
      },
      /** Scène 3D (mesures de performance). */
      get scene() {
        return view.scene;
      },
      get touch() {
        return touchMode;
      },
      /** Identifiant du circuit joué, variante du planning en vigueur et classement permis (lot 14). */
      get trackId() {
        return track ? track.id : null;
      },
      get plan() {
        return { variant: daily?.variant ?? 0, theme: plan.theme, known: planKnown, trial, ranked: submitAllowed };
      },
      /** Le circuit du jour tel que le fil de travail l'a rendu (lot 36) : texte, temps d'auteur, thème… ; `null` hors du circuit du jour. */
      get circuit() {
        return daily ? { number: daily.number, attempt: daily.attempt, spec: daily.spec, authorMs: daily.authorMs, palette: daily.palette, theme: daily.theme, trackId: daily.track.id, medals: daily.medals, fallback: daily.fallback } : null;
      },
      get ghost() {
        return session?.ghost?.race.car ?? null;
      },
      /** Salon (lot 26) : état du déroulé, classement, fantômes, horloge pilotable (essais). */
      get salon() {
        if (!salon) return null;
        const sal = salon;
        return {
          state: sal.state,
          finaleOn: sal.finaleOn,
          startLocked,
          session: sal.session,
          trackId: sal.circuit.id,
          theme: sal.circuit.theme,
          sessionMs: sal.sessionMs,
          demo: sal.demo,
          board: sal.board,
          best: sal.best?.ms ?? null,
          players: sal.players,
          lastError: sal.lastError,
          ghostMode: sal.ghostMode,
          ghosts: ghostField ? { names: ghostField.names, count: ghostField.count, ...ghostField.stats, cost: { ...ghostField.cost } } : null,
          podiumVisible: !$("podium").hidden,
          now: sal.clock.now(),
          endMs: sal.endMs,
          stats: { ...sal.stats, ...salonStats },
          /** Fait valoir `ms` comme heure du Salon (l'horloge continue ensuite à avancer). */
          setNow: (ms: number) => sal.clock.set(ms),
          /** Fantômes affichés : `all`, `top` ou `off` (comme la touche G, sans passer par les autres). */
          setGhostMode(mode: "all" | "top" | "off") {
            sal.ghostMode = mode;
            ghostField?.setMode(mode);
          },
          refresh: () => sal.refreshBoard(),
        };
      },
      /** Spectateur (lot 27b) : tour regardé, vitesse, pause, pas courant et total, caméra ; `seek(pas)` y saute. */
      get watch() {
        if (!watch && !watchWait) return null;
        return {
          waiting: watchWait,
          name: watch?.entry.name ?? null,
          announcedMs: watch?.entry.ms ?? null,
          mode: watch?.entry.mode ?? null,
          speed: watch?.speed ?? 1,
          paused: watch?.paused ?? false,
          tick: watch ? watchTick() : 0,
          total: watch?.total ?? 0,
          finishMs: race ? race.finishMs : -1,
          phase,
          free: freeCam,
          label: nameLabel ? nameLabel.sprite.visible : false,
          carVisible: carMesh.visible,
          orbit: { ...orbit },
          seek: (tick: number) => watch && restartWatch(tick),
        };
      },
      /** Interface (lot 29) : accueil ouvert, réglages, aide, classement replié, réglages courants. */
      get ui() {
        return { home: homeOpen, settings: !!settingsPanel?.isOpen(), howto: howto.isOpen(), boardFolded: boardPanel.folded(), boardHidden: hudBoard.hidden, settingsValues: { ...settings }, paused, quality: governor.level, qualityLocked: governor.locked, homeAllowed };
      },
      /** Synchronisation du profil (lot 30) : état (`ok`, `offline`, `revoked`, `unknown`…) et record du jour tel qu'il est gardé ici. */
      get sync() {
        return { ...online.sync.state, best: best ? { ms: best.ms, replay: !!best.replay } : null, playerId: online.playerId, name: online.name };
      },
      /** Joue une rediffusion à la place du clavier (tests de navigateur). */
      autoplay(code: string) {
        const player = new ReplayPlayer(decodeReplay(code));
        startAttempt(); // repart d'un décompte neuf : la rediffusion commence au pas 0
        autoplay = player;
      },
    },
  });
}
