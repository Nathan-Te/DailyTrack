import { describe, expect, it } from "vitest";
import { creerLecteur } from "../src/lecteur";
import type { PisteServie } from "../src/types";
import { CLE_REGLAGES, CLE_REPRISE, FONDU_S, choisirSuivante, courbeFondu, departDeLaPage, ecrireReprise, lireReglages, niveauFinal, VALIDITE_REPRISE_MS } from "../src/logique";
import { banc, liste, piste, StockageMemoire, type Banc } from "./faux";

const DEUX = liste(piste("a"), piste("b"), piste("c"));

/** Un lecteur démarré sur un banc : la liste est chargée, le premier morceau lancé. */
async function demarre(jeu: "track" | "jump" | "tower" | "portail" = "track", contenu: unknown = DEUX, o: Parameters<typeof banc>[2] = {}): Promise<{ b: Banc; l: ReturnType<typeof creerLecteur> }> {
  const b = banc(jeu, contenu, o);
  const l = creerLecteur(b.deps);
  await b.pret();
  return { b, l };
}

describe("le choix du morceau suivant", () => {
  it("jamais deux fois le même d'affilée, quel que soit le hasard (2 000 tirages)", () => {
    const pistes = [piste("a"), piste("b", { poids: 3 }), piste("c")];
    let precedent: string | null = null;
    const vus = new Set<string>();
    for (let i = 0; i < 2000; i++) {
      const p: PisteServie = choisirSuivante(pistes, precedent, Math.random)!;
      expect(p.id).not.toBe(precedent);
      vus.add(p.id);
      precedent = p.id;
    }
    expect([...vus].sort()).toEqual(["a", "b", "c"]);
  });

  it("tous les hasards possibles, aux deux extrémités : jamais le précédent", () => {
    const pistes = [piste("a"), piste("b"), piste("c")];
    for (const h of [0, 0.0001, 0.34, 0.5, 0.66, 0.9999, 1]) for (const prec of ["a", "b", "c", null]) expect(choisirSuivante(pistes, prec, () => h)?.id).not.toBe(prec);
  });

  it("le poids de tirage compte : un morceau de poids 9 revient bien plus souvent qu'un de poids 1", () => {
    const pistes = [piste("a"), piste("b", { poids: 9 }), piste("c")];
    let n = 0;
    let seed = 7;
    const hasard = () => ((seed = (seed * 48271) % 2147483647) / 2147483647);
    let prec: string | null = null;
    for (let i = 0; i < 3000; i++) {
      const p: PisteServie = choisirSuivante(pistes, prec, hasard)!;
      if (p.id === "b") n++;
      prec = p.id;
    }
    expect(n).toBeGreaterThan(1200);
  });

  it("un seul morceau : il revient ; aucun : rien", () => {
    expect(choisirSuivante([piste("a")], "a", Math.random)?.id).toBe("a");
    expect(choisirSuivante([], null, Math.random)).toBeNull();
  });
});

