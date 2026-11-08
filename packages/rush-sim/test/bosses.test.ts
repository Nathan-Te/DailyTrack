import { describe, expect, it } from "vitest";
import { daysFromCivil } from "@cdj/core";
import {
  BOSS,
  BOSS_IDS,
  B_BELIER,
  B_CHENE,
  B_DUC,
  B_GOLEM,
  B_REINE,
  ETOURDI,
  INVOCATION,
  MARCHE,
  NB_BOSS,
  Partie,
  PIERRES,
  POING,
  RECUPERE,
  RUGIT,
  REGLAGES_DEFAUT,
  SPORES,
  Z_BANDE,
  Z_INVOCATION,
  Z_SPORES,
  bossDuJour,
  cm,
  contenuScenario,
  dailyRush as dailyRushReel,
  empreinteContenu,
  enregistrer,
  entree,
  competenceDuPilote,
  etatPilote,
  idiv,
  indiceBoss,
  jouerLePilote,
  pasDuPilote,
  rejouer,
  themeDuJour,
  type Contenu,
  type Zone,
} from "../src/index";

// Lot BR5 : le jour demande de choisir une compétence au départ ; ces essais jouent la première (le tourbillon) sans écran de choix.
const dailyRush = (jour: number, version?: number): Contenu => ({ ...dailyRushReel(jour, version), competence: 0 });

// Les cinq boss de Rush (lot BR3) : le tirage, les règles communes (annonces, récupérations, phase 2, entrée en scène), les mécaniques propres de chacun et le pilote contre chacun.
const PREMIER = daysFromCivil(2026, 11, 2);

describe("le catalogue des boss", () => {
  it("cinq boss, dans l'ordre du catalogue ; chacun a deux cartes favorites qui existent", () => {
    expect([...BOSS_IDS]).toEqual(["golem", "reine", "grand-duc", "belier", "chene"]);
    expect(NB_BOSS).toBe(5);
    expect(BOSS_IDS.map((id) => indiceBoss(id))).toEqual([0, 1, 2, 3, 4]);
    expect(indiceBoss("dragon")).toBe(-1);
    for (const b of BOSS) expect(b.favorise.length).toBe(2);
  });
  it("les points de vie sont un % de ceux du golem (1 400) ; le rayon du corps vient du catalogue", () => {
    for (let b = 0; b < NB_BOSS; b++) {
      const p = new Partie(contenuScenario("boss", { boss: b }));
      expect(p.golem!.kind).toBe(b);
      expect(p.golem!.hpMax).toBe(idiv(REGLAGES_DEFAUT.golemVie * BOSS[b]!.vie, 100));
      expect(p.golem!.r).toBe(BOSS[b]!.rayon);
    }
    expect(new Partie(contenuScenario("boss")).golem!.kind).toBe(B_GOLEM);
    expect(contenuScenario("boss", { boss: 99 }).boss).toBe(NB_BOSS - 1);
  });
});

describe("le tirage du boss du jour", () => {
  const DEUX_ANS = Array.from({ length: 730 }, (_, i) => bossDuJour(PREMIER + i));
  it("jamais deux jours de suite le même boss (deux ans)", () => {
    for (let i = 1; i < DEUX_ANS.length; i++) expect(DEUX_ANS[i]).not.toBe(DEUX_ANS[i - 1]);
  });
  it("chaque boss revient au moins une fois tous les 7 jours (deux ans) : toute fenêtre de 7 jours les contient tous", () => {
    for (let i = 0; i + 7 <= DEUX_ANS.length; i++) expect(new Set(DEUX_ANS.slice(i, i + 7)).size).toBe(NB_BOSS);
  });
  it("tous les boss sont servis, à peu près autant (deux ans)", () => {
    const n = new Array<number>(NB_BOSS).fill(0);
    for (const b of DEUX_ANS) n[b]!++;
    for (const k of n) {
      expect(k).toBeGreaterThan(730 / NB_BOSS - 40);
      expect(k).toBeLessThan(730 / NB_BOSS + 40);
    }
  });
  it("le boss est indépendant du thème : chaque couple (boss, thème) arrive", () => {
    const couples = new Set(DEUX_ANS.map((b, i) => `${b}/${themeDuJour(PREMIER + i)}`));
    expect(couples.size).toBe(NB_BOSS * 3);
  });
  it("le tirage est le même pour tous (pur, indépendant de l'ordre des appels) ; le contenu du jour le porte", () => {
    expect(bossDuJour(PREMIER + 400)).toBe(DEUX_ANS[400]);
    expect(bossDuJour(PREMIER - 30)).toBe(bossDuJour(PREMIER));
    for (let i = 0; i < 20; i++) expect(dailyRush(PREMIER + i).boss).toBe(DEUX_ANS[i]);
  });
  it("le boss entre dans l'empreinte du contenu", () => {
    const c = dailyRush(PREMIER);
    const autre: Contenu = { ...c, boss: (c.boss + 1) % NB_BOSS };
    expect(empreinteContenu(c)).not.toBe(empreinteContenu(autre));
  });
});

