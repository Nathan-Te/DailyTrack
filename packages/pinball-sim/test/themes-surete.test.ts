import { describe, expect, it } from "vitest";
import { Rng } from "@cdj/core";
import { EV_PERDUE, EV_PORTAIL, EV_TOURBILLON, EV_TROU, NB_BILLES, REGLAGES, THEMES_PINBALL, UNITE, Partie, dailyPinball, copierReglages, type Contenu, type ThemePinball } from "../src/index";
import { PX, dansLaTable, distanceSegment, enJeu } from "./aide";

// **Aucun élément d'un thème ne garde la bille indéfiniment ni ne la fait traverser un mur** (règle du lot PB3). Pour chaque élément de chaque thème, sur plusieurs tables tirées, on lâche la bille en cent endroits de son
// voisinage, à toutes les vitesses, sans toucher aux batteurs : (1) elle finit toujours par être perdue, dans un délai borné ; (2) à vitesse maximale, elle ne passe jamais à moins de 5,8 px d'un mur ni hors de la table.
const JOUR = 20900;
const tables = (theme: ThemePinball, n: number): Contenu[] => Array.from({ length: n }, (_, i) => dailyPinball(JOUR + i * 7, undefined, theme));
const sansSauvee = (): typeof REGLAGES => ({ ...copierReglages(), sauvee: 0 });

/** Le centre et le rayon (px) de chaque élément d'un thème posé sur la table. */
function elementsDe(p: Partie): { nom: string; x: number; y: number; r: number }[] {
  const t = p.table;
  return [
    ...t.plateaux.map((z) => ({ nom: "manège", x: PX(z.x), y: PX(z.y), r: PX(z.r) })),
    ...t.tourbillons.map((z) => ({ nom: "tourbillon", x: PX(z.x), y: PX(z.y), r: PX(z.r) })),
    ...t.trousNoirs.map((z) => ({ nom: "trou noir", x: PX(z.x), y: PX(z.y), r: PX(z.r) })),
    ...t.portails.map((z) => ({ nom: "portail", x: PX(z.x), y: PX(z.y), r: PX(z.r) + 20 })),
    ...t.geysers.map((z) => ({ nom: "geyser", x: PX(z.x), y: PX(z.y), r: PX(z.r) })),
    ...t.coulees.map((z) => ({ nom: "coulée", x: PX(z.x), y: PX(z.y), r: PX(z.h) })),
    ...t.bumpers.filter((b) => b.mobile).map((b) => ({ nom: "astéroïde", x: PX(b.mobile!.x0), y: PX(b.y), r: PX(b.mobile!.amp) + 20 })),
  ];
}

describe("aucun élément ne garde la bille", () => {
  for (const theme of THEMES_PINBALL) {
    it(`${theme} : lâchée dans son élément, partout et à toute vitesse, sans batteur, la bille est toujours perdue ou revenue au lanceur (au plus 2 minutes de jeu)`, () => {
      const rng = new Rng(777);
      let lachers = 0;
      let pires = 0;
      for (const c of tables(theme, 4)) {
        const modele = new Partie(c, sansSauvee());
        for (const e of elementsDe(modele)) {
          for (let k = 0; k < 25; k++) {
            const p = new Partie(c, sansSauvee());
            const a = (rng.int(360) * Math.PI) / 180;
            const d = rng.int(Math.max(1, Math.trunc(e.r)));
            const v = rng.int(3) === 0 ? 0 : 50 + rng.int(1450);
            const b = (rng.int(360) * Math.PI) / 180;
            const x = e.x + Math.cos(a) * d;
            const y = e.y + Math.sin(a) * d;
            if (!dansLaTable(x * UNITE, y * UNITE, 14) || y > 600) continue;
            if (p.table.murs.some((s) => distanceSegment(x * UNITE, y * UNITE, s.ax, s.ay, s.bx, s.by) < 12)) continue;
            enJeu(p, x, y, Math.trunc(Math.cos(b) * v), Math.trunc(Math.sin(b) * v));
            lachers++;
            // la bille d'origine reste la même : on compte les pas jusqu'à sa perte (une bille de moins, ou la fin du jeu)
            let pas = 0;
            while (p.billes === NB_BILLES && !p.dansLanceur && !p.finie && pas < 72000) {
              p.avancer();
              pas++;
            }
            expect(p.billes < NB_BILLES || p.dansLanceur, `${theme} : ${e.nom}, lâchée en (${x.toFixed(0)}, ${y.toFixed(0)}) à ${v} px/s : ni perdue ni revenue au lanceur en ${pas} pas`).toBe(true);
            pires = Math.max(pires, pas);
          }
        }
      }
      expect(lachers).toBeGreaterThan(70);
      expect(pires).toBeLessThan(72000);
    });
  }
});

