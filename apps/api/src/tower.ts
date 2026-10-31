import { formatDay, parseDay } from "@cdj/core";
import {
  type Contenu,
  dailyTower,
  decoderRediffusion,
  empreinteContenu,
  ErreurGenerateur,
  estimationGeometrique,
  type Medailles,
  MEDAILLES_VERSION,
  medailleObtenue,
  type NomMedaille,
  numeroTower,
  PREMIER_JOUR_TOWER,
  type Plage,
  REGLAGES_DEFAUT,
  type Rediffusion,
  type Resultat,
  TOWER_GENERATOR_VERSION,
  TOWER_SIM_VERSION,
  type VuePartie,
  lireJour,
  ErreurRediffusion,
} from "@cdj/tower-sim";
import { examinerJourPrepare } from "@cdj/tower-sim/bot";
import { WithHeaders, cacheHeaders } from "./cache";
import { HttpError } from "./errors";
import type { AdminDuJeu, GameDefinition, GameInstance, MedaillePortail, Platform, PortailDuJeu, RequestInfo, ScorePortail, Statement } from "./games";
import { inputsHash } from "./copies";
import { sha256Hex } from "./players";
import { type ExecuteurRejeu, UNITES_REJEU_TOWER, erreurDeRediffusion, executeurPrincipal, rejouerPourServeur } from "./towerRejeu";

// Tower (`tower`) : le serveur du 3ᵉ jeu (lot T4). Même plan que DailyJump (`jump.ts`), à la hauteur plutôt qu'au chrono. Tower reste `off` : il n'est pas dans la table `jeux` (la garde du lot P le
// protège) et **cette définition n'est pas encore inscrite au registre** (`registry.ts`) : l'inscrire ajoute des tables au schéma, ce qui exige la remise à zéro du lancement (`TABLES_VIDEES`) et les
// pages des mentions légales — zones de la plateforme (cahier des charges du lot T4, docs/tower/lots/lot-T4-serveur-accueil.md). Les tests et l'outil d'essai montent le jeu par l'option `games` de `createApi`.
//
//   GET  /api/tower/info                      versions, date du jour (Paris), jours figés de l'image, environnement
//   GET  /api/tower/day/<AAAA-MM-JJ>          le contenu du jour tel que le serveur le calcule (numéro, thème, tirage, médailles en mm, source, provisoire ; jamais la preuve)
//   POST /api/tower/submit                    une partie : la rediffusion est rejouée, le serveur garde **son** résultat
//   GET  /api/tower/day/<AAAA-MM-JJ>/board    le classement du jour : les 50 premiers et ta ligne (`X-Player-Id`, facultatif)
//   GET  /api/tower/day/<AAAA-MM-JJ>/diamant  la silhouette de la tour du Diamant (l'état final de la partie du bot), seulement pour un joueur classé ce jour-là
//   GET  /api/tower/me                        le profil du joueur : chaque jour classé, médailles, série
//
// **Le contenu du jour est calculé par la même règle que le jeu** (`apps/tower/src/jour.ts`) : d'abord le fichier du jour préparé (`apps/tower/public/jours/`, option `frozen`), accepté seulement s'il
// se relit, se régénère à l'identique au tirage écrit et si sa **preuve rejouée donne le Diamant écrit** (`examinerJourPrepare` de `@cdj/tower-sim/bot`, la fonction du garde-fou des outils) ; sinon le
// tirage 0 de `dailyTower` et les médailles provisoires de l'estimation géométrique. Gardé en base (`tower_levels`, avec la règle qui l'a produit) et en mémoire : **un seul calcul même si deux
// requêtes arrivent ensemble**. La preuve de l'auteur ne sort jamais : le serveur n'en garde que l'empreinte de ses entrées et la silhouette de sa tour finale.
//
// **Un envoi est validé dans cet ordre, du moins cher au plus cher** : (1) débit compté en base (adresse, puis joueur) avant tout ; (2) taille du corps ; (3) texte de la rediffusion (taille, décodage,
// versions, réglages par défaut) ; (4) le jour : celui de Paris, ou celui d'hier pendant la grâce de 10 min ; (5) le contenu qu'elle nomme est celui du serveur (générateur, tirage) ; (6) joueur actif et
// pseudo ; (7) copies (`409 replay_copy` : les entrées de l'auteur ou d'un autre joueur classé ce jour-là) ; (8) plafond de rejeux (`spendReplays(UNITES_REJEU_TOWER)`) puis le rejeu, dans le fil de
// calcul s'il existe. Le serveur garde son `Resultat`, jamais un résultat annoncé.

/** La même grâce que DailyTrack et DailyJump (`GRACE_MS`, testé) : un joueur qui arrive juste après minuit de Paris peut encore classer sa partie de la veille. */
export const TOWER_GRACE_MS = 10 * 60_000;
/** Le classement rend les 50 premiers. */
export const TOWER_BOARD_TOP = 50;
/** Lectures de `/api/tower/*` par adresse et par fenêtre de débit (10 minutes). */
export const TOWER_READS_PER_CLIENT = 120;
/** Lectures du profil par joueur et par fenêtre. */
export const TOWER_ME_PER_PLAYER = 60;

