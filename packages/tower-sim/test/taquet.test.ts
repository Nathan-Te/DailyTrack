import { beforeAll, describe, expect, it } from "vitest";
import { COMMANDE, COMMANDES_CONNUES, COMMANDES_CONNUES_V4, decoderRediffusion, DEPART_EMBOITEMENT, encoderRediffusion, enregistrer, ErreurRediffusion, Partie, type Rapier, REGLAGES_DEFAUT, rejouer, SCENARIO_EMBOITEMENT } from "../src";
import { chargerRapier } from "../src/rapier";

// Lot T8 — le taquet (simulation 5) : un vrai coup sur le côté juste après le lâcher (fenêtre, portée, nombre de coups). Et les deux bits sont nouveaux de la simulation 5 : les versions 3 et 4 les refusent.
let R: Rapier;
beforeAll(async () => {
  R = await chargerRapier();
});


/** Les quatre premières pièces de `?scenario=emboitement` sont la tour de départ (le L, le bâton et les deux murs) : la première pièce jouée porte le numéro 4. */
const PREMIERE = DEPART_EMBOITEMENT.length;

/** Joue le carré de la niche : cinq pas à gauche (il se pose à gauche du bâton couché, contre lui), puis `coups` donne les ticks (depuis le lâcher) de chaque taquet vers la droite. */
function jouerNiche(coups: readonly number[], sens: number = COMMANDE.TAQUET_DROITE): Partie {
  const p = new Partie(R, { ...SCENARIO_EMBOITEMENT, pieces: ["O", "O"] });
  let k = 0;
  let lache = -1;
  while (p.etape !== "fini" && k < 900) {
    const v = p.vue();
    let m = COMMANDE.DESCENDRE;
    if (v.active === PREMIERE && k < 5) m |= COMMANDE.GAUCHE;
    if (lache < 0 && v.pieces[PREMIERE]?.etat === "libre") lache = k;
    if (lache >= 0 && coups.includes(k - lache)) m |= sens;
    p.avancer(m);
    k++;
  }
  return p;
}

describe("le taquet : un vrai coup sur le côté, d'un seul appui", () => {
  it("sans coup, le carré reste où il s'est posé : à gauche du bâton, hors de la niche (le bâton ferme la niche par le haut)", () => {
    const p = jouerNiche([]);
    expect(p.vue().pieces[PREMIERE]!.x).toBeLessThan(-2.4);
    p.dispose();
  });

  it("UN coup, à n'importe quel instant de la fenêtre (de 2 à 28 ticks après le lâcher), envoie le carré dans la niche jusqu'à la tige du L, où il s'arrête, calé — sans bouger le L", () => {
    for (const t of [2, 6, 10, 16, 22, 28]) {
      const p = jouerNiche([t]);
      const q = p.vue().pieces[PREMIERE]!;
      expect(q.x, `coup à ${t}`).toBeGreaterThan(-1.1);
      expect(q.x, `coup à ${t}`).toBeLessThan(-0.95);
      expect(q.y, `coup à ${t}`).toBeCloseTo(1, 2);
      expect(Math.abs(p.vue().pieces[0]!.x - DEPART_EMBOITEMENT[0]!.x8 / 8), `le L, coup à ${t}`).toBeLessThan(0.03);
      p.dispose();
    }
  });

  it("le coup vers la gauche envoie la pièce vers la gauche ; hors de la fenêtre (30 ticks) ou sans pièce lâchée, l'ordre est sans effet", () => {
    const g = jouerNiche([6], COMMANDE.TAQUET_GAUCHE);
    expect(g.vue().pieces[PREMIERE]!.x).toBeLessThan(-3.5); // le carré part à gauche, de sa pose (x = −2,5)
    g.dispose();
    const tard = jouerNiche([32]);
    expect(tard.vue().pieces[PREMIERE]!.x).toBeLessThan(-2.4);
    tard.dispose();
    const p = new Partie(R, { ...SCENARIO_EMBOITEMENT, pieces: ["O"] });
    const x0 = p.vue().pieces[PREMIERE]!.x;
    p.avancer(COMMANDE.TAQUET_DROITE); // rien n'est lâché : la pièce en main n'est jamais touchée
    expect(p.vue().pieces[PREMIERE]!.x).toBe(x0);
    p.dispose();
  });

  it("en terrain libre, un coup a sa portée (vitesse × durée = 1,5 m) puis s'arrête net ; deux coups à la suite vont deux fois plus loin ; un troisième est refusé (deux coups par pièce)", () => {
    const portee = (coups: number[]): number => {
      const p = new Partie(R, { nom: "libre", pieces: ["O", "O"], plateformeDemi8: 128 });
      let k = 0;
      let lache = -1;
      let x0 = NaN;
      while (k < 400) {
        const v = p.vue();
        let m = COMMANDE.DESCENDRE;
        if (lache < 0 && v.pieces[0]!.etat === "libre") {
          lache = k;
          x0 = v.pieces[0]!.x;
        }
        if (lache >= 0 && coups.includes(k - lache)) m |= COMMANDE.TAQUET_DROITE;
        p.avancer(m);
        k++;
      }
      const d = p.vue().pieces[0]!.x - x0;
      p.dispose();
      return d;
    };
    const un = portee([4]);
    expect(un).toBeGreaterThan(1.35);
    expect(un).toBeLessThan(1.65);
    const deux = portee([4, 25]);
    expect(deux).toBeGreaterThan(2.7);
    const trois = portee([4, 25, 27]); // le troisième ordre (dans la fenêtre, après le deuxième coup fini) n'ajoute rien : deux coups par pièce
    expect(Math.abs(trois - deux)).toBeLessThan(0.05);
    expect(portee([4, 8])).toBeLessThan(un + 0.05); // un coup en cours ne se double pas
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
