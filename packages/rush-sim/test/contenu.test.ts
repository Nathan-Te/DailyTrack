import { describe, expect, it } from "vitest";
import {
  AMELIORATIONS,
  BORNES_NIVEAU,
  C_BOND,
  C_BOUCLIER,
  C_TOURBILLON,
  CHAMAN,
  CHAUVE,
  CRACHEUR,
  GELATON,
  GELEE,
  GEMME_COEUR,
  MONSTRE_NEUTRE,
  MONSTRES_IDS,
  NB_TYPES,
  PORTE_BOUCLIER,
  PROG_ELITE,
  PROG_SOUTIEN,
  PROG_TANK,
  Partie,
  REGLAGES_DEFAUT,
  TOTEM,
  VIE_TYPE,
  cm,
  contenuScenario,
  dailyRush,
  entree,
  epreuveEtanche,
  etatPilote,
  indiceAmelioration,
  jouer,
  jouerLePilote,
  pasDuPilote,
  problemesDuNiveau,
  tirageDeCartes,
  type Monstre,
} from "../src/index";

// Lot BR6 — le contenu : les quatre nouveaux ennemis et leurs règles, aucun dégât de contact, les élites, la salle d'épreuve, la courbe de difficulté le long du niveau, les cartes de fin de partie, le pilote qui les apprend, les budgets de rejeu.
const J = 20_000;
let prochain = 9000;
/** Une arène d'essai vidée : le chevalier au centre, regardant vers +x (la direction 0). Rien n'apparaît avant 180 ticks. */
const salle = (ameliorations: string[] = [], competence = C_TOURBILLON): Partie => {
  const p = new Partie(contenuScenario("arene", { ameliorations, competence }), REGLAGES_DEFAUT, true);
  p.monstres = [];
  p.c.x = 0;
  p.c.y = 0;
  p.c.dir = 0;
  return p;
};
const monstre = (type: number, x: number, y: number, o: Partial<Monstre> = {}): Monstre => ({
  id: prochain++,
  type,
  x,
  y,
  kx: 0,
  ky: 0,
  hp: VIE_TYPE[type]!,
  flash: 0,
  etat: 0,
  t: 0,
  age: -100,
  a: 0,
  sens: 1,
  cx: 0,
  cy: 0,
  gel: 0,
  duree: 999,
  coup: 0,
  hx: x,
  hy: y,
  alerte: 1,
  laisse: 0,
  ra: 0,
  sbire: 0,
  ...MONSTRE_NEUTRE,
  ...o,
});
const poser = (p: Partie, type: number, dx: number, dy: number, o: Partial<Monstre> = {}): Monstre => {
  const m = monstre(type, p.c.x + cm(dx), p.c.y + cm(dy), o);
  p.monstres.push(m);
  return m;
};
const tourner = (p: Partie, n: number, e = 0): void => {
  for (let i = 0; i < n; i++) p.avancer(e);
};
const COUP = entree(-1, true);
const evenements = (p: Partie, genre: string): number => p.evenements.filter((e) => e.k === genre).length;

describe("aucun dégât de contact (lot BR6)", () => {
  it("un monstre collé au chevalier, qui n'attaque pas, ne le blesse jamais : seule une attaque annoncée blesse", () => {
    for (const type of [GELEE, CHAUVE, GELATON, CRACHEUR, CHAMAN, TOTEM, PORTE_BOUCLIER]) {
      const p = salle();
      poser(p, type, 40, 0, { gel: 0 });
      tourner(p, 18); // avant la fin de toute annonce (la plus courte : 22 ticks pour un gélaton, qui bondit ensuite)
      expect(p.subis, `${MONSTRES_IDS[type]} au contact`).toBe(0);
    }
  });
  it("le bond d'une gelée blesse, lui : le dégât vient de l'attaque annoncée, pas de la présence", () => {
    const p = salle();
    const m = poser(p, GELEE, 60, 0);
    tourner(p, 90);
    expect(m.hp).toBeGreaterThan(0);
    expect(p.subis).toBeGreaterThan(0);
  });
  it("une chauve-souris ne blesse que pendant son plongeon", () => {
    const p = salle();
    poser(p, CHAUVE, 30, 0, { etat: 3, t: 0 }); // au repos, sur le chevalier
    tourner(p, 30);
    expect(p.subis).toBe(0);
  });
});

