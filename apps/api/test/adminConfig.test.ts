import { describe, expect, it } from "vitest";
import { ConfigError, readConfig } from "../src/config";
import { ADMIN_EMAIL, CLIENT_ID, SESSION_KEY } from "./adminHelpers";

// Lot N1 : la configuration du panneau d'administration. Le vérificateur factice (qui accepte n'importe quelle connexion « factice:<adresse> ») ne doit jamais
// tourner en ligne : `readConfig` lève une erreur, et `server.ts` s'arrête sur toute `ConfigError` (« configuration refusée », code de sortie 1).

const PROD = { NODE_ENV: "production", ENVIRONMENT: "production", TURSO_DATABASE_URL: "libsql://dailytrack-misterzcool.turso.io", ALLOWED_ORIGINS: "https://playdujour.com", RATE_SALT: "un-sel-de-test-assez-long" };
const RECETTE = { NODE_ENV: "production", ENVIRONMENT: "recette", TURSO_DATABASE_URL: "libsql://dailytrack-recette-misterzcool.turso.io", ALLOWED_ORIGINS: "https://recette.playdujour.com", RATE_SALT: "un-sel-de-test-assez-long" };

describe("vérificateur factice du panneau d'administration", () => {
  it("est permis en local (et en CI)", () => {
    expect(readConfig({ ADMIN_FAKE_VERIFIER: "1" }).admin.fakeVerifier).toBe(true);
    expect(readConfig({ ENVIRONMENT: "local", ADMIN_FAKE_VERIFIER: "true" }).admin.fakeVerifier).toBe(true);
    expect(readConfig({}).admin.fakeVerifier).toBe(false);
    expect(readConfig({ ADMIN_FAKE_VERIFIER: "0" }).admin.fakeVerifier).toBe(false);
    expect(readConfig({ ADMIN_FAKE_VERIFIER: "" }).admin.fakeVerifier).toBe(false);
  });

  it("est refusé au démarrage en production : le serveur s'arrête", () => {
    expect(() => readConfig({ ...PROD, ADMIN_FAKE_VERIFIER: "1" })).toThrow(ConfigError);
    expect(() => readConfig({ ...PROD, ADMIN_FAKE_VERIFIER: "1" })).toThrow(/ADMIN_FAKE_VERIFIER/);
    expect(() => readConfig({ ...PROD, ENVIRONMENT: undefined, ADMIN_FAKE_VERIFIER: "1" })).toThrow(ConfigError); // l'image Docker pose NODE_ENV=production seul
    expect(readConfig(PROD).admin.fakeVerifier).toBe(false); // sans la variable, la production démarre
  });

  it("est refusé au démarrage en recette", () => {
    expect(() => readConfig({ ...RECETTE, ADMIN_FAKE_VERIFIER: "1" })).toThrow(ConfigError);
    expect(() => readConfig({ ENVIRONMENT: "recette", TURSO_DATABASE_URL: RECETTE.TURSO_DATABASE_URL, ADMIN_FAKE_VERIFIER: "1" })).toThrow(ConfigError);
    expect(readConfig(RECETTE).admin.fakeVerifier).toBe(false);
  });

  it("est refusé sur Cloud Run, quel que soit l'environnement déclaré", () => {
    expect(() => readConfig({ K_SERVICE: "cdj-api", TURSO_DATABASE_URL: "libsql://dailytrack-x.turso.io", ADMIN_FAKE_VERIFIER: "1" })).toThrow(ConfigError);
  });

  it("une valeur qui n'est ni 1, ni true, ni 0 est refusée plutôt que lue de travers", () => {
    expect(() => readConfig({ ADMIN_FAKE_VERIFIER: "oui" })).toThrow(ConfigError);
  });
});

describe("configuration du panneau", () => {
  it("lit la liste d'adresses, la clé de session, l'identifiant client, l'étiquette et le commit", () => {
    const c = readConfig({
      ...PROD,
      ADMIN_EMAILS: `${ADMIN_EMAIL}, Autre@Example.test`,
      ADMIN_SESSION_KEY: SESSION_KEY,
      ADMIN_GOOGLE_CLIENT_ID: CLIENT_ID,
      RELEASE_TAG: "prod-2026-10-28-1405",
      GIT_SHA: "0123456789abcdef0123456789abcdef01234567",
    }).admin;
    expect(c).toMatchObject({ emails: [ADMIN_EMAIL, "autre@example.test"], sessionKey: SESSION_KEY, clientId: CLIENT_ID, releaseTag: "prod-2026-10-28-1405", fakeVerifier: false, avertissements: [] });
    expect(c.commit).toBe("0123456789abcdef0123456789abcdef01234567");
  });

  it("une clé de session trop courte la retire (le panneau est désactivé) et le dit, sans jamais en répéter la valeur", () => {
    const c = readConfig({ ...PROD, ADMIN_EMAILS: ADMIN_EMAIL, ADMIN_GOOGLE_CLIENT_ID: CLIENT_ID, ADMIN_SESSION_KEY: "trop-courte" }).admin;
    expect(c.sessionKey).toBeUndefined();
    expect(c.avertissements.join(" ")).toMatch(/ADMIN_SESSION_KEY trop courte/);
    expect(JSON.stringify(c.avertissements)).not.toContain("trop-courte");
    expect(JSON.stringify(c.avertissements)).not.toContain(ADMIN_EMAIL);
  });

  it("des adresses sans identifiant client : avertissement ; des entrées qui ne sont pas des adresses : ignorées et comptées", () => {
    const c = readConfig({ ...PROD, ADMIN_EMAILS: `${ADMIN_EMAIL} pas-une-adresse`, ADMIN_SESSION_KEY: SESSION_KEY }).admin;
    expect(c.emails).toEqual([ADMIN_EMAIL]);
    expect(c.avertissements).toEqual(["ADMIN_EMAILS : 1 entrée(s) ignorée(s), ce ne sont pas des adresses", "ADMIN_EMAILS sans ADMIN_GOOGLE_CLIENT_ID : le panneau d'administration est désactivé"]);
    expect(JSON.stringify(c.avertissements)).not.toContain(ADMIN_EMAIL);
  });

  it("un identifiant client mal formé arrête le démarrage ; une étiquette ou un commit mal formés sont ignorés", () => {
    expect(() => readConfig({ ...PROD, ADMIN_GOOGLE_CLIENT_ID: "pas-un-identifiant" })).toThrow(ConfigError);
    const c = readConfig({ ...PROD, RELEASE_TAG: "n'importe quoi", GIT_SHA: "pas-un-commit" }).admin;
    expect(c.releaseTag).toBeUndefined();
    expect(c.commit).toBeUndefined();
  });
});
