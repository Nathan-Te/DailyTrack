import { describe, expect, it } from "vitest";
import { estLocale, hoteDe, refusDistantEnTest, refusSansDistant } from "../src/distant";
import { openLibsql } from "../src/libsql-open";

// Lot R14 : rien n'écrit dans Turso sans raison. Les tests restent locaux ; un script qui vise une base distante exige `--distant`.
describe("cibles locales et distantes", () => {
  it("reconnaît l'hôte", () => {
    expect(hoteDe("libsql://dailytrack-recette-x.aws-eu-west-1.turso.io")).toBe("dailytrack-recette-x.aws-eu-west-1.turso.io");
    expect(hoteDe("http://127.0.0.1:8081")).toBe("127.0.0.1");
    expect(hoteDe("file:/tmp/a.db")).toBeNull();
    expect(hoteDe(":memory:")).toBeNull();
  });

  it("local : fichier, mémoire, boucle locale", () => {
    for (const a of ["file:/tmp/a.db", ":memory:", "http://127.0.0.1:8081", "http://localhost:8080", "ws://[::1]:8080"]) expect(estLocale(a), a).toBe(true);
    for (const a of ["libsql://x.turso.io", "https://x.turso.io", "wss://x.turso.io", "http://recette.local:8081"]) expect(estLocale(a), a).toBe(false);
  });

  it("un script vers une base distante exige --distant et ne montre que l'hôte", () => {
    const refus = refusSansDistant("libsql://dailytrack-recette-x.turso.io", ["--days", "7"], "recette:seed écrit des joueurs fictifs.");
    expect(refus).toMatch(/--distant/);
    expect(refus).toMatch(/dailytrack-recette-x\.turso\.io/);
    expect(refusSansDistant("libsql://dailytrack-recette-x.turso.io", ["--distant"], "…")).toBeNull();
    expect(refusSansDistant("file:/tmp/recette.db", [], "…")).toBeNull();
  });

  it("un test ne reçoit jamais une adresse distante", async () => {
    expect(refusDistantEnTest("libsql://x.turso.io")).toMatch(/jamais dans un test/);
    expect(refusDistantEnTest("file:/tmp/a.db")).toBeNull();
    // `openLibsql` lui-même refuse, avant de créer un client, tant que Vitest tourne.
    await expect(openLibsql({ url: "libsql://dailytrack-recette-x.turso.io", authToken: "jeton" })).rejects.toThrow(/jamais dans un test/);
  });
});
