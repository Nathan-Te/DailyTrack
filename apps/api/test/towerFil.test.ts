import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "esbuild";
import { dailyTower, decoderRediffusion, encoderRediffusion, rejouer, TOWER_GENERATOR_VERSION } from "@cdj/tower-sim";
import { chargerRapier } from "@cdj/tower-sim/rapier";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { jouerScripte } from "../scripts/tower-aide";
import { D, monterTower } from "../scripts/tower-test";
import { HttpError } from "../src/errors";
import { executeurFil } from "../src/jeux/fil";
import { CODES_ERREUR } from "../src/codesErreur";
import { RefusJeu } from "../src/jeux/contrat";
import { type DemandeRejeu, executeurPrincipal, rejouerTower, UNITES_REJEU_TOWER } from "../src/towerRejeu";
import type { Resultat } from "@cdj/tower-sim";

const fil_ = (fichier: string, options?: { fileMax?: number; delaiMs?: number }) => executeurFil<DemandeRejeu, Resultat>(fichier, options);
import { playerId, TEST_DB } from "./helpers";

// Lot T4 — le rejeu serveur de Tower : un seul point d'entrée (`rejouerTower`), derrière lequel le calcul tourne dans le fil principal (repli) ou dans un fil de calcul (`worker_threads`).
// Le script du fil (`towerFilTravail.ts`) est empaqueté par esbuild comme le fera la plateforme (cahier des charges du lot T4). SQLite et libSQL.

const R = await chargerRapier();
const JOUR = "2026-11-10";
const contenu = dailyTower(D(JOUR), TOWER_GENERATOR_VERSION, 0);
const dossier = mkdtempSync(join(tmpdir(), "tower-fil-"));
const fichier = join(dossier, "tower-fil.mjs");
const { partie: p, code } = jouerScripte(R, contenu, Array.from({ length: 40 }, () => ({ rot: 0, dx: 1 })));
const attendu = p.resultat()!;
p.dispose();

beforeAll(async () => {
  await build({
    entryPoints: [new URL("../src/towerFilTravail.ts", import.meta.url).pathname],
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    outfile: fichier,
    banner: { js: "import { createRequire as __cdjRequire } from 'node:module'; const require = __cdjRequire(import.meta.url);" },
    logLevel: "silent",
  });
});
afterAll(() => rmSync(dossier, { recursive: true, force: true }));

describe(`Tower : le rejeu serveur (${TEST_DB})`, () => {
  it("le fil principal (repli) et le fil de calcul donnent exactement le Resultat du jeu", async () => {
    const principal = executeurPrincipal();
    const fil = fil_(fichier);
    try {
      expect(await rejouerTower(principal, { contenu, rediffusion: code })).toEqual(attendu);
      expect(await rejouerTower(fil, { contenu, rediffusion: code })).toEqual(attendu);
      expect(await rejouerTower(fil, { contenu, rediffusion: code })).toEqual(attendu); // le même fil resservi
    } finally {
      await fil.fermer?.();
    }
  });

  it("les refus du rejeu deviennent des refus du jeu (le statut de la liste des codes), des deux côtés : inachevée 422 not_finished, commandes en trop 400 invalid_replay, autre contenu 409 version", async () => {
    const rd = decoderRediffusion(code);
    const inachevee = encoderRediffusion({ ...rd, plages: [{ masque: 0, ticks: 20 }] });
    const surplus = encoderRediffusion({ ...rd, plages: [...rd.plages, { masque: 1, ticks: 50 }] });
    const autre = encoderRediffusion({ ...rd, contenu: { jour: D(JOUR) - 1 } });
    const fil = fil_(fichier);
    try {
      for (const ex of [executeurPrincipal(), fil]) {
        for (const [texte, status, erreur] of [[inachevee, 422, "not_finished"], [surplus, 400, "invalid_replay"], [autre, 409, "version"]] as const) {
          const e = await rejouerTower(ex, { contenu, rediffusion: texte }).catch((x: unknown) => x);
          expect(e).toBeInstanceOf(RefusJeu); // le module en fait la réponse : le statut est celui de la liste unique des codes
          expect({ status: CODES_ERREUR[(e as RefusJeu).code].status, code: (e as RefusJeu).code }).toEqual({ status, code: erreur });
        }
      }
    } finally {
      await fil.fermer?.();
    }
  });

  it("un seul fil, file bornée : le rejeu en cours et ceux qui attendent passent l'un après l'autre, le suivant est refusé 503 busy", async () => {
    const fil = fil_(fichier, { fileMax: 1 });
    try {
      const lance = () => rejouerTower(fil, { contenu, rediffusion: code });
      const premier = lance(); // part tout de suite (le fil démarre)
      const deuxieme = lance(); // attend dans la file (1 place)
      const troisieme = await lance().catch((e: unknown) => e); // la file est pleine
      expect(troisieme).toBeInstanceOf(HttpError);
      expect({ status: (troisieme as HttpError).status, code: (troisieme as HttpError).code }).toEqual({ status: 503, code: "busy" });
      expect((troisieme as HttpError).headers["Retry-After"]).toBeTruthy();
      expect(await premier).toEqual(attendu);
      expect(await deuxieme).toEqual(attendu);
      expect(await lance()).toEqual(attendu); // la file s'est vidée
    } finally {
      await fil.fermer?.();
    }
  });

  it("un rejeu qui dépasse son délai est abandonné (503 busy), le fil est arrêté et un nouveau repart pour le suivant", async () => {
    const fil = fil_(fichier, { delaiMs: 1 });
    try {
      const e = await rejouerTower(fil, { contenu, rediffusion: code }).catch((x: unknown) => x);
      expect(e).toMatchObject({ status: 503, code: "busy" });
    } finally {
      await fil.fermer?.();
    }
    const normal = fil_(fichier);
    try {
      expect(await rejouerTower(normal, { contenu, rediffusion: code })).toEqual(attendu);
    } finally {
      await normal.fermer?.();
    }
  });

  it("de bout en bout : un envoi rejoué dans le fil de calcul donne la même réponse que dans le fil principal", async () => {
    const fil = fil_(fichier);
    try {
      const a = await monterTower(JOUR, { executeur: fil });
      const b = await monterTower(JOUR, { executeur: executeurPrincipal() });
      const ra = await a.call("POST", "/api/tower/submit", { replay: code, name: "A" }, { headers: { "X-Player-Id": playerId(1) } });
      const rb = await b.call("POST", "/api/tower/submit", { replay: code, name: "A" }, { headers: { "X-Player-Id": playerId(1) } });
      expect(ra.status, JSON.stringify(ra.body)).toBe(200);
      expect(ra.body).toEqual(rb.body);
    } finally {
      await fil.fermer?.();
    }
  });

  it("le poids d'un rejeu dans le plafond de la plateforme est un entier positif qui laisse passer au moins un rejeu par minute au plafond de production (600)", () => {
    expect(Number.isInteger(UNITES_REJEU_TOWER)).toBe(true);
    expect(UNITES_REJEU_TOWER).toBeGreaterThan(1);
    expect(Math.floor(600 / UNITES_REJEU_TOWER)).toBeGreaterThanOrEqual(10);
  });

  it("rejouer() de tower-sim et le fil principal sont le même calcul", () => {
    expect(rejouer(R, contenu, code)).toEqual(attendu);
  });
});
