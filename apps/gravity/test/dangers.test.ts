import { describe, expect, it } from "vitest";
import { daysFromCivil } from "@cdj/core";
import {
  CASE,
  EV_CRAQUE,
  EV_EFFONDREMENT,
  FRAGILE_DELAI,
  LARGEUR_MORCEAU,
  LASER_CYCLE,
  LASER_ALLUME,
  MORCEAUX_PAR_BOUCLE,
  Partie,
  dailyGravity,
  terrainDeTest,
  terrainDuJour,
  type Laser,
  type Scie,
} from "@cdj/gravity-sim";
import { HAZARD, HAZARD_OUTLINE } from "@cdj/visuels/plateformes";
import { CATALOGUE_GRAVITY } from "../src/catalogue";
import { couleursGravity } from "../src/couleurs";
import { COLONNES_AVANT_ANNONCE, DANGER_AFFICHE, NOMS_DES_DANGERS } from "../src/dangersLogique";
import { CHUTE_VISIBLE, dessinAnnonceLaser, dessinFaisceau, dessinFragile, dessinLentille, dessinRail, dessinScie, niveauDeFissure } from "../src/dessins";
import { Monde } from "../src/monde3d";
import { notesDe, PORTEE_LASER, PORTEE_SCIE, VeilleDesDangers, sonsDuPas, type Photo } from "../src/sonsLogique";

// Lot GR7 — le rendu et les sons des trois dangers : les fissures grandissent, les scies tournent, les lasers préviennent puis brûlent ; tout est rouge et cerné ; une annonce « Nouveau : … » par danger, une seule fois ;
// aucune secousse pour un danger ; les sons (règle S2 : Web Audio, jamais d'élément audio) sont décidés par des fonctions pures.
const c = couleursGravity();
const sur = (grille: string[], objets: { scies?: Scie[]; lasers?: Laser[] } = {}): { terrain: ReturnType<typeof terrainDeTest>; partie: Partie } => {
  const terrain = terrainDeTest([grille], objets);
  return { terrain, partie: new Partie(terrain) };
};
const couloir = (): string[] => Array.from({ length: 12 }, (_, r) => (r < 2 || r >= 10 ? "#".repeat(16) : ".".repeat(16)));

describe("les fissures d'un sol fragile", () => {
  it("grandissent avec l'âge : intact, une fissure, deux, puis il va tomber (au plus 3 niveaux)", () => {
    expect(niveauDeFissure(-1, FRAGILE_DELAI)).toBe(0);
    expect(niveauDeFissure(0, FRAGILE_DELAI)).toBe(1);
    expect(niveauDeFissure(Math.trunc(FRAGILE_DELAI / 2), FRAGILE_DELAI)).toBe(2);
    expect(niveauDeFissure(FRAGILE_DELAI - 1, FRAGILE_DELAI)).toBe(3);
    let avant = 0;
    for (let a = 0; a < FRAGILE_DELAI; a++) {
      const n = niveauDeFissure(a, FRAGILE_DELAI);
      expect(n).toBeGreaterThanOrEqual(avant);
      avant = n;
    }
  });
  it("chaque niveau a son dessin, avec plus de fissures à chaque niveau", () => {
    const sommets = ([0, 1, 2, 3] as const).map((n) => dessinFragile(n, c.encre).vertexCount);
    for (let i = 1; i < 4; i++) expect(sommets[i]!).toBeGreaterThan(sommets[i - 1]!);
    expect(CHUTE_VISIBLE).toBeGreaterThan(10);
  });
  it("dans le monde : le maillage change de niveau puis disparaît en tombant", () => {
    const grille = couloir().map((l, r) => (r === 10 ? l.slice(0, 4) + "f".repeat(12) : r === 11 ? l.slice(0, 4) + ".".repeat(12) : l));
    const { terrain, partie } = sur(grille);
    const monde = new Monde(terrain, 1, c, false);
    monde.maj({ cam: 0, largeur: 20, tick: 0, temps: 0 }, partie);
    const vues = new Set<unknown>();
    const noter = (): void => void monde.groupe.children.flatMap((g) => g.children).forEach((m) => vues.add((m as { geometry?: unknown }).geometry));
    noter();
    const avant = vues.size;
    let craque = -1;
    let tombe = -1;
    for (let i = 0; i < 300 && !partie.finie; i++) {
      partie.avancer();
      if ((partie.ev & EV_CRAQUE) !== 0 && craque < 0) craque = partie.tick;
      if ((partie.ev & EV_EFFONDREMENT) !== 0 && tombe < 0) tombe = partie.tick;
      monde.maj({ cam: partie.cam / CASE, largeur: 20, tick: partie.tick, temps: partie.tick / 120 }, partie);
      noter();
    }
    expect(craque).toBeGreaterThan(0);
    expect(tombe - craque).toBe(FRAGILE_DELAI);
    expect(vues.size).toBeGreaterThanOrEqual(avant + 2); // des niveaux de fissure, en plus de l'intact
    monde.detruire();
  });
});

