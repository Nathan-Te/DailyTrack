import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { formatDay, parseDay } from "@cdj/core";
import { dailyTower, empreinteContenu, estimationGeometrique, lireJour, TOWER_GENERATOR_VERSION } from "@cdj/tower-sim";

// Lot TP : l'empreinte de ce que Tower SERT pour un jour — le même rôle que `empreintes.ts` pour Track et Jump, dans un fichier à part parce que le code en production n'a pas Tower avant
// sa première mise en production : `scripts/mise-en-production.mjs empreintes --tower <dossier>` ne lance ce script que si `packages/tower-sim` existe dans le dépôt visé, et un jeu absent
// de la production n'a aucun jour à conserver (`comparerEmpreintes`).
//
//   npm run jours:empreintes-tower -w @cdj/api -- --du 2026-11-02 --au 2026-11-20 --jours ../tower/public/jours --sortie /tmp/cible.json
//
// Ce que sert un jour : **le fichier du jour s'il se relit et se régénère à l'identique** (id, contenu, médailles — `prepare` s'il porte les médailles du bot, `genere` sinon), sinon le tirage 0 du
// générateur courant et l'estimation géométrique des médailles. La preuve n'est pas rejouée ici (le serveur et `jours.test.ts` le font) ; elle n'entre pas dans l'empreinte : elle ne sort pas du serveur.
// La sortie est **ajoutée** au fichier d'empreintes déjà écrit (clé `tower`).

export interface EmpreinteJour {
  id: string;
  h: string;
  ok: boolean;
}
const sha = (x: unknown): string => createHash("sha256").update(JSON.stringify(x)).digest("hex").slice(0, 16);

/** L'empreinte du jour de Tower que sert le code, avec les fichiers de `dossier`. */
export function empreinteTower(day: number, dossier: string | null): EmpreinteJour {
  const date = formatDay(day);
  const fichier = dossier ? join(dossier, `${date}.json`) : null;
  if (fichier && existsSync(fichier)) {
    try {
      const lu = lireJour(JSON.parse(readFileSync(fichier, "utf8")) as unknown, day);
      if (typeof lu !== "string") {
        const c = lu.contenu;
        const id = `tower-${date}-g${c.g}-t${c.tirage ?? 0}`;
        const m = lu.medailles ?? estimationGeometrique(c);
        const intact = empreinteContenu(dailyTower(day, c.g, c.tirage ?? 0)) === empreinteContenu(c);
        return { id, h: sha([id, empreinteContenu(c), m, lu.medailles ? "prepare" : "genere"]), ok: intact };
      }
    } catch {
      /* un fichier illisible n'est pas servi : le jour est généré */
    }
  }
  const c = dailyTower(day, TOWER_GENERATOR_VERSION, 0);
  const id = `tower-${date}-g${c.g}-t0`;
  return { id, h: sha([id, empreinteContenu(c), estimationGeometrique(c), "genere"]), ok: true };
}

const args = process.argv.slice(2);
const val = (nom: string): string | undefined => (args.includes(nom) ? args[args.indexOf(nom) + 1] : undefined);
if (process.argv[1] && /empreintes-tower\.(mjs|ts)$/.test(process.argv[1])) {
  const du = parseDay(val("--du") ?? "");
  const au = parseDay(val("--au") ?? "");
  const sortie = val("--sortie");
  if (du === null || au === null || au < du || !sortie) {
    console.error("Usage : npm run jours:empreintes-tower -w @cdj/api -- --du AAAA-MM-JJ --au AAAA-MM-JJ --sortie <fichier.json> [--jours <dossier des jours de Tower>]");
    process.exit(2);
  }
  const jours = resolve(val("--jours") ?? "../tower/public/jours");
  const tower: Record<string, EmpreinteJour> = {};
  for (let day = du; day <= au; day++) tower[formatDay(day)] = empreinteTower(day, jours);
  const chemin = resolve(sortie);
  const existant = existsSync(chemin) ? (JSON.parse(readFileSync(chemin, "utf8")) as Record<string, unknown>) : { version: 1, du: formatDay(du), au: formatDay(au) };
  mkdirSync(dirname(chemin), { recursive: true });
  writeFileSync(chemin, JSON.stringify({ ...existant, tower }, null, 1) + "\n");
  const invalides = Object.entries(tower).filter(([, e]) => !e.ok).map(([d]) => d);
  console.log(`Empreintes de Tower ${formatDay(du)} → ${formatDay(au)} : ${au - du + 1} jour(s)${invalides.length ? `, NON VALIDES : ${invalides.join(", ")}` : ""} → ${sortie}`);
}
