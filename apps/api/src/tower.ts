import { formatDay } from "@cdj/core";
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
import { FICHES_SERVEUR } from "./fiches.generated";
import type { GameDefinition, GameInstance, Platform } from "./games";
import { inputsHash } from "./copies";
import { type AdaptateurTable, type ContratJeu, creerJeu, type LigneBrute, type LigneNiveau, RefusJeu } from "./jeux/index";
import { sha256Hex } from "./players";
import { type ExecuteurRejeu, UNITES_REJEU_TOWER, executeurPrincipal, refusDeRediffusion, rejouerTower } from "./towerRejeu";

// Tower (`tower`) : le serveur du 3ᵉ jeu (lot T4), **depuis le lot K2 un jeu du module des jeux** (`jeux/`). Ce fichier ne garde que ce qui est propre à Tower : son **contrat** (`contratTower` : le contenu du jour, la rediffusion,
// le rejeu, les médailles, le fantôme Diamant, le format de ses réponses) et son **adaptateur de table** (`ADAPTATEUR_TOWER` : `tower_results`, hauteur ↓, vies ↓, ticks ↑). Les routes, l'ordre de validation d'un envoi, le
// classement et son rang par l'index, les copies, l'aperçu, l'effacement et les crochets du portail et de l'administration sont ceux du module (`jeux/module.ts`) : voir la rubrique « Module des jeux » de `apps/api/CLAUDE.md`.
// Tower reste `off` tant que Nathan ne le passe pas en `preview` puis `on` depuis `/admin/` (un jeu absent de la table `jeux` vaut `off`).
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

/**
 * **L'adaptateur de table de Tower** (lot K2) : `tower_results`, classée hauteur ↓, vies ↓, ticks ↑ (puis envoi ↑, identifiant ↑ : les départages ultimes de toute table) par l'index
 * `tower_results_by_rank` ; `tower_levels` garde le niveau du jour. Les colonnes écrites sont dans l'ordre de l'insertion historique.
 */
export const ADAPTATEUR_TOWER: AdaptateurTable = {
  table: "tower_results",
  colonnes: [
    { nom: "hauteur_mm", colonne: "hauteur_mm", sens: "desc" },
    { nom: "vies", colonne: "vies", sens: "desc" },
    { nom: "ticks", colonne: "ticks", sens: "asc" },
  ],
  colonnesEcrites: ["tirage", "hauteur_mm", "hauteur_max_mm", "vies", "ticks", "medal", "replay", "sim_version", "generator_version", "first_at", "submitted_at", "inputs_hash", "hidden", "apercu"],
  colonnesGardees: ["first_at", "hidden", "apercu"],
  niveaux: { table: "tower_levels", colonnes: ["g", "tirage", "theme", "source", "fichier", "medals", "silhouette", "author_hash"] },
};

