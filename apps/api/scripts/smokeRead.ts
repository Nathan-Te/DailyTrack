// Lot P4 (plateforme) : `smoke --lecture-seule`, la vérification de la production après chaque déploiement. **Ce mode n'écrit jamais rien** :
// il n'envoie que des `GET` (le `fetch` qu'il reçoit refuse tout le reste, `readOnlyFetch`), jamais d'identifiant de joueur (aucun en-tête
// `X-Player-Id` : rien ne peut être créé ni compté pour un joueur), et les lectures de l'API sont limitées en mémoire (aucune ligne de débit
// écrite). Il vérifie les formes et les codes de réponse des routes qu'un joueur lit : `/api/health` (mêmes champs), `/api/jump/info`
// (l'environnement attendu), le niveau du jour, le classement, le fantôme du premier, la carte des morts et la lecture regroupée, plus les
// en-têtes de cache (une réponse personnelle n'est jamais partagée).
//
// **Garde** (`smokeRefusal`) : ce mode est le **seul** permis contre un serveur de production. Le mode complet (qui crée des joueurs « Fumée »)
// refuse une cible de production qui n'est pas locale, comme depuis le lot P1 (l'image de la CI, lancée en local contre son propre `sqld`,
// reste permise).
//
// Seule écriture possible, et **du serveur, pas de l'outil** : les caches que la première requête d'un joueur, quel qu'il soit, remplirait aussi
// (le niveau du jour calculé et gardé, la carte d'un jour terminé figée) ; jamais un joueur, un temps, une vie ni un compteur.

/** Une adresse locale (l'image de la CI, un poste de développement). */
export function isLocalBase(base: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base.replace(/\/+$/, ""));
}

/**
 * La garde de `smoke` : `null` si l'essai peut partir, sinon le message du refus. `environment` : ce que `/api/jump/info` a rendu (`null` si
 * illisible). Seul `--lecture-seule` est permis contre la production ; le mode complet ne l'est qu'en local.
 */
export function smokeRefusal(o: { base: string; environment: string | null; readOnly: boolean }): string | null {
  if (o.readOnly) return null;
  if (o.environment === "production" && !isLocalBase(o.base)) {
    return `smoke refuse ${o.base} : c'est un serveur de production. Le mode complet crée des joueurs « Fumée » : recette ou serveur local seulement. Contre la production, seul « smoke --lecture-seule » est permis.`;
  }
  return null;
}

export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

/** Un `fetch` qui **refuse d'écrire** : tout ce qui n'est pas une lecture (`GET`, `HEAD`) lève avant de partir. */
export function readOnlyFetch(inner: FetchFn): FetchFn {
  return (input, init = {}) => {
    const method = (init.method ?? "GET").toUpperCase();
    if (method !== "GET" && method !== "HEAD") return Promise.reject(new Error(`smoke --lecture-seule : ${method} ${input} refusé (ce mode n'écrit jamais rien)`));
    if (init.body !== undefined && init.body !== null) return Promise.reject(new Error(`smoke --lecture-seule : corps refusé pour ${input}`));
    const headers = new Headers(init.headers);
    if (headers.has("x-player-id")) return Promise.reject(new Error(`smoke --lecture-seule : identifiant de joueur refusé pour ${input}`));
    return inner(input, { ...init, method });
  };
}

/** Une vérification : ce qu'elle dit, son résultat, la route et la réponse (pour le résumé du run). */
export interface SmokeCheck {
  label: string;
  ok: boolean;
  route: string;
  status: number;
  detail: string;
}

/** Les champs de `/api/health` (lot 28, inchangés depuis) : `testClock` n'existe qu'avec l'horloge de test, `revision` qu'en ligne. */
export const HEALTH_FIELDS = ["ok", "db", "simVersion", "generatorVersion", "today", "clock", "salonMinutes", "salonOverride"] as const;
const HEALTH_OPTIONAL = ["revision", "testClock"];

const isRow = (r: unknown): boolean => {
  const o = r as Record<string, unknown> | null;
  return !!o && Number.isInteger(o.rank) && typeof o.name === "string" && Number.isInteger(o.ticks) && Number.isInteger(o.deaths);
};
const isBoard = (b: unknown, date: string): boolean => {
  const o = b as Record<string, unknown> | null;
  return !!o && o.date === date && typeof o.open === "boolean" && Number.isInteger(o.participants) && Array.isArray(o.top) && o.top.length <= 10 && o.top.every(isRow) && (o.me === null || isRow(o.me));
};
const isGhost = (g: unknown, date: string): boolean => {
  const o = g as Record<string, unknown> | null;
  return !!o && o.date === date && typeof o.name === "string" && typeof o.replay === "string" && o.replay.length > 0 && Number.isInteger(o.ticks) && Number.isInteger(o.simVersion) && o.mine === false && !("playerId" in o);
};
const isDeathMap = (m: unknown, date: string): boolean => {
  const o = m as Record<string, unknown> | null;
  return !!o && o.date === date && typeof o.open === "boolean" && Number.isInteger(o.players) && Number.isInteger(o.deaths) && Array.isArray(o.tiles) && o.tiles.every((t) => Array.isArray(t) && t.length === 4);
};
const personal = (h: Headers): boolean => /\bprivate\b/.test(h.get("cache-control") ?? "") && /x-player-id/i.test(h.get("vary") ?? "");
const shared = (h: Headers, seconds: number): boolean => /\bpublic\b/.test(h.get("cache-control") ?? "") && (h.get("cache-control") ?? "").includes(`max-age=${seconds}`);

