import { describe, expect, it } from "vitest";
import { AMELIORATIONS, BOSS, Partie, REGLAGES_DEFAUT, contenuScenario } from "@cdj/rush-sim";
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
  it("Brise-pierre dit sa valeur CONTRE LE BOSS DU JOUR (lot BR4) : +90 % contre le golem et le bélier, la part que les trois autres encaissent contre eux", () => {
    const i = AMELIORATIONS.findIndex((a) => a.id === "brise-pierre");
    const fr = traducteur("fr");
    const dit = (boss: number): string => carteVue(i, 0, REGLAGES_DEFAUT, fr, boss).effet;
    expect(dit(0)).toBe("+90 % de dégâts contre le golem.");
    expect(dit(1)).toBe("+31 % de dégâts contre la reine gelée."); // 90 % × 35 % (BOSS[].brise), arrondi comme la simulation
    expect(dit(2)).toBe("+31 % de dégâts contre le grand-duc.");
    expect(dit(3)).toBe("+90 % de dégâts contre le bélier.");
    expect(dit(4)).toBe("+31 % de dégâts contre le vieux chêne.");
    expect(carteVue(i, 0, REGLAGES_DEFAUT, fr).effet).toBe("+90 % de dégâts contre le boss du jour."); // sans boss
    expect(carteVue(i, 0, REGLAGES_DEFAUT, traducteur("en"), 1).effet).toBe("+31% damage against the frozen queen.");
    // le texte est celui de la simulation : le pourcentage affiché est bien ce que la carte donne au premier palier
    for (const boss of [0, 1, 2, 3, 4]) {
      const p = new Partie(contenuScenario("boss", { boss }));
      p.paliers[i] = 1;
      // les dégâts contre CE boss avec un palier, sans l'affinité de ses cartes favorites (aucune prise) : cent dégâts deviennent 100 + n
      expect(p.degatsContreGolem(100, { ...p.golem!, sol: 1 })).toBe(100 + Number(/\+(\d+)/.exec(dit(boss))![1]));
    }
    // un curseur de `?debug&tune` change la valeur
    expect(carteVue(i, 0, { ...REGLAGES_DEFAUT, briseDegats: 50 }, fr, 0).effet).toContain("+50 %");
  });
  it("les textes du niveau et du choix existent dans les deux langues", () => {
    for (const cle of ["hud.niveau", "hud.xp", "choix.titre", "choix.aria", "choix.aide", "choix.palier", "choix.unique", "strategie.foncer", "strategie.peu", "strategie.beaucoup", "carte.meilleure"]) {
      expect((CATALOGUE_RUSH.fr as Record<string, string>)[cle], cle).toBeTruthy();
      expect((CATALOGUE_RUSH.en as Record<string, string>)[cle], cle).toBeTruthy();
    }
  });
});
