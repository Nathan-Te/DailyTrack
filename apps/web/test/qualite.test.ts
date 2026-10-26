import { describe, expect, it } from "vitest";
import { CHOIX_GRAPHISMES, NIVEAU_DU_CHOIX, POST_DANS_AUTO, VALIDITE_MS, chaineAuChargement, depart, lireMemoire, memoireValable, palierAuChargement, passesPermises, postVoulu, type Appareil, type MemoireQualite } from "../src/qualite";
import { DESCENDRE_MS, ECARTEES, FENETRE_COURSE_MS, INTERVALLES, MONTER_MS, MesureImages, SerieMesures, SurveillanceCourse, apresMesure, descenteCourse, frequenceEcran, mediane, memoireNeuve, seuils, verdict } from "../src/qualiteMesure";
import { DEFAULT_SETTINGS, parseSettings } from "../src/settings";

// Lot 45 : la règle de qualité automatique (38b, § 5) et le réglage « Qualité graphique ». Des médianes simulées ; le vrai jeu : `e2e/qualite.spec.ts`.

const TELEPHONE: Appareil = { ordinateur: false, logiciel: false, demiFlottants: true, memoire: 8 };
const ORDINATEUR: Appareil = { ordinateur: true, logiciel: false, demiFlottants: true, memoire: 8 };
const LOGICIEL: Appareil = { ordinateur: true, logiciel: true, demiFlottants: true };
const JOUR = 86_400_000;
const T0 = Date.UTC(2026, 9, 20, 12);
const PIX = 2340 * 1080;

/** Une série de mesures jusqu'au bout, avec ces médianes (à 60 Hz) : les paliers mesurés et la mémoire gardée. */
function serie(a: Appareil, medianes: number[], avant: MemoireQualite | null = null) {
  let m = memoireNeuve(palierAuChargement(a, avant, T0, PIX).palier, T0, PIX, avant);
  const paliers: number[] = [];
  for (const med of medianes) {
    paliers.push(m.palier);
    const r = apresMesure(m, med, 60, T0, PIX);
    m = r.memoire;
    if (!r.encore) return { paliers, memoire: m, fini: true };
  }
  return { paliers, memoire: m, fini: false };
}

describe("lot 45 : points de départ et garde-fous", () => {
  it("téléphone : palier 2 ; ordinateur : palier 3 ; rendu logiciel (ou navigateur piloté) : palier 1, sans mesure", () => {
    expect(depart(TELEPHONE)).toBe(2);
    expect(depart(ORDINATEUR)).toBe(3);
    expect(depart(LOGICIEL)).toBe(1);
    expect(palierAuChargement(LOGICIEL, null, T0, PIX)).toEqual({ palier: 1, mesurer: false });
    expect(palierAuChargement(TELEPHONE, null, T0, PIX)).toEqual({ palier: 2, mesurer: true });
    expect(palierAuChargement(ORDINATEUR, null, T0, PIX)).toEqual({ palier: 3, mesurer: true });
  });

  it("passes plein écran (lot 47) : un ordinateur, des demi-flottants rendables, 4 Go au moins ; jamais un téléphone", () => {
    expect(passesPermises(ORDINATEUR)).toBe(true);
    expect(passesPermises({ ...ORDINATEUR, demiFlottants: false })).toBe(false);
    expect(passesPermises({ ...ORDINATEUR, memoire: 2 })).toBe(false);
    expect(passesPermises({ ...ORDINATEUR, memoire: undefined })).toBe(true); // non annoncé (Firefox, Safari) : la mesure décidera
    expect(passesPermises(TELEPHONE)).toBe(false);
    expect(passesPermises(LOGICIEL)).toBe(false);
  });

  it("lot 47b : le post-traitement seulement sur « Maximale » (jamais en Auto, même au palier 3 mesuré ou mémorisé)", () => {
    expect(postVoulu("auto", ORDINATEUR)).toBe(false);
    expect(postVoulu("equilibree", ORDINATEUR)).toBe(false);
    expect(postVoulu("maximale", ORDINATEUR)).toBe(true);
    expect(postVoulu("maximale", { ...ORDINATEUR, demiFlottants: false })).toBe(false);
    expect(postVoulu("maximale", TELEPHONE)).toBe(false);
    // Une mémoire ancienne (palier 3 en Auto) redonne le palier 3, sans rien de plus.
    const m: MemoireQualite = { palier: 3, date: 1000, mediane: 10, pixels: 1e6, echecs: 0, plafond: null, durable: false };
    expect(palierAuChargement(ORDINATEUR, m, 2000, 1e6).palier).toBe(3);
  });

  it("le réglage : Auto (la règle), Économie 1, Équilibrée 2, Maximale 3 ; mémorisé dans cdj:settings, Auto par défaut", () => {
    expect(CHOIX_GRAPHISMES).toEqual(["auto", "economie", "equilibree", "maximale"]);
    expect(NIVEAU_DU_CHOIX).toEqual({ auto: null, economie: 1, equilibree: 2, maximale: 3 });
    expect(DEFAULT_SETTINGS.graphismes).toBe("auto");
    expect(parseSettings(JSON.stringify({ graphismes: "economie" })).graphismes).toBe("economie");
    expect(parseSettings(JSON.stringify({ graphismes: "ultra" })).graphismes).toBe("auto");
    expect(parseSettings(JSON.stringify({ quality: "low" })).graphismes).toBe("auto"); // un réglage enregistré avant le lot 45
  });
});

