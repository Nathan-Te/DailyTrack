import { formatDay, parseDay } from "@cdj/core";
import { WithHeaders, cacheHeaders } from "../cache";
import { inputsHash } from "../copies";
import { CODES_ERREUR, type CodeErreur } from "../codesErreur";
import type { SqlValue } from "../db";
import { HttpError } from "../errors";
import type { FICHES_SERVEUR } from "../fiches.generated";
import type { AdminDuJeu, GameInstance, MedaillePortail, Platform, PortailDuJeu, RequestInfo, Statement } from "../games";
import { type AdaptateurTable, sqlDe, verifierAdaptateur, versFiche, versTable } from "./adaptateur";
import { refOfPlayer } from "../players";
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

/** Ce que le module met à la disposition des routes propres d'un jeu et de ses extensions (lot K2b) : les mêmes fonctions que ses propres routes, jamais une copie. */
export interface OutilsModule<Niveau> {
  /** Le niveau d'un jour (lu en base si la règle est la même, sinon calculé une seule fois). */
  niveau(jour: number): Promise<Niveau>;
  /** Une date d'adresse en jour (400 `invalid_date`, 404 `unknown_day` pour le futur ou avant le premier jour). */
  dayOf(date: string): number;
  /** Le jour accepte-t-il encore des envois (aujourd'hui à Paris, hier pendant la grâce) ? */
  ouvert(jour: number): boolean;
  /** Le débit des lectures du jeu (en mémoire, par adresse). */
  limiterLectures(info: RequestInfo): Promise<void>;
  /** L'identifiant du joueur en en-tête `X-Player-Id` (400 `invalid_player` s'il est exigé et manque). */
  joueurEntete(req: Request, requis: boolean): string | null;
  /** Le classement d'un jour tel que la route `board` le rend (ta ligne avec `moi`). */
  classement(jour: number, moi: string | null): Promise<unknown>;
  /** La place d'un résultat dans le classement du jour (nombre de classés visibles qui passent devant, plus un). */
  rang(jour: number, score: Record<string, number>, envoyeA: number, playerId: string): Promise<number>;
  /** Le nombre de classés visibles d'un jour. */
  classes(jour: number): Promise<number>;
}

