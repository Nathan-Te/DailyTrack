import { daysFromCivil } from "@cdj/core";
import { DANGERS_LEVEL, ESSAI_LEVEL, PREMIER_JOUR_JUMP, SANDBOX_LEVEL, TILE_SOLID, buildModule, dailyLevel, isSpikeTile, parseLevel, type Level } from "@cdj/jump-sim";
import { describe, expect, it } from "vitest";
import { AMBIENCES, AMBIENCE_HEADROOM, AmbientScheduler, ambiencePeak, ambienceTarget, quietestGameSoundPeak } from "../src/audioLogic";
import { CORNERS, E, N, NE, NW, S, SE, SW, W, depthMap, neighbourMask, tileShape } from "../src/autotile";
import { contrastRatio, hueDistance, hueOf, luminance } from "../src/contrast";
import {
  DECOR_KEEPOUT,
  DECOR_LITE_SHARE,
  DECOR_PER_COLUMN,
  DECOR_WALL_SHARE,
  DECOR_Z,
  buildDecorArt,
  keepouts,
  nearestKeepout,
  partsBounds,
  placeDecor,
} from "../src/decor";
import { PALETTES, paletteForDay } from "../src/palette";
import { PARALLAX_Z0, buildParallax, layerOffset, visibleLayers } from "../src/parallax";
import { TILE_Z, TRIM_BUMP, buildTileArt, insideTiles } from "../src/tileArt";
import { HAZARD, HAZARD_OUTLINE, PLAYER, THEMES, THEME_NAMES, backdropColors, fillsBelow, solidColors, themeByName, themeForDay, type Theme } from "../src/themes";

const ALL: Theme[] = THEME_NAMES.map((n) => THEMES[n]);
const first = PREMIER_JOUR_JUMP;

describe("themeForDay", () => {
  it("est pur : même jour, même thème ; jamais deux fois de suite le même (2 000 jours)", () => {
    for (let d = first - 1000; d < first + 1000; d++) {
      expect(themeForDay(d)).toBe(themeForDay(d));
      expect(themeForDay(d).name, `jours ${d} et ${d + 1}`).not.toBe(themeForDay(d + 1).name);
    }
  });

  it("se répartit sur les cinq thèmes (120 dates : chacun entre 12 et 36 fois)", () => {
    const count = new Map<string, number>();
    for (let d = first; d < first + 120; d++) count.set(themeForDay(d).name, (count.get(themeForDay(d).name) ?? 0) + 1);
    expect(count.size).toBe(5);
    for (const [name, n] of count) {
      expect(n, name).toBeGreaterThanOrEqual(12);
      expect(n, name).toBeLessThanOrEqual(36);
    }
  });

  it("la palette du jour est celle du thème du jour ; ?theme= lit les noms avec ou sans accent", () => {
    for (let d = first; d < first + 30; d++) expect(paletteForDay(d)).toBe(themeForDay(d).palette);
    expect(PALETTES).toHaveLength(5);
    expect(themeByName("foret")!.name).toBe("foret");
    expect(themeByName("forêt")!.name).toBe("foret");
    expect(themeByName("Néon")!.name).toBe("neon");
    expect(themeByName("lave")).toBeNull();
    expect(themeByName(null)).toBeNull();
  });

  it("le thème ne dépend que de la date : ni identifiant de niveau, ni version (cosmétique)", () => {
    // `themeForDay` ne prend que le numéro du jour ; le niveau d'une date ne lit pas le thème (son identifiant n'en parle pas).
    const L = dailyLevel(daysFromCivil(2026, 10, 20));
    expect(L.id).toBe(`jour-2026-10-20-g4`);
    for (const t of ALL) expect(L.id).not.toContain(t.name);
  });
});