describe("le fondu", () => {
  it("deux courbes à puissance constante : l'une monte de 0 à 1, l'autre descend de 1 à 0, et sin² + cos² = 1", () => {
    const { entree, sortie } = courbeFondu(32);
    expect([entree[0], entree[31]]).toEqual([0, 1]);
    expect(sortie[0]).toBe(1);
    expect(sortie[31]!).toBeCloseTo(0, 6);
    for (let i = 0; i < 32; i++) expect(entree[i]! ** 2 + sortie[i]! ** 2).toBeCloseTo(1, 6);
  });

  it("à la fin du morceau, le suivant entre en fondu pendant que celui-ci sort, puis il se tait", async () => {
    const { b, l } = await demarre("track", liste(piste("a"), piste("b")));
    const [v0, v1] = b.elements;
    expect(l.enCours()?.id).toBe("a");
    expect(v0!.src).toBe("/musique/a-abcd1234.m4a");
    v0!.duration = 120;
    v0!.jusqua(120 - FONDU_S - 1); // loin de la fin : rien
    expect(v1!.lectures).toBe(0);
    v0!.jusqua(120 - FONDU_S + 0.1); // la fin approche
    expect(l.enCours()?.id).toBe("b");
    expect(v1!.src).toBe("/musique/b-abcd1234.m4a");
    expect(v1!.lectures).toBe(1);
    // Les gains des deux voix : les deux courbes, de la durée du fondu.
    const gains = b.ctx.gains.filter((g) => g.gain.courbes().length > 0);
    expect(gains.length).toBe(2);
    for (const g of gains) expect(g.gain.courbes().at(-1)![3]).toBe(FONDU_S);
    // Le premier se tait quand son fondu est fini.
    expect(v0!.paused).toBe(false);
    b.attente.filter((a) => a.ms > FONDU_S * 1000 - 1).forEach((a) => a.fn());
    expect(v0!.paused).toBe(true);
    // Le morceau suivant n'est jamais le même que celui qui sort.
    expect(l.etat().precedent).toBe("a");
  });

  it("« Morceau suivant » : un fondu plus court, jamais le même morceau", async () => {
    const { b, l } = await demarre("track", DEUX, { hasard: [0, 0, 0, 0] });
    const avant = l.enCours()!.id;
    l.suivante();
    expect(l.enCours()!.id).not.toBe(avant);
    const courbes = b.ctx.gains.flatMap((g) => g.gain.courbes()).map((c) => c[3]);
    expect(Math.min(...courbes)).toBeLessThan(FONDU_S);
  });
});

describe("le premier geste et les règles des navigateurs", () => {
  it("le lecteur ne demande rien tant qu'il n'est pas créé : liste, contexte et éléments audio n'existent qu'après", async () => {
    const b = banc("track", DEUX);
    expect(b.etat.requetes).toEqual([]);
    expect(b.elements).toEqual([]);
    expect(b.ecouteursDe("fenetre", "click")).toBe(0);
    creerLecteur(b.deps);
    await b.pret();
    expect(b.etat.requetes).toEqual(["/musique/liste.json"]);
    expect(b.elements.length).toBe(2);
  });

  it("un contexte suspendu (pas de geste valide) : la musique attend, chaque geste le réveille, puis les écouteurs de geste partent", async () => {
    const b = banc("track", DEUX);
    b.ctx.resume = async () => undefined; // le navigateur refuse tant qu'il n'y a pas de vrai geste
    const l = creerLecteur(b.deps);
    await b.pret();
    expect(b.ecouteursDe("fenetre", "touchend")).toBe(1);
    expect(l.etat().joue).toBe(false);
    b.ctx.resume = async function (this: typeof b.ctx) { this.state = "running"; };
    b.elements[0]!.paused = true;
    b.emettre("fenetre", "touchend");
    await b.pret();
    expect(b.ctx.state).toBe("running");
    expect(l.etat().joue).toBe(true);
    expect(b.ecouteursDe("fenetre", "touchend")).toBe(0);
    expect(b.ecouteursDe("fenetre", "click")).toBe(0);
  });

  it("à iPhone : tant que l'audio n'est pas débloqué, le lecteur écoute `touchend` et `click` (seuls gestes qui terminent un toucher)", async () => {
    const b = banc("track", DEUX);
    b.ctx.resume = async () => undefined;
    creerLecteur(b.deps);
    await b.pret();
    for (const g of ["pointerdown", "keydown", "touchstart", "touchend", "click"]) expect(b.ecouteursDe("fenetre", g), g).toBe(1);
  });

  it("une liste vide (aucun morceau pour ce jeu) : ni contexte, ni élément audio, rien ne joue", async () => {
    const { b, l } = await demarre("portail", DEUX.pistes.length ? liste(piste("a", { jeux: ["track"] })) : DEUX);
    expect(b.elements).toEqual([]);
    expect(l.etat().active).toBe(false);
  });

  it("une réponse qui n'est pas une liste (page d'erreur, JSON d'une autre version) : le lecteur se tait sans lever", async () => {
    for (const contenu of ["<html>", { version: 2, pistes: [] }, null]) {
      const { b, l } = await demarre("track", contenu);
      expect(b.elements).toEqual([]);
      expect(l.etat().active).toBe(false);
    }
  });

  it("une liste qui ne se charge pas : le lecteur se tait sans lever", async () => {
    const b = banc("track", DEUX);
    b.deps.chargerListe = async () => {
      throw new Error("réseau");
    };
    const l = creerLecteur(b.deps);
    await b.pret();
    expect(l.etat().active).toBe(false);
  });
});

