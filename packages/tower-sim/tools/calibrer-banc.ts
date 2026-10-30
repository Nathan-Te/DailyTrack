// Lot T0 — CALIBRATION (une fois, hors CI) de la suite du banc : un bot glouton joue 39 pièces sur le moteur A (tour sage : la plus basse sans perte) et la 34ᵉ est le coup ;
// chaque pièce attend que la tour se stabilise (la durée est son « attente »). La suite est figée dans lab/bancTable.ts. Les deux moteurs rejouent ensuite cette table.
//   npm run calibrer:tower -w @cdj/tower-sim               tout refaire (≈ 8 min)
//   npm run calibrer:tower -w @cdj/tower-sim -- --instants  garder formes, rotations et colonnes de la table, recalculer seulement les attentes (secondes)
// À ne relancer que si la table doit changer (puis refaire les mesures et les empreintes de référence du README).
import { writeFileSync } from "node:fs";
import { Rng } from "@cdj/core";
import { moteurA } from "../lab/a/moteurA";
import { BANC_CONFIG, BANC_COUP, BANC_GRAINE, BANC_PIECES, type Commande } from "../lab/banc";
import { BANC_TABLE } from "../lab/bancTable";
import { PIECE_KINDS, type PieceKind } from "../lab/interface";
import { poser, poserSansCommande, tourDeBot } from "../lab/mesures/bot";

const depuisTable = process.argv.includes("--instants");
const e = moteurA();
const etat = poserSansCommande(e, BANC_CONFIG);
const rng = new Rng(BANC_GRAINE);
let sac: PieceKind[] = [];
const table: [PieceKind, number, number, number][] = [];
for (let i = 0; i < BANC_PIECES; i++) {
  if (sac.length === 0) sac = rng.shuffle(PIECE_KINDS);
  let kind = sac.pop()!;
  let rot: number;
  let x8: number;
  let cmd: Commande;
  if (i === BANC_COUP) {
    kind = "I";
    rot = 1;
    x8 = 72;
    cmd = { tick: 0, kind, rot, x8, vx8: -128, depart: "flanc" };
  } else if (depuisTable) {
    [kind, rot, x8] = BANC_TABLE[i]!;
    cmd = { tick: 0, kind, rot, x8, vx8: 0, depart: "dessus" };
  } else {
    const t = tourDeBot(e, etat, kind);
    rot = t.meilleur.rot;
    x8 = t.meilleur.x8;
    cmd = { tick: 0, kind, rot, x8, vx8: 0, depart: "dessus" };
  }
  const attente = poser(e, etat, cmd);
  table.push([kind, rot, x8, attente]);
  const s = e.snapshot(etat.world);
  console.log(i, kind, rot, x8, `attente ${attente} · perdues ${s.pieces.filter((p) => p.lost).length}`);
}
const lignes = table.map(([k, r, x, a]) => `  ["${k}", ${r}, ${x}, ${a}],`).join("\n");
writeFileSync(
  new URL("../lab/bancTable.ts", import.meta.url),
  `// GÉNÉRÉ par tools/calibrer-banc.ts (calibré UNE fois sur le moteur A) — ne pas modifier à la main.
// Suite fixe du banc : [forme, quart de tour, colonne du centre de masse en huitièmes de mètre, attente en pas avant la pièce suivante], une ligne par pièce.
// La ligne du coup (pièce ${BANC_COUP}) n'est lue que pour son attente : banc.ts écrit le coup lui-même.
import type { PieceKind } from "./interface";
export const BANC_TABLE: readonly (readonly [PieceKind, number, number, number])[] = [
${lignes}
];
`,
);