describe("couleurs réservées et contrastes", () => {
  it("dangers et personnage : la même couleur dans tous les thèmes", () => {
    for (const t of ALL) {
      expect(t.palette.hazard).toBe(HAZARD);
      expect(t.palette.player).toBe(PLAYER);
    }
  });

  it("les dangers contrastent ≥ 3:1 avec tout fond possible (ciel, plans, tuiles) et leur cerne", () => {
    for (const t of ALL) {
      for (const c of [...backdropColors(t), ...solidColors(t)]) expect(contrastRatio(HAZARD, c), `${t.name} ${c.toString(16)}`).toBeGreaterThanOrEqual(3);
    }
    expect(contrastRatio(HAZARD, HAZARD_OUTLINE)).toBeGreaterThanOrEqual(3);
  });

  it("le personnage contraste ≥ 3:1 avec le fond (ciel et plans) et avec les tuiles", () => {
    for (const t of ALL) for (const c of [...backdropColors(t), ...solidColors(t)]) expect(contrastRatio(PLAYER, c), `${t.name} ${c.toString(16)}`).toBeGreaterThanOrEqual(3);
  });

  it("les friables se distinguent des pleins (≥ 2,5:1) et ne ressemblent ni à un danger ni au personnage", () => {
    for (const t of ALL) {
      expect(contrastRatio(t.palette.crumble, t.tiles.face), t.name).toBeGreaterThanOrEqual(2.5);
      expect(contrastRatio(t.palette.crumble, t.tiles.deep), t.name).toBeGreaterThanOrEqual(2.5);
      expect(hueDistance(t.palette.crumble, HAZARD), t.name).toBeGreaterThanOrEqual(40);
      // Autre teinte, ou bien moins saturé que le jaune vif du personnage.
      expect(hueDistance(t.palette.crumble, PLAYER) >= 30 || hueOf(t.palette.crumble).chroma < hueOf(PLAYER).chroma * 0.6, t.name).toBe(true);
    }
  });

  it("ressorts et arrivée ne ressemblent ni au personnage ni à un danger", () => {
    for (const t of ALL) {
      for (const c of [t.palette.spring, t.palette.finish]) {
        expect(hueDistance(c, PLAYER) >= 30 || hueOf(c).chroma < 0.3, `${t.name} ${c.toString(16)}`).toBe(true);
        expect(hueDistance(c, HAZARD) >= 30 || hueOf(c).chroma < 0.3, `${t.name} ${c.toString(16)}`).toBe(true);
      }
    }
  });

  it("les plans du fond restent sombres et peu contrastés avec le ciel (≤ 1,6:1) ; leur plein se distingue des tuiles (≥ 1,45:1)", () => {
    for (const t of ALL) {
      for (const c of backdropColors(t)) expect(contrastRatio(c, t.palette.background), `${t.name} ${c.toString(16)}`).toBeLessThanOrEqual(1.6);
      // Le plein d'un plan couvre le bas de l'écran (là où l'on tombe) : jamais de la valeur des tuiles, toujours plus sombre qu'elles.
      for (const l of t.parallax.filter((x) => fillsBelow(x.kind))) {
        expect(contrastRatio(t.tiles.face, l.color), `${t.name} ${l.kind}`).toBeGreaterThanOrEqual(1.45);
        expect(luminance(l.color)).toBeLessThan(luminance(t.tiles.face));
      }
      expect(contrastRatio(t.tiles.face, t.palette.background), t.name).toBeGreaterThanOrEqual(1.6);
    }
  });

  it("calcul : noir et blanc font 21:1, une couleur avec elle-même 1:1", () => {
    expect(contrastRatio(0, 0xffffff)).toBeCloseTo(21, 5);
    expect(contrastRatio(0x336699, 0x336699)).toBe(1);
    expect(hueOf(0xff0000).hue).toBe(0);
    expect(hueDistance(0xff0000, 0x00ffff)).toBe(180);
  });
});

