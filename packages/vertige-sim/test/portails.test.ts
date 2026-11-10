import { describe, expect, it } from "vitest";
import { jouerCibles } from "../tools/robot";
import { M, ORIENTATIONS, PORTAIL_DEMI_H, PORTAIL_DEMI_L, PORTAIL_PROFONDEUR, Partie, T_AVANT, appliquer, geo, liaisons, murDePortail, niveau, poche, type Boite, type Commande, type Niveau, type Portail } from "../src/index";

// Les portails (lot V1) : la géométrie (poches vides, rotations propres), la règle de passage (le CENTRE de la boîte passe le plan), la rotation appliquée à la position, à la vitesse, au regard et à la gravité, et
// la règle « à cheval » (une poche vide : aucun cas particulier de collision).
const rien: Commande = { k: 0, dl: 0, dt: 0 };
const recouvre = (a: Boite, b: Boite): boolean => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0 && a.z0 < b.z1 && a.z1 > b.z0;
const portail = (x: number, y: number, z: number, normale: Portail["normale"], haut: Portail["haut"]): Portail => ({ x: x * M, y: y * M, z: z * M, normale, haut });

/** Un puits : une dalle à 10 m avec un portail dans le sol, un plafond plus loin avec son pendant (on tombe par l'un, on ressort par l'autre), le sol en bas. */
const A = portail(0, 10, 0, 2, 0);
const B = portail(0, 10, 30, 3, 0);
const PUITS: Niveau = {
  nom: "portails",
  blocs: [{ boite: { x0: -40 * M, y0: -1 * M, z0: -40 * M, x1: 40 * M, y1: 0, z1: 60 * M }, role: "pierre" }, ...murDePortail(A, 4, 4, 4), ...murDePortail(B, 4, 4, 4)],
  depart: { x: -3 * M, y: 10 * M + 1000, z: 0, lacet: 49152 }, // regarde vers +x : il court vers le trou, du bord de la dalle
  arrivee: null,
  reprises: [],
  gemmes: [],
  chute: -30 * M,
  portails: [{ a: A, b: B }],
};

describe("la géométrie des portails", () => {
  it("chaque paire a des normales et des hauts perpendiculaires, et des rotations propres qui sont l'inverse l'une de l'autre", () => {
    for (const nom of ["portails"] as const) {
      for (const paire of niveau(nom).portails!) {
        for (const p of [paire.a, paire.b]) {
          const g = geo(p);
          expect(g.n[0] * g.u[0] + g.n[1] * g.u[1] + g.n[2] * g.u[2]).toBe(0);
        }
        const [ab, ba] = liaisons(paire);
        expect(appliquer(ab.R, appliquer(ba.R, [3, 5, 7]))).toEqual([3, 5, 7]);
        expect(appliquer(ab.R, [-ab.de.n[0], -ab.de.n[1], -ab.de.n[2]])).toEqual([...ab.vers.n]); // l'entrée devient la sortie
        expect(appliquer(ab.R, [...ab.de.u])).toEqual([...ab.vers.u]);
      }
    }
  });
  it("la poche de chaque portail (section de l'ouverture, 1 m de fond) ne contient aucun bloc", () => {
    for (const n of [niveau("portails"), PUITS]) {
      for (const paire of n.portails!) {
        for (const p of [paire.a, paire.b]) {
          const poc = poche(p);
          for (const b of n.blocs) expect(recouvre(poc, b.boite), `un bloc dans la poche de ${p.x},${p.y},${p.z}`).toBe(false);
        }
      }
    }
  });
  it("l'ouverture est de taille fixe, plus large que la boîte (0,6 × 1,8) et plus profonde que sa demi-hauteur", () => {
    expect([PORTAIL_DEMI_L, PORTAIL_DEMI_H, PORTAIL_PROFONDEUR]).toEqual([800_000, 1_200_000, 1_000_000]);
    expect(2 * PORTAIL_DEMI_L).toBeGreaterThan(600_000);
    expect(2 * PORTAIL_DEMI_H).toBeGreaterThan(1_800_000);
    expect(PORTAIL_PROFONDEUR).toBeGreaterThan(900_000);
  });
});