describe("la scie et le laser dans le monde", () => {
  it("une scie : un rail et un disque par scie ; le disque suit `positionScie` ; mouvement réduit : il ne tourne pas", () => {
    const scie: Scie = { x0: 5 * CASE, y0: 9 * CASE + CASE / 2, x1: 9 * CASE, y1: 9 * CASE + CASE / 2, periode: 100, decalage: 0 };
    for (const reduit of [false, true]) {
      const { terrain, partie } = sur(couloir(), { scies: [scie] });
      const monde = new Monde(terrain, 1, c, reduit);
      monde.maj({ cam: 0, largeur: 20, tick: 0, temps: 0 }, partie);
      const maillages = monde.groupe.children.flatMap((g) => g.children);
      expect(maillages.length).toBeGreaterThan(2);
      const lent = monde.groupe.children.flatMap((g) => g.children).find((m) => Math.abs(m.position.x - 5) < 1e-6 && Math.abs(m.position.y + 9.5) < 1e-6 && m.rotation.z === 0);
      expect(lent).toBeDefined();
      monde.maj({ cam: 0, largeur: 20, tick: 50, temps: 50 / 120 }, partie);
      const milieu = monde.groupe.children.flatMap((g) => g.children).find((m) => Math.abs(m.position.x - 7) < 0.02 && Math.abs(m.position.y + 9.5) < 1e-6);
      expect(milieu, "à mi-chemin du rail").toBeDefined();
      // il tourne ; avec « réduire les animations » il garde sa pose, sans tourner
      expect(milieu!.rotation.z === 0).toBe(reduit);
      monde.detruire();
    }
  });
  it("un laser : le trait pâle puis le rayon, jamais les deux ensemble ; éteint, rien", () => {
    const laser: Laser = { c: 8, r0: 5, r1: 9, decalage: 0 };
    const { terrain, partie } = sur(couloir(), { lasers: [laser] });
    const monde = new Monde(terrain, 1, c, true);
    const visibles = (tick: number): number => {
      monde.maj({ cam: 0, largeur: 20, tick, temps: tick / 120 }, partie);
      return monde.groupe.children.flatMap((g) => g.children).filter((m) => m.visible && Math.abs(m.position.x - 8.5) < 1e-6 && m.scale.y > 3 && m.scale.y < 6).length;
    };
    expect(visibles(10)).toBe(0); // éteint
    expect(visibles(LASER_CYCLE - LASER_ALLUME - 30)).toBe(1); // l'annonce
    expect(visibles(LASER_CYCLE - 20)).toBe(1); // le rayon (un seul des deux est visible)
    monde.detruire();
  });
});

describe("tout est rouge : le rouge reste celui des dangers, cerné de sombre", () => {
  /** Les couleurs d'un tampon, rendues en 0xRRGGBB (les sommets les rangent en linéaire). */
  const couleursDe = (a: { col: ArrayLike<number> }): Set<number> => {
    const srgb = (l: number): number => Math.round((l <= 0.0031308 ? l * 12.92 : 1.055 * l ** (1 / 2.4) - 0.055) * 255);
    const s = new Set<number>();
    for (let i = 0; i < a.col.length; i += 3) s.add(((srgb(a.col[i]!) << 16) | (srgb(a.col[i + 1]!) << 8) | srgb(a.col[i + 2]!)) >>> 0);
    return s;
  };
  it("la scie, la lentille et le rayon portent le rouge des dangers et son contour", () => {
    for (const art of [dessinScie(c.encre, c.papier), dessinLentille(c.encre), dessinFaisceau()]) expect(couleursDe(art).has(HAZARD >>> 0), "rouge").toBe(true);
    expect(couleursDe(dessinScie(c.encre, c.papier)).has(HAZARD_OUTLINE >>> 0), "contour").toBe(true);
    expect(dessinRail(3, c.encre).vertexCount).toBeGreaterThan(0);
    expect(dessinAnnonceLaser().vertexCount).toBeGreaterThan(0);
  });
});

