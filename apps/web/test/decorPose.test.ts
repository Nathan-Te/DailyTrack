import { describe, expect, it } from "vitest";
import { FALL_DEPTH, FIGURES_LOT49, THEMES, createFigureTrack, figureByName, parseTrack, type ThemeName } from "@cdj/sim";
import { PoseLog, ROLES, type Pose } from "../src/decorPose";
import { trackGeometry } from "../src/scene/existant";
import { circuitsDuTest, compter, inventaire, relever, releverP1, verifier, type Circuit, type Faute, } from "./decorChecks";

// Lot 37 : règles de pose du décor (apps/web/CLAUDE.md, « Décor : règles de pose »), vérifiées sans rendu sur 64 circuits : les jours du 13/10 au
// 15/12/2026, chaque thème imposé 8 fois. `DECOR_RAPPORT=1 npx vitest run apps/web/test/decorPose.test.ts` imprime les fautes par type et par thème
// (c'est ce qui a chiffré `main` : voir docs/lots/lot-37-decor-propre.md).

const THEMES_NOMS = Object.keys(THEMES) as ThemeName[];

describe("l'outil de vérification lui-même", () => {
  const track = parseTrack("pose-test", "S/n@start S S L2 S S R S S@finish");
  const sol = track.voidY - FALL_DEPTH;
  const base: Pose = { kind: "decor", part: "pied", appui: "sol", group: 1, x0: -400, y0: sol, z0: -400, x1: -398, y1: sol + 3, z1: -398, tris: 12, block: -1, style: "test" };
  const circuit: Circuit = { jour: "test", theme: "stade", palette: "stade", track };

  it("accepte un élément posé au sol, loin de la route", () => {
    expect(verifier(circuit, [base])).toEqual([]);
  });
  it("refuse un élément qui flotte au-dessus du sol", () => {
    expect(verifier(circuit, [{ ...base, y0: sol + 1.2 }]).map((f) => f.regle)).toEqual(["vide"]);
  });
  it("refuse un élément posé sur la route", () => {
    const b = track.blocks[1]!;
    const x = b.cx * 32 + 16;
    const z = b.cz * 32 + 16;
    const fautes = verifier(circuit, [{ ...base, x0: x - 1, x1: x + 1, z0: z - 1, z1: z + 1 }]);
    expect(fautes.some((f) => f.regle === "passage")).toBe(true);
  });
  it("refuse une poutre trop basse au-dessus de la route, et une poutre sans pied", () => {
    const b = track.blocks[1]!;
    const x = b.cx * 32 + 16;
    const z = b.cz * 32 + 16;
    const poutre: Pose = { ...base, kind: "porte", part: "surplomb", group: 2, x0: x - 8, x1: x + 8, z0: z - 1, z1: z + 1, y0: b.y0 + 3, y1: b.y0 + 4 };
    expect(verifier(circuit, [poutre]).map((f) => f.regle).sort()).toEqual(["passage", "structure"]);
  });
  it("chaque type d'élément a un rôle", () => {
    for (const kind of ["poteau", "panneau", "arche-depart", "arche-arrivee", "arche-vitesse", "porte", "tribune", "decor", "lampadaire"] as const) expect(ROLES[kind]).toBeTruthy();
  });
  it("un relevé ne change pas la construction : mêmes formes avec et sans relevé", () => {
    const sans = trackGeometry(track, "stade", { headless: true });
    const avec = trackGeometry(track, "stade", { headless: true, log: new PoseLog() });
    for (const k of ["g", "speedG", "decorG", "denseG"] as const) expect(avec[k].pos).toEqual(sans[k].pos);
    expect(avec.props.solid.pos).toEqual(sans.props.solid.pos);
  });
});

// Lot 43 : la scène du jeu est le palier 1 (éléments de course, éclairage de piste de la Nuit, sponsors, panneaux de distance, et le décor d'aujourd'hui) ;
// l'ancienne scène, chargée à la demande (vitrine, `?palier=existant`), reste vérifiée.
for (const [scene, releve] of [["palier 1, la scène du jeu", releverP1], ["existant (à la demande)", relever]] as const) {
describe(`pose du décor sur 64 circuits (13/10 → 15/12/2026, chaque thème imposé 8 fois) — ${scene}`, () => {
  const circuits = circuitsDuTest(THEMES_NOMS);
  const toutes: Faute[] = [];
  const parKind: Record<string, { elements: number; tris: number }> = {};
  const parJour: Record<string, number> = {};

  it("au moins 60 circuits, chaque thème au moins 8 fois", () => {
    expect(circuits.length).toBeGreaterThanOrEqual(60);
    for (const t of THEMES_NOMS) expect(circuits.filter((c) => c.theme === t).length).toBeGreaterThanOrEqual(8);
  });

  it("aucune faute : un appui sous chaque pied, rien dans le passage, rien au-dessus du vide", () => {
    for (const c of circuits) {
      const poses = releve(c.track, c.palette);
      for (const [k, v] of Object.entries(inventaire(poses))) {
        parKind[k] ??= { elements: 0, tris: 0 };
        parKind[k]!.elements += v.elements;
        parKind[k]!.tris += v.tris;
      }
      const f = verifier(c, poses);
      parJour[`${c.jour} ${c.theme}`] = f.length;
      toutes.push(...f);
    }
    if (process.env.DECOR_RAPPORT) rapport(toutes, parKind, parJour);
    const resume = Object.entries(compter(toutes)).map(([k, t]) => `${k}: ${JSON.stringify(t)}`);
    const enFaute = Object.values(compter(toutes)).reduce((a, t) => a + Object.values(t).reduce((x, y) => x + y, 0), 0);
    const exemples = toutes.slice(0, 6).map((f) => `${f.jour} ${f.theme} ${f.kind} (bloc ${f.block}) : ${f.regle} — ${f.detail}`);
    expect(enFaute, `${enFaute} éléments en faute (${toutes.length} fautes)\n${resume.join("\n")}\n${exemples.join("\n")}`).toBe(0);
  }, 240_000);
});
}

