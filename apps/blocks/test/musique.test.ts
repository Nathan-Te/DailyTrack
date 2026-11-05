import { readFileSync } from "node:fs";
import { join } from "node:path";
import { THEMES_BLOCKS } from "@cdj/blocks-sim";
import { SCENES, hzDeMidi, lireListe, pistesDeLaScene, pistesDuJeu } from "@cdj/musique";
import { describe, expect, it } from "vitest";
import { SEUIL_COUCHE, coucheVoulue, suivreCouche } from "../src/coucheLogique";
import { DO5 } from "../src/sonsLogique";

// Lot B6 — la musique de Blocks : un morceau par scène (le menu et chacun des six thèmes), tous sur Do (La mineur pour la nuit) pour que les demi-tons du combo (Do₅ et au-dessus) sonnent juste, et une couche qui entre
// au combo ×3. Les morceaux sont ceux de la liste servie (`musique/servi/liste.json`, la vraie).
const liste = lireListe(JSON.parse(readFileSync(join(__dirname, "../../../musique/servi/liste.json"), "utf8")))!;
const blocks = pistesDuJeu(liste, "blocks");

describe("la musique de Blocks : un morceau par scène", () => {
  it("les scènes de Blocks sont `menu` et un `theme:<id>` par thème du jeu", () => {
    expect([...SCENES.blocks]).toEqual(["menu", ...THEMES_BLOCKS.map((t) => `theme:${t}`)]);
    expect(blocks).toHaveLength(7);
  });

  it("chaque scène a exactement un morceau, et c'est le sien : le menu, puis chacun des six thèmes", () => {
    for (const scene of SCENES.blocks) {
      const ceux = pistesDeLaScene(blocks, scene);
      expect(ceux.map((p) => p.id), scene).toEqual([`blocks-${scene === "menu" ? "menu" : scene.slice(6)}`]);
      expect(ceux[0]!.scenes, scene).toEqual([scene]);
    }
  });

  it("un thème inconnu ne joue rien (le silence), sans repli sur le morceau d'un autre thème", () => {
    expect(pistesDeLaScene(blocks, "theme:lave")).toEqual([]);
  });

  it("sans scène (un scénario d'essai sans thème), tous les morceaux de Blocks sont possibles", () => {
    expect(pistesDeLaScene(blocks, null)).toHaveLength(7);
  });

  it("chaque morceau a une couleur (tempo, tonique, gamme) : de quoi caler la couche", () => {
    for (const p of blocks) {
      expect(p.bpm, p.id).toBeGreaterThanOrEqual(80);
      expect(p.bpm, p.id).toBeLessThanOrEqual(100);
      expect(Number.isInteger(p.tonique), p.id).toBe(true);
      expect(p.gamme, p.id).toBeTruthy();
    }
  });

  it("calme et qui ne lasse pas : 85 à 100 BPM, au moins 90 s avant de se répéter à l'identique", () => {
    for (const p of blocks) expect(p.duree, p.id).toBeGreaterThanOrEqual(90);
    expect(Math.min(...blocks.map((p) => p.bpm!))).toBeGreaterThanOrEqual(84);
  });

  it("la tonalité est accordée aux effets : Do₅ (la note de l'effacement au combo ×1) est la tonique de chaque morceau, ou celle de son relatif (La mineur, la nuit)", () => {
    expect(hzDeMidi(72)).toBeCloseTo(DO5, 1); // Do₅ = la note MIDI 72
    for (const p of blocks) {
      const doClasse = p.tonique! % 12 === 0;
      const laMineur = p.tonique === 57 && p.gamme === "min"; // La mineur : les mêmes notes que Do majeur
      expect(doClasse || laMineur, p.id).toBe(true);
    }
    expect(blocks.find((p) => p.id === "blocks-nuit")!.gamme).toBe("min");
    // Le palier 3 du combo (Ré₅, où la couche entre) est un degré de la gamme de chaque morceau sur Do (hors nuit : La mineur le contient aussi).
    const re = 74 % 12;
    for (const p of blocks) {
      const degres = { maj: [0, 2, 4, 5, 7, 9, 11], min: [0, 2, 3, 5, 7, 8, 10], dor: [0, 2, 3, 5, 7, 9, 10], mix: [0, 2, 4, 5, 7, 9, 10], lyd: [0, 2, 4, 6, 7, 9, 11], phr: [0, 1, 3, 5, 7, 8, 10] }[p.gamme as "maj"];
      expect(degres.map((d) => (p.tonique! + d) % 12), p.id).toContain(re);
    }
  });
});

describe("la couche du combo : entrée à ×3, sortie à la perte du combo ou à la fin", () => {
  it("le seuil est ×3", () => {
    expect(SEUIL_COUCHE).toBe(3);
    expect([0, 1, 2, 3, 4, 9].map((c) => coucheVoulue(c, false))).toEqual([false, false, false, true, true, true]);
  });

  it("à la fin de la partie, la couche sort même si le combo est haut", () => {
    expect(coucheVoulue(7, true)).toBe(false);
  });

  it("le suivi n'envoie que les changements : ×1, ×2 rien ; ×3 entrée ; ×4 rien ; combo perdu sortie ; ×3 de nouveau entrée ; fin sortie", () => {
    const appels: boolean[] = [];
    const suivi = suivreCouche({ couche: (a) => void appels.push(a) });
    for (const combo of [0, 1, 2]) suivi.maj(combo, false);
    expect(appels).toEqual([]);
    suivi.maj(3, false);
    suivi.maj(4, false);
    suivi.maj(4, false);
    expect(appels).toEqual([true]);
    expect(suivi.actif()).toBe(true);
    suivi.maj(0, false); // le combo est perdu
    expect(appels).toEqual([true, false]);
    suivi.maj(3, false);
    suivi.maj(5, true); // la partie finit
    expect(appels).toEqual([true, false, true, false]);
    suivi.arreter();
    expect(appels).toHaveLength(4); // déjà sortie : rien de plus
  });

  it("détruire la partie fait sortir la couche, et un jeu sans musique ne plante pas", () => {
    const appels: boolean[] = [];
    const suivi = suivreCouche({ couche: (a) => void appels.push(a) });
    suivi.maj(3, false);
    suivi.arreter();
    expect(appels).toEqual([true, false]);
    const sans = suivreCouche(null);
    sans.maj(5, false);
    expect(sans.actif()).toBe(true);
    expect(() => sans.arreter()).not.toThrow();
  });
});
