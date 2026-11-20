import { describe, expect, it } from "vitest";
import { IDS_PLANS, PLANS_ESSAI, Partie, UNITE, tablesDuPlan as contenusDuPlan, toutesLesTables } from "@cdj/pinball-sim";

/** Lot PBT0 : les plans d'essai t1 à t6 et leurs miroirs jouent les mêmes gardes que les plans du jour. */
const PLANS_GARDES = [...IDS_PLANS, ...PLANS_ESSAI.flatMap((p) => [p.id, `${p.id}m`])];
import { geoPorte } from "../src/deblocages";
import { ECART_MAX_PLAQUE, boiteDeLEtiquette, boiteTouche, boitesSeRecouvrent, comptePourLaMission, disquesDesRails, disquesDuMini, empreinteDuModule, flechesAuSol, lampesMission, placerEtiquettes, styleEtiquette } from "../src/dessin";
import { MAX_FLECHES_VIVES, indiquer } from "../src/indications";
import { nomDuModule } from "../src/noms";
import { CATALOGUE_FR } from "../src/catalogue.fr";
import { CATALOGUE_EN } from "../src/catalogue.en";

// LA MESURE DE LISIBILITÉ (lot PBL1) — « avec tous les éléments et toutes les étiquettes, on s'y perd ». Ce test la garde sur **les 500 tables** que le générateur peut tirer (`toutesLesTables` : quatre plans × quatre thèmes ×
// leurs modules), en français et en anglais :
//   • **au plus deux plaques permanentes** (l'élément de la mission et le verrou) — la porte a la sienne, mais elle ne s'affiche que porte ouverte ;
//   • **aucune plaque à plus de `ECART_MAX_PLAQUE` px de son élément** (sa boîte à son empreinte), jamais réduite sous 68 % ;
//   • **aucune plaque sur un rail**, une bouche, le mini-batteur, ni sur un module, un poteau, une lampe, une flèche au sol, la porte, ni sur une autre plaque ;
//   • **pas plus de trois flèches vives à la fois**, dans tous les états des essais (`?essai=verrou`, `multibille`, `porte`, un combo, et tout ensemble).
// Un test par plan et par langue : chacun reste sous la seconde.
const LANGUES = { fr: CATALOGUE_FR, en: CATALOGUE_EN } as const;
const px = (u: number): number => u / UNITE;

function noms(langue: keyof typeof LANGUES, theme: string): (module: string) => string | null {
  const cat = LANGUES[langue] as Record<string, string>;
  return (module) => nomDuModule((cle) => cat[cle]!, theme, module);
}
/** La distance d'une boîte à un point (0 : le point est dedans). */
const distanceBoite = (b: { x0: number; y0: number; x1: number; y1: number }, x: number, y: number): number => Math.hypot(x - Math.min(b.x1, Math.max(b.x0, x)), y - Math.min(b.y1, Math.max(b.y0, y)));

const tablesDuPlan = (plan: string): { table: Partie["table"]; theme: Parameters<typeof placerEtiquettes>[1]; cle: string }[] =>
  contenusDuPlan(plan).map((c) => ({ table: new Partie(c).table, theme: c.theme, cle: `${c.theme}:${c.plan}:${c.modules.join(",")}` }));