describe("lot 45 : la mesure", () => {
  it("on écarte les 30 premières images, puis la médiane de 90 intervalles", () => {
    expect([ECARTEES, INTERVALLES]).toEqual([30, 90]);
    const m = new MesureImages();
    for (let i = 0; i < ECARTEES; i++) expect(m.ajouter(500)).toBe(false); // compilation des programmes : ignorée
    for (let i = 0; i < INTERVALLES - 1; i++) expect(m.ajouter(i % 2 ? 12 : 30)).toBe(false);
    expect(m.ajouter(12)).toBe(true);
    expect(m.intervalles).toHaveLength(90);
    expect(Math.max(...m.intervalles)).toBe(30);
    expect(mediane(m.intervalles)).toBe(21);
    expect(mediane([5, 1, 3])).toBe(3);
  });

  it("seuils à 60 Hz : ≤ 13 ms monter, ≥ 22 ms descendre ; ramenés à la fréquence de l'écran (90, 120 Hz)", () => {
    expect([MONTER_MS, DESCENDRE_MS]).toEqual([13, 22]);
    expect(verdict(13)).toBe("monter");
    expect(verdict(16.7)).toBe("rester");
    expect(verdict(22)).toBe("descendre");
    expect(seuils(120)).toEqual({ monter: 6.5, descendre: 11 });
    // Le Pixel 7 de Nathan (90 Hz) : palier 2 à 11 ms tient, palier 3 à 16 ms descend (vitrine, 22/10/2026).
    expect(verdict(11, 90)).toBe("rester");
    expect(verdict(16, 90)).toBe("descendre");
  });

  it("la fréquence de l'écran se lit sur les intervalles les plus courts ; une scène lourde reste à 60 Hz", () => {
    expect(frequenceEcran(Array(90).fill(16.7))).toBe(60);
    expect(frequenceEcran(Array(90).fill(11.1))).toBe(90);
    expect(frequenceEcran([...Array(60).fill(8.33), ...Array(30).fill(16.7)])).toBe(120);
    expect(frequenceEcran(Array(90).fill(6.94))).toBe(144);
    expect(frequenceEcran(Array(90).fill(40))).toBe(60);
    expect(frequenceEcran([])).toBe(60);
  });
});