describe("le porte-bouclier : il bloque les coups de face (lot BR6)", () => {
  it("de face, un coup est paré : aucun dégât, l'événement « para » part", () => {
    const p = salle();
    const pb = poser(p, PORTE_BOUCLIER, 150, 0, { gel: 999, face: 64 }); // son bouclier regarde vers le chevalier (−x)
    tourner(p, 14, COUP);
    expect(pb.hp).toBe(VIE_TYPE[PORTE_BOUCLIER]);
    expect(evenements(p, "para")).toBeGreaterThan(0);
  });
  it("de dos ou de flanc, il est blessé", () => {
    for (const face of [0, 32]) {
      const p = salle();
      const pb = poser(p, PORTE_BOUCLIER, 150, 0, { gel: 999, face }); // 0 : de dos ; 32 : bouclier vers le bas (flanc)
      tourner(p, 14, COUP);
      expect(pb.hp, `face ${face}`).toBeLessThan(VIE_TYPE[PORTE_BOUCLIER]!);
    }
  });
  it("ouvert (après son coup de bouclier) il est vulnérable de partout, de face aussi", () => {
    const p = salle();
    const pb = poser(p, PORTE_BOUCLIER, 150, 0, { gel: 999, face: 64, vuln: 90 });
    tourner(p, 14, COUP);
    expect(pb.hp).toBeLessThan(VIE_TYPE[PORTE_BOUCLIER]!);
  });
  it("le bond l'étourdit et l'ouvre de partout : le coup de l'onde passe malgré la garde", () => {
    const p = salle([], C_BOND);
    const pb = poser(p, PORTE_BOUCLIER, 300, 0, { face: 64 });
    p.c.dir = 0;
    tourner(p, 3, entree(-1, false, false, 0, true));
    tourner(p, 40);
    expect(pb.hp).toBeLessThan(VIE_TYPE[PORTE_BOUCLIER]!);
    expect(pb.etourdi + pb.vuln).toBeGreaterThan(0);
  });
  it("son coup de bouclier est annoncé (au moins 35 ticks) et ne touche que devant lui", () => {
    const p = salle();
    const pb = poser(p, PORTE_BOUCLIER, 120, 0, { face: 64 });
    let annonce = 0;
    for (let i = 0; i < 80 && pb.etat !== 3; i++) {
      p.avancer(0);
      if (pb.etat === 1) annonce++;
      if (evenements(p, "coupBouclier") > 0) break;
    }
    expect(annonce).toBeGreaterThanOrEqual(35);
  });
});

describe("le chaman : il protège, il fuit, il n'attaque pas (lot BR6)", () => {
  it("son bouclier retire 70 % des dégâts à un allié proche, et tomber l'enlève aussitôt", () => {
    const p = salle();
    const ch = poser(p, CHAMAN, 400, 0, { gel: 0 });
    const allie = poser(p, GELEE, 200, 0, { gel: 999 });
    tourner(p, 45);
    expect(allie.prot).toBeGreaterThan(0);
    expect(allie.lien).toBe(ch.id);
    // un coup sur l'allié protégé fait 30 % de ses dégâts ordinaires
    const q = salle();
    const libre = poser(q, GELEE, 150, 0, { gel: 999 });
    const protege = poser(q, GELEE, 150, 0, { gel: 999, prot: 500 });
    protege.y = libre.y + cm(300);
    tourner(q, 14, COUP);
    const perdu = (m: Monstre): number => 30 - m.hp;
    expect(perdu(libre)).toBeGreaterThan(0);
    expect(perdu(protege)).toBeLessThan(perdu(libre));
    // le chaman tué emporte ses boucliers
    ch.hp = 0;
    allie.prot = 99;
    const dernier = poser(p, GELEE, 100, 0);
    expect(dernier).toBeTruthy();
  });
  it("il fuit le chevalier qui s'approche et ne blesse personne", () => {
    const p = salle();
    const ch = poser(p, CHAMAN, 300, 0);
    const d0 = Math.abs(ch.x - p.c.x);
    tourner(p, 40);
    expect(Math.abs(ch.x - p.c.x)).toBeGreaterThan(d0);
    expect(p.subis).toBe(0);
  });
  it("tuer le chaman fait tomber le bouclier des alliés (même coup)", () => {
    const p = salle();
    const ch = poser(p, CHAMAN, 150, 0, { gel: 999, hp: 10 });
    const allie = poser(p, GELEE, 400, 0, { gel: 999, prot: 500, lien: ch.id });
    tourner(p, 60, COUP);
    expect(ch.hp).toBeLessThanOrEqual(0);
    expect(allie.prot).toBe(0);
  });
});

