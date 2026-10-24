import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { daysFromCivil, formatDay } from "@cdj/core";
import { MAX_BODY_BYTES } from "../src/api";
import { CODES_ERREUR, estCodeErreur, type CodeErreur } from "../src/codesErreur";
import { HttpError } from "../src/errors";
import { salonSessionAt } from "@cdj/sim";
import { DAY, TEST_DB, makeApi, parisDayStart, playerId, verifierErreur, type TestApi } from "./helpers";

// Lot I1 (plateforme) : chaque réponse d'erreur du serveur porte un code de la liste unique (`src/codesErreur.ts`), avec le statut de la liste
// et aucun message (lot I6). (1) Parcours des routes : toutes les routes connues, chaque méthode, des corps vides, illisibles ou trop gros, avec et sans
// identifiant de joueur ou jeton d'admin. (2) Les sources : chaque `HttpError` construit a un code de la liste et son statut ; chaque code de la
// liste est rendu quelque part. (3) La documentation (`docs/plateforme/codes-erreur.md`) décrit exactement la liste.
// Les cas d'erreur déjà testés ailleurs sont vérifiés par `makeApi().call` (`verifierErreur`, helpers.ts). SQLite et libSQL.

const TOKEN = "jeton-admin-de-test-0123456789";
const TODAY = daysFromCivil(2026, 10, 20); // un jour où DailyJump a un niveau (le premier : 16/10/2026)
const NOON_TODAY = parisDayStart(TODAY) + 12 * 3_600_000;
const D = formatDay(DAY); // le jour de DailyTrack dont le circuit est en cache (helpers)
const J = formatDay(TODAY);
const S = salonSessionAt(NOON_TODAY); // la session du Salon à l'heure du parcours

/** Les chemins de toutes les routes du registre (communes, DailyTrack, Salon, DailyJump, admin), plus des chemins inconnus et des paramètres faux. */
const ROUTES = [
  // Santé, sonde, inconnues
  "/api/health",
  "/api/sonde/entetes",
  "/api",
  "/api/inconnue",
  "/nimporte-quoi",
  // Communes (identity.ts)
  "/api/player",
  "/api/name",
  "/api/name?name=",
  "/api/name?name=Essai",
  "/api/name?name=x",
  "/api/me",
  "/api/me/code",
  "/api/admin/effacer",
  // DailyTrack (cdj.ts)
  "/api/submit",
  "/api/planning",
  "/api/garage", // lot 41 : identifiant obligatoire dans `X-Player-Id` (400 `invalid_player`, 410 `code_revoked`) ; ajoutée au lot de plateforme « suites de Track 2 »
  `/api/day/${D}`,
  `/api/day/${D}/leaderboard`,
  `/api/day/${D}/leaderboard?player=zz`,
  `/api/day/${D}/ghost`,
  `/api/day/${D}/ghost?kind=autre`,
  `/api/day/${D}/ghost?kind=ahead&player=${playerId(77)}`,
  `/api/day/${D}/autre`,
  "/api/day/pas-une-date",
  "/api/day/%E0", // encodage illisible : 400 `invalid_date` depuis le lot I2 (était 500 `internal` : decodeURIComponent non gardé dans cdj.ts)
  "/api/day/%E0/leaderboard",
  "/api/day/2099-01-01",
  "/api/day/2020-01-01",
  "/api/admin/overview",
  "/api/admin/planning/2099-01-01",
  `/api/admin/planning/${formatDay(TODAY + 5)}`,
  `/api/admin/planning/${J}`,
  "/api/admin/planning/pas-une-date",
  "/api/admin/planning/%E0",
  "/api/admin/inconnue",
  // Salon (salon.ts)
  "/api/salon/now",
  `/api/salon/${S}/board`,
  `/api/salon/${S}/board?since=x`,
  `/api/salon/${S}/ghosts`,
  `/api/salon/${S}/ghosts?refs=pas-une-ref`,
  `/api/salon/${S}/ghosts?refs=${Array.from({ length: 30 }, (_, i) => `r${i}`).join(",")}`,
  `/api/salon/${S}/submit`,
  `/api/salon/${S + 1000}/board`,
  "/api/salon/x/board",
  `/api/salon/${S}/autre`,
  "/api/salon/%ZZ/board",
  // DailyJump (jump.ts, jumpLives.ts)
  "/api/jump",
  "/api/jump/info",
  "/api/jump/submit",
  "/api/jump/lives",
  "/api/jump/me",
  `/api/jump/day/${J}`,
  `/api/jump/day/${J}/board`,
  `/api/jump/day/${J}/ghost/first`,
  `/api/jump/day/${J}/deaths`,
  `/api/jump/day/${J}/carnage`,
  `/api/jump/day/${J}/bundle`,
  "/api/jump/day/2099-01-01/board",
  "/api/jump/day/2026-10-01",
  "/api/jump/day/pas-une-date",
  "/api/jump/day/%ZZ",
  "/api/jump/inconnue",
  // Portail (portail.ts, lot I2)
  "/api/portail",
  "/api/portail/jour",
  "/api/portail/profil",
  "/api/portail/classement",
  "/api/portail/classement?date=2026-02-30",
  "/api/portail/classement?date=2099-01-01",
  "/api/portail/autre",
];

