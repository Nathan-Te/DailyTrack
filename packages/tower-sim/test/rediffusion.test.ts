import { parseDay, pushVarint, toBase64Url } from "@cdj/core";
import { beforeAll, describe, expect, it } from "vitest";
import {
  TOWER_GENERATOR_VERSION,
  type CodeRefusTower,
  COMMANDE,
  type Contenu,
  dailyTower,
  decoderRediffusion,
  empreinteVue,
  encoderRediffusion,
  enregistrer,
  ErreurRediffusion,
  FORMAT_REDIFFUSION,
  MAX_TICKS_JEU,
  MAX_TICKS_REJEU,
  NB_PIECES,
  Partie,
  type PieceKind,
  type Rapier,
  type Rediffusion,
  REGLAGES_DEFAUT,
  rejouer,
  rejouerComplet,
  rejouerParTranches,
  type Scenario,
  SCENARIO_ESSAI,
  ticksRediffusion,
  TICKS_PAR_SECONDE,
  TIRAGES_MAX,
  TOWER_SIM_VERSION,
  VERSIONS_SIM_JOUABLES,
} from "../src";
import { chargerRapier } from "../src/rapier";

// Lot T2 — la rediffusion : aller-retour, chaque refus, et `rejouer` = la partie jouée (même Resultat, même état final, au bit près). Node seulement (règle R13) ; le rejeu des trois
// références dans Chromium, Firefox et WebKit est `apps/tower/e2e/determinisme.spec.ts`.
let R: Rapier;
beforeAll(async () => {
  R = await chargerRapier();
});

const JOUR = parseDay("2026-11-02")!;
const contenuDuJour: Contenu = dailyTower(JOUR);

/** Une partie déterministe : chaque pièce part à gauche ou à droite d'un nombre de demi-cases qui dépend de son numéro, tourne parfois, puis descend. */
function jouerScripte(contenu: Scenario, reglages = REGLAGES_DEFAUT): Partie {
  const p = new Partie(R, contenu, reglages);
  let id = -1;
  let k = 0;
  while (p.etape !== "fini") {
    const v = p.vue();
    if (v.active !== id) {
      id = v.active;
      k = 0;
    }
    const dx = ((v.active * 5 + 2) % 7) - 3;
    let c = 0;
    if (k < Math.abs(dx) * 2 && k % 2 === 0) c |= dx < 0 ? COMMANDE.GAUCHE : COMMANDE.DROITE;
    else if (k === 9 && v.active % 3 === 0) c |= COMMANDE.TOURNER;
    if (k > 14) c |= COMMANDE.DESCENDRE;
    k++;
    p.avancer(v.active >= 0 ? c : 0);
  }
  return p;
}

/** Fabrique le texte d'une rediffusion à la main (octet par octet) pour provoquer chaque refus. */
function octets(o: { format?: number; sim?: number; g?: number; genre?: number; jour?: number; tirage?: number; nom?: string; reglages?: number[]; plages?: [number, number][] }): string {
  const b: number[] = [o.format ?? FORMAT_REDIFFUSION, o.sim ?? TOWER_SIM_VERSION, o.g ?? 1, o.genre ?? 0];
  if ((o.genre ?? 0) === 0) pushVarint(b, o.jour ?? JOUR);
  else if (o.genre === 2) {
    pushVarint(b, o.jour ?? JOUR);
    pushVarint(b, o.tirage ?? 1);
  } else {
    b.push((o.nom ?? "essai").length);
    for (const c of o.nom ?? "essai") b.push(c.charCodeAt(0));
  }
  for (const r of o.reglages ?? [20, 4, 56, 3]) pushVarint(b, r);
  for (const [masque, ticks] of o.plages ?? [[0, 10]]) {
    b.push(masque);
    pushVarint(b, ticks);
  }
  return toBase64Url(b);
}
const refus = (f: () => unknown): CodeRefusTower => {
  try {
    f();
  } catch (e) {
    if (e instanceof ErreurRediffusion) return e.code;
    throw e;
  }
  throw new Error("aucun refus");
};

