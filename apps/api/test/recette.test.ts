import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ConfigError, assertDatabaseMatches, databaseName, readConfig, readEnvironment, recetteSeedTarget } from "../src/config";
import { SERVER_PATHS, TAG_MAX, previewSlug, recetteTag, shortHash, taggedUrl, touchesServer } from "../../../scripts/recette.mjs";

// Lot R1 (plateforme) : l'environnement de recette. Configuration (`ENVIRONMENT`, règle des noms de base) et étiquette des révisions.

const prod = { NODE_ENV: "production", ALLOWED_ORIGINS: "https://nathan-te.github.io", TURSO_DATABASE_URL: "libsql://dailytrack-misterzcool.turso.io", TURSO_AUTH_TOKEN: "jeton", RATE_SALT: "un-sel-assez-long-123" };
// Le service de recette tourne sur la même image (NODE_ENV=production) avec sa propre base.
const recette = { ...prod, ENVIRONMENT: "recette", K_SERVICE: "cdj-api-recette", TURSO_DATABASE_URL: "libsql://dailytrack-recette-misterzcool.turso.io" };

describe("nom de la base", () => {
  it("Turso : le premier élément du nom d'hôte ; local : le nom du fichier", () => {
    expect(databaseName("libsql://dailytrack-misterzcool.turso.io")).toBe("dailytrack-misterzcool");
    expect(databaseName("libsql://DailyTrack-Recette-x.aws-eu-west-1.turso.io")).toBe("dailytrack-recette-x");
    expect(databaseName("https://cdj-recette-nathan.turso.io/")).toBe("cdj-recette-nathan");
    expect(databaseName("http://127.0.0.1:8081")).toBe("127");
    expect(databaseName("file:./data/recette.db")).toBe("recette.db");
    expect(databaseName("./data/cdj.sqlite")).toBe("cdj.sqlite");
    expect(databaseName(":memory:")).toBe(":memory:");
  });

  it("un mot « recette » caché dans le chemin ou la requête ne compte pas", () => {
    expect(databaseName("libsql://cdj-nathan.turso.io/recette")).toBe("cdj-nathan");
    expect(databaseName("https://cdj-nathan.turso.io?recette=1")).toBe("cdj-nathan");
    expect(databaseName("file:/recette/cdj.db")).toBe("cdj.db");
  });

  it("recette : le nom doit contenir « recette » ; production : jamais", () => {
    expect(() => assertDatabaseMatches("recette", "libsql://dailytrack-recette-x.turso.io")).not.toThrow();
    expect(() => assertDatabaseMatches("recette", "libsql://dailytrack-misterzcool.turso.io")).toThrow(/recette/);
    expect(() => assertDatabaseMatches("production", "libsql://dailytrack-misterzcool.turso.io")).not.toThrow();
    expect(() => assertDatabaseMatches("production", "libsql://dailytrack-recette-x.turso.io")).toThrow(ConfigError);
    expect(() => assertDatabaseMatches("local", "libsql://dailytrack-recette-x.turso.io")).not.toThrow();
  });
});

