import { describe, expect, it } from "vitest";
import { Commandes } from "@cdj/ui/src/commandes";
import { definirLiaison, definirTouche } from "@cdj/ui/src/commandesEdition";
import { CATALOGUE_TOWER } from "../src/catalogue";
import { ACTIONS_TOWER } from "../src/commandes";
import { ACTIONS_AIDE, nomsAide, segmentsAide } from "../src/aideLigne";

// Lot T7 : l'aide des commandes en partie cite les touches CHOISIES (en pastilles de clavier) ou les boutons de la manette, d'après le gabarit du catalogue (`aide.ligne`), français et anglais.
const fraiche = (): Commandes => new Commandes("tower", ACTIONS_TOWER, null);
/** Le traducteur des tests : le gabarit du catalogue, `{action}` remplacé par le paramètre donné. */
const traducteurDe = (langue: "fr" | "en") => (cle: string, params: Record<string, string> = {}) => (CATALOGUE_TOWER[langue][cle] as string).replace(/\{(\w+)\}/g, (m, k: string) => params[k] ?? m);
/** La ligne en une phrase : le texte, les pastilles entre crochets. */
const phrase = (c: Commandes, entree: "clavier" | "manette", langue: "fr" | "en" = "fr"): string =>
  segmentsAide(c, entree, langue, traducteurDe(langue))
    .map((m) => (typeof m === "string" ? m : m.map((n) => `[${n}]`).join("")))
    .join("");

describe("l'aide des commandes en partie", () => {
  it("le gabarit cite les cinq actions dans les deux langues", () => {
    for (const langue of ["fr", "en"] as const) for (const id of ACTIONS_AIDE) expect(CATALOGUE_TOWER[langue]["aide.ligne"], `${langue} ${id}`).toContain(`{${id}}`);
  });

  it("au clavier : les deux premières touches de chaque action, celles du joueur", () => {
    const c = fraiche();
    c.disposition = new Map([["KeyW", "z"], ["KeyA", "q"], ["KeyS", "s"], ["KeyD", "d"]]); // AZERTY
    expect(phrase(c, "clavier")).toBe("[←][Q] [→][D] déplacer · [↑][Z] tourner · [↓][S] descendre · [P] pause");
    expect(phrase(c, "clavier", "en")).toBe("[←][Q] [→][D] move · [↑][Z] rotate · [↓][S] drop · [P] pause");
  });

  it("cite la touche choisie dans Réglages › Commandes (Z pour tourner, Entrée ne figure pas)", () => {
    const c = fraiche();
    definirTouche(c, "tourner", 0, "KeyN");
    definirTouche(c, "pause", 0, "KeyO");
    const p = phrase(c, "clavier");
    expect(p).toContain("[N][W] tourner");
    expect(p).toContain("[O] pause");
    expect(p).not.toContain("[↑] tourner");
  });

  it("à la manette : des boutons de manette — le stick déplace, A tourne, RT descend, Start met en pause (le bouton choisi, s'il a changé)", () => {
    const c = fraiche();
    expect(phrase(c, "manette")).toBe("[←] [→] déplacer · [A] tourner · [RT] descendre · [Start] pause");
    definirLiaison(c, "tourner", "b1");
    definirLiaison(c, "descendre", "b6");
    expect(phrase(c, "manette")).toBe("[←] [→] déplacer · [B] tourner · [LT] descendre · [Start] pause");
  });

  it("une action sans touche (emplacement vide) ne casse pas la ligne", () => {
    const c = fraiche();
    c.etat.clavier.pause = [""];
    expect(nomsAide(c, "pause", "clavier", "fr")).toEqual([]);
    expect(() => phrase(c, "clavier")).not.toThrow();
  });
});
