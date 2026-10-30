import { formatDay } from "@cdj/core";
import { compteLe as compteDansPeriodes, etatDe, liveFromDe, lirePeriodes, periodesApres, type EtatJeu, type PeriodeJeu } from "@cdj/core/jeux";
import { WithHeaders } from "./cache";
import { HttpError } from "./errors";
import type { Platform, RequestInfo, Statement } from "./games";
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
  /** Les instructions qui effacent les résultats rangés à part par l'aperçu (quand le jeu passe `on`) : ils ne deviennent jamais publics. */
  viderApercu?: () => Statement[];
}

interface LigneSql {
  jeu: string;
  etat: string;
  live_from: number | null;
  periodes: string;
  cle_hash: string | null;
  cle_creee_le: number | null;
  modifie_le: number;
}

interface Jeu {
  etat: EtatJeu;
  periodes: PeriodeJeu[];
  cleHash: string | null;
  cleCreeeLe: number | null;
  modifieLe: number;
}

const SELECT = "SELECT jeu, etat, live_from, periodes, cle_hash, cle_creee_le, modifie_le FROM jeux";
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
    lignes = new Map(rows.map((r) => [r.jeu, { etat: etatDe(r.etat), periodes: lirePeriodes(r.periodes), cleHash: r.cle_hash, cleCreeeLe: r.cle_creee_le, modifieLe: r.modifie_le }] as const));
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
    const corps = { jeux: Object.fromEntries(jeux.map((j) => [j.site, etat(j.site)])) };
    // Un aperçu de PR voit les jeux comme `on` pour les montrer (badge « Brouillon ») : la réponse dépend alors de l'hôte, jamais mise en cache partagé.
    if (apercuDePr(req)) return new WithHeaders({ ...corps, apercu: true }, { "Cache-Control": "no-store" });
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

  async function lister(): Promise<unknown> {
    lueA = -Infinity; // l'administrateur lit la base, pas la mémoire
    await charger();
    return {
      aujourdhui: formatDay(platform.today()),
      jeux: jeux.map((j) => {
        const g = lignes.get(j.site);
        const periodes = g?.periodes ?? [];
        return {
          jeu: j.site,
          nom: j.nom,
          etat: g?.etat ?? "off",
          /** Le premier jour entier où le jeu compte dans la journée (le jour qui suit l'activation), ou `null`. */
          liveFrom: jour(liveFromDe(periodes)),
          periodes: periodes.map(([du, au]) => ({ du: formatDay(du), au: jour(au) })),
          cle: { presente: !!g?.cleHash, creeeLe: g?.cleCreeeLe ? new Date(g.cleCreeeLe).toISOString() : null },
          modifieLe: g ? new Date(g.modifieLe).toISOString() : null,
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
    return r ? { etat: etatDe(r.etat), periodes: lirePeriodes(r.periodes), cleHash: r.cle_hash, cleCreeeLe: r.cle_creee_le, modifieLe: r.modifie_le } : null;
  }

  async function changerEtat(admin: string, site: string, corps: Corps): Promise<unknown> {
    confirme(corps);
    const j = jeuDe(site);
    if (corps.etat !== "off" && corps.etat !== "preview" && corps.etat !== "on") throw new HttpError(400, "invalid_action", "État attendu : off, preview ou on");
    const apres: EtatJeu = corps.etat;
    const avant = await ligne(site);
    const etatAvant: EtatJeu = avant?.etat ?? "off";
    if (apres === etatAvant) return await lister(); // rien à changer : pas de ligne de journal pour rien
    const t = now();
    const periodes = periodesApres(avant?.periodes ?? [], etatAvant, apres, platform.today());
    const instructions: Statement[] = [
      {
        sql: `INSERT INTO jeux (jeu, etat, live_from, periodes, modifie_le) VALUES (?, ?, ?, ?, ?)
              ON CONFLICT (jeu) DO UPDATE SET etat = excluded.etat, live_from = excluded.live_from, periodes = excluded.periodes, modifie_le = excluded.modifie_le`,
        params: [site, apres, liveFromDe(periodes), JSON.stringify(periodes), t],
      },
      ecrireJournal({ at: t, admin, action: "changer l'état d'un jeu", cible: site, avant: { etat: etatAvant }, apres: { etat: apres, liveFrom: jour(liveFromDe(periodes)) } }),
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
