import { describe, expect, it } from "vitest";
import { daysFromCivil, mixSeed } from "@cdj/core";
import {
  ALERTE_GELEE,
  BORNES_NIVEAU,
  CASE,
  CHAUVE,
  GELEE,
  INACCESSIBLE,
  RAYON_VASE,
  passageBloque,
  GELATON,
  LAISSE,
  MUR,
  PONT,
  PREMIER_JOUR_RUSH,
  RAYON_ARENE,
  RUSH_GENERATOR_VERSION,
  RUSH_SIM_VERSION,
  Z_CHEMIN,
  Z_PONT,
  Z_CLAIRIERE,
  rencontresDuChemin,
  tempsSansRencontre,
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
  dailyRush as dailyRushVrai,
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
  type Contenu,
  type Niveau,
} from "../src/index";

import { COS, SIN } from "../src/index";
const COS_DIR = (a: number): number => COS[a]!;
const SIN_DIR = (a: number): number => SIN[a]!;

// Lot BR5 : le jour demande de choisir une compétence au départ ; ces essais jouent la première (le tourbillon) sans écran de choix.
const dailyRushReel = dailyRushVrai;
const dailyRush = (jour: number, version?: number): Contenu => ({ ...dailyRushVrai(jour, version), competence: 0 });
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
  it("lot BR6 — le chemin principal fait 140 à 205 m ; 3 à 5 détours, chacun à 40-110 m du chemin, menant à un camp de 16 à 28 monstres ; 0 à 7 monstres épars ; 4 à 9 groupes", () => {
    for (const n of niveaux) {
      expect(n.longueurCm).toBeGreaterThanOrEqual(14000);
      expect(n.longueurCm).toBeLessThanOrEqual(20500);
      expect(BORNES_NIVEAU.longueurMin).toBe(14000);
      expect(BORNES_NIVEAU.longueurMax).toBe(20500);
      expect(n.detours.length).toBeGreaterThanOrEqual(3);
      expect(n.detours.length).toBeLessThanOrEqual(5);
      for (const d of n.detours) {
        expect(d.distanceCm).toBeGreaterThanOrEqual(BORNES_NIVEAU.detourMin);
        expect(d.distanceCm).toBeLessThanOrEqual(BORNES_NIVEAU.detourMax);
        const k = n.monstres.filter((m) => m.camp === d.camp).length;
        expect(k).toBeGreaterThanOrEqual(BORNES_NIVEAU.campMin);
        expect(k).toBeLessThanOrEqual(BORNES_NIVEAU.campMax);
      }
      const epars = n.monstres.filter((m) => m.camp < 0 && m.groupe < 0).length;
      expect(epars).toBeLessThanOrEqual(7);
      expect(n.monstres.length).toBeLessThanOrEqual(BORNES_NIVEAU.monstresMax);
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
    expect(c.g).toBe(RUSH_GENERATOR_VERSION);
    expect(RUSH_GENERATOR_VERSION).toBe(7);
    expect(RUSH_SIM_VERSION).toBe(9);
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
    // une gelée dont la ligne vers l'est (où le chevalier se tient) est libre sur 13 m : le test la déplace de 5 m puis la regarde rentrer en ligne droite (le niveau du lot BR6 est plus grand et plus encombré)
    const g = p.monstres.find((m) => m.type === GELEE && Array.from({ length: 27 }, (_, k) => k).every((k) => marchableEn(p.niveau!, m.x + cm(50 * k), m.y)))!;
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
    p.resynchroniser(); // un monstre éveillé à la main rejoint les actifs
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
  it("foncer : il gagne au moins 58 jours sur 60, en 95 à 400 s (médiane ~3 min) ; chaque partie se rejoue exactement", () => {
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
        const rj = rejouer(c, enregistrer(c, r.changements, r.choix));
        expect(rj).toEqual(r.resultat);
      }
    }
    expect(victoires).toBeGreaterThanOrEqual(58);
    // lot BR5 : la compétence raccourcit le combat du boss et les meutes allongent la route — les bornes de BR2 (40 s, 95 s ; médiane 55 à 75 s) sont élargies sur la mesure (37 à 90 s, médiane ~58 s) ; BR6 rééquilibre
    expect(Math.min(...temps)).toBeGreaterThan(95); // lot BR6 : la run est plus longue (le niveau double, la salle d'épreuve, le boss à 7 500 points de vie) : foncer met 115 à 310 s, médiane ~3 min
    expect(Math.max(...temps)).toBeLessThan(400);
    const tri = [...temps].sort((x, y) => x - y);
    expect(tri[Math.floor(tri.length / 2)]!).toBeGreaterThan(150);
    expect(tri[Math.floor(tri.length / 2)]!).toBeLessThan(230);
  }, 120_000); // lot BR6 : une rediffusion de 60 jours dépasse 30 s sur un job chargé de la CI (jeu fictif)
  it("tout nettoyer tue plus que foncer et gagne bien plus de niveaux (lot BR2)", () => {
    const c = dailyRush(J0 + 3);
    const f = jouerLePilote(c, REGLAGES_DEFAUT, Infinity, "foncer");
    const n = jouerLePilote(c, REGLAGES_DEFAUT, Infinity, "beaucoup");
    expect(n.resultat.tues).toBeGreaterThan(f.resultat.tues + 5);
    // lot BR2 : l'XP des camps donne des niveaux (donc des cartes) : tout nettoyer monte bien plus haut que foncer
    expect(n.resultat.nv).toBeGreaterThan(f.resultat.nv + 3);
  });
  it("la rediffusion du pire pilote tient dans les limites", () => {
    const c = dailyRush(J0 + 7);
    const r = jouerLePilote(c, REGLAGES_DEFAUT, Infinity, "beaucoup");
    const texte = encoderRediffusion({ sim: RUSH_SIM_VERSION, g: RUSH_GENERATOR_VERSION, contenu: { jour: c.jour }, changements: r.changements, choix: r.choix });
    expect(texte.length).toBeLessThan(40000);
  });
});

