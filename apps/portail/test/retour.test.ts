import { describe, expect, it } from "vitest";
import { cheminDuSite, jeuDuChemin, lireRetour } from "../src/retour";

// Lot I4 : `/profil/?retour=<chemin>` ramène au jeu d'où l'on vient — seulement vers un chemin du site, jamais vers une adresse extérieure.
describe("retour du profil : un chemin du site seulement", () => {
  it("accepte les chemins du site", () => {
    for (const ok of ["/", "/track/", "/track", "/jump/", "/a/b/c/", "/mentions-legales/", "/track/index.html"]) expect(cheminDuSite(ok), ok).toBe(ok);
  });

  it("refuse les adresses extérieures, les schémas, les chemins piégés", () => {
    const hostiles = [
      "https://evil.example/",
      "http://evil.example",
      "//evil.example",
      "///evil.example",
      "/\\evil.example",
      "\\evil.example",
      "\\\\evil.example",
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "data:text/html,<script>1</script>",
      "track/",
      "",
      "/..",
      "/../",
      "/track/../../etc",
      "/./track/",
      "/%2e%2e/",
      "/%2E%2E/track/",
      "/track%2F..%2F",
      "/%5Cevil",
      "/track/?a=1",
      "/track/#x",
      "/tr ack/",
      "/track/\n",
      "/ ",
      `/${"a".repeat(200)}`,
    ];
    for (const h of hostiles) expect(cheminDuSite(h), JSON.stringify(h)).toBeNull();
    expect(cheminDuSite(null)).toBeNull();
    expect(cheminDuSite(undefined)).toBeNull();
  });

  it("le jeu vient du chemin (Track, Jump), sinon aucun : aucun nom inventé", () => {
    expect(jeuDuChemin("/track/")).toBe("track");
    expect(jeuDuChemin("/track")).toBe("track");
    expect(jeuDuChemin("/jump/")).toBe("jump");
    expect(jeuDuChemin("/")).toBeNull();
    expect(jeuDuChemin("/track/admin/")).toBeNull();
    expect(jeuDuChemin("/trackx/")).toBeNull();
  });

  it("lit ?retour= dans l'adresse (décodé une fois) ; tout le reste donne le retour par défaut", () => {
    expect(lireRetour("?retour=%2Ftrack%2F")).toEqual({ chemin: "/track/", jeu: "track" });
    expect(lireRetour("?retour=/jump/&x=1")).toEqual({ chemin: "/jump/", jeu: "jump" });
    expect(lireRetour("")).toBeNull();
    expect(lireRetour("?retour=%2F")).toBeNull(); // un chemin du site, mais pas un jeu
    expect(lireRetour("?retour=https%3A%2F%2Fevil.example%2Ftrack%2F")).toBeNull();
    expect(lireRetour("?retour=%2F%2Fevil.example")).toBeNull();
    expect(lireRetour("?retour=%252e%252e")).toBeNull();
    expect(lireRetour("?retour=%2Ftrack%2F&retour=%2F%2Fevil")).toEqual({ chemin: "/track/", jeu: "track" }); // la première valeur
  });
});