/** Une route que seul ce jeu a (Salon, Garage, vies, carnage, paliers…) : essayée après celles du module ; `undefined` : ce chemin n'est pas à elle. */
export type RoutePropre = (path: string, req: Request, url: URL, info: RequestInfo, outils: OutilsModule<never>) => Promise<unknown>;

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
  /** Point d'extension : appelé en tête de chaque requête que l'instance reçoit, avant tout (Jump y oublie les vies d'un jour fini). */
  avantRoute?: (path: string) => Promise<void>;
  /** Point d'extension : reçoit les outils du module à la création (les routes propres et leurs sous-modules en ont besoin avant la première requête). */
  recevoirOutils?: (outils: OutilsModule<Niveau>) => void;
  /** Point d'extension : le profil `me` du jeu quand son format n'est pas celui du module (Jump). */
  profil?: (id: string, info: RequestInfo) => Promise<unknown>;
  /** Point d'extension : durée (ms) pendant laquelle le portail garde en mémoire le nombre de classés du jour (défaut : aucune mémoire). */
  memoClasses?: number;
  /** Points d'extension : ce que le jeu ajoute ou remplace dans ce que le module fabrique (le module ne nomme jamais un jeu). */
  surcharges?: {
    portail?: (base: PortailDuJeu) => PortailDuJeu;
    admin?: (base: AdminDuJeu) => AdminDuJeu;
    rotation?: (ancien: string, nouveau: string, base: Statement[]) => Statement[];
    effacement?: (playerId: string, base: { counts: Record<string, number>; statements: Statement[] }) => Promise<{ counts: Record<string, number>; statements: Statement[] }>;
    apresRenommage?: () => void;
    apresEffacement?: () => void;
  };
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
  if (!contrat.valider && !(contrat.decoder && contrat.jourDe && contrat.memeContenu && contrat.entrees && contrat.rejouer)) throw new Error(`le contrat de ${fiche.code} ne dit ni \`valider\` ni decoder / jourDe / memeContenu / entrees / rejouer`);
  const sansMedaille = adaptateur.sansMedaille === true;
  const messageJour = contrat.messagesJournal?.jour ?? `${contrat.nomJournal} : jour calculé`;
  const messagePartie = contrat.messagesJournal?.partie ?? `${contrat.nomJournal} : partie du jour`;
  const sql = sqlDe(adaptateur);
  const colonnes = adaptateur.colonnes;
  const tableNiveaux = adaptateur.niveaux?.table ?? null;
  const colonnesNiveau = adaptateur.niveaux?.colonnes ?? [];
  const premierJour = parseDay(fiche.premierJour)!;
  const unites = fiche.rejeu.unitesServeur;
  /** Le sens du classement de la fiche : `desc` = la plus grande valeur d'abord. */
  const effectif = colonnes.map((c) => (c.signe === -1 ? (c.sens === "asc" ? "desc" : "asc") : c.sens));

  // --- Le niveau du jour : lu en base si la règle est la même, sinon calculé une seule fois (même si deux requêtes arrivent ensemble) -------------------------
  const niveaux = new Map<number, { rule: string; niveau: Niveau }>();
  const enCalcul = new Map<number, Promise<Niveau>>();

  async function chargerNiveau(day: number, rule: string): Promise<Niveau> {
    const row = tableNiveaux ? await db.first<Record<string, SqlValue>>(`SELECT rule, ${colonnesNiveau.join(", ")} FROM ${tableNiveaux} WHERE day = ?`, [day]) : null;
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
      if (tableNiveaux) await db.run(`INSERT OR REPLACE INTO ${tableNiveaux} (day, rule, ${colonnesNiveau.join(", ")}, created_at) VALUES (?, ?, ${colonnesNiveau.map(() => "?").join(", ")}, ?)`, [
        day,
        rule,
        ...colonnesNiveau.map((k) => c.ligne[k] ?? null),
        now(),
      ]);
      log("INFO", messageJour, { day: formatDay(day), ...contrat.champsJournalJour(niveau), ms: Math.round(performance.now() - debutCalcul) });
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
    if (contrat.jourMin !== undefined && day < contrat.jourMin) throw new HttpError(404, "unknown_day", "Ce jour n'a pas de niveau");
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

  const ligne = (rank: number, brute: LigneBrute): unknown => contrat.ligneClassement!(rank, versFiche(adaptateur, brute));

  async function board(day: number, me: string | null): Promise<unknown> {
    if (contrat.tableau) {
      // Point d'extension : le jeu met le classement en forme (Jump : `levelId`, `deaths`, un niveau lu seulement s'il y a des classés).
      const [count, rows, own] = await Promise.all([participants(day), db.all<LigneBrute>(sql.top, [day, config.top]), me ? db.first<LigneBrute>(sql.moi, [day, me]) : Promise.resolve(null)]);
      return contrat.tableau({
        date: formatDay(day),
        ouvert: isOpen(day),
        participants: count,
        top: rows,
        moi: own && me ? own : null,
        rangMoi: () => rankOf(day, scoreDe(versFiche(adaptateur, own!)), Number(own!.submitted_at), me!),
        niveau: () => getNiveau(day),
        apresEnvoi: false,
      });
    }
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
  async function rejouer(niveau: Niveau, texte: string, r?: Rejeu): Promise<Mesure> {
    platform.spendReplays(r !== undefined && contrat.unites ? contrat.unites(r) : unites); // lots R5 et R7 : le plafond global de rejeux de l'instance (503 au-delà) ; le jeu pèse `rejeu.unitesServeur` de sa fiche, ou ce que dit son contrat
    return contrat.rejouer!(niveau, texte);
  }

  /** Lot R9 : une copie (les entrées de l'auteur du niveau, ou d'une partie déjà classée d'un autre joueur ce jour-là, ou retirée par l'administration) est refusée avant d'écrire quoi que ce soit. */
  async function refuserCopies(jour: number, hash: string, auteur: string | null, playerId: string): Promise<void> {
    if (platform.allowCopies) return;
    if (hash === auteur) throw new HttpError(409, "replay_copy", "Cette partie est la copie de la preuve de l'auteur");
    if (await db.first(sql.copie, [jour, hash, playerId])) throw new HttpError(409, "replay_copy", "Cette partie est la copie d'une autre");
    if (await db.first(`SELECT 1 AS n FROM resultats_retires WHERE game = '${fiche.code}' AND day = ? AND inputs_hash = ? LIMIT 1`, [jour, hash])) throw new HttpError(409, "replay_copy", "Cette partie a été retirée par l'administration");
  }

  /**
   * Lot D2 (C5) : la réponse d'un renvoi déjà accepté — celle d'un envoi qui n'améliore rien (`improved: false`), construite sur la ligne écrite, avec `deja: true`. Même forme que la réponse d'un
   * envoi pour le jeu ; le classement est celui d'aujourd'hui ; **rien n'est rejoué ni écrit**, le plafond de rejeux n'est pas touché.
   */
  async function reponseDeja(playerIdCourant: string, jour: number, niveau: Niveau, ligneDeja: LigneBrute, mesure: Mesure): Promise<unknown> {
    const prev = versFiche(adaptateur, ligneDeja);
    const at = Number(ligneDeja.submitted_at);
    const medaille = sansMedaille ? contrat.medailleDeLigne!(niveau, prev) : ((ligneDeja.medal as string | null) ?? null);
    const best: LigneBrute & { submitted_at: number } = { ...prev, ...scoreDe(prev), medal: medaille, submitted_at: at };
    const entrees = { date: formatDay(jour), jour, niveau, mesure, medaille, improved: false, meilleur: best };
    log("INFO", `${messagePartie} déjà acceptée`, { day: formatDay(jour) });
    if (contrat.tableau) {
      const [rank, total, rows] = await Promise.all([rankOf(jour, scoreDe(best), at, playerIdCourant), participants(jour), db.all<LigneBrute>(sql.top, [jour, config.top])]);
      const moi: LigneBrute = { ...best, name: (await players.find(playerIdCourant))?.name ?? "", ref: await refOfPlayer(playerIdCourant) };
      const tableau = await contrat.tableau({ date: formatDay(jour), ouvert: isOpen(jour), participants: total, top: rows, moi, rangMoi: async () => rank, niveau: async () => niveau, apresEnvoi: true });
      return { ...(contrat.reponseEnvoi({ ...entrees, rang: rank, participants: total, board: tableau }) as object), deja: true };
    }
    const [rank, b] = await Promise.all([rankOf(jour, scoreDe(best), at, playerIdCourant), board(jour, playerIdCourant)]);
    return { ...(contrat.reponseEnvoi({ ...entrees, rang: rank, participants: (b as { participants: number }).participants, board: b }) as object), deja: true };
  }

  async function submit(req: Request, info: RequestInfo): Promise<unknown> {
    // 1. Débit, compté en base (exact quelle que soit l'instance), avant de lire le corps et avant tout rejeu. Compteurs propres au jeu.
    await platform.hitAddress(info, debit.adresse, limits.perClient);
    const playerId = headerPlayer(req, true)!;
    await hit(await hashKey(debit.joueur, playerId), limits.perPlayer);
    // 2. Taille du corps (413 au-delà de `MAX_BODY_BYTES`, lu sans tout charger).
    const body = await readJson(req);
    let known = null as Awaited<ReturnType<typeof players.find>>;
    let name = "";
    let actif: Promise<void> | null = null;
    const verifierActif = (): Promise<void> => (actif ??= players.assertActive(playerId));
    /** Joueur actif et pseudo (réservé à son premier propriétaire, vérifié avant le rejeu). */
    const joueur = async (): Promise<void> => {
      await verifierActif();
      known = await players.find(playerId);
      name = await players.resolveName(playerId, body.name, known);
    };
    /**
     * Lot D2 (C5) : la partie déjà écrite de ce joueur, si le texte envoyé est exactement celui de sa meilleure partie du jour (un renvoi) — sans rejeu, sans plafond de rejeux. Le pseudo suit les
     * mêmes règles qu'un envoi ordinaire (réservé à son propriétaire ; un joueur peut réécrire le sien avec une autre casse) : seul le rejeu est évité.
     */
    const dejaAccepte = async (jourDemande: number, texte: unknown): Promise<LigneBrute | null> => {
      if (typeof texte !== "string" || texte.length === 0 || !contrat.mesureDeLigne) return null;
      await verifierActif();
      const ligne = await db.first<LigneBrute>(sql.deja, [jourDemande, playerId, info.apercu === true ? 1 : 0, texte]);
      if (!ligne) return null;
      await joueur();
      await players.save(playerId, name, known);
      return ligne;
    };
    let jour: number;
    let niveau: Niveau;
    let r: Rejeu;
    let mesure: Mesure;
    let hash: string;
    if (contrat.valider) {
      // Point d'extension : le jeu valide dans son ordre (le jour, les versions, la rediffusion, le rejeu) ; les copies viennent après, comme avant.
      const v = await contrat.valider(body, { niveau: getNiveau, ouvert: isOpen, avantRejeu: joueur, dejaAccepte });
      ({ jour, niveau, rejeu: r, mesure } = v);
      if (v.deja) return reponseDeja(playerId, jour, niveau, v.deja, mesure);
      hash = v.empreinte;
      await refuserCopies(jour, hash, v.empreinteAuteur, playerId);
    } else {
      // 3 à 5. Le texte, le jour, le contenu.
      r = contrat.decoder!(body.replay);
      const j = contrat.jourDe!(r);
      if (j === null) throw new HttpError(409, "not_daily", "Un scénario d'essai n'est jamais classé");
      jour = j;
      if (jour > today()) throw new HttpError(409, "not_daily", "Ce jour n'est pas encore sorti");
      if (!isOpen(jour)) throw new HttpError(409, "day_closed", "Le classement de ce jour est figé : seul le jour en cours se classe");
      niveau = await getNiveau(jour);
      contrat.memeContenu!(r, niveau);
      // Lot D2 (C5) : un renvoi déjà accepté répond ici, **après** les contrôles du jour et du contenu (une autre version reste refusée) et **avant** le joueur, les copies, le plafond de rejeux et le rejeu.
      const deja = await dejaAccepte(jour, body.replay);
      if (deja) return reponseDeja(playerId, jour, niveau, deja, contrat.mesureDeLigne!(deja, niveau));
      // 6. Joueur actif et pseudo.
      await joueur();
      // 7. Copies (lot R9) : refusées avant d'écrire quoi que ce soit, pas même le joueur ; le même joueur qui renvoie sa propre partie n'est pas concerné.
      hash = await inputsHash(contrat.entrees!(r));
      await refuserCopies(jour, hash, contrat.empreinteAuteur(niveau), playerId);
      // 8. Le plafond de rejeux, puis le rejeu : la seule source du résultat.
      mesure = await rejouer(niveau, body.replay as string, r);
    }

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
        hidden: (known as { hidden: number } | null)?.hidden === 1 || apercu === 1 ? 1 : 0, // lot N1 : un joueur masqué reste masqué ; lot P : l'aperçu est masqué aussi
        apercu,
      };
      await db.run(sql.insertion, [jour, playerId, ...sql.colonnesInsert.map((c) => valeurs[c] ?? null)]);
    }
    log("INFO", messagePartie, { day: formatDay(jour), ...contrat.champsJournalPartie(mesure, improved) });
    const medalPrev = prev ? (sansMedaille ? contrat.medailleDeLigne!(niveau, prev) : ((prev.medal as string | null) ?? null)) : null;
    const best: LigneBrute & { submitted_at: number } = improved
      ? { ...rejouee.autres, ...rejouee.score, medal: medalNew, submitted_at: t }
      : { ...prev!, ...scoreDe(prev!), medal: medalPrev, submitted_at: Number(prev!.submitted_at) };
    if (contrat.tableau) {
      // Point d'extension : le classement d'après l'envoi se met en forme comme les autres, sans relire ta ligne (elle vient d'être écrite : `best`).
      const [rank, total, rows] = await Promise.all([rankOf(jour, scoreDe(best), best.submitted_at, playerId), participants(jour), db.all<LigneBrute>(sql.top, [jour, config.top])]);
      const moi: LigneBrute = { ...best, name, ref: await refOfPlayer(playerId) };
      const tableau = await contrat.tableau({ date: formatDay(jour), ouvert: isOpen(jour), participants: total, top: rows, moi, rangMoi: async () => rank, niveau: async () => niveau, apresEnvoi: true });
      return contrat.reponseEnvoi({ date: formatDay(jour), jour, niveau, mesure, medaille: medalNew, improved, meilleur: best, rang: rank, participants: total, board: tableau });
    }
    const [rank, b] = await Promise.all([rankOf(jour, scoreDe(best), best.submitted_at, playerId), board(jour, playerId)]);
    return contrat.reponseEnvoi({ date: formatDay(jour), jour, niveau, mesure, medaille: medalNew, improved, meilleur: best, rang: rank, participants: (b as { participants: number }).participants, board: b });
  }

  // --- Le fantôme (réservé aux classés) ---------------------------------------------------------------------------------------------------
  /** 403 `not_ranked` pour qui n'est pas classé ce jour-là (règle G1 : on le débloque en finissant) ; le contrat dit le reste (404 `no_ghost` sans preuve). */
  async function fantome(day: number, id: string): Promise<unknown> {
    await players.assertActive(id);
    if (!(await db.first(sql.classe, [day, id]))) throw new HttpError(403, "not_ranked", "Le fantôme se débloque quand tu es classé ce jour-là");
    return contrat.fantome!.lire(await getNiveau(day), day);
  }

  // --- La rediffusion du n° 1 du jour (lot « manques de Blocks ») ----------------------------------------------------------------------
  /** Le premier du classement et sa rediffusion. Jour ouvert : 403 `not_ranked` pour qui n'est pas classé (on le débloque en finissant, comme le fantôme) ; 404 `no_ghost` si personne n'est classé. */
  async function premier(day: number, id: string | null): Promise<unknown> {
    if (isOpen(day)) {
      if (!id) throw new HttpError(400, "invalid_player", "Identifiant de joueur attendu");
      await players.assertActive(id);
      if (!(await db.first(sql.classe, [day, id]))) throw new HttpError(403, "not_ranked", "La partie du premier se débloque quand tu es classé ce jour-là");
    }
    const ligne = await db.first<LigneBrute>(sql.premier, [day]);
    if (!ligne) throw new HttpError(404, "no_ghost", "Personne n'est encore classé ce jour-là");
    return { date: formatDay(day), name: ligne.name, replay: ligne.replay, simVersion: ligne.sim_version, generatorVersion: ligne.generator_version, mine: id !== null && ligne.player_id === id };
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
      return contrat.jourProfil!(versFiche(adaptateur, r), formatDay(Number(r.day)));
    });
    const joues = new Set(rows.map((r) => Number(r.day)));
    const t = today();
    let streak = 0;
    for (let d = joues.has(t) ? t : t - 1; joues.has(d); d--) streak++;
    return { name: player.name, renameRequired: player.rename_required === 1, today: formatDay(t), ...contrat.versions(), days, stats: { days: days.length, medals, streak }, generation };
  }

  // --- Les routes -----------------------------------------------------------------------------------------------------------------------
  const echapper = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  const cheminJour = new RegExp(`^${echapper(prefixe)}/day/([^/]+)(/board${contrat.fantome ? `|/${echapper(contrat.fantome.route)}` : ""}${contrat.premier ? "|/first" : ""})?$`);

  /** Les outils que le module prête aux routes propres et aux extensions du jeu. */
  const outils: OutilsModule<Niveau> = { niveau: getNiveau, dayOf, ouvert: isOpen, limiterLectures: limitReads, joueurEntete: headerPlayer, classement: board, rang: rankOf, classes: participants };

  async function route(path: string, req: Request, _url: URL, info: RequestInfo): Promise<unknown> {
    try {
      await config.avantRoute?.(path);
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
        return config.profil ? await config.profil(headerPlayer(req, true)!, info) : await myProfile(headerPlayer(req, true)!, info);
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
        if (m[2] === "/first") return new WithHeaders(await premier(day, headerPlayer(req, false)), cacheHeaders({ open, perPlayer: true }));
        if (m[2] !== undefined) return new WithHeaders(await fantome(day, headerPlayer(req, true)!), cacheHeaders({ open, perPlayer: true }));
        return new WithHeaders(await getInfo(day), cacheHeaders({ open, perPlayer: false }));
      }
      for (const propre of config.routesPropres ?? []) {
        const r = await propre(path, req, _url, info, outils as OutilsModule<never>);
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
  /** Le nombre de classés montré par le portail : relu à chaque fois, ou gardé `memoClasses` ms par instance (Jump). */
  const classesMemo = new Map<number, { at: number; n: number }>();
  async function classesDuJour(day: number): Promise<number> {
    if (!config.memoClasses) return participants(day);
    const kept = classesMemo.get(day);
    if (kept && now() - kept.at < config.memoClasses) return kept.n;
    const n = await participants(day);
    if (classesMemo.size > 8) classesMemo.clear();
    classesMemo.set(day, { at: now(), n });
    return n;
  }

  // Lot A3 : le premier jour de la catégorie (facultatif dans la fiche ; la fiche générée n'en écrit le champ que si un jeu l'a).
  const depuis = (fiche as { categorieDepuis?: string }).categorieDepuis;
  const categorieDepuis = depuis === undefined ? undefined : (parseDay(depuis) ?? undefined);
  const portailBase: PortailDuJeu = {
    site: fiche.id,
    nom: config.nom,
    premierJour,
    categorie: fiche.categorie,
    ...(categorieDepuis !== undefined ? { categorieDepuis } : {}),
    ...(fiche.classement.format !== "temps" ? { unite: fiche.classement.unite === "mm" ? ("mm" as const) : ("points" as const) } : {}),
    ...(fiche.classement.format === "temps" && !fiche.classement.cumul ? { cumul: false as const } : {}), // un jeu au temps hors du cumul (arcade) : sa vue reste, le cumul ne le compte pas
    classement: fiche.classement.format === "temps" ? "temps" : "hauteur", // lot K4c : tout jeu classé à un score (hauteur, points) compte dans la journée mais jamais dans le cumul au temps
    async jour(day) {
      return contrat.portailJour(await getNiveau(day), day);
    },
    async etat(id, day, connu) {
      const own = await db.first<LigneBrute>(sql.etat, [day, id]);
      if (!own) return contrat.etatSansEssai ? contrat.etatSansEssai(id, day) : { statut: "pas_joue" };
      const f = versFiche(adaptateur, own);
      const v = contrat.versPortail(f);
      const [rang, classes, niveau] = await Promise.all([
        connu ? connu.rang : rankOf(day, scoreDe(f), Number(own.submitted_at), id),
        connu ? connu.classes : classesDuJour(day),
        sansMedaille ? getNiveau(day) : Promise.resolve(null),
      ]);
      const medaille = niveau !== null ? medaillePortail(contrat.medailleDeLigne!(niveau, f)) : medaillePortail(own.medal);
      return { statut: "fini", tempsMs: v.tempsMs, medaille, rang, classes: Math.max(classes, rang), ...(v.score ? { score: v.score } : {}) };
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
      if (rows.length === 0) return [];
      const niveau = sansMedaille ? await getNiveau(day) : null; // un jour sans classé ne calcule rien
      return rows.map((r) => {
        const v = contrat.versPortail(versFiche(adaptateur, r));
        return { playerId: r.player_id, tempsMs: v.tempsMs, medaille: niveau !== null ? medaillePortail(contrat.medailleDeLigne!(niveau, versFiche(adaptateur, r))) : medaillePortail(r.medal), at: Number(r.submitted_at), ...(v.score ? { score: v.score } : {}), ...(v.ticks !== undefined ? { ticks: v.ticks } : {}) }; // lot F2 : `ticks` exacts pour le classement filtré « Amis »
      });
    },
  };

  const portail = config.surcharges?.portail ? config.surcharges.portail(portailBase) : portailBase;

  const adminBase: AdminDuJeu = {
    activite: [{ table: adaptateur.table, jour: "day", joueur: "player_id", ...(adaptateur.filtreJeu ? { portee: `${adaptateur.filtreJeu.colonne} = '${adaptateur.filtreJeu.valeur}'` } : {}) }],
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
  const admin = config.surcharges?.admin ? config.surcharges.admin(adminBase) : adminBase;

  config.recevoirOutils?.(outils);

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
        if (contrat.valider) {
          const n = await getNiveau(day);
          const v = await contrat.valider(contrat.corpsDeRegistre!(n, code), { niveau: getNiveau, ouvert: isOpen, avantRejeu: async () => {}, dejaAccepte: async () => null });
          return contrat.validation(v.mesure);
        }
        const r = contrat.decoder!(code);
        if (contrat.jourDe!(r) !== day) throw new HttpError(409, "not_daily", "Cette partie n'est pas celle de ce jour");
        const n = await getNiveau(day);
        contrat.memeContenu!(r, n);
        return contrat.validation(await rejouer(n, code, r));
      } catch (e) {
        throw e instanceof RefusJeu ? versHttp(e) : e;
      }
    },
    // « Changer mon code » : les parties classées suivent le joueur.
    rotateStatements: (oldId, newId): Statement[] => {
      const base: Statement[] = [{ sql: sql.rotation, params: [newId, oldId] }];
      return config.surcharges?.rotation ? config.surcharges.rotation(oldId, newId, base) : base;
    },
    // Un pseudo changé : le classement le joint à chaque lecture (rien n'est gardé en mémoire, sauf ce que le jeu garde et oublie ici).
    onRename: async () => {
      config.surcharges?.apresRenommage?.();
    },
    // Lot R5 — effacement d'un joueur : ses parties classées (le classement se recalcule sans lui à la prochaine lecture).
    erase: async (playerId) => {
      const n = await db.first<{ n: number }>(sql.compteJoueur, [playerId]);
      const base = { counts: { [contrat.compteEffacement]: n?.n ?? 0 }, statements: [{ sql: sql.effacer, params: [playerId] }] as Statement[] };
      return config.surcharges?.effacement ? config.surcharges.effacement(playerId, base) : base;
    },
    onErased: config.surcharges?.apresEffacement ? () => config.surcharges!.apresEffacement!() : undefined,
    // Lot K4d : les lignes du classement filtré (« Amis », « Mon groupe ») d'un jeu au format neuf : les colonnes de la fiche des seuls joueurs de la liste, **une requête**, mises en forme comme « Tous ».
    lignesAmies: async (day, ids) => {
      const sorties = new Map<string, (rang: number, pseudo: string, ref: string) => Record<string, unknown>>();
      if (ids.length === 0 || !contrat.ligneClassement) return sorties;
      const rows = await db.all<LigneBrute & { player_id: string }>(sql.joueurs(ids.length), [day, ...ids]);
      for (const r of rows) sorties.set(r.player_id, (rang, pseudo, ref) => contrat.ligneClassement!(rang, versFiche(adaptateur, { ...r, name: pseudo, ref })) as Record<string, unknown>);
      return sorties;
    },
  };
}
