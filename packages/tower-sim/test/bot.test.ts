import { beforeAll, describe, expect, it } from "vitest";
import { COMMANDE, dailyTower, empreinteVue, Partie, type Rapier, rejouer, type Scenario, SCENARIO_ESSAI, scenarioPaliers } from "../src";
import { bot, commandesDuCoup, coupInterdit, coupsDe, essayerBot, jouerBot, jouerBotRobuste, noteEssai, OPTIONS_BOT, ROTATIONS, VARIANTES_BOT } from "../src/bot";
import { BUDGET_TICKS, PENALITE_MOUVEMENT, PENALITE_VIE, PROFONDEUR_VISIBLE_MM, SATISFAIT_MM } from "../src/bot/constantes";
import { chargerRapier } from "../src/rapier";

// Lot T3 — le bot de l'auteur. Les tests de calcul jouent une PETITE partie (neuf pièces, une plateforme de 6 m) : une journée entière coûte une minute (mesures-t3, rapport du lot).
let R: Rapier;
beforeAll(async () => {
  R = await chargerRapier();
});

const PETITE: Scenario = { nom: "petite", pieces: [..."TIOLJ"] as Scenario["pieces"][number][], plateformeDemi8: 24 };

describe("la copie d'une partie (Partie.cloner)", () => {
  it("est exacte : avancer l'original et la copie avec les mêmes commandes donne les mêmes empreintes, tick après tick", () => {
    const p = new Partie(R, dailyTower(20_800));
    const cmd = (t: number): number => (t % 90 === 3 ? COMMANDE.TOURNER : 0) | (t % 70 === 5 ? COMMANDE.DROITE : 0) | (t % 100 > 10 ? COMMANDE.DESCENDRE : 0);
    let t = 0;
    for (; t < 700; t++) p.avancer(cmd(t));
    expect(p.vue().posees).toBeGreaterThan(2);
    const q = p.cloner();
    expect(empreinteVue(q.vue())).toBe(empreinteVue(p.vue()));
    for (let k = 0; k < 700 && p.etape !== "fini"; k++, t++) {
      p.avancer(cmd(t));
      q.avancer(cmd(t));
      if (k % 50 === 0) expect(empreinteVue(q.vue()), `tick ${t}`).toBe(empreinteVue(p.vue()));
    }
    expect(q.resultat()).toEqual(p.resultat());
    p.dispose();
    q.dispose();
  });

  it("est indépendante : jouer la copie ne touche pas l'original", () => {
    const p = new Partie(R, PETITE);
    for (let t = 0; t < 120; t++) p.avancer(COMMANDE.DESCENDRE);
    const avant = empreinteVue(p.vue());
    const q = p.cloner();
    for (let t = 0; t < 300; t++) q.avancer(COMMANDE.GAUCHE);
    expect(empreinteVue(p.vue())).toBe(avant);
    p.dispose();
    q.dispose();
  });
});