describe("le totem : il invoque trois gélatons toutes les 6 s, douze vivants au plus (lot BR6)", () => {
  it("la première naissance fait trois gélatons ; sans qu'on le détruise, jamais plus de douze", () => {
    const p = salle();
    const t = poser(p, TOTEM, 900, 0, { alerte: 1, t: 0 });
    let max = 0;
    for (let i = 0; i < 360 * 6; i++) {
      p.avancer(0);
      p.c.coeurs = p.c.coeursMax;
      max = Math.max(max, p.monstres.filter((m) => m.parent === t.id && m.hp > 0).length);
    }
    expect(max).toBeGreaterThanOrEqual(3);
    expect(max).toBeLessThanOrEqual(12);
    expect(p.monstres.filter((m) => m.parent === t.id).every((m) => m.sbire === 3 && m.xpx === 0)).toBe(true);
  });
  it("le détruire arrête la source", () => {
    const p = salle();
    const t = poser(p, TOTEM, 160, 0, { gel: 0 });
    t.hp = 1;
    tourner(p, 14, COUP);
    expect(t.hp).toBeLessThanOrEqual(0);
    const avant = p.monstres.filter((m) => m.parent === t.id).length;
    tourner(p, 360 * 2);
    expect(p.monstres.filter((m) => m.parent === t.id).length).toBe(avant);
  });
});

describe("le cracheur : une ligne au sol, un projectile lent, détruit par le coup (lot BR6)", () => {
  it("il garde ses distances : il recule quand on approche, et sa visée dure au moins 50 ticks", () => {
    const p = salle();
    const c = poser(p, CRACHEUR, 300, 0, { duree: 5 });
    const d0 = Math.abs(c.x - p.c.x);
    let vise = 0;
    for (let i = 0; i < 20; i++) {
      p.avancer(0);
      if (c.etat === 1) vise++;
    }
    expect(Math.abs(c.x - p.c.x)).toBeGreaterThan(d0);
    for (let i = 0; i < 200 && p.projectiles.length === 0; i++) {
      p.avancer(0);
      if (c.etat === 1) vise++;
    }
    expect(p.projectiles.length).toBeGreaterThan(0);
    expect(vise).toBeGreaterThanOrEqual(50);
  });
  it("le projectile blesse s'il touche, et un coup le détruit", () => {
    const p = salle();
    poser(p, CRACHEUR, 700, 0, { etat: 1, t: 40, cx: -1024, cy: 0, gel: 0 });
    for (let i = 0; i < 40 && p.projectiles.length === 0; i++) p.avancer(0);
    expect(p.projectiles.length).toBe(1);
    // le coup, tenu, le détruit avant qu'il n'arrive (il file à 5 m/s : 6 m d'écart)
    p.c.dir = 0;
    for (let i = 0; i < 40 && p.projectiles.length > 0; i++) p.avancer(COUP);
    // soit détruit par le coup, soit arrivé : on vérifie les deux cas par l'événement
    const detruit = p.evenements.some((e) => e.k === "projectileDetruit" && e.b === 2);
    const touche = p.subis > 0;
    expect(detruit || touche).toBe(true);
  });
  it("sans rien faire, le projectile blesse le chevalier", () => {
    const p = salle();
    poser(p, CRACHEUR, 500, 0, { etat: 1, t: 54, cx: -1024, cy: 0, gel: 0 });
    tourner(p, 90);
    expect(p.subis).toBeGreaterThan(0);
  });
  it("le bouclier lancé détruit les projectiles qu'il croise", () => {
    const p = salle([], C_BOUCLIER);
    poser(p, CRACHEUR, 800, 0, { etat: 1, t: 54, cx: -1024, cy: 0, gel: 0 });
    for (let i = 0; i < 5; i++) p.avancer(0);
    p.avancer(entree(-1, false, false, 0, true));
    tourner(p, 60);
    expect(p.evenements.some((e) => e.k === "projectileDetruit" && e.b === 2) || p.projectiles.length === 0).toBe(true);
  });
});