export interface TowerOptions {
  /** Les fichiers du jour de l'image (date → contenu JSON), lus à la construction ; vide sans eux. */
  frozen?: Readonly<Record<string, unknown>>;
  /** Ce qui exécute les rejeux : le fil principal (défaut, repli) ou le fil de calcul (`executeurFil`, `jeux/fil.ts`). */
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
  /** Lot F2 : la référence publique du joueur (`players.ref`). */
  ref?: string;
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
const msOfTicks = (ticks: number) => Math.round((ticks * 1000) / 60);
const n = (v: unknown): number => Number(v);

/**
 * **Le contrat de Tower** (lot K2) : le contenu du jour (le fichier préparé qui se vérifie, sinon le générateur), la rediffusion et son rejeu, les médailles, le fantôme Diamant, le format des réponses. Il ne
 * lit ni n'écrit aucune table (la ligne du niveau est gardée par le module) et ne construit aucune réponse HTTP (il lève `RefusJeu`).
 */
export function contratTower(platform: Platform, options: TowerOptions | undefined): ContratJeu<Niveau, Rediffusion, Resultat> {
  const { log, today } = platform;
  const frozen = options?.frozen ?? {};
  const frozenDays = Object.keys(frozen).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  const executeur = options?.executeur ?? executeurPrincipal();
  let rapier: Promise<import("@cdj/tower-sim").Rapier> | null = null;
  const chargerR = () => (rapier ??= import("@cdj/tower-sim/rapier").then((m) => m.chargerRapier()));
  const empreintesFichiers = new Map<number, string>();
  void today;

  const nombre = (day: number) => {
    const num = numeroTower(day);
    return num >= 1 ? num : null;
  };

  function infoDe(day: number, c: Contenu, m: Medailles, source: "prepare" | "genere"): TowerDayInfo {
    return { date: formatDay(day), empreinte: empreinteContenu(c), number: nombre(day), theme: c.theme, tirage: c.tirage ?? 0, medals: par(m), source, provisoire: source === "genere", simVersion: TOWER_SIM_VERSION, generatorVersion: c.g };
  }

  function contenuDuFichier(day: number): Contenu {
    const lu = lireJour(frozen[formatDay(day)], day);
    if (typeof lu === "string") throw new ErreurGenerateur(lu);
    return lu.contenu;
  }

  const ligneDe = (niveau: Niveau, fichier: boolean): LigneNiveau => ({
    g: niveau.contenu.g,
    tirage: niveau.contenu.tirage ?? 0,
    theme: niveau.contenu.theme,
    source: niveau.info.source,
    fichier: fichier ? 1 : 0,
    medals: JSON.stringify(niveau.medailles),
    silhouette: niveau.silhouette ? JSON.stringify(niveau.silhouette) : null,
    author_hash: niveau.authorHash,
  });

  /** Étape 3 : le texte de la rediffusion — taille (`MAX_CARACTERES`, vérifiée par le décodage avant toute analyse), décodage, versions connues, réglages par défaut seulement. */
  function lireRediffusion(texte: unknown): Rediffusion {
    if (typeof texte !== "string" || texte.length === 0) throw new RefusJeu("invalid_replay", "Rediffusion manquante");
    let r: Rediffusion;
    try {
      r = decoderRediffusion(texte);
    } catch (e) {
      if (e instanceof ErreurRediffusion) throw refusDeRediffusion(e.code);
      throw e;
    }
    // Le serveur ne joue que les réglages par défaut (les curseurs de `?debug&tune` sont des outils, fermés en production).
    for (const k of Object.keys(REGLAGES_DEFAUT) as (keyof typeof REGLAGES_DEFAUT)[]) if (r.reglages[k] !== REGLAGES_DEFAUT[k]) throw new RefusJeu("invalid_replay", "Réglages de partie non permis");
    return r;
  }

  return {
    nomJournal: "DailyTower",
    compteEffacement: "partiesDailyTower",
    versions: () => ({ simVersion: TOWER_SIM_VERSION, generatorVersion: TOWER_GENERATOR_VERSION }),
    joursFiges: frozenDays,

    /** La règle d'une date : versions et empreinte du fichier du jour de l'image. Un autre fichier, une autre version = recalcul. */
    async regle(day) {
      const raw = frozen[formatDay(day)];
      let tag = "-";
      if (raw !== undefined) {
        let h = empreintesFichiers.get(day);
        if (h === undefined) empreintesFichiers.set(day, (h = (await sha256Hex(JSON.stringify(raw))).slice(0, 16)));
        tag = `f${h}`;
      }
      return `s${TOWER_SIM_VERSION}-g${TOWER_GENERATOR_VERSION}-m${MEDAILLES_VERSION}-${tag}`;
    },

    /** Le jour par la règle du jeu : le fichier préparé s'il se vérifie (preuve rejouée), le fichier seulement figé s'il se régénère, sinon le générateur courant au tirage 0. */
    async calculer(day) {
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
          return { niveau, ligne: ligneDe(niveau, true) };
        }
        // Un fichier seulement figé (sans médailles ni preuve) donne son contenu, comme dans le jeu ; un fichier préparé qui ne se vérifie pas est refusé (journal) et le jour est généré.
        const lu = lireJour(raw, day);
        if (typeof lu !== "string" && lu.medailles === null && lu.preuve === null && empreinteContenu(lu.contenu) === empreinteContenu(dailyTower(day, lu.contenu.g, lu.contenu.tirage ?? 0))) {
          const m = estimationGeometrique(lu.contenu);
          const niveau: Niveau = { info: infoDe(day, lu.contenu, m, "genere"), contenu: lu.contenu, medailles: m, authorHash: null, silhouette: null };
          return { niveau, ligne: ligneDe(niveau, true) };
        }
        log("WARNING", "DailyTower : fichier du jour refusé, jour généré", { day: formatDay(day), reason: ex.slice(0, 120) });
      }
      const contenu = dailyTower(day, TOWER_GENERATOR_VERSION, 0);
      const m = estimationGeometrique(contenu);
      const niveau: Niveau = { info: infoDe(day, contenu, m, "genere"), contenu, medailles: m, authorHash: null, silhouette: null };
      return { niveau, ligne: ligneDe(niveau, false) };
    },

