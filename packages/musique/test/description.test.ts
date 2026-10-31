import { describe, expect, it } from "vitest";
import { creditDe, resoudreJeux, verifierDescription } from "../src/description";
import { FORMAT_SCENE, SCENES } from "../src/scenes";
import { pistesDuJeu } from "../src/liste";
import { liste, piste } from "./faux";

const existe = { fichierExiste: () => true };
const bon = { id: "premier-jour", titre: "Premier jour", artiste: "Nathan", fichier: "premier-jour.mp3", jeux: ["track"], licence: "mienne" };
const erreursDe = (p: unknown, opts = existe) => verifierDescription({ pistes: [p] }, opts).erreurs.join("\n");

describe("musiques.json : la vérification refuse ce qui ne peut pas être publié", () => {
  it("accepte un morceau complet", () => {
    expect(verifierDescription({ pistes: [bon] }, existe).erreurs).toEqual([]);
    expect(verifierDescription({ pistes: [] }, existe).erreurs).toEqual([]);
  });

  it("refuse un morceau sans licence, ou avec une licence qui n'est pas admise", () => {
    const { licence: _l, ...sans } = bon;
    expect(erreursDe(sans)).toContain("licence");
    expect(erreursDe({ ...bon, licence: "tous droits réservés" })).toContain("n'est pas admise");
    expect(erreursDe({ ...bon, licence: "" })).toContain("licence");
  });

  it("refuse un jeu inconnu, un morceau sans jeu", () => {
    expect(erreursDe({ ...bon, jeux: ["track", "tetris"] })).toContain("« tetris » est inconnu");
    expect(erreursDe({ ...bon, jeux: [] })).toContain("« jeux »");
    expect(erreursDe({ ...bon, jeux: undefined })).toContain("« jeux »");
    expect(erreursDe({ ...bon, jeux: ["tous", "portail"] })).toBe("");
  });

  it("exige le crédit en CC-BY et la source en CC0, CC-BY et achetée", () => {
    expect(erreursDe({ ...bon, licence: "CC-BY-4.0", source: "https://exemple.org/x" })).toContain("« credit » obligatoire");
    expect(erreursDe({ ...bon, licence: "CC-BY-4.0", credit: "Musique de X (CC BY 4.0)" })).toContain("« source » obligatoire");
    expect(erreursDe({ ...bon, licence: "CC-BY-4.0", credit: "Musique de X (CC BY 4.0)", source: "https://exemple.org/x" })).toBe("");
    expect(erreursDe({ ...bon, licence: "CC0" })).toContain("« source » obligatoire");
    expect(erreursDe({ ...bon, licence: "achetee" })).toContain("« source » obligatoire");
  });

  it("refuse l'identifiant mal formé ou en double, le fichier absent ou d'un format inconnu, un champ inconnu", () => {
    expect(erreursDe({ ...bon, id: "Premier Jour" })).toContain("« id »");
    expect(verifierDescription({ pistes: [bon, bon] }, existe).erreurs.join("\n")).toContain("déjà utilisé");
    expect(erreursDe(bon, { fichierExiste: () => false })).toContain("n'existe pas");
    expect(erreursDe({ ...bon, fichier: "x.txt" })).toContain("format");
    expect(erreursDe({ ...bon, fichier: "../secret.mp3" })).toContain("« fichier »");
    expect(erreursDe({ ...bon, licnce: "CC0" })).toContain("champ inconnu « licnce »");
    expect(erreursDe({ ...bon, poids: 0 })).toContain("« poids »");
    expect(erreursDe({ ...bon, volumeDb: 40 })).toContain("« volumeDb »");
    expect(verifierDescription({}, existe).erreurs[0]).toContain("pistes");
  });

  it("`tous` désigne Track, Jump et Tower — pas le portail, qui doit être nommé", () => {
    expect(resoudreJeux(["tous"])).toEqual(["track", "jump", "tower"]);
    expect(resoudreJeux(["portail", "tous", "jump"])).toEqual(["track", "jump", "tower", "portail"]);
    expect(resoudreJeux(["tetris"])).toEqual([]);
  });

  it("le crédit : celui de l'auteur, sinon « Titre — Artiste » (avec CC0 pour le domaine public)", () => {
    expect(creditDe({ titre: "T", artiste: "A", licence: "mienne" })).toBe("« T » — A");
    expect(creditDe({ titre: "T", artiste: "A", licence: "CC0" })).toBe("« T » — A (CC0)");
    expect(creditDe({ titre: "T", artiste: "A", licence: "CC-BY-4.0", credit: " Musique de A (CC BY 4.0) " })).toBe("Musique de A (CC BY 4.0)");
  });
});

describe("la liste par jeu", () => {
  const l = liste(piste("a", { jeux: ["track"] }), piste("b", { jeux: ["jump", "tower"] }), piste("c", { jeux: ["track", "jump", "tower"] }), piste("d", { jeux: ["portail"] }));
  it("chaque jeu n'a que ses morceaux, dans l'ordre de la liste", () => {
    expect(pistesDuJeu(l, "track").map((p) => p.id)).toEqual(["a", "c"]);
    expect(pistesDuJeu(l, "jump").map((p) => p.id)).toEqual(["b", "c"]);
    expect(pistesDuJeu(l, "tower").map((p) => p.id)).toEqual(["b", "c"]);
    expect(pistesDuJeu(l, "portail").map((p) => p.id)).toEqual(["d"]);
  });
});

describe("les scènes d'un morceau (menu, un thème de niveaux)", () => {
  const avec = (scenes: unknown, jeux: string[] = ["track"]) => erreursDe({ ...bon, jeux, scenes });
  it("accepte menu et les thèmes connus du jeu, refuse une faute de frappe, une scène d'un autre jeu, un format invalide ou une liste vide", () => {
    expect(avec(["menu", "theme:nuit"])).toBe("");
    expect(avec(["theme:nuit"], ["jump"])).toBe("");
    expect(avec(["theme:foret"], ["track"])).toContain("n'existe dans aucun de ses jeux");
    expect(avec(["theme:foret"], ["track", "jump"])).toBe(""); // la forêt existe dans Jump, un des deux jeux du morceau
    expect(avec(["theme:nnuit"])).toContain("n'existe dans aucun");
    expect(avec(["Theme Nuit"])).toContain("n'est pas une scène");
    expect(avec([])).toContain("au moins une scène");
    expect(avec("menu")).toContain("une liste");
  });

  it("chaque scène connue a le bon format, et chaque jeu a au moins « menu »", () => {
    for (const [jeu, scenes] of Object.entries(SCENES)) {
      expect(scenes, jeu).toContain("menu");
      for (const s of scenes) expect(FORMAT_SCENE.test(s), `${jeu} : ${s}`).toBe(true);
    }
  });
});