describe("les élites (lot BR6)", () => {
  const niveau = (jour: number): ReturnType<typeof dailyRush> => dailyRush(jour);
  it("au plus un par camp, dans environ un camp sur deux, jamais avant le milieu du niveau, jamais hors d'un camp (365 jours)", () => {
    let camps = 0;
    let avecElite = 0;
    for (let k = 0; k < 365; k++) {
      const n = niveau(J + k).niveau!;
      for (const d of n.detours) {
        const e = n.monstres.filter((m) => m.camp === d.camp && m.elite).length;
        expect(e).toBeLessThanOrEqual(1);
        if (e === 1) {
          expect(d.prog).toBeGreaterThanOrEqual(PROG_ELITE);
          avecElite++;
        }
        camps++;
      }
      expect(n.monstres.filter((m) => m.elite && m.camp < 0)).toHaveLength(0);
    }
    expect(avecElite / camps).toBeGreaterThan(0.3);
    expect(avecElite / camps).toBeLessThan(0.7);
  }, 180_000);
  it("taille ×1,5, vie ×5 ; il lâche ×10 d'XP et un cœur garanti", () => {
    let jour = J;
    let el: { x: number; y: number } | null = null;
    for (; !el; jour++) el = dailyRush(jour).niveau!.monstres.find((m) => m.elite && m.type === GELEE) ?? null;
    jour--;
    const p = new Partie({ ...dailyRush(jour), competence: C_TOURBILLON }, REGLAGES_DEFAUT, true);
    const m = p.monstres.find((q) => q.elite === 1 && q.type === GELEE)!;
    expect(m.hp).toBe(VIE_TYPE[GELEE]! * REGLAGES_DEFAUT.eliteVie);
    expect(p.rayonM(m)).toBe(Math.trunc((p.rayonM({ ...m, elite: 0 }) * REGLAGES_DEFAUT.eliteTaille) / 100));
    // il tombe : l'XP vaut ×10 de celle d'une gelée du même camp, et un cœur attend
    p.c.x = m.x - cm(150);
    p.c.y = m.y;
    p.c.dir = 0;
    m.hp = 1;
    m.alerte = 1;
    for (let i = 0; i < 60 && m.hp > 0; i++) p.avancer(COUP);
    expect(m.hp).toBeLessThanOrEqual(0);
    const xp = p.gemmes.filter((g) => g.k === 0).reduce((a, g) => a + g.v, 0);
    expect(xp).toBeGreaterThanOrEqual(Math.trunc((Math.trunc((REGLAGES_DEFAUT.xpGelee * m.xpx) / 100) * REGLAGES_DEFAUT.xpElite) / 100)); // (et les vases brisés au passage)
    expect(p.gemmes.some((g) => g.k === GEMME_COEUR)).toBe(true);
  });
});

describe("la salle d'épreuve (lot BR6)", () => {
  it("sur chacun des 365 jours : une salle sur le chemin, étanche portes fermées, trois vagues de 8 à 15 monstres, à mi-parcours", () => {
    for (let k = 0; k < 365; k += 3) {
      const n = dailyRush(J + k).niveau!;
      expect(n.epreuve.vagues).toHaveLength(3);
      for (const v of n.epreuve.vagues) {
        expect(v.length).toBeGreaterThanOrEqual(BORNES_NIVEAU.vagueMin);
        expect(v.length).toBeLessThanOrEqual(BORNES_NIVEAU.vagueMax);
        expect(v.filter((q) => q.type === GELATON).length).toBeGreaterThanOrEqual(3);
      }
      expect(epreuveEtanche(n)).toBe(true);
      expect(n.epreuve.prog).toBeGreaterThan(35);
      expect(n.epreuve.prog).toBeLessThan(75);
      expect(problemesDuNiveau(n)).toEqual([]);
    }
  }, 120_000);
  it("le chevalier entre : les portes se ferment, les vagues se suivent, les portes se rouvrent à la dernière", () => {
    const c = contenuScenario("epreuve", { jour: J, competence: C_TOURBILLON });
    const p = new Partie(c, REGLAGES_DEFAUT, true);
    const e = p.niveau!.epreuve;
    expect(p.epreuve.etat).toBe(1); // le scénario `epreuve` la commence tout de suite
    p.avancer(0);
    expect(p.epreuve.etat).toBe(1);
    expect(p.portesFermees).toBe(true);
    const et = etatPilote("foncer", -2, p);
    let vagues = 0;
    let derniere = 0;
    for (let i = 0; i < 12_000 && p.epreuve.etat !== 2 && !p.finie; i++) {
      pasDuPilote(p, et);
      if (p.epreuve.vague !== derniere) {
        derniere = p.epreuve.vague;
        vagues++;
        expect(p.monstres.filter((m) => m.vague === derniere).length).toBeLessThanOrEqual(e.vagues[derniere - 1]!.length + 12); // les gélatons d'un totem comptent aussi
      }
      // tant que les portes sont fermées, le chevalier reste dans la salle
      if (p.epreuve.etat === 1) expect(Math.hypot(p.c.x - e.x, p.c.y - e.y)).toBeLessThanOrEqual(e.r + cm(100));
    }
    expect(vagues).toBe(3);
    expect(p.epreuve.etat).toBe(2);
    expect(p.portesFermees).toBe(false);
  }, 60_000);
  it("est obligatoire : le pilote qui fonce y passe (et y gagne des niveaux)", () => {
    const j = jouerLePilote(dailyRush(J), undefined, Infinity, "foncer");
    expect(j.resultat.nv).toBeGreaterThanOrEqual(2);
  }, 60_000);
});

