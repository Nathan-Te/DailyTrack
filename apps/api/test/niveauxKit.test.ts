import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { build } from "esbuild";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { formatDay } from "@cdj/core";
import { executeurFil } from "../src/jeux/fil";
import { ligneDeNiveau, memeValeur, NIVEAU_GARDE_OCTETS_MAX } from "../src/jeux/defauts";
import { type DemandeKit, type ExecuteurKit, executeurKitPrincipal, type ReponseKit } from "../src/niveauxFil";
import { GAMES } from "../src/registry";
import { D_ESSAI, JOUR_ESSAI } from "./jeuNeufAide";
import { DAY_MS, makeApi, ouvrirJeu, type TestApi, TEST_DB } from "./helpers";
import { JEU_LENT, SEUILS_LENTS_MS } from "./niveauxKitJeu";

// Lot D4 — **le niveau du jour des jeux du kit ne bloque plus le serveur.** Un jeu fictif du kit dont les seuils coûtent 3 s de processeur : pendant son calcul dans le fil de calcul (un vrai `worker_threads`), l'accueil, `/api/jeux` et
// le classement répondent en moins de 500 ms et le retard de la boucle d'événements reste sous 100 ms ; le niveau calculé se garde en base et une instance qui se réveille le relit sans le recalculer.

const MIDI = D_ESSAI * DAY_MS + 12 * 3_600_000;
const code = JEU_LENT.code;
const dossier = mkdtempSync(join(tmpdir(), "niveaux-kit-"));
const fichier = join(dossier, "niveaux-fil.mjs");

