import { beforeAll, describe, expect, it } from "vitest";
import { COMMANDE, Partie, type PieceKind, type Rapier, scenarioPaliers, TOUR_DEPART } from "@cdj/tower-sim";
import { chargerRapier } from "@cdj/tower-sim/rapier";
import { CHOC_MIN, evenementsDeFin, GENRES_EVENEMENTS, type EvenementJeu, Observateur } from "../src/evenements";
import { piece, vue } from "./_vues";

// Lot T5 — les événements de la partie, lus dans la vue (comme `eventsBetween` de Jump) : de quoi donner un son, une secousse, un clignement des vies.
let R: Rapier;
beforeAll(async () => {
  R = await chargerRapier();
});
const genres = (e: readonly EvenementJeu[]): string[] => e.map((x) => x.genre);

describe("les événements, sur des vues écrites à la main", () => {
  it("un déplacement d'une demi-case et un quart de tour de la pièce active, jamais la poussée du vent (un huitième)", () => {
    const o = new Observateur();
    o.observer(vue(1, [piece(0, { etat: "active", x: 0, y: 8, endormie: false })]));
    expect(genres(o.observer(vue(2, [piece(0, { etat: "active", x: 0.5, y: 7.96, endormie: false })])))).toEqual(["deplacement"]);
    expect(genres(o.observer(vue(3, [piece(0, { etat: "active", x: 0.625, y: 7.92, endormie: false })])))).toEqual([]); // le vent
    expect(genres(o.observer(vue(4, [piece(0, { etat: "active", x: 0.625, y: 7.88, rot: 3, endormie: false })])))).toEqual(["rotation"]);
  });

  it("le lâcher est un contact (sa taille et sa vitesse) ; un choc fait un contact, un ralentissement doux n'en fait pas", () => {
    const o = new Observateur();
    o.observer(vue(1, [piece(0, { etat: "active", y: 3, taille: "geante", endormie: false })]));
    const lache = o.observer(vue(2, [piece(0, { etat: "libre", y: 2.96, taille: "geante", endormie: false })]));
    expect(lache).toHaveLength(1);
    expect(lache[0]).toMatchObject({ genre: "contact", taille: "geante" });
    expect((lache[0] as { vitesse: number }).vitesse).toBeGreaterThan(1);
    // Une pièce libre qui tombe à 4 m/s puis s'arrête net : un choc, d'intensité la vitesse perdue.
    const p = new Observateur();
    p.observer(vue(1, [piece(0, { y: 6, endormie: false })]));
    p.observer(vue(2, [piece(0, { y: 6 - 4 / 60, endormie: false })]));
    const choc = p.observer(vue(3, [piece(0, { y: 6 - 4 / 60, endormie: false })]));
    expect(choc[0]).toMatchObject({ genre: "contact" });
    expect((choc[0] as { vitesse: number }).vitesse).toBeGreaterThanOrEqual(CHOC_MIN);
    const doux = new Observateur();
    doux.observer(vue(1, [piece(0, { y: 6, endormie: false })]));
    doux.observer(vue(2, [piece(0, { y: 6 - 2 / 60, endormie: false })]));
    expect(genres(doux.observer(vue(3, [piece(0, { y: 6 - 3.5 / 60, endormie: false })])))).toEqual([]);
  });

  it("une pièce perdue : un événement `perte` (sa colonne, sa taille) ; deux d'affilée sont une cascade (secousse plus forte, grondement une fois)", () => {
    const o = new Observateur();
    o.observer(vue(1, [piece(0, { endormie: false }), piece(1, { x: 3, endormie: false }), piece(2, { x: -3, endormie: false })]));
    const un = o.observer(vue(2, [piece(0, { etat: "perdue", x: -1, y: -0.1, taille: "petite" }), piece(1, { x: 3, endormie: false }), piece(2, { x: -3, endormie: false })]));
    expect(un).toEqual([{ genre: "perte", x: -1, taille: "petite", cascade: 0 }]);
    const deux = o.observer(vue(30, [piece(0, { etat: "perdue" }), piece(1, { etat: "perdue", x: 3 }), piece(2, { x: -3, endormie: false })]));
    expect(genres(deux)).toEqual(["perte", "effondrement"]);
    expect(deux[0]).toMatchObject({ cascade: 1 });
    expect(deux[1]).toMatchObject({ force: 2 });
    // Un troisième aussitôt après : une perte, plus de grondement (il faut attendre).
    const trois = o.observer(vue(40, [piece(0, { etat: "perdue" }), piece(1, { etat: "perdue" }), piece(2, { etat: "perdue", x: -3 })]));
    expect(genres(trois)).toEqual(["perte"]);
    // Une perte longtemps après la cascade n'en est pas une.
    const seule = new Observateur();
    seule.observer(vue(1, [piece(0), piece(1)]));
    seule.observer(vue(2, [piece(0, { etat: "perdue" }), piece(1)]));
    expect(genres(seule.observer(vue(500, [piece(0, { etat: "perdue" }), piece(1, { etat: "perdue" })])))).toEqual(["perte"]);
  });

  it("la tour qui perd plus de 1,5 m en une seconde et demie s'effondre, même sans perdre de pièce", () => {
    const o = new Observateur();
    o.observer(vue(1, [piece(0)], { hauteurMm: 9000 }));
    expect(genres(o.observer(vue(2, [piece(0)], { hauteurMm: 8900 })))).toEqual([]);
    const e = o.observer(vue(30, [piece(0)], { hauteurMm: 6000 }));
    expect(e).toEqual([{ genre: "effondrement", force: 1 }]);
  });

  it("le palier franchi, puis l'effet quand la pièce qui le porte naît ; le vent sonne une fois pour ses trois pièces, ventDebut et ventFin encadrent", () => {
    const o = new Observateur();
    o.observer(vue(1, [piece(0, { etat: "libre", y: 1 }), piece(1, { etat: "active", y: 8, endormie: false })]));
    const palier = o.observer(vue(2, [piece(0, { etat: "libre", y: 1 }), piece(1, { etat: "active", y: 7.9, endormie: false })], { declenches: 1, dernierEffet: "vent" }));
    expect(palier).toEqual([{ genre: "palier", effet: "vent", bonus: false }]);
    // La pièce suivante naît avec l'effet (la précédente vient de se poser : un contact) : `effet` + `ventDebut`.
    const naissance = o.observer(vue(3, [piece(0), piece(1), piece(2, { etat: "active", y: 8, effet: "vent", endormie: false })], { declenches: 1, dernierEffet: "vent" }));
    expect(genres(naissance)).toEqual(["contact", "effet", "ventDebut"]);
    // Les deux pièces suivantes ont le même effet : pas de nouvel « effet », ni de nouveau début de vent.
    const suivante = o.observer(vue(4, [piece(0), piece(1), piece(2, { effet: "vent" }), piece(3, { etat: "active", y: 8, effet: "vent", endormie: false })], { declenches: 1, dernierEffet: "vent" }));
    expect(genres(suivante)).toEqual(["contact"]); // la pièce 2 vient de se poser ; la pièce 3 a le même vent : ni « effet », ni nouveau « ventDebut »
    const fin = o.observer(vue(5, [piece(0), piece(1), piece(2, { effet: "vent" }), piece(3, { effet: "vent" }), piece(4, { etat: "active", y: 8, endormie: false })], { declenches: 1, dernierEffet: "vent" }));
    expect(genres(fin)).toEqual(["contact", "ventFin"]);
    // Un bonus se range du bon côté.
    const b = new Observateur();
    b.observer(vue(1, [piece(0)]));
    expect(b.observer(vue(2, [piece(0)], { declenches: 1, dernierEffet: "lierre" }))[0]).toEqual({ genre: "palier", effet: "lierre", bonus: true });
  });

  it("les cris de l'analyseur deviennent des événements `cri` ; la fin de partie donne la fin puis la médaille", () => {
    const o = new Observateur();
    o.observer(vue(1, [piece(0)]));
    expect(o.observer(vue(2, [piece(0)]), [0])).toEqual([{ genre: "cri", id: 0 }]);
    expect(evenementsDeFin("pieces", null)).toEqual([{ genre: "fin", motif: "pieces" }]);
    expect(evenementsDeFin("vies", "or")).toEqual([{ genre: "fin", motif: "vies" }, { genre: "medaille", nom: "or" }]);
  });

  it("`reinitialiser` repart de zéro (une nouvelle partie ne se souvient de rien)", () => {
    const o = new Observateur();
    o.observer(vue(1, [piece(0, { etat: "active", effet: "vent", endormie: false })]));
    o.reinitialiser();
    expect(genres(o.observer(vue(1, [piece(0, { etat: "active", effet: "vent", endormie: false })])))).toEqual(["effet", "ventDebut"]);
  });
});

