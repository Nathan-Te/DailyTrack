import { describe, expect, it } from "vitest";
import { creerCouche } from "../src/couche";
import { creerLecteur } from "../src/lecteur";
import { CLE_REPRISE, COUCHE_ECART_MAX_S, COUCHE_LECTURES, GAMMES, ecrireReprise, arpegeDeMesure, debutMesure, ecartHorloge, etincelle, hzDeMidi, mesureSec, nappeTenue } from "../src/logique";
import { FauxContexte, banc, liste, piste, StockageMemoire, type Banc } from "./faux";

// La couche du jeu (lot B6) : un arpège calé sur la boucle, ou, quand l'horloge du flux n'est pas assez régulière, une nappe sans pulsation. Tout est essayé sur des faux (horloges que le test fait avancer).
// Lot S2 : le lecteur lit la position du morceau sur l'horloge du contexte (Web Audio), donc, dans le lecteur, l'écart « flux − contexte » ne varie pas et l'arpège est calé ; la nappe et le recalage
// sur un flux irrégulier sont essayés sur la couche seule (`creerCouche`), avec un flux que le test fait sauter.

describe("la logique de la couche (pure)", () => {
  it("la mesure dure quatre temps ; le calage trouve le début de la mesure la plus proche, avance ou retard compris", () => {
    expect(mesureSec(120)).toBe(2);
    // L'horloge du flux dit 5,5 s quand celle du contexte dit 13,5 s ; la mesure de 90 BPM (2,667 s) commence à 5,333 s du fichier, donc à 13,333 s du contexte.
    expect(debutMesure(13.55, 5.5, 13.5, 90)).toBeCloseTo(13.3333, 3);
    // Le flux a pris 30 ms d'avance : la mesure suivante commence 30 ms plus tôt sur l'horloge du contexte.
    expect(debutMesure(16, 7.53, 15.5, 90)).toBeCloseTo(15.97, 6);
    // Un flux en retard de 30 ms : 30 ms plus tard.
    expect(debutMesure(16, 7.47, 15.5, 90)).toBeCloseTo(16.03, 6);
    // Jamais plus d'une demi-mesure d'écart avec ce qu'on visait.
    for (let c = 0; c < 20; c += 0.37) expect(Math.abs(debutMesure(30, c, 10, 100) - 30)).toBeLessThanOrEqual(mesureSec(100) / 2 + 1e-9);
  });

  it("l'arpège : huit croches à contretemps, tonique, quinte et octave seulement, deux motifs qui alternent, tout est audible mais discret", () => {
    const a = arpegeDeMesure(48, 90, 0);
    const b = arpegeDeMesure(48, 90, 1);
    expect(a).toHaveLength(8);
    const pas = mesureSec(90) / 8;
    a.forEach((n, i) => expect(n.dt).toBeCloseTo(i * pas + pas / 2, 9));
    expect(a.every((n) => n.dt > 0 && n.dt < mesureSec(90))).toBe(true);
    for (const n of [...a, ...b]) expect([0, 7, 12, 19]).toContain(n.midi - 60);
    expect(a.map((n) => n.midi)).not.toEqual(b.map((n) => n.midi));
    expect(arpegeDeMesure(48, 90, 2)).toEqual(a);
    for (const n of a) expect(n.gain).toBeLessThanOrEqual(0.05);
  });

  it("la nappe : tonique et quinte tenues, des étincelles aiguës sur les degrés de la gamme du morceau, à des instants variables", () => {
    expect(nappeTenue(48)).toEqual([60, 67]);
    expect(etincelle(48, "maj", 0, 0.9)).toMatchObject({ midi: 72 });
    expect(etincelle(48, "maj", 0.5, 0.9).midi).toBe(72 + GAMMES.maj![1]!);
    expect(etincelle(48, "phr", 0.5, 0.9).midi).toBe(72 + 1); // la seconde du phrygien est mineure
    expect(etincelle(48, "inconnue", 0.99, 0.9).midi).toBe(72 + 7); // une gamme inconnue : majeure
    expect(etincelle(48, "maj", 0, 0.1).midi).toBe(84); // l'octave au-dessus, parfois
    expect(etincelle(48, "maj", 0, 0).attente).toBeLessThan(etincelle(48, "maj", 0, 0.99).attente);
  });

  it("l'écart de l'horloge : nul pour un flux régulier, grand pour un flux par bonds, infini sans lecture", () => {
    expect(ecartHorloge([-8, -8, -8])).toBe(0);
    expect(ecartHorloge([-8, -7.95, -8.01])).toBeGreaterThan(COUCHE_ECART_MAX_S);
    expect(ecartHorloge([])).toBe(Infinity);
  });
});

