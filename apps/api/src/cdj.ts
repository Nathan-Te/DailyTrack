import {
  GENERATOR_VERSION,
  MAX_VARIANT,
  BASCULE_LOT_35,
  MEDAL_FACTORS,
  MEDAL_FACTORS_35,
  MEDAL_PERCENTILES,
  PREMIER_JOUR,
  ReplayError,
  SIM_VERSION,
  circuitNumber,
  dailyCircuit,
  dailyTrackId,
  decodeReplay,
  etatGarage,
  formatDay,
  isVariant,
  medalFor,
  medalDayStats,
  medalPoolStats,
  medalsFor,
  nouvellesVoitures,
  parseDay,
  parseTrack,
  progresGarage,
  ratiosOf,
  replayRace,
  replayTicks,
  themeByName,
  thresholdsOf,
  themeForDay,
  type EtatVoiture,
  type Medal,
  type MedalRatios,
  type PaletteName,
  type ProgresGarage,
  type ResultatDuJour,
  type ThemeName,
  type Track,
} from "@cdj/sim";
import { inputsHash, trackInputs } from "./copies";
import { replayUnits } from "./replayCost";
import { HttpError } from "./errors";
import type { GameDefinition, GameInstance, Platform, PortailDuJeu, RequestInfo, Statement } from "./games";
import { DEFAULT_SALON_LIMITS, createSalon, salonSessionMs, type SalonLimits } from "./salon";

// DailyTrack (`cdj`) au registre des jeux (lot P0 de la plateforme) : le classement du jour (lot 5), le planning et l'admin (lot 14), le Salon
// (lot 27, `salon.ts`) et le contenu du profil (lot 30). **Aucune route ne change** : les chemins historiques (`/api/day`, `/api/submit`,
// `/api/planning`, `/api/admin`, `/api/salon`) restent sous `/api`, les réponses sont les mêmes ; ce code vient d'`api.ts`, déplacé tel quel.
// Ce qui est commun à tous les jeux (identité, pseudo, débit, schéma) vient de la plateforme (`platform.ts`, `identity.ts`).
//
// Le serveur ne fait confiance à aucun temps annoncé : il reçoit la rediffusion (la suite des commandes du joueur), la rejoue avec le même code
// de simulation que le jeu, et n'enregistre que le temps qu'il a lui-même recalculé.

/** Un joueur qui passe la ligne juste après minuit (heure de Paris) peut encore classer sa course du jour précédent. */
export const GRACE_MS = 10 * 60_000;
/** Longueur minimale du jeton d'admin : un jeton court se devine. */
export const ADMIN_TOKEN_MIN = 16;
/** Jours d'avance au plus pour remplacer un circuit. */
export const PLANNING_HORIZON = 60;
/** Mauvais jetons tolérés par fenêtre de débit et par adresse, avant de bloquer (même avec le bon jeton). */
export const ADMIN_MAX_FAILURES = 10;
/** Lot I2 : durée de vie en mémoire du nombre de classés du jour montré par le portail (l'écart minimal entre deux relectures d'un jeu). */
export const CLASSES_MEMO_MS = 30_000;
/** Lot 32 : au plus une ligne de journal par cet intervalle pour l'usage de l'ancien `?player=` (le compte complet est dans `/api/admin/overview`). */
export const LEGACY_LOG_MS = 5 * 60_000;
/** Lot 41 : lectures du Garage (`GET /api/garage`) par adresse et par joueur et par fenêtre, comptées en mémoire (une lecture n'écrit rien). */
export const GARAGE_READS_PER_CLIENT = 120;
/** Lot R7 : lectures du classement et des fantômes par adresse et par fenêtre (chacune lit tous les temps du jour : coût proportionnel au nombre de joueurs). */
export const BOARD_READS_PER_CLIENT = 300;
export const GARAGE_READS_PER_PLAYER = 60;
/** Lot 35 : jours lus au plus par l'outil de calibrage des médailles (`GET /api/admin/medailles`), aujourd'hui compris. */
export const MEDAILLES_JOURS = 120;

/** Tables de DailyTrack. Créées au premier appel (`CREATE … IF NOT EXISTS`) : pas de migration manuelle. */
export const CDJ_SCHEMA: string[] = [
  // Cache des circuits du jour : calculés une fois (générateur + pilote de validation, coûteux), puis figés.
  `CREATE TABLE IF NOT EXISTS circuits (
     day INTEGER PRIMARY KEY,
     track_id TEXT NOT NULL,
     spec TEXT NOT NULL,
     author_ms INTEGER NOT NULL,
     attempt INTEGER NOT NULL,
     palette TEXT NOT NULL,
     created_at INTEGER NOT NULL,
     author_hash TEXT
   )`,
  // Planning (lot 14) : les jours dont le circuit a été remplacé à l'avance par l'admin. Pas de ligne = circuit d'origine
  // (variante 0, thème de la date). `theme` : thème imposé, ou NULL pour celui de la date.
  `CREATE TABLE IF NOT EXISTS planning (
     day INTEGER PRIMARY KEY,
     variant INTEGER NOT NULL,
     theme TEXT,
     chosen_at INTEGER NOT NULL
   )`,
  // Meilleur temps de chaque joueur pour chaque jour, avec la rediffusion qui l'a produit (sert de fantôme).
  `CREATE TABLE IF NOT EXISTS results (
     day INTEGER NOT NULL,
     player_id TEXT NOT NULL,
     ms INTEGER NOT NULL,
     splits TEXT NOT NULL,
     replay TEXT NOT NULL,
     respawns INTEGER NOT NULL,
     submitted_at INTEGER NOT NULL,
     final_rank INTEGER,
     final_total INTEGER,
     PRIMARY KEY (day, player_id)
   )`,
  `CREATE INDEX IF NOT EXISTS results_by_time ON results (day, ms, submitted_at)`,
  // Lot 30 : « mes temps » (GET /api/me) lit les résultats d'un joueur sans parcourir toute la table.
  `CREATE INDEX IF NOT EXISTS results_by_player ON results (player_id, day)`,
  // --- Le Salon (lot 27) ---
  // Meilleur temps de chaque joueur pour chaque session, avec la rediffusion qui l'a produit (sert de fantôme). `ref` : référence
  // publique du joueur pour cette session (empreinte salée : l'identifiant secret ne sort jamais du serveur). Effacé à la fin de la session (+ minute de grâce : lot 27b).
  `CREATE TABLE IF NOT EXISTS salon_runs (
     session INTEGER NOT NULL,
     player_id TEXT NOT NULL,
     ref TEXT NOT NULL,
     name TEXT NOT NULL,
     ms INTEGER NOT NULL,
     splits TEXT NOT NULL,
     replay TEXT NOT NULL,
     submitted_at INTEGER NOT NULL,
     PRIMARY KEY (session, player_id)
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS salon_runs_by_ref ON salon_runs (session, ref)`,
  `CREATE INDEX IF NOT EXISTS salon_runs_by_time ON salon_runs (session, ms, submitted_at)`,
  `CREATE INDEX IF NOT EXISTS salon_runs_by_date ON salon_runs (submitted_at)`,
  // Version du classement d'une session : augmente à chaque temps amélioré ou pseudo changé (le jeu ne recharge que si elle change).
  `CREATE TABLE IF NOT EXISTS salon_sessions (
     session INTEGER PRIMARY KEY,
     version INTEGER NOT NULL
   )`,
  // Cache des circuits de session : générés à l'avance (deux minutes avant la fin de la session précédente), puis figés.
  `CREATE TABLE IF NOT EXISTS salon_circuits (
     session INTEGER PRIMARY KEY,
     track_id TEXT NOT NULL,
     spec TEXT NOT NULL,
     created_at INTEGER NOT NULL
   )`,
  // Présence : empreinte du joueur et dernier passage. Rien d'autre n'est conservé (ni identifiant, ni adresse).
  `CREATE TABLE IF NOT EXISTS salon_presence (
     key TEXT PRIMARY KEY,
     seen_at INTEGER NOT NULL
   )`,
  // Dernier envoi de chaque joueur (empreinte) : au plus un envoi toutes les 5 s.
  `CREATE TABLE IF NOT EXISTS salon_throttle (
     key TEXT PRIMARY KEY,
     at INTEGER NOT NULL
   )`,
];

