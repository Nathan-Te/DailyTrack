import { beforeAll, describe, expect, it } from "vitest";
import { COMMANDE, COMMANDES_CONNUES, COMMANDES_CONNUES_V4, decoderRediffusion, DEPART_EMBOITEMENT, encoderRediffusion, enregistrer, ErreurRediffusion, Partie, type Rapier, REGLAGES_DEFAUT, rejouer, SCENARIO_EMBOITEMENT } from "../src";
import { LIMITE_X8 } from "../src/constantes";
import { chargerRapier } from "../src/rapier";
import { joueurEmboitement } from "../tools/joueur";

// Lot T8 — le taquet (simulation 5) : un élan de la pièce EN MAIN, avant la pose (portée, vitesse, arrêt net contre un obstacle, choc donné à la pièce frappée, nombre d'élans). Et les deux bits sont
// nouveaux de la simulation 5 : les versions 3 et 4 les refusent.
let R: Rapier;
beforeAll(async () => {
  R = await chargerRapier();
});

/** Les quatre premières pièces de `?scenario=emboitement` sont la tour de départ (le L, le bâton et les deux murs) : la première pièce jouée porte le numéro 4. */
const PREMIERE = DEPART_EMBOITEMENT.length;

/**
 * Le carré de la niche : cinq pas à gauche (il descend le long du bout du bâton couché), puis `quand(bas, k)` dit, à chaque tick et d'après la hauteur du bas du carré, quel masque ajouter (les taquets).
 * Rend la partie arrêtée 900 ticks au plus après le début.
 */
function jouerNiche(quand: (bas: number, k: number) => number): Partie {
  const p = new Partie(R, { ...SCENARIO_EMBOITEMENT, pieces: ["O", "O"] });
  let k = 0;
  while (p.etape !== "fini" && k < 900) {
    const v = p.vue();
    let m = 0;
    if (v.active === PREMIERE) {
      if (k < 5) m |= COMMANDE.GAUCHE;
      else m |= quand(v.pieces[PREMIERE]!.y - 1, k);
    }
    p.avancer(m);
    k++;
  }
  return p;
}

/** Une pièce libre sur une grande plateforme, sans rien autour : `jouer(p)` donne les commandes ; rend l'abscisse du centre de la pièce en main avant et après. */
function enTerrainLibre(stabilite: Record<string, number>, jouer: (p: Partie) => void): { avant: number; apres: number } {
  const p = new Partie(R, { nom: "libre", pieces: ["O"], plateformeDemi8: 128 }, REGLAGES_DEFAUT, { stabilite });
  const avant = p.vue().pieces[0]!.x;
  jouer(p);
  const apres = p.vue().pieces[0]!.x;
  p.dispose();
  return { avant, apres };
}

const attendre = (p: Partie, n: number): void => {
  for (let k = 0; k < n; k++) p.avancer(0);
};

