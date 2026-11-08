import { describe, expect, it } from "vitest";
import { REESSAI_PRECHARGEMENT_MS, TAMPONS_MAX, creerLecteur } from "../src/lecteur";
import type { PisteServie } from "../src/types";
import { CLE_REGLAGES, CLE_REPRISE, FONDU_S, FONDU_SCENE_S, pistesDeLaScene, choisirSuivante, courbeFondu, departDeLaPage, ecrireReprise, lireReglages, niveauFinal, VALIDITE_REPRISE_MS } from "../src/logique";
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
    const s0 = b.ctx.sources[0]!;
    expect(l.enCours()?.id).toBe("a");
    expect(s0.fichier).toBe("/musique/a-abcd1234.m4a");
    expect(s0.decalage).toBe(0);
    await b.avancer(107); // loin de la fin : rien
    expect(b.ctx.sources).toHaveLength(1);
    expect(l.enCours()?.id).toBe("a");
    await b.avancer(10); // la position passe 116,85 s : la fin approche
    expect(l.enCours()?.id).toBe("b");
    const s1 = b.ctx.sources[1]!;
    expect(s1.fichier).toBe("/musique/b-abcd1234.m4a");
    expect(s1.decalage).toBe(0);
    expect(b.ctx.sources.filter((s) => s.joue)).toHaveLength(2); // pendant le fondu, les deux jouent
    // Les gains des deux voix : les deux courbes, de la durée du fondu.
    const gains = b.ctx.gains.filter((g) => g.gain.courbes().length > 0);
    expect(gains.length).toBe(2);
    for (const g of gains) expect(g.gain.courbes().at(-1)![3]).toBe(FONDU_S);
    // Le premier se tait quand son fondu est fini.
    expect(s0.joue).toBe(true);
    b.attente.filter((a) => a.ms > FONDU_S * 1000 - 1).forEach((a) => a.fn());
    expect(s0.joue).toBe(false);
    expect(s1.joue).toBe(true);
    // Le morceau suivant n'est jamais le même que celui qui sort.
    expect(l.etat().precedent).toBe("a");
  });

  it("le suivant est téléchargé et décodé pendant que le premier joue : au moment du fondu, plus rien à attendre", async () => {
    const { b, l } = await demarre("track", liste(piste("a"), piste("b")));
    expect(b.etat.telechargements).toEqual(["/musique/a-abcd1234.m4a"]);
    await b.avancer(1);
    expect(b.etat.telechargements).toEqual(["/musique/a-abcd1234.m4a", "/musique/b-abcd1234.m4a"]);
    expect(l.etat().tampons).toEqual(["a", "b"]);
    expect(b.ctx.sources).toHaveLength(1); // préchargé, pas lancé
    await b.avancer(116);
    expect(l.enCours()?.id).toBe("b");
    expect(b.etat.telechargements).toHaveLength(2); // le fondu n'a rien demandé au réseau
  });

  it("« Morceau suivant » : un fondu plus court, jamais le même morceau", async () => {
    const { b, l } = await demarre("track", DEUX, { hasard: [0, 0, 0, 0] });
    const avant = l.enCours()!.id;
    l.suivante();
    await b.pret();
    expect(l.enCours()!.id).not.toBe(avant);
    const courbes = b.ctx.gains.flatMap((g) => g.gain.courbes()).map((c) => c[3]);
    expect(Math.min(...courbes)).toBeLessThan(FONDU_S);
  });

  it("un morceau qui finit sans que le fondu l'ait relayé (la fin arrive avant le seuil) : le suivant entre tout de suite", async () => {
    const { b, l } = await demarre("track", liste(piste("a"), piste("b")));
    b.ctx.sources[0]!.finir();
    await b.pret();
    expect(l.enCours()?.id).toBe("b");
  });

  it("un morceau seul revient (un deuxième tampon du même fichier n'est pas décodé : il est partagé)", async () => {
    const { b, l } = await demarre("track", liste(piste("seul", { duree: 20 })));
    await b.avancer(20);
    expect(l.enCours()?.id).toBe("seul");
    expect(b.ctx.sources.length).toBeGreaterThan(1);
    expect(b.ctx.decodes).toHaveLength(1);
    expect(l.etat().tampons).toEqual(["seul"]);
  });
});