describe("auto-tuilage", () => {
  it("chaque configuration des 8 voisins donne une seule forme, la bonne", () => {
    for (let m = 0; m < 256; m++) {
      const s = tileShape(m);
      const has = (b: number) => (m & b) !== 0;
      expect(s.top).toBe(!has(N));
      expect(s.right).toBe(!has(E));
      expect(s.bottom).toBe(!has(S));
      expect(s.left).toBe(!has(W));
      expect(s.outer).toEqual([!has(N) && !has(W), !has(N) && !has(E), !has(S) && !has(E), !has(S) && !has(W)]);
      expect(s.inner).toEqual([has(N) && has(W) && !has(NW), has(N) && has(E) && !has(NE), has(S) && has(E) && !has(SE), has(S) && has(W) && !has(SW)]);
      // Un coin ne peut pas être à la fois extérieur et intérieur.
      for (const k of CORNERS) expect(s.outer[k] && s.inner[k]).toBe(false);
      expect(s.interior).toBe(m === 255);
    }
    expect(tileShape(0)).toMatchObject({ top: true, right: true, bottom: true, left: true, outer: [true, true, true, true] });
  });

  // Une petite carte : un îlot, un mur, un coin intérieur.
  const MAP = parseLevel(["#S....F", "#..##..", "#..##..", "#......", "###.###", "###.###", "#######"].join("\n") + "\n");

  it("lit les voisins dans la grille ; les bords gauche, droit et haut sont pleins, le dessous est ouvert", () => {
    expect(neighbourMask(MAP, 0, 0) & (N | NW | W)).toBe(N | NW | W);
    // Le bloc (3, 1) : un îlot 2 × 2, coin haut-gauche exposé.
    const s = tileShape(neighbourMask(MAP, 3, 1));
    expect(s.top && s.left && s.outer[0]).toBe(true);
    expect(s.right).toBe(false);
    // Coin intérieur : (2, 5) a au-dessus (2, 4) et à droite (3, 5)… vide ; (2, 6) a (2, 5) au-dessus et (3, 6) à droite, (3, 5) vide.
    expect(tileShape(neighbourMask(MAP, 2, 6)).inner[1]).toBe(true);
    // La dernière rangée touche le dessous de la grille : face du dessous exposée.
    expect(tileShape(neighbourMask(MAP, 1, 6)).bottom).toBe(true);
  });

  it("profondeur : 0 au bord, de plus en plus loin dedans, −1 dans le vide", () => {
    const L = parseLevel(["#########", "#########", "#########", "#########", "....S...F", "#########"].join("\n") + "\n");
    const d = depthMap(L);
    expect(d[4 * L.width]).toBe(-1);
    expect(d[3 * L.width + 4]).toBe(0);
    expect(d[2 * L.width + 4]).toBe(1);
    expect(d[0 * L.width + 4]).toBe(3);
  });

  it("le dessin reste dans les tuiles (bosses ≤ 0,1 tuile au-dessus d'une face), fusionné par tronçons de 32 colonnes", () => {
    for (const level of [ESSAI_LEVEL, DANGERS_LEVEL, SANDBOX_LEVEL]) {
      for (const t of ALL) {
        const art = buildTileArt(level, t.tiles);
        expect(art.chunks.length).toBe(Math.ceil(level.width / 32));
        for (const c of art.chunks) expect(insideTiles(level, c.art, TRIM_BUMP), `${t.name} ${c.col0}`).toBe(true);
        expect(art.tiles).toBe(level.tiles.filter((x) => x === TILE_SOLID).length);
      }
    }
  });

  it("une face qui porte un pic n'a ni contour ni garniture ; toutes les profondeurs de dessin sont sous les dangers", () => {
    const L = parseLevel(["#S..F", "#.^..", "#####"].join("\n") + "\n");
    const art = buildTileArt(L, THEMES.foret.tiles);
    expect(art.hazardFaces).toBe(1);
    // Rien de la tuile sous le pic (colonne 2) ne dépasse sa face du dessus.
    const a = art.chunks[0]!.art;
    for (let i = 0; i < a.pos.length; i += 3) if (a.pos[i]! > 2 && a.pos[i]! < 3) expect(a.pos[i + 1]!).toBeLessThanOrEqual(-2 + 1e-9);
    for (const z of Object.values(TILE_Z)) expect(z).toBeLessThan(0.05);
  });
});