describe("l'arrière-plan", () => {
  it("l'onglet passe en arrière-plan : tout se met en pause et le contexte se suspend ; au retour la musique reprend", async () => {
    const { b, l } = await demarre();
    b.elements[0]!.paused = false;
    b.etat.cachee = true;
    b.emettre("document", "visibilitychange");
    expect(b.elements.every((e) => e.paused)).toBe(true);
    expect(b.ctx.suspendus).toBe(1);
    expect(l.etat().enPause).toBe(true);
    const reprisesAvant = b.elements[0]!.lectures;
    b.etat.cachee = false;
    b.emettre("document", "visibilitychange");
    expect(b.ctx.state).toBe("running");
    expect(b.elements[0]!.paused).toBe(false);
    expect(b.elements[0]!.lectures).toBe(reprisesAvant + 1);
    expect(l.etat().enPause).toBe(false);
  });

  it("en arrière-plan, la position est gardée pour la reprise", async () => {
    const { b } = await demarre();
    b.elements[0]!.currentTime = 42;
    b.etat.cachee = true;
    b.emettre("document", "visibilitychange");
    const r = JSON.parse(b.session.getItem(CLE_REPRISE)!);
    expect(r).toMatchObject({ id: "a", t: 42 });
  });

  it("un fondu et un « suivant » ne se déclenchent pas pendant la pause", async () => {
    const { b, l } = await demarre();
    b.etat.cachee = true;
    b.emettre("document", "visibilitychange");
    const avant = l.enCours()!.id;
    l.suivante();
    b.elements[0]!.duration = 100;
    b.elements[0]!.jusqua(99);
    expect(l.enCours()!.id).toBe(avant);
  });
});

describe("la reprise au changement de page", () => {
  const sessionAvec = (id: string, t: number, at: number) => new StockageMemoire(new Map([[CLE_REPRISE, ecrireReprise({ id, t, at })]]));

  it("le même morceau est repris là où il en était (même jeu, page suivante)", async () => {
    const { b, l } = await demarre("track", DEUX, { session: sessionAvec("b", 37.5, 999_000), maintenant: 1_000_000 });
    expect(l.enCours()?.id).toBe("b");
    expect(b.elements[0]!.currentTime).toBe(37.5);
  });

  it("de Track à Jump : si le morceau passe aussi dans Jump, il continue au même endroit ; sinon un autre entre en fondu, jamais celui qu'on vient d'entendre", async () => {
    const l2 = liste(piste("a", { jeux: ["track"] }), piste("b", { jeux: ["track", "jump"] }), piste("c", { jeux: ["jump"] }));
    const dansJump = await demarre("jump", l2, { session: sessionAvec("b", 20, 999_500) });
    expect(dansJump.l.enCours()?.id).toBe("b");
    expect(dansJump.b.elements[0]!.currentTime).toBe(20);
    // `a` n'existe pas dans Jump : un autre morceau, en fondu d'entrée, depuis le début.
    const autre = await demarre("jump", l2, { session: sessionAvec("a", 20, 999_500) });
    expect(autre.l.enCours()?.id).not.toBe("a");
    expect(autre.b.elements[0]!.currentTime).toBe(0);
    expect(autre.b.ctx.gains.some((g) => g.gain.courbes().length > 0)).toBe(true);
  });

  it("une reprise trop vieille, ou un morceau presque fini : on repart d'un morceau neuf", () => {
    const pistes = [piste("a"), piste("b")];
    const vieille = { id: "a", t: 30, at: 0 };
    expect(departDeLaPage(pistes, vieille, VALIDITE_REPRISE_MS + 1, () => 0)).toMatchObject({ repris: false, depart: 0 });
    expect(departDeLaPage(pistes, { id: "a", t: 119, at: 5 }, 10, () => 0)?.repris).toBe(false);
    expect(departDeLaPage(pistes, { id: "a", t: 30, at: 5 }, 10, () => 0)).toMatchObject({ repris: true, depart: 30 });
    expect(departDeLaPage([], null, 0, () => 0)).toBeNull();
  });

  it("le lecteur note sa position dans le stockage de l'onglet (pas dans celui de l'appareil)", async () => {
    const { b } = await demarre();
    b.elements[0]!.jusqua(12);
    expect(JSON.parse(b.session.getItem(CLE_REPRISE)!)).toMatchObject({ id: "a", t: 12 });
    expect(b.stockage.getItem(CLE_REPRISE)).toBeNull();
    b.emettre("fenetre", "pagehide");
    expect(b.session.getItem(CLE_REPRISE)).not.toBeNull();
  });
});