/** Les tables de Tower : le contenu du jour (aucune donnée de joueur) et les meilleures parties. */
export const TOWER_SCHEMA: string[] = [
  // Le jour de chaque date, tel que le serveur le calcule. `rule` : la règle qui l'a produit (versions de la simulation, du générateur et des médailles, empreinte du fichier du jour) ; une autre
  // règle = recalcul. `fichier` : 1 si le contenu vient d'un fichier du jour (sinon `dailyTower(jour, g, tirage)`). `silhouette` : la tour finale du Diamant (JSON, jamais les commandes) ; `author_hash` :
  // l'empreinte des entrées de la preuve (refus des copies). Rien de tout cela ne désigne un joueur.
  `CREATE TABLE IF NOT EXISTS tower_levels (
     day INTEGER PRIMARY KEY,
     rule TEXT NOT NULL,
     g INTEGER NOT NULL,
     tirage INTEGER NOT NULL,
     theme TEXT NOT NULL,
     source TEXT NOT NULL,
     fichier INTEGER NOT NULL,
     medals TEXT NOT NULL,
     silhouette TEXT,
     author_hash TEXT,
     created_at INTEGER NOT NULL
   )`,
  // La meilleure partie de chaque joueur pour chaque jour, **rejouée par le serveur** : hauteur finale stable (mm), hauteur la plus haute atteinte, vies, ticks, la médaille obtenue (code commun),
  // sa rediffusion (le fantôme « ma meilleure », rendu au seul joueur) et l'empreinte de ses entrées. Remplacée seulement par une partie strictement meilleure (hauteur, puis vies, puis moins de ticks).
  `CREATE TABLE IF NOT EXISTS tower_results (
     day INTEGER NOT NULL,
     player_id TEXT NOT NULL,
     tirage INTEGER NOT NULL,
     hauteur_mm INTEGER NOT NULL,
     hauteur_max_mm INTEGER NOT NULL,
     vies INTEGER NOT NULL,
     ticks INTEGER NOT NULL,
     medal TEXT,
     replay TEXT NOT NULL,
     sim_version INTEGER NOT NULL,
     generator_version INTEGER NOT NULL,
     first_at INTEGER NOT NULL,
     submitted_at INTEGER NOT NULL,
     inputs_hash TEXT NOT NULL,
     hidden INTEGER NOT NULL DEFAULT 0,
     apercu INTEGER NOT NULL DEFAULT 0,
     PRIMARY KEY (day, player_id)
   )`,
  // Le classement : `hidden` avant la hauteur (tout classement écarte `hidden = 1`), puis l'ordre du classement lui-même, de sorte que le top 50 se lit dans l'ordre de l'index et que le rang se compte
  // par quatre recherches (hauteur plus grande, vies plus grandes à hauteur égale…) qui ne lisent que les parties qui passent devant.
  `CREATE INDEX IF NOT EXISTS tower_results_by_rank ON tower_results (day, hidden, hauteur_mm DESC, vies DESC, ticks, submitted_at, player_id)`,
  `CREATE INDEX IF NOT EXISTS tower_results_by_inputs ON tower_results (day, inputs_hash)`,
  `CREATE INDEX IF NOT EXISTS tower_results_by_player ON tower_results (player_id, day)`,
  // Lot P : effacer les parties d'aperçu quand le jeu passe `on` (l'index ne couvre que ces quelques lignes).
  `CREATE INDEX IF NOT EXISTS tower_results_by_apercu ON tower_results (apercu) WHERE apercu = 1`,
];

export interface TowerOptions {
  /** Les fichiers du jour de l'image (date → contenu JSON), lus à la construction ; vide sans eux. */
  frozen?: Readonly<Record<string, unknown>>;
  /** Ce qui exécute les rejeux : le fil principal (défaut, repli) ou le fil de calcul (`executeurFil`, `towerFil.ts`). */
  executeur?: ExecuteurRejeu;
}

/** Les codes communs aux jeux de la plateforme (`MedaillePortail`) pour les noms de médailles de Tower (le Diamant est `author`). */
export type MedailleTower = "author" | "gold" | "silver" | "bronze";
const CODE_MEDAILLE: Readonly<Record<NomMedaille, MedailleTower>> = { auteur: "author", or: "gold", argent: "silver", bronze: "bronze" };
const medailleDe = (hauteurMm: number, m: Medailles): MedailleTower | null => {
  const n = medailleObtenue(hauteurMm, m);
  return n === null ? null : CODE_MEDAILLE[n];
};

/** Le jour tel que `GET /api/tower/day/<date>` le rend. */
export interface TowerDayInfo {
  date: string;
  /** L'empreinte du contenu joué (`empreinteContenu` de `@cdj/tower-sim`) : le jeu et le serveur disent le même contenu quand elle est la même. */
  empreinte: string;
  /** Le numéro de la tour (`PREMIER_JOUR_TOWER`, provisoire), ou `null` avant la tour n° 1. */
  number: number | null;
  theme: string;
  tirage: number;
  medals: { author: number; gold: number; silver: number; bronze: number };
  /** `prepare` : le fichier du jour préparé (médailles du bot, preuve rejouée) ; `genere` : le générateur, médailles estimées. */
  source: "prepare" | "genere";
  provisoire: boolean;
  simVersion: number;
  generatorVersion: number;
}

/** Une pièce de la silhouette (la même forme que `FantomePiece` du jeu). */
export interface PieceSilhouette {
  kind: string;
  rot: number;
  taille: string;
  x: number;
  y: number;
  angle: number;
}

export interface TowerRow {
  rank: number;
  name: string;
  hauteurMm: number;
  vies: number;
  ticks: number;
  medal: MedailleTower | null;
}

export interface TowerBoard {
  date: string;
  open: boolean;
  participants: number;
  top: TowerRow[];
  me: TowerRow | null;
  /** Lot R8 : la génération de données (`Platform.generation`), pour « Nouveau départ ». */
  generation: number;
}

export interface TowerSubmitResult {
  accepted: true;
  date: string;
  /** Le résultat **du rejeu** de cet envoi. */
  resultat: Pick<Resultat, "hauteurMm" | "hauteurMaxMm" | "vies" | "ticks" | "posees" | "tombees" | "motif">;
  medal: MedailleTower | null;
  /** « Nouveau record » : premier envoi du jour, ou strictement meilleur (hauteur, puis vies, puis moins de ticks) que le meilleur du joueur. */
  improved: boolean;
  best: { hauteurMm: number; vies: number; ticks: number; medal: MedailleTower | null };
  rank: number;
  participants: number;
  board: TowerBoard;
}

