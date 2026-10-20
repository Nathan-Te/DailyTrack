import { parisDay } from "@cdj/clock";
import { parseDay } from "@cdj/core";
import { PREMIER_JOUR_JUMP, dailyLevel, jumpMedalsFor } from "@cdj/jump-sim";
import { describe, expect, it } from "vitest";
import { REFUSED_TEXT, chooseDay, dayLine, finishMedalText, isPreview, levelTitle, nextMedal, shortDate } from "../src/dailyInfo";
import { paletteForDay } from "../src/palette";

// Le niveau du jour côté jeu (lot 5) : aperçu ou site publié, porte des jours futurs, médaille visée, textes. Dates fixes, jamais l'heure réelle.

const day = (d: string) => parseDay(d)!;

describe("isPreview : aperçu de branche et serveur local, sinon site publié", () => {
  it("le site publié depuis main n'est pas un aperçu", () => {
    expect(isPreview({ hostname: "nathan-te.github.io", pathname: "/DailyTrack/jump/" })).toBe(false);
    expect(isPreview({ hostname: "nathan-te.github.io", pathname: "/DailyTrack/jump/index.html" })).toBe(false);
    expect(isPreview({ hostname: "exemple.fr", pathname: "/jump/" })).toBe(false);
    // Un « b » qui n'est pas un dossier de branche ne compte pas.
    expect(isPreview({ hostname: "nathan-te.github.io", pathname: "/DailyTrack/jump/b" })).toBe(false);
    expect(isPreview({ hostname: "nathan-te.github.io", pathname: "/DailyTrack/bjump/" })).toBe(false);
  });

  it("un aperçu de branche (/b/<branche>/) en est un", () => {
    expect(isPreview({ hostname: "nathan-te.github.io", pathname: "/DailyTrack/b/claude-lot-5/jump/" })).toBe(true);
    expect(isPreview({ hostname: "nathan-te.github.io", pathname: "/DailyTrack/b/ccr-4577740d-3047yh/jump/index.html" })).toBe(true);
  });

  it("lot R4 : un canal d'aperçu Firebase d'une PR et la recette en sont ; la production et le site Firebase lui-même non", () => {
    expect(isPreview({ hostname: "playdujour-recette--pr-12-a1b2c3d4.web.app", pathname: "/jump/" })).toBe(true);
    expect(isPreview({ hostname: "recette.playdujour.com", pathname: "/jump/" })).toBe(true);
    expect(isPreview({ hostname: "playdujour.com", pathname: "/jump/" })).toBe(false);
    expect(isPreview({ hostname: "www.playdujour.com", pathname: "/jump/" })).toBe(false);
    expect(isPreview({ hostname: "playdujour.web.app", pathname: "/jump/" })).toBe(false);
  });

  it("le serveur local (machine ou réseau local) en est un", () => {
    for (const hostname of ["localhost", "127.0.0.1", "[::1]", "::1", "0.0.0.0", "192.168.1.20", "10.0.0.5", "172.20.3.4", "mon-pc.local", ""]) {
      expect(isPreview({ hostname, pathname: "/" }), hostname).toBe(true);
    }
    expect(isPreview({ hostname: "172.40.3.4", pathname: "/" })).toBe(false);
  });
});