const METHODS = ["GET", "POST", "PUT", "DELETE"] as const;
/** Un corps de bonne forme mais faux à l'étage suivant (rediffusion vide, niveau illisible, vies vides, variante hors limites…). */
const PLAUSIBLE = JSON.stringify({ playerId: playerId(424243), newId: playerId(424244), date: D, replay: "", levelId: "pas-un-niveau", lives: [], variant: -1, code: "CDJ2.abc" });
/** Corps essayés (aucun pour GET) : absent, JSON illisible, un tableau, un objet vide, de bonne forme mais faux, trop gros. */
const BODIES: (string | undefined)[] = [undefined, "{", "[]", "{}", PLAUSIBLE, `{"x":"${"A".repeat(MAX_BODY_BYTES)}"}`];
/** En-têtes essayés : rien, un joueur inconnu, un identifiant illisible, le jeton d'admin. */
const HEADERS: Record<string, string>[] = [{}, { "X-Player-Id": playerId(424242) }, { "X-Player-Id": "pas-un-identifiant" }, { Authorization: `Bearer ${TOKEN}` }];

/** Parcourt routes × méthodes × corps × en-têtes ; rend les erreurs vues et les réponses qui ne suivent pas la règle. */
async function walk(t: TestApi, routes: readonly string[]): Promise<{ errors: number; seen: Map<CodeErreur, number>; bad: string[] }> {
  const seen = new Map<CodeErreur, number>();
  const bad: string[] = [];
  let errors = 0;
  let n = 0;
  for (const headers of HEADERS) {
    for (const route of routes) {
      for (const method of METHODS) {
        for (const raw of method === "GET" ? [undefined] : BODIES) {
          // Une adresse par requête : le débit par adresse ne masque pas les autres refus (il est couvert par ses propres tests).
          const clientKey = `198.18.${(n >> 8) & 255}.${n & 255}`;
          n++;
          const what = `${method} ${route} (corps ${raw === undefined ? "absent" : raw.length > MAX_BODY_BYTES ? "trop gros" : raw}, en-têtes ${Object.keys(headers).join("+") || "aucun"})`;
          try {
            // `call` vérifie déjà la règle (helpers.ts) ; on la revérifie ici pour nommer la requête fautive.
            const r = await t.call(method, route, undefined, { raw, clientKey, headers });
            if (r.status >= 400) {
              errors++;
              verifierErreur(r.status, r.body);
              seen.set(r.body.error, (seen.get(r.body.error) ?? 0) + 1);
            }
          } catch (e) {
            bad.push(`${what} : ${e instanceof Error ? e.message : String(e)}`);
          }
        }
      }
    }
  }
  return { errors, seen, bad };
}

describe(`codes d'erreur : parcours des routes (${TEST_DB})`, () => {
  it("toute réponse d'erreur a un code de la liste, le statut de la liste et aucun message (lot I6)", async () => {
    const t = await makeApi({ adminToken: TOKEN });
    t.clock.now = NOON_TODAY;
    const { errors, seen, bad } = await walk(t, ROUTES);
    expect(bad).toEqual([]);
    expect(errors).toBeGreaterThan(1000);
    // Le parcours atteint bien les refus de chaque étage (route, méthode, corps, identité, date, admin, Salon, DailyJump).
    for (const code of [
      "not_found", "method_not_allowed", "invalid_json", "too_large", "invalid_player", "unknown_player", "invalid_name", "invalid_code",
      "unauthorized", "invalid_date", "unknown_day", "day_closed", "day_started", "too_far", "invalid_variant", "invalid_kind", "no_ghost",
      "invalid_replay", "invalid_session", "unknown_session", "invalid_since", "too_many_refs", "invalid_ref", "invalid_level",
    ] satisfies CodeErreur[]) {
      expect(seen.get(code) ?? 0, `code « ${code} » jamais rendu par le parcours`).toBeGreaterThan(0);
    }
    // Lot I2 : plus aucune erreur interne sur une entrée mal formée (le parcours n'envoie que des entrées fausses, jamais une panne).
    expect(seen.get("internal") ?? 0, "une entrée mal formée a rendu 500 `internal`").toBe(0);
  }, 120_000);

  it("admin désactivé (sans jeton) : ses routes répondent `not_found`, avec le statut de la liste", async () => {
    const t = await makeApi();
    const { errors, seen, bad } = await walk(t, ["/api/admin/overview", `/api/admin/planning/${formatDay(DAY + 5)}`, "/api/admin/effacer", "/api/admin/inconnue"]);
    expect(bad).toEqual([]);
    expect(errors).toBeGreaterThan(0);
    expect([...seen.keys()].filter((c) => c !== "not_found" && c !== "too_large" && c !== "invalid_json" && c !== "method_not_allowed")).toEqual([]);
    expect(seen.get("not_found")).toBeGreaterThan(0);
  }, 60_000);
});