describe("les coups du bot", () => {
  it("les rotations sans doublon : 1 pour O, 2 pour I, S et Z, 4 pour les autres", () => {
    expect(ROTATIONS).toEqual({ O: 1, I: 2, S: 2, Z: 2, T: 4, L: 4, J: 4 });
  });
  it("les positions sont au pas de la demi-case, de chaque côté — et rien d'autre : jamais de coup « à la mer »", () => {
    const o = { ...OPTIONS_BOT, positionsParCote: 3 };
    const coups = coupsDe("O", 28, o);
    expect(coups.map((c) => c.dx)).toEqual([0, -1, 1, -2, 2, -3, 3]);
    // jamais plus loin que ce qui touche encore la plateforme : aucun coup ne jette la pièce hors de la plateforme
    for (const kind of ["O", "I", "T"] as const) expect(Math.max(...coupsDe(kind, 28).map((c) => Math.abs(c.dx))) * 4).toBeLessThanOrEqual(28 + 4 * 5);
    expect(coupsDe("T", 28, o).filter((c) => c.dx === 0)).toHaveLength(4);
    expect(coupsDe("I", 28, o).filter((c) => c.dx === 0)).toHaveLength(2);
    // une petite plateforme réduit les positions : jamais au-delà de ce qui touche encore la plateforme
    expect(coupsDe("O", 4, { ...OPTIONS_BOT, positionsParCote: 9 }).map((c) => Math.abs(c.dx))).toContain(2);
    expect(Math.max(...coupsDe("O", 4, { ...OPTIONS_BOT, positionsParCote: 9 }).map((c) => Math.abs(c.dx)).filter((d) => d < 7))).toBe(2);
  });
  it("les commandes sont les vraies : tourner, déplacer d'une demi-case par tick, DESCENDRE levé tout du long", () => {
    expect(commandesDuCoup({ rot: 2, dx: -1 })).toEqual([COMMANDE.TOURNER | COMMANDE.DESCENDRE, COMMANDE.TOURNER | COMMANDE.DESCENDRE, COMMANDE.GAUCHE | COMMANDE.DESCENDRE]);
    expect(commandesDuCoup({ rot: 0, dx: 2 })).toEqual([COMMANDE.DROITE | COMMANDE.DESCENDRE, COMMANDE.DROITE | COMMANDE.DESCENDRE]);
  });
  it("la note : la hauteur, moins une pénalité par vie perdue et par pièce qui bouge encore (entiers)", () => {
    expect(noteEssai(20_000, 0, 0)).toBe(20_000);
    expect(noteEssai(20_000, 1, 0)).toBe(20_000 - PENALITE_VIE);
    expect(noteEssai(20_000, 0, 2)).toBe(20_000 - 2 * PENALITE_MOUVEMENT);
    expect(PENALITE_VIE).toBeGreaterThan(PENALITE_MOUVEMENT * 20);
    expect(Number.isInteger(PENALITE_VIE) && Number.isInteger(PENALITE_MOUVEMENT)).toBe(true);
  });
});