/** Joue un boss face à un chevalier immobile et invincible, posé en (x, y) cm : ce qu'il annonce (à la pose de chaque zone), ses récupérations, ses étourdissements et ce qu'il fait. */
function observer(boss: number, phase2: boolean, ticks: number, chevalier: [number, number] = [0, 520]) {
  const p = new Partie(contenuScenario("boss", { boss, phase2 }), REGLAGES_DEFAUT, true);
  p.c.x = cm(chevalier[0]);
  p.c.y = cm(chevalier[1]);
  const vues = new Set<Zone>();
  const annonces: { phase: number; type: number; rang: number; annonce: number; attaque: number; t0: number }[] = [];
  let chocs = 0;
  const recups: { phase: number; duree: number }[] = [];
  const etourdis: number[] = [];
  let recup = 0;
  let etourdi = 0;
  let nuagesMax = 0;
  let sbires = 0;
  const bandes: Zone[] = [];
  const positionsChene: string[] = [];
  for (let i = 0; i < ticks && !p.finie; i++) {
    p.c.degat = 999;
    p.c.x = cm(chevalier[0]); // immobile, même si le boss le pousse
    p.c.y = cm(chevalier[1]);
    p.avancer(0);
    chocs += p.evenements.filter((e) => e.k === "choc").length;
    for (const z of p.zones) if (!vues.has(z)) {
      vues.add(z);
      annonces.push({ phase: p.golem!.phase, type: z.type, rang: z.rang, annonce: z.ti - z.t0, attaque: p.golem!.attaque, t0: z.t0 });
      if (z.type === Z_BANDE) bandes.push({ ...z });
    }
    if (p.golem!.etat === RECUPERE) recup++;
    else if (recup > 0) {
      recups.push({ phase: p.golem!.phase, duree: recup });
      recup = 0;
    }
    if (p.golem!.etat === ETOURDI) etourdi++;
    else if (etourdi > 0) {
      etourdis.push(etourdi);
      etourdi = 0;
    }
    nuagesMax = Math.max(nuagesMax, p.nuages.length);
    sbires = Math.max(sbires, p.monstres.filter((m) => m.sbire > 0).length);
    if (i % 50 === 0) positionsChene.push(`${p.golem!.x},${p.golem!.y}`);
    p.vider();
  }
  return { p, annonces, recups, etourdis, nuagesMax, sbires, bandes, positionsChene, chocs };
}

