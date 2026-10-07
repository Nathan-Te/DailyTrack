import { DEFAULT_CAR_PARAMS, isDefaultParams, type CarParams } from "@cdj/sim";
import { copyText } from "./clipboard";

// Panneau de réglage de la conduite (`?debug&tune`, lot 7) : des curseurs sur les paramètres qui comptent le plus,
// effet immédiat sur la course en cours, et « Copier les réglages » (JSON) pour les envoyer à Nathan → retouche 7b.
// Une course jouée avec des réglages modifiés n'est jamais classée ni enregistrée comme record.

interface Slider {
  key: keyof CarParams;
  label: string;
  min: number;
  max: number;
  step: number;
}

/** Les paramètres réglables, du plus parlant au plus fin. */
export const TUNE_SLIDERS: readonly Slider[] = [
  { key: "gripFront", label: "Grip avant (m/s²)", min: 25, max: 70, step: 0.5 },
  { key: "gripRear", label: "Grip arrière (m/s²)", min: 25, max: 70, step: 0.5 },
  { key: "slipPeak", label: "Seuil de glisse (rad)", min: 0.04, max: 0.3, step: 0.005 },
  { key: "slideGrip", label: "Grip gardé en glisse", min: 0.4, max: 1, step: 0.01 },
  { key: "slideDrag", label: "Perte en glisse", min: 0, max: 20, step: 0.5 },
  { key: "steerMax", label: "Braquage lent (rad)", min: 0.25, max: 0.9, step: 0.01 },
  { key: "steerAtLimit", label: "Braquage rapide (× limite)", min: 0.7, max: 1.8, step: 0.01 },
  { key: "steerSpeed", label: "Vitesse du volant (1/s)", min: 4, max: 30, step: 0.5 },
  { key: "driftGrip", label: "Grip arrière en dérapage", min: 0.2, max: 1, step: 0.01 },
  { key: "driftAngle", label: "Angle de dérapage", min: 0.15, max: 0.8, step: 0.01 },
  { key: "driftPull", label: "Dérapage : serre le virage", min: 0, max: 90, step: 1 },
  { key: "maxSpeed", label: "Vitesse de pointe (m/s)", min: 30, max: 55, step: 0.5 },
  { key: "overspeedDrag", label: "Traînée au-delà de la pointe (m/s²)", min: 0.5, max: 8, step: 0.1 },
  { key: "boostMaxSpeed", label: "Plaque : vitesse max (m/s)", min: 48, max: 90, step: 1 },
  { key: "turboMaxSpeed", label: "Super turbo : vitesse max (m/s)", min: 48, max: 110, step: 1 },
  { key: "slopeGravity", label: "Pente : pesanteur (m/s²)", min: 0, max: 60, step: 1 },
  { key: "accel", label: "Accélération (m/s²)", min: 10, max: 40, step: 0.5 },
  { key: "brake", label: "Freinage (m/s²)", min: 20, max: 70, step: 1 },
  { key: "suspStiffness", label: "Raideur suspension", min: 20, max: 150, step: 1 },
  { key: "suspDamping", label: "Amortissement", min: 1, max: 15, step: 0.25 },
  { key: "gravity", label: "Gravité (m/s²)", min: 9.8, max: 35, step: 0.2 },
  { key: "landLoss", label: "Perte réception de travers", min: 0, max: 3, step: 0.05 },
  { key: "wallFriction", label: "Frottement rebord", min: 0, max: 0.8, step: 0.01 },
  { key: "wallBounce", label: "Rebond rebord", min: 0, max: 0.8, step: 0.01 },
];

/** Réglages en JSON, tels que la retouche 7b les attend (toutes les valeurs, triées comme `DEFAULT_CAR_PARAMS`). */
export function paramsJson(params: Readonly<CarParams>): string {
  return JSON.stringify(params, Object.keys(DEFAULT_CAR_PARAMS));
}

/** Réglages modifiés seulement (pour l'affichage). */
export function changedParams(params: Readonly<CarParams>): (keyof CarParams)[] {
  return (Object.keys(DEFAULT_CAR_PARAMS) as (keyof CarParams)[]).filter((k) => params[k] !== DEFAULT_CAR_PARAMS[k]);
}

const STORAGE_KEY = "cdj:tune";

/** Réglages du panneau gardés d'une visite à l'autre (seulement en mode `tune`). */
export function loadTunedParams(): CarParams {
  const params: CarParams = { ...DEFAULT_CAR_PARAMS };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<Record<keyof CarParams, unknown>>;
    for (const k of Object.keys(params) as (keyof CarParams)[]) {
      const v = saved[k];
      if (typeof v === "number" && Number.isFinite(v)) params[k] = v;
    }
  } catch {
    /* rien de gardé */
  }
  return params;
}

function saveTunedParams(params: Readonly<CarParams>): void {
  try {
    if (isDefaultParams(params)) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, paramsJson(params));
  } catch {
    /* stockage indisponible */
  }
}

/**
 * Construit le panneau dans `root`. `params` est modifié en place (la course en cours le lit à chaque pas) ;
 * `onChange` est appelé après chaque modification.
 */
export function mountTunePanel(root: HTMLElement, params: CarParams, onChange: () => void): void {
  const fmt = (v: number, step: number) => (step >= 1 ? String(v) : v.toFixed(Math.min(3, Math.max(1, -Math.floor(Math.log10(step))))));
  const head = document.createElement("div");
  head.className = "head";
  const title = document.createElement("strong");
  title.textContent = "Réglages de conduite";
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.textContent = "–";
  toggle.title = "Replier";
  head.append(title, toggle);

  const body = document.createElement("div");
  body.className = "body";
  const rows = new Map<keyof CarParams, { input: HTMLInputElement; value: HTMLElement; row: HTMLElement }>();
  const refresh = () => {
    for (const [key, r] of rows) {
      const s = TUNE_SLIDERS.find((x) => x.key === key)!;
      r.input.value = String(params[key]);
      r.value.textContent = fmt(params[key], s.step);
      r.row.classList.toggle("changed", params[key] !== DEFAULT_CAR_PARAMS[key]);
    }
    status.textContent = isDefaultParams(params) ? "Réglages par défaut" : `${changedParams(params).length} réglage(s) modifié(s) : courses non classées`;
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
    input.step = String(s.step);
    input.dataset.key = s.key;
    input.addEventListener("input", () => {
      params[s.key] = Number(input.value);
      saveTunedParams(params);
      refresh();
      onChange();
    });
    // Rendre le clavier à la voiture une fois le curseur lâché.
    input.addEventListener("change", () => input.blur());
    row.append(name, value, input);
    body.append(row);
    rows.set(s.key, { input, value, row });
  }

  const status = document.createElement("div");
  status.className = "status";
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
  button("Copier les réglages", async (b) => {
    const ok = await copyText(paramsJson(params));
    b.textContent = ok ? "Copié ✓" : "Copie impossible";
    setTimeout(() => (b.textContent = "Copier les réglages"), 1600);
  });
  button("Par défaut", () => {
    Object.assign(params, DEFAULT_CAR_PARAMS);
    saveTunedParams(params);
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
}