describe("le bot joue une vraie partie", () => {
  // Deux passages sur la même petite partie (≈ 10 s chacun) : ils servent au test de déterminisme et à tous les autres.
  let a: ReturnType<typeof jouerBot>;
  let b: ReturnType<typeof jouerBot>;
  beforeAll(() => {
    a = jouerBot(R, PETITE);
    b = jouerBot(R, PETITE);
  }, 120_000);

  it("déterministe : deux passages donnent exactement la même preuve", () => {
    expect(a.rediffusion).toEqual(b.rediffusion);
    expect(a.resultat).toEqual(b.resultat);
  });

  it("sa preuve est une rediffusion ordinaire : `rejouer` redonne exactement sa hauteur", () => {
    const r = a;
    expect(r.resultat.hauteurMm).toBeGreaterThan(2_000);
    expect(rejouer(R, PETITE, r.rediffusion)).toEqual(r.resultat);
    expect(r.rediffusion.contenu).toEqual({ scenario: "petite" });
  });

  it("le générateur rend les commandes de chaque pièce décidée (de quoi la regarder jouer), puis la preuve", { timeout: 60_000 }, () => {
    const g = bot(R, PETITE);
    const pieces: number[][] = [];
    let n = g.next();
    while (!n.done) {
      pieces.push(n.value);
      n = g.next();
    }
    expect(pieces.length).toBeGreaterThanOrEqual(1);
    expect(pieces.length).toBeLessThanOrEqual(PETITE.pieces.length);
    // les commandes rendues, jouées sur une partie neuve, donnent la même tour que la preuve avant la stabilisation
    const p = new Partie(R, PETITE);
    for (const masques of pieces) for (const m of masques) p.avancer(m);
    expect(p.vue().posees).toBe(pieces.length);
    p.dispose();
    expect(n.value!.resultat.hauteurMm).toBeGreaterThan(0);
  });

  it("un plafond de ticks coupe le calcul : une partie non finie n'est pas une preuve, le résultat est `null`", { timeout: 60_000 }, () => {
    expect(essayerBot(R, PETITE, { ...OPTIONS_BOT, plafondTicks: 3_000 })).toBeNull();
    expect(essayerBot(R, PETITE, { ...OPTIONS_BOT, plafondTicks: 10_000_000 })!.rediffusion).toEqual(a.rediffusion);
  });

  it("ne triche pas : jamais une pièce posée hors de l'écran, au pied d'une haute tour (coup interdit sous la zone visible)", { timeout: 120_000 }, () => {
    // Une tour de départ à 9 m (la plateforme est donc à 9 m sous le sommet, hors de la zone visible de 6,5 m) et quatre pièces : chaque pièce doit se poser dans la zone visible.
    const haut: Scenario = { ...scenarioPaliers("lierre"), paliers: [], pieces: [..."TOLJ"] as Scenario["pieces"][number][] };
    const g = bot(R, haut);
    const suivi = new Partie(R, haut);
    let n = g.next();
    let pieces = 0;
    while (!n.done) {
      const avant = suivi.lecture().sommetMm;
      const id = suivi.idActive;
      for (const m of n.value) suivi.avancer(m);
      const p = suivi.vue().pieces[id]!;
      if (p.etat === "libre") expect(Math.round(p.y * 1000), `pièce ${id}`).toBeGreaterThanOrEqual(avant - PROFONDEUR_VISIBLE_MM - 5);
      pieces++;
      n = g.next();
    }
    suivi.dispose();
    expect(pieces).toBeGreaterThanOrEqual(3);
    expect(n.value!.rediffusion.plages.length).toBeGreaterThan(0);
  });

  it("coupInterdit : la frontière est la zone visible sous le sommet de la tour, au millimètre", () => {
    expect(PROFONDEUR_VISIBLE_MM).toBe(6_500);
    expect(coupInterdit(20_000 - 6_500, 20_000)).toBe(false);
    expect(coupInterdit(20_000 - 6_501, 20_000)).toBe(true);
    expect(coupInterdit(0, 5_000)).toBe(false); // une tour basse : la plateforme est à l'écran
    expect(coupInterdit(0, 30_000)).toBe(true);
  });

  it("les reprises : satisfait, on garde le réglage ordinaire ; sinon on essaie les variantes sous le budget de ticks, et on garde la meilleure preuve", { timeout: 120_000 }, () => {
    expect(VARIANTES_BOT).toHaveLength(4);
    expect(VARIANTES_BOT[0]).toEqual(OPTIONS_BOT);
    expect(SATISFAIT_MM).toBe(30_000);
    expect(BUDGET_TICKS).toBe(600_000);
    const content = jouerBotRobuste(R, PETITE, a, { satisfaitMm: 1, budgetTicks: BUDGET_TICKS });
    expect(content.variante).toBe(0);
    expect(content.rediffusion).toEqual(a.rediffusion);
    const budget = a.compteurs.ticks + 4_000;
    const repris = jouerBotRobuste(R, PETITE, a, { satisfaitMm: 1_000_000, budgetTicks: budget });
    expect(repris.resultat.hauteurMm).toBeGreaterThanOrEqual(a.resultat.hauteurMm); // jamais pire que le réglage ordinaire
    expect(repris.ticksTotal).toBeGreaterThan(a.compteurs.ticks); // une variante a été essayée (ici coupée par le plafond : abandonnée, sans preuve)
    expect(repris.ticksTotal).toBeLessThanOrEqual(budget);
    expect(rejouer(R, PETITE, repris.rediffusion)).toEqual(repris.resultat);
  });

  it("applique les paliers comme au joueur : un jour avec un palier bas se joue sans erreur et se rejoue au bit près", { timeout: 60_000 }, () => {
    const c = dailyTower(20_800);
    const court: Scenario = { ...c, pieces: c.pieces.slice(0, 5), paliers: [{ metres: 3, effet: "petite" }, ...c.paliers.slice(1)] };
    const r = jouerBot(R, court);
    expect(rejouer(R, court, r.rediffusion)).toEqual(r.resultat);
  });

  it("la preuve d'un scénario nommé se rejoue (essai raccourci)", { timeout: 60_000 }, () => {
    const court: Scenario = { ...SCENARIO_ESSAI, pieces: SCENARIO_ESSAI.pieces.slice(0, 4) };
    const r = jouerBot(R, court);
    expect(rejouer(R, court, r.rediffusion).hauteurMm).toBe(r.resultat.hauteurMm);
  });
});