describe.each(BOSS_IDS.map((id, b) => [id, b] as const))("règles communes — %s", (_id, b) => {
  it("annonce chaque attaque d'au moins 70 ticks en phase 1 et 50 en phase 2, second coup compris", () => {
    const un = observer(b, false, 3000);
    expect(un.annonces.length).toBeGreaterThanOrEqual(3);
    for (const a of un.annonces.filter((a) => a.phase === 1)) expect(a.annonce).toBeGreaterThanOrEqual(70);
    const deux = observer(b, true, 3600);
    expect(deux.annonces.length).toBeGreaterThanOrEqual(3);
    for (const a of deux.annonces) expect(a.annonce).toBeGreaterThanOrEqual(50);
  });
  it("récupère au moins 80 ticks après chaque attaque en phase 1 et 55 en phase 2 (c'est la fenêtre pour taper)", () => {
    // le chevalier au centre : le bélier n'y finit pas contre le muret (il récupère au lieu d'être étourdi)
    const un = observer(b, false, 3000, [0, 0]);
    expect(un.recups.length).toBeGreaterThanOrEqual(3);
    for (const r of un.recups) expect(r.duree).toBeGreaterThanOrEqual(80);
    const deux = observer(b, true, 3600, [0, 0]);
    expect(deux.recups.length).toBeGreaterThanOrEqual(3);
    for (const r of deux.recups) expect(r.duree).toBeGreaterThanOrEqual(55);
  });
  it("passe en phase 2 sous 50 % de vie : il rugit, invulnérable, et le coup le dit (arrêt sur image de 150 ms dans le jeu)", () => {
    const p = new Partie(contenuScenario("boss", { boss: b }), REGLAGES_DEFAUT, true);
    const g = p.golem!;
    g.hp = idiv(g.hpMax, 2) + 1;
    g.sol = 1; // le grand-duc posé encaisse tout
    p.c.x = g.x;
    p.c.y = g.y + g.r + cm(120);
    p.c.dir = 96;
    for (let i = 0; i < 14; i++) p.avancer(i === 0 ? entree(-1, true) : 0);
    expect(g.phase).toBe(2);
    expect(g.etat === RUGIT).toBe(true);
    expect(p.evenements.find((e) => e.k === "touche" && e.b === 3)).toBeDefined();
    expect(p.evenements.some((e) => e.k === "phase2")).toBe(true);
    // invulnérable pendant le rugissement
    const pv = g.hp;
    p.c.etat = 0;
    p.c.t = 0;
    for (let i = 0; i < 12; i++) p.avancer(i === 0 ? entree(-1, true) : 0);
    expect(g.hp).toBe(pv);
  });
  it("le scénario de phase 2 commence à 50 % de vie", () => {
    const p = new Partie(contenuScenario("boss", { boss: b, phase2: true }));
    expect(p.golem!.phase).toBe(2);
    expect(p.golem!.hp).toBe(idiv(p.golem!.hpMax, 2));
  });
  it("dort jusqu'à la fermeture de la barrière, puis rugit une seconde, invulnérable (l'entrée en scène)", () => {
    const c: Contenu = { ...dailyRush(PREMIER), boss: b };
    const p = new Partie(c, REGLAGES_DEFAUT, true);
    for (let i = 0; i < 30; i++) p.avancer(0);
    expect(p.golemEveille).toBe(false);
    expect(p.golem!.etat).toBe(MARCHE);
    // le chevalier entre dans l'arène
    p.c.x = p.ax - 600;
    p.c.y = p.ay;
    p.c.degat = 9999;
    p.avancer(0);
    expect(p.barriere).toBeGreaterThanOrEqual(0);
    expect(p.golem!.etat).toBe(RUGIT);
    expect(p.golem!.duree).toBeGreaterThanOrEqual(60);
    // un coup porté pendant le rugissement est bloqué
    const pv = p.golem!.hp;
    p.golem!.x = p.c.x + cm(300);
    p.golem!.y = p.c.y;
    p.c.dir = 0;
    for (let i = 0; i < 20; i++) p.avancer(i === 0 ? entree(-1, true) : 0);
    expect(p.golem!.hp).toBe(pv);
  });
  it("une partie de forme : un joueur immobile perd ; le pilote le fait tomber", () => {
    const { resultat } = jouerLePilote(contenuScenario("boss", { boss: b }));
    expect(resultat.victoire).toBe(true);
    expect(resultat.ticks).toBeGreaterThan(900);
  });
});