const BLOCKS = liste(piste("b1", { jeux: ["blocks"], bpm: 90, tonique: 48, gamme: "maj", duree: 100 }));

/** Un lecteur de Blocks qui joue `liste` : le premier geste a eu lieu, le morceau a commencé à 2 s du fichier (reprise d'une page à l'autre : le fichier est à 2 s quand le contexte dit 10 s). */
async function joue(contenu: unknown = BLOCKS): Promise<{ b: Banc; l: ReturnType<typeof creerLecteur> }> {
  const session = new StockageMemoire(new Map([[CLE_REPRISE, ecrireReprise({ id: "b1", t: 2, at: 999_900 })]]));
  const b = banc("blocks", contenu, { session });
  const l = creerLecteur(b.deps);
  await b.pret();
  b.emettre("fenetre", "pointerdown");
  await b.pret();
  return { b, l };
}
/** `n` lectures de la position du morceau, une toutes les 250 ms. Finit à ctx 13,5 s / position 5,5 s (la première lecture est à ctx 10 s). */
async function lectures(b: Banc, n: number): Promise<void> {
  b.surveiller();
  await b.avancer(0.25 * (n - 1));
}
/** Fait sonner le prochain pas de la boucle de la couche (125 ms). */
function pas(b: Banc): void {
  const i = b.attente.findIndex((a) => a.ms === 125);
  expect(i, "la boucle de la couche tourne").toBeGreaterThanOrEqual(0);
  b.attente.splice(i, 1)[0]!.fn();
}
const triangles = (b: Banc) => b.ctx.oscillateurs.filter((o) => o.type === "triangle");

describe("la couche dans le lecteur : un arpège calé sur la boucle", () => {
  it("rien n'est synthétisé tant que le jeu ne la demande pas, même quand le morceau a sa tonalité", async () => {
    const { b } = await joue();
    await lectures(b, COUCHE_LECTURES + 2);
    expect(b.ctx.oscillateurs).toHaveLength(0);
    expect(b.attente.some((a) => a.ms === 125)).toBe(false);
  });

  it("entrée : un fondu d'environ 1 s ; les notes tombent sur la grille de la mesure du morceau (à la milliseconde près), à contretemps", async () => {
    const { b, l } = await joue();
    await lectures(b, COUCHE_LECTURES + 3); // ctx 13,5 s, flux 5,5 s : la mesure de 2,667 s a commencé à 5,333 s du fichier (ctx 13,333 s)
    l.couche(true);
    const porte = b.ctx.gains.at(-1)!;
    expect(porte.gain.appels.find((a) => a[0] === "cible")).toEqual(["cible", 1, 13.5, expect.closeTo(1 / 3, 9)]);
    pas(b);
    const debuts = triangles(b).map((o) => o.debut!);
    expect(debuts.length).toBeGreaterThan(0);
    const pasS = mesureSec(90) / 8;
    // La mesure commence à ctx 13,3333 : ses notes sont à 13,3333 + pas/2 + i × pas, et seules celles qui ne sont pas passées sont jouées.
    for (const t of debuts) {
      const k = (t - 13.33333333 - pasS / 2) / pasS;
      expect(Math.abs(k - Math.round(k)) * pasS, `note à ${t}`).toBeLessThan(0.001);
      expect(t).toBeGreaterThanOrEqual(13.5);
    }
    // Tonique, quinte, octave (et la quinte de l'octave) : do₄, sol₄, do₅, sol₅.
    const demiTons = new Set(triangles(b).map((o) => Math.round(Math.log2(o.hz / hzDeMidi(60)) * 12)));
    for (const d of demiTons) expect([0, 7, 12, 19]).toContain(d);
    expect(demiTons.size).toBeGreaterThanOrEqual(3);
  });

  it("sortie : un fondu d'environ 1 s, la nappe éventuelle s'arrête ensuite, et plus aucune note n'est programmée", async () => {
    const { b, l } = await joue();
    await lectures(b, COUCHE_LECTURES + 3);
    l.couche(true);
    pas(b);
    l.couche(false);
    const porte = b.ctx.gains.at(-1)!;
    expect(porte.gain.appels.filter((a) => a[0] === "cible").at(-1)![1]).toBe(0);
    const avant = b.ctx.oscillateurs.length;
    expect(b.attente.some((a) => a.ms === 125)).toBe(true);
    pas(b); // la boucle en cours se termine sans rien programmer
    expect(b.ctx.oscillateurs).toHaveLength(avant);
    expect(b.attente.some((a) => a.ms === 125)).toBe(false);
  });

  it("une couche demandée avant le chargement du lecteur entre dès qu'il est prêt", async () => {
    const b = banc("blocks", BLOCKS);
    const l = creerLecteur(b.deps);
    l.couche(true); // la liste n'est pas encore chargée
    await b.pret();
    expect(b.ctx.gains.at(-1)!.gain.appels.some((a) => a[0] === "cible" && a[1] === 1)).toBe(true);
  });
});

