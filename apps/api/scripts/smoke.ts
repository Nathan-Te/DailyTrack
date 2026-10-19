// Essai de bout en bout d'une API en marche (CI : l'image Docker contre un serveur libSQL ; poste local) :
//   npm run smoke -w @cdj/api -- http://localhost:8080 [--origin https://nathan-te.github.io]
// Santé, circuit du jour (généré par la première requête), un temps du jour rejoué par le serveur, classement, fantôme, Salon (maintenant,
// envoi, classement). **Crée un joueur « Fumée »** : à ne pas lancer contre la vraie base de production.
// Lot P0 (plateforme) : DailyJump (`/api/jump/info`, `/api/jump/day/<aujourd'hui>` calculé par le serveur et égal à celui du jeu, chaque jour
// figé de l'image servi depuis son fichier) ; lecture seule.
import { dailyCircuit, encodeReplay, formatDay, parseDay, runPilot, salonCircuit } from "@cdj/sim";
import { JUMP_GENERATOR_VERSION, JUMP_SIM_VERSION, dailyLevel } from "@cdj/jump-sim";

const base = (process.argv[2] ?? "http://localhost:8080").replace(/\/+$/, "");
const originAt = process.argv.indexOf("--origin");
const origin = originAt > 0 ? process.argv[originAt + 1] : undefined;

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
const srun = runPilot(salon.track, { grip: 0.9 });
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

console.log(failed ? `\n${failed} vérification(s) en échec` : "\nTout est bon.");
process.exit(failed ? 1 : 0);