describe("la reine gelée", () => {
  it("bondit sur le chevalier : un cercle de 3,3 m annoncé, et elle atterrit dessus à l'impact", () => {
    const o = observer(B_REINE, false, 1200, [0, 300]);
    const bonds = o.annonces.filter((a) => a.type === POING);
    expect(bonds.length).toBeGreaterThanOrEqual(2);
    expect(o.p.golem!.r).toBe(cm(200));
  });
  it("atterrit à l'impact sur le cercle (elle saute dans les derniers ticks)", () => {
    const p = new Partie(contenuScenario("boss", { boss: B_REINE }), REGLAGES_DEFAUT, true);
    p.c.degat = 999;
    let impact: { x: number; y: number } | null = null;
    for (let i = 0; i < 800 && !impact; i++) {
      p.avancer(0);
      const e = p.evenements.find((q) => q.k === "impact");
      if (e) impact = { x: e.x, y: e.y };
    }
    expect(impact).not.toBeNull();
    expect(Math.abs(p.golem!.x - impact!.x)).toBeLessThanOrEqual(cm(10));
    expect(Math.abs(p.golem!.y - impact!.y)).toBeLessThanOrEqual(cm(10));
  });
  it("en phase 2, enchaîne deux bonds (le second est annoncé sur le chevalier à l'impact du premier)", () => {
    const o = observer(B_REINE, true, 1500);
    expect(o.annonces.some((a) => a.type === POING && a.rang === 1)).toBe(true);
  });
  it("se divise à chaque seuil de vie franchi (75 %, 50 %, puis chaque huitième) en 3 petites gelées qui ne lâchent pas d'XP", () => {
    const c: Contenu = { ...dailyRush(PREMIER), boss: B_REINE };
    const p = new Partie(c, REGLAGES_DEFAUT, true);
    p.barriere = 1;
    const g = p.golem!;
    expect(g.div).toBe(0);
    p.monstres = [];
    // un coup qui fait franchir les 75 %
    p.c.x = g.x;
    p.c.y = g.y + g.r + cm(120);
    p.c.dir = 96;
    g.etat = MARCHE;
    g.repos = 9999;
    g.hp = idiv(g.hpMax * 750, 1000) + 3;
    for (let i = 0; i < 12; i++) p.avancer(i === 0 ? entree(-1, true) : 0);
    expect(g.div).toBe(1);
    const petites = p.monstres.filter((m) => m.sbire === 2);
    expect(petites.length).toBe(3);
    expect(p.evenements.filter((e) => e.k === "division").length).toBe(1);
    // tuer une petite ne lâche aucune gemme
    const xp = p.gemmes.length;
    petites[0]!.hp = 0;
    p.monstres = p.monstres.filter((m) => m.hp > 0);
    expect(p.gemmes.length).toBe(xp);
  });
  it("commence la phase 2 déjà divisée deux fois (le scénario) ; les seuils sont 750, 500, 375, 250 et 125 ‰", () => {
    expect(new Partie(contenuScenario("boss", { boss: B_REINE, phase2: true })).golem!.div).toBe(2);
  });
  it("les petites gelées naissent endormies (elles laissent le temps de les abattre)", () => {
    const o = observer(B_REINE, false, 10);
    expect(o.sbires).toBe(0);
  });
});

