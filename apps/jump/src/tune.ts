import {
  DEFAULT_JUMP_PARAMS,
  JUMP_PARAM_KEYS,
  MAX_SPEED,
  SPRINT_PARAM_KEYS,
  SPRINT_TRIAL_PARAMS,
  SURFACE_DEFAULTS,
  SURFACE_PARAM_KEYS,
  TICK_RATE,
  UNITS_PER_TILE,
  WIND_DEFAULTS,
  WIND_PARAM_KEYS,
  isDefaultJumpParams,
  sprintTop,
  surfaceParam,
  windParam,
  type JumpParamKey,
  type JumpParams,
  type SprintParamKey,
  type SurfaceParamKey,
  type WindParamKey,
} from "@cdj/jump-sim";
import { CAMERA, CAMERA_DEFAULTS, CARNAGE, CARNAGE_DEFAULTS, SHAKES, SHAKE_DEFAULTS, type CameraKey, type CarnageKey, type ShakeKey } from "./camera";
import { START, START_DEFAULTS } from "./session";
import { gameStorage, storageKey } from "./storage";

// Panneau de réglages du personnage (`?debug&tune`) : un curseur par réglage, en unités humaines, la valeur entière à côté. Effet immédiat
// (la session lit les réglages à chaque pas). « Copier les valeurs » donne le JSON à coller (les valeurs retenues deviennent les défauts,
// version +1). Une partie aux réglages modifiés porte le drapeau `tuned` et ne sera jamais enregistrée.
// Lot 8b : une section « Élan progressif (essai) » (interrupteur et trois curseurs) ; éteint par défaut, allumé la partie est `tuned`.
// Lot 11 : une section « Tapis et glace » (trois curseurs : `beltSpeed`, `iceAccel`, `iceDecel`). Ces réglages sont **optionnels** (absents de
// `DEFAULT_JUMP_PARAMS`, comme ceux de l'élan : absent = `SURFACE_DEFAULTS`) : le curseur montre le défaut tant qu'ils sont absents, la valeur
// n'est écrite qu'au premier mouvement du curseur, « Réinitialiser » les retire, et dès que l'un diffère du défaut la partie est `tuned`
// (`isDefaultJumpParams`) : rien n'est enregistré, le badge « réglages modifiés » s'affiche.
// Lot 13 : une section « Courants d'air » (trois curseurs : `windAccel`, `windRise`, `windDrift`), sur le même principe (absent = `WIND_DEFAULTS`).

type Unit = "speed" | "accel" | "ticks" | "length";

export interface TuneSlider<K extends keyof JumpParams = JumpParamKey> {
  key: K;
  label: string;
  unit: Unit;
  /** Bornes de la valeur entière. */
  min: number;
  max: number;
  /** Indication calculée (hauteur d'un saut, durée d'une accélération…). */
  hint?: (p: Readonly<JumpParams>) => string;
}

/** Lot 8b : les curseurs de l'essai d'élan (section à part, sans défaut : valeurs de départ `SPRINT_TRIAL_PARAMS`). */
export type SprintSlider = TuneSlider<Exclude<SprintParamKey, "sprintMode">>;

/** Lot 11 : les curseurs des surfaces (section à part, valeurs par défaut `SURFACE_DEFAULTS`). */
export type SurfaceSlider = TuneSlider<SurfaceParamKey>;
/** Lot 13 : les curseurs du vent (section à part, valeurs par défaut `WIND_DEFAULTS`). */
export type WindSlider = TuneSlider<WindParamKey>;

const T = UNITS_PER_TILE;
const R = TICK_RATE;
const num = (v: number, digits = 1) => v.toFixed(digits).replace(".", ",");

/** Valeur entière → unité humaine (tuiles/s, tuiles/s², secondes, tuiles). */
export function toHuman(unit: Unit, v: number): number {
  switch (unit) {
    case "speed":
      return (v * R) / T;
    case "accel":
      return (v * R * R) / T;
    case "ticks":
      return v / R;
    case "length":
      return v / T;
  }
}

