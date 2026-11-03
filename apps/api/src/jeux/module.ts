import { formatDay, parseDay } from "@cdj/core";
import { WithHeaders, cacheHeaders } from "../cache";
import { inputsHash } from "../copies";
import { CODES_ERREUR, type CodeErreur } from "../codesErreur";
import type { SqlValue } from "../db";
import { HttpError } from "../errors";
import type { FICHES_SERVEUR } from "../fiches.generated";
import type { AdminDuJeu, GameInstance, MedaillePortail, Platform, PortailDuJeu, RequestInfo, Statement } from "../games";
import { type AdaptateurTable, sqlDe, verifierAdaptateur, versFiche, versTable } from "./adaptateur";
import { type ContratJeu, type LigneBrute, RefusJeu } from "./contrat";

// Lot K2 — **le module des jeux** : tout ce que le serveur d'un jeu qui se classe fait à l'identique (routes `info`, `day`, `submit`, `board`, fantôme, `me` ; ordre de validation d'un envoi ; classement par colonnes
// avec rang par l'index ; copies ; aperçu ; effacement ; crochets du portail et de l'administration), écrit **une fois**. Un jeu fournit son **contrat** (`contrat.ts`), son **adaptateur de table**
// (`adaptateur.ts`) et la fiche (`config/jeux/<id>.json`, lue par `apps/api/src/fiches.generated.ts`) ; il garde ses routes propres (`routesPropres`) : le Salon, le Garage, les vies, les paliers… ne migrent jamais.
// Tower est le premier jeu sur le module (`tower.ts`) ; Jump (K2b) et Track (K2c) suivent, chacun avec le banc de réponses (`scripts/banc.ts`).
//
// **Un envoi est validé dans cet ordre, du moins cher au plus cher** : (1) débit compté en base (adresse, puis joueur) avant tout ; (2) taille du corps ; (3) le texte de la rediffusion (décodage, versions, réglages)
// par le contrat ; (4) le jour : celui de Paris, ou celui d'hier pendant la grâce ; (5) le contenu qu'elle nomme est celui du serveur ; (6) joueur actif et pseudo ; (7) copies (`409 replay_copy` : les entrées de
// l'auteur, d'un autre joueur classé ce jour-là ou d'un résultat retiré par l'administration) ; (8) plafond de rejeux (`spendReplays`) puis le rejeu. Le serveur garde **son** résultat, jamais un résultat annoncé.

/** La fiche d'un jeu telle que le serveur la lit (projection `serveur`, `npm run fiches`). */
export type FicheServeur = (typeof FICHES_SERVEUR)[number];

/** Une route que seul ce jeu a (Salon, Garage, vies, carnage, paliers…) : essayée après celles du module ; `undefined` : ce chemin n'est pas à elle. */
export type RoutePropre = (path: string, req: Request, url: URL, info: RequestInfo) => Promise<unknown>;

/** Les compteurs de débit du jeu (préfixes de la table `rate` : propres à chaque jeu, ceux des autres ne bougent pas). */
export interface DebitDuJeu {
  adresse: string;
  joueur: string;
  lectures: string;
  profilAdresse: string;
  profilJoueur: string;
}

export interface ConfigJeu<Niveau, Rejeu, Mesure> {
  fiche: FicheServeur;
  contrat: ContratJeu<Niveau, Rejeu, Mesure>;
  adaptateur: AdaptateurTable;
  /** Le nom du jeu tel que le portail l'écrit (« Tower »). */
  nom: string;
  /** Les routes du jeu : `/api/<code>` pour un jeu nouveau ; Track garde `/api` (K2c). */
  prefixe: string;
  /** La grâce après minuit de Paris (ms) pendant laquelle le jour d'hier accepte encore des envois. */
  graceMs: number;
  /** Combien de lignes le classement rend. */
  top: number;
  lecturesParAdresse: number;
  lecturesProfilParJoueur: number;
  debit: DebitDuJeu;
  /** Les écritures de plus permises pendant l'aperçu (chacune range ses résultats à part). */
  ecrituresApercuPropres?: readonly string[];
  routesPropres?: readonly RoutePropre[];
  /** Le lecteur d'une rediffusion pour l'administration (`AdminDuJeu.lienRediffusion`) ; défaut : aucun. */
  lienRediffusion?: (date: string, rang: number) => string | null;
}

const medaillePortail = (m: unknown): MedaillePortail | null => (m === "author" || m === "gold" || m === "silver" || m === "bronze" ? m : null);