describe("le grand-duc", () => {
  it("annonce un plongeon par une bande au sol (70 ticks avant son départ) et ne la parcourt qu'ensuite", () => {
    const o = observer(B_DUC, false, 1500);
    expect(o.bandes.length).toBeGreaterThanOrEqual(2);
    for (const z of o.bandes) {
      expect(z.dash).toBeGreaterThanOrEqual(12);
      expect(z.ti - z.t0 - z.dash).toBeGreaterThanOrEqual(70);
      expect(z.r).toBe(cm(130));
    }
    // la bande passe par le chevalier (immobile en (0, 520)) et le dépasse
    const z = o.bandes[0]!;
    const [dx, dy] = [z.x2 - z.x, z.y2 - z.y];
    const t = ((cm(0) - z.x) * dx + (cm(520) - z.y) * dy) / (dx * dx + dy * dy);
    expect(t).toBeGreaterThan(0);
    expect(t).toBeLessThan(1);
  });
  it("encaisse un quart en vol, tout à terre ; il se pose après un plongeon (la fenêtre pour le punir)", () => {
    const p = new Partie(contenuScenario("boss", { boss: B_DUC }), REGLAGES_DEFAUT, true);
    const g = p.golem!;
    expect(g.sol).toBe(0);
    expect(p.degatsContreGolem(100)).toBe(25);
    g.sol = 1;
    expect(p.degatsContreGolem(100)).toBe(100);
    // il se pose pendant la récupération, jamais pendant l'annonce
    const q = new Partie(contenuScenario("boss", { boss: B_DUC }), REGLAGES_DEFAUT, true);
    let vuAuSol = false;
    for (let i = 0; i < 1800; i++) {
      q.c.degat = 999;
      q.avancer(0);
      const h = q.golem!;
      if (h.etat === RECUPERE) {
        expect(h.sol).toBe(1);
        vuAuSol = true;
      }
      if (h.etat === 1) expect(h.sol).toBe(0);
    }
    expect(vuAuSol).toBe(true);
  });
  it("en vol il ne pousse personne (le chevalier passe dessous) ; à terre il est solide", () => {
    const p = new Partie(contenuScenario("boss", { boss: B_DUC }), REGLAGES_DEFAUT, true);
    const g = p.golem!;
    p.c.x = g.x;
    p.c.y = g.y;
    p.avancer(0);
    expect(Math.abs(p.c.x - g.x) + Math.abs(p.c.y - g.y)).toBeLessThan(cm(100));
    g.sol = 1;
    g.hp = g.hpMax;
    p.c.x = g.x;
    p.c.y = g.y;
    p.avancer(0);
    expect(Math.hypot(p.c.x - g.x, p.c.y - g.y)).toBeGreaterThanOrEqual(g.r);
  });
  it("en phase 2, deux plongeons croisés annoncés ensemble (deux bandes qui se coupent), et il se pose après le second", () => {
    const o = observer(B_DUC, true, 900);
    const [a, b] = o.bandes;
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    expect(a!.rang).toBe(0);
    expect(b!.rang).toBe(1);
    expect(b!.t0).toBe(a!.t0); // annoncés en même temps
    // les segments se coupent
    const croise = (): boolean => {
      const d = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): number => (x2 - x1) * (y3 - y1) - (y2 - y1) * (x3 - x1);
      return d(a!.x, a!.y, a!.x2, a!.y2, b!.x, b!.y) * d(a!.x, a!.y, a!.x2, a!.y2, b!.x2, b!.y2) < 0 && d(b!.x, b!.y, b!.x2, b!.y2, a!.x, a!.y) * d(b!.x, b!.y, b!.x2, b!.y2, a!.x2, a!.y2) < 0;
    };
    expect(croise()).toBe(true);
    expect(b!.ti).toBeGreaterThan(a!.ti);
    // le chevalier immobile est sur les deux bandes : il serait touché deux fois
    expect(o.annonces.filter((x) => x.type === Z_BANDE).every((x) => x.annonce >= 50)).toBe(true);
  });
  it("un chevalier resté sur la bande est touché à l'arrivée, un chevalier écarté non", () => {
    // resté sur la ligne : touché
    const q = new Partie(contenuScenario("boss", { boss: B_DUC }), REGLAGES_DEFAUT, true);
    q.c.x = cm(0);
    q.c.y = cm(520);
    for (let i = 0; i < 400 && q.subis === 0; i++) {
      q.c.x = cm(0);
      q.c.y = cm(520);
      q.avancer(0);
    }
    expect(q.subis).toBeGreaterThan(0);
    const p = new Partie(contenuScenario("boss", { boss: B_DUC }), REGLAGES_DEFAUT, true);
    p.c.x = cm(0);
    p.c.y = cm(520);
    let bande: Zone | undefined;
    while (!bande && p.tick < 600) {
      p.avancer(0);
      bande = p.zones.find((z) => z.type === Z_BANDE);
    }
    expect(bande).toBeDefined();
    // on pose le chevalier à 4 m de la ligne, perpendiculairement : la bande ne le touche pas
    const [dx, dy] = [bande!.x2 - bande!.x, bande!.y2 - bande!.y];
    const l = Math.hypot(dx, dy);
    p.c.x = cm(0) + Math.trunc((-dy / l) * cm(400));
    p.c.y = cm(520) + Math.trunc((dx / l) * cm(400));
    const avant = p.subis;
    while (p.tick < bande!.ti + 5) p.avancer(0);
    expect(p.subis).toBe(avant);
  });
});

