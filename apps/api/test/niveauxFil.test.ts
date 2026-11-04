import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "esbuild";
import { daysFromCivil } from "@cdj/core";
import { parisDayStart } from "@cdj/clock";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApi } from "../src/api";
import { executeurFil } from "../src/jeux/fil";
import type { Logger } from "../src/log";
import { type DemandeNiveau, type ReponseNiveau, DELAI_NIVEAU_MS, calculerNiveau, executeurNiveauxPrincipal } from "../src/niveauxFil";
import { openTestDb, TEST_DB } from "./helpers";

// Lot D3 (C9) : le niveau du lendemain est prêt avant minuit, et le calcul du niveau ne bloque plus le fil principal. **Aucun niveau ne change** : le fil de calcul et le fil principal donnent le même niveau, date par date.

const D = (date: string): number => daysFromCivil(Number(date.slice(0, 4)), Number(date.slice(5, 7)), Number(date.slice(8, 10)));
const dossier = mkdtempSync(join(tmpdir(), "niveaux-fil-"));
const fichier = join(dossier, "niveaux-fil.mjs");

beforeAll(async () => {
  await build({
    entryPoints: [new URL("../src/niveauxFilTravail.ts", import.meta.url).pathname],
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    outfile: fichier,
    banner: { js: "import { createRequire as __cdjRequire } from 'node:module'; const require = __cdjRequire(import.meta.url);" },
    logLevel: "silent",
  });
});
afterAll(() => rmSync(dossier, { recursive: true, force: true }));

type Ligne = { severity: string; message: string; fields: Record<string, unknown> };
function journal(): { log: Logger; lignes: Ligne[] } {
  const lignes: Ligne[] = [];
  return { lignes, log: (severity, message, fields = {}) => void lignes.push({ severity, message, fields }) };
}
const message = (lignes: Ligne[], texte: string) => lignes.filter((l) => l.message === texte);

describe(`le calcul du niveau dans un fil (${TEST_DB})`, () => {
  it("le fil de calcul et le fil principal donnent exactement le même niveau : Jump et Track, plusieurs jours, une variante et un thème imposé", async () => {
    const fil = executeurFil<DemandeNiveau, ReponseNiveau>(fichier, { delaiMs: DELAI_NIVEAU_MS });
    const principal = executeurNiveauxPrincipal();
    try {
      const demandes: DemandeNiveau[] = [
        ...["2026-10-30", "2026-11-12", "2026-12-01"].map((d) => ({ jeu: "jump" as const, day: D(d), fige: undefined })),
        ...["2026-10-14", "2026-11-12", "2026-12-01"].map((d) => ({ jeu: "track" as const, day: D(d), variante: 0, theme: null })),
        { jeu: "track", day: D("2026-11-12"), variante: 2, theme: null },
      ];
      for (const d of demandes) {
        const a = await fil.rejouer(d);
        const b = await principal.rejouer(d);
        expect(a, `${d.jeu} ${d.day}`).toEqual(b);
        expect(a).toEqual(calculerNiveau(d));
      }
    } finally {
      await fil.fermer?.();
    }
  }, 120_000);

  it("de bout en bout : un serveur dont le niveau vient du fil rend les mêmes réponses qu'un serveur qui calcule sur place (Track, Jump, portail)", async () => {
    const jour = D("2026-11-12");
    const horloge = parisDayStart(jour) + 12 * 3_600_000;
    const fil = executeurFil<DemandeNiveau, ReponseNiveau>(fichier, { delaiMs: DELAI_NIVEAU_MS });
    const dbA = await openTestDb();
    const dbB = await openTestDb();
    try {
      const A = createApi({ db: dbA, now: () => horloge, niveauxExecuteur: fil, allowCopies: true });
      const B = createApi({ db: dbB, now: () => horloge, allowCopies: true });
      const lire = async (api: ReturnType<typeof createApi>, chemin: string) => {
        const r = await api.handle(new Request(`http://api.test${chemin}`), { clientKey: "203.0.113.7" });
        return { status: r.status, corps: await r.json() };
      };
      for (const chemin of ["/api/day/2026-11-12", "/api/jump/day/2026-11-12", "/api/portail/jour"]) {
        const a = await lire(A, chemin);
        const b = await lire(B, chemin);
        expect(a.status, chemin).toBe(200);
        expect(a, chemin).toEqual(b);
      }
      // Ce que le fil a calculé est ce qui est gardé en base : le circuit et le niveau sont les mêmes que sur place.
      const ligne = (db: typeof dbA, table: string) => db.first<Record<string, unknown>>(`SELECT * FROM ${table} WHERE day = ?`, [jour]);
      const sansHorodatage = (r: Record<string, unknown> | null) => {
        const { created_at: _c, ...reste } = r ?? {};
        return reste;
      };
      expect(sansHorodatage(await ligne(dbA, "circuits"))).toEqual(sansHorodatage(await ligne(dbB, "circuits")));
      expect(sansHorodatage(await ligne(dbA, "jump_levels"))).toEqual(sansHorodatage(await ligne(dbB, "jump_levels")));
    } finally {
      await fil.fermer?.();
      dbA.close();
      dbB.close();
    }
  }, 120_000);
});