describe("les événements, sur une vraie partie (Rapier)", () => {
  /** Joue `n` ticks et rend tous les événements, tick par tick. */
  function jouer(p: Partie, o: Observateur, n: number, cmd: (k: number, active: number) => number = () => COMMANDE.DESCENDRE): EvenementJeu[] {
    const out: EvenementJeu[] = [];
    o.observer(p.vue());
    let id = -1;
    let k = 0;
    for (let t = 0; t < n && p.etape !== "fini"; t++) {
      const a = p.vue().active;
      if (a !== id) {
        id = a;
        k = 0;
      }
      p.avancer(cmd(k++, a));
      out.push(...o.observer(p.vue()));
    }
    return out;
  }

  it("une pièce posée à la main donne déplacements, rotation et contact ; une pièce jetée à la mer donne une perte, puis la fin de partie", () => {
    const p = new Partie(R, { nom: "mer", pieces: [..."OOOO"] as PieceKind[], plateformeDemi8: 16 });
    const o = new Observateur();
    // Les deux premières pièces se posent (un déplacement, un quart de tour), les suivantes sont jetées par-dessus bord.
    const ev = jouer(p, o, 3000, (k, id) => (id < 2 ? (k === 1 ? COMMANDE.DROITE : k === 3 ? COMMANDE.TOURNER : COMMANDE.DESCENDRE) : COMMANDE.GAUCHE | COMMANDE.DESCENDRE));
    const g = genres(ev);
    expect(g).toContain("deplacement");
    expect(g).toContain("rotation");
    expect(g).toContain("contact");
    expect(g.filter((x) => x === "perte").length).toBeGreaterThanOrEqual(1);
    p.dispose();
  });

  it("un palier franchi dans une vraie partie donne `palier` puis `effet` (la pièce suivante)", () => {
    const sc = scenarioPaliers("lierre");
    const p = new Partie(R, { ...sc, pieces: [..."OOOOOOOO"] as PieceKind[] });
    const o = new Observateur();
    // Pose les pièces au milieu de la plateforme (aucun ordre) jusqu'à franchir le premier palier de 8 m.
    const ev = jouer(p, o, 6000);
    const g = genres(ev);
    const i = g.indexOf("palier");
    expect(i).toBeGreaterThanOrEqual(0);
    expect(g.indexOf("effet")).toBeGreaterThan(i - 1);
    expect(ev.find((e) => e.genre === "palier")).toMatchObject({ effet: "lierre", bonus: true });
    p.dispose();
    void TOUR_DEPART;
  });

  it("tous les genres d'événements sont connus et ont un nom unique", () => {
    expect(new Set(GENRES_EVENEMENTS).size).toBe(GENRES_EVENEMENTS.length);
    expect(GENRES_EVENEMENTS).toEqual(expect.arrayContaining(["deplacement", "rotation", "contact", "palier", "effet", "perte", "effondrement", "ventDebut", "ventFin", "cri", "plouf", "fin", "medaille"]));
  });
});