describe("le taquet : un petit coup de côté de la pièce en main, manuel à 100 %", () => {
  it("sans taquet, le carré se pose à gauche du bâton, hors de la niche (le bâton la ferme par le haut)", () => {
    const p = jouerNiche(() => 0);
    expect(p.vue().pieces[PREMIERE]!.x).toBeLessThan(-2.4);
    p.dispose();
  });

  it("deux taquets donnés quand le carré passe sous le bâton le glissent dans la niche jusqu'à la tige du L, où il s'arrête net, calé — sans bouger le L ni le bâton", () => {
    for (const haut of [1, 0.7]) {
      let premier = -1;
      const p = jouerNiche((bas, k) => {
        if (premier < 0 && bas <= haut) {
          premier = k;
          return COMMANDE.TAQUET_DROITE;
        }
        return premier >= 0 && k === premier + 5 ? COMMANDE.TAQUET_DROITE : 0;
      });
      const q = p.vue().pieces[PREMIERE]!;
      expect(q.x, `taquets à ${haut} m`).toBeGreaterThan(-1.1);
      expect(q.x, `taquets à ${haut} m`).toBeLessThan(-0.95);
      expect(q.y, `taquets à ${haut} m`).toBeCloseTo(1, 1);
      expect(Math.abs(p.vue().pieces[0]!.x - DEPART_EMBOITEMENT[0]!.x8 / 8), `le L, taquets à ${haut} m`).toBeLessThan(0.15); // la tige du L reçoit le choc du carré qui arrive : elle glisse de quelques centimètres, avec le bâton
      expect(p.vue().pieces[1]!.y, `le bâton reste posé, taquets à ${haut} m`).toBeCloseTo(3.5, 1);
      p.dispose();
    }
  });

  it("donné contre le bout du bâton, le taquet frappe le bâton : il reçoit un choc (il glisse un peu sur sa tige sans tomber) et le carré, lui, ne bouge pas", () => {
    let donne = false;
    const p = jouerNiche((bas) => {
      if (donne || bas > 2.5) return 0;
      donne = true;
      return COMMANDE.TAQUET_DROITE;
    });
    const baton = p.vue().pieces[1]!;
    const x0 = DEPART_EMBOITEMENT[1]!.x8 / 8;
    expect(baton.x - x0).toBeGreaterThan(0.03); // le bâton a été poussé vers la droite
    expect(baton.x - x0).toBeLessThan(1); // sans quitter sa tige
    expect(baton.y).toBeCloseTo(3.5, 1); // et il est resté posé dessus
    expect(p.vue().pieces[PREMIERE]!.x).toBeLessThan(-2.4); // le carré est resté à gauche de son bout
    p.dispose();
  });

  it("un taquet fait 1 m (4 ticks de 2 huitièmes), à droite comme à gauche ; les pas, le quart de tour et un second ordre sont ignorés pendant le coup", () => {
    const d = enTerrainLibre({}, (p) => {
      p.avancer(COMMANDE.TAQUET_DROITE);
      for (let k = 0; k < 3; k++) p.avancer(COMMANDE.GAUCHE | COMMANDE.TOURNER | COMMANDE.TAQUET_GAUCHE);
      attendre(p, 10);
    });
    expect(d.apres - d.avant).toBeCloseTo(1, 6);
    const g = enTerrainLibre({}, (p) => {
      p.avancer(COMMANDE.TAQUET_GAUCHE);
      attendre(p, 10);
    });
    expect(g.apres - g.avant).toBeCloseTo(-1, 6);
  });

  it("aucun recalage : la pièce reste exactement là où le coup l'a mise, hors de la grille des demi-cases (portée réglée à 0,75 m)", () => {
    const d = enTerrainLibre({ taquetTicks: 3 }, (p) => {
      p.avancer(COMMANDE.TAQUET_DROITE);
      attendre(p, 10);
    });
    expect(d.apres - d.avant).toBeCloseTo(0.75, 6);
  });

  it("sans limite de coups par pièce : dix taquets de suite font dix mètres ; le bord de la scène borne la course", () => {
    const dix = enTerrainLibre({}, (p) => {
      for (let i = 0; i < 10; i++) {
        p.avancer(COMMANDE.TAQUET_DROITE);
        attendre(p, 4);
      }
    });
    expect(dix.apres - dix.avant).toBeCloseTo(10, 6);
    const bord = enTerrainLibre({}, (p) => {
      for (let i = 0; i < 40; i++) {
        p.avancer(COMMANDE.TAQUET_DROITE);
        attendre(p, 4);
      }
    });
    expect(bord.apres * 8).toBeLessThanOrEqual(LIMITE_X8);
    expect(bord.apres * 8).toBeGreaterThan(LIMITE_X8 - 16);
  });

  it("la partie de référence du golden (joueurEmboitement) glisse le premier carré dans la niche avec deux taquets", () => {
    const p = joueurEmboitement(R, SCENARIO_EMBOITEMENT);
    const q = p.vue().pieces[PREMIERE]!;
    expect(q.x).toBeGreaterThan(-1.1);
    expect(q.x).toBeLessThan(-0.95);
    expect(p.commandesJouees().filter((m) => m & COMMANDE.TAQUET_DROITE).length).toBeGreaterThanOrEqual(2);
    p.dispose();
  });

  it("le taquet frappe une pièce posée : elle reçoit un choc (elle glisse de quelques centimètres sans basculer), le carré en main s'arrête contre elle", () => {
    const p = new Partie(R, { nom: "choc", pieces: ["O"], plateformeDemi8: 128, depart: [{ kind: "O", rot: 0, x8: 32, y8: 8 }] }); // le carré posé : x de 3 à 5, y de 0 à 2
    let donne = false;
    for (let k = 0; k < 400 && p.vue().active === 1; k++) {
      let m: number = COMMANDE.DESCENDRE;
      const bas = p.vue().pieces[1]!.y - 1;
      if (bas < 4) m = 0;
      if (k < 3) m |= COMMANDE.DROITE; // le carré en main part à l'abscisse 1,5 : son bord droit est à 0,5 m du carré posé
      if (!donne && bas <= 1.4) {
        m |= COMMANDE.TAQUET_DROITE;
        donne = true;
      }
      p.avancer(m);
    }
    for (let k = 0; k < 120; k++) p.avancer(0);
    const posee = p.vue().pieces[0]!;
    expect(donne).toBe(true);
    expect(posee.x - 4).toBeGreaterThan(0.03);
    expect(posee.x - 4).toBeLessThan(0.6);
    expect(posee.y).toBeCloseTo(1, 1);
    p.dispose();
  });
});

