import { readFileSync } from "node:fs";
import { join } from "node:path";
import { daysFromCivil, formatDay } from "@cdj/core";
import { describe, expect, it } from "vitest";
import { ACTIONS_KIT, cleAction } from "../src/jeu/commandes";
import { CATALOGUE_KIT_EN, CATALOGUE_KIT_FR } from "../src/jeu/catalogue";
import { creerVibreur, creerVolumeEffets, lireReglages, volumeEffetsLu } from "../src/jeu/reglagesJoueur";
import { commandesDuJeu } from "../src/jeu/commandes";
import { ligneParDefaut } from "../src/partage";
import { baseApi, choisirJour, lireOptions, serieLocale } from "../src/jeu/session";

// Lot K4f — les parties pures de `brancherJeu` (le DOM est essayé par les specs de « Cibles », le premier jeu assemblé par le kit).
const J = daysFromCivil(2026, 11, 6);

describe("les options d'adresse d'un jeu neuf", () => {
  it("lit l'adresse ; les outils d'essai (`?debug`, `?manuel`, `?simuler=`) sont fermés sur la production (règle R9)", () => {
    const q = "?api=http://localhost:8793&debug&manuel&simuler=lent&tactile=0&seed=2026-11-02&apercu=abc";
    expect(lireOptions(q, false)).toEqual({ api: "http://localhost:8793", apercu: true, debug: true, manuel: true, simuler: "lent", tactile: "0", seed: daysFromCivil(2026, 11, 2), theme: null });
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
    expect(lireReglages(f, stock(null))).toEqual({ v: 1, mouvement: "normal", fantome: "aucun", vibration: "oui", effets: 100 });
    expect(lireReglages(f, stock("pas du json"))).toEqual({ v: 1, mouvement: "normal", fantome: "aucun", vibration: "oui", effets: 100 });
    expect(lireReglages(f, stock(JSON.stringify({ mouvement: "reduit", fantome: "meilleure" })))).toEqual({ v: 1, mouvement: "reduit", fantome: "meilleure", vibration: "oui", effets: 100 });
    expect(lireReglages(f, stock(JSON.stringify({ vibration: "non" }))).vibration).toBe("non"); // lot B1 : la même donnée de stockage, une clé de plus
    expect(lireReglages(f, stock(JSON.stringify({ vibration: "peut-être" }))).vibration).toBe("oui");
    expect(lireReglages(f, { getItem: () => { throw new Error("refusé"); } })).toEqual({ v: 1, mouvement: "normal", fantome: "aucun", vibration: "oui", effets: 100 });
  });
});