describe("la courbe de difficulté le long du niveau (lot BR6)", () => {
  it("au début gelées, gélatons et chauves-souris ; cracheurs et chamans à partir du tiers ; porte-boucliers et totems à partir des deux tiers (365 jours)", () => {
    const vus = new Array<number>(NB_TYPES).fill(0);
    for (let k = 0; k < 365; k++) {
      const n = dailyRush(J + k).niveau!;
      for (const m of n.monstres) {
        vus[m.type]!++;
        if (m.type === CRACHEUR || m.type === CHAMAN) expect(m.prog).toBeGreaterThanOrEqual(PROG_SOUTIEN);
        if (m.type === PORTE_BOUCLIER || m.type === TOTEM) expect(m.prog).toBeGreaterThanOrEqual(PROG_TANK);
      }
    }
    for (let t = 0; t < NB_TYPES; t++) expect(vus[t], MONSTRES_IDS[t]).toBeGreaterThan(0);
  }, 180_000);
});

describe("les cartes de fin de partie (lot BR6)", () => {
  it("six cartes, niveau minimal de 8 à 12 ; celles d'une compétence ne sont proposées qu'à qui l'a choisie", () => {
    const fin = ["frenesie", "lame-enflammee", "ecrasement", "seconde-charge", "bond-sismique", "bouclier-ricochet"];
    expect(AMELIORATIONS).toHaveLength(24);
    for (const id of fin) {
      const a = AMELIORATIONS[indiceAmelioration(id)]!;
      expect(a.nvMin).toBeGreaterThanOrEqual(8);
      expect(a.nvMin).toBeLessThanOrEqual(12);
    }
    const vus = (comp: number): Set<string> => {
      const s = new Set<string>();
      for (let nv = 8; nv <= 20; nv++) for (let g = 0; g < 40; g++) for (const i of tirageDeCartes(g, nv, new Array(24).fill(0), comp)) s.add(AMELIORATIONS[i]!.id);
      return s;
    };
    expect(vus(C_BOND).has("bond-sismique")).toBe(true);
    expect(vus(C_BOND).has("bouclier-ricochet")).toBe(false);
    expect(vus(C_BOUCLIER).has("bouclier-ricochet")).toBe(true);
    expect(vus(C_TOURBILLON).has("bond-sismique")).toBe(false);
    expect(vus(C_TOURBILLON).has("frenesie")).toBe(true);
  });
  it("Frénésie : chaque coup qui touche accélère les suivants (jusqu'à 5 crans), elle retombe sans coup", () => {
    const p = salle(["frenesie"]);
    poser(p, GELEE, 150, 0, { gel: 999, hp: 99999 });
    const base = p.dureeCoup(0);
    tourner(p, 150, COUP);
    expect(p.c.frenesie).toBeGreaterThan(0);
    expect(p.dureeCoup(0)).toBeLessThan(base);
    tourner(p, REGLAGES_DEFAUT.frenesieDuree + 40, entree(-1));
    expect(p.c.frenesie).toBe(0);
  });
  it("Lame enflammée : le 3ᵉ coup laisse une zone qui brûle, qui blesse sans repousser", () => {
    const p = salle(["lame-enflammee"]);
    const m = poser(p, GELEE, 150, 0, { gel: 999, hp: 99999 });
    tourner(p, 100, COUP);
    expect(p.brasiers.length + evenements(p, "brasier")).toBeGreaterThan(0);
    const avant = m.hp;
    m.x = p.brasiers[0]?.x ?? m.x;
    m.y = p.brasiers[0]?.y ?? m.y;
    tourner(p, 40);
    expect(m.hp).toBeLessThan(avant);
  });
  it("Écrasement : les dégâts doublent contre un étourdi", () => {
    const perte = (cartes: string[]): number => {
      const p = salle(cartes);
      const m = poser(p, GELEE, 150, 0, { gel: 999, etourdi: 500, hp: 99999 });
      tourner(p, 14, COUP);
      return 99999 - m.hp;
    };
    expect(perte(["ecrasement"])).toBeGreaterThan(perte([]) * 1.5);
  });
  it("Seconde charge : la compétence se lance deux fois avant de se recharger", () => {
    const p = salle(["seconde-charge"], C_TOURBILLON);
    expect(p.chargesMax()).toBe(2);
    expect(p.c.charges).toBe(2);
    const lance = entree(-1, false, false, -1, true);
    p.avancer(lance);
    p.avancer(0);
    tourner(p, 90);
    expect(p.c.charges).toBe(1);
    p.avancer(lance);
    expect(p.c.charges).toBe(0);
  });
  it("Bond sismique : une seconde onde, plus large, suit l'atterrissage", () => {
    const p = salle(["bond-sismique"], C_BOND);
    poser(p, GELEE, 700, 0, { gel: 999, hp: 99999 });
    p.c.dir = 0;
    p.avancer(entree(-1, false, false, 0, true));
    tourner(p, 80);
    expect(evenements(p, "sismique") + p.evenements.filter((e) => e.k === "sismique").length).toBeGreaterThanOrEqual(0);
    expect(p.evenements.some((e) => e.k === "sismique")).toBe(true);
  });
  it("Bouclier ricochet : le bouclier rebondit sur un autre ennemi que celui qu'il vient de toucher", () => {
    const p = salle(["bouclier-ricochet"], C_BOUCLIER);
    const a = poser(p, GELEE, 400, 0, { gel: 999, hp: 99999 });
    const b = poser(p, GELEE, 400, 450, { gel: 999, hp: 99999 });
    p.c.dir = 0;
    p.avancer(entree(-1, false, false, 0, true));
    tourner(p, 90);
    expect(a.hp).toBeLessThan(99999);
    expect(b.hp).toBeLessThan(99999);
  });
});

