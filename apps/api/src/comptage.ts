import type { LibsqlClientLike } from "./libsql";

/**
 * Lot R14 — compter ce que chaque requête fait lire et écrire, **sur une base libSQL locale** (`file:`), pour les outils de mesure et le test de garde des routes chaudes.
 * Jamais branché sur le serveur : il lit `sqlite_stmt`, une table du moteur natif, absente du client HTTP de Turso.
 *
 * Ce que Turso facture, ce sont les lignes **lues par le moteur** (un `SCAN` d'une table de 10 000 lignes en lit 10 000 pour n'en rendre qu'une). Le moteur local n'expose pas
 * ce compteur exact ; on en garde les deux parts qu'il donne :
 *   - `parcourues` : les pas d'un parcours complet de table ou d'index (`nscan` de `sqlite_stmt`, `SQLITE_STMTSTATUS_FULLSCAN_STEP`) — c'est la part qu'un index supprime ;
 *   - `renvoyees` : les lignes que la requête rend (chacune est lue au moins une fois).
 * `lues` = leur somme : **une estimation basse** (une recherche par index lit aussi les entrées de l'index qu'elle écarte ; un `COUNT` sur une plage d'index ne rend qu'une ligne).
 * Le plan (`apps/api/src/plans.ts`) complète : il dit si la requête parcourt une table. `etapes` (`nstep`, les instructions du moteur) sert de témoin de travail.
 */
export interface LigneComptage {
  sql: string;
  appels: number;
  parcourues: number;
  renvoyees: number;
  ecrites: number;
  etapes: number;
}

export interface Comptage {
  instructions: number;
  parcourues: number;
  renvoyees: number;
  ecrites: number;
  etapes: number;
  /** Instructions passées en lot (transaction) : comptées, mais leurs parcours ne le sont pas (le moteur les exécute sur une connexion à part). */
  enLot: number;
  parRequete: Map<string, LigneComptage>;
}

export type ClientCompte = LibsqlClientLike & {
  comptage: Comptage;
  /** Les lignes lues estimées jusqu'ici (`parcourues + renvoyees`). */
  lues(): number;
  /** Remet les compteurs à zéro (avant la route à mesurer). */
  remettre(): void;
};

const vide = (): Comptage => ({ instructions: 0, parcourues: 0, renvoyees: 0, ecrites: 0, etapes: 0, enLot: 0, parRequete: new Map() });

export function avecComptage(client: LibsqlClientLike): ClientCompte {
  const comptage = vide();
  const totaux = async () => {
    const res = await client.execute({ sql: "SELECT COALESCE(SUM(nscan), 0) AS s, COALESCE(SUM(nstep), 0) AS t FROM sqlite_stmt", args: [] });
    const ligne = res.rows[0] as unknown as { s: number; t: number };
    return { parcourues: Number(ligne.s), etapes: Number(ligne.t) };
  };
  const compte: ClientCompte = {
    comptage,
    lues: () => comptage.parcourues + comptage.renvoyees,
    remettre() {
      Object.assign(comptage, vide());
    },
    async execute(stmt) {
      const avant = await totaux();
      const res = await client.execute(stmt);
      const apres = await totaux();
      const parcourues = Math.max(0, apres.parcourues - avant.parcourues);
      const etapes = Math.max(0, apres.etapes - avant.etapes);
      const renvoyees = res.rows.length;
      comptage.instructions++;
      comptage.parcourues += parcourues;
      comptage.renvoyees += renvoyees;
      comptage.ecrites += res.rowsAffected;
      comptage.etapes += etapes;
      const cle = stmt.sql.replace(/\s+/g, " ").trim();
      const ligne = comptage.parRequete.get(cle) ?? { sql: cle, appels: 0, parcourues: 0, renvoyees: 0, ecrites: 0, etapes: 0 };
      ligne.appels++;
      ligne.parcourues += parcourues;
      ligne.renvoyees += renvoyees;
      ligne.ecrites += res.rowsAffected;
      ligne.etapes += etapes;
      comptage.parRequete.set(cle, ligne);
      return res;
    },
    async batch(stmts, mode) {
      comptage.instructions += stmts.length;
      comptage.enLot += stmts.length;
      return client.batch(stmts, mode);
    },
    close: () => client.close(),
  };
  return compte;
}

/** Les `n` requêtes qui lisent le plus, pour un rapport lisible. */
export function plusCouteuses(c: Comptage, n = 10): LigneComptage[] {
  return [...c.parRequete.values()].sort((a, b) => b.parcourues + b.renvoyees - (a.parcourues + a.renvoyees)).slice(0, n);
}