// --- Lot BR1b : un niveau dense, des détours en boucle, des obstacles cassables ----------------------------------------------------------------------------------------------------------------------
describe("un niveau compact et dense (lot BR1b)", () => {
  const niveaux = Array.from({ length: 365 }, (_, i) => genererNiveau(graine(daysFromCivil(2026, 11, 2) + i)));

  it("la règle de densité : jamais plus de ~4 s de course sans rencontre sur le chemin principal (le générateur la vérifie, la mesure est donnée par jour)", () => {
    for (const n of niveaux) {
      expect(n.sansRencontreCm).toBeLessThanOrEqual(BORNES_NIVEAU.sansRencontreMax);
      expect(tempsSansRencontre(n)).toBeLessThanOrEqual(4.01);
      expect(n.sansRencontreCm).toBeGreaterThan(0);
      // la valeur du niveau est celle qu'on recalcule sur sa grille
      expect(rencontresDuChemin(n).sansRencontreCm).toBe(n.sansRencontreCm);
      expect(n.rencontres.length).toBeGreaterThanOrEqual(3); // trois groupes au moins (lot BR5)
    }
    // un niveau qui dépasse la règle est refusé par `problemesDuNiveau`
    const trop = { ...niveaux[0]!, sansRencontreCm: BORNES_NIVEAU.sansRencontreMax + 1 };
    expect(problemesDuNiveau(trop).some((m) => m.includes("sans rencontre"))).toBe(true);
  });
  it("une clairière ou une rencontre tous les 15 à 20 m en moyenne", () => {
    for (const n of niveaux) {
      const etapes = n.clairieres.filter((c) => c.genre === "etape").length;
      const pas = n.longueurCm / 100 / (etapes + n.rencontres.length + 1);
      expect(pas).toBeGreaterThan(8);
      expect(pas).toBeLessThan(22);
    }
    const moyenne = niveaux.reduce((a, n) => a + n.longueurCm / 100 / (n.clairieres.filter((c) => c.genre === "etape").length + n.rencontres.length + 1), 0) / niveaux.length;
    expect(moyenne).toBeGreaterThan(9); // lot BR5 : plus d'unités sur la route (BR1b : 11)
    expect(moyenne).toBeLessThan(20);
  });
  it("des groupes de 2 à 4 monstres ou des meutes de 6 à 12 gélatons (lot BR5), l'alerte de 10 à 12 m, en travers du chemin (pas dans une clairière), loin du départ", () => {
    for (const n of niveaux) {
      const ids = new Set(n.monstres.filter((m) => m.groupe >= 0).map((m) => m.groupe));
      expect(ids.size).toBeGreaterThanOrEqual(4);
      expect(ids.size).toBeLessThanOrEqual(9);
      let meutes = 0;
      for (const g of ids) {
        const k = n.monstres.filter((m) => m.groupe === g);
        expect(k.length).toBeGreaterThanOrEqual(2);
        expect(k.length).toBeLessThanOrEqual(12);
        if (k.length > 4) {
          meutes++;
          expect(k.every((m) => m.type === GELATON)).toBe(true); // une meute est faite de gélatons
        }
        for (const m of k) {
          expect(m.alerte).toBeGreaterThanOrEqual(cm(1000));
          expect(m.alerte).toBeLessThanOrEqual(cm(1200));
          expect(m.alerte).toBeGreaterThan(ALERTE_GELEE);
          expect(m.camp).toBe(-1);
          const zone = n.zones[caseDe(n, m.x, m.y)];
          expect(zone === Z_CHEMIN || zone === Z_PONT || zone === Z_CLAIRIERE).toBe(true);
          expect(distance(m.x, m.y, k[0]!.x, k[0]!.y)).toBeLessThan(cm(600)); // un groupe se tient groupé (une meute de 12 : ~4 m)
          expect(distance(m.x, m.y, n.depart.x, n.depart.y)).toBeGreaterThanOrEqual(cm(1600));
        }
      }
      expect(meutes).toBeGreaterThanOrEqual(1); // au moins une meute de 6 à 12 gélatons par niveau
    }
    // la plupart des membres sont sur un lien (là où le chemin est étroit)
    let sur = 0;
    let tous = 0;
    for (const n of niveaux) for (const m of n.monstres) if (m.groupe >= 0) { tous++; const z = n.zones[caseDe(n, m.x, m.y)]; if (z === Z_CHEMIN || z === Z_PONT) sur++; }
    expect(sur / tous).toBeGreaterThan(0.7);
  });
  it("au moins la moitié des détours rejoignent le chemin principal plus loin (une boucle), la plupart quand la géométrie le permet", () => {
    let boucles = 0;
    let tous = 0;
    for (const n of niveaux) {
      const b = n.detours.filter((d) => d.hub2 >= 0).length;
      expect(b * 2).toBeGreaterThanOrEqual(n.detours.length);
      boucles += b;
      tous += n.detours.length;
      for (const d of n.detours) {
        const camp = n.clairieres[d.camp]!;
        expect(camp.genre).toBe("camp");
        const liens = n.liens.filter((l) => l.a === d.camp || l.b === d.camp);
        expect(liens.length).toBe(d.hub2 >= 0 ? 2 : 1);
        if (d.hub2 >= 0) {
          expect(d.hub2).toBeGreaterThan(d.hub);
          // une boucle ne passe pas par l'arène : elle revient à une étape
          expect(n.clairieres[d.hub2]!.genre).not.toBe("arene");
          expect(liens.map((l) => (l.a === d.camp ? l.b : l.a)).sort()).toEqual([d.hub, d.hub2].sort());
        }
      }
      // le chemin principal reste le plus court : il ne passe pas par un camp
      const sol = new Set<number>();
      let idx = caseDe(n, n.depart.x, n.depart.y);
      while (n.dist[idx]! > 0) {
        const s = descendre(n, n.dist, idx);
        sol.add(n.zones[s]!);
        idx = s;
      }
      for (const d of n.detours) {
        const camp = n.clairieres[d.camp]!;
        const [px, py] = [camp.x, camp.y];
        let k = caseDe(n, n.depart.x, n.depart.y);
        let passe = false;
        while (n.dist[k]! > 0) {
          const c = descendre(n, n.dist, k);
          const i = c % n.l;
          const cx = n.ox + i * CASE + CASE / 2;
          const cy = n.oy + ((c - i) / n.l) * CASE + CASE / 2;
          if (distance(cx, cy, px, py) < camp.r) passe = true;
          k = c;
        }
        expect(passe).toBe(false);
      }
    }
    expect(boucles / tous).toBeGreaterThan(0.5);
  });
  it("des groupes de vases (lot BR5) : 6 à 110 vases en groupes de 4 à 12, jamais sur un pont, près d'un monstre, du départ ou de l'arène, jamais sur l'axe d'un chemin ; le contenu est tiré de la graine", () => {
    let total = 0;
    const contenus = [0, 0, 0];
    for (const n of niveaux) {
      const groupes = new Set(n.vases.map((v) => v.groupe));
      expect(groupes.size).toBeGreaterThanOrEqual(BORNES_NIVEAU.vasesGroupesMin);
      expect(n.vases.length).toBeLessThanOrEqual(BORNES_NIVEAU.vasesMax);
      for (const g of groupes) {
        const k = n.vases.filter((v) => v.groupe === g).length;
        expect(k).toBeGreaterThanOrEqual(4);
        expect(k).toBeLessThanOrEqual(12);
      }
      for (const v of n.vases) {
        total++;
        expect(v.genre).toBeGreaterThanOrEqual(0);
        expect(v.genre).toBeLessThan(RAYON_VASE.length);
        expect(v.tirage).toBeGreaterThanOrEqual(0);
        expect(v.tirage).toBeLessThan(100);
        expect(n.cases[caseDe(n, v.x, v.y)]).toBe(SOL);
        expect(distance(v.x, v.y, n.depart.x, n.depart.y)).toBeGreaterThanOrEqual(cm(450));
        expect(distance(v.x, v.y, n.arene.x, n.arene.y)).toBeGreaterThanOrEqual(RAYON_ARENE + cm(450));
        for (const m of n.monstres) expect(distance(v.x, v.y, m.x, m.y)).toBeGreaterThanOrEqual(cm(120));
        contenus[v.tirage < REGLAGES_DEFAUT.vaseGemme ? 0 : v.tirage < REGLAGES_DEFAUT.vaseGemme + REGLAGES_DEFAUT.vaseRecharge ? 1 : 2]!++;
      }
    }
    // les contenus suivent les taux (une gemme le plus souvent, parfois une recharge, un cœur plus rarement : 60 / 25 / 15 %)
    expect(contenus[0]! / total).toBeGreaterThan(0.5);
    expect(contenus[0]! / total).toBeLessThan(0.7);
    expect(contenus[1]! / total).toBeGreaterThan(0.18);
    expect(contenus[2]! / total).toBeGreaterThan(0.08);
    expect(contenus[2]! / total).toBeLessThan(0.22);
  }, 120_000); // lot BR6 : une rediffusion de 60 jours dépasse 30 s sur un job chargé de la CI (jeu fictif)
  it("rien ne bloque le chemin : le chevalier rejoint l'arène et chaque monstre avec les vases pleins (grille fine) — et le validateur voit un mur de vases", () => {
    for (const n of niveaux) expect(passageBloque(n)).toBeNull();
    // un mur de vases en travers de l'entrée de l'arène barre le chemin : le validateur le voit
    const n = niveaux[0]!;
    const dx = n.arene.ex - n.arene.x;
    const dy = n.arene.ey - n.arene.y;
    const d = Math.hypot(dx, dy);
    const cx = n.arene.x + (dx / d) * (RAYON_ARENE + cm(700));
    const cy = n.arene.y + (dy / d) * (RAYON_ARENE + cm(700));
    const mur = Array.from({ length: 13 }, (_, i) => ({ genre: 0, x: Math.round(cx + (-dy / d) * cm(-480 + i * 80)), y: Math.round(cy + (dx / d) * cm(-480 + i * 80)), tirage: 0, groupe: 99 }));
    expect(passageBloque({ ...n, vases: [...n.vases, ...mur] })).not.toBeNull();
  });
  it("génère un niveau en peu de tentatives (le coût est mesuré en tentatives, pas en millisecondes : la CI est lente et variable)", () => {
    const essais = niveaux.map((n) => n.essais);
    expect(Math.max(...essais)).toBeLessThan(1500);
    expect(essais.reduce((a, b) => a + b, 0) / essais.length).toBeLessThan(120);
  });
});

