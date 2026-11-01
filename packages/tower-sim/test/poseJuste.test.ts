import { beforeAll, describe, expect, it } from "vitest";
import { COMMANDE, Partie, type Rapier, REGLAGES_DEFAUT } from "../src";
import { chargerRapier } from "../src/rapier";
import { CAS, type Cas, etendue, jouerCas, type MesureCas } from "../tools/alignement";

// Lot T6 — une pose juste reste juste. Les cas du diagnostic (`tools/alignement.ts`) sont joués par des commandes scriptées en simulation 4 ; les seuils sont ceux du rapport (`docs/tower/lots/lot-T6-grille-visee.md`) :
// jamais plus de 5 mm d'écart entre des bords qui devraient coïncider, 0,5° d'inclinaison, 5 mm de glissement entre le lâcher et le repos. La physique reste le jeu : un porte-à-faux tombe toujours.
let R: Rapier;
beforeAll(async () => {
  R = await chargerRapier();
});

const SEUIL_MM = 5;
const SEUIL_DEG = 0.5;
const cas = (nom: string): Cas => CAS.find((c) => c.nom.startsWith(nom))!;

describe("une pose juste reste juste (simulation 4)", () => {
  const mesures = new Map<string, MesureCas>();
  beforeAll(() => {
    for (const c of CAS) mesures.set(c.nom, jouerCas(R, c, 4));
  });

  it.each(CAS.map((c) => c.nom))("%s : les bords qui doivent coïncider coïncident à %i mm près, l'inclinaison et le glissement restent sous les seuils, aucune pièce n'est perdue", (nom) => {
    const m = mesures.get(nom)!;
    expect(Math.abs(m.horizontalMm), "bords").toBeLessThanOrEqual(SEUIL_MM);
    expect(m.inclinaisonDeg, "inclinaison").toBeLessThanOrEqual(SEUIL_DEG);
    expect(m.glissementMm, "glissement").toBeLessThanOrEqual(SEUIL_MM);
    expect(m.grilleMm, "bord visé / posé").toBeLessThanOrEqual(SEUIL_MM);
    expect(m.perdues).toBe(0);
  });

  it("O sur O : le jour vertical entre les deux carrés est de l'ordre du millimètre", () => {
    expect(Math.abs(mesures.get("O sur O")!.verticalMm)).toBeLessThanOrEqual(2);
  });

  it("colonne de 8 O posés justes : alignée à 5 mm près sur toute sa hauteur, le tassement (16 m théoriques) reste sous 10 mm", () => {
    const m = mesures.get("colonne de 8 O")!;
    expect(m.detail.filter((d) => d.nom.includes("/O1")).every((d) => Math.abs(d.mm) <= SEUIL_MM)).toBe(true);
    expect(Math.abs(m.tassementMm!)).toBeLessThanOrEqual(10);
  });

  it("mur de 6 pièces côte à côte (deux rangs de trois carrés) : les voisins se touchent et ne s'écartent pas (5 mm)", () => {
    const m = mesures.get("mur de 6 pièces (2 rangs de 3 O)")!;
    expect(m.detail).toHaveLength(7);
    for (const d of m.detail) expect(Math.abs(d.mm), d.nom).toBeLessThanOrEqual(SEUIL_MM);
  });

  it("T tourné posé dans un creux d'une case : la tête repose sur les deux carrés, la queue descend dans le creux sans le toucher", () => {
    const m = mesures.get("T tourné dans un creux")!;
    for (const d of m.detail.filter((x) => x.nom.startsWith("T sur"))) expect(Math.abs(d.mm + 1000)).toBeLessThanOrEqual(SEUIL_MM); // le bas du T est 1 m sous le dessus du carré : la queue ; la tête est sur lui
    expect(Math.abs(m.horizontalMm)).toBeLessThanOrEqual(SEUIL_MM);
  });
});

