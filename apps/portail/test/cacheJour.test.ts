import { daysFromCivil } from "@cdj/core";
import { IDENTITY_REV_KEY } from "@cdj/profile";
import { describe, expect, it } from "vitest";
import { CLE_CACHE_JOUR, garderJour, jourGarde } from "../src/cacheJour";
import type { Jour } from "../src/jour";

// La copie de la dernière réponse de l'accueil : elle accélère l'affichage, elle ne le fausse jamais (autre jour, autre joueur, état qui a pu changer, message retiré).

const JOUR_LOCAL = daysFromCivil(2026, 11, 2);
const MAINTENANT = Date.parse("2026-11-02T13:00:00.000Z");

const jour = (plus: Partial<Jour> = {}): Jour => ({
  date: "2026-11-02",
  journee: 8,
  maintenant: "2026-11-02T12:00:00.000Z",
  prochainJour: "2026-11-02T23:00:00.000Z",
  jeux: [
    { jeu: "cdj", site: "track", numero: 21, theme: "nuit", seuils: null, premierJour: "2026-10-13", etat: { statut: "fini", tempsMs: 61000, medaille: "gold", rang: 3, classes: 40 } },
    { jeu: "jump", site: "jump", numero: 18, theme: "foret", seuils: null, premierJour: "2026-10-16", etat: { statut: "en_cours", morts: 4 } },
    { jeu: "tower", site: "tower", numero: 1, theme: "port", seuils: null, premierJour: "2026-11-02", unite: "mm", etat: { statut: "pas_joue" } },
  ],
  joueur: { pseudo: "Zoé", serie: 5, aProlonger: false, journeesParfaites: 1, aujourdhuiParfaite: false },
  nouveaute: { id: 3, date: "2026-11-01", titre: { fr: "Tower", en: "Tower" }, publieLe: 1 },
  annonce: { id: 9, fr: "Maintenance", en: "Maintenance", ton: "info", ou: ["portail"], jusqua: null } as unknown as Jour["annonce"],
  ...plus,
});

const memoire = (): Pick<Storage, "getItem" | "setItem" | "removeItem"> & { m: Map<string, string> } => {
  const m = new Map<string, string>();
  return { m, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
};

describe("portail : la copie de la dernière réponse de l'accueil", () => {
  it("la clé est une donnée de jeu (cdj:, effacée au Nouveau départ), pas un réglage gardé", async () => {
    const { CLES_GARDEES, clesDeDonnees } = await import("@cdj/profile");
    expect(CLE_CACHE_JOUR.startsWith("cdj:")).toBe(true);
    expect(CLES_GARDEES).not.toContain(CLE_CACHE_JOUR);
    const s = Object.assign(memoire(), { length: 0, key: () => null });
    s.setItem(CLE_CACHE_JOUR, "{}");
    const liste = { length: 1, key: (i: number) => (i === 0 ? CLE_CACHE_JOUR : null) };
    expect(clesDeDonnees(liste)).toEqual([CLE_CACHE_JOUR]);
  });

  it("rend la réponse gardée du jour, sans le message en direct, avec Tower et la nouveauté", () => {
    const s = memoire();
    garderJour(s, jour(), true);
    const j = jourGarde(s, JOUR_LOCAL, MAINTENANT, true)!;
    expect(j.jeux.map((g) => g.jeu)).toEqual(["cdj", "jump", "tower"]);
    expect(j.nouveaute?.titre.fr).toBe("Tower");
    expect(j.joueur?.serie).toBe(5);
    expect(j.annonce).toBeUndefined();
    expect(s.m.get(CLE_CACHE_JOUR)).not.toContain("Maintenance");
  });

  it("un état qui a pu changer n'est pas montré : seuls les jeux finis gardent le leur", () => {
    const s = memoire();
    garderJour(s, jour(), true);
    const j = jourGarde(s, JOUR_LOCAL, MAINTENANT, true)!;
    expect(j.jeux.map((g) => g.etat?.statut)).toEqual(["fini", undefined, undefined]);
  });

  it("un visiteur sans profil n'a rien de gardé : sa réponse est publique, le cache de Hosting la sert déjà", () => {
    const s = memoire();
    garderJour(s, jour(), false);
    expect(s.m.size).toBe(0);
  });

  it("sans joueur dans la copie, la partie publique est rendue telle quelle", () => {
    const s = memoire();
    const { joueur: _j, ...sansJoueur } = jour();
    garderJour(s, sansJoueur as Jour, true);
    expect(jourGarde(s, JOUR_LOCAL, MAINTENANT, false)?.jeux).toHaveLength(3);
  });

  it("jamais un autre jour, ni après le prochain minuit", () => {
    const s = memoire();
    garderJour(s, jour(), true);
    expect(jourGarde(s, JOUR_LOCAL + 1, MAINTENANT, true)).toBeNull();
    expect(jourGarde(s, JOUR_LOCAL, Date.parse("2026-11-02T23:00:01.000Z"), true)).toBeNull();
  });

  it("jamais les données d'un autre joueur : la révision d'identité a changé, ou il n'y a plus de profil", () => {
    const s = memoire();
    garderJour(s, jour(), true);
    s.setItem(IDENTITY_REV_KEY, "1");
    expect(jourGarde(s, JOUR_LOCAL, MAINTENANT, true)).toBeNull();
    expect(s.m.has(CLE_CACHE_JOUR)).toBe(false);
    const t = memoire();
    garderJour(t, jour(), true);
    expect(jourGarde(t, JOUR_LOCAL, MAINTENANT, false)).toBeNull();
    expect(t.m.has(CLE_CACHE_JOUR)).toBe(false);
  });

  it("une copie illisible ou d'une autre forme est retirée sans rien casser ; un stockage qui refuse ne lève pas", () => {
    for (const brut of ["pas du json", "null", JSON.stringify({ v: 2, rev: 0, jour: jour() }), JSON.stringify({ v: 1, rev: 0, jour: { date: 3 } })]) {
      const s = memoire();
      s.setItem(CLE_CACHE_JOUR, brut);
      expect(jourGarde(s, JOUR_LOCAL, MAINTENANT, true)).toBeNull();
    }
    const refuse = { getItem: () => { throw new Error("refusé"); }, setItem: () => { throw new Error("refusé"); } };
    expect(() => garderJour(refuse, jour(), true)).not.toThrow();
    expect(jourGarde(refuse, JOUR_LOCAL, MAINTENANT, true)).toBeNull();
    expect(jourGarde(null, JOUR_LOCAL, MAINTENANT, true)).toBeNull();
  });
});