/** Les niveaux de contrôle du décor : les trois niveaux écrits, deux morceaux, deux niveaux du jour. */
const LEVELS: { id: string; level: Level }[] = [
  { id: "essai", level: ESSAI_LEVEL },
  { id: "dangers", level: DANGERS_LEVEL },
  { id: "bac-a-sable", level: SANDBOX_LEVEL },
  { id: "module:cheminee:0", level: buildModule("cheminee", 0).level },
  { id: "module:scies-jumelles:0", level: buildModule("scies-jumelles", 0).level },
  ...[daysFromCivil(2026, 10, 20), daysFromCivil(2026, 11, 2)].map((d) => {
    const L = dailyLevel(d);
    return { id: L.id, level: L.level };
  }),
];

describe("décor", () => {
  it("aucune forme pointue ni dentée, jamais au plafond, jamais de la teinte des dangers", () => {
    for (const t of ALL) {
      for (const k of t.decor) {
        expect(["dessus", "mur", "fond"]).toContain(k.anchor);
        for (const p of k.parts) {
          expect(["rect", "disque", "demi"]).toContain(p.shape);
          expect(hueDistance(p.color, HAZARD) >= 40 || hueOf(p.color).chroma < 0.3, `${t.name}/${k.id} ${p.color.toString(16)}`).toBe(true);
        }
        // Le décor « fond » reste dans les tons du fond.
        if (k.anchor === "fond") for (const p of k.parts) expect(contrastRatio(p.color, t.palette.background), `${t.name}/${k.id}`).toBeLessThanOrEqual(1.6);
        // Un décor de mur part du mur (rien ne mord dans la tuile : sinon il serait toujours refusé).
        if (k.anchor === "mur") expect(partsBounds(k.parts).x0, `${t.name}/${k.id}`).toBeGreaterThanOrEqual(0);
      }
      // Au moins un décor de face par thème, et un décor du fond.
      expect(t.decor.some((k) => k.anchor === "dessus")).toBe(true);
      expect(t.decor.some((k) => k.anchor === "fond")).toBe(true);
    }
  });

  it("chaque décor du thème sort sur le niveau d'essai et sur un niveau du jour", () => {
    for (const t of ALL) {
      const seen = new Set<string>();
      for (const { id, level } of [LEVELS[0]!, LEVELS[5]!]) for (const it of placeDecor(level, t, id)) seen.add(t.decor[it.kind]!.id);
      expect([...seen].sort(), t.name).toEqual(t.decor.map((k) => k.id).sort());
    }
  });

  it("déterministe : même niveau, même identifiant, même thème → mêmes décors ; un autre thème en pose d'autres", () => {
    const a = placeDecor(ESSAI_LEVEL, THEMES.foret, "essai");
    expect(placeDecor(ESSAI_LEVEL, THEMES.foret, "essai")).toEqual(a);
    expect(a.length).toBeGreaterThan(5);
    expect(placeDecor(ESSAI_LEVEL, THEMES.usine, "essai")).not.toEqual(a);
    expect(placeDecor(ESSAI_LEVEL, THEMES.foret, "autre")).not.toEqual(a);
  });

  it("rien à moins de 1,5 tuile d'un danger, d'un ressort, d'un fanion, du départ ou de l'arrivée ; densité plafonnée", () => {
    for (const { id, level } of LEVELS) {
      const list = keepouts(level);
      for (const t of ALL) {
        const items = placeDecor(level, t, id, list);
        expect(items.length, `${id} ${t.name}`).toBeLessThanOrEqual(Math.floor(level.width * DECOR_PER_COLUMN));
        expect(items.filter((i) => i.anchor === "mur").length).toBeLessThanOrEqual(Math.floor(Math.floor(level.width * DECOR_PER_COLUMN) * DECOR_WALL_SHARE));
        for (const it of items) expect(nearestKeepout(it.box, list), `${id} ${t.name} ${it.x},${it.y}`).toBeGreaterThanOrEqual(DECOR_KEEPOUT);
        // Effets réduits : la moitié (arrondie au-dessus), les premiers tirés.
        const lite = items.filter((i) => i.lite).length;
        expect(lite).toBe(Math.ceil(items.length * DECOR_LITE_SHARE));
        items.forEach((it, k) => expect(it.lite).toBe(k < lite));
        // Un décor de face ne déborde jamais sur une tuile : sa boîte est dans des cases vides.
        for (const it of items) {
          if (it.anchor === "fond") continue;
          for (let r = Math.floor(it.box.y0 + 1e-6); r <= Math.floor(it.box.y1 - 1e-6); r++) {
            for (let c = Math.floor(it.box.x0 + 1e-6); c <= Math.floor(it.box.x1 - 1e-6); c++) {
              const tile = level.tiles[r * level.width + c]!;
              expect(tile, `${id} ${t.name} (${c}, ${r})`).toBe(0);
              expect(isSpikeTile(tile)).toBe(false);
            }
          }
        }
      }
    }
  });

  it("les pics, les scies (tout leur trajet), les ressorts, les fanions et l'arrivée sont bien dans la liste à éviter", () => {
    const kinds = new Set(keepouts(DANGERS_LEVEL).map((k) => k.kind));
    for (const k of ["pic", "scie", "ressort", "depart", "arrivee"]) expect(kinds.has(k as never), k).toBe(true);
    expect(keepouts(ESSAI_LEVEL).some((k) => k.kind === "fanion")).toBe(true);
    // Une scie mobile : son trajet complet est couvert (le décor reste loin de chaque point du parcours).
    const moving = keepouts(DANGERS_LEVEL).find((k) => k.kind === "scie" && (k.path?.length ?? 0) > 1)!;
    expect(moving).toBeTruthy();
    const p = moving.path![1]!;
    expect(nearestKeepout({ x0: p.x, y0: p.y, x1: p.x + 0.1, y1: p.y + 0.1 }, [moving])).toBe(0);
  });

  it("rien au premier plan : le décor se dessine derrière les tuiles, les dangers et le personnage ; les effets réduits n'en gardent que la moitié", () => {
    expect(DECOR_Z.face).toBeLessThan(TILE_Z.base);
    expect(DECOR_Z.fond).toBeLessThan(DECOR_Z.face);
    expect(PARALLAX_Z0 + 2).toBeLessThan(DECOR_Z.fond);
    const items = placeDecor(ESSAI_LEVEL, THEMES.nuit, "essai");
    const chunks = buildDecorArt(THEMES.nuit, items, ESSAI_LEVEL.width, 32);
    let all = 0;
    let lite = 0;
    for (const c of chunks) {
      all += c.art.idx.length;
      lite += c.liteIndices;
      expect(c.liteIndices).toBeLessThanOrEqual(c.art.idx.length);
      for (let i = 2; i < c.art.pos.length; i += 3) expect(c.art.pos[i]!).toBeLessThan(TILE_Z.base);
    }
    expect(lite).toBeGreaterThan(0);
    expect(lite).toBeLessThan(all);
  });
});

