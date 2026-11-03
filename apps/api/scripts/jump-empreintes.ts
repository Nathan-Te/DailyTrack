import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { formatDay } from "@cdj/core";
import * as jumpSim from "@cdj/jump-sim";
import { dailyLevel, thawLevel } from "@cdj/jump-sim";
import { sha, type EmpreinteJour } from "./empreintes";

// Lot R6 : l'empreinte de ce que DailyJump SERT pour un jour : le niveau que le serveur et le jeu servent — **le fichier figé s'il se vérifie** (`thawLevel`, la fonction même du jeu), sinon
// `dailyLevel(jour)`. Lot K4b : le module de Jump (`jours.fabrication.empreinte` de sa fiche).

// Ce module est COPIÉ dans le code en production, qui peut être plus ancien que lui : il n'importe par son nom aucune fonction plus récente que ce code. Le lot V1 a ajouté
// `declareFrozenGenerators` ; un code d'avant le lot V1 ne l'a pas (mise en production du 01/11/2026 arrêtée : « No matching export ») et n'en a pas besoin — ses thèmes ne
// dépendent d'aucune déclaration —, donc l'empreinte reste exactement ce que ce code sert. Test : `apps/portail/test/miseEnProduction.test.ts` (compilé contre un code sans elle).
const declareFrozenGenerators = Reflect.get(jumpSim, "declareFrozenGenerators") as ((generateurs: Record<string, number>) => void) | undefined;

let dossierDeclare: string | null = null;
/** Lot V1 : comme le serveur et le jeu, les niveaux figés de `dossier` sont déclarés à la simulation (le thème d'un jour figé d'avant le sac de thèmes, et celui du premier jour du sac, en dépendent). */
function declarer(dossier: string): void {
  if (dossierDeclare === dossier || !declareFrozenGenerators) return;
  dossierDeclare = dossier;
  const generateurs: Record<string, number> = {};
  for (const f of readdirSync(dossier)) {
    const date = /^(\d{4}-\d{2}-\d{2})\.json$/.exec(f)?.[1];
    if (date) generateurs[date] = (JSON.parse(readFileSync(join(dossier, f), "utf8")) as { generatorVersion: number }).generatorVersion;
  }
  declareFrozenGenerators(generateurs);
}

/** L'empreinte du niveau de Jump qui est servi pour un jour : le fichier figé de `dossier` s'il se vérifie, sinon le niveau généré. */
export function empreinteJour(day: number, dossier: string | null): EmpreinteJour {
  if (dossier && existsSync(dossier)) declarer(dossier);
  const fichier = dossier ? join(dossier, `${formatDay(day)}.json`) : null;
  if (fichier && existsSync(fichier)) {
    const d = thawLevel(JSON.parse(readFileSync(fichier, "utf8")) as unknown, day);
    if (typeof d !== "string") return { id: d.id, h: sha([d.id, d.hash, d.authorTicks, d.medals, d.theme, d.level.simVersion]), ok: !d.fallback };
  }
  const d = dailyLevel(day);
  return { id: d.id, h: sha([d.id, d.hash, d.authorTicks, d.medals, d.theme, d.level.simVersion]), ok: !d.fallback };
}