export interface TowerMeDay {
  date: string;
  hauteurMm: number;
  vies: number;
  ticks: number;
  medal: MedailleTower | null;
}

export interface TowerMe {
  name: string;
  renameRequired: boolean;
  today: string;
  simVersion: number;
  generatorVersion: number;
  days: TowerMeDay[];
  stats: { days: number; medals: Record<MedailleTower, number>; streak: number };
  generation: number;
}

/** Le jour en mémoire : ce que rend `/day`, le contenu joué, et ce qui ne sort jamais (empreinte des entrées de l'auteur, silhouette de sa tour). */
interface Niveau {
  info: TowerDayInfo;
  contenu: Contenu;
  medailles: Medailles;
  authorHash: string | null;
  silhouette: PieceSilhouette[] | null;
}

/**
 * Les entrées effectivement jouées d'une rediffusion de Tower, plages recollées (le codage en plages n'est pas unique : deux plages voisines de même masque n'en font qu'une) — la base du refus
 * des copies. La rediffusion étant refusée si elle s'arrête avant la fin de la partie ou la dépasse, toutes ses plages comptent.
 */
export function towerInputs(plages: readonly Plage[]): string {
  const out: string[] = [];
  let dernier = -1;
  let n = 0;
  for (const p of plages) {
    if (n > 0 && p.masque === dernier) n += p.ticks;
    else {
      if (n > 0) out.push(`${n}x${dernier}`);
      dernier = p.masque;
      n = p.ticks;
    }
  }
  if (n > 0) out.push(`${n}x${dernier}`);
  return `tower|${out.join(";")}`;
}

/** La silhouette d'une vue finale : les pièces encore sur la tour. */
export function silhouetteDe(vue: Pick<VuePartie, "pieces">): PieceSilhouette[] {
  return vue.pieces.filter((p) => p.etat === "libre").map((p) => ({ kind: p.kind, rot: p.rot, taille: p.taille, x: p.x, y: p.y, angle: p.angle }));
}

const par = (m: Medailles) => ({ author: m.auteur, gold: m.or, silver: m.argent, bronze: m.bronze });

/** Rang d'un résultat : les parties qui passent devant (hauteur, puis vies, puis moins de ticks, puis envoyée avant, puis l'identifiant) — quatre recherches d'index, aucune ne lit les parties derrière. */
const RANK_SQL =
  "SELECT (SELECT COUNT(*) FROM tower_results WHERE day = ? AND hidden = 0 AND hauteur_mm > ?)" +
  " + (SELECT COUNT(*) FROM tower_results WHERE day = ? AND hidden = 0 AND hauteur_mm = ? AND vies > ?)" +
  " + (SELECT COUNT(*) FROM tower_results WHERE day = ? AND hidden = 0 AND hauteur_mm = ? AND vies = ? AND ticks < ?)" +
  " + (SELECT COUNT(*) FROM tower_results WHERE day = ? AND hidden = 0 AND hauteur_mm = ? AND vies = ? AND ticks = ? AND (submitted_at < ? OR (submitted_at = ? AND player_id < ?))) AS n";

