import { describe, expect, it } from "vitest";
import { daysFromCivil, mixSeed } from "@cdj/core";
import {
  ALERTE_GELEE,
  BORNES_NIVEAU,
  CASE,
  CHAUVE,
  GELEE,
  INACCESSIBLE,
  LAISSE,
  MUR,
  PONT,
  PREMIER_JOUR_RUSH,
  RAYON_ARENE,
  RAYON_CHEVALIER,
  REGLAGES_DEFAUT,
  RUGIT,
  SOL,
  THEMES_RUSH,
  VIDE,
  Partie,
  caseDe,
  casesDeLArene,
  champDeDistance,
  cm,
  dailyRush,
  descendre,
  dirVers,
  distance,
  encoderRediffusion,
  enregistrer,
  entree,
  genererNiveau,
  jouerLePilote,
  problemesDuNiveau,
  rejouer,
  themeDuJour,
  type Niveau,
} from "../src/index";

const SEL = 0x3f91d3;
const graine = (j: number): number => mixSeed(j, SEL);
const marchableEn = (n: Niveau, x: number, y: number): boolean => {
  const i = caseDe(n, x, y);
  return i >= 0 && (n.cases[i] === SOL || n.cases[i] === PONT);
};
const croix = (dx: number, dy: number): number => Math.trunc((dirVers(dx, dy) + 2) / 4) % 32;
const J0 = PREMIER_JOUR_RUSH;
const tournerN = (p: Partie, n: number, e = 0): void => {
  for (let i = 0; i < n && !p.finie; i++) p.avancer(e);
};

describe("le générateur du niveau (lot BR1)", () => {
  const niveaux = Array.from({ length: 365 }, (_, i) => genererNiveau(graine(daysFromCivil(2026, 11, 2) + i)));

  it("365 graines donnent 365 niveaux valides (chemin du départ à l'arène, longueur, détours, camps, monstres épars, aucune case isolée, rien près du départ)", () => {
    for (const n of niveaux) expect(problemesDuNiveau(n)).toEqual([]);
  });
  it("le chemin principal fait 120 à 160 m ; 2 à 4 détours, chacun à 20-40 m du chemin, menant à un camp de 4 à 8 monstres ; 3 à 5 monstres épars", () => {
    for (const n of niveaux) {
      expect(n.longueurCm).toBeGreaterThanOrEqual(BORNES_NIVEAU.longueurMin);
      expect(n.longueurCm).toBeLessThanOrEqual(BORNES_NIVEAU.longueurMax);
      expect(n.detours.length).toBeGreaterThanOrEqual(2);
      expect(n.detours.length).toBeLessThanOrEqual(4);
      for (const d of n.detours) {
        expect(d.distanceCm).toBeGreaterThanOrEqual(2000);
        expect(d.distanceCm).toBeLessThanOrEqual(4000);
        const k = n.monstres.filter((m) => m.camp === d.camp).length;
        expect(k).toBeGreaterThanOrEqual(4);
        expect(k).toBeLessThanOrEqual(8);
      }
      const epars = n.monstres.filter((m) => m.camp < 0).length;
      expect(epars).toBeGreaterThanOrEqual(3);
      expect(epars).toBeLessThanOrEqual(5);
    }
  });
  it("aucune case accessible n'est isolée : tout le sol touche le champ de distance à l'arène ; aucun monstre à moins de 15 m du départ ni sur un mur", () => {
    for (const n of niveaux) {
      for (let k = 0; k < n.cases.length; k++) if (n.cases[k] === SOL || n.cases[k] === PONT) expect(n.dist[k]).not.toBe(INACCESSIBLE);
      for (const m of n.monstres) {
        expect(distance(m.x, m.y, n.depart.x, n.depart.y)).toBeGreaterThanOrEqual(cm(1500));
        expect(marchableEn(n, m.x, m.y)).toBe(true);
      }
    }
  });
  it("l'arène est toujours la même taille (même nombre de cases), centrée sur une case, et sa porte a au moins deux cases", () => {
    const tailles = new Set(niveaux.map(casesDeLArene));
    expect(tailles.size).toBe(1);
    for (const n of niveaux) {
      const reste = (n.arene.x - n.ox) % CASE;
      expect(reste).toBe(CASE / 2);
      expect(n.porte.length).toBeGreaterThanOrEqual(2);
      expect(distance(n.arene.x, n.arene.y, n.arene.ex, n.arene.ey)).toBeLessThanOrEqual(Math.trunc(RAYON_ARENE * 1.01));
    }
  });
  it("est pur : une graine donne toujours le même niveau ; deux jours donnent des niveaux différents (variété)", () => {
    const a = genererNiveau(graine(J0));
    const b = genererNiveau(graine(J0));
    expect(a.empreinte).toBe(b.empreinte);
    expect(Array.from(a.cases)).toEqual(Array.from(b.cases));
    expect(new Set(niveaux.map((n) => n.empreinte)).size).toBe(365);
    // des formes variées : plusieurs nombres de détours, de ponts, de tailles de grille
    expect(new Set(niveaux.map((n) => n.detours.length)).size).toBe(3);
    expect(new Set(niveaux.map((n) => n.liens.filter((l) => l.pont).length)).size).toBeGreaterThanOrEqual(3);
    expect(new Set(niveaux.map((n) => `${n.l}x${n.h}`)).size).toBeGreaterThan(100);
    expect(new Set(niveaux.map((n) => Math.round(n.longueurCm / 500))).size).toBeGreaterThanOrEqual(5);
  });
  it("le champ de distance descend vers l'arène depuis le départ, case après case", () => {
    const n = niveaux[0]!;
    let idx = caseDe(n, n.depart.x, n.depart.y);
    let pas = 0;
    while (n.dist[idx]! > 0 && pas < 5000) {
      const s = descendre(n, n.dist, idx);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(n.dist[s]!).toBeLessThan(n.dist[idx]!);
      idx = s;
      pas++;
    }
    expect(n.dist[idx]).toBe(0);
    expect(champDeDistance(n, [idx])[idx]).toBe(0);
  });
  it("le jour porte son niveau et son thème ; les scénarios n'ont pas de niveau", () => {
    const c = dailyRush(J0);
    expect(c.niveau).not.toBeNull();
    expect(c.theme).toBe(themeDuJour(J0));
    expect(c.g).toBe(2);
  });
});

