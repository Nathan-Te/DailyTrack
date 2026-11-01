import { describe, expect, it } from "vitest";
import { CLE_REGLAGES, REGLAGES_JOUEUR_DEFAUT, VERSION_REGLAGES, ecrireReglagesJoueur, facteurDe, lireReglagesJoueur } from "../src/reglagesJoueur";

// Lot T7 : les réglages d'affichage du joueur (`tower:reglages`) : le fantôme au départ, les secousses, la panique des yeux, la visée. Le stockage est absent, refusé ou abîmé : les défauts, sans erreur.
const magasin = (brut?: string) => {
  const m = new Map<string, string>(brut === undefined ? [] : [[CLE_REGLAGES, brut]]);
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
};

describe("les réglages d'affichage du joueur", () => {
  it("la clé est une donnée de jeu de Tower : `tower:reglages`", () => {
    expect(CLE_REGLAGES).toBe("tower:reglages");
  });

  it("sans stockage, ou rien d'écrit : les défauts", () => {
    expect(lireReglagesJoueur(null)).toEqual(REGLAGES_JOUEUR_DEFAUT);
    expect(lireReglagesJoueur(magasin())).toEqual({ fantome: "meilleure", secousses: "normal", yeux: "normal", visee: true });
  });

  it("abîmé, d'un autre format ou qui lève : les défauts, sans erreur", () => {
    for (const brut of ["pas du json", "null", "42", "[]", '{"v":2,"fantome":"aucun"}', "{}"]) expect(lireReglagesJoueur(magasin(brut)), brut).toEqual(REGLAGES_JOUEUR_DEFAUT);
    const leve = { getItem: () => { throw new Error("refusé"); }, setItem: () => { throw new Error("refusé"); } };
    expect(lireReglagesJoueur(leve)).toEqual(REGLAGES_JOUEUR_DEFAUT);
    expect(() => ecrireReglagesJoueur(leve, REGLAGES_JOUEUR_DEFAUT)).not.toThrow();
    expect(() => ecrireReglagesJoueur(null, REGLAGES_JOUEUR_DEFAUT)).not.toThrow();
  });

  it("une valeur invalide reprend son défaut, les autres champs restent", () => {
    const brut = JSON.stringify({ v: VERSION_REGLAGES, fantome: "diamant", secousses: "reduit", yeux: "énorme", visee: "oui" });
    expect(lireReglagesJoueur(magasin(brut))).toEqual({ fantome: "meilleure", secousses: "reduit", yeux: "normal", visee: true });
  });

  it("ce qui est écrit est relu", () => {
    const s = magasin();
    const r = { fantome: "aucun", secousses: "aucun", yeux: "reduit", visee: false } as const;
    ecrireReglagesJoueur(s, r);
    expect(lireReglagesJoueur(s)).toEqual(r);
  });

  it("les niveaux : normal 1, réduit la moitié, aucun zéro", () => {
    expect([facteurDe("normal"), facteurDe("reduit"), facteurDe("aucun")]).toEqual([1, 0.5, 0]);
  });
});