export interface CdjOptions {
  /** Jeton de l'admin (lot 14, `ADMIN_TOKEN`) ; absent ou trop court : l'admin est désactivé (les routes n'existent pas). */
  adminToken?: string;
  /** Durée d'une session du Salon en minutes (`SALON_MINUTES` : tests, essais locaux et recette seulement). */
  salonMinutes?: number;
  /** Limites de débit du Salon (voir `DEFAULT_SALON_LIMITS`). */
  salonLimits?: Partial<SalonLimits>;
  /** Joueurs fictifs (`history:seed`, `recette:seed`) : jamais réglé par le serveur de production. */
  demoPlayers?: boolean;
}

interface Circuit {
  day: number;
  trackId: string;
  /** Variante du planning (0 = d'origine) et thème imposé (`null` = celui de la date). */
  variant: number;
  theme: ThemeName | null;
  spec: string;
  authorMs: number;
  attempt: number;
  palette: PaletteName;
  track: Track;
  /**
   * Lot R9 : l'empreinte des entrées de l'auteur du circuit (le pilote automatique, `copies.ts`) : une course qui en est la copie est refusée. `null` : pas
   * calculée (ligne d'avant, jour passé : un jour fermé n'accepte plus rien).
   */
  authorHash: string | null;
}

export type CdjInstance = GameInstance & {
  salon: ReturnType<typeof createSalon>;
  /** Lot R5 : la garde de l'admin (jeton `ADMIN_TOKEN`, échecs comptés), pour les routes d'admin de la plateforme (`POST /api/admin/effacer`). */
  requireAdmin(req: Request, info: RequestInfo): Promise<void>;
};