describe("lot 45 : la série de mesures (médianes simulées)", () => {
  it("un téléphone qui tient le palier 2 y reste", () => {
    const r = serie(TELEPHONE, [16]);
    expect(r).toMatchObject({ paliers: [2], fini: true });
    expect(r.memoire).toMatchObject({ palier: 2, mediane: 16, plafond: null, durable: false });
  });

  it("un téléphone rapide monte au palier 3 et remesure ; trop lent là-haut, il redescend et ne remonte pas aussitôt", () => {
    expect(serie(TELEPHONE, [10, 16])).toMatchObject({ paliers: [2, 3], fini: true, memoire: { palier: 3 } });
    const r = serie(TELEPHONE, [10, 25, 9]);
    expect(r).toMatchObject({ paliers: [2, 3, 2], fini: true });
    expect(r.memoire).toMatchObject({ palier: 2, plafond: 2, mediane: 9 });
  });

  it("un ordinateur lent descend jusqu'au palier 1 ; deux mesures ratées de suite : on s'en souvient (plafond durable)", () => {
    const r = serie(ORDINATEUR, [30, 25, 40]);
    expect(r).toMatchObject({ paliers: [3, 2, 1], fini: true });
    expect(r.memoire).toMatchObject({ palier: 1, plafond: 1, durable: true });
    // Une semaine plus tard : remesuré, mais jamais au-dessus du plafond durable.
    const plus = palierAuChargement(ORDINATEUR, r.memoire, T0 + VALIDITE_MS + 1, PIX);
    expect(plus).toEqual({ palier: 1, mesurer: true });
    expect(serie(ORDINATEUR, [8], r.memoire)).toMatchObject({ paliers: [1], fini: true, memoire: { palier: 1 } });
  });

  it("une seule mesure ratée : le plafond vaut pour la série, pas pour la remesure de la semaine suivante", () => {
    const r = serie(ORDINATEUR, [30, 16]);
    expect(r.memoire).toMatchObject({ palier: 2, plafond: 2, durable: false });
    expect(palierAuChargement(ORDINATEUR, r.memoire, T0 + VALIDITE_MS + 1, PIX)).toEqual({ palier: 3, mesurer: true });
  });

  it("au palier 1, « descendre » ne descend plus ; au palier 3, « monter » ne monte plus", () => {
    expect(serie(LOGICIEL, [80])).toMatchObject({ paliers: [1], fini: true, memoire: { palier: 1 } });
    expect(serie(ORDINATEUR, [5])).toMatchObject({ paliers: [3], fini: true, memoire: { palier: 3 } });
  });

  it("une mesure interrompue (accueil fermé) ne compte pas ; une série pas finie reprend au palier atteint, avec son plafond", () => {
    const m = memoireNeuve(3, T0, PIX, null);
    expect(apresMesure(m, null, 60, T0, PIX)).toEqual({ memoire: m, encore: true });
    const descendu = apresMesure(m, 30, 60, T0, PIX).memoire; // 3 → 2, pas encore mesuré au palier 2
    expect(descendu).toMatchObject({ palier: 2, mediane: null, plafond: 2 });
    expect(palierAuChargement(ORDINATEUR, descendu, T0 + JOUR, PIX)).toEqual({ palier: 2, mesurer: true });
    expect(memoireNeuve(2, T0 + JOUR, PIX, descendu)).toMatchObject({ palier: 2, plafond: 2, echecs: 1 });
  });
});

describe("lot 45 : cdj:qualite", () => {
  it("mémorisé (palier, date, médiane) ; remesuré après une semaine, ou si l'écran change de taille d'un facteur 1,5", () => {
    const m = serie(TELEPHONE, [16]).memoire;
    const relu = lireMemoire(JSON.stringify(m));
    expect(relu).toEqual(m);
    expect(memoireValable(relu, T0 + 6 * JOUR, PIX)).toBe(true);
    expect(palierAuChargement(TELEPHONE, relu, T0 + 6 * JOUR, PIX)).toEqual({ palier: 2, mesurer: false });
    expect(memoireValable(relu, T0 + 8 * JOUR, PIX)).toBe(false);
    expect(memoireValable(relu, T0, PIX * 1.4)).toBe(true);
    expect(memoireValable(relu, T0, PIX * 1.6)).toBe(false);
    expect(memoireValable(relu, T0, PIX / 1.6)).toBe(false);
    expect(memoireValable(relu, T0 - JOUR, PIX)).toBe(false); // une horloge revenue en arrière
    for (const raw of [null, "", "{", "[]", JSON.stringify({ palier: 4, date: T0, pixels: PIX }), JSON.stringify({ palier: 2 })]) expect(lireMemoire(raw), String(raw)).toBeNull();
    expect(lireMemoire(JSON.stringify({ palier: 2, date: T0, pixels: PIX }))).toEqual({ palier: 2, date: T0, pixels: PIX, mediane: null, echecs: 0, plafond: null, durable: false });
  });

  it("la série du jeu : des intervalles imposés (`?intervalles=30,16`) décident chaque mesure, la mémoire est gardée à chaque décision", () => {
    let memoire: MemoireQualite | null = null;
    const decisions: number[] = [];
    const s = new SerieMesures({ depart: () => 3, memoire: () => memoire, pixels: () => PIX, imposes: [30, 16], decider: (m) => ((memoire = m), decisions.push(m.palier)) });
    let encore = true;
    let images = 0;
    while (encore && images < 1000) {
      expect(s.mesure !== null || images === 0 || decisions.length > 0).toBe(true);
      encore = s.image(1000);
      images++;
    }
    expect(decisions).toEqual([2, 2]);
    expect(memoire).toMatchObject({ palier: 2, mediane: 16 });
    expect(s.derniere).toEqual({ mediane: 16, hz: 60, palier: 2 });
    // Deux mesures complètes : chacune une image pour commencer, 30 écartées, 90 gardées.
    expect(images).toBe(2 * (1 + ECARTEES + INTERVALLES));
  });
});

