import { describe, expect, it } from "vitest";
import { actionDe, BONUS_PLATEAU_VIDE, caseOccupee, contenuDeScenario, effacer, grilleDepuis, grilleEnTexte, jouer, NB_PIECES, Partie, peutPoser, PIECES, PLAFOND_PIECES, pieceParNom, pleines, tientQuelquePart, VIDE, ErreurRejeu } from "../src/index";
import { contenuDEssai, pieceDeForme } from "./aide";

describe("le catalogue (seed § 4)", () => {
  it("40 pièces, une par orientation, ids dans l'ordre, aucune forme en double", () => {
    expect(NB_PIECES).toBe(40);
    expect(PIECES.map((p) => p.id)).toEqual(PIECES.map((_, i) => i));
    const formes = new Set(PIECES.map((p) => `${p.largeur}x${p.hauteur}:${p.rangees.join(",")}`));
    expect(formes.size).toBe(40);
    const parFamille = (f: string): number => PIECES.filter((p) => p.famille === f).length;
    expect([parFamille("petite"), parFamille("barre"), parFamille("carre"), parFamille("coin"), parFamille("l"), parFamille("grandL"), parFamille("tsz"), parFamille("rectangle")]).toEqual([2, 6, 2, 4, 8, 4, 12, 2]);
  });
  it("plus de pièce de 1 case : la famille « petites » n'a que les deux dominos", () => {
    expect(PIECES.some((p) => p.cases === 1)).toBe(false);
    expect(PIECES.filter((p) => p.famille === "petite").map((p) => p.nom)).toEqual(["domino-0", "domino-1"]);
    expect(() => pieceParNom("mono-0")).toThrow();
  });
  it("le grand T : 5 cases, boîte 3 × 3, 4 orientations, famille T, poids 2, « très grosse » et boîte 3 × 3 (leurs garde-fous)", () => {
    const grandsT = PIECES.filter((p) => p.nom.startsWith("grandt"));
    expect(grandsT).toHaveLength(4);
    for (const p of grandsT) expect(p).toMatchObject({ famille: "tsz", cases: 5, largeur: 3, hauteur: 3, poids: 2, grosseur: 2, boite33: true, tresGrosse: true });
    // Une barre de 3 et une branche de 2 au milieu, dans les quatre sens.
    const formes = grandsT.map((p) => [...p.rangees].map((o) => Array.from({ length: 3 }, (_, c) => ((o >> c) & 1 ? "X" : ".")).join("")).join("/"));
    expect(new Set(formes)).toEqual(new Set(["XXX/.X./.X.", "..X/XXX/..X", ".X./.X./XXX", "X../XXX/X.."]));
    expect(pieceParNom("grandl-0").poids).toBe(2);
  });
  it("nombre de cases, boîte et « très grosse » (6 cases ou plus, ou boîte de 3 × 3)", () => {
    expect(PIECES.every((p) => p.cases === p.rangees.reduce((n, o) => n + [...o.toString(2)].filter((b) => b === "1").length, 0))).toBe(true);
    expect(pieceParNom("domino-0").cases).toBe(2);
    expect(pieceParNom("rect-0")).toMatchObject({ largeur: 3, hauteur: 2, cases: 6, tresGrosse: true, boite33: false });
    expect(pieceParNom("grandl-0")).toMatchObject({ cases: 5, boite33: true, tresGrosse: true });
    expect(pieceParNom("barre5-0")).toMatchObject({ cases: 5, tresGrosse: false });
    expect(pieceParNom("carre3-0")).toMatchObject({ cases: 9, boite33: true });
    expect(PIECES.filter((p) => p.tresGrosse).map((p) => p.famille)).toEqual(["carre", "grandL", "grandL", "grandL", "grandL", "tsz", "tsz", "tsz", "tsz", "rectangle", "rectangle"]);
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
    // La ligne 0 et la colonne 0 sont pleines sauf le coin (0, 0), (1, 0) et (0, 1) : le coin de trois cases, posé en (0, 0), les achève.
    const coin = pieceDeForme(["XX", "X."]).nom;
    const depart = ["..XXXXXX", ".......".padEnd(8, "."), ...Array(6).fill("X.......")];
    const p = new Partie(contenuDEssai([coin], depart));
    const r = p.poser(0, 0)!;
    expect(r).toMatchObject({ n: 2, lignes: 1, colonnes: 1, effacement: 40, gain: 3 + 40 + BONUS_PLATEAU_VIDE, combo: 1, plateauVide: true });
    expect(p.score).toBe(3 + 40 + BONUS_PLATEAU_VIDE);
  });
  it("effacements multiples : 2 lignes et 1 colonne d'un coup (scénario « presque-plein »)", () => {
    const p = new Partie(contenuDeScenario("presque-plein"));
    const r = p.poser(5, 6)!;
    expect(r).toMatchObject({ n: 3, lignes: 0b11000000, colonnes: 0b10000000, cases: 6, effacement: 90, gain: 96, combo: 1, plateauVide: false });
    expect(grilleEnTexte(p.grille)).toEqual(["X.......", "X.......", "........", "........", "........", "........", "........", "........"]);
  });
  it("le combo multiplie l'effacement : 10 × n × n × combo (deux effacements de suite : 10 puis 20)", () => {
    const p = new Partie(contenuDEssai(["domino-0", "domino-0"], ["XXXXXX..", "XXXXXX..", "........", "........", "........", "X.......", "........", "........"]));
    expect(p.poser(6, 0)).toMatchObject({ n: 1, effacement: 10, combo: 1, gain: 12 });
    expect(p.poser(6, 1)).toMatchObject({ n: 1, effacement: 20, combo: 2, gain: 22 });
    expect(p.score).toBe(34);
  });
  it("le combo survit à 2 poses sans effacement et se perd à la 3ᵉ", () => {
    const depart = [".XXXXXXX", ...Array(7).fill("........")];
    const p = new Partie(contenuDEssai(["domino-1", "domino-0", "domino-0", "domino-0"], depart));
    expect(p.poser(0, 0)).toMatchObject({ n: 1, combo: 1, effacement: 10 });
    expect(p.poser(0, 3)).toMatchObject({ n: 0, combo: 1, comboPerdu: false });
    expect(p.poser(2, 3)).toMatchObject({ n: 0, combo: 1, comboPerdu: false }); // 2 poses sans effacement : il survit
    expect(p.poser(4, 3)).toMatchObject({ n: 0, combo: 0, comboPerdu: true }); // la 3ᵉ : perdu
    expect(p.comboMax).toBe(1);
  });
  it("un effacement à la 3ᵉ pose sans effacement garde le combo : il passe à 2, et le maximal avec lui", () => {
    const depart = ["XXXXXX..", "XXXXXXX.", ...Array(6).fill("........")];
    const q = new Partie(contenuDEssai(["domino-0", "domino-0", "domino-0", "domino-1"], depart));
    expect(q.poser(6, 0)).toMatchObject({ n: 1, combo: 1, effacement: 10 });
    expect(q.poser(0, 4)).toMatchObject({ n: 0 });
    expect(q.poser(2, 4)).toMatchObject({ n: 0, combo: 1 }); // deux poses sans effacement : le combo (1) est encore là
    expect(q.poser(7, 1)).toMatchObject({ n: 1, combo: 2, effacement: 20 }); // la ligne 1 s'achève : combo 2, 10 × 1 × 1 × 2
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
    const p = new Partie(contenuDEssai(["domino-0"]));
    expect(p.poser(0, 0)!.plateauVide).toBe(false);
  });
});

