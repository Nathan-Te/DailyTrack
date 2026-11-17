import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { THEMES_PINBALL, dailyPinball } from "@cdj/pinball-sim";
import { etatPermis, identiteAChoisir, identiteComplete } from "@cdj/core/fiche";
import { CATALOGUE_PINBALL } from "../src/catalogue";
import { DEFINITION } from "../src/definition";
import { modulesDeLaTable } from "../src/panneau";
import { nomDuModule } from "../src/noms";

// Lot PB5b — l'identité de Pinball et ses textes complets : la fiche passe le test des fiches **avec l'état `preview`** (sans changer l'état réel : il reste `off`, c'est Nathan qui publie), l'illustration est celle de la maquette
// validée, « Comment jouer » est complet dans les deux langues, aucun « À remplacer » ne reste.
const lire = (chemin: string): string => readFileSync(new URL(chemin, import.meta.url), "utf8");
const fiche = JSON.parse(lire("../../../config/jeux/pinball.json")) as {
  etatDepart: string;
  etiquette: { fond: string; coque: string; police: string; dessin: string };
  identite: { police: string; motif: string; illustration: string; aujourdhui: boolean };
};

describe("« Pinball » : la fiche est prête pour l'aperçu", () => {
  it("l'identité est complète : plus aucun « à choisir », donc `preview` et `on` sont permis par le test des fiches — l'état réel reste `off`", () => {
    expect(identiteAChoisir(fiche as never)).toEqual([]);
    expect(identiteComplete(fiche as never)).toBe(true);
    for (const etat of ["off", "preview", "on"] as const) expect(etatPermis(fiche as never, etat), etat).toBe(true);
    expect(fiche.etatDepart, "c'est Nathan qui publie : le jeu naît et reste `off`").toBe("off");
  });
  it("le choix de Nathan du 16/11/2026 : l'étiquette « Néon » (rose et prune, Barlow Condensed), les rayures, l'illustration « la table », le panneau « Aujourd'hui »", () => {
    expect(fiche.etiquette).toMatchObject({ fond: "#F6A2D8", coque: "#962170", police: '"Barlow Condensed", "Archivo", sans-serif' });
    expect(fiche.identite).toEqual({ police: "Barlow Condensed", motif: "rayures", illustration: "apps/pinball/public/illustration.svg", aujourdhui: true });
  });
  it("l'illustration est la copie de la maquette validée (`illustration-3-la-table.svg`), aux couleurs de la charte, sans ressource ni opacité", () => {
    const svg = lire("../public/illustration.svg");
    expect(svg).toBe(lire("../../../docs/pinball/maquettes/illustration-3-la-table.svg"));
    expect(svg).not.toMatch(/opacity|href=|url\(|<script|<image/i);
    expect(svg).toContain("#2A1E16"); // l'encre
  });
});

describe("« Pinball » : les textes sont complets, en français et en anglais", () => {
  it("« Comment jouer » : dix points (lot PBG1 : les rails et le combo ; lot PBG2 : la boucle verrou, multibille, niveaux ; lot PBG3 : la porte, le poteau et l'aiguillage ; lot PBL1 : les flèches au sol et leurs couleurs), chacun dans les deux langues, sans « À remplacer »", () => {
    expect(DEFINITION.aide).toHaveLength(10);
    for (const langue of ["fr", "en"] as const) {
      const c = CATALOGUE_PINBALL[langue] as Record<string, string>;
      for (const cle of DEFINITION.aide) {
        expect(c[cle], `${langue} ${cle}`).toBeTruthy();
        expect(c[cle], `${langue} ${cle}`).not.toMatch(/à remplacer|to replace/i);
      }
    }
  });
  it("aucun marqueur « À remplacer » ne reste dans le catalogue (les mentions légales sont en place depuis le lot K8)", () => {
    expect(lire("../src/catalogue.fr.ts")).not.toMatch(/À remplacer/);
    expect(lire("../src/catalogue.en.ts")).not.toMatch(/To replace/i);
  });
  it("le HUD et le panneau « Aujourd'hui » ont leurs clés dans les deux langues (mêmes clés, aucune vide)", () => {
    const fr = CATALOGUE_PINBALL.fr as Record<string, string>;
    const en = CATALOGUE_PINBALL.en as Record<string, string>;
    const cles = Object.keys(fr).filter((k) => /^(aujourdhui|hud)\./.test(k));
    for (const k of ["aujourdhui.mission", "aujourdhui.table", "aujourdhui.medailles", "hud.aide.lancer", "hud.mission.reussie", "hud.score.aria", "hud.mult.aria", "hud.billes.aria", "hud.combo", "hud.combo.aria", "hud.rail.gain", "aujourdhui.plan", "aujourdhui.boucle", "hud.multibille", "hud.niveau", "hud.verrou.aria"]) expect(cles, k).toContain(k);
    for (const k of cles) {
      expect(fr[k], `fr ${k}`).toBeTruthy();
      expect(en[k], `en ${k}`).toBeTruthy();
    }
    expect(Object.keys(en).filter((k) => /^(aujourdhui|hud)\./.test(k)).sort()).toEqual([...cles].sort());
    for (const m of ["manege", "tourbillon", "portail", "geyser"]) for (const c of [fr, en]) expect(c[`hud.mission.nom.${m}`], m).toBeTruthy();
  });
});

describe("« Pinball » : le panneau « Aujourd'hui » dit les modules de la table", () => {
  it("chaque table : les modules de la mission d'abord, aucun doublon, chaque nom vient du catalogue", () => {
    const t = (cle: string): string => (CATALOGUE_PINBALL.fr as Record<string, string>)[cle] ?? `?${cle}`;
    for (const theme of THEMES_PINBALL) {
      for (const jour of [20400, 20401, 20402]) {
        const c = dailyPinball(jour, undefined, theme);
        const noms = modulesDeLaTable(c, t);
        expect(noms.length, `${theme} ${jour}`).toBeGreaterThan(0);
        expect(new Set(noms.map((n) => n.nom)).size, `${theme} ${jour} : aucun doublon`).toBe(noms.length);
        expect(noms.some((n) => n.mission), `${theme} ${jour} : la mission a son module`).toBe(true);
        expect(noms[0]!.mission, `${theme} ${jour} : la mission d'abord`).toBe(true);
        for (const n of noms) expect(n.nom, `${theme} ${jour}`).not.toMatch(/^\?/);
      }
    }
  });
  it("un nom de module est le même sur la table et dans le panneau (`noms.ts`)", () => {
    const t = (cle: string): string => cle;
    expect(nomDuModule(t, "foire", "mini")).toBe("module.bumpers.foire");
    expect(nomDuModule(t, "foire", "trou")).toBe("module.trou.foire");
    expect(nomDuModule(t, "espace", "portailA")).toBe("module.portailA");
    expect(nomDuModule(t, "foire", "inconnu")).toBeNull();
  });
});
