import { describe, expect, it } from "vitest";
import { JEUX_PUBLICS, compteLe, etatDansListe, etatDe, etatsDeReponse, etatsParDefaut, liveFromDe, lirePeriodes, periodesApres, type PeriodeJeu } from "../src/jeux";

// Lot P : la logique pure de l'interrupteur des jeux — états, jeu inconnu, et surtout les périodes `[du, au)` où un jeu compte dans la journée, à dates fixes
// (jours de Paris en jours depuis 1970 : 100 = « lundi », 101 = mardi…). L'intégration (base, routes, séries) est dans `apps/api/test/jeux.test.ts`.

describe("états", () => {
  it("tout ce qui n'est pas un état connu vaut `off` ; un jeu absent d'une liste aussi", () => {
    expect(etatDe("on")).toBe("on");
    expect(etatDe("preview")).toBe("preview");
    for (const v of ["off", "ON", "", null, undefined, 1, {}]) expect(etatDe(v)).toBe("off");
    expect(etatDansListe({ track: "on" }, "tower")).toBe("off");
    expect(etatDansListe({ track: "on" }, "track")).toBe("on");
    expect(etatDansListe(null, "track")).toBe("off");
    expect(etatDansListe({}, "toString")).toBe("off"); // pas de piège de prototype
  });

  it("sans réseau, seuls les jeux déjà publics sont `on` : un jeu en développement n'apparaît jamais par défaut", () => {
    expect(etatsParDefaut()).toEqual({ track: "on", jump: "on" });
    expect(JEUX_PUBLICS).toEqual(["track", "jump"]);
    expect(etatDansListe(etatsParDefaut(), "tower")).toBe("off");
  });

  it("la réponse du serveur est lue avec prudence", () => {
    expect(etatsDeReponse({ jeux: { track: "on", jump: "preview", tower: "n'importe quoi" } })).toEqual({ track: "on", jump: "preview", tower: "off" });
    for (const v of [null, {}, { jeux: null }, { jeux: [] }, "x"]) expect(etatsDeReponse(v)).toBeNull();
  });
});

describe("périodes de la journée", () => {
  const T = 100;
  it("activer : la période s'ouvre le lendemain (le premier jour entier)", () => {
    const p = periodesApres([], "off", "on", T);
    expect(p).toEqual([[101, null]]);
    expect(liveFromDe(p)).toBe(101);
    expect(compteLe(p, 100)).toBe(false); // le jour de l'activation
    expect(compteLe(p, 101)).toBe(true);
    expect(compteLe(p, 500)).toBe(true);
  });

  it("désactiver : la période se ferme demain (le jeu sort de la journée dès le lendemain) ; les jours passés ne bougent pas", () => {
    const actif: PeriodeJeu[] = [[90, null]];
    const p = periodesApres(actif, "on", "off", T);
    expect(p).toEqual([[90, 101]]);
    expect(compteLe(p, 89)).toBe(false);
    expect(compteLe(p, 90)).toBe(true);
    expect(compteLe(p, 100)).toBe(true); // aujourd'hui compte encore
    expect(compteLe(p, 101)).toBe(false);
    expect(periodesApres(actif, "on", "preview", T)).toEqual([[90, 101]]);
  });

  it("activé puis désactivé le jour même : il n'a jamais compté, rien ne reste", () => {
    const p = periodesApres(periodesApres([], "off", "on", T), "on", "off", T);
    expect(p).toEqual([]);
    expect(liveFromDe(p)).toBeNull();
  });

  it("réactivation : le jour même de la désactivation la période se rouvre sans trou ; plus tard une nouvelle période s'ouvre le lendemain", () => {
    const fermee = periodesApres([[90, null]], "on", "off", T); // [[90, 101]]
    expect(periodesApres(fermee, "off", "on", T)).toEqual([[90, null]]);
    const plusTard = periodesApres(fermee, "off", "on", 104);
    expect(plusTard).toEqual([[90, 101], [105, null]]);
    expect(compteLe(plusTard, 103)).toBe(false); // le trou : pas de jeu, pas de journée parfaite à rater
    expect(compteLe(plusTard, 104)).toBe(false);
    expect(compteLe(plusTard, 105)).toBe(true);
    expect(liveFromDe(plusTard)).toBe(105);
  });

  it("off ↔ preview ne touche à rien ; un même état non plus", () => {
    const p: PeriodeJeu[] = [[90, 95]];
    expect(periodesApres(p, "off", "preview", T)).toEqual(p);
    expect(periodesApres(p, "preview", "off", T)).toEqual(p);
    expect(periodesApres(p, "on", "on", T)).toEqual(p);
    expect(periodesApres(p, "off", "preview", T)).not.toBe(p); // jamais la même liste : l'appelant peut la garder
  });

  it("les périodes gardées en JSON sont relues avec prudence", () => {
    expect(lirePeriodes('[[0,null],[5,7]]')).toEqual([[0, null], [5, 7]]);
    for (const v of ["", "pas du json", "{}", '[["a",1]]', '[[1.5,null]]', null, undefined]) expect(lirePeriodes(v)).toEqual([]);
    expect(compteLe(lirePeriodes("abîmé"), 100)).toBe(false); // abîmé : le jeu ne compte pas, rien ne casse
  });
});