describe(`le niveau du lendemain, prêt avant minuit (${TEST_DB})`, () => {
  const jour = D("2026-11-12");
  const minuit = parisDayStart(jour + 1);
  const quand = { trenteCinq: minuit - 25 * 60_000, quinze: minuit - 15 * 60_000, vingtH: minuit - 4 * 3_600_000 };

  it("avant 23 h 30 une requête ne prépare rien ; dans la demi-heure d'avant minuit elle lance la préparation sans l'attendre, et minuit ne calcule plus rien", async () => {
    const db = await openTestDb();
    const { log, lignes } = journal();
    const horloge = { now: quand.vingtH };
    const fil = executeurFil<DemandeNiveau, ReponseNiveau>(fichier, { delaiMs: DELAI_NIVEAU_MS });
    try {
      const soir = createApi({ db, now: () => horloge.now, niveauxExecuteur: fil, allowCopies: true, log });
      const get = async (api: ReturnType<typeof createApi>, chemin: string) => api.handle(new Request(`http://api.test${chemin}`), { clientKey: "203.0.113.7" });

      // 20 h : rien n'est préparé.
      expect((await get(soir, "/api/portail/jour")).status).toBe(200);
      expect(soir.preparerLeLendemain()).toBeNull();
      expect(message(lignes, "niveau du lendemain prêt")).toHaveLength(0);
      expect(await db.first("SELECT 1 AS ok FROM circuits WHERE day = ?", [jour + 1])).toBeNull();

      // 23 h 35 : la requête qui arrive lance la préparation, et sa réponse ne l'attend pas.
      horloge.now = quand.trenteCinq;
      const t0 = performance.now();
      expect((await get(soir, "/api/portail/jour")).status).toBe(200);
      const reponseMs = performance.now() - t0;
      const en = soir.preparerLeLendemain();
      expect(en, "la préparation est en cours ou finie").not.toBe(undefined);
      await en;
      const prets = message(lignes, "niveau du lendemain prêt");
      expect(prets.map((l) => l.fields.jeu).sort()).toEqual(["cdj", "jump"]); // Tower est éteint (absent de la table `jeux`) : rien à préparer
      expect(prets.every((l) => l.fields.jour === "2026-11-13")).toBe(true);
      expect(reponseMs).toBeLessThan(3000);
      expect(await db.first("SELECT 1 AS ok FROM circuits WHERE day = ?", [jour + 1])).not.toBeNull();
      expect(await db.first("SELECT 1 AS ok FROM jump_levels WHERE day = ?", [jour + 1])).not.toBeNull();
      // Une seconde requête de la demi-heure ne refait rien.
      await get(soir, "/api/portail/jour");
      await soir.preparerLeLendemain();
      expect(message(lignes, "niveau du lendemain prêt")).toHaveLength(2);

      // Minuit, une instance neuve : elle lit les niveaux en base et ne calcule ni circuit ni niveau.
      const autre = journal();
      horloge.now = minuit + 2_000;
      const matin = createApi({ db, now: () => horloge.now, allowCopies: true, log: autre.log });
      const r = await get(matin, "/api/portail/jour");
      expect(r.status).toBe(200);
      const corps = (await r.json()) as { date: string; jeux: { jeu: string; numero: number | null; theme: string | null }[] };
      expect(corps.date).toBe("2026-11-13");
      expect(corps.jeux.every((j) => j.numero !== null && j.theme !== null)).toBe(true);
      expect(message(autre.lignes, "circuit du jour généré")).toHaveLength(0);
      expect(message(autre.lignes, "DailyJump : niveau du jour calculé")).toHaveLength(0);
    } finally {
      await fil.fermer?.();
      db.close();
    }
  }, 120_000);

  it("aucun niveau ne change : ce que minuit sert est identique avec et sans préparation", async () => {
    const dbA = await openTestDb();
    const dbB = await openTestDb();
    try {
      const horlogeA = { now: quand.quinze };
      const A = createApi({ db: dbA, now: () => horlogeA.now, allowCopies: true });
      await A.handle(new Request("http://api.test/api/portail/jour"), { clientKey: "203.0.113.7" });
      await A.preparerLeLendemain();
      const lire = async (api: ReturnType<typeof createApi>, chemin: string) => {
        const r = await api.handle(new Request(`http://api.test${chemin}`), { clientKey: "203.0.113.7" });
        return { status: r.status, corps: await r.json() };
      };
      const A2 = createApi({ db: dbA, now: () => minuit + 2_000, allowCopies: true });
      const B = createApi({ db: dbB, now: () => minuit + 2_000, allowCopies: true });
      for (const chemin of ["/api/portail/jour", "/api/day/2026-11-13", "/api/jump/day/2026-11-13"]) expect(await lire(A2, chemin), chemin).toEqual(await lire(B, chemin));
    } finally {
      dbA.close();
      dbB.close();
    }
  }, 120_000);

  it("un jeu éteint n'est pas préparé, et un jour déjà préparé par l'instance ne l'est pas deux fois", async () => {
    const db = await openTestDb();
    const { log, lignes } = journal();
    const horloge = { now: quand.quinze };
    try {
      const api = createApi({ db, now: () => horloge.now, allowCopies: true, log });
      await api.handle(new Request("http://api.test/api/portail/jour"), { clientKey: "203.0.113.7" });
      await api.preparerLeLendemain();
      expect(message(lignes, "niveau du lendemain prêt").map((l) => l.fields.jeu).sort()).toEqual(["cdj", "jump"]);
      horloge.now += 60_000;
      await api.handle(new Request("http://api.test/api/portail/jour"), { clientKey: "203.0.113.7" });
      await api.preparerLeLendemain();
      expect(message(lignes, "niveau du lendemain prêt")).toHaveLength(2);
      // Jump éteint : sa préparation ne se fait pas pour une instance neuve.
      await db.run("INSERT OR REPLACE INTO jeux (jeu, etat, live_from, periodes, modifie_le) VALUES ('jump', 'off', 0, '[]', 0)");
      const autre = journal();
      const neuve = createApi({ db, now: () => horloge.now, allowCopies: true, log: autre.log });
      await neuve.handle(new Request("http://api.test/api/portail/jour"), { clientKey: "203.0.113.7" });
      await neuve.preparerLeLendemain();
      expect(message(autre.lignes, "niveau du lendemain prêt").map((l) => l.fields.jeu)).toEqual(["cdj"]);
    } finally {
      db.close();
    }
  }, 120_000);
});
