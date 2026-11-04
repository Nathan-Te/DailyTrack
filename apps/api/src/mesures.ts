import { AsyncLocalStorage } from "node:async_hooks";
import { monitorEventLoopDelay, PerformanceObserver } from "node:perf_hooks";
import type { SqlDb, SqlValue } from "./db";
import type { Logger } from "./log";

// Lot D3 (C8 et C2) — **les mesures du serveur**, pour nommer les blocages de toute l'instance (des envois acceptés après 8 à 11 s, D1 § 6 bis) sans rien deviner. Node seulement (`server.ts` les crée et les
// donne à `createApi`) ; un `createApi` sans `mesures` n'en a aucune (tests, outils, Worker). Trois choses, toutes **sans donnée personnelle** (une route sans date ni identifiant, des durées, des nombres) :
//
// 1. **Le retard de la boucle d'événements.** Une sentinelle (un minuteur de 100 ms) mesure l'écart entre deux de ses passages. Un écart au-delà de `seuilBlocageMs` (1 s) écrit **une ligne « blocage »**
//    avec ce qui tournait (les requêtes en cours : route et âge), le temps de processeur consommé pendant l'écart (`cpuMs`) et les pauses du ramasse-miettes. **`type: "calcul"`** : le fil de Node était
//    occupé (processeur ≈ écart : un calcul ou le ramasse-miettes) ; **`type: "attente"`** : il n'a presque rien consommé (processus gelé hors requête par Cloud Run, ou hôte surchargé) ; **`enRequete`** dit si une
//    requête était en cours (alors Cloud Run allouait du processeur : l'attente n'est pas un gel). Un relevé par minute (`monitorEventLoopDelay`) : p50, p99, max, requêtes, mémoire.
// 2. **Les étapes d'un envoi** (`…/submit`) : lecture (débit, corps), contrôles (jour, versions, pseudo), rejeu, écriture, et le temps passé en SQL. **Une ligne seulement pour un envoi de plus de
//    `seuilEnvoiMs` (3 s).** Les étapes sont marquées par la plateforme (`readJson`, `spendReplays`) et par le premier `run` / `batch` qui suit le rejeu : aucun jeu n'a à les connaître.
// 3. **Le ramasse-miettes** : durée des pauses (`PerformanceObserver` `gc`), comptées dans le relevé de la minute ; une pause de plus de `seuilGcMs` (500 ms) écrit sa ligne.
//
// **Volume borné** : un relevé par minute et par instance (et seulement si l'instance a servi une requête), au plus 10 lignes « blocage », 20 lignes « envoi lent » et 10 lignes « ramasse-miettes long » par
// minute. Lire les lignes en production : `docs/plateforme/lots/lot-D3-serveur-minuit-memoire-blocages.md`.

export type EtapeEnvoi = "lecture" | "controles" | "rejeu" | "ecriture";
const ORDRE: readonly EtapeEnvoi[] = ["lecture", "controles", "rejeu", "ecriture"];

interface Requete {
  route: string;
  debut: number;
  etape: EtapeEnvoi;
  depuisEtape: number;
  etapes: Record<EtapeEnvoi, number>;
  sqlMs: number;
  sqlN: number;
  /** Le plus long retard de la boucle vu **pendant** cette requête. */
  retardMs: number;
}

export interface OptionsMesures {
  log: Logger;
  /** Pas de la sentinelle (100 ms). */
  pasMs?: number;
  /** Un écart de la boucle au-delà duquel une ligne « blocage » est écrite (1 000 ms). */
  seuilBlocageMs?: number;
  /** Un envoi plus long que cela écrit sa ligne d'étapes (3 000 ms). */
  seuilEnvoiMs?: number;
  /** Une pause du ramasse-miettes plus longue que cela écrit sa ligne (500 ms). */
  seuilGcMs?: number;
  /** Durée du relevé périodique (60 000 ms). */
  releveMs?: number;
  /** Les 24 h du tableau de bord se comptent par tranches de cette durée (60 000 ms). */
  trancheMs?: number;
  /** Lot D3b — l'horloge monotone en ms (`performance.now`) : un test la donne pour ne dépendre d'aucune durée réelle. */
  horloge?: () => number;
  /** Lot D3b — le temps de processeur du fil principal en µs (`cpuDuFil`) : un test le donne pour la même raison. */
  cpu?: () => number;
}

