import { describe, expect, it } from "vitest";
import { actionDe, BONUS_PLATEAU_VIDE, caseOccupee, contenuDeScenario, effacer, grilleDepuis, grilleEnTexte, jouer, NB_PIECES, Partie, peutPoser, PIECES, PLAFOND_PIECES, pieceParNom, pleines, tientQuelquePart, VIDE, ErreurRejeu } from "../src/index";
import { contenuDEssai } from "./aide";

describe("le catalogue (seed § 4)", () => {
  it("37 pièces, une par orientation, ids dans l'ordre, aucune forme en double", () => {
    expect(NB_PIECES).toBe(37);
    expect(PIECES.map((p) => p.id)).toEqual(PIECES.map((_, i) => i));
    const formes = new Set(PIECES.map((p) => `${p.largeur}x${p.hauteur}:${p.rangees.join(",")}`));
    expect(formes.size).toBe(37);
    const parFamille = (f: string): number => PIECES.filter((p) => p.famille === f).length;
    expect([parFamille("petite"), parFamille("barre"), parFamille("carre"), parFamille("coin"), parFamille("l"), parFamille("grandL"), parFamille("tsz"), parFamille("rectangle")]).toEqual([3, 6, 2, 4, 8, 4, 8, 2]);
  });
  it("nombre de cases, boîte et « très grosse » (6 cases ou plus, ou boîte de 3 × 3)", () => {
    expect(PIECES.every((p) => p.cases === p.rangees.reduce((n, o) => n + [...o.toString(2)].filter((b) => b === "1").length, 0))).toBe(true);
    expect(pieceParNom("mono-0").cases).toBe(1);
    expect(pieceParNom("rect-0")).toMatchObject({ largeur: 3, hauteur: 2, cases: 6, tresGrosse: true, boite33: false });
    expect(pieceParNom("grandl-0")).toMatchObject({ cases: 5, boite33: true, tresGrosse: true });
    expect(pieceParNom("barre5-0")).toMatchObject({ cases: 5, tresGrosse: false });
    expect(pieceParNom("carre3-0")).toMatchObject({ cases: 9, boite33: true });
    expect(PIECES.filter((p) => p.tresGrosse).map((p) => p.famille)).toEqual(["carre", "grandL", "grandL", "grandL", "grandL", "rectangle", "rectangle"]);
  });
});

describe("la grille en bits", () => {
  it("pose, rejette ce qui déborde ou recouvre, ne change rien en cas de rejet", () => {
    const l = pieceParNom("l-0");
    const g = grilleDepuis(["XX......", ...Array(7).fill("........")]);
    expect(peutPoser(g, l, 0, 0)).toBe(false); // recouvre
    expect(peutPoser(g, l, 7, 0)).toBe(false); // déborde à droite
    expect(peutPoser(g, l, 0, 6)).toBe(false); // déborde en bas
    expect(peutPoser(g, l, 0, 5)).toBe(true);
    expect(caseOccupee(g, 1, 0)).toBe(true);
    expect(grilleEnTexte(g)[0]).toBe("XX......");
  });
  it("les deux mots de 32 bits : la ligne 3 et la ligne 4, la colonne 7, la ligne 7", () => {
    const g = grilleDepuis(["........", "........", "........", "XXXXXXXX", "XXXXXXXX", "........", "........", ".......X"]);
    expect(pleines(g)).toEqual({ lignes: 0b00011000, colonnes: 0 });
    expect(grilleEnTexte(effacer(g, 0b00011000, 0))).toEqual(["........", "........", "........", "........", "........", "........", "........", ".......X"]);
    expect(tientQuelquePart(g, pieceParNom("carre3-0"))).toBe(true);
  });
});