describe("l'enregistrement et le rejeu", () => {
  it("rejouer = la partie jouée : le même Resultat et le même état final, au bit près (un jour avec paliers, et le scénario d'essai)", () => {
    for (const contenu of [contenuDuJour, SCENARIO_ESSAI]) {
      const jouee = jouerScripte(contenu);
      const code = encoderRediffusion(enregistrer(jouee));
      const r = rejouerComplet(R, contenu, code);
      expect(r.resultat).toEqual(jouee.resultat());
      expect(empreinteVue(r.vue)).toBe(empreinteVue(jouee.vue()));
      expect(rejouer(R, contenu, code)).toEqual(jouee.resultat());
      jouee.dispose();
    }
  });

  it("la rediffusion ne garde que les ticks de la phase de jeu : autant que les ticks du Resultat, sans l'attente de stabilisation", () => {
    const jouee = jouerScripte(contenuDuJour);
    const r = enregistrer(jouee);
    expect(ticksRediffusion(r)).toBe(jouee.resultat()!.ticks);
    expect(jouee.tick).toBeGreaterThan(jouee.resultat()!.ticks - 1);
    expect(r.plages.every((p, i) => p.ticks >= 1 && (i === 0 || r.plages[i - 1]!.masque !== p.masque))).toBe(true); // plages canoniques
    jouee.dispose();
  });

  it("l'en-tête dit le format, TOWER_SIM_VERSION, TOWER_GENERATOR_VERSION, le jour (ou le scénario) et les réglages", () => {
    const jouee = jouerScripte(contenuDuJour, { ...REGLAGES_DEFAUT, vies: 5 });
    const d = decoderRediffusion(encoderRediffusion(enregistrer(jouee)));
    expect(d).toMatchObject({ sim: TOWER_SIM_VERSION, g: TOWER_GENERATOR_VERSION, contenu: { jour: JOUR }, reglages: { vitesseChute8: 20, facteurDescente: 4, hauteurApparition8: 56, vies: 5 } });
    jouee.dispose();
    const e = jouerScripte(SCENARIO_ESSAI);
    expect(decoderRediffusion(encoderRediffusion(enregistrer(e)))).toMatchObject({ sim: TOWER_SIM_VERSION, g: 0, contenu: { scenario: "essai" } });
    e.dispose();
  });

  it("aller-retour : décoder puis encoder rend le même texte, et la rediffusion décodée se rejoue comme la jouée (réglages non standard compris)", () => {
    const reglages = { vitesseChute8: 24, facteurDescente: 6, hauteurApparition8: 48, vies: 4 };
    const jouee = jouerScripte(contenuDuJour, reglages);
    const rec = enregistrer(jouee);
    const code = encoderRediffusion(rec);
    expect(decoderRediffusion(code)).toEqual(rec);
    expect(encoderRediffusion(decoderRediffusion(code))).toBe(code);
    expect(rejouer(R, contenuDuJour, decoderRediffusion(code))).toEqual(jouee.resultat());
    jouee.dispose();
  });

  it("une partie complète de 40 pièces à la chute minimale tient dans la borne, avec de la marge ; chaque tranche rend la main", () => {
    // 40 carrés qui tombent à 2,5 m/s sur la tour, sans jamais descendre : la partie nominale de ≈ 6 700 ticks.
    const contenu: Scenario = { nom: "carres", pieces: Array.from({ length: NB_PIECES }, () => "O" as const), plateformeDemi8: 28 };
    const p = new Partie(R, contenu);
    while (p.etape !== "fini") p.avancer(0);
    const r = enregistrer(p);
    const nominal = NB_PIECES * Math.round(((REGLAGES_DEFAUT.hauteurApparition8 / REGLAGES_DEFAUT.vitesseChute8) * TICKS_PAR_SECONDE) / 1);
    expect(p.resultat()!.posees).toBe(NB_PIECES);
    expect(ticksRediffusion(r)).toBeGreaterThan(nominal * 0.9);
    expect(ticksRediffusion(r)).toBeLessThan(nominal * 1.1);
    expect(MAX_TICKS_JEU).toBeGreaterThanOrEqual(nominal * 2.9); // la borne : ≈ trois parties nominales
    expect(MAX_TICKS_REJEU).toBe(MAX_TICKS_JEU + 300);
    const tranches: number[] = [];
    const g = rejouerParTranches(R, contenu, r, 1000);
    for (;;) {
      const n = g.next();
      if (n.done) {
        expect(n.value.resultat).toEqual(p.resultat());
        break;
      }
      tranches.push(n.value);
    }
    expect(tranches.slice(0, 3)).toEqual([1000, 2000, 3000]);
    expect(tranches.length).toBe(Math.floor(ticksRediffusion(r) / 1000));
    p.dispose();
  });
});