describe("lot 50 : la règle surveille aussi la course ; le post-traitement dans Auto seulement s'il est prouvé", () => {
  const ordinateur: Appareil = { ordinateur: true, logiciel: false, demiFlottants: true, memoire: 8 };
  const m0: MemoireQualite = { palier: 3, date: 1, mediane: 10, pixels: 2_000_000, echecs: 0, plafond: null, durable: false };

  it("la médiane de 5 s de course au-delà du seuil propose une descente ; en dessous, rien ; une pause recommence la fenêtre", () => {
    const s = new SurveillanceCourse();
    let proposee = false;
    for (let i = 0; i < 400; i++) proposee ||= s.image(16.7);
    expect(proposee, "60 images/s").toBe(false);
    expect(s.derniere).toMatchObject({ hz: 60 });
    expect(s.derniere!.mediane).toBeCloseTo(16.7, 5);
    const lente = new SurveillanceCourse();
    let n = 0;
    while (!lente.image(33.4)) n++;
    expect(n * 33.4, "jugée au bout de 5 s d'images").toBeGreaterThanOrEqual(FENETRE_COURSE_MS - 34);
    expect(lente.derniere!.mediane).toBeCloseTo(33.4, 5); // 30 images/s saccadées : la mesure de Nathan avec la chaîne du lot 47
    const coupee = new SurveillanceCourse();
    for (let i = 0; i < 100; i++) expect(coupee.image(33.4)).toBe(false); // 3,3 s
    coupee.interrompre(); // la pause
    for (let i = 0; i < 100; i++) expect(coupee.image(33.4), "la fenêtre est repartie de zéro").toBe(false);
    expect(new SurveillanceCourse().image(900), "un onglet en pause n'est pas une mesure").toBe(false);
  });

  it("la descente : d'abord la chaîne, puis le palier — mémorisée (le post-traitement refusé, un plafond durable), « trop lourd » pour les Réglages", () => {
    const sansChaine = descenteCourse(m0, { niveau: 3, post: true }, 5, 2_000_000);
    expect(sansChaine).toMatchObject({ palier: 3, sansPost: true, trop: true });
    expect(postVoulu("auto", ordinateur, sansChaine, true), "Auto ne la redonne plus à cet appareil").toBe(false);
    expect(postVoulu("maximale", ordinateur, sansChaine, true), "« Maximale » la garde : choix explicite").toBe(true);
    const p2 = descenteCourse(sansChaine, { niveau: 3, post: false }, 6, 2_000_000);
    expect(p2).toMatchObject({ palier: 2, plafond: 2, durable: true, sansPost: true, trop: true });
    expect(palierAuChargement(ordinateur, p2, 7, 2_000_000).palier, "la remesure ne remonte pas au-dessus").toBeLessThanOrEqual(2);
    expect(descenteCourse(null, { niveau: 1, post: false }, 5, 1).palier, "jamais sous le palier 1").toBe(1);
    // On s'en souvient d'une série de mesures à l'autre.
    expect(memoireNeuve(3, 9, 2_000_000, sansChaine)).toMatchObject({ sansPost: true, trop: true });
    expect(lireMemoire(JSON.stringify(p2))).toMatchObject({ sansPost: true, trop: true });
  });

  it("une mesure ratée avec le post-traitement le retire d'abord (le palier 3 est remesuré sans lui)", () => {
    const r = apresMesure({ ...m0, mediane: null }, 30, 60, 10, 2_000_000, true);
    expect(r).toMatchObject({ encore: true, memoire: { palier: 3, sansPost: true } });
    expect(apresMesure({ ...m0, mediane: null }, 30, 60, 10, 2_000_000, false).memoire.palier, "sans lui : le palier descend").toBe(2);
  });

  it("le post-traitement dans Auto : seulement si POST_DANS_AUTO ; « Maximale » toujours là où il est permis ; le moteur suit", () => {
    expect(postVoulu("auto", ordinateur, null, false)).toBe(false);
    expect(postVoulu("auto", ordinateur, null, true)).toBe(true);
    expect(postVoulu("auto", { ...ordinateur, ordinateur: false }, null, true), "jamais un téléphone").toBe(false);
    expect(postVoulu("auto", ordinateur, null), "la décision du lot (après le rapport du banc)").toBe(POST_DANS_AUTO);
    expect(chaineAuChargement({ adresse: null, choix: "auto", ordinateur: true, memoire: m0, dansAuto: true })).toBe(true);
    expect(chaineAuChargement({ adresse: null, choix: "auto", ordinateur: true, memoire: { ...m0, palier: 2 }, dansAuto: true }), "Auto au palier 2").toBe(false);
    expect(chaineAuChargement({ adresse: null, choix: "auto", ordinateur: true, memoire: { ...m0, sansPost: true }, dansAuto: true }), "refusé par cet appareil").toBe(false);
  });
});
