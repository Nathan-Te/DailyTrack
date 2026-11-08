import { describe, expect, it } from "vitest";
import { Color } from "three";
import { BLOCS_LOT58, FX_RESET, createFigureTrack } from "@cdj/sim";
import { Builder } from "../src/meshKit";
import { geometrieP1 } from "../src/scene/composerP1";
import { COULEURS_EFFET } from "../src/scene/palier1";
import { MARQUE } from "../src/scene/pieces";
import { LIVREE, ecartCouleurs } from "../src/voiture/livree";

// Lot 58 : la signalétique des blocs plus complexes — chaque effet a sa couleur, loin de l'orange de la voiture et des autres effets, et chaque
// prototype se dessine au palier 1 avec son portique (rien de la simulation : le rendu seulement).

function couleurs(g: Builder): Set<number> {
  const out = new Set<number>();
  const c = new Color();
  for (let i = 0; i < g.col.length; i += 3) out.add(c.setRGB(g.col[i]!, g.col[i + 1]!, g.col[i + 2]!).getHex());
  return out;
}

describe("couleurs des blocs à effet (lot 58)", () => {
  it("jamais l'orange de la voiture (ΔE 2000 > 12), et chacune à ΔE > 12 des autres", () => {
    const effets = COULEURS_EFFET.slice(1);
    expect(effets.length).toBe(FX_RESET);
    for (const c of effets) expect(ecartCouleurs(LIVREE.orange, c), c.toString(16)).toBeGreaterThan(12);
    for (let i = 0; i < effets.length; i++) for (let j = i + 1; j < effets.length; j++) expect(ecartCouleurs(effets[i]!, effets[j]!)).toBeGreaterThan(12);
  });

  it("chaque prototype se dessine au palier 1 ; un bloc à effet pose la couleur de son portique, et rien n'approche l'orange de la voiture", () => {
    for (const e of BLOCS_LOT58) {
      const track = createFigureTrack(e.name)!;
      const g = geometrieP1(track, "stade", { headless: true });
      const vues = new Set([...couleurs(g.calques.route), ...couleurs(g.calques.solide), ...couleurs(g.calques.lumineux)]);
      for (const b of track.blocks) if (b.fx !== undefined) expect(vues.has(COULEURS_EFFET[b.fx]!), `${e.name} : portique`).toBe(true);
      vues.delete(MARQUE.livree);
      expect([...vues].filter((c) => ecartCouleurs(LIVREE.orange, c) <= 12).map((c) => c.toString(16)), e.name).toEqual([]);
    }
  });
});
