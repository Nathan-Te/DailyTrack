import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Suite } from "@cdj/profile";
import { FauxEvenement as _e, installerFauxDom, type FauxElement } from "../../ui/test/fauxDom";
import { elementsDeSuite, poserSuite } from "../src/suite";

void _e;
const t = (cle: string, p?: Record<string, string | number>) => `${cle}${p ? JSON.stringify(p) : ""}`;
const ids = ["suite-jeu-suivant", "suite-parfaite", "suite-portail"] as const;
beforeEach(() => void installerFauxDom(vi));
afterEach(() => vi.unstubAllGlobals());
const f = (x: unknown) => x as FauxElement;

describe("la suite du jour (DOM commun)", () => {
  const suivant: Suite = { kind: "suivant", jeu: "jump", nom: "Jump", href: "../jump/" };
  const parfaite: Suite = { kind: "parfaite", href: "../" };
  it("jeu suivant : la légende puis le lien de marque, avec les identifiants et classes du jeu", () => {
    const [legende, lien] = elementsDeSuite(suivant, t, ids, ["legende", "parfaite", "next-game"]).map(f);
    expect(legende!.className).toBe("legende");
    expect(legende!.textContent).toBe("arrivee.legendeSuite");
    expect(lien!.id).toBe("suite-jeu-suivant");
    expect(lien!.classList.contains("next-game")).toBe(true);
    expect(lien!.textContent).toContain('arrivee.jeuSuivant{"jeu":"Jump"}');
    expect(lien!.getAttribute("href")).toBe("../jump/");
  });
  it("journée parfaite : le bloc puis le retour au portail ; sans classe de bouton, aucune n'est ajoutée", () => {
    const [bloc, retour] = elementsDeSuite(parfaite, t, ids, ["legende", "parfaite"], "suite.legende").map(f);
    expect(bloc!.id).toBe("suite-parfaite");
    expect(bloc!.className).toBe("parfaite");
    expect(retour!.id).toBe("suite-portail");
    expect(retour!.classList.contains("next-game")).toBe(false);
    expect(retour!.getAttribute("href")).toBe("../");
  });
  it("poserSuite : vide et caché sans suite", () => {
    const hote = f(document.createElement("div"));
    poserSuite(hote as unknown as HTMLElement, suivant, t, ids, ["l", "p"]);
    expect(hote.hidden).toBe(false);
    expect(hote.children.length).toBe(2);
    poserSuite(hote as unknown as HTMLElement, null, t, ids, ["l", "p"]);
    expect(hote.hidden).toBe(true);
    expect(hote.children.length).toBe(0);
  });
});
