import { describe, expect, it } from "vitest";
import { daysFromCivil } from "@cdj/core";
import { encoderEnveloppe } from "@cdj/core/enveloppe";
import {
  AMELIORATIONS,
  ErreurRediffusion,
  idiv,
  MAX_CHOIX,
  NB_AMELIORATIONS,
  NB_CARTES,
  PRIORITES,
  Partie,
  REGLAGES_DEFAUT,
  STRATEGIES,
  RUSH_GENERATOR_VERSION,
  RUSH_SIM_VERSION,
  chargeDe,
  choisirCarte,
  cm,
  contenuScenario,
  dailyRush as dailyRushReel,
  decoderRediffusion,
  empreinteContenu,
  enregistrer,
  entree,
  etatPilote,
  indiceAmelioration,
  jouer,
  jouerJusqua,
  jouerLePilote,
  lireCharge,
  pasDuPilote,
  rejouer,
  tirageDeCartes,
  type Contenu,
  type Reglages,
} from "../src/index";

// Lot BR5 : le jour demande de choisir une compétence au départ ; ces essais jouent la première (le tourbillon) sans écran de choix.
const dailyRush = (jour: number, version?: number): Contenu => ({ ...dailyRushReel(jour, version), competence: 0 });

// Lot BR2 — l'XP (les gemmes, l'aimant, les niveaux), le choix d'une amélioration (le tirage, l'événement d'entrée, la validation par le serveur), chacune des 24 améliorations et les trois stratégies du pilote.
const J0 = daysFromCivil(2026, 11, 2);
const jour = (k = 0): Contenu => dailyRush(J0 + k);
const avec = (c: Contenu, ameliorations: string[]): Contenu => ({ ...c, ameliorations });
const attendre = (p: Partie, n: number, e = 0): void => {
  for (let i = 0; i < n; i++) p.avancer(e);
};
/** Une gemme posée à `x, y` (cm) par rapport au chevalier. */
/** La direction de la croix (0 à 31) qui suit le chemin au départ (un terrain dégagé devant le chevalier). */
const versLeChemin = (p: Partie): number => Math.round(p.c.dir / 4) % 32;
const gemme = (p: Partie, dx: number, dy: number, v = 10): void => {
  p.gemmes.push({ id: 900 + p.gemmes.length, x: p.c.x + cm(dx), y: p.c.y + cm(dy), v, k: 0, vers: false, age: p.tick });
};
const niveauPret = (p: Partie): void => {
  p.xp = p.xpSeuil(p.nv + 1) - 1;
  gemme(p, 30, 0, 5);
  attendre(p, 3);
};

