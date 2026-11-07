import { Box3, PerspectiveCamera, Vector3, type Mesh, type Object3D } from "three";
import { describe, expect, it } from "vitest";
import { ANNONCE, BOSS_IDS, ETOURDI, MARCHE, RECUPERE, RUGIT, Z_BANDE, type Golem, type Zone } from "@cdj/rush-sim";
import { CATALOGUE_FR } from "../src/catalogue.fr";
import { CATALOGUE_EN } from "../src/catalogue.en";
import { animerBoss, bossFictif, capDuBoss, courseEnCours, creerBoss, prochaineCourse, type BossVu, type EntreeBoss } from "../src/bosses";
import { cameraDuBestiaire, ECART_BESTIAIRE } from "../src/bestiaire";
import { creerChevalier } from "../src/acteurs";

// Les cinq boss côté vue (lot BR3), sans navigateur : leurs tailles (documentées ici), leur nombre de formes (donc d'appels de dessin), leur animation dans tous les états (aucune valeur folle), leur cap, la caméra du bestiaire et les textes français et anglais.
/** La boîte des formes VISIBLES d'un acteur (les étoiles du bélier, cachées hors de l'étourdissement, ne comptent pas). */
const taille = (racine: Object3D): Vector3 => {
  racine.updateMatrixWorld(true);
  const b = new Box3();
  racine.traverseVisible((n) => {
    if ((n as Mesh).isMesh && !(n as Mesh).layers.isEnabled(1)) b.union(new Box3().setFromObject(n));
  });
  return b.getSize(new Vector3());
};
const formes = (racine: Object3D): number => {
  let n = 0;
  racine.traverse((o) => {
    if ((o as Mesh).isMesh && !(o as Mesh).layers.isEnabled(1) && !((o as Mesh).material as { isMeshBasicMaterial?: boolean }).isMeshBasicMaterial) n++;
  });
  return n;
};
const entree = (o: Partial<EntreeBoss> = {}): EntreeBoss => ({ dt: 1 / 60, temps: 1.3, t: 0, vivant: true, mort: 0, marche: false, sursaut: 0, tick: 0, zones: [], elan: 24, dort: false, ...o });
const poser = (kind: number, o: Partial<Golem>): Golem => ({ ...bossFictif(kind), ...o });
const bande = (o: Partial<Zone> = {}): Zone => ({ type: Z_BANDE, x: 0, y: 0, r: 5324, t0: 0, ti: 103, rang: 0, x2: 0, y2: 40000, dash: 33, ...o });

describe("les cinq boss (lot BR3) : les tailles", () => {
  const T = BOSS_IDS.map((_, k) => taille(creerBoss(k).racine));
  const chevalier = taille(creerChevalier().racine).y;
  it("le golem est inchangé (fiche des tailles du lot BR0b : 4,5 à 7,4 m de haut)", () => {
    expect(creerBoss(0).kind).toBe(0);
    expect(taille(creerBoss(0).racine).y).toBeGreaterThan(4.5);
    expect(taille(creerBoss(0).racine).y).toBeLessThan(7.6);
  });
  it("la reine gelée : un dôme de 4 m de large (rayon 2 m, comme sa collision), 2,2 à 3,2 m de haut couronne comprise", () => {
    expect(T[1]!.x).toBeGreaterThan(3.6);
    expect(T[1]!.x).toBeLessThan(4.6);
    expect(T[1]!.y).toBeGreaterThan(2.2);
    expect(T[1]!.y).toBeLessThan(3.2);
  });
  it("le grand-duc : 7 à 9 m d'envergure, 3 à 4,5 m de haut, bien plus petit que la reine en largeur au sol mais plus large qu'elle en vol", () => {
    expect(T[2]!.x).toBeGreaterThan(7);
    expect(T[2]!.x).toBeLessThan(9.5);
    expect(T[2]!.y).toBeGreaterThan(3);
    expect(T[2]!.y).toBeLessThan(4.6);
  });
  it("le bélier : un gros animal trapu, 5,5 à 7 m de long, 3 à 4,6 m de haut (cornes comprises)", () => {
    expect(T[3]!.z).toBeGreaterThan(5.5);
    expect(T[3]!.z).toBeLessThan(7.2);
    expect(T[3]!.y).toBeGreaterThan(3);
    expect(T[3]!.y).toBeLessThan(4.6);
  });
  it("le vieux chêne : 7 à 9,5 m de haut, 5,5 à 10 m de large (cime, bras et racines)", () => {
    expect(T[4]!.y).toBeGreaterThan(7);
    expect(T[4]!.y).toBeLessThan(9.5);
    expect(T[4]!.x).toBeGreaterThan(5.5);
    expect(T[4]!.x).toBeLessThan(10);
  });
  it("chaque boss est bien plus grand que le chevalier (1,5 m)", () => {
    for (const t of T) expect(Math.max(t.x, t.y, t.z)).toBeGreaterThan(2.2 * chevalier);
  });
  it("chaque boss tient en peu de formes (un appel de dessin chacune, deux avec le contour) : 12 au plus", () => {
    BOSS_IDS.forEach((id, k) => expect(formes(creerBoss(k).racine), id).toBeLessThanOrEqual(12));
  });
});