describe("l'annonce « Nouveau : … »", () => {
  it("chaque danger a son nom, sa consigne et son aide, en français et en anglais ; la mort a son texte", () => {
    for (const langue of ["fr", "en"] as const) {
      const cat = CATALOGUE_GRAVITY[langue] as Record<string, string>;
      expect(cat["danger.nouveau"]).toContain("{danger}");
      for (const d of NOMS_DES_DANGERS) for (const cle of [`danger.${d}`, `danger.${d}.consigne`, `aide.danger.${d}`]) expect(cat[cle], `${langue} ${cle}`).toBeTruthy();
      expect(cat["mort.scie"]).toBeTruthy();
      expect(cat["mort.laser"]).toBeTruthy();
      expect(cat["essai.reglage.courbe"]).toBeTruthy();
    }
    expect(DANGER_AFFICHE).toBeGreaterThan(240);
    expect(COLONNES_AVANT_ANNONCE).toBeGreaterThan(6);
  });
  it("chaque danger est introduit une fois, dans l'ordre du seed (scies, puis sols fragiles et lasers), par un morceau marqué `intro`", () => {
    const terrain = terrainDuJour(dailyGravity(daysFromCivil(2026, 11, 17)));
    const intros: { m: number; intro: string }[] = [];
    for (let m = 0; m < 2 * MORCEAUX_PAR_BOUCLE; m++) {
      const mo = terrain.morceau(m);
      if (mo.intro) intros.push({ m, intro: mo.intro });
    }
    expect(intros.map((x) => x.intro)).toEqual(["scies", "fragiles", "lasers"]);
    expect(intros[0]!.m).toBeGreaterThanOrEqual(19);
    expect(intros[0]!.m).toBeLessThan(38);
    for (const { m } of intros.slice(1)) expect(Math.trunc(m / 19)).toBe(2);
  });
});

describe("les sons des dangers (décidés par des fonctions pures)", () => {
  const photo: Photo = { g: 1, mult: 1, chaine: 0, bouclier: false, aimant: 0, portail: null, monte: false };
  it("le craquement et l'effondrement viennent des événements de la simulation", () => {
    expect(sonsDuPas(EV_CRAQUE, photo, photo)).toEqual([{ son: "craquement" }]);
    expect(sonsDuPas(EV_EFFONDREMENT, photo, photo)).toEqual([{ son: "effondrement" }]);
  });
  it("chaque son de danger a des notes douces (jamais d'onde carrée, niveau de crête ≤ 0,3)", () => {
    for (const son of ["scie", "craquement", "effondrement", "laserCharge", "laserBrule"] as const) {
      const notes = notesDe({ son });
      expect(notes.length).toBeGreaterThan(0);
      for (const n of notes) {
        expect(n.g).toBeLessThanOrEqual(0.3);
        expect(["sine", "triangle"]).toContain(n.onde);
      }
    }
  });
  it("la scie qui passe près s'entend une fois par passage, pas en rafale, pas de loin", () => {
    const scie: Scie = { x0: 6 * CASE, y0: 9 * CASE + CASE / 2, x1: 6 * CASE, y1: 9 * CASE + CASE / 2, periode: 1000, decalage: 0 };
    const { terrain, partie } = sur(couloir(), { scies: [scie] });
    const veille = new VeilleDesDangers();
    let n = 0;
    for (let i = 0; i < 400 && !partie.finie; i++) {
      partie.avancer();
      n += veille.pas(terrain, partie).filter((e) => e.son === "scie").length;
    }
    expect(PORTEE_SCIE).toBeLessThan(4);
    expect(n).toBe(1);
  });
  it("le laser se charge (le trait pâle), puis brûle ; rien quand il est loin du joueur", () => {
    const laser: Laser = { c: 12, r0: 5, r1: 9, decalage: 0 };
    const { terrain, partie } = sur(couloir(), { lasers: [laser] });
    const veille = new VeilleDesDangers();
    const sons: string[] = [];
    // (le joueur est un peu devant le rayon quand il brûle : un joueur passif y meurt, la veille continue de lire la partie jusqu'à sa mort)
    for (let i = 0; i < LASER_CYCLE + 40; i++) {
      if (!partie.finie) partie.avancer();
      else partie.tick++;
      for (const e of veille.pas(terrain, partie)) sons.push(e.son);
    }
    expect(sons.indexOf("laserCharge")).toBeGreaterThanOrEqual(0);
    expect(sons.indexOf("laserBrule")).toBeGreaterThan(sons.indexOf("laserCharge"));
    expect(PORTEE_LASER).toBeGreaterThan(LARGEUR_MORCEAU / 2);
    // Loin du joueur : un laser à 60 colonnes ne se fait pas entendre.
    const loin = terrainDeTest([couloir()], { lasers: [{ c: 5, r0: 5, r1: 9, decalage: 0 }] });
    const p2 = new Partie(loin);
    const v2 = new VeilleDesDangers();
    for (let i = 0; i < 10; i++) {
      p2.avancer();
      p2.x = 60 * CASE;
      expect(v2.pas(loin, p2)).toEqual([]);
    }
  });
});