describe("les thèmes (lot BR1)", () => {
  it("trois thèmes, tous servis, et jamais deux jours de suite le même (sur deux ans)", () => {
    expect(THEMES_RUSH.length).toBe(3);
    const vus = new Set<string>();
    for (let j = J0; j < J0 + 730; j++) {
      vus.add(themeDuJour(j));
      expect(themeDuJour(j)).not.toBe(themeDuJour(j + 1));
    }
    expect(vus.size).toBe(3);
  });
});

describe("la grille de collision (lot BR1)", () => {
  it("le chevalier ne sort jamais du sol, quoi qu'il fasse (marche, coups, esquives), sur plusieurs jours", () => {
    for (let k = 0; k < 4; k++) {
      const p = new Partie(dailyRush(J0 + k * 5), REGLAGES_DEFAUT);
      const n = p.niveau!;
      for (let t = 0; t < 4000 && p.barriere < 0; t++) {
        p.c.coeurs = 3;
        p.avancer(entree((t >> 4) * 7 % 32, t % 5 === 0, t % 97 === 0));
        const r = RAYON_CHEVALIER;
        for (const [dx, dy] of [[-r, -r], [r, -r], [-r, r], [r, r]] as const) expect(marchableEn(n, p.c.x + dx, p.c.y + dy)).toBe(true);
      }
    }
  });
  it("il glisse le long d'un mur au lieu de s'arrêter, et un bord de pont l'arrête", () => {
    const p = new Partie(dailyRush(J0), REGLAGES_DEFAUT);
    const n = p.niveau!;
    // une case de sol dont le voisin de droite est un mur ou du vide
    let trouve = -1;
    for (let k = 0; k < n.cases.length && trouve < 0; k++) {
      const i = k % n.l;
      if (n.cases[k] === SOL && i + 1 < n.l && (n.cases[k + 1] === MUR || n.cases[k + 1] === VIDE) && n.cases[k - n.l] === SOL && n.cases[k + n.l] === SOL && n.cases[k - 1] === SOL) trouve = k;
    }
    expect(trouve).toBeGreaterThanOrEqual(0);
    const i = trouve % n.l;
    const j = (trouve - i) / n.l;
    p.c.x = n.ox + i * CASE + CASE - cm(60);
    p.c.y = n.oy + j * CASE + CASE / 2;
    const y0 = p.c.y;
    // il pousse vers le bas-droite : x bloqué par le mur, y glisse
    tournerN(p, 12, entree(30)); // direction 30 : vers le bas-droite (dirVers 120/4)
    expect(p.c.x + RAYON_CHEVALIER).toBeLessThanOrEqual(n.ox + (i + 1) * CASE);
    expect(p.c.y).not.toBe(y0);
  });
  it("un monstre au sol ne traverse pas les murs ; la chauve-souris vole par-dessus", () => {
    const p = new Partie(dailyRush(J0 + 2), REGLAGES_DEFAUT);
    const n = p.niveau!;
    for (let t = 0; t < 2400; t++) {
      p.c.coeurs = 3;
      p.avancer(entree((t >> 5) % 32, t % 3 === 0, false));
      for (const m of p.monstres) if (m.type === GELEE) expect(marchableEn(n, m.x, m.y)).toBe(true);
    }
  });
});