describe("l'animation des boss dans tous leurs états", () => {
  const vide = (kind: number): BossVu => creerBoss(kind);
  const sain = (racine: Object3D): boolean => {
    let ok = true;
    racine.traverse((n) => {
      for (const v of [n.position, n.rotation, n.scale] as unknown as Record<string, number>[]) for (const k of ["x", "y", "z"]) if (!Number.isFinite(v[k]!)) ok = false;
    });
    return ok;
  };
  for (const [k, id] of BOSS_IDS.entries()) {
    it(`${id} : tous les états, toutes les attaques, vivant, mort, endormi : aucune valeur folle`, () => {
      const vu = vide(k);
      for (const etat of [MARCHE, ANNONCE, RECUPERE, RUGIT, ETOURDI]) {
        for (let attaque = 0; attaque <= 9; attaque++) {
          for (const sol of [0, 1]) {
            for (const [t, dort, vivant] of [[0, false, true], [30, false, true], [90, false, true], [200, true, true], [40, false, false]] as const) {
              const g = poser(k, { etat, attaque, sol, t, duree: 120, t1: 70, recup: 90, phase: 1 + (t % 2) });
              const zones = [bande({ ti: 103, dash: 33 }), bande({ ti: 143, dash: 33, rang: 1 })];
              animerBoss(vu, g, entree({ t, tick: 60 + t, zones, dort, vivant, mort: vivant ? 0 : t }));
              expect(sain(vu.racine), `${id} etat ${etat} attaque ${attaque}`).toBe(true);
              expect(Number.isFinite(vu.haut)).toBe(true);
              expect(vu.haut).toBeGreaterThanOrEqual(0);
              expect(vu.haut).toBeLessThan(7);
              expect(vu.reflet).toBeGreaterThanOrEqual(0);
              expect(vu.reflet).toBeLessThan(1);
            }
          }
        }
      }
    });
  }
  it("le grand-duc en vol est à 3-4 m de haut ; posé en récupération il est au sol, essoufflé (il clignote), ailes repliées", () => {
    const vu = creerBoss(2) as Extract<BossVu, { kind: 2 }>;
    for (let i = 0; i < 120; i++) animerBoss(vu, poser(2, { sol: 0, etat: MARCHE }), entree({ dt: 1 / 60, temps: i / 60 }));
    expect(vu.haut).toBeGreaterThan(3.2);
    expect(vu.haut).toBeLessThan(4);
    expect(vu.reflet).toBe(0);
    for (let i = 0; i < 120; i++) animerBoss(vu, poser(2, { sol: 1, etat: RECUPERE, recup: 100, t: i }), entree({ dt: 1 / 60, temps: 2 + i / 60, t: i }));
    expect(vu.haut).toBeLessThan(0.05);
    expect(vu.racine.position.y).toBeLessThan(0.05);
    expect(vu.reflet).toBeGreaterThan(0); // le moment à punir se voit
    // les ailes se replient (l'aile droite pend)
    expect(vu.ailes[1].rotation.z).toBeLessThan(-0.8);
  });
  it("le grand-duc qui plonge descend le long de sa bande : plus il avance, plus il est bas", () => {
    const vu = creerBoss(2) as Extract<BossVu, { kind: 2 }>;
    const g = poser(2, { sol: 0, etat: ANNONCE, attaque: 4, duree: 103, t1: 70 });
    const zones = [bande({ ti: 103, dash: 33 })];
    const haut: number[] = [];
    for (let i = 0; i < 90; i++) animerBoss(vu, g, entree({ tick: 55, zones, t: 55 })); // il a eu le temps de prendre son altitude d'annonce
    for (const tick of [60, 70, 80, 90, 100]) {
      animerBoss(vu, g, entree({ tick, zones, t: tick }));
      haut.push(vu.haut);
    }
    expect(haut[0]!).toBeGreaterThan(haut[2]!);
    expect(haut[2]!).toBeGreaterThan(haut[4]!);
    expect(haut[4]!).toBeLessThan(1.5);
  });
  it("la reine bondit : elle monte pendant l'élan, retombe à l'impact (haut 0 avant et après)", () => {
    const vu = creerBoss(1) as Extract<BossVu, { kind: 1 }>;
    const g = poser(1, { etat: ANNONCE, attaque: 3, duree: 70, t1: 70 });
    const h = (t: number): number => {
      animerBoss(vu, g, entree({ t, elan: 24 }));
      return vu.haut;
    };
    expect(h(10)).toBe(0); // elle s'écrase
    expect(h(40)).toBe(0);
    expect(h(58)).toBeGreaterThan(2.5); // au sommet du bond
    expect(h(70)).toBeLessThan(0.1); // elle retombe
  });
  it("le bélier étourdi montre ses étoiles ; il ne les montre pas autrement", () => {
    const vu = creerBoss(3) as Extract<BossVu, { kind: 3 }>;
    animerBoss(vu, poser(3, { etat: ETOURDI, duree: 120 }), entree({ t: 20 }));
    expect(vu.etoiles.visible).toBe(true);
    animerBoss(vu, poser(3, { etat: MARCHE }), entree());
    expect(vu.etoiles.visible).toBe(false);
  });
});