describe("les gemmes et l'aimant", () => {
  it("un monstre tué lâche une gemme d'XP ; un monstre d'un camp vaut plus que celui du chemin", () => {
    const c = jour();
    const p = new Partie(c, REGLAGES_DEFAUT, true);
    const n = c.niveau!;
    const tous = [...p.monstres];
    for (const camp of [false, true]) {
      const idx = n.monstres.findIndex((m) => m.type === 0 && (m.camp >= 0) === camp);
      expect(idx).toBeGreaterThanOrEqual(0);
      const m = tous[idx]!;
      p.monstres = [m]; // seul : un coup qui en tue d'autres (les camps du lot BR5 sont serrés) lâcherait leurs gemmes
      p.c.x = m.x - cm(120);
      p.c.y = m.y;
      p.c.dir = 0;
      m.hp = 1;
      const avant = p.gemmes.length;
      for (let t = 0; t < 40 && p.gemmes.length === avant; t++) p.avancer(entree(-1, true, false, 0));
      const g = p.gemmes.find((q) => q.x === m.x && q.y === m.y) ?? p.gemmes[p.gemmes.length - 1]!;
      expect(g.v).toBe(camp ? Math.trunc((REGLAGES_DEFAUT.xpGelee * REGLAGES_DEFAUT.xpCamp) / 100) : REGLAGES_DEFAUT.xpGelee);
      attendre(p, 120); // ramassée par l'aimant (ou laissée si trop loin) : on revient au monstre suivant
    }
    expect(p.tues).toBe(2);
  });
  it("les scénarios d'essai n'ont pas d'XP (pas de niveau du jour)", () => {
    const p = new Partie(contenuScenario("boss"), REGLAGES_DEFAUT);
    p.monstres.push({ ...jouerPremierMonstre(), hp: 1 });
    expect(p.gemmes).toEqual([]);
  });
  it("l'aimant (≈ 3 m) attire la gemme jusqu'au chevalier ; une gemme plus loin reste où elle est, pour toujours", () => {
    const p = new Partie(jour(), REGLAGES_DEFAUT);
    gemme(p, 250, 0, 10);
    gemme(p, 0, 450, 7);
    attendre(p, 60);
    expect(p.xp).toBe(10);
    expect(p.gemmes).toHaveLength(1);
    expect(p.gemmes[0]!.vers).toBe(false);
    attendre(p, 3000); // ne disparaît jamais
    expect(p.gemmes).toHaveLength(1);
    expect(p.xp).toBe(10);
    // le chevalier s'approche : elle vole à lui et ne s'arrête plus
    p.c.y = p.gemmes[0]!.y - cm(280);
    p.c.x = p.gemmes[0]!.x;
    attendre(p, 40);
    expect(p.xp).toBe(17);
    expect(p.gemmes).toHaveLength(0);
  });
  it("une gemme aimantée suit le chevalier même s'il s'éloigne : elle est plus rapide que la pleine course", () => {
    const p = new Partie(jour(), REGLAGES_DEFAUT);
    gemme(p, 200, 0, 4);
    attendre(p, 2);
    expect(p.gemmes[0]!.vers).toBe(true);
    attendre(p, 120, entree(16)); // il court vers la gauche
    expect(p.xp).toBe(4);
  });
  it("l'XP fait partie de l'état (empreinte), ainsi que les gemmes", () => {
    const a = new Partie(jour());
    const b = new Partie(jour());
    expect(a.empreinte()).toBe(b.empreinte());
    gemme(a, 400, 0);
    expect(a.empreinte()).not.toBe(b.empreinte());
  });
});

function jouerPremierMonstre() {
  return new Partie(jour()).monstres.find((q) => q.type === 0)!;
}

describe("les niveaux et le monde figé", () => {
  it("le niveau 2 s'atteint à xpBase points, puis chaque niveau coûte xpPas de plus", () => {
    const p = new Partie(jour());
    const r = REGLAGES_DEFAUT;
    expect([1, 2, 3, 4, 5].map((n) => p.xpSeuil(n))).toEqual([0, r.xpBase, 2 * r.xpBase + r.xpPas, 3 * r.xpBase + 3 * r.xpPas, 4 * r.xpBase + 6 * r.xpPas]);
  });
  it("un niveau gagné ouvre un choix de trois cartes et FIGE le monde (le tick ne passe plus) jusqu'au choix", () => {
    const p = new Partie(jour(), REGLAGES_DEFAUT, true);
    p.xp = p.xpSeuil(2) - 5;
    attendre(p, 3);
    expect(p.choix).toBeNull();
    gemme(p, 30, 0, 5);
    attendre(p, 5);
    expect(p.nv).toBe(2);
    expect(p.choix!.nv).toBe(2);
    expect(p.choix!.cartes).toHaveLength(NB_CARTES);
    expect(p.evenements.some((e) => e.k === "niveau" && e.a === 2)).toBe(true);
    const t = p.tick;
    const x = p.c.x;
    attendre(p, 600, entree(0, true, true));
    expect(p.tick).toBe(t); // le chrono (les ticks) est arrêté
    expect(p.c.x).toBe(x);
    expect(p.finie).toBe(false);
  });
  it("le choix refuse un autre niveau, une carte qui n'existe pas, et tout hors d'un niveau gagné ; il accepte la bonne carte", () => {
    const p = new Partie(jour());
    expect(p.choisir(2, 0)).toBe(false); // aucun niveau gagné
    niveauPret(p);
    expect(p.choix).not.toBeNull();
    for (const [nv, i] of [[1, 0], [3, 0], [2, -1], [2, 3], [2, 0.5]] as const) expect(p.choisir(nv, i)).toBe(false);
    expect(p.choix).not.toBeNull();
    const carte = p.choix!.cartes[1]!;
    expect(p.choisir(2, 1)).toBe(true);
    expect(p.choix).toBeNull();
    expect(p.choisir(2, 1)).toBe(false); // déjà fait
    expect(p.paliers[carte]).toBe(carte === indiceAmelioration("soin") ? 0 : 1);
  });
  it("assez d'XP pour plusieurs niveaux à la fois : un choix après l'autre", () => {
    const p = new Partie(jour());
    gemme(p, 30, 0, 400);
    attendre(p, 3);
    const niveaux: number[] = [];
    for (let i = 0; i < 10 && p.choix; i++) {
      niveaux.push(p.choix.nv);
      expect(p.choisir(p.choix.nv, 0)).toBe(true);
    }
    expect(niveaux.slice(0, 3)).toEqual([2, 3, 4]);
    expect(p.nv).toBe(niveaux[niveaux.length - 1]);
  });
  it("le scénario « cartes » ouvre le choix tout de suite, au niveau demandé (2 par défaut)", () => {
    const c = contenuScenario("cartes", { jour: J0 + 3, nv: 5 });
    expect(c.niveau).not.toBeNull();
    const p = new Partie(c);
    expect(p.choix!.nv).toBe(5);
    expect(p.choix!.cartes).toEqual(tirageDeCartes(c.graine, 5, new Array(NB_AMELIORATIONS).fill(0)));
    expect(new Partie(contenuScenario("cartes", { jour: J0 + 3 })).choix!.nv).toBe(2);
  });
});