    restaurer(day, ligne) {
      // Le contenu ne se garde pas en base : il se régénère (jamais la preuve) à partir du fichier de l'image ou du générateur.
      const contenu = ligne.fichier === 1 ? contenuDuFichier(day) : dailyTower(day, n(ligne.g), n(ligne.tirage));
      const medailles = JSON.parse(String(ligne.medals)) as Medailles;
      const source = ligne.source === "prepare" ? "prepare" : "genere";
      const authorHash = (ligne.author_hash as string | null) ?? null;
      const silhouette = ligne.silhouette === null || ligne.silhouette === undefined ? null : (JSON.parse(String(ligne.silhouette)) as PieceSilhouette[]);
      if (source === "prepare" && (authorHash === null || silhouette === null)) throw new ErreurGenerateur("jour préparé sans empreinte ni silhouette");
      return { info: infoDe(day, contenu, medailles, source), contenu, medailles, authorHash, silhouette };
    },

    champsJournalJour: (niveau) => ({ source: niveau.info.source, tirage: niveau.info.tirage }),
    infoJour: (niveau) => niveau.info,
    portailJour: (niveau, day) => ({ numero: niveau.info.number ?? day - PREMIER_JOUR_TOWER + 1, theme: niveau.info.theme, seuils: par(niveau.medailles), unite: "mm" }),
    empreinteAuteur: (niveau) => niveau.authorHash,

    decoder: lireRediffusion,
    jourDe: (r) => ("jour" in r.contenu ? r.contenu.jour : null),
    /** Étape 5 : la rediffusion nomme le générateur et le tirage que le serveur sert ce jour-là (sinon l'onglet est resté sur une autre version : « recharge la page »). */
    memeContenu(r, niveau) {
      const tirage = "jour" in r.contenu ? (r.contenu.tirage ?? 0) : 0;
      if (r.g !== niveau.contenu.g || tirage !== (niveau.contenu.tirage ?? 0)) throw new RefusJeu("version", `Une nouvelle version du jeu est disponible : recharge la page (générateur ${r.g}, tirage ${tirage})`);
    },
    entrees: (r) => towerInputs(r.plages),
    rejouer: (niveau, texte) => rejouerTower(executeur, { contenu: niveau.contenu, rediffusion: texte }),
    rejouee: (niveau, r, res) => ({
      score: { hauteur_mm: res.hauteurMm, vies: res.vies, ticks: res.ticks },
      autres: { tirage: niveau.contenu.tirage ?? 0, hauteur_max_mm: res.hauteurMaxMm, sim_version: r.sim, generator_version: niveau.contenu.g },
    }),
    medaille: (niveau, score) => medailleDe(score.hauteur_mm!, niveau.medailles),
    champsJournalPartie: (res, improved) => ({ hauteurMm: res.hauteurMm, vies: res.vies, improved, executeur: executeur.nom ?? "inconnu" }),
    validation: (res) => ({ ms: msOfTicks(res.ticks), ticks: res.ticks }),

