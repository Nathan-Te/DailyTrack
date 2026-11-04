import { daysFromCivil, formatDay } from "@cdj/core";
import { describe, expect, it } from "vitest";
import { ACTIONS_KIT, cleAction } from "../src/jeu/commandes";
import { CATALOGUE_KIT_EN, CATALOGUE_KIT_FR } from "../src/jeu/catalogue";
import { creerVibreur, lireReglages } from "../src/jeu/reglagesJoueur";
import { baseApi, choisirJour, lireOptions, serieLocale } from "../src/jeu/session";

// Lot K4f — les parties pures de `brancherJeu` (le DOM est essayé par les specs de « Cibles », le premier jeu assemblé par le kit).
const J = daysFromCivil(2026, 11, 6);

describe("les options d'adresse d'un jeu neuf", () => {
  it("lit l'adresse ; les outils d'essai (`?debug`, `?manuel`, `?simuler=`) sont fermés sur la production (règle R9)", () => {
    const q = "?api=http://localhost:8793&debug&manuel&simuler=lent&tactile=0&seed=2026-11-02&apercu=abc";
    expect(lireOptions(q, false)).toEqual({ api: "http://localhost:8793", apercu: true, debug: true, manuel: true, simuler: "lent", tactile: "0", seed: daysFromCivil(2026, 11, 2) });
    const prod = lireOptions(q, true);
    expect([prod.debug, prod.manuel, prod.simuler]).toEqual([false, false, null]);
    expect(prod.api).toBe("http://localhost:8793"); // la règle R7 s'applique à `baseApi`, pas ici
    expect(lireOptions("?debug&simuler=autre", false).simuler).toBeNull();
    expect(lireOptions("?manuel", false).manuel).toBe(false); // `?manuel` sans `?debug` n'ouvre rien
  });
  it("règle R7 : sur la production `?api=` ne vise que `/`, la page elle-même ou la machine locale", () => {
    expect(baseApi(null, "/", "https://playdujour.com", true)).toBe("https://playdujour.com");
    expect(baseApi("https://pirate.example", "/", "https://playdujour.com", true)).toBe("https://playdujour.com");
    expect(baseApi("http://localhost:8793", undefined, "https://recette.playdujour.com", false)).toBe("http://localhost:8793");
    expect(baseApi(null, undefined, "https://playdujour.com", true)).toBeNull(); // pas de serveur : pas de classement
    expect(baseApi("demo", "/", "https://playdujour.com", false)).toBeNull();
  });
  it("le jour à jouer : `?seed=` d'un jour passé est une archive ; un jour futur est refusé sur la production", () => {
    expect(choisirJour(null, J, true)).toEqual({ jour: J, archive: false, refuse: false });
    expect(choisirJour(J - 3, J, true)).toEqual({ jour: J - 3, archive: true, refuse: false });
    expect(choisirJour(J + 2, J, true)).toEqual({ jour: J, archive: false, refuse: true });
    expect(choisirJour(J + 2, J, false)).toEqual({ jour: J + 2, archive: false, refuse: false });
  });
});

describe("la série locale (les records gardés dans le navigateur)", () => {
  const dates = (...d: number[]) => d.map(formatDay);
  it("compte les jours consécutifs jusqu'à aujourd'hui, ou hier si aujourd'hui n'est pas joué", () => {
    expect(serieLocale(dates(J, J - 1, J - 2, J - 4), J)).toBe(3);
    expect(serieLocale(dates(J - 1, J - 2), J)).toBe(2);
    expect(serieLocale(dates(J - 2), J)).toBe(0);
    expect(serieLocale([], J)).toBe(0);
  });
});

describe("les réglages du joueur", () => {
  const stock = (v: string | null) => ({ getItem: () => v });
  it("des défauts sûrs : stockage vide, abîmé ou refusé", () => {
    const f = { fiche: { prefixe: "cibles:" } };
    expect(lireReglages(f, stock(null))).toEqual({ v: 1, mouvement: "normal", fantome: "aucun", vibration: "oui" });
    expect(lireReglages(f, stock("pas du json"))).toEqual({ v: 1, mouvement: "normal", fantome: "aucun", vibration: "oui" });
    expect(lireReglages(f, stock(JSON.stringify({ mouvement: "reduit", fantome: "meilleure" })))).toEqual({ v: 1, mouvement: "reduit", fantome: "meilleure", vibration: "oui" });
    expect(lireReglages(f, stock(JSON.stringify({ vibration: "non" }))).vibration).toBe("non"); // lot B1 : la même donnée de stockage, une clé de plus
    expect(lireReglages(f, stock(JSON.stringify({ vibration: "peut-être" }))).vibration).toBe("oui");
    expect(lireReglages(f, { getItem: () => { throw new Error("refusé"); } })).toEqual({ v: 1, mouvement: "normal", fantome: "aucun", vibration: "oui" });
  });
});

describe("la vibration (lot B1)", () => {
  const reglage = (vibration: "oui" | "non") => () => ({ v: 1 as const, mouvement: "normal" as const, fantome: "aucun" as const, vibration });
  const faux = () => {
    const appels: unknown[] = [];
    return { appels, nav: { vibrate: (m: number | number[]) => (appels.push(m), true) } };
  };
  it("vibre quand le réglage est « oui », sur un appareil tactile qui sait vibrer ; le motif est copié", () => {
    const { appels, nav } = faux();
    const vibrer = creerVibreur(reglage("oui"), nav, true);
    vibrer(20);
    vibrer([10, 30, 10]);
    expect(appels).toEqual([20, [10, 30, 10]]);
  });
  it("ne fait rien : réglage « non » (lu à chaque appel), pas tactile, pas de `vibrate` (iPhone), navigateur absent", () => {
    const { appels, nav } = faux();
    let r = reglage("oui");
    const vibrer = creerVibreur(() => r(), nav, true);
    r = reglage("non");
    vibrer(20);
    creerVibreur(reglage("oui"), nav, false)(20);
    creerVibreur(reglage("oui"), {}, true)(20);
    creerVibreur(reglage("oui"), null, true)(20);
    expect(appels).toEqual([]);
    r = reglage("oui");
    vibrer(20); // un réglage changé en pause vaut tout de suite
    expect(appels).toEqual([20]);
  });
  it("un navigateur qui refuse la vibration ne casse pas la partie", () => {
    const vibrer = creerVibreur(reglage("oui"), { vibrate: () => { throw new Error("refusé"); } }, true);
    expect(() => vibrer(20)).not.toThrow();
  });
});

describe("les actions du kit et son vocabulaire", () => {
  it("pause, recommencer et fantôme sont à tous les jeux ; chacune a son nom dans le catalogue du kit", () => {
    expect(ACTIONS_KIT.map((a) => a.id)).toEqual(["pause", "recommencer", "fantome"]);
    for (const a of ACTIONS_KIT) expect(CATALOGUE_KIT_FR).toHaveProperty([cleAction(a.id)]);
    expect(cleAction("gauche")).toBe("commandes.action.gauche"); // celles du jeu sont dans son catalogue
  });
  it("le français et l'anglais du kit ont les mêmes clés et les mêmes paramètres", () => {
    expect(Object.keys(CATALOGUE_KIT_EN).sort()).toEqual(Object.keys(CATALOGUE_KIT_FR).sort());
    const params = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const [k, v] of Object.entries(CATALOGUE_KIT_FR)) expect(params(CATALOGUE_KIT_EN[k as keyof typeof CATALOGUE_KIT_EN]), k).toEqual(params(v));
  });
});