describe("le tirage des cartes (graine du jour + numéro du niveau)", () => {
  const zero = new Array<number>(NB_AMELIORATIONS).fill(0);
  it("trois cartes différentes, toujours les mêmes pour un même jour et un même niveau (donc les mêmes pour tous)", () => {
    const g = jour().graine;
    for (let nv = 2; nv < 14; nv++) {
      const a = tirageDeCartes(g, nv, zero);
      expect(a).toHaveLength(3);
      expect(new Set(a).size).toBe(3);
      expect(tirageDeCartes(g, nv, zero)).toEqual(a);
    }
  });
  it("le tirage change d'un niveau à l'autre et d'un jour à l'autre", () => {
    const g = jour().graine;
    const par = (graine: number): string => Array.from({ length: 8 }, (_, i) => tirageDeCartes(graine, i + 2, zero).join(".")).join("|");
    expect(new Set(Array.from({ length: 8 }, (_, i) => tirageDeCartes(g, i + 2, zero).join(".")).filter(Boolean)).size).toBeGreaterThan(4);
    expect(par(g)).not.toBe(par(jour(1).graine));
  });
  it("jamais une carte au maximum de ses paliers ; les cartes rares ne viennent qu'à partir de leur niveau", () => {
    const g = jour().graine;
    for (let nv = 2; nv < 40; nv++) {
      const paliers = zero.map((_, i) => (i % 2 === 0 ? AMELIORATIONS[i]!.max : 0)).map((v) => (v === Infinity ? 0 : v));
      for (const i of tirageDeCartes(g, nv, paliers)) {
        expect(paliers[i]!).toBeLessThan(AMELIORATIONS[i]!.max);
        expect(nv).toBeGreaterThanOrEqual(AMELIORATIONS[i]!.nvMin);
      }
    }
    // toutes les cartes sont pleines sauf une : elle seule est offerte
    const pleines = AMELIORATIONS.map((a, i) => (i === indiceAmelioration("soin") ? 0 : a.max));
    expect(tirageDeCartes(g, 30, pleines)).toEqual([indiceAmelioration("soin")]);
  });
  it("un joueur qui n'a rien pris au maximum voit le tirage de tout le monde : deux parties au même niveau", () => {
    const a = new Partie(jour(2));
    const b = new Partie(jour(2));
    niveauPret(a);
    niveauPret(b);
    expect(a.choix!.cartes).toEqual(b.choix!.cartes);
  });
  it("le catalogue : 24 améliorations (lot BR5 : 4 cartes de compétence ; lot BR6 : 6 cartes de fin de partie), cumulables jusqu'à 3 fois sauf celles qui sont uniques ; le soin peut revenir", () => {
    expect(NB_AMELIORATIONS).toBe(24);
    const uniques = AMELIORATIONS.filter((a) => a.max === 1).map((a) => a.id);
    expect(uniques.sort()).toEqual(["bond-sismique", "bouclier-ricochet", "echo", "ecrasement", "esquive-tranchante", "frenesie", "lame-enflammee", "moulinet", "onde-epee", "seconde-charge", "vol-de-vie"]);
    expect(AMELIORATIONS.find((a) => a.id === "soin")!.max).toBe(Infinity);
    expect(AMELIORATIONS.filter((a) => a.max === 3)).toHaveLength(11);
    expect(AMELIORATIONS.find((a) => a.id === "signature")!.max).toBe(2);
    expect(AMELIORATIONS.filter((a) => a.famille === "competence").map((a) => a.id)).toEqual(["recharge-vive", "maitrise", "echo", "signature", "seconde-charge", "bond-sismique", "bouclier-ricochet"]);
  });
});

