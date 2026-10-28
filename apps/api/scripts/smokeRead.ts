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

/**
 * Un `fetch` qui **refuse d'écrire** : tout ce qui n'est pas une lecture (`GET`, `HEAD`) lève avant de partir. Jamais d'identifiant de joueur, sauf
 * (lot I3, la vérification `Vary` « par Hosting ») **un seul identifiant**, nommé d'avance, et pour des `GET` du portail seulement
 * (`/api/portail/`) : une lecture ne crée ni ne compte rien pour un joueur (en mémoire, aucune ligne de débit).
 */
export function readOnlyFetch(inner: FetchFn, o: { joueurPermis?: string } = {}): FetchFn {
  return (input, init = {}) => {
    const method = (init.method ?? "GET").toUpperCase();
    if (method !== "GET" && method !== "HEAD") return Promise.reject(new Error(`smoke --lecture-seule : ${method} ${input} refusé (ce mode n'écrit jamais rien)`));
    if (init.body !== undefined && init.body !== null) return Promise.reject(new Error(`smoke --lecture-seule : corps refusé pour ${input}`));
    const headers = new Headers(init.headers);
    const joueur = headers.get("x-player-id");
    if (joueur !== null && !(o.joueurPermis !== undefined && joueur === o.joueurPermis && /^https?:\/\/[^/]+\/api\/portail\//.test(input))) {
      return Promise.reject(new Error(`smoke --lecture-seule : identifiant de joueur refusé pour ${input}`));
    }
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
      /x-player-id/i.test(portail.headers.get("vary") ?? "") &&
      // Lot I3 : le numéro de journée commun (null avant le 23/10/2026) et, pour chaque jeu, son dossier et son nom (« jeu suivant du jour »).
      (p.journee === null || (Number.isInteger(p.journee) && p.journee >= 1)) &&
      jeux.every((j) => typeof j.site === "string" && j.site !== "" && typeof j.nom === "string" && j.nom !== ""),
    "/api/portail/jour",
    portail,
    `journée ${String(p?.journee)} — ${jeux.map((j) => `${String(j.jeu)} n° ${String(j.numero)} (${String(j.theme)})`).join(", ")}`,
  );
  // Lot I3 : le classement du jour tous jeux confondus (sans joueur : public, 30 s au plus, jamais d'identifiant dans la réponse).
  const classement = await get("/api/portail/classement");
  check(
    "portail : le classement du jour (barème, jeux, haut du classement), public, 30 s au plus",
    estClassement(classement.body, date) && /\bpublic\b/.test(classement.headers.get("cache-control") ?? "") && Number(/max-age=(\d+)/.exec(classement.headers.get("cache-control") ?? "")?.[1] ?? NaN) <= 30 && /x-player-id/i.test(classement.headers.get("vary") ?? ""),
    "/api/portail/classement",
    classement,
    `${String(classement.body?.classes)} classé(s)`,
  );
  return checks;
}

/**
 * Lot R8 — **après la remise à zéro du lancement** (`smoke --lecture-seule --vide`) : la base est vide. Des `GET` seulement, aucun identifiant :
 * la génération de données est annoncée (> 0), aucun classé aujourd'hui dans DailyTrack, DailyJump ni au classement du jour du portail, aucune mort
 * enregistrée, et la réponse publique du portail ne porte aucun joueur. À lancer sur l'adresse du **service** (Cloud Run), pas sur celle de Firebase
 * Hosting : son cache public (30 à 60 s) pourrait encore montrer l'ancien classement.
 */
export async function verifierVide(base: string, fetchImpl: FetchFn): Promise<SmokeCheck[]> {
  const root = base.replace(/\/+$/, "");
  const f = readOnlyFetch(fetchImpl);
  const checks: SmokeCheck[] = [];
  const get = async (route: string): Promise<{ status: number; body: any }> => {
    try {
      const res = await f(root + route, { method: "GET" });
      const text = await res.text();
      return { status: res.status, body: text ? JSON.parse(text) : null };
    } catch (e) {
      return { status: 0, body: { erreur: e instanceof Error ? e.message : String(e) } };
    }
  };
  const check = (label: string, ok: boolean, route: string, r: { status: number; body: unknown }, detail = "") =>
    checks.push({ label, ok, route, status: r.status, detail: ok ? detail : `${detail}${detail ? " — " : ""}réponse ${r.status} ${JSON.stringify(r.body).slice(0, 200)}` });
  const portail = await get("/api/portail/jour");
  const date: string = typeof portail.body?.date === "string" ? portail.body.date : "";
  check(
    "remise à zéro : le serveur annonce une génération de données, et le portail ne montre aucun joueur",
    portail.status === 200 && Number.isSafeInteger(portail.body?.generation) && portail.body.generation > 0 && !("joueur" in portail.body),
    "/api/portail/jour",
    portail,
    `génération ${String(portail.body?.generation)}`,
  );
  const track = await get(`/api/day/${date}/leaderboard?limit=10`);
  check("remise à zéro : DailyTrack, aucun classé aujourd'hui", track.status === 200 && track.body?.participants === 0 && track.body?.top?.length === 0, `/api/day/${date}/leaderboard`, track, "0 classé");
  const jump = await get(`/api/jump/day/${date}/board`);
  check("remise à zéro : DailyJump, aucun classé aujourd'hui", jump.status === 200 && jump.body?.participants === 0 && jump.body?.top?.length === 0, `/api/jump/day/${date}/board`, jump, "0 classé");
  const morts = await get(`/api/jump/day/${date}/deaths`);
  check("remise à zéro : DailyJump, aucune mort enregistrée aujourd'hui", morts.status === 200 && morts.body?.players === 0 && morts.body?.deaths === 0, `/api/jump/day/${date}/deaths`, morts, "0 joueur, 0 mort");
  const classement = await get("/api/portail/classement");
  check(
    "remise à zéro : le classement du jour du portail est vide",
    (classement.status === 200 && classement.body?.classes === 0 && classement.body?.top?.length === 0) || (classement.status === 404 && classement.body?.error === "unknown_day"),
    "/api/portail/classement",
    classement,
    classement.status === 200 ? "0 classé" : "pas encore de journée (avant le lancement)",
  );
  return checks;
}

/** La forme du classement du jour (`GET /api/portail/classement`). */
function estClassement(b: unknown, date: string): boolean {
  const o = b as Record<string, any> | null;
  return (
    !!o &&
    o.date === date &&
    typeof o.ouvert === "boolean" &&
    Number.isInteger(o.classes) &&
    typeof o.vue === "string" &&
    Array.isArray(o.jeux) &&
    o.jeux.length >= 2 &&
    Array.isArray(o.top) &&
    o.top.length <= 50 &&
    o.top.every((l: any) => Number.isInteger(l.rang) && typeof l.pseudo === "string" && (l.tempsMs === null || Number.isInteger(l.tempsMs)) && typeof l.complet === "boolean" && typeof l.resultats === "object" && !("id" in l) && !("playerId" in l)) &&
    !("moi" in o)
  );
}

/**
 * Lot I3 — **la vérification `Vary` « par Hosting »**. Le portail rend la même adresse (`/api/portail/jour`, `/api/portail/classement`) en deux
 * versions : publique (gardée par le cache de Firebase Hosting, 60 s au plus) et personnelle (avec `X-Player-Id`, `private`). Tout repose sur le
 * `Vary: X-Player-Id` : si Hosting l'ignorait, une lecture avec identifiant faite juste après une lecture sans recevrait la réponse publique (sans
 * l'état du joueur), et surtout une lecture sans identifiant ne doit **jamais** recevoir l'état d'un joueur. À lancer sur l'adresse de Firebase
 * Hosting (pas directement Cloud Run : sans CDN, la vérification ne prouve rien). `joueur` : un identifiant **connu** du serveur (le joueur de
 * démonstration de la recette, qui a fini Track aujourd'hui) pour constater qu'il reçoit son état ; sans lui, un identifiant inventé (production :
 * aucun joueur n'est créé, la lecture rend `404 unknown_player`, jamais la réponse publique mise en cache).
 */
export async function varyParHosting(base: string, fetchImpl: FetchFn, o: { joueur?: string } = {}): Promise<SmokeCheck[]> {
  const root = base.replace(/\/+$/, "");
  const connu = o.joueur !== undefined;
  const joueur = o.joueur ?? Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
  const f = readOnlyFetch(fetchImpl, { joueurPermis: joueur });
  const checks: SmokeCheck[] = [];
  const get = async (route: string, avecJoueur: boolean) => {
    try {
      const res = await f(root + route, { method: "GET", headers: avecJoueur ? { "X-Player-Id": joueur } : {} });
      const text = await res.text();
      let body: any = null;
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
  const check = (label: string, ok: boolean, route: string, r: { status: number; body: unknown; headers: Headers }, detail = "") =>
    checks.push({ label, ok, route, status: r.status, detail: ok ? detail : `${detail}${detail ? " — " : ""}réponse ${r.status} ${JSON.stringify(r.body).slice(0, 200)}` });
  const sansEtat = (b: any) => !!b && !("joueur" in b) && Array.isArray(b.jeux) && b.jeux.every((j: any) => !("etat" in j));
  const detailCache = (h: Headers) => `x-cache ${h.get("x-cache") ?? "—"}, age ${h.get("age") ?? "—"}, vary ${h.get("vary") ?? "—"}`;

  for (const route of ["/api/portail/jour", "/api/portail/classement"]) {
    const jour = route.endsWith("/jour");
    // 1. Deux lectures sans identifiant : la réponse publique, que le cache de Hosting garde.
    await get(route, false);
    const publique = await get(route, false);
    check(`par Hosting (${route}) : sans identifiant, la réponse publique`, publique.status === 200 && (jour ? sansEtat(publique.body) : !("moi" in publique.body)) && /\bpublic\b/.test(publique.headers.get("cache-control") ?? ""), route, publique, detailCache(publique.headers));
    // 2. Tout de suite après : avec identifiant. Elle doit recevoir SA réponse (l'état du joueur), pas la publique gardée.
    const perso = await get(route, true);
    const bonne = connu
      ? perso.status === 200 && (jour ? perso.body?.joueur?.pseudo !== undefined && perso.body.jeux.every((j: any) => j.etat?.statut !== undefined) : "moi" in perso.body)
      : perso.status === 404 && perso.body?.error === "unknown_player";
    check(
      `par Hosting (${route}) : avec identifiant juste après, ${connu ? "l'état du joueur (pas la réponse publique gardée)" : "la réponse du serveur pour un inconnu (404), pas la réponse publique gardée"}`,
      bonne && /\bprivate\b|no-store/.test(perso.headers.get("cache-control") ?? "") && (!connu || /x-player-id/i.test(perso.headers.get("vary") ?? "")),
      route,
      perso,
      `${detailCache(perso.headers)}, Cache-Control « ${perso.headers.get("cache-control") ?? "—"} »`,
    );
    // 3. Et l'inverse : sans identifiant, jamais l'état d'un joueur.
    const apres = await get(route, false);
    check(`par Hosting (${route}) : sans identifiant juste après, jamais l'état d'un joueur`, apres.status === 200 && (jour ? sansEtat(apres.body) : !("moi" in apres.body)), route, apres, detailCache(apres.headers));
  }
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
