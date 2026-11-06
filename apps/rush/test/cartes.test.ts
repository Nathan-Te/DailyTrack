import { describe, expect, it } from "vitest";
import { AMELIORATIONS, REGLAGES_DEFAUT } from "@cdj/rush-sim";
import { carteVue } from "../src/cartes";
import { CATALOGUE_RUSH } from "../src/catalogue";

// Lot BR2 — les cartes du choix d'amélioration, côté vue : chaque amélioration a son nom, son effet (dans les deux langues, avec les mêmes paramètres), son icône, et son texte écrit les nombres des réglages.
const traducteur = (langue: "fr" | "en") => (cle: string, params: Readonly<Record<string, string | number>> = {}): string => {
  const brut = (CATALOGUE_RUSH[langue] as Record<string, string>)[cle];
  if (brut === undefined) throw new Error(`clé absente (${langue}) : ${cle}`);
  return brut.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? `{${k}}`));
};
const parametres = (texte: string): string[] => [...texte.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).sort();

describe("les cartes d'amélioration (lot BR2)", () => {
  it("chaque amélioration a un nom et un effet, en français et en anglais, avec les mêmes paramètres", () => {
    const fr = CATALOGUE_RUSH.fr as Record<string, string>;
    const en = CATALOGUE_RUSH.en as Record<string, string>;
    for (const a of AMELIORATIONS) {
      for (const champ of ["nom", "effet"]) {
        const cle = `carte.${a.id.replace(/-/g, "_")}.${champ}`;
        expect(fr[cle], cle).toBeTruthy();
        expect(en[cle], cle).toBeTruthy();
        expect(parametres(en[cle]!), cle).toEqual(parametres(fr[cle]!));
      }
    }
  });
  it("la carte affichée écrit les nombres des réglages (aucun paramètre resté en clair), son icône, sa famille et son palier", () => {
    for (const langue of ["fr", "en"] as const) {
      const t = traducteur(langue);
      AMELIORATIONS.forEach((a, i) => {
        const c = carteVue(i, 0, REGLAGES_DEFAUT, t);
        expect(c.id).toBe(a.id);
        expect(c.nom.length).toBeGreaterThan(2);
        expect(c.effet).not.toMatch(/[{}]/);
        expect(c.icone).toMatch(/^M/);
        expect(c.famille).toBe(a.famille);
        expect(c.palier).toBe(a.max === Infinity ? "" : a.max === 1 ? t("choix.unique") : `1 / ${a.max}`);
      });
    }
  });
  it("un curseur de `?debug&tune` change le texte avec la force de l'effet", () => {
    const t = traducteur("fr");
    const i = AMELIORATIONS.findIndex((a) => a.id === "lame-lourde");
    expect(carteVue(i, 0, { ...REGLAGES_DEFAUT, lourdeDegats: 42 }, t).effet).toContain("+42 %");
    expect(carteVue(i, 1, REGLAGES_DEFAUT, t).palier).toBe("2 / 3");
  });
  it("les textes du niveau et du choix existent dans les deux langues", () => {
    for (const cle of ["hud.niveau", "hud.xp", "choix.titre", "choix.aria", "choix.aide", "choix.palier", "choix.unique", "strategie.foncer", "strategie.peu", "strategie.beaucoup", "carte.meilleure"]) {
      expect((CATALOGUE_RUSH.fr as Record<string, string>)[cle], cle).toBeTruthy();
      expect((CATALOGUE_RUSH.en as Record<string, string>)[cle], cle).toBeTruthy();
    }
  });
});