describe("la traversée : le centre de la boîte passe le plan", () => {
  const parcours = jouerCibles("portails", [[-6, 1.2, -6], [14, 1.2, -10], [34, 1.2, -10], [40.9, 5.5, -3], [42.5, 1, -3.5]], { apres: 10, maxPas: 3000 });
  it("le parcours mêle les trois paires et l'orbe, et arrive", () => {
    expect(parcours.partie.traversees).toBe(3);
    expect(parcours.partie.bascules).toBe(1);
    expect(parcours.partie.fin).toBeGreaterThan(0);
    expect(parcours.partie.chutes).toBe(0);
  });
  it("la traversée a lieu au premier pas où le centre passe le plan (jamais avant), la boîte est alors à cheval", () => {
    const p = new Partie(niveau("portails"));
    const plan = geo(niveau("portails").portails![0]!.a);
    const d = (): number => {
      const c = p.centre();
      return (c[0] - plan.centre[0]) * plan.n[0] + (c[1] - plan.centre[1]) * plan.n[1] + (c[2] - plan.centre[2]) * plan.n[2];
    };
    let avant = Infinity;
    for (const c of parcours.commandes) {
      p.avancer(c);
      if (p.traversees === 1) break;
      avant = d();
      expect(avant).toBeGreaterThanOrEqual(0); // tant que le centre est devant le plan, rien ne se passe
    }
    expect(p.traversees).toBe(1);
    expect(avant).toBeLessThan(0.3 * M); // le pas d'avant : à moins d'un pas de course du plan, la boîte est à cheval (demi-épaisseur 0,3 m)
    expect(avant).toBeGreaterThanOrEqual(0);
  });
  it("paire droite : la position suit la translation, la vitesse tourne d'un demi-tour (−z → +z), la gravité reste, le regard garde ses nombres", () => {
    const p = new Partie(niveau("portails"));
    let lacet = 0;
    for (const c of parcours.commandes) {
      p.avancer(c);
      lacet = p.lacet;
      if (p.traversees === 1) break;
    }
    const v = p.vitesseMonde();
    expect(v[2]).toBeGreaterThan(5 * M);
    expect(Math.hypot(v[0], v[2])).toBeGreaterThan(8.5 * M);
    expect(p.gravite).toBe(3);
    const c = p.centre();
    expect(c[2]).toBeGreaterThan(-20 * M); // sorti du portail B (z = −20), devant lui
    expect(c[2]).toBeLessThan(-19.4 * M);
    expect(Math.abs(c[0] - 14 * M)).toBeLessThan(1 * M);
    expect(p.lacet).toBe(lacet);
  });
  it("paire tournée d'un quart de tour : −z devient +x ; la gravité reste vers le bas", () => {
    const p = new Partie(niveau("portails"));
    for (const c of parcours.commandes) {
      p.avancer(c);
      if (p.traversees === 2) break;
    }
    const v = p.vitesseMonde();
    expect(v[0]).toBeGreaterThan(7 * M);
    expect(Math.abs(v[2])).toBeLessThan(2 * M);
    expect(p.gravite).toBe(3);
    expect(p.centre()[0]).toBeGreaterThan(26 * M);
  });
  it("paire qui change la gravité : elle tourne vers l'ouest (−x), on ressort par le plafond en tombant", () => {
    const p = new Partie(niveau("portails"));
    for (const c of parcours.commandes) {
      p.avancer(c);
      if (p.traversees === 3) break;
    }
    expect(p.gravite).toBe(1);
    const v = p.vitesseMonde();
    expect(v[1]).toBeLessThan(-7 * M);
    expect(p.centre()[1]).toBeLessThan(12 * M);
    expect(p.centre()[1]).toBeGreaterThan(11.4 * M);
  });
  it("le retour : repasser par le portail d'arrivée remet la position et l'orientation d'origine", () => {
    // A1 → B1, demi-tour, B1 → A1.
    const s = jouerCibles("portails", [[-6, 1.2, -6], [14, 1.2, -20], [-6, 1.2, -3]], { apres: 5, maxPas: 2000 });
    expect(s.partie.traversees).toBe(2);
    expect(s.partie.ori).toBe(0);
    expect(s.partie.pieds()[2]).toBeGreaterThan(-6 * M); // ressorti de A1, du côté de la pièce
  });
});

describe("un portail dans le sol (on tombe par l'un, on ressort par l'autre)", () => {
  it("tombe pieds en avant dans l'un, ressort du plafond de l'autre en continuant de tomber, sans heurter la poche", () => {
    const p = new Partie(PUITS);
    p.avancer(rien);
    for (let i = 0; i < 300 && p.traversees === 0; i++) p.avancer({ k: T_AVANT, dl: 0, dt: 0 });
    expect(p.traversees).toBe(1);
    expect(p.gravite).toBe(3);
    expect(p.centre()[2]).toBeGreaterThan(29 * M);
    expect(p.centre()[1]).toBeLessThan(10 * M); // sorti sous le plafond du second portail
    expect(p.vitesseMonde()[1]).toBeLessThan(0);
    for (let i = 0; i < 200; i++) p.avancer(rien);
    expect(p.sol).toBe(true);
    expect(p.pieds()[1]).toBeLessThan(0.01 * M); // retombé sur le sol, 10 m plus bas
    expect(p.chutes).toBe(0);
  });
  it("une partie rejouée donne le même état (déterminisme)", () => {
    const jouer = (): string => {
      const q = new Partie(PUITS);
      for (let i = 0; i < 400; i++) q.avancer({ k: i > 0 ? T_AVANT : 0, dl: 0, dt: 0 });
      return q.empreinte();
    };
    expect(jouer()).toBe(jouer());
  });
});
void ORIENTATIONS;