describe("codes d'erreur : la liste", () => {
  it("chaque code a un statut d'erreur HTTP et un sens en français", () => {
    for (const [code, { status, sens }] of Object.entries(CODES_ERREUR)) {
      expect(code, code).toMatch(/^[a-z]+(_[a-z]+)*$/);
      expect(status >= 400 && status <= 599, `${code} : ${status}`).toBe(true);
      expect(sens.length, code).toBeGreaterThan(10);
    }
    expect(estCodeErreur("not_found")).toBe(true);
    expect(estCodeErreur("toString")).toBe(false);
    expect(estCodeErreur(404)).toBe(false);
  });

  it("le typage de HttpError impose le statut de la liste", () => {
    const ok = new HttpError(404, "not_found", "Route inconnue");
    expect(ok.status).toBe(CODES_ERREUR.not_found.status);
    // @ts-expect-error : 400 n'est pas le statut de `not_found` (tsc refuse, `npm run typecheck` le vérifie)
    const wrong = new HttpError(400, "not_found", "Route inconnue");
    expect(wrong.code).toBe("not_found");
    // @ts-expect-error : un code hors de la liste ne compile pas
    expect(new HttpError(400, "pas_un_code", "x").status).toBe(400);
  });
});

describe("codes d'erreur : les sources (apps/api/src)", () => {
  const dir = new URL("../src/", import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith(".ts"));
  const sources = files.map((f) => ({ file: f, text: readFileSync(new URL(f, dir), "utf8") }));

  it("chaque `new HttpError(<statut>, \"<code>\"` a un code de la liste et le statut de la liste", () => {
    const problems: string[] = [];
    let built = 0;
    for (const { file, text } of sources) {
      const all = text.match(/new HttpError\(/g)?.length ?? 0;
      const literal = [...text.matchAll(/new HttpError\(\s*(\d{3})\s*,\s*"([a-z_]+)"/g)];
      if (literal.length !== all) problems.push(`${file} : ${all - literal.length} HttpError sans statut et code écrits en clair`);
      for (const [, status, code] of literal) {
        built++;
        if (!estCodeErreur(code)) problems.push(`${file} : code « ${code} » absent de CODES_ERREUR`);
        else if (CODES_ERREUR[code].status !== Number(status)) problems.push(`${file} : « ${code} » rendu en ${status}, la liste dit ${CODES_ERREUR[code].status}`);
      }
    }
    expect(problems).toEqual([]);
    expect(built).toBeGreaterThan(50);
  });

  it("chaque code de la liste est rendu quelque part (HttpError ou corpsErreur)", () => {
    const used = new Set<string>();
    for (const { text } of sources) {
      for (const [, code] of text.matchAll(/new HttpError\(\s*\d{3}\s*,\s*"([a-z_]+)"/g)) used.add(code!);
      for (const [, code] of text.matchAll(/corpsErreur\(\s*"([a-z_]+)"/g)) used.add(code!);
    }
    expect(Object.keys(CODES_ERREUR).filter((c) => !used.has(c))).toEqual([]);
  });

  it("aucune réponse d'erreur écrite à la main hors de la liste (`error: \"…\"` en clair)", () => {
    const problems: string[] = [];
    for (const { file, text } of sources) {
      if (file === "codesErreur.ts") continue;
      for (const [, code] of text.matchAll(/\berror:\s*"([^"]*)"/g)) problems.push(`${file} : error: "${code}"`);
    }
    expect(problems).toEqual([]);
  });
});

describe("codes d'erreur : la documentation (docs/plateforme/codes-erreur.md)", () => {
  it("une ligne de tableau par code de la liste, avec son statut ; aucun code de plus", () => {
    const doc = readFileSync(new URL("../../../docs/plateforme/codes-erreur.md", import.meta.url), "utf8");
    const rows = [...doc.matchAll(/^\|\s*`([a-z_]+)`\s*\|\s*(\d{3})\s*\|/gm)].map(([, code, status]) => [code!, Number(status)] as const);
    const documented = new Map(rows);
    expect(rows.length, "un code documenté deux fois").toBe(documented.size);
    expect(Object.fromEntries(documented)).toEqual(Object.fromEntries(Object.entries(CODES_ERREUR).map(([c, v]) => [c, v.status])));
  });
});
