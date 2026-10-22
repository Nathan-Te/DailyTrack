import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { TICK_RATE, decodeReplay, fromRuns, parseLevel, sectionPeriod, withSingleClock, type BuiltModule } from "../src/index";
import { modulesDir, packageDir } from "./files";

// Lot 15 — la **validation toutes phases** des morceaux (fichiers et règles communes à `phases:modules` et aux tests). Dans un niveau à une
// seule horloge (v4), la mort ne remet rien à zéro : en repartant du point de passage qui précède un morceau, on le rencontre à n'importe
// quelle phase de son horloge. Une variante n'est posée par le générateur que si, **repartie à l'arrêt** de son palier d'entrée (la reprise
// sur le point de passage, exactement), elle a une solution **jouable par un humain** (gigue ±3 ≥ 50 %, appuis du lot 11 : la règle du lot 8c,
// attendre étant permis) à chacune des phases essayées : `PHASES_PER_PERIOD` phases réparties sur la période de son horloge (toutes si la
// période est plus courte).

/** Version de la règle (phases essayées, recherche, mesure) : la changer fait tout refaire. (Lot 17 : l'attente maximale se lit sur les solutions gardées, elle ne change pas la recherche.) */
export const PHASES_RULE_VERSION = 1;
/** Phases essayées par variante : au moins 8 (toutes si la période est plus courte). */
export const PHASES_PER_PERIOD = 8;

/**
 * Lot 17 — **attente maximale** : une reprise ne demande jamais plus de 12 s d'attente sur le palier, à aucune phase (sinon la variante est
 * refusée, même si une solution existe : un joueur n'attend pas 55 s devant un couloir). Mesurée sur la solution gardée : les pas sans
 * commande avant la première commande (`waitOf`).
 */
export const PHASE_WAIT_MAX = 12 * TICK_RATE;

export interface PhaseResult {
  /** Phase de l'horloge au départ (pas, dans [0, période)). */
  phase: number;
  /** La solution trouvée (rediffusion v4 du morceau seul mis à cette phase), ou null. */
  code: string | null;
  /** Pas de la sortie canonique, gigue (‰ à ±1, ±2, ±3) et note (0 : refusée). */
  exitTick: number;
  gigue: [number, number, number] | null;
  exigence: number;
}

export interface VariantPhases {
  /** Empreinte de la grille du morceau seul (comme `solutions.json`) : une autre grille, et c'est à refaire. */
  grid: string;
  /** Période de l'horloge du morceau (pas). */
  period: number;
  phases: PhaseResult[];
  /** Toutes les phases ont une solution jouable. */
  ok: boolean;
}

export interface PhasesFile {
  rule: number;
  perPeriod: number;
  /** Par morceau, par variante : `null` pour une variante sans horloge (rien qui tourne) ou inutilisable par le générateur. */
  modules: Record<string, { variants: (VariantPhases | null)[] }>;
}

export const phasesPath = () => join(modulesDir(), "phases.json");
export const phasesSourcePath = () => join(packageDir(), "src", "phases.ts");

/** L'attente d'une solution sur le palier : les pas sans commande avant la première (le chrono court, rien n'est touché). */
export function waitOf(inputs: readonly number[]): number {
  let n = 0;
  while (n < inputs.length && inputs[n] === 0) n++;
  return n;
}

/** L'attente de la solution gardée d'une phase (0 sans solution). */
export function phaseWait(p: Pick<PhaseResult, "code">): number {
  return p.code ? waitOf(fromRuns(decodeReplay(p.code).runs)) : 0;
}

/** Une phase passe : une solution jouable par un humain (note ≥ 1) qui n'attend pas plus de `PHASE_WAIT_MAX` pas. */
export const phaseOk = (p: PhaseResult): boolean => p.exigence >= 1 && phaseWait(p) <= PHASE_WAIT_MAX;

/** Une variante passe quand toutes ses phases passent. */
export const variantOk = (v: Pick<VariantPhases, "phases">): boolean => v.phases.length > 0 && v.phases.every(phaseOk);

/** Les phases essayées pour une période. */
export function phasesOf(period: number): number[] {
  if (period <= PHASES_PER_PERIOD) return Array.from({ length: period }, (_, k) => k);
  return Array.from({ length: PHASES_PER_PERIOD }, (_, k) => Math.floor((k * period) / PHASES_PER_PERIOD));
}

/** La période de l'horloge d'un morceau seul (sa seule section), 0 s'il n'a rien qui tourne. */
export function modulePeriod(m: BuiltModule): number {
  return m.level.sections.length === 0 ? 0 : sectionPeriod(m.level, 0);
}

/** Le morceau seul passé à l'horloge unique (version 4), sa section à la phase `phase` au chrono 0. */
export function singleClockModule(m: BuiltModule, phase: number): BuiltModule {
  const ascii = withSingleClock(m.ascii, [phase]);
  return { ...m, ascii, level: parseLevel(ascii) };
}

export function readPhases(): PhasesFile | null {
  try {
    return JSON.parse(readFileSync(phasesPath(), "utf8")) as PhasesFile;
  } catch {
    return null;
  }
}

/** Le texte de `src/phases.ts` : les variantes refusées (au moins une phase sans solution jouable). */
export function phasesSource(file: PhasesFile): string {
  const refused: Record<string, number[]> = {};
  for (const [id, m] of Object.entries(file.modules)) {
    const ko = m.variants.flatMap((v, k) => (v && !v.ok ? [k] : []));
    if (ko.length > 0) refused[id] = ko;
  }
  return [
    "// Généré par `npm run phases:modules -w @cdj/jump-sim` (lot 15) à partir de `modules/phases.json` : ne pas modifier à la main.",
    "// Un test vérifie que ce fichier est exactement celui que le script écrirait (sinon : « relancer phases:modules »).",
    "",
    "/**",
    " * Lot 15 — **validation toutes phases** : les variantes (par morceau) dont une reprise à l'arrêt, à l'une des phases essayées de leur horloge,",
    " * n'a pas de solution jouable par un humain. Le générateur v4 ne les pose jamais (`daily.ts`) ; le détail est dans `modules/phases.json`.",
    " */",
    `export const PHASE_REFUSED: Readonly<Record<string, readonly number[]>> = ${JSON.stringify(refused)};`,
    "",
  ].join("\n");
}

export function writePhases(file: PhasesFile): void {
  writeFileSync(phasesPath(), JSON.stringify(file, null, 1) + "\n");
  writeFileSync(phasesSourcePath(), phasesSource(file));
}
