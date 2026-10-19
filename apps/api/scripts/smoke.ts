// Essai de bout en bout d'une API en marche (CI : l'image Docker contre un serveur libSQL ; poste local) :
//   npm run smoke -w @cdj/api -- http://localhost:8080 [--origin https://nathan-te.github.io]
// Santé, circuit du jour (généré par la première requête), un temps du jour rejoué par le serveur, classement, fantôme, Salon (maintenant,
// envoi, classement). **Crée un joueur « Fumée »** : à ne pas lancer contre la vraie base de production.
// Lot P0 (plateforme) : DailyJump (`/api/jump/info`, `/api/jump/day/<aujourd'hui>` calculé par le serveur et égal à celui du jeu, chaque jour
// figé de l'image servi depuis son fichier) ; lecture seule.
// Lot P1 : DailyJump classé. Le joueur d'essai envoie **la preuve de l'auteur** du niveau du jour (fichier figé du dépôt s'il y en a un, sinon
// `dailyLevel`, la règle du jeu) : le serveur la rejoue, rend le temps de l'auteur, sans mort, son rang ; le classement le montre ; une autre
// version est refusée (409). **Garde-fou** : un serveur `production` (`/api/jump/info`) n'est accepté qu'en local (l'image de la CI) ; une
// adresse distante de production est refusée avant toute écriture (les workflows ne lancent déjà `smoke` que contre la recette ou la CI).
// Lot P3 : les morts de tout le monde. Le joueur d'essai envoie un lot de vies (des morts d'essais fictifs du niveau du jour) et une vie forgée
// (en-tête incohérent) : le lot est accepté, la vie forgée écartée seule ; la carte des morts et l'échantillon du carnage répondent ; un
// inconnu est refusé (404). Relancé sur la même base, un autre joueur « Fumée » : rien ne s'accumule de façon gênante (30 morts au plus chacun).
// Lot P4 : **`--lecture-seule`**, la vérification de la production après chaque déploiement (`production.yml`) : des GET seulement, sans
// identifiant de joueur, **rien n'est jamais écrit** (`smokeRead.ts`) ; c'est **le seul mode permis contre la production**. Options :
// `--environnement production` (ce que `/api/jump/info` doit dire), `--resume <fichier>` (le résumé du run, Markdown), `--retour <commande>`
// (la commande de retour arrière à copier, écrite dans le résumé en cas d'échec). Le mode complet vérifie aussi la lecture regroupée.
//   npm run smoke -w @cdj/api -- https://<API> --lecture-seule --environnement production
import { appendFileSync, readFileSync, readdirSync } from "node:fs";
import { dailyCircuit, encodeReplay, formatDay, parseDay, runPilot, salonCircuit } from "@cdj/sim";
import { JUMP_GENERATOR_VERSION, JUMP_SIM_VERSION, dailyLevel, decodeReplay, demoAttempts, encodeReplay as encodeJump, lifeReplay, replayAttempt } from "@cdj/jump-sim";
import { jumpDailyOf } from "../src/jump";
import { readOnlySmoke, smokeRefusal, smokeSummary } from "./smokeRead";

const base = (process.argv[2] ?? "http://localhost:8080").replace(/\/+$/, "");
const option = (name: string): string | undefined => {
  const at = process.argv.indexOf(name);
  return at > 0 ? process.argv[at + 1] : undefined;
};
const origin = option("--origin");
const readOnly = process.argv.includes("--lecture-seule");

// Lot P4 : la vérification en lecture seule (production comprise) : aucune écriture, puis la sortie.
if (readOnly) {
  const checks = await readOnlySmoke(base, (u, i) => fetch(u, i), { expectEnvironment: option("--environnement"), origin });
  for (const c of checks) console.log(`${c.ok ? "✓" : "✗"} ${c.label} — ${c.route} ${c.status}${c.detail ? ` — ${c.detail}` : ""}`);
  const failedChecks = checks.filter((c) => !c.ok).length;
  const summary = option("--resume");
  if (summary) appendFileSync(summary, smokeSummary(base, checks, option("--retour") ?? null));
  console.log(failedChecks ? `\n${failedChecks} vérification(s) en échec` : "\nTout est bon (lecture seule : rien n'a été écrit).");
  process.exit(failedChecks ? 1 : 0);
}