describe("la mémoire : au plus deux morceaux décodés (lot S2)", () => {
  it("pendant dix minutes de musique, avec fondus, « suivant » et changements de scène : jamais plus de deux tampons ni de deux lectures à la fois", async () => {
    const L = liste(
      piste("a", { duree: 60, scenes: ["menu", "theme:nuit"] }),
      piste("b", { duree: 60, scenes: ["theme:nuit"] }),
      piste("c", { duree: 60, scenes: ["theme:nuit"] }),
      piste("d", { duree: 60, scenes: ["theme:stade"] }),
      piste("e", { duree: 60, scenes: ["theme:stade"] }),
    );
    const b = banc("track", L, { hasard: [0.1, 0.4, 0.8, 0.3, 0.6, 0.9, 0.2, 0.5, 0.7] });
    const l = creerLecteur(b.deps);
    l.scene("theme:nuit");
    await b.pret();
    let pic = 0;
    const regarder = () => {
      pic = Math.max(pic, l.etat().tampons.length);
      expect(l.etat().tampons.length).toBeLessThanOrEqual(TAMPONS_MAX);
      expect(b.ctx.sources.filter((s) => s.joue).length).toBeLessThanOrEqual(2);
    };
    for (let seconde = 0; seconde < 600; seconde += 0.25) {
      await b.avancer(0.25);
      regarder();
      if (seconde === 100) { l.suivante(); await b.pret(); regarder(); }
      if (seconde === 200) { l.scene("theme:stade"); await b.pret(); regarder(); }
      if (seconde === 201) { l.scene("theme:nuit"); await b.pret(); regarder(); } // une scène qui change pendant le fondu de la précédente
      if (seconde === 300) { l.suivante(); l.suivante(); await b.pret(); regarder(); }
      if (seconde === 400) { l.scene("menu"); await b.pret(); regarder(); }
    }
    expect(pic).toBe(2);
    expect(l.enCours()).not.toBeNull();
  });

  it("un morceau lâché (fondu fini) est retiré de la mémoire du lecteur ; « arrêter » lâche tout", async () => {
    const { b, l } = await demarre("track", liste(piste("a"), piste("b")));
    await b.avancer(118);
    expect(l.enCours()?.id).toBe("b");
    expect(l.etat().tampons).toEqual(["a", "b"]);
    b.attente.filter((a) => a.ms > FONDU_S * 1000 - 1).forEach((a) => a.fn());
    expect(l.etat().tampons).toEqual(["b"]);
    l.arreter();
    expect(l.etat().tampons).toEqual([]);
    expect(b.ctx.sources.every((s) => !s.joue)).toBe(true);
  });
});

describe("le réseau et le décodage qui échouent", () => {
  it("le suivant ne se charge pas : le morceau en cours continue, le préchargement est retenté plus tard ; le fondu se fait quand il arrive", async () => {
    const { b, l } = await demarre("track", liste(piste("a"), piste("b")));
    b.etat.echecs.add("/musique/b-abcd1234.m4a");
    await b.avancer(1);
    expect(l.enCours()?.id).toBe("a");
    expect(l.etat().tampons).toEqual(["a"]); // l'échec ne reste pas en mémoire
    expect(b.etat.telechargements.filter((u) => u.includes("/b-"))).toHaveLength(1);
    await b.avancer(5);
    expect(b.etat.telechargements.filter((u) => u.includes("/b-"))).toHaveLength(1); // pas de nouvel essai avant le délai
    b.etat.echecs.clear();
    b.etat.maintenant += REESSAI_PRECHARGEMENT_MS + 1;
    await b.avancer(1);
    expect(b.etat.telechargements.filter((u) => u.includes("/b-"))).toHaveLength(2);
    expect(l.etat().tampons).toEqual(["a", "b"]);
  });

  it("le suivant est introuvable au moment du fondu : le morceau en cours finit, puis « suivant » ou la fin réessaie", async () => {
    const { b, l } = await demarre("track", liste(piste("a"), piste("b")));
    b.etat.echecs.add("/musique/b-abcd1234.m4a");
    await b.avancer(119.75);
    expect(l.enCours()?.id).toBe("a");
    b.etat.echecs.clear();
    b.ctx.sources[0]!.finir();
    await b.pret();
    expect(l.enCours()?.id).toBe("b");
  });

  it("le premier morceau ne se charge pas : le lecteur se tait sans lever, « suivant » réessaie", async () => {
    const b = banc("track", liste(piste("a")));
    b.etat.echecs.add("/musique/a-abcd1234.m4a");
    const l = creerLecteur(b.deps);
    await b.pret();
    expect(l.enCours()).toBeNull();
    expect(l.etat().tampons).toEqual([]);
    b.etat.echecs.clear();
    l.suivante();
    await b.pret();
    expect(l.enCours()?.id).toBe("a");
  });
});