    ligneClassement(rank, b: LigneBrute): TowerRow {
      return { rank, name: String(b.name), hauteurMm: n(b.hauteur_mm), vies: n(b.vies), ticks: n(b.ticks), medal: (b.medal as MedailleTower | null) ?? null, ...(b.ref ? { ref: String(b.ref) } : {}) };
    },
    reponseEnvoi: (c): TowerSubmitResult => {
      const res = c.mesure as Resultat;
      return {
        accepted: true,
        date: c.date,
        resultat: { hauteurMm: res.hauteurMm, hauteurMaxMm: res.hauteurMaxMm, vies: res.vies, ticks: res.ticks, posees: res.posees, tombees: res.tombees, motif: res.motif },
        medal: c.medaille as MedailleTower | null,
        improved: c.improved,
        best: { hauteurMm: n(c.meilleur.hauteur_mm), vies: n(c.meilleur.vies), ticks: n(c.meilleur.ticks), medal: (c.meilleur.medal as MedailleTower | null) ?? null },
        rank: c.rang,
        participants: c.participants,
        board: c.board as TowerBoard,
      };
    },
    jourProfil: (b, date): TowerMeDay => ({ date, hauteurMm: n(b.hauteur_mm), vies: n(b.vies), ticks: n(b.ticks), medal: (b.medal as MedailleTower | null) ?? null }),
    // Tower se classe à la **hauteur** : le score est `{ unite: "mm", valeur, vies }` à côté de `tempsMs`, qui n'est ici que la durée de la partie (le dernier départage).
    versPortail: (b) => ({ tempsMs: msOfTicks(n(b.ticks)), score: { unite: "mm", valeur: n(b.hauteur_mm), vies: n(b.vies) }, ticks: n(b.ticks) }),

    /**
     * La silhouette de la tour du Diamant (l'état final de la partie du bot), pour un joueur **classé ce jour-là** (règle G1 : le module le vérifie). 404 `no_ghost` si le jour n'a pas de preuve (médailles
     * estimées). Une silhouette, jamais des commandes.
     */
    fantome: {
      route: "diamant",
      lire(niveau, day) {
        if (niveau.silhouette === null) throw new RefusJeu("no_ghost", "Ce jour n'a pas de tour de Diamant");
        return { date: formatDay(day), hauteurMm: niveau.medailles.auteur, pieces: niveau.silhouette };
      },
    },
  };
}

/** La fiche de Tower (`config/jeux/tower.json`), telle que le serveur la lit. */
const FICHE_TOWER = FICHES_SERVEUR.find((f) => f.code === "tower")!;

export function createTower(platform: Platform, options: TowerOptions | undefined): GameInstance {
  return creerJeu(platform, {
    fiche: FICHE_TOWER,
    contrat: contratTower(platform, options),
    adaptateur: ADAPTATEUR_TOWER,
    nom: "Tower",
    prefixe: "/api/tower",
    graceMs: TOWER_GRACE_MS,
    top: TOWER_BOARD_TOP,
    lecturesParAdresse: TOWER_READS_PER_CLIENT,
    lecturesProfilParJoueur: TOWER_ME_PER_PLAYER,
    debit: { adresse: "twip", joueur: "twp", lectures: "twrd", profilAdresse: "tmeip", profilJoueur: "tme" },
  });
}

/** Tower, prêt pour le registre : routes sous `/api/tower`. */
export const TOWER_GAME: GameDefinition<TowerOptions | undefined> = {
  code: "tower",
  name: "Tower",
  prefix: "/api/tower",
  tables: ["tower_levels", "tower_results"],
  schema: TOWER_SCHEMA,
  versions: () => ({ simVersion: TOWER_SIM_VERSION, generatorVersion: TOWER_GENERATOR_VERSION }),
  create: createTower,
};

export { UNITES_REJEU_TOWER };
