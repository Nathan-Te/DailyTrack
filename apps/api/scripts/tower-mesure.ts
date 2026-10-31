// Lot T4 — `npx esbuild scripts/tower-mesure.ts --bundle --platform=node --format=esm --target=node22 --outfile=dist/tower-mesure.mjs "--banner:js=import { createRequire as __cdjRequire } from 'node:module'; const require = __cdjRequire(import.meta.url);" && NODE_NO_WARNINGS=1 node dist/tower-mesure.mjs` (dans `apps/api`) : ce que coûte Tower sur le serveur — le rejeu (calcul pur), puis chaque route (requêtes, lignes lues et écrites, calcul).
// **Base libSQL locale seulement** (un fichier temporaire, effacé à la fin ; jamais Turso, règle R14). Les lignes lues sont l'estimation basse de `src/comptage.ts` (pas de parcours + lignes
// rendues). Un `sqld` local donnerait l'exact de Turso ; sans lui, c'est ce qu'on a.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cpus } from "node:os";
import { daysFromCivil, formatDay } from "@cdj/core";
import { dailyTower, encoderRediffusion, enregistrer, lireJour, Partie, REGLAGES_DEFAUT, rejouer, type Scenario, type Contenu, NB_PIECES } from "@cdj/tower-sim";
import { chargerRapier } from "@cdj/tower-sim/rapier";
import { createApi } from "../src/api";
import { ensureSchemaOn } from "../src/db";
import { openLibsql } from "../src/libsql-open";
import { silentLog } from "../src/log";
import { GAMES } from "../src/registry";
import { UNITES_REJEU_TOWER } from "../src/towerRejeu";
import { creerTablesTower, fixtureJour, jouerScripte, towerGame } from "./tower-aide";

const mediane = (v: number[]): number => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)]!;
console.log(`Machine : ${cpus()[0]?.model ?? "?"} (${cpus().length} cœurs), Node ${process.version}\n`);
const R = await chargerRapier();

// ---- 1. le rejeu (calcul pur) ----
console.log("## Le rejeu (médiane de 5 passes après 2 d'échauffement), Rapier dans le fil principal");
{
  const duJour = dailyTower(daysFromCivil(2026, 11, 2));
  const bonus: Contenu = { ...duJour, pieces: Array.from({ length: NB_PIECES }, () => "O" as const), paliers: duJour.paliers.map((p, i) => ({ metres: p.metres, effet: (["lierre", "figee", "petite"] as const)[i % 3]! })) };
  const cas: [string, Scenario][] = [
    ["partie nominale : 40 carrés, six paliers de bonus, chute minimale (la partie qui va jusqu'au bout)", bonus],
    ["un jour réel (02/11/2026), joué sans rien faire : la tour s'effondre, trois vies perdues", duJour],
  ];
  for (const [nom, contenu] of cas) {
    // Joué sans rien faire (chute minimale, tout au centre) : les parties les plus longues, comme `tools/mesures-t2.ts`.
    const partie = new Partie(R, contenu, { ...REGLAGES_DEFAUT });
    while (partie.etape !== "fini") partie.avancer(0);
    const code = encoderRediffusion(enregistrer(partie));
    const r = partie.resultat()!;
    partie.dispose();
    const t: number[] = [];
    for (let i = 0; i < 7; i++) {
      const t0 = performance.now();
      rejouer(R, contenu, code);
      if (i >= 2) t.push(performance.now() - t0);
    }
    console.log(`- ${nom} : ${r.ticks} ticks (+ ${r.ticksGel - r.ticks} de stabilisation), médiane ${mediane(t).toFixed(0)} ms (${((mediane(t) * 1000) / r.ticksGel).toFixed(0)} µs par tick)`);
  }
  // Borne : la plus longue partie qui tient dans MAX_TICKS_JEU (chute à 1 m/s : réglages non permis au serveur, mais le coût par tick est le même) — voir tools/mesures-t2.ts.
  const lent = { ...REGLAGES_DEFAUT, vitesseChute8: 8 };
  const p = new Partie(R, { ...duJour, pieces: Array.from({ length: NB_PIECES }, () => "O" as const) } as Scenario, lent);
  while (p.etape !== "fini") p.avancer(0);
  const code = encoderRediffusion(enregistrer(p));
  const r = p.resultat()!;
  p.dispose();
  const t: number[] = [];
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    rejouer(R, { ...duJour, pieces: Array.from({ length: NB_PIECES }, () => "O" as const) } as Scenario, code);
    t.push(performance.now() - t0);
  }
  console.log(`- à la borne (réglages hors serveur : chute à 1 m/s) : ${r.ticks} ticks (borne MAX_TICKS_JEU = 20 000), médiane ${mediane(t).toFixed(0)} ms`);
  console.log(`\nUNITES_REJEU_TOWER = ${UNITES_REJEU_TOWER} (≈ 15 ms par unité : ${UNITES_REJEU_TOWER * 15} ms) ; au plafond de production de 600 unités par minute : ${Math.floor(600 / UNITES_REJEU_TOWER)} rejeux par minute et par instance.\n`);
}