/** La couche seule, sur un contexte et un flux que le test pilote : le flux dit `flux.t` (secondes du fichier) quand le contexte dit `ctx.currentTime`. */
function seule() {
  const ctx = new FauxContexte();
  const bus = ctx.createGain();
  const flux = { t: 2 };
  const attente: { ms: number; fn: () => void }[] = [];
  const couche = creerCouche({
    ctx,
    bus,
    piste: () => piste("b1", { jeux: ["blocks"], bpm: 90, tonique: 48, gamme: "maj", duree: 100 }),
    flux: () => ({ genre: 1, t: flux.t }),
    audible: () => true,
    hasard: () => 0.5,
    planifier: (ms, fn) => void attente.push({ ms, fn }),
  });
  /** Une lecture toutes les 250 ms : `ecart(i)` est de combien le flux s'écarte à la lecture i. Finit à ctx 13,5 s / flux 5,5 s. */
  const lire = (n: number, ecart: (i: number) => number = () => 0, depart = (i: number) => 2 + 0.25 * i) => {
    for (let i = 0; i < n; i++) {
      ctx.currentTime = 10 + 0.25 * i;
      flux.t = depart(i) + ecart(i);
      couche.lire(1, flux.t - ctx.currentTime, flux.t);
    }
  };
  const pas = () => {
    const i = attente.findIndex((a) => a.ms === 125);
    expect(i, "la boucle de la couche tourne").toBeGreaterThanOrEqual(0);
    attente.splice(i, 1)[0]!.fn();
  };
  return { ctx, couche, flux, lire, pas, triangles: () => ctx.oscillateurs.filter((o) => o.type === "triangle") };
}

describe("la couche : la nappe, quand le calage n'est pas tenable (un flux dont l'horloge saute)", () => {
  it("un flux lu par bonds (50 ms) donne une nappe : deux sons tenus et des étincelles, pas un seul arpège", () => {
    const c = seule();
    c.lire(COUCHE_LECTURES + 3, (i) => (i % 2 ? 0.05 : 0));
    c.couche.regler(true);
    c.pas();
    expect(c.triangles()).toHaveLength(0);
    const sines = c.ctx.oscillateurs.filter((o) => o.type === "sine");
    expect(sines.slice(0, 2).map((o) => Math.round(o.hz))).toEqual([Math.round(hzDeMidi(60)), Math.round(hzDeMidi(67))]);
    expect(sines.length).toBeGreaterThan(2); // + au moins une étincelle
    // Aucune grille : les étincelles ne sont pas sur les temps du morceau et ne dépendent pas du flux.
  });

  it("tant qu'il n'y a pas assez de lectures, la couche est une nappe (prudence) ; ensuite, avec un flux régulier, l'arpège prend le relais", () => {
    const c = seule();
    c.lire(3);
    c.couche.regler(true);
    c.pas();
    expect(c.triangles()).toHaveLength(0);
    expect(c.ctx.oscillateurs.length).toBeGreaterThan(0);
    c.lire(COUCHE_LECTURES + 3);
    c.ctx.currentTime = 13.5;
    c.pas();
    expect(c.triangles().length).toBeGreaterThan(0);
  });

  it("recalage à chaque mesure : le flux prend 12 ms d'avance (sous le seuil des 20 ms), la mesure suivante les suit", () => {
    const c = seule();
    c.lire(COUCHE_LECTURES + 3);
    c.couche.regler(true);
    c.pas();
    const avant = c.triangles().length;
    // Deux secondes passent : ctx 15,5 s ; le flux, lui, dit 7,512 s au lieu de 7,5 s (+12 ms d'avance sur le contexte). La mesure suivante était visée à 16 s.
    c.ctx.currentTime = 15.5;
    c.flux.t = 7.512;
    c.pas();
    const nouvelles = c.triangles().slice(avant);
    expect(nouvelles.length).toBe(8);
    const debut = nouvelles[0]!.debut! - mesureSec(90) / 16;
    expect(Math.abs(debut - 15.988)).toBeLessThan(0.001); // sur la grille de l'horloge du flux, pas sur celle qu'on avait visée (16 s)
    expect(Math.abs(debut - 16)).toBeGreaterThan(0.01);
  });

  it("les premières secondes du flux (mise en mémoire) ne comptent pas dans la mesure de son horloge", () => {
    const c = seule();
    c.lire(COUCHE_LECTURES + 3, () => 0, (i) => (i < 3 ? 0.5 + i * 0.1 : 2 + 0.25 * i)); // trois lectures chaotiques sous 1 s
    c.couche.regler(true);
    c.pas();
    expect(c.triangles().length).toBeGreaterThan(0);
  });
});

