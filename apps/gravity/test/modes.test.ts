import { afterEach, describe, expect, it, vi } from "vitest";
import { CASE, DEPART_X, LARGEUR_MORCEAU, MODE_AVION, MODE_ONDE, MODE_RESSORT, Partie, planDuJour, terrainDuJour, type TypePortail } from "@cdj/gravity-sim";
import { contenuDuJour } from "../src/niveau";
import { COLONNES_AVANT_MORCEAU, distanceAvantMorceau } from "../src/essai";
import { Annonces, CHEVRONS_DU_PORTAIL, NOMS_DES_MODES, RANG_DES_MODES, estPortailDeVitesse, nomDuMode, type AnnonceMode, type AnnonceVitesse } from "../src/modesLogique";

// Lot GR6 — les modes de vol côté jeu : ce que dit l'annonce d'un portail (la consigne seulement la première fois du mode dans la partie), les noms, et `?mode=` qui place la partie avant la première section de ce mode.
describe("l'annonce des modes", () => {
  it("la consigne n'est donnée que la première fois du mode dans la partie ; ensuite le nom seul", () => {
    const a = new Annonces();
    const un = a.portail("avion", 100) as AnnonceMode;
    expect(un).toMatchObject({ mode: "avion", consigne: true, depuis: 100 });
    expect((a.portail("gravite", 500) as AnnonceMode).mode).toBe("gravite");
    const deux = a.portail("avion", 900) as AnnonceMode;
    expect(deux).toMatchObject({ mode: "avion", consigne: false });
    expect(deux.id).toBeGreaterThan(un.id); // un nouveau portail est une nouvelle annonce (le HUD réécrit)
    expect((a.portail("onde", 1200) as AnnonceMode).consigne).toBe(true);
    expect((a.portail("onde", 1500) as AnnonceMode).consigne).toBe(false);
    expect((a.portail("ressort", 1800) as AnnonceMode).consigne).toBe(true);
  });
  it("la gravité est le mode du départ : son retour ne porte jamais de consigne", () => {
    const a = new Annonces();
    expect((a.portail("gravite", 10) as AnnonceMode).consigne).toBe(false);
  });
  it("l'état « déjà annoncé » vit avec la partie : une partie neuve repart de zéro", () => {
    const premiere = new Annonces();
    premiere.portail("onde", 1);
    expect((new Annonces().portail("onde", 1) as AnnonceMode).consigne).toBe(true);
  });
  it("un portail de vitesse est une annonce discrète, jamais une annonce de mode", () => {
    const a = new Annonces();
    const v = a.portail("v2", 40) as AnnonceVitesse;
    expect(v).toMatchObject({ type: "v2", depuis: 40 });
    expect(a.mode).toBeNull();
    expect(a.vitesse).toBe(v);
    expect(["lent", "v1", "v2", "v3"].every((t) => estPortailDeVitesse(t as TypePortail))).toBe(true);
    expect(["avion", "onde", "ressort", "gravite"].some((t) => estPortailDeVitesse(t as TypePortail))).toBe(false);
    expect(CHEVRONS_DU_PORTAIL).toEqual({ lent: 0, v1: 1, v2: 2, v3: 3 });
  });
  it("les noms et les rangs suivent ceux de la simulation", () => {
    expect(NOMS_DES_MODES.map((_, i) => nomDuMode(i))).toEqual(["gravite", "avion", "onde", "ressort"]);
    expect(RANG_DES_MODES).toEqual({ gravite: 0, avion: MODE_AVION, onde: MODE_ONDE, ressort: MODE_RESSORT });
    expect(nomDuMode(99)).toBe("gravite");
  });
});

describe("?mode= : la partie commence juste avant la première section de ce mode", () => {
  afterEach(() => vi.unstubAllGlobals());
  const JOUR = 20_400;
  for (const mode of ["avion", "onde", "ressort"] as const) {
    it(`?mode=${mode} : le morceau du plan est une section de ce mode, la partie est à ${COLONNES_AVANT_MORCEAU} colonnes devant, jamais classée`, async () => {
      vi.stubGlobal("location", { search: `?mode=${mode}` });
      const contenu = await contenuDuJour(JOUR, "http://localhost/", "");
      const terrain = terrainDuJour(contenu);
      const n = planDuJour(JOUR, terrain.regles!).premierMorceauDuMode(RANG_DES_MODES[mode] as 1 | 2 | 3);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(terrain.morceau(n).motif).toBe(mode);
      expect(terrain.morceau(n).portails.map((p) => p.type)).toContain(mode); // le portail d'entrée est dans ce morceau
      const essai = (contenu as { essai?: { robot: boolean; changements: readonly number[]; depart: number } }).essai!;
      expect(essai.robot).toBe(false);
      expect(essai.depart).toBeGreaterThan(0);
      // on rejoue ses changements jusqu'au pas du départ : le joueur est dans le morceau d'avant, à la distance annoncée, encore en gravité
      const p = new Partie(terrain);
      let k = 0;
      while (p.tick < essai.depart && !p.finie) {
        if (essai.changements[k] === p.tick) (k++ % 2 === 0 ? p.appuyer() : p.relacher());
        p.avancer();
      }
      expect(p.finie).toBe(false);
      expect(p.mode).toBe(0);
      expect(p.distance).toBeGreaterThanOrEqual(distanceAvantMorceau(n) - 1);
      expect(Math.trunc(p.x / CASE / LARGEUR_MORCEAU)).toBeLessThan(n);
      expect(n * LARGEUR_MORCEAU - (p.x - DEPART_X) / CASE).toBeLessThan(COLONNES_AVANT_MORCEAU + 6);
    });
  }
  it("`?morceau=` l'emporte sur `?mode=` ; sans essai demandé, le contenu ne porte aucun essai", async () => {
    vi.stubGlobal("location", { search: "?mode=ressort&morceau=6" });
    const c = await contenuDuJour(JOUR, "http://localhost/", "");
    const e = (c as { essai?: { depart: number } }).essai!;
    vi.stubGlobal("location", { search: "?morceau=6" });
    const seul = (await contenuDuJour(JOUR, "http://localhost/", "")) as { essai?: { depart: number } };
    expect(e.depart).toBe(seul.essai!.depart);
    vi.stubGlobal("location", { search: "" });
    expect(((await contenuDuJour(JOUR, "http://localhost/", "")) as { essai?: unknown }).essai).toBeUndefined();
  });
});
