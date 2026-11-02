import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CATALOGUE_COMMUN } from "@cdj/ui";
import { tuilesDesJeux, nomDuJeuAdmin, type Chiffres } from "../src/adminDonnees";
import { CATALOGUE_PORTAIL } from "../src/catalogue";
import { FICHES, ficheDuJeu, ficheDuRegistre, titreDeCarte } from "../src/jeuxFiches";
import { cartes } from "../src/jours";

// Lot K1 : le portail lit la fiche des jeux qui en ont une (ici Tower) : cartouches, accroche, titre, nom, filtre du cumul, thèmes du catalogue, tableau de bord.
const ROOT = join(__dirname, "../../..");
const jeu = (JSON.parse(readFileSync(join(ROOT, "config/jeux/projections/jeu.json"), "utf8")) as { jeux: { id: string; themes: string[] }[] }).jeux;

describe("les cartouches, le catalogue et les noms viennent de la fiche", () => {
  it("la projection du portail est celle des fiches : Tower, hors du cumul, classé à la hauteur", () => {
    expect(FICHES.map((f) => f.id)).toEqual(["tower"]);
    expect(ficheDuJeu("tower")).toMatchObject({ code: "tower", cumul: false, format: "hauteur", titre: null });
    expect(ficheDuRegistre("tower")?.id).toBe("tower");
    expect(ficheDuJeu("track")).toBeUndefined(); // Track et Jump : leur code d'avant, jusqu'aux lots K1b et K1c
  });

  it("les cartouches : Track, Jump, puis chaque fiche, sans numéro local (le serveur le donne)", () => {
    const c = cartes(20_000);
    expect(c.map((x) => [x.code, x.jeu, x.lien])).toEqual([["track", "cdj", "track/"], ["jump", "jump", "jump/"], ["tower", "tower", "tower/"]]);
    expect(c[2]!.numero).toBe(0);
  });

  it("chaque fiche a son accroche et son nom dans les catalogues français et anglais, et un nom par thème", () => {
    for (const f of FICHES) {
      expect(f.accroche in CATALOGUE_PORTAIL.fr, `${f.accroche} (fr)`).toBe(true);
      expect(f.accroche in CATALOGUE_PORTAIL.en, `${f.accroche} (en)`).toBe(true);
      expect(`jeu.${f.id}.nom` in CATALOGUE_COMMUN.fr, `jeu.${f.id}.nom (fr)`).toBe(true);
      expect(`jeu.${f.id}.nom` in CATALOGUE_COMMUN.en, `jeu.${f.id}.nom (en)`).toBe(true);
      if (f.titre) expect(f.titre in CATALOGUE_COMMUN.fr || f.titre in CATALOGUE_PORTAIL.fr).toBe(true);
    }
    for (const j of jeu.filter((x) => FICHES.some((f) => f.id === x.id))) {
      const cles = (c: Record<string, string>) => Object.keys(c).filter((k) => k.startsWith(`portail.theme.${j.id}.`)).map((k) => k.slice(`portail.theme.${j.id}.`.length)).sort();
      expect(cles(CATALOGUE_PORTAIL.fr), `thèmes de ${j.id} (fr)`).toEqual([...j.themes].sort());
      expect(cles(CATALOGUE_PORTAIL.en), `thèmes de ${j.id} (en)`).toEqual([...j.themes].sort());
    }
  });

  it("le titre d'une cartouche sans clé `titre` est le nom en capitales", () => {
    expect(titreDeCarte(ficheDuJeu("tower")!, { t: (() => "x") as never }, "Tower")).toBe("TOWER");
    expect(titreDeCarte({ ...ficheDuJeu("tower")!, titre: "k" }, { t: ((c: string) => `[${c}]`) as never }, "Tower")).toBe("[k]");
  });

  it("le portail ne nomme plus Tower en dur dans le code qui présente un jeu (hors commentaires)", () => {
    for (const f of ["portail.ts", "profil.ts", "classement.ts", "partageDuJour.ts", "jours.ts", "adminDiffusion.ts", "adminDonnees.ts", "admin.ts"]) {
      const code = readFileSync(join(ROOT, "apps/portail/src", f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
      expect(code, f).not.toMatch(/["'`]tower["'`]|etiquetteTower|jeu\.tower\./);
    }
  });
});

describe("le tableau de bord : une tuile par jeu, le bon nom de jeu", () => {
  const base: Chiffres = { joueursAujourdhui: 5, joueursHier: 4, nouveauxProfils: 1, track: { finis: 3 }, jump: { finis: 2, morts: 7 } };

  it("sans les chiffres de Tower (jeu pas monté sur le serveur) : Track et Jump seulement, comme avant", () => {
    expect(tuilesDesJeux(base)).toEqual([
      { legende: "Track finis", valeur: "3" },
      { legende: "Jump finis", valeur: "2", sousTexte: "7 morts" },
    ]);
  });

  it("avec les chiffres de Tower : la tuile « Tower finis »", () => {
    const l = tuilesDesJeux({ ...base, tower: { finis: 4 } } as Chiffres);
    expect(l.map((t) => [t.legende, t.valeur])).toEqual([["Track finis", "3"], ["Jump finis", "2"], ["Tower finis", "4"]]);
    expect(tuilesDesJeux({ ...base, tower: { finis: 0 } } as Chiffres).at(-1)).toEqual({ legende: "Tower finis", valeur: "0" });
  });

  it("un résultat retiré à Tower ne s'affiche plus « Track »", () => {
    expect(nomDuJeuAdmin("tower")).toBe("Tower");
    expect(nomDuJeuAdmin("cdj")).toBe("Track");
    expect(nomDuJeuAdmin("jump")).toBe("Jump");
    expect(nomDuJeuAdmin("autre")).toBe("autre"); // un jeu inconnu garde son code : jamais « Track » par défaut
  });
});