describe("actions illégales et fin de partie", () => {
  it("une action illégale est rejetée SANS changer l'état", () => {
    const p = new Partie(contenuDEssai(["domino-0", "domino-0"]));
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
    // Un damier où seuls (0, 0) et (1, 0) se touchent : le domino y tient, et le suivant ne tient plus nulle part.
    const depart = ["..X.X.X.", ".X.X.X.X", "X.X.X.X.", ".X.X.X.X", "X.X.X.X.", ".X.X.X.X", "X.X.X.X.", ".X.X.X.X"];
    const p = new Partie(contenuDEssai(["domino-0", "domino-0"], depart));
    expect(p.finie).toBe(false);
    expect(p.poser(0, 0)).toMatchObject({ n: 0 });
    expect(p.resultat()).toMatchObject({ raison: "bloquee", poses: 1 });
    expect(p.piece).toBeNull();
  });
  it("la pose d'une pièce qui tient encore ailleurs ne finit pas la partie", () => {
    const depart = ["XXXXXXXX", "XXXXXXXX", "XXXXXXXX", "XXXXXXXX", "XXXXXXXX", "XXXXXXXX", "XXXXXXXX", "XXXXXX.."];
    const p = new Partie(contenuDEssai(["domino-0", "domino-0"], depart));
    expect(p.finie).toBe(false);
    p.poser(6, 7); // les lignes et colonnes pleines partent : la grille se vide
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