describe("la couche dans le lecteur : l'horloge est celle du contexte, donc l'arpège est calé", () => {
  it("la position du morceau suit l'horloge du contexte : après les premières lectures, l'arpège joue, jamais la nappe", async () => {
    const { b, l } = await joue();
    await lectures(b, COUCHE_LECTURES + 3);
    l.couche(true);
    pas(b);
    expect(triangles(b).length).toBeGreaterThan(0);
    expect(b.ctx.oscillateurs.filter((o) => o.type === "sine")).toHaveLength(0);
  });

  it("tant que le lecteur n'a pas eu assez de lectures, la couche est une nappe (prudence)", async () => {
    const { b, l } = await joue();
    await lectures(b, 3);
    l.couche(true);
    pas(b);
    expect(triangles(b)).toHaveLength(0);
    expect(b.ctx.oscillateurs.length).toBeGreaterThan(0);
  });
});

describe("la couche dans le lecteur : les réglages et les cas où elle se tait", () => {
  const demande = async (contenu: unknown = BLOCKS) => {
    const { b, l } = await joue(contenu);
    await lectures(b, COUCHE_LECTURES + 3);
    return { b, l };
  };

  it("« Couper la musique » : rien n'est synthétisé ; le volume à zéro, le muet du jeu et la page cachée aussi", async () => {
    for (const regle of [
      (l: ReturnType<typeof creerLecteur>) => l.regler({ coupee: true }),
      (l: ReturnType<typeof creerLecteur>) => l.regler({ volume: 0 }),
      (l: ReturnType<typeof creerLecteur>) => l.sourdine(true),
      (l: ReturnType<typeof creerLecteur>) => l.baisser(0),
    ]) {
      const { b, l } = await demande();
      regle(l);
      l.couche(true);
      pas(b);
      expect(b.ctx.oscillateurs).toHaveLength(0);
    }
    const { b, l } = await demande();
    l.couche(true);
    b.etat.cachee = true;
    pas(b);
    expect(b.ctx.oscillateurs).toHaveLength(0);
    b.etat.cachee = false;
    pas(b);
    expect(b.ctx.oscillateurs.length).toBeGreaterThan(0);
  });

  it("elle passe par le bus du lecteur : volume, baisse du jeu et « couper » la touchent comme le morceau", async () => {
    const { b, l } = await demande();
    l.couche(true);
    const bus = b.ctx.gains[0]!; // le premier gain du lecteur est son bus
    const porte = b.ctx.gains.at(-1)!; // le dernier créé : la porte de la couche
    expect(porte.vers).toContain(bus);
    pas(b);
    // Chaque note passe par sa propre enveloppe, puis par la porte : donc par le bus.
    expect((b.ctx.oscillateurs[0]!.vers[0] as { vers: unknown[] }).vers).toContain(porte);
  });

  it("un morceau sans tempo ni tonique (Track, Jump, Tower) n'a pas de couche : rien n'est synthétisé", async () => {
    const { b, l } = await demande(liste(piste("sans", { jeux: ["blocks"] })));
    l.couche(true);
    pas(b);
    expect(b.ctx.oscillateurs).toHaveLength(0);
  });
});

describe("baisser(niveau, duree) : le fondu de niveau (lot B6)", () => {
  const cibles = (b: Banc) => b.ctx.gains[0]!.gain.appels.filter((a) => a[0] === "cible");

  it("sans durée, le niveau change en 60 ms comme avant ; avec une durée, la constante de temps est le tiers de la durée (95 % atteints à la fin)", async () => {
    const { b, l } = await joue();
    l.baisser(0.5);
    expect(cibles(b).at(-1)![3]).toBe(0.06);
    l.baisser(0.35, 1.2);
    expect(cibles(b).at(-1)![3]).toBeCloseTo(0.4, 9);
    l.baisser(1, 1.5);
    expect(cibles(b).at(-1)![3]).toBeCloseTo(0.5, 9);
    expect(cibles(b).at(-1)![1] as number).toBeGreaterThan(cibles(b).at(-2)![1] as number);
  });

  it("le même niveau redemandé ne fait rien (un jeu peut le dire à chaque image) ; un réglage du joueur pendant le fondu reprend la main en 60 ms", async () => {
    const { b, l } = await joue();
    l.baisser(0.35, 1.2);
    const n = cibles(b).length;
    l.baisser(0.35, 1.2);
    expect(cibles(b)).toHaveLength(n);
    l.regler({ volume: 0.5 });
    expect(cibles(b).at(-1)![3]).toBe(0.06);
  });
});