describe("chacune des améliorations", () => {
  const pal = (ids: string[], c = jour()): Partie => new Partie(avec(c, ids), REGLAGES_DEFAUT, true);
  const R: Reglages = REGLAGES_DEFAUT;
  it("Lame lourde : plus de dégâts, un coup un peu plus long", () => {
    const a = pal([]);
    const b = pal(["lame-lourde", "lame-lourde"]);
    expect(b.degatsCoup(0)).toBe(Math.trunc((a.degatsCoup(0) * (100 + 2 * R.lourdeDegats)) / 100));
    expect(b.degatsCoup(2)).toBeGreaterThan(a.degatsCoup(2));
    expect(b.dureeCoup(0)).toBeGreaterThan(a.dureeCoup(0));
  });
  it("Allonge : plus de portée et un arc plus large", () => {
    const a = pal([]);
    const b = pal(["allonge"]);
    expect(b.porteeCoup(0)).toBeGreaterThan(a.porteeCoup(0));
    expect(b.arcCoup(0)).toBe(a.arcCoup(0) + R.allongeArc);
  });
  it("Cadence : un coup plus rapide (sans jamais descendre sous la moitié)", () => {
    const a = pal([]);
    const b = pal(["cadence"]);
    expect(b.dureeCoup(0)).toBeLessThan(a.dureeCoup(0));
    expect(b.impactCoup(0)).toBeLessThanOrEqual(a.impactCoup(0));
    const c = pal(["cadence", "cadence", "cadence", "cadence"]);
    expect(c.dureeCoup(0)).toBeGreaterThanOrEqual(Math.trunc(a.dureeCoup(0) / 2));
  });
  it("Moulinet : le 3ᵉ coup frappe tout autour (le coup 1 garde son arc)", () => {
    expect(pal(["moulinet"]).arcCoup(2)).toBe(180);
    expect(pal(["moulinet"]).arcCoup(0)).toBe(pal([]).arcCoup(0));
    for (const [id, derriere] of [[[], false], [["moulinet"], true]] as const) {
      const p = pal([...id]);
      const m = p.monstres.find((q) => q.type === 0)!;
      m.hp = 1000;
      p.c.x = m.x + cm(130); // le monstre est DERRIÈRE le chevalier, qui regarde à droite
      p.c.y = m.y;
      p.c.dir = 0;
      p.c.combo = 2;
      p.coupId = 1;
      (p as unknown as { frapper(): void }).frapper();
      expect(m.hp < 1000).toBe(derriere);
    }
  });
  it("Onde d'épée : le 3ᵉ coup lance une onde qui blesse chaque cible une seule fois", () => {
    const p = pal(["onde-epee"]);
    p.vases = []; // (les vases d'un camp, brisés par l'onde, donneraient assez d'XP pour ouvrir un choix : le monde se figerait)
    const m = p.monstres.find((q) => q.type === 0)!;
    m.hp = 1000;
    p.c.x = m.x - cm(500);
    p.c.y = m.y;
    p.c.dir = 0;
    p.c.combo = 2;
    (p as unknown as { frapper(): void }).frapper();
    expect(p.ondesEpee).toHaveLength(1);
    expect(p.evenements.some((e) => e.k === "ondeEpee")).toBe(true);
    attendre(p, 60);
    const touche = 1000 - m.hp;
    expect(touche).toBeGreaterThan(0);
    attendre(p, 60);
    expect(1000 - m.hp).toBe(touche);
    expect(p.ondesEpee).toHaveLength(0); // l'onde est courte
    const sans = pal([]);
    sans.c.combo = 2;
    (sans as unknown as { frapper(): void }).frapper();
    expect(sans.ondesEpee).toHaveLength(0);
  });
  it("Bottes légères : le chevalier va plus vite, à la marche comme à la course", () => {
    const parcours = (ids: string[]): number => {
      const p = pal(ids);
      const x = p.c.x;
      const y = p.c.y;
      attendre(p, 30, entree(versLeChemin(p)));
      return Math.hypot(p.c.x - x, p.c.y - y);
    };
    expect(parcours(["bottes-legeres"])).toBeGreaterThan(parcours([]) * 1.2);
    expect(parcours(["bottes-legeres", "bottes-legeres", "bottes-legeres"])).toBeGreaterThan(parcours(["bottes-legeres"]));
  });
  it("Esquive longue, Esquive vive, Esquive tranchante", () => {
    const dash = (ids: string[]): { d: number; attente: number } => {
      const p = pal(ids);
      const x = p.c.x;
      const y = p.c.y;
      attendre(p, 20, entree(versLeChemin(p), false, true));
      return { d: Math.hypot(p.c.x - x, p.c.y - y), attente: p.c.attente };
    };
    expect(dash(["esquive-longue"]).d).toBeGreaterThan(dash([]).d * 1.15);
    expect(dash(["esquive-vive"]).attente).toBeLessThan(dash([]).attente);
    // l'esquive tranchante blesse ce qu'elle traverse, une seule fois
    const p = pal(["esquive-tranchante"]);
    const m = p.monstres.find((q) => q.type === 0)!;
    m.hp = 1000;
    p.c.x = m.x - cm(150);
    p.c.y = m.y;
    p.c.dir = 0;
    attendre(p, 14, entree(0, false, true));
    const perdu = 1000 - m.hp;
    expect(perdu).toBeGreaterThan(0);
    expect(perdu).toBeLessThanOrEqual(Math.trunc(p.degatsCoup(0) * 1.2));
    const sans = pal([]);
    const m2 = sans.monstres.find((q) => q.type === 0)!;
    m2.hp = 1000;
    sans.c.x = m2.x - cm(150);
    sans.c.y = m2.y;
    attendre(sans, 14, entree(0, false, true));
    expect(m2.hp).toBe(1000);
  });
  it("Cœur en plus : +1 cœur au plus, et un soin ; Soin : rend 1 cœur, et peut revenir", () => {
    const p = pal(["coeur-en-plus"]);
    expect(p.c.coeursMax).toBe(4);
    expect(p.c.coeurs).toBe(4);
    const q = new Partie(jour());
    q.c.coeurs = 1;
    niveauPret(q);
    q.choix!.cartes[0] = indiceAmelioration("soin");
    expect(q.choisir(2, 0)).toBe(true);
    expect(q.c.coeurs).toBe(2);
    expect(q.paliers[indiceAmelioration("soin")]).toBe(0); // jamais au maximum : il peut revenir
    q.c.coeurs = 3;
    q.choix = { nv: 3, cartes: [indiceAmelioration("soin"), 0, 1] };
    q.choisir(3, 0);
    expect(q.c.coeurs).toBe(3); // jamais au-dessus du maximum
  });
  it("Vol de vie : un cœur tous les N monstres tués", () => {
    const p = pal(["vol-de-vie"]);
    const m = p.monstres.find((q) => q.type === 0)!;
    p.c.coeurs = 1;
    p.tues = REGLAGES_DEFAUT.volVie - 1;
    p.c.x = m.x - cm(120);
    p.c.y = m.y;
    p.c.dir = 0;
    m.hp = 1;
    for (let t = 0; t < 40 && p.tues < REGLAGES_DEFAUT.volVie; t++) p.avancer(entree(-1, true, false, 0));
    expect(p.tues).toBeGreaterThanOrEqual(REGLAGES_DEFAUT.volVie);
    expect(p.c.coeurs).toBe(2);
  });
  it("Brise-pierre : plus de dégâts contre le golem seulement", () => {
    const golem = { ...jour(), boss: 0 };
    const a = pal([], golem);
    const b = pal(["brise-pierre", "brise-pierre"], golem);
    expect(b.degatsContreGolem(100)).toBe(100 + 2 * REGLAGES_DEFAUT.briseDegats);
    expect(a.degatsContreGolem(100)).toBe(100);
    expect(b.degatsCoup(0)).toBe(a.degatsCoup(0));
    // lot BR3 : les autres boss l'encaissent mal (35 %), sauf le bélier de carrière (la pierre, 100 %)
    expect(pal(["brise-pierre", "brise-pierre"], { ...jour(), boss: 1 }).degatsContreGolem(100)).toBe(100 + idiv(2 * REGLAGES_DEFAUT.briseDegats * 35, 100));
    expect(pal(["brise-pierre", "brise-pierre"], { ...jour(), boss: 3 }).degatsContreGolem(100)).toBe(100 + 2 * REGLAGES_DEFAUT.briseDegats);
  });
  it("Aimant : le rayon des gemmes grandit (×2 au maximum)", () => {
    for (const [ids, ramasse] of [[[], false], [["aimant", "aimant", "aimant"], true]] as const) {
      const p = pal([...ids]);
      gemme(p, 520, 0, 3);
      attendre(p, 80);
      expect(p.xp === 3).toBe(ramasse);
    }
  });
  it("une amélioration au maximum de ses paliers ne se prend plus", () => {
    const p = pal(["moulinet", "moulinet", "moulinet"]);
    expect(p.paliers[indiceAmelioration("moulinet")]).toBe(1);
  });
});