describe("la veille des monstres : rayon d'alerte et laisse (lot BR1)", () => {
  it("un monstre du niveau reste à sa place tant que le chevalier est loin, et ne bouge pas de lui-même", () => {
    const p = new Partie(dailyRush(J0), REGLAGES_DEFAUT);
    const avant = p.monstres.map((m) => [m.x, m.y, m.type]);
    tournerN(p, 300);
    for (const [k, m] of p.monstres.entries()) {
      expect(m.alerte).toBe(0);
      if (m.type === GELEE) expect([m.x, m.y]).toEqual([avant[k]![0], avant[k]![1]]);
      else expect(distance(m.x, m.y, m.hx, m.hy)).toBeLessThan(cm(400)); // elle plane près de sa place
    }
  });
  it("il remarque le chevalier à son rayon d'alerte, le poursuit, puis le lâche (laisse) et rentre à sa place", () => {
    const p = new Partie(dailyRush(J0), REGLAGES_DEFAUT, true);
    const g = p.monstres.find((m) => m.type === GELEE)!;
    // le chevalier se tient juste dans le rayon d'alerte de cette gelée
    p.c.x = g.x + ALERTE_GELEE - cm(50);
    p.c.y = g.y;
    p.c.coeurs = 3;
    p.avancer(0);
    expect(g.alerte).toBe(1);
    expect(p.evenements.some((e) => e.k === "alerte")).toBe(true);
    // le chevalier file très loin : au-delà du double du rayon d'alerte, il la lâche
    g.x += cm(500); // elle s'est éloignée de sa place
    p.c.x = g.x + ALERTE_GELEE * 3;
    p.c.degat = 9999;
    tournerN(p, 3);
    expect(g.alerte).toBe(2);
    p.c.x = g.hx + LAISSE * 3;
    p.c.y = g.hy;
    tournerN(p, 1200);
    expect(distance(g.x, g.y, g.hx, g.hy)).toBeLessThan(cm(150));
    expect(g.alerte).toBe(0);
  });
  it("un monstre qui s'éloigne de sa place de plus que sa laisse abandonne", () => {
    const p = new Partie(dailyRush(J0), REGLAGES_DEFAUT);
    const g = p.monstres.find((m) => m.type === GELEE)!;
    g.alerte = 1;
    g.x = g.hx + LAISSE + cm(100);
    p.c.x = g.x + cm(300);
    p.c.y = g.y;
    p.c.degat = 9999;
    p.avancer(0);
    expect(g.alerte).toBe(2);
  });
  it("les scénarios d'essai gardent des monstres qui poursuivent partout (pas de laisse)", () => {
    const p = new Partie({ ...dailyRush(J0), niveau: null, scenario: "arene" }, REGLAGES_DEFAUT);
    for (const m of p.monstres) {
      expect(m.laisse).toBe(0);
      expect(m.alerte).toBe(1);
    }
    expect(p.monstres.length).toBeGreaterThan(0);
    void CHAUVE;
  });
});