describe("parallaxe", () => {
  it("deux ou trois plans par thème, du plus lointain au plus proche, couvrant toute la largeur", () => {
    for (const t of ALL) {
      expect(t.parallax.length).toBeGreaterThanOrEqual(2);
      expect(t.parallax.length).toBeLessThanOrEqual(3);
      for (let i = 1; i < t.parallax.length; i++) expect(t.parallax[i]!.factor).toBeGreaterThanOrEqual(t.parallax[i - 1]!.factor);
      const layers = buildParallax(t, ESSAI_LEVEL.width, "essai");
      expect(layers.map((l) => l.art.triangles > 0)).toEqual(t.parallax.map(() => true));
      expect(buildParallax(t, ESSAI_LEVEL.width, "essai").map((l) => l.art.pos)).toEqual(layers.map((l) => l.art.pos));
    }
  });

  it("chaque plan défile à son facteur ; figé avec le mouvement réduit ; un seul plan avec les effets réduits", () => {
    const layer = THEMES.foret.parallax[1]!;
    const a = layerOffset(layer, 10, -20, -20);
    const b = layerOffset(layer, 20, -20, -20);
    // La caméra avance de 10 : le plan, vu à l'écran, recule de 10 × facteur.
    expect(b.x - 20 - (a.x - 10)).toBeCloseTo(-10 * layer.factor, 9);
    const still = [layerOffset(layer, 10, -20, -20, 0), layerOffset(layer, 50, -30, -20, 0)];
    expect(still[0]!.x - 10).toBeCloseTo(still[1]!.x - 50, 9);
    expect(still[0]!.y + 20).toBeCloseTo(still[1]!.y + 30, 9);
    expect(visibleLayers(3, false)).toBe(3);
    expect(visibleLayers(3, true)).toBe(1);
  });
});

