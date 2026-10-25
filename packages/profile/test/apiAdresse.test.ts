import { describe, expect, it } from "vitest";
import { apiFromAddress } from "../src/apiAdresse";

// Lot R7 : `?api=` sur la production ne mène jamais l'identifiant secret hors du site.
describe("apiFromAddress : l'adresse de l'API lue dans ?api=", () => {
  const origin = "https://playdujour.com";

  it("hors production (recette, aperçus, développement) : tout passe, comme avant", () => {
    expect(apiFromAddress("https://x.run.app", false, origin)).toBe("https://x.run.app");
    expect(apiFromAddress("https://pirate.example", false)).toBe("https://pirate.example");
    expect(apiFromAddress("", false)).toBeNull();
    expect(apiFromAddress(null, false)).toBeNull();
  });

  it("en production : `/`, `demo`, la même origine et la machine locale seulement", () => {
    expect(apiFromAddress("/", true, origin)).toBe("/");
    expect(apiFromAddress("demo", true, origin)).toBe("demo");
    expect(apiFromAddress("https://playdujour.com", true, origin)).toBe("https://playdujour.com");
    expect(apiFromAddress("https://playdujour.com/", true, origin)).toBe("https://playdujour.com/");
    expect(apiFromAddress("http://localhost:8787", true, origin)).toBe("http://localhost:8787");
    expect(apiFromAddress("http://127.0.0.1:8788", true, origin)).toBe("http://127.0.0.1:8788");
  });

  it("en production : tout autre serveur est refusé (le lien piégé ne reçoit rien)", () => {
    for (const piege of [
      "https://pirate.example",
      "https://pirate.example/api",
      "https://playdujour.com.pirate.example",
      "https://playdujour.com@pirate.example",
      "https://user:pw@playdujour.com",
      "http://playdujour.com", // autre schéma = autre origine
      "https://recette.playdujour.com",
      "//pirate.example",
      "javascript:alert(1)",
      "data:text/plain,x",
      "https://localhost.pirate.example",
      "pirate.example",
    ]) {
      expect(apiFromAddress(piege, true, origin), piege).toBeNull();
    }
  });
});
