import { describe, expect, it } from "vitest";
import { AMELIORATIONS, DUREE_TICKS, NB_AMELIORATIONS, TICKS_PAR_SECONDE, dailyRush } from "@cdj/rush-sim";
import { CATALOGUE_RUSH } from "../src/catalogue";
import { DEFINITION } from "../src/definition";
import { lireEssai } from "../src/essai";
import { cartesPrises, lignesDeFin, tempsDuKit } from "../src/fin";

// Lot BR4 — l'écran de fin (celui du kit, complété par le jeu), les nouvelles options d'adresse et l'accord de la définition avec les médailles.
const traducteur = (langue: "fr" | "en") => (cle: string, params: Readonly<Record<string, string | number>> = {}): string => {
  const brut = (CATALOGUE_RUSH[langue] as Record<string, string>)[cle];
  if (brut === undefined) throw new Error(`clé absente (${langue}) : ${cle}`);
  return brut.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? `{${k}}`));
};
const paliers = (prises: Record<string, number>): number[] => AMELIORATIONS.map((a) => prises[a.id] ?? 0);

const l0 = (o: { t: ReturnType<typeof traducteur>; langue: "fr" | "en" }): string => lignesDeFin({ boss: 0, paliers: paliers({}), diamant: { ticks: 3433, strategie: "peu" } }, o).diamant!;
describe("les cartes choisies, au bas de l'écran de fin", () => {
  it("écrivent les cartes prises dans l'ordre du catalogue, avec ×n pour un palier au-delà du premier", () => {
    const t = traducteur("fr");
    expect(cartesPrises(paliers({ "lame-lourde": 2, moulinet: 1, "bottes-legeres": 3 }), t)).toEqual(["Lame lourde ×2", "Moulinet", "Bottes légères ×3"]);
    expect(cartesPrises(paliers({}), t)).toEqual([]);
    expect(cartesPrises(new Array(NB_AMELIORATIONS).fill(0), traducteur("en"))).toEqual([]);
  });
  it("disent le boss du jour, les cartes (ou « aucune »), et le Diamant — dans les deux langues, sans paramètre resté en clair", () => {
    for (const langue of ["fr", "en"] as const) {
      const o = { t: traducteur(langue), langue };
      for (let boss = 0; boss < 5; boss++) {
        const l = lignesDeFin({ boss, paliers: paliers({ cadence: 2 }), diamant: { ticks: 3433, strategie: "peu" } }, o);
        for (const texte of [l.boss, l.cartes, l.diamant!]) expect(texte).not.toMatch(/\{\w+\}/);
        expect(l.cartes).toContain("×2");
        expect(l.diamant).toContain(langue === "fr" ? "0:57,21" : "0:57.21");
      }
      expect(lignesDeFin({ boss: 0, paliers: paliers({}) }, o)).toMatchObject({ diamant: null });
      expect(lignesDeFin({ boss: 0, paliers: paliers({}) }, o).cartes).toBe(o.t("fin.aucuneCarte"));
      expect(lignesDeFin({ boss: 0, paliers: paliers({}), diamant: { ticks: 3433 } }, o).diamant).toBe(o.t("fin.diamant", { temps: langue === "fr" ? "0:57,21" : "0:57.21", strategie: "" }));
      expect(l0(o)).toContain(`(${o.t("strategie.peu")})`);
    }
    expect(lignesDeFin({ boss: 1, paliers: paliers({}) }, { t: traducteur("fr"), langue: "fr" }).boss).toBe("Boss du jour : Reine gelée");
    expect(lignesDeFin({ boss: 3, paliers: paliers({}) }, { t: traducteur("en"), langue: "en" }).boss).toBe(`Boss of the day: ${(CATALOGUE_RUSH.en as Record<string, string>)["boss.nom.belier"]}`);
  });
  it("réécrit en temps les nombres que le kit écrit en ticks (les seuils, « encore … »), et laisse le reste", () => {
    expect(tempsDuKit("3433", "fr")).toBe("0:57,21");
    expect(tempsDuKit("3433", "en")).toBe("0:57.21");
    expect(tempsDuKit(" 4462 ", "fr")).toBe("1:14,36");
    expect(tempsDuKit("0:57,21", "fr")).toBe("0:57,21"); // déjà un temps : intact
    expect(tempsDuKit("Or", "fr")).toBe("Or");
    expect(tempsDuKit(String(DUREE_TICKS), "fr")).toBe("10:00,00");
  });
});

describe("les options d'adresse du lot BR4", () => {
  it("?scenario=jour&fantome=1 : le fantôme du Diamant dès le départ (un essai)", () => {
    const e = lireEssai("?debug&scenario=jour&fantome=1", false);
    expect(e).toMatchObject({ scenario: "jour", fantome: true, essai: true });
    expect(lireEssai("?scenario=jour", false).fantome).toBe(false);
  });
  it("?scenario=medailles&jours=7 : le tableau des médailles (7 jours par défaut, 14 au plus)", () => {
    expect(lireEssai("?scenario=medailles&jours=7", false)).toMatchObject({ medailles: 7, essai: true });
    expect(lireEssai("?scenario=medailles", false).medailles).toBe(7);
    expect(lireEssai("?scenario=medailles&jours=99", false).medailles).toBe(14);
    expect(lireEssai("?scenario=medailles&jours=0", false).medailles).toBe(7);
  });
  it("?scenario=fin&temps=65000 : l'écran de fin à 65 s (en ticks), jamais moins d'une seconde ni plus de dix minutes", () => {
    expect(lireEssai("?scenario=fin&temps=65000", false)).toMatchObject({ fin: 65 * TICKS_PAR_SECONDE, essai: true });
    expect(lireEssai("?scenario=fin", false).fin).toBe(65 * TICKS_PAR_SECONDE);
    expect(lireEssai("?scenario=fin&temps=10", false).fin).toBe(TICKS_PAR_SECONDE);
    expect(lireEssai("?scenario=fin&temps=99999999", false).fin).toBe(DUREE_TICKS);
    expect(lireEssai("?scenario=jour", false).fin).toBeNull();
  });
  it("sur la production (restreint) aucune de ces options n'existe", () => {
    for (const q of ["?scenario=jour&fantome=1", "?scenario=medailles&jours=7", "?scenario=fin&temps=65000"]) expect(lireEssai(q, true)).toMatchObject({ medailles: null, fin: null, fantome: false, essai: false });
  });
  it("une partie d'essai n'est jamais classable", () => {
    for (const q of ["?debug&scenario=jour&fantome=1", "?scenario=medailles", "?scenario=fin"]) expect(DEFINITION.classable!(q)).toBe(false);
    expect(DEFINITION.classable!("")).toBe(true);
  });
});

describe("la définition donne des médailles (lot BR4)", () => {
  it("n'est plus « sans médaille » et garde le fantôme du kit (bouton dans l'interface en jeu)", () => {
    expect(DEFINITION.sansMedaille).not.toBe(true);
    expect(DEFINITION.sansFantome).not.toBe(true);
    expect(dailyRush(0).niveau).not.toBeNull();
  });
});