/** Rapport chiffré (README du lot 37) : fautes par type × thème, par règle, et les jours les plus chargés. */
// Lot 49 : les douze nouvelles figures, chaque variante et son miroir, sur la palette de chacun de leurs thèmes (Stade, Nuit et Canyon pour une figure de
// tous les thèmes) : mêmes règles de pose, sur le palier 1 et l'existant. Les circuits du jour d'après la bascule (v18) sont aussi dans les 64 ci-dessus.
describe("lot 49 : les nouvelles figures se posent (règles du lot 37)", () => {
  const circuits: Circuit[] = [];
  for (const nom of FIGURES_LOT49) {
    const f = figureByName(nom)!;
    for (const theme of (f.only ?? ["stade", "nuit", "canyon"]) as ThemeName[])
      for (let v = 0; v < f.variants; v++)
        for (const miroir of [false, true]) circuits.push({ jour: `${nom} v${v}${miroir ? " miroir" : ""}`, theme, palette: THEMES[theme].palette, track: createFigureTrack(nom, v, miroir)! });
  }
  it("au moins une variante par figure et par thème", () => {
    expect(circuits.length).toBeGreaterThanOrEqual(FIGURES_LOT49.length * 4);
  });
  for (const [scene, releve] of [["palier 1", releverP1], ["existant", relever]] as const) {
    it(`aucune faute (${scene})`, () => {
      const toutes = circuits.flatMap((c) => verifier(c, releve(c.track, c.palette)));
      expect(toutes.slice(0, 6).map((f) => `${f.jour} ${f.theme} ${f.kind} (bloc ${f.block}) : ${f.regle} — ${f.detail}`)).toEqual([]);
    }, 120_000);
  }
});

function rapport(fautes: Faute[], parKind: Record<string, { elements: number; tris: number }>, parJour: Record<string, number>) {
  const lignes: string[] = [];
  const enFaute = Object.values(compter(fautes)).reduce((a, t) => a + Object.values(t).reduce((x, y) => x + y, 0), 0);
  lignes.push(`éléments en faute : ${enFaute} sur ${Object.values(parKind).reduce((a, b) => a + b.elements, 0)} mesurés (${fautes.length} fautes, une structure peut en avoir plusieurs)`);
  const n = THEMES_NOMS.length * 8;
  lignes.push("inventaire par circuit (moyenne sur " + n + ") : " + JSON.stringify(Object.fromEntries(Object.entries(parKind).map(([k, v]) => [k, { elements: +(v.elements / n).toFixed(1), triangles: Math.round(v.tris / n) }]))));
  const ordre = (o: Record<string, number>) => Object.entries(o).sort((a, b) => b[1] - a[1]);
  const regles: Record<string, number> = {};
  const vusRegle = new Set<string>();
  for (const f of fautes) {
    const cle = `${f.jour}|${f.theme}|${f.kind}|${f.group}|${f.regle}`;
    if (vusRegle.has(cle)) continue;
    vusRegle.add(cle);
    regles[`${f.kind}/${f.regle}`] = (regles[`${f.kind}/${f.regle}`] ?? 0) + 1;
  }
  lignes.push("par type et règle : " + JSON.stringify(Object.fromEntries(ordre(regles))));
  lignes.push("par type et thème : " + JSON.stringify(compter(fautes)));
  const vides: Record<string, number> = {};
  const vusVide = new Set<string>();
  for (const f of fautes) {
    const cle = `${f.jour}|${f.kind}|${f.group}`;
    if (f.regle !== "vide" || vusVide.has(cle)) continue;
    vusVide.add(cle);
    vides[`${f.jour} ${f.theme}`] = (vides[`${f.jour} ${f.theme}`] ?? 0) + 1;
  }
  lignes.push("jours avec le plus d'éléments en l'air : " + JSON.stringify(ordre(vides).slice(0, 24)));
  lignes.push("jours les plus chargés (toutes règles) : " + JSON.stringify(ordre(parJour).slice(0, 24)));
  process.stdout.write("\n" + lignes.join("\n") + "\n");
}