describe("ambiances sonores", () => {
  it("une ambiance par thème, avec nappes et événements, toujours sous les sons de jeu", () => {
    const quiet = quietestGameSoundPeak();
    expect(quiet).toBeGreaterThan(0.05);
    for (const t of ALL) {
      const spec = AMBIENCES[t.ambience];
      expect(spec.beds.length).toBeGreaterThan(0);
      expect(spec.events.length).toBeGreaterThan(0);
      expect(ambiencePeak(spec), t.name).toBeLessThanOrEqual(AMBIENCE_HEADROOM * quiet);
      for (const e of spec.events) expect(e.every[0]).toBeGreaterThan(0.5);
    }
    expect(new Set(ALL.map((t) => AMBIENCES[t.ambience].label)).size).toBe(5);
  });

  it("le volume suit le curseur « ambiance » (au carré) et se coupe onglet caché", () => {
    expect(ambienceTarget(1, false)).toBe(1);
    expect(ambienceTarget(0.5, false)).toBeCloseTo(0.25, 9);
    expect(ambienceTarget(0, false)).toBe(0);
    expect(ambienceTarget(1, true)).toBe(0);
  });

  it("calendrier des événements : déterministe, espacé comme demandé, sans rattrapage après une absence", () => {
    const spec = AMBIENCES.foret;
    const run = (seed: number) => {
      const s = new AmbientScheduler(spec, seed);
      const out: { index: number; at: number }[] = [];
      for (let t = 0; t <= 120; t += 0.1) out.push(...s.due(t));
      return out;
    };
    const a = run(42);
    expect(run(42)).toEqual(a);
    expect(run(43)).not.toEqual(a);
    for (let i = 0; i < spec.events.length; i++) {
      const times = a.filter((e) => e.index === i).map((e) => e.at);
      expect(times.length).toBeGreaterThan(5);
      expect(times[0]!).toBeGreaterThanOrEqual(spec.events[i]!.every[0]);
      for (let k = 1; k < times.length; k++) {
        expect(times[k]! - times[k - 1]!).toBeGreaterThanOrEqual(spec.events[i]!.every[0] - 1e-9);
        expect(times[k]! - times[k - 1]!).toBeLessThanOrEqual(spec.events[i]!.every[1] + 0.11);
      }
    }
    const s = new AmbientScheduler(spec, 1);
    expect(s.due(1000).length).toBeLessThanOrEqual(spec.events.length);
  });
});
