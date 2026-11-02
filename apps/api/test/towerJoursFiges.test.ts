import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { formatDay, parseDay } from "@cdj/core";
import { dailyTower, lireJour, TOWER_GENERATOR_VERSION, VERSIONS_GENERATEUR } from "@cdj/tower-sim";
import { empreinteTower } from "../scripts/empreintes-tower";

// Lot R16 (plateforme) : les jours de Tower ne changent jamais, même sans fichier préparé. Ce test monte la version du générateur **dans le test seulement** (un générateur factice, la
// « version 4 » : même jour, autres pièces et autre thème) et regarde ce que sert Tower pour les jours déjà servis. Le vrai générateur n'est pas touché (`TOWER_GENERATOR_VERSION` reste 3).
// Rapport et diagnostic : docs/plateforme/lots/lot-R16-tower-registre-des-jours.md.
const FACTICE = 4;
vi.mock("@cdj/tower-sim", async (importOriginal) => {
  const reel = await importOriginal<typeof import("@cdj/tower-sim")>();
  return {
    ...reel,
    TOWER_GENERATOR_VERSION: 4,
    dailyTower: (jour: number, version: number = 4, tirage = 0) => {
      if (version !== 4) return reel.dailyTower(jour, version, tirage);
      const c = reel.dailyTower(jour, 3, tirage);
      return { ...c, g: 4, pieces: [...c.pieces].reverse(), theme: c.theme === "port" ? "nuit" : "port" };
    },
  };
});

const JOURS = join(__dirname, "../../tower/public/jours");
const FIXTURES = join(__dirname, "../../../packages/tower-sim/test/fixtures/jours");
type Jours = Record<string, { id: string; h: string }>;
const gardees = JSON.parse(readFileSync(join(__dirname, "jours-passes.json"), "utf8")) as { tower: Jours };
const dates = Object.keys(gardees.tower).sort();

describe("lot R16 — monter le générateur de Tower ne change aucun jour déjà servi", () => {
  it("le générateur factice produit bien autre chose que la version 3 (sinon le test ne prouverait rien)", () => {
    const jour = parseDay("2026-11-01")!;
    expect(TOWER_GENERATOR_VERSION).toBe(FACTICE);
    expect(dailyTower(jour).g).toBe(FACTICE);
    expect(dailyTower(jour).pieces.join("")).not.toBe(dailyTower(jour, 3).pieces.join(""));
  });

  it("le risque : un jour servi SANS fichier prend le générateur courant — son empreinte change (c'est ce qu'un fichier du jour empêche)", () => {
    for (const date of dates) {
      const sans = empreinteTower(parseDay(date)!, null);
      expect(sans.id, date).toBe(`tower-${date}-g${FACTICE}-t0`);
      expect(sans.h, `${date} : sans fichier, le jour change avec la version du générateur`).not.toBe(gardees.tower[date]!.h);
    }
  });

  it("chaque jour gardé dans jours-passes.json a son fichier : il garde sa version et son empreinte, quelle que soit la version du générateur déployée ensuite", () => {
    expect(dates.length).toBeGreaterThan(0);
    for (const date of dates) {
      expect(existsSync(join(JOURS, `${date}.json`)), `${date} : un jour protégé a toujours son fichier (« Mettre en production » le fige avec le code en production)`).toBe(true);
      const e = empreinteTower(parseDay(date)!, JOURS);
      expect(e.ok, date).toBe(true);
      expect(e, `Tower ${date} a changé avec la version ${FACTICE} du générateur`).toEqual({ id: gardees.tower[date]!.id, h: gardees.tower[date]!.h, ok: true });
    }
  });

  it("un jour connu prend sa version, un jour inconnu prend la dernière", () => {
    const connu = dates[0]!;
    expect(empreinteTower(parseDay(connu)!, JOURS).id).toMatch(/-g3-t\d$/);
    const inconnu = formatDay(parseDay(dates.at(-1)!)! + 400);
    expect(existsSync(join(JOURS, `${inconnu}.json`))).toBe(false);
    expect(empreinteTower(parseDay(inconnu)!, JOURS).id).toBe(`tower-${inconnu}-g${FACTICE}-t0`);
  });

  it("le Diamant et les seuils d'un jour préparé sont ceux du fichier : la version du générateur n'y change rien", () => {
    for (const [date, h] of [["2026-11-06", "g2, médailles du fichier"], ["2026-11-17", "g3, tirage 1"]] as const) {
      const brut = JSON.parse(readFileSync(join(FIXTURES, `${date}.json`), "utf8")) as { g: number; medailles: { auteur: number; or: number; argent: number; bronze: number } };
      const lu = lireJour(brut, parseDay(date)!);
      expect(typeof lu, date).not.toBe("string");
      if (typeof lu === "string") continue;
      expect(lu.medailles, date).toEqual(brut.medailles);
      expect(lu.contenu.g, date).toBe(brut.g);
      const e = empreinteTower(parseDay(date)!, FIXTURES);
      expect(e.ok, date).toBe(true);
      expect(e.id, date).toMatch(new RegExp(`^tower-${date}-g${brut.g}-t\\d$`));
      expect(e.h, `${date} : ${h}`).toBe(EMPREINTES_PREPAREES[date]);
    }
  });

  it("les versions du générateur que les fichiers nomment restent appelables (on n'enlève une ancienne version que lorsqu'aucun jour ne la nomme)", () => {
    for (const dossier of [JOURS, FIXTURES]) {
      for (const f of readdirSync(dossier).filter((n) => /^\d{4}-\d{2}-\d{2}\.json$/.test(n))) {
        const g = (JSON.parse(readFileSync(join(dossier, f), "utf8")) as { g: number }).g;
        expect(VERSIONS_GENERATEUR, `${f} nomme g${g}`).toContain(g);
      }
    }
  });
});

/** Les empreintes des deux jours préparés de test, relevées avec le vrai générateur (version 3) : une preuve ne dépend pas de la version courante. */
const EMPREINTES_PREPAREES: Record<string, string> = { "2026-11-06": "600e7a83b1728d86", "2026-11-17": "1f011b336a7d1041" };