describe("l'effacement et le barème (seed § 3 et 5)", () => {
  it("+1 point par case posée, sans effacement : le combo ne bouge pas", () => {
    const p = new Partie(contenuDEssai(["coin-0"]));
    const r = p.poser(2, 2)!;
    expect(r).toMatchObject({ cases: 3, n: 0, effacement: 0, gain: 3, combo: 0 });
    expect(p.score).toBe(3);
  });
  it("ligne ET colonne effacées ensemble : la case au croisement compte pour les deux (n = 2, pas 3)", () => {
    // La ligne 0 et la colonne 0 sont pleines sauf leur croisement (0, 0) : le monomino les achève.
    const depart = [".XXXXXXX", ...Array(7).fill("X......."), ];
    const p = new Partie(contenuDEssai(["mono-0"], depart));
    const r = p.poser(0, 0)!;
    expect(r).toMatchObject({ n: 2, lignes: 1, colonnes: 1, effacement: 40, gain: 341, combo: 1, plateauVide: true });
    expect(p.score).toBe(1 + 40 + BONUS_PLATEAU_VIDE);
  });
  it("effacements multiples : 2 lignes et 1 colonne d'un coup (scénario « presque-plein »)", () => {
    const p = new Partie(contenuDeScenario("presque-plein"));
    const r = p.poser(5, 6)!;
    expect(r).toMatchObject({ n: 3, lignes: 0b11000000, colonnes: 0b10000000, cases: 6, effacement: 90, gain: 96, combo: 1, plateauVide: false });
    expect(grilleEnTexte(p.grille)).toEqual(["X.......", "X.......", "........", "........", "........", "........", "........", "........"]);
  });
  it("le combo multiplie l'effacement : 10 × n × n × combo (deux effacements de suite : 10 puis 20)", () => {
    const p = new Partie(contenuDEssai(["mono-0", "mono-0"], ["XXXXXXX.", "XXXXXXX.", "........", "........", "........", "X.......", "........", "........"]));
    expect(p.poser(7, 0)).toMatchObject({ n: 1, effacement: 10, combo: 1, gain: 11 });
    expect(p.poser(7, 1)).toMatchObject({ n: 1, effacement: 20, combo: 2, gain: 21 });
    expect(p.score).toBe(32);
  });
  it("le combo survit à 2 poses sans effacement et se perd à la 3ᵉ", () => {
    const depart = [".XXXXXXX", ...Array(7).fill("........")];
    const p = new Partie(contenuDEssai(["mono-0", "mono-0", "mono-0", "mono-0", "mono-0"], depart));
    expect(p.poser(0, 0)).toMatchObject({ n: 1, combo: 1, effacement: 10 });
    expect(p.poser(0, 2)).toMatchObject({ n: 0, combo: 1, comboPerdu: false });
    expect(p.poser(1, 2)).toMatchObject({ n: 0, combo: 1, comboPerdu: false }); // 2 poses sans effacement : il survit
    expect(p.poser(2, 2)).toMatchObject({ n: 0, combo: 0, comboPerdu: true }); // la 3ᵉ : perdu
    expect(p.comboMax).toBe(1);
  });
  it("un effacement à la 3ᵉ pose sans effacement garde le combo : il passe à 2, et le maximal avec lui", () => {
    const depart = [".XXXXXXX", "X.......", ...Array(6).fill("........")];
    const p = new Partie(contenuDEssai(["mono-0", "mono-0", "mono-0", "mono-0"], depart));
    expect(p.poser(0, 0)).toMatchObject({ n: 1, combo: 1 }); // efface la ligne 0 ; reste (0,1)
    expect(p.poser(3, 4)).toMatchObject({ n: 0 });
    expect(p.poser(4, 4)).toMatchObject({ n: 0 });
    // Deux poses sans effacement : le combo (1) est encore là. On complète la ligne 1 : il passe à 2, effacement 10 × 1 × 1 × 2.
    const q = new Partie(contenuDEssai(["mono-0", "mono-0", "mono-0", "mono-0"], [".XXXXXXX", "XXXXXXX.", ...Array(6).fill("........")]));
    expect(q.poser(0, 0)).toMatchObject({ combo: 1, effacement: 10 });
    expect(q.poser(0, 4)).toMatchObject({ n: 0 });
    expect(q.poser(1, 4)).toMatchObject({ n: 0, combo: 1 });
    expect(q.poser(7, 1)).toMatchObject({ n: 1, combo: 2, effacement: 20 });
    expect(q.comboMax).toBe(2);
  });
  it("plateau vide : +300 fixe, sans multiplicateur (scénario « plateau-vide »)", () => {
    const p = new Partie(contenuDeScenario("plateau-vide"));
    const r = p.poser(7, 6)!;
    expect(r).toMatchObject({ n: 2, effacement: 40, plateauVide: true, gain: 2 + 40 + 300 });
    expect(grilleEnTexte(p.grille).every((l) => l === "........")).toBe(true);
    expect(p.finie).toBe(false);
  });
  it("pas de +300 quand la grille est vide sans effacement (début de partie)", () => {
    const p = new Partie(contenuDEssai(["mono-0"]));
    expect(p.poser(0, 0)!.plateauVide).toBe(false);
  });
});