describe("le premier geste et les règles des navigateurs", () => {
  it("le lecteur ne demande rien tant qu'il n'est pas créé : liste, morceau et contexte audio n'existent qu'après, et jamais un élément audio", async () => {
    const b = banc("track", DEUX);
    expect(b.etat.requetes).toEqual([]);
    expect(b.etat.telechargements).toEqual([]);
    expect(b.ctx.sources).toEqual([]);
    expect(b.ecouteursDe("fenetre", "click")).toBe(0);
    creerLecteur(b.deps);
    await b.pret();
    expect(b.etat.requetes).toEqual(["/musique/liste.json"]);
    expect(b.etat.telechargements).toHaveLength(1);
    expect(b.ctx.sources).toHaveLength(1);
    expect(Object.keys(b.deps).sort()).not.toContain("creerAudio"); // lot S2 : plus d'élément média
  });

  it("un contexte suspendu (pas de geste valide) : la musique attend, chaque geste le réveille, puis les écouteurs de geste partent", async () => {
    const b = banc("track", DEUX);
    b.ctx.resume = async () => undefined; // le navigateur refuse tant qu'il n'y a pas de vrai geste
    const l = creerLecteur(b.deps);
    await b.pret();
    expect(b.ecouteursDe("fenetre", "touchend")).toBe(1);
    expect(l.etat().joue).toBe(false);
    b.ctx.resume = async function (this: typeof b.ctx) { this.state = "running"; };
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

  it("une liste vide (aucun morceau pour ce jeu) : ni contexte, ni lecture, rien ne joue", async () => {
    const { b, l } = await demarre("portail", DEUX.pistes.length ? liste(piste("a", { jeux: ["track"] })) : DEUX);
    expect(b.ctx.sources).toEqual([]);
    expect(b.ctx.gains).toEqual([]);
    expect(b.etat.telechargements).toEqual([]);
    expect(l.etat().active).toBe(false);
  });

  it("une réponse qui n'est pas une liste (page d'erreur, JSON d'une autre version) : le lecteur se tait sans lever", async () => {
    for (const contenu of ["<html>", { version: 2, pistes: [] }, null]) {
      const { b, l } = await demarre("track", contenu);
      expect(b.ctx.sources).toEqual([]);
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
  it("l'onglet passe en arrière-plan : le contexte se suspend (son horloge, donc la position du morceau, s'arrête) ; au retour la musique reprend là où elle en était", async () => {
    const { b, l } = await demarre();
    await b.avancer(5);
    b.etat.cachee = true;
    b.emettre("document", "visibilitychange");
    expect(b.ctx.suspendus).toBe(1);
    expect(l.etat().enPause).toBe(true);
    expect(b.ctx.sources[0]!.joue).toBe(true); // la lecture n'est pas coupée : elle attend, au même endroit
    b.etat.cachee = false;
    b.emettre("document", "visibilitychange");
    expect(b.ctx.state).toBe("running");
    expect(b.ctx.repris).toBeGreaterThan(0);
    expect(l.etat().enPause).toBe(false);
    expect(l.enCours()?.id).toBe("a");
  });

  it("en arrière-plan, la position est gardée pour la reprise", async () => {
    const { b } = await demarre();
    await b.avancer(42);
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
    await b.avancer(200); // la surveillance tourne, mais n'enchaîne rien
    expect(l.enCours()!.id).toBe(avant);
    expect(b.ctx.sources).toHaveLength(1);
  });
});

describe("la reprise au changement de page", () => {
  const sessionAvec = (id: string, t: number, at: number) => new StockageMemoire(new Map([[CLE_REPRISE, ecrireReprise({ id, t, at })]]));

  it("le même morceau est repris là où il en était (même jeu, page suivante)", async () => {
    const { b, l } = await demarre("track", DEUX, { session: sessionAvec("b", 37.5, 999_000), maintenant: 1_000_000 });
    expect(l.enCours()?.id).toBe("b");
    expect(b.ctx.sources[0]!.decalage).toBe(37.5);
  });

  it("de Track à Jump : si le morceau passe aussi dans Jump, il continue au même endroit ; sinon un autre entre en fondu, jamais celui qu'on vient d'entendre", async () => {
    const l2 = liste(piste("a", { jeux: ["track"] }), piste("b", { jeux: ["track", "jump"] }), piste("c", { jeux: ["jump"] }));
    const dansJump = await demarre("jump", l2, { session: sessionAvec("b", 20, 999_500) });
    expect(dansJump.l.enCours()?.id).toBe("b");
    expect(dansJump.b.ctx.sources[0]!.decalage).toBe(20);
    // `a` n'existe pas dans Jump : un autre morceau, en fondu d'entrée, depuis le début.
    const autre = await demarre("jump", l2, { session: sessionAvec("a", 20, 999_500) });
    expect(autre.l.enCours()?.id).not.toBe("a");
    expect(autre.b.ctx.sources[0]!.decalage).toBe(0);
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
    await b.avancer(11.75);
    b.etat.maintenant += 2000; // la position n'est notée qu'une fois par seconde
    await b.avancer(0.25);
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
    expect(lireReglages(null)).toEqual({ volume: 0.8, coupee: false });
    expect(lireReglages("pas du json")).toEqual({ volume: 0.8, coupee: false });
    expect(lireReglages(JSON.stringify({ volume: 9, coupee: "oui" }))).toEqual({ volume: 1, coupee: false });
  });

  it("le niveau final : coupée ou en sourdine = 0 ; la baisse du jeu et le volume s'appliquent ; le niveau ne dépasse jamais celui du morceau préparé", () => {
    const r = { volume: 1, coupee: false };
    expect(niveauFinal({ reglages: r, baisse: 1, sourdine: false })).toBeLessThanOrEqual(1);
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
    expect(l.reglages()).toEqual({ volume: 0.8, coupee: false });
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

describe("les scènes : un morceau par menu et par thème", () => {
  const L = liste(
    piste("accueil", { scenes: ["menu"] }),
    piste("nuit", { scenes: ["theme:nuit"] }),
    piste("stade", { scenes: ["theme:stade"] }),
    piste("partout"),
    piste("deux", { scenes: ["theme:nuit", "theme:stade"] }),
  );

  it("les morceaux d'une scène : ceux qui la nomment, sinon ceux qui passent partout, sinon aucun ; sans scène : tous", () => {
    const ids = (s: string | null) => pistesDeLaScene(L.pistes, s).map((p) => p.id);
    expect(ids("menu")).toEqual(["accueil"]);
    expect(ids("theme:nuit")).toEqual(["nuit", "deux"]);
    expect(ids("theme:ville")).toEqual(["partout"]); // aucun morceau pour la ville : celui qui passe partout
    expect(ids(null)).toEqual(["accueil", "nuit", "stade", "partout", "deux"]);
    expect(pistesDeLaScene(liste(piste("a", { scenes: ["menu"] })).pistes, "theme:nuit")).toEqual([]); // rien pour le thème, rien qui passe partout : le silence
  });

  it("le jeu annonce la scène avant le premier geste : le lecteur démarre sur un morceau de cette scène, et jamais un autre", async () => {
    for (const [sceneJeu, attendu] of [["menu", ["accueil"]], ["theme:stade", ["stade", "deux"]]] as const) {
      const b = banc("track", L);
      const l = creerLecteur(b.deps);
      l.scene(sceneJeu); // dit tout de suite, avant que la liste soit chargée
      await b.pret();
      expect(attendu, sceneJeu).toContain(l.enCours()!.id);
      expect(l.etat().scene).toBe(sceneJeu);
    }
  });

  it("changer de scène : fondu vers un morceau de la nouvelle scène ; si le morceau en cours y passe aussi, il continue", async () => {
    const b = banc("track", L, { hasard: [0, 0, 0] });
    const l = creerLecteur(b.deps);
    l.scene("menu");
    await b.pret();
    expect(l.enCours()!.id).toBe("accueil");
    l.scene("theme:nuit");
    await b.pret();
    expect(["nuit", "deux"]).toContain(l.enCours()!.id);
    expect(b.ctx.gains.filter((g) => g.gain.courbes().length > 0).length).toBe(2); // un fondu sortant, un fondu entrant
    expect(b.ctx.gains.flatMap((g) => g.gain.courbes()).map((c) => c[3])).toContain(FONDU_SCENE_S);
    // « deux » passe dans la nuit et dans le stade : en passant de l'un à l'autre il continue sans coupure.
    for (let i = 0; i < 6 && l.enCours()!.id !== "deux"; i++) {
      l.suivante();
      await b.pret();
    }
    if (l.enCours()!.id === "deux") {
      const lectures = b.ctx.sources.length;
      l.scene("theme:stade");
      await b.pret();
      expect(l.enCours()!.id).toBe("deux");
      expect(b.ctx.sources.length).toBe(lectures);
    }
  });

  it("une scène sans aucun morceau : le morceau en cours sort en fondu puis se tait ; la scène suivante relance", async () => {
    const b = banc("track", liste(piste("accueil", { scenes: ["menu"] })));
    const l = creerLecteur(b.deps);
    l.scene("menu");
    await b.pret();
    expect(l.enCours()?.id).toBe("accueil");
    l.scene("theme:nuit");
    b.attente.filter((a) => a.ms > 1000).forEach((a) => a.fn());
    expect(l.enCours()).toBeNull();
    expect(b.ctx.sources.every((s) => !s.joue)).toBe(true);
    expect(l.etat().tampons).toEqual([]);
    l.scene("menu");
    await b.pret();
    expect(l.enCours()?.id).toBe("accueil");
  });

  it("la reprise d'une page à l'autre ne reprend que le morceau de la scène : l'accueil d'un jeu ne rejoue pas la musique d'un niveau", async () => {
    const session = new StockageMemoire(new Map([[CLE_REPRISE, ecrireReprise({ id: "nuit", t: 30, at: 999_500 })]]));
    const b = banc("track", L, { session, maintenant: 1_000_000 });
    const l = creerLecteur(b.deps);
    l.scene("menu");
    await b.pret();
    expect(l.enCours()!.id).toBe("accueil");
    const session2 = new StockageMemoire(new Map([[CLE_REPRISE, ecrireReprise({ id: "nuit", t: 30, at: 999_500 })]]));
    const b2 = banc("track", L, { session: session2, maintenant: 1_000_000 });
    const l2 = creerLecteur(b2.deps);
    l2.scene("theme:nuit");
    await b2.pret();
    expect(l2.enCours()!.id).toBe("nuit");
    expect(b2.ctx.sources[0]!.decalage).toBe(30);
  });

  it("sans scène annoncée (un scénario d'essai) : tous les morceaux du jeu", async () => {
    const b = banc("track", L);
    const l = creerLecteur(b.deps);
    await b.pret();
    expect(l.etat().pistes.length).toBe(5);
    expect(l.etat().scene).toBeNull();
  });

  it("un changement de scène pendant la pause attend le retour de l'onglet", async () => {
    const b = banc("track", L);
    const l = creerLecteur(b.deps);
    l.scene("menu");
    await b.pret();
    b.etat.cachee = true;
    b.emettre("document", "visibilitychange");
    l.scene("theme:stade");
    await b.pret();
    expect(l.enCours()!.id).toBe("accueil");
    b.etat.cachee = false;
    b.emettre("document", "visibilitychange");
    await b.pret();
    expect(["stade", "deux"]).toContain(l.enCours()!.id);
  });

  it("la scène change pendant que le premier morceau se charge : le morceau arrivé est lâché, et un morceau de la nouvelle scène prend sa place", async () => {
    const b = banc("track", L);
    b.etat.retenir = true;
    const l = creerLecteur(b.deps);
    l.scene("menu");
    await b.pret();
    expect(l.enCours()).toBeNull(); // le téléchargement est en route
    l.scene("theme:stade"); // le jeu a changé de scène entre-temps
    await b.livrer(); // le morceau du menu arrive : il n'est plus de la scène
    await b.livrer(); // celui du stade
    expect(["stade", "deux"]).toContain(l.enCours()!.id);
    expect(l.etat().tampons.length).toBeLessThanOrEqual(2);
    expect(b.ctx.sources.filter((s) => s.joue)).toHaveLength(1);
  });
});