export function createTower(platform: Platform, options: TowerOptions | undefined): GameInstance {
  const { db, now, log, today, sinceMidnight, hashKey, hit, readHit, readJson, playerIdOf, players, limits } = platform;
  const frozen = options?.frozen ?? {};
  const frozenDays = Object.keys(frozen).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  const executeur = options?.executeur ?? executeurPrincipal();
  let rapier: Promise<import("@cdj/tower-sim").Rapier> | null = null;
  const chargerR = () => (rapier ??= import("@cdj/tower-sim/rapier").then((m) => m.chargerRapier()));

  // --- Le contenu du jour ------------------------------------------------------------------------------------------------
  const niveaux = new Map<number, { rule: string; niveau: Niveau }>();
  const enCalcul = new Map<number, Promise<Niveau>>();
  const empreintesFichiers = new Map<number, string>();

  /** La règle d'une date : versions et empreinte du fichier du jour de l'image. Un autre fichier, une autre version = recalcul. */
  async function ruleOf(day: number): Promise<string> {
    const raw = frozen[formatDay(day)];
    let tag = "-";
    if (raw !== undefined) {
      let h = empreintesFichiers.get(day);
      if (h === undefined) empreintesFichiers.set(day, (h = (await sha256Hex(JSON.stringify(raw))).slice(0, 16)));
      tag = `f${h}`;
    }
    return `s${TOWER_SIM_VERSION}-g${TOWER_GENERATOR_VERSION}-m${MEDAILLES_VERSION}-${tag}`;
  }

  const nombre = (day: number) => {
    const n = numeroTower(day);
    return n >= 1 ? n : null;
  };

  function infoDe(day: number, c: Contenu, m: Medailles, source: "prepare" | "genere"): TowerDayInfo {
    return { date: formatDay(day), empreinte: empreinteContenu(c), number: nombre(day), theme: c.theme, tirage: c.tirage ?? 0, medals: par(m), source, provisoire: source === "genere", simVersion: TOWER_SIM_VERSION, generatorVersion: c.g };
  }

  /** Le jour par la règle du jeu : le fichier préparé s'il se vérifie (preuve rejouée), le fichier seulement figé s'il se régénère, sinon le générateur courant au tirage 0. */
  async function calculer(day: number): Promise<{ niveau: Niveau; fichier: boolean }> {
    const raw = frozen[formatDay(day)];
    if (raw !== undefined) {
      const ex = examinerJourPrepare(await chargerR(), raw, day);
      if (typeof ex !== "string") {
        const rediffusion = decoderRediffusion(ex.lu.preuve);
        const niveau: Niveau = {
          info: infoDe(day, ex.lu.contenu, ex.lu.medailles, "prepare"),
          contenu: ex.lu.contenu,
          medailles: ex.lu.medailles,
          authorHash: await inputsHash(towerInputs(rediffusion.plages)),
          silhouette: silhouetteDe(ex.rejeu.vue),
        };
        return { niveau, fichier: true };
      }
      // Un fichier seulement figé (sans médailles ni preuve) donne son contenu, comme dans le jeu ; un fichier préparé qui ne se vérifie pas est refusé (journal) et le jour est généré.
      const lu = lireJour(raw, day);
      if (typeof lu !== "string" && lu.medailles === null && lu.preuve === null && empreinteContenu(lu.contenu) === empreinteContenu(dailyTower(day, lu.contenu.g, lu.contenu.tirage ?? 0))) {
        const m = estimationGeometrique(lu.contenu);
        return { niveau: { info: infoDe(day, lu.contenu, m, "genere"), contenu: lu.contenu, medailles: m, authorHash: null, silhouette: null }, fichier: true };
      }
      log("WARNING", "DailyTower : fichier du jour refusé, jour généré", { day: formatDay(day), reason: ex.slice(0, 120) });
    }
    const contenu = dailyTower(day, TOWER_GENERATOR_VERSION, 0);
    const m = estimationGeometrique(contenu);
    return { niveau: { info: infoDe(day, contenu, m, "genere"), contenu, medailles: m, authorHash: null, silhouette: null }, fichier: false };
  }

  function contenuDuFichier(day: number): Contenu {
    const lu = lireJour(frozen[formatDay(day)], day);
    if (typeof lu === "string") throw new ErreurGenerateur(lu);
    return lu.contenu;
  }

  async function chargerNiveau(day: number, rule: string): Promise<Niveau> {
    const row = await db.first<{ rule: string; g: number; tirage: number; source: string; fichier: number; medals: string; silhouette: string | null; author_hash: string | null }>(
      "SELECT rule, g, tirage, source, fichier, medals, silhouette, author_hash FROM tower_levels WHERE day = ?",
      [day],
    );
    let niveau: Niveau | null = null;
    if (row && row.rule === rule) {
      try {
        // Le contenu ne se garde pas en base : il se régénère (jamais la preuve) à partir du fichier de l'image ou du générateur.
        const contenu = row.fichier === 1 ? contenuDuFichier(day) : dailyTower(day, row.g, row.tirage);
        const medailles = JSON.parse(row.medals) as Medailles;
        const source = row.source === "prepare" ? "prepare" : "genere";
        if (source === "prepare" && (row.author_hash === null || row.silhouette === null)) throw new ErreurGenerateur("jour préparé sans empreinte ni silhouette");
        niveau = { info: infoDe(day, contenu, medailles, source), contenu, medailles, authorHash: row.author_hash, silhouette: row.silhouette === null ? null : (JSON.parse(row.silhouette) as PieceSilhouette[]) };
      } catch {
        niveau = null; // une ligne abîmée est recalculée, jamais crue
      }
    }
    if (!niveau) {
      const debut = performance.now();
      const c = await calculer(day);
      niveau = c.niveau;
      await db.run(
        "INSERT OR REPLACE INTO tower_levels (day, rule, g, tirage, theme, source, fichier, medals, silhouette, author_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [day, rule, niveau.contenu.g, niveau.contenu.tirage ?? 0, niveau.contenu.theme, niveau.info.source, c.fichier ? 1 : 0, JSON.stringify(niveau.medailles), niveau.silhouette ? JSON.stringify(niveau.silhouette) : null, niveau.authorHash, now()],
      );
      log("INFO", "DailyTower : jour calculé", { day: formatDay(day), source: niveau.info.source, tirage: niveau.info.tirage, ms: Math.round(performance.now() - debut) });
    }
    niveaux.set(day, { rule, niveau });
    return niveau;
  }

  async function getNiveau(day: number): Promise<Niveau> {
    const rule = await ruleOf(day);
    const memo = niveaux.get(day);
    if (memo && memo.rule === rule) return memo.niveau;
    let attente = enCalcul.get(day);
    if (!attente) {
      attente = chargerNiveau(day, rule).finally(() => enCalcul.delete(day));
      enCalcul.set(day, attente);
    }
    return attente;
  }

  const getInfo = async (day: number): Promise<TowerDayInfo> => (await getNiveau(day)).info;

  function dayOf(date: string): number {
    const day = parseDay(date);
    if (day === null) throw new HttpError(400, "invalid_date", "Date attendue au format AAAA-MM-JJ");
    if (day > today()) throw new HttpError(404, "unknown_day", "Cette tour n'est pas encore sortie");
    return day;
  }

  /** Le jour accepte-t-il encore des envois ? Aujourd'hui (Paris), et hier pendant la grâce qui suit minuit. Sinon il est figé. */
  const isOpen = (day: number): boolean => day === today() || (day === today() - 1 && sinceMidnight() < TOWER_GRACE_MS);

  const limitReads = (info: RequestInfo) => platform.readHitAddress(info, "twrd", TOWER_READS_PER_CLIENT);

  function headerPlayer(req: Request, required: boolean): string | null {
    const raw = req.headers.get("x-player-id");
    if (raw === null || raw === "") {
      if (required) throw new HttpError(400, "invalid_player", "Identifiant de joueur manquant (en-tête X-Player-Id)");
      return null;
    }
    return playerIdOf(raw);
  }

  // --- La validation d'une partie ----------------------------------------------------------------------------------------
  /** Étape 3 : le texte de la rediffusion — taille (`MAX_CARACTERES`, vérifiée par le décodage avant toute analyse), décodage, versions connues, réglages par défaut seulement. */
  function lireRediffusion(texte: unknown): Rediffusion {
    if (typeof texte !== "string" || texte.length === 0) throw new HttpError(400, "invalid_replay", "Rediffusion manquante");
    let r: Rediffusion;
    try {
      r = decoderRediffusion(texte);
    } catch (e) {
      if (e instanceof ErreurRediffusion) throw erreurDeRediffusion(e);
      throw e;
    }
    // Le serveur ne joue que les réglages par défaut (les curseurs de `?debug&tune` sont des outils, fermés en production).
    for (const k of Object.keys(REGLAGES_DEFAUT) as (keyof typeof REGLAGES_DEFAUT)[]) if (r.reglages[k] !== REGLAGES_DEFAUT[k]) throw new HttpError(400, "invalid_replay", "Réglages de partie non permis");
    return r;
  }

  /** Étape 4 : le jour que nomme la rediffusion — un jour (pas un scénario), celui d'aujourd'hui ou d'hier pendant la grâce. */
  function jourDeRediffusion(r: Rediffusion): number {
    if (!("jour" in r.contenu)) throw new HttpError(409, "not_daily", "Un scénario d'essai n'est jamais classé");
    const day = r.contenu.jour;
    if (day > today()) throw new HttpError(409, "not_daily", "Cette tour n'est pas encore sortie");
    if (!isOpen(day)) throw new HttpError(409, "day_closed", "Le classement de ce jour est figé : seule la tour du jour se classe");
    return day;
  }

  /** Étape 5 : la rediffusion nomme le générateur et le tirage que le serveur sert ce jour-là (sinon l'onglet est resté sur une autre version : « recharge la page »). */
  function memeContenu(r: Rediffusion, n: Niveau): void {
    const tirage = "jour" in r.contenu ? (r.contenu.tirage ?? 0) : 0;
    if (r.g !== n.contenu.g || tirage !== (n.contenu.tirage ?? 0)) throw new HttpError(409, "version", `Une nouvelle version du jeu est disponible : recharge la page (générateur ${r.g}, tirage ${tirage})`);
  }

  async function rejouer(n: Niveau, texte: string): Promise<Resultat> {
    platform.spendReplays(UNITES_REJEU_TOWER); // lots R5 et R7 : le plafond global de rejeux de l'instance (503 au-delà) ; Tower pèse UNITES_REJEU_TOWER
    return rejouerPourServeur(executeur, { contenu: n.contenu, rediffusion: texte });
  }

  // --- Le classement ------------------------------------------------------------------------------------------------------
  async function rankOf(day: number, h: number, vies: number, ticks: number, at: number, id: string): Promise<number> {
    const row = await db.first<{ n: number }>(RANK_SQL, [day, h, day, h, vies, day, h, vies, ticks, day, h, vies, ticks, at, at, id]);
    return (row?.n ?? 0) + 1;
  }

  async function participants(day: number): Promise<number> {
    return (await db.first<{ n: number }>("SELECT COUNT(*) AS n FROM tower_results WHERE day = ? AND hidden = 0", [day]))?.n ?? 0;
  }

  type LigneBrute = { hauteur_mm: number; vies: number; ticks: number; medal: string | null; name: string };
  const ligne = (rank: number, r: LigneBrute): TowerRow => ({ rank, name: r.name, hauteurMm: r.hauteur_mm, vies: r.vies, ticks: r.ticks, medal: (r.medal as MedailleTower | null) ?? null });

  async function board(day: number, me: string | null): Promise<TowerBoard> {
    const [count, rows, own, generation] = await Promise.all([
      participants(day),
      db.all<LigneBrute>(
        "SELECT r.hauteur_mm AS hauteur_mm, r.vies AS vies, r.ticks AS ticks, r.medal AS medal, p.name AS name FROM tower_results r JOIN players p ON p.id = r.player_id WHERE r.day = ? AND r.hidden = 0 ORDER BY r.hauteur_mm DESC, r.vies DESC, r.ticks ASC, r.submitted_at ASC, r.player_id ASC LIMIT ?",
        [day, TOWER_BOARD_TOP],
      ),
      me
        ? db.first<LigneBrute & { submitted_at: number }>(
            "SELECT r.hauteur_mm AS hauteur_mm, r.vies AS vies, r.ticks AS ticks, r.medal AS medal, r.submitted_at AS submitted_at, p.name AS name FROM tower_results r JOIN players p ON p.id = r.player_id WHERE r.day = ? AND r.player_id = ?",
            [day, me],
          )
        : Promise.resolve(null),
      platform.generation(),
    ]);
    const mine = own && me ? ligne(await rankOf(day, own.hauteur_mm, own.vies, own.ticks, own.submitted_at, me), own) : null;
    return { date: formatDay(day), open: isOpen(day), participants: count, top: rows.map((r, i) => ligne(i + 1, r)), me: mine, generation };
  }

  // --- L'envoi ------------------------------------------------------------------------------------------------------------
  async function submit(req: Request, info: RequestInfo): Promise<TowerSubmitResult> {
    // 1. Débit, compté en base (exact quelle que soit l'instance), avant de lire le corps et avant tout rejeu. Compteurs propres à Tower.
    await platform.hitAddress(info, "twip", limits.perClient);
    const playerId = headerPlayer(req, true)!;
    await hit(await hashKey("twp", playerId), limits.perPlayer);
    // 2. Taille du corps (413 au-delà de `MAX_BODY_BYTES`, lu sans tout charger).
    const body = await readJson(req);
    // 3 à 5. Le texte, le jour, le contenu.
    const r = lireRediffusion(body.replay);
    const day = jourDeRediffusion(r);
    const niveau = await getNiveau(day);
    memeContenu(r, niveau);
    // 6. Joueur actif et pseudo (réservé à son premier propriétaire, vérifié avant le rejeu).
    await players.assertActive(playerId);
    const known = await players.find(playerId);
    const name = await players.resolveName(playerId, body.name, known);
    // 7. Copies (lot R9) : refusées avant d'écrire quoi que ce soit, pas même le joueur ; le même joueur qui renvoie sa propre partie n'est pas concerné.
    const hash = await inputsHash(towerInputs(r.plages));
    if (!platform.allowCopies) {
      if (hash === niveau.authorHash) throw new HttpError(409, "replay_copy", "Cette partie est la copie de la preuve de l'auteur");
      if (await db.first("SELECT 1 AS n FROM tower_results WHERE day = ? AND inputs_hash = ? AND player_id <> ? LIMIT 1", [day, hash, playerId])) throw new HttpError(409, "replay_copy", "Cette partie est la copie d'une autre");
      if (await db.first("SELECT 1 AS n FROM resultats_retires WHERE game = 'tower' AND day = ? AND inputs_hash = ? LIMIT 1", [day, hash])) throw new HttpError(409, "replay_copy", "Cette partie a été retirée par l'administration");
    }
    // 8. Le plafond de rejeux, puis le rejeu : la seule source du résultat.
    const res = await rejouer(niveau, body.replay as string);

    const t = now();
    // Le joueur n'existe qu'après une partie valide (table `players` de la plateforme).
    await players.save(playerId, name, known);
    // Lot P : pendant l'aperçu du jeu (`info.apercu`) la partie est rangée à part (`apercu = 1`, `hidden = 1`) ; elle ne remplace jamais une partie publique.
    const apercu = info.apercu === true ? 1 : 0;
    const prev = await db.first<{ hauteur_mm: number; vies: number; ticks: number; medal: string | null; submitted_at: number }>(
      "SELECT hauteur_mm, vies, ticks, medal, submitted_at FROM tower_results WHERE day = ? AND player_id = ? AND apercu = ?",
      [day, playerId, apercu],
    );
    const improved = !prev || res.hauteurMm > prev.hauteur_mm || (res.hauteurMm === prev.hauteur_mm && (res.vies > prev.vies || (res.vies === prev.vies && res.ticks < prev.ticks)));
    const medalNew = medailleDe(res.hauteurMm, niveau.medailles);
    if (improved) {
      await db.run(
        `INSERT INTO tower_results (day, player_id, tirage, hauteur_mm, hauteur_max_mm, vies, ticks, medal, replay, sim_version, generator_version, first_at, submitted_at, inputs_hash, hidden, apercu)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (day, player_id) DO UPDATE SET tirage = excluded.tirage, hauteur_mm = excluded.hauteur_mm, hauteur_max_mm = excluded.hauteur_max_mm, vies = excluded.vies, ticks = excluded.ticks,
           medal = excluded.medal, replay = excluded.replay, sim_version = excluded.sim_version, generator_version = excluded.generator_version, submitted_at = excluded.submitted_at, inputs_hash = excluded.inputs_hash
         WHERE tower_results.apercu = excluded.apercu AND (excluded.hauteur_mm > tower_results.hauteur_mm OR (excluded.hauteur_mm = tower_results.hauteur_mm AND (excluded.vies > tower_results.vies OR (excluded.vies = tower_results.vies AND excluded.ticks < tower_results.ticks))))`,
        [day, playerId, niveau.contenu.tirage ?? 0, res.hauteurMm, res.hauteurMaxMm, res.vies, res.ticks, medalNew, body.replay as string, TOWER_SIM_VERSION, niveau.contenu.g, t, t, hash, known?.hidden === 1 || apercu === 1 ? 1 : 0, apercu], // lot N1 : un joueur masqué reste masqué ; lot P : l'aperçu est masqué aussi
      );
    }
    log("INFO", "DailyTower : partie du jour", { day: formatDay(day), hauteurMm: res.hauteurMm, vies: res.vies, improved });
    const best = improved ? { hauteurMm: res.hauteurMm, vies: res.vies, ticks: res.ticks, medal: medalNew, at: t } : { hauteurMm: prev!.hauteur_mm, vies: prev!.vies, ticks: prev!.ticks, medal: (prev!.medal as MedailleTower | null) ?? null, at: prev!.submitted_at };
    const [rank, b] = await Promise.all([rankOf(day, best.hauteurMm, best.vies, best.ticks, best.at, playerId), board(day, playerId)]);
    return {
      accepted: true,
      date: formatDay(day),
      resultat: { hauteurMm: res.hauteurMm, hauteurMaxMm: res.hauteurMaxMm, vies: res.vies, ticks: res.ticks, posees: res.posees, tombees: res.tombees, motif: res.motif },
      medal: medalNew,
      improved,
      best: { hauteurMm: best.hauteurMm, vies: best.vies, ticks: best.ticks, medal: best.medal },
      rank,
      participants: b.participants,
      board: b,
    };
  }

  // --- Le fantôme Diamant ---------------------------------------------------------------------------------------------------
  /**
   * La silhouette de la tour du Diamant (l'état final de la partie du bot), pour un joueur **classé ce jour-là** (règle G1 : on la débloque en finissant). 403 `not_ranked` sinon ; 404 `no_ghost` si le
   * jour n'a pas de preuve (médailles estimées). Une silhouette, jamais des commandes.
   */
  async function diamant(day: number, id: string): Promise<{ date: string; hauteurMm: number; pieces: PieceSilhouette[] }> {
    await players.assertActive(id);
    if (!(await db.first("SELECT 1 AS n FROM tower_results WHERE day = ? AND player_id = ?", [day, id]))) throw new HttpError(403, "not_ranked", "Le Diamant se débloque quand tu es classé ce jour-là");
    const n = await getNiveau(day);
    if (n.silhouette === null) throw new HttpError(404, "no_ghost", "Ce jour n'a pas de tour de Diamant");
    return { date: formatDay(day), hauteurMm: n.medailles.auteur, pieces: n.silhouette };
  }

  // --- Le profil -------------------------------------------------------------------------------------------------------------
  async function myProfile(id: string, info: RequestInfo): Promise<TowerMe> {
    await platform.readHitAddress(info, "tmeip", TOWER_READS_PER_CLIENT);
    readHit(await hashKey("tme", id), TOWER_ME_PER_PLAYER);
    await players.assertActive(id);
    const [player, rows, generation] = await Promise.all([
      players.find(id),
      db.all<{ day: number; hauteur_mm: number; vies: number; ticks: number; medal: string | null }>("SELECT day, hauteur_mm, vies, ticks, medal FROM tower_results WHERE player_id = ? ORDER BY day ASC", [id]),
      platform.generation(),
    ]);
    if (!player) throw new HttpError(404, "unknown_player", "Ce profil n'existe pas sur le serveur : joue une partie pour l'ouvrir");
    const medals: Record<MedailleTower, number> = { author: 0, gold: 0, silver: 0, bronze: 0 };
    const days: TowerMeDay[] = rows.map((r) => {
      const medal = (r.medal as MedailleTower | null) ?? null;
      if (medal) medals[medal]++;
      return { date: formatDay(r.day), hauteurMm: r.hauteur_mm, vies: r.vies, ticks: r.ticks, medal };
    });
    const joues = new Set(rows.map((r) => r.day));
    const t = today();
    let streak = 0;
    for (let d = joues.has(t) ? t : t - 1; joues.has(d); d--) streak++;
    return { name: player.name, renameRequired: player.rename_required === 1, today: formatDay(t), simVersion: TOWER_SIM_VERSION, generatorVersion: TOWER_GENERATOR_VERSION, days, stats: { days: days.length, medals, streak }, generation };
  }

  // --- Les routes -----------------------------------------------------------------------------------------------------------
  async function route(path: string, req: Request, _url: URL, info: RequestInfo): Promise<unknown> {
    if (path === "/api/tower/info") {
      if (req.method !== "GET") throw new HttpError(405, "method_not_allowed", "GET attendu");
      await limitReads(info);
      return { game: "tower", simVersion: TOWER_SIM_VERSION, generatorVersion: TOWER_GENERATOR_VERSION, today: formatDay(today()), frozenDays, environment: platform.environment };
    }
    if (path === "/api/tower/submit") {
      if (req.method !== "POST") throw new HttpError(405, "method_not_allowed", "POST attendu");
      return await submit(req, info);
    }
    if (path === "/api/tower/me") {
      if (req.method !== "GET") throw new HttpError(405, "method_not_allowed", "GET attendu");
      return await myProfile(headerPlayer(req, true)!, info);
    }
    const m = /^\/api\/tower\/day\/([^/]+)(\/board|\/diamant)?$/.exec(path);
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
      if (m[2] === "/diamant") return new WithHeaders(await diamant(day, headerPlayer(req, true)!), cacheHeaders({ open, perPlayer: true }));
      return new WithHeaders(await getInfo(day), cacheHeaders({ open, perPlayer: false }));
    }
    if (path === "/api/tower" || path.startsWith("/api/tower/")) throw new HttpError(404, "not_found", "Route inconnue");
    return undefined;
  }


  // --- Lot TP : ce que le portail et le panneau d'administration font de Tower --------------------------------------------------
  // Tower se classe à la **hauteur** (`classement: "hauteur"`) : le score est `{ unite: "mm", valeur, vies }` à côté de `tempsMs`, qui n'est ici que la durée de la partie (le dernier départage).
  // Il compte dans la journée (série, journée parfaite, partage) mais jamais dans le cumul au temps : la place d'un jour vient de l'ordre du classement de Tower (hauteur, vies, ticks, envoi).
  const msOfTicks = (ticks: number) => Math.round((ticks * 1000) / 60);
  const scoreDe = (r: { hauteur_mm: number; vies: number }): ScorePortail => ({ unite: "mm", valeur: r.hauteur_mm, vies: r.vies });
  const medaillePortail = (m: string | null): MedaillePortail | null => (m === "author" || m === "gold" || m === "silver" || m === "bronze" ? m : null);

  const portail: PortailDuJeu = {
    site: "tower",
    nom: "Tower",
    premierJour: PREMIER_JOUR_TOWER,
    classement: "hauteur",
    async jour(day) {
      const n = await getNiveau(day);
      return { numero: n.info.number ?? day - PREMIER_JOUR_TOWER + 1, theme: n.info.theme, seuils: par(n.medailles), unite: "mm" };
    },
    async etat(id, day, connu) {
      const own = await db.first<{ hauteur_mm: number; vies: number; ticks: number; medal: string | null; submitted_at: number }>(
        "SELECT hauteur_mm, vies, ticks, medal, submitted_at FROM tower_results WHERE day = ? AND player_id = ?",
        [day, id],
      );
      if (!own) return { statut: "pas_joue" };
      const [rang, classes] = await Promise.all([connu ? connu.rang : rankOf(day, own.hauteur_mm, own.vies, own.ticks, own.submitted_at, id), connu ? connu.classes : participants(day)]);
      return { statut: "fini", tempsMs: msOfTicks(own.ticks), medaille: medaillePortail(own.medal), rang, classes: Math.max(classes, rang), score: scoreDe(own) };
    },
    joursFinis: async (id) => (await db.all<{ day: number }>("SELECT day FROM tower_results WHERE player_id = ?", [id])).map((r) => r.day),
    async profil(id) {
      const rows = await db.all<{ day: number; hauteur_mm: number; vies: number; ticks: number; medal: string | null; submitted_at: number }>(
        "SELECT day, hauteur_mm, vies, ticks, medal, submitted_at FROM tower_results WHERE player_id = ?",
        [id],
      );
      const medailles: Record<MedaillePortail, number> = { author: 0, gold: 0, silver: 0, bronze: 0 };
      let meilleurRang: { date: string; rang: number; classes: number } | null = null;
      for (const r of rows) {
        const m = medaillePortail(r.medal);
        if (m) medailles[m]++;
        const [rang, classes] = await Promise.all([rankOf(r.day, r.hauteur_mm, r.vies, r.ticks, r.submitted_at, id), participants(r.day)]);
        if (!meilleurRang || rang < meilleurRang.rang || (rang === meilleurRang.rang && classes > meilleurRang.classes)) meilleurRang = { date: formatDay(r.day), rang, classes: Math.max(classes, rang) };
      }
      return { joursFinis: rows.length, medailles, meilleurRang };
    },
    // Tous les classés du jour dans l'ordre du classement de Tower (un jour sans classé ne calcule rien : le fichier du jour n'est pas lu).
    async classes(day) {
      const rows = await db.all<{ player_id: string; hauteur_mm: number; vies: number; ticks: number; medal: string | null; submitted_at: number }>(
        "SELECT player_id, hauteur_mm, vies, ticks, medal, submitted_at FROM tower_results WHERE day = ? AND hidden = 0 ORDER BY hauteur_mm DESC, vies DESC, ticks ASC, submitted_at ASC, player_id ASC",
        [day],
      );
      return rows.map((r) => ({ playerId: r.player_id, tempsMs: msOfTicks(r.ticks), medaille: medaillePortail(r.medal), at: r.submitted_at, score: scoreDe(r) }));
    },
  };

  const admin: AdminDuJeu = {
    activite: [{ table: "tower_results", jour: "day", joueur: "player_id" }],
    compteurs: async (day) => ({ finis: (await db.first<{ n: number }>("SELECT COUNT(*) AS n FROM tower_results WHERE day = ?", [day]))?.n ?? 0 }),
    joursPrets: async () => ({ figes: frozenDays.length }),
    resultats: async (id, limite) => {
      const [jours, rows] = await Promise.all([
        db.first<{ n: number }>("SELECT COUNT(*) AS n FROM tower_results WHERE player_id = ?", [id]),
        db.all<{ day: number; hauteur_mm: number; vies: number; ticks: number; medal: string | null; submitted_at: number; hidden: number }>(
          "SELECT day, hauteur_mm, vies, ticks, medal, submitted_at, hidden FROM tower_results WHERE player_id = ? ORDER BY day DESC LIMIT ?",
          [id, limite],
        ),
      ]);
      const liste = [];
      for (const r of rows) {
        const [rang, classes] = await Promise.all([rankOf(r.day, r.hauteur_mm, r.vies, r.ticks, r.submitted_at, id), participants(r.day)]);
        liste.push({ day: r.day, tempsMs: msOfTicks(r.ticks), score: scoreDe(r), medaille: medaillePortail(r.medal), rang, classes: Math.max(classes + r.hidden, rang), envoyeA: r.submitted_at });
      }
      return { jours: jours?.n ?? 0, liste };
    },
    retirer: async (id, day) => {
      const row = await db.first<{ ticks: number; replay: string; inputs_hash: string | null }>("SELECT ticks, replay, inputs_hash FROM tower_results WHERE day = ? AND player_id = ?", [day, id]);
      if (!row) return null;
      return { tempsMs: msOfTicks(row.ticks), replay: row.replay, inputsHash: row.inputs_hash, statements: [{ sql: "DELETE FROM tower_results WHERE day = ? AND player_id = ?", params: [day, id] }] };
    },
    masquer: (id, masque): Statement[] => [{ sql: "UPDATE tower_results SET hidden = ? WHERE player_id = ?", params: [masque ? 1 : 0, id] }],
    // Tower n'a pas de lecteur d'une rediffusion d'un autre joueur.
    lienRediffusion: () => null,
  };

  return {
    route,
    portail,
    admin,
    dailyLevel: getInfo,
    // Lot P (interrupteur des jeux) : en aperçu, seul l'envoi d'une partie range ses résultats à part ; ils sont effacés quand le jeu passe `on` (jamais publics).
    ecrituresApercu: ["/api/tower/submit"],
    viderApercu: (): Statement[] => [{ sql: "DELETE FROM tower_results WHERE apercu = 1" }],
    // Le registre : la validation d'une partie du jour (le contenu du serveur, les versions, le rejeu). Le temps rendu est celui de la partie, en ms.
    validate: async (day, code) => {
      const r = lireRediffusion(code);
      if (!("jour" in r.contenu) || r.contenu.jour !== day) throw new HttpError(409, "not_daily", "Cette partie n'est pas celle de ce jour");
      const n = await getNiveau(day);
      memeContenu(r, n);
      const res = await rejouer(n, code);
      return { ms: Math.round((res.ticks * 1000) / 60), ticks: res.ticks };
    },
    // « Changer mon code » : les parties classées suivent le joueur.
    rotateStatements: (oldId, newId): Statement[] => [{ sql: "UPDATE tower_results SET player_id = ? WHERE player_id = ?", params: [newId, oldId] }],
    // Un pseudo changé : le classement le joint à chaque lecture (rien n'est gardé en mémoire).
    onRename: async () => {},
    // Lot R5 — effacement d'un joueur : ses parties classées (le classement se recalcule sans lui à la prochaine lecture).
    erase: async (playerId) => {
      const n = await db.first<{ n: number }>("SELECT COUNT(*) AS n FROM tower_results WHERE player_id = ?", [playerId]);
      return { counts: { partiesDailyTower: n?.n ?? 0 }, statements: [{ sql: "DELETE FROM tower_results WHERE player_id = ?", params: [playerId] }] };
    },
  };
}

/** Tower, prêt pour le registre (pas encore inscrit : voir l'en-tête) : routes sous `/api/tower`. */
export const TOWER_GAME: GameDefinition<TowerOptions | undefined> = {
  code: "tower",
  name: "Tower",
  prefix: "/api/tower",
  tables: ["tower_levels", "tower_results"],
  schema: TOWER_SCHEMA,
  versions: () => ({ simVersion: TOWER_SIM_VERSION, generatorVersion: TOWER_GENERATOR_VERSION }),
  create: createTower,
};
