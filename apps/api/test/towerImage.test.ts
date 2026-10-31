import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { parisDay } from "@cdj/clock";
import { dailyTower, TOWER_GENERATOR_VERSION } from "@cdj/tower-sim";
import { chargerRapier } from "@cdj/tower-sim/rapier";
import { afterAll, describe, expect, it } from "vitest";
import { jouerScripte } from "../scripts/tower-aide";
import { TEST_DB } from "./helpers";

// Lot TP — l'**image construite** rejoue Tower dans le fil de calcul. On construit le paquet comme le Dockerfile (`scripts/build-node.mjs` : `server.mjs` et `tower-fil.mjs`), on lance
// `server.mjs` tel quel (base SQLite d'un dossier temporaire, jamais Turso), on ouvre Tower à l'interrupteur, on envoie une vraie partie et on lit le journal du serveur : sa ligne de démarrage dit
// que les rejeux passent par le fil, et la ligne de la partie nomme l'exécuteur qui l'a rejouée. Aucune donnée personnelle n'est lue ni écrite dans les journaux (testé aussi).
// Un seul des deux projets (SQLite / libSQL) le joue : le paquet et sa base sont les mêmes.

const API = fileURLToPath(new URL("..", import.meta.url));

const portLibre = () =>
  new Promise<number>((resolve, reject) => {
    const s = createServer();
    s.listen(0, () => {
      const p = (s.address() as { port: number }).port;
      s.close(() => resolve(p));
    });
    s.on("error", reject);
  });

describe.skipIf(TEST_DB !== "sqlite")("Tower : l'image construite rejoue dans le fil de calcul (lot TP)", () => {
  const dossier = mkdtempSync(join(tmpdir(), "cdj-tower-image-"));
  let serveur: ChildProcess | null = null;
  afterAll(() => {
    serveur?.kill();
    rmSync(dossier, { recursive: true, force: true });
  });

  it("le paquet contient le fil ; le démarrage le dit ; une partie est rejouée par lui", async () => {
    execFileSync(process.execPath, ["scripts/build-node.mjs"], { cwd: API, stdio: "pipe" });
    const port = await portLibre();
    const lignes: string[] = [];
    const env: NodeJS.ProcessEnv = { ...process.env, PORT: String(port), DB_PATH: join(dossier, "cdj.sqlite"), ENVIRONMENT: "local", NODE_NO_WARNINGS: "1", ALLOWED_ORIGINS: "*" };
    for (const k of ["NODE_ENV", "TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN", "K_SERVICE", "VITEST", "SALON_MINUTES"]) delete env[k];
    serveur = spawn(process.execPath, ["dist/server.mjs"], { cwd: API, env });
    serveur.stdout!.on("data", (d: Buffer) => lignes.push(...d.toString().split("\n").filter(Boolean)));
    serveur.stderr!.on("data", (d: Buffer) => lignes.push(...d.toString().split("\n").filter(Boolean)));
    const pret = async (): Promise<void> => {
      for (let i = 0; i < 200; i++) {
        if (lignes.some((l) => l.includes("API du Circuit du Jour prête"))) return;
        await new Promise((r) => setTimeout(r, 50));
      }
      throw new Error(`le serveur n'a pas démarré : ${lignes.join("\n").slice(0, 600)}`);
    };
    await pret();
    expect(lignes.some((l) => l.includes("Tower : les rejeux passent par le fil de calcul"))).toBe(true);
    expect(lignes.some((l) => l.includes("repli"))).toBe(false);

    const base = `http://127.0.0.1:${port}`;
    expect((await fetch(`${base}/api/health`)).status).toBe(200); // crée le schéma
    // Tower naît `off` : on l'ouvre à la main, dans la base du serveur (le serveur relit l'état au plus toutes les 30 s ; rien n'a encore été lu).
    const bd = new DatabaseSync(join(dossier, "cdj.sqlite"));
    bd.exec("INSERT OR REPLACE INTO jeux (jeu, etat, live_from, periodes, modifie_le) VALUES ('tower', 'on', 0, '[[0,null]]', 0)");
    bd.close();

    const jour = parisDay(Date.now());
    const R = await chargerRapier();
    const { partie, code } = jouerScripte(R, dailyTower(jour, TOWER_GENERATOR_VERSION, 0));
    partie.dispose();
    const r = await fetch(`${base}/api/tower/submit`, {
      method: "POST",
      headers: { "content-type": "application/json", "X-Player-Id": "ab".repeat(16) },
      body: JSON.stringify({ replay: code, name: "ImageTest" }),
    });
    const corps = (await r.json()) as { accepted?: boolean; error?: string };
    expect(r.status, JSON.stringify(corps)).toBe(200);
    expect(corps.accepted).toBe(true);
    const partieLog = lignes.find((l) => l.includes("DailyTower : partie du jour"));
    expect(partieLog, lignes.join("\n").slice(-800)).toBeDefined();
    expect(JSON.parse(partieLog!).executeur).toBe("fil");
    // Jamais de donnée personnelle au journal : ni pseudo, ni identifiant, ni rediffusion.
    const tout = lignes.join("\n");
    expect(tout).not.toContain("ImageTest");
    expect(tout).not.toContain("ab".repeat(16));
    expect(tout).not.toContain(code.slice(0, 40));
  }, 120_000);
});