describe("les vases dans la partie (lot BR5)", () => {
  /** Une partie du jour, le chevalier posé à 1,6 m d'un vase du groupe `g`, tourné vers lui. */
  const devantUnVase = (j = J0, g = 0): { p: Partie; dir: number; v: Partie["vases"][number] } => {
    const p = new Partie(dailyRush(j), REGLAGES_DEFAUT);
    const v = p.vases.find((q) => q.groupe === g)!;
    // un point à 1,6 m du vase, sur du sol libre et sans autre vase à moins de 1,2 m
    for (let a = 0; a < 128; a += 8) {
      const x = v.x + Math.trunc((COS_DIR(a) * cm(160)) / 1024);
      const y = v.y + Math.trunc((SIN_DIR(a) * cm(160)) / 1024);
      if (!marchableEn(p.niveau!, x, y)) continue;
      if (p.vases.some((q) => q !== v && distance(q.x, q.y, x, y) < cm(120))) continue;
      p.c.x = x;
      p.c.y = y;
      return { p, dir: croix(v.x - x, v.y - y), v };
    }
    throw new Error("pas de point libre devant le vase");
  };
  it("il est plein pour le chevalier : tant qu'il tient, il ne le traverse pas", () => {
    const { p, dir, v } = devantUnVase();
    for (let t = 0; t < 120; t++) {
      p.c.coeurs = 3;
      p.avancer(entree(dir));
      expect(distance(p.c.x, p.c.y, v.x, v.y)).toBeGreaterThanOrEqual(v.r + RAYON_CHEVALIER - 8);
    }
    expect(p.vases.includes(v)).toBe(true);
  });
  it("un coup le brise (l'événement « brise » part, il disparaît de la liste) ; un coup en arc en brise plusieurs ; un coup ne brise un vase qu'une fois", () => {
    let plusieurs = 0;
    let essais = 0;
    for (let k = 0; k < 12; k++) {
      let devant: ReturnType<typeof devantUnVase>;
      try {
        devant = devantUnVase(J0 + k);
      } catch {
        continue; // un jour où le groupe 0 n'a pas de point libre devant lui (le niveau du lot BR6 est plus encombré)
      }
      const { p, dir, v } = devant;
      essais++;
      const pj = new Partie(p.contenu, REGLAGES_DEFAUT, true);
      pj.c.x = p.c.x;
      pj.c.y = p.c.y;
      const avant = pj.vases.length;
      let brises = 0;
      for (let t = 0; t < 40; t++) {
        pj.c.coeurs = 3;
        pj.avancer(entree(dir, t === 0));
        for (const ev of pj.evenements) if (ev.k === "brise") brises++;
        pj.vider();
        if (brises > 0) break;
      }
      expect(brises).toBeGreaterThanOrEqual(1);
      if (brises >= 2) plusieurs++;
      expect(pj.vases.length).toBe(avant - brises);
      expect(pj.vases.some((q) => q.id === v.id)).toBe(false);
    }
    expect(essais).toBeGreaterThanOrEqual(6);
    expect(plusieurs).toBeGreaterThan(0); // un groupe serré : l'arc en brise plusieurs
  });
  it("le contenu est tiré de la graine, déterministe ; un vase de gemme donne de l'XP, de rage de la rage, de cœur un cœur qui attend tant que les cœurs sont pleins", () => {
    const p = new Partie(dailyRush(J0), REGLAGES_DEFAUT);
    const q = new Partie(dailyRush(J0), REGLAGES_DEFAUT);
    expect(p.vases.map((v) => p.contenuDuVase(v.tirage))).toEqual(q.vases.map((v) => q.contenuDuVase(v.tirage)));
    expect(p.contenuDuVase(0)).toBe(0);
    expect(p.contenuDuVase(REGLAGES_DEFAUT.vaseGemme)).toBe(1);
    expect(p.contenuDuVase(REGLAGES_DEFAUT.vaseGemme + REGLAGES_DEFAUT.vaseRecharge)).toBe(2);
    // les taux sont des réglages
    const r = new Partie(dailyRush(J0), { ...REGLAGES_DEFAUT, vaseGemme: 0, vaseRecharge: 100 });
    expect(r.contenuDuVase(99)).toBe(1);
  });
  it("le pilote qui fonce gagne ces jours-là (les vases du chemin ne le bloquent pas)", () => {
    for (let k = 0; k < 6; k++) {
      const c = dailyRushReel(J0 + k);
      const r = jouerLePilote(c);
      expect(r.resultat.victoire).toBe(true);
    }
  });
});
