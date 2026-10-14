import { DEFAULT_JUMP_PARAMS, JUMP_PARAM_KEYS, TICK_RATE, UNITS_PER_TILE, isDefaultJumpParams, type JumpParams } from "@cdj/jump-sim";
import { storageKey } from "./storage";

// Panneau de réglages du personnage (`?debug&tune`) : un curseur par réglage, en unités humaines, la valeur entière à côté. Effet immédiat
// (la session lit les réglages à chaque pas). « Copier les valeurs » donne le JSON à coller (les valeurs retenues deviennent les défauts,
// version +1). Une partie aux réglages modifiés porte le drapeau `tuned` et ne sera jamais enregistrée.

type Unit = "speed" | "accel" | "ticks" | "length";

export interface TuneSlider {
  key: keyof JumpParams;
  label: string;
  unit: Unit;
  /** Bornes de la valeur entière. */
  min: number;
  max: number;
  /** Indication calculée (hauteur d'un saut, durée d'une accélération…). */
  hint?: (p: Readonly<JumpParams>) => string;
}

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
];

export const TUNE_STORAGE_KEY = storageKey("tune");

/** Réglages en JSON, dans l'ordre des défauts : prêts à coller dans `DEFAULT_JUMP_PARAMS`. */
export function paramsJson(params: Readonly<JumpParams>): string {
  return JSON.stringify(params, JUMP_PARAM_KEYS as string[], 2);
}

/** Lit des réglages gardés : seules les clés connues, entières et dans les bornes de leur curseur, sont reprises. */
export function parseTuned(text: string | null): JumpParams {
  const params: JumpParams = { ...DEFAULT_JUMP_PARAMS };
  if (!text) return params;
  try {
    const saved = JSON.parse(text) as Partial<Record<keyof JumpParams, unknown>>;
    for (const s of TUNE_SLIDERS) {
      const v = saved[s.key];
      if (typeof v === "number" && Number.isInteger(v) && v >= s.min && v <= s.max) params[s.key] = v;
    }
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
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
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

/** Construit le panneau dans `root`. `params` est modifié en place ; `onChange` après chaque modification. */
export function mountTunePanel(root: HTMLElement, params: JumpParams, onChange: () => void): { refresh(): void } {
  const head = document.createElement("div");
  head.className = "head";
  const title = document.createElement("strong");
  title.textContent = "Réglages du personnage";
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.textContent = "–";
  toggle.title = "Replier";
  head.append(title, toggle);

  const body = document.createElement("div");
  body.className = "body";
  const rows = new Map<keyof JumpParams, { input: HTMLInputElement; value: HTMLElement; hint: HTMLElement; row: HTMLElement }>();
  const status = document.createElement("div");
  status.className = "status";

  const refresh = () => {
    for (const s of TUNE_SLIDERS) {
      const r = rows.get(s.key)!;
      r.input.value = String(params[s.key]);
      r.value.textContent = `${formatHuman(s.unit, params[s.key])} (${params[s.key]})`;
      r.hint.textContent = s.hint ? s.hint(params) : "";
      r.row.classList.toggle("changed", params[s.key] !== DEFAULT_JUMP_PARAMS[s.key]);
    }
    const changed = JUMP_PARAM_KEYS.filter((k) => params[k] !== DEFAULT_JUMP_PARAMS[k]).length;
    status.textContent = changed === 0 ? "Réglages par défaut" : `${changed} réglage(s) modifié(s) : partie jamais enregistrée`;
  };

  for (const s of TUNE_SLIDERS) {
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
      params[s.key] = Math.round(Number(input.value));
      saveTuned(params);
      refresh();
      onChange();
    });
    // Rendre le clavier au personnage une fois le curseur lâché (les flèches ne doivent plus bouger le curseur).
    input.addEventListener("change", () => input.blur());
    row.append(name, value, input, hint);
    body.append(row);
    rows.set(s.key, { input, value, hint, row });
  }

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
  button("Copier les valeurs", async (b) => {
    const ok = await copyText(paramsJson(params));
    b.textContent = ok ? "Copié ✓" : "Copie impossible";
    setTimeout(() => (b.textContent = "Copier les valeurs"), 1600);
  });
  button("Réinitialiser", () => {
    Object.assign(params, DEFAULT_JUMP_PARAMS);
    saveTuned(params);
    refresh();
    onChange();
  });
  body.append(status, actions);

  toggle.addEventListener("click", () => {
    toggle.blur();
    const folded = root.classList.toggle("folded");
    toggle.textContent = folded ? "+" : "–";
    toggle.title = folded ? "Déplier" : "Replier";
  });
  root.replaceChildren(head, body);
  root.hidden = false;
  refresh();
  return { refresh };
}
