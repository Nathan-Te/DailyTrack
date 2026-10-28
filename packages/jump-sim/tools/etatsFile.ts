import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { INPUT_LEFT, INPUT_RIGHT, TICK_RATE, decodeReplay, fromRuns, parseLevel, swapAlternes, type BuiltModule } from "../src/index";
import { modulesDir, packageDir } from "./files";
import { PHASE_WAIT_MAX, type PhaseResult, type PhasesFile, type VariantPhases } from "./phasesFile";

// Lot 28 — la **validation de la reprise depuis l'état B** des blocs alternés (fichiers et règles communes à `etats:modules` et aux tests). Depuis la version 12, une reprise sur le point de
// passage garde l'état des blocs alternés : un joueur peut repartir du palier d'entrée d'un morceau avec les deux jeux inversés (B plein). Une variante à blocs alternés n'est posée par
// le générateur g22 que si, **repartie à l'arrêt du palier d'entrée en B** (à chaque phase essayée de son horloge, comme `phases:modules`), elle a une solution **jouable par un humain**
// (gigue ±3 ≥ 50 %, appuis du lot 11 : la règle du lot 8c) qui ne reste pas plus de `PHASE_WAIT_MAX` (12 s) sur le palier avant de s'élancer. Sauter sur place y est permis (c'est ce qui
// remet A) ; le « premier candidat » de l'outil est exactement celui-là : un saut sur place, l'attente de la phase, puis la solution « arrêt » gardée.

/** Version de la règle (phases essayées, recherche, mesure) : la changer fait tout refaire. */
export const ETATS_RULE_VERSION = 1;

export const etatsPath = () => join(modulesDir(), "etats.json");
export const etatsSourcePath = () => join(packageDir(), "src", "etats.ts");

/** Le morceau seul avec les deux jeux inversés : son état A est l'état B du morceau d'origine. */
export function swappedModule(m: BuiltModule): BuiltModule {
  const ascii = swapAlternes(m.ascii);
  return { ...m, ascii, level: parseLevel(ascii) };
}

/** Le temps passé sur le palier avant de s'élancer : les pas jusqu'à la première commande de déplacement (un saut sur place compte, c'est de l'attente). */
export function moveWait(inputs: readonly number[]): number {
  let n = 0;
  while (n < inputs.length && (inputs[n]! & (INPUT_LEFT | INPUT_RIGHT)) === 0) n++;
  return n;
}

/** L'attente de la solution gardée d'une phase en B (0 sans solution). */
export function phaseWaitB(p: Pick<PhaseResult, "code">): number {
  return p.code ? moveWait(fromRuns(decodeReplay(p.code).runs)) : 0;
}

/** Une phase passe en B : une solution jouable par un humain (note ≥ 1) qui ne reste pas plus de `PHASE_WAIT_MAX` pas sur le palier. */
export const phaseOkB = (p: PhaseResult): boolean => p.exigence >= 1 && phaseWaitB(p) <= PHASE_WAIT_MAX;

/** Une variante passe quand toutes ses phases passent. */
export const variantOkB = (v: Pick<VariantPhases, "phases">): boolean => v.phases.length > 0 && v.phases.every(phaseOkB);

export function readEtats(): PhasesFile | null {
  try {
    return JSON.parse(readFileSync(etatsPath(), "utf8")) as PhasesFile;
  } catch {
    return null;
  }
}

/** Le texte de `src/etats.ts` : les variantes refusées (au moins une phase sans solution jouable depuis l'état B). */
export function etatsSource(file: PhasesFile): string {
  const refused: Record<string, number[]> = {};
  for (const [id, m] of Object.entries(file.modules)) {
    const ko = m.variants.flatMap((v, k) => (v && !variantOkB(v) ? [k] : []));
    if (ko.length > 0) refused[id] = ko;
  }
  return [
    "// Généré par `npm run etats:modules -w @cdj/jump-sim` (lot 28) à partir de `modules/etats.json` : ne pas modifier à la main.",
    "// Un test vérifie que ce fichier est exactement celui que le script écrirait (sinon : « relancer etats:modules »).",
    "",
    "/**",
    " * Lot 28 — **reprise depuis l'état B des blocs alternés** : les variantes (par morceau) à blocs alternés dont la reprise sur le point de passage qui les précède, les blocs étant dans",
    " * l'état B (celui que la reprise garde depuis la version 12), n'a pas de solution jouable par un humain, à l'une des phases essayées de leur horloge. Le générateur g22 ne les pose jamais",
    " * (`daily.ts`) ; le détail est dans `modules/etats.json`.",
    " */",
    `export const ALT_B_REFUSED: Readonly<Record<string, readonly number[]>> = ${JSON.stringify(refused)};`,
    "",
  ].join("\n");
}

export function writeEtats(file: PhasesFile): void {
  writeFileSync(etatsPath(), JSON.stringify(file, null, 1) + "\n");
  writeFileSync(etatsSourcePath(), etatsSource(file));
}

export { TICK_RATE };
