import { formatDay, parseDay } from "@cdj/core";
import { parisDayStart } from "@cdj/clock";
import { compteLe as compteDansPeriodes, debutDePeriode, etatDe, jeuPartyDuJour, liveFromDe, lirePeriodes, periodesApres, prochainJourParty, type CategorieJeu, type EtatJeu, type JeuPartyEnLice, type PeriodeJeu } from "@cdj/core/jeux";
import { WithHeaders } from "./cache";
import { FICHES_SERVEUR } from "./fiches.generated";
import { HttpError } from "./errors";
import type { AdminDuJeu, Platform, RequestInfo, Statement } from "./games";
import { ecrireJournal } from "./journaux";
import { sha256Hex } from "./players";

// Lot P (plateforme) — l'**interrupteur des jeux** : Nathan décide, depuis l'administration et sans redéployer, quand un jeu devient visible. Trois états par jeu :
//
//   | état      | accueil, journée, série, partage, classement | page du jeu /<jeu>/                    | API du jeu (envoi, classement)                     |
//   | `off`     | absent                                        | « Bientôt »                            | refuse : 404 `game_unavailable`                    |
//   | `preview` | absent                                        | jouable avec la clé d'aperçu (bandeau) | accepte avec la clé seulement ; résultats à part   |
//   | `on`      | présent (la journée : voir `live_from`)       | jouable par tous                       | normal                                             |
//
// **Un jeu absent de la table vaut `off`** (un nouveau jeu naît caché). Track et Jump, déjà publics, sont semés `on` une seule fois par le schéma (`semerJeux`, `db.ts` : `JEUX_PUBLICS`, `meta.jeux_semes`) : une lecture n'écrit jamais.
// **La journée** ne compte un jeu qu'à partir du premier jour entier où il est `on` (`live_from`), et plus à partir du lendemain de sa désactivation : les périodes `[du, au)`
// de `@cdj/core/jeux` (`periodesApres`, testé). Désactiver ne supprime rien. **La clé d'aperçu** n'est gardée qu'en empreinte et ne passe jamais dans une adresse : elle arrive
// dans l'en-tête `X-Preview-Key`. Les **aperçus de PR** (recette, jamais la production) voient tous les jeux.
//
//   Public : GET /api/jeux                                   les états (`{ jeux: { track: "on", … } }`), cache public de 30 s (`s-maxage`)
//   Administration (session, `X-Cdj-Admin`, `confirmer: true`, chaque action au journal **dans la même transaction**, sans donnée personnelle) :
//     GET  /api/admin/jeux                                   les jeux, leur état, leurs périodes, la clé (présente ou non, jamais sa valeur)
//     POST /api/admin/jeux/<jeu>/etat   { etat }             l'interrupteur
//     POST /api/admin/jeux/<jeu>/cle                         génère une clé (rendue **une seule fois**), remplace la précédente
//     POST /api/admin/jeux/<jeu>/cle/revoquer                révoque la clé
// Guide : apps/api/CLAUDE.md, « Publication des jeux (lot P) ».

/** Cache de la liste des jeux : par instance, relue au plus toutes les 30 s (et à chaque changement fait par cette instance). */
export const JEUX_TTL_MS = 30_000;
/** Cache public de `GET /api/jeux` : le cache partagé de Firebase Hosting (`s-maxage`) ; le navigateur revalide. */
export const JEUX_CACHE_S = 30;
/** Lectures de `GET /api/jeux` par adresse et par fenêtre de débit (10 minutes). */
export const JEUX_LECTURES_PAR_ADRESSE = 120;
/** L'en-tête qui porte la clé d'aperçu (jamais l'adresse). */
export const ENTETE_CLE_APERCU = "X-Preview-Key";