describe("les réglages communs aux trois jeux", () => {
  it("un réglage fait dans un jeu est relu par les deux autres (même clé, même stockage de l'appareil)", async () => {
    const appareil = new StockageMemoire();
    const track = await demarre("track", DEUX, { stockage: appareil });
    track.l.regler({ volume: 0.7, coupee: true });
    expect(appareil.getItem(CLE_REGLAGES)).not.toBeNull();
    for (const jeu of ["jump", "tower"] as const) {
      const autre = await demarre(jeu, DEUX, { stockage: appareil });
      expect(autre.l.reglages()).toEqual({ volume: 0.7, coupee: true });
    }
    expect(lireReglages(appareil.getItem(CLE_REGLAGES))).toEqual({ volume: 0.7, coupee: true });
  });

  it("par défaut : allumée, à un volume modéré ; une valeur illisible retrouve le défaut", () => {
    expect(lireReglages(null)).toEqual({ volume: 0.4, coupee: false });
    expect(lireReglages("pas du json")).toEqual({ volume: 0.4, coupee: false });
    expect(lireReglages(JSON.stringify({ volume: 9, coupee: "oui" }))).toEqual({ volume: 1, coupee: false });
  });

  it("le niveau final : coupée ou en sourdine = 0 ; la baisse du jeu et le volume s'appliquent ; le niveau de base reste sous 1", () => {
    const r = { volume: 1, coupee: false };
    expect(niveauFinal({ reglages: r, baisse: 1, sourdine: false })).toBeLessThanOrEqual(0.5);
    expect(niveauFinal({ reglages: r, baisse: 0.4, sourdine: false })).toBeCloseTo(0.4 * niveauFinal({ reglages: r, baisse: 1, sourdine: false }), 9);
    expect(niveauFinal({ reglages: { volume: 1, coupee: true }, baisse: 1, sourdine: false })).toBe(0);
    expect(niveauFinal({ reglages: r, baisse: 1, sourdine: true })).toBe(0);
    expect(niveauFinal({ reglages: { volume: 0, coupee: false }, baisse: 1, sourdine: false })).toBe(0);
  });

  it("la baisse et la sourdine du jeu changent le niveau du bus, pas les réglages du joueur", async () => {
    const { b, l } = await demarre();
    const bus = b.ctx.gains[0]!;
    l.baisser(0.4);
    const cible = () => bus.gain.appels.filter((a) => a[0] === "cible").at(-1)![1] as number;
    const plein = niveauFinal({ reglages: l.reglages(), baisse: 1, sourdine: false });
    expect(cible()).toBeCloseTo(plein * 0.4, 9);
    l.sourdine(true);
    expect(cible()).toBe(0);
    l.sourdine(false);
    l.baisser(1);
    expect(cible()).toBeCloseTo(plein, 9);
    expect(l.reglages()).toEqual({ volume: 0.4, coupee: false });
  });

  it("un compresseur est sur le chemin de sortie, et le bus ne passe qu'une fois par lui", async () => {
    const b = banc("track", DEUX);
    const comp = { threshold: new (await import("./faux")).FauxParam(), ratio: new (await import("./faux")).FauxParam(), knee: new (await import("./faux")).FauxParam(), attack: new (await import("./faux")).FauxParam(), release: new (await import("./faux")).FauxParam(), vers: [] as unknown[], connect(v: unknown) { this.vers.push(v); return v; } };
    (b.ctx as unknown as { createDynamicsCompressor: () => typeof comp }).createDynamicsCompressor = () => comp;
    creerLecteur(b.deps);
    await b.pret();
    expect(b.ctx.gains[0]!.vers).toEqual([comp]);
    expect(comp.vers).toEqual([b.ctx.destination]);
  });
});