export function createCdj(platform: Platform, options: CdjOptions): CdjInstance {
  const { db, now, log, limits, players, hashKey, hit, readJson, playerIdOf, today, sinceMidnight } = platform;
  const circuits = new Map<number, Circuit>();
  /** Circuits en cours de calcul (jour + identifiant) : deux requêtes simultanées n'en font qu'un (le générateur coûte ≈ 0,2–0,5 s de calcul). */
  const generating = new Map<string, Promise<Circuit>>();
  const sessionMs = salonSessionMs(options.salonMinutes) ?? 600_000;

  // --- Planning et circuit du jour (cache : le générateur est coûteux, le résultat est figé) -----------------
  /** Variante et thème imposé du planning pour un jour (`{ 0, null }` : le circuit d'origine). */
  async function planOf(day: number): Promise<{ variant: number; theme: ThemeName | null }> {
    const row = await db.first<{ variant: number; theme: string | null }>("SELECT variant, theme FROM planning WHERE day = ?", [day]);
    if (!row) return { variant: 0, theme: null };
    return { variant: isVariant(row.variant) ? row.variant : 0, theme: themeByName(row.theme)?.name ?? null };
  }

  /**
   * Le circuit en vigueur ce jour-là : celui du planning s'il y en a un, sinon l'original. Toujours celui-là qui sert au
   * rejeu : une ligne ou une mémoire d'une autre variante (ou d'une autre version du générateur) est ignorée.
   */
  async function getCircuit(day: number): Promise<Circuit> {
    const { variant, theme } = await planOf(day);
    const expected = dailyTrackId(day, theme, variant);
    const memo = circuits.get(day);
    if (memo && memo.trackId === expected) return memo;
    const key = `${day}|${expected}`;
    let pending = generating.get(key);
    if (!pending) {
      pending = loadCircuit(day, variant, theme, expected).finally(() => generating.delete(key));
      generating.set(key, pending);
    }
    return pending;
  }

  /**
   * Lit le circuit en base, ou le génère et le garde. Avec plusieurs instances, deux d'entre elles peuvent le calculer en même temps :
   * le résultat est le même (déterministe) et l'écriture identique, donc sans conséquence.
   */
  async function loadCircuit(day: number, variant: number, theme: ThemeName | null, expected: string): Promise<Circuit> {
    const row = await db.first<{ track_id: string; spec: string; author_ms: number; attempt: number; palette: string; author_hash: string | null }>(
      "SELECT track_id, spec, author_ms, attempt, palette, author_hash FROM circuits WHERE day = ?",
      [day],
    );
    let circuit: Circuit;
    // Lot R9 : un circuit gardé sans l'empreinte de son auteur (écrit avant le lot) est recalculé tant que son jour accepte des temps ; un jour fermé ne sert plus à rien.
    if (row && row.track_id === expected && (row.author_hash !== null || day < today() - 1)) {
      circuit = {
        day,
        trackId: row.track_id,
        variant,
        theme,
        spec: row.spec,
        authorMs: row.author_ms,
        attempt: row.attempt,
        palette: row.palette as PaletteName,
        track: parseTrack(row.track_id, row.spec),
        authorHash: row.author_hash,
      };
    } else {
      const started = performance.now();
      circuit = await withAuthorHash(generate(day, variant, theme));
      await storeCircuit(circuit);
      log("INFO", "circuit du jour généré", { day: formatDay(day), trackId: circuit.trackId, attempt: circuit.attempt, ms: Math.round(performance.now() - started) });
    }
    circuits.set(day, circuit);
    return circuit;
  }

  /** Le circuit généré, et (en plus) le texte des entrées de son auteur : l'empreinte s'en tire à part (`withAuthorHash`, asynchrone). */
  function generate(day: number, variant: number, theme: ThemeName | null): Circuit & { authorInputs: string } {
    const c = dailyCircuit(day, variant, theme);
    if (c.fallback) throw new HttpError(503, "circuit_unavailable", "Circuit indisponible, réessaie plus tard");
    return {
      day,
      trackId: c.track.id,
      variant,
      theme,
      spec: c.spec,
      authorMs: c.authorMs,
      attempt: c.attempt,
      palette: c.palette,
      track: c.track,
      authorHash: null,
      authorInputs: trackInputs(c.authorReplay.runs, replayTicks(c.authorReplay)),
    };
  }

  /** Lot R9 : le circuit avec l'empreinte des entrées de son auteur (le pilote). */
  async function withAuthorHash(c: Circuit & { authorInputs: string }): Promise<Circuit> {
    const { authorInputs, ...circuit } = c;
    return { ...circuit, authorHash: await inputsHash(authorInputs) };
  }

  const storeCircuit = (c: Circuit) =>
    db.run("INSERT OR REPLACE INTO circuits (day, track_id, spec, author_ms, attempt, palette, created_at, author_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [
      c.day,
      c.trackId,
      c.spec,
      c.authorMs,
      c.attempt,
      c.palette,
      now(),
      c.authorHash,
    ]);

  function dayOf(date: unknown, mustBeOpen = false): number {
    const day = typeof date === "string" ? parseDay(date) : null;
    if (day === null) throw new HttpError(400, "invalid_date", "Date attendue au format AAAA-MM-JJ");
    if (day < PREMIER_JOUR || day > today()) throw new HttpError(404, "unknown_day", "Ce jour n'a pas (encore) de circuit");
    if (mustBeOpen) {
      const open = day === today() || (day === today() - 1 && sinceMidnight() < GRACE_MS);
      if (!open) throw new HttpError(409, "day_closed", "Le classement de ce jour est figé");
    }
    return day;
  }

  // --- Lot 32 : l'identifiant du joueur est dans l'en-tête `X-Player-Id`, jamais dans l'adresse -----------------------------
  // Une adresse finit dans les journaux de requêtes de l'hébergeur (Cloud Run les garde 30 jours) : l'identifiant secret du joueur n'y va plus.
  // **Transition** : l'ancien paramètre `?player=` reste lu (onglets restés ouverts avec l'ancien jeu) quand l'en-tête manque, **jusqu'à la
  // retouche 32b** (date de retrait : docs/lots/lot-32-en-tete-joueur.md). Son usage est compté sans rien retenir du joueur (ni identifiant, ni
  // adresse) : `legacyPlayerParam` dans `/api/admin/overview`, et une ligne de journal par `LEGACY_LOG_MS` au plus (route et total, rien d'autre).
  const legacyPlayerParam = { since: now(), total: 0, byRoute: {} as Record<string, number> };
  let legacyLoggedAt = -Infinity;
  /**
   * Le joueur qui interroge une lecture de DailyTrack, ou `null` (spectateur, lecture anonyme) : l'en-tête d'abord, sinon l'ancien paramètre
   * `?player=` (compté). Un identifiant mal formé est refusé (400 `invalid_player`), d'où qu'il vienne.
   */
  function playerOf(req: Request, url: URL, route: string): string | null {
    const header = req.headers.get("x-player-id");
    if (header !== null) return playerIdOf(header);
    const legacy = url.searchParams.get("player");
    if (legacy === null) return null;
    legacyPlayerParam.total++;
    legacyPlayerParam.byRoute[route] = (legacyPlayerParam.byRoute[route] ?? 0) + 1;
    const t = now();
    if (t - legacyLoggedAt >= LEGACY_LOG_MS) {
      legacyLoggedAt = t;
      log("INFO", "paramètre ?player= encore utilisé (transition du lot 32)", { route, total: legacyPlayerParam.total });
    }
    return playerIdOf(legacy);
  }

  // --- Le Salon (lot 27) : voir salon.ts ------------------------------------------------------------------------------
  const salon = createSalon({
    db,
    players,
    now,
    sessionMs,
    hashKey,
    hit,
    hitAddress: platform.hitAddress,
    peerHit: platform.peerHit,
    spendReplays: platform.spendReplays,
    readJson,
    playerIdOf,
    playerOf,
    limits: { ...DEFAULT_SALON_LIMITS, ...options.salonLimits },
    demoPlayers: options.demoPlayers === true,
    log,
  });

  async function playerName(id: string): Promise<string | null> {
    const row = await db.first<{ name: string }>("SELECT name FROM players WHERE id = ?", [id]);
    return row?.name ?? null;
  }

  async function rankOf(day: number, ms: number, submittedAt: number): Promise<number> {
    const row = await db.first<{ n: number }>(
      "SELECT COUNT(*) AS n FROM results WHERE day = ? AND (ms < ? OR (ms = ? AND submitted_at < ?))",
      [day, ms, ms, submittedAt],
    );
    return (row?.n ?? 0) + 1;
  }

  async function participants(day: number): Promise<number> {
    return (await db.first<{ n: number }>("SELECT COUNT(*) AS n FROM results WHERE day = ?", [day]))?.n ?? 0;
  }

  // --- Routes -----------------------------------------------------------------------------------------------
  /**
   * La validation d'une course (registre des jeux) : la rediffusion est décodée, sa version vérifiée, puis **rejouée** sur le circuit en vigueur
   * ce jour-là. Le temps rendu est celui du rejeu, jamais un temps annoncé.
   */
  async function validateRun(day: number, code: string) {
    // Vérifications bon marché d'abord, rejeu (coûteux) ensuite.
    let replay;
    try {
      replay = decodeReplay(code);
    } catch (e) {
      throw new HttpError(400, "invalid_replay", e instanceof ReplayError ? e.message : "Rediffusion illisible");
    }
    if (replay.simVersion !== SIM_VERSION) {
      // Course enregistrée avec une autre physique (jeu resté ouvert pendant une mise à jour, vieux record) : elle
      // ne donnerait pas le même temps ici. Pas de migration : on la refuse en disant pourquoi.
      const why = replay.simVersion < SIM_VERSION ? "une ancienne version du jeu" : "une version du jeu plus récente que le serveur";
      throw new HttpError(409, "sim_version", `Course enregistrée avec ${why} (simulation v${replay.simVersion}, serveur v${SIM_VERSION}) : recharge la page et refais un temps`);
    }
    const circuit = await getCircuit(day);
    if (replay.trackId !== circuit.trackId) throw new HttpError(409, "track_mismatch", "Cette rediffusion n'est pas celle du circuit de ce jour");

    platform.spendReplays(replayUnits(replay.runs)); // lots R5 et R7 : plafond global de rejeux de l'instance, proportionnel à la durée (503 au-delà)
    const result = replayRace(circuit.track, replay); // la seule source du temps
    if (!result.finished) throw new HttpError(422, "not_finished", "Cette rediffusion ne franchit pas la ligne d'arrivée");

    // Lot R9 : l'empreinte des entrées effectivement jouées (jusqu'à l'arrivée) : la base du refus des copies.
    return { result, circuit, inputsHash: await inputsHash(trackInputs(replay.runs, result.ticks)) };
  }

  async function submit(req: Request, info: RequestInfo): Promise<unknown> {
    const body = await readJson(req);
    const playerId = playerIdOf(req.headers.get("x-player-id") ?? body.playerId); // lot 32 : l'en-tête d'abord ; le corps n'est jamais dans une adresse
    const day = dayOf(body.date, true);
    if (typeof body.replay !== "string" || body.replay.length === 0) throw new HttpError(400, "invalid_replay", "Rediffusion manquante");
    await platform.hitAddress(info, "ip", limits.perClient);
    await hit(await hashKey("p", playerId), limits.perPlayer);

    // Pseudo (lot 30) : réservé à son premier propriétaire, vérifié avant le rejeu (bon marché) et garanti par la base à l'écriture.
    await players.assertActive(playerId);
    const known = await players.find(playerId);
    const name = await players.resolveName(playerId, body.name, known);

    const { result, circuit, inputsHash: hash } = await validateRun(day, body.replay);
    // Lot R9 : une copie (les entrées de l'auteur du circuit, ou d'une course déjà classée d'un autre joueur ce jour-là) est refusée avant d'écrire quoi que ce soit.
    // Le même joueur qui renvoie sa propre course n'est pas concerné ; l'ordre d'arrivée ne change rien à la règle (la première course classée garde sa place).
    if (!platform.allowCopies) {
      if (hash === circuit.authorHash) throw new HttpError(409, "replay_copy", "Cette course est la copie de celle de l'auteur du circuit");
      const same = await db.first<{ n: number }>("SELECT 1 AS n FROM results WHERE day = ? AND inputs_hash = ? AND player_id <> ? LIMIT 1", [day, hash, playerId]);
      if (same) throw new HttpError(409, "replay_copy", "Cette course est la copie d'une autre");
    }

    const t = now();
    await players.save(playerId, name, known);
    const previous = await db.first<{ ms: number; submitted_at: number }>("SELECT ms, submitted_at FROM results WHERE day = ? AND player_id = ?", [day, playerId]);
    const improved = !previous || result.finishMs < previous.ms;
    if (improved) {
      await db.run(
        `INSERT INTO results (day, player_id, ms, splits, replay, respawns, submitted_at, inputs_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (day, player_id) DO UPDATE SET ms = excluded.ms, splits = excluded.splits, replay = excluded.replay,
           respawns = excluded.respawns, submitted_at = excluded.submitted_at, inputs_hash = excluded.inputs_hash WHERE excluded.ms < results.ms`,
        [day, playerId, result.finishMs, JSON.stringify(result.splits), body.replay, result.respawns, t, hash],
      );
    }
    log("INFO", "temps du jour", { day: formatDay(day), ms: result.finishMs, improved });
    const bestMs = improved ? result.finishMs : previous!.ms;
    const bestAt = improved ? t : previous!.submitted_at;
    const medals = medalsFor(circuit.authorMs, day);
    // Lot 41 : le statut du Garage arrive avec la réponse (aucune requête de plus au jeu) ; `nouvelles` = les voitures que cette course débloque
    // (la progression d'avant se déduit de celle d'après, le meilleur temps de ce jour remplacé par l'ancien, ou retiré s'il n'y en avait pas).
    const apres = await resultatsGarage(playerId);
    const avant = improved ? apres.filter((r) => r.day !== day).concat(previous ? [{ day, ms: previous.ms, authorMs: circuit.authorMs }] : []) : apres;
    const pApres = progresGarage(apres);
    const ouvert = await garageOuvert(playerId);
    return {
      accepted: true,
      improved,
      ms: result.finishMs,
      splits: result.splits,
      respawns: result.respawns,
      bestMs,
      rank: await rankOf(day, bestMs, bestAt),
      participants: await participants(day),
      medal: medalFor(result.finishMs, medals) as Medal | null,
      garage: ouvert
        ? { progres: pApres, voitures: toutDebloque(etatGarage(pApres)), nouvelles: [] }
        : { progres: pApres, voitures: etatGarage(pApres), nouvelles: nouvellesVoitures(progresGarage(avant), pApres) },
    };
  }

  // --- Le Garage (lot 41) ---------------------------------------------------------------------------------------------------------------------
  /**
   * Les meilleurs temps du jour de ce joueur (un par jour, **rejoués par le serveur** : la table `results` ; le Salon n'y est pas) et le temps du
   * pilote de chaque jour : **une requête indexée** (`results_by_player`, puis la clé de `circuits`), une ligne lue par jour joué. Les règles :
   * `progresGarage` / `etatGarage` (`packages/sim/src/garage.ts`, la même table que le jeu).
   */
  async function resultatsGarage(id: string): Promise<ResultatDuJour[]> {
    const rows = await db.all<{ day: number; ms: number; author_ms: number | null }>(
      "SELECT r.day AS day, r.ms AS ms, c.author_ms AS author_ms FROM results r LEFT JOIN circuits c ON c.day = r.day WHERE r.player_id = ?",
      [id],
    );
    return rows.map((r) => ({ day: r.day, ms: r.ms, authorMs: r.author_ms }));
  }

  /**
   * **Recette seulement** : un joueur de démonstration (`players.demo = 1`, créé par `recette:seed` — « Démo », `/?demo=joueur` du portail) a
   * toutes les voitures du Garage, pour les voir et les choisir sans les gagner. Jamais ailleurs : l'environnement d'abord (aucune lecture de
   * plus hors de la recette), et un serveur de production ne crée jamais de joueur de démonstration. La progression rendue reste la vraie.
   */
  async function garageOuvert(id: string): Promise<boolean> {
    if (platform.environment !== "recette") return false;
    return (await db.first<{ demo: number }>("SELECT demo FROM players WHERE id = ?", [id]))?.demo === 1;
  }
  const toutDebloque = (voitures: EtatVoiture[]): EtatVoiture[] => voitures.map((v) => ({ ...v, debloquee: true }));

  /**
   * `GET /api/garage` (identifiant **obligatoire** dans l'en-tête `X-Player-Id`) : `{ progres { jours, or, auteur }, voitures [{ id, debloquee,
   * progres { fait, nombre } | null }] }`. Un joueur jamais classé a tout à zéro (la civile seulement) ; code remplacé : 410. Lectures limitées en
   * mémoire, aucune écriture.
   */
  async function garage(req: Request, info: RequestInfo): Promise<{ progres: ProgresGarage; voitures: ReturnType<typeof etatGarage> }> {
    const header = req.headers.get("x-player-id");
    if (header === null) throw new HttpError(400, "invalid_player", "Identifiant de joueur manquant (en-tête X-Player-Id)");
    const id = playerIdOf(header);
    await platform.readHitAddress(info, "gar", GARAGE_READS_PER_CLIENT);
    platform.readHit(await hashKey("garp", id), GARAGE_READS_PER_PLAYER);
    await players.assertActive(id);
    const progres = progresGarage(await resultatsGarage(id));
    const voitures = etatGarage(progres);
    return { progres, voitures: (await garageOuvert(id)) ? toutDebloque(voitures) : voitures };
  }

  /**
   * Le contenu du profil (`GET /api/me`, lot 30) : les temps de DailyTrack de ce joueur, ses médailles, sa meilleure place, sa série, son
   * record du jour avec sa rediffusion. La plateforme a déjà vérifié l'identité (en-tête, débit, code révoqué, joueur connu).
   */
  async function profile(id: string): Promise<Record<string, unknown>> {
    const t = today();
    const rows = await db.all<{ day: number; ms: number; submitted_at: number; track_id: string | null; author_ms: number | null; final_rank: number | null; final_total: number | null }>(
      `SELECT r.day AS day, r.ms AS ms, r.submitted_at AS submitted_at, c.track_id AS track_id, c.author_ms AS author_ms, r.final_rank AS final_rank, r.final_total AS final_total
       FROM results r LEFT JOIN circuits c ON c.day = r.day WHERE r.player_id = ? ORDER BY r.day DESC`,
      [id],
    );
    // Un jour est fermé (sa place ne bougera plus) une fois passée la minute de grâce qui suit minuit : sa place est calculée une fois, puis gardée.
    const closedBefore = sinceMidnight() >= GRACE_MS ? t : t - 1;
    if (rows.some((r) => r.final_rank === null && r.day < closedBefore)) {
      const done = await db.all<{ day: number; final_rank: number; final_total: number }>(
        `UPDATE results SET
           final_rank = (SELECT COUNT(*) FROM results x WHERE x.day = results.day AND (x.ms < results.ms OR (x.ms = results.ms AND x.submitted_at < results.submitted_at))) + 1,
           final_total = (SELECT COUNT(*) FROM results x WHERE x.day = results.day)
         WHERE player_id = ? AND final_rank IS NULL AND day < ? RETURNING day, final_rank, final_total`,
        [id, closedBefore],
      );
      const byDay = new Map(done.map((d) => [d.day, d]));
      for (const r of rows) {
        const d = byDay.get(r.day);
        if (d) {
          r.final_rank = d.final_rank;
          r.final_total = d.final_total;
        }
      }
    }
    const counts: Record<Medal, number> = { author: 0, gold: 0, silver: 0, bronze: 0 };
    let bestRank: { date: string; rank: number; participants: number } | null = null;
    const played = new Set<number>();
    const past: { date: string; trackId: string | null; ms: number; medal: Medal | null }[] = [];
    let todayRow: (typeof rows)[number] | null = null;
    for (const r of rows) {
      played.add(r.day);
      const medal = r.author_ms === null ? null : (medalFor(r.ms, medalsFor(r.author_ms, r.day)) as Medal | null);
      if (medal) counts[medal]++;
      // Jours fermés : place gardée. Aujourd'hui (et hier, pendant la grâce) : place du moment.
      const rank = r.final_rank ?? (await rankOf(r.day, r.ms, r.submitted_at));
      const total = r.final_total ?? (await participants(r.day));
      if (!bestRank || rank < bestRank.rank || (rank === bestRank.rank && total > bestRank.participants)) bestRank = { date: formatDay(r.day), rank, participants: total };
      if (r.day === t) todayRow = r;
      else past.push({ date: formatDay(r.day), trackId: r.track_id, ms: r.ms, medal });
    }
    let streak = 0;
    for (let d = played.has(t) ? t : t - 1; played.has(d); d--) streak++;

    let best: unknown = null;
    if (todayRow) {
      const full = await db.first<{ splits: string; replay: string }>("SELECT splits, replay FROM results WHERE day = ? AND player_id = ?", [t, id]);
      let simVersion: number | null = null;
      try {
        simVersion = full ? decodeReplay(full.replay).simVersion : null;
      } catch {
        /* rediffusion illisible : le temps reste, pas le fantôme */
      }
      best = {
        date: formatDay(t),
        trackId: todayRow.track_id,
        ms: todayRow.ms,
        medal: todayRow.author_ms === null ? null : medalFor(todayRow.ms, medalsFor(todayRow.author_ms, t)),
        splits: full ? (JSON.parse(full.splits) as number[]) : [],
        ...(full && simVersion !== null ? { replay: full.replay, simVersion } : {}),
      };
    }
    return {
      today: formatDay(t),
      simVersion: SIM_VERSION,
      stats: { days: rows.length, medals: counts, bestRank, streak },
      best,
      past,
    };
  }

  async function dayInfo(date: string): Promise<unknown> {
    const day = dayOf(date);
    const c = await getCircuit(day);
    return {
      date: formatDay(day),
      number: circuitNumber(day),
      trackId: c.trackId,
      variant: c.variant,
      theme: c.theme,
      authorMs: c.authorMs,
      attempt: c.attempt,
      palette: c.palette,
      simVersion: SIM_VERSION,
      generatorVersion: GENERATOR_VERSION,
      // Lot R8 : la génération de données (remise à zéro du lancement) : un navigateur qui en garde une plus ancienne efface ses données de jeu.
      generation: await platform.generation(),
    };
  }

  /** Public : les jours (jusqu'à aujourd'hui) dont le circuit n'est pas l'original. Les jours à venir ne sont pas révélés. */
  async function publicPlanning(): Promise<unknown> {
    const rows = await db.all<{ day: number; variant: number; theme: string | null }>("SELECT day, variant, theme FROM planning WHERE day <= ? ORDER BY day", [today()]);
    return { today: formatDay(today()), days: rows.map((r) => ({ date: formatDay(r.day), variant: r.variant, theme: themeByName(r.theme)?.name ?? null })) };
  }

  // --- Admin (jeton) ------------------------------------------------------------------------------------------
  const adminToken = options.adminToken && options.adminToken.length >= ADMIN_TOKEN_MIN ? options.adminToken : null;

  /** Comparaison à temps constant : on compare les empreintes SHA-256 (de longueur fixe), octet par octet sans s'arrêter. */
  async function sameToken(given: string, expected: string): Promise<boolean> {
    const enc = new TextEncoder();
    const [x, y] = await Promise.all([crypto.subtle.digest("SHA-256", enc.encode(given)), crypto.subtle.digest("SHA-256", enc.encode(expected))]);
    const a = new Uint8Array(x);
    const b = new Uint8Array(y);
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
    return diff === 0;
  }

  async function requireAdmin(req: Request, info: RequestInfo): Promise<void> {
    if (!adminToken) throw new HttpError(404, "not_found", "Route inconnue"); // admin désactivé : la route n'existe pas
    // Lot R5 : chaque requête d'admin compte aussi sur l'adresse de connexion (une adresse inventée par un appel direct ne remet pas les
    // échecs à zéro) : au plus ADMIN_MAX_FAILURES × PEER_FACTOR requêtes par fenêtre et par adresse de connexion.
    await platform.peerHit(info, "adm", ADMIN_MAX_FAILURES);
    const key = await hashKey("adm", info.clientKey ?? "inconnu");
    const bucket = Math.floor(now() / limits.windowMs);
    const failures = (await db.first<{ count: number }>("SELECT count FROM rate WHERE key = ? AND bucket = ?", [key, bucket]))?.count ?? 0;
    if (failures >= ADMIN_MAX_FAILURES) {
      const retry = Math.max(1, Math.ceil(((bucket + 1) * limits.windowMs - now()) / 1000));
      throw new HttpError(429, "rate_limited", "Trop d'essais de jeton, réessaie plus tard", { "Retry-After": String(retry) });
    }
    const header = req.headers.get("authorization") ?? "";
    const given = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (!(await sameToken(given, adminToken))) {
      log("WARNING", "admin : jeton refusé"); // lot R7 : jamais le jeton reçu ni l'adresse
      await hit(key, ADMIN_MAX_FAILURES); // compte l'échec (et refuse net au-delà de la limite)
      throw new HttpError(401, "unauthorized", "Jeton d'admin manquant ou incorrect");
    }
  }

  /** Vue d'ensemble pour le panneau : planning, quatorze jours passés (joueurs, meilleur temps) et temps du jour. */
  async function adminOverview(): Promise<unknown> {
    const t = today();
    const first = Math.max(PREMIER_JOUR, t - 14); // aujourd'hui et les quatorze jours passés
    const plan = await db.all<{ day: number; variant: number; theme: string | null; chosen_at: number }>("SELECT day, variant, theme, chosen_at FROM planning ORDER BY day");
    const stats = await db.all<{ day: number; n: number; best: number }>("SELECT day, COUNT(*) AS n, MIN(ms) AS best FROM results WHERE day >= ? AND day <= ? GROUP BY day", [first, t]);
    const known = await db.all<{ day: number; track_id: string; author_ms: number }>("SELECT day, track_id, author_ms FROM circuits WHERE day >= ? AND day <= ?", [first, t]);
    const times = await db.all<{ ms: number }>("SELECT ms FROM results WHERE day = ? ORDER BY ms ASC LIMIT 5000", [t]);
    const planBy = new Map(plan.map((r) => [r.day, r]));
    const days = [];
    for (let day = t; day >= first; day--) {
      const s = stats.find((r) => r.day === day);
      const c = known.find((r) => r.day === day);
      const p = planBy.get(day);
      days.push({
        date: formatDay(day),
        number: circuitNumber(day),
        participants: s?.n ?? 0,
        bestMs: s?.best ?? null,
        authorMs: c?.author_ms ?? null,
        trackId: c?.track_id ?? null,
        variant: p?.variant ?? 0,
        theme: themeByName(p?.theme)?.name ?? null,
      });
    }
    return {
      today: formatDay(t),
      simVersion: SIM_VERSION,
      generatorVersion: GENERATOR_VERSION,
      plan: plan.map((r) => ({ date: formatDay(r.day), variant: r.variant, theme: themeByName(r.theme)?.name ?? null, chosenAt: r.chosen_at })),
      days,
      times: times.map((r) => r.ms),
      /** Lot 32 : usage de l'ancien `?player=` depuis le démarrage de cette instance (anonyme : un compte par route). À zéro, la retouche 32b peut le retirer. */
      legacyPlayerParam: { ...legacyPlayerParam, byRoute: { ...legacyPlayerParam.byRoute } },
    };
  }

  /**
   * Lot 35 — outil de calibrage des médailles, **en lecture seule** (aucune écriture : ni circuit généré et gardé, ni place calculée) : par
   * jour, depuis le premier jour (au plus `MEDAILLES_JOURS`), le temps du pilote (lu dans `circuits`), les seuils en vigueur, les
   * percentiles des meilleurs temps et la part des joueurs ayant chaque médaille ; puis par thème et tous jours réunis (jours fermés
   * seulement : aujourd'hui est encore ouvert). Les pilotes fictifs (`players.demo`) sont exclus sauf `?demo=1` (la recette n'a qu'eux).
   * `ratios` (temps ÷ pilote, triés, sans identité) permet de simuler d'autres facteurs sur les jours passés.
   */
  async function adminMedals(url: URL): Promise<unknown> {
    const t = today();
    const first = Math.max(PREMIER_JOUR, t - MEDAILLES_JOURS + 1);
    const withDemo = url.searchParams.get("demo") === "1";
    const plan = await db.all<{ day: number; variant: number; theme: string | null }>("SELECT day, variant, theme FROM planning WHERE day >= ? AND day <= ?", [first, t]);
    const known = await db.all<{ day: number; track_id: string; author_ms: number }>("SELECT day, track_id, author_ms FROM circuits WHERE day >= ? AND day <= ?", [first, t]);
    const rows = await db.all<{ day: number; ms: number }>(
      `SELECT r.day AS day, r.ms AS ms FROM results r JOIN players p ON p.id = r.player_id WHERE r.day >= ? AND r.day <= ?${withDemo ? "" : " AND p.demo = 0"} ORDER BY r.day, r.ms`,
      [first, t],
    );
    const timesBy = new Map<number, number[]>();
    for (const r of rows) {
      const list = timesBy.get(r.day) ?? [];
      list.push(r.ms);
      timesBy.set(r.day, list);
    }
    const days = [];
    const pools = new Map<string, { ratios: number[]; thresholds: MedalRatios }[]>();
    for (let day = t; day >= first; day--) {
      const p = plan.find((r) => r.day === day);
      const variant = p && isVariant(p.variant) ? p.variant : 0;
      const forced = themeByName(p?.theme)?.name ?? null;
      const theme = forced ?? themeForDay(day).name;
      const c = known.find((r) => r.day === day);
      // Le circuit gardé n'est le bon que s'il porte l'identifiant attendu (même règle que `getCircuit`) ; sinon pas de pilote connu.
      const pilotMs = c && c.track_id === dailyTrackId(day, forced, variant) ? c.author_ms : null;
      const times = timesBy.get(day) ?? [];
      const medals = pilotMs === null ? null : medalsFor(pilotMs, day);
      const stats = medals && pilotMs !== null ? medalDayStats(times, pilotMs, medals) : null;
      const ratios = pilotMs !== null ? ratiosOf(times, pilotMs) : [];
      if (day < t && medals && pilotMs !== null && ratios.length) {
        const thresholds = thresholdsOf(medals, pilotMs);
        for (const key of [theme, "tous"]) pools.set(key, [...(pools.get(key) ?? []), { ratios, thresholds }]);
      }
      days.push({ date: formatDay(day), number: circuitNumber(day), theme, variant, trackId: c?.track_id ?? null, open: day === t, pilotMs, medals, players: times.length, stats, ratios });
    }
    const themes = [...pools.entries()].filter(([k]) => k !== "tous").map(([theme, list]) => ({ theme, ...medalPoolStats(list) }));
    themes.sort((a, b) => a.theme.localeCompare(b.theme));
    return {
      today: formatDay(t),
      simVersion: SIM_VERSION,
      generatorVersion: GENERATOR_VERSION,
      factors: MEDAL_FACTORS,
      /** Lot 35 : les facteurs à partir de la bascule (auteur en multiple du pilote, les autres de l'auteur). */
      factors35: MEDAL_FACTORS_35,
      bascule: formatDay(BASCULE_LOT_35),
      percentiles: MEDAL_PERCENTILES,
      demo: withDemo,
      days,
      themes,
      all: medalPoolStats(pools.get("tous") ?? []),
    };
  }

  /** Le jour doit être strictement dans le futur (date de Paris) : un jour commencé est figé, ses joueurs ont déjà couru dessus. */
  function plannableDay(date: string): number {
    const day = parseDay(date);
    if (day === null) throw new HttpError(400, "invalid_date", "Date attendue au format AAAA-MM-JJ");
    if (day <= today()) throw new HttpError(409, "day_started", "Ce jour a déjà commencé : son circuit est figé");
    if (day > today() + PLANNING_HORIZON) throw new HttpError(400, "too_far", `Pas plus de ${PLANNING_HORIZON} jours à l'avance`);
    return day;
  }

  async function replaceCircuit(req: Request, date: string): Promise<unknown> {
    const day = plannableDay(date);
    const body = await readJson(req);
    if (!isVariant(body.variant)) throw new HttpError(400, "invalid_variant", `Variante attendue : un entier de 0 à ${MAX_VARIANT}`);
    let theme: ThemeName | null = null;
    if (body.theme !== undefined && body.theme !== null) {
      const t = typeof body.theme === "string" ? themeByName(body.theme) : null;
      if (!t) throw new HttpError(400, "invalid_theme", "Thème inconnu");
      theme = t.name;
    }
    if (theme === themeForDay(day).name) theme = null; // le thème de la date n'est pas « imposé »
    if (body.variant === 0 && theme === null) return revertCircuit(date);
    // Le circuit doit exister : le pilote doit le finir dans la fenêtre. Sinon la course du jour n'aurait pas de circuit.
    const circuit = generate(day, body.variant, theme);
    const chosenAt = now();
    await db.run(
      "INSERT INTO planning (day, variant, theme, chosen_at) VALUES (?, ?, ?, ?) ON CONFLICT (day) DO UPDATE SET variant = excluded.variant, theme = excluded.theme, chosen_at = excluded.chosen_at",
      [day, body.variant, theme, chosenAt],
    );
    await storeCircuit(circuit);
    circuits.delete(day);
    log("INFO", "admin : circuit remplacé", { date: formatDay(day), variant: body.variant, theme }); // lot R7 : l'action, jamais le jeton ni l'adresse
    return { date: formatDay(day), variant: body.variant, theme, chosenAt, trackId: circuit.trackId, authorMs: circuit.authorMs };
  }

  async function revertCircuit(date: string): Promise<unknown> {
    const day = plannableDay(date);
    await db.run("DELETE FROM planning WHERE day = ?", [day]);
    await db.run("DELETE FROM circuits WHERE day = ?", [day]); // régénéré à la demande, avec le circuit d'origine
    circuits.delete(day);
    log("INFO", "admin : circuit d'origine rétabli", { date: formatDay(day) });
    return { date: formatDay(day), variant: 0, theme: null, chosenAt: null };
  }

  async function leaderboard(date: string, req: Request, url: URL): Promise<unknown> {
    const day = dayOf(date);
    const limit = Math.min(50, Math.max(1, Math.floor(Number(url.searchParams.get("limit") ?? 10)) || 10));
    const me = playerOf(req, url, "leaderboard");
    const count = await participants(day);
    if (count === 0) return { date: formatDay(day), participants: 0, top: [], me: null };

    const medals = medalsFor((await getCircuit(day)).authorMs, day);
    const rows = await db.all<{ ms: number; name: string }>(
      "SELECT r.ms AS ms, p.name AS name FROM results r JOIN players p ON p.id = r.player_id WHERE r.day = ? ORDER BY r.ms ASC, r.submitted_at ASC LIMIT ?",
      [day, limit],
    );
    const top = rows.map((r, i) => ({ rank: i + 1, name: r.name, ms: r.ms, medal: medalFor(r.ms, medals) }));
    let mine: { rank: number; name: string; ms: number; medal: Medal | null } | null = null;
    if (me) {
      const own = await db.first<{ ms: number; submitted_at: number }>("SELECT ms, submitted_at FROM results WHERE day = ? AND player_id = ?", [day, me]);
      if (own) mine = { rank: await rankOf(day, own.ms, own.submitted_at), name: (await playerName(me)) ?? "", ms: own.ms, medal: medalFor(own.ms, medals) };
    }
    return { date: formatDay(day), participants: count, top, me: mine };
  }

  async function ghost(date: string, req: Request, url: URL): Promise<unknown> {
    const day = dayOf(date);
    const kind = url.searchParams.get("kind");
    if (kind !== "first" && kind !== "ahead") throw new HttpError(400, "invalid_kind", "kind doit valoir first ou ahead");
    let offset = 0;
    if (kind === "ahead") {
      const me = playerOf(req, url, "ghost");
      if (me === null) throw new HttpError(400, "invalid_player", "Identifiant de joueur manquant (en-tête X-Player-Id)"); // « ahead » : le joueur est obligatoire
      const own = await db.first<{ ms: number; submitted_at: number }>("SELECT ms, submitted_at FROM results WHERE day = ? AND player_id = ?", [day, me]);
      if (!own) throw new HttpError(404, "no_ghost", "Pas encore de temps pour ce joueur");
      const rank = await rankOf(day, own.ms, own.submitted_at);
      if (rank <= 1) throw new HttpError(404, "no_ghost", "Personne devant toi : tu es premier");
      offset = rank - 2;
    }
    const row = await db.first<{ ms: number; splits: string; replay: string; name: string }>(
      "SELECT r.ms AS ms, r.splits AS splits, r.replay AS replay, p.name AS name FROM results r JOIN players p ON p.id = r.player_id WHERE r.day = ? ORDER BY r.ms ASC, r.submitted_at ASC LIMIT 1 OFFSET ?",
      [day, offset],
    );
    if (!row) throw new HttpError(404, "no_ghost", "Aucun temps enregistré pour ce jour");
    return { name: row.name, rank: offset + 1, ms: row.ms, splits: JSON.parse(row.splits) as number[], replay: row.replay, simVersion: SIM_VERSION };
  }

  /**
   * Lot I2 : la date d'une adresse (`/api/day/<date>`, `/api/admin/planning/<date>`). Un encodage illisible (`%E0`) est une date invalide
   * (400 `invalid_date`, comme le Salon et DailyJump), jamais une erreur interne.
   */
  function decodeDate(raw: string): string {
    try {
      return decodeURIComponent(raw);
    } catch {
      throw new HttpError(400, "invalid_date", "Date attendue au format AAAA-MM-JJ");
    }
  }

  /** Les routes de DailyTrack (chemins historiques, sous `/api`) ; `undefined` : ce chemin n'est pas à DailyTrack. */
  async function route(path: string, req: Request, url: URL, info: RequestInfo): Promise<unknown> {
    if (path === "/api/submit") {
      if (req.method !== "POST") throw new HttpError(405, "method_not_allowed", "POST attendu");
      return await submit(req, info);
    }
    if (path === "/api/planning") {
      if (req.method !== "GET") throw new HttpError(405, "method_not_allowed", "GET attendu");
      return await publicPlanning();
    }
    if (path === "/api/garage") {
      if (req.method !== "GET") throw new HttpError(405, "method_not_allowed", "GET attendu");
      return await garage(req, info);
    }
    if (path.startsWith("/api/admin/")) {
      await requireAdmin(req, info);
      if (path === "/api/admin/overview") {
        if (req.method !== "GET") throw new HttpError(405, "method_not_allowed", "GET attendu");
        return await adminOverview();
      }
      if (path === "/api/admin/medailles") {
        if (req.method !== "GET") throw new HttpError(405, "method_not_allowed", "GET attendu");
        return await adminMedals(url);
      }
      const pm = /^\/api\/admin\/planning\/([^/]+)$/.exec(path);
      if (pm) {
        const date = decodeDate(pm[1]!);
        if (req.method === "PUT") return await replaceCircuit(req, date);
        if (req.method === "DELETE") return await revertCircuit(date);
        throw new HttpError(405, "method_not_allowed", "PUT ou DELETE attendu");
      }
      throw new HttpError(404, "not_found", "Route inconnue");
    }
    const sm = /^\/api\/salon\/([^/]+)(?:\/(board|ghosts|submit))?$/.exec(path);
    if (sm) {
      const what = sm[2];
      let key: string;
      try {
        key = decodeURIComponent(sm[1]!);
      } catch {
        throw new HttpError(400, "invalid_session", "Adresse invalide");
      }
      if (!what && key === "now") {
        if (req.method !== "GET") throw new HttpError(405, "method_not_allowed", "GET attendu");
        return await salon.nowRoute(req, url, info);
      }
      if (what === "submit") {
        if (req.method !== "POST") throw new HttpError(405, "method_not_allowed", "POST attendu");
        return await salon.submitRoute(key, req, info);
      }
      if (what === "board" || what === "ghosts") {
        if (req.method !== "GET") throw new HttpError(405, "method_not_allowed", "GET attendu");
        return what === "board" ? await salon.boardRoute(key, req, url, info) : await salon.ghostsRoute(key, url, info);
      }
      throw new HttpError(404, "not_found", "Route inconnue");
    }
    const m = /^\/api\/day\/([^/]+)(?:\/(leaderboard|ghost))?$/.exec(path);
    if (m) {
      if (req.method !== "GET") throw new HttpError(405, "method_not_allowed", "GET attendu");
      const date = decodeDate(m[1]!);
      if (m[2] === "leaderboard" || m[2] === "ghost") {
        // Lot R7 : ces deux lectures coûtent un parcours des temps du jour ; sans limite, un appel en boucle épuisait la base (réponses `no-store`).
        await platform.readHitAddress(info, "lb", BOARD_READS_PER_CLIENT);
        return m[2] === "leaderboard" ? await leaderboard(date, req, url) : await ghost(date, req, url);
      }
      return await dayInfo(date);
    }
    return undefined;
  }

  // --- Lot I2 : ce que le portail montre de DailyTrack (`portail.ts`) --------------------------------------------------------
  // Le circuit en vigueur (planning compris) donne le thème et les seuils ; l'état du joueur vient de `results` (le classement prouvé :
  // temps rejoué par le serveur). DailyTrack ne sait pas qu'un joueur a commencé sans finir : il ne déclare jamais `en_cours`.
  /** Classés du jour en cours, gardés `CLASSES_MEMO_MS` par instance : le portail se lit souvent, et compter les classés lit une ligne par classé. */
  const classesMemo = new Map<number, { at: number; n: number }>();
  async function classesDuJour(day: number): Promise<number> {
    const kept = classesMemo.get(day);
    if (kept && now() - kept.at < CLASSES_MEMO_MS) return kept.n;
    const n = await participants(day);
    if (classesMemo.size > 8) classesMemo.clear();
    classesMemo.set(day, { at: now(), n });
    return n;
  }

  const portail: PortailDuJeu = {
    site: "track",
    nom: "Track",
    premierJour: PREMIER_JOUR,
    async jour(day) {
      const c = await getCircuit(day);
      const m = medalsFor(c.authorMs, day);
      return { numero: circuitNumber(day), theme: c.theme ?? themeForDay(day).name, seuils: { author: m.author, gold: m.gold, silver: m.silver, bronze: m.bronze } };
    },
    async etat(id, day, connu) {
      const own = await db.first<{ ms: number; submitted_at: number }>("SELECT ms, submitted_at FROM results WHERE day = ? AND player_id = ?", [day, id]);
      if (!own) return { statut: "pas_joue" };
      // Lot I3 : la place et les classés du classement du jour gardé par le portail, quand il les a ; sinon on les compte (une ligne lue par classé).
      const [rang, classes, circuit] = await Promise.all([connu ? connu.rang : rankOf(day, own.ms, own.submitted_at), connu ? connu.classes : classesDuJour(day), getCircuit(day)]);
      // Les classés gardés en mémoire peuvent dater de quelques secondes : jamais moins que le rang.
      return { statut: "fini", tempsMs: own.ms, medaille: medalFor(own.ms, medalsFor(circuit.authorMs, day)) as Medal | null, rang, classes: Math.max(classes, rang) };
    },
    joursFinis: async (id) => (await db.all<{ day: number }>("SELECT day FROM results WHERE player_id = ?", [id])).map((r) => r.day),
    // Lot I3 : tous les classés du jour, dans l'ordre du classement (même tri que `rankOf` : temps, puis premier envoyé), médaille lue sur les
    // seuils du circuit en vigueur (comme `etat`). Une ligne par classé ; aucun calcul de circuit pour un jour sans classé.
    async classes(day) {
      const rows = await db.all<{ player_id: string; ms: number; submitted_at: number }>("SELECT player_id, ms, submitted_at FROM results WHERE day = ? ORDER BY ms ASC, submitted_at ASC", [day]);
      if (rows.length === 0) return [];
      const m = medalsFor((await getCircuit(day)).authorMs, day);
      return rows.map((r) => ({ playerId: r.player_id, medaille: medalFor(r.ms, m) as Medal | null, at: r.submitted_at }));
    },
    // Le même calcul que `GET /api/me` (places des jours fermés gardées une fois calculées) : le profil commun dit la même chose que le jeu.
    async profil(id) {
      const stats = (await profile(id)).stats as { days: number; medals: Record<Medal, number>; bestRank: { date: string; rank: number; participants: number } | null };
      return {
        joursFinis: stats.days,
        medailles: stats.medals,
        meilleurRang: stats.bestRank ? { date: stats.bestRank.date, rang: stats.bestRank.rank, classes: stats.bestRank.participants } : null,
      };
    },
  };

  return {
    route,
    salon,
    portail,
    dailyLevel: (day) => getCircuit(day),
    validate: async (day, code) => ({ ms: (await validateRun(day, code)).result.finishMs }),
    profile,
    // Pseudo changé : le Salon en cours montre le même pseudo.
    onRename: async (playerId, name) => {
      await db.run("UPDATE salon_runs SET name = ? WHERE player_id = ? AND name <> ?", [name, playerId, name]);
    },
    // « Changer mon code » : les temps suivent le joueur ; ses courses du Salon en cours sont oubliées (une session dure dix minutes).
    rotateStatements: (oldId, newId): Statement[] => [
      { sql: "UPDATE results SET player_id = ? WHERE player_id = ?", params: [newId, oldId] },
      { sql: "DELETE FROM salon_runs WHERE player_id = ?", params: [oldId] },
    ],
    // Lot R5 — effacement d'un joueur : ses temps (le classement d'un jour passé est recalculé sans lui : places finales oubliées, recalculées à
    // la prochaine lecture du profil des autres), ses courses du Salon (version de la session avancée : le classement se recharge), sa présence
    // et son délai d'envoi du Salon (des empreintes). Le fantôme du premier est relu en base : un premier effacé n'est plus servi.
    erase: async (playerId) => {
      const [results, salonRuns] = await Promise.all([
        db.first<{ n: number }>("SELECT COUNT(*) AS n FROM results WHERE player_id = ?", [playerId]),
        db.first<{ n: number }>("SELECT COUNT(*) AS n FROM salon_runs WHERE player_id = ?", [playerId]),
      ]);
      const [presence, throttle] = await Promise.all([hashKey("pr", playerId), hashKey("sgp", playerId)]);
      return {
        counts: { tempsDailyTrack: results?.n ?? 0, coursesSalon: salonRuns?.n ?? 0 },
        statements: [
          { sql: "UPDATE results SET final_rank = NULL, final_total = NULL WHERE day IN (SELECT day FROM results WHERE player_id = ?)", params: [playerId] },
          { sql: "DELETE FROM results WHERE player_id = ?", params: [playerId] },
          { sql: "UPDATE salon_sessions SET version = version + 1 WHERE session IN (SELECT session FROM salon_runs WHERE player_id = ?)", params: [playerId] },
          { sql: "DELETE FROM salon_runs WHERE player_id = ?", params: [playerId] },
          { sql: "DELETE FROM salon_presence WHERE key = ?", params: [presence] },
          { sql: "DELETE FROM salon_throttle WHERE key = ?", params: [throttle] },
        ],
      };
    },
    requireAdmin,
    tick: () => salon.tick(),
  };
}

/** DailyTrack au registre : routes historiques sous `/api` (jamais déplacées sous `/api/cdj`). */
export const CDJ_GAME: GameDefinition<CdjOptions> = {
  code: "cdj",
  name: "DailyTrack",
  prefix: "/api",
  tables: ["circuits", "planning", "results", "salon_runs", "salon_sessions", "salon_circuits", "salon_presence", "salon_throttle"],
  schema: CDJ_SCHEMA,
  versions: () => ({ simVersion: SIM_VERSION, generatorVersion: GENERATOR_VERSION }),
  create: createCdj,
};