describe("la rediffusion porte les choix (événement d'entrée) et le serveur les valide", () => {
  const c = jour(1);
  const r = jouerLePilote(c, REGLAGES_DEFAUT, Infinity, "beaucoup");
  it("des choix dans la charge : écrits, relus, rejoués au bit près", () => {
    expect(r.choix.length).toBeGreaterThanOrEqual(5);
    const texte = enregistrer(c, r.changements, r.choix);
    const d = decoderRediffusion(texte);
    expect(d.choix).toEqual(r.choix);
    expect(d.changements).toEqual(r.changements);
    expect(rejouer(c, texte)).toEqual(r.resultat);
    // les niveaux se suivent : 2, 3, 4… ; chaque index est 0, 1 ou 2
    expect(r.choix.map((x) => x.nv)).toEqual(r.choix.map((_, i) => i + 2));
    for (const x of r.choix) expect([0, 1, 2]).toContain(x.carte);
  });
  it("un choix manquant, en trop, au mauvais niveau ou à une carte inexistante est refusé", () => {
    const refus = (choix: typeof r.choix): string => {
      try {
        rejouer(c, enregistrer(c, r.changements, choix));
      } catch (e) {
        expect(e).toBeInstanceOf(ErreurRediffusion);
        return (e as ErreurRediffusion).code;
      }
      return "accepté";
    };
    expect(refus(r.choix)).toBe("accepté");
    expect(refus(r.choix.slice(0, -1))).toBe("choix_invalide"); // le dernier niveau gagné n'a pas de choix
    expect(refus([])).toBe("choix_invalide");
    expect(refus([...r.choix, { tick: 30000, nv: r.choix.length + 2, carte: 0 }])).toBe("choix_invalide"); // un choix sans niveau gagné
    expect(refus(r.choix.map((x, i) => (i === 1 ? { ...x, nv: x.nv + 1 } : x)))).toBe("choix_invalide"); // un autre niveau que celui qui vient d'être gagné
    expect(refus([{ tick: 10, nv: 2, carte: 0 }, ...r.choix.slice(1)])).not.toBe("");
  });
  it("une carte hors de 0 à 2 est illisible (format), un choix sans niveau aussi", () => {
    const tel = (octets: number[]) => () => decoderRediffusion(encoderEnveloppe({ sim: RUSH_SIM_VERSION, g: RUSH_GENERATOR_VERSION, contenu: { jour: c.jour }, charge: octets }));
    expect(tel([5, 2, 128 + 3])).toThrow(); // carte 3
    expect(tel([5, 0, 128])).toThrow(); // niveau 0
    expect(tel([5, 2, 128 + 2])).not.toThrow();
  });
  it("au plus MAX_CHOIX choix", () => {
    const trop = Array.from({ length: MAX_CHOIX + 1 }, (_, i) => ({ tick: i + 1, nv: 2, carte: 0 }));
    expect(() => lireCharge(chargeDe([], trop))).toThrow(/choix/);
    expect(lireCharge(chargeDe([], trop.slice(0, MAX_CHOIX))).choix).toHaveLength(MAX_CHOIX);
  });
  it("les choix et les changements se fondent dans l'ordre des ticks, sans rien perdre", () => {
    const ch = [{ tick: 3, e: entree(2) }, { tick: 9, e: 0 }, { tick: 20, e: entree(5, true) }];
    const cx = [{ tick: 9, nv: 2, carte: 1 }, { tick: 20, nv: 3, carte: 2 }];
    const lu = lireCharge(chargeDe(ch, cx));
    expect(lu.changements).toEqual(ch);
    expect(lu.choix).toEqual(cx);
  });
  it("jouerJusqua s'arrête au niveau gagné quand le choix manque (un essai, pas une erreur)", () => {
    const j = jouerJusqua(c, r.changements, 40000, REGLAGES_DEFAUT, []);
    expect(j.resultat.victoire).toBe(false);
    expect(j.ticks).toBeLessThan(r.ticks);
  });
  it("jouer sans les choix du pilote : une partie qui a gagné un niveau ne se rejoue pas sans eux", () => {
    expect(() => jouer(c, r.changements, REGLAGES_DEFAUT, [])).toThrow(ErreurRediffusion);
  });
  it("l'empreinte d'un contenu de scénario compte les améliorations et le niveau, pas celle d'un jour", () => {
    expect(empreinteContenu(contenuScenario("boss"))).not.toBe(empreinteContenu(contenuScenario("boss", { ameliorations: ["moulinet"] })));
    expect(empreinteContenu(contenuScenario("cartes", { jour: J0, nv: 3 }))).not.toBe(empreinteContenu(contenuScenario("cartes", { jour: J0, nv: 4 })));
    expect(contenuScenario("boss", { ameliorations: ["moulinet", "inconnue"] }).ameliorations).toEqual(["moulinet"]);
  });
});