/** Un jeu de la plateforme vu par l'interrupteur : son dossier sur le site (le nom public, `track`, `jump`), son nom, et ce qui efface ses résultats d'aperçu. */
export interface JeuInterrupteur {
  /** Le code du registre (`cdj`, `jump`). */
  code: string;
  /** Le dossier du jeu sur le site : la clé de l'interrupteur et de l'adresse d'aperçu. */
  site: string;
  nom: string;
  /** Lot PA1b : la catégorie (crochet `portail`) et le premier jour du jeu : le tour de rôle des jeux Party (`party`, plus bas) ne compte que ceux de catégorie `party`. */
  categorie?: CategorieJeu;
  premierJour?: number;
  /** Les instructions qui effacent les résultats rangés à part par l'aperçu (quand le jeu passe `on`) : ils ne deviennent jamais publics. */
  viderApercu?: () => Statement[];
  /** Lot N3 : le nombre de joueurs qui ont un résultat ce jour-là (une seule requête indexée, un nombre et jamais une ligne de joueur) ; absent : le jeu n'a pas de crochet d'administration (`null` dans la liste). */
  joueursDuJour?: (jour: number) => Promise<number>;
}

/** Lot N3 : ce qui interdit une position de l'interrupteur — un **code** (le panneau l'écrit, jamais un message du serveur) et ses champs. Le serveur reste le juge : `changerEtat` refuse avec le même code. */
export interface Blocage {
  code: "identite_incomplete";
  /** Les champs de l'identité de la fiche encore « à choisir » (`police`, `motif`, `illustration`). */
  manque: string[];
}

/** Lot N3 : la liste des jeux est gardée en mémoire 30 s pour les compteurs du jour (une requête par jeu et par instance, pas par lecture de l'administrateur). */
export const JOUEURS_DU_JOUR_TTL_MS = 30_000;

interface LigneSql {
  jeu: string;
  etat: string;
  live_from: number | null;
  periodes: string;
  cle_hash: string | null;
  cle_creee_le: number | null;
  modifie_le: number;
  etat_le: number | null;
}

interface Jeu {
  etat: EtatJeu;
  periodes: PeriodeJeu[];
  cleHash: string | null;
  cleCreeeLe: number | null;
  modifieLe: number;
  /** Lot N3 : le dernier changement d'état (`null` : avant la colonne, on prend `modifieLe`). */
  etatLe: number | null;
}

const SELECT = "SELECT jeu, etat, live_from, periodes, cle_hash, cle_creee_le, modifie_le, etat_le FROM jeux";
type Corps = Record<string, unknown>;

