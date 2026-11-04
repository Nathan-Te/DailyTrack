import { describe, expect, it } from "vitest";
import { daysFromCivil } from "@cdj/core";
import { actionDe, contenuDeScenario, dailyBlocks, decoderRediffusion, encoderRediffusion, enregistrer, ErreurRediffusion, MAX_CARACTERES, PLAFOND_PIECES, rejouer, BLOCKS_GENERATOR_VERSION, BLOCKS_SIM_VERSION } from "../src/index";
import { jouerGlouton } from "../src/glouton";
import { contenuDEssai } from "./aide";

const JOUR = daysFromCivil(2026, 11, 3);
const refus = (f: () => unknown): string => {
  try {
    f();
  } catch (e) {
    return e instanceof ErreurRediffusion ? e.code : `autre : ${String(e)}`;
  }
  return "accepté";
};

describe("rediffusion et rejeu", () => {
  const contenu = dailyBlocks(JOUR);
  const { resultat, actions } = jouerGlouton(contenu);

  it("une partie complète s'encode, se décode et se rejoue au même résultat ; un octet par pose", () => {
    const texte = enregistrer(contenu, actions);
    expect(decoderRediffusion(texte).actions).toEqual(actions);
    expect(rejouer(contenu, texte)).toEqual(resultat);
    expect(resultat.raison).toBe("bloquee");
    // Un octet par pose : ce que les poses ajoutent au texte vide est leur nombre en base64url (4 caractères pour 3 octets), à un caractère près.
    expect(texte.length - enregistrer(contenu, []).length).toBeLessThanOrEqual(Math.ceil((actions.length * 4) / 3) + 1);
  });

  it("refuse une action illégale", () => {
    expect(refus(() => rejouer(contenu, enregistrer(contenu, [...actions.slice(0, 5), actions[3]!, ...actions.slice(6)])))).not.toBe("accepté");
    expect(refus(() => rejouer(contenu, enregistrer(contenu, [actionDe(0, 0), actionDe(0, 0)])))).toBe("action_illegale");
  });
  it("refuse une action après la fin", () => {
    expect(refus(() => rejouer(contenu, enregistrer(contenu, [...actions, actionDe(0, 0)])))).toBe("apres_la_fin");
  });
  it("refuse une partie non terminée (il manque la dernière pose)", () => {
    expect(refus(() => rejouer(contenu, enregistrer(contenu, actions.slice(0, -1))))).toBe("non_terminee");
    expect(refus(() => rejouer(contenu, enregistrer(contenu, [])))).toBe("non_terminee");
  });
  it("refuse une suite au-delà du plafond (au décodage) et une charge hors grille", () => {
    const trop = Array.from({ length: PLAFOND_PIECES + 1 }, () => 0);
    expect(refus(() => decoderRediffusion(encoderRediffusion({ sim: BLOCKS_SIM_VERSION, g: BLOCKS_GENERATOR_VERSION, contenu: { jour: JOUR }, actions: trop })))).toBe("trop_longue");
    expect(refus(() => decoderRediffusion(encoderRediffusion({ sim: BLOCKS_SIM_VERSION, g: BLOCKS_GENERATOR_VERSION, contenu: { jour: JOUR }, actions: [64] })))).toBe("format_illisible");
    expect(MAX_CARACTERES).toBeGreaterThan(Math.ceil(((PLAFOND_PIECES + 40) * 4) / 3));
  });
  it("refuse un autre jour, une autre version, un texte illisible ou tronqué", () => {
    expect(refus(() => rejouer(dailyBlocks(JOUR + 1), enregistrer(contenu, actions)))).toBe("contenu_different");
    expect(refus(() => rejouer(contenu, encoderRediffusion({ sim: 2, g: BLOCKS_GENERATOR_VERSION, contenu: { jour: JOUR }, actions })))).toBe("version_inconnue");
    expect(refus(() => decoderRediffusion("pas-une-rediffusion"))).not.toBe("accepté");
    expect(refus(() => decoderRediffusion(""))).toBe("format_illisible");
    expect(refus(() => decoderRediffusion(enregistrer(contenu, actions).slice(0, 3)))).not.toBe("accepté");
  });
  it("un scénario nomme son scénario : il ne se rejoue pas sur un jour (et inversement)", () => {
    const s = contenuDeScenario("blocage");
    const texte = enregistrer(s, []);
    expect(decoderRediffusion(texte).contenu).toEqual({ scenario: "blocage" });
    expect(rejouer(s, texte).raison).toBe("bloquee");
    expect(refus(() => rejouer(contenu, texte))).toBe("contenu_different");
    expect(refus(() => rejouer(s, enregistrer(contenu, actions)))).toBe("contenu_different");
  });
  it("une partie courte à la main (suite d'essai) se rejoue", () => {
    const c = contenuDEssai(["coin-0"], ["XXXXXXXX", "XXXXXXXX", "XXXXXXXX", "XXXXXXXX", "XXXXXXXX", "XXXXXXXX", "XXXXXXXX", "XXXXXX.."]);
    expect(rejouer({ ...c, jour: JOUR, g: BLOCKS_GENERATOR_VERSION }, enregistrer({ ...c, jour: JOUR }, [])).raison).toBe("bloquee");
  });
});
