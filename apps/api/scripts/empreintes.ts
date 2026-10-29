import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { formatDay } from "@cdj/core";
import { dailyLevel, declareFrozenGenerators, thawLevel } from "@cdj/jump-sim";
import { dailyCircuit } from "@cdj/sim";

// Lot R6 (le garde-fou des jours) : l'empreinte de ce que chaque jeu SERT pour un jour, calculée par le code d'une construction. Ce fichier ne dépend que des
// paquets `@cdj/*` (aucune route, aucune base) : le workflow de production le copie dans le dépôt du code actuellement en production pour comparer, jour par jour, ce que
// la production sert et ce que servira la nouvelle construction (`empreintes-jours.ts`, `scripts/mise-en-production.mjs comparer`). Le test `jours-passes.test.ts` s'en sert aussi.
//
//  - DailyTrack : le circuit d'origine du jour (`dailyCircuit(jour)`) — identifiant (donc version du générateur du jour), texte, temps du pilote, médailles, palette, thème. Le
//    planning de l'admin (variantes) vit en base et n'est pas du code : un jour joué n'est jamais remplacé (409 `day_started`).
//  - DailyJump : le niveau que le serveur et le jeu servent — **le fichier figé s'il se vérifie** (`thawLevel`, la fonction même du jeu), sinon `dailyLevel(jour)`.

export interface EmpreinteJour {
  /** Identifiant du circuit ou du niveau (`jour-AAAA-MM-JJ-g<N>`). */
  id: string;
  /** SHA-256 (16 premiers caractères hexadécimaux) de ce qui définit le jour. */
  h: string;
  /** Vrai si le jour est valide : ni circuit de secours (Track), ni niveau de secours (Jump). */
  ok: boolean;
}

const sha = (x: unknown): string => createHash("sha256").update(JSON.stringify(x)).digest("hex").slice(0, 16);

/** L'empreinte du circuit d'origine d'un jour de Track. */
export function empreinteTrack(day: number): EmpreinteJour {
  const c = dailyCircuit(day);
  return {
    id: c.track.id,
    h: sha([c.track.id, c.spec, c.authorMs, c.medals, c.palette, c.theme, c.attempt, c.figures.map((f) => [f.name, f.variant, f.from, f.to])]),
    ok: !c.fallback,
  };
}

let dossierDeclare: string | null = null;
/** Lot V1 : comme le serveur et le jeu, les niveaux figés de `dossier` sont déclarés à la simulation (le thème d'un jour figé d'avant le sac de thèmes, et celui du premier jour du sac, en dépendent). */
function declarer(dossier: string): void {
  if (dossierDeclare === dossier) return;
  dossierDeclare = dossier;
  const generateurs: Record<string, number> = {};
  for (const f of readdirSync(dossier)) {
    const date = /^(\d{4}-\d{2}-\d{2})\.json$/.exec(f)?.[1];
    if (date) generateurs[date] = (JSON.parse(readFileSync(join(dossier, f), "utf8")) as { generatorVersion: number }).generatorVersion;
  }
  declareFrozenGenerators(generateurs);
}

/** L'empreinte du niveau de Jump qui est servi pour un jour : le fichier figé de `dossier` s'il se vérifie, sinon le niveau généré. */
export function empreinteJump(day: number, dossier: string | null): EmpreinteJour {
  if (dossier && existsSync(dossier)) declarer(dossier);
  const fichier = dossier ? join(dossier, `${formatDay(day)}.json`) : null;
  if (fichier && existsSync(fichier)) {
    const d = thawLevel(JSON.parse(readFileSync(fichier, "utf8")) as unknown, day);
    if (typeof d !== "string") return { id: d.id, h: sha([d.id, d.hash, d.authorTicks, d.medals, d.theme, d.level.simVersion]), ok: !d.fallback };
  }
  const d = dailyLevel(day);
  return { id: d.id, h: sha([d.id, d.hash, d.authorTicks, d.medals, d.theme, d.level.simVersion]), ok: !d.fallback };
}