/**
 * L'essai en lecture seule. `fetchImpl` est enveloppé par `readOnlyFetch` (aucune écriture ne peut partir) ; `expectEnvironment` : ce que
 * `/api/jump/info` doit dire (`production` pour la vérification de la production), ou rien (l'environnement est seulement relevé).
 */
export async function readOnlySmoke(base: string, fetchImpl: FetchFn, o: { expectEnvironment?: string; origin?: string } = {}): Promise<SmokeCheck[]> {
  const root = base.replace(/\/+$/, "");
  const f = readOnlyFetch(fetchImpl);
  const checks: SmokeCheck[] = [];
  const get = async (route: string): Promise<{ status: number; body: any; headers: Headers }> => {
    try {
      const res = await f(root + route, { method: "GET", headers: o.origin ? { Origin: o.origin } : {} });
      const text = await res.text();
      let body: unknown = null;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = { illisible: text.slice(0, 120) };
      }
      return { status: res.status, body, headers: res.headers };
    } catch (e) {
      return { status: 0, body: { erreur: e instanceof Error ? e.message : String(e) }, headers: new Headers() };
    }
  };
  const check = (label: string, ok: boolean, route: string, r: { status: number; body: unknown }, detail = "") =>
    checks.push({ label, ok, route, status: r.status, detail: ok ? detail : `${detail}${detail ? " — " : ""}réponse ${r.status} ${JSON.stringify(r.body).slice(0, 300)}` });

  // DailyTrack et la plateforme : /api/health, mêmes champs qu'avant.
  const health = await get("/api/health");
  const keys = health.body && typeof health.body === "object" ? Object.keys(health.body as object) : [];
  const fieldsOk = HEALTH_FIELDS.every((k) => keys.includes(k)) && keys.every((k) => (HEALTH_FIELDS as readonly string[]).includes(k) || HEALTH_OPTIONAL.includes(k));
  const prod = o.expectEnvironment === "production";
  check(
    "santé : base joignable, mêmes champs qu'avant",
    health.status === 200 && health.body?.ok === true && health.body?.db === "ok" && fieldsOk && (!prod || (health.body?.salonOverride === false && !("testClock" in health.body))),
    "/api/health",
    health,
    `${keys.join(", ")}`,
  );
  const date: string = typeof health.body?.today === "string" ? health.body.today : "";

  // DailyJump : l'environnement, puis ce qu'un joueur lit.
  const info = await get("/api/jump/info");
  check(
    `DailyJump : /api/jump/info${o.expectEnvironment ? ` (environnement « ${o.expectEnvironment} »)` : ""}`,
    info.status === 200 && Number.isInteger(info.body?.simVersion) && Number.isInteger(info.body?.generatorVersion) && info.body?.today === date && (!o.expectEnvironment || info.body?.environment === o.expectEnvironment),
    "/api/jump/info",
    info,
    `environnement ${String(info.body?.environment)}, simulation v${String(info.body?.simVersion)}, générateur v${String(info.body?.generatorVersion)}`,
  );
  const dayRoute = `/api/jump/day/${date}`;
  const day = await get(dayRoute);
  check(
    "DailyJump : niveau du jour (identifiant, empreinte, temps de l'auteur), cache public court",
    day.status === 200 && typeof day.body?.id === "string" && typeof day.body?.hash === "string" && Number.isInteger(day.body?.authorTicks) && shared(day.headers, 30),
    dayRoute,
    day,
    `${String(day.body?.id)} (${String(day.body?.source)})`,
  );
  const board = await get(`${dayRoute}/board`);
  check(
    "DailyJump : classement du jour (top 10, nombre de classés), jamais en cache partagé",
    board.status === 200 && isBoard(board.body, date) && board.body.open === true && board.body.me === null && personal(board.headers),
    `${dayRoute}/board`,
    board,
    `${String(board.body?.participants)} classé(s)`,
  );
  const ghost = await get(`${dayRoute}/ghost/first`);
  check(
    "DailyJump : fantôme du premier (ou 404 no_ghost sans classé)",
    (ghost.status === 200 && isGhost(ghost.body, date) && personal(ghost.headers)) || (ghost.status === 404 && ghost.body?.error === "no_ghost"),
    `${dayRoute}/ghost/first`,
    ghost,
    ghost.status === 200 ? `« ${String(ghost.body?.name)} »` : "personne n'est classé",
  );
  const deaths = await get(`${dayRoute}/deaths`);
  check(
    "DailyJump : carte des morts du jour, cache public court",
    deaths.status === 200 && isDeathMap(deaths.body, date) && shared(deaths.headers, 30),
    `${dayRoute}/deaths`,
    deaths,
    `${String(deaths.body?.players)} joueur(s), ${String(deaths.body?.deaths)} mort(s)`,
  );
  const bundle = await get(`${dayRoute}/bundle`);
  const b = bundle.body as Record<string, any> | null;
  check(
    "DailyJump : lecture regroupée (classement, fantôme, carte), jamais en cache partagé",
    bundle.status === 200 &&
      !!b &&
      b.date === date &&
      isBoard(b.board, date) &&
      (b.ghost === null ? b.board.participants === 0 : isGhost(b.ghost, date)) &&
      isDeathMap(b.deaths, date) &&
      !("profile" in b) &&
      personal(bundle.headers),
    `${dayRoute}/bundle`,
    bundle,
    `${String(b?.board?.participants)} classé(s), fantôme ${b?.ghost ? `« ${String(b.ghost.name)} »` : "aucun"}, carte ${String(b?.deaths?.players)} joueur(s)`,
  );
  // Un jour fermé (hier) : figé, gardé longtemps. Avant le premier niveau, il n'existe pas (404) : rien à vérifier.
  const yesterday = new Date(Date.parse(`${date}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  const past = await get(`/api/jump/day/${yesterday}/bundle`);
  if (past.status !== 404) {
    check(
      "DailyJump : lecture regroupée d'hier (jour figé : cache long, jamais partagé)",
      past.status === 200 && past.body?.open === false && /max-age=86400/.test(past.headers.get("cache-control") ?? "") && personal(past.headers),
      `/api/jump/day/${yesterday}/bundle`,
      past,
    );
  }
  // Lot I2 : le portail (sans joueur : la réponse publique, gardée au plus 60 s et jamais au-delà du prochain minuit de Paris).
  const portail = await get("/api/portail/jour");
  const p = portail.body as Record<string, any> | null;
  const maxAge = Number(/max-age=(\d+)/.exec(portail.headers.get("cache-control") ?? "")?.[1] ?? NaN);
  const jeux: any[] = Array.isArray(p?.jeux) ? p.jeux : [];
  check(
    "portail : les jeux du jour (numéro, thème, seuils), l'heure du serveur, le prochain minuit ; public, 60 s au plus",
    portail.status === 200 &&
      !!p &&
      p.date === date &&
      Date.parse(p.prochainJour) > Date.parse(p.maintenant) &&
      ["cdj", "jump"].every((code) => jeux.some((j) => j.jeu === code && Number.isInteger(j.numero) && j.numero > 0)) &&
      !("joueur" in p) &&
      /\bpublic\b/.test(portail.headers.get("cache-control") ?? "") &&
      maxAge <= 60 &&
      /x-player-id/i.test(portail.headers.get("vary") ?? ""),
    "/api/portail/jour",
    portail,
    jeux.map((j) => `${String(j.jeu)} n° ${String(j.numero)} (${String(j.theme)})`).join(", "),
  );
  return checks;
}

/** Le résumé d'un run (Markdown, `GITHUB_STEP_SUMMARY`) : chaque vérification, et pour un échec la route et la réponse. */
export function smokeSummary(base: string, checks: SmokeCheck[], rollback: string | null, target = "de la production"): string {
  const failed = checks.filter((c) => !c.ok);
  const lines = [
    failed.length ? `### ❌ Vérification ${target} : ${failed.length} échec(s)` : `### ✅ Vérification ${target} : tout est bon`,
    "",
    `Cible : ${base} — \`smoke --lecture-seule\` (aucune écriture : des GET seulement, sans identifiant de joueur).`,
    "",
    "| | Vérification | Route | Réponse |",
    "|---|---|---|---|",
    ...checks.map((c) => `| ${c.ok ? "✓" : "✗"} | ${c.label} | \`${c.route}\` | ${c.status}${c.ok ? (c.detail ? ` — ${c.detail.replace(/\|/g, "/")}` : "") : ` — ${c.detail.replace(/\|/g, "/")}`} |`),
  ];
  if (failed.length && rollback) lines.push("", "**Retour arrière (manuel)** : rien n'est annulé automatiquement. Pour revenir à la révision d'avant :", "", "```bash", rollback, "```");
  return `${lines.join("\n")}\n`;
}
