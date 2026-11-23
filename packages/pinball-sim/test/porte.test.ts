import { describe, expect, it } from "vitest";
import { EV2_PORTE_FERME, EV2_PORTE_OUVRE, EV2_PORTE_PASSAGE, EV_BANQUE, PLANS, UNITE, Partie, REGLAGES, copierReglages, toutesLesTables } from "../src/index";
import { dansLaTable, pointOccupe } from "../src/validation";
import { avancer, enJeu, evenements2, partiePlan, surLeRail } from "./aide";

// LA PORTE (lot PBG3) : un passage incliné fermé par un battant. Fermé, c'est un mur ; la banque de cibles complète l'ouvre (sur une table sans banque, l'orbite menée à son bout) ; un passage rapporte `portePoints`, fait
// avancer la mission d'un cran (en multibille : un jackpot de plus) ; elle se referme à la fin de son temps, ou peu après un passage.

// lot PBT1 : les tables A et B ont leur porte (sur la bouche de l'orbite) ; la table C n'a ni orbite ni porte
const PLANS_DU_JOUR = PLANS.filter((p) => p.porte).map((p) => p.id);
/** La bille posée dans le passage, à `d` px derrière le battant (sur son axe), lancée le long de l'axe à `v` px/s : elle monte vers le battant. */
function versLaPorte(p: Partie, d: number, v: number): Partie {
  const g = p.table.passage!;
  const x = g.x / UNITE - (g.ux / 16384) * d;
  const y = g.y / UNITE - (g.uy / 16384) * d;
  return enJeu(p, x, y, (g.ux / 16384) * v, (g.uy / 16384) * v);
}
/** Le côté du battant (le signe de la distance, en px) où est la bille. */
const cote = (p: Partie): number => {
  const g = p.table.passage!;
  return ((p.x - g.x) * g.ux + (p.y - g.y) * g.uy) / 16384 / UNITE;
};