beforeAll(async () => {
  await build({
    entryPoints: [new URL("./niveauxKitTravail.ts", import.meta.url).pathname],
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

/** Le plus long retard de la boucle d'événements du fil principal tant que la sentinelle tourne (un minuteur de 5 ms : l'écart au-delà de 5 ms). */
function sentinelle(): { arreter(): number } {
  let dernier = performance.now();
  let pire = 0;
  const s = setInterval(() => {
    const t = performance.now();
    pire = Math.max(pire, t - dernier - 5);
    dernier = t;
  }, 5);
  return {
    arreter() {
      clearInterval(s);
      return pire;
    },
  };
}

/** Un fil de calcul comme celui du serveur (le script du test : le jeu fictif aux seuils lents). */
const filDuTest = () => executeurFil<DemandeKit, ReponseKit>(fichier, { delaiMs: 60_000 });

/** Un exécuteur qui répond tout de suite, avec ce que le jeu fictif calcule (son niveau `{ jour }` et ses seuils), et compte ce qu'on lui demande : les 3 s de robot ne sont payées qu'une fois, par le fil du test. */
function executeurCompteur(): ExecuteurKit & { demandes: { code: string; jour: string }[] } {
  const demandes: { code: string; jour: string }[] = [];
  return {
    nom: "principal",
    demandes,
    async rejouer(d) {
      demandes.push({ code: d.code, jour: formatDay(d.day) });
      return { niveau: { jour: d.day }, seuils: SEUILS };
    },
  };
}

/** Un serveur où le jeu fictif est `on` et Track et Jump `off` (leur niveau est celui du lot D3, hors de ce lot). */
async function monter(options: { executeur?: ExecuteurKit; db?: TestApi["db"]; revision?: string } = {}): Promise<TestApi> {
  const t = await makeApi({ seed: false, games: [...GAMES, JEU_LENT], ...(options.db ? { db: options.db } : {}), niveauxKitExecuteur: options.executeur, revision: options.revision ?? "revision-a" });
  t.clock.now = MIDI;
  await ouvrirJeu(t, code);
  await t.db.run("UPDATE jeux SET etat = 'off' WHERE jeu IN ('track', 'jump')");
  return t;
}
const sha = (v: unknown): string => createHash("sha256").update(JSON.stringify(v)).digest("hex");
const cleMeta = `niveau:${code}:${JOUR_ESSAI}`;
const jeuDeAccueil = (corps: { jeux: { jeu: string }[] }) => corps.jeux.find((j) => j.jeu === code) as { numero: number; theme: string | null; seuils: Record<string, number> | null; provisoire?: boolean } | undefined;
const SEUILS = { author: 200, gold: 100, silver: 50, bronze: 20 };

describe(`le niveau du jour d'un jeu du kit, calculé hors du fil principal (${TEST_DB})`, () => {
  it("pendant que les seuils (3 s de calcul) se calculent, l'accueil, /api/jeux et le classement répondent en moins de 500 ms et la boucle ne retarde pas de 100 ms", async () => {
    const fil = filDuTest();
    const t = await monter({ executeur: fil });
    try {
      const veille = sentinelle();
      const duree = async (chemin: string) => {
        const t0 = performance.now();
        const r = await t.call("GET", chemin);
        return { ms: performance.now() - t0, r };
      };
      // L'instance est froide : le premier accueil lance le calcul (le fil le fait, pas lui) et rend le jeu **sans seuils**, avec son numéro et son thème du calendrier.
      const premier = await duree("/api/portail/jour");
      expect(premier.ms).toBeLessThan(500);
      expect(premier.r.status).toBe(200);
      expect(jeuDeAccueil(premier.r.body)).toMatchObject({ numero: 10, theme: "plat", seuils: null, provisoire: true });
      // Une réponse où un niveau n'est pas prêt n'est pas gardée longtemps : 5 s au plus (les seuils arrivent vite), pas les 60 s d'une réponse complète.
      expect(premier.r.headers.get("Cache-Control")).toBe("public, max-age=5");
      // Pendant le calcul (≈ 3 s de plus), toutes les lectures répondent vite.
      const pendant = await Promise.all([duree("/api/portail/jour"), duree("/api/jeux"), duree("/api/portail/classement"), duree("/api/portail/jour")]);
      for (const p of pendant) {
        expect(p.r.status).toBe(200);
        expect(p.ms).toBeLessThan(500);
      }
      expect(jeuDeAccueil(pendant[0]!.r.body)?.seuils).toBeNull();
      expect(pendant[1]!.r.body.jeux[code]).toBe("on");
      // La preuve que le calcul tournait bien pendant ces lectures : le niveau n'est pas prêt, il le sera dans ≈ 3 s — et c'est la route du jeu qui l'attend, pas l'accueil.
      const t0 = performance.now();
      const jour = await t.call("GET", `/api/${code}/day/${JOUR_ESSAI}`);
      expect(jour.status).toBe(200);
      expect(jour.body.medals).toEqual(SEUILS);
      expect(performance.now() - t0).toBeGreaterThan(SEUILS_LENTS_MS * 0.3); // le calcul n'était pas fini : la route du jeu l'a attendu
      expect(veille.arreter()).toBeLessThan(100);
      // Le niveau prêt, l'accueil rend les seuils (en ms : le jeu est au score, ils sont rendus tels quels) et n'est plus provisoire.
      const apres = await t.call("GET", "/api/portail/jour");
      expect(jeuDeAccueil(apres.body)).toEqual({ ...jeuDeAccueil(apres.body), numero: 10, theme: "plat", seuils: SEUILS });
      expect(jeuDeAccueil(apres.body)?.provisoire).toBeUndefined();
      expect(apres.headers.get("Cache-Control")).toBe("public, max-age=60");
    } finally {
      await fil.fermer?.();
    }
  }, 60_000);

  it("témoin : les mêmes seuils calculés sur place figent la boucle (la mesure voit un blocage quand il y en a un)", async () => {
    const t = await monter(); // pas de fil de calcul : le repli, comme avant le lot D4
    const veille = sentinelle();
    const r = await t.call("GET", "/api/portail/jour");
    expect(r.status).toBe(200);
    expect(jeuDeAccueil(r.body)?.seuils).toEqual(SEUILS); // sur place l'accueil attend le niveau, comme avant : rien ne change pour les tests et les outils
    expect(jeuDeAccueil(r.body)?.provisoire).toBeUndefined();
    await new Promise((r) => setTimeout(r, 20)); // un passage du minuteur après le blocage : c'est lui qui le mesure
    expect(veille.arreter()).toBeGreaterThan(SEUILS_LENTS_MS * 0.8);
  }, 30_000);

  it("le niveau calculé se garde en base ; une instance qui se réveille le relit au lieu de rejouer le robot — même niveau, même empreinte, mêmes réponses", async () => {
    const compteur = executeurCompteur();
    const a = await monter({ executeur: compteur });
    await a.api.preparerAuDemarrage();
    expect(compteur.demandes).toEqual([
      { code, jour: JOUR_ESSAI },
      { code, jour: formatDay(D_ESSAI + 1) },
    ]);
    const ligne = await a.db.first<{ value: string }>("SELECT value FROM meta WHERE key = ?", [cleMeta]);
    expect(ligne).not.toBeNull();
    const garde = JSON.parse(ligne!.value) as { revision: string; rule: string; ligne: { garde: string } };
    expect(garde.revision).toBe("revision-a");
    expect(JSON.parse(garde.ligne.garde)).toEqual({ niveau: { jour: D_ESSAI }, seuils: SEUILS });
    const jourA = await a.call("GET", `/api/${code}/day/${JOUR_ESSAI}`);
    const accueilA = await a.call("GET", "/api/portail/jour");

    // Une autre instance, même base, même version du code : son exécuteur ne doit jamais être appelé (il lèverait : il ne connaît aucun jeu).
    const muet = executeurKitPrincipal([]);
    const b = await monter({ executeur: muet, db: a.db });
    const jourB = await b.call("GET", `/api/${code}/day/${JOUR_ESSAI}`);
    expect(jourB.status).toBe(200);
    expect(jourB.body).toStrictEqual(jourA.body);
    // Le premier accueil de l'instance qui se réveille a déjà les seuils : relire en base n'est pas « calculer ».
    const accueilB = await b.call("GET", "/api/portail/jour");
    expect(jeuDeAccueil(accueilB.body)).toStrictEqual(jeuDeAccueil(accueilA.body));
    // Même empreinte du niveau (le niveau et les seuils) que celui qui vient d'être calculé.
    expect(sha(JSON.parse(garde.ligne.garde))).toBe(sha({ niveau: { jour: D_ESSAI }, seuils: SEUILS }));
  }, 30_000);

  it("un niveau gardé par une autre version du code n'est jamais relu : la nouvelle version le recalcule et le garde à son tour", async () => {
    const compteur = executeurCompteur();
    const demain = { code, jour: formatDay(D_ESSAI + 1) };
    const a = await monter({ executeur: compteur, revision: "revision-a" });
    await a.call("GET", `/api/${code}/day/${JOUR_ESSAI}`);
    await a.api.preparerAuDemarrage(); // aujourd'hui (la route du jeu l'a déjà demandé : une seule demande) puis demain
    expect(compteur.demandes).toEqual([{ code, jour: JOUR_ESSAI }, demain]);
    const apres = executeurCompteur();
    const b = await monter({ executeur: apres, db: a.db, revision: "revision-b" });
    await b.call("GET", `/api/${code}/day/${JOUR_ESSAI}`);
    await b.api.preparerAuDemarrage();
    expect(apres.demandes).toEqual([{ code, jour: JOUR_ESSAI }, demain]); // une autre version : on recalcule
    const ligne = await a.db.first<{ value: string }>("SELECT value FROM meta WHERE key = ?", [cleMeta]);
    expect((JSON.parse(ligne!.value) as { revision: string }).revision).toBe("revision-b");
    // Une valeur abîmée n'est pas crue : elle est recalculée.
    await a.db.run("UPDATE meta SET value = '{pas du json' WHERE key = ?", [cleMeta]);
    const abime = executeurCompteur();
    const c = await monter({ executeur: abime, db: a.db, revision: "revision-b" });
    expect((await c.call("GET", `/api/${code}/day/${JOUR_ESSAI}`)).status).toBe(200);
    await c.api.preparerAuDemarrage();
    expect(abime.demandes).toEqual([{ code, jour: JOUR_ESSAI }]); // aujourd'hui était abîmé : recalculé ; demain, gardé par la même version : relu
  }, 30_000);

  it("au démarrage, un jeu éteint n'a rien à préparer", async () => {
    const compteur = executeurCompteur();
    const t = await monter({ executeur: compteur });
    await t.db.run("UPDATE jeux SET etat = 'off' WHERE jeu = ?", [code]);
    await t.api.preparerAuDemarrage();
    expect(compteur.demandes).toEqual([]);
  }, 30_000);

  it("le jeu sans fil de calcul (tests, outils, développement) ne garde rien en base et se comporte comme avant", async () => {
    const t = await monter();
    await t.call("GET", `/api/${code}/day/${JOUR_ESSAI}`);
    expect(await t.db.first("SELECT 1 AS n FROM meta WHERE key = ?", [cleMeta])).toBeNull();
  }, 30_000);
});

describe("le niveau d'un jeu du kit passe par le fil sans rien perdre", () => {
  const jours = [D_ESSAI];

  it("la valeur gardée en base est le niveau et ses seuils, à l'octet près : le JSON ne perd rien, ou le niveau n'est pas gardé", async () => {
    const principal = executeurKitPrincipal(GAMES);
    let gardes = 0;
    for (const jeu of GAMES.filter((g) => g.niveauDuJour && g.code !== "pinball")) {
      // Pinball (le robot : 14 à 21 s) n'est pas rejoué ici : son niveau `{ jour, contenu, seuils }` a la forme de celui de Gravity, et `mesure:niveaux-kit` le mesure.
      for (const jour of jours) {
        const brut = await principal.rejouer({ jeu: "kit", code: jeu.code, day: jour, frozen: {} });
        const ligne = ligneDeNiveau(brut);
        if ("garde" in ligne) {
          gardes++;
          const relu = JSON.parse(ligne.garde) as unknown;
          expect(relu, `${jeu.code} ${jour}`).toStrictEqual(brut);
          expect(sha(relu), `${jeu.code} ${jour} : empreinte`).toBe(sha(brut));
        } else {
          // Pas gardé : ou bien trop gros, ou bien le JSON ne le rend pas à l'identique (tableaux typés) ; il se recalcule dans le fil.
          const texte = JSON.stringify(brut);
          expect(texte.length > NIVEAU_GARDE_OCTETS_MAX || !memeValeur(JSON.parse(texte), brut), `${jeu.code} ${jour} : pourquoi pas gardé`).toBe(true);
        }
      }
    }
    expect(gardes).toBeGreaterThanOrEqual(3); // au moins trois jeux du registre sont gardés
  }, 120_000);

  it("memeValeur ne laisse passer ni un tableau typé, ni undefined, ni -0, ni une Map", () => {
    expect(memeValeur({ a: [1, 2, { b: "x" }], c: null }, { a: [1, 2, { b: "x" }], c: null })).toBe(true);
    expect(memeValeur({ a: new Uint8Array([1]) }, JSON.parse(JSON.stringify({ a: new Uint8Array([1]) })))).toBe(false);
    expect(memeValeur({ a: undefined }, JSON.parse(JSON.stringify({ a: undefined })))).toBe(false);
    expect(memeValeur({ a: -0 }, JSON.parse(JSON.stringify({ a: -0 })))).toBe(false);
    expect(memeValeur({ a: new Map() }, JSON.parse(JSON.stringify({ a: new Map() })))).toBe(false);
    expect(ligneDeNiveau({ gros: "x".repeat(NIVEAU_GARDE_OCTETS_MAX) })).toEqual({});
  });
});