export function formatHuman(unit: Unit, v: number): string {
  const h = toHuman(unit, v);
  switch (unit) {
    case "speed":
      return `${num(h)} tuiles/s`;
    case "accel":
      return `${num(h)} tuiles/s²`;
    case "ticks":
      return `${num(h, 3)} s`;
    case "length":
      return `${num(h, 3)} tuile`;
  }
}

/** Hauteur d'un saut lancé à `v` unités/pas sous une gravité `g` (somme exacte des pas de montée), en tuiles. */
export function jumpHeight(v: number, g: number): number {
  if (g <= 0) return Infinity;
  let h = 0;
  for (let vy = v; vy > 0; vy -= g) h += vy;
  return h / T;
}

/** Pas pour atteindre `target` en ajoutant `step` à chaque pas. */
const ticksTo = (target: number, step: number) => (step > 0 ? Math.ceil(target / step) : Infinity);

export const TUNE_SLIDERS: readonly TuneSlider[] = [
  { key: "runSpeed", label: "Vitesse de course", unit: "speed", min: 100, max: 1000 },
  { key: "groundAccel", label: "Accélération au sol", unit: "accel", min: 1, max: 120, hint: (p) => `pleine vitesse en ${num(ticksTo(p.runSpeed, p.groundAccel) / R, 2)} s` },
  { key: "groundDecel", label: "Freinage au sol (et demi-tour)", unit: "accel", min: 1, max: 160, hint: (p) => `arrêt en ${num(ticksTo(p.runSpeed, p.groundDecel) / R, 2)} s` },
  { key: "airAccel", label: "Accélération en l'air", unit: "accel", min: 0, max: 120 },
  { key: "airDecel", label: "Freinage en l'air (sans commande)", unit: "accel", min: 0, max: 120 },
  { key: "gravity", label: "Gravité", unit: "accel", min: 1, max: 60 },
  { key: "fallSpeed", label: "Chute maximale", unit: "speed", min: 100, max: 2000 },
  { key: "jumpSpeed", label: "Impulsion du saut", unit: "speed", min: 200, max: 2000, hint: (p) => `saut complet ≈ ${num(jumpHeight(p.jumpSpeed, p.gravity), 2)} tuiles, montée ${num(ticksTo(p.jumpSpeed, p.gravity) / R, 2)} s` },
  { key: "jumpCut", label: "Coupe de saut (montée gardée au relâcher)", unit: "speed", min: 0, max: 1500, hint: (p) => `saut court ≈ ${num(p.jumpSpeed / T + jumpHeight(Math.min(p.jumpCut, p.jumpSpeed), p.gravity), 2)} tuiles` },
  { key: "slideSpeed", label: "Glisse murale (chute max)", unit: "speed", min: 0, max: 1000 },
  { key: "wallJumpX", label: "Saut mural : poussée", unit: "speed", min: 0, max: 1200 },
  { key: "wallJumpY", label: "Saut mural : impulsion", unit: "speed", min: 0, max: 1500, hint: (p) => `≈ ${num(jumpHeight(p.wallJumpY, p.gravity), 2)} tuiles` },
  { key: "wallLock", label: "Saut mural : verrou vers le mur", unit: "ticks", min: 0, max: 60 },
  { key: "wallReach", label: "Saut mural : portée", unit: "length", min: 0, max: 2048 },
  { key: "coyote", label: "Coyote (sol)", unit: "ticks", min: 0, max: 30 },
  { key: "wallCoyote", label: "Coyote mural", unit: "ticks", min: 0, max: 30 },
  { key: "jumpBuffer", label: "Tampon de saut", unit: "ticks", min: 0, max: 30 },
  { key: "cornerTolerance", label: "Tolérance de coin", unit: "length", min: 0, max: 2048 },
  { key: "crumbleDelay", label: "Bloc friable : délai avant la chute", unit: "ticks", min: 0, max: 120 },
  // Le ressort lance à la fin du pas où l'on s'y pose : la gravité agit avant le premier mouvement (d'où `v − g`).
  { key: "springSpeed", label: "Ressort : vitesse de lancement", unit: "speed", min: 0, max: 2048, hint: (p) => `≈ ${num(jumpHeight(Math.min(p.springSpeed, MAX_SPEED) - p.gravity, p.gravity), 2)} tuiles de haut` },
];