// ---- 2. les routes ----
const dossier = mkdtempSync(join(tmpdir(), "cdj-tower-"));
try {
  const DATE = "2026-11-07";
  const jour = daysFromCivil(2026, 11, 7);
  const frozen = { [DATE]: fixtureJour(DATE) };
  const lu = lireJour(frozen[DATE], jour);
  if (typeof lu === "string") throw new Error(lu);
  const db = await openLibsql({ url: `file:${join(dossier, "tower.db")}`, comptage: true });
  await ensureSchemaOn(db);
  await creerTablesTower(db);
  await db.run("INSERT OR REPLACE INTO jeux (jeu, etat, live_from, periodes, modifie_le) VALUES ('tower', 'on', 0, '[[0,null]]', 0)");
  const horloge = { now: jour * 86_400_000 + 12 * 3_600_000 };
  const nouvelle = () => createApi({ db, now: () => horloge.now, log: silentLog, allowCopies: true, games: [...GAMES, towerGame({ frozen })], environment: "local" });
  const id = (n: number) => n.toString(16).padStart(32, "0");

  // 300 joueurs, chacun avec une partie ce jour-là (lignes synthétiques : le classement a une taille réaliste).
  for (let i = 0; i < 300; i++) {
    await db.run("INSERT INTO players (id, name, created_at, updated_at, name_key) VALUES (?, ?, 0, 0, ?)", [id(10_000 + i), `Joueur${i}`, `joueur${i}`]);
    await db.run(
      "INSERT INTO tower_results (day, player_id, tirage, hauteur_mm, hauteur_max_mm, vies, ticks, medal, replay, sim_version, generator_version, first_at, submitted_at, inputs_hash, hidden, apercu) VALUES (?, ?, 0, ?, ?, ?, ?, NULL, '', 3, 3, 0, ?, ?, 0, 0)",
      [jour, id(10_000 + i), 2000 + ((i * 137) % 40_000), 2000 + ((i * 137) % 40_000), i % 4, 900 + (i % 50), 1000 + i, `s${i}`],
    );
  }
  await db.run("INSERT INTO players (id, name, created_at, updated_at, name_key) VALUES (?, 'Prem', 0, 0, 'prem')", [id(1)]); // le joueur d'essai existe déjà pour les lectures

  const { partie: p1, code: haut } = jouerScripte(R, lu.contenu, Array.from({ length: 40 }, () => ({ rot: 0, dx: 1 })));
  p1.dispose();
  const { partie: p2, code: bas } = jouerScripte(R, lu.contenu, Array.from({ length: 40 }, () => ({ rot: 0, dx: -1 })));
  p2.dispose();
  const { partie: p3, code: autre } = jouerScripte(R, lu.contenu, Array.from({ length: 40 }, (_, i) => ({ rot: i % 4, dx: 0 })));
  p3.dispose();
  const lignes: { route: string; instr: number; lues: number; ecrites: number; ms: number }[] = [];
  let api = nouvelle();
  async function mesure(route: string, requete: () => Request, neuve = false): Promise<unknown> {
    if (neuve) api = nouvelle();
    db.compte.remettre();
    const t0 = performance.now();
    const res = await api.handle(requete(), { clientKey: "203.0.113.9" });
    const ms = performance.now() - t0;
    const c = db.compte.comptage;
    lignes.push({ route, instr: c.instructions, lues: c.parcourues + c.renvoyees, ecrites: c.ecrites, ms });
    if (res.status >= 500) throw new Error(`${route} : ${res.status}`);
    return res.json().catch(() => null);
  }
  const get = (chemin: string, joueur?: number) => () => new Request(`http://tower.test${chemin}`, { headers: joueur ? { "X-Player-Id": id(joueur) } : {} });
  const post = (joueur: number, replay: string, name?: string) => () =>
    new Request("http://tower.test/api/tower/submit", { method: "POST", headers: { "X-Player-Id": id(joueur), "Content-Type": "application/json" }, body: JSON.stringify({ replay, name }) });

  await mesure("GET /api/tower/info", get("/api/tower/info"), true);
  await mesure("GET /api/tower/day/<jour préparé> — instance neuve (rejoue la preuve, écrit le jour)", get(`/api/tower/day/${DATE}`), true);
  await mesure("GET /api/tower/day/<jour préparé> — relu en base par une instance neuve", get(`/api/tower/day/${DATE}`), true);
  await mesure("GET /api/tower/day/<jour préparé> — en mémoire", get(`/api/tower/day/${DATE}`));
  await mesure("GET /api/tower/day/<jour sans fichier> — instance neuve (généré, écrit)", get("/api/tower/day/2026-11-06"), true);
  await mesure("POST /api/tower/submit — premier envoi, joueur connu (rejeu compris)", post(1, bas, "Prem"));
  await mesure("POST /api/tower/submit — nouveau record", post(1, haut));
  await mesure("POST /api/tower/submit — pas un record", post(1, autre));
  await mesure("POST /api/tower/submit — premier envoi d'un joueur inconnu (crée le joueur)", post(2, haut, "Deux"));
  await mesure("POST /api/tower/submit — refusé : pas le jour (409, avant le rejeu)", post(3, encoderRediffusion({ ...(await import("@cdj/tower-sim")).decoderRediffusion(haut), contenu: { jour: jour - 5 } }), "Trois"));
  await mesure("GET /api/tower/day/<jour>/board — avec ta ligne", get(`/api/tower/day/${DATE}/board`, 1));
  await mesure("GET /api/tower/day/<jour>/board — sans identifiant", get(`/api/tower/day/${DATE}/board`));
  await mesure("GET /api/tower/day/<jour>/diamant — classé", get(`/api/tower/day/${DATE}/diamant`, 1));
  await mesure("GET /api/tower/me", get("/api/tower/me", 1));
  void formatDay;

  console.log("## Les routes (base libSQL locale de 300 classés ; « lues » = estimation basse de src/comptage.ts)");
  console.log("| route | requêtes | lignes lues | lignes écrites | calcul (ms) |\n|---|---|---|---|---|");
  for (const l of lignes) console.log(`| ${l.route} | ${l.instr} | ${l.lues} | ${l.ecrites} | ${l.ms.toFixed(0)} |`);
  db.close();
} finally {
  rmSync(dossier, { recursive: true, force: true });
}