describe("lot T3b — le tirage du contenu dans la rediffusion", () => {
  it("un tirage n ≥ 1 s'écrit en genre 2 et se rejoue au bit près ; le tirage 0 garde l'ancienne forme (genre 0), octet pour octet", () => {
    const c0 = dailyTower(JOUR, 3, 0);
    const c2 = dailyTower(JOUR, 3, 2);
    expect(c2.tirage).toBe(2);
    const jouee = jouerScripte(c2);
    const rec = enregistrer(jouee);
    expect(rec.contenu).toEqual({ jour: JOUR, tirage: 2 });
    const code = encoderRediffusion(rec);
    expect(decoderRediffusion(code)).toEqual(rec);
    expect(encoderRediffusion(decoderRediffusion(code))).toBe(code);
    expect(rejouerComplet(R, c2, code).resultat).toEqual(jouee.resultat());
    jouee.dispose();
    const jouee0 = jouerScripte(c0);
    const rec0 = enregistrer(jouee0);
    expect(rec0.contenu).toEqual({ jour: JOUR }); // le tirage 0 n'est pas nommé
    const octets0 = Array.from(Buffer.from(encoderRediffusion(rec0), "base64url"));
    expect(octets0.slice(0, 4)).toEqual([FORMAT_REDIFFUSION, TOWER_SIM_VERSION, 3, 0]);
    jouee0.dispose();
  });

  it("une rediffusion d'un tirage ne se rejoue que sur ce tirage (contenu_different sur un autre tirage du même jour)", () => {
    const jouee = jouerScripte(dailyTower(JOUR, 3, 1));
    const rec = enregistrer(jouee);
    expect(refus(() => rejouer(R, dailyTower(JOUR, 3, 0), rec))).toBe("contenu_different");
    expect(refus(() => rejouer(R, dailyTower(JOUR, 3, 2), rec))).toBe("contenu_different");
    expect(() => rejouer(R, dailyTower(JOUR, 3, 1), rec)).not.toThrow();
    jouee.dispose();
    const jouee0 = jouerScripte(dailyTower(JOUR, 3, 0));
    expect(refus(() => rejouer(R, dailyTower(JOUR, 3, 1), enregistrer(jouee0)))).toBe("contenu_different");
    jouee0.dispose();
  });

  it("une rediffusion de la version 2 du générateur se rejoue toujours, sur le contenu de la version 2", () => {
    const c = dailyTower(JOUR, 2);
    const jouee = jouerScripte(c);
    const code = encoderRediffusion(enregistrer(jouee));
    expect(decoderRediffusion(code)).toMatchObject({ g: 2, contenu: { jour: JOUR } });
    expect(rejouer(R, c, code)).toEqual(jouee.resultat());
    expect(refus(() => rejouer(R, dailyTower(JOUR), code))).toBe("contenu_different");
    jouee.dispose();
  });
});

describe("lot T6 — deux versions de la simulation, la 3 reste rejouable telle quelle", () => {
  const contenu: Scenario = { nom: "essai", pieces: [..."OOIJL"] as PieceKind[], plateformeDemi8: 28 };
  // Les mêmes commandes, jouées par la version 3 puis par la 4 : deux parties différentes, chacune se rejoue par sa version.
  const jouerV = (version: number): Partie => {
    const p = new Partie(R, contenu, REGLAGES_DEFAUT, { version });
    let id = -1;
    let k = 0;
    while (p.etape !== "fini" && p.tick < 6000) {
      const v = p.vue();
      if (v.active !== id) {
        id = v.active;
        k = 0;
      }
      const c = v.active >= 0 ? ((k > 6 && k < 14 && k % 2 === 0 ? COMMANDE.DROITE : 0) | (k === 2 ? COMMANDE.TOURNER : 0) | COMMANDE.DESCENDRE) : 0;
      k++;
      p.avancer(c);
    }
    return p;
  };

  it("la rediffusion nomme la version de la partie qui l'a jouée (3 ou 4), et le rejeu la joue avec cette version, au bit près", () => {
    for (const version of [3, 4]) {
      const p = jouerV(version);
      const r = enregistrer(p);
      expect(r.sim).toBe(version);
      const code = encoderRediffusion(r);
      expect(decoderRediffusion(code).sim).toBe(version);
      const rejeu = rejouerComplet(R, contenu, code);
      expect(rejeu.resultat).toEqual(p.resultat());
      expect(empreinteVue(rejeu.vue)).toBe(empreinteVue(p.vue()));
      p.dispose();
    }
  });

  it("les deux versions donnent des parties différentes pour les mêmes commandes (la 4 pivote autour de la grille) : la version est bien lue dans l'en-tête, pas devinée", () => {
    const a = jouerV(3);
    const b = jouerV(4);
    expect(empreinteVue(a.vue())).not.toBe(empreinteVue(b.vue()));
    a.dispose();
    b.dispose();
  });

  it("une version que ce code ne joue pas (2, 5) est refusée à la lecture comme au rejeu ; les versions 3 et 4 sont acceptées", () => {
    for (const sim of VERSIONS_SIM_JOUABLES) expect(() => decoderRediffusion(octets({ sim, genre: 1, g: 0 }))).not.toThrow();
    for (const sim of [2, 5]) {
      expect(refus(() => decoderRediffusion(octets({ sim, genre: 1, g: 0 })))).toBe("version_inconnue");
      expect(refus(() => rejouerComplet(R, contenu, { sim, g: 0, contenu: { scenario: "essai" }, reglages: { ...REGLAGES_DEFAUT }, plages: [{ masque: 0, ticks: 1 }] }))).toBe("version_inconnue");
    }
    expect(VERSIONS_SIM_JOUABLES).toEqual([3, 4]);
    expect(TOWER_SIM_VERSION).toBe(4);
  });

  it("une partie sans version donnée est jouée en version courante (4)", () => {
    expect(new Partie(R, contenu).version).toBe(TOWER_SIM_VERSION);
  });
});