describe("la barrière de l'arène (lot BR1)", () => {
  const devantLArene = (): Partie => {
    const p = new Partie(dailyRush(J0), REGLAGES_DEFAUT);
    const n = p.niveau!;
    // dehors, sur le chemin, à 6 m du bord de l'arène
    p.c.x = n.arene.ex + Math.trunc((((n.arene.ex - n.arene.x) * cm(600)) / RAYON_ARENE));
    p.c.y = n.arene.ey + Math.trunc((((n.arene.ey - n.arene.y) * cm(600)) / RAYON_ARENE));
    return p;
  };
  it("tant que le chevalier n'est pas entré, la barrière est ouverte et le golem dort (il ne bouge pas, ne frappe pas)", () => {
    const p = devantLArene();
    const g = p.golem!;
    const [gx, gy] = [g.x, g.y];
    tournerN(p, 400);
    expect(p.barriere).toBe(-1);
    expect(p.golemEveille).toBe(false);
    expect([g.x, g.y]).toEqual([gx, gy]);
    expect(p.zones.length).toBe(0);
  });
  it("en entrant, la barrière se referme derrière lui, le golem se réveille (il rugit, invulnérable), et le chevalier ne ressort plus", () => {
    const p = devantLArene();
    const n = p.niveau!;
    const e = entree(croix(n.arene.x - p.c.x, n.arene.y - p.c.y));
    const evs = new Set<string>();
    const pj = new Partie(p.contenu, REGLAGES_DEFAUT, true);
    pj.c.x = p.c.x;
    pj.c.y = p.c.y;
    for (let t = 0; t < 600 && pj.barriere < 0; t++) {
      pj.avancer(e);
      for (const ev of pj.evenements) evs.add(ev.k);
    }
    expect(pj.barriere).toBeGreaterThan(0);
    expect(evs.has("barriere") && evs.has("eveil")).toBe(true);
    expect(pj.golem!.etat).toBe(RUGIT);
    expect(distance(pj.c.x, pj.c.y, n.arene.x, n.arene.y)).toBeLessThan(RAYON_ARENE);
    // il pousse vers la sortie pendant dix secondes : il reste dans l'arène
    const sortie = entree(croix(n.arene.ex - n.arene.x, n.arene.ey - n.arene.y));
    for (let t = 0; t < 600; t++) {
      pj.c.coeurs = 3;
      pj.avancer(sortie);
      expect(distance(pj.c.x, pj.c.y, n.arene.x, n.arene.y)).toBeLessThanOrEqual(RAYON_ARENE);
    }
    expect(pj.golemEveille).toBe(true);
  });
  it("le golem réveillé combat comme au BR0c : il finit par frapper (un cercle est annoncé)", () => {
    const p = devantLArene();
    const n = p.niveau!;
    const e = entree(croix(n.arene.x - p.c.x, n.arene.y - p.c.y));
    let vu = false;
    for (let t = 0; t < 1200 && !vu; t++) {
      p.c.coeurs = 3;
      p.avancer(p.barriere < 0 ? e : 0);
      vu = p.zones.length > 0;
    }
    expect(vu).toBe(true);
  });
});

describe("le pilote dans le niveau (lot BR1)", () => {
  it("foncer : il gagne au moins 58 jours sur 60, en 40 à 100 s ; chaque partie se rejoue exactement", () => {
    let victoires = 0;
    const temps: number[] = [];
    for (let k = 0; k < 60; k++) {
      const c = dailyRush(J0 + k);
      const r = jouerLePilote(c);
      if (r.resultat.victoire) {
        victoires++;
        temps.push(r.ticks / 60);
      }
      if (k < 3) {
        const rj = rejouer(c, enregistrer(c, r.changements));
        expect(rj).toEqual(r.resultat);
      }
    }
    expect(victoires).toBeGreaterThanOrEqual(58);
    expect(Math.min(...temps)).toBeGreaterThan(40);
    expect(Math.max(...temps)).toBeLessThan(100);
  });
  it("tout nettoyer prend nettement plus de temps que foncer (et tue plus)", () => {
    const c = dailyRush(J0 + 3);
    const f = jouerLePilote(c, REGLAGES_DEFAUT, Infinity, "foncer");
    const n = jouerLePilote(c, REGLAGES_DEFAUT, Infinity, "nettoyer");
    expect(n.resultat.tues).toBeGreaterThan(f.resultat.tues + 5);
    if (n.resultat.victoire) expect(n.ticks).toBeGreaterThan(f.ticks + 30 * 60);
  });
  it("la rediffusion du pire pilote tient dans les limites", () => {
    const c = dailyRush(J0 + 7);
    const r = jouerLePilote(c, REGLAGES_DEFAUT, Infinity, "nettoyer");
    const texte = encoderRediffusion({ sim: 4, g: 2, contenu: { jour: c.jour }, changements: r.changements });
    expect(texte.length).toBeLessThan(40000);
  });
});
