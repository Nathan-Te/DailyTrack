import "./legacy";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { daysFromCivil, formatDay, parseDay } from "@cdj/core";
import {
  JUMP_GENERATOR_SAC,
  JUMP_GENERATOR_VERSION,
  JUMP_THEME_NAMES,
  PREMIER_JOUR_JUMP,
  declareFrozenGenerators,
  declareOldFrozenDays,
  jumpThemeAncien,
  jumpThemeForDay,
  jumpThemeOfGenerator,
  jumpThemeOfSim,
  thawLevel,
} from "../src/index";

// Lot V1 (plateforme) : le sac de thèmes de Jump (cinq thèmes, cycles de cinq jours). La règle commune est testée dans `packages/core/test/sacThemes.test.ts` ; ici ce qui est propre
// à Jump : les cinq thèmes, les jours figés d'avant (leur générateur dit leur thème), le premier jour du sac, et le thème de chaque niveau figé du dépôt.

const N = JUMP_THEME_NAMES.length;
const D0 = daysFromCivil(2026, 11, 20);
const suite = (depuis: number, jours: number): string[] => Array.from({ length: jours }, (_, i) => jumpThemeForDay(depuis + i));
const ecartMax = (s: readonly string[]): number => {
  let max = 0;
  for (const t of JUMP_THEME_NAMES) {
    let dernier = -1;
    s.forEach((x, i) => {
      if (x !== t) return;
      if (dernier >= 0) max = Math.max(max, i - dernier);
      dernier = i;
    });
  }
  return max;
};

afterEach(() => declareOldFrozenDays([]));