describe("le bélier de carrière", () => {
  it("annonce sa charge par une ligne droite jusqu'au chevalier (70 ticks avant le départ) ; contre le muret, il est étourdi 2 s", () => {
    const o = observer(B_BELIER, false, 1500, [0, 520]);
    expect(o.bandes.length).toBeGreaterThanOrEqual(1);
    for (const z of o.bandes) expect(z.ti - z.t0 - z.dash).toBeGreaterThanOrEqual(70);
    expect(o.etourdis.length).toBeGreaterThanOrEqual(1);
    for (const e of o.etourdis) expect(e).toBe(120);
    expect(o.chocs).toBe(o.etourdis.length);
  });
  it("sa charge finit contre le muret seulement si celui-ci est derrière le chevalier : au centre de l'arène, pas d'étourdissement mais une récupération", () => {
    const o = observer(B_BELIER, false, 1500, [0, 0]);
    expect(o.etourdis.length).toBe(0);
    expect(o.recups.length).toBeGreaterThanOrEqual(2);
    expect(o.chocs).toBe(0);
  });
  it("étourdi, il ne bouge pas, ne frappe pas, et encaisse plein pot", () => {
    const p = new Partie(contenuScenario("boss", { boss: B_BELIER }), REGLAGES_DEFAUT, true);
    p.c.x = 0;
    p.c.y = cm(520);
    let n = 0;
    while (p.golem!.etat !== ETOURDI && n++ < 1200) {
      p.c.degat = 999;
      p.avancer(0);
    }
    expect(p.golem!.etat).toBe(ETOURDI);
    const [x, y] = [p.golem!.x, p.golem!.y];
    const zones = p.zones.length;
    for (let i = 0; i < 100; i++) {
      p.c.degat = 999;
      p.avancer(0);
    }
    expect(p.golem!.etat).toBe(ETOURDI);
    expect([p.golem!.x, p.golem!.y]).toEqual([x, y]);
    expect(p.zones.length).toBeLessThanOrEqual(zones);
    // il touche le muret : il est à l'extrémité de l'arène
    expect(Math.hypot(x, y)).toBeGreaterThan(RAYON_ARENE_CM - cm(250));
  });
  it("en phase 2, des charges enchaînées (la seconde, annoncée 50 ticks, part d'où la première finit) et des éclats annoncés au choc", () => {
    const sans = observer(B_BELIER, true, 1500, [0, 0]);
    const rangs = sans.bandes.map((z) => z.rang);
    expect(rangs).toContain(0);
    expect(rangs).toContain(1);
    for (const z of sans.bandes.filter((z) => z.rang === 1)) expect(z.ti - z.t0 - z.dash).toBeGreaterThanOrEqual(50);
    const choc = observer(B_BELIER, true, 1500, [0, 520]);
    const eclats = choc.annonces.filter((a) => a.type === PIERRES);
    expect(eclats.length).toBeGreaterThanOrEqual(3);
    for (const a of eclats) expect(a.annonce).toBeGreaterThanOrEqual(50);
  });
});

const RAYON_ARENE_CM = 1150;