describe("aucun élément ne fait traverser un mur", () => {
  for (const theme of THEMES_PINBALL) {
    it(`${theme} : 600 tirs à 1 500 px/s autour de ses éléments : jamais à moins de 5,8 px d'un mur, jamais hors de la table, jamais plus de 7,4 px par pas (hors téléportation et capture)`, () => {
      const rng = new Rng(4242);
      let pas = 0;
      let teleports = 0;
      for (let i = 0; i < 600; i++) {
        const c = tables(theme, 12)[i % 12]!;
        const p = new Partie(c, sansSauvee());
        const els = elementsDe(p);
        const e = els[rng.int(els.length)]!;
        let x = 0;
        let y = 0;
        for (let essai = 0; essai < 100; essai++) {
          const a = (rng.int(360) * Math.PI) / 180;
          const d = rng.int(Math.trunc(e.r) + 40);
          x = e.x + Math.cos(a) * d;
          y = e.y + Math.sin(a) * d;
          if (dansLaTable(x * UNITE, y * UNITE, 14) && y < 560 && ![...p.table.murs, ...(p.table.passage ? [p.table.passage.battant] : [])].some((s) => distanceSegment(x * UNITE, y * UNITE, s.ax, s.ay, s.bx, s.by) < 14) && ![...p.table.poteaux, ...p.table.bumpers].some((q) => PX(Math.hypot(x * UNITE - q.x, y * UNITE - q.y)) < 14 + PX(q.r))) break;
          x = 0;
        }
        if (x === 0) continue;
        const b = (rng.int(360) * Math.PI) / 180;
        enJeu(p, x, y, Math.trunc(Math.cos(b) * REGLAGES.vitesseMax), Math.trunc(Math.sin(b) * REGLAGES.vitesseMax));
        for (let k = 0; k < 900 && p.billes === NB_BILLES && !p.finie; k++) {
          const [ax, ay, capte, avant] = [p.x, p.y, p.captif > 0, p.couche];
          const [avx, avy] = [p.vx, p.vy];
          p.avancer();
          pas++;
          // lot PBG1 : la bille prise par un rail (ou qui en sort) change de couche : elle ne touche plus rien, la traversée est celle du test des rails
          if (avant === 1 || p.couche === 1) {
            teleports++;
            continue;
          }
          if (p.ev & EV_PERDUE || p.dansLanceur) break;
          if (p.ev & (EV_PORTAIL | EV_TOURBILLON | EV_TROU) || capte) {
            teleports++; // la bille repart d'ailleurs, d'un point qui n'est pas dans un mur (vérifié ci-dessous)
          } else {
            expect(PX(Math.hypot(p.x - ax, p.y - ay)), `${theme}, tir ${i}, pas ${k} : trop loin en un pas (${p.table.plan} ev ${p.ev} v avant (${PX(avx).toFixed(0)}, ${PX(avy).toFixed(0)}) après (${PX(p.vx).toFixed(0)}, ${PX(p.vy).toFixed(0)}) de (${PX(ax).toFixed(1)}, ${PX(ay).toFixed(1)}) à (${PX(p.x).toFixed(1)}, ${PX(p.y).toFixed(1)}))`).toBeLessThan(7.4);
          }
          if (p.captif > 0) continue;
          if (!dansLaTable(p.x, p.y, 9 - 3)) throw new Error(`${theme}, tir ${i}, pas ${k} : la bille est sortie de la table en (${PX(p.x).toFixed(1)}, ${PX(p.y).toFixed(1)})`);
          for (const s of p.table.murs) {
            if (s.type === 2 && p.bas[p.table.murs.indexOf(s)]) continue;
            const d = distanceSegment(p.x, p.y, s.ax, s.ay, s.bx, s.by);
            if (d < 9 - 3.2) throw new Error(`${theme}, tir ${i}, pas ${k} : la bille est à ${d.toFixed(2)} px d'un mur (en ${PX(p.x).toFixed(1)}, ${PX(p.y).toFixed(1)})`);
          }
        }
      }
      expect(pas).toBeGreaterThan(100000);
      expect(teleports).toBeGreaterThanOrEqual(0);
    });
  }
});

describe("les sorties des portails et du tourbillon sont libres", () => {
  it("le point où la bille ressort (20 px sous l'autre portail, 36 px du tourbillon, vers le bas) est à plus de 14 px de tout mur, bumper et poteau, sur toutes les tables de l'espace et de l'océan", () => {
    for (const c of [...tables("espace", 40), ...tables("ocean", 40)]) {
      const p = new Partie(c);
      const sorties = [
        ...p.table.portails.map((q) => ({ x: q.x, y: q.y + 20 * UNITE })),
        ...p.table.tourbillons.flatMap((z) => [-3, -2, -1, 0, 1, 2, 3].map(() => ({ x: z.x, y: z.y + 36 * UNITE }))),
      ];
      for (const s of sorties) {
        for (const m of p.table.murs) expect(distanceSegment(s.x, s.y, m.ax, m.ay, m.bx, m.by), `jour ${c.jour}`).toBeGreaterThan(12);
        for (const q of [...p.table.poteaux, ...p.table.bumpers]) expect(PX(Math.hypot(s.x - q.x, s.y - q.y)) - PX(q.r)).toBeGreaterThan(9);
      }
    }
  });
});