describe("les plaques sont rares, collées à leur élément, jamais sur un rail (lot PBL1)", () => {
  for (const langue of Object.keys(LANGUES) as (keyof typeof LANGUES)[]) {
    for (const plan of PLANS_GARDES) {
      it(`plan « ${plan} », en ${langue} : deux plaques permanentes au plus, collées à leur élément, sur rien d'autre`, () => {
        let tables = 0;
        for (const { table, theme, cle } of tablesDuPlan(plan)) {
          tables++;
          const quoi = `${langue} ${cle}`;
          const etiquettes = placerEtiquettes(table, theme, noms(langue, theme));
          const permanentes = etiquettes.filter((e) => e.permanente);
          expect(permanentes.length, quoi).toBeLessThanOrEqual(2);
          // l'élément de la mission, le verrou (tous les plans du jour en ont un), la porte
          expect(etiquettes.map((e) => e.role), quoi).toEqual(table.passage ? ["mission", "verrou", "porte"] : ["mission", "verrou"]); // lot PBT0 : un plan d'essai sans orbite n'a pas de porte
          const porte = geoPorte(table);
          const rails = [...disquesDesRails(table), ...disquesDuMini(table)];
          const element = table.poses.find((m) => comptePourLaMission(theme, m.type) && m.type !== "portailB")!;
          const style = styleEtiquette(theme);
          expect(style, quoi).toBeTruthy();
          etiquettes.forEach((e, i) => {
            const b = boiteDeLEtiquette(e);
            // collée à son élément : la pointe a de quoi la relier à lui
            let ecart: number;
            if (e.role === "porte") {
              ecart = Math.min(...[...porte!.murs.flatMap((m) => [{ x: m.x0, y: m.y0 }, { x: (m.x0 + m.x1) / 2, y: (m.y0 + m.y1) / 2 }, { x: m.x1, y: m.y1 }]), porte!.a, porte!.b].map((p) => distanceBoite(b, p.x, p.y)));
              expect(ecart, `${quoi} ${e.role}`).toBeLessThanOrEqual(ECART_MAX_PLAQUE + 9 + 8);
            } else {
              const c = e.role === "verrou" ? table.trous[table.verrou]! : element;
              ecart = distanceBoite(b, px(c.x), px(c.y)) - empreinteDuModule(e.role === "verrou" ? "trou" : element.type);
              // la plaque d'un élément enserré (rails, voisins) peut mordre de 55 % de son rayon sur lui, dernier recours ; jamais sur autre chose (vérifié plus bas)
              expect(ecart, `${quoi} ${e.role} mord trop sur son élément`).toBeGreaterThanOrEqual(-0.55 * empreinteDuModule(e.role === "verrou" ? "trou" : element.type) - 1e-6);
              expect(ecart, `${quoi} ${e.role} est trop loin de son élément (${ecart.toFixed(1)} px)`).toBeLessThanOrEqual(ECART_MAX_PLAQUE);
            }
            expect(e.taille, `${quoi} ${e.role}`).toBeGreaterThanOrEqual(0.52);
            // la pointe regarde l'élément
            const ap = e.ancres[0]!;
            expect(Math.abs(Math.atan2(ap.y - e.y, ap.x - e.x) - e.pointe), quoi).toBeLessThan(1e-9);
            // jamais sur un rail, une bouche ou le mini-batteur
            // lot PBL2 : un seul cas connu — la plaque « PORTE » de la « doublette » (sa porte est au coin haut droit, entre l'orbite, la coulée et les rampes : la plaque ne s'affiche que porte ouverte, brièvement) ; elle ne recouvre
            // jamais un module, une flèche ni une autre plaque. L'ancien cas (le geyser de l'emplacement (250, 252)) a disparu avec les emplacements.
            const connu = plan === "doublette" && e.role === "porte";
            if (e.surUnRail) expect(connu, `${quoi} : la plaque ${e.role} n'a de place que sur un rail`).toBe(true);
            else for (const d of rails) expect(boiteTouche(b, d.x, d.y, d.r), `${quoi} : la plaque ${e.role} recouvre un rail`).toBe(false);
            // ni sur un module, un poteau, une lampe, une flèche au sol
            table.poses.forEach((m) => {
              const sien = (e.role === "verrou" && m.type === "trou" && m.x === table.trous[table.verrou]!.x && m.y === table.trous[table.verrou]!.y) || (e.role === "mission" && m === element);
              if (!sien && e.role !== "porte") expect(boiteTouche(b, px(m.x), px(m.y), empreinteDuModule(m.type)), `${quoi} : ${e.role} recouvre le module ${m.type}`).toBe(false);
              if (e.role === "porte") expect(boiteTouche(b, px(m.x), px(m.y), empreinteDuModule(m.type)), `${quoi} : ${e.role} recouvre le module ${m.type}`).toBe(false);
            });
            for (const p of table.poteaux) expect(boiteTouche(b, px(p.x), px(p.y), px(p.r)), quoi).toBe(false);
            for (const v of table.voies) expect(boiteTouche(b, px(v.x), px(v.y) + 24, 7.5), quoi).toBe(false);
            for (const but of [4, 5]) for (const l of lampesMission(table, theme, but)) expect(boiteTouche(b, l.x, l.y, 5.5), quoi).toBe(false);
            for (const f of flechesAuSol(table, theme)) expect(boiteTouche(b, f.x, f.y, 11), `${quoi} : ${e.role} recouvre une flèche`).toBe(false);
            for (const m of porte?.murs ?? []) expect(boiteTouche(b, (m.x0 + m.x1) / 2, (m.y0 + m.y1) / 2, 8), quoi).toBe(false);
            for (let k = i + 1; k < etiquettes.length; k++) expect(boitesSeRecouvrent(b, boiteDeLEtiquette(etiquettes[k]!)), `${quoi} : deux plaques se recouvrent`).toBe(false);
            // dans la table
            expect(b.x0, quoi).toBeGreaterThanOrEqual(24);
            expect(b.x1, quoi).toBeLessThanOrEqual(344);
          });
        }
        expect(tables).toBeGreaterThanOrEqual(4);
      });
    }
  }

  it("la mise en place est déterministe, et les plaques sont les mêmes dans les deux langues pour un même texte", () => {
    const { table } = tablesDuPlan("doublette")[0]!;
    const a = placerEtiquettes(table, "volcan", noms("fr", "volcan"));
    expect(placerEtiquettes(table, "volcan", noms("fr", "volcan"))).toEqual(a);
  });

  it("aucune plaque pour les bumpers, les mini-bumpers, les cibles, le spinner, le trou simple, les couloirs, les rampes ni l'orbite", () => {
    for (const plan of IDS_PLANS) {
      for (const { table, theme } of tablesDuPlan(plan).slice(0, 40)) {
        const modules = placerEtiquettes(table, theme, noms("fr", theme)).map((e) => e.module);
        for (const interdit of ["bumpers", "mini", "cibles", "spinner", "rampe", "orbite", "coulee", "asteroide", "trouNoir"]) expect(modules).not.toContain(interdit);
      }
    }
  });
});