describe("ENVIRONMENT", () => {
  it("absente : production si NODE_ENV=production (déploiements d'avant le lot R1), sinon local", () => {
    expect(readEnvironment({ NODE_ENV: "production" })).toBe("production");
    expect(readEnvironment({})).toBe("local");
    expect(readConfig(prod).environment).toBe("production");
    expect(readConfig({}).environment).toBe("local");
  });

  it("refuse une valeur inconnue", () => {
    expect(() => readEnvironment({ ENVIRONMENT: "staging" })).toThrow(/ENVIRONMENT/);
    expect(() => readConfig({ ENVIRONMENT: "Recette" })).toThrow(ConfigError);
  });

  it("production : refusée sur une base de recette (ENVIRONMENT écrite ou déduite de NODE_ENV)", () => {
    expect(() => readConfig({ ...prod, ENVIRONMENT: "production", TURSO_DATABASE_URL: "libsql://dailytrack-recette-x.turso.io" })).toThrow(/contient « recette »/);
    expect(() => readConfig({ ...prod, TURSO_DATABASE_URL: "libsql://dailytrack-recette-x.turso.io" })).toThrow(/contient « recette »/);
    expect(readConfig({ ...prod, ENVIRONMENT: "production" })).toMatchObject({ environment: "production", production: true });
  });

  it("recette : refusée sur une base dont le nom ne contient pas « recette »", () => {
    expect(() => readConfig({ ...recette, TURSO_DATABASE_URL: prod.TURSO_DATABASE_URL })).toThrow(/ne contient pas « recette »/);
    expect(() => readConfig({ ENVIRONMENT: "recette", DB_PATH: "./data/cdj.sqlite" })).toThrow(/ne contient pas « recette »/);
    expect(readConfig({ ENVIRONMENT: "recette", DB_PATH: "./data/recette.sqlite" }).environment).toBe("recette");
  });

  it("recette : l'horloge de test et le Salon court sont permis, même sur Cloud Run avec l'image de production", () => {
    const c = readConfig({ ...recette, TEST_CLOCK_OFFSET_MS: "-3600000", SALON_MINUTES: "2" });
    expect(c).toMatchObject({ environment: "recette", testClockOffsetMs: -3_600_000, salonMinutes: 2 });
    expect(() => readConfig({ ...recette, TEST_CLOCK_OFFSET_MS: "demain" })).toThrow(/TEST_CLOCK_OFFSET_MS/);
  });

  it("recette : les règles d'un serveur en ligne restent (origines, sel, Turso sur Cloud Run)", () => {
    expect(readConfig(recette).production).toBe(true);
    expect(() => readConfig({ ...recette, ALLOWED_ORIGINS: "" })).toThrow(/ALLOWED_ORIGINS/);
    expect(() => readConfig({ ...recette, RATE_SALT: "court" })).toThrow(/RATE_SALT/);
    expect(() => readConfig({ ...recette, TURSO_DATABASE_URL: "" })).toThrow(/TURSO_DATABASE_URL/);
  });

  it("production : rien ne change, l'horloge de test et le Salon court restent refusés", () => {
    for (const p of [prod, { ...prod, ENVIRONMENT: "production" }, { ...prod, ENVIRONMENT: "production", NODE_ENV: undefined }]) {
      expect(() => readConfig({ ...p, SALON_MINUTES: "2" })).toThrow(/SALON_MINUTES/);
      expect(() => readConfig({ ...p, TEST_CLOCK_OFFSET_MS: "1000" })).toThrow(/TEST_CLOCK_OFFSET_MS/);
    }
    expect(() => readConfig({ K_SERVICE: "cdj-api", TURSO_DATABASE_URL: "libsql://x", TEST_CLOCK_OFFSET_MS: "1000" })).toThrow(/TEST_CLOCK_OFFSET_MS/);
  });

  it("local : refusée sur Cloud Run (un service déployé est production ou recette)", () => {
    expect(() => readConfig({ ...prod, ENVIRONMENT: "local", K_SERVICE: "cdj-api" })).toThrow(/ENVIRONMENT=local/);
    expect(readConfig({ ENVIRONMENT: "local", SALON_MINUTES: "2" }).salonMinutes).toBe(2);
  });
});

describe("recette:seed refuse la production", () => {
  it("exige ENVIRONMENT=recette", () => {
    expect(() => recetteSeedTarget({ TURSO_DATABASE_URL: "libsql://dailytrack-recette-x.turso.io" })).toThrow(/ENVIRONMENT=recette/);
    expect(() => recetteSeedTarget({ ENVIRONMENT: "production", TURSO_DATABASE_URL: "libsql://dailytrack-recette-x.turso.io" })).toThrow(/ENVIRONMENT=recette/);
  });

  it("exige une base dont le nom contient « recette »", () => {
    expect(() => recetteSeedTarget({ ENVIRONMENT: "recette", TURSO_DATABASE_URL: prod.TURSO_DATABASE_URL })).toThrow(/ne contient pas « recette »/);
    expect(() => recetteSeedTarget({ ENVIRONMENT: "recette" })).toThrow(/ne contient pas « recette »/); // SQLite par défaut : ./data/cdj.sqlite
  });

  it("donne la base de recette", () => {
    expect(recetteSeedTarget({ ENVIRONMENT: "recette", TURSO_DATABASE_URL: "libsql://dailytrack-recette-x.turso.io", TURSO_AUTH_TOKEN: "j" })).toEqual({ kind: "turso", url: "libsql://dailytrack-recette-x.turso.io", authToken: "j" });
    expect(recetteSeedTarget({ ENVIRONMENT: "recette", DB_PATH: "/tmp/recette.sqlite" })).toEqual({ kind: "sqlite", path: "/tmp/recette.sqlite" });
  });
});