describe("les refus : un code d'erreur propre à Tower pour chaque cas", () => {
  const bonne = encoderRediffusion({ sim: TOWER_SIM_VERSION, g: TOWER_GENERATOR_VERSION, contenu: { jour: JOUR }, reglages: { ...REGLAGES_DEFAUT }, plages: [{ masque: 0, ticks: 10 }] });

  it("version inconnue : une autre version de la simulation, un générateur inconnu, ou un générateur sur un scénario nommé", () => {
    expect(() => decoderRediffusion(bonne)).not.toThrow();
    expect(refus(() => decoderRediffusion(octets({ sim: TOWER_SIM_VERSION + 1 })))).toBe("version_inconnue");
    expect(refus(() => decoderRediffusion(octets({ sim: 1 })))).toBe("version_inconnue");
    expect(refus(() => decoderRediffusion(octets({ g: 7 })))).toBe("version_inconnue");
    expect(refus(() => decoderRediffusion(octets({ g: 0 })))).toBe("version_inconnue");
    expect(refus(() => decoderRediffusion(octets({ genre: 1, g: 1 })))).toBe("version_inconnue");
    expect(() => decoderRediffusion(octets({ genre: 1, g: 0 }))).not.toThrow();
  });

  it("format illisible : un autre format, un texte qui n'est pas du base64url, un texte tronqué, un entier démesuré, un genre ou un nom de scénario inconnus, une plage vide", () => {
    expect(refus(() => decoderRediffusion(octets({ format: 2 })))).toBe("format_illisible");
    expect(refus(() => decoderRediffusion("pas du base64url !"))).toBe("format_illisible");
    expect(refus(() => decoderRediffusion("A"))).toBe("format_illisible"); // longueur invalide
    expect(refus(() => decoderRediffusion(""))).toBe("format_illisible");
    expect(refus(() => decoderRediffusion(bonne.slice(0, 6)))).toBe("format_illisible"); // l'en-tête est coupé
    expect(refus(() => decoderRediffusion(octets({ genre: 3 })))).toBe("format_illisible");
    expect(refus(() => decoderRediffusion(octets({ genre: 1, nom: "Essai !" })))).toBe("format_illisible");
    expect(refus(() => decoderRediffusion(octets({ plages: [[0, 0]] })))).toBe("format_illisible");
    expect(refus(() => decoderRediffusion(toBase64Url([1, TOWER_SIM_VERSION, 1, 0, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x01])))).toBe("format_illisible"); // entier trop long
    expect(refus(() => decoderRediffusion(octets({ plages: [[0, 5]] }) + "A"))).toBe("format_illisible"); // une plage dont le nombre de ticks manque
  });

  it("commandes inconnues : un masque qui porte un bit que le jeu n'a pas", () => {
    for (const m of [16, 32, 128, 255, COMMANDE.GAUCHE | 16]) expect(refus(() => decoderRediffusion(octets({ plages: [[m, 3]] })))).toBe("commandes_inconnues");
    for (const m of [0, 1, 2, 4, 8, 15]) expect(() => decoderRediffusion(octets({ plages: [[m, 3]] }))).not.toThrow();
  });

  it("partie trop longue : plus de MAX_TICKS_JEU ticks, ou un texte démesuré (refusé avant d'être décodé)", () => {
    expect(() => decoderRediffusion(octets({ plages: [[0, MAX_TICKS_JEU]] }))).not.toThrow();
    expect(refus(() => decoderRediffusion(octets({ plages: [[0, MAX_TICKS_JEU + 1]] })))).toBe("trop_longue");
    expect(refus(() => decoderRediffusion(octets({ plages: [[0, 10_000], [1, 10_000], [0, 1]] })))).toBe("trop_longue");
    expect(refus(() => decoderRediffusion("A".repeat(200_000)))).toBe("trop_longue");
  });

  it("réglages hors bornes : refusés avant tout rejeu (une chute trop lente rallongerait la partie)", () => {
    for (const reglages of [[0, 4, 56, 3], [20, 0, 56, 3], [20, 4, 0, 3], [20, 4, 56, 0], [200, 4, 56, 3], [20, 4, 56, 10], [1, 4, 56, 3]]) {
      expect(refus(() => decoderRediffusion(octets({ reglages })))).toBe("reglages_invalides");
    }
  });

  it("inachevée (elle s'arrête avant la fin de la partie) et surplus (elle continue après la fin)", () => {
    const jouee = jouerScripte(contenuDuJour);
    const rec = enregistrer(jouee);
    const trop: Rediffusion = { ...rec, plages: [...rec.plages, { masque: COMMANDE.GAUCHE, ticks: 3 }] };
    const court: Rediffusion = { ...rec, plages: rec.plages.slice(0, -1) };
    expect(refus(() => rejouer(R, contenuDuJour, court))).toBe("inachevee");
    expect(refus(() => rejouer(R, contenuDuJour, trop))).toBe("surplus");
    expect(refus(() => rejouer(R, contenuDuJour, { ...rec, plages: [] }))).toBe("inachevee");
    expect(() => rejouer(R, contenuDuJour, rec)).not.toThrow();
    jouee.dispose();
  });

  it("lot T3b — le tirage : refus d'un tirage 0 en genre 2 (forme canonique), d'un tirage hors des TIRAGES_MAX, d'un tirage sur un générateur qui n'en a pas ; l'encodeur refuse aussi", () => {
    expect(() => decoderRediffusion(octets({ genre: 2, g: 3, tirage: 1 }))).not.toThrow();
    expect(() => decoderRediffusion(octets({ genre: 2, g: 3, tirage: TIRAGES_MAX - 1 }))).not.toThrow();
    expect(refus(() => decoderRediffusion(octets({ genre: 2, g: 3, tirage: 0 })))).toBe("format_illisible");
    expect(refus(() => decoderRediffusion(octets({ genre: 2, g: 3, tirage: TIRAGES_MAX })))).toBe("format_illisible");
    expect(refus(() => decoderRediffusion(octets({ genre: 2, g: 2, tirage: 1 })))).toBe("version_inconnue");
    expect(refus(() => decoderRediffusion(octets({ genre: 2, g: 1, tirage: 1 })))).toBe("version_inconnue");
    const rec = { sim: TOWER_SIM_VERSION, g: 3, reglages: { ...REGLAGES_DEFAUT }, plages: [{ masque: 0, ticks: 10 }] };
    expect(refus(() => encoderRediffusion({ ...rec, contenu: { jour: JOUR, tirage: TIRAGES_MAX } }))).toBe("format_illisible");
    expect(refus(() => encoderRediffusion({ ...rec, contenu: { jour: JOUR, tirage: -1 } }))).toBe("format_illisible");
  });

  it("contenu différent : un autre jour, un autre scénario, ou une autre version du générateur que celui sur lequel on la rejoue", () => {
    const jouee = jouerScripte(contenuDuJour);
    const rec = enregistrer(jouee);
    expect(refus(() => rejouer(R, dailyTower(JOUR + 1), rec))).toBe("contenu_different");
    expect(refus(() => rejouer(R, SCENARIO_ESSAI, rec))).toBe("contenu_different");
    expect(refus(() => rejouer(R, { ...contenuDuJour, g: TOWER_GENERATOR_VERSION + 1 }, rec))).toBe("contenu_different");
    const e = jouerScripte(SCENARIO_ESSAI);
    expect(refus(() => rejouer(R, contenuDuJour, enregistrer(e)))).toBe("contenu_different");
    expect(refus(() => rejouer(R, { ...SCENARIO_ESSAI, nom: "autre" }, enregistrer(e)))).toBe("contenu_different");
    jouee.dispose();
    e.dispose();
  });

  it("rejouer accepte le texte comme l'objet décodé et refuse un texte mauvais avec le même code", () => {
    expect(refus(() => rejouer(R, contenuDuJour, "###"))).toBe("format_illisible");
    expect(refus(() => rejouer(R, contenuDuJour, octets({ sim: 9 })))).toBe("version_inconnue");
  });
});
