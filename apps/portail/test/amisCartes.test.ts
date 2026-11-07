import { describe, expect, it } from "vitest";
import type { LigneClassement } from "../src/classementDonnees";
import { bilanDuJour, cartesDesAmis, ecoule, initialeDe, membresDuGroupe, ontJoue } from "../src/amisCartes";

// Lot U3 : la page « Amis et groupes » — la journée de chaque ami et de chaque membre, tirée du classement du jour ; rien n'est inventé quand le classement n'a pas répondu.
const JEUX = [
  { jeu: "cdj", site: "track", nom: "Track" },
  { jeu: "jump", site: "jump", nom: "Jump" },
  { jeu: "tower", site: "tower", nom: "Tower", unite: "mm" as const, categorie: "arcade" as const },
];
const nom = (j: { nom: string }) => j.nom;
const fait = { rang: 1, tempsMs: 40_000, medaille: null };
const ligne = (rang: number, ref: string, o: Partial<LigneClassement> = {}): LigneClassement => ({ rang, pseudo: `P-${ref}`, ref, tempsMs: 70_000 + rang, complet: true, resultats: { cdj: fait, jump: fait }, ...o });
const ami = (ref: string, o: { reciproque?: boolean } = {}) => ({ ref, pseudo: `P-${ref}`, reciproque: o.reciproque ?? true, origine: "ajout" as const });

describe("lot U3 : le bilan d'une journée", () => {
  it("les pastilles sont les jeux du cumul (ni la hauteur ni l'arcade), faits ou pas", () => {
    const b = bilanDuJour(JEUX, ligne(2, "a", { complet: false, resultats: { cdj: fait, jump: null } }), nom);
    expect(b.etat).toBe("joue");
    expect(b.pastilles?.map((p) => [p.initiale, p.fait])).toEqual([["T", true], ["J", false]]);
    expect([b.faits, b.total]).toEqual([1, 2]);
  });
  it("tous les jeux du cumul finis : journée parfaite ; aucun, ou pas de ligne : rien", () => {
    expect(bilanDuJour(JEUX, ligne(1, "a"), nom).etat).toBe("parfaite");
    expect(bilanDuJour(JEUX, undefined, nom)).toMatchObject({ etat: "rien", faits: 0, total: 2 });
  });
  it("sans classement : inconnu, sans pastille", () => {
    expect(bilanDuJour(null, undefined, nom)).toEqual({ etat: "inconnu", faits: 0, total: 0, pastilles: null });
  });
  it("la lettre d'un jeu est la première de son nom", () => {
    expect(initialeDe("jump")).toBe("J");
    expect(initialeDe("")).toBe("");
  });
});