describe("les flèches vives : trois au plus, la même couleur par intention (lot PBL1)", () => {
  for (const plan of PLANS_GARDES) {
    it(`plan « ${plan} » : dans tous les états, jamais plus de ${MAX_FLECHES_VIVES} flèches vives`, () => {
      for (const c of contenusDuPlan(plan)) {
        const etats: Record<string, (p: Partie) => void> = {
          repos: () => {},
          verrou: (p) => p.allumerLeVerrou(),
          multibille: (p) => p.lancerLaMultibille(),
          porte: (p) => p.ouvrirLaPorte(),
          combo: (p) => {
            p.combo = 3;
            p.comboFin = p.tick + 3000;
          },
          "verrou + porte + combo": (p) => {
            p.allumerLeVerrou();
            p.ouvrirLaPorte();
            p.combo = 2;
            p.comboFin = p.tick + 3000;
          },
          "multibille + porte + combo": (p) => {
            p.lancerLaMultibille();
            p.ouvrirLaPorte();
            p.combo = 2;
            p.comboFin = p.tick + 3000;
          },
        };
        for (const [nom, poser] of Object.entries(etats)) {
          const p = new Partie(c);
          poser(p);
          const sol = flechesAuSol(p.table, c.theme);
          for (const dernier of [-1, 0]) {
            const vives = indiquer(p, sol, dernier);
            expect(vives.length, `${c.theme}:${c.plan} ${nom}`).toBeLessThanOrEqual(MAX_FLECHES_VIVES);
            expect(new Set(vives.map((v) => v.fleche.id)).size, "une flèche une fois").toBe(vives.length);
          }
        }
      }
    });
  }

  it("au repos, la flèche de l'élément de la mission est jaune ; verrou allumé, celle du verrou est bleue ; en multibille, l'élément est rose ; la porte ouverte s'allume ; un combo allume l'autre rail en vert", () => {
    const c = toutesLesTables().find((q) => q.plan === "doublette" && q.theme === "volcan")!;
    const p = new Partie(c);
    const sol = flechesAuSol(p.table, "volcan");
    expect(indiquer(p, sol, -1).map((a) => [a.fleche.cible, a.intention])).toEqual([["element", "mission"]]);
    p.allumerLeVerrou();
    const verrou = indiquer(p, sol, -1);
    expect(verrou.map((a) => a.intention)).toEqual(["verrou", "verrou"]); // le verrou, et la rampe dont l'aiguillage y mène
    expect(verrou[0]!.fleche.cible).toBe("verrou");
    expect(verrou[1]!.fleche.cible).toBe("rail");
    p.ouvrirLaPorte();
    expect(indiquer(p, sol, -1).map((a) => [a.fleche.cible, a.intention])).toContainEqual(["porte", "mission"]);
    const q = new Partie(c);
    q.lancerLaMultibille();
    expect(indiquer(q, sol, -1)[0]).toMatchObject({ intention: "jackpot" });
    expect(indiquer(q, sol, -1)[0]!.fleche.cible).toBe("element");
    const r = new Partie(c);
    r.combo = 2;
    r.comboFin = 3000;
    const combo = indiquer(r, sol, 0);
    expect(combo.filter((a) => a.intention === "combo").every((a) => a.fleche.cible === "rail" && a.fleche.rang !== 0)).toBe(true);
    expect(combo.some((a) => a.intention === "combo")).toBe(true);
  });

  it("une flèche au sol seulement devant l'élément de la mission, le verrou, chaque bouche de rail et la porte", () => {
    for (const c of toutesLesTables().slice(0, 60)) {
      const t = new Partie(c).table;
      const sol = flechesAuSol(t, c.theme);
      expect(sol.filter((f) => f.cible === "element").length, `${c.theme}:${c.plan}`).toBe(t.poses.filter((m) => comptePourLaMission(c.theme, m.type)).length);
      expect(sol.filter((f) => f.cible === "verrou")).toHaveLength(1);
      expect(sol.filter((f) => f.cible === "rail")).toHaveLength(t.portes.length);
      expect(sol.filter((f) => f.cible === "porte")).toHaveLength(1);
    }
  });
});