/** Valeur d'un réglage d'élan, ou sa valeur de départ s'il n'est pas encore réglé. */
export const sprintValue = (p: Readonly<JumpParams>, key: SprintParamKey): number => p[key] ?? SPRINT_TRIAL_PARAMS[key];

const sprintParams = (p: Readonly<JumpParams>): JumpParams => ({ ...p, sprintSpeed: sprintValue(p, "sprintSpeed"), sprintAccel: sprintValue(p, "sprintAccel") });

export const SPRINT_SLIDERS: readonly SprintSlider[] = [
  { key: "sprintSpeed", label: "Élan : vitesse maximale", unit: "speed", min: 375, max: 1500, hint: (p) => `+${num(((sprintTop(sprintParams(p)) - p.runSpeed) * R) / T)} tuiles/s sur la course` },
  { key: "sprintDelay", label: "Élan : temps à pleine vitesse avant l'élan", unit: "ticks", min: 0, max: 240 },
  {
    key: "sprintAccel",
    label: "Élan : accélération",
    unit: "accel",
    min: 1,
    max: 40,
    hint: (p) => `élan atteint en ${num(ticksTo(sprintTop(sprintParams(p)) - p.runSpeed, sprintValue(p, "sprintAccel")) / R, 2)} s`,
  },
];

/** Valeur d'un réglage de surface, ou son défaut s'il n'est pas réglé. */
export const surfaceValue = (p: Readonly<JumpParams>, key: SurfaceParamKey): number => surfaceParam(p, key);

export const SURFACE_SLIDERS: readonly SurfaceSlider[] = [
  {
    key: "beltSpeed",
    label: "Tapis roulant : vitesse ajoutée",
    unit: "speed",
    min: 0,
    max: 600,
    hint: (p) => `avec le tapis : ${num(((p.runSpeed + surfaceValue(p, "beltSpeed")) * R) / T)} tuiles/s, contre : ${num((Math.abs(p.runSpeed - surfaceValue(p, "beltSpeed")) * R) / T)} tuiles/s`,
  },
  { key: "iceAccel", label: "Glace : accélération", unit: "accel", min: 1, max: 120, hint: (p) => `pleine vitesse en ${num(ticksTo(p.runSpeed, surfaceValue(p, "iceAccel")) / R, 2)} s` },
  { key: "iceDecel", label: "Glace : freinage (et demi-tour)", unit: "accel", min: 1, max: 160, hint: (p) => `arrêt en ${num(ticksTo(p.runSpeed, surfaceValue(p, "iceDecel")) / R, 2)} s` },
];

/** Combien de réglages de surface diffèrent de leur défaut. */
export const surfacesChanged = (p: Readonly<JumpParams>): number => SURFACE_PARAM_KEYS.filter((k) => surfaceValue(p, k) !== SURFACE_DEFAULTS[k]).length;

/** Lot 13 : valeur d'un réglage du vent, ou son défaut. */
export const windValue = (p: Readonly<JumpParams>, key: WindParamKey): number => windParam(p, key);

export const WIND_SLIDERS: readonly WindSlider[] = [
  { key: "windAccel", label: "Vent : poussée", unit: "accel", min: 1, max: 120, hint: (p) => `montée atteinte en ${num(ticksTo(windValue(p, "windRise"), windValue(p, "windAccel")) / R, 2)} s depuis l'arrêt` },
  { key: "windRise", label: "Vent vers le haut : montée maximale", unit: "speed", min: 0, max: 1200, hint: (p) => `on plane à ${num((windValue(p, "windRise") * R) / T)} tuiles/s vers le haut` },
  {
    key: "windDrift",
    label: "Vent latéral : dérive",
    unit: "speed",
    min: 0,
    max: 800,
    hint: (p) => `avec le vent : ${num(((p.runSpeed + windValue(p, "windDrift")) * R) / T)} tuiles/s, contre : ${num(((p.runSpeed - windValue(p, "windDrift")) * R) / T)} tuiles/s`,
  },
];