describe("le sac de thèmes de Jump (lot V1)", () => {
  it("un sac demande au moins cinq thèmes (la jonction de cycles n'a pas toujours de solution sinon ; le code ne le vérifie pas à l'exécution)", () => {
    expect(N).toBeGreaterThanOrEqual(5);
  });

  it("le générateur g23 est celui du sac ; la simulation ne change pas", () => {
    expect(JUMP_GENERATOR_SAC).toBe(23);
    // Lot 30 : g24 (le maintien minimal du saut) suit ; g23 reste le dernier générateur de la version 12 (`THEME_BAG_GENERATOR`).
    expect(JUMP_GENERATOR_VERSION).toBeGreaterThanOrEqual(JUMP_GENERATOR_SAC);
  });

  it("365 jours : 0 répétition d'un jour à l'autre, 0 alternance A B A, les cinq thèmes, aucun ne tarde plus de 2n − 1 jours", () => {
    const s = suite(D0, 365);
    expect(s.filter((x, i) => i > 0 && x === s[i - 1])).toEqual([]);
    expect(s.filter((x, i) => i > 1 && x === s[i - 2])).toEqual([]);
    expect(new Set(s).size).toBe(N);
    expect(ecartMax(s)).toBeLessThanOrEqual(2 * N - 1);
  });

  it("chaque cycle de cinq jours (alignés sur le numéro de jour) contient les cinq thèmes, chacun une fois", () => {
    const debut = Math.ceil(D0 / N) * N;
    for (let c = 0; c < 70; c++) expect([...suite(debut + c * N, N)].sort(), `cycle ${c}`).toEqual([...JUMP_THEME_NAMES].sort());
  });

  it("la jonction de deux cycles : le dernier thème d'un cycle ne revient pas avant le 3ᵉ jour du suivant, l'avant-dernier pas le 1ᵉʳ", () => {
    const debut = Math.ceil(D0 / N) * N;
    for (let c = 0; c < 400; c++) {
      const avant = suite(debut + c * N, N);
      const apres = suite(debut + (c + 1) * N, N);
      expect(apres.indexOf(avant[N - 1]!), `cycle ${c + 1}`).toBeGreaterThanOrEqual(2);
      expect(apres[0]).not.toBe(avant[N - 2]);
    }
  });

  it("la jonction avec le dernier jour figé : à chaque position possible du premier jour du sac, ni répétition ni A B A avec les jours figés d'avant (leur thème est celui de l'ancienne règle)", () => {
    for (let decalage = 0; decalage < 4 * N; decalage++) {
      for (let k = 0; k < 20; k++) {
        const premier = D0 + decalage + k * 13 * N; // le premier jour du sac
        // Les jours d'avant sont figés par un générateur d'avant le sac (g22) : leurs fichiers le disent.
        declareFrozenGenerators(Object.fromEntries(Array.from({ length: 30 }, (_, i) => [formatDay(premier - 1 - i), 22])));
        const veille = jumpThemeForDay(premier - 1);
        const avantVeille = jumpThemeForDay(premier - 2);
        expect(veille, formatDay(premier - 1)).toBe(jumpThemeAncien(premier - 1));
        expect(avantVeille, formatDay(premier - 2)).toBe(jumpThemeAncien(premier - 2));
        const s = suite(premier, 60);
        expect(s[0], `le premier jour du sac répète la veille (${formatDay(premier)})`).not.toBe(veille);
        expect(s[0], `A B A (${formatDay(premier)})`).not.toBe(avantVeille);
        expect(s[1], `le deuxième jour répète la veille du premier (${formatDay(premier)})`).not.toBe(veille);
        expect(s[1]).not.toBe(s[0]);
        expect(s.filter((x, i) => i > 0 && x === s[i - 1])).toEqual([]);
        expect(s.filter((x, i) => i > 1 && x === s[i - 2])).toEqual([]);
        expect(ecartMax(s)).toBeLessThanOrEqual(2 * N - 1);
      }
    }
  });

  it("un jour figé par un générateur du sac (g23 et plus) n'est pas « ancien » : il suit le sac ; un jour figé en g22 garde l'ancienne règle", () => {
    declareFrozenGenerators({ [formatDay(D0)]: 22, [formatDay(D0 + 1)]: JUMP_GENERATOR_SAC, [formatDay(D0 + 2)]: JUMP_GENERATOR_SAC + 1 });
    expect(jumpThemeForDay(D0)).toBe(jumpThemeAncien(D0));
    // D0 + 1 est le premier jour du sac : il évite le thème de la veille figée.
    expect(jumpThemeForDay(D0 + 1)).not.toBe(jumpThemeAncien(D0));
    expect(jumpThemeForDay(D0 + 2)).not.toBe(jumpThemeForDay(D0 + 1));
  });

  it("la version de la simulation et le générateur du niveau choisissent la règle : l'ancienne avant la version 12 et avant g23, le sac sinon", () => {
    for (let d = D0; d < D0 + 60; d++) {
      expect(jumpThemeOfSim(d, 11), formatDay(d)).toBe(jumpThemeAncien(d));
      expect(jumpThemeOfSim(d, 12), formatDay(d)).toBe(jumpThemeForDay(d));
      expect(jumpThemeOfGenerator(d, 22), formatDay(d)).toBe(jumpThemeAncien(d));
      expect(jumpThemeOfGenerator(d, 23), formatDay(d)).toBe(jumpThemeForDay(d));
    }
  });

  it("chaque niveau figé du dépôt se relit avec le thème de son générateur : l'ancienne règle pour g22 et avant, le sac sinon (aucun jour servi ne change)", () => {
    const dossier = join(import.meta.dirname, "../../../apps/jump/public/levels");
    const fichiers = readdirSync(dossier).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f));
    expect(fichiers.length).toBeGreaterThan(0);
    const anciens: string[] = [];
    for (const f of fichiers) {
      const raw = JSON.parse(readFileSync(join(dossier, f), "utf8")) as { generatorVersion: number };
      if (raw.generatorVersion < JUMP_GENERATOR_SAC) anciens.push(f.slice(0, 10));
      const jour = parseDay(f.slice(0, 10))!;
      const niveau = thawLevel(raw, jour);
      expect(typeof niveau, f).not.toBe("string");
      if (typeof niveau === "string") continue;
      expect(niveau.theme, f).toBe(raw.generatorVersion < JUMP_GENERATOR_SAC ? jumpThemeAncien(jour) : jumpThemeForDay(jour));
    }
    // Déclarés comme le fait le jeu (la construction) et le serveur : la page, l'archive et la palette de ces jours-là gardent leur thème.
    declareOldFrozenDays(anciens);
    for (const f of fichiers) {
      const raw = JSON.parse(readFileSync(join(dossier, f), "utf8")) as { generatorVersion: number };
      if (raw.generatorVersion < JUMP_GENERATOR_SAC) expect(jumpThemeForDay(parseDay(f.slice(0, 10))!), f).toBe(jumpThemeAncien(parseDay(f.slice(0, 10))!));
    }
  });

  it("le premier jour de la liste du dépôt n'est pas touché : PREMIER_JOUR_JUMP garde son ancien thème une fois déclaré", () => {
    declareOldFrozenDays([formatDay(PREMIER_JOUR_JUMP)]);
    expect(jumpThemeForDay(PREMIER_JOUR_JUMP)).toBe(jumpThemeAncien(PREMIER_JOUR_JUMP));
  });
});
