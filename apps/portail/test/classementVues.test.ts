import { describe, expect, it } from "vitest";
import { VUE_CUMUL, aSeparation, adresseDeVue, ongletVoisin, onglets, positionSeparation, tuileDuClassement, vueDeLAdresse } from "../src/classementVues";
import type { Jour } from "../src/jour";

// Lot A1 : la logique pure du classement au chrono — onglets, vue gardée dans l'adresse, séparation « Un jeu sur deux », texte de la tuile de l'accueil.

const JEUX = [
  { jeu: "cdj", site: "track", nom: "Track" },
  { jeu: "jump", site: "jump", nom: "Jump" },
];

describe("la vue dans l'adresse (?vue=)", () => {
  it("le cumul par défaut ; un dossier de jeu bien formé est gardé ; le reste retombe sur le cumul", () => {
    expect(vueDeLAdresse("")).toBe(VUE_CUMUL);
    expect(vueDeLAdresse("?date=2026-10-27")).toBe(VUE_CUMUL);
    expect(vueDeLAdresse("?vue=track")).toBe("track");
    expect(vueDeLAdresse("?date=2026-10-27&vue=jump")).toBe("jump");
    for (const mauvaise of ["?vue=", "?vue=../x", "?vue=Track", "?vue=<script>", "?vue=" + "a".repeat(40), "?vue=1"]) expect(vueDeLAdresse(mauvaise)).toBe(VUE_CUMUL);
  });

  it("l'adresse garde le jour et la vue ; aujourd'hui et le cumul n'écrivent rien", () => {
    const base = "https://playdujour.com/classement/";
    expect(adresseDeVue(base, { date: null, vue: VUE_CUMUL }).search).toBe("");
    expect(adresseDeVue(base, { date: null, vue: "jump" }).search).toBe("?vue=jump");
    expect(adresseDeVue(base, { date: "2026-10-27", vue: "track" }).search).toBe("?date=2026-10-27&vue=track");
    // Revenir au cumul efface la vue, revenir à aujourd'hui efface la date.
    expect(adresseDeVue(`${base}?date=2026-10-27&vue=track`, { date: null, vue: VUE_CUMUL }).search).toBe("");
    expect(adresseDeVue(`${base}?vue=jump`, { date: "2026-10-26", vue: "jump" }).search).toBe("?date=2026-10-26&vue=jump");
  });
});

describe("les onglets", () => {
  it("Cumulé, puis un onglet par jeu du jour, dans l'ordre du registre", () => {
    expect(onglets(JEUX).map((o) => o.vue)).toEqual(["cumul", "track", "jump"]);
    expect(onglets([JEUX[0]!]).map((o) => o.vue)).toEqual(["cumul", "track"]);
  });

  it("flèches, Début et Fin passent d'un onglet à l'autre en bouclant ; une autre touche ne fait rien", () => {
    expect(ongletVoisin(0, 3, "ArrowRight")).toBe(1);
    expect(ongletVoisin(2, 3, "ArrowRight")).toBe(0);
    expect(ongletVoisin(0, 3, "ArrowLeft")).toBe(2);
    expect(ongletVoisin(1, 3, "Home")).toBe(0);
    expect(ongletVoisin(1, 3, "End")).toBe(2);
    expect(ongletVoisin(1, 3, "a")).toBeNull();
  });
});

describe("la séparation « Un jeu sur deux »", () => {
  it("elle tombe sur la première ligne d'un joueur qui n'a pas tout fini, au cumul seulement", () => {
    const lignes = [{ complet: true }, { complet: true }, { complet: false }, { complet: false }];
    expect(positionSeparation(lignes)).toBe(2);
    expect(positionSeparation([{ complet: false }])).toBe(0);
    expect(positionSeparation([{ complet: true }])).toBeNull();
    expect(positionSeparation([])).toBeNull();
    expect(aSeparation({ vue: "cumul", top: lignes as never })).toBe(2);
    expect(aSeparation({ vue: "track", top: lignes as never })).toBeNull();
  });
});

describe("la tuile « Classement du jour » de l'accueil", () => {
  const jeux = (...statuts: ("fini" | "pas_joue" | "en_cours")[]): Jour["jeux"] =>
    JEUX.map((j, i) => ({
      ...j,
      numero: 1,
      theme: null,
      seuils: null,
      premierJour: "2026-10-13",
      etat: statuts[i] === "fini" ? { statut: "fini", tempsMs: 30_000, medaille: null, rang: 9, classes: 40 } : statuts[i] === "en_cours" ? { statut: "en_cours" } : { statut: "pas_joue" },
    }));
  const joueur = (cumulMs: number | null, rangDuJour: number | null) => ({ pseudo: "A", serie: 0, aProlonger: false, journeesParfaites: 0, aujourdhuiParfaite: false, cumulMs, rangDuJour, classesDuJour: rangDuJour === null ? null : 40 });

  it("les deux jeux finis : la place et le temps cumulé", () => {
    expect(tuileDuClassement(joueur(102_315, 9), jeux("fini", "fini"))).toEqual({ type: "cumul", rang: 9, cumulMs: 102_315 });
  });

  it("un seul jeu fini : la place et le jeu à finir pour le cumul (le premier qui n'est pas fini)", () => {
    expect(tuileDuClassement(joueur(null, 14), jeux("fini", "pas_joue"))).toEqual({ type: "manque", rang: 14, jeu: { jeu: "jump", nom: "Jump" } });
    expect(tuileDuClassement(joueur(null, 14), jeux("pas_joue", "fini"))).toEqual({ type: "manque", rang: 14, jeu: { jeu: "cdj", nom: "Track" } });
    // Un jeu « en cours » n'est pas fini.
    expect(tuileDuClassement(joueur(null, 3), jeux("fini", "en_cours"))).toMatchObject({ type: "manque", jeu: { jeu: "jump" } });
  });

  it("aucun jeu fini, joueur neuf ou sans réponse : l'invitation d'avant", () => {
    expect(tuileDuClassement(joueur(null, null), jeux("pas_joue", "pas_joue"))).toEqual({ type: "inviter" });
    expect(tuileDuClassement(undefined, [])).toEqual({ type: "inviter" });
  });
});