/** Combien de réglages du vent diffèrent de leur défaut. */
export const windsChanged = (p: Readonly<JumpParams>): number => WIND_PARAM_KEYS.filter((k) => windValue(p, k) !== WIND_DEFAULTS[k]).length;

export const TUNE_STORAGE_KEY = storageKey("tune");

// Lot 14 : la section « Caméra et secousses », en tête du panneau `?debug&tune`. Affichage seulement : ne rend jamais la partie `tuned`, mémorisée à part
// (`jump:camera`, seulement relue avec `?debug&tune` : sans outil, le jeu a les valeurs par défaut).
export const CAMERA_STORAGE_KEY = storageKey("camera");

export interface CameraSlider {
  /** Lot 15 : `pret`, la durée du « Prêt… » avant le départ d'un niveau à une seule horloge (`START`, session.ts). */
  key: CameraKey | ShakeKey | CarnageKey | "pret";
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
}

export const CAMERA_SLIDERS: readonly CameraSlider[] = [
  { key: "mortAmp", label: "Secousse à la mort : amplitude", min: 0, max: 0.5, step: 0.01, unit: "tuile" },
  { key: "mortDur", label: "Secousse à la mort : durée", min: 0.02, max: 0.5, step: 0.01, unit: "s" },
  { key: "chuteAmp", label: "Secousse d'une grosse chute : amplitude (0 : aucune)", min: 0, max: 0.5, step: 0.01, unit: "tuile" },
  { key: "chuteDur", label: "Secousse d'une grosse chute : durée", min: 0.02, max: 0.5, step: 0.01, unit: "s" },
  { key: "deadZone", label: "Zone morte verticale (demi-hauteur)", min: 0, max: 6, step: 0.1, unit: "tuiles" },
  { key: "settleRate", label: "Recalage doux au sol (vitesse)", min: 0.2, max: 8, step: 0.1, unit: "/s" },
  { key: "verticalRate", label: "Suivi hors de la zone (chutes, longues montées)", min: 1, max: 14, step: 0.5, unit: "/s" },
  { key: "clockOpacity", label: "Carnage : opacité des dangers à horloge (scies mobiles, clignotants, rafales)", min: 0.1, max: 1, step: 0.05, unit: "(1 = normal)" },
  { key: "pret", label: "« Prêt… » avant le départ (horloge unique, lot 15)", min: 0.1, max: 3, step: 0.05, unit: "s" },
];

const isShakeKey = (k: CameraSlider["key"]): k is ShakeKey => k in SHAKE_DEFAULTS;
const isCarnageKey = (k: CameraSlider["key"]): k is CarnageKey => k in CARNAGE_DEFAULTS;
const cameraValue = (k: CameraSlider["key"]): number => (k === "pret" ? START.pret : isCarnageKey(k) ? CARNAGE[k] : isShakeKey(k) ? SHAKES[k] : CAMERA[k]);
const cameraDefault = (k: CameraSlider["key"]): number => (k === "pret" ? START_DEFAULTS.pret : isCarnageKey(k) ? CARNAGE_DEFAULTS[k] : isShakeKey(k) ? SHAKE_DEFAULTS[k] : CAMERA_DEFAULTS[k]);
const setCamera = (k: CameraSlider["key"], v: number): void => {
  if (k === "pret") START.pret = v;
  else if (isCarnageKey(k)) CARNAGE[k] = v;
  else if (isShakeKey(k)) SHAKES[k] = v;
  else CAMERA[k] = v;
};