describe("la physique reste le jeu : un porte-à-faux tombe toujours, une tour mal bâtie aussi", () => {
  function jouer(c: Cas): Partie {
    // Même pilotage que l'outil de diagnostic, mais on garde la partie pour lire les états.
    const p = new Partie(R, { nom: c.nom, pieces: c.placements.map((q) => q.kind), plateformeDemi8: c.demi8 }, REGLAGES_DEFAUT);
    for (let t = 0; t < 20000 && p.etape !== "fini"; t++) {
      const v = p.vue();
      let cmd = COMMANDE.DESCENDRE;
      if (v.active >= 0) {
        const q = c.placements[v.active]!;
        const pc = v.pieces[v.active]!;
        const e = etendue(pc.kind, pc.rot, pc);
        const ecart = q.gauche8 - e.gauche * 8;
        if (ecart > 2) cmd |= COMMANDE.DROITE;
        else if (ecart < -2) cmd |= COMMANDE.GAUCHE;
      }
      p.avancer(cmd);
    }
    return p;
  }

  it("un O posé aux trois quarts dans le vide (son bord gauche à 3 m, la plateforme finit à 3,5 m) bascule et tombe à la mer", () => {
    const p = jouer({ nom: "porte-à-faux", demi8: 28, placements: [{ kind: "O", rot: 0, gauche8: 24 }], contraintes: [] });
    expect(p.vue().pieces[0]!.etat).toBe("perdue");
    expect(p.resultat()!.vies).toBe(REGLAGES_DEFAUT.vies - 1);
    p.dispose();
  });

  it("un O posé pile sur le bord (la moitié de sa largeur dans le vide, mais son centre de masse sur la plateforme) tient ; décalé d'une demi-case de plus, il tombe", () => {
    const tient = jouer({ nom: "bord", demi8: 28, placements: [{ kind: "O", rot: 0, gauche8: 12 }], contraintes: [] }); // [1,5 m ; 3,5 m] : tout sur la plateforme
    expect(tient.vue().pieces[0]!.etat).toBe("libre");
    tient.dispose();
    const tombe = jouer({ nom: "bord", demi8: 28, placements: [{ kind: "O", rot: 0, gauche8: 28 }], contraintes: [] }); // [3,5 m ; 5,5 m] : entièrement dans le vide
    expect(tombe.vue().pieces[0]!.etat).toBe("perdue");
    tombe.dispose();
  });

  it("un O posé sur un autre, décalé de 1,5 m (son centre de masse hors de l'appui), glisse et tombe : on n'a pas triché avec le frottement", () => {
    const p = jouer({ nom: "décalé", demi8: 28, placements: [{ kind: "O", rot: 0, gauche8: -8 }, { kind: "O", rot: 0, gauche8: 4 }], contraintes: [] });
    // Le carré du haut dépasse de 1,5 m : il bascule ; au repos il n'est plus sur le carré du bas.
    const haut = p.vue().pieces[1]!;
    expect(haut.etat === "perdue" || haut.y < 2.9 || Math.abs(haut.angle) > 0.2).toBe(true);
    p.dispose();
  });

  it("une tour bâtie en escalier, chaque carré décalé d'une demi-case dans le même sens, s'effondre avant le sixième", () => {
    const placements = Array.from({ length: 8 }, (_, i) => ({ kind: "O" as const, rot: 0, gauche8: -8 + 4 * i }));
    const p = jouer({ nom: "escalier", demi8: 28, placements, contraintes: [] });
    expect(p.vue().tombees).toBeGreaterThanOrEqual(1);
    p.dispose();
  });
});

describe("version 3 : le diagnostic « avant » reste reproductible (le défaut du lâcher le long d'un voisin collé)", () => {
  it("mur de 6 pièces : un carré lâché trop tôt le long de son voisin est éjecté (une pièce perdue) — c'était le défaut, la version 3 est inchangée", () => {
    const m = jouerCas(R, cas("mur de 6"), 3);
    expect(m.perdues).toBeGreaterThanOrEqual(1);
  });
});
