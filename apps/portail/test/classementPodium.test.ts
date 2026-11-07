import { describe, expect, it } from "vitest";
import type { LigneClassement } from "../src/classementDonnees";
import { EMBLEME_LIGNE, MARCHES, PHOTOS, groupeDeLigne, jeuxDuCumul, lignesDuPodium, nombreDeColonnes, photoDePlace, resteDuHaut } from "../src/classementPodium";

// Lot U2 : le podium de `/classement/` — qui monte dessus, ce qui reste pour la liste, les tailles de photo (charte rév. 19, § 9).
const ligne = (rang: number, o: Partial<LigneClassement> = {}): LigneClassement => ({ rang, pseudo: `J${rang}`, tempsMs: 70_000 + rang * 1000, complet: true, resultats: {}, ...o });
const haut = (n: number) => Array.from({ length: n }, (_, i) => ligne(i + 1));

describe("lot U2 : le podium", () => {
  it("il y a un podium à partir de 3 classés, jamais avant", () => {
    expect(lignesDuPodium({ vue: "cumul", top: haut(2) })).toBeNull();
    expect(lignesDuPodium({ vue: "cumul", top: [] })).toBeNull();
    expect(lignesDuPodium({ vue: "cumul", top: haut(3) })?.map((l) => l.rang)).toEqual([1, 2, 3]);
    expect(lignesDuPodium({ vue: "track", top: haut(50) })).toHaveLength(MARCHES);
  });
  it("au cumul, un joueur qui n'a pas tout fini (sous « Un jeu sur deux ») ne monte pas sur le podium : pas de podium", () => {
    const top = [ligne(1), ligne(2), ligne(3, { complet: false, tempsMs: null })];
    expect(lignesDuPodium({ vue: "cumul", top })).toBeNull();
    // Dans la vue d'un jeu, tout classé a un temps : le podium est là.
    expect(lignesDuPodium({ vue: "jump", top: [ligne(1), ligne(2), ligne(3)] })).not.toBeNull();
    // Un jeu à la hauteur : le score tient lieu de temps.
    const score = { unite: "mm" as const, valeur: 1200, vies: 2 };
    expect(lignesDuPodium({ vue: "tower", top: [1, 2, 3].map((r) => ligne(r, { tempsMs: null, score })) })).toHaveLength(3);
  });
  it("la liste garde le reste du haut, rien n'est renuméroté ; sans podium, tout", () => {
    const c = { vue: "cumul", top: haut(5), classes: 5 };
    const reste = resteDuHaut(c);
    expect(reste.top.map((l) => l.rang)).toEqual([4, 5]);
    expect(reste.classes).toBe(5);
    expect(resteDuHaut({ vue: "cumul", top: haut(2) }).top).toHaveLength(2);
    expect(c.top).toHaveLength(5); // l'entrée n'est pas modifiée
  });
  it("les photos : 112 px pour le premier, 92 px pour les deux suivants ; 48 px dans la liste, 88 px dans la feuille d'un joueur", () => {
    expect([1, 2, 3].map(photoDePlace)).toEqual([112, 92, 92]);
    expect(PHOTOS).toEqual({ premier: 112, suivants: 92, ligne: 48, feuille: 88 });
    expect(EMBLEME_LIGNE).toBe(22);
  });
  it("l'emblème d'un groupe n'est dessiné que si le serveur dit le groupe de la ligne", () => {
    expect(groupeDeLigne(ligne(1))).toBeNull();
    expect(groupeDeLigne(ligne(1, { groupe: { id: "g1", nom: "Les Lève-tôt" } }))?.nom).toBe("Les Lève-tôt");
    expect(groupeDeLigne({ groupe: { id: 3, nom: "x" } as never })).toBeNull();
    expect(groupeDeLigne(ligne(1, { groupe: null }))).toBeNull(); // lot U4 : `null` sans groupe
  });
  it("les colonnes du cumul : les jeux au temps du jour, ni un jeu à la hauteur ou aux points, ni un jeu d'arcade ; 6 colonnes au plus", () => {
    const jeux = [{ jeu: "cdj" }, { jeu: "jump" }, { jeu: "tower", unite: "mm", categorie: "arcade" }, { jeu: "blocks", unite: "points", categorie: "arcade" }, { jeu: "rush", categorie: "arcade" }];
    expect(jeuxDuCumul(jeux).map((j) => j.jeu)).toEqual(["cdj", "jump"]);
    expect([-1, 0, 3, 9].map(nombreDeColonnes)).toEqual([0, 0, 3, 6]);
  });
});