describe("les courses et le cap", () => {
  const cible = { x: 0, y: 20000 };
  it("la course en cours est la bande dont la fenêtre `dash` (les derniers ticks avant l'impact) contient le tick", () => {
    const z = bande({ ti: 103, dash: 33 });
    expect(courseEnCours([z], 69)).toBeNull();
    expect(courseEnCours([z], 70)?.u).toBeCloseTo(0, 5);
    expect(courseEnCours([z], 86.5)?.u).toBeCloseTo(0.5, 5);
    expect(courseEnCours([z], 103)).toBeNull();
    expect(courseEnCours([bande({ dash: 0 })], 90)).toBeNull(); // une bande sans course (les racines du chêne) n'en est pas une
  });
  it("la prochaine course est la bande qui frappe le plus tôt", () => {
    expect(prochaineCourse([bande({ ti: 150 }), bande({ ti: 103 })])!.ti).toBe(103);
    expect(prochaineCourse([])).toBeNull();
  });
  it("le bélier et le grand-duc qui annoncent regardent le long de leur bande ; sinon vers le chevalier ; le grand-duc en vol regarde où il va", () => {
    const z = bande({ x: 0, y: 0, x2: 40000, y2: 0 });
    for (const kind of [2, 3]) expect(capDuBoss(poser(kind, { etat: ANNONCE }), [z], cible, { dx: 0, dy: 0 })).toBeCloseTo(Math.PI / 2, 5);
    expect(capDuBoss(poser(3, { etat: MARCHE }), [z], cible, { dx: 0, dy: 0 })).toBeCloseTo(0, 5); // vers le chevalier : +z
    expect(capDuBoss(poser(2, { etat: MARCHE, sol: 0 }), [], cible, { dx: 100, dy: 0 })).toBeCloseTo(Math.PI / 2, 5);
    expect(capDuBoss(poser(2, { etat: MARCHE, sol: 1 }), [], cible, { dx: 100, dy: 0 })).toBeCloseTo(0, 5); // posé : vers le chevalier
    expect(capDuBoss(poser(0, { etat: ANNONCE }), [z], cible, { dx: 0, dy: 0 })).toBeCloseTo(0, 5); // le golem ne charge pas
  });
});

describe("la caméra du bestiaire", () => {
  it("les cinq boss (bras et ailes compris) tiennent dans l'image pour un téléphone en paysage, un PC en 16:9 et un écran carré", () => {
    for (const aspect of [844 / 390, 16 / 9, 1]) {
      const c = cameraDuBestiaire(aspect);
      const cam = new PerspectiveCamera(25, aspect, 0.5, 200);
      cam.position.set(...c.position);
      cam.lookAt(...c.regard);
      cam.updateMatrixWorld(true);
      const demiRangee = (2 * ECART_BESTIAIRE) + 5.2; // le centre du dernier boss + sa demi-largeur (le golem fait 10 m, bras écartés)
      for (const x of [-demiRangee, demiRangee]) {
        for (const y of [0, 7]) {
          const p = new Vector3(x, y, 0).project(cam);
          expect(Math.abs(p.x), `x ${x} aspect ${aspect.toFixed(2)}`).toBeLessThanOrEqual(1);
          expect(Math.abs(p.y)).toBeLessThanOrEqual(1);
        }
      }
    }
  });
  it("jamais plus près que la distance du jeu : la même échelle de base", () => {
    expect(cameraDuBestiaire(16 / 9).distance).toBeGreaterThanOrEqual(34);
  });
});

describe("les textes des boss (fr et en)", () => {
  it("chaque boss a un nom en français et en anglais ; le HUD le compose avec son pourcentage", () => {
    for (const id of BOSS_IDS) {
      const cle = `boss.nom.${id}` as keyof typeof CATALOGUE_FR;
      expect(CATALOGUE_FR[cle], `fr ${id}`).toBeTruthy();
      expect(CATALOGUE_EN[cle as keyof typeof CATALOGUE_EN], `en ${id}`).toBeTruthy();
    }
    expect(CATALOGUE_FR["hud.boss"]).toContain("{nom}");
    expect(CATALOGUE_FR["hud.boss"]).toContain("{pct}");
    expect(CATALOGUE_EN["hud.boss"]).toContain("{nom}");
    expect(CATALOGUE_EN["hud.boss"]).toContain("{pct}");
    expect(CATALOGUE_FR["carte.legende"]).toContain("{boss}");
    expect(CATALOGUE_EN["carte.legende"]).toContain("{boss}");
  });
  it("les noms se distinguent (français : cinq noms différents, anglais : cinq noms différents)", () => {
    expect(new Set(BOSS_IDS.map((id) => CATALOGUE_FR[`boss.nom.${id}` as keyof typeof CATALOGUE_FR])).size).toBe(5);
    expect(new Set(BOSS_IDS.map((id) => CATALOGUE_EN[`boss.nom.${id}` as keyof typeof CATALOGUE_EN])).size).toBe(5);
  });
});
