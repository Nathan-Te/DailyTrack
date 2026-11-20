import { writeFileSync } from "node:fs";
import { PLANS_ESSAI, THEMES_PINBALL, Partie, analyserTable, cleDeTable, dailyPinball, defautsDeConception, densite, nombreDeTirs, tirsDeConception, type Contenu } from "../src/index";
import { enFil, enParallele, repondre } from "./fils";

// `npm run valider-essais:pinball -w @cdj/pinball-sim -- [--sortie=mesures.json] [--fils=N]` : les mesures du lot PBT0 pour chaque plan d'essai, dans les deux sens et les quatre thèmes (48 tables) — la validation complète du lot PB4
// (aucune bille coincée, chaque module touché, la mission, la porte), les tirs et leurs fenêtres, la densité, le Diamant du robot (le meilleur de ses 4 parties de 6 minutes, sur la table d'essai : ce n'est pas un jour servi). ≈ 6 s par table.
interface Mesure {
  cle: string;
  plan: string;
  theme: string;
  ok: boolean;
  raisons: string[];
  tirs: Record<string, number>;
  nombre: number;
  densite: { obstacles: number; rails: number; total: number };
  defauts: string[];
  diamant: number;
  scores: number[];
  billePire: number;
  verrou: boolean;
  multibille: boolean;
  secondes: number;
}
const travail = (c: Contenu): Mesure => {
  const t0 = performance.now();
  const a = analyserTable(c);
  const t = new Partie(c).table;
  const tirs = tirsDeConception(c);
  return {
    cle: cleDeTable(c),
    plan: c.plan,
    theme: c.theme,
    ok: a.ok!,
    raisons: a.raisons!,
    tirs: tirs.ms,
    nombre: nombreDeTirs(c.plan),
    densite: densite(t),
    defauts: defautsDeConception(t),
    diamant: Math.max(...a.scores),
    scores: a.scores,
    billePire: a.billes!.pire,
    verrou: a.verrou!,
    multibille: a.multibille!,
    secondes: (performance.now() - t0) / 1000,
  };
};
if (enFil) repondre(travail);
else {
  const args = process.argv.slice(2);
  const valeur = (nom: string): string | undefined => args.find((a) => a.startsWith(`--${nom}=`))?.slice(nom.length + 3);
  const ids = PLANS_ESSAI.flatMap((p) => [p.id, `${p.id}m`]).filter((id) => !valeur("plan") || id === valeur("plan"));
  const tables = ids.flatMap((id) => THEMES_PINBALL.map((theme) => dailyPinball(0, undefined, theme, id)));
  const resumes = await enParallele<Contenu, Mesure>(new URL(import.meta.url), tables, (r) => console.log(`${r.ok ? "ok " : "REFUSÉE"} ${r.cle} diamant ${r.diamant}${r.ok ? "" : " — " + r.raisons.join(" ; ")}`), valeur("fils") ? Number(valeur("fils")) : undefined);
  if (valeur("sortie")) writeFileSync(valeur("sortie")!, JSON.stringify(resumes, null, 1) + "\n");
  console.log(`${resumes.filter((r) => r.ok).length}/${resumes.length} valides ; pire bille lâchée ${Math.max(...resumes.map((r) => r.billePire))} pas ; ${(resumes.reduce((a, r) => a + r.secondes, 0) / resumes.length).toFixed(1)} s par table`);
}