describe("la porte des jours futurs", () => {
  const today = day("2026-10-20");
  it("site publié : hier en archive, aujourd'hui ouvert, demain refusé (le niveau du jour s'ouvre)", () => {
    expect(chooseDay(day("2026-10-19"), today, false)).toEqual({ day: day("2026-10-19"), mode: "archive", refused: false });
    expect(chooseDay(today, today, false)).toEqual({ day: today, mode: "jour", refused: false });
    expect(chooseDay(day("2026-10-21"), today, false)).toEqual({ day: today, mode: "jour", refused: true });
    expect(chooseDay(day("2030-01-01"), today, false)).toEqual({ day: today, mode: "jour", refused: true });
    expect(chooseDay(null, today, false)).toEqual({ day: today, mode: "jour", refused: false });
  });

  it("aperçu : toutes les dates sont ouvertes", () => {
    expect(chooseDay(day("2026-10-19"), today, true)).toEqual({ day: day("2026-10-19"), mode: "archive", refused: false });
    expect(chooseDay(today, today, true)).toEqual({ day: today, mode: "jour", refused: false });
    expect(chooseDay(day("2026-10-21"), today, true)).toEqual({ day: day("2026-10-21"), mode: "futur", refused: false });
  });

  it("passage de minuit (heure de Paris) : demain est refusé à 23:59:59, c'est le niveau du jour à 00:00:00", () => {
    // Le 20/10/2026, Paris est à UTC+2 : minuit de Paris = 22:00 UTC.
    const before = parisDay(Date.UTC(2026, 9, 20, 21, 59, 59));
    const after = parisDay(Date.UTC(2026, 9, 20, 22, 0, 0));
    expect(before).toBe(day("2026-10-20"));
    expect(after).toBe(day("2026-10-21"));
    expect(chooseDay(day("2026-10-21"), before, false)).toEqual({ day: before, mode: "jour", refused: true });
    expect(chooseDay(day("2026-10-21"), after, false)).toEqual({ day: after, mode: "jour", refused: false });
    // Et en hiver (UTC+1) : minuit de Paris = 23:00 UTC.
    expect(parisDay(Date.UTC(2026, 11, 24, 22, 59, 59))).toBe(day("2026-12-24"));
    expect(parisDay(Date.UTC(2026, 11, 24, 23, 0, 0))).toBe(day("2026-12-25"));
    expect(chooseDay(day("2026-12-25"), parisDay(Date.UTC(2026, 11, 24, 22, 59, 59)), false).refused).toBe(true);
    expect(chooseDay(day("2026-12-25"), parisDay(Date.UTC(2026, 11, 24, 23, 0, 0)), false).refused).toBe(false);
  });

  it("le message du refus est discret et en français", () => {
    expect(REFUSED_TEXT).toBe("Ce niveau n'est pas encore sorti");
  });
});

describe("médailles et textes", () => {
  const medals = jumpMedalsFor(3600);
  it("la prochaine médaille visée : bronze sans temps, puis argent, or, auteur ; rien une fois l'auteur battu", () => {
    expect(nextMedal(null, medals)).toEqual({ medal: "bronze", ticks: 5760 });
    expect(nextMedal(6000, medals)).toEqual({ medal: "bronze", ticks: 5760 });
    expect(nextMedal(5760, medals)).toEqual({ medal: "silver", ticks: 4680 });
    expect(nextMedal(4000, medals)).toEqual({ medal: "gold", ticks: 3960 });
    expect(nextMedal(3700, medals)).toEqual({ medal: "author", ticks: 3600 });
    expect(nextMedal(3600, medals)).toBeNull();
  });

  it("titre, date courte, ligne du HUD (archive, à venir, aperçu)", () => {
    expect(levelTitle(12)).toBe("DailyJump #12");
    expect(levelTitle(0)).toBe("DailyJump");
    expect(shortDate("2026-10-16")).toBe("16 oct. 2026");
    const d = { number: 5, date: "2026-10-20", medals };
    expect(dayLine(d, { day: day("2026-10-20"), mode: "jour", refused: false }, false, null)).toBe("DailyJump #5 · visée 🥉 48,000 s");
    expect(dayLine(d, { day: day("2026-10-20"), mode: "archive", refused: false }, false, 4000)).toBe("DailyJump #5 · archive du 20 oct. 2026 · visée 🥇 33,000 s");
    expect(dayLine(d, { day: day("2026-10-20"), mode: "futur", refused: false }, true, 3600)).toBe("DailyJump #5 · à venir (20 oct. 2026) · aperçu · 🏆 auteur battu");
  });

  it("bandeau d'arrivée : la médaille obtenue et le temps de l'auteur", () => {
    expect(finishMedalText(3600, medals)).toEqual({ medal: "author", text: "🏆 Médaille auteur · Temps de l'auteur : 30,000 s" });
    expect(finishMedalText(3900, medals).medal).toBe("gold");
    expect(finishMedalText(9999, medals)).toEqual({ medal: null, text: "Pas de médaille (bronze : 48,000 s) · Temps de l'auteur : 30,000 s" });
  });

  it("le niveau du jour d'une date : numéro, médailles entières, palette du jour", () => {
    const L = dailyLevel(day("2026-10-20"));
    expect(L.number).toBe(day("2026-10-20") - PREMIER_JOUR_JUMP + 1);
    expect(L.medals.author).toBe(L.authorTicks);
    expect(paletteForDay(L.day).name).toBe(paletteForDay(day("2026-10-20")).name);
  });
});
