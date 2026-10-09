import { describe, expect, it } from "vitest";
import { CELL, THEME_NAMES, THEMES, blockHalfWidth, dailyCircuit, daysFromCivil, parseTrack, themeForDay, type ThemeName } from "@cdj/sim";
import { CAMERAS, CAMERA_NAMES, cameraIndexOf, nextCameraIndex } from "../src/cameras";
import { AMBIENCE, AMBIENCE_KINDS, ambienceFor, ambienceLevel } from "../src/audioLogic";
import { hazardOf, signsFor } from "../src/signage";
import { LOOKS, PALETTE_DEFS } from "../src/trackMesh";
import { signStyleOf } from "../src/trackProps";

describe("caméras (lot 23)", () => {
  it("trois caméras : proche, loin, capot, dans cet ordre, et on en fait le tour", () => {
    expect(CAMERAS.map((c) => c.name)).toEqual(["proche", "loin", "capot"]);
    expect([...CAMERA_NAMES]).toEqual(["proche", "loin", "capot"]);
    let i = 0;
    const seen: string[] = [];
    for (let k = 0; k < 6; k++) {
      i = nextCameraIndex(i);
      seen.push(CAMERAS[i]!.name);
    }
    expect(seen).toEqual(["loin", "capot", "proche", "loin", "capot", "proche"]);
  });
  it("le choix mémorisé est relu ; un nom inconnu ou absent donne la caméra proche", () => {
    expect(cameraIndexOf("capot")).toBe(2);
    expect(cameraIndexOf("loin")).toBe(1);
    expect(cameraIndexOf("n'importe quoi")).toBe(0);
    expect(cameraIndexOf(null)).toBe(0);
  });
  it("capot : très basse, devant le centre de la voiture, carrosserie cachée ; les autres restent derrière", () => {
    const hood = CAMERAS[2]!;
    expect(hood.hideCar).toBe(true);
    expect(hood.height).toBeLessThan(1);
    expect(hood.back).toBeLessThan(0);
    for (const c of CAMERAS.slice(0, 2)) {
      expect(c.hideCar).toBeFalsy();
      expect(c.back).toBeGreaterThan(3);
      expect(c.height).toBeGreaterThan(hood.height);
    }
  });
});

describe("ambiances sonores par thème (lot 23)", () => {
  it("chaque palette a son ambiance, et les huit thèmes en couvrent six types différents", () => {
    const kinds = new Set<string>();
    for (const name of THEME_NAMES) kinds.add(ambienceFor(THEMES[name as ThemeName].palette));
    expect([...kinds].sort()).toEqual(["city", "crickets", "crowd", "hotwind", "hum", "breeze", "wind"].sort());
    expect(ambienceFor("stade")).toBe("crowd");
    expect(ambienceFor("neige")).toBe("wind");
    expect(ambienceFor("alpin")).toBe("wind");
    expect(ambienceFor("campagne")).toBe("crickets");
    expect(ambienceFor("ville")).toBe("city");
    expect(ambienceFor("canyon")).toBe("hotwind");
    expect(ambienceFor("nuit")).toBe("hum");
  });
  it("chaque recette produit du son (bruit ou notes), discret, et la vitesse la couvre peu à peu", () => {
    for (const kind of AMBIENCE_KINDS) {
      const r = AMBIENCE[kind];
      expect(r.noise || r.tones?.length).toBeTruthy();
      expect(r.level).toBeGreaterThan(0);
      expect(r.level).toBeLessThanOrEqual(0.2);
      expect(ambienceLevel(kind, 0)).toBe(r.level);
      expect(ambienceLevel(kind, 48)).toBeLessThan(ambienceLevel(kind, 10));
      expect(ambienceLevel(kind, 90)).toBeGreaterThan(0);
    }
  });
});

describe("ambiance de lumière par thème (lot 23)", () => {
  it("chaque palette a son ambiance ; seuls les thèmes sombres ont des phares, et les halos sont forts la nuit", () => {
    for (const name of Object.keys(PALETTE_DEFS)) expect(LOOKS[name as keyof typeof LOOKS]).toBeTruthy();
    expect(LOOKS.nuit.headlights).toBeGreaterThan(0);
    expect(LOOKS.neon.headlights).toBeGreaterThan(0);
    for (const day of ["stade", "desert", "neige", "campagne", "canyon", "alpin", "ville"] as const) expect(LOOKS[day].headlights).toBe(0);
    for (const day of ["stade", "desert", "neige", "campagne", "canyon", "alpin", "ville"] as const) expect(LOOKS.nuit.halo).toBeGreaterThan(LOOKS[day].halo);
  });
  it("la brume est un trait du thème : voile de ville et jour blanc plus denses que l'air limpide du col", () => {
    expect(LOOKS.ville.haze).toBeGreaterThan(LOOKS.alpin.haze);
    expect(LOOKS.neige.haze).toBeGreaterThan(LOOKS.alpin.haze);
    expect(LOOKS.stade.haze).toBeLessThan(1);
  });
});

