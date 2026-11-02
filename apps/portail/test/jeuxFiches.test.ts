import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CATALOGUE_COMMUN } from "@cdj/ui";
import { tuilesDesJeux, nomDuJeuAdmin, type Chiffres } from "../src/adminDonnees";
import { CATALOGUE_PORTAIL } from "../src/catalogue";
import { FICHES, ficheDuJeu, ficheDuRegistre, titreDeCarte } from "../src/jeuxFiches";
import { cartes } from "../src/jours";
import { daysFromCivil } from "@cdj/core";

// Lots K1, K1b et K1c : le portail lit la fiche de chaque jeu (Track, Jump, Tower) : cartouches, accroche, titre, nom, filtre du cumul, thèmes du catalogue, tableau de bord.
const ROOT = join(__dirname, "../../..");
const jeu = (JSON.parse(readFileSync(join(ROOT, "config/jeux/projections/jeu.json"), "utf8")) as { jeux: { id: string; themes: string[] }[] }).jeux;

describe("les cartouches, le catalogue et les noms viennent de la fiche", () => {
  it("la projection du portail est celle des fiches : Track et Jump (au temps, dans le cumul) et Tower (hors du cumul, classé à la hauteur)", () => {
    expect(FICHES.map((f) => f.id)).toEqual(["track", "jump", "tower"]);
    expect(ficheDuJeu("track")).toMatchObject({ code: "cdj", cumul: true, format: "temps", titre: "jeu.track.titre", premierJour: "2026-10-13" });
    expect(ficheDuJeu("track")?.accrocheTheme).toBeUndefined();
    expect(ficheDuJeu("tower")).toMatchObject({ code: "tower", cumul: false, format: "hauteur" });
    expect(ficheDuJeu("tower")?.titre).toBeUndefined();
    expect(ficheDuJeu("jump")).toMatchObject({ code: "jump", cumul: true, format: "temps", titre: "jeu.jump.titre", accrocheTheme: "jump.replique." });
    expect(ficheDuRegistre("tower")?.id).toBe("tower");
    expect(ficheDuRegistre("jump")?.id).toBe("jump");
    expect(ficheDuRegistre("cdj")?.id).toBe("track"); // le code du registre de Track n'est pas son identifiant
    expect(ficheDuJeu("cdj")).toBeUndefined();
  });

  it("les cartouches : une par fiche, dans l'ordre ; Track et Jump ont leur numéro local (publics d'emblée), Tower non (le serveur le donne)", () => {
    const c = cartes(20_000);
    expect(c.map((x) => [x.code, x.jeu, x.lien])).toEqual([["track", "cdj", "track/"], ["jump", "jump", "jump/"], ["tower", "tower", "tower/"]]);
    expect(c[0]!.numero).toBe(20_000 - daysFromCivil(2026, 10, 13) + 1);
    expect(c[1]!.numero).toBe(20_000 - daysFromCivil(2026, 10, 16) + 1);
    expect(c[2]!.numero).toBe(0);
  });

  it("l'accroche d'un jeu qui en a une par thème suit le thème du jour : chaque thème de Jump a sa réplique dans le catalogue commun", () => {
    const j = ficheDuJeu("jump")!;
    for (const t of jeu.find((x) => x.id === "jump")!.themes) expect(`${j.accrocheTheme}${t}` in CATALOGUE_COMMUN.fr, t).toBe(true);
  });

  it("chaque fiche a son accroche et son nom dans les catalogues français et anglais, et un nom par thème", () => {
    for (const f of FICHES) {
      expect(f.accroche in CATALOGUE_PORTAIL.fr, `${f.accroche} (fr)`).toBe(true);
      expect(f.accroche in CATALOGUE_PORTAIL.en, `${f.accroche} (en)`).toBe(true);
      expect(`jeu.${f.id}.nom` in CATALOGUE_COMMUN.fr, `jeu.${f.id}.nom (fr)`).toBe(true);
      expect(`jeu.${f.id}.nom` in CATALOGUE_COMMUN.en, `jeu.${f.id}.nom (en)`).toBe(true);
      if (f.titre) expect(f.titre in CATALOGUE_COMMUN.fr || f.titre in CATALOGUE_PORTAIL.fr).toBe(true);
    }
    // Exception nommée : Track n'a pas de noms de thèmes au portail (sa cartouche n'en montre pas : `nomTheme` rend `null` sans clé) ; ajouter ses huit noms changerait la cartouche et le catalogue.
    for (const j of jeu.filter((x) => FICHES.some((f) => f.id === x.id) && x.id !== "track")) {
      const cles = (c: Record<string, string>) => Object.keys(c).filter((k) => k.startsWith(`portail.theme.${j.id}.`)).map((k) => k.slice(`portail.theme.${j.id}.`.length)).sort();
      expect(cles(CATALOGUE_PORTAIL.fr), `thèmes de ${j.id} (fr)`).toEqual([...j.themes].sort());
      expect(cles(CATALOGUE_PORTAIL.en), `thèmes de ${j.id} (en)`).toEqual([...j.themes].sort());
    }
  });

  it("le titre d'une cartouche sans clé `titre` est le nom en capitales", () => {
    expect(titreDeCarte(ficheDuJeu("tower")!, { t: (() => "x") as never }, "Tower")).toBe("TOWER");
    expect(titreDeCarte({ ...ficheDuJeu("tower")!, titre: "k" }, { t: ((c: string) => `[${c}]`) as never }, "Tower")).toBe("[k]");
  });

  // Lot K1b : le test de K1 s'étend à chaque jeu qui a une fiche (Track le rejoint au lot K1c). Les exceptions sont nommées une à une, avec leur raison ; chacune doit encore se voir dans le code
  // (une exception qui ne sert plus est retirée : le test échoue sinon).
  const EXCEPTIONS: { fichier: string; motif: RegExp; raison: string }[] = [
    { fichier: "admin.ts", motif: /"data-menu": "track"/, raison: "le menu du panneau d'administration : l'entrée de la page d'outils `/track/admin/` (voir la suivante)" },
    { fichier: "admin.ts", motif: /"data-menu": "jump"/, raison: "le menu du panneau d'administration : les entrées des pages d'outils `/<jeu>/admin/` (`admin.outils` de la fiche) ne sont pas encore lues de la fiche — lot K2 (le panneau est l'outil de l'éditeur, hors du portail des joueurs)" },
  ];
  it("le portail ne nomme plus un jeu qui a une fiche en dur dans le code qui présente un jeu (hors commentaires et exceptions nommées)", () => {
    const vues = new Set<number>();
    for (const f of ["portail.ts", "profil.ts", "classement.ts", "partageDuJour.ts", "jours.ts", "adminDiffusion.ts", "adminDonnees.ts", "admin.ts"]) {
      const code = readFileSync(join(ROOT, "apps/portail/src", f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
      for (const { id } of FICHES) {
        const Id = id.charAt(0).toUpperCase() + id.slice(1);
        const motif = new RegExp(`["'\`]${id}["'\`]|etiquette${Id}\\b|jeu\\.${id}\\.`);
        const lignes = code.split("\n").filter((l) => motif.test(l));
        const restantes = lignes.filter((l) => {
          const k = EXCEPTIONS.findIndex((e) => e.fichier === f && e.motif.test(l));
          if (k >= 0) vues.add(k);
          return k < 0;
        });
        expect(restantes, `${f} nomme « ${id} » en dur`).toEqual([]);
      }
    }
    EXCEPTIONS.forEach((e, k) => expect(vues.has(k), `l'exception « ${e.fichier} ${e.motif} » ne sert plus : la retirer`).toBe(true));
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