/** Relit les réglages de la caméra gardés (seules les clés connues et dans leurs bornes sont reprises). */
export function loadCameraTune(storage: Pick<Storage, "getItem"> | null = safeStorage()): void {
  try {
    const saved = JSON.parse(storage?.getItem(CAMERA_STORAGE_KEY) ?? "{}") as Record<string, unknown>;
    for (const s of CAMERA_SLIDERS) {
      const v = saved[s.key];
      if (typeof v === "number" && v >= s.min && v <= s.max) setCamera(s.key, v);
    }
  } catch {
    /* texte illisible ou stockage indisponible : les défauts */
  }
}

function saveCameraTune(): void {
  try {
    const out: Record<string, number> = {};
    for (const s of CAMERA_SLIDERS) if (cameraValue(s.key) !== cameraDefault(s.key)) out[s.key] = cameraValue(s.key);
    if (Object.keys(out).length === 0) safeStorage()?.removeItem(CAMERA_STORAGE_KEY);
    else safeStorage()?.setItem(CAMERA_STORAGE_KEY, JSON.stringify(out));
  } catch {
    /* stockage indisponible */
  }
}

/** Les valeurs de la section Caméra, en JSON (à donner pour en faire les défauts). */
export const cameraJson = (): string => JSON.stringify(Object.fromEntries(CAMERA_SLIDERS.map((s) => [s.key, cameraValue(s.key)])), null, 2);

/**
 * Réglages en JSON, dans l'ordre des défauts : prêts à coller dans `DEFAULT_JUMP_PARAMS`. L'élan n'y est que s'il est allumé ; les réglages des
 * surfaces (lot 11) que s'ils diffèrent de leur défaut.
 */
export function paramsJson(params: Readonly<JumpParams>): string {
  const keys: string[] = [...JUMP_PARAM_KEYS];
  if (params.sprintMode) for (const k of SPRINT_PARAM_KEYS) if (params[k] !== undefined) keys.push(k);
  for (const k of SURFACE_PARAM_KEYS) if (params[k] !== undefined && params[k] !== SURFACE_DEFAULTS[k]) keys.push(k);
  for (const k of WIND_PARAM_KEYS) if (params[k] !== undefined && params[k] !== WIND_DEFAULTS[k]) keys.push(k);
  return JSON.stringify(params, keys, 2);
}

/** Lot 8b : allume l'élan (les réglages absents prennent leur valeur de départ) ou l'éteint (ses réglages restent, sans effet). */
export function setSprint(params: JumpParams, on: boolean): void {
  if (!on) {
    params.sprintMode = 0;
    return;
  }
  for (const k of SPRINT_PARAM_KEYS) params[k] = sprintValue(params, k);
  params.sprintMode = 1;
}

/** Remet les défauts : l'élan disparaît (ses réglages aussi), et les réglages des surfaces reviennent à leur défaut (absents). */
export function resetParams(params: JumpParams): void {
  Object.assign(params, DEFAULT_JUMP_PARAMS);
  for (const k of SPRINT_PARAM_KEYS) delete params[k];
  for (const k of SURFACE_PARAM_KEYS) delete params[k];
  for (const k of WIND_PARAM_KEYS) delete params[k];
}

/** Lit des réglages gardés : seules les clés connues, entières et dans les bornes de leur curseur, sont reprises. */
export function parseTuned(text: string | null): JumpParams {
  const params: JumpParams = { ...DEFAULT_JUMP_PARAMS };
  if (!text) return params;
  try {
    const saved = JSON.parse(text) as Partial<Record<keyof JumpParams, unknown>>;
    for (const s of [...TUNE_SLIDERS, ...SPRINT_SLIDERS, ...SURFACE_SLIDERS, ...WIND_SLIDERS]) {
      const v = saved[s.key];
      if (typeof v === "number" && Number.isInteger(v) && v >= s.min && v <= s.max) params[s.key] = v;
    }
    if (saved.sprintMode === 1) setSprint(params, true);
  } catch {
    /* texte illisible : les défauts */
  }
  return params;
}