describe("le vieux chêne", () => {
  it("ne bouge jamais ; il lance des racines en ligne, en cercles, des spores et invoque des gelées", () => {
    const o = observer(B_CHENE, false, 3200);
    expect(new Set(o.positionsChene).size).toBe(1);
    const types = new Set(o.annonces.map((a) => a.type));
    expect(types).toContain(Z_BANDE);
    expect(types).toContain(PIERRES);
    expect(types).toContain(Z_SPORES);
    expect(types).toContain(Z_INVOCATION);
    expect(new Set(o.annonces.map((a) => a.attaque))).toEqual(new Set([6, 7, SPORES, INVOCATION]));
  });
  it("invoque 2 ou 3 gelées, qui ne lâchent pas d'XP", () => {
    const o = observer(B_CHENE, false, 3200);
    expect(o.sbires).toBeGreaterThanOrEqual(2);
    const groupes = new Map<number, number>();
    for (const a of o.annonces.filter((a) => a.type === Z_INVOCATION)) groupes.set(a.t0, (groupes.get(a.t0) ?? 0) + 1);
    expect(groupes.size).toBeGreaterThanOrEqual(2);
    for (const n of groupes.values()) expect([2, 3]).toContain(n);
  });
  it("les spores éclatent en un nuage qui reste au sol quelques secondes, puis s'éteint", () => {
    const p = new Partie(contenuScenario("boss", { boss: B_CHENE }), REGLAGES_DEFAUT, true);
    let debut = -1;
    let fin = -1;
    for (let i = 0; i < 4000 && fin < 0; i++) {
      p.c.degat = 999;
      p.avancer(0);
      if (p.nuages.length > 0 && debut < 0) debut = p.tick;
      if (debut >= 0 && p.nuages.length === 0) fin = p.tick;
    }
    expect(debut).toBeGreaterThan(0);
    expect(fin - debut).toBeGreaterThanOrEqual(240);
    expect(fin - debut).toBeLessThanOrEqual(300);
  });
  it("un nuage blesse qui reste dedans (un cœur, puis l'invincibilité des dégâts), pas qui est dehors", () => {
    const p = new Partie(contenuScenario("boss", { boss: B_CHENE }), REGLAGES_DEFAUT, true);
    // on pose un nuage sous le chevalier
    p.nuages.push({ x: p.c.x, y: p.c.y, r: cm(300), t0: 0, fin: 5000 });
    p.avancer(0);
    expect(p.c.coeurs).toBe(2);
    const dehors = new Partie(contenuScenario("boss", { boss: B_CHENE }), REGLAGES_DEFAUT, true);
    dehors.nuages.push({ x: dehors.c.x + cm(900), y: dehors.c.y, r: cm(300), t0: 0, fin: 5000 });
    dehors.avancer(0);
    expect(dehors.c.coeurs).toBe(3);
  });
  it("en phase 2, des racines en étoile (six bandes) et des spores plus grandes", () => {
    const sporesDe = (phase2: boolean): number => {
      const p = new Partie(contenuScenario("boss", { boss: B_CHENE, phase2 }), REGLAGES_DEFAUT, true);
      let r = 0;
      for (let i = 0; i < 4000 && r === 0; i++) {
        p.c.degat = 999;
        p.avancer(0);
        const z = p.zones.find((q) => q.type === Z_SPORES);
        if (z) r = z.r;
      }
      return r;
    };
    expect(sporesDe(true)).toBeGreaterThan(sporesDe(false));
    // six bandes de racines à la fois en étoile
    let max = 0;
    const p = new Partie(contenuScenario("boss", { boss: B_CHENE, phase2: true }), REGLAGES_DEFAUT, true);
    for (let i = 0; i < 3600; i++) {
      p.c.degat = 999;
      p.avancer(0);
      max = Math.max(max, p.zones.filter((z) => z.type === Z_BANDE).length);
    }
    expect(max).toBe(6);
    const racines1 = new Partie(contenuScenario("boss", { boss: B_CHENE }), REGLAGES_DEFAUT, true);
    let max1 = 0;
    for (let i = 0; i < 3200; i++) {
      racines1.c.degat = 999;
      racines1.avancer(0);
      max1 = Math.max(max1, racines1.zones.filter((z) => z.type === Z_BANDE).length);
    }
    expect(max1).toBe(2);
  });
});

describe("l'affinité : ce que chaque boss favorise", () => {
  it("chaque palier d'une carte favorite multiplie les dégâts contre lui (les paliers se composent) ; une carte non favorite non", () => {
    const base = (boss: number, ids: string[]): Partie => new Partie({ ...dailyRush(PREMIER), boss, ameliorations: ids }, REGLAGES_DEFAUT, true);
    const a = REGLAGES_DEFAUT.affinite;
    expect(a).toBeGreaterThan(0);
    const reine0 = base(B_REINE, []).degatsContreGolem(1000);
    expect(base(B_REINE, ["moulinet"]).degatsContreGolem(1000)).toBe(idiv(reine0 * (100 + a), 100));
    expect(base(B_REINE, ["moulinet", "maitrise"]).degatsContreGolem(1000)).toBe(idiv(idiv(reine0 * (100 + a), 100) * (100 + a), 100));
    expect(base(B_REINE, ["cadence"]).degatsContreGolem(1000)).toBe(reine0); // la cadence n'est pas favorite de la reine
    expect(base(B_DUC, ["esquive-vive", "esquive-vive"]).degatsContreGolem(1000)).toBeGreaterThan(base(B_DUC, ["esquive-vive"]).degatsContreGolem(1000));
  });
});