/** Comparaison à temps constant de deux empreintes (hexadécimales, de même longueur). */
function memeEmpreinte(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/** Une clé d'aperçu : 24 octets au hasard (192 bits), en base 64 d'adresse. Rendue une seule fois à l'administrateur. */
function nouvelleCle(): string {
  const o = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Une adresse d'aperçu de PR (`<site>--pr-<n>-<empreinte>.web.app`) : le seul endroit où un jeu `off` se montre sans clé. */
const APERCU_DE_PR = /--pr-\d+-[a-z0-9]+\.web\.app$/i;

/**
 * Lot N3 : le compteur « joueurs du jour » d'un jeu pour la ligne de l'administration — **un nombre**, jamais une ligne de joueur. Il lit les tables que le jeu déclare dans son crochet `admin.activite`
 * (celles du tableau de bord) : une seule requête indexée sur le jour (`day = ?`, plus la portée du jeu sur une table partagée), un joueur compté une fois même s'il a plusieurs lignes. Sans crochet : `undefined`.
 */
export function joueursDuJourDe(platform: Platform, admin: AdminDuJeu | undefined): ((jour: number) => Promise<number>) | undefined {
  const activite = admin?.activite;
  if (!activite?.length) return undefined;
  const sql = `SELECT COUNT(*) AS n FROM (${activite.map((a) => `SELECT ${a.joueur} AS joueur FROM ${a.table} WHERE ${a.portee ? `${a.portee} AND ` : ""}${a.jour} = ?`).join(" UNION ")})`;
  return async (jour) => (await platform.db.first<{ n: number }>(sql, activite.map(() => jour)))?.n ?? 0;
}

export function createJeux(platform: Platform, jeux: readonly JeuInterrupteur[]) {
  const { db, now, log } = platform;
  const parSite = new Map(jeux.map((j) => [j.site, j] as const));
  const parCode = new Map(jeux.map((j) => [j.code, j] as const));

  let lignes = new Map<string, Jeu>();
  let lueA = -Infinity;
  let enCours: Promise<void> | null = null;

  const executer = async (statements: Statement[]): Promise<void> => {
    if (db.batch) await db.batch(statements);
    else for (const s of statements) await db.run(s.sql, s.params);
  };

  async function lire(): Promise<void> {
    const rows = await db.all<LigneSql>(SELECT);
    lignes = new Map(rows.map((r) => [r.jeu, { etat: etatDe(r.etat), periodes: lirePeriodes(r.periodes), cleHash: r.cle_hash, cleCreeeLe: r.cle_creee_le, modifieLe: r.modifie_le, etatLe: r.etat_le }] as const));
    lueA = now();
  }

  /** La liste des jeux, en mémoire ; relue au plus toutes les `JEUX_TTL_MS` (un seul chargement même si deux requêtes arrivent ensemble). */
  async function charger(): Promise<void> {
    if (now() - lueA < JEUX_TTL_MS) return;
    enCours ??= lire().finally(() => {
      enCours = null;
    });
    await enCours;
  }

  /** L'état d'un jeu (à lire après `charger()`) : **absent de la table = `off`**. */
  const etat = (site: string): EtatJeu => lignes.get(site)?.etat ?? "off";
  /** Ce jour-là, le jeu compte-t-il dans la journée (série, journée parfaite, classement du jour, partage) ? */
  const compteLe = (site: string, jour: number): boolean => compteDansPeriodes(lignes.get(site)?.periodes ?? [], jour);
  /** Lot F1 : le premier jour où le jeu compte dans sa période en cours (`live_from`), ou `null` sans période : la pastille « Nouveau » en dérive (`estNouveau`). */
  const liveFrom = (site: string): number | null => liveFromDe(lignes.get(site)?.periodes ?? []);

  /** Vrai pour une requête venue d'un aperçu de PR, hors production : ses jeux `off` se montrent et se jouent (résultats à part). */
  function apercuDePr(req: Request): boolean {
    if (platform.environment === "production") return false;
    for (const h of ["origin", "x-forwarded-host", "x-fh-requested-host"]) {
      const v = req.headers.get(h);
      if (!v) continue;
      let hote = v;
      try {
        hote = new URL(v.includes("://") ? v : `https://${v}`).hostname;
      } catch {
        continue;
      }
      if (APERCU_DE_PR.test(hote)) return true;
    }
    return false;
  }

  /** La clé d'aperçu de la requête est-elle la bonne (et non révoquée) ? Empreinte comparée à temps constant ; rien n'est calculé sans en-tête. */
  async function cleValide(site: string, req: Request): Promise<boolean> {
    const cle = req.headers.get(ENTETE_CLE_APERCU);
    const attendu = lignes.get(site)?.cleHash;
    if (!cle || !attendu || cle.length > 128) return false;
    return memeEmpreinte(await sha256Hex(cle), attendu);
  }

  /**
   * La garde d'un jeu : `on` pour tous ; `preview` avec la clé (ou depuis un aperçu de PR) ; sinon **404 `game_unavailable`**. Un jeu `off` ne s'ouvre pas avec une clé : seul
   * un aperçu de PR (recette) le montre. Rend le mode : `preview` = ce que l'appel écrit est rangé à part.
   */
  async function garde(site: string, req: Request): Promise<"on" | "preview"> {
    await charger();
    const e = etat(site);
    if (e === "on") return "on";
    if (apercuDePr(req)) return "preview";
    if (e === "preview" && (await cleValide(site, req))) return "preview";
    throw new HttpError(404, "game_unavailable", "Ce jeu n'est pas disponible");
  }

  // --- Public ------------------------------------------------------------------------------------------------------------------------
  async function routePublique(path: string, req: Request, info: RequestInfo): Promise<unknown> {
    if (path !== "/api/jeux") return undefined;
    if (req.method !== "GET") throw new HttpError(405, "method_not_allowed", "GET attendu");
    await platform.readHitAddress(info, "jx", JEUX_LECTURES_PAR_ADRESSE);
    await charger();
    const apercu = apercuDePr(req);
    const jourParis = platform.today();
    const tour = party(jourParis, apercu);
    // Lot PA1b : `party` n'existe que si le registre a un jeu Party ; `date` dit le jour de Paris du calcul (la réponse est gardée 30 s : un client compare avant de s'en servir).
    const corps = { jeux: Object.fromEntries(jeux.map((j) => [j.site, etat(j.site)])), ...(tour ? { party: { date: formatDay(jourParis), ...tour } } : {}) };
    // Un aperçu de PR voit les jeux comme `on` pour les montrer (badge « Brouillon ») : la réponse dépend alors de l'hôte, jamais mise en cache partagé.
    if (apercu) return new WithHeaders({ ...corps, apercu: true }, { "Cache-Control": "no-store" });
    // `max-age=0` : le navigateur revalide à chaque ouverture ; `s-maxage=30` : le cache de Firebase Hosting, partagé par tous les joueurs, garde la réponse 30 s (comme le message en direct).
    return new WithHeaders(corps, { "Cache-Control": `public, max-age=0, s-maxage=${JEUX_CACHE_S}` });
  }

  // --- Administration -----------------------------------------------------------------------------------------------------------------
  const confirme = (corps: Corps) => {
    if (corps.confirmer !== true) throw new HttpError(400, "invalid_action", "Confirmation attendue");
  };
  const methode = (req: Request, attendu: "GET" | "POST"): void => {
    if (req.method !== attendu) throw new HttpError(405, "method_not_allowed", `${attendu} attendu`);
  };
  const jour = (d: number | null) => (d === null ? null : formatDay(d));

  /** Lot N3 : la fiche d'un jeu côté serveur (catégorie, couleur, identité) — celle que `npm run fiches` a écrite. */
  const ficheDe = (site: string) => FICHES_SERVEUR.find((f) => f.id === site) as { categorie?: string; fond?: string; etatDepart?: string; premierJour?: string; identiteManque?: readonly string[] } | undefined;

  /**
   * Lot N3 : ce qui interdit une position de l'interrupteur. Aujourd'hui : l'identité de la fiche incomplète (lot K5 : ni `preview` ni `on` ; `off` est toujours permis). Une règle de plus s'ajoute ici :
   * la liste (`bloque`) et le refus (`changerEtat`) la lisent au même endroit, le panneau n'a rien à recalculer.
   */
  function blocage(site: string, vers: EtatJeu): Blocage | null {
    const manque = ficheDe(site)?.identiteManque;
    return vers !== "off" && manque?.length ? { code: "identite_incomplete", manque: [...manque] } : null;
  }

  /** Les joueurs du jour d'un jeu : un nombre, gardé 30 s par instance ; `null` sans crochet (le panneau écrit « – »). Aucune donnée de joueur ne sort. */
  const joueursMemo = new Map<string, { at: number; jour: number; n: number | null }>();
  async function joueursDuJour(j: JeuInterrupteur, jourParis: number): Promise<number | null> {
    if (!j.joueursDuJour) return null;
    const m = joueursMemo.get(j.site);
    if (m && m.jour === jourParis && now() - m.at < JOUEURS_DU_JOUR_TTL_MS) return m.n;
    let n: number | null;
    try {
      n = await j.joueursDuJour(jourParis);
    } catch {
      n = null; // un compteur qui échoue ne ferme pas la page : la ligne écrit « – »
    }
    joueursMemo.set(j.site, { at: now(), jour: jourParis, n });
    return n;
  }

  /**
   * Depuis quand le jeu est dans son état : `etat_le` ; **sans lui** (une ligne d'avant la colonne), un jeu `on` public d'emblée (Track, Jump : semés `on` par le schéma) date de son premier jour — la date de leur
   * mise en ligne, pas celle du semis —, sinon la dernière écriture de la ligne (`modifie_le`). Limite assumée : un jeu changé d'état avant la colonne et revenu à `on` garde la date de son premier jour.
   */
  function etatLe(site: string, g: Jeu): number {
    if (g.etatLe !== null) return g.etatLe;
    const f = ficheDe(site);
    const premier = g.etat === "on" && f?.etatDepart === "on" && f.premierJour ? parseDay(f.premierJour) : null;
    return premier === null ? g.modifieLe : parisDayStart(premier);
  }

  // --- Lot PA1b : le tour de rôle des jeux Party ---------------------------------------------------------------------------------------------------
  // **Le jeu Party d'un jour** se calcule à partir du seul numéro du jour et des jeux Party qui **comptent ce jour-là** (périodes `[du, au)` de l'interrupteur, lot P) : un jeu ouvert ou fermé en cours de journée
  // compte à partir du lendemain, donc ne change pas le jeu du jour commencé ; aucune table, un jour passé se recalcule à l'identique. L'ordre est celui des dates d'ouverture (début de la période du jour), puis du
  // dossier. **En aperçu** (aperçu de PR, clé d'aperçu), tous les jeux Party du registre sont en lice, dès leur premier jour : un jeu en brouillon se montre alors « classé aujourd'hui » quand son tour vient.
  const aPartie = jeux.some((j) => j.categorie === "party");
  /** Les jeux Party en lice ce jour-là. */
  function partyEnLice(jour: number, tout: boolean): JeuPartyEnLice[] {
    return jeux.flatMap((j): JeuPartyEnLice[] => {
      if (j.categorie !== "party") return [];
      if (tout) return j.premierJour !== undefined && j.premierJour <= jour ? [{ site: j.site, depuis: j.premierJour }] : [];
      const depuis = debutDePeriode(lignes.get(j.site)?.periodes ?? [], jour);
      return depuis === null ? [] : [{ site: j.site, depuis }];
    });
  }
  /** Le dossier du jeu Party de ce jour, ou `null` (à lire après `charger()`). */
  const partyDuJour = (jour: number, tout = false): string | null => jeuPartyDuJour(partyEnLice(jour, tout), jour);
  /** Le prochain jour (après `jour`) où ce jeu sera en tête, si les jeux en lice restent ceux de demain (un jeu ouvert aujourd'hui y est, un jeu fermé aujourd'hui n'y est plus). */
  const partyProchain = (site: string, jour: number, tout = false): string | null => {
    const d = prochainJourParty(partyEnLice(jour + 1, tout), site, jour);
    return d === null ? null : formatDay(d);
  };
  /** Ce que `GET /api/jeux` et `GET /api/portail/jour` écrivent : le jeu du jour et la prochaine date de chaque jeu Party en lice ; `undefined` tant que le registre n'a aucun jeu Party (la forme d'avant, bancs inchangés). */
  function party(jour: number, tout = false): { jeu: string | null; prochains: Record<string, string> } | undefined {
    if (!aPartie) return undefined;
    const prochains: Record<string, string> = {};
    for (const j of partyEnLice(jour + 1, tout)) {
      const d = partyProchain(j.site, jour, tout);
      if (d !== null) prochains[j.site] = d;
    }
    return { jeu: partyDuJour(jour, tout), prochains };
  }

  async function lister(): Promise<unknown> {
    lueA = -Infinity; // l'administrateur lit la base, pas la mémoire
    await charger();
    const aujourdhui = platform.today();
    const compteurs = await Promise.all(jeux.map((j) => joueursDuJour(j, aujourdhui)));
    return {
      aujourdhui: formatDay(aujourdhui),
      jeux: jeux.map((j, i) => {
        const g = lignes.get(j.site);
        const periodes = g?.periodes ?? [];
        const fiche = ficheDe(j.site);
        return {
          jeu: j.site,
          nom: j.nom,
          etat: g?.etat ?? "off",
          /** Lot N3 : la catégorie de la fiche (`jour`, `arcade`, …) et la couleur du jeu (`etiquette.fond`) : la vignette et le filtre de la ligne. */
          categorie: fiche?.categorie ?? "jour",
          couleur: fiche?.fond ?? null,
          /** Le premier jour entier où le jeu compte dans la journée (le jour qui suit l'activation), ou `null`. */
          liveFrom: jour(liveFromDe(periodes)),
          periodes: periodes.map(([du, au]) => ({ du: formatDay(du), au: jour(au) })),
          cle: { presente: !!g?.cleHash, creeeLe: g?.cleCreeeLe ? new Date(g.cleCreeeLe).toISOString() : null },
          modifieLe: g ? new Date(g.modifieLe).toISOString() : null,
          /** Lot N3 : depuis quand le jeu est dans cet état (le dernier changement d'état, sinon la dernière écriture de sa ligne) ; `null` : un jeu qui n'a jamais eu de ligne. */
          etatDepuis: g ? new Date(etatLe(j.site, g)).toISOString() : null,
          /** Lot N3 : les joueurs qui ont un résultat aujourd'hui (un nombre) ; `null` : le jeu n'a pas de compteur. */
          joueursAujourdhui: compteurs[i],
          /** Lot N3 : ce qui interdit chaque position (`null` : permise). `off` n'est jamais interdit. */
          bloque: { off: null, preview: blocage(j.site, "preview"), on: blocage(j.site, "on") },
        };
      }),
    };
  }

  const jeuDe = (brut: string): JeuInterrupteur => {
    const j = parSite.get(brut);
    if (!j) throw new HttpError(400, "invalid_action", "Jeu inconnu");
    return j;
  };

  /** La ligne du jeu telle que la base la garde (lue à l'instant : l'action part de l'état réel, pas de la mémoire). */
  async function ligne(site: string): Promise<Jeu | null> {
    const r = await db.first<LigneSql>(`${SELECT} WHERE jeu = ?`, [site]);
    return r ? { etat: etatDe(r.etat), periodes: lirePeriodes(r.periodes), cleHash: r.cle_hash, cleCreeeLe: r.cle_creee_le, modifieLe: r.modifie_le, etatLe: r.etat_le } : null;
  }

  async function changerEtat(admin: string, site: string, corps: Corps): Promise<unknown> {
    confirme(corps);
    const j = jeuDe(site);
    if (corps.etat !== "off" && corps.etat !== "preview" && corps.etat !== "on") throw new HttpError(400, "invalid_action", "État attendu : off, preview ou on");
    const apres: EtatJeu = corps.etat;
    // Lot K5 : un jeu dont l'identité (police, motif, illustration) vaut encore « à choisir » ne passe ni en `preview` ni en `on` (`etatPermis`, `@cdj/core/fiche`) ; `off` est toujours permis.
    // Lot K5b : un code à part, avec les champs qui manquent (`manque`) : le panneau les dit (le client n'affiche jamais un message du serveur).
    const bloque = blocage(site, apres);
    if (bloque) throw new HttpError(400, "identite_incomplete", "L'identité du jeu n'est pas complète (police, motif ou illustration « à choisir ») : elle est à remplir dans sa fiche avant l'aperçu.", {}, { manque: bloque.manque });
    const avant = await ligne(site);
    const etatAvant: EtatJeu = avant?.etat ?? "off";
    if (apres === etatAvant) return await lister(); // rien à changer : pas de ligne de journal pour rien
    const t = now();
    const periodes = periodesApres(avant?.periodes ?? [], etatAvant, apres, platform.today());
    const instructions: Statement[] = [
      {
        sql: `INSERT INTO jeux (jeu, etat, live_from, periodes, modifie_le, etat_le) VALUES (?, ?, ?, ?, ?, ?)
              ON CONFLICT (jeu) DO UPDATE SET etat = excluded.etat, live_from = excluded.live_from, periodes = excluded.periodes, modifie_le = excluded.modifie_le, etat_le = excluded.etat_le`,
        params: [site, apres, liveFromDe(periodes), JSON.stringify(periodes), t, t],
      },
      // Lot N3 : le bouton « Annuler » du panneau remet l'état d'avant : même route, `annulation: true` ; **chaque changement et chaque annulation restent au journal**, l'annulation sous son propre nom.
      ecrireJournal({ at: t, admin, action: corps.annulation === true ? "annuler le changement d'état d'un jeu" : "changer l'état d'un jeu", cible: site, avant: { etat: etatAvant }, apres: { etat: apres, liveFrom: jour(liveFromDe(periodes)) } }),
    ];
    // Un résultat d'aperçu ne devient jamais public : quand le jeu passe `on`, ce que l'aperçu avait rangé à part est effacé (dans la même transaction).
    if (apres === "on" && j.viderApercu) instructions.push(...j.viderApercu());
    await executer(instructions);
    lueA = -Infinity;
    log("INFO", "jeux : état changé", { jeu: site, de: etatAvant, a: apres });
    return await lister();
  }

  async function genererCle(admin: string, site: string, corps: Corps): Promise<unknown> {
    confirme(corps);
    jeuDe(site);
    const cle = nouvelleCle();
    const t = now();
    const avant = await ligne(site);
    await executer([
      {
        sql: `INSERT INTO jeux (jeu, etat, live_from, periodes, cle_hash, cle_creee_le, modifie_le) VALUES (?, 'off', NULL, '[]', ?, ?, ?)
              ON CONFLICT (jeu) DO UPDATE SET cle_hash = excluded.cle_hash, cle_creee_le = excluded.cle_creee_le, modifie_le = excluded.modifie_le`,
        params: [site, await sha256Hex(cle), t, t],
      },
      // Le journal ne garde ni la clé ni son empreinte : seulement qu'elle a été générée (et si elle en remplaçait une).
      ecrireJournal({ at: t, admin, action: "générer la clé d'aperçu", cible: site, avant: { cle: !!avant?.cleHash }, apres: { cle: true } }),
    ]);
    lueA = -Infinity;
    // La clé est rendue **une seule fois** : le serveur n'en garde que l'empreinte.
    return { cle, jeu: site };
  }

  async function revoquerCle(admin: string, site: string, corps: Corps): Promise<unknown> {
    confirme(corps);
    jeuDe(site);
    const avant = await ligne(site);
    if (!avant?.cleHash) throw new HttpError(400, "invalid_action", "Ce jeu n'a pas de clé d'aperçu");
    const t = now();
    await executer([
      { sql: "UPDATE jeux SET cle_hash = NULL, cle_creee_le = NULL, modifie_le = ? WHERE jeu = ?", params: [t, site] },
      ecrireJournal({ at: t, admin, action: "révoquer la clé d'aperçu", cible: site, avant: { cle: true }, apres: { cle: false } }),
    ]);
    lueA = -Infinity;
    return await lister();
  }

  /** Les routes d'administration (`reste` : ce qui suit `/api/admin/`), appelées par `admin.ts` une fois la session vérifiée ; `undefined` : pas d'ici. */
  async function routeAdmin(reste: string, req: Request, admin: string, lireCorps: () => Promise<Corps>): Promise<unknown> {
    if (reste === "jeux") {
      methode(req, "GET");
      return await lister();
    }
    const m = /^jeux\/([^/]+)\/(etat|cle|cle\/revoquer)$/.exec(reste);
    if (!m) return undefined;
    methode(req, "POST");
    const corps = await lireCorps();
    if (m[2] === "etat") return await changerEtat(admin, m[1]!, corps);
    if (m[2] === "cle") return await genererCle(admin, m[1]!, corps);
    return await revoquerCle(admin, m[1]!, corps);
  }

  return {
    charger,
    etat,
    compteLe,
    liveFrom,
    partyDuJour,
    partyProchain,
    party,
    garde,
    apercuDePr,
    routePublique,
    routeAdmin,
    /** Oublie la liste gardée (tests, remise à zéro) : la prochaine requête la relit. */
    oublier: () => {
      lueA = -Infinity;
    },
    /** Le jeu du registre pour ce code (`cdj` → `track`), ou `undefined`. */
    siteDe: (code: string) => parCode.get(code)?.site,
  };
}

export type Jeux = ReturnType<typeof createJeux>;
