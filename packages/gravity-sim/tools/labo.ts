import { jouerScenario, META, TOUS_LES_MOTIFS, type ResultatLabo } from "../src/index";

// `npm run labo:gravity -w @cdj/gravity-sim -- [--motif <id>[,<id>…]] [--variante n] [--vitesses 8,10,12.5,15,17] [--entree 1|-1] [--tout]` (lot GR7) : le laboratoire des motifs, une ligne par scénario.
const arg = (nom: string): string | undefined => {
  const i = process.argv.indexOf(`--${nom}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const ids = (arg("motif") ?? "").split(",").filter(Boolean);
const vitesses = (arg("vitesses") ?? "8,10,12.5,15,17").split(",").map(Number);
const entrees = arg("entree") ? [Number(arg("entree")) as 1 | -1] : ([1, -1] as const);
const seulementVariante = arg("variante") !== undefined ? Number(arg("variante")) : null;
const liste = ids.length > 0 ? ids : [...META.keys()];
let total = 0;
let ko = 0;
let passifs = 0;
const rouge: ResultatLabo[] = [];
for (const id of liste) {
  const meta = META.get(id);
  if (!meta) {
    console.log(`motif inconnu : ${id} (connus : ${TOUS_LES_MOTIFS.join(", ")})`);
    process.exitCode = 1;
    continue;
  }
  for (let v = 0; v < meta.variantes; v++) {
    if (seulementVariante !== null && v !== seulementVariante) continue;
    for (const entree of entrees) {
      const bilan: string[] = [];
      for (const vitesse of vitesses) {
        const r = jouerScenario({ id, variante: v, entree, vitesse });
        total++;
        if (!r.robot) {
          ko++;
          rouge.push(r);
        }
        if (r.passif) passifs++;
        bilan.push(`${vitesse}:${r.robot ? "ok" : "KO"}${r.passif ? "·passif" : ""}${r.robot ? `(${r.fenetre})` : ""}`);
      }
      console.log(`${id.padEnd(18)} v${v} ${entree === 1 ? "sol" : "plf"}  ${bilan.join("  ")}`);
    }
  }
}
console.log(`\n${total} scénarios, ${ko} échecs du robot, ${passifs} traversés sans rien faire`);
for (const r of rouge.slice(0, 40)) console.log(`  KO ${r.id} v${r.variante} ${r.entree === 1 ? "sol" : "plf"} ${r.vitesse} cases/s : ${r.detail}`);
if (ko > 0) process.exitCode = 1;