/** Un refus du contrat en erreur de l'API : le statut est celui de la liste unique des codes. */
function versHttp(e: RefusJeu): HttpError {
  const code: CodeErreur = e.code;
  return new HttpError<CodeErreur>(CODES_ERREUR[code].status as never, code, e.message, {}, e.details);
}

export function creerJeu<Niveau, Rejeu, Mesure>(platform: Platform, config: ConfigJeu<Niveau, Rejeu, Mesure>): GameInstance {
  const { fiche, contrat, adaptateur, prefixe, debit } = config;
  const { db, now, log, today, sinceMidnight, hashKey, hit, readHit, readJson, playerIdOf, players, limits } = platform;
  verifierAdaptateur(fiche.classement.colonnes, adaptateur);
  const sql = sqlDe(adaptateur);
  const colonnes = adaptateur.colonnes;
  const tableNiveaux = adaptateur.niveaux.table;
  const colonnesNiveau = adaptateur.niveaux.colonnes;
  const premierJour = parseDay(fiche.premierJour)!;
  const unites = fiche.rejeu.unitesServeur;
  /** Le sens du classement de la fiche : `desc` = la plus grande valeur d'abord. */
  const effectif = colonnes.map((c) => (c.signe === -1 ? (c.sens === "asc" ? "desc" : "asc") : c.sens));

  // --- Le niveau du jour : lu en base si la règle est la même, sinon calculé une seule fois (même si deux requêtes arrivent ensemble) -------------------------
  const niveaux = new Map<number, { rule: string; niveau: Niveau }>();
  const enCalcul = new Map<number, Promise<Niveau>>();

  async function chargerNiveau(day: number, rule: string): Promise<Niveau> {
    const row = await db.first<Record<string, SqlValue>>(`SELECT rule, ${colonnesNiveau.join(", ")} FROM ${tableNiveaux} WHERE day = ?`, [day]);
    let niveau: Niveau | null = null;
    if (row && row.rule === rule) {
      try {
        niveau = contrat.restaurer(day, row);
      } catch {
        niveau = null; // une ligne abîmée est recalculée, jamais crue
      }
    }
    if (!niveau) {
      const debutCalcul = performance.now();
      const c = await contrat.calculer(day);
      niveau = c.niveau;
      await db.run(`INSERT OR REPLACE INTO ${tableNiveaux} (day, rule, ${colonnesNiveau.join(", ")}, created_at) VALUES (?, ?, ${colonnesNiveau.map(() => "?").join(", ")}, ?)`, [
        day,
        rule,
        ...colonnesNiveau.map((k) => c.ligne[k] ?? null),
        now(),
      ]);
      log("INFO", `${contrat.nomJournal} : jour calculé`, { day: formatDay(day), ...contrat.champsJournalJour(niveau), ms: Math.round(performance.now() - debutCalcul) });
    }
    niveaux.set(day, { rule, niveau });
    return niveau;
  }

  async function getNiveau(day: number): Promise<Niveau> {
    const rule = await contrat.regle(day);
    const memo = niveaux.get(day);
    if (memo && memo.rule === rule) return memo.niveau;
    let attente = enCalcul.get(day);
    if (!attente) {
      attente = chargerNiveau(day, rule).finally(() => enCalcul.delete(day));
      enCalcul.set(day, attente);
    }
    return attente;
  }

  const getInfo = async (day: number): Promise<unknown> => contrat.infoJour(await getNiveau(day));

  function dayOf(date: string): number {
    const day = parseDay(date);
    if (day === null) throw new HttpError(400, "invalid_date", "Date attendue au format AAAA-MM-JJ");
    if (day > today()) throw new HttpError(404, "unknown_day", "Ce jour n'est pas encore sorti");
    return day;
  }

  /** Le jour accepte-t-il encore des envois ? Aujourd'hui (Paris), et hier pendant la grâce qui suit minuit. Sinon il est figé. */
  const isOpen = (day: number): boolean => day === today() || (day === today() - 1 && sinceMidnight() < config.graceMs);

  const limitReads = (info: RequestInfo) => platform.readHitAddress(info, debit.lectures, config.lecturesParAdresse);

  function headerPlayer(req: Request, required: boolean): string | null {
    const raw = req.headers.get("x-player-id");
    if (raw === null || raw === "") {
      if (required) throw new HttpError(400, "invalid_player", "Identifiant de joueur manquant (en-tête X-Player-Id)");
      return null;
    }
    return playerIdOf(raw);
  }

  // --- Le classement ----------------------------------------------------------------------------------------------------------------------
  /** Le score d'une ligne lue (les colonnes de classement, sous leur nom de fiche). */
  const scoreDe = (fiche: LigneBrute): Record<string, number> => Object.fromEntries(colonnes.map((c) => [c.nom, Number(fiche[c.nom])]));

  async function rankOf(day: number, score: Record<string, number>, at: number, id: string): Promise<number> {
    const row = await db.first<{ n: number }>(sql.rang, sql.parametresRang(day, score, at, id));
    return (row?.n ?? 0) + 1;
  }

  async function participants(day: number): Promise<number> {
    return (await db.first<{ n: number }>(sql.participants, [day]))?.n ?? 0;
  }

  const ligne = (rank: number, brute: LigneBrute): unknown => contrat.ligneClassement(rank, versFiche(adaptateur, brute));

  async function board(day: number, me: string | null): Promise<unknown> {
    const [count, rows, own, generation] = await Promise.all([
      participants(day),
      db.all<LigneBrute>(sql.top, [day, config.top]),
      me ? db.first<LigneBrute>(sql.moi, [day, me]) : Promise.resolve(null),
      platform.generation(),
    ]);
    const mine = own && me ? ligne(await rankOf(day, scoreDe(versFiche(adaptateur, own)), Number(own.submitted_at), me), own) : null;
    return { date: formatDay(day), open: isOpen(day), participants: count, top: rows.map((r, i) => ligne(i + 1, r)), me: mine, generation };
  }

  /** Vrai si le score `a` passe strictement devant le score gardé `b` : la première colonne qui diffère décide (dans le sens de la fiche). */
  function meilleur(a: Record<string, number>, b: Record<string, number>): boolean {
    for (const [i, c] of colonnes.entries()) {
      const x = a[c.nom]!;
      const y = b[c.nom]!;
      if (x === y) continue;
      return effectif[i] === "desc" ? x > y : x < y;
    }
    return false;
  }

  // --- La validation et l'envoi -----------------------------------------------------------------------------------------------------------
  async function rejouer(niveau: Niveau, texte: string): Promise<Mesure> {
    platform.spendReplays(unites); // lots R5 et R7 : le plafond global de rejeux de l'instance (503 au-delà) ; le jeu pèse `rejeu.unitesServeur` de sa fiche
    return contrat.rejouer(niveau, texte);
  }

  async function submit(req: Request, info: RequestInfo): Promise<unknown> {
    // 1. Débit, compté en base (exact quelle que soit l'instance), avant de lire le corps et avant tout rejeu. Compteurs propres au jeu.
    await platform.hitAddress(info, debit.adresse, limits.perClient);
    const playerId = headerPlayer(req, true)!;
    await hit(await hashKey(debit.joueur, playerId), limits.perPlayer);
    // 2. Taille du corps (413 au-delà de `MAX_BODY_BYTES`, lu sans tout charger).
    const body = await readJson(req);
    // 3 à 5. Le texte, le jour, le contenu.
    const r = contrat.decoder(body.replay);
    const jour = contrat.jourDe(r);
    if (jour === null) throw new HttpError(409, "not_daily", "Un scénario d'essai n'est jamais classé");
    if (jour > today()) throw new HttpError(409, "not_daily", "Ce jour n'est pas encore sorti");
    if (!isOpen(jour)) throw new HttpError(409, "day_closed", "Le classement de ce jour est figé : seul le jour en cours se classe");
    const niveau = await getNiveau(jour);
    contrat.memeContenu(r, niveau);
    // 6. Joueur actif et pseudo (réservé à son premier propriétaire, vérifié avant le rejeu).
    await players.assertActive(playerId);
    const known = await players.find(playerId);
    const name = await players.resolveName(playerId, body.name, known);
    // 7. Copies (lot R9) : refusées avant d'écrire quoi que ce soit, pas même le joueur ; le même joueur qui renvoie sa propre partie n'est pas concerné.
    const hash = await inputsHash(contrat.entrees(r));
    if (!platform.allowCopies) {
      if (hash === contrat.empreinteAuteur(niveau)) throw new HttpError(409, "replay_copy", "Cette partie est la copie de la preuve de l'auteur");
      if (await db.first(sql.copie, [jour, hash, playerId])) throw new HttpError(409, "replay_copy", "Cette partie est la copie d'une autre");
      if (await db.first(`SELECT 1 AS n FROM resultats_retires WHERE game = '${fiche.code}' AND day = ? AND inputs_hash = ? LIMIT 1`, [jour, hash])) throw new HttpError(409, "replay_copy", "Cette partie a été retirée par l'administration");
    }
    // 8. Le plafond de rejeux, puis le rejeu : la seule source du résultat.
    const mesure = await rejouer(niveau, body.replay as string);

    const t = now();
    // Le joueur n'existe qu'après une partie valide (table `players` de la plateforme).
    await players.save(playerId, name, known);
    // Lot P : pendant l'aperçu du jeu (`info.apercu`) la partie est rangée à part (`apercu = 1`, `hidden = 1`) ; elle ne remplace jamais une partie publique.
    const apercu = info.apercu === true ? 1 : 0;
    const rejouee = contrat.rejouee(niveau, r, mesure);
    const precedent = await db.first<LigneBrute>(sql.precedent, [jour, playerId, apercu]);
    const prev = precedent ? versFiche(adaptateur, precedent) : null;
    const improved = !prev || meilleur(rejouee.score, scoreDe(prev));
    const medalNew = contrat.medaille(niveau, rejouee.score);
    if (improved) {
      const valeurs: Record<string, SqlValue> = {
        ...versTable(adaptateur, rejouee.score, rejouee.autres),
        medal: medalNew,
        replay: body.replay as string,
        first_at: t,
        submitted_at: t,
        inputs_hash: hash,
        hidden: known?.hidden === 1 || apercu === 1 ? 1 : 0, // lot N1 : un joueur masqué reste masqué ; lot P : l'aperçu est masqué aussi
        apercu,
      };
      await db.run(sql.insertion, [jour, playerId, ...sql.colonnesInsert.map((c) => valeurs[c] ?? null)]);
    }
    log("INFO", `${contrat.nomJournal} : partie du jour`, { day: formatDay(jour), ...contrat.champsJournalPartie(mesure, improved) });
    const best: LigneBrute & { submitted_at: number } = improved
      ? { ...rejouee.score, medal: medalNew, submitted_at: t }
      : { ...scoreDe(prev!), medal: (prev!.medal as string | null) ?? null, submitted_at: Number(prev!.submitted_at) };
    const [rank, b] = await Promise.all([rankOf(jour, scoreDe(best), best.submitted_at, playerId), board(jour, playerId)]);
    return contrat.reponseEnvoi({ date: formatDay(jour), mesure, medaille: medalNew, improved, meilleur: best, rang: rank, participants: (b as { participants: number }).participants, board: b });
  }

  // --- Le fantôme (réservé aux classés) ---------------------------------------------------------------------------------------------------
  /** 403 `not_ranked` pour qui n'est pas classé ce jour-là (règle G1 : on le débloque en finissant) ; le contrat dit le reste (404 `no_ghost` sans preuve). */
  async function fantome(day: number, id: string): Promise<unknown> {
    await players.assertActive(id);
    if (!(await db.first(sql.classe, [day, id]))) throw new HttpError(403, "not_ranked", "Le fantôme se débloque quand tu es classé ce jour-là");
    return contrat.fantome!.lire(await getNiveau(day), day);
  }

  // --- Le profil --------------------------------------------------------------------------------------------------------------------------
  async function myProfile(id: string, info: RequestInfo): Promise<unknown> {
    await platform.readHitAddress(info, debit.profilAdresse, config.lecturesParAdresse);
    readHit(await hashKey(debit.profilJoueur, id), config.lecturesProfilParJoueur);
    await players.assertActive(id);
    const [player, rows, generation] = await Promise.all([players.find(id), db.all<LigneBrute>(sql.moiProfil, [id]), platform.generation()]);
    if (!player) throw new HttpError(404, "unknown_player", "Ce profil n'existe pas sur le serveur : joue une partie pour l'ouvrir");
    const medals: Record<MedaillePortail, number> = { author: 0, gold: 0, silver: 0, bronze: 0 };
    const days = rows.map((r) => {
      const m = medaillePortail(r.medal);
      if (m) medals[m]++;
      return contrat.jourProfil(versFiche(adaptateur, r), formatDay(Number(r.day)));
    });
    const joues = new Set(rows.map((r) => Number(r.day)));
    const t = today();
    let streak = 0;
    for (let d = joues.has(t) ? t : t - 1; joues.has(d); d--) streak++;
    return { name: player.name, renameRequired: player.rename_required === 1, today: formatDay(t), ...contrat.versions(), days, stats: { days: days.length, medals, streak }, generation };
  }

  // --- Les routes -----------------------------------------------------------------------------------------------------------------------
  const echapper = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  const cheminJour = new RegExp(`^${echapper(prefixe)}/day/([^/]+)(/board${contrat.fantome ? `|/${echapper(contrat.fantome.route)}` : ""})?$`);

  async function route(path: string, req: Request, _url: URL, info: RequestInfo): Promise<unknown> {
    try {
      if (path === `${prefixe}/info`) {
        if (req.method !== "GET") throw new HttpError(405, "method_not_allowed", "GET attendu");
        await limitReads(info);
        return { game: fiche.code, ...contrat.versions(), today: formatDay(today()), frozenDays: contrat.joursFiges, environment: platform.environment };
      }
      if (path === `${prefixe}/submit`) {
        if (req.method !== "POST") throw new HttpError(405, "method_not_allowed", "POST attendu");
        return await submit(req, info);
      }
      if (path === `${prefixe}/me`) {
        if (req.method !== "GET") throw new HttpError(405, "method_not_allowed", "GET attendu");
        return await myProfile(headerPlayer(req, true)!, info);
      }
      const m = cheminJour.exec(path);
      if (m) {
        if (req.method !== "GET") throw new HttpError(405, "method_not_allowed", "GET attendu");
        await limitReads(info);
        let date: string;
        try {
          date = decodeURIComponent(m[1]!);
        } catch {
          throw new HttpError(400, "invalid_date", "Date attendue au format AAAA-MM-JJ");
        }
        const day = dayOf(date);
        const open = isOpen(day);
        if (m[2] === "/board") return new WithHeaders(await board(day, headerPlayer(req, false)), cacheHeaders({ open, perPlayer: true }));
        if (m[2] !== undefined) return new WithHeaders(await fantome(day, headerPlayer(req, true)!), cacheHeaders({ open, perPlayer: true }));
        return new WithHeaders(await getInfo(day), cacheHeaders({ open, perPlayer: false }));
      }
      for (const propre of config.routesPropres ?? []) {
        const r = await propre(path, req, _url, info);
        if (r !== undefined) return r;
      }
      if (path === prefixe || path.startsWith(`${prefixe}/`)) throw new HttpError(404, "not_found", "Route inconnue");
      return undefined;
    } catch (e) {
      throw e instanceof RefusJeu ? versHttp(e) : e;
    }
  }

  // --- Les crochets du portail et de l'administration ----------------------------------------------------------------------------------------
  // Un jeu classé à la **hauteur** (fiche : `classement.format`) compte dans la journée mais jamais dans le cumul au temps ; son score est celui que `versPortail` du contrat rend.
  const portail: PortailDuJeu = {
    site: fiche.id,
    nom: config.nom,
    premierJour,
    classement: fiche.classement.format === "hauteur" ? "hauteur" : "temps",
    async jour(day) {
      return contrat.portailJour(await getNiveau(day), day);
    },
    async etat(id, day, connu) {
      const own = await db.first<LigneBrute>(sql.etat, [day, id]);
      if (!own) return { statut: "pas_joue" };
      const f = versFiche(adaptateur, own);
      const v = contrat.versPortail(f);
      const [rang, classes] = await Promise.all([connu ? connu.rang : rankOf(day, scoreDe(f), Number(own.submitted_at), id), connu ? connu.classes : participants(day)]);
      return { statut: "fini", tempsMs: v.tempsMs, medaille: medaillePortail(own.medal), rang, classes: Math.max(classes, rang), ...(v.score ? { score: v.score } : {}) };
    },
    joursFinis: async (id) => (await db.all<{ day: number }>(sql.joursFinis, [id])).map((r) => r.day),
    async profil(id) {
      const rows = await db.all<LigneBrute>(sql.profil, [id]);
      const medailles: Record<MedaillePortail, number> = { author: 0, gold: 0, silver: 0, bronze: 0 };
      let meilleurRang: { date: string; rang: number; classes: number } | null = null;
      for (const r of rows) {
        const m = medaillePortail(r.medal);
        if (m) medailles[m]++;
        const [rang, classes] = await Promise.all([rankOf(Number(r.day), scoreDe(versFiche(adaptateur, r)), Number(r.submitted_at), id), participants(Number(r.day))]);
        if (!meilleurRang || rang < meilleurRang.rang || (rang === meilleurRang.rang && classes > meilleurRang.classes)) meilleurRang = { date: formatDay(Number(r.day)), rang, classes: Math.max(classes, rang) };
      }
      return { joursFinis: rows.length, medailles, meilleurRang };
    },
    // Tous les classés du jour dans l'ordre du classement du jeu (un jour sans classé ne calcule rien : le niveau du jour n'est pas lu).
    async classes(day) {
      const rows = await db.all<LigneBrute & { player_id: string }>(sql.classes, [day]);
      return rows.map((r) => {
        const v = contrat.versPortail(versFiche(adaptateur, r));
        return { playerId: r.player_id, tempsMs: v.tempsMs, medaille: medaillePortail(r.medal), at: Number(r.submitted_at), ...(v.score ? { score: v.score } : {}), ...(v.ticks !== undefined ? { ticks: v.ticks } : {}) }; // lot F2 : `ticks` exacts pour le classement filtré « Amis »
      });
    },
  };

  const admin: AdminDuJeu = {
    activite: [{ table: adaptateur.table, jour: "day", joueur: "player_id" }],
    compteurs: async (day) => ({ finis: (await db.first<{ n: number }>(sql.compteJour, [day]))?.n ?? 0 }),
    joursPrets: async () => ({ figes: contrat.joursFiges.length }),
    resultats: async (id, limite) => {
      const [jours, rows] = await Promise.all([db.first<{ n: number }>(sql.administration.compte, [id]), db.all<LigneBrute>(sql.administration.liste, [id, limite])]);
      const liste = [];
      for (const r of rows) {
        const f = versFiche(adaptateur, r);
        const v = contrat.versPortail(f);
        const [rang, classes] = await Promise.all([rankOf(Number(r.day), scoreDe(f), Number(r.submitted_at), id), participants(Number(r.day))]);
        liste.push({ day: Number(r.day), tempsMs: v.tempsMs, ...(v.score ? { score: v.score } : {}), medaille: medaillePortail(r.medal), rang, classes: Math.max(classes + Number(r.hidden), rang), envoyeA: Number(r.submitted_at) });
      }
      return { jours: jours?.n ?? 0, liste };
    },
    retirer: async (id, day) => {
      const row = await db.first<LigneBrute & { replay: string; inputs_hash: string | null }>(sql.administration.retrait, [day, id]);
      if (!row) return null;
      return { tempsMs: contrat.versPortail(versFiche(adaptateur, row)).tempsMs, replay: row.replay, inputsHash: row.inputs_hash, statements: [{ sql: sql.supprimerJour, params: [day, id] }] };
    },
    masquer: (id, masque): Statement[] => [{ sql: sql.masquer, params: [masque ? 1 : 0, id] }],
    lienRediffusion: (date, rang) => config.lienRediffusion?.(date, rang) ?? null,
  };

  return {
    route,
    portail,
    admin,
    dailyLevel: getInfo,
    // Lot P (interrupteur des jeux) : en aperçu, seul l'envoi d'une partie range ses résultats à part ; ils sont effacés quand le jeu passe `on` (jamais publics).
    ecrituresApercu: [`${prefixe}/submit`, ...(config.ecrituresApercuPropres ?? [])],
    viderApercu: (): Statement[] => [{ sql: sql.viderApercu }],
    // Le registre : la validation d'une partie du jour (le contenu du serveur, les versions, le rejeu). Le temps rendu est celui de la partie, en ms.
    validate: async (day, code) => {
      try {
        const r = contrat.decoder(code);
        if (contrat.jourDe(r) !== day) throw new HttpError(409, "not_daily", "Cette partie n'est pas celle de ce jour");
        const n = await getNiveau(day);
        contrat.memeContenu(r, n);
        return contrat.validation(await rejouer(n, code));
      } catch (e) {
        throw e instanceof RefusJeu ? versHttp(e) : e;
      }
    },
    // « Changer mon code » : les parties classées suivent le joueur.
    rotateStatements: (oldId, newId): Statement[] => [{ sql: sql.rotation, params: [newId, oldId] }],
    // Un pseudo changé : le classement le joint à chaque lecture (rien n'est gardé en mémoire).
    onRename: async () => {},
    // Lot R5 — effacement d'un joueur : ses parties classées (le classement se recalcule sans lui à la prochaine lecture).
    erase: async (playerId) => {
      const n = await db.first<{ n: number }>(sql.compteJoueur, [playerId]);
      return { counts: { [contrat.compteEffacement]: n?.n ?? 0 }, statements: [{ sql: sql.effacer, params: [playerId] }] };
    },
  };
}