async function call(method: string, path: string, body?: unknown): Promise<{ status: number; body: any; ms: number; headers: Headers }> {
  const t0 = performance.now();
  const res = await fetch(base + path, {
    method,
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(origin ? { Origin: origin } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json(), ms: Math.round(performance.now() - t0), headers: res.headers };
}

let failed = 0;
function check(label: string, ok: boolean, detail = ""): void {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed++;
}

const player = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
// Un pseudo appartient à son premier propriétaire (lot 30) : chaque exécution prend le sien, pour qu'on puisse relancer l'essai sur la même base.
const NAME = `Fumée${Math.floor(1000 + Math.random() * 9000)}`;

// Garde-fou (lot P1, lot P4) : le mode complet jamais contre la production (sauf l'image lancée en local par la CI, contre son propre sqld) ;
// contre la production, seul `--lecture-seule` est permis (`smokeRefusal`, testé).
const where = await call("GET", "/api/jump/info").catch(() => null);
const refusal = smokeRefusal({ base, environment: typeof where?.body?.environment === "string" ? where.body.environment : null, readOnly });
if (refusal) {
  console.error(refusal);
  process.exit(1);
}

const health = await call("GET", "/api/health");
check("santé : base joignable, SALON_MINUTES absente", health.status === 200 && health.body.ok && health.body.db === "ok" && health.body.salonOverride === false, JSON.stringify(health.body));
if (origin) check(`CORS : ${origin} autorisée`, health.headers.get("access-control-allow-origin") === origin || health.headers.get("access-control-allow-origin") === "*");

const date: string = health.body.today;
const day = parseDay(date)!;
const info = await call("GET", `/api/day/${date}`);
check("circuit du jour servi (généré à la première requête, gardé en base)", info.status === 200 && !!info.body.trackId, `${info.ms} ms`);
const again = await call("GET", `/api/day/${date}`);
check("deuxième lecture : lu en base, plus de génération", again.body.trackId === info.body.trackId && again.ms < Math.max(300, info.ms), `${again.ms} ms`);

const circuit = dailyCircuit(day);
const run = runPilot(circuit.track, { grip: 0.9 });
check("le pilote local finit le circuit du jour", run.valid && circuit.track.id === info.body.trackId);
const sub = await call("POST", "/api/submit", { playerId: player, name: NAME, date, replay: encodeReplay(run.replay) });
check("temps du jour accepté, rejoué par le serveur", sub.status === 200 && sub.body.ms === run.finishMs && sub.body.rank >= 1, `${sub.body.ms} ms, ${sub.ms} ms de requête`);
const taken = await call("GET", `/api/name?name=${encodeURIComponent(NAME.toUpperCase())}`);
check("pseudo réservé : le même, en majuscules, est pris (et rien d'autre n'est dit)", taken.status === 200 && taken.body.available === false && Object.keys(taken.body).every((k) => k === "available" || k === "suggestions"));
const mine = await fetch(`${base}/api/me`, { headers: { "X-Player-Id": player } });
const profile = (await mine.json()) as any;
check("profil du joueur (identifiant en en-tête) : pseudo, temps du jour avec rediffusion, statistiques", mine.status === 200 && profile.name === NAME && profile.best?.ms === run.finishMs && profile.best?.replay === encodeReplay(run.replay) && profile.stats?.days === 1);
const board = await call("GET", `/api/day/${date}/leaderboard?player=${player}`);
check("classement du jour : le joueur y est", board.status === 200 && board.body.me?.name === NAME);
const ghost = await call("GET", `/api/day/${date}/ghost?kind=first`);
check("fantôme du premier servi", ghost.status === 200 && typeof ghost.body.replay === "string");

const now = await call("GET", `/api/salon/now?player=${player}`);
check("Salon : session en cours", now.status === 200 && Number.isInteger(now.body.session), `session ${now.body.session}`);
const salon = salonCircuit(now.body.session);
// Le pilote local à quelques adhérences, de la plus vive à la plus prudente : à 0,9 il ne finit pas tous les circuits du Salon (session
// 2987362 du 19/10/2026, mesuré au lot P2 : il finit à 0,8) ; l'essai ne porte pas sur le pilote mais sur l'envoi d'une course valide.
const srun = [0.9, 0.8, 0.7, 0.6].map((grip) => runPilot(salon.track, { grip })).find((r) => r.valid) ?? runPilot(salon.track, { grip: 0.9 });
check("le pilote local finit le circuit du Salon", srun.valid && salon.track.id === now.body.trackId);
const ssub = await call("POST", `/api/salon/${now.body.session}/submit`, { playerId: player, name: NAME, replay: encodeReplay(srun.replay) });
check("Salon : temps accepté (circuit de la session généré à ce premier envoi)", ssub.status === 200 && ssub.body.ms === srun.finishMs, `${ssub.ms} ms`);
const sboard = await call("GET", `/api/salon/${now.body.session}/board?player=${player}`);
check("Salon : classement de la session", sboard.status === 200 && sboard.body.rows?.length >= 1 && sboard.body.me?.ms === srun.finishMs);

// --- DailyJump (lot P0) : l'espace /api/jump/, en lecture seule --------------------------------------------------------------
const jinfo = await call("GET", "/api/jump/info");
check(
  "DailyJump : /api/jump/info (versions, date de Paris, jours figés, environnement)",
  jinfo.status === 200 && jinfo.body.simVersion === JUMP_SIM_VERSION && jinfo.body.generatorVersion === JUMP_GENERATOR_VERSION && jinfo.body.today === date && Array.isArray(jinfo.body.frozenDays),
  JSON.stringify(jinfo.body),
);
const frozenDays: string[] = Array.isArray(jinfo.body.frozenDays) ? jinfo.body.frozenDays : [];
const jday = await call("GET", `/api/jump/day/${date}`);
const ours = frozenDays.includes(date) ? null : dailyLevel(day);
check(
  "DailyJump : niveau du jour calculé par le serveur (identifiant, empreinte, temps de l'auteur), le même que le jeu",
  jday.status === 200 && typeof jday.body.hash === "string" && (ours === null || (jday.body.id === ours.id && jday.body.hash === ours.hash && jday.body.authorTicks === ours.authorTicks)),
  `${jday.body.id} ${jday.body.hash} (${jday.body.source}), ${jday.ms} ms`,
);
const jagain = await call("GET", `/api/jump/day/${date}`);
check("DailyJump : deuxième lecture servie du cache", jagain.status === 200 && jagain.body.hash === jday.body.hash, `${jagain.ms} ms`);
for (const d of frozenDays) {
  const r = await call("GET", `/api/jump/day/${d}`);
  check(`DailyJump : jour figé ${d} servi depuis son fichier (preuve rejouée)`, r.status === 200 && r.body.source === "fige", `${r.body.id} ${r.body.hash}`);
}
const jfuture = await call("GET", `/api/jump/day/${formatDay(day + 1)}`);
check("DailyJump : demain est refusé", jfuture.status === 404);

// --- DailyJump (lot P1) : un essai classé, rejoué par le serveur ------------------------------------------------------------------
const frozenFiles: Record<string, unknown> = {};
try {
  const dir = new URL("../../jump/public/levels/", import.meta.url);
  for (const f of readdirSync(dir)) {
    const d = /^(\d{4}-\d{2}-\d{2})\.json$/.exec(f)?.[1];
    if (d) frozenFiles[d] = JSON.parse(readFileSync(new URL(f, dir), "utf8"));
  }
} catch {
  /* sans le dépôt : le niveau généré (un jour figé ne serait alors pas le bon : le serveur le dirait, 409 version) */
}
const level = jumpDailyOf(day, frozenFiles);
const jbody = { levelId: level.id, simVersion: JUMP_SIM_VERSION, generatorVersion: JUMP_GENERATOR_VERSION, replay: level.code };
const jcall = async (method: string, path: string, body?: unknown) => {
  const t0 = performance.now();
  const res = await fetch(base + path, {
    method,
    headers: { "X-Player-Id": player, ...(body ? { "Content-Type": "application/json" } : {}), ...(origin ? { Origin: origin } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: (await res.json()) as any, ms: Math.round(performance.now() - t0) };
};
check("DailyJump : le niveau du jour du serveur est celui du jeu", jday.body.id === level.id && jday.body.hash === level.hash, `${level.id} ${level.hash}`);
const jsub = await jcall("POST", "/api/jump/submit", jbody);
check(
  "DailyJump : essai du jour accepté, rejoué par le serveur (temps de l'auteur, sans mort), rang rendu",
  jsub.status === 200 && jsub.body.ticks === level.authorTicks && jsub.body.deaths === 0 && jsub.body.medal === "author" && jsub.body.rank >= 1 && jsub.body.participants >= jsub.body.rank,
  `${jsub.status} ${jsub.body.ticks} pas, rang ${jsub.body.rank}/${jsub.body.participants}, ${jsub.ms} ms`,
);
const jboard = await jcall("GET", `/api/jump/day/${date}/board`);
check(
  "DailyJump : classement du jour, la ligne du joueur d'essai (même rang)",
  jboard.status === 200 && jboard.body.me?.name === NAME && jboard.body.me?.ticks === level.authorTicks && jboard.body.me?.rank === jsub.body.rank && jboard.body.top.length >= 1,
  `${jboard.body.participants} classé(s), ${jboard.ms} ms`,
);
const jold = await jcall("POST", "/api/jump/submit", { ...jbody, generatorVersion: JUMP_GENERATOR_VERSION - 1 });
check("DailyJump : une autre version est refusée (409, « nouvelle version »)", jold.status === 409 && jold.body.error === "version");
const jyesterday = await jcall("POST", "/api/jump/submit", { ...jbody, levelId: `jour-${formatDay(day - 1)}-g${JUMP_GENERATOR_VERSION}` });
check("DailyJump : un autre jour est refusé", jyesterday.status === 409);

// --- DailyJump (lot P2) : le fantôme du premier et le profil DailyJump ----------------------------------------------------------
const jghost = await jcall("GET", `/api/jump/day/${date}/ghost/first`);
const firstRow = jboard.body.top?.[0];
check(
  "DailyJump : fantôme du premier (la rediffusion du premier du classement, versions du jeu)",
  jghost.status === 200 &&
    typeof jghost.body.replay === "string" &&
    jghost.body.replay.length > 0 &&
    jghost.body.name === firstRow?.name &&
    jghost.body.ticks === firstRow?.ticks &&
    jghost.body.simVersion === JUMP_SIM_VERSION &&
    jghost.body.mine === (firstRow?.name === NAME),
  `${jghost.status} premier « ${String(jghost.body.name)} », ${String(jghost.body.ticks)} pas, ${jghost.ms} ms`,
);
const jme = await jcall("GET", "/api/jump/me");
const meToday = Array.isArray(jme.body.days) ? jme.body.days.find((d: { date: string }) => d.date === date) : null;
check(
  "DailyJump : /api/jump/me rend le jour classé du joueur d'essai (temps rejoué, médaille, morts)",
  jme.status === 200 && jme.body.name === NAME && meToday?.ticks === level.authorTicks && meToday?.medal === "author" && meToday?.deaths === 0 && jme.body.stats?.days >= 1,
  `${jme.status} ${jme.body.stats?.days} jour(s), ${jme.ms} ms`,
);

// --- DailyJump (lot P3) : les morts de tout le monde --------------------------------------------------------------------------------
const deathLives: string[] = [];
for (const a of demoAttempts(level.level, level.replay, 0x5e0e, { attempts: 6, maxLives: 6 })) {
  for (const life of replayAttempt(level.level, a.replay, level.id).lives) if (life.end === "mort" && deathLives.length < 6) deathLives.push(encodeJump(lifeReplay(a.replay, life)));
}
const fromCheckpoint = deathLives.map((c) => decodeReplay(c)).find((r) => r.start.checkpoint >= 0);
const forged = fromCheckpoint ? encodeJump({ ...fromCheckpoint, start: { ...fromCheckpoint.start, sections: fromCheckpoint.start.sections.map(() => -1) } }) : "forgée";
const livesBody = { levelId: level.id, simVersion: JUMP_SIM_VERSION, generatorVersion: JUMP_GENERATOR_VERSION, lives: [...deathLives, forged] };
const unknown = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
const jstranger = await fetch(`${base}/api/jump/lives`, {
  method: "POST",
  headers: { "X-Player-Id": unknown, "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}) },
  body: JSON.stringify(livesBody),
});
check("DailyJump : un inconnu ne peut pas envoyer de vies (404 unknown_player)", jstranger.status === 404 && ((await jstranger.json()) as any).error === "unknown_player");
const jlives = await jcall("POST", "/api/jump/lives", livesBody);
const verdicts: string[] = Array.isArray(jlives.body.results) ? jlives.body.results : [];
check(
  "DailyJump : un lot de vies accepté (chaque vie rejouée), la vie forgée écartée seule",
  jlives.status === 200 && deathLives.length > 0 && jlives.body.accepted === deathLives.length && verdicts.slice(0, deathLives.length).every((v) => v === "ok") && verdicts[deathLives.length] === "invalid",
  `${jlives.status} ${jlives.body.accepted} acceptée(s) sur ${jlives.body.received}, ${jlives.body.invalid} écartée(s), ${jlives.ms} ms`,
);
const jagainLives = await jcall("POST", "/api/jump/lives", { ...livesBody, lives: deathLives });
check("DailyJump : le même lot renvoyé n'est pas compté deux fois", jagainLives.status === 200 && jagainLives.body.accepted === 0 && jagainLives.body.duplicates === deathLives.length);
const jmap = await jcall("GET", `/api/jump/day/${date}/deaths`);
check(
  "DailyJump : carte des morts du jour (tuiles agrégées, joueurs, morts)",
  jmap.status === 200 && Array.isArray(jmap.body.tiles) && jmap.body.players >= 0 && jmap.body.deaths >= 0 && jmap.body.open === true,
  `${jmap.body.players} joueur(s), ${jmap.body.deaths} mort(s), ${jmap.body.tiles?.length} tuile(s) (recalculée au plus toutes les 3 min), ${jmap.ms} ms`,
);
const jcarnage = await jcall("GET", `/api/jump/day/${date}/carnage`);
check(
  "DailyJump : échantillon du carnage (rediffusions, sans identifiant)",
  jcarnage.status === 200 && Array.isArray(jcarnage.body.lives) && jcarnage.body.simVersion === JUMP_SIM_VERSION && !JSON.stringify(jcarnage.body).includes(player),
  `${jcarnage.body.lives?.length} vie(s) de ${jcarnage.body.players} joueur(s), ${jcarnage.ms} ms`,
);

// --- Lot P4 : la lecture regroupée (classement, fantôme, carte) et ses en-têtes de cache ------------------------------------------------
const jbundle = await fetch(`${base}/api/jump/day/${date}/bundle`, { headers: { "X-Player-Id": player, ...(origin ? { Origin: origin } : {}) } });
const bundleBody = (await jbundle.json()) as any;
check(
  "DailyJump : lecture regroupée (classement avec ta ligne, fantôme, carte, profil) en une requête, jamais en cache partagé",
  jbundle.status === 200 &&
    bundleBody.board?.me?.name === NAME &&
    bundleBody.board?.participants >= 1 &&
    typeof bundleBody.ghost?.replay === "string" &&
    Array.isArray(bundleBody.deaths?.tiles) &&
    bundleBody.profile?.name === NAME &&
    /\bprivate\b/.test(jbundle.headers.get("cache-control") ?? "") &&
    /x-player-id/i.test(jbundle.headers.get("vary") ?? ""),
  `${jbundle.status} ${String(bundleBody.board?.participants)} classé(s), Cache-Control « ${String(jbundle.headers.get("cache-control"))} »`,
);

console.log(failed ? `\n${failed} vérification(s) en échec` : "\nTout est bon.");
process.exit(failed ? 1 : 0);