describe("les trois stratégies du pilote", () => {
  it("chaque liste de priorités nomme les 24 améliorations, une fois chacune", () => {
    for (const s of STRATEGIES) expect([...PRIORITES[s]].sort()).toEqual(AMELIORATIONS.map((a) => a.id).sort());
  });
  it("le pilote prend la première carte de sa liste qui est offerte", () => {
    const p = new Partie(jour());
    p.choix = { nv: 2, cartes: [indiceAmelioration("aimant"), indiceAmelioration("lame-lourde"), indiceAmelioration("soin")] };
    expect(choisirCarte(p, "foncer")).toBe(1);
    p.choix = { nv: 2, cartes: [indiceAmelioration("aimant"), indiceAmelioration("soin"), indiceAmelioration("bottes-legeres")] };
    expect(choisirCarte(p, "beaucoup")).toBe(2);
  });
  it("foncer, un peu d'XP et beaucoup d'XP gagnent le jour ; plus on chasse l'XP, plus on monte de niveaux", () => {
    const c = jour(3);
    const par = Object.fromEntries(STRATEGIES.map((s) => [s, jouerLePilote(c, REGLAGES_DEFAUT, Infinity, s)])) as Record<(typeof STRATEGIES)[number], ReturnType<typeof jouerLePilote>>;
    for (const s of STRATEGIES) expect(par[s].resultat.victoire).toBe(true);
    expect(par.foncer.resultat.nv).toBeLessThanOrEqual(6); // lot BR6 : la salle d'épreuve lui donne 3 ou 4 niveaux
    expect(par.beaucoup.resultat.nv).toBeGreaterThanOrEqual(9);
    expect(par.peu.resultat.nv).toBeGreaterThanOrEqual(par.foncer.resultat.nv);
    expect(par.beaucoup.resultat.tues).toBeGreaterThanOrEqual(par.peu.resultat.tues); // lot BR5 : égalité possible (les camps proches sont les mêmes)
    // et sur plusieurs jours, chasser tous les camps tue strictement plus que chasser les proches
    let plus = 0;
    for (let k = 4; k < 10; k++) {
      const cj = dailyRushReel(J0 + k);
      if (jouerLePilote(cj, REGLAGES_DEFAUT, Infinity, "beaucoup").resultat.tues > jouerLePilote(cj, REGLAGES_DEFAUT, Infinity, "peu").resultat.tues) plus++;
    }
    expect(plus).toBeGreaterThan(0);
  });
  it("le pilote joue pas à pas avec ses choix : même résultat que jouerLePilote", () => {
    const c = jour(4);
    const p = new Partie(c);
    const e = etatPilote("peu", -2, p);
    while (!p.finie) pasDuPilote(p, e);
    expect(p.resultat()).toEqual(jouerLePilote(c, REGLAGES_DEFAUT, Infinity, "peu").resultat);
  });
  it("le combat contre le golem sans amélioration : il se gagne, en 2 à 4 minutes (lot BR6 : 7 500 points de vie ; les cartes de la salle d'épreuve et des camps le raccourcissent)", () => {
    const r = jouerLePilote(contenuScenario("boss"), REGLAGES_DEFAUT, 36000);
    expect(r.resultat.victoire).toBe(true);
    expect(r.ticks / 60).toBeGreaterThan(120);
    expect(r.ticks / 60).toBeLessThan(260);
  });
  it("un build complet bat le golem en quelques secondes", () => {
    const tout = ["lame-lourde", "lame-lourde", "lame-lourde", "cadence", "cadence", "cadence", "brise-pierre", "brise-pierre", "brise-pierre"];
    const r = jouerLePilote(contenuScenario("boss", { ameliorations: tout }), REGLAGES_DEFAUT, 36000);
    expect(r.resultat.victoire).toBe(true);
    expect(r.ticks / 60).toBeLessThan(90); // lot BR6 : 7 500 points de vie (15 s à 2 200)
  });
});

