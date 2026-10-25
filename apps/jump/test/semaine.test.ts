import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { formatDay, parseDay } from "@cdj/core";
import { VARIETY_DAYS, VARIETY_FROZEN, VARIETY_ORIGIN, dailyLevel } from "@cdj/jump-sim";
import { miniKind, repeatedPieces, semaineDayOf, semaineDays, semaineEntry, semaineFromEntry, type SemaineFile } from "../src/semaineInfo";
import { readUrlOptions, semaineHref } from "../src/urlOptions";

// Lot 19 — l'outil de la variété (`?semaine=`) et les jours figés que la règle de variété lit avec leur contenu réel.

const LEVELS = join(import.meta.dirname, "../public/levels");

describe("lot 19 — les jours figés de la règle de variété", () => {
  it("VARIETY_FROZEN est exactement le contenu des fichiers figés (public/levels) des jours d'avant la première époque", () => {
    for (const [date, ids] of Object.entries(VARIETY_FROZEN)) {
      const raw = JSON.parse(readFileSync(join(LEVELS, `${date}.json`), "utf8")) as { morceaux: { id: string }[] };
      expect(ids, date).toEqual(raw.morceaux.map((m) => m.id));
    }
    for (let j = 1; j < VARIETY_DAYS; j++) expect(Object.keys(VARIETY_FROZEN)).toContain(formatDay(VARIETY_ORIGIN - j));
  });
});

describe("lot 19 — l'outil ?semaine", () => {
  it("lit l'adresse : la date de départ, `&generateur=13`, et ce n'est ni le niveau du jour ni la galerie", () => {
    const o = readUrlOptions("?semaine=2026-10-27&debug");
    expect(o.semaine).toBe(parseDay("2026-10-27"));
    expect(o.semaineG13).toBe(false);
    expect(o.daily).toBe(false);
    expect(o.gallery).toBe(false);
    expect(readUrlOptions("?semaine=2026-10-27&generateur=13").semaineG13).toBe(true);
    expect(readUrlOptions("?semaine=n-importe").semaine).toBe(null);
    expect(readUrlOptions("?generateur=13").semaineG13).toBe(false);
    expect(semaineHref("2026-10-27", true, o)).toBe("?semaine=2026-10-27&generateur=13&debug");
  });

  it("un jour montré : grille, premier point des scies mobiles, morceaux et leurs colonnes ; aller-retour par le fichier de comparaison", () => {
    const L = dailyLevel(VARIETY_ORIGIN);
    const day = semaineDayOf(L);
    expect(day.rows).toEqual(L.ascii.split("\n\n")[0]!.split("\n"));
    expect(day.rows).toHaveLength(L.level.height);
    expect(day.saws.length).toBe(L.level.saws.filter((s) => s.cycle > 0).length);
    expect(day.pieces.map((p) => p.id)).toEqual(L.pieces.map((p) => p.id));
    expect(semaineFromEntry(semaineEntry(day))).toEqual(day);
    expect(miniKind("#")).toBe("plein");
    expect(miniKind("~")).toBe("meca");
    expect(miniKind("o")).toBe("danger");
    expect(miniKind("C")).toBe("repere");
    expect(miniKind(".")).toBe("vide");
  });

  it("surligne les morceaux présents dans plusieurs jours, avec leurs dates", () => {
    const days = [
      { date: "a", pieces: [{ id: "puits", variant: 0, col0: 0, col1: 1 }, { id: "tunnel", variant: 1, col0: 2, col1: 3 }] },
      { date: "b", pieces: [{ id: "puits", variant: 3, col0: 0, col1: 1 }] },
      { date: "c", pieces: [{ id: "lucarne", variant: 0, col0: 0, col1: 1 }] },
    ];
    expect(Object.fromEntries(repeatedPieces(days))).toEqual({ puits: ["a", "b"] });
    expect(semaineDays(10)).toEqual([10, 11, 12, 13, 14, 15, 16]);
  });

  it("g14 : la première semaine n'a aucun morceau de base répété à moins de 3 jours ; le fichier g13 couvre 28 jours à partir du 27/10/2026", () => {
    const week = semaineDays(VARIETY_ORIGIN).map((d) => semaineDayOf(dailyLevel(d)));
    for (const [, dates] of repeatedPieces(week)) {
      const days = dates.map((d) => parseDay(d)!);
      for (let i = 1; i < days.length; i++) expect(days[i]! - days[i - 1]!).toBeGreaterThanOrEqual(VARIETY_DAYS);
    }
    const file = JSON.parse(readFileSync(join(import.meta.dirname, "../public/outils/semaine-g13.json"), "utf8")) as SemaineFile;
    expect(file.generateur).toBe(13);
    expect(file.jours.map((j) => j.date)).toEqual(semaineDays(VARIETY_ORIGIN, 28).map(formatDay));
    for (const j of file.jours) expect(j.id).toBe(`jour-${j.date}-g13`);
  }, 120_000);
});