/** Ce que le tableau de bord de `/admin/` lit : l'instance qui répond (une instance de Cloud Run ne voit pas les autres). */
export interface InstantaneMesures {
  depuisMs: number;
  memoire: { rssMo: number; tasMo: number; externeMo: number };
  /** Le plus grand retard de la boucle d'événements **pendant une requête**, sur 24 h (ou depuis le démarrage de l'instance). */
  retardMax24hMs: number;
  blocages24h: number;
}

/** Ce que `process` sait lire du processeur (injectable : un test donne un `process` avec ou sans `threadCpuUsage`). */
export interface LecteurCpu {
  threadCpuUsage?: () => { user: number; system: number };
  cpuUsage: () => { user: number; system: number };
}

/**
 * Le temps de processeur consommé **par le fil principal** (µs). `process.threadCpuUsage` (Node ≥ 22.19) ne compte que ce fil ; sans lui `process.cpuUsage` compte aussi les fils de calcul et du ramasse-miettes, donc
 * un fil principal gelé pendant qu'un fil de calcul travaille passerait pour « occupé » : le type `calcul` n'est alors fiable que pour un processus sans fil de calcul actif.
 */
export function cpuDuFil(proc: LecteurCpu = process): number {
  const c = proc.threadCpuUsage?.() ?? proc.cpuUsage();
  return c.user + c.system;
}

export type TypeBlocage = "calcul" | "attente";

/**
 * **La décision** (lot D3b, séparée de la mesure pour être testée sur des valeurs injectées) : un écart entre deux passages de la sentinelle est un `calcul` si le processeur consommé par le fil couvre au moins la moitié de
 * l'écart (le fil de Node était occupé : un calcul ou le ramasse-miettes), sinon une `attente` (il n'a presque rien consommé : conteneur gelé hors requête, hôte surchargé).
 * @param cpuMs le processeur consommé par le fil pendant l'écart (ms)
 * @param ecartMs la durée de l'écart entre les deux passages (ms, pas de la sentinelle compris)
 */
export function typeDeBlocage(cpuMs: number, ecartMs: number): TypeBlocage {
  return cpuMs >= 0.5 * ecartMs ? "calcul" : "attente";
}

/** Ce que la sentinelle déduit d'un passage, à partir de ses seuls arguments (aucune horloge lue ici). Temps en ms, processeur en µs. */
export function analyserPassage(a: { maintenant: number; dernier: number; pasMs: number; cpu: number; dernierCpu: number }): { retardMs: number; ecartMs: number; cpuMs: number; type: TypeBlocage } {
  const ecartMs = a.maintenant - a.dernier;
  const retardMs = Math.max(0, ecartMs - a.pasMs);
  const cpuMs = (a.cpu - a.dernierCpu) / 1000;
  return { retardMs, ecartMs, cpuMs, type: typeDeBlocage(cpuMs, ecartMs) };
}

const LIGNES_PAR_MINUTE = { blocage: 10, envoi: 20, gc: 10 } as const;
const mo = (octets: number): number => Math.round((octets / 1_048_576) * 10) / 10;
const ms = (ns: number): number => Math.round(ns / 1e5) / 10;