describe("actions illégales et fin de partie", () => {
  it("une action illégale est rejetée SANS changer l'état", () => {
    const p = new Partie(contenuDEssai(["domino-0", "mono-0"]));
    p.poser(0, 0);
    const avant = JSON.stringify([p.grille, p.rang, p.score, p.combo, p.sansEffacement, p.comboMax, p.fin]);
    expect(p.poser(0, 0)).toBeNull(); // recouvre le domino
    expect(p.poser(8, 0)).toBeNull();
    expect(p.poser(-1, 0)).toBeNull();
    expect(p.poser(0, 8)).toBeNull();
    expect(p.poser(1.5, 0)).toBeNull();
    expect(JSON.stringify([p.grille, p.rang, p.score, p.combo, p.sansEffacement, p.comboMax, p.fin])).toBe(avant);
  });
  it("la partie finit dès que la pièce du moment ne tient nulle part (scénario « blocage » : tout de suite)", () => {
    const p = new Partie(contenuDeScenario("blocage"));
    expect(p.finie).toBe(true);
    expect(p.resultat()).toEqual({ score: 0, combo: 0, poses: 0, raison: "bloquee" });
    expect(p.poser(0, 1)).toBeNull();
  });
  it("la fin se détecte après la pose qui bouche la dernière place pour la pièce suivante", () => {
    const depart = ["XXXXXXXX", "XXXXXXXX", "XXXXXXXX", "XXXXXXXX", "XXXXXXXX", "XXXXXXXX", "XXXXXXXX", "XXXXXX.."];
    const p = new Partie(contenuDEssai(["mono-0", "mono-0"], depart));
    expect(p.finie).toBe(false);
    p.poser(6, 7);
    expect(p.finie).toBe(false);
    expect(p.piece).not.toBeNull();
  });
  it("le plafond arrête la partie à la 2 000ᵉ pièce", () => {
    const p = new Partie(contenuDEssai([]));
    p.rang = PLAFOND_PIECES - 1;
    expect(p.poser(0, 0)).not.toBeNull();
    expect(p.resultat()).toMatchObject({ raison: "plafond", poses: PLAFOND_PIECES });
    expect(p.piece).toBeNull();
    expect(p.suivante).toBeNull();
  });
  it("la pièce suivante est celle d'après (information seulement)", () => {
    const p = new Partie(contenuDEssai(["domino-0", "barre3-1"]));
    expect([p.piece!.nom, p.suivante!.nom]).toEqual(["domino-0", "barre3-1"]);
    p.poser(0, 0);
    expect(p.piece!.nom).toBe("barre3-1");
  });
});

describe("le rejeu", () => {
  it("jouer rend le même résultat que la partie, et refuse une partie non terminée", () => {
    const c = contenuDeScenario("blocage");
    expect(jouer(c, [])).toEqual({ score: 0, combo: 0, poses: 0, raison: "bloquee" });
    const nonTerminee = contenuDEssai(["domino-0"]);
    expect(() => jouer(nonTerminee, [actionDe(0, 0)])).toThrow(ErreurRejeu);
    expect(VIDE.lo).toBe(0);
  });
});