export function loadTuned(storage: Pick<Storage, "getItem"> | null = safeStorage()): JumpParams {
  try {
    return parseTuned(storage?.getItem(TUNE_STORAGE_KEY) ?? null);
  } catch {
    return { ...DEFAULT_JUMP_PARAMS };
  }
}

export function saveTuned(params: Readonly<JumpParams>, storage: Pick<Storage, "setItem" | "removeItem"> | null = safeStorage()): void {
  try {
    if (isDefaultJumpParams(params)) storage?.removeItem(TUNE_STORAGE_KEY);
    else storage?.setItem(TUNE_STORAGE_KEY, JSON.stringify(params));
  } catch {
    /* stockage indisponible */
  }
}

function safeStorage(): Storage | null {
  return gameStorage();
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    document.body.append(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}

export interface TunePanelOptions {
  /** Sur téléphone : le panneau s'ouvre par ⚙ ; ce bouton ✕ le referme (à la place du repli – / +). */
  onClose?: () => void;
}

/** Construit le panneau dans `root`. `params` est modifié en place ; `onChange` après chaque modification (curseur, interrupteur d'élan). */
export function mountTunePanel(root: HTMLElement, params: JumpParams, onChange: () => void, options: TunePanelOptions = {}): { refresh(): void } {
  const head = document.createElement("div");
  head.className = "head";
  const title = document.createElement("strong");
  title.textContent = "Réglages du personnage";
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.textContent = options.onClose ? "✕" : "–";
  toggle.title = options.onClose ? "Fermer" : "Replier";
  if (options.onClose) toggle.setAttribute("aria-label", "Fermer les réglages");
  head.append(title, toggle);

  const body = document.createElement("div");
  body.className = "body";
  type Row = { input: HTMLInputElement; value: HTMLElement; hint: HTMLElement; row: HTMLElement };
  const rows = new Map<JumpParamKey, Row>();
  const sprintRows = new Map<Exclude<SprintParamKey, "sprintMode">, Row>();
  const surfaceRows = new Map<SurfaceParamKey, Row>();
  const windRows = new Map<WindParamKey, Row>();
  const status = document.createElement("div");
  status.className = "status";

  // Lot 8b : la section de l'essai d'élan, sous les réglages du personnage.
  const sprintBox = document.createElement("div");
  sprintBox.className = "sprint";
  const sprintTitle = document.createElement("strong");
  sprintTitle.textContent = "Élan progressif (essai)";
  const sprintNote = document.createElement("small");
  sprintNote.className = "hint";
  sprintNote.textContent = "Après un moment à pleine vitesse au sol, le personnage accélère encore. Jamais enregistré, jamais classé.";
  const sprintSwitch = document.createElement("button");
  sprintSwitch.type = "button";
  sprintSwitch.className = "switch";
  sprintSwitch.dataset.key = "sprintMode";

  const refresh = () => {
    for (const s of TUNE_SLIDERS) {
      const r = rows.get(s.key)!;
      r.input.value = String(params[s.key]);
      r.value.textContent = `${formatHuman(s.unit, params[s.key])} (${params[s.key]})`;
      r.hint.textContent = s.hint ? s.hint(params) : "";
      r.row.classList.toggle("changed", params[s.key] !== DEFAULT_JUMP_PARAMS[s.key]);
    }
    const on = params.sprintMode === 1;
    for (const s of SPRINT_SLIDERS) {
      const r = sprintRows.get(s.key)!;
      const v = sprintValue(params, s.key);
      r.input.value = String(v);
      r.input.disabled = !on;
      r.value.textContent = `${formatHuman(s.unit, v)} (${v})`;
      r.hint.textContent = s.hint ? s.hint(params) : "";
      r.row.classList.toggle("changed", on);
    }
    for (const s of SURFACE_SLIDERS) {
      const r = surfaceRows.get(s.key)!;
      const v = surfaceValue(params, s.key);
      r.input.value = String(v);
      r.value.textContent = `${formatHuman(s.unit, v)} (${v})`;
      r.hint.textContent = s.hint ? s.hint(params) : "";
      r.row.classList.toggle("changed", v !== SURFACE_DEFAULTS[s.key]);
    }
    for (const s of WIND_SLIDERS) {
      const r = windRows.get(s.key)!;
      const v = windValue(params, s.key);
      r.input.value = String(v);
      r.value.textContent = `${formatHuman(s.unit, v)} (${v})`;
      r.hint.textContent = s.hint ? s.hint(params) : "";
      r.row.classList.toggle("changed", v !== WIND_DEFAULTS[s.key]);
    }
    sprintSwitch.textContent = on ? "Élan : activé" : "Élan : désactivé";
    sprintSwitch.setAttribute("aria-pressed", on ? "true" : "false");
    sprintBox.classList.toggle("on", on);
    const changed = JUMP_PARAM_KEYS.filter((k) => params[k] !== DEFAULT_JUMP_PARAMS[k]).length + (on ? 1 : 0) + surfacesChanged(params) + windsChanged(params);
    status.textContent = changed === 0 ? "Réglages par défaut" : `${changed} réglage(s) modifié(s) : partie jamais enregistrée`;
  };

  const addSlider = <K extends keyof JumpParams>(parent: HTMLElement, s: TuneSlider<K>, store: Map<K, Row>) => {
    const row = document.createElement("label");
    row.className = "row";
    const name = document.createElement("span");
    name.textContent = s.label;
    const value = document.createElement("span");
    value.className = "value";
    const input = document.createElement("input");
    input.type = "range";
    input.min = String(s.min);
    input.max = String(s.max);
    input.step = "1";
    input.dataset.key = s.key;
    const hint = document.createElement("small");
    hint.className = "hint";
    input.addEventListener("input", () => {
      (params as unknown as Record<K, number>)[s.key] = Math.round(Number(input.value));
      saveTuned(params);
      refresh();
      onChange();
    });
    // Rendre le clavier au personnage une fois le curseur lâché (les flèches ne doivent plus bouger le curseur).
    input.addEventListener("change", () => input.blur());
    row.append(name, value, input, hint);
    parent.append(row);
    store.set(s.key, { input, value, hint, row });
  };
  for (const s of TUNE_SLIDERS) addSlider(body, s, rows);

  sprintSwitch.addEventListener("click", () => {
    sprintSwitch.blur();
    setSprint(params, params.sprintMode !== 1);
    saveTuned(params);
    refresh();
    onChange();
  });
  sprintBox.append(sprintTitle, sprintNote, sprintSwitch);
  for (const s of SPRINT_SLIDERS) addSlider(sprintBox, s, sprintRows);
  body.append(sprintBox);

  // Lot 11 : la section « Tapis et glace ».
  const surfaceBox = document.createElement("div");
  surfaceBox.className = "surfaces";
  const surfaceTitle = document.createElement("strong");
  surfaceTitle.textContent = "Tapis et glace";
  const surfaceNote = document.createElement("small");
  surfaceNote.className = "hint";
  surfaceNote.textContent = "Vitesse du tapis roulant, accélération et freinage sur la glace. Modifiés, la partie n'est jamais enregistrée.";
  surfaceBox.append(surfaceTitle, surfaceNote);
  for (const s of SURFACE_SLIDERS) addSlider(surfaceBox, s, surfaceRows);
  body.append(surfaceBox);

  // Lot 13 : la section « Courants d'air ».
  const windBox = document.createElement("div");
  windBox.className = "winds";
  const windTitle = document.createElement("strong");
  windTitle.textContent = "Courants d'air";
  const windNote = document.createElement("small");
  windNote.className = "hint";
  windNote.textContent = "Poussée, montée maximale (vent vers le haut) et dérive (vent latéral), à force 100. Modifiés, la partie n'est jamais enregistrée.";
  windBox.append(windTitle, windNote);
  for (const s of WIND_SLIDERS) addSlider(windBox, s, windRows);
  body.append(windBox);

  // Lot 14 : la section « Caméra et secousses ».
  const cameraBox = document.createElement("div");
  cameraBox.className = "camera";
  cameraBox.id = "camera";
  const cameraTitle = document.createElement("strong");
  cameraTitle.textContent = "Caméra et secousses";
  const cameraNote = document.createElement("small");
  cameraNote.className = "hint";
  cameraNote.textContent = "Affichage seulement (la partie n'est pas modifiée). Les secousses ne sont lancées que par la mort ; les valeurs sont gardées dans ce navigateur.";
  cameraBox.append(cameraTitle, cameraNote);
  const cameraRows: { s: CameraSlider; input: HTMLInputElement; value: HTMLElement; row: HTMLElement }[] = [];
  for (const s of CAMERA_SLIDERS) {
    const row = document.createElement("label");
    row.className = "row";
    const name = document.createElement("span");
    name.textContent = s.label;
    const value = document.createElement("span");
    value.className = "value";
    const input = document.createElement("input");
    input.type = "range";
    input.min = String(s.min);
    input.max = String(s.max);
    input.step = String(s.step);
    input.dataset.key = s.key;
    input.addEventListener("input", () => {
      setCamera(s.key, Number(input.value));
      saveCameraTune();
      refreshCamera();
    });
    input.addEventListener("change", () => input.blur());
    row.append(name, value, input);
    cameraBox.append(row);
    cameraRows.push({ s, input, value, row });
  }
  function refreshCamera(): void {
    for (const r of cameraRows) {
      const v = cameraValue(r.s.key);
      r.input.value = String(v);
      r.value.textContent = `${num(v, 2)} ${r.s.unit}`;
      r.row.classList.toggle("changed", v !== cameraDefault(r.s.key));
    }
  }
  loadCameraTune();
  refreshCamera();
  body.prepend(cameraBox); // en tête du panneau : visible dès l'ouverture de `?debug&tune`

  const actions = document.createElement("div");
  actions.className = "actions";
  const button = (label: string, onClick: (b: HTMLButtonElement) => void | Promise<void>) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.addEventListener("click", async () => {
      b.blur();
      await onClick(b);
    });
    actions.append(b);
    return b;
  };
  // Presse-papiers refusé (page non sécurisée, navigateur strict) : le JSON s'affiche dans une zone de texte déjà sélectionnée.
  const fallback = document.createElement("textarea");
  fallback.className = "json";
  fallback.readOnly = true;
  fallback.rows = 8;
  fallback.hidden = true;
  fallback.setAttribute("aria-label", "Valeurs à copier");
  button("Copier les valeurs", async (b) => {
    const text = paramsJson(params);
    const ok = await copyText(text);
    fallback.hidden = ok;
    if (!ok) {
      fallback.value = text;
      fallback.focus();
      fallback.select();
      fallback.setSelectionRange(0, text.length);
    }
    b.textContent = ok ? "Copié ✓" : "Copie impossible : texte ci-dessous";
    setTimeout(() => (b.textContent = "Copier les valeurs"), 2400);
  });
  button("Copier la caméra", async (b) => {
    const ok = await copyText(cameraJson());
    b.textContent = ok ? "Copié ✓" : "Copie impossible";
    setTimeout(() => (b.textContent = "Copier la caméra"), 2400);
  });
  button("Réinitialiser", () => {
    for (const s of CAMERA_SLIDERS) setCamera(s.key, cameraDefault(s.key));
    saveCameraTune();
    refreshCamera();
    resetParams(params);
    saveTuned(params);
    refresh();
    onChange();
  });
  body.append(status, actions, fallback);

  toggle.addEventListener("click", () => {
    toggle.blur();
    if (options.onClose) {
      options.onClose();
      return;
    }
    const folded = root.classList.toggle("folded");
    toggle.textContent = folded ? "+" : "–";
    toggle.title = folded ? "Déplier" : "Replier";
  });
  root.replaceChildren(head, body);
  root.hidden = options.onClose ? true : false;
  refresh();
  return { refresh };
}