export function creerMesures(options: OptionsMesures) {
  const { log } = options;
  const pas = options.pasMs ?? 100;
  const seuilBlocage = options.seuilBlocageMs ?? 1000;
  const seuilEnvoi = options.seuilEnvoiMs ?? 3000;
  const seuilGc = options.seuilGcMs ?? 500;
  const releveMs = options.releveMs ?? 60_000;
  const tranche = options.trancheMs ?? 60_000;
  const horloge = options.horloge ?? (() => performance.now());
  const cpu = options.cpu ?? (() => cpuDuFil());
  const contexte = new AsyncLocalStorage<Requete>();
  const enCours = new Set<Requete>();
  const demarreA = Date.now();

  // --- Le ramasse-miettes ---
  let gcDepuisSentinelle = 0;
  let gcMaxMinute = 0;
  let gcMsMinute = 0;
  let gcNMinute = 0;
  let observateur: PerformanceObserver | null = null;

  // --- La fenêtre d'une minute ---
  const histo = monitorEventLoopDelay({ resolution: 10 });
  let requetesMinute = 0;
  let enCoursMax = 0;
  let retardEnRequeteMinute = 0;
  let debutFenetre = Date.now();
  const lignes = { blocage: 0, envoi: 0, gc: 0 };

  // --- Les 24 h du tableau de bord : le plus grand retard vu en requête, par tranche ---
  const tranches = new Map<number, { retard: number; blocages: number }>();
  const TRANCHES_24H = Math.ceil(86_400_000 / tranche);
  function noterTranche(retard: number, blocage: boolean): void {
    const k = Math.floor(Date.now() / tranche);
    let t = tranches.get(k);
    if (!t) {
      t = { retard: 0, blocages: 0 };
      tranches.set(k, t);
      for (const ancienne of tranches.keys()) if (ancienne <= k - TRANCHES_24H) tranches.delete(ancienne);
    }
    if (retard > t.retard) t.retard = retard;
    if (blocage) t.blocages++;
  }

  // --- La sentinelle ---
  let dernier = horloge();
  let dernierCpu = cpu();
  let enRequeteAvant = false;
  let minuteur: ReturnType<typeof setInterval> | null = null;
  let releve: ReturnType<typeof setInterval> | null = null;

  function sentinelle(): void {
    const t = horloge();
    const cpuMaintenant = cpu();
    const { retardMs: retard, cpuMs, type } = analyserPassage({ maintenant: t, dernier, pasMs: pas, cpu: cpuMaintenant, dernierCpu });
    dernier = t;
    dernierCpu = cpuMaintenant;
    // Une requête en cours au passage précédent **et** à celui-ci : Cloud Run allouait du processeur tout l'écart. Une requête arrivée à la fin d'un gel (qui réveille le minuteur) n'en fait pas un blocage de requête.
    const enRequete = enCours.size > 0 && enRequeteAvant;
    const gc = gcDepuisSentinelle;
    gcDepuisSentinelle = 0;
    if (enCours.size > enCoursMax) enCoursMax = enCours.size;
    if (retard > 0 && enRequete) {
      if (retard > retardEnRequeteMinute) retardEnRequeteMinute = retard;
      for (const r of enCours) if (retard > r.retardMs) r.retardMs = retard;
      noterTranche(retard, retard >= seuilBlocage);
    }
    if (retard >= seuilBlocage && lignes.blocage < LIGNES_PAR_MINUTE.blocage) {
      lignes.blocage++;
      const routes = [...enCours]
        .sort((a, b) => a.debut - b.debut)
        .slice(0, 6)
        .map((r) => `${r.route} ${Math.round(t - r.debut)}ms ${r.etape}`)
        .join(", ");
      log("WARNING", "blocage de la boucle d'événements", {
        retardMs: Math.round(retard),
        cpuMs: Math.round(cpuMs),
        type,
        gcMs: Math.round(gc),
        enRequete,
        enCours: enCours.size,
        routes,
      });
    }
    enRequeteAvant = enCours.size > 0;
  }

  function releverMinute(): void {
    const maintenant = Date.now();
    const fenetre = maintenant - debutFenetre;
    const m = process.memoryUsage();
    if (requetesMinute > 0 || enCours.size > 0) {
      log("INFO", "boucle d'événements", {
        fenetreMs: fenetre,
        p50Ms: ms(histo.percentile(50)),
        p99Ms: ms(histo.percentile(99)),
        maxMs: ms(histo.max),
        maxEnRequeteMs: Math.round(retardEnRequeteMinute),
        requetes: requetesMinute,
        enCoursMax,
        gcN: gcNMinute,
        gcMs: Math.round(gcMsMinute),
        gcMaxMs: Math.round(gcMaxMinute),
        rssMo: mo(m.rss),
        tasMo: mo(m.heapUsed),
        externeMo: mo(m.external),
      });
    }
    histo.reset();
    requetesMinute = 0;
    enCoursMax = enCours.size;
    retardEnRequeteMinute = 0;
    gcMaxMinute = 0;
    gcMsMinute = 0;
    gcNMinute = 0;
    debutFenetre = maintenant;
    lignes.blocage = lignes.envoi = lignes.gc = 0;
  }

  function demarrer(): void {
    if (minuteur) return;
    histo.enable();
    dernier = horloge();
    dernierCpu = cpu();
    minuteur = setInterval(sentinelle, pas);
    minuteur.unref();
    releve = setInterval(releverMinute, releveMs);
    releve.unref();
    try {
      observateur = new PerformanceObserver((liste) => {
        for (const e of liste.getEntries()) {
          gcDepuisSentinelle += e.duration;
          gcMsMinute += e.duration;
          gcNMinute++;
          if (e.duration > gcMaxMinute) gcMaxMinute = e.duration;
          if (e.duration >= seuilGc && lignes.gc < LIGNES_PAR_MINUTE.gc) {
            lignes.gc++;
            log("WARNING", "ramasse-miettes long", { dureeMs: Math.round(e.duration), enCours: enCours.size });
          }
        }
      });
      observateur.observe({ entryTypes: ["gc"] });
    } catch {
      observateur = null; // pas de mesure du ramasse-miettes sur ce Node : le reste marche
    }
  }

  function arreter(): void {
    if (minuteur) clearInterval(minuteur);
    if (releve) clearInterval(releve);
    minuteur = releve = null;
    histo.disable();
    observateur?.disconnect();
    observateur = null;
  }

  // --- Une requête ---
  function marquer(etape: EtapeEnvoi): void {
    const r = contexte.getStore();
    if (!r || ORDRE.indexOf(etape) <= ORDRE.indexOf(r.etape)) return; // les étapes ne reculent jamais
    const t = horloge();
    r.etapes[r.etape] += t - r.depuisEtape;
    r.etape = etape;
    r.depuisEtape = t;
  }

  function suivre<T>(route: string, fn: () => Promise<T>): Promise<T> {
    const t = horloge();
    const r: Requete = { route, debut: t, etape: "lecture", depuisEtape: t, etapes: { lecture: 0, controles: 0, rejeu: 0, ecriture: 0 }, sqlMs: 0, sqlN: 0, retardMs: 0 };
    enCours.add(r);
    requetesMinute++;
    if (enCours.size > enCoursMax) enCoursMax = enCours.size;
    const fin = (): void => {
      enCours.delete(r);
      const total = horloge() - r.debut;
      r.etapes[r.etape] += horloge() - r.depuisEtape;
      if (total >= seuilEnvoi && route.endsWith("/submit") && lignes.envoi < LIGNES_PAR_MINUTE.envoi) {
        lignes.envoi++;
        log("WARNING", "envoi lent", {
          route,
          totalMs: Math.round(total),
          lectureMs: Math.round(r.etapes.lecture),
          controlesMs: Math.round(r.etapes.controles),
          rejeuMs: Math.round(r.etapes.rejeu),
          ecritureMs: Math.round(r.etapes.ecriture),
          sqlMs: Math.round(r.sqlMs),
          sqlN: r.sqlN,
          retardBoucleMs: Math.round(r.retardMs),
          enCours: enCours.size,
        });
      }
    };
    return contexte.run(r, fn).finally(fin);
  }

  /** La base, chronométrée : le temps passé en SQL de chaque requête, et le passage à l'étape « écriture » à la première écriture qui suit le rejeu. */
  function envelopper(db: SqlDb): SqlDb {
    async function chrono<T>(ecriture: boolean, f: () => Promise<T>): Promise<T> {
      const r = contexte.getStore();
      if (r && ecriture && r.etape === "rejeu") marquer("ecriture");
      const t = horloge();
      try {
        return await f();
      } finally {
        if (r) {
          r.sqlMs += horloge() - t;
          r.sqlN++;
        }
      }
    }
    return {
      run: (sql: string, params?: SqlValue[]) => chrono(true, () => db.run(sql, params)),
      first: <T>(sql: string, params?: SqlValue[]) => chrono(false, () => db.first<T>(sql, params)),
      all: <T>(sql: string, params?: SqlValue[]) => chrono(false, () => db.all<T>(sql, params)),
      ...(db.batch ? { batch: (statements: { sql: string; params?: SqlValue[] }[]) => chrono(true, () => db.batch!(statements)) } : {}),
    };
  }

  function instantane(): InstantaneMesures {
    const m = process.memoryUsage();
    let retard = 0;
    let blocages = 0;
    const limite = Math.floor(Date.now() / tranche) - TRANCHES_24H;
    for (const [k, t] of tranches) {
      if (k <= limite) continue;
      if (t.retard > retard) retard = t.retard;
      blocages += t.blocages;
    }
    return { depuisMs: Date.now() - demarreA, memoire: { rssMo: mo(m.rss), tasMo: mo(m.heapUsed), externeMo: mo(m.external) }, retardMax24hMs: Math.round(retard), blocages24h: blocages };
  }

  // `passage` et `releve` : la sentinelle et le relevé d'une minute, appelables à la main (lot D3b : un test les pilote avec une horloge injectée, sans attendre de minuteur).
  return { demarrer, arreter, marquer, suivre, envelopper, instantane, enCours: () => enCours.size, passage: sentinelle, releve: releverMinute };
}

export type Mesures = ReturnType<typeof creerMesures>;
