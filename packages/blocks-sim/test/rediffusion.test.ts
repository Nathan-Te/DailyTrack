import { describe, expect, it } from "vitest";
import { daysFromCivil } from "@cdj/core";
import { actionDe, BLOCKS_GENERATOR_VERSION, BLOCKS_SIM_VERSION, contenuDeScenario, dailyBlocks, decoderRediffusion, encoderRediffusion, enregistrer, ErreurRediffusion, MAX_CARACTERES, NB_ACTIONS, PLAFOND_PIECES, rejouer } from "../src/index";
import { jouerGlouton } from "../src/glouton";
import { activerReglesV1 } from "../src/v1";
import { jouerDiamant } from "../src/diamant";
import { contenuDEssai } from "./aide";

activerReglesV1(); // les tests « v1 » ci-dessous (le jeu, lui, ne les active jamais)

const JOUR = daysFromCivil(2026, 11, 3);
const refus = (f: () => unknown): string => {
  try {
    f();
  } catch (e) {
    return e instanceof ErreurRediffusion ? e.code : `autre : ${String(e)}`;
  }
  return "accepté";
};

describe("rediffusion et rejeu (règles v2 : un octet par pose, emplacement × 64 + ligne × 8 + colonne)", () => {
  const contenu = dailyBlocks(JOUR);
  const { resultat, actions } = jouerGlouton(contenu);

  it("une partie complète s'encode, se décode et se rejoue au même résultat ; un octet par pose", () => {
    const texte = enregistrer(contenu, actions);
    expect(decoderRediffusion(texte).actions).toEqual(actions);
    expect(decoderRediffusion(texte)).toMatchObject({ sim: BLOCKS_SIM_VERSION, g: BLOCKS_GENERATOR_VERSION });
    expect(rejouer(contenu, texte)).toEqual(resultat);
    expect(resultat.raison).toBe("bloquee");
    expect(actions.every((a) => Number.isInteger(a) && a >= 0 && a < NB_ACTIONS)).toBe(true);
    expect(actions.some((a) => a >= 64)).toBe(true); // on pose aussi les deuxième et troisième pièces
    // Un octet par pose : ce que les poses ajoutent au texte vide est leur nombre en base64url (4 caractères pour 3 octets), à un caractère près.
    expect(texte.length - enregistrer(contenu, []).length).toBeLessThanOrEqual(Math.ceil((actions.length * 4) / 3) + 1);
  });

  it("refuse une action illégale : un emplacement déjà posé, une case occupée", () => {
    expect(refus(() => rejouer(contenu, enregistrer(contenu, [actionDe(0, 0, 0), actionDe(0, 4, 4)])))).toBe("action_illegale"); // l'emplacement 0 est vide
    expect(refus(() => rejouer(contenu, enregistrer(contenu, [actionDe(0, 0, 0), actionDe(1, 0, 0)])))).toBe("action_illegale"); // la case est occupée (ou la pièce déborde)
    expect(refus(() => rejouer(contenu, enregistrer(contenu, [...actions.slice(0, 5), actions[3]!, ...actions.slice(6)])))).not.toBe("accepté");
  });
  it("refuse une action après la fin", () => {
    expect(refus(() => rejouer(contenu, enregistrer(contenu, [...actions, actionDe(0, 0, 0)])))).toBe("apres_la_fin");
  });
  it("refuse une partie non terminée (il manque la dernière pose)", () => {
    expect(refus(() => rejouer(contenu, enregistrer(contenu, actions.slice(0, -1))))).toBe("non_terminee");
    expect(refus(() => rejouer(contenu, enregistrer(contenu, [])))).toBe("non_terminee");
  });
  it("refuse une suite au-delà du plafond (au décodage) et une charge hors de 0 à 191", () => {
    const trop = Array.from({ length: PLAFOND_PIECES + 1 }, () => 0);
    expect(refus(() => decoderRediffusion(encoderRediffusion({ sim: BLOCKS_SIM_VERSION, g: BLOCKS_GENERATOR_VERSION, contenu: { jour: JOUR }, actions: trop })))).toBe("trop_longue");
    expect(refus(() => decoderRediffusion(encoderRediffusion({ sim: BLOCKS_SIM_VERSION, g: BLOCKS_GENERATOR_VERSION, contenu: { jour: JOUR }, actions: [192] })))).toBe("format_illisible");
    expect(refus(() => decoderRediffusion(encoderRediffusion({ sim: BLOCKS_SIM_VERSION, g: BLOCKS_GENERATOR_VERSION, contenu: { jour: JOUR }, actions: [191] })))).toBe("accepté");
    expect(MAX_CARACTERES).toBeGreaterThan(Math.ceil(((PLAFOND_PIECES + 40) * 4) / 3));
  });
  it("refuse un autre jour, une autre version, des règles et un tirage qui ne vont pas ensemble, un texte illisible ou tronqué", () => {
    expect(refus(() => rejouer(dailyBlocks(JOUR + 1), enregistrer(contenu, actions)))).toBe("contenu_different");
    expect(refus(() => rejouer(contenu, encoderRediffusion({ sim: 99, g: BLOCKS_GENERATOR_VERSION, contenu: { jour: JOUR }, actions })))).toBe("version_inconnue");
    expect(refus(() => rejouer(contenu, encoderRediffusion({ sim: BLOCKS_SIM_VERSION, g: 99, contenu: { jour: JOUR }, actions })))).toBe("version_inconnue");
    expect(refus(() => decoderRediffusion(encoderRediffusion({ sim: 1, g: BLOCKS_GENERATOR_VERSION, contenu: { jour: JOUR }, actions })))).toBe("version_inconnue"); // règles v1 avec un tirage v4
    expect(refus(() => decoderRediffusion("pas-une-rediffusion"))).not.toBe("accepté");
    expect(refus(() => decoderRediffusion(""))).toBe("format_illisible");
    expect(refus(() => decoderRediffusion(enregistrer(contenu, actions).slice(0, 3)))).not.toBe("accepté");
  });
  it("une rediffusion v1 ne rejoue pas un jour v2, et inversement (`contenu_different`)", () => {
    const v1 = dailyBlocks(JOUR, 3);
    expect(refus(() => rejouer(contenu, enregistrer(v1, [])))).toBe("contenu_different");
    expect(refus(() => rejouer(v1, enregistrer(contenu, actions)))).toBe("contenu_different");
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
    const c = contenuDEssai(["coin-0", "coin-0", "coin-0"], ["XXXXXXXX", "XXXXXXXX", "XXXXXXXX", "XXXXXXXX", "XXXXXXXX", "XXXXXXXX", "XXXXXXXX", "XXXXXX.."]);
    expect(rejouer({ ...c, jour: JOUR, g: BLOCKS_GENERATOR_VERSION }, enregistrer({ ...c, jour: JOUR }, [])).raison).toBe("bloquee");
  });
});