describe("lot U3 : les cartes de tes amis", () => {
  const top = [ligne(1, "toi", { moi: true }), ligne(2, "b"), ligne(3, "c", { complet: false, tempsMs: null, resultats: { cdj: fait, jump: null } })];
  const classement = { top, jeux: JEUX, absents: [{ ref: "d", pseudo: "P-d" }] };
  const amis = [ami("d"), ami("c", { reciproque: false }), ami("e"), ami("b")];

  it("l'ordre du classement entre amis, puis ceux qui n'ont rien fini, puis ceux qu'il ne nomme pas ; toi, jamais", () => {
    const cartes = cartesDesAmis({ amis, classement, duJour: null, nom });
    expect(cartes.map((c) => c.ref)).toEqual(["b", "c", "d", "e"]);
  });
  it("le rang et le temps seulement pour qui a tout fini ; son état dit sa journée", () => {
    const cartes = Object.fromEntries(cartesDesAmis({ amis, classement, duJour: null, nom }).map((c) => [c.ref, c]));
    expect(cartes.b).toMatchObject({ rang: 2, tempsMs: 70_002, bilan: { etat: "parfaite" } });
    expect(cartes.c).toMatchObject({ rang: null, tempsMs: null, bilan: { etat: "joue", faits: 1, total: 2 } });
    expect(cartes.d!.bilan.etat).toBe("rien");
    expect(cartes.e!.bilan.etat).toBe("rien");
    expect(cartes.c!.reciproque).toBe(false);
  });
  it("le dernier jeu joué vient de la réponse du portail, pour les amis qu'elle détaille seulement", () => {
    const cartes = Object.fromEntries(
      cartesDesAmis({ amis, classement, duJour: [{ pseudo: "P-c", ref: "c", faits: ["track"], parfaite: false, dernier: { site: "track", at: 5 } }], nom }).map((c) => [c.ref, c]),
    );
    expect(cartes.c!.dernier).toEqual({ site: "track", at: 5 });
    expect(cartes.b!.dernier).toBeNull();
  });
  it("lot U4 : le dernier jeu joué vient d'abord de la ligne du classement, pour tous les amis ; la réponse du portail ne sert que de repli", () => {
    const avecDernier = { ...classement, top: [ligne(1, "toi", { moi: true }), ligne(2, "b", { dernier: { site: "jump", at: 9 } }), top[2]!] };
    const cartes = Object.fromEntries(
      cartesDesAmis({ amis, classement: avecDernier, duJour: [{ pseudo: "P-b", ref: "b", faits: ["track"], parfaite: false, dernier: { site: "track", at: 5 } }, { pseudo: "P-c", ref: "c", faits: ["track"], parfaite: false, dernier: { site: "track", at: 6 } }], nom }).map((c) => [c.ref, c]),
    );
    expect(cartes.b!.dernier).toEqual({ site: "jump", at: 9 }); // la ligne l'emporte
    expect(cartes.c!.dernier).toEqual({ site: "track", at: 6 }); // pas dans la ligne : le repli
    expect(cartes.e!.dernier).toBeNull();
  });
  it("sans classement : les amis dans l'ordre de la liste, journée inconnue, et pas de compte de joueurs du jour", () => {
    const cartes = cartesDesAmis({ amis, classement: null, duJour: null, nom });
    expect(cartes.map((c) => c.ref)).toEqual(["d", "c", "e", "b"]);
    expect(cartes.every((c) => c.bilan.etat === "inconnu")).toBe(true);
    expect(ontJoue(cartes)).toBeNull();
  });
  it("le compte des amis qui ont joué", () => {
    expect(ontJoue(cartesDesAmis({ amis, classement, duJour: null, nom }))).toBe(2);
  });
});

describe("lot U3 : les membres de ton groupe", () => {
  const membres = [
    { ref: "chef", pseudo: "Cheffe", chef: true },
    { ref: "toi", pseudo: "Déclic", chef: false },
    { ref: "z", pseudo: "Zed", chef: false },
  ];
  const classement = { top: [ligne(1, "chef"), ligne(2, "toi", { moi: true, complet: false, resultats: { cdj: fait, jump: null } })], jeux: JEUX };
  it("chacun avec sa journée, dans l'ordre du serveur ; toi reconnu par ta référence", () => {
    const m = membresDuGroupe({ membres, classement, moi: { ref: "toi" }, nom });
    expect(m.map((x) => [x.pseudo, x.bilan.etat, x.moi])).toEqual([["Cheffe", "parfaite", false], ["Déclic", "joue", true], ["Zed", "rien", false]]);
  });
  it("sans ta référence, ton pseudo (unique) te désigne", () => {
    expect(membresDuGroupe({ membres, classement, moi: { pseudo: "déclic" }, nom }).find((x) => x.moi)?.ref).toBe("toi");
    expect(membresDuGroupe({ membres, classement, moi: {} , nom }).some((x) => x.moi)).toBe(false);
  });
  it("sans classement : journée inconnue", () => {
    expect(membresDuGroupe({ membres, classement: null, moi: {}, nom }).every((x) => x.bilan.etat === "inconnu")).toBe(true);
  });
});

describe("lot U3 : il y a combien de temps", () => {
  it("à l'instant, en minutes, en heures, jamais négatif", () => {
    expect(ecoule(1000, 30_000)).toEqual({ genre: "alInstant", n: 0 });
    expect(ecoule(0, 12 * 60_000 + 5)).toEqual({ genre: "minutes", n: 12 });
    expect(ecoule(0, 3 * 3_600_000 + 1)).toEqual({ genre: "heures", n: 3 });
    expect(ecoule(10_000, 0)).toEqual({ genre: "alInstant", n: 0 });
  });
});