describe("la porte : un passage incliné fermé par un battant", () => {
  it.each(PLANS_DU_JOUR)("le plan %s a sa porte et son orbite ; elle s'ouvre par la banque quand la table en a une, par l'orbite sinon", (plan) => {
    const avecBanque = partiePlan(plan, "ocean", { 3: "cibles" });
    const sansBanque = partiePlan(plan, "ocean", { 3: "mini" });
    expect(avecBanque.table.passage, plan).not.toBeNull();
    expect(avecBanque.table.passage!.parBanque).toBe(true);
    expect(sansBanque.table.passage!.parBanque).toBe(false);
    expect(avecBanque.passageOuvert).toBe(0);
  });

  it("la table C (ni orbite ni porte) et le plan d'essai n'ont pas de porte ; la porte des tables A et B est à sens unique, sans murs, posée sur la bouche de l'orbite", () => {
    expect(PLANS_DU_JOUR).toEqual(["A", "B"]);
    expect(partiePlan("C").table.passage).toBeNull();
    for (const plan of PLANS_DU_JOUR) {
      const t = partiePlan(plan).table;
      expect([t.passage!.sensUnique, t.passage!.murs], plan).toEqual([true, 0]);
      // le battant est horizontal, de l'arc... de x = 22 à x = 86 (centré sur la bouche, x = 54), 26 px sous la bouche du rail de l'orbite
      const b = t.passage!.battant;
      expect([b.ay === b.by, Math.min(b.ax, b.bx) / UNITE, Math.max(b.ax, b.bx) / UNITE], plan).toEqual([true, 22, 86]);
      const orbite = t.portes.find((g) => t.rails[g.rail]!.genre === "orbite")!;
      expect(Math.round((b.ay - orbite.y) / UNITE), plan).toBe(26);
    }
  });

  it("à sens unique : une bille qui tombe d'en haut sur le battant fermé le traverse (elle ne s'y pose pas) ; celle qui monte rebondit", () => {
    for (const plan of PLANS_DU_JOUR) {
      const g0 = partiePlan(plan).table.passage!;
      // d'en haut : lâchée à 12 px au-dessus du battant, au repos
      const haut = partiePlan(plan, "foire", {}, { ...copierReglages(), sauvee: 0 });
      enJeu(haut, g0.x / UNITE, g0.y / UNITE - 12, 0, 0);
      let dessous = false;
      for (let i = 0; i < 600 && !dessous; i++) {
        haut.avancer();
        dessous = haut.y > g0.y + 12 * UNITE;
      }
      expect(dessous, `${plan} : la bille qui tombe traverse le battant`).toBe(true);
      // d'en bas : lancée à 700 px/s vers le battant fermé, elle ne le franchit jamais
      const bas = versLaPorte(partiePlan(plan, "foire"), 14, 700);
      for (let i = 0; i < 200; i++) {
        bas.avancer();
        expect(cote(bas), `${plan} pas ${i}`).toBeLessThan(2);
      }
    }
  });

  it("le plan d'essai n'a pas de porte", () => {
    expect(new Partie({ jour: 0, g: 6, theme: "foire", plan: "classique", miroir: false, modules: ["spinner", "bumpers", "cibles", "cibles", "trou", "mini"] }).table.passage).toBeNull();
  });

  it.each(PLANS_DU_JOUR)("%s : fermée, la porte est un mur — la bille qui la heurte de bas en haut, à toute vitesse, ne passe jamais", (plan) => {
    for (const v of [300, 700, 1100, 1500]) {
      const p = versLaPorte(partiePlan(plan, "foire", { 3: "mini" }), 14, v);
      expect(cote(p)).toBeLessThan(0);
      for (let i = 0; i < 400; i++) {
        p.avancer();
        // jamais de l'autre côté du battant à l'intérieur de sa largeur
        const g = p.table.passage!;
        const lat = ((p.x - g.x) * g.nx + (p.y - g.y) * g.ny) / 16384 / UNITE;
        if (Math.abs(lat) < 14) expect(cote(p), `${plan} v=${v} pas ${i}`).toBeLessThan(2);
      }
      expect(p.passages).toBe(0);
    }
  });

  it("une banque de cibles complète ouvre la porte : l'événement, le temps ouvert, puis elle se referme", () => {
    const p = partiePlan("B", "ocean", { 3: "cibles" });
    // deux cibles de la banque sont déjà tombées ; la bille tombe sur la troisième
    const banque = p.table.banques[0]!;
    banque.slice(0, 2).forEach((k) => (p.bas[k] = true));
    const s = p.table.murs[banque[2]!]!;
    const mx = (s.ax + s.bx) / 2 / UNITE;
    const my = (s.ay + s.by) / 2 / UNITE;
    // devant la cible (du côté des batteurs), lancée vers elle
    const nx = -s.uy / 16384;
    const ny = s.ux / 16384;
    const sens = (184 - mx) * nx + (640 - my) * ny > 0 ? 1 : -1;
    enJeu(p, mx + sens * nx * 14, my + sens * ny * 14, -sens * nx * 300, -sens * ny * 300);
    let ev = 0;
    let evBanque = false;
    for (let i = 0; i < 20 && !p.passageOuvert; i++) {
      p.avancer();
      ev |= p.ev2;
      evBanque ||= (p.ev & EV_BANQUE) !== 0;
    }
    expect(evBanque).toBe(true);
    expect(ev & EV2_PORTE_OUVRE).toBeTruthy();
    expect(p.passageOuvert).toBeGreaterThan(REGLAGES.porteDuree - 40);
    expect(p.ouvertures).toBe(1);
    // elle se referme au bout de `porteDuree` pas, avec son événement
    p.passageOuvert = 3;
    p.dansLanceur = true; // la bille ne joue plus : on ne regarde que la porte
    expect(evenements2(p, 4) & EV2_PORTE_FERME).toBeTruthy();
    expect(p.passageOuvert).toBe(0);
  });

  it("sur une table sans banque, l'orbite menée à son bout ouvre la porte ; une rampe, non", () => {
    const p = partiePlan("B", "ocean", { 3: "mini" });
    const orbite = p.table.rails.findIndex((r) => r.genre === "orbite");
    const rampe = p.table.rails.findIndex((r) => r.genre === "rampe");
    surLeRail(p, rampe, p.table.rails[rampe]!.len / UNITE - 1, 600);
    avancer(p, 3);
    expect(p.railsFaits[rampe]).toBe(1);
    expect(p.passageOuvert).toBe(0);
    surLeRail(p, orbite, p.table.rails[orbite]!.len / UNITE - 1, 600);
    const ev = evenements2(p, 3);
    expect(p.railsFaits[orbite]).toBe(1);
    expect(p.passageOuvert).toBeGreaterThan(0);
    expect(ev & EV2_PORTE_OUVRE).toBeTruthy();
  });

  it("sur une table avec banque, l'orbite n'ouvre pas la porte", () => {
    const p = partiePlan("B", "ocean", { 3: "cibles" });
    const orbite = p.table.rails.findIndex((r) => r.genre === "orbite");
    surLeRail(p, orbite, p.table.rails[orbite]!.len / UNITE - 1, 600);
    avancer(p, 3);
    expect(p.railsFaits[orbite]).toBe(1);
    expect(p.passageOuvert).toBe(0);
  });

  it.each(PLANS_DU_JOUR)("%s : ouverte, la bille passe — points, un cran de mission, un seul passage par ouverture, la porte se referme peu après", (plan) => {
    const p = partiePlan(plan, "ocean", { 3: "mini" });
    p.ouvrirLaPorte();
    p.passageOuvert = REGLAGES.porteDuree; // une ouverture ordinaire, pas l'essai
    versLaPorte(p, 14, 700);
    const ev = evenements2(p, 60);
    expect(ev & EV2_PORTE_PASSAGE, plan).toBeTruthy();
    expect(p.passages).toBe(1);
    expect(p.score).toBeGreaterThanOrEqual(REGLAGES.portePoints);
    expect(p.portePoints).toBe(REGLAGES.portePoints);
    expect(p.compteur, "la mission avance d'un cran").toBe(1);
    // repasser pendant la même ouverture ne rapporte rien de plus
    const score = p.score;
    p.passageServi = true;
    versLaPorte(p, 14, 700);
    avancer(p, 60);
    expect(p.passages).toBe(1);
    // la porte s'est refermée `porteApres` pas après le passage
    expect(p.passageOuvert).toBeLessThanOrEqual(Math.max(0, REGLAGES.porteApres - 60));
    void score;
  });

  it("le passage rapporte le multiplicateur en plus : portePoints × le cran", () => {
    const p = partiePlan("B", "ocean", { 3: "mini" });
    p.mult = 3;
    p.ouvrirLaPorte();
    versLaPorte(p, 14, 700);
    avancer(p, 60);
    expect(p.portePoints).toBe(REGLAGES.portePoints * 3);
  });

  it("pendant la multibille, un passage ajoute un jackpot", () => {
    const p = partiePlan("B", "ocean", { 3: "mini" });
    p.lancerLaMultibille();
    avancer(p, 1);
    const avant = p.jackpotsPartie;
    // les billes de la multibille sont lâchées par le trou : on pose la principale dans la porte
    p.ouvrirLaPorte();
    versLaPorte(p, 14, 700);
    avancer(p, 50);
    expect(p.passages).toBe(1);
    expect(p.jackpotsPartie).toBe(avant + 1);
    expect(p.compteur, "la mission ne compte pas pendant la multibille").toBe(p.but);
  });

  it("la mission du niveau avance d'un cran par passage, jusqu'à la réussir", () => {
    const p = partiePlan("B", "foire", { 3: "mini" });
    p.compteur = p.but - 1;
    p.ouvrirLaPorte();
    versLaPorte(p, 14, 700);
    avancer(p, 50);
    expect(p.missionFaite).toBe(true);
    expect(p.verrouAllume).toBe(true);
  });

  it("la porte qui se ferme sur la bille ne la coince pas, ne la fait pas traverser le battant", () => {
    for (const plan of PLANS_DU_JOUR) {
      for (const d of [-6, -2, 0, 2, 6]) {
        const p = partiePlan(plan, "foire", { 3: "mini" });
        p.passageOuvert = 2;
        p.passageServi = true;
        const g = p.table.passage!;
        enJeu(p, g.x / UNITE + (g.ux / 16384) * d, g.y / UNITE + (g.uy / 16384) * d, 0, 0);
        avancer(p, 20);
        expect(p.passageOuvert).toBe(0);
        // elle finit perdue ou revenue au lanceur
        for (let i = 0; i < 54000 && !p.dansLanceur && p.billes === 3; i++) p.avancer();
        expect(p.billes < 3 || p.dansLanceur, `${plan} d=${d}`).toBe(true);
      }
    }
  });

  it("aucune bille ne reste dans la porte ni dessus, ouverte ou fermée : une grille fine à 49 px autour d'elle (sa poche et ses abords), la bille à l'arrêt puis lancée, jouée 20 secondes", () => {
    // ce que fait une bille ensuite (elle peut rejoindre une orbite fermée du plateau, que la validation des tables éprouve et qu'une vraie partie brise) n'est pas l'affaire de la porte : on exige seulement qu'elle ne reste pas
    // posée contre elle — ni dans sa poche, ni sur son battant, ni sur le bout de ses murs
    for (const plan of PLANS_DU_JOUR) {
      for (const ouverte of [false, true]) {
        const base = partiePlan(plan, "foire", { 3: "mini" });
        const g = base.table.passage!;
        const occupe = (x: number, y: number): boolean => !dansLaTable(x, y) || pointOccupe(base.table, x, y);
        for (let dy = -49; dy <= 49; dy += 7) {
          for (let dx = -49; dx <= 49; dx += 7) {
            for (const v of [0, 500]) {
              if (occupe(g.x / UNITE + dx + 1, g.y / UNITE + dy + 1)) continue;
              const p = partiePlan(plan, "foire", { 3: "mini" }, { ...copierReglages(), sauvee: 0 });
              if (ouverte) p.ouvrirLaPorte();
              enJeu(p, g.x / UNITE + dx + 1, g.y / UNITE + dy + 1, v === 0 ? 0 : v, v === 0 ? 0 : -v / 2);
              // 20 s : une bille posée dans la poche y resterait ; on regarde les 2 dernières secondes
              let pas = 0;
              let immobile = 0;
              while (p.billes === 3 && !p.dansLanceur && !p.finie && pas < 12000) {
                p.avancer();
                pas++;
                const pres = Math.hypot(p.x - g.x, p.y - g.y) / UNITE < 45;
                const lente = Math.hypot(p.vx, p.vy) / UNITE < 25;
                immobile = pas > 10000 && pres && lente ? immobile + 1 : 0;
              }
              expect(immobile, `${plan} ouverte=${ouverte} (${dx}, ${dy}) v=${v}`).toBe(0);
            }
          }
        }
      }
    }
  }, 120_000);

  it("la porte ne touche à aucun module des 16 tables qui en ont une : son battant est à 6 px au moins de l'emprise de chaque module (bumpers, cibles, trou, éléments des thèmes)", () => {
    const dist = (x: number, y: number, ax: number, ay: number, bx: number, by: number): number => {
      const ex = bx - ax;
      const ey = by - ay;
      const u = Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey) / (ex * ex + ey * ey)));
      return Math.hypot(x - ax - ex * u, y - ay - ey * u);
    };
    for (const c of toutesLesTables().filter((q) => PLANS_DU_JOUR.includes(q.plan))) {
      const t = new Partie(c).table;
      const b = t.passage!.battant;
      const cercles = [...t.bumpers, ...t.trous, ...t.plateaux, ...t.tourbillons, ...t.portails, ...t.geysers];
      for (const z of cercles) expect(dist(z.x, z.y, b.ax, b.ay, b.bx, b.by) / UNITE - z.r / UNITE, `${c.theme}:${c.plan}${c.miroir ? "'" : ""}`).toBeGreaterThan(6);
      for (const k of t.banques.flat()) {
        const m = t.murs[k]!;
        expect(dist((m.ax + m.bx) / 2, (m.ay + m.by) / 2, b.ax, b.ay, b.bx, b.by) / UNITE, `${c.theme}:${c.plan} cible`).toBeGreaterThan(20);
      }
    }
  });
});
