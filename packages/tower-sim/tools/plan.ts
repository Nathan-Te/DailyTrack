// Lot T3 — ce que `preparer:tower` fait de chaque jour (tools/preparer.ts), à part pour être testé : calculer, garder ou refuser. **Un fichier existant n'est réécrit que par `--forcer`**, et un
// fichier dont la version `g` n'est pas celle du code est TOUJOURS refusé (même avec `--forcer`) : un jour servi sous une autre version du générateur ne se recalcule pas.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { formatDay } from "@cdj/core";
import { TOWER_GENERATOR_VERSION } from "../src";
import { verifierJourPrepare } from "../src/bot";
import type { Rapier } from "../src/rapier";

export interface Decision {
  jour: number;
  date: string;
  action: "calculer" | "garder" | "refuser";
  /** Le motif d'un refus. */
  motif?: string;
}

export const cheminDuJour = (dossier: string, jour: number): string => `${dossier}/${formatDay(jour)}.json`;

export function planifier(R: Rapier, dossier: string, du: number, au: number, forcer: boolean): Decision[] {
  const decisions: Decision[] = [];
  for (let jour = du; jour <= au; jour++) {
    const date = formatDay(jour);
    const fichier = cheminDuJour(dossier, jour);
    if (!existsSync(fichier)) {
      decisions.push({ jour, date, action: "calculer" });
      continue;
    }
    let json: { g?: number };
    try {
      json = JSON.parse(readFileSync(fichier, "utf8")) as { g?: number };
    } catch {
      decisions.push({ jour, date, action: "refuser", motif: "le fichier existant n'est pas du JSON" });
      continue;
    }
    if (json.g !== TOWER_GENERATOR_VERSION) {
      decisions.push({ jour, date, action: "refuser", motif: `fichier en g${String(json.g)}, ce code est en g${TOWER_GENERATOR_VERSION} — refusé, même avec --forcer` });
      continue;
    }
    if (forcer) {
      decisions.push({ jour, date, action: "calculer" });
      continue;
    }
    const motif = verifierJourPrepare(R, json, jour);
    decisions.push(motif ? { jour, date, action: "refuser", motif } : { jour, date, action: "garder" });
  }
  return decisions;
}

/** Écrit le fichier d'un jour (crée le dossier). */
export function ecrire(dossier: string, jour: number, texte: string): void {
  mkdirSync(dossier, { recursive: true });
  writeFileSync(cheminDuJour(dossier, jour), texte);
}