describe("étiquette de la révision de recette (partagée par les workflows de recette et de Pages)", () => {
  const branches = ["main", "lot-R1-recette", "Lot-R1-recette", "claude/dailyjump-lot-8b-animation-elan", "claude/dailyjump-lot-8b-animation-elan-2", "été/ça", "___", "a".repeat(200), "ccr-9cb88ba0-62npko"];

  it("minuscules, chiffres et tirets, commence par une lettre, finit par l'empreinte, longueur bornée", () => {
    for (const b of branches) {
      const t = recetteTag(b);
      expect(t, b).toMatch(/^b-[a-z0-9-]*[a-z0-9]$/);
      expect(t, b).not.toMatch(/--/);
      expect(t.length, b).toBeLessThanOrEqual(TAG_MAX);
      expect(t.endsWith(shortHash(b)), b).toBe(true);
    }
  });

  it("stable, et deux branches différentes n'ont jamais la même étiquette", () => {
    expect(recetteTag("lot-R1-recette")).toBe(recetteTag("lot-R1-recette"));
    expect(recetteTag("lot-R1-recette")).toBe("b-lot-r1-recette-3qt7yb"); // valeur figée : changer la règle change l'adresse de toutes les révisions
    const tags = new Set(branches.map(recetteTag));
    expect(tags.size).toBe(branches.length);
    expect(recetteTag("Lot-R1-recette")).not.toBe(recetteTag("lot-R1-recette"));
  });

  it("l'adresse de la révision tient dans un nom d'hôte (63 caractères par élément)", () => {
    for (const service of ["https://cdj-api-recette-5qi6aa4qqa-ew.a.run.app", "https://cdj-api-recette-123456789012.europe-west1.run.app/"]) {
      for (const b of branches) {
        const url = taggedUrl(service, recetteTag(b));
        expect(url).toMatch(/^https:\/\/b-[a-z0-9-]+---cdj-api-recette-/);
        expect(new URL(url).hostname.split(".")[0]!.length).toBeLessThanOrEqual(63);
      }
    }
    expect(taggedUrl("https://s-abc-ew.a.run.app", "b-x-000001")).toBe("https://b-x-000001---s-abc-ew.a.run.app");
    expect(() => taggedUrl("http://s.run.app", "b-x")).toThrow();
    expect(() => taggedUrl("https://b-x---s.run.app", "b-y")).toThrow(/déjà/);
    expect(() => recetteTag("")).toThrow();
  });

  it("dossier de l'aperçu Pages : inchangé depuis avant le lot R1 (`/` → `-`)", () => {
    expect(previewSlug("claude/dailyjump-lot-9-themes")).toBe("claude-dailyjump-lot-9-themes");
    expect(previewSlug("lot-R1-recette")).toBe("lot-R1-recette");
  });

  it("la ligne de commande donne la même chose que les fonctions", async () => {
    const { execFileSync } = await import("node:child_process");
    const script = join(__dirname, "../../../scripts/recette.mjs");
    expect(execFileSync("node", [script, "tag", "claude/x"], { encoding: "utf8" }).trim()).toBe(recetteTag("claude/x"));
    expect(execFileSync("node", [script, "slug", "claude/x"], { encoding: "utf8" }).trim()).toBe("claude-x");
    expect(execFileSync("node", [script, "url", "https://s-h-ew.a.run.app", "claude/x"], { encoding: "utf8" }).trim()).toBe(`https://${recetteTag("claude/x")}---s-h-ew.a.run.app`);
    expect(execFileSync("node", [script, "touches-server"], { input: "docs/a.md\napps/api/src/x.ts\n", encoding: "utf8" }).trim()).toBe("true");
  });
});

describe("code du serveur (déclencheurs de la recette et du déploiement)", () => {
  it("reconnaît le serveur et ses dépendances, pas le jeu ni la documentation", () => {
    for (const f of ["apps/api/src/api.ts", "packages/sim/src/car.ts", "packages/core/src/rng.ts", "packages/clock/src/paris.ts", "packages/jump-sim/src/player.ts", "apps/jump/public/levels/2026-10-18.json", "package-lock.json", ".github/workflows/deploy-api.yml"]) {
      expect(touchesServer([f]), f).toBe(true);
    }
    for (const f of ["apps/web/src/main.ts", "apps/jump/src/main.ts", "docs/plateforme/recette.md", "CLAUDE.md", "apps/jump/public/levels.txt", "packages/simulation/x.ts"]) {
      expect(touchesServer([f]), f).toBe(false);
    }
  });

  it("`on.pull_request.paths` de recette.yml est exactement `SERVER_PATHS`", () => {
    const yml = readFileSync(join(__dirname, "../../../.github/workflows/recette.yml"), "utf8");
    const block = /pull_request:\n(?:.*\n)*?\s+paths:\n((?:\s+- .*\n)+)/.exec(yml);
    expect(block).not.toBeNull();
    const paths = [...block![1]!.matchAll(/- "([^"]+)"/g)].map((m) => m[1]);
    expect(paths).toEqual(SERVER_PATHS);
  });
});