describe("l'équilibre (lots BR2 et BR6) : chaque stratégie est la plus rapide sur une part des jours", () => {
  // **Lot BR6 : la cible suspendue en BR5 est rétablie** — chaque stratégie la plus rapide sur ~15 % des jours au moins, aucune sur plus de ~60 % (mesuré sur 365 jours : `npm run equilibre:rush`, README du lot). Sur 30 jours le hasard de l'échantillon est grand : on
  // vérifie le plancher à 8 % et le plafond à 70 %.
  it("sur 30 jours, chacune des trois stratégies est la plus rapide sur 8 % des jours au moins, aucune sur plus de 70 % (365 jours : 15 à 60 %, README du lot)", () => {
    const jours = 30;
    const gagnant = new Map<string, number>(STRATEGIES.map((s) => [s, 0]));
    for (let k = 0; k < jours; k++) {
      const t = STRATEGIES.map((s) => {
        const r = jouerLePilote(dailyRushReel(J0 + k), REGLAGES_DEFAUT, Infinity, s);
        return r.resultat.victoire ? r.ticks : 99999;
      });
      const s = STRATEGIES[t.indexOf(Math.min(...t))]!;
      gagnant.set(s, gagnant.get(s)! + 1);
    }
    for (const s of STRATEGIES) {
      expect(gagnant.get(s)! / jours, `${s} : ${[...gagnant].join(" ")}`).toBeLessThanOrEqual(0.7);
      expect(gagnant.get(s)! / jours, `${s} : ${[...gagnant].join(" ")}`).toBeGreaterThanOrEqual(0.08);
    }
  }, 400_000);
});