describe("les deux bits du taquet sont nouveaux de la simulation 5", () => {
  it("COMMANDES_CONNUES porte les six bits, COMMANDES_CONNUES_V4 les quatre anciens", () => {
    expect(COMMANDES_CONNUES).toBe(63);
    expect(COMMANDES_CONNUES_V4).toBe(15);
  });

  const rediff = (sim: number, masque: number): string =>
    encoderRediffusion({ sim, g: 0, contenu: { scenario: "essai" }, reglages: { ...REGLAGES_DEFAUT }, plages: [{ masque, ticks: 5 }] });

  it("une rediffusion des simulations 3 et 4 qui contient un bit du taquet est refusée (commandes_inconnues) ; en simulation 5 elle se décode", () => {
    for (const sim of [3, 4]) {
      for (const bit of [COMMANDE.TAQUET_GAUCHE, COMMANDE.TAQUET_DROITE]) {
        expect(() => decoderRediffusion(rediff(sim, bit | COMMANDE.DESCENDRE))).toThrowError(ErreurRediffusion);
        try {
          decoderRediffusion(rediff(sim, bit));
        } catch (e) {
          expect((e as ErreurRediffusion).code).toBe("commandes_inconnues");
        }
      }
    }
    expect(decoderRediffusion(rediff(5, COMMANDE.TAQUET_GAUCHE | COMMANDE.TAQUET_DROITE)).plages[0]!.masque).toBe(48);
  });

  it("une partie des simulations 3 et 4 ignore les bits du taquet (et ne les enregistre pas) : la rediffusion qu'elle produit se rejoue", () => {
    for (const version of [3, 4]) {
      const p = new Partie(R, SCENARIO_EMBOITEMENT, REGLAGES_DEFAUT, { version });
      p.avancer(COMMANDE.TAQUET_DROITE | COMMANDE.DESCENDRE);
      expect(p.commandesJouees()[0]).toBe(COMMANDE.DESCENDRE);
      p.dispose();
    }
  });

  it("une partie rejouée en simulation 5 avec des taquets donne le même résultat que la partie jouée (la rediffusion porte les bits)", () => {
    const p = new Partie(R, SCENARIO_EMBOITEMENT, REGLAGES_DEFAUT, { version: 5 });
    let k = 0;
    while (p.etape !== "fini" && k < 20000) p.avancer(k++ % 40 === 3 ? COMMANDE.TAQUET_DROITE | COMMANDE.DESCENDRE : COMMANDE.DESCENDRE);
    const r = enregistrer(p);
    expect(r.sim).toBe(5);
    expect(r.plages.some((x) => x.masque & COMMANDE.TAQUET_DROITE)).toBe(true);
    const texte = encoderRediffusion(r);
    expect(rejouer(R, SCENARIO_EMBOITEMENT, texte)).toEqual(p.resultat());
    p.dispose();
  });
});
