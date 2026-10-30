import { describe, expect, it, vi } from "vitest";
import { ETATS_JEU, JEUX_PUBLICS, etatDansListe as etatCore, etatsDeReponse as reponseCore, etatsParDefaut as defautCore } from "@cdj/core/jeux";
import { CLES_GARDEES, clesDeDonnees } from "../src/generation";
import {
  ENTETE_APERCU,
  adopterCleApercu,
  cleApercuKey,
  demarrerInterrupteur,
  etatDansListe,
  etatsDeReponse,
  etatsParDefaut,
  fetchAvecCleApercu,
  lireCleApercu,
  ouvertureDuJeu,
} from "../src/jeux";

// Lot P : l'interrupteur des jeux côté client — la clé d'aperçu (rangée puis retirée de l'adresse, jamais dans l'adresse d'un appel), la décision « jeu / aperçu / Bientôt », le repli sans réseau.

const CLE = "AbCdEfGhIjKlMnOpQrStUvWxYz012345";
const memoire = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
};

describe("accord avec le serveur (@cdj/core/jeux)", () => {
  it("les règles recopiées disent la même chose que celles du serveur", () => {
    expect(etatsParDefaut()).toEqual(defautCore());
    expect(Object.keys(etatsParDefaut())).toEqual([...JEUX_PUBLICS]);
    const reponse = { jeux: { track: "on", jump: "preview", tower: "?" } };
    expect(etatsDeReponse(reponse)).toEqual(reponseCore(reponse));
    for (const v of [null, {}, { jeux: [] }, { jeux: "x" }]) expect(etatsDeReponse(v)).toEqual(reponseCore(v));
    for (const e of ETATS_JEU) expect(etatDansListe({ a: e }, "a")).toBe(etatCore({ a: e }, "a"));
    expect(etatDansListe({ a: "on" }, "b")).toBe(etatCore({ a: "on" }, "b"));
  });
});

describe("la clé d'aperçu", () => {
  it("le lien d'aperçu la range puis rend l'adresse sans elle ; les autres paramètres et le fragment restent", () => {
    const s = memoire();
    const r = adopterCleApercu("tower", { pathname: "/tower/", search: `?apercu=${CLE}&debug=1`, hash: "#x" }, s);
    expect(r).toEqual({ cle: CLE, adresse: "/tower/?debug=1#x" });
    expect(lireCleApercu(s, "tower")).toBe(CLE);
    expect(s.m.get(cleApercuKey("tower"))).toBe(CLE);
    expect(adopterCleApercu("tower", { pathname: "/tower/", search: "", hash: "" }, s)).toBeNull();
  });

  it("une clé illisible est retirée de l'adresse sans être gardée ; un stockage refusé ne casse rien", () => {
    const s = memoire();
    expect(adopterCleApercu("tower", { pathname: "/tower/", search: "?apercu=x", hash: "" }, s)).toEqual({ cle: null, adresse: "/tower/" });
    expect(adopterCleApercu("tower", { pathname: "/tower/", search: `?apercu=${"a".repeat(200)}`, hash: "" }, s)?.cle).toBeNull();
    expect(s.m.size).toBe(0);
    const casse = { getItem: () => { throw new Error("refusé"); }, setItem: () => { throw new Error("refusé"); } };
    expect(adopterCleApercu("tower", { pathname: "/t/", search: `?apercu=${CLE}`, hash: "" }, casse)).toEqual({ cle: CLE, adresse: "/t/" });
    expect(lireCleApercu(casse, "tower")).toBeNull();
  });

  it("la clé part dans l'en-tête X-Preview-Key, vers l'API de la plateforme seulement, jamais dans une adresse", async () => {
    const appels: { url: string; entete: string | null }[] = [];
    const f = fetchAvecCleApercu("https://playdujour.com", CLE, async (url, init) => {
      appels.push({ url, entete: new Headers(init.headers).get(ENTETE_APERCU) });
      return new Response("{}");
    });
    await f("https://playdujour.com/api/jump/info", {});
    await f("https://autre.example/api/x", {});
    await f("https://playdujour.com/jump/levels/x.json", {});
    expect(appels).toEqual([
      { url: "https://playdujour.com/api/jump/info", entete: CLE },
      { url: "https://autre.example/api/x", entete: null },
      { url: "https://playdujour.com/jump/levels/x.json", entete: null },
    ]);
    expect(appels.every((a) => !a.url.includes(CLE))).toBe(true);
  });

  it("c'est un réglage de l'appareil : « Nouveau départ » ne l'efface pas", () => {
    const s = { length: 2, key: (i: number) => ["cdj:apercu:tower", "cdj:player"][i] ?? null };
    expect(clesDeDonnees(s)).toEqual(["cdj:player"]);
    expect(CLES_GARDEES).not.toContain("cdj:apercu:tower"); // gardée par préfixe, pas par une liste de jeux
  });
});