describe("le pilote contre chaque boss (60 jours forcés)", () => {
  const JOURS = Array.from({ length: 60 }, (_, k) => k);
  const construction = (b: number, n: number): string[] => [BOSS[b]!.favorise[0]!, BOSS[b]!.favorise[1]!, BOSS[b]!.favorise[0]!, BOSS[b]!.favorise[1]!, "bottes-legeres", "cadence", "lame-lourde", "soin"].slice(0, n);
  const jouer1 = (b: number, jour: number, ameliorations: string[]): { victoire: boolean; s: number } => {
    const p = new Partie(contenuScenario("boss", { boss: b, jour, ameliorations, competence: competenceDuPilote(b) })); // lot BR5 : la compétence que le pilote prend ce jour-là
    const etat = etatPilote("foncer", -2, p);
    while (!p.finie) pasDuPilote(p, etat);
    return { victoire: p.victoire, s: p.resultat().ticks / 60 };
  };
  const mediane = (v: number[]): number => [...v].sort((x, y) => x - y)[Math.floor(v.length / 2)]!;
  it.each(BOSS_IDS.map((id, b) => [id, b] as const))("%s : au moins 58 victoires sur 60 ; sans carte ~25 à 50 s (lot BR5 : la compétence raccourcit le combat) ; avec une construction adaptée de 6 cartes bien plus court", (_id, b) => {
    const sans = JOURS.map((k) => jouer1(b, k, []));
    expect(sans.filter((r) => r.victoire).length).toBeGreaterThanOrEqual(58);
    const m = mediane(sans.filter((r) => r.victoire).map((r) => r.s));
    expect(m).toBeGreaterThanOrEqual(22); // BR3 : 38 — la compétence (lot BR5) raccourcit le combat ; BR6 rétablit l'équilibre
    expect(m).toBeLessThanOrEqual(56);
    const avec = JOURS.slice(0, 20).map((k) => jouer1(b, k, construction(b, 6)));
    expect(avec.every((r) => r.victoire)).toBe(true);
    expect(mediane(avec.map((r) => r.s))).toBeLessThanOrEqual(20);
    expect(mediane(avec.map((r) => r.s))).toBeLessThan(m / 2);
  });
  it("le bélier : le pilote attire la charge contre le muret (il est étourdi plusieurs fois par combat)", () => {
    let chocs = 0;
    for (let k = 0; k < 10; k++) {
      const p = new Partie(contenuScenario("boss", { boss: B_BELIER, jour: k }), REGLAGES_DEFAUT, true);
      const etat = etatPilote("foncer", -2, p);
      while (!p.finie) {
        pasDuPilote(p, etat);
        chocs += p.evenements.filter((e) => e.k === "choc").length;
        p.vider();
      }
    }
    expect(chocs / 10).toBeGreaterThanOrEqual(3);
  });
});

describe("la rediffusion d'un jour de chaque boss", () => {
  it("le pilote joue une semaine entière (les cinq boss) : la rediffusion se rejoue à l'identique", () => {
    const vus = new Set<number>();
    for (let k = 0; k < 7; k++) {
      const c = dailyRush(PREMIER + k);
      vus.add(c.boss);
      const { changements, choix, resultat } = jouerLePilote(c);
      const code = enregistrer(c, changements, choix);
      expect(rejouer(c, code)).toEqual(resultat);
      expect(resultat.victoire).toBe(true);
      expect(code.length).toBeLessThan(6000);
    }
    expect(vus.size).toBe(NB_BOSS);
  });
});

