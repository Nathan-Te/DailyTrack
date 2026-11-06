import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { daysFromCivil } from "@cdj/core";
import { JUMP_GENERATOR_VERSION, calendrierPourLesTests } from "@cdj/jump-sim";
import { makeApi, parisDayStart, TEST_DB } from "./helpers";

// Lot 33 (incident du 06/11/2026) — **un jour déjà servi ne change jamais**. Le 06/11/2026 la mise en production a figé les jours 03 à 06/11 avec un outil qui ne déclarait pas les niveaux déjà figés
// d'un ancien générateur : les fichiers n'étaient pas les niveaux que la production avait servis (hash a1ecd408… au lieu de be47f97c… le 03/11). Ces tests prouvent (1) que les fichiers
// figés du dépôt sont exactement ce que le serveur d'avant (sans eux) servait, (2) qu'un générateur plus récent que celui d'une date ne génère pas ce jour : le serveur refuse au lieu de servir autre chose,
// (3) qu'un jour figé reste servi tel quel quel que soit le calendrier.

const NIVEAUX = join(__dirname, "../../jump/public/levels");
const tous = (): Record<string, unknown> =>
  Object.fromEntries(readdirSync(NIVEAUX).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).map((f) => [f.slice(0, 10), JSON.parse(readFileSync(join(NIVEAUX, f), "utf8")) as unknown]));
const jour = (date: string) => daysFromCivil(Number(date.slice(0, 4)), Number(date.slice(5, 7)), Number(date.slice(8, 10)));
/** Les jours servis par le code d'avant sans fichier (lot 33 : figés à nouveau avec la révision d'avant). */
const JOURS_SERVIS = ["2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"] as const;

afterEach(() => calendrierPourLesTests(null));

async function serveur(date: string, frozen: Record<string, unknown>) {
  const t = await makeApi({ seed: false, environment: "recette", jumpFrozen: frozen });
  t.clock.now = parisDayStart(jour(date)) + 12 * 3_600_000;
  return t;
}

describe(`jours servis immuables (${TEST_DB})`, () => {
  it("le fichier figé d'un jour déjà servi est exactement le niveau que le serveur d'avant (sans fichier) servait : même identifiant, même empreinte, mêmes médailles, même thème", async () => {
    const apres = tous();
    const avant = Object.fromEntries(Object.entries(apres).filter(([d]) => !(JOURS_SERVIS as readonly string[]).includes(d)));
    for (const date of JOURS_SERVIS) {
      expect(apres[date], `${date} : le fichier figé existe`).toBeDefined();
      const sansFichier = await (await serveur(date, avant)).call("GET", `/api/jump/day/${date}`);
      const avecFichier = await (await serveur(date, apres)).call("GET", `/api/jump/day/${date}`);
      expect(sansFichier.body, date).toMatchObject({ source: "genere" });
      expect(avecFichier.body, date).toMatchObject({ source: "fige" });
      const { source: _a, ...serviAvant } = sansFichier.body as Record<string, unknown>;
      const { source: _b, ...serviApres } = avecFichier.body as Record<string, unknown>;
      expect(serviApres, date).toEqual(serviAvant);
    }
  }, 120_000);

  it("l'incident : le code d'un générateur plus récent que celui de la date ne génère pas un jour sans fichier — 503 level_unavailable, rien n'est servi ni gardé", async () => {
    // Le calendrier dit : g(courant − 1) jusqu'au 06/11 inclus, le générateur du code depuis le 07/11. Aujourd'hui (06/11) n'a pas de fichier : le serveur ne le génère pas.
    calendrierPourLesTests([
      { depuis: "2026-10-16", generateur: JUMP_GENERATOR_VERSION - 1 },
      { depuis: "2026-11-07", generateur: JUMP_GENERATOR_VERSION },
    ]);
    const sans = Object.fromEntries(Object.entries(tous()).filter(([d]) => d <= "2026-11-02"));
    const t = await serveur("2026-11-06", sans);
    const r = await t.call("GET", "/api/jump/day/2026-11-06");
    expect([r.status, r.body.error]).toEqual([503, "level_unavailable"]);
    expect(await t.db.first("SELECT COUNT(*) AS n FROM jump_levels")).toEqual({ n: 0 });
    // Le jour d'après, du générateur du code, se sert normalement.
    t.clock.now = parisDayStart(jour("2026-11-07")) + 12 * 3_600_000;
    const demain = await t.call("GET", "/api/jump/day/2026-11-07");
    expect(demain.status).toBe(200);
    expect(demain.body).toMatchObject({ id: `jour-2026-11-07-g${JUMP_GENERATOR_VERSION}`, source: "genere" });
  }, 120_000);

  it("avec son fichier figé, aujourd'hui reste servi tel quel, quel que soit le calendrier des bascules", async () => {
    const complet = tous();
    const avant = await (await serveur("2026-11-06", complet)).call("GET", "/api/jump/day/2026-11-06");
    expect(avant.status).toBe(200);
    calendrierPourLesTests([
      { depuis: "2026-10-16", generateur: JUMP_GENERATOR_VERSION - 1 },
      { depuis: "2026-11-07", generateur: JUMP_GENERATOR_VERSION },
    ]);
    const apres = await (await serveur("2026-11-06", complet)).call("GET", "/api/jump/day/2026-11-06");
    expect(apres.status).toBe(200);
    expect(apres.body).toEqual(avant.body);
    expect(apres.body).toMatchObject({ source: "fige" });
  }, 120_000);
});