describe("ce que le jeu montre", () => {
  const lecture = (etats: Record<string, "off" | "preview" | "on">, apercuDePr = false) => ({ etats, apercuDePr });
  it("`on` : le jeu ; `off` : Bientôt, même avec une clé ; `preview` : l'aperçu avec la clé, Bientôt sans", () => {
    expect(ouvertureDuJeu("tower", lecture({ tower: "on" }), null)).toEqual({ vue: "ouvert" });
    expect(ouvertureDuJeu("tower", lecture({ tower: "off" }), CLE)).toEqual({ vue: "bientot" });
    expect(ouvertureDuJeu("tower", lecture({ tower: "preview" }), CLE)).toEqual({ vue: "apercu", brouillon: false });
    expect(ouvertureDuJeu("tower", lecture({ tower: "preview" }), null)).toEqual({ vue: "bientot" });
  });

  it("un jeu absent de la liste vaut off ; un aperçu de PR montre tout avec le badge « Brouillon »", () => {
    expect(ouvertureDuJeu("tower", lecture({ track: "on" }), null)).toEqual({ vue: "bientot" });
    expect(ouvertureDuJeu("tower", lecture({ tower: "off" }, true), null)).toEqual({ vue: "apercu", brouillon: true });
    expect(ouvertureDuJeu("track", lecture({ track: "on" }, true), null)).toEqual({ vue: "ouvert" });
  });

  it("sans réponse du serveur : la liste du site, où seuls les jeux déjà publics sont ouverts", () => {
    expect(ouvertureDuJeu("track", null, null)).toEqual({ vue: "ouvert" });
    expect(ouvertureDuJeu("jump", null, null)).toEqual({ vue: "ouvert" });
    expect(ouvertureDuJeu("tower", null, CLE)).toEqual({ vue: "bientot" });
  });
});

describe("le démarrage d'un jeu", () => {
  const base = { jeu: "tower", adresse: { pathname: "/tower/", search: `?apercu=${CLE}`, hash: "" } };
  it("range la clé, retire l'adresse, la fait porter par les appels, lit l'état et décide", async () => {
    const s = memoire();
    const remplacer = vi.fn();
    const poser = vi.fn();
    const fetchImpl = async () => new Response(JSON.stringify({ jeux: { tower: "preview" } }));
    const o = await demarrerInterrupteur({ ...base, base: "https://x.test", stockage: s, remplacerAdresse: remplacer, poserCle: poser, fetchImpl });
    expect(remplacer).toHaveBeenCalledWith("/tower/");
    expect(poser).toHaveBeenCalledWith(CLE);
    expect(o).toEqual({ vue: "apercu", brouillon: false });
  });

  it("serveur injoignable : la liste du site ; démonstration ou sans serveur : le jeu s'ouvre sans rien lire", async () => {
    const fetchImpl = async () => {
      throw new Error("réseau");
    };
    const commun = { remplacerAdresse: vi.fn(), poserCle: vi.fn(), stockage: memoire() };
    expect(await demarrerInterrupteur({ jeu: "tower", adresse: { pathname: "/", search: "", hash: "" }, base: "https://x.test", fetchImpl, ...commun })).toEqual({ vue: "bientot" });
    expect(await demarrerInterrupteur({ jeu: "track", adresse: { pathname: "/", search: "", hash: "" }, base: "https://x.test", fetchImpl, ...commun })).toEqual({ vue: "ouvert" });
    expect(await demarrerInterrupteur({ jeu: "tower", adresse: { pathname: "/", search: "", hash: "" }, base: "demo", ...commun })).toEqual({ vue: "ouvert" });
    expect(await demarrerInterrupteur({ jeu: "tower", adresse: { pathname: "/", search: "", hash: "" }, base: null, ...commun })).toEqual({ vue: "ouvert" });
  });
});