describe("une rediffusion trichée est refusée (lot B8c : le serveur retire chaque série depuis la grille qu'il rejoue)", () => {
  it("une partie jouée avec des pièces qui n'ont pas été tirées (ici des séries de dominos, bien plus faciles) ne se rejoue pas sur le vrai jour : action illégale, après la fin ou non terminée — jamais acceptée avec un autre score", () => {
    for (let i = 0; i < 10; i++) {
      const jour = JOUR + i;
      const vrai = dailyBlocks(jour);
      // Le tricheur joue SA suite de dominos (contenuDEssai : trois dominos à chaque série) et envoie ses poses comme celles du vrai jour.
      const faux = { ...contenuDEssai([]), jour, graine: vrai.graine };
      const triche = jouerDiamant(faux);
      expect(triche.actions.length).toBeGreaterThan(20);
      const code = refus(() => rejouer(vrai, enregistrer(vrai, triche.actions)));
      expect(["action_illegale", "apres_la_fin", "non_terminee"], `jour ${jour} : ${code}`).toContain(code);
    }
  });

  it("changer une seule pose d'une vraie partie change les séries suivantes (elles dépendent de la grille) : la fin de la rediffusion, écrite pour l'autre suite, est refusée ou rejoue un autre score", () => {
    const vrai = dailyBlocks(JOUR + 2);
    const { actions, resultat } = jouerGlouton(vrai);
    // On déplace la première pose du premier emplacement vers une autre case légale ; les poses suivantes restent celles de la partie d'origine.
    const modifie = [...actions];
    modifie[0] = (modifie[0]! + 1) % 8 === 0 ? modifie[0]! - 1 : modifie[0]! + 1;
    const code = refus(() => rejouer(vrai, enregistrer(vrai, modifie)));
    if (code === "accepté") expect(rejouer(vrai, enregistrer(vrai, modifie)).score).not.toBe(resultat.score);
    else expect(["action_illegale", "apres_la_fin", "non_terminee"]).toContain(code);
  });
});