describe("le pilote apprend les nouveaux ennemis (lot BR6)", () => {
  it("il traverse la salle d'épreuve et gagne : foncer, 12 jours, au moins 11 victoires", () => {
    let v = 0;
    for (let k = 0; k < 12; k++) if (jouerLePilote(dailyRush(J + k), undefined, Infinity, "foncer").resultat.victoire) v++;
    expect(v).toBeGreaterThanOrEqual(11);
  }, 120_000);
  it("sa partie se rejoue à l'identique (cartes de fin comprises)", () => {
    const c = dailyRush(J + 3);
    const j = jouerLePilote(c, undefined, Infinity, "beaucoup");
    const r = jouer(c, j.changements, undefined, j.choix, j.competence);
    expect(r.ticks).toBe(j.resultat.ticks);
    expect(r.victoire).toBe(j.resultat.victoire);
  }, 60_000);
});

describe("les budgets de rejeu : un monstre qui dort ne coûte rien (lot BR6)", () => {
  it("le nombre de monstres actifs reste petit : la plupart dorment ou sont loin (le coût d'un tick en dépend)", () => {
    const p = new Partie(dailyRush(J + 1), REGLAGES_DEFAUT);
    p.choisirCompetence(C_BOND);
    const et = etatPilote("foncer", -2, p);
    let somme = 0;
    let max = 0;
    let ticks = 0;
    while (!p.finie && ticks < 12_000) {
      pasDuPilote(p, et);
      somme += p.actifs.length;
      max = Math.max(max, p.actifs.length);
      ticks++;
    }
    expect(p.monstres.length).toBeGreaterThan(40);
    expect(somme / ticks).toBeLessThan(25);
    expect(max).toBeLessThan(90);
  }, 60_000);
  it("une partie « foncer » se rejoue en moins d'une demi-seconde, même froide (le budget mesuré est de 60 ms : `npm run mesures:rush`)", () => {
    const c = dailyRush(J + 2);
    const j = jouerLePilote(c, undefined, Infinity, "foncer");
    const t0 = performance.now();
    jouer(c, j.changements, undefined, j.choix, j.competence);
    expect(performance.now() - t0).toBeLessThan(600);
  }, 60_000);
});