describe("panneaux de direction (lot 23)", () => {
  const track = (text: string) => parseTrack("essai", text);

  it("un virage à gauche est annoncé par un panneau « gauche » planté à droite, avant le virage", () => {
    const t = track("S@start S S S L S S@finish");
    const signs = signsFor(t);
    expect(signs).toHaveLength(1);
    const s = signs[0]!;
    expect(s.kind).toBe("left");
    expect(s.hazard).toBe(4);
    expect(s.block).toBeLessThan(4);
    expect(s.block).toBeGreaterThanOrEqual(1);
    expect(s.side).toBe(-1); // côté extérieur : à droite d'un virage à gauche
    expect(s.offset).toBeGreaterThan(blockHalfWidth(t.blocks[s.block]!, s.q));
    expect(s.offset).toBeLessThan(CELL / 2);
  });
  it("virage à droite : panneau à gauche ; serré = 3 chevrons, large = 2, ample = 1", () => {
    const tight = signsFor(track("S@start S S S R S S@finish"))[0]!;
    expect(tight.kind).toBe("right");
    expect(tight.side).toBe(1);
    expect(tight.severity).toBe(3);
    const wide = signsFor(track("S@start S S S R2 S S S@finish"))[0]!;
    expect(wide.severity).toBe(2);
  });
  it("un saut et une cuve ont leur panneau", () => {
    const jump = signsFor(track("S@start S S S K S S S S@finish"));
    expect(jump.map((s) => s.kind)).toEqual(["jump"]);
    const cuve = signsFor(track("S@start S S S V S S S@finish"));
    expect(cuve.map((s) => s.kind)).toEqual(["cuve"]);
    expect(cuve[0]!.cuve).toBe(3); // les deux parois
  });
  it("pas de panneau au départ, ni sur un bloc sans rebord, ni deux sur le même bloc", () => {
    const early = signsFor(track("S@start L S S@finish"));
    expect(early).toHaveLength(0); // aucun bloc droit entre le départ et le virage
    for (let d = 0; d < 8; d++) {
      const c = dailyCircuit(daysFromCivil(2026, 10, 6) + d);
      const signs = signsFor(c.track);
      const hosts = signs.map((s) => s.block);
      expect(new Set(hosts).size).toBe(hosts.length);
      for (const s of signs) {
        const host = c.track.blocks[s.block]!;
        expect(host.open).toBe(false);
        expect(s.block).toBeLessThan(s.hazard);
        expect(s.hazard - s.block).toBeLessThanOrEqual(3);
        expect(s.block).toBeGreaterThan(0);
      }
    }
  }, 120_000);
  it("sur 30 dates et les huit thèmes : chaque virage serré est annoncé quand un bloc droit le précède", () => {
    let tight = 0;
    let announced = 0;
    const from = daysFromCivil(2026, 10, 6);
    const themes = new Set<string>();
    for (let d = 0; d < 30; d++) {
      const c = dailyCircuit(from + d);
      themes.add(themeForDay(from + d).name);
      const signed = new Set(signsFor(c.track).map((s) => s.hazard));
      for (const b of c.track.blocks) {
        if (b.kind !== "curveL" && b.kind !== "curveR") continue;
        const prev = c.track.blocks[b.index - 1];
        if (!prev || hazardOf(prev) || prev.open || prev.cuve) continue;
        tight++;
        if (signed.has(b.index)) announced++;
      }
    }
    expect(tight).toBeGreaterThan(15);
    expect(announced / tight).toBeGreaterThan(0.85);
    expect(themes.size).toBeGreaterThanOrEqual(7);
  }, 240_000);
  it("chaque type de panneau a sa couleur : jaune ample, orange large, rouge serré, bleu cuve, orange saut", () => {
    expect(signStyleOf("left", 1)).toBe("yellow");
    expect(signStyleOf("right", 2)).toBe("orange");
    expect(signStyleOf("left", 3)).toBe("red");
    expect(signStyleOf("cuve", 1)).toBe("blue");
    expect(signStyleOf("jump", 1)).toBe("orange");
  });
});
