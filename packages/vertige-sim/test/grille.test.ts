import { Rng } from "@cdj/core";
import { describe, expect, it } from "vitest";
import { CM, Grille, NOMS_NIVEAUX, Partie, T_ARRIERE, T_AVANT, T_DASH, T_DROITE, T_GAUCHE, T_SAUT, niveau, type Boite, type Commande, type Niveau } from "../src/index";
import "../src/modulesIndex"; // enregistre le niveau « enchainement »

// L'index spatial (lot V2) est une optimisation : il ne change AUCUNE règle. Deux preuves ici : la grille rend bien toutes les boîtes qui peuvent chevaucher la requête, dans l'ordre du niveau ; et une partie jouée avec
// l'index a, à chaque pas, la même empreinte d'état que la même partie jouée en essayant toutes les boîtes (`sansIndex`). Le golden (`golden.test.ts`) est la troisième : il est resté identique au bit près.
const recouvre = (a: Boite, b: Boite): boolean => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0 && a.z0 < b.z1 && a.z1 > b.z0;

describe("la grille", () => {
  it("rend toutes les boîtes qui chevauchent la requête, sans doublon, dans l'ordre du niveau", () => {
    const rng = new Rng(5);
    const boites: Boite[] = Array.from({ length: 300 }, () => {
      const x = (rng.int(2000) - 1000) * 10_000;
      const y = (rng.int(600) - 300) * 10_000;
      const z = (rng.int(2000) - 1000) * 10_000;
      const grande = rng.int(20) === 0; // une dalle immense : « grande », essayée à chaque requête
      return { x0: x, y0: y, z0: z, x1: x + (1 + rng.int(grande ? 40_000 : 800)) * 10_000, y1: y + (1 + rng.int(300)) * 10_000, z1: z + (1 + rng.int(grande ? 40_000 : 800)) * 10_000 };
    });
    const g = new Grille(boites);
    expect(g.taille.grandes).toBeGreaterThan(0);
    expect(g.taille.dansLaGrille).toBeGreaterThan(200);
    for (let i = 0; i < 400; i++) {
      const x = (rng.int(2400) - 1200) * 10_000;
      const y = (rng.int(800) - 400) * 10_000;
      const z = (rng.int(2400) - 1200) * 10_000;
      const q: Boite = { x0: x, y0: y, z0: z, x1: x + rng.int(900) * 10_000, y1: y + rng.int(400) * 10_000, z1: z + rng.int(900) * 10_000 };
      const sortie = [...g.chercher(q.x0, q.y0, q.z0, q.x1, q.y1, q.z1)];
      expect(new Set(sortie).size).toBe(sortie.length);
      expect([...sortie]).toEqual([...sortie].sort((a, b) => a - b));
      const attendues = boites.flatMap((b, k) => (recouvre(b, q) ? [k] : []));
      for (const k of attendues) expect(sortie, `la boîte ${k} chevauche la requête ${i}`).toContain(k);
    }
  });
  it("la version exhaustive rend tout, dans l'ordre", () => {
    const boites: Boite[] = Array.from({ length: 5 }, (_, i) => ({ x0: i * CM, y0: 0, z0: 0, x1: i * CM + 1, y1: 1, z1: 1 }));
    expect([...new Grille(boites, true).chercher(0, 0, 0, 1, 1, 1)]).toEqual([0, 1, 2, 3, 4]);
  });
});

/** Une marche au hasard semé : toutes les touches, des sauts, des dashs, du regard. */
function marche(graine: number, pas: number): Commande[] {
  const rng = new Rng(graine);
  const out: Commande[] = [];
  let k = T_AVANT;
  for (let i = 0; i < pas; i++) {
    if (rng.int(30) === 0) k = [T_AVANT, T_AVANT | T_DROITE, T_AVANT | T_GAUCHE, T_DROITE, T_GAUCHE, T_ARRIERE, T_AVANT][rng.int(7)]!;
    let c = k;
    if (rng.int(45) === 0) c |= T_SAUT;
    if (rng.int(150) === 0) c |= T_DASH;
    out.push({ k: c, dl: rng.int(61) - 30 + (rng.int(100) === 0 ? 8000 : 0), dt: rng.int(21) - 10 });
  }
  return out;
}

describe("l'index ne change aucune règle", () => {
  for (const nom of NOMS_NIVEAUX) {
    it(`${nom} : avec et sans index, la même empreinte à chaque pas (marches au hasard)`, () => {
      const n = niveau(nom);
      const sans: Niveau = { ...n, sansIndex: true, arrivee: null };
      const avec: Niveau = { ...n, arrivee: null };
      for (const graine of [1, 2, 3]) {
        const a = new Partie(avec);
        const b = new Partie(sans);
        for (const c of marche(graine * 17 + nom.length, 2400)) {
          a.avancer(c);
          b.avancer(c);
          if (a.empreinte() !== b.empreinte()) throw new Error(`${nom}, graine ${graine} : l'état diffère au pas ${a.tick}`);
        }
      }
    });
  }
  it("un niveau de 600 boîtes : la même partie, avec et sans index", () => {
    const blocs = Array.from({ length: 600 }, (_, i) => {
      const x = (i % 20) * 8 * 1_000_000;
      const z = -Math.floor(i / 20) * 8 * 1_000_000;
      return { boite: { x0: x, y0: -1_000_000, z0: z, x1: x + 5_000_000, y1: 0, z1: z + 5_000_000 }, role: "pierre" as const };
    });
    const base: Niveau = { ...niveau("bac-a-sable"), blocs, arrivee: null };
    const a = new Partie(base);
    const b = new Partie({ ...base, sansIndex: true });
    for (const c of marche(9, 3000)) {
      a.avancer(c);
      b.avancer(c);
    }
    expect(a.empreinte()).toBe(b.empreinte());
  });
});