describe("la vibration (lot B1)", () => {
  const reglage = (vibration: "oui" | "non") => () => ({ v: 1 as const, mouvement: "normal" as const, fantome: "aucun" as const, vibration, effets: 100 });
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

describe("le volume des effets, séparé de la musique (lot « manques de Blocks »)", () => {
  const stock = (brut: string | null) => ({ getItem: () => brut });
  it("100 par défaut ; de 0 à 100 par pas de 5 ; une valeur illisible retombe sur 100 ; la même donnée de stockage que les autres réglages", () => {
    expect(lireReglages({ fiche: { prefixe: "x:" } }, stock(null)).effets).toBe(100);
    for (const [brut, attendu] of [[35, 35], [37, 35], [38, 40], [250, 100], [-5, 0], [0, 0], ["x", 100], [null, 100], [Number.NaN, 100]] as const) expect(volumeEffetsLu(brut), String(brut)).toBe(attendu);
    expect(lireReglages({ fiche: { prefixe: "x:" } }, stock(JSON.stringify({ effets: 40 }))).effets).toBe(40);
  });
  it("`volumeEffets` rend 0 à 1 et relit le réglage à chaque appel (un réglage changé en pause vaut tout de suite)", () => {
    let effets = 100;
    const v = creerVolumeEffets(() => ({ v: 1, mouvement: "normal", fantome: "aucun", vibration: "oui", effets }));
    expect(v()).toBe(1);
    effets = 25;
    expect(v()).toBe(0.25);
    effets = 0;
    expect(v()).toBe(0);
  });
});

describe("`?theme=` est lu par le kit, hors production seulement (lot « manques de Blocks »)", () => {
  it("le code est rendu tel quel (il est validé contre les thèmes de la fiche par `brancherJeu`) ; fermé sur la production ; absent = null", () => {
    expect(lireOptions("?theme=nuit", false).theme).toBe("nuit");
    expect(lireOptions("?theme=nuit", true).theme).toBeNull();
    expect(lireOptions("", false).theme).toBeNull();
    expect(lireOptions("?theme=", false).theme).toBeNull();
  });
  it("`brancherJeu` n'accepte qu'un code de la fiche, et un thème forcé est un essai : jamais classé, et le contenu du jour reçoit le thème", () => {
    const index = readFileSync(join(__dirname, "../src/jeu/index.ts"), "utf8");
    expect(index).toContain("fiche.themes.includes(options.theme)");
    expect(index).toMatch(/const essai = def\.classable\?\.\(location\.search\) === false \|\| themeForce !== null;/);
    expect(index).toContain("def.contenuDuJour(jour, document.baseURI, theme)");
  });
});

describe("le classement de l'accueil se relit une fois avant de dire « indisponible » (lot « manques de Blocks »)", () => {
  it("un échec de la première lecture attend 2 s puis relit une seule fois ; « indisponible » ne vient qu'ensuite", () => {
    const index = readFileSync(join(__dirname, "../src/jeu/index.ts"), "utf8");
    expect(index).toContain("export const DELAI_REESSAI_CLASSEMENT_MS = 2000;");
    expect(index).toMatch(/if \(!b\.ok\) \{\s*await new Promise\(\(r\) => setTimeout\(r, DELAI_REESSAI_CLASSEMENT_MS\)\);\s*b = await d\.source\.board\(date, pid\);\s*\}/);
    expect(index).toContain("dessinerClassement(!b.ok)"); // l'indisponibilité se dit après le second essai
  });
});

describe("un jeu sans fantôme (lot « manques de Blocks »)", () => {
  const fiche = { id: "essai-sans-fantome", nom: "Essai", colonnes: [{ nom: "score", sens: "desc" as const }], themes: ["a"], prefixe: "essai-sans-fantome:", premierJour: "2026-11-02" };
  const i18n = { parametresCommuns: () => undefined, langue: "fr" } as never;
  const def = (sansFantome: boolean) => ({ actions: [{ id: "poser", clavier: ["Space"], manette: "b0" }], sansFantome }) as never;
  it("la commande « fantôme » (touche G, manette) n'existe que pour un jeu qui a un fantôme", () => {
    const store = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
    const avec = commandesDuJeu({ ...fiche, id: "avec-fantome" }, def(false), i18n);
    const sans = commandesDuJeu(fiche, def(true), i18n);
    expect(avec.actionDeTouche("KeyG")).toBe("fantome");
    expect(sans.actionDeTouche("KeyG")).toBeNull();
    expect(sans.actionDeTouche("Space")).toBe("poser");
    expect(sans.actionDeTouche("KeyP")).toBe("pause");
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });
  it("la partie, les Réglages et le catalogue le savent (le bouton du HUD, la ligne « Fantôme au départ », la rediffusion du Diamant)", () => {
    const partie = readFileSync(join(__dirname, "../src/jeu/partie.ts"), "utf8");
    expect(partie).toContain("const sansFantome = def.sansFantome === true");
    expect(partie).toContain("sansFantome ? null : boutonFantome(");
    expect(partie).toMatch(/\(sansFantome \? null : e === "meilleure"/);
    expect(readFileSync(join(__dirname, "../src/jeu/reglages.ts"), "utf8")).toContain("c.def.sansFantome ? []");
  });
});

describe("la ligne à partager : les extras du jeu viennent après la médaille (lot « manques de Blocks »)", () => {
  const base = { nom: "Blocks", numero: 5, date: "2026-11-06", score: "4 582 pts", medaille: "\u{1F948}", rang: "3e/128" };
  it("`Du Jour · Blocks #5 — 4 582 pts — 🥈 — combo ×7 — 3e/128` ; une chaîne vide est ignorée ; sans extras, rien", () => {
    expect(ligneParDefaut({ ...base, extras: ["combo ×7"] })).toBe("Du Jour · Blocks #5 — 4 582 pts — \u{1F948} — combo ×7 — 3e/128");
    expect(ligneParDefaut({ ...base, extras: [""] })).toBe("Du Jour · Blocks #5 — 4 582 pts — \u{1F948} — 3e/128");
    expect(ligneParDefaut({ ...base })).toBe("Du Jour · Blocks #5 — 4 582 pts — \u{1F948} — 3e/128");
    const partie = readFileSync(join(__dirname, "../src/jeu/partie.ts"), "utf8");
    expect(partie).toContain("extras: def.extrasPartage?.(resultat.score, c.i18n.langue, t) ?? []");
  });
});

describe("le bandeau « Aperçu » réserve sa place à la scène (lot « manques de Blocks »)", () => {
  it("la page porte `dj-avec-apercu` quand le bandeau est posé ; la feuille donne la hauteur à `--dj-apercu-reserve` ; la scène du kit la lit", () => {
    const racine = join(__dirname, "../../..");
    expect(readFileSync(join(racine, "packages/ui/src/interrupteur.ts"), "utf8")).toContain('classList.add("dj-avec-apercu")');
    expect(readFileSync(join(racine, "packages/ui/src/interrupteur.css"), "utf8")).toMatch(/html\.dj-avec-apercu \{\s*--dj-apercu-reserve: \d+px;/);
    expect(readFileSync(join(racine, "packages/kit/src/jeu/jeu.css"), "utf8")).toMatch(/\.jeu-scene \{\s*padding-top: var\(--dj-apercu-reserve, 0px\);/);
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
