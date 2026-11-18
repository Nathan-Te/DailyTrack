import { FENETRE_MIN_MS, GAUCHE, DROITE, Partie, fenetresDeTir, objectifsDeLaTable, pasEnMs, tirsDuBatteur, zoneDeTir, type Contenu, type Controle } from "@cdj/pinball-sim";
import type { TirsAffiches } from "./dessin";

// L'ÉVENTAIL DES TIRS de `?debug&tirs` (lot PBL2) — un outil d'essai, jamais chargé par un joueur (le nom commence par `tune-` : la mesure du premier chargement ne le compte pas). Il rejoue **le geste de référence d'un humain**
// (la bille tenue sur un batteur levé, relâchée, puis le batteur renfoncé `d` pas plus tard : `packages/pinball-sim/src/tir.ts`) depuis les deux batteurs, et en tire ce que `dessinerSol` peint : la zone de tir, une trajectoire sur
// quatre moments de frappe (colorée par ce que la bille touche en premier) et la fenêtre de chaque objectif. Une demi-seconde de calcul.

/** Un moment de frappe sur `PAS` est dessiné (une trajectoire par 6,7 ms). */
const PAS = 4;

export function calculerTirs(contenu: Contenu): TirsAffiches {
  const zone = zoneDeTir().cases;
  const traces: TirsAffiches["traces"] = [];
  const table = new Partie(contenu).table;
  for (const cote of [GAUCHE, DROITE] as Controle[]) {
    for (const ouverte of table.passage ? [false, true] : [false]) {
      const r = tirsDuBatteur(contenu, cote, { traces: true, echantillon: 6, ...(ouverte ? { porteOuverte: true } : {}) });
      r.traces!.forEach((t, d) => {
        const objectif = r.etiquettes[d]!;
        if (d % PAS !== 0 || (ouverte && objectif !== "porte") || (!ouverte && objectif === "porte")) return;
        if (objectif === "rien" && d % (PAS * 4) !== 0) return;
        traces.push({ objectif, x: t.x, y: t.y });
      });
    }
  }
  const f = fenetresDeTir(contenu);
  const fenetres = objectifsDeLaTable(table).map((objectif) => ({ objectif, ms: f.ms[objectif] ?? pasEnMs(0), ok: (f.ms[objectif] ?? 0) >= FENETRE_MIN_MS }));
  return { zone, traces, fenetres };
}
