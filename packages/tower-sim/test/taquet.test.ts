import { beforeAll, describe, expect, it } from "vitest";
import { COMMANDE, COMMANDES_CONNUES, COMMANDES_CONNUES_V4, decoderRediffusion, DEPART_EMBOITEMENT, encoderRediffusion, enregistrer, ErreurRediffusion, Partie, type Rapier, REGLAGES_DEFAUT, rejouer, SCENARIO_EMBOITEMENT } from "../src";
import { LIMITE_X8 } from "../src/constantes";
import { chargerRapier } from "../src/rapier";

// Lot T8 — le taquet (simulation 5) : un élan de la pièce EN MAIN, avant la pose (portée, vitesse, arrêt net contre un obstacle, choc donné à la pièce frappée, nombre d'élans). Et les deux bits sont
// nouveaux de la simulation 5 : les versions 3 et 4 les refusent.
let R: Rapier;
beforeAll(async () => {
  R = await chargerRapier();
});

/** Les quatre premières pièces de `?scenario=emboitement` sont la tour de départ (le L, le bâton et les deux murs) : la première pièce jouée porte le numéro 4. */
const PREMIERE = DEPART_EMBOITEMENT.length;

/**
 * Le carré de la niche : cinq pas à gauche (il descend le long du bout du bâton couché), puis `quand(bas)` dit, à chaque tick et d'après la hauteur du bas du carré, quel masque ajouter (l'élan de taquet).
 * Rend la partie arrêtée un peu après le lâcher (900 ticks au plus).
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

describe("le taquet : un élan de la pièce en main, d'un seul appui", () => {
  it("sans élan, le carré se pose à gauche du bâton, hors de la niche (le bâton la ferme par le haut)", () => {
    const p = jouerNiche(() => 0);
    expect(p.vue().pieces[PREMIERE]!.x).toBeLessThan(-2.4);
    p.dispose();
  });

  it("donné quand le carré passe sous le bâton (il lui faut le temps de l'élan avant de toucher le sol : l'atterrissage le coupe), l'élan le glisse dans la niche jusqu'à la tige du L, où il s'arrête net, calé — sans bouger le L ni le bâton", () => {
    for (const haut of [1, 0.7, 0.4]) {
      let donne = false;
      const p = jouerNiche((bas) => {
        if (donne || bas > haut) return 0;
        donne = true;
        return COMMANDE.TAQUET_DROITE;
      });
      const q = p.vue().pieces[PREMIERE]!;
      expect(q.x, `élan à ${haut} m`).toBeGreaterThan(-1.1);
      expect(q.x, `élan à ${haut} m`).toBeLessThan(-0.95);
      expect(q.y, `élan à ${haut} m`).toBeCloseTo(1, 1);
      expect(Math.abs(p.vue().pieces[0]!.x - DEPART_EMBOITEMENT[0]!.x8 / 8), `le L, élan à ${haut} m`).toBeLessThan(0.15); // le L est frappé par le carré qui arrive contre sa tige : il reçoit un choc, il glisse de quelques centimètres avec le bâton
      expect(Math.abs(p.vue().pieces[1]!.x - (DEPART_EMBOITEMENT[1]!.x8 / 8)), `le bâton, élan à ${haut} m`).toBeLessThan(0.15);
      expect(p.vue().pieces[1]!.y, `le bâton reste posé, élan à ${haut} m`).toBeCloseTo(3.5, 1);
      p.dispose();
    }
  });

  it("donné trop tôt, l'élan frappe le bâton : le carré s'arrête net contre son bout, et le bâton reçoit un choc (il glisse un peu sur la tige sans tomber) ; le carré se pose ensuite dans le vide à gauche", () => {
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
    expect(p.vue().pieces[PREMIERE]!.x).toBeLessThan(-2.4); // le carré, lui, est resté à gauche de son bout
    p.dispose();
  });

  it("l'élan vers la gauche envoie la pièce vers la gauche ; les pas, le quart de tour et un second ordre sont ignorés pendant l'élan", () => {
    const p = new Partie(R, { nom: "libre", pieces: ["O"], plateformeDemi8: 128 });
    const x0 = p.vue().pieces[0]!.x;
    p.avancer(COMMANDE.TAQUET_GAUCHE);
    for (let k = 0; k < 20; k++) p.avancer(k < 5 ? COMMANDE.DROITE | COMMANDE.TOURNER | COMMANDE.TAQUET_DROITE : 0);
    expect(p.vue().pieces[0]!.x).toBeLessThan(x0 - 2.9);
    expect(p.vue().pieces[0]!.x).toBeGreaterThan(x0 - 3.1);
    p.dispose();
  });

  it("en terrain libre, un élan fait 3 m (vitesse × durée), la pièce se recale sur la grille des demi-cases ; trois élans font 9 m ; un quatrième est refusé (trois élans par pièce)", () => {
    const parcours = (n: number): number => {
      const p = new Partie(R, { nom: "libre", pieces: ["O"], plateformeDemi8: 128 });
      const x0 = p.vue().pieces[0]!.x;
      for (let i = 0; i < n; i++) {
        p.avancer(COMMANDE.TAQUET_DROITE);
        for (let k = 0; k < 12; k++) p.avancer(0);
      }
      const x = p.vue().pieces[0]!.x;
      p.dispose();
      return x - x0;
    };
    expect(parcours(1)).toBeCloseTo(3, 5);
    expect(parcours(3)).toBeCloseTo(9, 5);
    expect(parcours(4)).toBeCloseTo(9, 5);
  });

  it("l'élan est borné par le bord de la scène", () => {
    const p = new Partie(R, { nom: "libre", pieces: ["O"], plateformeDemi8: 128 });
    for (let i = 0; i < 3; i++) {
      p.avancer(COMMANDE.TAQUET_DROITE);
      for (let k = 0; k < 12; k++) p.avancer(0);
    }
    expect(p.vue().pieces[0]!.x * 8).toBeLessThanOrEqual(LIMITE_X8);
    p.dispose();
  });

  it("l'élan frappe une pièce posée : elle reçoit un choc (elle glisse de quelques centimètres), le carré en main s'arrête net contre elle puis se pose sur la grille", () => {
    const p = new Partie(R, { nom: "choc", pieces: ["O"], plateformeDemi8: 128, depart: [{ kind: "O", rot: 0, x8: 32, y8: 8 }] }); // le carré posé : x de 3 à 5, y de 0 à 2
    let donne = false;
    for (let k = 0; k < 400 && p.vue().active === 1; k++) {
      let m: number = COMMANDE.DESCENDRE;
      const bas = p.vue().pieces[1]!.y - 1;
      if (bas < 4) m = 0;
      if (!donne && bas <= 1.4) {
        m |= COMMANDE.TAQUET_DROITE;
        donne = true;
      }
      if (k < 3) m |= COMMANDE.DROITE; // le carré en main part à l'abscisse 0,5 : son élan de 3 m le mène au contact du carré posé
      p.avancer(m);
    }
    for (let k = 0; k < 120; k++) p.avancer(0);
    const posee = p.vue().pieces[0]!;
    expect(donne).toBe(true);
    expect(posee.x - 4).toBeGreaterThan(0.03);
    expect(posee.x - 4).toBeLessThan(0.6);
    expect(posee.y).toBeCloseTo(1, 1); // il glisse sans basculer
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
